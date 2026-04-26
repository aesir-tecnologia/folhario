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

  return db.transaction(async (tx) => {
    // Probe that we are actually inside a transaction at call time. The
    // GUC `transaction_read_only` is always defined inside a tx; calling it
    // with `missing_ok=true` returns null outside of one. Drizzle's
    // `transaction()` is structurally guaranteed to open one, but the probe
    // turns a future regression into a loud failure rather than silent
    // autocommit drift.
    const probe = await tx.execute<{ in_tx: string | null }>(
      sql`select current_setting('transaction_read_only', true) as in_tx`,
    );
    const probeRow = probe[0];
    if (!probeRow || probeRow.in_tx === null) {
      throw new UnitOfWorkError(
        "withUnitOfWork: callback is not running inside an active transaction",
      );
    }

    // Bind the JWT sub claim for RLS / auth.uid()-style policies.
    // Parameterize userId; keep `true` (is_local) as a SQL literal.
    await tx.execute(
      sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
    );

    return fn(tx);
  });
}
