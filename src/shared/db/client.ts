import { drizzle } from "drizzle-orm/postgres-js";
import postgres, { type Sql } from "postgres";

import { serverEnv } from "@shared/config/server-env";
import * as schema from "@shared/db/schema-registry";

/**
 * Runtime pooled database client.
 *
 * Per phase-2 D-14/D-15:
 * - Connects via DATABASE_POOL_URL (Supavisor transaction-mode pooler).
 * - postgres-js MUST disable prepared statements (`prepare: false`) because
 *   the transaction-mode pooler is incompatible with prepared statements.
 * - The `postgres.Sql` instance is a lazy global singleton so Vercel warm
 *   invocations reuse one connection pool across requests (T-02-13).
 *
 * Threat T-02-01 mitigation: `prepare: false` is non-negotiable here. A
 * unit grep test in `tests/unit/db-client.test.ts` fails the build if this
 * literal disappears, and forbids the non-pooled URL constant from leaking
 * into runtime code.
 *
 * Schema is imported from the migration registry intentionally: it is the
 * single composition point of all per-context tables that Drizzle's typed
 * relational query API needs. The D-01 guard
 * (`tests/unit/schema-registry.test.ts`) only forbids registry imports from
 * `src/app` and `src/contexts/*\/{api,application}` — runtime infrastructure
 * under `src/shared/db/` is permitted.
 */

type GlobalWithSql = typeof globalThis & {
  __folharioSql?: Sql;
};

const globalForDb = globalThis as GlobalWithSql;

export function getSql(): Sql {
  if (!globalForDb.__folharioSql) {
    globalForDb.__folharioSql = postgres(serverEnv.DATABASE_POOL_URL, {
      prepare: false,
    });
  }
  return globalForDb.__folharioSql;
}

export const db = drizzle({ client: getSql(), schema });

export type DbClient = typeof db;

/**
 * Tear down the singleton connection pool. Tests call this in `afterAll`;
 * production code should never call this — Vercel will reclaim the
 * Lambda environment instead.
 */
export async function closeDb(): Promise<void> {
  if (globalForDb.__folharioSql) {
    await globalForDb.__folharioSql.end({ timeout: 5 });
    globalForDb.__folharioSql = undefined;
  }
}
