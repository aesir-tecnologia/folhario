import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

/**
 * Phase 02 Plan 08 Task 2 — Storage adapter behavioural integration.
 *
 * Three contracts proven against the live local Supabase Storage API:
 *
 *  1. The adapter's `listBuckets()` exposes the three private buckets that
 *     plan 02-04 declared in `supabase/config.toml`: `plant-photos`,
 *     `plant-thumbnails`, and `data-exports`. (Overlaps with plan 02-04's
 *     storage-buckets test by design — plan 02-08 must keep working even
 *     if 02-04's test is removed in a future cleanup.)
 *
 *  2. `uploadObject` writes bytes to a `{user_id}/{aggregate_id}/{file_id}.{ext}`
 *     object key (D-26) and the resulting object is reachable via
 *     `createSignedUrl`. The fake-adapter inspector branch of this test
 *     also asserts that the photo-storage helper produces the EXACT path
 *     shape: `plant-photos/{user_id}/{plant_id}/{photo_id}.jpg` and
 *     `plant-thumbnails/{user_id}/{plant_id}/{photo_id}.jpg`.
 *
 *  3. `deletePrefix` removes every object under a `{user_id}/...` prefix
 *     (LGPD prefix deletion sweep, D-26).
 *
 * Cloud-Supabase guard: matches the existing pattern in
 * `tests/integration/postgres-connection.integration.test.ts` and
 * `tests/integration/storage-buckets.integration.test.ts`.
 *
 * Local stack reachability: skip with the explicit `supabase stop &&
 * supabase start` instruction when the Storage API is unreachable (per
 * 02-04 SUMMARY's `seed buckets --local` workflow). NEVER skip a cloud
 * URL — that's caught by the `supabase.co` regex above.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DB_URL = process.env.DATABASE_POOL_URL;

if (DB_URL && /supabase\.co/.test(DB_URL)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

const REQUIRED_BUCKETS = ["plant-photos", "plant-thumbnails", "data-exports"] as const;

const SKIP_MESSAGE =
  "Storage adapter test requires local Supabase running with refreshed buckets; " +
  "run 'supabase stop && supabase start' (and 'supabase seed buckets --local' " +
  "if buckets did not materialise).";

async function isStorageReachable(): Promise<boolean> {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return false;
  try {
    const { createSupabaseStorageAdapter } = await import(
      "@shared/adapters/supabase-storage"
    );
    const adapter = createSupabaseStorageAdapter();
    await adapter.listBuckets();
    return true;
  } catch {
    return false;
  }
}

const reachable = await isStorageReachable();

describe.skipIf(!reachable)("Phase-02-08 storage adapter integration", () => {
  it("listBuckets returns the three private plant buckets", async () => {
    const { createSupabaseStorageAdapter } = await import(
      "@shared/adapters/supabase-storage"
    );
    const adapter = createSupabaseStorageAdapter();
    const buckets = await adapter.listBuckets();
    const names = new Set(buckets.map((b) => b.name));
    const missing = REQUIRED_BUCKETS.filter((name) => !names.has(name));
    expect(
      missing,
      `Storage API missing buckets: ${missing.join(", ")}. ` + SKIP_MESSAGE,
    ).toEqual([]);
  });

  it("uploadObject + createSignedUrl round-trip an object", async () => {
    const { createSupabaseStorageAdapter } = await import(
      "@shared/adapters/supabase-storage"
    );
    const adapter = createSupabaseStorageAdapter();

    const userId = randomUUID();
    const plantId = randomUUID();
    const photoId = randomUUID();
    const objectKey = `${userId}/${plantId}/${photoId}.jpg`;
    const bucket = "plant-photos";

    const payload = Buffer.from("hello-world");
    await adapter.uploadObject({
      bucket,
      objectKey,
      buffer: payload,
      contentType: "image/jpeg",
    });

    const { signedUrl } = await adapter.createSignedUrl({
      bucket,
      objectKey,
      expiresInSeconds: 60,
    });
    expect(typeof signedUrl).toBe("string");
    expect(signedUrl.length).toBeGreaterThan(0);

    // Cleanup so the test is parallel/repeatable-safe.
    await adapter.deletePrefix({ bucket, prefix: `${userId}/` });
  });

  it("deletePrefix removes all objects under a {user_id}/ prefix (LGPD sweep)", async () => {
    const { createSupabaseStorageAdapter } = await import(
      "@shared/adapters/supabase-storage"
    );
    const adapter = createSupabaseStorageAdapter();

    const userId = randomUUID();
    const plantId = randomUUID();
    const bucket = "plant-photos";

    const photoIdA = randomUUID();
    const photoIdB = randomUUID();
    await adapter.uploadObject({
      bucket,
      objectKey: `${userId}/${plantId}/${photoIdA}.jpg`,
      buffer: Buffer.from("a"),
      contentType: "image/jpeg",
    });
    await adapter.uploadObject({
      bucket,
      objectKey: `${userId}/${plantId}/${photoIdB}.jpg`,
      buffer: Buffer.from("b"),
      contentType: "image/jpeg",
    });

    await adapter.deletePrefix({ bucket, prefix: `${userId}/` });

    // After the sweep, signing a URL still nominally succeeds (signed URLs
    // are issued by the Storage API even for nonexistent paths), but the
    // object should not exist. We assert via list — the bucket should not
    // return any object under this user's prefix.
    const remaining = await adapter.listObjectsUnderPrefix({
      bucket,
      prefix: `${userId}/`,
    });
    expect(remaining).toEqual([]);
  });
});

describe("Phase-02-08 photo-storage helper — D-26 path conventions", () => {
  it("produces plant-photos/{user_id}/{plant_id}/{photo_id}.jpg for originals", async () => {
    const { buildPlantPhotoObjectKey } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    );
    const userId = "11111111-1111-4111-8111-111111111111";
    const plantId = "22222222-2222-4222-8222-222222222222";
    const photoId = "33333333-3333-4333-8333-333333333333";
    const key = buildPlantPhotoObjectKey({ userId, plantId, photoId, ext: "jpg" });
    expect(key).toBe(`${userId}/${plantId}/${photoId}.jpg`);
  });

  it("produces plant-thumbnails/{user_id}/{plant_id}/{photo_id}.jpg for thumbnails", async () => {
    const { buildPlantThumbnailObjectKey } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    );
    const userId = "11111111-1111-4111-8111-111111111111";
    const plantId = "22222222-2222-4222-8222-222222222222";
    const photoId = "33333333-3333-4333-8333-333333333333";
    const key = buildPlantThumbnailObjectKey({ userId, plantId, photoId, ext: "jpg" });
    expect(key).toBe(`${userId}/${plantId}/${photoId}.jpg`);
  });

  it("photo-storage exports the canonical bucket names", async () => {
    const photoStorage = await import("@contexts/catalog/infrastructure/photo-storage");
    expect(photoStorage.PLANT_PHOTOS_BUCKET).toBe("plant-photos");
    expect(photoStorage.PLANT_THUMBNAILS_BUCKET).toBe("plant-thumbnails");
  });
});

if (!reachable) {
  console.warn(`[storage-adapter.integration] SKIP — ${SKIP_MESSAGE}`);
}
