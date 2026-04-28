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
    await sql`TRUNCATE TABLE
      public.email_verification_tokens,
      public.password_reset_tokens,
      public.auth_throttle,
      public.consent_logs,
      public.subscriptions,
      public.users,
      auth.users
      RESTART IDENTITY CASCADE`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
