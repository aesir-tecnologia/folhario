import { and, eq } from "drizzle-orm";

import { ErrorCode } from "@shared/config/errors";
import { withUnitOfWork, type TransactionalDb } from "@shared/db/unit-of-work";
import { policyVersions } from "@contexts/iam/infrastructure/db/schema";
import {
  create as createConsentLog,
  type ConsentLogRow,
} from "@contexts/iam/infrastructure/db/consent-logs";

/**
 * IAM application — record a ConsentLog row for the authenticated user.
 *
 * Plan 02-09 Task 1. Bound to the diagnostics consent route (Plan 02-09
 * Task 2) and any future surface that needs to record an LGPD-shaped
 * consent grant.
 *
 * Composition:
 *
 *   - Runs inside `withUnitOfWork(userId, …)` so RLS policies that read
 *     `request.jwt.claim.sub` see the right subject (D-20).
 *   - Looks up the current `privacy_policy` row from `policy_versions`
 *     inside the same transaction.
 *   - When no current policy version exists, returns
 *     `ErrorCode.ValidationFailed` directly (NOT a typed domain class)
 *     per the closed error registry (PRD §5 + plan 02-09 must_haves).
 *   - Otherwise writes a ConsentLog row via the functional repository
 *     and returns it.
 *
 * Inputs are the four user-facing fields from the route boundary
 * (`purpose`, `legalBasis`, `source`); the policy version comes from the
 * seed data, the `userId` from the JWT, and `granted_at` defaults to
 * now() on the row.
 */

export type RecordConsentInput = {
  purpose: "identification_third_party" | "push_notifications" | "marketing" | "analytics";
  legalBasis: "consent" | "contract" | "legitimate_interest";
  source: "signup" | "settings" | "first_use_prompt";
};

export type RecordConsentArgs = {
  userId: string;
  input: RecordConsentInput;
};

export type RecordConsentResult =
  | { ok: true; row: ConsentLogRow }
  | { ok: false; error: typeof ErrorCode.ValidationFailed; reason: string };

export async function recordConsent(
  args: RecordConsentArgs,
  injectedTx?: TransactionalDb,
): Promise<RecordConsentResult> {
  const { userId, input } = args;

  // CR-01 mitigation: when a tx is injected (e.g., from withIdempotency),
  // run inside it so the consent write shares the caller's rollback
  // envelope. Otherwise open a fresh UoW so standalone callers still
  // get role + GUC bound.
  const work = async (tx: TransactionalDb): Promise<RecordConsentResult> => {
    const currentPolicy = await tx
      .select({ id: policyVersions.id })
      .from(policyVersions)
      .where(
        and(eq(policyVersions.documentType, "privacy_policy"), eq(policyVersions.isCurrent, true)),
      )
      .limit(1);

    const policy = currentPolicy[0];
    if (!policy) {
      return {
        ok: false,
        error: ErrorCode.ValidationFailed,
        reason: "no_current_policy_version",
      };
    }

    const row = await createConsentLog(tx, {
      userId,
      purpose: input.purpose,
      legalBasis: input.legalBasis,
      source: input.source,
      policyVersionId: policy.id,
      grantedAt: new Date().toISOString(),
    });

    return { ok: true, row };
  };

  if (injectedTx) {
    return work(injectedTx);
  }
  return withUnitOfWork(userId, work);
}
