import { sql } from "drizzle-orm";
import { z } from "zod";

import { db, type DbClient } from "@shared/db/client";

/**
 * Unit-of-Work boundary for application use-cases.
 *
 * Per phase-2 D-18/D-20: every mutating use-case runs through a single DB
 * transaction. Inside that transaction we (a) `SET LOCAL ROLE authenticated`
 * so RLS policies engage (the connection role `postgres` has BYPASSRLS),
 * and (b) bind `request.jwt.claim.sub` so policies that call `auth.uid()`
 * resolve to the right subject. Repositories still apply explicit
 * `user_id` filters as the primary control; RLS is defense in depth.
 *
 * Threat T-02-12 mitigation: a stray autocommit query would silently
 * bypass both the role switch and the GUC. We route everything through
 * `db.transaction(...)`, which is structurally guaranteed by Drizzle to
 * open a transaction. The integration test proves the GUC is set inside
 * the callback and reset afterwards.
 *
 * Threat T-02-32 mitigation: `userId` is parsed with `z.string().uuid()`
 * BEFORE `db.transaction(...)` is called. A non-UUID string would otherwise
 * be silently bound to `request.jwt.claim.sub`, where any RLS policy
 * comparing `auth.uid() = user_id` would either match nothing (silent
 * deny-all) or, with a colliding string, match the wrong row. Failure
 * surfaces as `UnitOfWorkError` whose `code` is `validation_failed`.
 *
 * Threat T-02-33 mitigation: `set_config(..., true)` is `is_local = true`
 * (transaction-scoped); the binding evaporates at COMMIT/ROLLBACK and
 * cannot leak across pooled-connection checkouts. As defense in depth we
 * also assert `isTransactionalClient(tx)` inside the `db.transaction(...)`
 * callback so a future change exposing a shape-mismatched argument
 * (e.g. a stub passed via `as any`) is caught at runtime, not silently
 * accepted.
 */
export type TransactionalDb = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type UnitOfWorkCallback<T> = (tx: TransactionalDb) => Promise<T>;

export class UnitOfWorkError extends Error {
  readonly code = "validation_failed" as const;
  constructor(message: string) {
    super(message);
    this.name = "UnitOfWorkError";
  }
}

const userIdSchema = z.string().uuid();

function assertValidUserId(userId: unknown): asserts userId is string {
  if (userIdSchema.safeParse(userId).success) return;

  if (typeof userId !== "string") {
    throw new UnitOfWorkError(
      `withUnitOfWork: userId must be a string (got ${userId === null ? "null" : typeof userId})`,
    );
  }
  if (userId.trim() === "") {
    throw new UnitOfWorkError("withUnitOfWork: userId must be a non-empty string");
  }
  throw new UnitOfWorkError(
    "withUnitOfWork: userId must be a valid UUID (validation_failed; T-02-32)",
  );
}

/**
 * Runtime predicate distinguishing a Drizzle transactional client (`tx`,
 * the parameter of `db.transaction(cb)`) from the bare singleton `db`.
 *
 * Drizzle's `PgTransaction` extends `PgDatabase` and adds `rollback()` /
 * `setTransaction()`. The base `PgDatabase` has neither. The runtime
 * `typeof rollback === "function"` check therefore separates a real `tx`
 * from `db` even when TypeScript has been bypassed.
 *
 * Exported so callers (and the leak unit test) can guard against a future
 * change that would let a non-transactional client reach a code path that
 * relies on `is_local` GUCs.
 */
export function isTransactionalClient(value: unknown): value is TransactionalDb {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { rollback?: unknown }).rollback === "function"
  );
}

export async function withUnitOfWork<T>(userId: string, fn: UnitOfWorkCallback<T>): Promise<T> {
  assertValidUserId(userId);

  return db.transaction(async (tx) => {
    if (!isTransactionalClient(tx)) {
      throw new UnitOfWorkError(
        "withUnitOfWork: transaction callback received a non-transactional client (T-02-33)",
      );
    }

    await tx.execute(sql`set local role authenticated`);
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);

    return fn(tx);
  });
}
