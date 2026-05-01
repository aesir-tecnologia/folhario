import { randomUUID } from "node:crypto";

import sharp from "sharp";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 05 — createPlant use-case unit tests (Task 1 RED).
 *
 * Tests U1–U8 covering:
 *  U1  Name required (empty string → validation_failed)
 *  U2  Photo required (missing → validation_failed)
 *  U3  Unsupported MIME (image/gif → validation_failed, no storage call)
 *  U4  GPS-bearing buffer (exifr.gps returns coords → validation_failed, no storage)
 *  U5  Oversize buffer (MAX_UPLOAD_BYTES + 1 → validation_failed, no storage)
 *  U6  source:'identification' requires speciesId (missing → validation_failed)
 *  U7  source:'manual' rejects speciesId field (unknown key → validation_failed)
 *  U8  PostHog property-key allowlist: EXACTLY {source,has_nickname,has_location,
 *      has_acquisition_date,has_notes,photo_count} — D-28 privacy contract
 *
 * Mocks:
 *  - @shared/inngest/client → vi.fn() to assert send never/once called
 *  - @shared/telemetry/posthog-server → vi.fn() returning mock ph client
 *  - @contexts/catalog/infrastructure/photo-storage → __setStorageAdapterForTests
 *    with a fake that records uploadObject calls
 */

vi.mock("@shared/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["test-id"] }),
  },
}));

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);
const mockPostHogInstance = {
  capture: mockCapture,
  shutdown: mockShutdown,
};

vi.mock("@shared/telemetry/posthog-server", () => ({
  getPostHog: vi.fn(() => mockPostHogInstance),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

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

describe("createPlant use-case — unit tests (U1–U8)", () => {
  const validUserId = randomUUID();

  let createPlant: typeof import("@contexts/catalog/application/create-plant").createPlant;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
  let fakeUploadObject: ReturnType<typeof vi.fn>;
  let validJpegBuffer: Buffer;

  beforeAll(async () => {
    ({ createPlant } = await import("@contexts/catalog/application/create-plant"));
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));

    validJpegBuffer = await sharp({
      create: { width: 4, height: 4, channels: 3, background: { r: 100, g: 150, b: 200 } },
    })
      .jpeg({ quality: 80 })
      .toBuffer();
  });

  afterEach(() => {
    setStorageAdapterForTests(null);
    vi.clearAllMocks();
  });

  function makeFakeStorageAdapter() {
    fakeUploadObject = vi.fn(async ({ bucket, objectKey }: { bucket: string; objectKey: string }) => ({
      bucket,
      objectKey,
    }));
    const fakeAdapter = {
      uploadObject: fakeUploadObject,
      createSignedUrl: vi.fn(async () => ({ signedUrl: "https://example.test/signed" })),
      deletePrefix: vi.fn(async () => {}),
      deleteObject: vi.fn(async () => {}),
      listBuckets: vi.fn(async () => []),
      listObjectsUnderPrefix: vi.fn(async () => []),
    };
    return fakeAdapter;
  }

  it("U1: empty name returns validation_failed before any storage call", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U2: missing photo field returns validation_failed before any storage call", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "Suculenta",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      photo: undefined as any,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U3: unsupported MIME type (image/gif) returns validation_failed with /unsupported content type/ reason, no storage call", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "Suculenta",
      photo: { buffer: validJpegBuffer, contentType: "image/gif" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.reason).toMatch(/unsupported content type/i);
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U4: GPS-bearing buffer returns validation_failed with /gps/i reason, no storage call", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const exifrMod = await import("exifr");
    const gpsFn = exifrMod.gps as unknown as ReturnType<typeof vi.fn>;
    gpsFn.mockResolvedValueOnce({ latitude: -23.55, longitude: -46.63 });

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "Suculenta",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
      expect(result.reason).toMatch(/gps/i);
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U5: oversize buffer (MAX_UPLOAD_BYTES + 1) returns validation_failed before storage", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const oversizeBuffer = Buffer.alloc(1_048_577);

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "Suculenta",
      photo: { buffer: oversizeBuffer, contentType: "image/jpeg" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U6: source:identification without speciesId returns validation_failed", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const result = await createPlant({
      source: "identification",
      userId: validUserId,
      name: "Monstera deliciosa",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      // speciesId intentionally omitted
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U7: source:manual with speciesId field returns validation_failed (strict union, no cross-branch leak)", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "Suculenta",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      // speciesId MUST be rejected on the manual branch
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      speciesId: "some-uuid" as any,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("validation_failed");
    }
    expect(fakeUploadObject).not.toHaveBeenCalled();
  });

  it("U8: PostHog capture is called with EXACTLY {source,has_nickname,has_location,has_acquisition_date,has_notes,photo_count} — D-28 privacy contract", async () => {
    const fake = makeFakeStorageAdapter();
    setStorageAdapterForTests(fake as unknown as Parameters<typeof setStorageAdapterForTests>[0]);

    const { inngest } = await import("@shared/inngest/client");
    (inngest.send as ReturnType<typeof vi.fn>).mockResolvedValue({ ids: ["ok"] });

    const { withUnitOfWork: realUoW } = await import("@shared/db/unit-of-work");
    const uowSpy = vi.spyOn(
      await import("@shared/db/unit-of-work"),
      "withUnitOfWork",
    );

    const fakePlant = {
      id: randomUUID(),
      userId: validUserId,
      name: "Suculenta",
      nickname: "Susu",
      location: null,
      acquisitionDate: null,
      notes: null,
      speciesId: null,
      coverPhotoUrl: "plant-photos/key",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const fakePhotoEntry = {
      id: randomUUID(),
      plantId: fakePlant.id,
      photoUrl: "plant-photos/key",
      thumbnailUrl: "plant-thumbnails/key",
      note: null,
      createdAt: new Date().toISOString(),
    };

    uowSpy.mockImplementationOnce(async (_userId: string, fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ insert: vi.fn(), execute: vi.fn() });
    });

    const plantsRepoMod = await import("@contexts/catalog/infrastructure/db/plants");
    const photoEntriesRepoMod = await import("@contexts/catalog/infrastructure/db/photo-entries");
    vi.spyOn(plantsRepoMod, "create").mockResolvedValueOnce(fakePlant as unknown as ReturnType<typeof plantsRepoMod.create> extends Promise<infer T> ? T : never);
    vi.spyOn(photoEntriesRepoMod, "create").mockResolvedValueOnce(fakePhotoEntry as unknown as ReturnType<typeof photoEntriesRepoMod.create> extends Promise<infer T> ? T : never);

    const result = await createPlant({
      source: "manual",
      userId: validUserId,
      name: "Suculenta",
      photo: { buffer: validJpegBuffer, contentType: "image/jpeg" },
      nickname: "Susu",
    });

    if (!result.ok) {
      throw new Error(`Expected ok:true, got: ${JSON.stringify(result)}`);
    }

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const captureCall = mockCapture.mock.calls[0]?.[0] as {
      distinctId: string;
      event: string;
      properties: Record<string, unknown>;
    };
    expect(captureCall.event).toBe("plant_added");
    expect(captureCall.distinctId).toBe(validUserId);

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

    uowSpy.mockRestore();
    vi.restoreAllMocks();

    void realUoW;
  });
});
