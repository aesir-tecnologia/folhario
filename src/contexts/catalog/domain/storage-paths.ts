/**
 * Storage-path ownership validators (D-26 canonical path:
 * `{userId}/{plantId}/{photoId}.{ext}`). Defends against
 * prefix-mis-scope deletion races (T-05-04-01).
 * Pure functions, no I/O.
 *
 * - validateStorageObjectKey: use before deleteObject (single file).
 * - validateStorageDeletionPrefix: use before deletePrefix (plant cleanup).
 *
 * Downstream consumers (05-06 delete-plant, 05-07 delete-photo-entry,
 * 05-09 route handlers) MUST call the appropriate helper BEFORE any
 * `storageAdapter.deleteObject(...)` or `deletePrefix(...)`.
 */

export class StoragePathValidationError extends Error {
  constructor(message: string) {
    super(`storage path validation failed: ${message}`);
    this.name = "StoragePathValidationError";
  }
}

/**
 * Validates a full storage object key for single-file operations.
 * Asserts key matches `^{userId}/{plantId}/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$`.
 * Throws `StoragePathValidationError` on any mismatch.
 */
export function validateStorageObjectKey({
  userId,
  plantId,
  key,
}: {
  userId: string;
  plantId: string;
  key: string;
}): void {
  if (!userId) throw new StoragePathValidationError("userId empty");
  if (!plantId) throw new StoragePathValidationError("plantId empty");
  const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedPlantId = plantId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(
    `^${escapedUserId}/${escapedPlantId}/[a-zA-Z0-9-]+\\.(jpg|jpeg|png|webp)$`,
  );
  if (!pattern.test(key)) {
    throw new StoragePathValidationError(
      `key "${key}" does not match expected pattern for userId="${userId}" plantId="${plantId}"`,
    );
  }
}

/**
 * Parse the plantId from a D-26 canonical object key `{userId}/{plantId}/{photoId}.{ext}`.
 * Returns the plantId segment, or null if the key does not match the expected shape.
 *
 * Canonical single source-of-truth used by delete-photo-entry.ts (replaces
 * extractPlantIdFromKey) and inngest/functions.ts (replaces extractPlantIdFromObjectKey).
 * Returns null on failure instead of throwing so callers choose their own error strategy.
 */
export function parsePlantPhotoKey(key: string, userId: string): string | null {
  const prefix = `${userId}/`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  return rest.slice(0, slash);
}

/**
 * Validates a prefix path used for bulk storage deletion (e.g. plant cleanup).
 * Asserts prefix === `${userId}/${plantId}/` exactly.
 * Throws `StoragePathValidationError` on any mismatch, including cross-user-prefix attacks.
 */
export function validateStorageDeletionPrefix({
  userId,
  plantId,
  prefix,
}: {
  userId: string;
  plantId: string;
  prefix: string;
}): void {
  if (!userId) throw new StoragePathValidationError("userId empty");
  if (!plantId) throw new StoragePathValidationError("plantId empty");
  const expected = `${userId}/${plantId}/`;
  if (prefix !== expected) {
    throw new StoragePathValidationError(
      `prefix "${prefix}" does not match expected "${expected}"`,
    );
  }
}
