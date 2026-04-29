// Phase 4 plan 06 — signup orchestration.
//
//  - D-03/D-25 two-phase: authAdapter.createUser() THEN one db.transaction(...)
//    for all DB writes; if the tx fails, compensate with adminDeleteUser.
//  - Codex HIGH #2: ALL DB writes inside ONE db.transaction(...) block; the
//    repositories accept `dbOrTx` so the same transactional handle threads
//    through every write.
//  - Codex HIGH #3: ALL Supabase auth calls go through `authAdapter`; this
//    file does not import `@supabase/*` and does not call `supabase.auth.*`.
//  - D-32: partner_code looked up against `partner_stores`; inactive/absent
//    rejects with `invalid_partner_code`. Empty/null = organic + 14 days.
//  - Wave-1 reconciliation: `getCurrentPolicyVersions` returns BOTH active
//    rows so each `consent_logs` row references the correct documentType-bound
//    `policy_version_id` (purpose='signup_acceptance' for both rows).
//  - Resolved Q1: already-registered email returns 200 + welcome-back; the
//    route handler dispatches the welcome-back email event.

import { db } from "@shared/db/client";
import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import { inngest } from "@shared/inngest/client";
import { getCurrentPolicyVersions } from "@contexts/iam/infrastructure/db/policy-versions";
import { getUserByEmail, insertPublicUser } from "@contexts/iam/infrastructure/db/users";
import { isPartnerCodeActive } from "@contexts/iam/infrastructure/db/partner-store";
import { insertSignupConsents } from "@contexts/iam/infrastructure/db/consent-logs";
import { insertTrialingSubscription } from "@contexts/iam/infrastructure/db/subscriptions";
import { mintVerificationToken } from "@contexts/iam/infrastructure/db/verification-tokens";
import type { SignupRequest } from "@contexts/iam/domain/schemas";
import ptBR from "../../../messages/pt-BR.json";

// pt-BR is the only locale at launch (PROJECT.md). Importing the JSON directly
// keeps this use-case decoupled from `next-intl/server`'s request-context
// requirement (which integration tests cannot satisfy without spinning up Next).
const verificationSubject = (ptBR as { email: { verification: { subject: string } } }).email
  .verification.subject;

export type SignupResult =
  | { kind: "created"; userId: string; verificationUrl: string }
  | { kind: "already_registered"; resetUrl: string }
  | { kind: "invalid_partner_code" };

export async function signupUser(input: SignupRequest, requestUrl: URL): Promise<SignupResult> {
  // Resolved Q1: already-registered → 200 + welcome-back at the route layer.
  // No "email already in use" enumeration leak.
  const existing = await getUserByEmail(input.email);
  if (existing) {
    const resetUrl = new URL("/auth/forgot-password", requestUrl).toString();
    return { kind: "already_registered", resetUrl };
  }

  // D-32: partner_code validation.
  const partnerCodeRaw = (input.partner_code ?? "").trim();
  let trialSource: "organic" | "partner" = "organic";
  if (partnerCodeRaw.length > 0) {
    const isActive = await isPartnerCodeActive(partnerCodeRaw);
    if (!isActive) {
      return { kind: "invalid_partner_code" };
    }
    trialSource = "partner";
  }

  // D-03/Codex HIGH #3: authAdapter.createUser (NOT supabase.auth.admin.createUser).
  const created = await authAdapter.createUser({
    email: input.email,
    password: input.password,
  });
  const userId = created.id;

  // D-25 + Codex HIGH #2: ALL DB writes inside ONE db.transaction(...).
  // If anything throws, the tx rolls back; the catch then compensates the
  // auth.users insert via authAdapter.adminDeleteUser.
  //
  // Phase 04 review WR-05: this path INTENTIONALLY does NOT wrap in
  // withUnitOfWork(userId, ...). The user has just been minted in
  // auth.users above; no JWT exists yet on the caller, and the public.users
  // INSERT must run under the service-role connection rather than as
  // `authenticated` (which is what withUnitOfWork's `set local role` would
  // switch to). `oauth-complete.ts` IS wrapped in withUnitOfWork because
  // there a Supabase JWT exists. Defense-in-depth here lives in the
  // explicit `userId` filters the repositories apply.
  let tokenId: string;
  let rawToken: string;
  try {
    const txResult = await db.transaction(async (tx) => {
      // Wave-1 reconciliation: BOTH active policy_versions rows so each
      // consent_logs row points to the correct documentType-bound version.
      const policies = await getCurrentPolicyVersions(tx);
      if (!policies) {
        throw new Error(
          "signupUser: missing is_current=true policy_versions row for terms_of_service or privacy_policy " +
            "(deployment misconfig — fixtures/seed-policy-version.ts MUST seed both)",
        );
      }

      await insertPublicUser(
        {
          id: userId,
          email: input.email,
          age_confirmed_at: new Date(),
          timezone: input.timezone,
          partner_code: partnerCodeRaw.length > 0 ? partnerCodeRaw : null,
          trial_source: trialSource,
        },
        tx,
      );

      await insertSignupConsents(
        {
          userId,
          tosPolicyVersionId: policies.tos.id,
          privacyPolicyVersionId: policies.privacy.id,
        },
        tx,
      );

      await insertTrialingSubscription(
        {
          userId,
          partnerCode: partnerCodeRaw.length > 0 ? partnerCodeRaw : null,
          trialSource,
        },
        tx,
      );

      const minted = await mintVerificationToken({ userId, sentToEmail: input.email }, tx);
      return minted;
    });
    tokenId = txResult.tokenId;
    rawToken = txResult.rawToken;
  } catch (dbError) {
    // D-25 compensating delete via the AuthAdapter (Codex HIGH #3 boundary).
    await authAdapter.adminDeleteUser(userId);
    throw dbError;
  }

  // D-25 step 3 (after commit): emit verification email + mint browser session.
  const verificationUrl = new URL(`/auth/verify?token=${rawToken}`, requestUrl).toString();
  await inngest.send({
    id: `email-verification/${tokenId}`,
    name: "notifications/email.requested",
    data: {
      template: "verification",
      to: input.email,
      subject: verificationSubject,
      props: { url: verificationUrl, userEmail: input.email },
    },
  });

  // Mint Supabase session cookie via the AuthAdapter (Codex HIGH #3).
  // Non-fatal if signIn fails — the unverified blocker still works on next
  // request. Catch any error (including the "cookies() called outside request
  // scope" thrown when running outside a Next request, e.g. integration tests)
  // so signup itself stays atomic with the DB tx.
  try {
    await authAdapter.signInWithPassword({
      email: input.email,
      password: input.password,
    });
  } catch {
    /* swallow: best-effort session mint */
  }

  return { kind: "created", userId, verificationUrl };
}
