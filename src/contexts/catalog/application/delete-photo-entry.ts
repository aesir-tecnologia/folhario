import { eq } from "drizzle-orm";

import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import type { TransactionalDb } from "@shared/db/unit-of-work";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
import * as pendingStorageDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import { photoEntries } from "@contexts/catalog/infrastructure/db/schema";
import {
  validateStorageObjectKey,
  parsePlantPhotoKey,
} from "@contexts/catalog/domain/storage-paths";
import {
  PLANT_PHOTOS_BUCKET,
  PLANT_THUMBNAILS_BUCKET,
  KNOWN_BUCKETS,
} from "@contexts/catalog/infrastructure/photo-storage";

export interface DeletePhotoEntryInput {
  userId: string;
  /** Optional: when omitted, the use-case looks up the photo entry first to derive plantId. */
  plantId?: string;
  photoEntryId: string;
}

export type PostCommitCallback = () => Promise<void>;

export type DeletePhotoEntryResult =
  | { ok: true; postCommit?: PostCommitCallback }
  | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed; reason: string };

/**
 * Parse the stored `{bucket}/{key}` URL, validate the bucket against KNOWN_BUCKETS,
 * and return the parsed components. Returns null for malformed or unknown-bucket URLs,
 * preventing garbage from reaching pending_storage_deletions.
 */
function extractObjectKey(storedUrl: string): { bucket: string; key: string } | null {
  const slash = storedUrl.indexOf("/");
  if (slash <= 0 || slash >= storedUrl.length - 1) return null;
  const bucket = storedUrl.slice(0, slash);
  if (!(KNOWN_BUCKETS as Set<string>).has(bucket)) return null;
  return { bucket, key: storedUrl.slice(slash + 1) };
}


/**
 * Delete a photo entry with same-TX cover auto-promote (D-03) and
 * per-photo pending_storage_deletions row insert (T-05-04-01 mitigation).
 *
 * Steps:
 *  1. Resolve plantId (from input.plantId, or look up via photoEntryId).
 *  2. Ownership check OUTSIDE UoW (plant must belong to userId).
 *  3. UoW TX:
 *     a. Delete the photo entry row.
 *     b. Validate both storage keys (T-05-04-01 second call site).
 *     c. Insert pending_storage_deletions for both buckets.
 *     d. bumpCoverFor — ALWAYS (defensive idempotence; cheap no-op if not cover).
 *  4. No Inngest event (cleanup via pending_storage_deletions reconciler, D-22/D-24).
 *  5. No PostHog event (no telemetry for photo-entry delete).
 *
 * Accepts optional `deps.tx` for caller-owned transaction (HIGH-3). When
 * provided, the use-case does NOT call `withUnitOfWork`. The `ok: true`
 * result's `postCommit` field is `undefined` (no telemetry callback needed).
 *
 * Accepts optional `input.plantId`. When omitted (e.g. route handler has only
 * photoEntryId in the URL), the use-case looks up the photo entry to derive
 * the plantId for the ownership check.
 */
export async function deletePhotoEntry(
  input: DeletePhotoEntryInput,
  deps: { tx?: TransactionalDb } = {},
): Promise<DeletePhotoEntryResult> {
  // Resolve plantId: if caller provides it use it directly; otherwise look up
  // the photo entry to derive the plantId for the ownership check.
  let resolvedPlantId: string;
  if (input.plantId) {
    resolvedPlantId = input.plantId;
  } else {
    const [entryRow] = await defaultDb
      .select({ plantId: photoEntries.plantId })
      .from(photoEntries)
      .where(eq(photoEntries.id, input.photoEntryId))
      .limit(1);
    if (!entryRow) {
      return { ok: false, code: ErrorCode.NotFound, reason: "photo entry not found" };
    }
    resolvedPlantId = entryRow.plantId;
  }

  const owned = await plantsRepo.findByIdForUser(
    defaultDb,
    input.userId,
    resolvedPlantId,
  );
  if (!owned) {
    return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
  }

  type TxResult = { kind: "ok" } | { kind: "not_found" } | { kind: "validation_failed"; reason: string };

  const runInTx = async (tx: TransactionalDb): Promise<TxResult> => {
    const deleted = await photoEntriesRepo.deletePhotoEntry(tx, {
      photoEntryId: input.photoEntryId,
    });
    if (!deleted) {
      return { kind: "not_found" };
    }

    const photoParsed = extractObjectKey(deleted.photoUrl);
    const thumbParsed = extractObjectKey(deleted.thumbnailUrl);
    if (!photoParsed || !thumbParsed) {
      return { kind: "validation_failed", reason: "malformed stored url in photo entry" };
    }
    if (photoParsed.bucket !== PLANT_PHOTOS_BUCKET) {
      return { kind: "validation_failed", reason: "unexpected bucket for photo url" };
    }
    if (thumbParsed.bucket !== PLANT_THUMBNAILS_BUCKET) {
      return { kind: "validation_failed", reason: "unexpected bucket for thumbnail url" };
    }

    const photoPlantId = parsePlantPhotoKey(photoParsed.key, input.userId);
    const thumbPlantId = parsePlantPhotoKey(thumbParsed.key, input.userId);
    if (!photoPlantId || !thumbPlantId) {
      return { kind: "validation_failed", reason: "malformed stored url: cannot extract plantId" };
    }
    validateStorageObjectKey({
      userId: input.userId,
      plantId: photoPlantId,
      key: photoParsed.key,
    });
    validateStorageObjectKey({
      userId: input.userId,
      plantId: thumbPlantId,
      key: thumbParsed.key,
    });

    await pendingStorageDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_PHOTOS_BUCKET,
      prefix: photoParsed.key,
      kind: "object",
    });
    await pendingStorageDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_THUMBNAILS_BUCKET,
      prefix: thumbParsed.key,
      kind: "object",
    });

    await photoEntriesRepo.bumpCoverFor(tx, {
      userId: input.userId,
      plantId: resolvedPlantId,
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

  if (txResult.kind === "validation_failed") {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: txResult.reason,
    };
  }

  return { ok: true };
}
