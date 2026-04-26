#!/usr/bin/env tsx
/**
 * Phase-2 Plan 01 placeholder: confirms a setup-script can connect over the
 * direct migration URL and refuses to claim "seeds OK" until later plans land
 * the schema and reference rows. Plan 02-04 replaces the placeholder lookup
 * with real legal-basis / policy-version / identification-limit /
 * provider-budget seed assertions.
 *
 * Exit codes:
 *  0  — readiness check (`select 1`) succeeded AND every required seed table
 *       is present and contains at least one row. (Currently unreachable
 *       because no Phase-2 schema has shipped yet; this is intentional —
 *       `pnpm db:setup` MUST fail until plan 02-04.)
 *  1  — schema not ready: required tables are absent or unseeded.
 *  2  — connection or unexpected SQL error.
 */

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

// Minimal placeholder list. Plan 02-04 expands this to the full Phase-2
// reference-data set (legal_basis, policy_versions, identification_limits,
// provider_budgets, etc.).
const REQUIRED_TABLES: readonly string[] = ["public.users"];

async function main(): Promise<void> {
  const sql = getMigrationSql();

  try {
    const ping = await sql<{ one: number }[]>`select 1 as one`;
    if (ping[0]?.one !== 1) {
      console.error("[check-seeds] readiness probe failed: select 1 returned unexpected payload");
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
        `[check-seeds] schema not ready — missing tables: ${missing.join(", ")}. ` +
          "Run `pnpm db:migrate && pnpm db:seed` first; if migrations or seeds are " +
          "missing, this is expected until Phase-2 Plan 02-04.",
      );
      process.exit(1);
    }

    // TODO(plan 02-04): for each seed table, assert non-empty rowcount and the
    // exact reference set (legal_basis enum coverage, policy_versions current,
    // identification_limits trial+paid rows, provider_budgets day rows).
    console.log("[check-seeds] schema present. Real seed assertions land in plan 02-04.");
  } catch (err) {
    console.error("[check-seeds] unexpected error:", err);
    process.exit(2);
  } finally {
    await closeMigrationSql(sql);
  }
}

void main();
