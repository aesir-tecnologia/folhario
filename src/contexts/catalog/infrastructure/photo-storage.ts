import * as Sentry from "@sentry/nextjs";

import {
  createSupabaseStorageAdapter,
  __setSupabaseClientForTests as __underlyingSetSupabaseClientForTests,
} from "@shared/adapters/supabase-storage";
import type {
  CreateSignedUrlResult,
  StorageAdapter,
  UploadObjectResult,
} from "@shared/adapters/storage";
import { timeServer } from "@shared/telemetry/server-timing";

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
 * Returns the current StorageAdapter instance (real or test-injected).
 * Used by Inngest cleanup functions that need to call `deletePrefix`
 * outside the request lifecycle (D-22). Reads the same `cachedAdapter`
 * that `__setStorageAdapterForTests` swaps, so integration tests work
 * correctly when the fake adapter is injected.
 */
export function getStorageAdapter(): StorageAdapter {
  return getAdapter();
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

export async function signOriginalUrl(input: SignPlantPhotoInput): Promise<CreateSignedUrlResult> {
  return getAdapter().createSignedUrl({
    bucket: PLANT_PHOTOS_BUCKET,
    objectKey: buildPlantPhotoObjectKey(input),
    expiresInSeconds: input.expiresInSeconds,
  });
}

export async function signThumbnailUrl(input: SignPlantPhotoInput): Promise<CreateSignedUrlResult> {
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

export const KNOWN_BUCKETS = new Set([PLANT_PHOTOS_BUCKET, PLANT_THUMBNAILS_BUCKET] as const);

export type SignCatalogPhotoUrlResult =
  | { ok: true; signedUrl: string }
  | { ok: false; reason: "invalid_stored_url" | "unknown_bucket" };

/**
 * Sign a catalog photo URL for read access. Takes the stored
 * `{bucket}/{key}` shape persisted in `photo_entries.photo_url` and
 * `photo_entries.thumbnail_url` (see `upload-photo.ts:212`). Parses
 * once, delegates to the adapter. Pure function except for the
 * adapter call. D-20: callers pass `ttlSeconds = 24*3600`; the
 * literal stays in the caller, NEVER baked into this helper
 * (drift control).
 */
export async function signCatalogPhotoUrl(input: {
  storedUrl: string;
  ttlSeconds: number;
}): Promise<SignCatalogPhotoUrlResult> {
  const slash = input.storedUrl.indexOf("/");
  if (slash <= 0 || slash >= input.storedUrl.length - 1) {
    return { ok: false, reason: "invalid_stored_url" };
  }
  const bucket = input.storedUrl.slice(0, slash);
  const objectKey = input.storedUrl.slice(slash + 1);
  if (!(KNOWN_BUCKETS as Set<string>).has(bucket)) {
    return { ok: false, reason: "unknown_bucket" };
  }
  const result = await timeServer(
    "catalog.storage.createSignedUrl",
    () =>
      getAdapter().createSignedUrl({
        bucket,
        objectKey,
        expiresInSeconds: input.ttlSeconds,
      }),
    { bucket, ttlSeconds: input.ttlSeconds },
  );
  return { ok: true, signedUrl: result.signedUrl };
}

/**
 * CR-03 compensating deletion: remove a single photo's storage objects
 * when the DB write fails after upload. CR-01 fix: routes through the
 * adapter's `deleteObject` (single-key SDK `remove([key])`) — the prior
 * implementation passed the full canonical file key to `deletePrefix`,
 * which the Supabase SDK interprets as a folder path and silently
 * no-ops, leaving the bytes orphaned. Errors are swallowed and logged
 * (and reported to Sentry per IN-02): a failed compensating delete must
 * not mask the original DB error the caller is rethrowing.
 */
export async function deleteSinglePlantPhotoBestEffort(input: {
  userId: string;
  plantId: string;
  photoId: string;
  originalExt: "jpg" | "png" | "webp";
}): Promise<void> {
  const adapter = getAdapter();
  const originalKey = buildPlantPhotoObjectKey({
    userId: input.userId,
    plantId: input.plantId,
    photoId: input.photoId,
    ext: input.originalExt,
  });
  const thumbnailKey = buildPlantThumbnailObjectKey({
    userId: input.userId,
    plantId: input.plantId,
    photoId: input.photoId,
    ext: "jpg",
  });
  try {
    await adapter.deleteObject({ bucket: PLANT_PHOTOS_BUCKET, objectKey: originalKey });
  } catch (err) {
    console.warn(
      `[catalog/photo-storage] compensating delete failed for ${PLANT_PHOTOS_BUCKET}/${originalKey}:`,
      err,
    );
    Sentry.captureException(err, {
      tags: { area: "photo-storage", operation: "compensating-delete" },
      extra: {
        bucket: PLANT_PHOTOS_BUCKET,
        objectKey: originalKey,
        userId: input.userId,
        plantId: input.plantId,
        photoId: input.photoId,
      },
    });
  }
  try {
    await adapter.deleteObject({ bucket: PLANT_THUMBNAILS_BUCKET, objectKey: thumbnailKey });
  } catch (err) {
    console.warn(
      `[catalog/photo-storage] compensating delete failed for ${PLANT_THUMBNAILS_BUCKET}/${thumbnailKey}:`,
      err,
    );
    Sentry.captureException(err, {
      tags: { area: "photo-storage", operation: "compensating-delete" },
      extra: {
        bucket: PLANT_THUMBNAILS_BUCKET,
        objectKey: thumbnailKey,
        userId: input.userId,
        plantId: input.plantId,
        photoId: input.photoId,
      },
    });
  }
}
