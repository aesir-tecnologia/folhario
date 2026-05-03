"use client";

import { useState, useEffect } from "react";

export const SORT_IDS = ["name_asc", "name_desc", "date_new", "date_old", "location"] as const;
export type SortId = (typeof SORT_IDS)[number];

const STORAGE_KEY = "folhario.catalog.sort";

function readStoredSort(): SortId {
  if (typeof window === "undefined") return "date_new";
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) return "date_new";
    if ((SORT_IDS as readonly string[]).includes(raw)) return raw as SortId;
    sessionStorage.removeItem(STORAGE_KEY);
    return "date_new";
  } catch {
    return "date_new";
  }
}

export function useSortPreference(): [SortId, (next: SortId) => void] {
  const [sortId, setSortId] = useState<SortId>("date_new");

  useEffect(() => {
    const stored = readStoredSort();
    if (stored !== "date_new") {
      setSortId(stored); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, []);

  function setSort(next: SortId): void {
    sessionStorage.setItem(STORAGE_KEY, next);
    setSortId(next);
  }

  return [sortId, setSort];
}
