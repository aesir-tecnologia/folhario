import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { db } from "@shared/db/client";
import * as locRepo from "@contexts/catalog/infrastructure/db/location-suggestions";

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

describe.skipIf(!dbUrl)("location_suggestions repository", () => {
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
      email: `loc-repo-userA-${runId}@test.local`,
      password,
      email_confirm: true,
    });
    if (createAErr || !createdA?.user) {
      throw new Error(`createUser failed for A: ${createAErr?.message ?? "no user"}`);
    }
    userAId = createdA.user.id;

    const { data: createdB, error: createBErr } = await adminClient.auth.admin.createUser({
      email: `loc-repo-userB-${runId}@test.local`,
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
      email: `loc-repo-userA-${runId}@test.local`,
      password,
    });
    if (signInA.error || !signInA.data.session?.access_token) {
      throw new Error(`signInWithPassword A failed: ${signInA.error?.message}`);
    }
    userAJwtSub = jwtSub(signInA.data.session.access_token);

    const signInB = await adminClient.auth.signInWithPassword({
      email: `loc-repo-userB-${runId}@test.local`,
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
        await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userAId}`;
        await adminClient.auth.admin.deleteUser(userAId);
      }
      if (userBId) {
        await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userBId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userBId}`;
        await adminClient.auth.admin.deleteUser(userBId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  it("upsert() inserts a new row on first call with usage_count=1 and last_used_at=now()", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;

    const row = await locRepo.upsert(db, { userId: userAId, label: "Sala" });
    expect(row).not.toBeNull();
    expect(row!.usageCount).toBe(1);
    expect(row!.labelDisplay).toBe("Sala");
    expect(row!.labelNormalized).toBe("sala");
    expect(row!.lastUsedAt).toBeTruthy();

    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
  });

  it("upsert() ON CONFLICT increments usage_count by 1 and touches last_used_at", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;

    const row1 = await locRepo.upsert(db, { userId: userAId, label: "Sala" });
    await new Promise((r) => setTimeout(r, 10));
    const row2 = await locRepo.upsert(db, { userId: userAId, label: "Sala" });

    expect(row2).not.toBeNull();
    expect(row2!.usageCount).toBe(2);
    expect(row2!.lastUsedAt >= row1!.lastUsedAt).toBe(true);

    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
  });

  it("upsert() folds diacritics — 'Varanda' and 'varánda' resolve to the SAME row (label_normalized PK collision)", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;

    await locRepo.upsert(db, { userId: userAId, label: "Varanda" });
    await locRepo.upsert(db, { userId: userAId, label: "varánda" });

    const rows = await adminSql<{ label_normalized: string; label_display: string; usage_count: number }[]>`
      SELECT label_normalized, label_display, usage_count
      FROM public.location_suggestions
      WHERE user_id = ${userAId}
    `;
    expect(rows.length).toBe(1);
    expect(rows[0]!.usage_count).toBe(2);
    expect(rows[0]!.label_display).toBe("Varanda");

    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
  });

  it("upsert() — different users with the same label coexist as two rows (composite PK on user_id + label_normalized)", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userBId}`;

    await locRepo.upsert(db, { userId: userAId, label: "Sala" });
    await locRepo.upsert(db, { userId: userBId, label: "Sala" });

    const rowsA = await adminSql<{ user_id: string }[]>`
      SELECT user_id FROM public.location_suggestions WHERE label_normalized = 'sala'
    `;
    expect(rowsA.length).toBe(2);

    await adminSql`DELETE FROM public.location_suggestions WHERE user_id IN (${userAId}, ${userBId})`;
  });

  it("upsert() rejects empty/whitespace-only labels (returns null)", async () => {
    const result = await locRepo.upsert(db, { userId: userAId, label: "   " });
    expect(result).toBeNull();

    const result2 = await locRepo.upsert(db, { userId: userAId, label: "" });
    expect(result2).toBeNull();
  });

  it("listForUser(userId, 20) returns rows ordered by usage_count DESC, last_used_at DESC, limited to 20", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;

    // Seed 25 rows with varying usage counts
    for (let i = 0; i < 25; i++) {
      const label = `Location-${String(i).padStart(3, "0")}`;
      await locRepo.upsert(db, { userId: userAId, label });
      // Some with extra usage
      if (i < 5) {
        await locRepo.upsert(db, { userId: userAId, label });
      }
    }

    const results = await locRepo.listForUser(db, { userId: userAId, limit: 20 });
    expect(results.length).toBe(20);

    // Verify ordering: usage_count DESC
    for (let i = 1; i < results.length; i++) {
      const prev = results[i - 1]!;
      const curr = results[i]!;
      if (prev.usageCount === curr.usageCount) {
        // tiebreak: last_used_at DESC
        expect(prev.lastUsedAt >= curr.lastUsedAt).toBe(true);
      } else {
        expect(prev.usageCount >= curr.usageCount).toBe(true);
      }
    }

    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
  });

  it("listForUser excludes rows from other users", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userBId}`;

    await locRepo.upsert(db, { userId: userAId, label: "Sala" });
    await locRepo.upsert(db, { userId: userAId, label: "Varanda" });
    await locRepo.upsert(db, { userId: userAId, label: "Cozinha" });
    await locRepo.upsert(db, { userId: userBId, label: "Quarto" });
    await locRepo.upsert(db, { userId: userBId, label: "Escritório" });
    await locRepo.upsert(db, { userId: userBId, label: "Garagem" });
    await locRepo.upsert(db, { userId: userBId, label: "Jardim" });
    await locRepo.upsert(db, { userId: userBId, label: "Pátio" });

    const resultsA = await locRepo.listForUser(db, { userId: userAId, limit: 20 });
    const resultsB = await locRepo.listForUser(db, { userId: userBId, limit: 20 });
    expect(resultsA.length).toBe(3);
    expect(resultsB.length).toBe(5);

    await adminSql`DELETE FROM public.location_suggestions WHERE user_id IN (${userAId}, ${userBId})`;
  });

  it("RLS owner-only on location_suggestions — userB authenticated cannot SELECT userA's rows (T-05-03-03)", async () => {
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;

    await adminSql`
      INSERT INTO public.location_suggestions (user_id, label_normalized, label_display)
      VALUES (${userAId}, 'sala', 'Sala')
      ON CONFLICT DO NOTHING
    `;

    const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
    try {
      const rowsAsB = await driver.begin(async (tx) => {
        await tx.unsafe(`SET LOCAL ROLE authenticated`);
        await tx`SELECT set_config('request.jwt.claim.sub', ${userBJwtSub}, true)`;
        return tx<{ label_display: string }[]>`
          SELECT label_display FROM public.location_suggestions WHERE user_id = ${userAId}
        `;
      });
      expect(rowsAsB).toHaveLength(0);
    } finally {
      await driver.end({ timeout: 5 });
      await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userAId}`;
    }
  }, 30_000);
});
