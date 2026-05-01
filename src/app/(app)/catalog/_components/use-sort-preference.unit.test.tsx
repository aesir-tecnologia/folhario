import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

import { useSortPreference, SORT_IDS, type SortId } from "./use-sort-preference";

const STORAGE_KEY = "folhario.catalog.sort";

beforeEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("useSortPreference", () => {
  it("Test 1 (default-when-absent): returns 'date_new' when sessionStorage is empty", () => {
    const { result } = renderHook(() => useSortPreference());
    const [sortId] = result.current;
    expect(sortId).toBe("date_new");
  });

  it("Test 2 (round-trip): setter writes to sessionStorage and remounted hook returns updated value", () => {
    const { result, rerender } = renderHook(() => useSortPreference());

    act(() => {
      const [, setSortId] = result.current;
      setSortId("name_asc");
    });

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe("name_asc");

    const { result: remountedResult } = renderHook(() => useSortPreference());
    const [sortId] = remountedResult.current;
    expect(sortId).toBe("name_asc");

    void rerender;
  });

  it("Test 3 (invalid value rejected): bogus sessionStorage value → returns 'date_new' AND clears bad value", () => {
    sessionStorage.setItem(STORAGE_KEY, "bogus_invalid_sort");

    const { result } = renderHook(() => useSortPreference());
    const [sortId] = result.current;

    expect(sortId).toBe("date_new");
    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("Test 4 (SSR-safe): when window is undefined, hook returns 'date_new' without throwing", () => {
    vi.stubGlobal("window", undefined);

    expect(() => {
      const { result } = renderHook(() => useSortPreference());
      const [sortId] = result.current;
      expect(sortId).toBe("date_new");
    }).not.toThrow();
  });

  it("Test 5 (whitelist): SORT_IDS exported as 5-member readonly tuple", () => {
    const expected: SortId[] = ["name_asc", "name_desc", "date_new", "date_old", "location"];
    expect(SORT_IDS).toEqual(expected);
    expect(SORT_IDS).toHaveLength(5);
  });
});
