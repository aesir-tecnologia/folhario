// Phase 4 plan 08 — POST /api/v1/iam/password/reset (D-10 + AUTH-12 + D-31).
//
// D-31: JSON request bodies only; multipart is not accepted on this route.
// AUTH-12: existing access tokens (JWTs) issued before the reset MUST remain
//   valid. consumePasswordReset does NOT invalidate sessions.
// Codex HIGH #2: consume + adminUpdatePassword wrapped in db.transaction
//   inside the use-case so a failed update rolls back consumed_at.
// Codex HIGH #3: AUTH calls go through authAdapter — this file does not
//   import @supabase/* and does not touch the auth surface directly.
//
// Closed registry (Phase 1 D-10/D-12): only ValidationFailed and
// InternalError surface from this handler.

import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { passwordResetConsumeSchema } from "@contexts/iam/domain/schemas";
import { consumePasswordReset } from "@contexts/iam/application/consume-password-reset";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json(); // D-31: JSON only
  } catch {
    return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
  }

  const parsed = passwordResetConsumeSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.");
  }

  try {
    const result = await consumePasswordReset(parsed.data);
    if (result.kind === "invalid_or_expired") {
      // AUTH-12: token already consumed OR expired OR forged → 400.
      return errorResponse(
        ErrorCode.ValidationFailed,
        "Link inválido ou expirado.",
      );
    }
    return NextResponse.json({ ok: true });
  } catch {
    // Tx rolled back (Codex HIGH #2). Bubble up as 500 — operator alert
    // surfaces via Sentry; user can request a new reset.
    return errorResponse(
      ErrorCode.InternalError,
      "Não foi possível concluir agora.",
    );
  }
}
