import { describe, expect, it } from "vitest";
import type { Query } from "@tanstack/react-query";

// shouldPersist lives in query-provider — will fail (RED) until implementation.
import { shouldPersist } from "@shared/ui/query-provider";

function makeQuery(
  queryKey: unknown[],
  status: "success" | "pending" | "error" = "success",
): Query {
  return {
    queryKey,
    state: {
      status,
      data: status === "success" ? {} : undefined,
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

describe("shouldPersist allowlist filter", () => {
  it("query with ['catalog','plants','list',{sort:'date_new'}] MUST persist", () => {
    const q = makeQuery(["catalog", "plants", "list", { sort: "date_new" }]);
    expect(shouldPersist(q)).toBe(true);
  });

  it("query with ['catalog','plant','some-uuid'] MUST persist", () => {
    const q = makeQuery(["catalog", "plant", "some-uuid"]);
    expect(shouldPersist(q)).toBe(true);
  });

  it("query with ['catalog','photo-entries','plant-id'] MUST persist", () => {
    const q = makeQuery(["catalog", "photo-entries", "plant-id"]);
    expect(shouldPersist(q)).toBe(true);
  });

  it("query with ['catalog','locations'] MUST persist", () => {
    const q = makeQuery(["catalog", "locations"]);
    expect(shouldPersist(q)).toBe(true);
  });

  it("query with ['identification','recent'] MUST NOT persist", () => {
    const q = makeQuery(["identification", "recent"]);
    expect(shouldPersist(q)).toBe(false);
  });

  it("query with ['iam','me'] MUST NOT persist", () => {
    const q = makeQuery(["iam", "me"]);
    expect(shouldPersist(q)).toBe(false);
  });

  it("query with ['catalog'] only (without subkey) MUST NOT persist", () => {
    const q = makeQuery(["catalog"]);
    expect(shouldPersist(q)).toBe(false);
  });

  it("query in pending state MUST NOT persist (delegates to defaultShouldDehydrateQuery)", () => {
    const q = makeQuery(["catalog", "plants", "list", { sort: "date_new" }], "pending");
    expect(shouldPersist(q)).toBe(false);
  });
});
