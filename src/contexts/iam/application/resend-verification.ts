// Phase 4 plan 06 — resend-verification use-case (D-08).
//
// Caller (the route handler) enforces the per-user 1/min rate limit using
// the auth_throttle backend. This use-case revokes prior unused tokens via
// `mintVerificationToken` (which calls `revokeUnusedVerificationTokens`
// internally), inserts a fresh row, and emits the same Inngest event the
// signup flow uses (with id `email-verification/{tokenId}` for 24h
// producer-side dedup).

import * as Sentry from "@sentry/nextjs";

import { mintVerificationToken } from "@contexts/iam/infrastructure/db/verification-tokens";
import { inngest } from "@shared/inngest/client";
import ptBR from "../../../messages/pt-BR.json";

// See note in signup.ts: pt-BR-only at launch + integration tests run outside
// the Next request context that next-intl/server.getTranslations requires.
const verificationSubject =
  (ptBR as { email: { verification: { subject: string } } }).email.verification.subject;

export async function resendVerification(opts: {
  userId: string;
  email: string;
  requestUrl: URL;
}): Promise<{ tokenId: string }> {
  const { tokenId, rawToken } = await mintVerificationToken({
    userId: opts.userId,
    sentToEmail: opts.email,
  });
  const verificationUrl = new URL(
    `/auth/verify?token=${rawToken}`,
    opts.requestUrl,
  ).toString();
  // Phase 4 plan 04-13 (UAT gap 2 architectural fix mirror): the token
  // row in `email_verification_tokens` is already persisted by
  // mintVerificationToken above. A transient Inngest delivery failure
  // here used to throw, which the route handler's bare `catch {}`
  // mapped to a generic 500 — silently swallowing the operator signal.
  // Wrap so the failure surfaces to Sentry but does not block the
  // route from returning success (the user can click "Reenviar" again
  // via the per-user 1/min throttle).
  try {
    await inngest.send({
      id: `email-verification/${tokenId}`,
      name: "notifications/email.requested",
      data: {
        template: "verification",
        to: opts.email,
        subject: verificationSubject,
        props: { url: verificationUrl, userEmail: opts.email },
      },
    });
  } catch (err) {
    Sentry.captureException(err, {
      tags: { surface: "iam.resendVerification.notify" },
      extra: { tokenId },
    });
  }
  return { tokenId };
}
