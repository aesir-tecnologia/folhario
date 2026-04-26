#!/usr/bin/env tsx
/**
 * Phase-2 Plan 04: behavioural seed-data check.
 *
 * Connects through the migration client and asserts, by row content (NOT by
 * file text), that every static reference row Phase 2 needs is present:
 *
 *   - `legal_basis` PG enum has exactly { consent, contract, legitimate_interest }.
 *     Queried via `pg_enum` joined to `pg_type`.
 *   - `policy_versions` has the current `privacy_policy` and `terms_of_service`
 *     rows for version `2026-04-25.1`, both `is_current=true`.
 *   - `identification_limits` has rows for `trial` (5,75) and `paid` (15,200).
 *   - `provider_budgets` has 4 rows: (plant_id|openai_compat) × (identification|care_guide),
 *     each with `daily_cost_cap_cents=500`.
 *
 * For each check, the script prints `seeds: <name> rows=<actual> (expected <n>)`
 * before deciding pass/fail, so `pnpm db:check-seeds` output is reviewable
 * and the verifier `grep -E 'rows=[0-9]+ \(expected [0-9]+\)'` is satisfied.
 *
 * Exit codes:
 *  0 — readiness probe + every seed assertion passed.
 *  1 — any required row count or value is missing or differs from expected.
 *  2 — connection or unexpected SQL error.
 */

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

const EXPECTED_LEGAL_BASIS = ["consent", "contract", "legitimate_interest"] as const;

const EXPECTED_IDENTIFICATION_LIMITS = [
  { tier: "trial", daily_cap: 5, period_cap: 75 },
  { tier: "paid", daily_cap: 15, period_cap: 200 },
] as const;

const EXPECTED_PROVIDER_BUDGETS = [
  { provider: "plant_id", purpose: "identification" },
  { provider: "plant_id", purpose: "care_guide" },
  { provider: "openai_compat", purpose: "identification" },
  { provider: "openai_compat", purpose: "care_guide" },
] as const;

function fail(message: string): never {
  console.error(`[check-seeds] ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  const sql = getMigrationSql();
  let failed = false;

  try {
    // Readiness probe (matches the 02-01 placeholder pattern).
    const ping = await sql<{ one: number }[]>`select 1 as one`;
    if (ping[0]?.one !== 1) {
      console.error("[check-seeds] readiness probe failed: select 1 returned unexpected payload");
      process.exit(2);
    }

    // -------------------------------------------------------------------------
    // legal_basis enum (D-48): query pg_enum joined to pg_type.
    // -------------------------------------------------------------------------
    const enumRows = await sql<{ label: string }[]>`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'legal_basis'
      ORDER BY e.enumlabel ASC
    `;
    const enumLabels = enumRows.map((row) => row.label);
    console.log(
      `seeds: legal_basis enum rows=${enumLabels.length} (expected ${EXPECTED_LEGAL_BASIS.length})`,
    );
    const expectedSorted = [...EXPECTED_LEGAL_BASIS].sort();
    const enumMismatch =
      enumLabels.length !== expectedSorted.length ||
      enumLabels.some((value, index) => value !== expectedSorted[index]);
    if (enumMismatch) {
      console.error(
        `[check-seeds] legal_basis enum mismatch — got [${enumLabels.join(", ")}], ` +
          `expected [${expectedSorted.join(", ")}]`,
      );
      failed = true;
    }

    // -------------------------------------------------------------------------
    // policy_versions: 2 current rows for `2026-04-25.1`.
    // -------------------------------------------------------------------------
    const policyRows = await sql<
      { document_type: string; version: string; is_current: boolean }[]
    >`
      SELECT document_type, version, is_current
      FROM public.policy_versions
      WHERE version = '2026-04-25.1' AND is_current = true
      ORDER BY document_type ASC
    `;
    console.log(`seeds: policy_versions rows=${policyRows.length} (expected 2)`);
    if (policyRows.length !== 2) {
      console.error(
        `[check-seeds] expected 2 current policy_versions rows for 2026-04-25.1, ` +
          `found ${policyRows.length}`,
      );
      failed = true;
    } else {
      const expectedTypes = ["privacy_policy", "terms_of_service"] as const;
      for (let i = 0; i < expectedTypes.length; i += 1) {
        const row = policyRows[i];
        if (!row || row.document_type !== expectedTypes[i]) {
          console.error(
            `[check-seeds] policy_versions[${i}] expected ${expectedTypes[i]}, ` +
              `got ${row?.document_type ?? "<missing>"}`,
          );
          failed = true;
        }
      }
    }

    // -------------------------------------------------------------------------
    // identification_limits: trial(5,75), paid(15,200).
    // -------------------------------------------------------------------------
    const limitRows = await sql<{ tier: string; daily_cap: number; period_cap: number }[]>`
      SELECT tier, daily_cap, period_cap FROM public.identification_limits ORDER BY tier ASC
    `;
    console.log(`seeds: identification_limits rows=${limitRows.length} (expected 2)`);
    if (limitRows.length !== 2) {
      console.error(
        `[check-seeds] expected 2 identification_limits rows, found ${limitRows.length}`,
      );
      failed = true;
    } else {
      const byTier = new Map(limitRows.map((row) => [row.tier, row]));
      for (const expected of EXPECTED_IDENTIFICATION_LIMITS) {
        const row = byTier.get(expected.tier);
        if (
          !row ||
          Number(row.daily_cap) !== expected.daily_cap ||
          Number(row.period_cap) !== expected.period_cap
        ) {
          console.error(
            `[check-seeds] identification_limits.${expected.tier} expected ` +
              `daily_cap=${expected.daily_cap}, period_cap=${expected.period_cap}; ` +
              `got daily_cap=${row?.daily_cap ?? "<missing>"}, ` +
              `period_cap=${row?.period_cap ?? "<missing>"}`,
          );
          failed = true;
        }
      }
    }

    // -------------------------------------------------------------------------
    // provider_budgets: 4 rows, each with daily_cost_cap_cents=500.
    // -------------------------------------------------------------------------
    const budgetRows = await sql<
      { provider: string; purpose: string; daily_cost_cap_cents: number }[]
    >`
      SELECT provider, purpose, daily_cost_cap_cents
      FROM public.provider_budgets
      WHERE daily_cost_cap_cents = 500
      ORDER BY provider ASC, purpose ASC
    `;
    console.log(`seeds: provider_budgets rows=${budgetRows.length} (expected 4)`);
    if (budgetRows.length !== 4) {
      console.error(
        `[check-seeds] expected 4 provider_budgets rows with daily_cost_cap_cents=500, ` +
          `found ${budgetRows.length}`,
      );
      failed = true;
    } else {
      const tuples = new Set(budgetRows.map((row) => `${row.provider}:${row.purpose}`));
      for (const expected of EXPECTED_PROVIDER_BUDGETS) {
        const key = `${expected.provider}:${expected.purpose}`;
        if (!tuples.has(key)) {
          console.error(`[check-seeds] provider_budgets missing tuple ${key}`);
          failed = true;
        }
      }
    }
  } catch (err) {
    console.error("[check-seeds] unexpected error:", err);
    process.exit(2);
  } finally {
    await closeMigrationSql(sql);
  }

  if (failed) {
    fail("one or more seed assertions failed; re-run `pnpm db:seed` and inspect the seed SQL.");
  }
  console.log("[check-seeds] OK — all seed assertions passed.");
}

void main();
