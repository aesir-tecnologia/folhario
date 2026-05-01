// Phase 5 D-25: fake-indexeddb registration for Vitest unit-dom project.
// Imports the side-effect "auto" entry which registers global indexedDB,
// IDBKeyRange, IDBFactory, etc. Per-test reset via `new IDBFactory()`
// ensures full isolation between tests (RESEARCH §Pattern 8).
import "fake-indexeddb/auto";
import { beforeEach } from "vitest";

beforeEach(() => {
  // Replace the global indexedDB with a fresh factory per-test.
  // `new IDBFactory()` is exposed by fake-indexeddb's auto registration.
  (globalThis as unknown as { indexedDB: IDBFactory }).indexedDB = new IDBFactory();
});
