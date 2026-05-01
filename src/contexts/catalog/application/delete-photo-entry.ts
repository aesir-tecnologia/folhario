import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import type { TransactionalDb } from "@shared/db/unit-of-work";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
import * as pendingStorageDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import { validateStorageObjectKey } from "@contexts/catalog/domain/storage-paths";
import {
  PLANT_PHOTOS_BUCKET,
  PLANT_THUMBNAILS_BUCKET,
} from "@contexts/catalog/infrastructure/photo-storage";

export interface DeletePhotoEntryInput {
  userId: string;
  plantId: string;
  photoEntryId: string;
}

export type PostCommitCallback = () => Promise<void>;

export type DeletePhotoEntryResult =
  | { ok: true; postCommit?: PostCommitCallback }
  | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed; reason: string };

/**
 * Parse the stored `{bucket}/{key}` URL and return the bucket-relative key.
 * Mirrors signCatalogPhotoUrl's parser but returns the raw key for ownership validation.
 */
function extractObjectKey(storedUrl: string): string | null {
  const slash = storedUrl.indexOf("/");
  if (slash <= 0 || slash >= storedUrl.length - 1) return null;
  return storedUrl.slice(slash + 1);
}

/**
 * Extract the plantId from a bucket-relative key with the shape
 * `{userId}/{plantId}/{photoId}.{ext}`.
 * Returns the plantId segment or null if the key does not match the pattern.
 *
 * T-05-04-01: when a photo entry is validated via validateStorageObjectKey,
 * we use the plantId embedded in the stored URL (the original upload plant)
 * rather than `input.plantId`. This handles the edge case where a photo entry
 * has been administratively re-linked to a different plant while preserving
 * the ownership check on `userId`.
 */
function extractPlantIdFromKey(key: string, userId: string): string | null {
  const prefix = `${userId}/`;
  if (!key.startsWith(prefix)) return null;
  const rest = key.slice(prefix.length);
  const nextSlash = rest.indexOf("/");
  if (nextSlash <= 0) return null;
  return rest.slice(0, nextSlash);
}

/**
 * Delete a photo entry with same-TX cover auto-promote (D-03) and
 * per-photo pending_storage_deletions row insert (T-05-04-01 mitigation).
 *
 * Steps:
 *  1. Ownership check OUTSIDE UoW (plant must belong to userId).
 *  2. UoW TX:
 *     a. Delete the photo entry row.
 *     b. Validate both storage keys (T-05-04-01 second call site).
 *     c. Insert pending_storage_deletions for both buckets.
 *     d. bumpCoverFor — ALWAYS (defensive idempotence; cheap no-op if not cover).
 *  3. No Inngest event (cleanup via pending_storage_deletions reconciler, D-22/D-24).
 *  4. No PostHog event (no telemetry for photo-entry delete).
 *
 * Accepts optional `deps.tx` for caller-owned transaction (HIGH-3). When
 * provided, the use-case does NOT call `withUnitOfWork`. The `ok: true`
 * result's `postCommit` field is `undefined` (no telemetry callback needed).
 */
export async function deletePhotoEntry(
  input: DeletePhotoEntryInput,
  deps: { tx?: TransactionalDb } = {},
): Promise<DeletePhotoEntryResult> {
  const owned = await plantsRepo.findByIdForUser(
    defaultDb,
    input.userId,
    input.plantId,
  );
  if (!owned) {
    return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
  }

  type TxResult = { kind: "ok" } | { kind: "not_found" };

  const runInTx = async (tx: TransactionalDb): Promise<TxResult> => {
    const deleted = await photoEntriesRepo.deletePhotoEntry(tx, {
      photoEntryId: input.photoEntryId,
    });
    if (!deleted) {
      return { kind: "not_found" };
    }

    const photoKey = extractObjectKey(deleted.photoUrl);
    const thumbKey = extractObjectKey(deleted.thumbnailUrl);
    if (!photoKey || !thumbKey) {
      throw new Error("malformed stored url in photo entry");
    }

    const photoPlantId = extractPlantIdFromKey(photoKey, input.userId);
    const thumbPlantId = extractPlantIdFromKey(thumbKey, input.userId);
    if (!photoPlantId || !thumbPlantId) {
      throw new Error("malformed stored url: cannot extract plantId");
    }
    validateStorageObjectKey({
      userId: input.userId,
      plantId: photoPlantId,
      key: photoKey,
    });
    validateStorageObjectKey({
      userId: input.userId,
      plantId: thumbPlantId,
      key: thumbKey,
    });

    await pendingStorageDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_PHOTOS_BUCKET,
      prefix: photoKey,
    });
    await pendingStorageDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_THUMBNAILS_BUCKET,
      prefix: thumbKey,
    });

    await photoEntriesRepo.bumpCoverFor(tx, {
      userId: input.userId,
      plantId: input.plantId,
    });

    return { kind: "ok" };
  };

  const txResult = deps.tx
    ? await runInTx(deps.tx)
    : await withUnitOfWork(input.userId, runInTx);

  if (txResult.kind === "not_found") {
    return {
      ok: false,
      code: ErrorCode.NotFound,
      reason: "photo entry not found",
    };
  }

  return { ok: true };
}
