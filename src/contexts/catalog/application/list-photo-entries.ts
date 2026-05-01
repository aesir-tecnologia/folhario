import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
import { signCatalogPhotoUrl } from "@contexts/catalog/infrastructure/photo-storage";
import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";

const SIGN_TTL_SECONDS = 24 * 3600;

export interface ListPhotoEntriesInput {
  userId: string;
  plantId: string;
}

export type ListPhotoEntriesResult =
  | {
      ok: true;
      items: (Omit<PhotoEntryRow, "thumbnailUrl"> & {
        thumbnailUrl: string;
        photoSignedUrl: string | null;
        thumbnailSignedUrl: string | null;
      })[];
    }
  | { ok: false; code: typeof ErrorCode.NotFound; reason: string };

export async function listPhotoEntries(
  input: ListPhotoEntriesInput,
): Promise<ListPhotoEntriesResult> {
  const owned = await plantsRepo.findByIdForUser(
    defaultDb,
    input.userId,
    input.plantId,
  );
  if (!owned) {
    return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
  }

  const rows = await photoEntriesRepo.list(defaultDb, { plantId: input.plantId });

  // repo orders ASC (oldest-first) for D-03 cover logic. CAT-06 requires
  // reverse-chronological display — reverse without mutating the original.
  const reversed = [...rows].reverse();

  const items = await Promise.all(
    reversed.map(async (row) => {
      const [signedThumb, signedPhoto] = await Promise.all([
        signCatalogPhotoUrl({
          storedUrl: row.thumbnailUrl,
          ttlSeconds: SIGN_TTL_SECONDS,
        }),
        signCatalogPhotoUrl({
          storedUrl: row.photoUrl,
          ttlSeconds: SIGN_TTL_SECONDS,
        }),
      ]);
      return {
        ...row,
        // Phase 5 legacy carry-over: thumbnailUrl is the signed URL on the
        // result row (existing consumers + tests pin this). Phase 6+ should
        // consume thumbnailSignedUrl explicitly. photoUrl is preserved as
        // the raw {bucket}/{key} so delete-photo-entry's extractObjectKey
        // path keeps working when invoked on the DB row.
        thumbnailUrl: signedThumb.ok ? signedThumb.signedUrl : row.thumbnailUrl,
        photoSignedUrl: signedPhoto.ok ? signedPhoto.signedUrl : null,
        thumbnailSignedUrl: signedThumb.ok ? signedThumb.signedUrl : null,
      };
    }),
  );

  return { ok: true, items };
}
