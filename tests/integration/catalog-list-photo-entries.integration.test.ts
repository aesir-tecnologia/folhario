import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Phase 05 Plan 07 — list-photo-entries use-case integration tests (Task 3A RED).
 *
 * Tests:
 *  1  Owned plant with 3 photo entries → { ok: true, items: [...] } reverse-chronological
 *  2  Cross-user plant → { ok: false, code: not_found } (T-05-07-02)
 *  3  Each item's thumbnailUrl is a signed URL (contains ?expires_in=) not the stored {bucket}/{key}
 *  4  Empty plant → { ok: true, items: [] }
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

describe.skipIf(!dbUrl)("Phase-05-07 listPhotoEntries use-case integration", () => {
  const adminSql = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });
  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  let otherUserId: string;

  let listPhotoEntries: typeof import("@contexts/catalog/application/list-photo-entries").listPhotoEntries;
  let __setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;

  beforeAll(async () => {
    ({ listPhotoEntries } = await import(
      "@contexts/catalog/application/list-photo-entries"
    ));
    ({ __setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
    }

    const runId = randomUUID().slice(0, 8);

    const { data: userA, error: errA } = await adminClient.auth.admin.createUser({
      email: `list-photo-entries-userA-${runId}@test.local`,
      password: `pw-${randomUUID()}`,
      email_confirm: true,
    });
    if (errA || !userA.user) throw new Error(`createUser A: ${errA?.message}`);
    userId = userA.user.id;

    const { data: userB, error: errB } = await adminClient.auth.admin.createUser({
      email: `list-photo-entries-userB-${runId}@test.local`,
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
      __setStorageAdapterForTests(null);
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

  async function seedPlant(uid: string): Promise<string> {
    const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.plants (user_id, name)
      VALUES (${uid}, ${"Test Plant"})
      RETURNING id
    `;
    if (!row) throw new Error("seedPlant: no row");
    return row.id;
  }

  async function seedPhotoEntry(
    plantId: string,
    ownerId: string,
    createdAtOffset = 0,
  ): Promise<{ id: string; thumbnailUrl: string }> {
    const photoId = randomUUID();
    const thumbnailUrl = `plant-thumbnails/${ownerId}/${plantId}/${photoId}.jpg`;
    const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.photo_entries (id, plant_id, photo_url, thumbnail_url, created_at)
      VALUES (
        ${photoId},
        ${plantId},
        ${"plant-photos/" + ownerId + "/" + plantId + "/" + photoId + ".jpg"},
        ${thumbnailUrl},
        now() + ${createdAtOffset + " seconds"}::interval
      )
      RETURNING id
    `;
    if (!row) throw new Error("seedPhotoEntry: no row");
    return { id: row.id, thumbnailUrl };
  }

  it("Test 1: owned plant with 3 photo entries → ok:true, items ordered reverse-chrono", async () => {
    const plantId = await seedPlant(userId);

    // Set up a fake adapter that returns deterministic signed URLs
    const fakeAdapter = {
      uploadObject: async () => ({ bucket: "", objectKey: "" }),
      listBuckets: async () => [],
      listObjectsUnderPrefix: async () => [],
      deletePrefix: async () => {},
      deleteObject: async () => {},
      createSignedUrl: async ({ bucket, objectKey }: { bucket: string; objectKey: string }) =>
        ({ signedUrl: `memory://${bucket}/${objectKey}?expires_in=86400` }),
    } as import("@shared/adapters/storage").StorageAdapter;
    __setStorageAdapterForTests(fakeAdapter);

    // Seed 3 entries with different timestamps (oldest first)
    await seedPhotoEntry(plantId, userId, 0);
    await seedPhotoEntry(plantId, userId, 1);
    const newest = await seedPhotoEntry(plantId, userId, 2);

    const result = await listPhotoEntries({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.items).toHaveLength(3);
    // Reverse-chronological: newest first
    expect(result.items[0]?.id).toBe(newest.id);
  });

  it("Test 2: cross-user plant → not_found (T-05-07-02)", async () => {
    const plantId = await seedPlant(otherUserId);
    const result = await listPhotoEntries({ userId, plantId });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.code).toBe("not_found");
  });

  it("Test 3: thumbnailUrl is signed URL (contains ?expires_in=) not stored {bucket}/{key}", async () => {
    const plantId = await seedPlant(userId);
    const fakeAdapter = {
      uploadObject: async () => ({ bucket: "", objectKey: "" }),
      listBuckets: async () => [],
      listObjectsUnderPrefix: async () => [],
      deletePrefix: async () => {},
      deleteObject: async () => {},
      createSignedUrl: async ({ bucket, objectKey }: { bucket: string; objectKey: string }) =>
        ({ signedUrl: `memory://${bucket}/${objectKey}?expires_in=86400` }),
    } as import("@shared/adapters/storage").StorageAdapter;
    __setStorageAdapterForTests(fakeAdapter);

    await seedPhotoEntry(plantId, userId);

    const result = await listPhotoEntries({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.items).toHaveLength(1);
    const item = result.items[0]!;
    // Should be signed URL, not raw stored form
    expect(item.thumbnailUrl).toMatch(/\?expires_in=/);
    expect(item.thumbnailUrl).not.toMatch(/^plant-thumbnails\//);
  });

  it("Test 4: empty plant → { ok: true, items: [] }", async () => {
    const plantId = await seedPlant(userId);
    const result = await listPhotoEntries({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.items).toHaveLength(0);
  });

  it("Test 5 (CR-03): result items expose photoSignedUrl alongside thumbnailSignedUrl", async () => {
    const plantId = await seedPlant(userId);
    const fakeAdapter = {
      uploadObject: async () => ({ bucket: "", objectKey: "" }),
      listBuckets: async () => [],
      listObjectsUnderPrefix: async () => [],
      deletePrefix: async () => {},
      deleteObject: async () => {},
      createSignedUrl: async ({ bucket, objectKey }: { bucket: string; objectKey: string }) =>
        ({ signedUrl: `memory://${bucket}/${objectKey}?expires_in=86400` }),
    } as import("@shared/adapters/storage").StorageAdapter;
    __setStorageAdapterForTests(fakeAdapter);

    await seedPhotoEntry(plantId, userId);

    const result = await listPhotoEntries({ userId, plantId });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.items).toHaveLength(1);
    const item = result.items[0]! as Record<string, unknown>;
    expect(item).toHaveProperty("photoSignedUrl");
    expect(item).toHaveProperty("thumbnailSignedUrl");
    expect(typeof item.photoSignedUrl === "string" || item.photoSignedUrl === null).toBe(true);
    expect(typeof item.thumbnailSignedUrl === "string" || item.thumbnailSignedUrl === null).toBe(true);
    // photoSignedUrl must be a signed URL (contains ?expires_in=) when signing succeeds
    expect(item.photoSignedUrl).toMatch(/\?expires_in=/);
  });
});
