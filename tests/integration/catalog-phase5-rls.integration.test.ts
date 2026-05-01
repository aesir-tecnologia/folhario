import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Phase-05 Plan 02: owner-only RLS proof for pending_storage_deletions and
 * location_suggestions tables introduced in Phase 5.
 *
 * Pattern reused verbatim from tests/integration/rls-real-jwt.integration.test.ts:
 *   await tx.unsafe(`SET LOCAL ROLE authenticated`);
 *   await tx`SELECT set_config('request.jwt.claim.sub', '${userId}', true)`;
 *
 * Test structure mirrors the existing RLS proof: two real Supabase users,
 * service-role inserts, authenticated-role cross-user SELECT/INSERT denial.
 */

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";

const dbUrl = process.env.DATABASE_POOL_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
if (supabaseUrl && /supabase\.co/.test(supabaseUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in NEXT_PUBLIC_SUPABASE_URL).",
  );
}

describe.skipIf(!dbUrl)("Phase-05 Plan 02 — RLS owner-only proof", () => {
  let userAId: string;
  let userBId: string;
  let userAEmail: string;
  let userBEmail: string;
  let userAJwtSub: string;
  let userBJwtSub: string;

  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const adminSql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });

  function jwtSub(jwt: string): string {
    const parts = jwt.split(".");
    if (parts.length !== 3) {
      throw new Error("Malformed JWT (expected 3 dot-separated parts).");
    }
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
      sub?: string;
    };
    if (!payload.sub) {
      throw new Error("JWT payload missing `sub` claim.");
    }
    return payload.sub;
  }

  beforeAll(async () => {
    if (!serviceRoleKey) {
      throw new Error(
        "SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env' after 'pnpm db:start'.",
      );
    }
    if (!anonKey) {
      throw new Error(
        "NEXT_PUBLIC_SUPABASE_ANON_KEY missing. Run 'pnpm db:sync-env' after 'pnpm db:start'.",
      );
    }

    const runId = randomUUID().slice(0, 8);
    userAEmail = `phase5-rls-userA-${runId}@test.local`;
    userBEmail = `phase5-rls-userB-${runId}@test.local`;
    const password = `pw-${randomUUID()}`;

    const { data: createdA, error: createAErr } = await adminClient.auth.admin.createUser({
      email: userAEmail,
      password,
      email_confirm: true,
    });
    if (createAErr || !createdA?.user) {
      throw new Error(
        `Supabase Auth admin API not reachable. Error: ${createAErr?.message ?? "no user returned"}`,
      );
    }
    userAId = createdA.user.id;

    const { data: createdB, error: createBErr } = await adminClient.auth.admin.createUser({
      email: userBEmail,
      password,
      email_confirm: true,
    });
    if (createBErr || !createdB?.user) {
      throw new Error(
        `Supabase Auth admin API not reachable. Error: ${createBErr?.message ?? "no user returned"}`,
      );
    }
    userBId = createdB.user.id;

    const userARows = await adminSql<{ id: string }[]>`
      SELECT id FROM public.users WHERE id = ${userAId}
    `;
    const userBRows = await adminSql<{ id: string }[]>`
      SELECT id FROM public.users WHERE id = ${userBId}
    `;
    if (userARows.length === 0 || userBRows.length === 0) {
      throw new Error(
        "auth.users -> public.users sync trigger did not fire. Apply migrations: pnpm db:migrate.",
      );
    }

    const signInA = await adminClient.auth.signInWithPassword({ email: userAEmail, password });
    if (signInA.error || !signInA.data.session?.access_token) {
      throw new Error(
        `signInWithPassword failed for user A: ${signInA.error?.message ?? "no session"}`,
      );
    }
    userAJwtSub = jwtSub(signInA.data.session.access_token);

    const signInB = await adminClient.auth.signInWithPassword({ email: userBEmail, password });
    if (signInB.error || !signInB.data.session?.access_token) {
      throw new Error(
        `signInWithPassword failed for user B: ${signInB.error?.message ?? "no session"}`,
      );
    }
    userBJwtSub = jwtSub(signInB.data.session.access_token);
  }, 30_000);

  afterAll(async () => {
    try {
      if (userAId) {
        await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
        await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userAId}`;
      }
      if (userBId) {
        await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userBId}`;
        await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userBId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userBId}`;
      }
      if (userAId) await adminClient.auth.admin.deleteUser(userAId);
      if (userBId) await adminClient.auth.admin.deleteUser(userBId);
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  describe("pending_storage_deletions RLS", () => {
    it("user A authenticated cannot SELECT user B's row", async () => {
      // 1. Service-role INSERT a row owned by user A
      await adminSql`
        INSERT INTO public.pending_storage_deletions (id, user_id, bucket, prefix, status)
        VALUES (
          ${randomUUID()},
          ${userAId},
          'plant-photos',
          ${`${userAId}/test-plant/`},
          'pending'
        )
      `;

      const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        // 2. User B cannot see user A's rows
        const rowsAsB = await driver.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`);
          await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
          return tx<{ id: string }[]>`SELECT id FROM public.pending_storage_deletions`;
        });
        expect(rowsAsB).toHaveLength(0);

        // 3. Positive control: user A can see their own rows
        const rowsAsA = await driver.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`);
          await tx`SELECT set_config('request.jwt.claim.sub', ${userAJwtSub}, true)`;
          return tx<{ id: string }[]>`SELECT id FROM public.pending_storage_deletions`;
        });
        expect(rowsAsA.length).toBeGreaterThanOrEqual(1);
      } finally {
        await driver.end({ timeout: 5 });
      }
    }, 30_000);

    it("user A authenticated cannot INSERT a row claiming user B's user_id", async () => {
      const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        await expect(
          driver.begin(async (tx) => {
            await tx.unsafe(`SET LOCAL ROLE authenticated`);
            await tx`SELECT set_config('request.jwt.claim.sub', ${userAJwtSub}, true)`;
            await tx`
              INSERT INTO public.pending_storage_deletions (id, user_id, bucket, prefix, status)
              VALUES (
                ${randomUUID()},
                ${userBId},
                'plant-photos',
                ${`${userBId}/cross-user-attempt/`},
                'pending'
              )
            `;
          }),
        ).rejects.toThrow();
      } finally {
        await driver.end({ timeout: 5 });
      }
    }, 30_000);
  });

  describe("location_suggestions RLS", () => {
    it("user A authenticated cannot SELECT user B's suggestions", async () => {
      // 1. Service-role INSERT a suggestion owned by user A
      await adminSql`
        INSERT INTO public.location_suggestions (user_id, label_normalized, label_display)
        VALUES (${userAId}, 'sala', 'Sala')
        ON CONFLICT (user_id, label_normalized) DO NOTHING
      `;

      const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        // 2. User B cannot see user A's suggestions
        const rowsAsB = await driver.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`);
          await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
          return tx<
            { label_display: string }[]
          >`SELECT label_display FROM public.location_suggestions`;
        });
        expect(rowsAsB).toHaveLength(0);

        // 3. Positive control: user A can see their own suggestions
        const rowsAsA = await driver.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`);
          await tx`SELECT set_config('request.jwt.claim.sub', ${userAJwtSub}, true)`;
          return tx<
            { label_display: string }[]
          >`SELECT label_display FROM public.location_suggestions`;
        });
        expect(rowsAsA.length).toBeGreaterThanOrEqual(1);
      } finally {
        await driver.end({ timeout: 5 });
      }
    }, 30_000);

    it("user A authenticated cannot INSERT claiming user B's user_id", async () => {
      const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        await expect(
          driver.begin(async (tx) => {
            await tx.unsafe(`SET LOCAL ROLE authenticated`);
            await tx`SELECT set_config('request.jwt.claim.sub', ${userAJwtSub}, true)`;
            await tx`
              INSERT INTO public.location_suggestions (user_id, label_normalized, label_display)
              VALUES (${userBId}, 'varanda', 'Varanda')
            `;
          }),
        ).rejects.toThrow();
      } finally {
        await driver.end({ timeout: 5 });
      }
    }, 30_000);
  });

  describe("Cross-test sanity", () => {
    it("the new tables exist and are non-zero in pg_tables", async () => {
      const rows = await adminSql<{ count: string }[]>`
        SELECT count(*)::text AS count
        FROM pg_tables
        WHERE tablename IN ('pending_storage_deletions', 'location_suggestions')
      `;
      expect(rows[0]?.count).toBe("2");
    });

    it("the pending_deletion_status enum is registered", async () => {
      const rows = await adminSql<{ regtype: string }[]>`
        SELECT 'pending_deletion_status'::regtype::text AS regtype
      `;
      expect(rows[0]?.regtype).toBe("pending_deletion_status");
    });
  });
});
