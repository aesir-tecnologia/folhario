// Phase 4 plan 09 — AUTH-13 + Codex HIGH #3 + Codex HIGH #6.
//
// Self-service password change with current-password reverification:
//   1. AUTH-13 + UI-SPEC §4: OAuth-only users (no encrypted_password in
//      auth.users) cannot change password — return `oauth_only` so the route
//      maps to forbidden 403.
//   2. Codex HIGH #6: reverify the current password via
//      `authAdapter.signInWithPassword({email, password: currentPassword})`
//      BEFORE calling `adminUpdatePassword`. Wrong current → invalid_credentials.
//   3. AUTH-12: `adminUpdatePassword` does NOT call signOut. Existing JWTs
//      remain valid (single-device JWT semantics, D-05).
//
// Codex HIGH #3: this module imports the AuthAdapter only — no
// `supabase.auth.*` calls and no Drizzle imports.

import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";

export type ChangePasswordResult =
  | { kind: "success" }
  | { kind: "invalid_credentials" }
  | { kind: "oauth_only" };

export async function changePassword(opts: {
  userId: string;
  email: string;
  currentPassword: string;
  newPassword: string;
  hasPassword: boolean;
}): Promise<ChangePasswordResult> {
  // AUTH-13 + UI-SPEC §4: OAuth-only users cannot change a password they don't have.
  if (!opts.hasPassword) {
    return { kind: "oauth_only" };
  }

  // Codex HIGH #6 reverify: signInWithPassword is the cheapest authoritative
  // "is this the current password?" check. T-04-09-01 mitigation.
  const verify = await authAdapter.signInWithPassword({
    email: opts.email,
    password: opts.currentPassword,
  });
  if (!verify.ok) {
    return { kind: "invalid_credentials" };
  }

  const update = await authAdapter.adminUpdatePassword({
    userId: opts.userId,
    newPassword: opts.newPassword,
  });
  if (!update.ok) {
    throw new Error(`adminUpdatePassword failed: ${update.reason}`);
  }

  // AUTH-12: do NOT call signOut. Existing JWTs remain valid.
  return { kind: "success" };
}
