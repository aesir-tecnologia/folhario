import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import { db, type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { consentLogs } from "@contexts/iam/infrastructure/db/schema";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

/**
 * IAM `consent_logs` repository — functional module per phase-2 D-16.
 *
 * Caller-provided `userId` filters are explicit (D-20, T-02-12). RLS is
 * defense in depth; this module would still scope correctly even if the
 * `consent_logs_owner_all` policy were bypassed via service-role queries.
 */

type ConsentLogsDb = DbClient | TransactionalDb;

export type ConsentLogRow = typeof consentLogs.$inferSelect;
export type ConsentLogInsert = typeof consentLogs.$inferInsert;

export async function create(
  db: ConsentLogsDb,
  input: ConsentLogInsert,
): Promise<ConsentLogRow> {
  const [row] = await db.insert(consentLogs).values(input).returning();
  if (!row) {
    throw new Error("consentLogs.create: insert returned no row");
  }
  return row;
}

export interface ListByUserCursor {
  /**
   * Inclusive cursor — return rows with (createdAt, id) strictly LESS than
   * the supplied tuple, in DESC order. Phase 06 wraps this in a base64 JSON
   * cursor helper; the repository contract stays low-level so use-cases can
   * compose it freely.
   */
  createdAt: string;
  id: string;
}

export interface ListByUserOptions {
  cursor?: ListByUserCursor;
  limit?: number;
}

export async function listByUser(
  dbHandle: ConsentLogsDb,
  userId: string,
  options: ListByUserOptions = {},
): Promise<ConsentLogRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);

  const baseFilter = eq(consentLogs.userId, userId);

  const cursor = options.cursor;
  const where = cursor
    ? and(
        baseFilter,
        or(
          lt(consentLogs.createdAt, cursor.createdAt),
          and(eq(consentLogs.createdAt, cursor.createdAt), lt(consentLogs.id, cursor.id)),
        ),
      )
    : baseFilter;

  return dbHandle
    .select()
    .from(consentLogs)
    .where(where)
    .orderBy(desc(consentLogs.createdAt), desc(consentLogs.id))
    .limit(limit);
}

/**
 * Phase 4 AUTH-09 (Wave-1 reconciliation per 04-PREREQ-AUDIT amendment).
 *
 * Phase 2 separated "what was consented to" (`consent_logs.purpose`) from
 * "which legal document was active at consent time" (`consent_logs.policy_version_id`
 * → `policy_versions.document_type`). Signup acceptance writes TWO rows,
 * both with `purpose='signup_acceptance'` (Phase 4-added enum value, plan
 * 04-02), each pointing to a distinct `policy_versions` row — one with
 * `document_type='terms_of_service'` and one with `document_type='privacy_policy'`.
 *
 * Tests assert via JOIN `consent_logs.policy_version_id = policy_versions.id`
 * (NOT a literal `purpose` string match for the doc identity).
 *
 * Codex HIGH #2: accepts `dbOrTx` so the signup use-case can wrap this with
 * the user/subscription/token writes in one transaction.
 */
export async function insertSignupConsents(
  opts: {
    userId: string;
    /** policy_versions.id where document_type='terms_of_service' AND is_current=true */
    tosPolicyVersionId: string;
    /** policy_versions.id where document_type='privacy_policy' AND is_current=true */
    privacyPolicyVersionId: string;
  },
  dbOrTx: DbOrTx = db,
): Promise<{ termsLogId: string; privacyLogId: string }> {
  const rows = await dbOrTx.execute<{ id: string; policy_version_id: string }>(
    sql`INSERT INTO public.consent_logs (user_id, purpose, legal_basis, source, policy_version_id, granted_at)
          VALUES
            (${opts.userId}, 'signup_acceptance', 'contract', 'signup', ${opts.tosPolicyVersionId},     now()),
            (${opts.userId}, 'signup_acceptance', 'contract', 'signup', ${opts.privacyPolicyVersionId}, now())
        RETURNING id, policy_version_id`,
  );
  const terms = rows.find((r) => r.policy_version_id === opts.tosPolicyVersionId);
  const privacy = rows.find((r) => r.policy_version_id === opts.privacyPolicyVersionId);
  if (!terms || !privacy) {
    throw new Error(
      "insertSignupConsents: expected 2 rows with distinct policy_version_id (terms + privacy)",
    );
  }
  return { termsLogId: terms.id, privacyLogId: privacy.id };
}
