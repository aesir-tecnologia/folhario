import type { QueryClient } from "@tanstack/react-query";

const HIGH_WATER = 0.8;
const LOW_WATER = 0.7;

/**
 * Returns the current used/quota ratio, or null when navigator.storage is
 * unavailable (SSR, older browsers). SSR-safe: never throws.
 */
export async function getStorageUsageRatio(): Promise<number | null> {
  if (typeof navigator === "undefined") return null;
  const storage = navigator.storage;
  if (!storage || typeof storage.estimate !== "function") return null;
  try {
    const { usage, quota } = await storage.estimate();
    if (typeof usage !== "number" || typeof quota !== "number" || quota === 0) return null;
    return usage / quota;
  } catch {
    return null;
  }
}

/**
 * If used/quota > 0.8, removes oldest queries from `queryClient` (by
 * dataUpdatedAt ASC) until the ratio drops below 0.7. SSR-safe: no-op when
 * navigator.storage is unavailable.
 *
 * Eviction policy: targets queries whose queryKey is in the persisted
 * allowlist (catalog.*); other queries are left alone.
 */
export async function checkAndEvict(
  queryClient: QueryClient,
): Promise<{ evicted: number; ratioAfter: number | null }> {
  const ratio = await getStorageUsageRatio();
  if (ratio === null) return { evicted: 0, ratioAfter: null };
  if (ratio <= HIGH_WATER) return { evicted: 0, ratioAfter: ratio };

  const cache = queryClient.getQueryCache();
  const candidates = cache
    .findAll()
    .filter((q) => q.queryKey[0] === "catalog")
    .sort((a, b) => a.state.dataUpdatedAt - b.state.dataUpdatedAt);

  let evicted = 0;
  for (const q of candidates) {
    queryClient.removeQueries({ queryKey: q.queryKey, exact: true });
    evicted += 1;
    const next = await getStorageUsageRatio();
    if (next === null || next < LOW_WATER) {
      return { evicted, ratioAfter: next };
    }
  }
  const final = await getStorageUsageRatio();
  return { evicted, ratioAfter: final };
}
