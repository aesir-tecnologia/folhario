import {
  createSupabaseStorageAdapter,
  __setSupabaseClientForTests as __underlyingSetSupabaseClientForTests,
} from "@shared/adapters/supabase-storage";
import type { StorageAdapter } from "@shared/adapters/storage";

/**
 * Identification context photo-storage helpers (Phase 2 D-25 two-tier API).
 *
 * Identification photos persist for audit / history thumbnail access (D-21).
 * Object keyspace: `{userId}/{identificationId}/{n}.jpg` where `n` is the
 * 0-indexed photo position (0..4).
 *
 * Access is private-bucket-only; callers MUST use `signIdentificationPhotoUrl`
 * to produce 24h signed URLs for client delivery.
 */

export const IDENTIFICATION_PHOTOS_BUCKET = "identification-photos";

let cachedAdapter: StorageAdapter | null = null;

function getAdapter(): StorageAdapter {
  if (!cachedAdapter) {
    cachedAdapter = createSupabaseStorageAdapter();
  }
  return cachedAdapter;
}

/**
 * Test seam: swap in a fake `StorageAdapter`. Pass `null` to restore the
 * real Supabase-backed factory. Mirrors the catalog photo-storage pattern.
 */
export function __setStorageAdapterForTests(adapter: StorageAdapter | null): void {
  cachedAdapter = adapter;
  if (adapter === null) {
    __underlyingSetSupabaseClientForTests(null);
  }
}

export interface UploadIdentificationPhotoInput {
  userId: string;
  identificationId: string;
  index: number;
  buffer: Buffer | Uint8Array;
  contentType: string;
}

export async function uploadIdentificationPhoto(
  input: UploadIdentificationPhotoInput,
): Promise<{ storedUrl: string }> {
  const objectKey = `${input.userId}/${input.identificationId}/${input.index}.jpg`;
  const result = await getAdapter().uploadObject({
    bucket: IDENTIFICATION_PHOTOS_BUCKET,
    objectKey,
    buffer: input.buffer,
    contentType: input.contentType,
  });
  return { storedUrl: `${IDENTIFICATION_PHOTOS_BUCKET}/${result.objectKey}` };
}

export type SignIdentificationPhotoUrlResult =
  | { ok: true; signedUrl: string }
  | { ok: false; reason: "invalid_stored_url" };

export async function signIdentificationPhotoUrl(input: {
  storedUrl: string;
  ttlSeconds: number;
}): Promise<SignIdentificationPhotoUrlResult> {
  const slash = input.storedUrl.indexOf("/");
  if (slash <= 0 || slash >= input.storedUrl.length - 1) {
    return { ok: false, reason: "invalid_stored_url" };
  }
  const bucket = input.storedUrl.slice(0, slash);
  const objectKey = input.storedUrl.slice(slash + 1);
  if (bucket !== IDENTIFICATION_PHOTOS_BUCKET) {
    return { ok: false, reason: "invalid_stored_url" };
  }
  const result = await getAdapter().createSignedUrl({
    bucket: IDENTIFICATION_PHOTOS_BUCKET,
    objectKey,
    expiresInSeconds: input.ttlSeconds,
  });
  return { ok: true, signedUrl: result.signedUrl };
}

/**
 * LGPD prefix-deletion sweep: removes all identification photos for a user.
 * Phase 11 will call this from the deletion Inngest worker.
 */
export async function deleteAllIdentificationPhotosForUser(userId: string): Promise<void> {
  await getAdapter().deletePrefix({
    bucket: IDENTIFICATION_PHOTOS_BUCKET,
    prefix: `${userId}/`,
  });
}
