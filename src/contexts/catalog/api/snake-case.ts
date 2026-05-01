import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";
import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";

/**
 * Phase-5 D-02 / PRD §5 — snake_case response mappers for catalog route handlers.
 *
 * All /api/v1/* routes return snake_case JSON per PRD §5. These helpers
 * convert camelCase DB row types to the correct response shape. No logic
 * beyond key renaming; validation and business rules belong in use-cases.
 */

export type PlantSnakeCase = {
  id: string;
  user_id: string;
  species_id: string | null;
  name: string;
  nickname: string | null;
  location: string | null;
  acquisition_date: string | null;
  notes: string | null;
  cover_photo_url: string | null;
  created_at: string;
  updated_at: string;
};

export function toPlantSnakeCase(row: PlantRow): PlantSnakeCase {
  return {
    id: row.id,
    user_id: row.userId,
    species_id: row.speciesId ?? null,
    name: row.name,
    nickname: row.nickname ?? null,
    location: row.location ?? null,
    acquisition_date: row.acquisitionDate ?? null,
    notes: row.notes ?? null,
    cover_photo_url: row.coverPhotoUrl ?? null,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

export type PlantWithSignedUrlSnakeCase = PlantSnakeCase & {
  cover_signed_url: string | null;
};

export function toPlantWithSignedUrlSnakeCase(
  row: PlantRow & { coverSignedUrl: string | null },
): PlantWithSignedUrlSnakeCase {
  return {
    ...toPlantSnakeCase(row),
    cover_signed_url: row.coverSignedUrl,
  };
}

export type PhotoEntrySnakeCase = {
  id: string;
  plant_id: string;
  photo_url: string;
  thumbnail_url: string;
  note: string | null;
  created_at: string;
};

export function toPhotoEntrySnakeCase(row: PhotoEntryRow): PhotoEntrySnakeCase {
  return {
    id: row.id,
    plant_id: row.plantId,
    photo_url: row.photoUrl,
    thumbnail_url: row.thumbnailUrl,
    note: row.note ?? null,
    created_at: row.createdAt,
  };
}

export type LocationSnakeCase = {
  label_display: string;
};
