// Phase 4 plan 09 — POST /api/v1/iam/oauth/complete (AUTH-03 + D-04 + D-32).
//
// D-31: JSON-only request bodies; multipart not accepted.
// Codex HIGH #2: completeOauthSignup wraps user-fields + 2 consent_logs +
//   subscription writes in ONE db.transaction.
// Codex HIGH #3: NO `supabase.auth.*` calls — all auth via requireApiUser.
//
// The endpoint is in UNVERIFIED_ALLOWED_PATHS so an OAuth user (who lands
// authenticated but with age_confirmed_at IS NULL per resolved Q4) can call
// it through the unverified blocker.

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { requireApiUser } from "@shared/api/auth";
import { oauthCompleteSchema } from "@contexts/iam/domain/schemas";
import { completeOauthSignup } from "@contexts/iam/application/oauth-complete";

export async function POST(request: Request) {
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
  const parsed = oauthCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.");
  }

  try {
    const result = await completeOauthSignup({
      ...parsed.data,
      userId: r.user.id,
      email: r.user.email,
    });

    // D-32: invalid partner_code → invalid_partner_code (HTTP 400 per closed registry).
    if (result.kind === "invalid_partner_code") {
      return errorResponse(
        ErrorCode.InvalidPartnerCode,
        "Código de parceiro inválido.",
      );
    }

    // success or already_completed → 200 (idempotent per T-04-09-06).
    return NextResponse.json({ ok: true });
  } catch (err) {
    // Phase 4 plan 04-13 (UAT gap 2 observability parity fix): the
    // oauth-complete write-path does NOT call inngest.send (verified
    // 2026-04-29) so the gap-2 root cause does not apply here, but
    // the bare catch shape would silently swallow any genuine
    // db.transaction failure (e.g., partner_stores lookup error,
    // policy_versions row missing). Sentry capture surfaces the
    // operator signal. Closed-registry error shape preserved per D-31.
    Sentry.captureException(err, { tags: { surface: "iam.oauthComplete.route" } });
    return errorResponse(
      ErrorCode.InternalError,
      "Não foi possível concluir agora.",
    );
  }
}
