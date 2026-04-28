import { ErrorCode } from "@shared/config/errors";
import {
  getCurrentUser,
  getCurrentUserFromSession,
  type CurrentUserResult,
} from "@contexts/iam/application/current-user";

/**
 * `requireApiUser(request)` — the auth gate every protected `/api/v1/*` route
 * helper calls before doing any work.
 *
 * Two transports supported:
 *  - Phase 2 Bearer: `Authorization: Bearer <jwt>` → cryptographic JWKS verify.
 *  - Phase 4 cookie session: Supabase SSR cookies → AuthAdapter.getUserBySession.
 *
 * The handler tries Bearer first (Phase 2 routes pass it explicitly); when
 * absent, it falls back to the cookie-session path (Phase 4 web/PWA flow).
 * Both routes resolve the same `users` row through the IAM repository.
 *
 * Closed-registry result shape: `{ok: true, user} | {ok: false, code, reason}`.
 * This is the AUTHORITATIVE auth check; the Next 16 proxy in `src/proxy.ts`
 * does only fast missing-bearer rejection (T-02-18: no authorization in
 * proxy alone).
 */

export type ApiUserResult = CurrentUserResult;

type CurrentUserOk = Extract<CurrentUserResult, { ok: true }>;

export type VerifiedUserResult =
  | CurrentUserOk
  | {
      ok: false;
      code: typeof ErrorCode.Unauthenticated | typeof ErrorCode.EmailUnverified;
      reason: string;
    };

export async function requireApiUser(request: Request): Promise<ApiUserResult> {
  const header = request.headers.get("authorization");
  if (header && header.trim().length > 0) {
    return getCurrentUser(header);
  }
  // Phase 4: no Authorization header → try Supabase SSR cookie session.
  return getCurrentUserFromSession();
}

/**
 * Phase 4 D-21 — additional gate: authenticated AND email-verified.
 *
 * Returns `{ok: true, user}` only when the user has a non-null
 * `emailVerifiedAt` (D-22 product source of truth). Authenticated-but-
 * unverified users get `EmailUnverified` (403) so the UI blocker (Plan 10)
 * and proxy default-deny (D-23) can react.
 */
export async function requireVerifiedUser(request: Request): Promise<VerifiedUserResult> {
  const result = await requireApiUser(request);
  if (!result.ok) return result;
  if (!result.user.emailVerifiedAt) {
    return {
      ok: false,
      code: ErrorCode.EmailUnverified,
      reason: "email_unverified",
    };
  }
  return { ok: true, user: result.user };
}

/**
 * Phase 4 D-23 — default-deny allowlist for unverified users.
 *
 * The root layout (Plan 10, route group `(authed)`) and proxy use this
 * constant. Every new endpoint opts-in by being added here; the default
 * behavior is to require verification.
 *
 * Includes legal stub pages (Codex MEDIUM consent UX fix): Plan 10's signup
 * form renders T&C and Privacy as hyperlinks bound to the active
 * policy_version, and the linked pages render under construction copy until
 * the founder drafts the real text.
 */
export const UNVERIFIED_ALLOWED_PATHS: ReadonlyArray<string | RegExp> = [
  // Verification + account-management endpoints reachable while unverified
  "/api/v1/iam/resend-verification",
  "/api/v1/iam/me",
  "/api/v1/iam/me/password",
  "/api/v1/iam/logout",
  "/api/v1/iam/oauth/complete",
  // Pre-auth pages
  "/auth/verify",
  "/auth/verify-error",
  "/auth/oauth-complete",
  "/auth/login",
  "/auth/signup",
  "/auth/forgot-password",
  "/auth/reset",
  "/auth/callback",
  // Public auth API endpoints
  "/api/v1/iam/signup",
  "/api/v1/iam/login",
  "/api/v1/iam/password/reset-request",
  "/api/v1/iam/password/reset",
  // Legal stub pages — Plan 10 + Codex MEDIUM consent UX fix
  "/legal/terms",
  "/legal/privacy",
  // Static + infrastructure (UI-SPEC discretion)
  /^\/_next\//,
  "/manifest.webmanifest",
  "/sw.js",
  "/sw.js.map",
  /^\/icons\//,
  "/favicon.ico",
  "/apple-touch-icon.png",
  /^\/api\/v1\/diagnostics\//,
  /^\/api\/inngest/,
  "/api/v1/webhooks/stripe",
];

export function isUnverifiedAllowed(pathname: string): boolean {
  return UNVERIFIED_ALLOWED_PATHS.some((p) =>
    typeof p === "string" ? p === pathname : p.test(pathname),
  );
}

// Re-export ErrorCode so route helpers can import the auth surface in one go.
export { ErrorCode };
