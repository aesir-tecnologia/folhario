// Phase 4 plan 08 — request-password-reset use-case (D-11 + D-25 + AUTH-11).
//
// INVOKED FROM INSIDE the iam/password-reset-requested Inngest function (NOT
// from the route handler). The route handler is a thin inngest.send wrapper
// — sub-millisecond, constant-time response. All conditional logic (lookup,
// branch, mint, dispatch) happens async here for D-11's anti-enumeration
// timing-attack defense.
//
// D-25 atomicity: `mintResetToken` already runs revokeUnusedResetTokens
// followed by an INSERT on the same connection. Phase 04 review WR-03:
// wrapping that single repo call in db.transaction(...) bought no
// additional atomicity (a connection-loss between the two statements
// aborts the wrapped tx exactly as it would abort the bare repo call) —
// it just added a BEGIN/COMMIT round-trip. If that two-statement pair
// ever needs to interleave with other writes, lift the revoke + insert
// into separate calls and put THOSE inside an explicit tx.
// Codex HIGH #3: emits via inngest.send → notifications/send-email function.
// Supabase auth calls go through `authAdapter` elsewhere; this file does
// not import `@supabase/*` and does not touch the auth surface directly.
//
// pt-BR-only at launch + integration tests run outside the Next request
// context that next-intl/server.getTranslations() requires, so we import
// the JSON directly (same pattern as signup.ts and resend-verification.ts).

import { inngest } from "@shared/inngest/client";
import { getUserByEmail } from "@contexts/iam/infrastructure/db/users";
import { mintResetToken } from "@contexts/iam/infrastructure/db/reset-tokens";
import ptBR from "../../../messages/pt-BR.json";

const passwordResetSubject = (ptBR as { email: { passwordReset: { subject: string } } }).email
  .passwordReset.subject;

export async function requestPasswordReset(args: {
  email: string;
  requestUrl: string;
}): Promise<void> {
  const user = await getUserByEmail(args.email);
  if (!user) return; // anti-enumeration: no email sent
  if (!user.hasPassword) return; // OAuth-only: no email sent (anti-enumeration)

  // D-25 atomicity: mintResetToken internally calls revokeUnusedResetTokens
  // then inserts the new row on the same connection — Phase 04 review
  // WR-03: no additional tx wrapper is needed (or useful) for the
  // single-call shape.
  const { tokenId, rawToken } = await mintResetToken({
    userId: user.id,
    sentToEmail: args.email,
  });

  const resetUrl = new URL(`/auth/reset?token=${rawToken}`, args.requestUrl).toString();

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
