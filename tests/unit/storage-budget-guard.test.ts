import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

// Will fail (RED) until implementation file exists.
import {
  checkAndEvict,
  getStorageUsageRatio,
} from "@shared/ui/storage-budget-guard";

describe("getStorageUsageRatio", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when navigator.storage.estimate is unavailable; no throw", async () => {
    vi.stubGlobal("navigator", { storage: undefined });
    const result = await getStorageUsageRatio();
    expect(result).toBeNull();
  });

  it("returns 0.5 when mock estimate returns {usage: 50, quota: 100}", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 50, quota: 100 }),
      },
    });
    const result = await getStorageUsageRatio();
    expect(result).toBe(0.5);
  });
});

describe("checkAndEvict", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("is a no-op when ratio is 0.5; evicted === 0", async () => {
    vi.stubGlobal("navigator", {
      storage: {
        estimate: vi.fn().mockResolvedValue({ usage: 50, quota: 100 }),
      },
    });
    const qc = new QueryClient();
    const result = await checkAndEvict(qc);
    expect(result.evicted).toBe(0);
  });

  it("evicts oldest catalog queries (by dataUpdatedAt ASC) when ratio is 0.85", async () => {
    let usage = 85;
    const estimateMock = vi.fn(() => Promise.resolve({ usage, quota: 100 }));
    vi.stubGlobal("navigator", {
      storage: { estimate: estimateMock },
    });

    const qc = new QueryClient();

    // Seed three catalog queries with ascending dataUpdatedAt
    await qc.setQueryData(["catalog", "plants", "list", { sort: "date_new" }], { data: "a" });
    await qc.setQueryData(["catalog", "plant", "uuid-1"], { data: "b" });
    await qc.setQueryData(["catalog", "photo-entries", "uuid-1"], { data: "c" });

    // Simulate that removing each query reduces usage by 10
    // With 3 queries: 85 → 75 → 65 → 55 (drops below 70 = LOW_WATER after 2 removals)
    qc.getQueryCache().subscribe(() => {
      const count = qc.getQueryCache().findAll().filter((q) => q.queryKey[0] === "catalog").length;
      usage = 65 + count * 10;
    });

    const result = await checkAndEvict(qc);
    expect(result.evicted).toBeGreaterThan(0);
    expect(result.ratioAfter).not.toBeNull();
    expect(result.ratioAfter!).toBeLessThan(0.7);
  });

  it("eviction NEVER targets a query whose queryKey[0] !== 'catalog'", async () => {
    let usage = 85;
    const estimateMock = vi.fn(() => Promise.resolve({ usage, quota: 100 }));
    vi.stubGlobal("navigator", {
      storage: { estimate: estimateMock },
    });

    const qc = new QueryClient();
    await qc.setQueryData(["iam", "me"], { email: "test@example.com" });
    await qc.setQueryData(["catalog", "plants", "list", { sort: "date_new" }], { data: "x" });

    qc.getQueryCache().subscribe(() => {
      const count = qc.getQueryCache().findAll().filter((q) => q.queryKey[0] === "catalog").length;
      usage = 60 + count * 10;
    });

    await checkAndEvict(qc);

    // IAM query must still be present
    const iamQuery = qc.getQueryData(["iam", "me"]);
    expect(iamQuery).toBeDefined();
  });

  it("returns safely when typeof navigator === 'undefined' (SSR-safe)", async () => {
    vi.stubGlobal("navigator", undefined);
    const qc = new QueryClient();
    let result: { evicted: number; ratioAfter: number | null } | undefined;
    let threw = false;
    try {
      result = await checkAndEvict(qc);
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    expect(result?.evicted).toBe(0);
    expect(result?.ratioAfter).toBeNull();
  });
});
