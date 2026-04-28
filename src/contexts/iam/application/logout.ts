import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";

/**
 * Phase 4 AUTH-14 + D-05 + Resolved Q-AUTH-14 + Codex HIGH #3.
 *
 * Per-device logout. The adapter's signOutLocal() clears this device's
 * cookie and revokes its refresh token. Any existing JWT continues to be
 * valid until its `exp` (≤1h on Supabase default); logout-all-devices is
 * AUTH-v2-02 (post-MVP).
 *
 * Idempotent — already-logged-out users are a no-op (the adapter swallows
 * errors per AUTH-14 idempotence).
 */
export async function logoutUser(): Promise<void> {
  await authAdapter.signOutLocal();
}
