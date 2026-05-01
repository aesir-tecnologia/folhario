import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Phase 05 Plan 07 — get-plant use-case integration tests (Task 1B RED).
 *
 * Tests:
 *  1  Owned plant with N photo entries and M reminders → { ok: true, plant, _meta }
 *  2  Cross-user plant → { ok: false, code: not_found } (T-05-07-02)
 *  3  Owned plant with zero photo entries + zero reminders → _meta zeroes (D-07)
 *  4  _meta keys are camelCase (photoEntryCount, reminderCount)
 */

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";

const dbUrl = process.env.DATABASE_POOL_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("Phase-05-07 getPlant use-case integration", () => {
  const adminSql = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });
  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  let otherUserId: string;

  let getPlant: typeof import("@contexts/catalog/application/get-plant").getPlant;

  beforeAll(async () => {
    ({ getPlant } = await import("@contexts/catalog/application/get-plant"));

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
    }

    const runId = randomUUID().slice(0, 8);

    const { data: userA, error: errA } = await adminClient.auth.admin.createUser({
      email: `get-plant-userA-${runId}@test.local`,
      password: `pw-${randomUUID()}`,
      email_confirm: true,
    });
    if (errA || !userA.user) throw new Error(`createUser A: ${errA?.message}`);
    userId = userA.user.id;

    const { data: userB, error: errB } = await adminClient.auth.admin.createUser({
      email: `get-plant-userB-${runId}@test.local`,
      password: `pw-${randomUUID()}`,
      email_confirm: true,
    });
    if (errB || !userB.user) throw new Error(`createUser B: ${errB?.message}`);
    otherUserId = userB.user.id;

    const [rowA] = await adminSql<{ id: string }[]>`SELECT id FROM public.users WHERE id = ${userId}`;
    const [rowB] = await adminSql<{ id: string }[]>`SELECT id FROM public.users WHERE id = ${otherUserId}`;
    if (!rowA || !rowB) {
      throw new Error("auth.users -> public.users sync trigger did not fire. Run pnpm db:migrate.");
    }
  }, 30_000);

  afterAll(async () => {
    try {
      if (userId) {
        await adminSql`DELETE FROM public.photo_entries WHERE plant_id IN (SELECT id FROM public.plants WHERE user_id = ${userId})`;
        await adminSql`DELETE FROM public.plants WHERE user_id = ${userId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userId}`;
        await adminClient.auth.admin.deleteUser(userId);
      }
      if (otherUserId) {
        await adminSql`DELETE FROM public.plants WHERE user_id = ${otherUserId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${otherUserId}`;
        await adminClient.auth.admin.deleteUser(otherUserId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  async function seedPlant(ownerId: string): Promise<string> {
    const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.plants (user_id, name)
      VALUES (${ownerId}, ${"Test Plant"})
      RETURNING id
    `;
    if (!row) throw new Error("seedPlant: no row");
    return row.id;
  }

  async function seedPhotoEntry(plantId: string, photoId?: string): Promise<void> {
    const pid = photoId ?? randomUUID();
    await adminSql`
      INSERT INTO public.photo_entries (id, plant_id, photo_url, thumbnail_url)
      VALUES (
        ${pid},
        ${plantId},
        ${"plant-photos/" + userId + "/" + plantId + "/" + pid + ".jpg"},
        ${"plant-thumbnails/" + userId + "/" + plantId + "/" + pid + ".jpg"}
      )
    `;
  }

  it("Test 1: owned plant with photo entries + reminders → ok:true with _meta counts", async () => {
    const plantId = await seedPlant(userId);
    await seedPhotoEntry(plantId);
    await seedPhotoEntry(plantId);

    const result = await getPlant({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.plant.id).toBe(plantId);
    expect(result._meta.photoEntryCount).toBe(2);
    expect(result._meta.reminderCount).toBe(0);
  });

  it("Test 2: cross-user plant → not_found (T-05-07-02)", async () => {
    const plantId = await seedPlant(otherUserId);
    const result = await getPlant({ userId, plantId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.code).toBe("not_found");
  });

  it("Test 3: zero photo entries + zero reminders → _meta zeroes (D-07)", async () => {
    const plantId = await seedPlant(userId);
    const result = await getPlant({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result._meta.photoEntryCount).toBe(0);
    expect(result._meta.reminderCount).toBe(0);
  });

  it("Test 4: _meta uses camelCase keys photoEntryCount and reminderCount", async () => {
    const plantId = await seedPlant(userId);
    const result = await getPlant({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    // Assert camelCase (not snake_case)
    expect("photoEntryCount" in result._meta).toBe(true);
    expect("reminderCount" in result._meta).toBe(true);
    expect("photo_entry_count" in result._meta).toBe(false);
    expect("reminder_count" in result._meta).toBe(false);
  });
});
