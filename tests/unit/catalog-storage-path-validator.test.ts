import { describe, expect, it } from "vitest";

import {
  StoragePathValidationError,
  validateStorageDeletionPrefix,
  validateStorageObjectKey,
} from "@contexts/catalog/domain/storage-paths";

describe("validateStorageObjectKey", () => {
  it("accepts canonical path with ext jpg", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/photo-id.jpg" }),
    ).not.toThrow();
  });

  it("accepts canonical path with ext png", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/photo-id.png" }),
    ).not.toThrow();
  });

  it("accepts canonical path with ext webp", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/photo-id.webp" }),
    ).not.toThrow();
  });

  it("accepts canonical path with ext jpeg", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/photo-id.jpeg" }),
    ).not.toThrow();
  });

  it("accepts photoId with UUID hyphens", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/2f3a-9b4c.jpg" }),
    ).not.toThrow();
  });

  it("throws StoragePathValidationError on mismatched userId", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u2/p1/photo.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on mismatched plantId", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p2/photo.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on empty userId", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "", plantId: "p1", key: "u1/p1/x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on empty plantId", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "", key: "u1/p1/x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on traversal .. segment", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/../p1/x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on trailing traversal", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/../x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on leading slash", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "/u1/p1/x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on backslash", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1\\p1\\x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on extension outside allow-list", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/x.heic" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on missing extension", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/x" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on extra path segments", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/sub/x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on too few segments", () => {
    expect(() =>
      validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/x.jpg" }),
    ).toThrow(StoragePathValidationError);
  });
});

describe("validateStorageDeletionPrefix", () => {
  it("accepts exact canonical prefix", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "u1", plantId: "p1", prefix: "u1/p1/" }),
    ).not.toThrow();
  });

  it("accepts different valid userId/plantId pair", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "abc", plantId: "def", prefix: "abc/def/" }),
    ).not.toThrow();
  });

  it("throws StoragePathValidationError on cross-user-prefix attack (T-05-04-01)", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "u1", plantId: "p1", prefix: "u2/p1/" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError when trailing slash is missing", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "u1", plantId: "p1", prefix: "u1/p1" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError when extra path is appended after prefix", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "u1", plantId: "p1", prefix: "u1/p1/photo.jpg" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on empty userId", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "", plantId: "p1", prefix: "u1/p1/" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on empty plantId", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "u1", plantId: "", prefix: "u1//" }),
    ).toThrow(StoragePathValidationError);
  });

  it("throws StoragePathValidationError on mismatched plantId", () => {
    expect(() =>
      validateStorageDeletionPrefix({ userId: "u1", plantId: "p1", prefix: "u1/p2/" }),
    ).toThrow(StoragePathValidationError);
  });
});
