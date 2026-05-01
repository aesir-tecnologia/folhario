import { ErrorCode } from "@shared/config/errors";
import { validateStorageObjectKey } from "@contexts/catalog/domain/storage-paths";
import { createPhotoEntryInputSchema } from "@contexts/catalog/domain/schemas";
import * as uploadPhotoModule from "@contexts/catalog/application/upload-photo";
import type { UploadPhotoResult } from "@contexts/catalog/application/upload-photo";
import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";
import { randomUUID } from "node:crypto";

/**
 * Catalog application use-case: add a photo entry to a plant's journal.
 *
 * Phase 05 Plan 07 — D-15 (multipart photo-journal add).
 *
 * Delegates the full upload pipeline (MIME, size, GPS, sharp thumbnail, two
 * storage writes, UoW insert) to `uploadPhoto` from `upload-photo.ts`
 * (single source of truth). This wrapper is responsible only for:
 *   1. Validating the canonical D-26 object key BEFORE the storage write
 *      (T-05-04-01 first call site — belt-and-braces against future callers
 *      that might supply a caller-controlled photoId).
 *   2. Mapping the input shape to `UploadPhotoInput`.
 *
 * NOTE: `createPhotoEntry` does NOT accept `deps.tx` because `uploadPhoto`
 * opens its own `withUnitOfWork` and the compensating-delete on TX failure
 * (CR-03) is tightly coupled to that same UoW boundary. Refactoring
 * `uploadPhoto` to accept an outer tx is out of scope for Phase 5.
 */

export interface CreatePhotoEntryInput {
  userId: string;
  plantId: string;
  buffer: Buffer;
  contentType: string;
  note: string | null;
}

export type CreatePhotoEntryResult =
  | { ok: true; photoEntry: PhotoEntryRow }
  | {
      ok: false;
      code:
        | typeof ErrorCode.ValidationFailed
        | typeof ErrorCode.NotFound
        | typeof ErrorCode.Unauthenticated;
      reason: string;
    };

export async function createPhotoEntry(
  input: CreatePhotoEntryInput,
): Promise<CreatePhotoEntryResult> {
  const schemaResult = createPhotoEntryInputSchema.safeParse({
    contentType: input.contentType,
    byteLength: input.buffer.byteLength,
    note: input.note,
  });
  if (!schemaResult.success) {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: schemaResult.error.message,
    };
  }

  const photoId = randomUUID();
  const ext =
    input.contentType === "image/png"
      ? "png"
      : input.contentType === "image/webp"
        ? "webp"
        : "jpg";
  const key = `${input.userId}/${input.plantId}/${photoId}.${ext}`;

  validateStorageObjectKey({
    userId: input.userId,
    plantId: input.plantId,
    key,
  });

  const result: UploadPhotoResult = await uploadPhotoModule.uploadPhoto({
    userId: input.userId,
    plantId: input.plantId,
    buffer: input.buffer,
    contentType: input.contentType,
    photoId,
    note: input.note,
  });

  return result;
}
