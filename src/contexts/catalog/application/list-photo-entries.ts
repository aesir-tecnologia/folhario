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
      items: (Omit<PhotoEntryRow, "thumbnailUrl"> & { thumbnailUrl: string })[];
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
      const signed = await signCatalogPhotoUrl({
        storedUrl: row.thumbnailUrl,
        ttlSeconds: SIGN_TTL_SECONDS,
      });
      return {
        ...row,
        thumbnailUrl: signed.ok ? signed.signedUrl : row.thumbnailUrl,
      };
    }),
  );

  return { ok: true, items };
}
