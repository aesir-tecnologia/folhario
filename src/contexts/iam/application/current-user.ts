import { ErrorCode } from "@shared/config/errors";
import { authAdapter, type AuthAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import type { UserRow } from "@contexts/iam/infrastructure/db/users";

/**
 * IAM application — current-user query.
 *
 * Composes `AuthAdapter.verifyBearer` (cryptographic JWT check) with
 * `users.findById` (defense-in-depth users-row lookup) so route helpers can
 * resolve the current user without knowing Supabase internals or importing a
 * users repository directly.
 *
 * The adapter dependency is overridable via `__setCurrentUserAdapterForTests`
 * so unit tests do not need to import Drizzle, jose, or hit the network.
 */

export type CurrentUserResult =
  | { ok: true; user: UserRow }
  | {
      ok: false;
      code: typeof ErrorCode.Unauthenticated;
      reason: string;
    };

let testAdapter: AuthAdapter | null = null;

/**
 * Phase 04 review WR-01: route through the process-wide AuthAdapter Proxy
 * singleton (`authAdapter`) instead of constructing a fresh adapter per
 * request. Constructing a new adapter per call defeats the JWKS cache
 * inside `createRemoteJWKSet` and bypasses the singleton boundary every
 * other use-case (signup/login/etc.) honors. The test seam is preserved.
 */
function adapter(): AuthAdapter {
  return testAdapter ?? authAdapter;
}

/**
 * Test-only override. `null` resets to the default factory.
 * The double-underscore prefix mirrors the pattern used elsewhere in
 * this codebase (e.g. test-only seams in posthog/sentry helpers).
 */
export function __setCurrentUserAdapterForTests(next: AuthAdapter | null): void {
  testAdapter = next;
}

export async function getCurrentUser(
  authorizationHeader: string | null | undefined,
): Promise<CurrentUserResult> {
  const adapterInstance = adapter();
  const verify = await adapterInstance.verifyBearer(authorizationHeader);
  if (!verify.ok) {
    return verify;
  }
  const user = await adapterInstance.getUserById(verify.userId);
  if (!user) {
    return {
      ok: false,
      code: ErrorCode.Unauthenticated,
      reason: "user_not_found",
    };
  }
  return { ok: true, user };
}

/**
 * Phase 4 D-21 — cookie-session lookup for Route Handlers / Server Actions.
 *
 * Used by request-pipelines that authenticate via Supabase SSR cookies (the
 * Phase 4 web/PWA flow) rather than an `Authorization: Bearer` header. Goes
 * through the AuthAdapter singleton so Codex HIGH #3 stays enforced.
 *
 * Pitfall 6 safety: `readOnly: false` is the default — call this from Route
 * Handlers and Server Actions only. Server Components must use
 * {@link getCurrentUserFromSessionReadOnly}.
 */
export async function getCurrentUserFromSession(): Promise<CurrentUserResult> {
  const adapterInstance = adapter();
  const session = await adapterInstance.getUserBySession({ readOnly: false });
  if (!session) {
    return {
      ok: false,
      code: ErrorCode.Unauthenticated,
      reason: "no_session",
    };
  }
  const user = await adapterInstance.getUserById(session.id);
  if (!user) {
    return {
      ok: false,
      code: ErrorCode.Unauthenticated,
      reason: "user_not_found",
    };
  }
  return { ok: true, user };
}

/**
 * Phase 4 D-21 + Pitfall 6 — read-only cookie-session lookup for Server
 * Components. The read-only Supabase client cannot mutate cookies, so any
 * refresh attempts become no-ops (Next 16 throws otherwise).
 */
export async function getCurrentUserFromSessionReadOnly(): Promise<CurrentUserResult> {
  const adapterInstance = adapter();
  const session = await adapterInstance.getUserBySession({ readOnly: true });
  if (!session) {
    return {
      ok: false,
      code: ErrorCode.Unauthenticated,
      reason: "no_session",
    };
  }
  const user = await adapterInstance.getUserById(session.id);
  if (!user) {
    return {
      ok: false,
      code: ErrorCode.Unauthenticated,
      reason: "user_not_found",
    };
  }
  return { ok: true, user };
}
