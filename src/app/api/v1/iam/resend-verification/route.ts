// Phase 4 AUTH-04 + D-08 + D-31 (JSON-only) — POST /api/v1/iam/resend-verification.
//
// Auth flow:
//   1. requireApiUser (Bearer→cookie fallback per Wave 3) gates access.
//   2. If user already verified → 200 idempotent (no error).
//   3. Per-user 1/min rate limit: bumpThrottle keyed by `user:{id}` instead
//      of IP, reusing the auth_throttle backend (D-08).
//   4. resendVerification (mintVerificationToken + Inngest event) runs.

import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { requireApiUser } from "@shared/api/auth";
import { resendVerification } from "@contexts/iam/application/resend-verification";
import { bumpThrottleRow } from "@contexts/iam/infrastructure/db/auth-throttle";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return errorResponse(auth.code, "Sessão necessária.");
  }
  const { user } = auth;

  // Idempotent for already-verified users (no error, no email re-sent).
  if (user.emailVerifiedAt) {
    return NextResponse.json({ ok: true, message: "E-mail já verificado." });
  }

  // D-08: per-user 1/min rate limit. Auth_throttle keyed by `user:{id}` so
  // a logged-in user across multiple IPs still hits one bucket. count > 1
  // means a second resend within the same 1-minute window.
  const { count } = await bumpThrottleRow(`user:${user.id}`, "resend-verification");
  if (count > 1) {
    return errorResponse(
      ErrorCode.RateLimited,
      "Aguarde antes de reenviar o e-mail.",
    );
  }

  try {
    await resendVerification({
      userId: user.id,
      email: user.email,
      requestUrl: new URL(request.url),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return errorResponse(
      ErrorCode.InternalError,
      "Não foi possível reenviar agora.",
    );
  }
}
