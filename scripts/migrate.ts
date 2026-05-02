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
 */

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

async function main(): Promise<void> {
  const sql = getMigrationSql();
  const db = drizzle(sql);
  try {
    await migrate(db, { migrationsFolder: "./drizzle/migrations" });
    console.log("[migrate] OK — all migrations applied.");
  } finally {
    await closeMigrationSql(sql);
  }
}

main().catch((err) => {
  console.error("[migrate] FAILED:", err);
  process.exit(1);
});
