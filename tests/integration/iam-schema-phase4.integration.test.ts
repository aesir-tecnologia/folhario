// Phase 4 plan 02 — integration test asserting Phase 4 schema additions
// landed on live local Postgres after `pnpm db:migrate`.
//
// Mirrors the live-Postgres baseline at
// tests/integration/postgres-connection.integration.test.ts (Phase 1
// pattern); reused throughout Phase 4 per CONTEXT D-28 (real local
// Supabase Auth in integration tests).
//
// Key smoking-gun: `relrowsecurity = true` on all three new tables —
// this is the Codex HIGH #1 assertion that proves drizzle-kit migrate
// (NOT push) executed the hand-appended RLS SQL.

import { describe, it, expect, afterAll } from "vitest";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("Phase 4 schema additions on live Postgres", () => {
  const sql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });

  afterAll(async () => {
    await sql.end({ timeout: 5 });
  });

  it("email_verification_tokens table exists with expected columns", async () => {
    const cols = await sql<{ column_name: string; data_type: string; is_nullable: string }[]>`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'email_verification_tokens'
      ORDER BY ordinal_position;
    `;
    const colNames = cols.map((c) => c.column_name);
    expect(colNames).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "consumed_at",
        "created_at",
        "sent_to_email",
      ]),
    );
  });

  it("password_reset_tokens table exists with expected columns", async () => {
    const cols = await sql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
      ORDER BY ordinal_position;
    `;
    expect(cols.map((c) => c.column_name)).toEqual(
      expect.arrayContaining([
        "id",
        "user_id",
        "token_hash",
        "expires_at",
        "consumed_at",
        "created_at",
        "sent_to_email",
      ]),
    );
  });

  it("auth_throttle table exists with composite PK on (ip, endpoint, window_start)", async () => {
    const pkCols = await sql<{ attname: string }[]>`
      SELECT a.attname
      FROM pg_index i
      JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = 'public.auth_throttle'::regclass AND i.indisprimary
      ORDER BY array_position(i.indkey::int[], a.attnum::int);
    `;
    expect(pkCols.map((c) => c.attname).sort()).toEqual(
      ["endpoint", "ip", "window_start"].sort(),
    );
  });

  it("auth_throttle.locked_until column exists and is nullable (D-14 5-min lockout per Codex HIGH #5)", async () => {
    const [row] = await sql<{ data_type: string; is_nullable: string }[]>`
      SELECT data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'auth_throttle' AND column_name = 'locked_until';
    `;
    expect(row).toBeDefined();
    expect(row!.is_nullable).toBe("YES");
    expect(row!.data_type).toMatch(/timestamp with time zone/i);
  });

  it("public.users.email_verified_at exists and is nullable", async () => {
    const [row] = await sql<{ data_type: string; is_nullable: string }[]>`
      SELECT data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'email_verified_at';
    `;
    expect(row).toBeDefined();
    expect(row!.is_nullable).toBe("YES");
    expect(row!.data_type).toMatch(/timestamp with time zone/i);
  });

  it("RLS is enabled on all three new tables (Codex HIGH #1 smoking gun — proves migrate ran the appended RLS SQL)", async () => {
    const rows = await sql<{ relname: string; relrowsecurity: boolean }[]>`
      SELECT relname, relrowsecurity
      FROM pg_class
      WHERE relname IN ('email_verification_tokens', 'password_reset_tokens', 'auth_throttle')
        AND relnamespace = 'public'::regnamespace;
    `;
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.relrowsecurity).toBe(true);
    }
  });

  it("service_role policy allows INSERT and SELECT on token tables", async () => {
    // Service role bypasses RLS via its policy. The local Supabase superuser
    // connection (postgres) has BYPASSRLS too, but we explicitly SET ROLE
    // service_role to exercise the policy path. The whole flow runs inside
    // a single rolled-back transaction so no fixture rows leak.
    await sql
      .begin(async (tx) => {
        await tx`SET LOCAL ROLE service_role`;
        // Real user row first to satisfy the FK on token tables.
        const [user] = await tx<{ id: string }[]>`
          INSERT INTO users (email, name, timezone, trial_source)
          VALUES (
            ${"phase4-rls-" + Math.random().toString(36).slice(2) + "@test.local"},
            'Phase 4 RLS Test',
            'America/Sao_Paulo',
            'organic'
          )
          RETURNING id;
        `;
        const userId = user!.id;
        const [inserted] = await tx<{ id: string }[]>`
          INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, sent_to_email)
          VALUES (
            ${userId},
            encode(sha256(gen_random_uuid()::text::bytea), 'hex'),
            now() + interval '24 hours',
            'test@example.com'
          )
          RETURNING id;
        `;
        expect(inserted!.id).toBeTruthy();
        const found = await tx<{ id: string }[]>`
          SELECT id FROM email_verification_tokens WHERE id = ${inserted!.id};
        `;
        expect(found).toHaveLength(1);
        // Roll back so this test leaves no fixture rows behind.
        throw new Error("__ROLLBACK__");
      })
      .catch((err) => {
        if (err instanceof Error && err.message === "__ROLLBACK__") return;
        throw err;
      });
  });
});
