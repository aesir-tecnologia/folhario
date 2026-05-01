import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import sharp from "sharp";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import * as schema from "@shared/db/schema-registry";

/**
 * Phase 05 Plan 05 — createPlant use-case integration tests (Task 2 RED).
 *
 * Tests I1–I7 covering:
 *  I1  Happy path source:manual — Plant + PhotoEntry created transactionally,
 *      telemetry fired inline after own UoW commit.
 *  I2  Compensating-delete on UoW rollback — both buckets empty after failure.
 *  I3  Telemetry leak guard on rollback (T-05-05-01) — PostHog + Inngest not called.
 *  I4  GPS rejection BEFORE storage write — zero rows, no storage, no telemetry.
 *  I5  source:identification branch with species_id set correctly.
 *  I6  Cross-user RLS defense — plant created under U1 is invisible to U2.
 *  I7  Outer-tx provided — postCommit callback returned, telemetry deferred.
 *
 * Setup mirrors photo-upload.integration.test.ts:
 *  - Cloud-Supabase guard.
 *  - __setStorageAdapterForTests with a fake (in-memory round-trip).
 *  - vi.mock for @shared/inngest/client and @shared/telemetry/posthog-server.
 *  - Service-role DB inserts for fixture users (bypass Supabase admin API).
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

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["test-event-id"] });

vi.mock("@shared/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@shared/telemetry/posthog-server", () => ({
  getPostHog: vi.fn(() => ({ capture: mockCapture, shutdown: mockShutdown })),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

type StorageAdapterShape = import("@shared/adapters/storage").StorageAdapter;

interface FakeAdapter {
  uploadObject: ReturnType<typeof vi.fn>;
  createSignedUrl: ReturnType<typeof vi.fn>;
  deletePrefix: ReturnType<typeof vi.fn>;
  deleteObject: ReturnType<typeof vi.fn>;
  listBuckets: ReturnType<typeof vi.fn>;
  listObjectsUnderPrefix: ReturnType<typeof vi.fn>;
  asAdapter: StorageAdapterShape;
  _stored: Set<string>;
  _storedKey: (bucket: string, objectKey: string) => string;
}

function makeFakeAdapter(): FakeAdapter {
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

describe.skipIf(!dbUrl)("Phase-05-05 createPlant use-case integration", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });
  const db = drizzle({ client: driver, schema });

  let userId: string;
  let userId2: string;
  let validJpegBuffer: Buffer;

  let createPlant: typeof import("@contexts/catalog/application/create-plant").createPlant;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
  let photoEntriesRepo: typeof import("@contexts/catalog/infrastructure/db/photo-entries");

  beforeAll(async () => {
    ({ createPlant } = await import("@contexts/catalog/application/create-plant"));
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));
    photoEntriesRepo = await import("@contexts/catalog/infrastructure/db/photo-entries");

    const userRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"create-plant-" + randomUUID() + "@test.local"}, 'Create Plant Test', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userRow[0]!.id as string;

    const userRow2 = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"create-plant-2-" + randomUUID() + "@test.local"}, 'Create Plant Test 2', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId2 = userRow2[0]!.id as string;

    validJpegBuffer = await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 100, g: 200, b: 100 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
  });

  afterAll(async () => {
    if (userId) {
      await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${userId})`;
      await driver`DELETE FROM plants WHERE user_id = ${userId}`;
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    if (userId2) {
      await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${userId2})`;
      await driver`DELETE FROM plants WHERE user_id = ${userId2}`;
      await driver`DELETE FROM users WHERE id = ${userId2}`;
    }
    await driver.end({ timeout: 5 });
  });

  afterEach(() => {
    setStorageAdapterForTests(null);
    vi.clearAllMocks();
  });

  it("I1: happy path source:manual — Plant + PhotoEntry created transactionally, telemetry fired inline", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const result = await createPlant({
      source: "manual",
      userId,
      name: "Suculenta",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      nickname: "Susu",
      location: "sala",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected ok:true, got: ${JSON.stringify(result)}`);

    expect(result.postCommit).toBeUndefined();

    const { plant, photoEntry } = result;

    const plantRows = await driver`
      SELECT id, user_id, name, cover_photo_url FROM plants WHERE id = ${plant.id}
    `;
    expect(plantRows).toHaveLength(1);
    expect(plantRows[0]!.user_id).toBe(userId);
    expect(plantRows[0]!.name).toBe("Suculenta");
    expect(plantRows[0]!.cover_photo_url).toBe(photoEntry.photoUrl);

    const photoRows = await driver`
      SELECT id, plant_id, photo_url FROM photo_entries WHERE id = ${photoEntry.id}
    `;
    expect(photoRows).toHaveLength(1);
    expect(photoRows[0]!.plant_id).toBe(plant.id);

    expect(fake.uploadObject).toHaveBeenCalledTimes(2);
    const firstCall = fake.uploadObject.mock.calls[0]?.[0] as { bucket: string };
    const secondCall = fake.uploadObject.mock.calls[1]?.[0] as { bucket: string };
    expect(firstCall.bucket).toBe("plant-photos");
    expect(secondCall.bucket).toBe("plant-thumbnails");

    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    const inngestCall = inngestSendMock.mock.calls[0]?.[0] as {
      name: string;
      data: { userId: string; plantId: string; source: string };
    };
    expect(inngestCall.name).toBe("plant.created");
    expect(inngestCall.data.userId).toBe(userId);
    expect(inngestCall.data.plantId).toBe(plant.id);
    expect(inngestCall.data.source).toBe("manual");

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const captureCall = mockCapture.mock.calls[0]?.[0] as {
      event: string;
      distinctId: string;
      properties: Record<string, unknown>;
    };
    expect(captureCall.event).toBe("plant_added");
    expect(captureCall.distinctId).toBe(userId);
    const propKeys = Object.keys(captureCall.properties).sort();
    expect(propKeys).toEqual(
      [
        "source",
        "has_nickname",
        "has_location",
        "has_acquisition_date",
        "has_notes",
        "photo_count",
      ].sort(),
    );
    expect(captureCall.properties.source).toBe("manual");
    expect(captureCall.properties.has_nickname).toBe(true);
    expect(captureCall.properties.has_location).toBe(true);
    expect(captureCall.properties.has_acquisition_date).toBe(false);
    expect(captureCall.properties.has_notes).toBe(false);
    expect(captureCall.properties.photo_count).toBe(1);

    expect(mockShutdown).toHaveBeenCalledTimes(1);

    await driver`DELETE FROM photo_entries WHERE id = ${photoEntry.id}`;
    await driver`DELETE FROM plants WHERE id = ${plant.id}`;
  });

  it("I2: compensating-delete on UoW rollback — both buckets empty after photoEntriesRepo.create throws", async () => {
    const fake = makeFakeAdapter();
    let observedOriginalKey = "";
    let observedThumbnailKey = "";

    fake.uploadObject.mockImplementation(async ({ bucket, objectKey }: { bucket: string; objectKey: string }) => {
      fake._stored.add(fake._storedKey(bucket, objectKey));
      if (bucket === "plant-photos") observedOriginalKey = objectKey;
      if (bucket === "plant-thumbnails") observedThumbnailKey = objectKey;
      return { bucket, objectKey };
    });

    setStorageAdapterForTests(fake.asAdapter);

    const photoCreateSpy = vi.spyOn(photoEntriesRepo, "create").mockRejectedValueOnce(
      new Error("simulated DB failure"),
    );

    await expect(
      createPlant({
        source: "manual",
        userId,
        name: "Doomed Plant I2",
        photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      }),
    ).rejects.toThrow("simulated DB failure");

    expect(fake.uploadObject).toHaveBeenCalledTimes(2);
    expect(observedOriginalKey).not.toBe("");
    expect(observedThumbnailKey).not.toBe("");

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

    const plantRows = await driver`
      SELECT id FROM plants WHERE user_id = ${userId} AND name = ${"Doomed Plant I2"}
    `;
    expect(plantRows).toHaveLength(0);

    photoCreateSpy.mockRestore();
  });

  it("I3 (T-05-05-01): PostHog + Inngest NOT called when own UoW rolls back — telemetry leak guard", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const photoCreateSpy = vi.spyOn(photoEntriesRepo, "create").mockRejectedValueOnce(
      new Error("simulated rollback"),
    );

    await expect(
      createPlant({
        source: "manual",
        userId,
        name: "Leak Guard Plant I3",
        photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      }),
    ).rejects.toThrow("simulated rollback");

    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockShutdown).not.toHaveBeenCalled();

    photoCreateSpy.mockRestore();
  });

  it("I4: GPS rejection BEFORE storage write — zero rows, no storage, no telemetry", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const exifrMod = await import("exifr");
    const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
    gpsFn.mockResolvedValueOnce({ latitude: -23.55, longitude: -46.63 });

    const result = await createPlant({
      source: "manual",
      userId,
      name: "GPS Plant I4",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.reason).toMatch(/gps/i);
    }

    expect(fake.uploadObject).not.toHaveBeenCalled();

    const plantRows = await driver`
      SELECT id FROM plants WHERE user_id = ${userId} AND name = ${"GPS Plant I4"}
    `;
    expect(plantRows).toHaveLength(0);

    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("I5: source:identification with speciesId — plant.species_id set, telemetry source correct", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const speciesRow = await driver`
      INSERT INTO species (scientific_name, common_name)
      VALUES (${"Monstera deliciosa " + randomUUID()}, ${"Costela-de-Adão"})
      RETURNING id
    `;
    const speciesId = speciesRow[0]!.id as string;

    try {
      const result = await createPlant({
        source: "identification",
        userId,
        name: "Monstera deliciosa",
        speciesId,
        photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error(`Expected ok:true, got: ${JSON.stringify(result)}`);

      const { plant, photoEntry } = result;
      expect(plant.speciesId).toBe(speciesId);

      expect(inngestSendMock).toHaveBeenCalledTimes(1);
      const inngestCall = inngestSendMock.mock.calls[0]?.[0] as { data: { source: string } };
      expect(inngestCall.data.source).toBe("identification");

      expect(mockCapture).toHaveBeenCalledTimes(1);
      const captureCall = mockCapture.mock.calls[0]?.[0] as {
        properties: Record<string, unknown>;
      };
      expect(captureCall.properties.source).toBe("identification");

      await driver`DELETE FROM photo_entries WHERE id = ${photoEntry.id}`;
      await driver`DELETE FROM plants WHERE id = ${plant.id}`;
    } finally {
      await driver`DELETE FROM species WHERE id = ${speciesId}`;
    }
  });

  it("I6: cross-user RLS defense — plant created under U1 invisible to U2", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const result = await createPlant({
      source: "manual",
      userId,
      name: "Private Plant I6",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(`Expected ok:true, got: ${JSON.stringify(result)}`);

    const { plant, photoEntry } = result;

    const u1Rows = await driver`
      SELECT id FROM plants WHERE user_id = ${userId} AND id = ${plant.id}
    `;
    expect(u1Rows).toHaveLength(1);

    const u2Rows = await driver`
      SELECT id FROM plants WHERE user_id = ${userId2} AND id = ${plant.id}
    `;
    expect(u2Rows).toHaveLength(0);

    await driver`DELETE FROM photo_entries WHERE id = ${photoEntry.id}`;
    await driver`DELETE FROM plants WHERE id = ${plant.id}`;
  });

  it("I7: outer-tx provided — postCommit callback returned, telemetry deferred until postCommit called", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    let plant: Awaited<ReturnType<typeof createPlant>>;
    let plantId: string | undefined;
    let photoEntryId: string | undefined;

    await db.transaction(async (outerTx) => {
      plant = await createPlant(
        {
          source: "manual",
          userId,
          name: "Outer TX Plant I7",
          photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
          nickname: "TxTest",
        },
        { tx: outerTx },
      );

      expect(plant.ok).toBe(true);
      if (!plant.ok) throw new Error(`Expected ok:true, got: ${JSON.stringify(plant)}`);

      expect(plant.postCommit).toBeDefined();
      expect(typeof plant.postCommit).toBe("function");

      expect(inngestSendMock).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();

      plantId = plant.plant.id;
      photoEntryId = plant.photoEntry.id;
    });

    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();

    if (plant!.ok && plant!.postCommit) {
      await plant!.postCommit();
    }

    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    const inngestCall = inngestSendMock.mock.calls[0]?.[0] as { name: string; data: { source: string } };
    expect(inngestCall.name).toBe("plant.created");
    expect(inngestCall.data.source).toBe("manual");

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const captureCall = mockCapture.mock.calls[0]?.[0] as { event: string };
    expect(captureCall.event).toBe("plant_added");

    if (photoEntryId) await driver`DELETE FROM photo_entries WHERE id = ${photoEntryId}`;
    if (plantId) await driver`DELETE FROM plants WHERE id = ${plantId}`;
  });

  it("I7b: outer-tx rollback variant — postCommit NOT called, no telemetry fires", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    let capturedPostCommit: (() => Promise<void>) | undefined;

    try {
      await db.transaction(async (outerTx) => {
        const plant = await createPlant(
          {
            source: "manual",
            userId,
            name: "Rollback TX Plant I7b",
            photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
          },
          { tx: outerTx },
        );

        expect(plant.ok).toBe(true);
        if (!plant.ok) throw new Error(`Expected ok:true`);

        capturedPostCommit = plant.postCommit;

        outerTx.rollback();
      });
    } catch {
      // Expected: tx.rollback() throws
    }

    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();

    expect(capturedPostCommit).toBeDefined();

    const rollbackRows = await driver`
      SELECT id FROM plants WHERE user_id = ${userId} AND name = ${"Rollback TX Plant I7b"}
    `;
    expect(rollbackRows).toHaveLength(0);
  });
});
