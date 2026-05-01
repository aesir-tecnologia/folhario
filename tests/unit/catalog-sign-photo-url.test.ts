import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 07 — signCatalogPhotoUrl unit tests (Task 3-PRE RED).
 *
 * Tests:
 *  1  Stored "plant-thumbnails/u1/p1/photo.jpg" → calls adapter with correct bucket + objectKey + expiresInSeconds
 *  2  Stored "plant-photos/u1/p1/photo.jpg" → uses plant-photos bucket
 *  3  Multi-segment key "plant-thumbnails/u1/p1/sub/photo.jpg" → full key preserved
 *  4  Malformed input (no '/') → { ok: false, reason: "invalid_stored_url" }
 *  5  Empty string → { ok: false, reason: "invalid_stored_url" }
 *  6  Unknown bucket prefix → { ok: false, reason: "unknown_bucket" }
 */

describe("signCatalogPhotoUrl", () => {
  let signCatalogPhotoUrl: typeof import("@contexts/catalog/infrastructure/photo-storage").signCatalogPhotoUrl;
  let __setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;

  const mockCreateSignedUrl = vi.fn();

  const fakeAdapter: import("@shared/adapters/storage").StorageAdapter = {
    uploadObject: vi.fn(),
    createSignedUrl: mockCreateSignedUrl,
    deletePrefix: vi.fn(),
    deleteObject: vi.fn(),
    listBuckets: vi.fn(),
    listObjectsUnderPrefix: vi.fn(),
  };

  beforeEach(async () => {
    ({ signCatalogPhotoUrl, __setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));
    __setStorageAdapterForTests(fakeAdapter);
    mockCreateSignedUrl.mockReset();
    mockCreateSignedUrl.mockResolvedValue({ signedUrl: "https://signed.test/result" });
  });

  it("Test 1: plant-thumbnails bucket → correct adapter call with bucket/objectKey/expiresInSeconds", async () => {
    const result = await signCatalogPhotoUrl({
      storedUrl: "plant-thumbnails/u1/p1/photo.jpg",
      ttlSeconds: 86400,
    });

    expect(result.ok).toBe(true);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith({
      bucket: "plant-thumbnails",
      objectKey: "u1/p1/photo.jpg",
      expiresInSeconds: 86400,
    });
    if (result.ok) {
      expect(result.signedUrl).toBe("https://signed.test/result");
    }
  });

  it("Test 2: plant-photos bucket → adapter called with plant-photos bucket", async () => {
    const result = await signCatalogPhotoUrl({
      storedUrl: "plant-photos/u1/p1/photo.jpg",
      ttlSeconds: 86400,
    });

    expect(result.ok).toBe(true);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ bucket: "plant-photos" }),
    );
  });

  it("Test 3: multi-segment key → full key after bucket prefix preserved", async () => {
    const result = await signCatalogPhotoUrl({
      storedUrl: "plant-thumbnails/u1/p1/sub/photo.jpg",
      ttlSeconds: 3600,
    });

    expect(result.ok).toBe(true);
    expect(mockCreateSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ objectKey: "u1/p1/sub/photo.jpg" }),
    );
  });

  it("Test 4: malformed input (no '/') → { ok: false, reason: 'invalid_stored_url' }", async () => {
    const result = await signCatalogPhotoUrl({
      storedUrl: "no-slash-here",
      ttlSeconds: 86400,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_stored_url");
    }
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("Test 5: empty string → { ok: false, reason: 'invalid_stored_url' }", async () => {
    const result = await signCatalogPhotoUrl({
      storedUrl: "",
      ttlSeconds: 86400,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_stored_url");
    }
  });

  it("Test 6: unknown bucket prefix → { ok: false, reason: 'unknown_bucket' }", async () => {
    const result = await signCatalogPhotoUrl({
      storedUrl: "other-bucket/some/path.jpg",
      ttlSeconds: 86400,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("unknown_bucket");
    }
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });
});
