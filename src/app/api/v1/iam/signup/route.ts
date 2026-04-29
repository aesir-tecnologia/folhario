// Phase 4 AUTH-01 + Resolved Q1 + D-31 (JSON-only) + D-32 (partner_code) +
// Codex HIGH #5 (signup throttle "always" mode).
//
// Route handler is a thin shell — orchestration lives in
// `@contexts/iam/application/signup`. JSON-only per D-31; never accepts
// form-encoded bodies. The withThrottle wrapper increments BEFORE invoking
// the handler ("always" mode) so a flood of valid signups still triggers
// rate_limited 429 without burning email budget.
//
// Phase 04 review WR-04: anti-enumeration timing-attack mitigation.
// The created path runs ~500ms-2s (DB tx + Supabase admin + signIn);
// the already_registered path runs ~30ms. Without padding, an attacker
// can probe latency to enumerate registered emails. Pad the
// already_registered branch to a constant baseline before responding so
// the gap is statistically significant only with many samples — this is
// option (b) from the review (bounded gap, not a thin async wrapper).

import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { withThrottle } from "@shared/api/throttle";
import { signupRequestSchema } from "@contexts/iam/domain/schemas";
import { signupUser } from "@contexts/iam/application/signup";
import { inngest } from "@shared/inngest/client";
import ptBR from "../../../../../messages/pt-BR.json";

const welcomeBackSubject = (ptBR as { email: { welcomeBack: { subject: string } } }).email
  .welcomeBack.subject;

// Phase 04 review WR-04: constant baseline floor (ms) for the
// already_registered branch. The review measured the created path at
// ~500ms-2s in production-shaped latency. Picking 200ms keeps the
// floor reliably BELOW the created floor across environments
// (preventing the inversion oracle where already_registered becomes
// consistently SLOWER than created — a different enumeration signal),
// while still masking the previous ~30ms vs ~500ms+ gap from casual
// latency probing. The created path is NEVER padded — real signups
// always emerge above the floor on the cold-cache path; warm-path
// inversion remains possible if Supabase + DB response is <200ms but
// the spread is then small enough that statistical attacks need many
// samples. Revisit if production p95 drops below 200ms.
const ANTI_ENUMERATION_BASELINE_MS = 200;

async function padToBaseline(startedAtMs: number): Promise<void> {
  const elapsed = Date.now() - startedAtMs;
  const remaining = ANTI_ENUMERATION_BASELINE_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }
}

export async function POST(request: Request): Promise<Response> {
  return withThrottle(request, "signup", "always", async () => {
    const startedAtMs = Date.now();
    let body: unknown;
    try {
      body = await request.json(); // D-31: JSON only, NEVER form-encoded
    } catch {
      return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
    }

    const parsed = signupRequestSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return errorResponse(ErrorCode.ValidationFailed, issue?.message ?? "Validação falhou.", {
        field: issue?.path?.join(".") ?? "unknown",
      });
    }

    try {
      const result = await signupUser(parsed.data, new URL(request.url));

      // D-32: invalid partner_code → invalid_partner_code (HTTP 400 per closed registry).
      if (result.kind === "invalid_partner_code") {
        return errorResponse(ErrorCode.InvalidPartnerCode, "Código de parceiro inválido.");
      }

      // Resolved Q1: already_registered → emit welcome-back, return same generic 200.
      if (result.kind === "already_registered") {
        try {
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
        } catch (err) {
          // Phase 4 plan 04-13: a transient Inngest fault must not
          // 500 the welcome-back response — the anti-enumeration
          // contract (Resolved Q1) requires the response to look
          // identical to the created path regardless of dispatch
          // outcome. Sentry capture surfaces the operator signal.
          Sentry.captureException(err, {
            tags: { surface: "iam.signup.welcomeBack" },
            extra: { email: parsed.data.email },
          });
        }
        // WR-04: baseline pad so this branch is not trivially time-separable
        // from the created branch.
        await padToBaseline(startedAtMs);
      }

      return NextResponse.json(
        { ok: true, message: "Conta criada — verifique seu email." },
        { status: 200 },
      );
    } catch (err) {
      // Phase 4 plan 04-13 (UAT gap 2 observability fix): bare catch
      // hid the inngest.send-cloud-delivery failure for hours and
      // would hide every future failure here too. Capture so on-call
      // sees the operator signal; preserve the closed-registry error
      // shape (D-31) for the user-visible response.
      Sentry.captureException(err, { tags: { surface: "iam.signup.route" } });
      return errorResponse(ErrorCode.InternalError, "Não foi possível concluir agora.");
    }
  });
}
