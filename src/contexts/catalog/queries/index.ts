import type { QueryFunction } from "@tanstack/react-query";

export type PlantsListSort = "date_new" | "date_old" | "name_asc" | "name_desc" | "location";

export type PlantsListParams = {
  sort: PlantsListSort;
  cursor?: string;
};

async function fetchPlantsList(params: PlantsListParams): Promise<unknown> {
  const sp = new URLSearchParams();
  sp.set("sort", params.sort);
  if (params.cursor) sp.set("cursor", params.cursor);
  const r = await fetch(`/api/v1/plants?${sp.toString()}`);
  if (!r.ok) throw new Error(`plants list failed: ${r.status}`);
  return r.json();
}

async function fetchPlantDetail(plantId: string): Promise<unknown> {
  const r = await fetch(`/api/v1/plants/${plantId}`);
  if (!r.ok) throw new Error(`plant detail failed: ${r.status}`);
  return r.json();
}

async function fetchPhotoEntries(plantId: string): Promise<unknown> {
  const r = await fetch(`/api/v1/plants/${plantId}/photo-entries`);
  if (!r.ok) throw new Error(`photo entries failed: ${r.status}`);
  return r.json();
}

async function fetchLocations(): Promise<unknown> {
  const r = await fetch("/api/v1/locations");
  if (!r.ok) throw new Error(`locations failed: ${r.status}`);
  return r.json();
}

export const plantsKeys = {
  all: () => ["catalog", "plants"] as const,
  lists: (params: PlantsListParams) =>
    ({
      queryKey: ["catalog", "plants", "list", params] as const,
      queryFn: (() => fetchPlantsList(params)) as QueryFunction<unknown>,
      staleTime: 30_000,
    }) as const,
  detail: (plantId: string) =>
    ({
      queryKey: ["catalog", "plant", plantId] as const,
      queryFn: (() => fetchPlantDetail(plantId)) as QueryFunction<unknown>,
      staleTime: 60_000,
    }) as const,
  photoEntries: (plantId: string) =>
    ({
      queryKey: ["catalog", "photo-entries", plantId] as const,
      queryFn: (() => fetchPhotoEntries(plantId)) as QueryFunction<unknown>,
      staleTime: 60_000,
    }) as const,
};

export const locationsKeys = {
  all: () =>
    ({
      queryKey: ["catalog", "locations"] as const,
      queryFn: (() => fetchLocations()) as QueryFunction<unknown>,
      staleTime: 5 * 60_000,
    }) as const,
};
