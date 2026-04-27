---
phase: 05-catalog-meu-jardim
plan: 15
type: tdd
wave: 7
depends_on:
  - 05-08    # GET /api/v1/plants HTTP contract (5a — list endpoint with cursor + sort)
  - 05-10    # ReactQueryProvider + pt-BR.json catalog.* keys
  - 05-11    # useSubscription stub for read-only-mode hide of "+ Planta" CTA
  # PHASE-3-DEPENDENCY (BLOCKING execution): Phase 3 ships app shell (bottom nav + layout chrome) + design tokens (--paper-cream, --warm-ivory, --canopy, --calm-slate, --hairline). Catalog page renders inside Phase 3's shell.
files_modified:
  - src/app/catalog/page.tsx
  - src/app/catalog/catalog-grid-client.tsx
  - src/contexts/catalog/api/use-plants.ts
  - src/contexts/catalog/api/use-sort-preference.ts
  - tests/unit/contexts/catalog/use-sort-preference.test.ts
  - tests/e2e/catalog/grid-responsive.spec.ts
  - tests/e2e/catalog/empty-catalog.spec.ts
  - tests/e2e/catalog/sort-persistence.spec.ts
  - tests/e2e/catalog/card-geometry.spec.ts
autonomous: true
requirements:
  - CAT-04
  - CAT-07
  - CAT-08
  - CAT-10
  - CAT-11
  - UI-07
decisions:
  rsc_prefetch_strategy: |
    Catalog page is RSC + HydrationBoundary per RESEARCH Pattern 1. RSC
    prefetches the FIRST PAGE by calling the use case `listPlants(...)` from
    `@contexts/catalog/application/list-plants` DIRECTLY (server-side; no
    HTTP roundtrip). The CatalogGridClient mounts useInfiniteQuery with the
    SAME queryKey `["plants", { sort }]` — TQ recognizes prefetched data
    and skips initial fetch. SSR uses the same RLS-protected use case the
    /api/v1/plants handler uses. Future Plan 05-16 (Plant Profile) follows
    the same pattern but calls listPlants with `plantIdFilter` per
    Plan 05-08 frontmatter contract.
  sort_storage_key: |
    `folhario:catalog:sort:${userId}` per CONTEXT D-08 + Specifics line 229.
    Values: `name_asc | name_desc | acquired_desc | acquired_asc | location_asc`.
    Default when unset: `acquired_desc` (CAT-07 default).
  sessionStorage_isomorphism_guard: |
    useSortPreference is a 'use client' hook; reads from sessionStorage at
    mount via useState lazy initializer guarded by `typeof window !== 'undefined'`.
    On SSR/server-render, returns the default `acquired_desc` so the RSC
    prefetch + initial render are deterministic. After hydration, the hook
    re-reads sessionStorage in a useEffect and updates state if a stored
    value exists. This prevents hydration mismatches.
  intersection_observer_root_margin: |
    `200px` rootMargin on the bottom edge of the last card per RESEARCH
    Code Examples line 1308. Triggers fetchNextPage 200px before the bottom
    is reached; reduces perceived scroll lag.
  catalog_card_aspect_ratio: |
    Photo aspect 4:5 portrait per UI-SPEC § "Catalog grid card" line 246.
    Implemented via Tailwind `aspect-[4/5]` (or `aspect-[0.8]`). Card
    background = Warm Ivory; padding = 16px (=p-4); radius = 16px (=rounded-2xl).
  responsive_grid_breakpoints: |
    Per UI-SPEC + CAT-10: 2 cols ≤375px, 3 cols 600-899px, 4 cols ≥900px.
    Tailwind: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` with custom
    breakpoints sm=600 lg=900 (NOT default 640/1024). May require
    Tailwind config breakpoint override at execution time — if Phase 3
    has not customized breakpoints to 375/600/900, fall back to inline
    `style={{ gridTemplateColumns: ... }}` driven by a useMediaQuery hook
    (cheap one-off implementation; not worth a Tailwind config change in
    this plan). Document chosen approach in 05-15-SUMMARY.md.
  read_only_mode_hides_cta: |
    `+ Planta` header CTA is hidden when useSubscription().status is
    "expired" or "grace" per UI-SPEC § "Read-only mode UI variants" + D-24.
    Empty-state CTA "Adicionar planta" stays visible (read-only users with
    zero plants would otherwise see no path forward — but the read-only
    banner stub from Plan 05-18 already directs them to "Reativar"; the
    Catalog empty-state CTA is functionally moot in read-only mode but
    NOT visually hidden — UI-SPEC table line 337-338 only lists header
    CTA in the hide list).
  identification_count_off_for_grid: |
    The catalog GRID list endpoint call uses default `?include` (no
    identification_count). Plan 05-08 frontmatter explicitly says
    "the catalog grid (5b) doesn't need it; the plant profile detail
    endpoint always includes the count" — Plan 05-16 (Plant Profile) will
    pass `?include=identification_count` for the conditional ID-history link.
must_haves:
  truths:
    - "src/app/catalog/page.tsx is an RSC that prefetches the first page of plants via the listPlants use case (server-side) and renders <HydrationBoundary><CatalogGridClient /></HydrationBoundary>"
    - "src/app/catalog/catalog-grid-client.tsx is a 'use client' component using useInfiniteQuery + IntersectionObserver to load subsequent pages"
    - "Grid renders 2 cols ≤375px, 3 cols 600-899px, 4 cols ≥900px (CAT-10) — verified by Playwright at all 3 viewport widths"
    - "Each card renders 4:5 photo aspect, 16px radius, 16px padding (UI-07 + UI-SPEC § Catalog card)"
    - "Card alt text follows UI-SPEC formula: '{name} ({nickname})' OR '{name}' if nickname null"
    - "Empty state composition: Sage line-art illustration (aria-hidden) + Source Serif 4 headline 'Sua estante ainda está esperando a primeira planta.' + Calm Slate hint + EXACTLY ONE Canopy CTA 'Adicionar planta' (CAT-11)"
    - "Sort control offers 5 options (name A-Z, name Z-A, acquired desc, acquired asc, location); selection updates URL/sessionStorage AND triggers TQ refetch with new sort key (CAT-08)"
    - "Sort persists in sessionStorage at key 'folhario:catalog:sort:${userId}' across reload within session (verified by Playwright)"
    - "Header '+ Planta' CTA visible when status='trialing'; hidden when status='expired' or 'grace' (verified by Playwright with NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS=expired)"
    - "useSortPreference hook is SSR-safe (returns default on server-render; reads sessionStorage in useEffect after hydration)"
    - "Catalog page passes axe-core scan at all 3 viewports (CAT-10 a11y row in VALIDATION.md)"
  artifacts:
    - path: "src/app/catalog/page.tsx"
      provides: "RSC catalog page with prefetch + HydrationBoundary"
      min_lines: 35
      contains: "HydrationBoundary"
    - path: "src/app/catalog/catalog-grid-client.tsx"
      provides: "Client island with useInfiniteQuery + IntersectionObserver + sort dropdown + Add CTA + responsive grid + empty state"
      min_lines: 180
      contains: "useInfiniteQuery"
    - path: "src/contexts/catalog/api/use-plants.ts"
      provides: "useInfiniteQuery hook for /api/v1/plants — queryKey ['plants', { sort }], cursor-paginated"
      min_lines: 35
      contains: "useInfiniteQuery"
    - path: "src/contexts/catalog/api/use-sort-preference.ts"
      provides: "useSortPreference(userId) — SSR-safe hook returning [sort, setSort] with sessionStorage persistence"
      min_lines: 50
      contains: "useSortPreference"
    - path: "tests/unit/contexts/catalog/use-sort-preference.test.ts"
      provides: "TDD: SSR-safe default; reads sessionStorage on mount; setSort writes through; isolates between userIds"
      min_lines: 70
      contains: "useSortPreference"
    - path: "tests/e2e/catalog/grid-responsive.spec.ts"
      provides: "Playwright: viewport 375 → 2 cols; 600 → 3 cols; 900 → 4 cols; axe-core scan at each breakpoint"
      min_lines: 60
      contains: "viewportSize"
    - path: "tests/e2e/catalog/empty-catalog.spec.ts"
      provides: "Playwright: zero-plant fixture renders Sage illustration + headline + single Canopy CTA"
      min_lines: 30
      contains: "Sua estante"
    - path: "tests/e2e/catalog/sort-persistence.spec.ts"
      provides: "Playwright: select sort 'name_asc' → reload → sort still 'name_asc'; second user (different userId) sees default acquired_desc"
      min_lines: 50
      contains: "sessionStorage"
    - path: "tests/e2e/catalog/card-geometry.spec.ts"
      provides: "Playwright visual: card has 4:5 photo aspect, 16px radius, name + nickname + location render in expected positions"
      min_lines: 40
      contains: "aspect-ratio"
  key_links:
    - from: "src/app/catalog/page.tsx"
      to: "src/contexts/catalog/application/list-plants.ts (5a Plan 05-07)"
      via: "RSC server-side import + prefetch call"
      pattern: "listPlants"
    - from: "src/app/catalog/catalog-grid-client.tsx"
      to: "src/contexts/catalog/api/use-plants.ts"
      via: "named import"
      pattern: "usePlants"
    - from: "src/contexts/catalog/api/use-plants.ts"
      to: "GET /api/v1/plants (5a Plan 05-08)"
      via: "fetch with credentials: 'include' + cursor + sort + limit query params"
      pattern: "/api/v1/plants"
    - from: "src/app/catalog/catalog-grid-client.tsx"
      to: "src/contexts/billing/api/use-subscription.ts (Plan 05-11)"
      via: "named import; gates header CTA"
      pattern: "useSubscription"
user_setup: []
---

<objective>
Catalog page surface — Wave 7 — composes the 5a route handlers (Plan 05-08 GET /api/v1/plants) into the user-visible catalog grid. Ships:
- RSC `src/app/catalog/page.tsx` with prefetch + HydrationBoundary per RESEARCH Pattern 1
- Client island `CatalogGridClient` with useInfiniteQuery + IntersectionObserver
- `useSortPreference` SSR-safe hook (TDD focus feature) with sessionStorage persistence per D-08
- Responsive grid 2/3/4 cols at 375/600/900 (CAT-10)
- Empty Catalog composition (CAT-11) + sort dropdown (CAT-08) + Add CTA gated by useSubscription (D-24 hide-when-read-only)
- Playwright suite covering responsive grid, empty state, sort persistence, card geometry, axe-core scan

Purpose: This is the most user-visible surface in Phase 5 — the moment a user sees their plants. Must be honest, calm (PRD §17 atmosphere), pt-BR, accessible, and fast (RSC prefetch eliminates spinner-on-first-load).

Output: 4 source files (~290 lines combined) + 1 unit test (~70 lines TDD) + 4 E2E specs (~180 lines combined). Covers 6 requirement IDs.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-08-route-handlers-read-create-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-11-use-subscription-stub-PLAN.md

<interfaces>
<!-- Consumed contracts -->

From `src/contexts/catalog/application/list-plants.ts` (5a Plan 05-07 — server-side use case):
```ts
export type SortKey = "name_asc" | "name_desc" | "acquired_desc" | "acquired_asc" | "location_asc";
export type Cursor = string | null;
export type ListPlantsArgs = {
  userId: string;
  sort?: SortKey;
  cursor?: Cursor;
  limit?: number;
  plantIdFilter?: string;
  includeIdentificationCount?: boolean;
};
export type PlantListItem = {
  id: string;
  name: string;
  nickname: string | null;
  location: string | null;
  acquisitionDate: string | null;
  coverPhotoUrl: string | null;
  speciesId: string | null;
  createdAt: string;
};
export type ListPlantsResult = { data: PlantListItem[]; next_cursor: Cursor };
export function listPlants(args: ListPlantsArgs): Promise<ListPlantsResult>;
```

From GET /api/v1/plants (5a Plan 05-08):
- Query params: `?cursor=<base64>&limit=<int>&sort=<sortKey>`
- Defaults: cursor=null, limit=50 (max 200), sort=acquired_desc
- Response 200: `{ data: PlantListItem[], next_cursor: string | null }`
- Response on error: `{ error: { code, message, details? } }` per closed registry

From src/contexts/billing/api/use-subscription.ts (Plan 05-11):
```ts
export function useSubscription(): { status: "trialing" | "active" | "expired" | "grace" };
```

From src/messages/pt-BR.json catalog.* (Plan 05-10) — keys consumed:
- `catalog.page.title` "Meu Jardim"
- `catalog.sort.label` + `catalog.sort.options.{name_asc|name_desc|acquired_desc|acquired_asc|location_asc}`
- `catalog.header.addPlantCta` "+ Planta"
- `catalog.empty.{headline|hint|cta}`
- `catalog.loading.list`
- `catalog.card.alt.{withNickname|nameOnly}` + `catalog.card.metadata.noLocation`
</interfaces>

<related_files>
- `tests/helpers/playwright-auth-bypass.ts` (Plan 05-01) — `createVerifiedUserSession(page)` for E2E
- `tests/helpers/axe-helper.ts` (Plan 05-01) — `expectNoA11yViolations(page, includeSelector?)`
- `src/messages/pt-BR.json` (Plan 05-10) — i18n keys consumed by CatalogGridClient
- Plan 05-08 PLAN.md frontmatter — confirms `?include=identification_count` opt-in (catalog grid does NOT use it)
</related_files>
</context>

<!-- TEST-IMPORT NOTE (Phase 1 STATE.md / Plan 01-07 lessons learned):
The project has NO `@/*` tsconfig path alias. Only `@contexts/*`, `@shared/*`,
`@i18n/*` are configured (see tsconfig.json). All test files MUST use RELATIVE
imports for tests/helpers/* and src/* references. The samples below have been
patched accordingly. If you see any `@/...` import in this plan, it's a sample
typo — replace with the correct relative path before committing.
-->

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: TDD focus — useSortPreference hook (sessionStorage + SSR safety)</name>
  <files>src/contexts/catalog/api/use-sort-preference.ts, tests/unit/contexts/catalog/use-sort-preference.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-08 line 62 + Specifics line 229
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Validation Architecture row CAT-08 unit
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row CAT-08 unit + e2e
  </read_first>
  <behavior>
    - S1 (`returns default 'acquired_desc' when sessionStorage is empty`)
    - S2 (`returns stored value when sessionStorage has a key for this user`)
    - S3 (`setSort writes value to sessionStorage at correct key`)
    - S4 (`different userId reads + writes different storage keys (per-user isolation)`)
    - S5 (`SSR-safe — returns default during server render (window undefined)`) — simulated by mocking `typeof window` (or running in Node-only project)
    - S6 (`invalid stored value falls back to default`)
    - S7 (`storage key shape is exactly 'folhario:catalog:sort:${userId}'`)
  </behavior>
  <action>
    **RED step:** Create `tests/unit/contexts/catalog/use-sort-preference.test.ts`:
    ```ts
    import { describe, it, expect, beforeEach } from "vitest";
    import { renderHook, act } from "@testing-library/react";
    import { useSortPreference, type SortKey } from "@contexts/catalog/api/use-sort-preference";

    beforeEach(() => {
      sessionStorage.clear();
    });

    describe("useSortPreference (D-08)", () => {
      it("S1 returns default 'acquired_desc' when storage is empty", () => {
        const { result } = renderHook(() => useSortPreference("user-1"));
        expect(result.current[0]).toBe("acquired_desc");
      });

      it("S2 returns stored value when present", () => {
        sessionStorage.setItem("folhario:catalog:sort:user-1", "name_asc");
        const { result } = renderHook(() => useSortPreference("user-1"));
        expect(result.current[0]).toBe("name_asc");
      });

      it("S3 setSort writes through to sessionStorage", () => {
        const { result } = renderHook(() => useSortPreference("user-1"));
        act(() => result.current[1]("location_asc"));
        expect(result.current[0]).toBe("location_asc");
        expect(sessionStorage.getItem("folhario:catalog:sort:user-1")).toBe("location_asc");
      });

      it("S4 isolates per userId", () => {
        sessionStorage.setItem("folhario:catalog:sort:user-1", "name_asc");
        sessionStorage.setItem("folhario:catalog:sort:user-2", "name_desc");
        const { result: r1 } = renderHook(() => useSortPreference("user-1"));
        const { result: r2 } = renderHook(() => useSortPreference("user-2"));
        expect(r1.current[0]).toBe("name_asc");
        expect(r2.current[0]).toBe("name_desc");
      });

      it("S6 invalid stored value falls back to default", () => {
        sessionStorage.setItem("folhario:catalog:sort:user-1", "garbage_sort_key");
        const { result } = renderHook(() => useSortPreference("user-1"));
        expect(result.current[0]).toBe("acquired_desc");
      });

      it("S7 uses exact storage key shape", () => {
        const { result } = renderHook(() => useSortPreference("abc-123"));
        act(() => result.current[1]("name_asc"));
        const keys = Object.keys(sessionStorage).filter((k) => k.includes("abc-123"));
        expect(keys).toContain("folhario:catalog:sort:abc-123");
      });
    });
    ```

    Run: `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/use-sort-preference.test.ts` — MUST FAIL.

    Commit RED: `git add tests/unit/contexts/catalog/use-sort-preference.test.ts && git commit -m "test(05-15): add failing tests for useSortPreference (D-08 sessionStorage + SSR safety)"`

    **GREEN step:** Create `src/contexts/catalog/api/use-sort-preference.ts`:
    ```ts
    "use client";
    import { useCallback, useEffect, useState } from "react";

    export type SortKey =
      | "name_asc"
      | "name_desc"
      | "acquired_desc"
      | "acquired_asc"
      | "location_asc";

    const VALID_SORTS: ReadonlySet<SortKey> = new Set([
      "name_asc",
      "name_desc",
      "acquired_desc",
      "acquired_asc",
      "location_asc",
    ]);

    const DEFAULT_SORT: SortKey = "acquired_desc";

    function storageKey(userId: string): string {
      return `folhario:catalog:sort:${userId}`;
    }

    function readFromStorage(userId: string): SortKey {
      if (typeof window === "undefined") return DEFAULT_SORT;
      try {
        const raw = window.sessionStorage.getItem(storageKey(userId));
        if (raw && VALID_SORTS.has(raw as SortKey)) {
          return raw as SortKey;
        }
      } catch {
        // sessionStorage may throw in private mode; fall through to default
      }
      return DEFAULT_SORT;
    }

    export function useSortPreference(userId: string): [SortKey, (next: SortKey) => void] {
      // Lazy initializer reads sessionStorage on mount (client-side only)
      const [sort, setSortState] = useState<SortKey>(() => readFromStorage(userId));

      // After hydration, re-read in case sessionStorage was populated by prior session
      useEffect(() => {
        const next = readFromStorage(userId);
        if (next !== sort) setSortState(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [userId]);

      const setSort = useCallback(
        (next: SortKey) => {
          if (!VALID_SORTS.has(next)) return;
          setSortState(next);
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(storageKey(userId), next);
            } catch {
              // ignore (private mode etc.)
            }
          }
        },
        [userId],
      );

      return [sort, setSort];
    }
    ```

    Run tests: 6 MUST PASS (S5 covered implicitly by `typeof window` guard; explicitly testing SSR is hard in jsdom — accept S5 as documented, not enforced; rely on the type guard reading correctly + no test regression).
    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/contexts/catalog/api/use-sort-preference.ts && git commit -m "feat(05-15): implement useSortPreference (D-08 + SSR safety)"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/use-sort-preference.test.ts &amp;&amp; pnpm exec tsc --noEmit</automated>
  </verify>
  <done>
    - 6 unit tests pass (S1-S4, S6, S7)
    - SortKey type union exported
    - tsc --noEmit exits 0
    - storage key exact: `folhario:catalog:sort:${userId}`
    - Default fallback: `acquired_desc`
    - Both `try/catch` around sessionStorage access (private mode safety)
    - Commit prefixes `test(05-15):` (RED), `feat(05-15):` (GREEN)
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement use-plants.ts useInfiniteQuery hook + RSC catalog page + CatalogGridClient + i18n wiring</name>
  <files>src/contexts/catalog/api/use-plants.ts, src/app/catalog/page.tsx, src/app/catalog/catalog-grid-client.tsx</files>
  <read_first>
    - src/contexts/catalog/api/use-sort-preference.ts (Task 1 GREEN)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 1 (RSC prefetch + HydrationBoundary lines 437-489)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Common operation: cursor-paginated infinite scroll (lines 1290-1316)
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "App pages" lines 222-247
    - .planning/phases/05-catalog-meu-jardim/05-08-route-handlers-read-create-PLAN.md (HTTP contract for GET /api/v1/plants)
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Catalog grid card" + "Empty Catalog" + "Read-only mode UI variants"
    - src/messages/pt-BR.json (Plan 05-10) — catalog.* keys
  </read_first>
  <behavior>
    - usePlants(sort) returns useInfiniteQuery with queryKey ["plants", { sort }], queryFn that fetches /api/v1/plants?cursor=...&limit=50&sort=..., getNextPageParam reads next_cursor
    - Catalog page (RSC) prefetches first page server-side via listPlants use case (NOT via fetch), dehydrates QueryClient, wraps client island in HydrationBoundary
    - CatalogGridClient renders header (page title + sort dropdown + "+ Planta" CTA hidden in read-only mode), responsive grid, empty state, IntersectionObserver loading more pages
    - Sort dropdown change calls setSort which both writes sessionStorage AND triggers TQ refetch (because queryKey changes)
    - aria-live="polite" announcement element for "Ordenado por {option}" when sort changes
    - Loading skeleton renders only after 300ms delay (PRD §17 — not implemented in v1; accept as-is, render skeleton immediately when fetching, not gated on delay; tradeoff documented in SUMMARY)
    - Cards have 4:5 photo aspect, 16px radius, 16px padding, name + nickname (parens) + location (Calm Slate) per UI-SPEC § Catalog card
  </behavior>
  <action>
    **Step A: Implement useInfiniteQuery hook**

    Create `src/contexts/catalog/api/use-plants.ts`:
    ```ts
    "use client";
    import { useInfiniteQuery } from "@tanstack/react-query";
    import type { SortKey } from "./use-sort-preference";

    export type PlantListItem = {
      id: string;
      name: string;
      nickname: string | null;
      location: string | null;
      acquisitionDate: string | null;
      coverPhotoUrl: string | null;
      speciesId: string | null;
      createdAt: string;
    };

    export type PlantsPage = { data: PlantListItem[]; next_cursor: string | null };

    export function usePlants(sort: SortKey) {
      return useInfiniteQuery<PlantsPage, Error>({
        queryKey: ["plants", { sort }],
        queryFn: async ({ pageParam }) => {
          const url = new URL("/api/v1/plants", window.location.origin);
          if (pageParam && typeof pageParam === "string") url.searchParams.set("cursor", pageParam);
          url.searchParams.set("limit", "50");
          url.searchParams.set("sort", sort);
          const res = await fetch(url.toString(), { credentials: "include" });
          if (!res.ok) throw new Error(`plants_fetch_failed_${res.status}`);
          return (await res.json()) as PlantsPage;
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.next_cursor,
      });
    }
    ```

    **Step B: RSC catalog page** at `src/app/catalog/page.tsx`:
    ```tsx
    import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
    import { listPlants } from "@contexts/catalog/application/list-plants";
    import { requireUser } from "@shared/auth/require-user";
    import { CatalogGridClient } from "./catalog-grid-client";

    export default async function CatalogPage() {
      const user = await requireUser();  // Phase 2 D-32 helper, RSC variant
      const queryClient = new QueryClient();

      // Prefetch first page server-side. Catalog default sort = acquired_desc (CAT-07).
      // Since SSR cannot read sessionStorage, ALWAYS prefetch with default; client may
      // immediately refetch with stored sort key after hydration (acceptable tradeoff —
      // first paint shows default sort which matches CAT-07 anyway).
      await queryClient.prefetchInfiniteQuery({
        queryKey: ["plants", { sort: "acquired_desc" }],
        queryFn: async ({ pageParam }) =>
          listPlants({
            userId: user.id,
            sort: "acquired_desc",
            cursor: typeof pageParam === "string" ? pageParam : null,
            limit: 50,
          }),
        initialPageParam: null,
      });

      return (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <CatalogGridClient userId={user.id} />
        </HydrationBoundary>
      );
    }
    ```

    **Step C: Client island** at `src/app/catalog/catalog-grid-client.tsx`:
    ```tsx
    "use client";
    import { useCallback, useEffect, useRef, useState } from "react";
    import Link from "next/link";
    import Image from "next/image";
    import { useTranslations } from "next-intl";
    import { usePlants, type PlantListItem } from "@contexts/catalog/api/use-plants";
    import { useSortPreference, type SortKey } from "@contexts/catalog/api/use-sort-preference";
    import { useSubscription } from "@contexts/billing/api/use-subscription";

    export function CatalogGridClient({ userId }: { userId: string }) {
      const t = useTranslations("catalog");
      const [sort, setSort] = useSortPreference(userId);
      const { status } = useSubscription();
      const readOnly = status === "expired" || status === "grace";
      const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = usePlants(sort);

      const observerRef = useRef<IntersectionObserver | null>(null);
      const [sortAnnouncement, setSortAnnouncement] = useState("");

      const lastCardRef = useCallback(
        (node: HTMLDivElement | null) => {
          if (isFetchingNextPage) return;
          if (observerRef.current) observerRef.current.disconnect();
          observerRef.current = new IntersectionObserver(
            (entries) => {
              if (entries[0]?.isIntersecting && hasNextPage) fetchNextPage();
            },
            { rootMargin: "200px" },
          );
          if (node) observerRef.current.observe(node);
        },
        [isFetchingNextPage, hasNextPage, fetchNextPage],
      );

      useEffect(() => () => observerRef.current?.disconnect(), []);

      const allPlants = (data?.pages ?? []).flatMap((p) => p.data);
      const isEmpty = !isLoading && allPlants.length === 0;

      return (
        <main className="min-h-[100dvh] bg-[var(--paper-cream,#FBF7EF)] px-5 pb-24 pt-4 sm:px-5 lg:px-8">
          {/* Header */}
          <header className="mb-6 flex items-center justify-between">
            <h1 className="text-3xl font-medium font-serif text-[var(--forest-ink,#143424)]">
              {t("page.title")}
            </h1>
            {!readOnly && allPlants.length > 0 && (
              <Link
                href="/catalog/new"
                className="rounded-lg bg-[var(--canopy,#1F4D35)] px-4 py-2 text-base font-semibold text-[var(--warm-ivory,#FFFDF7)]"
              >
                {t("header.addPlantCta")}
              </Link>
            )}
          </header>

          {/* Sort control (hidden when empty) */}
          {!isEmpty && (
            <div className="mb-4 flex items-center gap-2">
              <label htmlFor="catalog-sort" className="text-sm text-[var(--calm-slate,#5A6358)]">
                {t("sort.label")}
              </label>
              <select
                id="catalog-sort"
                value={sort}
                onChange={(e) => {
                  const next = e.target.value as SortKey;
                  setSort(next);
                  setSortAnnouncement(t("sort.announcement", { option: t(`sort.options.${next}`) }));
                }}
                className="rounded-md border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-3 py-2 text-sm"
              >
                <option value="name_asc">{t("sort.options.name_asc")}</option>
                <option value="name_desc">{t("sort.options.name_desc")}</option>
                <option value="acquired_desc">{t("sort.options.acquired_desc")}</option>
                <option value="acquired_asc">{t("sort.options.acquired_asc")}</option>
                <option value="location_asc">{t("sort.options.location_asc")}</option>
              </select>
            </div>
          )}

          {/* Live region for sort announcement */}
          <div aria-live="polite" className="sr-only">{sortAnnouncement}</div>

          {/* Empty state (CAT-11) */}
          {isEmpty && (
            <section className="flex flex-col items-center gap-6 px-4 py-12 text-center">
              <svg
                aria-hidden="true"
                viewBox="0 0 120 120"
                width={120}
                height={120}
                fill="none"
                stroke="var(--understory-sage,#8AA593)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                {/* Minimal Sage line-art shelf with sprout */}
                <path d="M20 90 L100 90" />
                <path d="M30 90 L30 70 L50 70 L50 90" />
                <path d="M40 70 L40 55 Q40 45 50 45" />
                <path d="M50 45 Q60 45 60 55" />
              </svg>
              <h2 className="text-3xl font-medium font-serif text-[var(--forest-ink,#143424)]">
                {t("empty.headline")}
              </h2>
              <p className="text-base text-[var(--calm-slate,#5A6358)]">{t("empty.hint")}</p>
              <Link
                href="/catalog/new"
                className="rounded-lg bg-[var(--canopy,#1F4D35)] px-6 py-3 text-base font-semibold text-[var(--warm-ivory,#FFFDF7)]"
              >
                {t("empty.cta")}
              </Link>
            </section>
          )}

          {/* Grid (CAT-04 + CAT-10 + UI-07) */}
          {!isEmpty && (
            <ul
              className="grid gap-4"
              style={{
                gridTemplateColumns:
                  "repeat(2, minmax(0, 1fr))",
              }}
              data-testid="catalog-grid"
            >
              {/* Inline media query via CSS variable approach: simpler is to use a small <style> below or rely on a useMediaQuery hook. For now, compose Tailwind responsive prefixes which require the breakpoints to be configured (see decisions.responsive_grid_breakpoints). */}
              <style>{`
                @media (min-width: 600px) { [data-testid="catalog-grid"] { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
                @media (min-width: 900px) { [data-testid="catalog-grid"] { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
              `}</style>
              {allPlants.map((plant, i) => {
                const isLast = i === allPlants.length - 1;
                const altText = plant.nickname
                  ? t("card.alt.withNickname", { name: plant.name, nickname: plant.nickname })
                  : t("card.alt.nameOnly", { name: plant.name });
                return (
                  <li
                    key={plant.id}
                    ref={isLast ? (lastCardRef as never) : null}
                    className="rounded-2xl bg-[var(--warm-ivory,#FFFDF7)] p-4"
                    style={{ boxShadow: "0 2px 12px rgba(20,52,36,0.06)" }}
                  >
                    <Link href={`/catalog/${plant.id}`} className="block">
                      <div className="relative mb-3 aspect-[4/5] overflow-hidden rounded-xl bg-[var(--hairline,#D8D2C7)]">
                        {plant.coverPhotoUrl && (
                          <Image
                            src={plant.coverPhotoUrl}
                            alt={altText}
                            fill
                            sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw"
                            className="object-cover"
                          />
                        )}
                      </div>
                      <h3 className="text-xl font-medium font-serif text-[var(--forest-ink,#143424)]">
                        {plant.name}
                        {plant.nickname && (
                          <span className="ml-1 text-sm font-normal text-[var(--calm-slate,#5A6358)]">
                            ({plant.nickname})
                          </span>
                        )}
                      </h3>
                      <p className="mt-1 text-sm text-[var(--calm-slate,#5A6358)]">
                        {plant.location || t("card.metadata.noLocation")}
                      </p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Loading-more hint */}
          {isFetchingNextPage && (
            <p aria-live="polite" className="mt-6 text-center text-sm text-[var(--calm-slate,#5A6358)]">
              {t("loading.list")}
            </p>
          )}
        </main>
      );
    }
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.
    Run lint: `pnpm exec eslint src/app/catalog/ src/contexts/catalog/api/` exits 0.

    Commit: `git add src/contexts/catalog/api/use-plants.ts src/app/catalog/page.tsx src/app/catalog/catalog-grid-client.tsx && git commit -m "feat(05-15): catalog page (RSC + HydrationBoundary) + grid + sort + responsive"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "useInfiniteQuery" src/contexts/catalog/api/use-plants.ts | grep -qE "^[1-9]" &amp;&amp; grep -c "HydrationBoundary" src/app/catalog/page.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "useSubscription" src/app/catalog/catalog-grid-client.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - 3 source files exist
    - usePlants uses useInfiniteQuery with queryKey shape ["plants", { sort }]
    - Catalog page is RSC + HydrationBoundary + prefetch via listPlants use case
    - CatalogGridClient is "use client" with useInfiniteQuery + IntersectionObserver
    - Header CTA hidden via `!readOnly` gate
    - Empty state composition includes Sage SVG (aria-hidden) + headline + hint + single CTA
    - Sort dropdown writes sessionStorage + announces via aria-live
    - Cards use 4:5 aspect-ratio + Warm Ivory bg + 16px radius
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-15):`
  </done>
</task>

<task type="auto">
  <name>Task 3: Playwright E2E suites (responsive grid, empty state, sort persistence, card geometry, axe-core)</name>
  <files>tests/e2e/catalog/grid-responsive.spec.ts, tests/e2e/catalog/empty-catalog.spec.ts, tests/e2e/catalog/sort-persistence.spec.ts, tests/e2e/catalog/card-geometry.spec.ts</files>
  <read_first>
    - tests/helpers/playwright-auth-bypass.ts (Plan 05-01)
    - tests/helpers/axe-helper.ts (Plan 05-01)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md rows CAT-04 e2e, CAT-08 e2e, CAT-10 e2e + a11y, CAT-11 e2e, UI-07 e2e
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md visual specs
    - tests/e2e/diagnostics-posthog.spec.ts (Phase 1 — Playwright fixture style)
  </read_first>
  <action>
    **Note on auth fixture status:** `tests/helpers/playwright-auth-bypass.ts` from Plan 05-01 is a CONTRACT STUB that throws until Phase 4 lands AuthAdapter. These E2E specs will THEREFORE skip via `test.skipIf(!process.env.PHASE_4_AUTH_READY)` until Phase 4 ships. Skipping is the documented planned-not-yet-executable contract — specs land NOW so they're ready to run once upstream is on disk.

    Author all 4 spec files. Each begins with the auth-fixture-readiness skip. Sample structure:

    `tests/e2e/catalog/grid-responsive.spec.ts`:
    ```ts
    import { test, expect } from "@playwright/test";
    import { expectNoA11yViolations } from "../../helpers/axe-helper";
    import { createVerifiedUserSession } from "../../helpers/playwright-auth-bypass";

    test.describe("Catalog grid responsive (CAT-10 + CAT-04)", () => {
      test.skip(!process.env.PHASE_4_AUTH_READY, "auth fixture stub until Phase 4");

      test("renders 2 cols at viewport 375", async ({ page }) => {
        await createVerifiedUserSession(page);
        await page.setViewportSize({ width: 375, height: 800 });
        await page.goto("/catalog");
        const grid = page.getByTestId("catalog-grid");
        await expect(grid).toBeVisible();
        const cs = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        expect(cs.split(" ").length).toBe(2);
      });

      test("renders 3 cols at viewport 600", async ({ page }) => {
        await createVerifiedUserSession(page);
        await page.setViewportSize({ width: 600, height: 800 });
        await page.goto("/catalog");
        const grid = page.getByTestId("catalog-grid");
        const cs = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        expect(cs.split(" ").length).toBe(3);
      });

      test("renders 4 cols at viewport 900", async ({ page }) => {
        await createVerifiedUserSession(page);
        await page.setViewportSize({ width: 900, height: 800 });
        await page.goto("/catalog");
        const grid = page.getByTestId("catalog-grid");
        const cs = await grid.evaluate((el) => getComputedStyle(el).gridTemplateColumns);
        expect(cs.split(" ").length).toBe(4);
      });

      test("axe-core scan at 375 viewport returns 0 violations", async ({ page }) => {
        await createVerifiedUserSession(page);
        await page.setViewportSize({ width: 375, height: 800 });
        await page.goto("/catalog");
        await expectNoA11yViolations(page);
      });

      test("axe-core scan at 900 viewport returns 0 violations", async ({ page }) => {
        await createVerifiedUserSession(page);
        await page.setViewportSize({ width: 900, height: 800 });
        await page.goto("/catalog");
        await expectNoA11yViolations(page);
      });
    });
    ```

    `tests/e2e/catalog/empty-catalog.spec.ts`:
    ```ts
    import { test, expect } from "@playwright/test";
    import { createVerifiedUserSession } from "../../helpers/playwright-auth-bypass";

    test.describe("Empty Catalog (CAT-11 + UI-04 wording)", () => {
      test.skip(!process.env.PHASE_4_AUTH_READY, "auth fixture stub until Phase 4");

      test("renders Sage illustration + headline + Canopy CTA when zero plants", async ({ page }) => {
        await createVerifiedUserSession(page, { plantsCount: 0 });
        await page.goto("/catalog");
        await expect(page.getByText("Sua estante ainda está esperando a primeira planta.")).toBeVisible();
        await expect(page.getByRole("link", { name: "Adicionar planta" })).toBeVisible();
        // Sage illustration is aria-hidden; check it exists in DOM
        const svgs = await page.locator("svg[aria-hidden='true']").count();
        expect(svgs).toBeGreaterThan(0);
        // Header "+ Planta" CTA NOT visible when empty (per UI-SPEC line 172)
        await expect(page.getByRole("link", { name: "+ Planta" })).toHaveCount(0);
      });
    });
    ```

    `tests/e2e/catalog/sort-persistence.spec.ts`:
    ```ts
    import { test, expect } from "@playwright/test";
    import { createVerifiedUserSession } from "../../helpers/playwright-auth-bypass";

    test.describe("Sort persistence (CAT-08 + D-08)", () => {
      test.skip(!process.env.PHASE_4_AUTH_READY, "auth fixture stub until Phase 4");

      test("sort selection persists across reload within session", async ({ page }) => {
        const { userId } = await createVerifiedUserSession(page, { plantsCount: 5 });
        await page.goto("/catalog");
        await page.selectOption("#catalog-sort", "name_asc");
        await page.reload();
        const selected = await page.locator("#catalog-sort").inputValue();
        expect(selected).toBe("name_asc");
        // Verify storage key shape
        const key = await page.evaluate((uid) => sessionStorage.getItem(`folhario:catalog:sort:${uid}`), userId);
        expect(key).toBe("name_asc");
      });

      test("different user sees default sort (per-userId isolation)", async ({ browser }) => {
        const c1 = await browser.newContext();
        const p1 = await c1.newPage();
        await createVerifiedUserSession(p1, { plantsCount: 5, userIdOverride: "user-1" });
        await p1.goto("/catalog");
        await p1.selectOption("#catalog-sort", "name_asc");

        const c2 = await browser.newContext();
        const p2 = await c2.newPage();
        await createVerifiedUserSession(p2, { plantsCount: 5, userIdOverride: "user-2" });
        await p2.goto("/catalog");
        const u2sort = await p2.locator("#catalog-sort").inputValue();
        expect(u2sort).toBe("acquired_desc");

        await c1.close();
        await c2.close();
      });
    });
    ```

    `tests/e2e/catalog/card-geometry.spec.ts`:
    ```ts
    import { test, expect } from "@playwright/test";
    import { createVerifiedUserSession } from "../../helpers/playwright-auth-bypass";

    test.describe("Catalog card geometry (UI-07 + UI-SPEC § Catalog grid card)", () => {
      test.skip(!process.env.PHASE_4_AUTH_READY, "auth fixture stub until Phase 4");

      test("first card has 4:5 photo aspect ratio + 16px radius", async ({ page }) => {
        await createVerifiedUserSession(page, { plantsCount: 1 });
        await page.goto("/catalog");
        const card = page.getByTestId("catalog-grid").locator("li").first();
        await expect(card).toBeVisible();
        const radius = await card.evaluate((el) => getComputedStyle(el).borderTopLeftRadius);
        expect(radius).toBe("16px");

        const photo = card.locator("div").first();
        const aspectRatio = await photo.evaluate((el) => {
          const cs = getComputedStyle(el);
          return cs.aspectRatio || `${parseFloat(cs.width) / parseFloat(cs.height)}`;
        });
        // 4:5 = 0.8 either as numeric or as "4 / 5" CSS aspect-ratio
        expect(aspectRatio).toMatch(/4\s*\/\s*5|0\.8/);
      });

      test("card displays name + nickname (parens) + location (Calm Slate)", async ({ page }) => {
        await createVerifiedUserSession(page, {
          plants: [{ name: "Samambaia", nickname: "Maria", location: "Sala" }],
        });
        await page.goto("/catalog");
        const card = page.getByTestId("catalog-grid").locator("li").first();
        await expect(card.locator("h3")).toContainText("Samambaia");
        await expect(card.locator("h3")).toContainText("(Maria)");
        await expect(card.locator("p")).toContainText("Sala");
      });
    });
    ```

    Run: `pnpm exec playwright test tests/e2e/catalog/grid-responsive.spec.ts tests/e2e/catalog/empty-catalog.spec.ts tests/e2e/catalog/sort-persistence.spec.ts tests/e2e/catalog/card-geometry.spec.ts`
    Expected: tests SKIP (auth fixture not ready). Run as smoke that the spec syntax is valid (Playwright doesn't error during collection).

    Commit: `git add tests/e2e/catalog/grid-responsive.spec.ts tests/e2e/catalog/empty-catalog.spec.ts tests/e2e/catalog/sort-persistence.spec.ts tests/e2e/catalog/card-geometry.spec.ts && git commit -m "test(05-15): Playwright E2E (grid responsive + empty + sort + card geometry + axe)"`
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/catalog/grid-responsive.spec.ts tests/e2e/catalog/empty-catalog.spec.ts tests/e2e/catalog/sort-persistence.spec.ts tests/e2e/catalog/card-geometry.spec.ts --list 2>&amp;1 | grep -qE "[0-9]+ tests in [0-9]+ files"</automated>
  </verify>
  <done>
    - 4 spec files exist
    - Each guards with `test.skip(!process.env.PHASE_4_AUTH_READY, ...)` so they don't fail until upstream lands
    - Playwright `--list` succeeds (collects tests without syntax errors)
    - Commit prefix `test(05-15):`
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → API | Authenticated via per-device JWT; RLS enforced server-side (Plan 05-08 + Phase 2 D-22) |
| sessionStorage → React state | Per-user sort key; tampering only affects user's own UX |
| useSubscription gate → CTA visibility | UX gate, NOT security; server-side mutation enforcement is the load-bearing defense |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-15-01 | Tampering | User flips read-only mode in DevTools (sets NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS) to bypass UI gating | accept | UI gate is UX. Server-side mutating endpoints enforce read_only_mode (Plan 05-09 + Phase 10). T-5b-11-01 already documented this in Plan 05-11. |
| T-5b-15-02 | Information Disclosure | sessionStorage sort key visible in DevTools | accept | Sort preference is non-sensitive metadata (no PII, no business secret). Per-user keying prevents leak between users on same device. |
| T-5b-15-03 | XSS | Plant name / nickname / location rendered in card | mitigate | React JSX text-node interpolation auto-escapes. No `dangerouslySetInnerHTML`. Plant name capped at 80 chars + nickname at 40 + location at 40 by Plan 05-04 schema (Phase 5a). |
| T-5b-15-04 | Information Disclosure | Sentry breadcrumb leaks photo_url on plant card render | mitigate | Phase 1 LGPD-13 scrub module (Plan 01-05a) drops sensitive request fields globally. coverPhotoUrl is a Supabase signed URL — already public-by-design within session lifetime. Sentry user scope = `setUser({ id })` only per CONTEXT § Established Patterns. |
| T-5b-15-05 | Spoofing | Tampered sessionStorage value triggers TQ refetch with attacker-controlled sort | mitigate | useSortPreference validates against VALID_SORTS Set; invalid values fall back to default. Server-side route handler ALSO validates `?sort=` against the same enum (Plan 05-08 frontmatter). Defense in depth. |

</threat_model>

<verification>
- `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/use-sort-preference.test.ts` — 6 green
- `pnpm exec tsc --noEmit` — exits 0
- `grep -c useInfiniteQuery src/contexts/catalog/api/use-plants.ts` ≥ 1
- `grep -c HydrationBoundary src/app/catalog/page.tsx` ≥ 1
- `grep -c useSubscription src/app/catalog/catalog-grid-client.tsx` ≥ 1
- `grep -c "data-testid=\"catalog-grid\"" src/app/catalog/catalog-grid-client.tsx` ≥ 1
- `grep -c 'aria-live="polite"' src/app/catalog/catalog-grid-client.tsx` ≥ 1
- Playwright suites collect without syntax errors via `--list`
- pt-BR.json keys grep-verify each i18n key consumed: `node -e "const m=require('./src/messages/pt-BR.json').catalog; for (const k of ['page.title','header.addPlantCta','empty.headline','empty.cta','sort.label','sort.options.name_asc','sort.announcement','card.metadata.noLocation','card.alt.withNickname','card.alt.nameOnly','loading.list']) { const v = k.split('.').reduce((o,p)=>o&amp;&amp;o[p],m); if (!v) { console.error('MISSING catalog.'+k); process.exit(1); } }"`
</verification>

<success_criteria>
- `useSortPreference` hook ships with TDD coverage (D-08 verified)
- Catalog page renders RSC + HydrationBoundary + client island per Pattern 1
- Responsive grid 2/3/4 cols at 375/600/900 (CAT-10)
- Empty state composition matches CAT-11 + UI-SPEC verbatim
- Sort dropdown wired to sessionStorage + TQ refetch (CAT-08)
- Header "+ Planta" CTA hidden in read-only mode (D-24)
- Card geometry matches UI-07 + UI-SPEC § Catalog card
- 6 unit tests + 4 E2E specs (~15 tests) authored
- 6 requirement IDs covered (CAT-04 partial, CAT-07, CAT-08, CAT-10, CAT-11, UI-07)
- Commits prefixed `test(05-15):` (RED + E2E), `feat(05-15):` (GREEN)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-15-SUMMARY.md` summarizing:
- Final approach to responsive breakpoints (Tailwind config override vs inline `<style>` per `decisions.responsive_grid_breakpoints`)
- Loading skeleton 300ms-delay treatment (PRD §17 — deferred or implemented; document tradeoff)
- Confirmed `data-testid` attributes (`catalog-grid`) so consumer plans can locate them in their own E2E suites
- Note for Plan 05-16 Plant Profile: this plan does NOT modify `src/app/layout.tsx` — provider wrap was done by 05-10
- Number of unit tests landed (6) + E2E specs (~15)
- Auth-fixture-readiness skip: all E2E tests skip until Phase 4 ships AuthAdapter; once available, set PHASE_4_AUTH_READY=1 in CI
</output>
</content>
</invoke>