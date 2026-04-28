// Phase 4 plan 06 — verify-email use-case (D-07/D-22).
//
// Codex HIGH #2 ordering fix: wraps consume + setEmailVerifiedAt in ONE
// db.transaction(...). The intra-tx ORDER is: consume FIRST (atomic UPDATE
// with FOR UPDATE row lock to prevent replay) → SET email_verified_at
// SECOND. Both succeed on commit; if anything throws, both roll back.
//
// Defense-in-depth posture (per plan): if a deployment misconfiguration
// caused autocommit between the two statements (cannot happen inside
// `db.transaction`, but documented as belt-and-braces), the user would
// still end up either fully verified OR fully unverified — never with a
// consumed token but unset email_verified_at.

import { db } from "@shared/db/client";
import { consumeVerificationToken } from "@contexts/iam/infrastructure/db/verification-tokens";
import { setEmailVerifiedAt } from "@contexts/iam/infrastructure/db/users";
import { captureSignupCompleted } from "@contexts/iam/infrastructure/posthog-bridge";

export type VerifyResult =
  | { kind: "verified"; userId: string }
  | { kind: "invalid_or_expired" };

export async function verifyEmail(rawToken: string): Promise<VerifyResult> {
  // Codex HIGH #2: wrap consume + setEmailVerifiedAt in db.transaction.
  const txResult = await db.transaction(async (tx) => {
    const consumed = await consumeVerificationToken(rawToken, tx);
    if (!consumed) return null;
    // Per plan ordering (defense-in-depth): SET email_verified_at AFTER consume
    // succeeded. Both commit together inside this tx.
    await setEmailVerifiedAt(consumed.userId, new Date(), tx);
    return { userId: consumed.userId };
  });

  if (!txResult) {
    return { kind: "invalid_or_expired" };
  }

  // Pitfall 8: signup_completed fires HERE — the "<2-min from email
  // verification" clock per PROJECT.md core value starts ticking now.
  await captureSignupCompleted(txResult.userId);

  return { kind: "verified", userId: txResult.userId };
}
