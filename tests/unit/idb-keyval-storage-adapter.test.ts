import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { IDBFactory } from "fake-indexeddb";

// The adapter lives in query-provider — import after fake-indexeddb is registered.
// This import will fail (RED) until the implementation file exists.
import { idbStorage } from "@shared/ui/query-provider";

beforeEach(() => {
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});

describe("idbStorage AsyncStorage adapter (idb-keyval bridge)", () => {
  it("getItem on missing key returns null (NOT undefined)", async () => {
    const result = await idbStorage.getItem("does-not-exist");
    expect(result).toBeNull();
  });

  it("setItem then getItem round-trips a string verbatim", async () => {
    const value = JSON.stringify({ test: "data", count: 42 });
    await idbStorage.setItem("round-trip-key", value);
    const result = await idbStorage.getItem("round-trip-key");
    expect(result).toBe(value);
  });

  it("setItem then removeItem then getItem returns null", async () => {
    await idbStorage.setItem("remove-me", "some-value");
    await idbStorage.removeItem("remove-me");
    const result = await idbStorage.getItem("remove-me");
    expect(result).toBeNull();
  });

  it("distinct keys are independent — removing one leaves the other intact", async () => {
    await idbStorage.setItem("key-a", "value-a");
    await idbStorage.setItem("key-b", "value-b");
    await idbStorage.removeItem("key-a");
    const resultA = await idbStorage.getItem("key-a");
    const resultB = await idbStorage.getItem("key-b");
    expect(resultA).toBeNull();
    expect(resultB).toBe("value-b");
  });
});
