import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createServerClient } from "@supabase/ssr";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import { clientEnv } from "@shared/config/client-env";

const SUPABASE_AUTH_TOKEN_COOKIE = /^sb-[^.]+-auth-token(?:\.\d+)?$/;

/**
 * Folhário Next 16 proxy — Plan 02-07 Task 3 + debug session
 * `publiclayout-auth-refresh-token-throw` (cold-start refresh fix).
 *
 * Two responsibilities:
 *
 * 1. **`/api/v1/*` fast-fail bearer gate** (Plan 02-07). Composes a fast
 *    missing-bearer rejection over `/api/v1/*` with a typed, anchored-regex
 *    public allowlist. Cryptographic JWT verification is NOT done here —
 *    that is the route helper's job (`requireApiUser` in
 *    `src/shared/api/auth.ts`). Routes are authoritative; the proxy is
 *    fast fail only (D-34/D-47, T-02-18 mitigation).
 *
 * 2. **`@supabase/ssr` cookie refresh** for non-API page routes (debug
 *    session publiclayout-auth-refresh-token-throw). Server Components
 *    use `getReadOnlySupabaseServerClient` whose no-op `setAll` (Pitfall
 *    6) cannot clear stale cookies — so without a middleware step that
 *    does have cookie-write capability, every Server Component render
 *    on a cold start with a leftover `sb-*` cookie triggers a failed
 *    refresh inside auth-js, which `console.error`s the AuthApiError
 *    and surfaces as "Console AuthApiError" in the Next 16 dev overlay
 *    (attributed to the awaiting React owner — PublicLayout / AppLayout).
 *    Running `createServerClient` + `auth.getUser()` here, with a real
 *    request/response cookie adapter, lets valid sessions refresh
 *    cleanly. For the FAILURE case (refresh rejected because the token
 *    was revoked or expired) `@supabase/ssr`'s internal storage flush
 *    via `onAuthStateChange` does NOT reliably emit a clearing
 *    Set-Cookie header against this version pair (auth-js@2.104.1 +
 *    ssr@0.10.2) — see the regression spec
 *    `tests/e2e/auth-cold-start-stale-cookie.spec.ts`. We therefore
 *    explicitly clear every `sb-*-auth-token` chunk on the response
 *    when `getUser()` returns a non-"session missing" error. That is
 *    side-stepping library internals on purpose: the regex match and
 *    Set-Cookie emission are now testable end-to-end and don't depend
 *    on auth-js firing SIGNED_OUT inside `_removeSession`.
 *
 * Body discipline (T-02-37): the `/api/v1/*` branch reads ONLY the URL
 * pathname and the Authorization header. It MUST NOT consume the request
 * body stream (no body reads, no JSON parsing, no form parsing) — doing
 * so would render the downstream route handler unable to parse the body
 * because the underlying stream can only be consumed once. The non-API
 * supabase branch only touches request cookies, never the body.
 *
 * Allowlist discipline (T-02-38): public endpoints are listed as ANCHORED
 * regex literals (`^...$`). A simple substring or `startsWith` match
 * would let `/api/v1/diagnostics/ping/extra` drift through; the anchored
 * regex form rejects that.
 *
 * Security headers are owned by `next.config.ts` (Plan 01-03) and MUST
 * NOT be re-applied here.
 */

const PUBLIC_API_ENDPOINTS: readonly RegExp[] = [
  /^\/api\/v1\/diagnostics\/ping$/,
  // Phase 4 plan 04-10 — Rule 3 blocking-issue fix: the bearer-only
  // proxy gate breaks Phase 4's cookie-session auth flow (every
  // cookie-bearing request lacks the Authorization header and the proxy
  // returns 401 before the route handler's `requireApiUser` cookie
  // fallback can run). Mirrors `UNVERIFIED_ALLOWED_PATHS` in
  // `src/shared/api/auth.ts` — public auth surfaces + cookie-session-
  // protected IAM routes are added here so the route handlers can do
  // the authoritative auth check. Anchored regexes per T-02-38.
  /^\/api\/v1\/iam\/signup$/,
  /^\/api\/v1\/iam\/login$/,
  /^\/api\/v1\/iam\/logout$/,
  /^\/api\/v1\/iam\/me$/,
  /^\/api\/v1\/iam\/me\/password$/,
  /^\/api\/v1\/iam\/oauth\/complete$/,
  /^\/api\/v1\/iam\/resend-verification$/,
  /^\/api\/v1\/iam\/password\/reset$/,
  /^\/api\/v1\/iam\/password\/reset-request$/,
  /^\/api\/v1\/diagnostics\/consent$/,
  /^\/api\/v1\/diagnostics\/iam-test-helpers\/latest-token$/,
  /^\/api\/v1\/diagnostics\/iam-test-helpers\/latest-reset-token$/,
  /^\/api\/v1\/diagnostics\/iam-test-helpers\/seed-verified-user$/,
  /^\/api\/v1\/diagnostics\/iam-test-helpers\/seed-oauth-incomplete-user$/,
  /^\/api\/inngest(\/|$)/,
  /^\/api\/v1\/health\/connectivity$/,
  /^\/api\/v1\/photos\/upload$/,
  /^\/api\/v1\/webhooks\/stripe$/,
  // Add future public endpoints here. Keep the `^` and `$` anchors in
  // every entry — substring matching is forbidden.
] as const;

function isPublicApiPath(pathname: string): boolean {
  return PUBLIC_API_ENDPOINTS.some((re) => re.test(pathname));
}

function isApiV1Path(pathname: string): boolean {
  return pathname === "/api/v1" || pathname.startsWith("/api/v1/");
}

function hasBearer(authorizationHeader: string | null): boolean {
  if (!authorizationHeader) return false;
  const trimmed = authorizationHeader.trim();
  if (trimmed.length === 0) return false;
  if (!trimmed.toLowerCase().startsWith("bearer ")) return false;
  const token = trimmed.slice(7).trim();
  return token.length > 0;
}

function unauthenticatedResponse(): NextResponse {
  // Closed error registry shape — must mirror `errorResponse(...)` in
  // `src/shared/config/errors.ts`. Inlined here to keep the API-gating
  // branch dependency-free of route-handler-only modules (DB, jose).
  return NextResponse.json(
    {
      error: {
        code: "unauthenticated",
        message: "missing or invalid bearer token",
      },
    },
    {
      status: 401,
      headers: { "content-type": "application/json" },
    },
  );
}

/**
 * @supabase/ssr middleware cookie-refresh step (debug session
 * publiclayout-auth-refresh-token-throw).
 *
 * Implements the canonical `@supabase/ssr` Next.js middleware pattern:
 *   - Build a `NextResponse.next({ request })` so per-request headers and
 *     cookies flow through.
 *   - Construct `createServerClient` with a cookie adapter that reads
 *     from the incoming `request` and writes to BOTH the request (so
 *     downstream handlers see refreshed cookies in the same request) and
 *     the response (so the browser receives the Set-Cookie header).
 *   - Call `supabase.auth.getUser()` once. This triggers any pending
 *     refresh — but unlike the read-only Server Component path, the
 *     `setAll` here actually writes, so a non-retryable refresh error
 *     successfully clears the stale cookie via `_removeSession()` instead
 *     of looping forever.
 *
 * The result/error of `getUser()` is intentionally ignored here — Server
 * Components / route handlers each do their own `getUser` call and
 * decide the request's auth disposition. This call is purely a cookie-
 * coherence pass.
 */
async function refreshSupabaseSession(request: NextRequest): Promise<NextResponse> {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          for (const { name, value, options } of cookiesToSet) {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Single getUser() call — refreshes valid sessions and triggers any
  // pending refresh attempt against Supabase. The downstream route /
  // Server-Component path makes its own auth disposition; this call is
  // purely a cookie-coherence pass.
  const { error } = await supabase.auth.getUser();

  // Defense-in-depth cookie clear (debug session
  // publiclayout-auth-refresh-token-throw + regression spec
  // tests/e2e/auth-cold-start-stale-cookie.spec.ts). When `getUser`
  // returns a non-"session missing" error, the request carried a
  // session blob whose refresh failed (revoked, expired, malformed).
  // `@supabase/ssr`'s internal SIGNED_OUT → `applyServerStorage` →
  // `setAll` flush does NOT fire a clearing Set-Cookie in this version
  // pair, so we manually clear every `sb-*-auth-token` chunk here.
  // Idempotent: clearing absent cookies is a no-op.
  if (error && !isAuthSessionMissingError(error)) {
    Sentry.captureException(error, {
      tags: { surface: "proxy.refreshSupabaseSession" },
    });
    for (const cookie of request.cookies.getAll()) {
      if (SUPABASE_AUTH_TOKEN_COOKIE.test(cookie.name)) {
        response.cookies.set(cookie.name, "", { maxAge: 0, path: "/" });
      }
    }
  }

  return response;
}

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Non-API routes: do the @supabase/ssr cookie-refresh middleware step
  // so Server Components never see a stale-cookie + failed-refresh state
  // (debug session publiclayout-auth-refresh-token-throw). The body is
  // not touched (page navigations are GETs without bodies in practice;
  // the supabase client only reads request cookies).
  if (!isApiV1Path(pathname)) {
    return refreshSupabaseSession(request);
  }

  // Public allowlist (anchored regex) — no bearer required.
  if (isPublicApiPath(pathname)) {
    return NextResponse.next();
  }

  // Protected `/api/v1/*` request. Look at the Authorization header only;
  // do not touch the body. If no Bearer is present, reject fast.
  const authHeader = request.headers.get("authorization");
  if (!hasBearer(authHeader)) {
    return unauthenticatedResponse();
  }

  // Bearer present — let the request flow to the route handler, which
  // performs cryptographic verification via `requireApiUser`.
  return NextResponse.next();
}

/**
 * Matcher: include `/api/v1/:path*` so the proxy gates protected APIs,
 * while keeping `_next`, `_vercel`, and static assets out (the historical
 * exclusion pattern from Plan 01-03 still applies to non-API paths).
 *
 * Two entries:
 *   1. The original negative-lookahead pattern for non-API routes — left
 *      in place so future page-level concerns can attach here without
 *      churning the matcher again.
 *   2. `/api/v1/:path*` so the proxy fires on every API request. Auth
 *      gating + public allowlist are decided in the proxy body above.
 */
export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/api/v1/:path*"],
};
