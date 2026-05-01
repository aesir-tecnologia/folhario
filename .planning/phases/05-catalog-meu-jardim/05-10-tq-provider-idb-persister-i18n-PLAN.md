---
phase: 05-catalog-meu-jardim
plan: 10
type: execute
wave: 3
depends_on: []
files_modified:
  - package.json
  - src/shared/ui/query-provider.tsx
  - src/shared/ui/storage-budget-guard.ts
  - src/contexts/catalog/queries/index.ts
  - src/contexts/iam/api/components/logout-link.tsx
  - src/messages/pt-BR.json
  - src/app/(app)/layout.tsx
  - tests/unit/idb-keyval-storage-adapter.test.ts
  - tests/unit/should-persist-query.test.ts
  - tests/unit/storage-budget-guard.test.ts
  - tests/unit/plants-keys.test.ts
autonomous: true
requirements:
  - OFF-08
tags: [tanstack-query, idb-persister, idb-keyval, query-factory, i18n, offline, catalog, tdd]

must_haves:
  truths:
    - "TanStack Query v5, the async-storage persister, the persist-client provider, and idb-keyval are installed as runtime dependencies (no -D flag)"
    - "src/shared/ui/query-provider.tsx is a 'use client' module that mounts <PersistQueryClientProvider> with an idb-keyval-backed AsyncStoragePersister keyed 'folhario.query-cache'"
    - "shouldDehydrateQuery only persists queries whose queryKey begins with one of the four allowlisted prefixes ['catalog','plants'] / ['catalog','plant'] / ['catalog','photo-entries'] / ['catalog','locations']; mutations are excluded"
    - "Persister is configured with maxAge = 24h so stale IDB entries are dropped on rehydration"
    - "Persister buster includes both the deploy SHA and a SHA-256-derived per-user hash so a different user on the same device cannot rehydrate the previous user's catalog cache"
    - "storage-budget-guard.ts exports a checkAndEvict() function that calls navigator.storage.estimate() and removes oldest queries (by dataUpdatedAt) until used/quota drops below 0.7 once it crosses 0.8"
    - "storage-budget-guard.ts is SSR-safe: every navigator-touching code path is gated by typeof navigator !== 'undefined' and resolves to a no-op when navigator is unavailable"
    - "src/contexts/catalog/queries/index.ts is a server-safe pure factory module with NO 'use client' directive and NO React imports; it exports plantsKeys.{all, lists, detail, photoEntries} and locationsKeys.all factories returning {queryKey, queryFn, staleTime}; queryFn uses fetch() which works in both Server Components (Next.js fetch) and client"
    - "src/contexts/catalog/queries/hooks.ts is a 'use client' hook layer that exports usePlants, usePlant, usePhotoEntries, useLocations — each wrapping useQuery(plantsQueryOptions(...)) from index.ts; downstream UI plans import hooks from this file, NOT from index.ts"
    - "Calling queryClient.invalidateQueries({queryKey: plantsKeys.all()}) partial-matches every list-variant + detail + photoEntries entry under 'catalog'"
    - "(app)/layout.tsx mounts <QueryProvider userId={user.id}> after the verified-user gate so unverified visitors never instantiate the cache"
    - "On logout, both the IDB persister (idb-keyval del('folhario.query-cache')) AND the SW API cache are purged BEFORE the redirect: if ('caches' in window) { await Promise.all([caches.delete('folhario-catalog-api-v1')]); } — this prevents cross-user data leakage from the SW runtime cache that 05-18 registers for /api/v1/plants*, /api/v1/photo-entries*, /api/v1/locations"
    - "messages/pt-BR.json catalog.* namespace contains every key UI-SPEC § Copywriting Contract enumerates (header, sort options, empty, manual add + errors, profile fields + delete sheet, photo journal, locations defaults, cross-cutting toasts); existing catalog.empty.hint and catalog.empty.cta are REPLACED with the Phase 5 contract values, not appended"
    - "this plan owns the top-level catalog namespace scaffold in src/messages/pt-BR.json; downstream plans (05-07, 05-08, 05-12) extend leaf keys only — they do NOT introduce new sibling namespaces"

  artifacts:
    - path: "src/shared/ui/query-provider.tsx"
      provides: "Client provider that wraps PersistQueryClientProvider with idb-keyval AsyncStoragePersister, allowlist filter, maxAge 24h, and per-user buster"
      min_lines: 80
      contains: "PersistQueryClientProvider"
    - path: "src/shared/ui/storage-budget-guard.ts"
      provides: "checkAndEvict() helper using navigator.storage.estimate(); SSR-safe; LRU eviction"
      min_lines: 40
      contains: "navigator.storage"
    - path: "src/contexts/catalog/queries/index.ts"
      provides: "Server-safe Tkdodo-style query factories: plantsKeys (all/lists/detail/photoEntries) + locationsKeys.all; NO 'use client' directive; NO React imports; queryFn uses fetch()"
      min_lines: 40
      exports: ["plantsKeys", "locationsKeys"]
    - path: "src/contexts/catalog/queries/hooks.ts"
      provides: "Client-only 'use client' hook layer: usePlants, usePlant, usePhotoEntries, useLocations — each wrapping useQuery() with the corresponding factory from index.ts"
      min_lines: 30
      exports: ["usePlants", "usePlant", "usePhotoEntries", "useLocations"]
    - path: "tests/unit/idb-keyval-storage-adapter.test.ts"
      provides: "Round-trip test for the AsyncStoragePersister-compatible idb-keyval adapter (getItem/setItem/removeItem) using fake-indexeddb"
      min_lines: 30
    - path: "tests/unit/should-persist-query.test.ts"
      provides: "Allowlist filter test: catalog.* prefixes ARE persisted; other queries (e.g. ['identification', ...], ['iam', ...]) are NOT; mutations are excluded"
      min_lines: 30
    - path: "tests/unit/storage-budget-guard.test.ts"
      provides: "navigator.storage.estimate mock: <0.8 returns no-op; >0.8 evicts oldest; SSR (typeof navigator === 'undefined') returns no-op"
      min_lines: 40
    - path: "tests/unit/plants-keys.test.ts"
      provides: "Query factory shape + partial-match invalidation test (plantsKeys.all() partial-matches lists/detail/photoEntries); also asserts caches.delete called with 'folhario-catalog-api-v1' on logout"
      min_lines: 40
    - path: "src/messages/pt-BR.json"
      provides: "catalog.* namespace expanded to cover header/sort/empty/add/profile/journal/locations/readOnly/offline keys per UI-SPEC § Copywriting Contract; canonical i18n namespace owner for phase 5 catalog"
      contains: "\"locations\""
    - path: "package.json"
      provides: "@tanstack/react-query, @tanstack/query-async-storage-persister, @tanstack/react-query-persist-client, idb-keyval as runtime dependencies"
      contains: "@tanstack/react-query"

  key_links:
    - from: "src/app/(app)/layout.tsx"
      to: "src/shared/ui/query-provider.tsx"
      via: "<QueryProvider userId={user.id}> wrapping <AppShell> (after verified-user gate)"
      pattern: "<QueryProvider"
    - from: "src/shared/ui/query-provider.tsx"
      to: "idb-keyval"
      via: "AsyncStoragePersister storage adapter calling get/set/del on key 'folhario.query-cache'"
      pattern: "from \"idb-keyval\""
    - from: "src/shared/ui/query-provider.tsx"
      to: "shouldDehydrateQuery allowlist"
      via: "persistOptions.dehydrateOptions.shouldDehydrateQuery filters by query-key prefix"
      pattern: "shouldDehydrateQuery"
    - from: "src/shared/ui/query-provider.tsx"
      to: "buster string"
      via: "persistOptions.buster = `${deploySha}.${userIdHash}` mitigating T-05-10-01"
      pattern: "buster"
    - from: "src/contexts/iam/api/components/logout-link.tsx"
      to: "idb-keyval del('folhario.query-cache') + caches.delete('folhario-catalog-api-v1')"
      via: "fetch(/api/v1/iam/logout) → del IDB cache → purge SW cache → window.location redirect"
      pattern: "folhario\\.query-cache"
---

<objective>
Ship the **TanStack Query v5 + IndexedDB persister + per-user query factory + i18n catalog namespace** plumbing that makes Phase 5 catalog browsing offline-tolerant (OFF-08, half) and gives later UI plans (05-15..05-18) a stable contract to read against.

Concretely, this plan delivers:

1. **Runtime dependencies installed** — `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `idb-keyval` (deferred from Wave 0 plan 05-01 per the orchestrator's "keep Wave 0 lean" guidance).
2. **`<QueryProvider>` client component** at `src/shared/ui/query-provider.tsx` that wraps `<PersistQueryClientProvider>` with an `idb-keyval`-backed AsyncStoragePersister, an allowlist `shouldDehydrateQuery` filter (D-17), `maxAge: 24h` (Pitfall 1), and a `buster` string composed of `${deploySha}.${userIdHash}` to mitigate cross-user IDB poisoning on shared devices (T-05-10-01).
3. **Storage budget guard** at `src/shared/ui/storage-budget-guard.ts` — SSR-safe LRU eviction triggered when `navigator.storage.estimate()` reports `used/quota > 0.8`, evicting oldest queries until the ratio drops below 0.7 (Pitfall 7).
4. **Tkdodo-style query factory split into two files:**
   - `src/contexts/catalog/queries/index.ts` — server-safe pure factory with NO `'use client'` directive and NO React imports: `plantsKeys.{all, lists, detail, photoEntries}` + `locationsKeys.all` with co-located query keys + `fetch()`-based queryFn + `staleTime` (D-18). Works in both Server Components and client. Wave 4 UI Server Components import `plantsQueryOptions` from this path.
   - `src/contexts/catalog/queries/hooks.ts` — client-only `'use client'` hook layer: `usePlants`, `usePlant`, `usePhotoEntries`, `useLocations` each wrapping `useQuery(plantsQueryOptions(...))` from `index.ts`. Wave 4 client components import hooks from this path.
5. **Mount `<QueryProvider>` inside `(app)/layout.tsx`** AFTER the verified-user gate (D-16, RESEARCH § "Wired in a client `<QueryProvider>` mounted inside `(app)/layout.tsx` after the auth gate"). Unverified visitors never instantiate the cache.
6. **Logout cache clear** — extend `LogoutLink` to clear BOTH the IDB persister (`idb-keyval del('folhario.query-cache')`) AND the SW API cache (`caches.delete('folhario-catalog-api-v1')`) BEFORE the redirect, preventing cross-user data leakage from the Service Worker runtime cache that plan 05-18 registers (T-05-10-01 mitigation).
7. **i18n catalog namespace** — extend `src/messages/pt-BR.json` `catalog.*` per UI-SPEC § Copywriting Contract (~55 keys covering header, sort options, empty state, manual add + errors, profile fields + delete sheet, photo journal, locations defaults, cross-cutting toasts). Existing placeholders `catalog.empty.hint` and `catalog.empty.cta` are **replaced** (not appended) per UI-SPEC §4 conflict resolution. This plan is the canonical i18n namespace owner for phase 5 catalog; downstream plans (05-07, 05-08, 05-12) extend leaf keys only.

This plan does NOT touch the Service Worker (D-19 ships in plan 05-18) and does NOT install `fake-indexeddb` (already shipped in 05-01). It mounts the provider but does not consume it — Wave 4 UI plans (05-15..05-18) are the first consumers.

Output: 5 new source files + 4 new unit test files + 3 edits (`package.json`, `src/messages/pt-BR.json`, `src/app/(app)/layout.tsx`, `src/contexts/iam/api/components/logout-link.tsx`).
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-PLAN-OUTLINE.md

# Closest analog (file shape + 'use client' convention)
@src/app/posthog-provider.tsx

# Mount target — must add <QueryProvider> AFTER the verified-user gate
@src/app/(app)/layout.tsx

# Logout flow — extend with cache clear BEFORE the redirect
@src/contexts/iam/api/components/logout-link.tsx
@src/contexts/iam/application/logout.ts
@src/app/api/v1/iam/logout/route.ts

# i18n target — replace placeholder catalog.empty.{hint,cta}; add ~55 new keys under catalog.*
@src/messages/pt-BR.json

# Wave 0 fixtures already in place (do NOT recreate)
@tests/unit/setup-idb.ts
@.planning/phases/05-catalog-meu-jardim/05-01-wave0-test-infra-PLAN.md

# Sentry release env (precedent for the deploy SHA used in buster)
@src/sentry.server.config.ts

<interfaces>
<!-- Contracts the executor implements + consumes. Embedded so no codebase scavenger hunt. -->

### `<QueryProvider>` public API (this plan creates)

```typescript
// src/shared/ui/query-provider.tsx
"use client";

export type QueryProviderProps = {
  /**
   * Authenticated user id (from (app)/layout.tsx after the verified-user gate).
   * Hashed via SHA-256 and combined with the deploy SHA into the persister
   * `buster` so a different user on a shared device cannot rehydrate the
   * previous user's catalog cache (T-05-10-01).
   */
  userId: string;
  children: React.ReactNode;
};

export function QueryProvider(props: QueryProviderProps): JSX.Element;
```

### `idb-keyval` AsyncStorage adapter (private to query-provider.tsx)

```typescript
// PersistQueryClientProvider's createAsyncStoragePersister expects:
type AsyncStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<unknown>;
  removeItem: (key: string) => Promise<void>;
};

// idb-keyval exposes get/set/del — the adapter is a 10-line bridge:
import { get, set, del } from "idb-keyval";

const idbStorage: AsyncStorage = {
  getItem: async (key) => (await get<string>(key)) ?? null,
  setItem: async (key, value) => set(key, value),
  removeItem: async (key) => del(key),
};
```

### `shouldPersist` allowlist filter (private helper)

```typescript
// D-17 allowlist. Mutations excluded by defaultShouldDehydrateQuery (TQ v5 default
// only persists *successful queries*, not mutations).
const ALLOWED_PREFIXES: readonly (readonly string[])[] = [
  ["catalog", "plants"],
  ["catalog", "plant"],
  ["catalog", "photo-entries"],
  ["catalog", "locations"],
] as const;

function shouldPersist(query: Query): boolean {
  if (!defaultShouldDehydrateQuery(query)) return false;
  const key = query.queryKey;
  return ALLOWED_PREFIXES.some((prefix) =>
    prefix.every((part, i) => key[i] === part),
  );
}
```

### `storage-budget-guard.ts` public API

```typescript
// src/shared/ui/storage-budget-guard.ts

/**
 * Returns the current used/quota ratio, or null when navigator.storage is
 * unavailable (SSR, older browsers). SSR-safe: never throws.
 */
export async function getStorageUsageRatio(): Promise<number | null>;

/**
 * If used/quota > 0.8, removes oldest queries from `queryClient` (by
 * dataUpdatedAt ASC) until the ratio drops below 0.7. SSR-safe: no-op when
 * navigator.storage is unavailable.
 *
 * Eviction policy: targets queries whose queryKey is in the persisted
 * allowlist (catalog.*); other queries are left alone.
 */
export async function checkAndEvict(queryClient: QueryClient): Promise<{
  evicted: number;
  ratioAfter: number | null;
}>;
```

### Query factory public API — TWO files (MEDIUM-2 split)

```typescript
// src/contexts/catalog/queries/index.ts
// SERVER-SAFE: NO 'use client' directive. NO React imports.
// queryFn uses fetch() — works in Server Components (Next.js fetch) and client.

import type { QueryFunction } from "@tanstack/react-query";

// `lists` parameters
export type PlantsListParams = {
  sort: "date_new" | "date_old" | "name_asc" | "name_desc" | "location";
  cursor?: string;
};

// queryKey ALWAYS begins with one of the four allowlist prefixes from D-17
// so the persister picks the entries up.
export const plantsKeys = {
  all: () => ["catalog", "plants"] as const,
  lists: (params: PlantsListParams) =>
    ({
      queryKey: ["catalog", "plants", "list", params] as const,
      queryFn: ((/* {signal} */) => fetchPlantsList(params)) satisfies QueryFunction,
      staleTime: 30_000,
    }) as const,
  detail: (plantId: string) =>
    ({
      queryKey: ["catalog", "plant", plantId] as const,
      queryFn: ((/* {signal} */) => fetchPlantDetail(plantId)) satisfies QueryFunction,
      staleTime: 60_000,
    }) as const,
  photoEntries: (plantId: string) =>
    ({
      queryKey: ["catalog", "photo-entries", plantId] as const,
      queryFn: ((/* {signal} */) => fetchPhotoEntries(plantId)) satisfies QueryFunction,
      staleTime: 60_000,
    }) as const,
};

export const locationsKeys = {
  all: () =>
    ({
      queryKey: ["catalog", "locations"] as const,
      queryFn: ((/* {signal} */) => fetchLocations()) satisfies QueryFunction,
      staleTime: 5 * 60_000,
    }) as const,
};
```

```typescript
// src/contexts/catalog/queries/hooks.ts
// CLIENT-ONLY: 'use client' directive required.
"use client";

import { useQuery } from "@tanstack/react-query";
import { plantsKeys, locationsKeys, type PlantsListParams } from "./index";

export function usePlants(params: PlantsListParams) {
  return useQuery(plantsKeys.lists(params));
}

export function usePlant(plantId: string) {
  return useQuery(plantsKeys.detail(plantId));
}

export function usePhotoEntries(plantId: string) {
  return useQuery(plantsKeys.photoEntries(plantId));
}

export function useLocations() {
  return useQuery(locationsKeys.all());
}
```

NOTE: Server Components import `plantsKeys` / `locationsKeys` from `@/contexts/catalog/queries`
(the `index.ts` server-safe path) and call `await queryClient.prefetchQuery(plantsKeys.lists(...))`.
Client components import hooks from `@/contexts/catalog/queries/hooks`.

NOTE: `fetchPlantsList`, `fetchPlantDetail`, `fetchPhotoEntries`, `fetchLocations`
are thin `fetch()` wrappers in `index.ts` that POST/GET against the
already-shipped routes from plans 05-08/05-09. Wire them as thin `fetch(...).then(r => r.json())`
shims; full type fidelity is the consumer plan's responsibility.

### Mount point — (app)/layout.tsx insertion (existing file, D modification)

```typescript
// src/app/(app)/layout.tsx — current shape (read first):
//   (a) Unauthenticated → redirect /auth/login
//   (b) age_confirmed_at NULL → redirect /auth/oauth-complete
//   (c) email_verified_at NULL → return <UnverifiedBlocker />
//   (d) Verified → return <AppShell>{children}</AppShell>
//
// THIS PLAN'S CHANGE — only branch (d):
//
//   return (
//     <QueryProvider userId={user.id}>
//       <AppShell>{children}</AppShell>
//     </QueryProvider>
//   );
//
// The QueryProvider is positioned INSIDE the verified-user gate. UnverifiedBlocker
// (branch c) and the redirects (a/b) NEVER instantiate the cache — there is no
// catalog data to persist for unverified or oauth-incomplete sessions.
```

### Logout cache clear — logout-link.tsx insertion (existing file, edit)

```typescript
// src/contexts/iam/api/components/logout-link.tsx — current shape:
//   await fetch("/api/v1/iam/logout", {...});
//   window.location.href = "/auth/login";
//
// THIS PLAN'S CHANGE — clear the IDB persister AND the SW API cache BEFORE the redirect:
//
//   try {
//     await fetch("/api/v1/iam/logout", { method: "POST", ... });
//   } finally {
//     try {
//       const { del } = await import("idb-keyval");
//       await del("folhario.query-cache");
//     } catch { /* swallow — best-effort IDB clear */ }
//     try {
//       if ('caches' in window) {
//         await Promise.all([caches.delete('folhario-catalog-api-v1')]);
//       }
//     } catch { /* swallow — best-effort SW cache purge */ }
//     window.location.href = "/auth/login";
//   }
//
// Dynamic import keeps idb-keyval out of the auth-flow bundle for users who
// never log out from this device. Both clears are best-effort (per-user buster
// already mitigates the cross-user IDB-poisoning risk; these clears are
// belt-and-braces second line of defense). The SW cache name
// 'folhario-catalog-api-v1' is the canonical identifier exported by plan 05-18.
```

### Deploy SHA source

The persister `buster` includes a deploy SHA. Reuse `process.env.NEXT_PUBLIC_DEPLOY_SHA`
(client-readable). If the env var is unset (local dev), fall back to the literal string
`"dev"`. CI sets `SENTRY_RELEASE` from the git SHA already (see `src/sentry.server.config.ts:11`);
add a one-line build-time copy `NEXT_PUBLIC_DEPLOY_SHA=$SENTRY_RELEASE` to the Vercel/CI env
or use `process.env.VERCEL_GIT_COMMIT_SHA` directly. Either source works — pick one
and document inline.

</interfaces>

</context>

<tasks>

<task type="auto">
  <name>Task 1: Install runtime deps and extend pt-BR.json catalog namespace</name>
  <files>
    package.json,
    src/messages/pt-BR.json
  </files>
  <action>
**Step A — install dependencies (runtime, NOT dev):**
```bash
pnpm add @tanstack/react-query @tanstack/query-async-storage-persister @tanstack/react-query-persist-client idb-keyval
```

The four packages are runtime-required by the client provider in Task 2 and the layout mount in Task 3. Versions verified in RESEARCH.md § Standard Stack (TQ family at `5.100.6`, idb-keyval at `6.2.2`); accept whatever pnpm resolves at install time as long as it stays on majors `^5.x` (TanStack) and `^6.x` (idb-keyval).

`fake-indexeddb` is already a dev dep from plan 05-01 — do NOT install it again.

**Step B — extend `src/messages/pt-BR.json` `catalog.*` namespace per UI-SPEC § Copywriting Contract.**

Read the current file first. The existing `catalog` object only has `empty.{title, hint, cta}` (lines 18–23). Two of those values must be **REPLACED** (per UI-SPEC §4 conflict resolution):

- `catalog.empty.hint`: `"As plantas que você adicionar aparecem aqui."` → `"Identifique sua primeira planta ou adicione manualmente."`
- `catalog.empty.cta`: `"Adicionar planta"` → `"Identificar planta"`

Then ADD all of the following keys under `catalog.*` (verbatim copy from UI-SPEC § Copywriting Contract; do NOT re-translate). Group them as nested objects in this order:

1. `catalog.header.title` = `"Meu Jardim"`
2. `catalog.header.countPlural` = `"{n, plural, one {# planta} other {# plantas}}"`
3. `catalog.sort.label` = `"Ordenar por"`
4. `catalog.sort.options.dateNew` = `"Adicionadas recentes"`
5. `catalog.sort.options.dateOld` = `"Adicionadas antigas"`
6. `catalog.sort.options.nameAsc` = `"Nome (A → Z)"`
7. `catalog.sort.options.nameDesc` = `"Nome (Z → A)"`
8. `catalog.sort.options.location` = `"Por local"`
9. `catalog.sort.announcement` = `"Catálogo reordenado por {label}"`
10. `catalog.add.title` = `"Adicionar planta"`
11. `catalog.add.fields.photo.label` = `"Foto da planta"`
12. `catalog.add.fields.photo.placeholder` = `"Toque para adicionar foto"`
13. `catalog.add.fields.photo.replace` = `"Trocar foto"`
14. `catalog.add.fields.name.label` = `"Nome"`
15. `catalog.add.fields.name.placeholder` = `"Como você chama essa planta?"`
16. `catalog.add.fields.nickname.label` = `"Apelido (opcional)"`
17. `catalog.add.fields.nickname.placeholder` = `"Um nome carinhoso"`
18. `catalog.add.fields.location.label` = `"Local (opcional)"`
19. `catalog.add.fields.acquisitionDate.label` = `"Data de aquisição (opcional)"`
20. `catalog.add.fields.notes.label` = `"Notas (opcional)"`
21. `catalog.add.fields.notes.placeholder` = `"Anotações sobre essa planta…"`
22. `catalog.add.submit` = `"Adicionar à minha estante"`
23. `catalog.add.submitLoading` = `"Adicionando…"`
24. `catalog.add.submitFailure` = `"Não conseguimos adicionar agora. Tente novamente em instantes."`
25. `catalog.add.errors.nameRequired` = `"Dê um nome para sua planta."`
26. `catalog.add.errors.photoRequired` = `"Adicione pelo menos uma foto."`
27. `catalog.add.errors.acquisitionDateInvalid` = `"Use o formato dd/mm/aaaa."`
28. `catalog.add.errors.summaryHeader` = `"Falta preencher: {fields}"`
29. `catalog.profile.fields.name.label` = `"Nome"`
30. `catalog.profile.fields.name.placeholder` = `"Sem nome"`
31. `catalog.profile.fields.name.requiredError` = `"Não pode ficar vazio."`
32. `catalog.profile.fields.nickname.label` = `"Apelido"`
33. `catalog.profile.fields.nickname.placeholder` = `"Adicionar apelido"`
34. `catalog.profile.fields.location.label` = `"Localização"`
35. `catalog.profile.fields.location.placeholder` = `"Adicionar local"`
36. `catalog.profile.fields.acquisitionDate.label` = `"Adicionada em"`
37. `catalog.profile.fields.acquisitionDate.placeholder` = `"Adicionar data"`
38. `catalog.profile.fields.notes.label` = `"Notas"`
39. `catalog.profile.fields.notes.placeholder` = `"Adicionar notas"`
40. `catalog.profile.savingLabel` = `"Salvando…"`
41. `catalog.profile.saveFailure` = `"Não conseguimos salvar agora — tentar de novo?"`
42. `catalog.profile.sections.reminders` = `"LEMBRETES ATIVOS"`
43. `catalog.profile.reminders.empty` = `"Você ainda não tem lembretes para esta planta."`
44. `catalog.profile.reminders.cta` = `"Criar lembrete"`
45. `catalog.profile.sections.journal` = `"DIÁRIO DE FOTOS"`
46. `catalog.profile.journal.viewAll` = `"Ver tudo"`
47. `catalog.profile.journal.empty` = `"Registre o crescimento adicionando fotos ao diário."`
48. `catalog.profile.journal.addCta` = `"Adicionar foto"`
49. `catalog.profile.overflow.delete` = `"Excluir planta"`
50. `catalog.profile.delete.title` = `"Excluir {nameOrNickname}?"`
51. `catalog.profile.delete.bodyBoth` = `"Isso vai apagar {photoCount, plural, one {# foto do diário} other {# fotos do diário}} e {reminderCount, plural, one {# lembrete} other {# lembretes}}. O histórico de identificações é mantido."`
52. `catalog.profile.delete.bodyPhotosOnly` = `"Isso vai apagar {photoCount, plural, one {# foto do diário} other {# fotos do diário}}. O histórico de identificações é mantido."`
53. `catalog.profile.delete.bodyRemindersOnly` = `"Isso vai apagar {reminderCount, plural, one {# lembrete} other {# lembretes}}. O histórico de identificações é mantido."`
54. `catalog.profile.delete.bodyEmpty` = `"Esta planta ainda não tem fotos no diário ou lembretes. O histórico de identificações é mantido."`
55. `catalog.profile.delete.cancel` = `"Cancelar"`
56. `catalog.profile.delete.confirm` = `"Excluir planta"`
57. `catalog.profile.delete.deleting` = `"Excluindo…"`
58. `catalog.profile.delete.failure` = `"Não conseguimos excluir agora. Tente novamente."`
59. `catalog.journal.titleFormat` = `"{name} — Diário"`
60. `catalog.journal.add.cta` = `"+ Foto"`
61. `catalog.journal.empty.title` = `"Comece o diário desta planta."`
62. `catalog.journal.empty.hint` = `"Adicione fotos novas para acompanhar o crescimento ao longo do tempo."`
63. `catalog.journal.empty.cta` = `"Adicionar primeira foto"`
64. `catalog.journal.add.title` = `"Nova foto"`
65. `catalog.journal.add.photoPlaceholder` = `"Toque para adicionar foto"`
66. `catalog.journal.add.noteLabel` = `"Anotação (opcional)"`
67. `catalog.journal.add.notePlaceholder` = `"Como ela está hoje?"`
68. `catalog.journal.add.submit` = `"Adicionar"`
69. `catalog.journal.add.submitting` = `"Enviando…"`
70. `catalog.journal.add.failure` = `"Não conseguimos enviar. Tente novamente."`
71. `catalog.journal.add.cancel` = `"Cancelar"`
72. `catalog.locations.placeholder` = `"Adicionar local"`
73. `catalog.locations.addCustom` = `"Adicionar '{typed}'"`
74. `catalog.locations.defaults` = `["sala", "varanda", "quarto", "banheiro", "cozinha", "escritório", "jardim", "outro"]` (string array, NOT a nested object — UI-SPEC §10/§11 + D-10)
75. `catalog.offline.mutationBlocked` = `"Sem conexão — tente novamente quando voltar online."`
76. `catalog.readOnly.addBlocked` = `"Reative sua assinatura para adicionar plantas."`
77. `catalog.readOnly.editBlocked` = `"Reative sua assinatura para editar suas plantas."`
78. `catalog.readOnly.deleteBlocked` = `"Reative sua assinatura para excluir plantas."`
79. `catalog.readOnly.journalAddBlocked` = `"Reative sua assinatura para adicionar fotos ao diário."`

NOTE: `catalog.locations.defaults` MUST be a JSON array (8 entries). Plan 05-12 already references it via `useTranslations('catalog.locations').raw('defaults')` — keep the shape compatible. If plan 05-12's executor already added a `catalog.locations.defaults` array on its branch, reconcile to a single source-of-truth: this plan's array is canonical (UI-SPEC §10).

If plan 05-12's branch already added `catalog.locations.placeholder` and `catalog.locations.addCustom`, KEEP them — they share this plan's contract. Do NOT duplicate.

**Step C — verify the resulting file is valid JSON and covers every key listed.**

Run `node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"` — must exit 0.

Per D-XX trace:
- Catalog locations defaults — D-10
- Catalog empty replace — UI-SPEC §4 conflict resolution
- Catalog readonly toasts — D-21
- Catalog offline toast — D-21 / Phase 9 deferral
  </action>
  <verify>
    <automated>node -e "const m = JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8')); const need = ['catalog.header.title','catalog.header.countPlural','catalog.sort.options.dateNew','catalog.empty.title','catalog.empty.hint','catalog.empty.cta','catalog.add.submit','catalog.add.errors.nameRequired','catalog.profile.fields.name.label','catalog.profile.delete.bodyBoth','catalog.journal.add.cta','catalog.locations.defaults','catalog.locations.placeholder','catalog.readOnly.addBlocked','catalog.offline.mutationBlocked']; const get=(o,p)=>p.split('.').reduce((a,k)=>a&&a[k],o); const missing = need.filter(k=>get(m,k)===undefined); if(missing.length) {console.error('MISSING',missing); process.exit(1);} if(m.catalog.empty.cta!=='Identificar planta'){console.error('catalog.empty.cta NOT replaced');process.exit(1);} if(!Array.isArray(m.catalog.locations.defaults)||m.catalog.locations.defaults.length!==8){console.error('catalog.locations.defaults must be 8-string array');process.exit(1);} console.log('ok');"</automated>
  </verify>
  <done>4 runtime deps in package.json under "dependencies" (NOT devDependencies); pt-BR.json valid JSON; every key in the 79-item list above resolvable; catalog.empty.cta == "Identificar planta" (not "Adicionar planta"); catalog.locations.defaults is an 8-element string array.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: IDB persister adapter, allowlist filter, storage-budget-guard, and QueryProvider</name>
  <files>
    src/shared/ui/query-provider.tsx,
    src/shared/ui/storage-budget-guard.ts,
    tests/unit/idb-keyval-storage-adapter.test.ts,
    tests/unit/should-persist-query.test.ts,
    tests/unit/storage-budget-guard.test.ts
  </files>
  <behavior>
**`tests/unit/idb-keyval-storage-adapter.test.ts`** (RED first):
- Test 1 — getItem on missing key returns `null` (NOT `undefined`).
- Test 2 — setItem then getItem round-trips a string verbatim.
- Test 3 — setItem then removeItem then getItem returns `null`.
- Test 4 — distinct keys are independent (set 'a', set 'b'; remove 'a' leaves 'b' intact).
- Each test runs against `fake-indexeddb` (auto-loaded by `tests/unit/setup-idb.ts` — already in vitest unit-dom setupFiles per plan 05-01).
- `beforeEach`: `globalThis.indexedDB = new IDBFactory();` (per-test isolation per D-25).

**`tests/unit/should-persist-query.test.ts`** (RED first):
- Test 1 — query with `queryKey: ['catalog','plants','list',{sort:'date_new'}]` MUST persist.
- Test 2 — query with `queryKey: ['catalog','plant','some-uuid']` MUST persist.
- Test 3 — query with `queryKey: ['catalog','photo-entries','plant-id']` MUST persist.
- Test 4 — query with `queryKey: ['catalog','locations']` MUST persist.
- Test 5 — query with `queryKey: ['identification','recent']` MUST NOT persist.
- Test 6 — query with `queryKey: ['iam','me']` MUST NOT persist.
- Test 7 — query with `queryKey: ['catalog']` (only-prefix without specific subkey) MUST NOT persist (every allowlisted prefix is at least 2 segments).
- Test 8 — a query whose state is `pending` (no data yet) MUST NOT persist (delegates to `defaultShouldDehydrateQuery`).

**`tests/unit/storage-budget-guard.test.ts`** (RED first):
- Test 1 — `getStorageUsageRatio()` returns `null` when `navigator.storage.estimate` is unavailable; no throw.
- Test 2 — `getStorageUsageRatio()` returns `0.5` when mock estimate returns `{usage: 50, quota: 100}`.
- Test 3 — `checkAndEvict(qc)` is a no-op when ratio is 0.5; `evicted === 0`.
- Test 4 — `checkAndEvict(qc)` evicts oldest catalog queries (by `dataUpdatedAt` ASC) when ratio is 0.85; ratio after eviction MUST be < 0.7 in the mock (set the mock so that each removed query reduces "usage" by a fixed amount).
- Test 5 — eviction NEVER targets a query whose `queryKey[0] !== 'catalog'`.
- Test 6 — when `typeof navigator === 'undefined'` (delete `globalThis.navigator` for the test), all functions return safely (`null` / `{evicted: 0, ratioAfter: null}`).

  </behavior>
  <action>
**Implement `src/shared/ui/storage-budget-guard.ts`:**

```typescript
// SSR-safe LRU eviction helper for the IDB-persisted TanStack Query cache (D-17).
// Per Pitfall 7: every navigator-touching code path is gated by typeof navigator !== 'undefined'.

import type { QueryClient } from "@tanstack/react-query";

const HIGH_WATER = 0.8;
const LOW_WATER = 0.7;

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

export async function checkAndEvict(
  queryClient: QueryClient,
): Promise<{ evicted: number; ratioAfter: number | null }> {
  const ratio = await getStorageUsageRatio();
  if (ratio === null) return { evicted: 0, ratioAfter: null };
  if (ratio <= HIGH_WATER) return { evicted: 0, ratioAfter: ratio };

  // Evict oldest catalog queries until usage drops below LOW_WATER.
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
```

**Implement `src/shared/ui/query-provider.tsx`:**

```typescript
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

const idbStorage = {
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

  // Storage budget guard: run on mount + every 60s.
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
        maxAge: 24 * 60 * 60 * 1000, // 24h per Pitfall 1
        buster, // ${deploySha}.${userIdHash} mitigates T-05-10-01
        dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

**Implement the three test files** verifying every behavior listed under `<behavior>`. Use:
- `@tanstack/react-query` `QueryCache`, `Query` for synthesizing test queries
- `vi.stubGlobal('navigator', {storage: {estimate: vi.fn(...)}})` for the budget guard tests; `vi.unstubAllGlobals()` in `afterEach`
- `fake-indexeddb` (already auto-loaded) for the IDB adapter test
- For the SSR test in `storage-budget-guard.test.ts`, use `vi.stubGlobal('navigator', undefined)` and assert no throw

After implementing, run `pnpm test:unit` — all 18 tests across the three files MUST pass GREEN. The first run (RED) is required if implementing properly TDD; if the executor has already written the implementation, ensure tests pass and commit.

Per D-XX trace:
- IDB persister adapter — D-16
- Allowlist filter + maxAge + buster — D-17, RESEARCH Pitfall 1, threat T-05-10-01
- Storage budget guard — D-17, RESEARCH Pitfall 7
- `<QueryProvider>` location — D-16 ("mounted inside (app)/layout.tsx after the auth gate")
  </action>
  <verify>
    <automated>pnpm test:unit -- idb-keyval-storage-adapter should-persist-query storage-budget-guard 2>&1 | tail -20</automated>
  </verify>
  <done>All three test files green under `pnpm test:unit`; `src/shared/ui/query-provider.tsx` exports `QueryProvider` (default-exports also acceptable for a 'use client' module per Phase 3 conventions but a named export matches `posthog-provider.tsx`); persister key is exactly `'folhario.query-cache'`; allowlist + maxAge + buster + dehydrateOptions wired per the implementation above; storage-budget-guard SSR-safe.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Query factory (index.ts + hooks.ts) + (app)/layout.tsx mount + logout cache clear</name>
  <files>
    src/contexts/catalog/queries/index.ts,
    src/contexts/catalog/queries/hooks.ts,
    src/app/(app)/layout.tsx,
    src/contexts/iam/api/components/logout-link.tsx,
    tests/unit/plants-keys.test.ts
  </files>
  <behavior>
**`tests/unit/plants-keys.test.ts`** (RED first):
- Test 1 — `plantsKeys.all()` returns `['catalog','plants']` (readonly tuple).
- Test 2 — `plantsKeys.lists({sort:'date_new'})` returns an object containing `queryKey: ['catalog','plants','list',{sort:'date_new'}]`, `queryFn` (function), `staleTime: 30_000`.
- Test 3 — `plantsKeys.detail('uuid-x')` returns `queryKey: ['catalog','plant','uuid-x']` (NOTE: 'plant' singular — D-17 allowlist tracks both 'plants' and 'plant').
- Test 4 — `plantsKeys.photoEntries('uuid-x')` returns `queryKey: ['catalog','photo-entries','uuid-x']`.
- Test 5 — `locationsKeys.all()` returns `queryKey: ['catalog','locations']`.
- Test 6 — invariant: every factory output's `queryKey[0]` is `'catalog'` AND the first two segments match an allowlisted prefix from `shouldPersist` (import the helper, run it on a synthesized `Query` for each factory output, assert `true`).
- Test 7 — `queryClient.invalidateQueries({queryKey: plantsKeys.all()})` partial-matches a query registered under `plantsKeys.lists(...)` AND another under `plantsKeys.detail(...)`. Use `QueryCache.find` after the invalidate to confirm both are flagged stale.
- Test 8 — `src/contexts/catalog/queries/index.ts` contains NO `'use client'` directive and NO `import.*from.*react` statement (assert via reading the file content as a string in the test).
- Test 9 — logout button unit test: mock `globalThis.caches = { delete: vi.fn().mockResolvedValue(true) }`; trigger the logout handleClick; assert `caches.delete` was called with `'folhario-catalog-api-v1'` (per HIGH-2 SW cache purge requirement).

  </behavior>
  <action>
**Implement `src/contexts/catalog/queries/index.ts` (server-safe — NO 'use client', NO React imports):**

```typescript
import type { QueryFunction } from "@tanstack/react-query";

export type PlantsListSort = "date_new" | "date_old" | "name_asc" | "name_desc" | "location";

export type PlantsListParams = {
  sort: PlantsListSort;
  cursor?: string;
};

// Thin fetch wrappers — works in Server Components (Next.js fetch) and client.
// Wave 4 UI plans replace these with type-checked API contracts; for now the
// consumers receive `unknown`. The shape contract is enforced at the API route
// level (plans 05-08/05-09); UI plans wrap with drizzle-zod parse on consumption.

async function fetchPlantsList(params: PlantsListParams): Promise<unknown> {
  const sp = new URLSearchParams();
  sp.set("sort", params.sort);
  if (params.cursor) sp.set("cursor", params.cursor);
  const r = await fetch(`/api/v1/plants?${sp.toString()}`);
  if (!r.ok) throw new Error(`plants list failed: ${r.status}`);
  return r.json();
}

async function fetchPlantDetail(plantId: string): Promise<unknown> {
  const r = await fetch(`/api/v1/plants/${plantId}`);
  if (!r.ok) throw new Error(`plant detail failed: ${r.status}`);
  return r.json();
}

async function fetchPhotoEntries(plantId: string): Promise<unknown> {
  const r = await fetch(`/api/v1/plants/${plantId}/photo-entries`);
  if (!r.ok) throw new Error(`photo entries failed: ${r.status}`);
  return r.json();
}

async function fetchLocations(): Promise<unknown> {
  const r = await fetch("/api/v1/locations");
  if (!r.ok) throw new Error(`locations failed: ${r.status}`);
  return r.json();
}

export const plantsKeys = {
  all: () => ["catalog", "plants"] as const,
  lists: (params: PlantsListParams) =>
    ({
      queryKey: ["catalog", "plants", "list", params] as const,
      queryFn: ((/* {signal} */) => fetchPlantsList(params)) as QueryFunction<unknown>,
      staleTime: 30_000,
    }) as const,
  detail: (plantId: string) =>
    ({
      queryKey: ["catalog", "plant", plantId] as const,
      queryFn: ((/* {signal} */) => fetchPlantDetail(plantId)) as QueryFunction<unknown>,
      staleTime: 60_000,
    }) as const,
  photoEntries: (plantId: string) =>
    ({
      queryKey: ["catalog", "photo-entries", plantId] as const,
      queryFn: ((/* {signal} */) => fetchPhotoEntries(plantId)) as QueryFunction<unknown>,
      staleTime: 60_000,
    }) as const,
};

export const locationsKeys = {
  all: () =>
    ({
      queryKey: ["catalog", "locations"] as const,
      queryFn: ((/* {signal} */) => fetchLocations()) as QueryFunction<unknown>,
      staleTime: 5 * 60_000,
    }) as const,
};
```

**Implement `src/contexts/catalog/queries/hooks.ts` (client-only 'use client' hook layer):**

```typescript
"use client";

import { useQuery } from "@tanstack/react-query";
import { plantsKeys, locationsKeys, type PlantsListParams } from "./index";

export function usePlants(params: PlantsListParams) {
  return useQuery(plantsKeys.lists(params));
}

export function usePlant(plantId: string) {
  return useQuery(plantsKeys.detail(plantId));
}

export function usePhotoEntries(plantId: string) {
  return useQuery(plantsKeys.photoEntries(plantId));
}

export function useLocations() {
  return useQuery(locationsKeys.all());
}
```

Wave 4 client components MUST import hooks from `hooks.ts`. Server Components MUST import factories from `index.ts`. Do NOT import hooks in Server Components — the `'use client'` boundary is the split point.

**Modify `src/app/(app)/layout.tsx`** (Edit, NOT Write — read first to preserve the four-branch gate):

Wrap `<AppShell>{children}</AppShell>` (currently the verified branch return on line 52) in `<QueryProvider userId={user.id}>`:

```typescript
import { QueryProvider } from "@shared/ui/query-provider";
// ...
// (d) Verified → app shell.
return (
  <QueryProvider userId={user.id}>
    <AppShell>{children}</AppShell>
  </QueryProvider>
);
```

NOTHING else in the file changes. Branches (a), (b), (c) — redirects and `<UnverifiedBlocker />` — are NOT wrapped (per D-16 + threat T-05-10-01: unverified or oauth-incomplete sessions never instantiate the cache).

**Modify `src/contexts/iam/api/components/logout-link.tsx`** (Edit, NOT Write — read first to preserve the existing fetch + redirect):

Inside the `try { await fetch(...); } finally { ... }` block, BEFORE the `window.location.href = '/auth/login'` line, clear BOTH the IDB persister key AND the SW API cache. Swallow errors on each independently so the redirect always runs:

```typescript
async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  try {
    await fetch("/api/v1/iam/logout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  } finally {
    try {
      const { del } = await import("idb-keyval");
      await del("folhario.query-cache");
    } catch {
      /* swallow — best-effort IDB clear; per-user buster already
         mitigates cross-user IDB poisoning at the persister level */
    }
    try {
      if ('caches' in window) {
        await Promise.all([caches.delete('folhario-catalog-api-v1')]);
      }
    } catch {
      /* swallow — best-effort SW cache purge */
    }
    window.location.href = "/auth/login";
  }
}
```

The SW cache name `'folhario-catalog-api-v1'` is the canonical identifier exported by plan 05-18's runtime cache rule. This plan references it as a string constant — if 05-18 ships first and exports `CATALOG_API_CACHE`, update to use that constant; otherwise the string literal is acceptable as a coordination comment.

**Implement `tests/unit/plants-keys.test.ts`** verifying every behavior under `<behavior>`.
- Tests 1-7: Import `shouldPersist` from `@shared/ui/query-provider` for Test 6 (synthesize a minimal `Query`-shaped object: `{queryKey, state: {status: 'success', data: {}, dataUpdatedAt: Date.now()}}`).
- Test 8: Read `src/contexts/catalog/queries/index.ts` as a string via `fs.readFileSync`; assert it does NOT contain `'use client'` or `from "react"` / `from 'react'`.
- Test 9 (HIGH-2 logout SW purge): Import the `LogoutLink` component (or its `handleClick` callback directly if exported); mock `globalThis.caches = { delete: vi.fn().mockResolvedValue(true) }`; mock `window.location` assign; trigger the logout; assert `caches.delete` was called with `'folhario-catalog-api-v1'`. If `handleClick` is not directly importable, test the behavior via a React Testing Library `render` + `userEvent.click` on the rendered anchor.

Per D-XX trace:
- Query factory shape + server-safe split — D-18, MEDIUM-2
- Client hooks layer — MEDIUM-2
- Mount inside (app)/layout.tsx — D-16
- Logout IDB clear — threat T-05-10-01 belt-and-braces mitigation
- Logout SW cache purge — HIGH-2, cross-user SW data leakage prevention
  </action>
  <verify>
    <automated>pnpm test:unit -- plants-keys 2>&1 | tail -15 && pnpm typecheck 2>&1 | tail -5</automated>
  </verify>
  <done>plants-keys.test.ts green (9 tests including SW cache purge assertion and server-safe index.ts check); `pnpm typecheck` exits 0; `(app)/layout.tsx` wraps `<AppShell>` in `<QueryProvider userId={user.id}>` ONLY in the verified branch; `LogoutLink` calls both `del('folhario.query-cache')` AND `caches.delete('folhario-catalog-api-v1')` before the redirect; `src/contexts/catalog/queries/index.ts` has NO 'use client' directive and NO React imports; `src/contexts/catalog/queries/hooks.ts` has 'use client' and exports usePlants/usePlant/usePhotoEntries/useLocations; `grep -n "caches.delete.*folhario-catalog-api-v1" src/contexts/iam/api/components/logout-link.tsx` returns at least 1 hit.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser ↔ IndexedDB | TanStack Query cache persists user-owned catalog data into a same-origin IDB database. On a shared device, this data MUST be partitioned per user. |
| Layout gate ↔ QueryProvider | `<QueryProvider>` is mounted ONLY in the verified-user branch of `(app)/layout.tsx`. Unverified or oauth-incomplete sessions never instantiate the cache. |
| Logout ↔ persister + SW cache | `LogoutLink` clears the IDB persister key AND purges the SW runtime cache (`folhario-catalog-api-v1`) before the page-reload redirect so the next user starts with a completely fresh cache state. |
| Layout ↔ child SSR data | Phase 5 D-13 (in plan 05-15) uses `<HydrationBoundary>` per-route; this plan does NOT introduce a global hydration leak surface. |
| Server Component ↔ Client Component boundary | `index.ts` is server-safe (no 'use client'); `hooks.ts` is client-only ('use client'). Importing hooks in a Server Component would break the boundary — the split enforces this at the module level. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-10-01 | T (Tampering) / I (Information Disclosure) | IndexedDB persister key `folhario.query-cache` on a device shared between users | mitigate | (a) `buster: ${deploySha}.${userIdHash}` (SHA-256(userId).slice(0,12) hex) — different user produces a different buster, forcing TQ to discard the previously-persisted cache on rehydrate; (b) `LogoutLink` calls `idb-keyval del('folhario.query-cache')` before redirect — IDB belt-and-braces; (c) `LogoutLink` calls `caches.delete('folhario-catalog-api-v1')` before redirect — SW cache belt-and-braces; (d) allowlist excludes any non-catalog query (e.g., IAM, identification) from the persister so identity-bearing payloads never land in IDB |
| T-05-10-02 | T (Tampering) | RSC `<HydrationBoundary>` leaking server state to wrong client cache | mitigate | This plan does NOT install a global `<HydrationBoundary>`. Per D-13, hydration is per-route inside the catalog page server component (plan 05-15); each request mints a fresh `QueryClient` server-side that is discarded after dehydration |
| T-05-10-03 | I (Information Disclosure) | Storage-budget eviction race during quota pressure leaking partial data | mitigate | `checkAndEvict` calls `queryClient.removeQueries({exact: true})` per query — eviction is whole-query, never partial; the helper is idempotent (re-runs collapse to no-op below `LOW_WATER`); guarded by `typeof navigator !== 'undefined'` so SSR + older browsers no-op |
| T-05-10-04 | E (Elevation of Privilege) | Allowlist regression letting a non-catalog query (e.g., `['iam','me']`) into IDB | mitigate | `tests/unit/should-persist-query.test.ts` Tests 5 + 6 lock the allowlist behavior; CI green-gate on the unit project means future regressions fail the suite. Allowlist prefixes are `as const` readonly tuples — a typo widens the allowlist, immediately failing the unit tests |
| T-05-10-05 | I (Information Disclosure) | Deploy SHA exposure via `NEXT_PUBLIC_DEPLOY_SHA` | accept | Deploy SHA is already public via Sentry release headers and source-map URLs (PROJECT.md observability constraint). Re-using it in the buster string adds no new disclosure |
| T-05-10-06 | I (Information Disclosure) | SW runtime cache (`folhario-catalog-api-v1`) serving previous user's authenticated API responses to new user on same device | mitigate | `LogoutLink` calls `caches.delete('folhario-catalog-api-v1')` in the finally block before redirect; guarded by `'caches' in window` for environments without SW support; swallows errors so redirect always runs |

`block_on: high` per ASVS L1. T-05-10-01 has THREE independent mitigations (buster partition + IDB logout clear + SW cache logout purge) — high-severity threat has redundant defense. T-05-10-04 is locked by automated unit tests in this plan's deliverable set. T-05-10-06 is a new threat added per HIGH-2 review finding.

</threat_model>

<verification>
## Phase-level checks

1. `pnpm test:unit` — all four new test files green (idb-keyval-storage-adapter, should-persist-query, storage-budget-guard, plants-keys).
2. `pnpm typecheck` — exits 0 with the layout edit, logout-link edit, query factory files, and provider all in tree.
3. `pnpm lint` — exits 0; no ESLint violations in new files.
4. **Sanity: allowlist coverage matches D-17 verbatim.**
   - `grep -E "ALLOWED_PREFIXES|catalog.*plants|catalog.*plant|catalog.*photo-entries|catalog.*locations" src/shared/ui/query-provider.tsx` returns the four prefixes (and only those four).
5. **Sanity: persister key is the canonical string.**
   - `grep -c "folhario.query-cache" src/shared/ui/query-provider.tsx src/contexts/iam/api/components/logout-link.tsx` returns 2 (one per file). Use `grep -v '^//'` filter if comment lines could leak the literal — these files have no comments containing the key.
6. **Sanity: `<QueryProvider>` mount is in the verified branch only.**
   - `grep -B 2 "<QueryProvider" src/app/(app)/layout.tsx` shows the surrounding context — must be after the `if (!user.emailVerifiedAt)` block, NOT before.
7. **Sanity: i18n catalog namespace coverage.**
   - The Task 1 verify command's `node -e ...` script asserts the 14 representative keys are present. Reviewer manually scans the diff for the full 79-item list.
8. **Sanity: HIGH-2 SW cache purge in logout.**
   - `grep -n "caches.delete.*folhario-catalog-api-v1" src/contexts/iam/api/components/logout-link.tsx` returns at least 1 hit.
9. **Sanity: MEDIUM-2 server-safe query factory.**
   - `grep -v '^#' src/contexts/catalog/queries/index.ts | grep -c "use client"` returns 0 (no 'use client' directive).
   - `grep -v '^#' src/contexts/catalog/queries/index.ts | grep -c "from ['\"]react['\"]"` returns 0 (no React imports).
   - `grep -c "use client" src/contexts/catalog/queries/hooks.ts` returns at least 1 (hooks file IS client-only).

## Run order

```bash
pnpm install            # picks up the four new runtime deps
pnpm test:unit          # all four new test files green
pnpm typecheck
pnpm lint
```

</verification>

<success_criteria>

- [ ] `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `idb-keyval` are listed under `dependencies` in `package.json` (NOT `devDependencies`)
- [ ] `src/shared/ui/query-provider.tsx` exports `QueryProvider` and is `'use client'`; wraps `<PersistQueryClientProvider>` with the idb-keyval adapter, allowlist filter, `maxAge: 24h`, and `buster = ${deploySha}.${userIdHash}`
- [ ] `src/shared/ui/storage-budget-guard.ts` exports `getStorageUsageRatio` and `checkAndEvict`; SSR-safe; LRU eviction targets ONLY catalog queries
- [ ] `src/contexts/catalog/queries/index.ts` exports `plantsKeys.{all, lists, detail, photoEntries}` and `locationsKeys.all` with the exact key shapes in `<interfaces>`; NO `'use client'` directive; NO React imports; `queryFn` uses `fetch()`
- [ ] `src/contexts/catalog/queries/hooks.ts` has `'use client'` directive and exports `usePlants`, `usePlant`, `usePhotoEntries`, `useLocations` each wrapping `useQuery()` with the corresponding factory from `index.ts`
- [ ] `src/app/(app)/layout.tsx` wraps `<AppShell>` in `<QueryProvider userId={user.id}>` ONLY in the verified-user branch; redirects + `<UnverifiedBlocker />` remain unwrapped
- [ ] `src/contexts/iam/api/components/logout-link.tsx` calls both `idb-keyval del('folhario.query-cache')` AND `caches.delete('folhario-catalog-api-v1')` (each in its own try/catch, error-swallowed) before `window.location.href` redirect; `grep -n "caches.delete.*folhario-catalog-api-v1" src/contexts/iam/api/components/logout-link.tsx` returns at least 1 hit
- [ ] `src/messages/pt-BR.json` `catalog.*` namespace covers all 79 keys from the UI-SPEC § Copywriting Contract; `catalog.empty.hint` and `catalog.empty.cta` are REPLACED (not appended); `catalog.locations.defaults` is an 8-element string array
- [ ] All four new unit tests green under `pnpm test:unit`; `pnpm typecheck` exits 0; `pnpm lint` exits 0

</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-10-SUMMARY.md` per `.claude/get-shit-done/templates/summary.md` covering:

- The four runtime deps installed (with resolved versions)
- The five new source files (query-provider, storage-budget-guard, queries/index.ts, queries/hooks.ts, logout-link edits) + four new test files + three edits
- Confirmation that the persister allowlist matches D-17 verbatim
- Confirmation that the buster string mitigates T-05-10-01 (deploy SHA + per-user hash)
- Confirmation that `<QueryProvider>` is mounted ONLY in the verified-user branch (defense at the gate)
- Confirmation that logout clears both the IDB persister key AND the SW cache `folhario-catalog-api-v1` before redirect (belt-and-braces, HIGH-2)
- Confirmation that `src/contexts/catalog/queries/index.ts` is server-safe (no 'use client', no React imports, fetch-based queryFn) and `hooks.ts` is client-only (MEDIUM-2 split)
- The 79-key i18n catalog namespace expansion (replaced placeholders + new keys); this plan is the canonical namespace owner (MEDIUM-4)
- Any deviations from the plan (if `pnpm` resolves a different major version than RESEARCH.md anticipated, document)
</output>
