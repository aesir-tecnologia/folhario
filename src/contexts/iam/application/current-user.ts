import { ErrorCode } from "@shared/config/errors";
import {
  createAuthAdapter,
  type AuthAdapter,
} from "@contexts/iam/infrastructure/auth/auth-adapter";
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

function adapter(): AuthAdapter {
  return testAdapter ?? createAuthAdapter();
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
