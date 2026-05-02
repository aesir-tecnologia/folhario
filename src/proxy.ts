import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { updateSessionInMiddleware } from "@contexts/iam/infrastructure/supabase-server";

/**
 * Folhário Next 16 proxy — Plan 02-07 Task 3 + Plan 04-12 (gap closure).
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
 * 2. **Supabase cookie refresh** for non-API page routes (Plan 04-12 +
 *    debug session `publiclayout-auth-refresh-token-throw`). Server
 *    Components use `getReadOnlySupabaseServerClient` whose no-op `setAll`
 *    (Pitfall 6) cannot clear stale cookies — so without a middleware step
 *    that does have cookie-write capability, every Server Component render
 *    on a cold start with a leftover `sb-*` cookie triggers a failed
 *    refresh inside auth-js, which `console.error`s the AuthApiError and
 *    surfaces as "Console AuthApiError" in the Next 16 dev overlay
 *    (attributed to the awaiting React owner — PublicLayout / AppLayout).
 *
 *    The cookie-refresh implementation lives at the IAM infrastructure
 *    boundary as `updateSessionInMiddleware` in
 *    `@contexts/iam/infrastructure/supabase-server`. This file imports
 *    only the named helper — Codex HIGH #3 enforced (proxy MUST NOT
 *    import the Supabase SSR or supabase-js packages directly).
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
  /^\/api\/v1\/diagnostics\/iam-test-helpers\/nullify-password$/,
  /^\/api\/inngest(\/|$)/,
  /^\/api\/v1\/health\/connectivity$/,
  /^\/api\/v1\/photos\/upload$/,
  /^\/api\/v1\/webhooks\/stripe$/,
  // Phase 5 — catalog routes are cookie-session-authenticated for the
  // web/PWA flow. The route handlers gate via `requireVerifiedUser`
  // which checks the Supabase SSR cookie. Without these entries the
  // bearer-only proxy gate 401s every browser-issued catalog mutation
  // before the cookie fallback can run. UUID segments are matched
  // against `[0-9a-f-]{36}` to keep the allowlist tight.
  /^\/api\/v1\/plants$/,
  /^\/api\/v1\/plants\/[0-9a-f-]{36}$/,
  /^\/api\/v1\/plants\/[0-9a-f-]{36}\/photo-entries$/,
  /^\/api\/v1\/photo-entries\/[0-9a-f-]{36}$/,
  /^\/api\/v1\/locations$/,
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

export default async function proxy(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Branch A: /api/v1/* — protected APIs use the fast-fail bearer gate.
  // This branch MUST NOT consume the request body (T-02-37) and MUST
  // NOT touch supabase.auth.* (Codex HIGH #3 — only the route handler
  // calls authAdapter.X()). Evaluated first so it never enters Branch B.
  if (isApiV1Path(pathname)) {
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

  // Branch B: non-API page routes — Phase 4 gap closure (UAT gap 1).
  //   Run the standard Supabase middleware-level cookie-refresh step
  //   via the named helper. Stale cookies get cleared HERE so by the
  //   time PublicLayout / AppLayout call getCurrentUserFromSessionReadOnly,
  //   auth-js no longer attempts the failed refresh + console.error
  //   that surfaces in the Next 16 dev overlay.
  return updateSessionInMiddleware(request);
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
