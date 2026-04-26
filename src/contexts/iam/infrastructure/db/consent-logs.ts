import { and, desc, eq, lt, or } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { consentLogs } from "@contexts/iam/infrastructure/db/schema";

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
  db: ConsentLogsDb,
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

  return db
    .select()
    .from(consentLogs)
    .where(where)
    .orderBy(desc(consentLogs.createdAt), desc(consentLogs.id))
    .limit(limit);
}
