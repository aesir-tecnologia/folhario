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

type StorageAdapterShape = import("@shared/adapters/storage").StorageAdapter;

interface FakeAdapter {
  uploadObject: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
  deletePrefix: ReturnType<typeof vi.fn>;
  deleteObject: ReturnType<typeof vi.fn>;
  listBuckets: ReturnType<typeof vi.fn>;
  listObjectsUnderPrefix: ReturnType<typeof vi.fn>;
  asAdapter: StorageAdapterShape;
  /**
   * CR-01 test seam: exposes the internal "stored" set so tests that
   * override `uploadObject` via `mockImplementation`/`mockImplementationOnce`
   * can still seed the round-trip state. Underscore-prefix signals
   * "test-internal, not part of any adapter contract."
   */
  _stored: Set<string>;
  /** Build the canonical `{bucket}/{objectKey}` join key the fake uses internally. */
  _storedKey: (bucket: string, objectKey: string) => string;
}

function makeFakeAdapter(): FakeAdapter {
  // CR-01 spec: the adapter exposes a `deleteObject` method (single-key
  // remove via `client.storage.from(bucket).remove([objectKey])`) and the
  // CR-03 compensating-delete path goes through it. Models the real bucket
  // round-trip by tracking which (bucket, objectKey) pairs are "stored"
  // and asserting the compensating delete actually clears them — the
  // previous call-shape-only assertion accepted a no-op against
  // `deletePrefix(file_path)`.
  const stored = new Set<string>();
  const storedKey = (bucket: string, objectKey: string) => `${bucket}/${objectKey}`;

  const uploadObject = vi.fn(
    async ({ bucket, objectKey }: { bucket: string; objectKey: string }) => {
      stored.add(storedKey(bucket, objectKey));
      return { bucket, objectKey };
    },
  );
  const createSignedUrl = vi.fn(async () => ({
    signedUrl: "https://example.test/signed-url",
  }));
  const deletePrefix = vi.fn(async ({ bucket, prefix }: { bucket: string; prefix: string }) => {
    // Mirror real Supabase semantics: the SDK's `list(path)` interprets
    // its argument as a folder. CR-01: passing a file path returns
    // zero matches, so deletePrefix(file_path) silently no-ops in
    // production. We replicate that here so a regression that routes
    // single-file deletes through `deletePrefix` (the original CR-03
    // fix's mistake) cannot pass this test.
    //
    // A "folder" prefix has either a trailing `/` or matches an entry
    // that has at least one path-segment beyond the prefix. We only
    // honour delete when prefix ends with `/` — the LGPD sweep usage
    // (`${userId}/`) — and ALWAYS no-op on bare file-path prefixes.
    if (!prefix.endsWith("/")) return;
    for (const key of [...stored]) {
      const expectedHead = `${bucket}/${prefix}`;
      if (key.startsWith(expectedHead)) stored.delete(key);
    }
  });
  const deleteObject = vi.fn(
    async ({ bucket, objectKey }: { bucket: string; objectKey: string }) => {
      stored.delete(storedKey(bucket, objectKey));
    },
  );
  const listBuckets = vi.fn(
    async () => [] as Awaited<ReturnType<StorageAdapterShape["listBuckets"]>>,
  );
  const listObjectsUnderPrefix = vi.fn(
    async ({ bucket, prefix }: { bucket: string; prefix: string }): Promise<string[]> => {
      const head = `${bucket}/${prefix}`;
      return [...stored].filter((k) => k.startsWith(head)).map((k) => k.slice(bucket.length + 1));
    },
  );

  const asAdapter: StorageAdapterShape = {
    uploadObject: uploadObject as unknown as StorageAdapterShape["uploadObject"],
    createSignedUrl: createSignedUrl as unknown as StorageAdapterShape["createSignedUrl"],
    deletePrefix: deletePrefix as unknown as StorageAdapterShape["deletePrefix"],
    deleteObject: deleteObject as unknown as StorageAdapterShape["deleteObject"],
    listBuckets: listBuckets as unknown as StorageAdapterShape["listBuckets"],
    listObjectsUnderPrefix:
      listObjectsUnderPrefix as unknown as StorageAdapterShape["listObjectsUnderPrefix"],
  };

  return {
    uploadObject,
    createSignedUrl,
    deletePrefix,
    deleteObject,
    listBuckets,
    listObjectsUnderPrefix,
    asAdapter,
    _stored: stored,
    _storedKey: storedKey,
  };
}

describe.skipIf(!dbUrl)("Phase-02-08 Task 3 photo upload use-case + route", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 2, idle_timeout: 5 });

  let userId: string;
  let plantId: string;
  let uploadPhoto: typeof import("@contexts/catalog/application/upload-photo").uploadPhoto;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
  let validJpegBuffer: Buffer;

  beforeAll(async () => {
    ({ uploadPhoto } = await import("@contexts/catalog/application/upload-photo"));
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } =
      await import("@contexts/catalog/infrastructure/photo-storage"));

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
    setStorageAdapterForTests(fake.asAdapter);

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
    setStorageAdapterForTests(fake.asAdapter);

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
    setStorageAdapterForTests(fake.asAdapter);

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
    setStorageAdapterForTests(fake.asAdapter);

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

  it("CR-03/CR-01: when DB insert fails after storage uploads, both buckets end empty under userId/", async () => {
    // Drop the plant between the ownership check and the UoW write so
    // the photo_entries.plant_id FK violates and the UoW transaction
    // rolls back. Storage uploads have already committed by then; the
    // compensating delete must clear both buckets.
    //
    // CR-01: this test now asserts STATE (the bucket round-trip) rather
    // than CALL SHAPE. The previous version only checked that a delete
    // method was called with a particular argument and accepted a no-op
    // — a real Supabase deletePrefix(file_path) would silently do nothing
    // because the SDK list() treats its argument as a folder. Asserting
    // listObjectsUnderPrefix({ ... prefix: "${userId}/" }) returns an
    // empty array catches the regression.
    const ephemeralPlant = await driver`
        INSERT INTO plants (user_id, name)
        VALUES (${userId}, 'Doomed Plant')
        RETURNING id
      `;
    const doomedPlantId = ephemeralPlant[0]!.id as string;

    const fake = makeFakeAdapter();
    let observedOriginalKey = "";
    let observedThumbnailKey = "";
    // `mockImplementation` REPLACES the default behaviour entirely — so
    // every override below MUST seed `fake._stored` itself, otherwise the
    // round-trip assertion at the end is vacuously true (empty set →
    // listObjectsUnderPrefix returns [] regardless of what the
    // compensating delete did).
    fake.uploadObject.mockImplementation(async ({ bucket, objectKey }) => {
      fake._stored.add(fake._storedKey(bucket, objectKey));
      if (bucket === "plant-photos") observedOriginalKey = objectKey;
      if (bucket === "plant-thumbnails") observedThumbnailKey = objectKey;
      return { bucket, objectKey };
    });
    fake.uploadObject.mockImplementationOnce(async ({ bucket, objectKey }) => {
      fake._stored.add(fake._storedKey(bucket, objectKey));
      observedOriginalKey = objectKey;
      // After the original upload completes, delete the plant so the
      // FK violates when uploadPhoto reaches step 7. The ownership
      // check at step 4 already passed (we're past it).
      await driver`DELETE FROM plants WHERE id = ${doomedPlantId}`;
      return { bucket, objectKey };
    });
    setStorageAdapterForTests(fake.asAdapter);

    await expect(
      uploadPhoto({
        userId,
        plantId: doomedPlantId,
        buffer: validJpegBuffer,
        contentType: "image/jpeg",
      }),
    ).rejects.toThrow();

    expect(fake.uploadObject).toHaveBeenCalledTimes(2);
    expect(observedOriginalKey).not.toBe("");
    expect(observedThumbnailKey).not.toBe("");

    // CR-01: assert deleteObject was called with the full canonical key
    // (NOT deletePrefix) — single-file removal must use the SDK's
    // remove([objectKey]) path. Folder-style deletePrefix would silently
    // no-op against a real Supabase backend.
    const deleteObjectCalls = fake.deleteObject.mock.calls.map(
      (c) => c[0] as { bucket: string; objectKey: string },
    );
    expect(
      deleteObjectCalls.some(
        (c) => c.bucket === "plant-photos" && c.objectKey === observedOriginalKey,
      ),
    ).toBe(true);
    expect(
      deleteObjectCalls.some(
        (c) => c.bucket === "plant-thumbnails" && c.objectKey === observedThumbnailKey,
      ),
    ).toBe(true);

    // CR-01 round-trip: the compensating delete must actually have
    // drained the buckets. Both the photos and thumbnails buckets
    // should now contain no objects under the user prefix.
    const photosLeft = await fake.asAdapter.listObjectsUnderPrefix({
      bucket: "plant-photos",
      prefix: `${userId}/`,
    });
    const thumbsLeft = await fake.asAdapter.listObjectsUnderPrefix({
      bucket: "plant-thumbnails",
      prefix: `${userId}/`,
    });
    expect(photosLeft).toEqual([]);
    expect(thumbsLeft).toEqual([]);
  });

  it("successful upload calls uploadObject twice (original then thumbnail) and writes a PhotoEntry row", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const result = await uploadPhoto({
      userId,
      plantId,
      buffer: validJpegBuffer,
      contentType: "image/jpeg",
    });

    expect(result.ok).toBe(true);
    expect(fake.uploadObject).toHaveBeenCalledTimes(2);

    const firstCall = fake.uploadObject.mock.calls[0]?.[0] as { bucket: string; objectKey: string };
    const secondCall = fake.uploadObject.mock.calls[1]?.[0] as {
      bucket: string;
      objectKey: string;
    };
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
});
