import postgres, { type Sql } from "postgres";

import { serverEnv } from "@shared/config/server-env";

/**
 * Migration / setup-script SQL helper.
 *
 * Per Phase-2 D-14: setup scripts (drizzle-kit, seeds, RLS checks, seed checks)
 * connect via DATABASE_URL — the direct, non-pooled Postgres URL — to avoid
 * Supavisor transaction-pooler constraints (e.g. prepared-statement
 * incompatibilities). Runtime app code lives elsewhere and uses the pooled URL
 * with `{ prepare: false }`; this module must never reach for it.
 *
 * Threat T-02-02 mitigation: this module reads only `serverEnv.DATABASE_URL`.
 * Static greps in later plans guard the boundary; do not add a fallback here.
 */
export function getMigrationSql(): Sql {
  return postgres(serverEnv.DATABASE_URL, {
    max: 1,
    idle_timeout: 5,
  });
}

export async function closeMigrationSql(sql: Sql): Promise<void> {
  await sql.end({ timeout: 5 });
}
