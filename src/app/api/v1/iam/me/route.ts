// Phase 4 plan 09 — GET/PATCH /api/v1/iam/me.
//
// D-31: JSON-only request bodies; multipart not accepted.
// Codex HIGH #3: NO Drizzle imports in this route handler. The use-case
//   `updateMyTimezone` calls the users repo so this file stays HTTP-only.
// Codex HIGH #3: NO `supabase.auth.*` calls — all auth via requireApiUser.
//
// Allowlist: `/api/v1/iam/me` is in UNVERIFIED_ALLOWED_PATHS (Plan 03 + plan 06)
// so authenticated-but-unverified users can still read their own profile to
// power the unverified blocker UI (AUTH-15) — they just can't reach the
// gated app endpoints.

import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { requireApiUser } from "@shared/api/auth";
import { getUserById } from "@contexts/iam/infrastructure/db/users";
import { updateMyTimezone } from "@contexts/iam/application/update-me";

/**
 * GET /api/v1/iam/me — returns the current user's enriched profile (joined
 * with auth.users to derive `hasPassword`). Plan 09 deviation: requireApiUser's
 * `r.user` is a `UserRow` (no hasPassword); the must_have spec requires
 * exposing hasPassword for the change-password UI guard, so we re-fetch via
 * getUserById which JOINs auth.users.encrypted_password.
 */
export async function GET(request: Request) {
  const r = await requireApiUser(request);
  if (!r.ok) {
    return errorResponse(r.code, "Sessão inválida.");
  }

  const enriched = await getUserById(r.user.id);
  if (!enriched) {
    return errorResponse(ErrorCode.NotFound, "Usuário não encontrado.");
  }
  return NextResponse.json({ user: enriched });
}

const patchSchema = z
  .object({
    timezone: z
      .string()
      .refine((v) => Intl.supportedValuesOf("timeZone").includes(v), {
        message: "invalid_timezone",
      }),
  })
  .strict();

/**
 * PATCH /api/v1/iam/me — D-31 JSON-only timezone update via the use-case.
 *
 * Codex HIGH #3: handler validates + delegates to updateMyTimezone; never
 * imports Drizzle directly. The use-case calls updateUserTimezone in the
 * users repo.
 */
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.");
  }

  await updateMyTimezone({ userId: r.user.id, timezone: parsed.data.timezone });

  // Re-fetch enriched row so the response carries the freshly-updated timezone +
  // hasPassword. Same shape as GET.
  const updated = await getUserById(r.user.id);
  if (!updated) {
    return errorResponse(ErrorCode.NotFound, "Usuário não encontrado.");
  }
  return NextResponse.json({ user: updated });
}
