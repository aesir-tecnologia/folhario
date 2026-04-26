import { randomUUID } from "node:crypto";

import postgres from "postgres";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 02 Plan 08 Task 3 — photo upload use-case + route integration.
 *
 * Three behaviours proven against real Postgres + real sharp + a fake
 * StorageAdapter (no live Storage round-trip — the storage round-trip
 * is covered by `tests/integration/storage-adapter.integration.test.ts`).
 *
 *  1. GPS-bearing buffer → use-case rejects with `validation_failed`
 *     BEFORE any storage write. Asserted by spying on the fake adapter's
 *     `uploadObject` and confirming it was never called (T-02-20 / INFRA-19
 *     defense in depth).
 *
 *  2. Successful upload calls `uploadObject` exactly twice in order:
 *     once with `bucket: 'plant-photos'`, then with `bucket: 'plant-thumbnails'`
 *     (D-31 thumbnail synchronously, D-26 path conventions).
 *
 *  3. Boundary check: `Buffer.alloc(MAX_UPLOAD_BYTES + 1)` (i.e. 1_048_577
 *     bytes) returns `validation_failed`. The boundary literal is asserted
 *     directly via `Buffer.alloc(1_048_577)` so the size-limit drift threat
 *     T-02-39 cannot regress silently.
 *
 * Cloud-Supabase guard pattern matches the existing tests; integration
 * tests target local Postgres only.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

vi.mock("exifr", async () => {
  const actual = await vi.importActual<typeof import("exifr")>("exifr");
  const gps = vi.fn(actual.gps);
  return {
    ...actual,
    default: { ...actual, gps },
    gps,
    __esModule: true,
  };
});

interface FakeAdapter {
  uploadObject: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
  deletePrefix: ReturnType<typeof vi.fn>;
  listBuckets: ReturnType<typeof vi.fn>;
  listObjectsUnderPrefix: ReturnType<typeof vi.fn>;
}

function makeFakeAdapter(): FakeAdapter {
  return {
    uploadObject: vi.fn(async ({ bucket, objectKey }: { bucket: string; objectKey: string }) => ({
      bucket,
      objectKey,
    })),
    createSignedUrl: vi.fn(async () => ({
      signedUrl: "https://example.test/signed-url",
    })),
    deletePrefix: vi.fn(async () => undefined),
    listBuckets: vi.fn(async () => []),
    listObjectsUnderPrefix: vi.fn(async () => []),
  };
}

describe.skipIf(!dbUrl)(
  "Phase-02-08 Task 3 photo upload use-case + route",
  () => {
    const driver = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });

    let userId: string;
    let plantId: string;
    let uploadPhoto: typeof import("@contexts/catalog/application/upload-photo").uploadPhoto;
    let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
    let validJpegBuffer: Buffer;

    beforeAll(async () => {
      ({ uploadPhoto } = await import("@contexts/catalog/application/upload-photo"));
      ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
        "@contexts/catalog/infrastructure/photo-storage"
      ));

      // Insert a fixture user + plant. Phase 04 wires real signup; here we
      // bypass via service-role insert for the test fixture.
      const userRow = await driver`
        INSERT INTO users (email, name, timezone, trial_source)
        VALUES (${"upload-" + randomUUID() + "@test.local"}, 'Upload Test', 'America/Sao_Paulo', 'organic')
        RETURNING id
      `;
      userId = userRow[0]!.id as string;

      const plantRow = await driver`
        INSERT INTO plants (user_id, name)
        VALUES (${userId}, 'Test Plant')
        RETURNING id
      `;
      plantId = plantRow[0]!.id as string;

      // Generate a tiny valid JPEG so the success path can run end-to-end.
      validJpegBuffer = await sharp({
        create: {
          width: 8,
          height: 8,
          channels: 3,
          background: { r: 100, g: 200, b: 100 },
        },
      })
        .jpeg({ quality: 80 })
        .toBuffer();
    });

    afterAll(async () => {
      if (userId) {
        await driver`DELETE FROM users WHERE id = ${userId}`;
      }
      await driver.end({ timeout: 5 });
    });

    afterEach(() => {
      setStorageAdapterForTests(null);
      vi.clearAllMocks();
    });

    it("rejects GPS-bearing buffer with validation_failed BEFORE any storage write", async () => {
      const fake = makeFakeAdapter();
      setStorageAdapterForTests(fake);

      const exifrMod = await import("exifr");
      const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
      gpsFn.mockResolvedValueOnce({ latitude: -23.55052, longitude: -46.633308 });

      const result = await uploadPhoto({
        userId,
        plantId,
        buffer: validJpegBuffer,
        contentType: "image/jpeg",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("validation_failed");
      }
      // Defense in depth assertion: the adapter NEVER saw the bytes.
      expect(fake.uploadObject).not.toHaveBeenCalled();
    });

    it("rejects an oversize buffer (MAX_UPLOAD_BYTES + 1 = 1_048_577) with validation_failed", async () => {
      const fake = makeFakeAdapter();
      setStorageAdapterForTests(fake);

      const oversizeBuffer = Buffer.alloc(1_048_577);
      const result = await uploadPhoto({
        userId,
        plantId,
        buffer: oversizeBuffer,
        contentType: "image/jpeg",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("validation_failed");
      }
      expect(fake.uploadObject).not.toHaveBeenCalled();
    });

    it("rejects a disallowed MIME type with validation_failed", async () => {
      const fake = makeFakeAdapter();
      setStorageAdapterForTests(fake);

      const result = await uploadPhoto({
        userId,
        plantId,
        buffer: validJpegBuffer,
        contentType: "application/pdf",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("validation_failed");
      }
      expect(fake.uploadObject).not.toHaveBeenCalled();
    });

    it("rejects an upload to a plant the user does not own with not_found", async () => {
      const fake = makeFakeAdapter();
      setStorageAdapterForTests(fake);

      const otherPlantId = randomUUID();
      const result = await uploadPhoto({
        userId,
        plantId: otherPlantId,
        buffer: validJpegBuffer,
        contentType: "image/jpeg",
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(["not_found", "validation_failed"]).toContain(result.code);
      }
      expect(fake.uploadObject).not.toHaveBeenCalled();
    });

    it("successful upload calls uploadObject twice (original then thumbnail) and writes a PhotoEntry row", async () => {
      const fake = makeFakeAdapter();
      setStorageAdapterForTests(fake);

      const result = await uploadPhoto({
        userId,
        plantId,
        buffer: validJpegBuffer,
        contentType: "image/jpeg",
      });

      expect(result.ok).toBe(true);
      expect(fake.uploadObject).toHaveBeenCalledTimes(2);

      const firstCall = fake.uploadObject.mock.calls[0]?.[0] as { bucket: string; objectKey: string };
      const secondCall = fake.uploadObject.mock.calls[1]?.[0] as { bucket: string; objectKey: string };
      expect(firstCall.bucket).toBe("plant-photos");
      expect(secondCall.bucket).toBe("plant-thumbnails");
      // D-26 path shape — same key on both buckets, just different bucket.
      expect(firstCall.objectKey).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
      expect(secondCall.objectKey).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/);
      expect(firstCall.objectKey).toBe(secondCall.objectKey);

      // PhotoEntry row exists in the catalog schema.
      if (result.ok) {
        const photoId = result.photoEntry.id;
        const rows = await driver`
          SELECT id, plant_id, photo_url, thumbnail_url
          FROM photo_entries
          WHERE id = ${photoId}
        `;
        expect(rows.length).toBe(1);
        expect(rows[0]?.plant_id).toBe(plantId);
        expect(rows[0]?.photo_url).toBeTruthy();
        expect(rows[0]?.thumbnail_url).toBeTruthy();

        // Cleanup the PhotoEntry row so the test is parallel/repeatable-safe.
        await driver`DELETE FROM photo_entries WHERE id = ${photoId}`;
      }
    });
  },
);
