import type { identifications } from "@contexts/identification/infrastructure/db/schema";

type IdentificationRow = typeof identifications.$inferSelect;

export type IdentificationResultItem = {
  speciesName: string;
  scientificName: string;
  confidence: number;
  providerSpeciesId: string;
};

export type IdentificationSnakeCase = {
  id: string;
  user_id: string;
  plant_id: string | null;
  photo_urls: string[];
  provider: string;
  model: string;
  results: IdentificationResultItem[];
  selected_result: IdentificationResultItem | null;
  manual_correction: string | null;
  latency_ms: number;
  consent_version: string;
  status: "success" | "failed";
  failure_reason: string | null;
  created_at: string;
};

export type IdentificationHistoryItemSnakeCase = IdentificationSnakeCase & {
  thumbnail_signed_url: string | null;
  plant_name: string | null;
};

export function toIdentificationSnakeCase(row: IdentificationRow): IdentificationSnakeCase {
  return {
    id: row.id,
    user_id: row.userId,
    plant_id: row.plantId ?? null,
    photo_urls: row.photoUrls,
    provider: row.provider,
    model: row.model,
    results: (row.results as IdentificationResultItem[]) ?? [],
    selected_result: (row.selectedResult as IdentificationResultItem | null) ?? null,
    manual_correction: row.manualCorrection ?? null,
    latency_ms: row.latencyMs,
    consent_version: row.consentVersion,
    status: row.status,
    failure_reason: row.failureReason ?? null,
    created_at: row.createdAt,
  };
}

export function toIdentificationHistoryItemSnakeCase(
  row: IdentificationRow,
  thumbnailSignedUrl: string | null,
  plantName: string | null,
): IdentificationHistoryItemSnakeCase {
  return {
    ...toIdentificationSnakeCase(row),
    thumbnail_signed_url: thumbnailSignedUrl,
    plant_name: plantName,
  };
}
