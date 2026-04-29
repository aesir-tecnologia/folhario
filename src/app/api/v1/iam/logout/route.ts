import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { withThrottle } from "@shared/api/throttle";
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
 *
 * Phase 04 review WR-07: defense against drive-by CSRF logouts.
 *   - Require Content-Type: application/json (matches D-31; cross-site
 *     <form> POSTs cannot set this header without preflight).
 *   - Wrap in withThrottle (per-IP) so attempts to mass-logout over a
 *     single IP get capped before reaching the auth surface.
 */
export async function POST(request: Request) {
  return withThrottle(request, "logout", "always", async () => {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
    }
    await logoutUser();
    return NextResponse.json({ ok: true });
  });
}
