#!/usr/bin/env tsx
/**
 * Phase-2 Plan 04: seed runner.
 *
 * Reads `drizzle/seeds/phase-02.sql` and executes it through the migration
 * client (D-14: direct DATABASE_URL, no pooler). The seed file uses
 * `INSERT ... ON CONFLICT DO NOTHING`, so re-running this script is safe
 * and idempotent.
 *
 * Exit codes:
 *  0 — seed file applied without error.
 *  1 — seed file is missing.
 *  2 — connection or unexpected SQL error.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

const SEED_FILE_PATH = resolve(process.cwd(), "drizzle/seeds/phase-02.sql");

async function main(): Promise<void> {
  let seedSql: string;
  try {
    seedSql = await readFile(SEED_FILE_PATH, "utf8");
  } catch (err) {
    console.error(
      `[seed] could not read seed file at ${SEED_FILE_PATH}. ` +
        "Plan 02-04 ships drizzle/seeds/phase-02.sql; ensure it is committed.",
      err,
    );
    process.exit(1);
  }

  if (seedSql.trim().length === 0) {
    console.error(`[seed] seed file ${SEED_FILE_PATH} is empty. Refusing to no-op.`);
    process.exit(1);
  }

  const sql = getMigrationSql();
  try {
    await sql.unsafe(seedSql);
    console.log("[seed] applied drizzle/seeds/phase-02.sql successfully (idempotent).");
  } catch (err) {
    console.error("[seed] error applying seed SQL:", err);
    process.exit(2);
  } finally {
    await closeMigrationSql(sql);
  }
}

void main();
