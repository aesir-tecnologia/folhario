import { and, asc, eq, lte, sql } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { pendingStorageDeletions } from "@contexts/catalog/infrastructure/db/schema";

type PsdDb = DbClient | TransactionalDb;

export type PendingStorageDeletionRow = typeof pendingStorageDeletions.$inferSelect;
export type PendingStorageDeletionInsert = typeof pendingStorageDeletions.$inferInsert;

export async function create(
  db: PsdDb,
  input: PendingStorageDeletionInsert,
): Promise<PendingStorageDeletionRow> {
  const [row] = await db.insert(pendingStorageDeletions).values(input).returning();
  if (!row) throw new Error("pendingStorageDeletions.create: insert returned no row");
  return row;
}

export async function markInProgress(
  db: PsdDb,
  id: string,
): Promise<PendingStorageDeletionRow | null> {
  const [row] = await db
    .update(pendingStorageDeletions)
    .set({
      status: "in_progress",
      attempts: sql`${pendingStorageDeletions.attempts} + 1`,
      startedAt: sql`now()`,
    })
    .where(eq(pendingStorageDeletions.id, id))
    .returning();
  return row ?? null;
}

export async function markCompleted(
  db: PsdDb,
  id: string,
): Promise<PendingStorageDeletionRow | null> {
  const [row] = await db
    .update(pendingStorageDeletions)
    .set({ status: "completed", completedAt: sql`now()` })
    .where(eq(pendingStorageDeletions.id, id))
    .returning();
  return row ?? null;
}

/**
 * Record an error for a deletion attempt.
 *
 * State machine: returns the row to 'pending' when attempts < 5 (retry-able),
 * transitions to 'failed' when attempts >= 5 (terminal).
 *
 * `markInProgress` already incremented attempts, so the current value
 * in the DB is the count AFTER this attempt.
 */
export async function recordError(
  db: PsdDb,
  id: string,
  message: string,
): Promise<PendingStorageDeletionRow | null> {
  const [row] = await db
    .update(pendingStorageDeletions)
    .set({
      status: sql`CASE WHEN ${pendingStorageDeletions.attempts} >= 5 THEN 'failed'::pending_deletion_status ELSE 'pending'::pending_deletion_status END`,
      lastError: message,
    })
    .where(eq(pendingStorageDeletions.id, id))
    .returning();
  return row ?? null;
}

export async function markFailed(
  db: PsdDb,
  id: string,
): Promise<PendingStorageDeletionRow | null> {
  const [row] = await db
    .update(pendingStorageDeletions)
    .set({ status: "failed" })
    .where(eq(pendingStorageDeletions.id, id))
    .returning();
  return row ?? null;
}

/**
 * **Service-role only.** This function MUST be called with the bare
 * `db` singleton from `@shared/db/client` (which connects as the
 * `postgres` BYPASSRLS role). Calling it inside `withUnitOfWork(...)`
 * would `SET LOCAL ROLE authenticated` and `auth.uid()` would resolve
 * to the request's userId — which is the wrong scope (the reconciler
 * processes rows across all users). RESEARCH Pitfall 4.
 *
 * The integration test in `catalog-pending-storage-deletions-repo.integration.test.ts`
 * proves the discipline by running this query under the authenticated
 * role with NO `request.jwt.claim.sub` binding and asserting zero
 * rows returned. Future code-review must reject any caller that
 * imports this function and wraps it in withUnitOfWork.
 *
 * SQL contract (no opts — Inngest happy-path):
 *   SELECT * FROM pending_storage_deletions
 *   WHERE status = 'pending' AND scheduled_at <= now()
 *   ORDER BY scheduled_at ASC
 *   LIMIT $1
 *   FOR UPDATE SKIP LOCKED
 *
 * SQL contract (with opts.staleInProgressMinutes — reconciler cron):
 *   SELECT * FROM pending_storage_deletions
 *   WHERE (status = 'pending' OR (status = 'in_progress' AND started_at < NOW() - INTERVAL '30 minutes'))
 *     AND scheduled_at <= now()
 *   ORDER BY scheduled_at ASC
 *   LIMIT $1
 *   FOR UPDATE SKIP LOCKED
 */
export async function fetchPendingBatch(
  db: DbClient,
  limit: number,
  opts?: { staleInProgressMinutes?: number },
): Promise<PendingStorageDeletionRow[]> {
  const staleMinutes = opts?.staleInProgressMinutes;

  const statusCondition =
    staleMinutes !== undefined
      ? sql`(${pendingStorageDeletions.status} = 'pending' OR (${pendingStorageDeletions.status} = 'in_progress' AND ${pendingStorageDeletions.startedAt} < now() - (${staleMinutes} || ' minutes')::interval))`
      : eq(pendingStorageDeletions.status, "pending");

  return db
    .select()
    .from(pendingStorageDeletions)
    .where(
      and(
        statusCondition,
        lte(pendingStorageDeletions.scheduledAt, sql`now()`),
      ),
    )
    .orderBy(asc(pendingStorageDeletions.scheduledAt))
    .limit(limit)
    .for("update", { skipLocked: true });
}
