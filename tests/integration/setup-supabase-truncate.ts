// Phase 4 D-28: real local Supabase Auth in integration tests.
//
// auth.users (Supabase logical schema) is not covered by the Drizzle
// transaction-rollback pattern (Phase 2 D-43), so auth-bearing integration
// tests TRUNCATE the touched tables in `beforeEach` to keep state isolated.
// The helper is OPT-IN — each test imports it explicitly and decides when
// to run it. This avoids a global setupFile that would slow down tests
// that don't touch auth tables.

import postgres from "postgres";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to use truncate helper against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

export async function truncateAuthAndIamTables(): Promise<void> {
  if (!dbUrl) return;
  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    // Plan 06 deviation (Rule 3): TRUNCATE ... CASCADE on auth.users fails as
    // role 'postgres' because the cascade tries to RESTART IDENTITY on the
    // auth-schema-owned `refresh_tokens_id_seq`. Use TRUNCATE only for the
    // public-owned children, then DELETE FROM auth.users (no IDENTITY restart
    // needed; CASCADE FKs do their job).
    await sql`TRUNCATE TABLE
      public.email_verification_tokens,
      public.password_reset_tokens,
      public.auth_throttle
      RESTART IDENTITY`;
    await sql`DELETE FROM public.consent_logs`;
    await sql`DELETE FROM public.subscriptions`;
    await sql`DELETE FROM public.users`;
    await sql`DELETE FROM auth.users`;
    // policy_versions is NOT wiped here — concurrent test files would race
    // on the seed. The seedCurrentPolicyVersions fixture uses upsert semantics
    // so re-seeding the same '1.0' row is idempotent. Other tests that need a
    // truly empty policy_versions (e.g. the atomic-tx test) set
    // is_current = false explicitly inside the test body.
  } finally {
    await sql.end({ timeout: 5 });
  }
}
