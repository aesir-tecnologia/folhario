// Phase 4 plan 08 — consume-password-reset use-case (D-10 + AUTH-12).
//
// Codex HIGH #2 (db.transaction atomicity): consume + adminUpdatePassword
// wrapped in ONE db.transaction(...). If the password update fails, the
// token consume rolls back so the user can request another reset.
//
// Codex HIGH #3 (AuthAdapter boundary): goes through `authAdapter`; this
// file does NOT import `@supabase/*` and does NOT call `supabase.auth.*`.
//
// AUTH-12 critical invariant: this use-case does NOT call signOut or
// revokeRefreshToken. Existing access tokens (JWTs) issued before the reset
// MUST remain valid. The adapter's adminUpdatePassword does not call
// signOut either (verified by the unit test on auth-adapter and the
// Playwright E2E in Task 3 — login with NEW password works post-reset
// while the OLD password is rejected).

import { db } from "@shared/db/client";
import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import { consumeResetToken } from "@contexts/iam/infrastructure/db/reset-tokens";

export type ConsumeResult =
  | { kind: "success" }
  | { kind: "invalid_or_expired" };

export async function consumePasswordReset(opts: {
  token: string;
  password: string;
}): Promise<ConsumeResult> {
  // Codex HIGH #2: wrap consume + adminUpdatePassword in db.transaction.
  // If the adapter call fails, consumed_at rolls back so the user can
  // request a new reset.
  const result = await db.transaction(async (tx) => {
    const consumed = await consumeResetToken(opts.token, tx);
    if (!consumed) return null;

    // Codex HIGH #3: authAdapter (NOT supabase.auth.admin.updateUserById directly).
    const updateResult = await authAdapter.adminUpdatePassword({
      userId: consumed.userId,
      newPassword: opts.password,
    });
    if (!updateResult.ok) {
      // Throw so the tx rolls back consumed_at — user retains the right
      // to request another reset.
      throw new Error(
        `adminUpdatePassword failed: ${updateResult.reason}`,
      );
    }
    return { userId: consumed.userId };
  });

  if (!result) return { kind: "invalid_or_expired" };
  return { kind: "success" };
}
