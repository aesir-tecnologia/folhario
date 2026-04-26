#!/usr/bin/env tsx
/**
 * Phase-2 Plan 01 placeholder: confirms a setup-script can connect over the
 * direct migration URL and refuses to claim "RLS OK" until later plans land
 * the schema. Plan 02-03 replaces the table list and asserts every public
 * table has `rowsecurity = true` plus an explicit policy.
 *
 * Exit codes:
 *  0  — readiness check (`select 1`) succeeded AND every required table is
 *       present. (Currently unreachable because no Phase-2 schema has shipped
 *       yet; this is intentional — `pnpm db:setup` MUST fail until plan 02-03.)
 *  1  — schema not ready: required tables are absent.
 *  2  — connection or unexpected SQL error.
 */

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

// Minimal placeholder list. Plan 02-03 expands this to the full Phase-2
// table set discovered in PRD §4.
const REQUIRED_TABLES: readonly string[] = ["public.users"];

async function main(): Promise<void> {
  const sql = getMigrationSql();

  try {
    const ping = await sql<{ one: number }[]>`select 1 as one`;
    if (ping[0]?.one !== 1) {
      console.error("[check-rls] readiness probe failed: select 1 returned unexpected payload");
      process.exit(2);
    }

    const missing: string[] = [];
    for (const table of REQUIRED_TABLES) {
      const rows = await sql<{ exists: string | null }[]>`
        select to_regclass(${table})::text as exists
      `;
      if (!rows[0]?.exists) missing.push(table);
    }

    if (missing.length > 0) {
      console.error(
        `[check-rls] schema not ready — missing tables: ${missing.join(", ")}. ` +
          "Run `pnpm db:migrate` first; if migrations are missing, this is expected " +
          "until Phase-2 Plan 02-03 lands the schema.",
      );
      process.exit(1);
    }

    // TODO(plan 02-03): for each public table, assert rowsecurity = true and
    // policy_name(s) exist via pg_class / pg_policies queries.
    console.log("[check-rls] schema present. Real RLS assertions land in plan 02-03.");
  } catch (err) {
    console.error("[check-rls] unexpected error:", err);
    process.exit(2);
  } finally {
    await closeMigrationSql(sql);
  }
}

void main();
