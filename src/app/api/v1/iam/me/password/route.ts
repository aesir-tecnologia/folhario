// Phase 4 plan 09 — PATCH /api/v1/iam/me/password (AUTH-13).
//
// D-31: JSON-only request bodies; multipart not accepted.
// Codex HIGH #3: AUTH calls go through changePassword → authAdapter; this
//   route never imports `@supabase/*` and never references the auth surface
//   directly.
// Codex HIGH #6: change-password uses real cookies in the Playwright E2E.
//
// Plan 09 deviation: requireApiUser returns `UserRow` (no hasPassword), so the
// route enriches via getUserById to read the join with auth.users — needed for
// the OAuth-only guard. T-04-09-02 mitigation.

import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { requireApiUser } from "@shared/api/auth";
import { changePasswordSchema } from "@contexts/iam/domain/schemas";
import { changePassword } from "@contexts/iam/application/change-password";
import { getUserById } from "@contexts/iam/infrastructure/db/users";

export async function PATCH(request: Request) {
  const r = await requireApiUser(request);
  if (!r.ok) {
    return errorResponse(r.code, "Sessão inválida.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
  }
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.");
  }

  // Plan 09 deviation: the AUTH-13 OAuth-only guard requires hasPassword,
  // which is only on the enriched UserWithCredentialFlag. r.user is the
  // narrow UserRow from requireApiUser, so re-fetch via getUserById.
  const enriched = await getUserById(r.user.id);
  if (!enriched) {
    return errorResponse(ErrorCode.NotFound, "Usuário não encontrado.");
  }

  const result = await changePassword({
    userId: enriched.id,
    email: enriched.email,
    currentPassword: parsed.data.current_password,
    newPassword: parsed.data.new_password,
    hasPassword: enriched.hasPassword,
  });

  if (result.kind === "oauth_only") {
    return errorResponse(ErrorCode.Forbidden, "Conta sem senha local.");
  }
  if (result.kind === "invalid_credentials") {
    return errorResponse(ErrorCode.InvalidCredentials, "Senha atual incorreta.");
  }
  return NextResponse.json({ ok: true });
}
