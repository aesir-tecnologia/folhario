// Phase 4 plan 08 — request-password-reset use-case (D-11 + D-25 + AUTH-11).
//
// INVOKED FROM INSIDE the iam/password-reset-requested Inngest function (NOT
// from the route handler). The route handler is a thin inngest.send wrapper
// — sub-millisecond, constant-time response. All conditional logic (lookup,
// branch, mint, dispatch) happens async here for D-11's anti-enumeration
// timing-attack defense.
//
// D-25 atomicity: revoke prior + mint fresh wrapped in db.transaction so a
// partial failure can't leave orphaned revoked tokens with no replacement.
// Codex HIGH #3: emits via inngest.send → notifications/send-email function
// (the route layer's only Supabase call goes through authAdapter elsewhere;
// this file does not call supabase.auth.* directly).
//
// pt-BR-only at launch + integration tests run outside the Next request
// context that next-intl/server.getTranslations() requires, so we import
// the JSON directly (same pattern as signup.ts and resend-verification.ts).

import { db } from "@shared/db/client";
import { inngest } from "@shared/inngest/client";
import { getUserByEmail } from "@contexts/iam/infrastructure/db/users";
import { mintResetToken } from "@contexts/iam/infrastructure/db/reset-tokens";
import ptBR from "../../../messages/pt-BR.json";

const passwordResetSubject = (
  ptBR as { email: { passwordReset: { subject: string } } }
).email.passwordReset.subject;

export async function requestPasswordReset(args: {
  email: string;
  requestUrl: string;
}): Promise<void> {
  const user = await getUserByEmail(args.email);
  if (!user) return; // anti-enumeration: no email sent
  if (!user.hasPassword) return; // OAuth-only: no email sent (anti-enumeration)

  // D-25 atomicity: revoke prior + mint fresh in one tx so a partial failure
  // can't leave orphaned revoked tokens with no replacement.
  const { tokenId, rawToken } = await db.transaction(async (tx) => {
    return await mintResetToken(
      { userId: user.id, sentToEmail: args.email },
      tx,
    );
  });

  const resetUrl = new URL(
    `/auth/reset?token=${rawToken}`,
    args.requestUrl,
  ).toString();

  // Codex HIGH #8: inner event id is `password-reset/{tokenId}` — token-unique.
  // Outer iam/password-reset-requested event id (set in route handler) handles
  // minute-bucket dedup to collapse double-clicks.
  await inngest.send({
    id: `password-reset/${tokenId}`,
    name: "notifications/email.requested",
    data: {
      template: "password-reset",
      to: args.email,
      subject: passwordResetSubject,
      props: { url: resetUrl, userEmail: args.email },
    },
  });
}
