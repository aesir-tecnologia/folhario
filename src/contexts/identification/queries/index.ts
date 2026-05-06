import type { QueryFunction } from "@tanstack/react-query";

import type {
  IdentificationSnakeCase,
  IdentificationHistoryItemSnakeCase,
} from "@contexts/identification/api/snake-case";

export type IdentificationsListParams = {
  plantId?: string;
  cursor?: string;
  limit?: number;
};

export type IdentificationsListResponse = {
  items: IdentificationHistoryItemSnakeCase[];
  next_cursor: string | null;
  total_count?: number;
};

export type IdentificationDetailResponse = {
  item: IdentificationSnakeCase;
};

async function fetchIdentificationHistory(
  params: IdentificationsListParams,
): Promise<IdentificationsListResponse> {
  const sp = new URLSearchParams();
  if (params.plantId) sp.set("plantId", params.plantId);
  if (params.cursor) sp.set("cursor", params.cursor);
  if (params.limit !== undefined) sp.set("limit", String(params.limit));
  const r = await fetch(`/api/v1/identifications?${sp.toString()}`, {
    credentials: "same-origin",
  });
  if (!r.ok) throw new Error(`identifications list failed: ${r.status}`);
  return r.json() as Promise<IdentificationsListResponse>;
}

/**
 * Detail fetcher is wired forward — actual GET-by-id route lands post-phase-6
 * if needed; the modal in IdentificationHistoryItem (UI-SPEC line 449) renders
 * from the list-row data. This stub ensures the factory's .detail() entry is
 * type-complete while failing loudly if accidentally called.
 */
async function fetchIdentificationDetail(
  _identificationId: string,
): Promise<IdentificationDetailResponse> {
  throw new Error("not implemented in phase 6");
}

export const identificationKeys = {
  all: () => ["identification", "history"] as const,
  history: (params: IdentificationsListParams) =>
    ({
      queryKey: ["identification", "history", params] as const,
      queryFn: (() =>
        fetchIdentificationHistory(params)) as QueryFunction<IdentificationsListResponse>,
      staleTime: 30_000,
    }) as const,
  detail: (identificationId: string) =>
    ({
      queryKey: ["identification", "detail", identificationId] as const,
      queryFn: (() =>
        fetchIdentificationDetail(identificationId)) as QueryFunction<IdentificationDetailResponse>,
      staleTime: 60_000,
    }) as const,
};
