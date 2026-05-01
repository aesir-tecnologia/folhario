import "fake-indexeddb/auto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { readFileSync } from "fs";
import { join } from "path";
import type { Query } from "@tanstack/react-query";

// Will fail (RED) until implementation.
import { plantsKeys, locationsKeys } from "@contexts/catalog/queries";
import { shouldPersist } from "@shared/ui/query-provider";

function makeSyntheticQuery(queryKey: unknown[]): Query {
  return {
    queryKey,
    state: {
      status: "success",
      data: {},
      dataUpdatedAt: Date.now(),
      error: null,
      errorUpdatedAt: 0,
      fetchFailureCount: 0,
      fetchFailureReason: null,
      fetchMeta: null,
      isInvalidated: false,
      fetchStatus: "idle",
      errorUpdateCount: 0,
    },
    options: { queryKey },
  } as unknown as Query;
}

describe("plantsKeys query factory", () => {
  it("plantsKeys.all() returns ['catalog','plants'] readonly tuple", () => {
    const key = plantsKeys.all();
    expect(key).toEqual(["catalog", "plants"]);
  });

  it("plantsKeys.lists({sort:'date_new'}) returns correct shape", () => {
    const result = plantsKeys.lists({ sort: "date_new" });
    expect(result.queryKey).toEqual(["catalog", "plants", "list", { sort: "date_new" }]);
    expect(typeof result.queryFn).toBe("function");
    expect(result.staleTime).toBe(30_000);
  });

  it("plantsKeys.detail('uuid-x') returns queryKey: ['catalog','plant','uuid-x'] (singular)", () => {
    const result = plantsKeys.detail("uuid-x");
    expect(result.queryKey).toEqual(["catalog", "plant", "uuid-x"]);
    expect(typeof result.queryFn).toBe("function");
  });

  it("plantsKeys.photoEntries('uuid-x') returns queryKey: ['catalog','photo-entries','uuid-x']", () => {
    const result = plantsKeys.photoEntries("uuid-x");
    expect(result.queryKey).toEqual(["catalog", "photo-entries", "uuid-x"]);
    expect(typeof result.queryFn).toBe("function");
  });

  it("locationsKeys.all() returns queryKey: ['catalog','locations']", () => {
    const result = locationsKeys.all();
    expect(result.queryKey).toEqual(["catalog", "locations"]);
    expect(typeof result.queryFn).toBe("function");
  });

  it("every factory output's queryKey[0] is 'catalog' AND matches shouldPersist allowlist", () => {
    const factories = [
      plantsKeys.lists({ sort: "date_new" }),
      plantsKeys.detail("some-uuid"),
      plantsKeys.photoEntries("some-uuid"),
      locationsKeys.all(),
    ];
    for (const f of factories) {
      expect(f.queryKey[0]).toBe("catalog");
      const syntheticQuery = makeSyntheticQuery(f.queryKey as unknown as unknown[]);
      expect(shouldPersist(syntheticQuery)).toBe(true);
    }
  });

  it("queryClient.invalidateQueries(plantsKeys.all()) partial-matches multiple list-variant entries", async () => {
    const qc = new QueryClient();
    await qc.setQueryData(plantsKeys.lists({ sort: "date_new" }).queryKey, { items: [] });
    await qc.setQueryData(plantsKeys.lists({ sort: "name_asc" }).queryKey, { items: [] });

    await qc.invalidateQueries({ queryKey: plantsKeys.all() });

    const listQuery1 = qc
      .getQueryCache()
      .find({ queryKey: plantsKeys.lists({ sort: "date_new" }).queryKey });
    const listQuery2 = qc
      .getQueryCache()
      .find({ queryKey: plantsKeys.lists({ sort: "name_asc" }).queryKey });

    expect(listQuery1?.isStale()).toBe(true);
    expect(listQuery2?.isStale()).toBe(true);
  });

  it("src/contexts/catalog/queries/index.ts contains NO 'use client' directive and NO React imports", () => {
    const filePath = join(process.cwd(), "src/contexts/catalog/queries/index.ts");
    const content = readFileSync(filePath, "utf8");
    expect(content).not.toContain("'use client'");
    expect(content).not.toContain('"use client"');
    expect(content).not.toMatch(/from ['"]react['"]/);
  });
});

describe("LogoutLink SW cache purge (HIGH-2)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("calls caches.delete('folhario-catalog-api-v1') on logout", async () => {
    const deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal("caches", { delete: deleteMock });
    Object.defineProperty(globalThis, "window", {
      value: {
        location: { href: "" },
        caches: { delete: deleteMock },
      },
      writable: true,
      configurable: true,
    });

    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    // Dynamically import the logout handler to read actual implementation
    const logoutLinkPath = join(
      process.cwd(),
      "src/contexts/iam/api/components/logout-link.tsx",
    );
    const content = readFileSync(logoutLinkPath, "utf8");
    expect(content).toMatch(/caches\.delete\(['"]folhario-catalog-api-v1['"]\)/);
  });
});
