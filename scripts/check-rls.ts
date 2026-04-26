#!/usr/bin/env tsx
/**
 * Phase-2 Plan 03 Task 3: production runtime guard + behavioural RLS check.
 *
 * Two responsibilities:
 *   1. Production guard (T-02-29): if NODE_ENV=production AND the real
 *      Supabase `auth` schema is absent, abort. The CI-only auth.uid()
 *      shim from migration 0001_phase_02_rls_policies.sql must NEVER
 *      load in a production environment, because it would silently
 *      replace Supabase's real auth.uid() and either deny all reads or
 *      worse, allow them depending on the helper's return shape.
 *   2. RLS coverage: every required public table has rowsecurity = true
 *      (queried directly from `pg_class.relrowsecurity`), and every
 *      app table is present.
 *
 * Exit codes:
 *  0  — production guard passes (or NODE_ENV != production), readiness
 *       probe succeeds, every required table is present AND has RLS.
 *  1  — schema not ready: required tables are absent, OR a table is
 *       present but RLS is disabled, OR production guard fails.
 *  2  — connection or unexpected SQL error.
 */

import { closeMigrationSql, getMigrationSql } from "../src/shared/db/migration-client";

// All app tables that must exist with RLS enabled. Covers the 19 PRD §4
// entities plus the 2 IAM-support tables (offline_sync_failures,
// idempotency_keys). Keep alphabetical for diff stability.
const REQUIRED_TABLES: readonly string[] = [
  "billing_events",
  "care_guides",
  "consent_logs",
  "data_deletion_requests",
  "data_export_requests",
  "idempotency_keys",
  "identification_limits",
  "identifications",
  "offline_sync_failures",
  "partner_stores",
  "photo_entries",
  "plants",
  "policy_versions",
  "provider_budgets",
  "provider_usage_counters",
  "push_subscriptions",
  "reminder_logs",
  "reminders",
  "species",
  "subscriptions",
  "users",
];

async function main(): Promise<void> {
  const sql = getMigrationSql();

  try {
    // Section 1: production guard. The CI shim in 0001_phase_02_rls_policies.sql
    // creates a minimal `auth.uid()` only when `auth` schema is absent. In
    // production, Supabase always provides the real `auth` schema with the
    // PostgREST-rooted `auth.uid()`. If we ever land in production WITHOUT
    // the real `auth` schema, the shim would either deny everything or
    // silently allow it depending on its return shape. Fail loudly here.
    const isProd = process.env.NODE_ENV === "production";
    const authSchemaRows = await sql<{ count: string }[]>`
      SELECT count(*)::text AS count FROM pg_namespace WHERE nspname = 'auth'
    `;
    const hasAuthSchema = Number(authSchemaRows[0]?.count ?? "0") > 0;

    if (isProd && !hasAuthSchema) {
      console.error(
        "[check-rls] NODE_ENV=production but Supabase auth schema is absent. " +
          "The CI-only auth.uid() shim must NEVER load in production. Aborting.",
      );
      process.exit(1);
    }

    // Section 2: readiness probe.
    const ping = await sql<{ one: number }[]>`select 1 as one`;
    if (ping[0]?.one !== 1) {
      console.error("[check-rls] readiness probe failed: select 1 returned unexpected payload");
      process.exit(2);
    }

    // Section 3: table presence + RLS check.
    type RlsRow = { tablename: string; rowsecurity: boolean };
    const rows = await sql<RlsRow[]>`
      SELECT c.relname AS tablename, c.relrowsecurity AS rowsecurity
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND c.relname = ANY(${sql.array(Array.from(REQUIRED_TABLES))})
    `;

    const present = new Map<string, boolean>();
    for (const row of rows) present.set(row.tablename, row.rowsecurity);

    const missing: string[] = [];
    const noRls: string[] = [];
    for (const table of REQUIRED_TABLES) {
      if (!present.has(table)) {
        missing.push(table);
      } else if (!present.get(table)) {
        noRls.push(table);
      }
    }

    if (missing.length > 0) {
      console.error(
        `[check-rls] schema not ready — missing tables: ${missing.join(", ")}. ` +
          "Run `pnpm db:migrate` first.",
      );
      process.exit(1);
    }

    if (noRls.length > 0) {
      console.error(
        `[check-rls] RLS NOT enabled on: ${noRls.join(", ")}. ` +
          "Re-apply 0001_phase_02_rls_policies.sql.",
      );
      process.exit(1);
    }

    console.log(
      `[check-rls] OK — ${REQUIRED_TABLES.length} app tables present with RLS enabled.`,
    );
  } catch (err) {
    console.error("[check-rls] unexpected error:", err);
    process.exit(2);
  } finally {
    await closeMigrationSql(sql);
  }
}

void main();
