// Phase 4 plan 08 — POST /api/v1/iam/password/reset-request (D-11 + AUTH-11 + D-31).
//
// THIN inngest.send WRAPPER — sub-millisecond, constant-time response. NO DB
// lookup, NO token mint, NO conditional logic in the route handler. All of
// that lives async inside the iam/password-reset-requested Inngest function
// (src/contexts/iam/inngest/functions.ts → src/contexts/iam/application/
// request-password-reset.ts) for D-11's anti-enumeration timing-attack
// defense.
//
// User resolved D-11 vs D-16 conflict on 2026-04-26 by reframing INFRA-10 as
// "8 PRD §3 MVP + 1 Phase-4 anti-enumeration add" — restoring
// iam/password-reset-requested as the 9th registered Inngest function.
//
// D-31: JSON request bodies only; multipart is not accepted on this route.
// D-15 + Codex HIGH #5: withThrottle("password-reset-request", "always", ...)
//   — per-IP 5/min lockout via locked_until.
// AUTH-11: ALWAYS returns 200 (anti-enumeration), even on validation failure
//   or enqueue failure.

import { NextResponse } from "next/server";

import { withThrottle } from "@shared/api/throttle";
import { passwordResetRequestSchema } from "@contexts/iam/domain/schemas";
import { inngest } from "@shared/inngest/client";

const ALWAYS_OK_BODY = {
  ok: true,
  message: "Verifique seu e-mail.",
};

export async function POST(request: Request) {
  return withThrottle(request, "password-reset-request", "always", async () => {
    let body: unknown;
    try {
      body = await request.json(); // D-31: JSON only
    } catch {
      // Even malformed body returns 200 (anti-enumeration).
      return NextResponse.json(ALWAYS_OK_BODY);
    }

    const parsed = passwordResetRequestSchema.safeParse(body);
    if (!parsed.success) {
      // Same 200 — no signal whether email is valid or not.
      return NextResponse.json(ALWAYS_OK_BODY);
    }

    const email = parsed.data.email;

    // Codex HIGH #8: outer event id is `password-reset-request/{email}/{minute-bucket}`
    // (1-min dedup). Collapses accidental rapid-fire from double-clicks; legitimate
    // new requests after 1h token expiry succeed (because the minute bucket has
    // rolled over). Inner notifications/email.requested event (emitted from inside
    // the Inngest function) uses its own id `password-reset/{tokenId}` for per-token
    // dedup.
    try {
      await inngest.send({
        id: `password-reset-request/${email}/${Math.floor(Date.now() / 60000)}`,
        name: "iam/password-reset-requested",
        data: { email, requestUrl: request.url },
      });
    } catch {
      // Swallow: anti-enumeration. Sentry capture is configured globally.
      // The user-visible response is unchanged regardless of whether enqueue
      // succeeded — we never leak that the async pipeline failed.
    }

    return NextResponse.json(ALWAYS_OK_BODY);
  });
}
