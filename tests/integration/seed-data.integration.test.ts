import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Phase-2 Plan 04 Task 3: behavioural seed-data integration test.
 *
 * Asserts the Phase 2 reference rows by querying the migrated Postgres directly
 * (NOT by parsing `drizzle/seeds/phase-02.sql` text):
 *
 *   - `legal_basis` PG enum has exactly { consent, contract, legitimate_interest }.
 *   - `policy_versions` has exactly one current `privacy_policy` row v2026-04-25.1
 *     and one current `terms_of_service` row v2026-04-25.1.
 *   - `identification_limits` has exactly two rows: trial(5,75), paid(15,200).
 *   - `provider_budgets` has exactly four rows with daily_cost_cap_cents=500
 *     covering (plant_id|openai_compat) × (identification|care_guide).
 *
 * Cloud-Supabase guard inherited from the existing project pattern.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("Phase-02-04 seed data integration", () => {
  const sql = postgres(dbUrl!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("legal_basis pg_enum has exactly [consent, contract, legitimate_interest]", async () => {
    const rows = await sql<{ label: string }[]>`
      SELECT e.enumlabel AS label
      FROM pg_enum e
      JOIN pg_type t ON e.enumtypid = t.oid
      WHERE t.typname = 'legal_basis'
      ORDER BY e.enumlabel ASC
    `;
    const labels = rows.map((row) => row.label);
    expect(labels).toEqual(["consent", "contract", "legitimate_interest"]);
  });

  it("policy_versions has exactly one current privacy_policy row at version 2026-04-25.1", async () => {
    const rows = await sql<
      { document_type: string; version: string; is_current: boolean }[]
    >`
      SELECT document_type, version, is_current
      FROM public.policy_versions
      WHERE document_type = 'privacy_policy'
        AND is_current = true
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      document_type: "privacy_policy",
      version: "2026-04-25.1",
      is_current: true,
    });
  });

  it("policy_versions has exactly one current terms_of_service row at version 2026-04-25.1", async () => {
    const rows = await sql<
      { document_type: string; version: string; is_current: boolean }[]
    >`
      SELECT document_type, version, is_current
      FROM public.policy_versions
      WHERE document_type = 'terms_of_service'
        AND is_current = true
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({
      document_type: "terms_of_service",
      version: "2026-04-25.1",
      is_current: true,
    });
  });

  it("identification_limits has exactly the trial and paid tier rows with the locked caps", async () => {
    const rows = await sql<{ tier: string; daily_cap: number; period_cap: number }[]>`
      SELECT tier, daily_cap, period_cap FROM public.identification_limits ORDER BY tier ASC
    `;
    expect(rows).toHaveLength(2);

    // postgres-js returns numeric / integer columns as strings or numbers depending
    // on the driver path; coerce explicitly so toEqual on numeric tuples is stable.
    const normalised = rows.map((row) => ({
      tier: row.tier,
      daily_cap: Number(row.daily_cap),
      period_cap: Number(row.period_cap),
    }));

    // alphabetical: paid < trial
    expect(normalised[0]).toEqual({ tier: "paid", daily_cap: 15, period_cap: 200 });
    expect(normalised[1]).toEqual({ tier: "trial", daily_cap: 5, period_cap: 75 });
  });

  it("provider_budgets has exactly four rows with daily_cost_cap_cents=500 covering all (provider, purpose) tuples", async () => {
    const rows = await sql<
      { provider: string; purpose: string; daily_cost_cap_cents: number }[]
    >`
      SELECT provider, purpose, daily_cost_cap_cents
      FROM public.provider_budgets
      WHERE daily_cost_cap_cents = 500
      ORDER BY provider ASC, purpose ASC
    `;
    expect(rows).toHaveLength(4);

    const tuples = new Set(rows.map((row) => `${row.provider}:${row.purpose}`));
    expect(tuples.has("plant_id:identification")).toBe(true);
    expect(tuples.has("plant_id:care_guide")).toBe(true);
    expect(tuples.has("openai_compat:identification")).toBe(true);
    expect(tuples.has("openai_compat:care_guide")).toBe(true);

    for (const row of rows) {
      expect(Number(row.daily_cost_cap_cents)).toBe(500);
    }
  });
});
