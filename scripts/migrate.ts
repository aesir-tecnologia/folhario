#!/usr/bin/env tsx
/**
 * Phase-2 D-14: migration runner that surfaces real errors.
 *
 * `drizzle-kit migrate` swallows the underlying SQL error inside its CLI
 * spinner — when a migration fails on CI you only see "ELIFECYCLE Command
 * failed" with no clue which statement broke. This script uses the
 * drizzle-orm migrator directly so any error is rethrown verbatim with the
 * failing migration filename in the stack.
 *
 * Identical contract to `drizzle-kit migrate` — reads
 * `drizzle/migrations/meta/_journal.json` and applies anything not yet in
 * `drizzle.__drizzle_migrations`.
 *
 * Deliberately does NOT import `src/shared/db/migration-client` (and therefore
 * not `serverEnv`): the production migration job in
 * `.github/workflows/deploy-production.yml` only sets DATABASE_URL — it must
 * not be coupled to the full Supabase server-env schema. Postgres options are
 * duplicated verbatim from migration-client.ts to keep migrator behavior
 * identical (T-02-02: read only DATABASE_URL).
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { z } from "zod";

const migrationEnv = z.object({ DATABASE_URL: z.string().url() }).parse(process.env);

async function main(): Promise<void> {
  const sql = postgres(migrationEnv.DATABASE_URL, {
    max: 1,
    idle_timeout: 5,
  });
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("[migrate] OK — all migrations applied.");
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
