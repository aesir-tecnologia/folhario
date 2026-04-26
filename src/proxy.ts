import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Folhário Next 16 proxy — Plan 02-07 Task 3.
 *
 * Composes a fast missing-bearer rejection over `/api/v1/*` with a typed,
 * anchored-regex public allowlist. Cryptographic JWT verification is NOT
 * done here — that is the route helper's job (`requireApiUser` in
 * `src/shared/api/auth.ts`). Routes are authoritative; the proxy is fast
 * fail only (D-34/D-47, T-02-18 mitigation).
 *
 * Body discipline (T-02-37): this function reads ONLY the URL pathname
 * and the Authorization header. It MUST NOT consume the request body
 * stream (no body reads, no JSON parsing, no form parsing) — doing so
 * would render the downstream route handler unable to parse the body
 * because the underlying stream can only be consumed once. A unit test
 * in tests/unit/proxy-body-passthrough.test.ts proves this directly.
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
  // `src/shared/config/errors.ts`. Inlined here to keep the proxy module
  // dependency-free (it must not pull in DB, jose, or env modules).
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

export default function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;

  // Only `/api/v1/*` is in scope for auth gating. Everything else passes.
  if (!isApiV1Path(pathname)) {
    return NextResponse.next();
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
