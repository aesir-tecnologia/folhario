import {
  createSupabaseStorageAdapter,
  __setSupabaseClientForTests as __underlyingSetSupabaseClientForTests,
} from "@shared/adapters/supabase-storage";
import type {
  CreateSignedUrlResult,
  StorageAdapter,
  UploadObjectResult,
} from "@shared/adapters/storage";

/**
 * Catalog context's photo-storage helper.
 *
 * Phase 02 Plan 08 — D-25 (per-context helper layered on the generic
 * StorageAdapter), D-26 (path conventions:
 * `plant-photos/{user_id}/{plant_id}/{photo_id}.jpg` and
 * `plant-thumbnails/...`).
 *
 * The helper holds the adapter instance, exposes a test-only override
 * (`__setStorageAdapterForTests`), and provides typed `uploadOriginal`,
 * `uploadThumbnail`, `signOriginalUrl`, `signThumbnailUrl`, and
 * `deleteAllForUser` operations that the application layer composes.
 *
 * D-26 path conventions are enforced HERE, not in the generic adapter:
 * a future LGPD prefix-deletion sweep can issue
 * `deletePrefix(plant-photos, '${userId}/')` and remove all of a user's
 * photos in one call without leaking any path-shape knowledge into the
 * adapter contract.
 */

export const PLANT_PHOTOS_BUCKET = "plant-photos";
export const PLANT_THUMBNAILS_BUCKET = "plant-thumbnails";

export interface PhotoStorageKeyInput {
  userId: string;
  plantId: string;
  photoId: string;
  ext: "jpg" | "png" | "webp";
}

/**
 * Build the canonical D-26 object key for the original photo. Returns the
 * IN-BUCKET key (no bucket prefix) — pass it to `adapter.uploadObject`
 * along with the `bucket` argument.
 */
export function buildPlantPhotoObjectKey(input: PhotoStorageKeyInput): string {
  return `${input.userId}/${input.plantId}/${input.photoId}.${input.ext}`;
}

/**
 * Build the canonical D-26 object key for the thumbnail. Same shape as
 * the original key — the bucket name is what differentiates them.
 */
export function buildPlantThumbnailObjectKey(input: PhotoStorageKeyInput): string {
  return `${input.userId}/${input.plantId}/${input.photoId}.${input.ext}`;
}

let cachedAdapter: StorageAdapter | null = null;

function getAdapter(): StorageAdapter {
  if (!cachedAdapter) {
    cachedAdapter = createSupabaseStorageAdapter();
  }
  return cachedAdapter;
}

/**
 * Test seam: swap in a fake `StorageAdapter`. Pass `null` to restore the
 * real Supabase-backed factory. Mirrors the
 * `__setCurrentUserAdapterForTests` pattern from plan 02-07.
 */
export function __setStorageAdapterForTests(adapter: StorageAdapter | null): void {
  cachedAdapter = adapter;
  if (adapter === null) {
    __underlyingSetSupabaseClientForTests(null);
  }
}

export interface UploadPlantPhotoInput {
  userId: string;
  plantId: string;
  photoId: string;
  ext: "jpg" | "png" | "webp";
  buffer: Buffer | Uint8Array;
  contentType: string;
}

export async function uploadOriginalPlantPhoto(
  input: UploadPlantPhotoInput,
): Promise<UploadObjectResult> {
  const objectKey = buildPlantPhotoObjectKey(input);
  return getAdapter().uploadObject({
    bucket: PLANT_PHOTOS_BUCKET,
    objectKey,
    buffer: input.buffer,
    contentType: input.contentType,
  });
}

export async function uploadPlantThumbnail(
  input: UploadPlantPhotoInput,
): Promise<UploadObjectResult> {
  const objectKey = buildPlantThumbnailObjectKey(input);
  return getAdapter().uploadObject({
    bucket: PLANT_THUMBNAILS_BUCKET,
    objectKey,
    buffer: input.buffer,
    contentType: input.contentType,
  });
}

export interface SignPlantPhotoInput {
  userId: string;
  plantId: string;
  photoId: string;
  ext: "jpg" | "png" | "webp";
  expiresInSeconds: number;
}

export async function signOriginalUrl(
  input: SignPlantPhotoInput,
): Promise<CreateSignedUrlResult> {
  return getAdapter().createSignedUrl({
    bucket: PLANT_PHOTOS_BUCKET,
    objectKey: buildPlantPhotoObjectKey(input),
    expiresInSeconds: input.expiresInSeconds,
  });
}

export async function signThumbnailUrl(
  input: SignPlantPhotoInput,
): Promise<CreateSignedUrlResult> {
  return getAdapter().createSignedUrl({
    bucket: PLANT_THUMBNAILS_BUCKET,
    objectKey: buildPlantThumbnailObjectKey(input),
    expiresInSeconds: input.expiresInSeconds,
  });
}

/**
 * LGPD prefix-deletion sweep: removes every plant photo + thumbnail under
 * the supplied user's prefix. Phase 11 will call this from the deletion
 * Inngest worker; Phase 02 ships the helper so the contract is testable.
 */
export async function deleteAllPlantMediaForUser(userId: string): Promise<void> {
  const adapter = getAdapter();
  const prefix = `${userId}/`;
  await adapter.deletePrefix({ bucket: PLANT_PHOTOS_BUCKET, prefix });
  await adapter.deletePrefix({ bucket: PLANT_THUMBNAILS_BUCKET, prefix });
}
