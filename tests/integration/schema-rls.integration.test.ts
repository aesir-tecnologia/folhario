import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

/**
 * Phase-2 Plan 03 Task 3: schema + RLS integration test.
 *
 * Asserts the Phase 2 database contract over a real Postgres connection:
 * - All 21 app tables exist in `public` (19 PRD §4 entities + 2 IAM-support
 *   tables: offline_sync_failures, idempotency_keys).
 * - RLS is enabled on every app table (`pg_class.relrowsecurity = true`).
 * - User-owned tables carry an ownership policy (FOR ALL TO authenticated).
 * - Reference tables carry an authenticated SELECT policy.
 * - Ownership indexes exist on `user_id` columns where present.
 *
 * Cloud-Supabase guard (per existing project pattern) prevents accidental
 * runs against a hosted DB.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

// All 19 PRD §4 entity tables.
const PRD_TABLES = [
  // IAM (6)
  "users",
  "policy_versions",
  "consent_logs",
  "partner_stores",
  "data_export_requests",
  "data_deletion_requests",
  // Catalog (2)
  "plants",
  "photo_entries",
  // Species & Care (2)
  "species",
  "care_guides",
  // Identification (4)
  "identifications",
  "identification_limits",
  "provider_budgets",
  "provider_usage_counters",
  // Reminders (2)
  "reminders",
  "reminder_logs",
  // Billing (2)
  "subscriptions",
  "billing_events",
  // Notifications (1)
  "push_subscriptions",
] as const;

// IAM-support tables (not in the 19 PRD entities, but RLS still mandatory).
const SUPPORT_TABLES = ["offline_sync_failures", "idempotency_keys"] as const;

const ALL_APP_TABLES = [...PRD_TABLES, ...SUPPORT_TABLES] as const;

// Direct user_id ownership.
const DIRECT_OWNED_TABLES = [
  "users",
  "consent_logs",
  "data_export_requests",
  "data_deletion_requests",
  "offline_sync_failures",
  "idempotency_keys",
  "plants",
  "identifications",
  "subscriptions",
  "push_subscriptions",
] as const;

// Transitive ownership via parent FK.
const TRANSITIVE_OWNED_TABLES = [
  "photo_entries",
  "reminders",
  "reminder_logs",
  "billing_events",
] as const;

const OWNER_TABLES = [...DIRECT_OWNED_TABLES, ...TRANSITIVE_OWNED_TABLES] as const;

const REFERENCE_TABLES = [
  "species",
  "care_guides",
  "identification_limits",
  "provider_budgets",
  "policy_versions",
  "partner_stores",
] as const;

// user_id columns we expect indexes on.
const USER_ID_INDEX_TABLES = [
  "consent_logs",
  "data_export_requests",
  "data_deletion_requests",
  "offline_sync_failures",
  "idempotency_keys",
  "plants",
  "identifications",
  "subscriptions",
  "push_subscriptions",
] as const;

describe.skipIf(!dbUrl)("Phase-02-03 schema + RLS integration", () => {
  const sql = postgres(dbUrl!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("all 19 PRD entity tables exist in public schema", async () => {
    const rows = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ${sql([...PRD_TABLES])}
    `;
    const present = new Set(rows.map((r) => r.tablename));
    const missing = PRD_TABLES.filter((t) => !present.has(t));
    expect(missing, `Missing PRD tables: ${missing.join(", ")}`).toEqual([]);
  });

  it("all IAM-support tables exist (offline_sync_failures, idempotency_keys)", async () => {
    const rows = await sql<{ tablename: string }[]>`
      SELECT tablename FROM pg_tables
      WHERE schemaname = 'public' AND tablename IN ${sql([...SUPPORT_TABLES])}
    `;
    expect(rows.length).toBe(SUPPORT_TABLES.length);
  });

  it("RLS is enabled on every app table", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT c.relname, c.relrowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname IN ${sql([...ALL_APP_TABLES])}
    `;
    const noRls = rows.filter((r) => !r.relrowsecurity).map((r) => r.relname);
    expect(noRls, `RLS disabled on: ${noRls.join(", ")}`).toEqual([]);
    expect(rows.length).toBe(ALL_APP_TABLES.length);
  });

  it("user-owned tables carry an ownership policy", async () => {
    const rows = await sql<{ tablename: string; policyname: string }[]>`
      SELECT tablename, policyname
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ${sql([...OWNER_TABLES])}
        AND policyname LIKE '%_owner_all'
    `;
    const tablesWithOwnerPolicy = new Set(rows.map((r) => r.tablename));
    const missing = OWNER_TABLES.filter((t) => !tablesWithOwnerPolicy.has(t));
    expect(missing, `Owner policy missing on: ${missing.join(", ")}`).toEqual([]);
  });

  it("reference tables carry an authenticated SELECT policy", async () => {
    const rows = await sql<{ tablename: string; policyname: string; cmd: string }[]>`
      SELECT tablename, policyname, cmd
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename IN ${sql([...REFERENCE_TABLES])}
        AND policyname LIKE '%_select_authenticated'
    `;
    const tablesWithRefPolicy = new Set(rows.map((r) => r.tablename));
    const missing = REFERENCE_TABLES.filter((t) => !tablesWithRefPolicy.has(t));
    expect(missing, `Reference SELECT policy missing on: ${missing.join(", ")}`).toEqual([]);
    // SELECT policies show up as cmd='SELECT' in pg_policies
    for (const row of rows) {
      expect(row.cmd).toBe("SELECT");
    }
  });

  it("ownership indexes exist on user_id columns", async () => {
    const rows = await sql<{ tablename: string; indexname: string }[]>`
      SELECT tablename, indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ${sql([...USER_ID_INDEX_TABLES])}
    `;
    const tablesWithUserIdIdx = new Set<string>();
    for (const row of rows) {
      if (row.indexname.includes("user_id")) tablesWithUserIdIdx.add(row.tablename);
    }
    const missing = USER_ID_INDEX_TABLES.filter((t) => !tablesWithUserIdIdx.has(t));
    expect(missing, `user_id index missing on: ${missing.join(", ")}`).toEqual([]);
  });

  it("the auth.uid() helper exists (real Supabase or CI shim)", async () => {
    const rows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'auth' AND p.proname = 'uid'
    `;
    expect(Number(rows[0]?.count ?? "0")).toBeGreaterThan(0);
  });
});
