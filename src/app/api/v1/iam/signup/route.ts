// Phase 4 AUTH-01 + Resolved Q1 + D-31 (JSON-only) + D-32 (partner_code) +
// Codex HIGH #5 (signup throttle "always" mode).
//
// Route handler is a thin shell — orchestration lives in
// `@contexts/iam/application/signup`. JSON-only per D-31; never accepts
// form-encoded bodies. The withThrottle wrapper increments BEFORE invoking
// the handler ("always" mode) so a flood of valid signups still triggers
// rate_limited 429 without burning email budget.

import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { withThrottle } from "@shared/api/throttle";
import { signupRequestSchema } from "@contexts/iam/domain/schemas";
import { signupUser } from "@contexts/iam/application/signup";
import { inngest } from "@shared/inngest/client";
import ptBR from "../../../../../messages/pt-BR.json";

const welcomeBackSubject =
  (ptBR as { email: { welcomeBack: { subject: string } } }).email.welcomeBack.subject;

export async function POST(request: Request): Promise<Response> {
  return withThrottle(request, "signup", "always", async () => {
    let body: unknown;
    try {
      body = await request.json(); // D-31: JSON only, NEVER form-encoded
    } catch {
      return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
    }

    const parsed = signupRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return errorResponse(
        ErrorCode.ValidationFailed,
        issue?.message ?? "Validação falhou.",
        { field: issue?.path?.join(".") ?? "unknown" },
      );
    }

    try {
      const result = await signupUser(parsed.data, new URL(request.url));

      // D-32: invalid partner_code → invalid_partner_code (HTTP 400 per closed registry).
      if (result.kind === "invalid_partner_code") {
        return errorResponse(
          ErrorCode.InvalidPartnerCode,
          "Código de parceiro inválido.",
        );
      }

      // Resolved Q1: already_registered → emit welcome-back, return same generic 200.
      if (result.kind === "already_registered") {
        await inngest.send({
          id: `welcome-back/${parsed.data.email}`,
          name: "notifications/email.requested",
          data: {
            template: "welcome-back",
            to: parsed.data.email,
            subject: welcomeBackSubject,
            props: { resetUrl: result.resetUrl, userEmail: parsed.data.email },
          },
        });
      }

      return NextResponse.json(
        { ok: true, message: "Conta criada — verifique seu email." },
        { status: 200 },
      );
    } catch {
      return errorResponse(
        ErrorCode.InternalError,
        "Não foi possível concluir agora.",
      );
    }
  });
}
