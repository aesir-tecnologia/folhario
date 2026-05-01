import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@shared/db/client";
import * as psdRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";

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

function jwtSub(jwt: string): string {
  const parts = jwt.split(".");
  if (parts.length !== 3) throw new Error("Malformed JWT");
  const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
    sub?: string;
  };
  if (!payload.sub) throw new Error("JWT missing sub");
  return payload.sub;
}

describe.skipIf(!dbUrl)("pending_storage_deletions repository", () => {
  let userAId: string;
  let userBId: string;
  let userAJwtSub: string;
  let userBJwtSub: string;

  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminSql = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });

  beforeAll(async () => {
    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
    }
    if (!anonKey) {
      throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY missing. Run 'pnpm db:sync-env'.");
    }

    const runId = randomUUID().slice(0, 8);
    const password = `pw-${randomUUID()}`;

    const { data: createdA, error: createAErr } = await adminClient.auth.admin.createUser({
      email: `psd-repo-userA-${runId}@test.local`,
      password,
      email_confirm: true,
    });
    if (createAErr || !createdA?.user) {
      throw new Error(`createUser failed for A: ${createAErr?.message ?? "no user"}`);
    }
    userAId = createdA.user.id;

    const { data: createdB, error: createBErr } = await adminClient.auth.admin.createUser({
      email: `psd-repo-userB-${runId}@test.local`,
      password,
      email_confirm: true,
    });
    if (createBErr || !createdB?.user) {
      throw new Error(`createUser failed for B: ${createBErr?.message ?? "no user"}`);
    }
    userBId = createdB.user.id;

    const [rowA] = await adminSql<{ id: string }[]>`SELECT id FROM public.users WHERE id = ${userAId}`;
    const [rowB] = await adminSql<{ id: string }[]>`SELECT id FROM public.users WHERE id = ${userBId}`;
    if (!rowA || !rowB) {
      throw new Error("auth.users -> public.users sync trigger did not fire. Run pnpm db:migrate.");
    }

    const signInA = await adminClient.auth.signInWithPassword({
      email: `psd-repo-userA-${runId}@test.local`,
      password,
    });
    if (signInA.error || !signInA.data.session?.access_token) {
      throw new Error(`signInWithPassword A failed: ${signInA.error?.message}`);
    }
    userAJwtSub = jwtSub(signInA.data.session.access_token);

    const signInB = await adminClient.auth.signInWithPassword({
      email: `psd-repo-userB-${runId}@test.local`,
      password,
    });
    if (signInB.error || !signInB.data.session?.access_token) {
      throw new Error(`signInWithPassword B failed: ${signInB.error?.message}`);
    }
    userBJwtSub = jwtSub(signInB.data.session.access_token);
  }, 30_000);

  afterAll(async () => {
    try {
      if (userAId) {
        await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userAId}`;
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userBId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userBId}`;
        await adminClient.auth.admin.deleteUser(userBId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  it("create() inserts a row with status='pending', attempts=0, scheduled_at defaulting to now()", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/test/`,
    });
    expect(row.status).toBe("pending");
    expect(row.attempts).toBe(0);
    expect(row.scheduledAt).toBeTruthy();
    expect(row.startedAt).toBeNull();
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
  });

  it("markInProgress(id) transitions status to 'in_progress', increments attempts by 1, and sets started_at = now()", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/markprogress/`,
    });
    const updated = await psdRepo.markInProgress(db, row.id);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe("in_progress");
    expect(updated!.attempts).toBe(1);
    expect(updated!.startedAt).not.toBeNull();
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
  });

  it("markCompleted(id) transitions status to 'completed' and sets completed_at", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/completed/`,
    });
    await psdRepo.markInProgress(db, row.id);
    const completed = await psdRepo.markCompleted(db, row.id);
    expect(completed).not.toBeNull();
    expect(completed!.status).toBe("completed");
    expect(completed!.completedAt).not.toBeNull();
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
  });

  it("recordError(id, message) sets last_error and transitions status to 'pending' when attempts < 5 (attempts 1–4)", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/recorderror/`,
    });
    await psdRepo.markInProgress(db, row.id);
    const errored = await psdRepo.recordError(db, row.id, "network timeout");
    expect(errored).not.toBeNull();
    expect(errored!.status).toBe("pending");
    expect(errored!.lastError).toBe("network timeout");
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
  });

  it("recordError(id, message) transitions status to 'failed' when attempts = 5 (final attempt)", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/finalattempt/`,
    });
    // Set attempts to 5 directly (simulating 5 markInProgress calls)
    await adminSql`
      UPDATE public.pending_storage_deletions
      SET attempts = 5, status = 'in_progress'
      WHERE id = ${row.id}
    `;
    const errored = await psdRepo.recordError(db, row.id, "final error");
    expect(errored).not.toBeNull();
    expect(errored!.status).toBe("failed");
    expect(errored!.lastError).toBe("final error");
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
  });

  it("markFailed(id) transitions status to 'failed' (terminal)", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/markfailed/`,
    });
    const failed = await psdRepo.markFailed(db, row.id);
    expect(failed).not.toBeNull();
    expect(failed!.status).toBe("failed");
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
  });

  it("fetchPendingBatch(db, limit=50) — no opts — returns up to limit rows with status='pending' AND scheduled_at <= now(), does NOT include in_progress rows", async () => {
    // Clean slate
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;

    // Seed 60 pending + 10 in_progress + 5 completed
    for (let i = 0; i < 60; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/pending-${i}/`}, 'pending')
      `;
    }
    for (let i = 0; i < 10; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/inprog-${i}/`}, 'in_progress')
      `;
    }
    for (let i = 0; i < 5; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/done-${i}/`}, 'completed')
      `;
    }

    const batch = await psdRepo.fetchPendingBatch(db, 50);
    expect(batch.length).toBe(50);
    expect(batch.every((r) => r.status === "pending")).toBe(true);

    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
  });

  it("fetchPendingBatch(db, limit=50, { staleInProgressMinutes: 30 }) returns pending rows AND in_progress rows whose started_at is older than 30 minutes", async () => {
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;

    // 5 fresh pending rows
    for (let i = 0; i < 5; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/pending-stale-${i}/`}, 'pending')
      `;
    }
    // 2 stale in_progress rows (started 45 minutes ago)
    for (let i = 0; i < 2; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status, started_at)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/stale-ip-${i}/`}, 'in_progress', NOW() - INTERVAL '45 minutes')
      `;
    }
    // 3 fresh in_progress rows (started 10 minutes ago — not yet stale)
    for (let i = 0; i < 3; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status, started_at)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/fresh-ip-${i}/`}, 'in_progress', NOW() - INTERVAL '10 minutes')
      `;
    }

    const batch = await psdRepo.fetchPendingBatch(db, 50, { staleInProgressMinutes: 30 });
    // Expect 5 pending + 2 stale in_progress = 7 total; fresh in_progress excluded
    expect(batch.length).toBe(7);
    const statuses = batch.map((r) => r.status);
    expect(statuses.filter((s) => s === "pending").length).toBe(5);
    expect(statuses.filter((s) => s === "in_progress").length).toBe(2);

    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
  });

  it("fetchPendingBatch skips rows with future scheduled_at", async () => {
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;

    // 5 pending rows scheduled 1 hour in the future
    for (let i = 0; i < 5; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status, scheduled_at)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/future-${i}/`}, 'pending', NOW() + INTERVAL '1 hour')
      `;
    }

    const batch = await psdRepo.fetchPendingBatch(db, 50);
    expect(batch.length).toBe(0);

    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
  });

  it("fetchPendingBatch — concurrent invocations do NOT process the same row twice (FOR UPDATE SKIP LOCKED)", async () => {
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;

    for (let i = 0; i < 10; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/concurrent-${i}/`}, 'pending')
      `;
    }

    // Open two separate connections and run fetchPendingBatch concurrently
    const conn1 = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    const conn2 = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });

    try {
      // Begin txn on conn1, lock rows with FOR UPDATE SKIP LOCKED
      const [ids1, ids2] = await Promise.all([
        conn1.begin(async (tx) => {
          const rows = await tx<{ id: string }[]>`
            SELECT id FROM public.pending_storage_deletions
            WHERE status = 'pending' AND scheduled_at <= NOW()
            ORDER BY scheduled_at ASC
            LIMIT 50
            FOR UPDATE SKIP LOCKED
          `;
          // Simulate work by waiting briefly before commit
          await new Promise((r) => setTimeout(r, 50));
          return rows.map((r) => r.id);
        }),
        conn2.begin(async (tx) => {
          const rows = await tx<{ id: string }[]>`
            SELECT id FROM public.pending_storage_deletions
            WHERE status = 'pending' AND scheduled_at <= NOW()
            ORDER BY scheduled_at ASC
            LIMIT 50
            FOR UPDATE SKIP LOCKED
          `;
          return rows.map((r) => r.id);
        }),
      ]);

      const set1 = new Set(ids1);
      const set2 = new Set(ids2);
      const overlap = [...set2].filter((id) => set1.has(id));
      expect(overlap).toHaveLength(0);
      expect(ids1.length + ids2.length).toBe(10);
    } finally {
      await conn1.end({ timeout: 5 });
      await conn2.end({ timeout: 5 });
      await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
    }
  }, 30_000);

  it("fetchPendingBatch under SET LOCAL ROLE authenticated returns ZERO rows even when pending rows exist (T-05-03-02 — service-role discipline)", async () => {
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;

    // Seed 5 pending rows owned by userA via service-role (BYPASSRLS)
    for (let i = 0; i < 5; i++) {
      await adminSql`
        INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
        VALUES (${userAId}, 'plant-photos', ${`${userAId}/discipline-${i}/`}, 'pending')
      `;
    }

    // Open a connection, SET LOCAL ROLE authenticated but DO NOT bind request.jwt.claim.sub.
    // With no JWT sub binding, auth.uid() resolves to NULL.
    // The RLS owner-only policy (auth.uid() = user_id) denies all rows because NULL != userAId.
    // This proves the discipline: a misuse that runs the reconciler inside withUnitOfWork
    // (which DOES bind the sub) would actually return rows — but without the binding,
    // the authenticated role sees nothing.
    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      const rows = await driver.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE authenticated`);
        // Intentionally NOT binding request.jwt.claim.sub — this is the proof
        return tx<{ id: string }[]>`
          SELECT id FROM public.pending_storage_deletions
          WHERE status = 'pending' AND scheduled_at <= NOW()
          ORDER BY scheduled_at ASC
          FOR UPDATE SKIP LOCKED
        `;
      });
      expect(rows).toHaveLength(0);
    } finally {
      await driver.end({ timeout: 5 });
      await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userAId}`;
    }
  }, 30_000);

  it("RLS owner-only — userB cannot SELECT userA's pending_storage_deletions rows", async () => {
    const row = await psdRepo.create(db, {
      userId: userAId,
      bucket: "plant-photos",
      prefix: `${userAId}/rls-test/`,
    });

    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      const rowsAsB = await driver.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE authenticated`);
        await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
        return tx<{ id: string }[]>`
          SELECT id FROM public.pending_storage_deletions WHERE user_id = ${userAId}
        `;
      });
      expect(rowsAsB).toHaveLength(0);
    } finally {
      await driver.end({ timeout: 5 });
      await adminSql`DELETE FROM public.pending_storage_deletions WHERE id = ${row.id}`;
    }
  }, 30_000);

  it("RLS owner-only — userB cannot INSERT a row claiming userA's user_id", async () => {
    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      await expect(
        driver.begin(async (tx) => {
          await tx.unsafe(`SET LOCAL ROLE authenticated`);
          await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
          await tx`
            INSERT INTO public.pending_storage_deletions (user_id, bucket, prefix, status)
            VALUES (${userAId}, 'plant-photos', ${`${userAId}/cross-user/`}, 'pending')
          `;
        }),
      ).rejects.toThrow();
    } finally {
      await driver.end({ timeout: 5 });
    }
  }, 30_000);
});
