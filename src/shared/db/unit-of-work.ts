import { sql } from "drizzle-orm";

import { db, type DbClient } from "@shared/db/client";

/**
 * Unit-of-Work boundary for application use-cases.
 *
 * Per phase-2 D-18/D-20: every mutating use-case runs through a single DB
 * transaction. Inside that transaction we set Postgres' `request.jwt.claim.sub`
 * GUC so any RLS policy that calls `auth.uid()` (or our local CI shim that
 * reads the same GUC) sees the right user. RLS is defense in depth — the
 * functional repositories below still apply explicit `user_id` filters.
 *
 * Threat T-02-12 mitigation: a stray autocommit query would silently bypass
 * the GUC. We therefore route everything through `db.transaction(...)`, which
 * is structurally guaranteed by Drizzle to open a transaction (see
 * `PgDatabase#transaction`). The integration test in
 * `tests/integration/unit-of-work.integration.test.ts` proves the GUC is set
 * for queries inside the callback and reset afterwards.
 *
 * `set_config('request.jwt.claim.sub', $userId, true)` uses the third arg
 * `is_local=true` so the setting is scoped to the current transaction — it
 * vanishes on COMMIT/ROLLBACK and cannot leak between connections in the
 * pooled `postgres-js` Sql instance.
 *
 * `userId` is validated at runtime (not just at the type level) because the
 * value can flow in from JWT-derived sources where TypeScript can no longer
 * vouch for it.
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
    throw new UnitOfWorkError(
      `withUnitOfWork: userId must be a string (got ${typeof userId})`,
    );
  }
  if (userId.trim() === "") {
    throw new UnitOfWorkError("withUnitOfWork: userId must be a non-empty string");
  }
}

export async function withUnitOfWork<T>(
  userId: string,
  fn: UnitOfWorkCallback<T>,
): Promise<T> {
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
    // Bind the JWT sub claim for RLS / auth.uid()-style policies.
    // Parameterize userId; keep `true` (is_local) as a SQL literal.
    await tx.execute(
      sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
    );

    return fn(tx);
  });
}
