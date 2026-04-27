import { randomUUID } from "node:crypto";

import sharp from "sharp";

import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import { rejectGpsMetadata, rejectOversizeBuffer } from "@shared/images/server-validate";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
import {
  buildPlantPhotoObjectKey,
  buildPlantThumbnailObjectKey,
  deleteSinglePlantPhotoBestEffort,
  PLANT_PHOTOS_BUCKET,
  PLANT_THUMBNAILS_BUCKET,
  uploadOriginalPlantPhoto,
  uploadPlantThumbnail,
} from "@contexts/catalog/infrastructure/photo-storage";
import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";

/**
 * Catalog application use-case: upload a plant photo.
 *
 * Phase 02 Plan 08 — D-27 (server proxy upload route delegates to
 * application code), D-30 (server GPS rejection BEFORE adapter write),
 * D-31 (synchronous thumbnail via sharp), INFRA-19, T-02-20 / T-02-22 /
 * T-02-39.
 *
 * Steps in order:
 *
 *   1. MIME validation (only `image/jpeg`, `image/png`, `image/webp`).
 *   2. Size validation against the shared `MAX_UPLOAD_BYTES` constant —
 *      no byte literal lives in this file.
 *   3. GPS rejection via `rejectGpsMetadata` (uses exifr).
 *   4. Plant ownership check (the user must own the target plant).
 *   5. Sharp generates a thumbnail synchronously.
 *   6. Storage adapter uploads original then thumbnail (D-26 path shape).
 *   7. UoW (RLS GUC bound to the user's id) inserts the PhotoEntry row.
 *
 * Returns a discriminated-union `UploadPhotoResult` mirroring the
 * `ParseResult`/`ApiUserResult` patterns from prior plans — routes map
 * non-ok results directly to `errorResponse(...)`.
 */

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);
type AllowedMime = "image/jpeg" | "image/png" | "image/webp";

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME_TYPES as Set<string>).has(value);
}

function extFromMime(mime: AllowedMime): "jpg" | "png" | "webp" {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default: {
      const _exhaustive: never = mime;
      throw new Error(`extFromMime: unhandled MIME ${String(_exhaustive)}`);
    }
  }
}

const THUMBNAIL_MAX_DIMENSION = 512;
const THUMBNAIL_QUALITY = 80;

export interface UploadPhotoInput {
  userId: string;
  plantId: string;
  buffer: Buffer;
  contentType: string;
  /** Optional caller-supplied photo id; defaults to a new UUID. */
  photoId?: string;
  /** Optional note to attach to the PhotoEntry row. */
  note?: string | null;
}

export type UploadPhotoResult =
  | { ok: true; photoEntry: PhotoEntryRow }
  | {
      ok: false;
      code:
        | typeof ErrorCode.ValidationFailed
        | typeof ErrorCode.NotFound
        | typeof ErrorCode.Unauthenticated;
      reason: string;
    };

export async function uploadPhoto(input: UploadPhotoInput): Promise<UploadPhotoResult> {
  // (1) MIME validation.
  if (!isAllowedMime(input.contentType)) {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: `unsupported content type: ${input.contentType}`,
    };
  }
  const mime: AllowedMime = input.contentType;

  // (2) Size validation — uses shared MAX_UPLOAD_BYTES; no byte literal.
  const sizeCheck = rejectOversizeBuffer(input.buffer);
  if (!sizeCheck.ok) {
    return {
      ok: false,
      code: sizeCheck.code,
      reason: sizeCheck.reason,
    };
  }

  // (3) GPS rejection — defense in depth; the client should have stripped
  // EXIF, but a malicious / older client could still attach coordinates.
  const gpsCheck = await rejectGpsMetadata(input.buffer);
  if (!gpsCheck.ok) {
    return {
      ok: false,
      code: gpsCheck.code,
      reason: gpsCheck.reason,
    };
  }

  // (4) Plant ownership — user must own the plant. We check OUTSIDE the
  // UoW so an unowned plant short-circuits before opening a transaction.
  const plantRow = await plantsRepo.findByIdForUser(defaultDb, input.userId, input.plantId);
  if (!plantRow) {
    return {
      ok: false,
      code: ErrorCode.NotFound,
      reason: "plant not found",
    };
  }

  // (5) Thumbnail via sharp — synchronously, in the same request (D-31).
  // Always emit JPEG for thumbnails so the bucket cap stays small.
  let thumbnailBuffer: Buffer;
  try {
    thumbnailBuffer = await sharp(input.buffer)
      .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer();
  } catch (error) {
    const reason =
      error instanceof Error
        ? `thumbnail generation failed: ${error.message}`
        : "thumbnail generation failed";
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason,
    };
  }

  const photoId = input.photoId ?? randomUUID();
  const ext = extFromMime(mime);

  // (6) Upload original then thumbnail — original first so a thumbnail
  // failure leaves the user's bytes safe and the database write never
  // happens (atomicity-by-not-writing).
  const originalKey = buildPlantPhotoObjectKey({
    userId: input.userId,
    plantId: input.plantId,
    photoId,
    ext,
  });
  await uploadOriginalPlantPhoto({
    userId: input.userId,
    plantId: input.plantId,
    photoId,
    ext,
    buffer: input.buffer,
    contentType: mime,
  });
  const thumbnailKey = buildPlantThumbnailObjectKey({
    userId: input.userId,
    plantId: input.plantId,
    photoId,
    ext: "jpg",
  });
  await uploadPlantThumbnail({
    userId: input.userId,
    plantId: input.plantId,
    photoId,
    ext: "jpg",
    buffer: thumbnailBuffer,
    contentType: "image/jpeg",
  });

  // (7) Insert PhotoEntry row inside a UoW so the RLS GUC is bound to the
  // user's id. The photoUrl/thumbnailUrl columns store the bucket-prefixed
  // path (`{bucket}/{objectKey}`), not a signed URL — signing happens at
  // read time so URLs do not expire in the database row.
  //
  // CR-03 mitigation: storage uploads (step 6) committed bytes to two
  // buckets BEFORE the DB row exists. If this insert fails (RLS denial,
  // FK race on plant deletion, transient connection drop, etc.), the
  // bytes would be unreachable orphans — `deleteAllPlantMediaForUser`
  // can't find them because the DB has no record they were uploaded.
  // Wrap the UoW in a try/catch and issue best-effort compensating
  // deletes on failure before rethrowing.
  let photoEntry: PhotoEntryRow;
  try {
    photoEntry = await withUnitOfWork(input.userId, async (tx) =>
      photoEntriesRepo.create(tx, {
        id: photoId,
        plantId: input.plantId,
        photoUrl: `${PLANT_PHOTOS_BUCKET}/${originalKey}`,
        thumbnailUrl: `${PLANT_THUMBNAILS_BUCKET}/${thumbnailKey}`,
        note: input.note ?? null,
      }),
    );
  } catch (err) {
    await deleteSinglePlantPhotoBestEffort({
      userId: input.userId,
      plantId: input.plantId,
      photoId,
      originalExt: ext,
    });
    throw err;
  }

  return { ok: true, photoEntry };
}
