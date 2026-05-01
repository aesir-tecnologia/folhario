import { afterAll, beforeAll } from "vitest";

import { __setStorageAdapterForTests } from "@contexts/catalog/infrastructure/photo-storage";
import { InMemoryStorageAdapter } from "./in-memory-storage-adapter";

export function useInMemoryStorageAdapter(): { getAdapter(): InMemoryStorageAdapter } {
  let adapter: InMemoryStorageAdapter;

  beforeAll(() => {
    adapter = new InMemoryStorageAdapter();
    __setStorageAdapterForTests(adapter);
  });

  afterAll(() => {
    adapter.clear();
    __setStorageAdapterForTests(null);
  });

  return {
    getAdapter(): InMemoryStorageAdapter {
      return adapter;
    },
  };
}
