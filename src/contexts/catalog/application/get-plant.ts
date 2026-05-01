import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";
import { signCatalogPhotoUrl } from "@contexts/catalog/infrastructure/photo-storage";

export interface GetPlantInput {
  userId: string;
  plantId: string;
}

export type GetPlantResult =
  | {
      ok: true;
      plant: PlantRow;
      coverSignedUrl: string | null;
      _meta: { photoEntryCount: number; reminderCount: number };
    }
  | {
      ok: false;
      code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed;
      reason: string;
    };

export async function getPlant(input: GetPlantInput): Promise<GetPlantResult> {
  // T-05-07-02: returns not_found (not forbidden) to avoid existence disclosure.
  const plant = await plantsRepo.findByIdForUser(defaultDb, input.userId, input.plantId);
  if (!plant) {
    return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
  }

  // D-07: cascade counts for delete-confirm sheet — ALWAYS included, not gated on query param.
  const counts = await plantsRepo.getCascadeCounts(defaultDb, {
    userId: input.userId,
    plantId: input.plantId,
  });

  // MEDIUM-3: sign single cover URL for the detail view (D-20: 24h TTL).
  let coverSignedUrl: string | null = null;
  if (plant.coverPhotoUrl) {
    const signed = await signCatalogPhotoUrl({
      storedUrl: plant.coverPhotoUrl,
      ttlSeconds: 24 * 3600,
    });
    coverSignedUrl = signed.ok ? signed.signedUrl : null;
  }

  return {
    ok: true,
    plant,
    coverSignedUrl,
    // Explicit camelCase mapping from snake_case repo return (D-07).
    _meta: {
      photoEntryCount: counts.photo_entry_count,
      reminderCount: counts.reminder_count,
    },
  };
}
