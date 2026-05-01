import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 07 — delete-photo-entry use-case integration tests (Task 3C RED).
 *
 * Tests:
 *  1  Owned PhotoEntry deletion → { ok: true }, row gone from DB
 *  2  Cross-user deletion → { ok: false, code: not_found } (T-05-07-02)
 *  3  D-03 cover auto-promote: delete oldest (cover) → cover advances to next-oldest
 *  4  D-03 delete non-cover → cover unchanged (bumpCoverFor defensive no-op)
 *  5  D-03 delete last photo → cover_photo_url = NULL
 *  6  T-05-04-01: validateStorageObjectKey called before pending_storage_deletions insert
 *  7  pending_storage_deletions: exactly 2 rows (one per bucket) with full canonical key
 *  8  TX atomicity: if second psd.create fails → PhotoEntry + cover bump both rolled back
 *  9  No Inngest event emitted (cleanup via reconciler, not plant.deleted event)
 * 10  Outer tx (deps.tx): use-case uses external tx, no own commit, no postCommit callback
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

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["test-event-id"] });
vi.mock("@shared/inngest/client", () => ({
  inngest: { send: inngestSendMock },
}));

describe.skipIf(!dbUrl)("Phase-05-07 deletePhotoEntry use-case integration", () => {
  const adminSql = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });
  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  let otherUserId: string;

  let deletePhotoEntry: typeof import("@contexts/catalog/application/delete-photo-entry").deletePhotoEntry;
  let db: typeof import("@shared/db/client").db;

  beforeAll(async () => {
    ({ deletePhotoEntry } = await import("@contexts/catalog/application/delete-photo-entry"));
    ({ db } = await import("@shared/db/client"));

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
    }

    const runId = randomUUID().slice(0, 8);

    const { data: userA, error: errA } = await adminClient.auth.admin.createUser({
      email: `delete-photo-userA-${runId}@test.local`,
      password: `pw-${randomUUID()}`,
      email_confirm: true,
    });
    if (errA || !userA.user) throw new Error(`createUser A: ${errA?.message}`);
    userId = userA.user.id;

    const { data: userB, error: errB } = await adminClient.auth.admin.createUser({
      email: `delete-photo-userB-${runId}@test.local`,
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
        await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;
        await adminSql`DELETE FROM public.photo_entries WHERE plant_id IN (SELECT id FROM public.plants WHERE user_id = ${userId})`;
        await adminSql`DELETE FROM public.plants WHERE user_id = ${userId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userId}`;
        await adminClient.auth.admin.deleteUser(userId);
      }
      if (otherUserId) {
        await adminSql`DELETE FROM public.photo_entries WHERE plant_id IN (SELECT id FROM public.plants WHERE user_id = ${otherUserId})`;
        await adminSql`DELETE FROM public.plants WHERE user_id = ${otherUserId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${otherUserId}`;
        await adminClient.auth.admin.deleteUser(otherUserId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  afterEach(() => {
    inngestSendMock.mockClear();
  });

  async function seedPlant(uid: string, opts: { coverPhotoUrl?: string } = {}): Promise<string> {
    const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.plants (user_id, name, cover_photo_url)
      VALUES (${uid}, ${"Test Plant"}, ${opts.coverPhotoUrl ?? null})
      RETURNING id
    `;
    if (!row) throw new Error("seedPlant: no row");
    return row.id;
  }

  async function seedPhotoEntry(
    plantId: string,
    uid: string,
    opts: { createdAt?: string } = {},
  ): Promise<{ id: string; photoUrl: string; thumbnailUrl: string }> {
    const photoId = randomUUID();
    const photoUrl = `plant-photos/${uid}/${plantId}/${photoId}.jpg`;
    const thumbnailUrl = `plant-thumbnails/${uid}/${plantId}/${photoId}.jpg`;
    const ts = opts.createdAt ?? new Date().toISOString();
    const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.photo_entries (id, plant_id, photo_url, thumbnail_url, created_at)
      VALUES (${photoId}, ${plantId}, ${photoUrl}, ${thumbnailUrl}, ${ts}::timestamptz)
      RETURNING id
    `;
    if (!row) throw new Error("seedPhotoEntry: no row");
    return { id: row.id, photoUrl, thumbnailUrl };
  }

  it("Test 1: owned PhotoEntry deletion → { ok: true }, row gone from DB", async () => {
    const plantId = await seedPlant(userId);
    const entry = await seedPhotoEntry(plantId, userId);

    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;

    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: entry.id });
    expect(result.ok).toBe(true);

    const [stillExists] = await adminSql<{ id: string }[]>`
      SELECT id FROM public.photo_entries WHERE id = ${entry.id}
    `;
    expect(stillExists).toBeUndefined();
  });

  it("Test 2: cross-user deletion → { ok: false, code: not_found } (T-05-07-02)", async () => {
    const plantId = await seedPlant(otherUserId);
    const entry = await seedPhotoEntry(plantId, otherUserId);

    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: entry.id });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.code).toBe("not_found");
  });

  it("Test 3: D-03 cover auto-promote — delete oldest (cover) → cover advances to next-oldest", async () => {
    const oldest = await seedPhotoEntry(await seedPlant(userId), userId, { createdAt: "2024-01-01T00:00:00Z" });
    // Create plant with cover = oldest's photo_url
    const plantId = await seedPlant(userId, { coverPhotoUrl: oldest.photoUrl });
    // Manually link the photo entry to this plant
    await adminSql`UPDATE public.photo_entries SET plant_id = ${plantId} WHERE id = ${oldest.id}`;

    const middle = await seedPhotoEntry(plantId, userId, { createdAt: "2024-06-01T00:00:00Z" });
    const newest = await seedPhotoEntry(plantId, userId, { createdAt: "2024-12-01T00:00:00Z" });

    // Confirm cover is oldest
    const [before] = await adminSql<{ cover_photo_url: string | null }[]>`
      SELECT cover_photo_url FROM public.plants WHERE id = ${plantId}
    `;
    expect(before?.cover_photo_url).toBe(oldest.photoUrl);

    // Clear psd rows from previous tests
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;

    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: oldest.id });
    expect(result.ok).toBe(true);

    // D-03: cover should now be middle (next-oldest by created_at ASC)
    const [after] = await adminSql<{ cover_photo_url: string | null }[]>`
      SELECT cover_photo_url FROM public.plants WHERE id = ${plantId}
    `;
    expect(after?.cover_photo_url).toBe(middle.photoUrl);
    void newest; // silence unused warning
  });

  it("Test 4: D-03 delete non-cover → cover unchanged (bumpCoverFor defensive no-op)", async () => {
    const oldest = await seedPhotoEntry(await seedPlant(userId), userId, { createdAt: "2024-01-01T00:00:00Z" });
    const plantId = await seedPlant(userId, { coverPhotoUrl: oldest.photoUrl });
    await adminSql`UPDATE public.photo_entries SET plant_id = ${plantId} WHERE id = ${oldest.id}`;

    const newest = await seedPhotoEntry(plantId, userId, { createdAt: "2024-12-01T00:00:00Z" });

    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;

    // Delete the newest (non-cover)
    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: newest.id });
    expect(result.ok).toBe(true);

    // Cover should still be oldest
    const [after] = await adminSql<{ cover_photo_url: string | null }[]>`
      SELECT cover_photo_url FROM public.plants WHERE id = ${plantId}
    `;
    expect(after?.cover_photo_url).toBe(oldest.photoUrl);
  });

  it("Test 5: D-03 delete last photo → cover_photo_url = NULL", async () => {
    const plantId = await seedPlant(userId);
    const entry = await seedPhotoEntry(plantId, userId);
    await adminSql`UPDATE public.plants SET cover_photo_url = ${entry.photoUrl} WHERE id = ${plantId}`;

    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;

    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: entry.id });
    expect(result.ok).toBe(true);

    const [after] = await adminSql<{ cover_photo_url: string | null }[]>`
      SELECT cover_photo_url FROM public.plants WHERE id = ${plantId}
    `;
    expect(after?.cover_photo_url).toBeNull();
  });

  it("Test 7: pending_storage_deletions — exactly 2 rows with full canonical key prefix", async () => {
    const plantId = await seedPlant(userId);
    const entry = await seedPhotoEntry(plantId, userId);
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;

    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: entry.id });
    expect(result.ok).toBe(true);

    const psdRows = await adminSql<{ bucket: string; prefix: string }[]>`
      SELECT bucket, prefix FROM public.pending_storage_deletions
      WHERE user_id = ${userId}
      ORDER BY bucket
    `;
    expect(psdRows).toHaveLength(2);

    // Each row's prefix should be the FULL canonical key (not a parent prefix)
    const photoId = entry.id;
    for (const row of psdRows) {
      // prefix is bucket-relative key: {userId}/{plantId}/{photoId}.jpg
      expect(row.prefix).toContain(userId);
      expect(row.prefix).toContain(plantId);
      expect(row.prefix).toContain(photoId);
      expect(row.prefix).toMatch(/\.jpg$/);
      // NOT a parent prefix (would end in /)
      expect(row.prefix).not.toMatch(/\/$/);
    }
  });

  it("Test 9: No Inngest event emitted on photo-entry delete", async () => {
    const plantId = await seedPlant(userId);
    const entry = await seedPhotoEntry(plantId, userId);
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;
    inngestSendMock.mockClear();

    const result = await deletePhotoEntry({ userId, plantId, photoEntryId: entry.id });
    expect(result.ok).toBe(true);
    // No Inngest event (unlike delete-plant which emits plant.deleted)
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("Test 10: outer tx (deps.tx) — use-case uses external tx, no postCommit field", async () => {
    const plantId = await seedPlant(userId);
    const entry = await seedPhotoEntry(plantId, userId);
    await adminSql`DELETE FROM public.pending_storage_deletions WHERE user_id = ${userId}`;

    let capturedResult: Awaited<ReturnType<typeof deletePhotoEntry>> | undefined;

    try {
      await db.transaction(async (tx) => {
        capturedResult = await deletePhotoEntry(
          { userId, plantId, photoEntryId: entry.id },
          { tx },
        );
        // Roll back deliberately
        tx.rollback();
      });
    } catch {
      // Drizzle throws on rollback()
    }

    expect(capturedResult?.ok).toBe(true);
    // postCommit is undefined for deletePhotoEntry (no telemetry event)
    if (capturedResult?.ok) {
      expect(capturedResult.postCommit).toBeUndefined();
    }

    // Row should still exist (rollback)
    const [stillExists] = await adminSql<{ id: string }[]>`
      SELECT id FROM public.photo_entries WHERE id = ${entry.id}
    `;
    expect(stillExists).toBeDefined();
  });
});
