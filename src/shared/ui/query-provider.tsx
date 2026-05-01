"use client";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
  type Query,
} from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createAsyncStoragePersister } from "@tanstack/query-async-storage-persister";
import { get, set, del } from "idb-keyval";

import { checkAndEvict } from "./storage-budget-guard";

export type QueryProviderProps = {
  /**
   * Authenticated user id (from (app)/layout.tsx after the verified-user gate).
   * Hashed via SHA-256 and combined with the deploy SHA into the persister
   * `buster` so a different user on a shared device cannot rehydrate the
   * previous user's catalog cache (T-05-10-01).
   */
  userId: string;
  children: ReactNode;
};

const ALLOWED_PREFIXES: readonly (readonly string[])[] = [
  ["catalog", "plants"],
  ["catalog", "plant"],
  ["catalog", "photo-entries"],
  ["catalog", "locations"],
] as const;

export function shouldPersist(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  const key = query.queryKey;
  return ALLOWED_PREFIXES.some((prefix) =>
    prefix.every((part, i) => key[i] === part),
  );
}

export const idbStorage = {
  getItem: async (k: string): Promise<string | null> =>
    (await get<string>(k)) ?? null,
  setItem: async (k: string, v: string): Promise<unknown> => set(k, v),
  removeItem: async (k: string): Promise<void> => del(k),
};

async function hashUserId(userId: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) return userId.slice(0, 12);
  const buf = new TextEncoder().encode(userId);
  const out = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(out).slice(0, 6))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function QueryProvider({ userId, children }: QueryProviderProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, gcTime: 24 * 60 * 60 * 1000 },
        },
      }),
  );

  // Starts as "init" — flips to "${deploySha}.${userIdHash}" after useEffect resolves.
  // This is intentional: buster is set asynchronously to avoid blocking render.
  const [buster, setBuster] = useState<string>("init");
  useEffect(() => {
    const sha = process.env.NEXT_PUBLIC_DEPLOY_SHA ?? "dev";
    hashUserId(userId).then((h) => setBuster(`${sha}.${h}`));
  }, [userId]);

  const persister = useMemo(
    () =>
      createAsyncStoragePersister({
        storage: idbStorage,
        key: "folhario.query-cache",
        throttleTime: 1000,
      }),
    [],
  );

  // Storage budget guard: run on mount + every 60s (Pitfall 7).
  useEffect(() => {
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      checkAndEvict(queryClient).catch(() => {});
    };
    run();
    const t = setInterval(run, 60_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [queryClient]);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 24 * 60 * 60 * 1000,
        buster,
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
