import { sql } from "drizzle-orm";

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
 * `SET LOCAL ROLE authenticated` resets at COMMIT/ROLLBACK so the next
 * checkout from the postgres-js pool starts as the connection's base role
 * again. Without this, `auth.uid() = user_id` policies are silently
 * skipped because the postgres superuser carries `rolbypassrls=true`
 * (CR-02 from 02-REVIEW.md).
 *
 * `set_config('request.jwt.claim.sub', $userId, true)` uses `is_local=true`
 * so the setting is scoped to the current transaction.
 *
 * `userId` is validated at runtime because the value can flow in from
 * JWT-derived sources where TypeScript can no longer vouch for it.
 */
export type TransactionalDb = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export type UnitOfWorkCallback<T> = (tx: TransactionalDb) => Promise<T>;

export class UnitOfWorkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnitOfWorkError";
  }
}

function assertValidUserId(userId: unknown): asserts userId is string {
  if (typeof userId !== "string") {
    throw new UnitOfWorkError(`withUnitOfWork: userId must be a string (got ${typeof userId})`);
  }
  if (userId.trim() === "") {
    throw new UnitOfWorkError("withUnitOfWork: userId must be a non-empty string");
  }
}

export async function withUnitOfWork<T>(userId: string, fn: UnitOfWorkCallback<T>): Promise<T> {
  assertValidUserId(userId);

  // Drizzle's `.transaction()` opens a `BEGIN`/`COMMIT` envelope before
  // invoking the callback; the `tx: TransactionalDb` parameter is the
  // structural assertion that we are inside that envelope. There is no
  // public API path that yields a `TransactionalDb` outside an open
  // transaction. The integration test in
  // `tests/integration/unit-of-work.integration.test.ts` exercises the
  // GUC end-to-end inside the callback (`current_setting('request.jwt.claim.sub')`
  // returns the supplied userId), which is the behavioral proof.
  return db.transaction(async (tx) => {
    // Switch to the `authenticated` role for the duration of this
    // transaction so RLS policies actually engage (CR-02 mitigation).
    // The pooled connection authenticates as `postgres` which carries
    // BYPASSRLS — without this switch, every owner policy is silently
    // skipped at runtime.
    await tx.execute(sql`set local role authenticated`);

    // Bind the JWT sub claim for RLS / auth.uid()-style policies.
    // Parameterize userId; keep `true` (is_local) as a SQL literal.
    await tx.execute(sql`select set_config('request.jwt.claim.sub', ${userId}, true)`);

    return fn(tx);
  });
}
