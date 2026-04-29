// Phase 4 plan 09 — AUTH-03 + D-04 + D-32 + Codex HIGH #2 + Codex HIGH #3.
//
// OAuth completion writes the missing user fields (age_confirmed_at, timezone,
// partner_code) AND sets email_verified_at = now() (AUTH-03 pre-verified) AND
// inserts the 2 consent_logs rows + the trialing subscription — ALL inside ONE
// `db.transaction(...)` block (Codex HIGH #2). If any step throws, the tx
// rolls back atomically.
//
// Wave-1 reconciliation: re-uses the same `getCurrentPolicyVersions` (plural)
// + `insertSignupConsents({tosPolicyVersionId, privacyPolicyVersionId}, tx)`
// helpers from plan 06 — same purpose='signup_acceptance' rows, same dual
// policy_version_id binding.
//
// D-32: partner_code lookup against `partner_stores`; inactive/absent rejects
// with `invalid_partner_code`. Empty/null = organic + 14 days.
//
// Idempotent: if the user's age_confirmed_at is already set, return
// `already_completed` (T-04-09-06 mitigation).

import { withUnitOfWork } from "@shared/db/unit-of-work";
import { getUserById, setOauthCompletionFields } from "@contexts/iam/infrastructure/db/users";
import { isPartnerCodeActive } from "@contexts/iam/infrastructure/db/partner-store";
import { getCurrentPolicyVersions } from "@contexts/iam/infrastructure/db/policy-versions";
import { insertSignupConsents } from "@contexts/iam/infrastructure/db/consent-logs";
import { insertTrialingSubscription } from "@contexts/iam/infrastructure/db/subscriptions";
import { captureSignupCompleted } from "@contexts/iam/infrastructure/posthog-bridge";
import type { OAuthComplete } from "@contexts/iam/domain/schemas";

export type OauthCompleteResult =
  | { kind: "success" }
  | { kind: "already_completed" }
  | { kind: "invalid_partner_code" };

export async function completeOauthSignup(
  input: OAuthComplete & { userId: string; email: string },
): Promise<OauthCompleteResult> {
  // T-04-09-06 idempotence: if the user already finished oauth-complete, return
  // already_completed without writing anything (UI redirect to / per Q4).
  const existing = await getUserById(input.userId);
  if (!existing) {
    throw new Error("oauth-complete: user not found in public.users");
  }
  if (existing.ageConfirmedAt) {
    return { kind: "already_completed" };
  }

  // D-32: partner_code validation (mirrors signup.ts).
  const partnerCodeRaw = (input.partner_code ?? "").trim();
  let trialSource: "organic" | "partner" = "organic";
  if (partnerCodeRaw.length > 0) {
    const isActive = await isPartnerCodeActive(partnerCodeRaw);
    if (!isActive) {
      return { kind: "invalid_partner_code" };
    }
    trialSource = "partner";
  }
  const partnerCode = partnerCodeRaw.length > 0 ? partnerCodeRaw : null;

  // Codex HIGH #2 + Phase 04 review WR-05: ALL DB writes inside ONE
  // withUnitOfWork(input.userId, ...) — sets `request.jwt.claim.sub` GUC
  // so RLS policies can scope correctly (D-20). Unlike signup (which has
  // no JWT yet — see signup.ts comment near its db.transaction), the
  // OAuth user IS authenticated by this point, so binding the subject is
  // both safe and required for defense-in-depth RLS to engage.
  // If any step throws, the tx rolls back; age_confirmed_at +
  // email_verified_at remain unset so the user can retry.
  await withUnitOfWork(input.userId, async (tx) => {
    // Wave-1 reconciliation: BOTH active policy_versions rows so each
    // consent_logs row points to the correct documentType-bound version.
    const policies = await getCurrentPolicyVersions(tx);
    if (!policies) {
      throw new Error(
        "oauth-complete: missing is_current=true policy_versions row for terms_of_service or privacy_policy " +
          "(deployment misconfig — fixtures/seed-policy-version.ts MUST seed both)",
      );
    }

    await setOauthCompletionFields(input.userId, { timezone: input.timezone, partnerCode }, tx);

    await insertSignupConsents(
      {
        userId: input.userId,
        tosPolicyVersionId: policies.tos.id,
        privacyPolicyVersionId: policies.privacy.id,
      },
      tx,
    );

    await insertTrialingSubscription(
      {
        userId: input.userId,
        partnerCode,
        trialSource,
      },
      tx,
    );
  });

  // Pitfall 8: signup_completed fires HERE for OAuth users (they skip the
  // /auth/verify route entirely because Google OAuth is pre-verified per
  // AUTH-03). The clock for the <2-min first-value SLA starts at this point.
  await captureSignupCompleted(input.userId);

  return { kind: "success" };
}
