#!/usr/bin/env tsx
/**
 * Seed runner — applies all phase seed files in order.
 *
 * Each seed file uses `INSERT ... ON CONFLICT DO NOTHING` (or idempotent
 * UPDATE), so re-running this script is safe (D-14: direct DATABASE_URL,
 * no pooler).
 *
 * Exit codes:
 *  0 — all seed files applied without error.
 *  1 — a seed file is missing.
 *  2 — connection or unexpected SQL error.
 */

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

const SEED_FILES: Array<{ path: string; label: string }> = [
  { path: "drizzle/seeds/phase-02.sql", label: "phase-02" },
  { path: "drizzle/seeds/phase-06.sql", label: "phase-06" },
];

async function main(): Promise<void> {
  const sql = getMigrationSql();
  try {
    for (const { path, label } of SEED_FILES) {
      const filePath = resolve(process.cwd(), path);
      let seedSql: string;
      try {
        seedSql = await readFile(filePath, "utf8");
      } catch (err) {
        console.error(
          `[seed] could not read seed file at ${filePath}. Ensure it is committed.`,
          err,
        );
        process.exit(1);
      }

      if (seedSql.trim().length === 0) {
        console.error(`[seed] seed file ${filePath} is empty. Refusing to no-op.`);
        process.exit(1);
      }

      await sql.unsafe(seedSql);
      console.log(`[seed] applied drizzle/seeds/${label}.sql successfully (idempotent).`);
    }
  } catch (err) {
    console.error("[seed] error applying seed SQL:", err);
    process.exit(2);
  } finally {
    await closeMigrationSql(sql);
  }
}

void main();
