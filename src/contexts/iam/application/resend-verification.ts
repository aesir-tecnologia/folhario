// Phase 4 plan 06 — resend-verification use-case (D-08).
//
// Caller (the route handler) enforces the per-user 1/min rate limit using
// the auth_throttle backend. This use-case revokes prior unused tokens via
// `mintVerificationToken` (which calls `revokeUnusedVerificationTokens`
// internally), inserts a fresh row, and emits the same Inngest event the
// signup flow uses (with id `email-verification/{tokenId}` for 24h
// producer-side dedup).

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
  return { tokenId };
}
