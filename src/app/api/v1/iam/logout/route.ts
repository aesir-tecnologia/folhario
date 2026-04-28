import { NextResponse } from "next/server";

import { logoutUser } from "@contexts/iam/application/logout";

/**
 * Phase 4 AUTH-14 + Resolved Q-AUTH-14 — POST /api/v1/iam/logout.
 *
 * D-31: JSON-only request bodies; multipart not accepted.
 * Idempotent: even an unauthenticated request gets 200 — the adapter's
 *   signOutLocal swallows errors per AUTH-14 idempotence. There is
 *   intentionally no auth gate.
 * Codex HIGH #3: AUTH calls go through logoutUser → authAdapter; this
 *   route never imports `@supabase/*` and never references the auth
 *   surface directly.
 *
 * Resolved Q-AUTH-14: scope=local sign-out clears this device's cookie
 *   and revokes its refresh token. The existing JWT continues to be valid
 *   until its `exp`; logout-all-devices is AUTH-v2-02.
 */
export async function POST(_request: Request) {
  await logoutUser();
  return NextResponse.json({ ok: true });
}
