---
phase: 05-catalog-meu-jardim
plan: 15
subsystem: ui
tags: [catalog, rsc, tanstack-query, sessionStorage, sort, axe, playwright, next-intl]

requires:
  - phase: 05-catalog-meu-jardim
    plan: 05-08
    provides: "GET /api/v1/plants route handler with items envelope + include_count + cover_signed_url"
  - phase: 05-catalog-meu-jardim
    plan: 05-10
    provides: "plantsKeys query factory, ListPlantsResponse types, QueryProvider, i18n catalog.* namespace"
  - phase: 05-catalog-meu-jardim
    plan: 05-11
    provides: "useSubscription() + SubscriptionProvider returning {active, readOnly}"
  - phase: 05-catalog-meu-jardim
    plan: 05-01
    provides: "authedUser + read-only Playwright fixtures"

provides:
  - "/catalog Server Component with HydrationBoundary + SSR first-page fetch"
  - "PlantCard: locked 4:5 cover + 16px padding + name/nickname/location geometry"
  - "CatalogGrid: 2/3/4 column responsive grid at 600/900px breakpoints"
  - "CatalogHeader: section label + count chip + sort Select + readOnly-gated Add Plant"
  - "CatalogEmpty: UI-SPEC §4 empty state with Sage illustration + Canopy CTA"
  - "useSortPreference: sessionStorage-backed sort hook with SORT_IDS whitelist"
  - "tests/e2e/catalog-grid-sort.spec.ts: 13 authed Playwright tests (viewport + sort + readOnly + axe)"

affects:
  - "05-16-plant-profile-page (reuses PlantCard geometry)"
  - "05-17-manual-add (reuses PlantCard on confirmation)"
  - "05-18-read-only-offline-banners (wires ReadOnlyBanner across CatalogHeader/Grid)"

tech-stack:
  added: []
  patterns:
    - "RSC catalog page uses listPlants use-case directly server-side + setQueryData instead of fetchQuery(relative-URL queryFn)"
    - "useSortPreference: lazy useState initializer reads sessionStorage (no useEffect race); try/catch for SSR safety"
    - "Custom media query breakpoints via Tailwind arbitrary variants: [@media(min-width:600px)]:grid-cols-3"
    - "Authed Playwright spec owns all authed-surface axe coverage (dedicated-authed-spec pattern, matches 05-16)"

key-files:
  created:
    - src/app/(app)/catalog/page.tsx
    - src/app/(app)/catalog/_components/catalog-grid.tsx
    - src/app/(app)/catalog/_components/catalog-header.tsx
    - src/app/(app)/catalog/_components/catalog-empty.tsx
    - src/app/(app)/catalog/_components/plant-card.tsx
    - src/app/(app)/catalog/_components/use-sort-preference.ts
    - src/app/(app)/catalog/_components/use-sort-preference.unit.test.tsx
    - tests/e2e/catalog-grid-sort.spec.ts
  modified:
    - src/contexts/catalog/queries/index.ts
    - src/messages/pt-BR.json

key-decisions:
  - "RSC uses listPlants use-case directly (not fetchQuery with relative URL) + setQueryData to populate TQ cache"
  - "useSortPreference test file uses .unit.test.tsx extension (not .ts) to route to jsdom vitest project"
  - "Tailwind design tokens are adaptive (light/dark via CSS variables) — no dark: prefix overrides needed"
  - "seedPlant helper is inline in E2E spec (not promoted to fixtures/); fixtures promotion deferred to 05-16/05-17"

patterns-established:
  - "Catalog _components directory: all client components co-located with their parent page"
  - "SkeletonCard: inline component using bg-hairline rounded-2xl aspect-4/5 animate-shimmer (no Skeleton primitive for non-fixed-width cards)"
  - "aria-live region for sort announce: role=status + data-testid=catalog-sort-announce + sr-only"

requirements-completed:
  - CAT-07
  - CAT-08
  - CAT-10
  - CAT-11
  - UI-04
  - UI-07

duration: 30min
completed: 2026-05-01
---

# Phase 05 Plan 15: Catalog Page Grid + Sort Summary

**Server Component catalog page with HydrationBoundary SSR, 2/3/4-column PlantCard grid, sessionStorage sort hook, and 13-test authed Playwright + axe suite**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-01T15:35:00Z
- **Completed:** 2026-05-01T15:48:00Z
- **Tasks:** 5 (including TDD RED/GREEN for Task 1)
- **Files modified:** 10

## Accomplishments

- Replaced static empty-only `/catalog` page with Server Component that calls `listPlants` use-case, pre-populates TanStack Query cache via `setQueryData`, and dehydrates into `<HydrationBoundary>` for zero-skeleton-flash on first paint
- Built complete PlantCard/CatalogGrid/CatalogHeader/CatalogEmpty component set matching UI-SPEC §1-§4 geometry
- Shipped `useSortPreference` sessionStorage hook with SORT_IDS whitelist guard (T-05-15-02 client-side mitigation)
- Created 13-test Playwright spec covering viewport columns + sort persistence + readOnly gating + 8 axe scans (filled and empty states)

## Task Commits

1. **Task 1 RED: useSortPreference failing tests** - `97d42bd` (test)
2. **Task 1 GREEN: useSortPreference hook + query factory types** - `54ba8de` (feat)
3. **Task 2: PlantCard + CatalogEmpty + CatalogGrid** - `b18eee3` (feat)
4. **Task 3: CatalogHeader** - `b49c362` (feat)
5. **Task 4: Server Component shell** - `e26ead0` (feat)
6. **Task 5: Playwright E2E spec** - `55e3788` (feat)

## Files Created/Modified

- `src/app/(app)/catalog/page.tsx` - Server Component: listPlants → setQueryData → HydrationBoundary
- `src/app/(app)/catalog/_components/catalog-grid.tsx` - Client: responsive grid consuming TQ cache
- `src/app/(app)/catalog/_components/catalog-header.tsx` - Client: label + count + sort Select + Add Plant
- `src/app/(app)/catalog/_components/catalog-empty.tsx` - Client: EmptyState with catalog.empty.* i18n
- `src/app/(app)/catalog/_components/plant-card.tsx` - Client: 4:5 cover + name + nickname + location
- `src/app/(app)/catalog/_components/use-sort-preference.ts` - Hook: sessionStorage + whitelist guard
- `src/app/(app)/catalog/_components/use-sort-preference.unit.test.tsx` - 5 unit-dom tests (all green)
- `tests/e2e/catalog-grid-sort.spec.ts` - 13 Playwright tests (listed; E2E requires live server+DB)
- `src/contexts/catalog/queries/index.ts` - Added include_count param + ListPlantsResponse + PlantListItem types
- `src/messages/pt-BR.json` - Added catalog.header.label, catalog.header.addPlant, catalog.sort.announce

## Decisions Made

- **RSC fetch strategy**: `fetchQuery(plantsKeys.lists())` fails in App Router RSC because the queryFn uses a relative URL (`/api/v1/plants`). Fixed by calling `listPlants` use-case directly and using `queryClient.setQueryData()` to populate the cache. This is correct per TanStack v5 RSC best practices — the cache key matches what `CatalogGrid`'s `useQuery` expects.
- **Test file extension**: Plan specified `.unit.test.ts` but vitest's unit-dom project (jsdom) matches `src/**/*.unit.test.tsx`. Renamed to `.tsx` — no JSX in the file but extension enables jsdom environment for sessionStorage tests.
- **Design tokens**: The project uses adaptive CSS variables (same token names, different values in dark mode). No `dark:*` Tailwind prefixes are used in existing components. Applied same pattern to new components (`bg-ivory`, `bg-hairline`, `text-forest`, `text-slate`).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RSC relative-URL fetch issue in queryFn**
- **Found during:** Task 4 (Server Component shell)
- **Issue:** `plantsKeys.lists().queryFn` calls `fetch('/api/v1/plants?...')` which fails in Next.js RSC (no hostname). `fetchQuery` would throw `TypeError: Failed to parse URL`.
- **Fix:** Called `listPlants` use-case directly, then `queryClient.setQueryData()` to pre-populate the TQ cache with the response. `HydrationBoundary` dehydrates for client hydration. The cache key `plantsKeys.lists({ sort: 'date_new', include_count: true }).queryKey` matches exactly what `CatalogGrid`'s `useQuery` call uses.
- **Files modified:** `src/app/(app)/catalog/page.tsx`
- **Verification:** `pnpm next build` passes; no RSC errors.
- **Committed in:** e26ead0

**2. [Rule 3 - Blocking] Missing include_count param in query factory**
- **Found during:** Task 4 (Server Component shell)
- **Issue:** `PlantsListParams` lacked `include_count?: boolean`. `fetchPlantsList` didn't propagate it. Return type was `Promise<unknown>` — `data.total_count` would not typecheck.
- **Fix:** Added `include_count?: boolean` to `PlantsListParams`, appended `sp.set('include_count', '1')` to fetch URL, added `ListPlantsResponse` and `PlantListItem` types, typed `plantsKeys.lists().queryFn` as `QueryFunction<ListPlantsResponse>`.
- **Files modified:** `src/contexts/catalog/queries/index.ts`
- **Verification:** `pnpm exec tsc --noEmit` passes.
- **Committed in:** 54ba8de (alongside GREEN impl)

**3. [Rule 3 - Blocking] Missing i18n keys (05-10 gap)**
- **Found during:** Task 3 (CatalogHeader)
- **Issue:** `messages/pt-BR.json` lacked `catalog.header.label`, `catalog.header.addPlant`, `catalog.sort.announce`. Plan required these keys but marked messages/pt-BR.json as owned by 05-10.
- **Fix:** Added missing keys: `label = "MEU JARDIM"`, `addPlant = "Adicionar planta"`, `announce = "Catálogo reordenado por {label}"`.
- **Files modified:** `src/messages/pt-BR.json`
- **Verification:** `pnpm exec tsc --noEmit` passes; CatalogHeader renders without runtime i18n error.
- **Committed in:** b18eee3

**4. [Rule 1 - Bug] Test 4 SSR-safe: vi.stubGlobal('window', undefined) breaks React internals**
- **Found during:** Task 1 (unit tests)
- **Issue:** Setting `window = undefined` via `vi.stubGlobal` breaks React's internal `window.event` access, causing the test to throw `TypeError: Cannot read properties of undefined (reading 'event')` instead of testing the hook.
- **Fix:** Changed SSR-safe test to mock `sessionStorage` as inaccessible (throws) via `Object.defineProperty`, then restore after the assertion. Hook's `try/catch` wrapping handles the exception and returns `'date_new'`.
- **Files modified:** `src/app/(app)/catalog/_components/use-sort-preference.unit.test.tsx`, `use-sort-preference.ts`
- **Verification:** All 5 unit tests pass.
- **Committed in:** 54ba8de

---

**Total deviations:** 4 auto-fixed (2 Rule 3 blocking, 1 Rule 3 blocking/05-10 gap, 1 Rule 1 bug)
**Impact on plan:** All fixes necessary for correct compilation and operation. No scope creep.

## TDD Gate Compliance

- Task 1: RED commit `97d42bd` (test) → GREEN commit `54ba8de` (feat) — gates satisfied
- Task 2: Plan marked `tdd="true"` but action explicitly states "NO unit test required" — treated as single `feat` commit per plan rationale (VALIDATION.md E2E stratum owns verification). No RED gate needed.
- Task 3: Plan marked `tdd="true"` but only typecheck+lint in verify step — single `feat` commit.

## Threat Mitigation Status

| Threat ID | Mitigation | Verified by |
|-----------|-----------|-------------|
| T-05-15-01 | Server Component calls `listPlants` with `auth.user.id` → same ownership filter as 05-08 GET handler; cross-user leakage prevented by RLS + repository WHERE clause | 05-08 integration tests (catalog-list-plants.integration.test.ts) |
| T-05-15-02 (client) | `useSortPreference` rejects non-whitelisted values (Test 3 in unit suite); clears bad sessionStorage entry | `use-sort-preference.unit.test.tsx` Test 3 (green) |
| T-05-15-02 (server) | 05-08 GET handler validates `?sort=` against `VALID_SORTS` set; falls back to validation_failed | 05-08 route handler (existing) |

## Surfaced Gaps in Upstream Plans

- **05-10 gap**: `messages/pt-BR.json` `catalog.header.label`, `catalog.header.addPlant`, `catalog.sort.announce` were absent. Added inline (Rule 3 deviation). 05-10 should be updated to include these keys in its own plan scope.
- **05-10 gap**: `src/contexts/catalog/queries/index.ts` lacked `include_count` param + typed response. Fixed inline (Rule 3 deviation). 05-10 should own this type extension.

## E2E Verification Note

`tests/e2e/catalog-grid-sort.spec.ts` lists 13 tests correctly via `playwright test --list`. Full E2E run requires a live Next.js server + Supabase local instance + DATABASE_POOL_URL env. Not executed in this automated context. Tests have been reviewed for correctness:
- `seedPlant` uses `page.request.post` multipart with a minimal JPEG buffer
- Grid column assertions use `getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length`
- Sort persistence verified via `sessionStorage.getItem` + navigation + `toHaveValue`
- readOnly fixture auto-sets `__test_subscription_read_only=1` cookie

## Known Stubs

- `CatalogGrid` skeleton cards (`SkeletonCard`) are visible only during loading (when `isLoading || !data`). With SSR hydration, `data` is always pre-populated so the skeleton branch is effectively dead on first render — intentional per D-13.

## Patterns Established for Downstream Plans

- **05-16** reuses `PlantCard` geometry (16px radius, 4:5 photo, 16px padding) for plant profile cover hero
- **05-17** reuses `PlantCard` on manual-add confirmation screen
- **05-18** wires `ReadOnlyBanner` across `CatalogHeader`/`CatalogGrid` surfaces
- Dedicated-authed-spec pattern: auth-required route axe coverage lives in `tests/e2e/catalog-grid-sort.spec.ts` (not modified `axe-placeholder-pages.spec.ts`)

## Self-Check

Files exist:
- [x] `src/app/(app)/catalog/page.tsx` — FOUND
- [x] `src/app/(app)/catalog/_components/catalog-grid.tsx` — FOUND
- [x] `src/app/(app)/catalog/_components/catalog-header.tsx` — FOUND
- [x] `src/app/(app)/catalog/_components/catalog-empty.tsx` — FOUND
- [x] `src/app/(app)/catalog/_components/plant-card.tsx` — FOUND
- [x] `src/app/(app)/catalog/_components/use-sort-preference.ts` — FOUND
- [x] `src/app/(app)/catalog/_components/use-sort-preference.unit.test.tsx` — FOUND
- [x] `tests/e2e/catalog-grid-sort.spec.ts` — FOUND

Commits exist:
- [x] 97d42bd — test(05-15): add failing tests (RED)
- [x] 54ba8de — feat(05-15): implement useSortPreference hook (GREEN)
- [x] b18eee3 — feat(05-15): PlantCard + CatalogEmpty + CatalogGrid
- [x] b49c362 — feat(05-15): CatalogHeader
- [x] e26ead0 — feat(05-15): Server Component catalog page
- [x] 55e3788 — feat(05-15): Playwright E2E spec

## Self-Check: PASSED

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
