---
phase: 05-catalog-meu-jardim
plan: 10
type: tdd
wave: 5
depends_on:
  - 05-08
  - 05-09
  # PHASE-3-DEPENDENCY (BLOCKING execution, NOT planning): requires Phase 3 to ship the layout shell + design tokens + bottom nav before this plan's `src/app/layout.tsx` patch runs.
  # PHASE-2-DEPENDENCY (BLOCKING execution): requires Phase 2 D-15 + Plan 01-03 next-intl plumbing already on disk (verified — `src/app/layout.tsx` lines 21-23 confirm wrap order).
files_modified:
  - package.json
  - src/shared/react-query/idb-persister.ts
  - src/shared/react-query/query-client.ts
  - src/shared/react-query/persist-client-provider.tsx
  - src/app/layout.tsx
  - src/messages/pt-BR.json
  - tests/unit/shared/react-query/idb-persister.test.ts
autonomous: true
requirements: []
decisions:
  use_subscription_location: |
    RESOLVED (Open Question Q3) — accept CONTEXT D-24 VERBATIM:
    `src/contexts/billing/api/use-subscription.ts`. Rationale:
    (a) 5a Plans 05-08 + 05-09 already shipped catalog client hooks under
        `src/contexts/catalog/api/use-*.ts` — the convention is established;
    (b) 05-PATTERNS.md § "Client hooks" explicitly documents this as
        a deviation from Phase 2 D-16 (`api/` for route handlers), accepted
        because CONTEXT D-24 locks the path so Phase 10 can swap the file
        atomically without renames;
    (c) Option (b) "move to `hooks/`" would silently invalidate the 5a-shipped
        convention for `use-plants.ts` etc. and require renames.
    All Phase 5 client hooks (5a + 5b) live under `<context>/api/use-*.ts`.
    Phase 10 swaps `use-subscription.ts` body without changing the path.
  i18n_namespace: |
    All Phase 5 catalog copy lands in `src/messages/pt-BR.json` under top-level
    `catalog.*` namespace in THIS plan to avoid sequential file mods across
    Plans 05-12 / 05-15 / 05-16 / 05-17 / 05-18 (would create artificial
    sequential dependencies). After this plan: every 5b plan that needs
    i18n calls `useTranslations("catalog")` against keys ALREADY in the file.
    The pt-BR.json file is OWNED here; subsequent 5b plans must NOT include
    it in their `files_modified`. (Drift mitigation: VALIDATION acceptance
    criteria below grep-verify each consumer key exists.)
  query_client_singleton_pattern: |
    Per RESEARCH Pattern 2 + 05-PATTERNS.md § "Shared Patterns > Singleton/factory":
    `useState(() => new QueryClient(...))` PER-RENDER (not per-module) inside
    `<PersistQueryClientProvider>` so SSR cannot leak QueryClient instances
    across users/requests. Persister `buster: "folhario-catalog-v1"` per
    RESEARCH Pattern 2. `gcTime: 24h`, `staleTime: 5min`,
    `refetchOnWindowFocus: true`.
  persister_storage_key: |
    `idb-keyval` key = `"folhario:tq-cache"` (top-level idbValidKey for the
    whole-client persister payload). Single-key pattern matches RESEARCH
    Pattern 2 verbatim — TQ writes the entire dehydrated client to one key
    with internal throttling.
  layout_wrap_order: |
    Per 05-PATTERNS.md § "TanStack Query providers > Where to wire it":
    `<NextIntlClientProvider>` (server-rendered outermost) →
      `<PostHogProvider>` (client) →
        `<ReactQueryProvider>` (client; THIS PLAN ADDS) →
          children.
    ReactQueryProvider goes INSIDE PostHogProvider so analytics fires for
    all queries. layout.tsx will only be modified by THIS PLAN; subsequent
    5b plans must NOT include `src/app/layout.tsx` in their files_modified.
must_haves:
  truths:
    - "TanStack Query 5.100.5 + persist-client + async-storage-persister + idb-keyval are installed at exact pinned versions"
    - "src/shared/react-query/idb-persister.ts exports createIdbPersister() returning a Persister with persistClient/restoreClient/removeClient backed by idb-keyval"
    - "src/shared/react-query/persist-client-provider.tsx exports a 'use client' ReactQueryProvider component that wraps children in <PersistQueryClientProvider> with the per-render QueryClient and the IDB persister"
    - "src/app/layout.tsx wraps PostHogProvider's children in <ReactQueryProvider> (TQ provider INSIDE PostHog INSIDE NextIntlClientProvider)"
    - "src/messages/pt-BR.json contains the COMPLETE catalog.* namespace covering every UI-SPEC § Copywriting Contract row (page titles, sort labels, headlines, hints, CTAs, modal copy, validation copy, banners) so subsequent 5b plans consume only"
    - "useSubscription hook PATH for 5b is locked at src/contexts/billing/api/use-subscription.ts (Q3 resolution; consumed by 05-11)"
    - "IDB persister behavior: writing to and reading from `folhario:tq-cache` key roundtrips a PersistedClient object (3 RED→GREEN tests)"
  artifacts:
    - path: "src/shared/react-query/idb-persister.ts"
      provides: "createIdbPersister(idbValidKey) — Persister implementation backed by idb-keyval"
      min_lines: 18
      contains: "createIdbPersister"
    - path: "src/shared/react-query/query-client.ts"
      provides: "createQueryClient() factory returning QueryClient with default gcTime=24h, staleTime=5min, refetchOnWindowFocus=true"
      min_lines: 18
      contains: "QueryClient"
    - path: "src/shared/react-query/persist-client-provider.tsx"
      provides: "ReactQueryProvider 'use client' wrapper using PersistQueryClientProvider with buster='folhario-catalog-v1', maxAge=24h, IDB persister"
      min_lines: 30
      contains: "PersistQueryClientProvider"
    - path: "src/app/layout.tsx"
      provides: "Layout wraps PostHogProvider children in ReactQueryProvider; preserves NextIntlClientProvider outermost"
      contains: "ReactQueryProvider"
    - path: "src/messages/pt-BR.json"
      provides: "Top-level catalog.* namespace with all 5b copy strings (page titles, sort labels, headlines, hints, CTAs, modal copy, validation copy, banners verbatim per UI-SPEC § Copywriting Contract)"
      contains: "catalog"
    - path: "tests/unit/shared/react-query/idb-persister.test.ts"
      provides: "RED→GREEN: persister round-trips PersistedClient via fake-indexeddb; restoreClient returns undefined when no key set; removeClient clears the entry"
      min_lines: 50
      contains: "createIdbPersister"
    - path: "package.json"
      provides: "exact-pinned versions @tanstack/react-query@5.100.5, @tanstack/react-query-persist-client@5.100.5, @tanstack/query-async-storage-persister@5.100.5, idb-keyval@6.2.2"
      contains: "@tanstack/react-query"
  key_links:
    - from: "src/app/layout.tsx"
      to: "src/shared/react-query/persist-client-provider.tsx"
      via: "import + JSX wrap inside <PostHogProvider>"
      pattern: "ReactQueryProvider"
    - from: "src/shared/react-query/persist-client-provider.tsx"
      to: "src/shared/react-query/idb-persister.ts"
      via: "useState(() => createIdbPersister())"
      pattern: "createIdbPersister"
    - from: "src/shared/react-query/idb-persister.ts"
      to: "idb-keyval (npm)"
      via: "imports get/set/del"
      pattern: "idb-keyval"
    - from: "src/messages/pt-BR.json"
      to: "every 5b page using useTranslations('catalog')"
      via: "next-intl namespace lookup"
      pattern: "catalog"
user_setup: []
---

<resolved_open_questions>
**Q3 (`useSubscription` location) — RESOLVED in this plan.**

Choice: **Option (a) — accept CONTEXT D-24 verbatim** at
`src/contexts/billing/api/use-subscription.ts`.

Rationale:
- Plans 05-08 + 05-09 (5a) already shipped Phase 5 client hooks under the
  `src/contexts/<ctx>/api/use-*.ts` convention. Picking option (b) would
  invalidate that convention silently and require renames.
- 05-PATTERNS.md § "Client hooks" pre-documents this as a "documented
  deviation from Phase 2 D-16" (which reserves `api/` for route handlers
  but only via the ESLint guard "no Drizzle in route handlers" — that
  guard does not forbid React hooks under `api/`).
- Phase 10 swaps the body of `use-subscription.ts` without changing the
  path — zero retrofit cost across all Phase-5-shipped consumers.

All Phase 5 client hooks (5a + 5b) live under `src/contexts/<ctx>/api/use-*.ts`.
05-11 lands `src/contexts/billing/api/use-subscription.ts`.
</resolved_open_questions>

<objective>
Wave 5 foundation infra for Phase 5b: install + wire TanStack Query 5.100.5 with the IDB-backed persister, and land the COMPLETE pt-BR catalog message namespace so every subsequent 5b plan consumes pre-existing translation keys without re-modifying the locale file.

Purpose: every catalog UI surface in waves 6-8 (catalog grid, plant profile, manual add, photo journal, home, /identify, banners) depends on `<ReactQueryProvider>` wrapping the app and on `useTranslations("catalog")` resolving against a populated message namespace. Centralizing both here eliminates artificial sequential dependencies on `pt-BR.json` and `layout.tsx` between later 5b plans.

Output: 4 new shared files (~80 lines), 1 layout patch, 1 i18n message file extension (~80 keys verbatim from UI-SPEC), 1 unit test (~50 lines, RED→GREEN coverage of the persister contract via fake-indexeddb), package.json with 4 exact-pinned dependencies.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-01-wave0-test-infra-PLAN.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/02-data-layer/02-CONTEXT.md

<interfaces>
<!-- Key contracts the executor needs. Extracted from RESEARCH § Patterns + verified upstream files. -->

From idb-keyval (npm 6.2.2):
```ts
export function get<T>(key: IDBValidKey): Promise<T | undefined>;
export function set(key: IDBValidKey, value: unknown): Promise<void>;
export function del(key: IDBValidKey): Promise<void>;
```

From @tanstack/react-query-persist-client (npm 5.100.5):
```ts
export type PersistedClient = {
  buster: string;
  timestamp: number;
  clientState: { mutations: unknown[]; queries: unknown[] };
};
export type Persister = {
  persistClient(client: PersistedClient): Promise<void> | void;
  restoreClient(): Promise<PersistedClient | undefined> | PersistedClient | undefined;
  removeClient(): Promise<void> | void;
};
export function PersistQueryClientProvider(props: {
  client: QueryClient;
  persistOptions: { persister: Persister; maxAge?: number; buster?: string };
  children: React.ReactNode;
}): JSX.Element;
```

From src/app/layout.tsx (current — verify before patching):
```tsx
// Phase 1 Plan 01-06 + 01-03 wrap order (DO NOT REORDER, only INSERT ReactQueryProvider INSIDE PostHogProvider):
<NextIntlClientProvider locale={locale} messages={messages}>
  <PostHogProvider>
    {children}
  </PostHogProvider>
</NextIntlClientProvider>
```

From src/i18n/request.ts (Phase 1 Plan 01-03 line 9 — read-only, do not modify):
```ts
messages: (await import(`../messages/${locale}.json`)).default,
```
The pt-BR.json file is loaded at locale resolution; new top-level keys appear automatically to consumers via `useTranslations("catalog")`.

From src/shared/telemetry/posthog-server.ts (Phase 1 Plan 01-06 — NO direct dependency, only the wrap-order constraint applies).
</interfaces>

<related_files>
- `tests/helpers/idb-test-setup.ts` (5a Plan 05-01) — fake-indexeddb global polyfill registered in unit Vitest project setupFiles. CONSUMED by `tests/unit/shared/react-query/idb-persister.test.ts` (this plan).
- `tests/unit/idb-polyfill-smoke.test.ts` (5a Plan 05-01) — confirms fake-indexeddb works in jsdom; this plan's test inherits the same polyfill.
</related_files>
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: Install TanStack Query + persister + idb-keyval (exact pins) and write RED test for IDB persister contract</name>
  <files>package.json, tests/unit/shared/react-query/idb-persister.test.ts</files>
  <read_first>
    - package.json (current — verify Phase 1 D-04 / Plan 01-04 exact-pin policy: `"next": "16.2.3"` not `"^16.2.3"`)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Standard Stack > Core (line 181) for exact versions
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 2 (line 492-560) for the persister contract shape
    - tests/helpers/idb-test-setup.ts (5a Plan 05-01 — fake-indexeddb polyfill registration; this test inherits)
    - tests/unit/idb-polyfill-smoke.test.ts (5a Plan 05-01 — Vitest IDB-polyfill working example)
    - .planning/phases/01-foundation/01-CONTEXT.md (Phase 1 D-04 EXACT version-pinning policy)
  </read_first>
  <behavior>
    - Test 1 (`createIdbPersister default key roundtrip`): persistClient writes a PersistedClient to default key `folhario:tq-cache`; restoreClient returns the SAME PersistedClient object (deep-equal)
    - Test 2 (`createIdbPersister custom key`): when called with `createIdbPersister("custom-key")`, all three methods operate against `custom-key`, not the default
    - Test 3 (`restoreClient returns undefined when no key set`): fresh fake-indexeddb, no prior write → restoreClient resolves to `undefined`
    - Test 4 (`removeClient clears the entry`): persistClient → removeClient → restoreClient returns `undefined`

    Tests use `import { createIdbPersister } from "@shared/react-query/idb-persister"` — module does NOT exist yet (RED). Tests use the global fake-indexeddb polyfill from `tests/helpers/idb-test-setup.ts` (already registered in 5a 05-01 vitest unit project setupFiles). Each test wraps body in `beforeEach` that calls `await del("folhario:tq-cache")` and `await del("custom-key")` to isolate state across tests.

    Assert PersistedClient shape via `expect(restored).toEqual({ buster: "test-buster", timestamp: ..., clientState: { mutations: [], queries: [] } })`.
  </behavior>
  <action>
    **RED step (write failing tests + install deps):**

    1. Edit `package.json` to add (in `dependencies` section, alphabetically placed):
       - `"@tanstack/query-async-storage-persister": "5.100.5"`
       - `"@tanstack/react-query": "5.100.5"`
       - `"@tanstack/react-query-persist-client": "5.100.5"`
       - `"idb-keyval": "6.2.2"`

       Use EXACT pins (no `^`, no `~`) per Phase 1 D-04 / Plan 01-04 commit policy.

    2. Run `pnpm install` to materialize the lockfile (verify `pnpm-lock.yaml` updated).

    3. Create `tests/unit/shared/react-query/idb-persister.test.ts` (NEW directory required):
       ```ts
       import { describe, it, expect, beforeEach } from "vitest";
       import { del } from "idb-keyval";
       import { createIdbPersister } from "@shared/react-query/idb-persister";
       import type { PersistedClient } from "@tanstack/react-query-persist-client";

       const sampleClient: PersistedClient = {
         buster: "test-buster",
         timestamp: 1_700_000_000_000,
         clientState: { mutations: [], queries: [] },
       };

       beforeEach(async () => {
         await del("folhario:tq-cache");
         await del("custom-key");
       });

       describe("createIdbPersister", () => {
         it("roundtrips PersistedClient via the default key", async () => {
           const persister = createIdbPersister();
           await persister.persistClient(sampleClient);
           const restored = await persister.restoreClient();
           expect(restored).toEqual(sampleClient);
         });

         it("uses the custom key when provided", async () => {
           const persister = createIdbPersister("custom-key");
           await persister.persistClient(sampleClient);
           const restored = await persister.restoreClient();
           expect(restored).toEqual(sampleClient);
         });

         it("returns undefined when no client persisted", async () => {
           const persister = createIdbPersister();
           const restored = await persister.restoreClient();
           expect(restored).toBeUndefined();
         });

         it("removeClient clears the entry", async () => {
           const persister = createIdbPersister();
           await persister.persistClient(sampleClient);
           await persister.removeClient();
           const restored = await persister.restoreClient();
           expect(restored).toBeUndefined();
         });
       });
       ```

    4. Run `pnpm exec vitest --run --project=unit tests/unit/shared/react-query/idb-persister.test.ts` — MUST FAIL with module-not-found error on `@shared/react-query/idb-persister` (RED gate; module is created in Task 2).

    5. Commit RED state:
       `git add package.json pnpm-lock.yaml tests/unit/shared/react-query/idb-persister.test.ts`
       `git commit -m "test(05-10): add failing tests for IDB persister + install TanStack Query 5.100.5"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/react-query/idb-persister.test.ts 2>&1 | grep -qE "(Cannot find module|Failed to resolve)" &amp;&amp; echo RED_GATE_OK</automated>
  </verify>
  <done>
    - package.json contains 4 new exact-pinned dependencies (`grep -c "\"5.100.5\"" package.json` returns 3 + `"idb-keyval": "6.2.2"` once)
    - pnpm-lock.yaml updated (file mtime newer than package.json mtime)
    - tests/unit/shared/react-query/idb-persister.test.ts exists with 4 `it(...)` blocks
    - Vitest run fails with module-not-found on `@shared/react-query/idb-persister` (RED gate)
    - Commit message starts with `test(05-10):`
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: GREEN — implement IDB persister + QueryClient factory + ReactQueryProvider; wire into layout.tsx</name>
  <files>src/shared/react-query/idb-persister.ts, src/shared/react-query/query-client.ts, src/shared/react-query/persist-client-provider.tsx, src/app/layout.tsx</files>
  <read_first>
    - tests/unit/shared/react-query/idb-persister.test.ts (the RED tests from Task 1 — your implementation must make these pass)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 2 (lines 502-560) — verbatim implementation skeleton
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "TanStack Query providers" (line 187-201) — wrap order
    - src/app/layout.tsx (current 27-line file — your patch INSERTS `<ReactQueryProvider>` INSIDE PostHogProvider; do NOT change wrap order; do NOT touch NextIntlClientProvider)
    - src/app/posthog-provider.tsx (Phase 1 Plan 01-06 — ANALOG for the "use client" provider style)
  </read_first>
  <behavior>
    - On import, `createIdbPersister()` (no args) returns a Persister whose 3 methods operate on the literal key `"folhario:tq-cache"`
    - On import, `createIdbPersister("custom")` returns a Persister whose 3 methods operate on the literal key `"custom"`
    - `createQueryClient()` returns a fresh QueryClient with `gcTime: 24*60*60*1000`, `staleTime: 5*60*1000`, `refetchOnWindowFocus: true`
    - `ReactQueryProvider` wraps children in `<PersistQueryClientProvider>` with `buster: "folhario-catalog-v1"`, `maxAge: 24*60*60*1000`, the IDB persister (per-render), and the per-render QueryClient
    - `src/app/layout.tsx` JSX has `<ReactQueryProvider>` directly INSIDE `<PostHogProvider>` and OUTSIDE `<NextIntlClientProvider>` — preserves the wrap order: NextIntl > PostHog > ReactQuery > children
  </behavior>
  <action>
    **GREEN step (minimal code to pass RED tests + wire into layout):**

    1. Create `src/shared/react-query/idb-persister.ts` (copy verbatim from RESEARCH Pattern 2 line 502-518):
       ```ts
       import { get, set, del } from "idb-keyval";
       import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

       export function createIdbPersister(idbValidKey: IDBValidKey = "folhario:tq-cache"): Persister {
         return {
           persistClient: async (client: PersistedClient) => {
             await set(idbValidKey, client);
           },
           restoreClient: async () => {
             return (await get<PersistedClient>(idbValidKey)) ?? undefined;
           },
           removeClient: async () => {
             await del(idbValidKey);
           },
         };
       }
       ```

    2. Create `src/shared/react-query/query-client.ts`:
       ```ts
       import { QueryClient } from "@tanstack/react-query";

       export function createQueryClient(): QueryClient {
         return new QueryClient({
           defaultOptions: {
             queries: {
               gcTime: 1000 * 60 * 60 * 24,    // 24h — must exceed persister maxAge
               staleTime: 1000 * 60 * 5,        // 5min — reduce focus refetch
               refetchOnWindowFocus: true,
             },
           },
         });
       }
       ```

    3. Create `src/shared/react-query/persist-client-provider.tsx`:
       ```tsx
       "use client";
       import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
       import { useState } from "react";
       import { createIdbPersister } from "./idb-persister";
       import { createQueryClient } from "./query-client";

       export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
         // Per-render so SSR cannot leak QueryClient across users.
         const [queryClient] = useState(createQueryClient);
         const [persister] = useState(() => createIdbPersister());

         return (
           <PersistQueryClientProvider
             client={queryClient}
             persistOptions={{
               persister,
               maxAge: 1000 * 60 * 60 * 24,
               buster: "folhario-catalog-v1",
             }}
           >
             {children}
           </PersistQueryClientProvider>
         );
       }
       ```

    4. Patch `src/app/layout.tsx` — INSERT `<ReactQueryProvider>` INSIDE `<PostHogProvider>`:
       - Add `import { ReactQueryProvider } from "@shared/react-query/persist-client-provider";`
       - Wrap `{children}` inside PostHogProvider with `<ReactQueryProvider>{children}</ReactQueryProvider>`
       - Wrap order MUST stay: `<NextIntlClientProvider>` > `<PostHogProvider>` > `<ReactQueryProvider>` > children
       - Do NOT touch `<html lang={locale}>` or `/manifest.webmanifest` link or NextIntlClientProvider (Plan 01-03 invariants).

    5. Run `pnpm exec vitest --run --project=unit tests/unit/shared/react-query/idb-persister.test.ts` — MUST PASS (4 green tests).

    6. Run `pnpm exec tsc --noEmit` — MUST exit 0 (zero TS errors).

    7. Commit GREEN state:
       `git add src/shared/react-query/ src/app/layout.tsx`
       `git commit -m "feat(05-10): implement IDB persister + ReactQueryProvider; wire into layout"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/react-query/idb-persister.test.ts &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c "ReactQueryProvider" src/app/layout.tsx | grep -qE "^[2-9]"</automated>
  </verify>
  <done>
    - `src/shared/react-query/idb-persister.ts` exists with `export function createIdbPersister`
    - `src/shared/react-query/query-client.ts` exists with `export function createQueryClient`
    - `src/shared/react-query/persist-client-provider.tsx` exists, starts with `"use client"`, exports `ReactQueryProvider`
    - 4 unit tests pass (grep `vitest --run` output for `4 passed`)
    - `pnpm exec tsc --noEmit` exits 0
    - `src/app/layout.tsx` contains `ReactQueryProvider` (>=2 occurrences: import + JSX)
    - Wrap order preserved: `grep -nE "(NextIntlClientProvider|PostHogProvider|ReactQueryProvider)" src/app/layout.tsx` shows the three in order
    - Commit message starts with `feat(05-10):`
  </done>
</task>

<task type="auto">
  <name>Task 3: Land COMPLETE pt-BR catalog message namespace (consumed by all 5b plans)</name>
  <files>src/messages/pt-BR.json</files>
  <read_first>
    - src/messages/pt-BR.json (currently `{}` — this task fills it with the catalog namespace)
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Copywriting Contract" lines 161-227 (every key listed verbatim per surface)
    - docs/CAVE-PRD.md §17 (color/typography/copy authority — but UI-SPEC is the consumed source)
    - docs/design/COPY.md (referenced by UI-SPEC for verbatim strings; UI-SPEC overrides on the 3 documented drift items per UI-SPEC § Documentation Drift lines 470-473)
    - src/i18n/request.ts (loader contract — confirms the file is loaded at locale resolution; no code change needed)
  </read_first>
  <action>
    Replace contents of `src/messages/pt-BR.json` with the full catalog namespace below. Every string is verbatim from UI-SPEC § Copywriting Contract or the canonical PRD wording it cites. NO emoji (PRD §17 banned). Latin scientific names are NOT in this file (consumers wrap in `<i lang="la">{name}</i>` at render time). Write JSON to be a strict superset of any future per-surface needs — this avoids re-modifying pt-BR.json in 5b plans 12/15/16/17/18.

    ```json
    {
      "catalog": {
        "page": {
          "title": "Meu Jardim"
        },
        "sort": {
          "label": "Ordenar por",
          "options": {
            "name_asc": "Nome (A-Z)",
            "name_desc": "Nome (Z-A)",
            "acquired_desc": "Mais recentes",
            "acquired_asc": "Mais antigas",
            "location_asc": "Local"
          },
          "announcement": "Ordenado por {option}"
        },
        "header": {
          "addPlantCta": "+ Planta"
        },
        "empty": {
          "headline": "Sua estante ainda está esperando a primeira planta.",
          "hint": "Adicione manualmente uma planta que você já cuida.",
          "cta": "Adicionar planta"
        },
        "loading": {
          "list": "Carregando suas plantas"
        },
        "card": {
          "alt": {
            "withNickname": "{name} ({nickname})",
            "nameOnly": "{name}"
          },
          "metadata": {
            "noLocation": "—"
          }
        },
        "manualAdd": {
          "title": "Adicionar planta manualmente",
          "fields": {
            "name": "Nome",
            "nickname": "Apelido (opcional)",
            "location": "Onde fica na casa?",
            "acquisitionDate": "Quando você ganhou/comprou?",
            "notes": "Anotações pessoais"
          },
          "submit": "Adicionar planta",
          "cancel": "Cancelar",
          "validation": {
            "nameRequired": "Dê um nome para sua planta — pode ser carinhoso.",
            "photoRequired": "Adicione pelo menos uma foto.",
            "photoRejected": "Não conseguimos enviar essa foto. Tente outra imagem.",
            "summary": "Verifique os campos destacados."
          },
          "photoButton": "Adicionar foto"
        },
        "locationPicker": {
          "placeholder": "Ex: Sala, varanda, quarto...",
          "sections": {
            "prior": "Usados antes",
            "defaults": "Sugestões"
          },
          "defaults": {
            "sala": "Sala",
            "varanda": "Varanda",
            "quarto": "Quarto",
            "banheiro": "Banheiro",
            "cozinha": "Cozinha",
            "escritorio": "Escritório",
            "jardim": "Jardim",
            "outro": "Outro"
          },
          "ariaLabel": "Locais",
          "ariaListboxLabel": "Sugestões de local"
        },
        "profile": {
          "sections": {
            "about": "Sobre",
            "careGuide": "Guia de cuidados",
            "reminders": "Lembretes",
            "journal": "Diário de fotos",
            "idHistory": "Histórico de identificação"
          },
          "remindersEmpty": "Nenhum lembrete ativo.",
          "journalEmpty": "Nenhuma foto no diário ainda.",
          "addJournalCta": "+ Foto no diário",
          "editAria": "Editar {field}",
          "deleteOverflow": "Excluir planta",
          "fieldLabels": {
            "name": "Nome",
            "nickname": "Apelido",
            "location": "Local",
            "acquisitionDate": "Data de aquisição",
            "notes": "Anotações"
          },
          "saveAnnouncement": "Atualizado",
          "validation": {
            "futureDateNotAllowed": "Use uma data passada — você não pode ter uma planta antes de tê-la."
          }
        },
        "photoJournal": {
          "title": "Diário de fotos",
          "addSheet": {
            "title": "Nova foto no diário",
            "notePlaceholder": "Como ela está hoje? (opcional)",
            "save": "Adicionar ao diário"
          },
          "empty": "Adicione a primeira foto para acompanhar o crescimento.",
          "lightbox": {
            "editNote": "Editar nota",
            "setAsCover": "Definir como capa",
            "delete": "Excluir",
            "alt": "Foto de {name}, {date}",
            "close": "Fechar"
          }
        },
        "delete": {
          "modal": {
            "title": "Excluir {name}?",
            "body": "Isso apagará as fotos e lembretes desta planta. A ação não pode ser desfeita.",
            "cancel": "Cancelar",
            "confirm": "Excluir"
          }
        },
        "modal": {
          "close": "Fechar"
        },
        "offline": {
          "banner": {
            "body": "Você está offline. Algumas ações estão indisponíveis."
          }
        },
        "readOnly": {
          "banner": {
            "body": "Sua assinatura expirou. Reative para identificar e receber lembretes.",
            "cta": "Reativar"
          }
        },
        "home": {
          "empty": {
            "headline": "Identifique sua primeira planta",
            "secondaryLink": "Adicionar manualmente",
            "captureAriaLabel": "Identificar planta com a câmera"
          }
        },
        "identify": {
          "placeholder": {
            "headline": "Identificação em breve",
            "hint": "Em breve você poderá fotografar e identificar suas plantas aqui.",
            "backToCatalog": "Voltar ao catálogo"
          }
        },
        "errors": {
          "fetchFailed": {
            "headline": "Não conseguimos carregar agora.",
            "hint": "Verifique sua conexão e tente de novo.",
            "retry": "Tentar de novo"
          }
        }
      }
    }
    ```

    Then run `pnpm exec tsc --noEmit` and `pnpm test:unit` to confirm no consumer breaks. Commit:
    `git add src/messages/pt-BR.json`
    `git commit -m "feat(05-10): land complete pt-BR catalog message namespace for 5b consumers"`
  </action>
  <verify>
    <automated>node -e "const m=require('./src/messages/pt-BR.json'); for(const k of ['page.title','sort.label','empty.headline','manualAdd.title','locationPicker.placeholder','profile.sections.about','photoJournal.title','delete.modal.title','offline.banner.body','readOnly.banner.body','home.empty.headline','identify.placeholder.headline']) { const v=k.split('.').reduce((o,p)=>o&amp;&amp;o[p], m.catalog); if(!v) { console.error('MISSING catalog.'+k); process.exit(1); } } console.log('OK')"</automated>
  </verify>
  <done>
    - `src/messages/pt-BR.json` is no longer `{}` — file size > 2KB
    - JSON validates: `node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"` exits 0
    - Top-level `catalog` namespace exists with sub-namespaces: `page`, `sort`, `header`, `empty`, `loading`, `card`, `manualAdd`, `locationPicker`, `profile`, `photoJournal`, `delete`, `modal`, `offline`, `readOnly`, `home`, `identify`, `errors`
    - All UI-SPEC § Copywriting Contract verbatim strings present (verified by automated grep above)
    - Pre-existing PRD §17 banned patterns absent: `grep -E "[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}]" src/messages/pt-BR.json | wc -l` returns 0 (no emoji)
    - Commit message starts with `feat(05-10):`
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → IDB | Persisted PersistedClient is user-readable in DevTools (acceptable: contains query results already visible in UI; no secrets) |
| layout.tsx → ReactQueryProvider | Provider state is per-render; SSR cannot leak QueryClient across users (mitigated by `useState(createQueryClient)`) |
| pt-BR.json → next-intl | Server-rendered string; XSS via interpolation tokens (mitigated: next-intl auto-escapes; no dangerouslySetInnerHTML) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-10-01 | Information Disclosure | Persister IDB cache contains plant names + photo URLs | accept | Same data is already rendered in DOM; IDB is per-origin sandboxed; LGPD posture remains "user owns their device" per PRD §11. Buster `folhario-catalog-v1` enables cache wipe on schema changes. |
| T-5b-10-02 | Tampering / Spoofing | SSR QueryClient leak across users (Pattern 2 anti-pattern) | mitigate | `useState(() => createQueryClient())` per-render, NOT module-level singleton. Verified by acceptance criteria asserting `createQueryClient` factory function (not exported singleton). |
| T-5b-10-03 | Tampering | i18n interpolation XSS via `{name}` token (e.g., `delete.modal.title`) | mitigate | next-intl auto-escapes interpolated values via React JSX (no dangerouslySetInnerHTML). Plant name capped at 80 chars by Phase 5a 05-04 schema. No active mitigation needed at THIS layer; downstream consumers must pass user input through JSX as text node, not raw HTML. |
| T-5b-10-04 | Information Disclosure | Sentry breadcrumb may capture IDB write payloads (PersistedClient contains query data) | accept | Phase 1 LGPD-13 scrub module (Plan 01-05a) drops `request.cookies` and redacts identification payloads. IDB write breadcrumbs do NOT contain image URLs (they contain query keys + small metadata); risk is low. If a future regression surfaces, extend scrub-fields list — not in scope here. |

</threat_model>

<verification>
Run after all 3 tasks:
- `pnpm exec vitest --run --project=unit tests/unit/shared/react-query/idb-persister.test.ts` exits 0 (4 tests pass)
- `pnpm exec tsc --noEmit` exits 0
- `node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"` exits 0
- `grep -c "ReactQueryProvider" src/app/layout.tsx` returns ≥ 2 (import + JSX)
- `grep -nE "(NextIntlClientProvider|PostHogProvider|ReactQueryProvider)" src/app/layout.tsx` shows three providers in correct nesting order
- `grep -E "@tanstack/react-query.*5\.100\.5" package.json` matches
</verification>

<success_criteria>
- TanStack Query 5.100.5 + persist-client + async-storage-persister + idb-keyval installed at exact pins
- `createIdbPersister()` works against `folhario:tq-cache` key with fake-indexeddb in unit tests (RED→GREEN proven)
- ReactQueryProvider is mounted in layout.tsx INSIDE PostHogProvider INSIDE NextIntlClientProvider
- pt-BR.json has the COMPLETE catalog namespace; subsequent 5b plans consume keys without re-modifying the file
- Q3 resolved: `useSubscription` will land at `src/contexts/billing/api/use-subscription.ts` (option a, accept CONTEXT D-24 verbatim) — documented in `decisions.use_subscription_location`
- All commits prefixed `test(05-10):` (RED), `feat(05-10):` (GREEN), `feat(05-10):` (i18n)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-10-SUMMARY.md` summarizing:
- Final pinned versions of TQ + persister + idb-keyval
- Confirmed Q3 resolution path: `src/contexts/billing/api/use-subscription.ts`
- The list of every catalog.* key landed in pt-BR.json (so 5b plans 11-18 can grep against it without reading this file)
- Whether any drift was discovered between UI-SPEC and COPY.md during the i18n authoring (UI-SPEC § Documentation Drift line 470-473 already lists 3 known items)
- Empirically-confirmed bundle size delta (run `pnpm build --filter=app | grep "First Load JS"` if Phase 3 has shipped layout-bundle baselines; otherwise note as "not measurable until Phase 3 shell ships")
</output>
</content>
</invoke>