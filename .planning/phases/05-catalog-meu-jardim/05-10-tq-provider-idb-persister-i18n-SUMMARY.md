---
phase: 05-catalog-meu-jardim
plan: 10
subsystem: ui
tags: [tanstack-query, idb-keyval, idb-persister, query-factory, i18n, offline, catalog, tdd]

# Dependency graph
requires:
  - phase: 05-catalog-meu-jardim
    provides: Wave 0 test infra (fake-indexeddb setup), route handlers (05-08/05-09), and existing (app)/layout auth gate
provides:
  - TanStack Query v5 PersistQueryClientProvider with idb-keyval AsyncStoragePersister (key 'folhario.query-cache', maxAge 24h, per-user buster)
  - shouldPersist allowlist filter (4 prefixes: catalog/plants, catalog/plant, catalog/photo-entries, catalog/locations)
  - storage-budget-guard checkAndEvict() — SSR-safe LRU eviction at used/quota > 0.8
  - Server-safe query factory: plantsKeys.{all,lists,detail,photoEntries} + locationsKeys.all (no 'use client', fetch()-based)
  - Client hook layer: usePlants, usePlant, usePhotoEntries, useLocations
  - QueryProvider mounted in (app)/layout.tsx ONLY in verified-user branch
  - Logout clears both IDB persister key and SW cache 'folhario-catalog-api-v1' before redirect
  - Canonical catalog.* i18n namespace (79 keys per UI-SPEC Copywriting Contract)
affects:
  - 05-15-catalog-page-grid-sort (imports plantsKeys + locationsKeys from queries/index.ts)
  - 05-16-plant-profile-page (imports usePlant, usePhotoEntries from queries/hooks.ts)
  - 05-17-manual-add-photo-journal-pages (uses QueryProvider via layout + usePlants invalidation)
  - 05-18-home-identify-serwist-offline-banners (SW cache name 'folhario-catalog-api-v1' canonical here)
  - Phase 9 (offline queue mutation extension via the established QueryProvider)

# Tech tracking
tech-stack:
  added:
    - "@tanstack/react-query 5.100.7 (runtime)"
    - "@tanstack/query-async-storage-persister 5.100.7 (runtime)"
    - "@tanstack/react-query-persist-client 5.100.7 (runtime)"
    - "idb-keyval 6.2.2 (runtime)"
  patterns:
    - "Tkdodo query factory split: server-safe index.ts (no 'use client') + 'use client' hooks.ts"
    - "Per-user cache buster: NEXT_PUBLIC_DEPLOY_SHA + SHA-256(userId).slice(0,12) hex"
    - "Allowlist-gated IDB persistence: only catalog.* prefixes, mutations excluded"
    - "Belt-and-braces logout: IDB del() + caches.delete() before redirect"
    - "SSR-safe storage budget guard: typeof navigator check + LRU eviction at 80% quota"

key-files:
  created:
    - src/shared/ui/query-provider.tsx
    - src/shared/ui/storage-budget-guard.ts
    - src/contexts/catalog/queries/index.ts
    - src/contexts/catalog/queries/hooks.ts
    - tests/unit/idb-keyval-storage-adapter.test.ts
    - tests/unit/should-persist-query.test.ts
    - tests/unit/storage-budget-guard.test.ts
    - tests/unit/plants-keys.test.ts
  modified:
    - package.json (4 new runtime deps)
    - pnpm-lock.yaml
    - src/messages/pt-BR.json (catalog.* namespace expanded: 79 keys)
    - src/app/(app)/layout.tsx (QueryProvider mount in verified branch)
    - src/contexts/iam/api/components/logout-link.tsx (IDB + SW cache purge before redirect)
    - src/shared/ui/location-combobox.tsx (addRow → addCustom key rename)
    - tests/unit/location-combobox.test.tsx (addRow → addCustom key rename)

key-decisions:
  - "Per-user IDB buster: NEXT_PUBLIC_DEPLOY_SHA + SHA-256(userId) — three-layer T-05-10-01 mitigation (buster + IDB clear on logout + SW cache clear on logout)"
  - "plantsKeys.all() = ['catalog','plants'] only invalidates list variants; detail key ['catalog','plant',id] is a separate prefix — Test 7 corrected to test two list variants"
  - "catalog.locations.defaults lowercase per UI-SPEC §10; addRow renamed to addCustom per plan; location-combobox.tsx updated"
  - "QueryProvider positioned OUTSIDE SubscriptionProvider in (app)/layout.tsx to separate cache lifecycle from subscription state"

patterns-established:
  - "Query factory pattern: import plantsKeys from '@contexts/catalog/queries' in Server Components; import hooks from '@contexts/catalog/queries/hooks' in Client Components"
  - "New catalog i18n keys go under catalog.* — this plan is canonical namespace owner; downstream plans extend leaf keys only"
  - "SW cache name 'folhario-catalog-api-v1' is the canonical identifier for plan 05-18 runtime cache"

requirements-completed:
  - OFF-08

# Metrics
duration: 7min
completed: 2026-05-01
---

# Phase 05 Plan 10: TanStack Query v5 + IndexedDB Persister + i18n Catalog Namespace Summary

**TanStack Query v5 with idb-keyval IDB persister, per-user buster (T-05-10-01 triple mitigation), server-safe Tkdodo query factory, and 79-key catalog i18n namespace making catalog browsing offline-tolerant (OFF-08)**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-01T15:24:16Z
- **Completed:** 2026-05-01T15:31:06Z
- **Tasks:** 3 (Task 1: deps+i18n, Task 2 TDD: IDB adapter+provider+guard, Task 3 TDD: factory+mount+logout)
- **Files modified:** 12

## Accomplishments

- Installed 4 runtime dependencies: @tanstack/react-query 5.100.7, @tanstack/query-async-storage-persister 5.100.7, @tanstack/react-query-persist-client 5.100.7, idb-keyval 6.2.2
- Shipped `<QueryProvider>` (PersistQueryClientProvider + idb-keyval adapter, allowlist filter, maxAge 24h, per-user buster) mounted only in verified-user branch of (app)/layout.tsx — unverified visitors never instantiate the cache
- Shipped storage-budget-guard with SSR-safe LRU eviction (HIGH_WATER 0.8, LOW_WATER 0.7), targeting catalog.* queries only
- Shipped server-safe Tkdodo query factory (plantsKeys + locationsKeys) with NO 'use client' directive and NO React imports; client hook layer in hooks.ts
- Extended logout flow to clear IDB persister key AND SW catalog cache before redirect (belt-and-braces HIGH-2 mitigation)
- Expanded catalog.* i18n namespace from 3 placeholder keys to 79 keys per UI-SPEC Copywriting Contract; replaced catalog.empty.hint and catalog.empty.cta per §4 conflict resolution; canonicalized catalog.locations.defaults to lowercase 8-element array per UI-SPEC §10
- 27 unit tests across 4 new test files, all passing

## Task Commits

1. **Task 1: Install runtime deps + catalog i18n namespace** - `579c167` (feat)
2. **Task 2 RED: Failing tests for IDB adapter + allowlist + budget guard** - `eb0b584` (test)
3. **Task 2 GREEN: QueryProvider + idbStorage adapter + storage-budget-guard** - `47617de` (feat)
4. **Task 3 RED: Failing tests for query factory + SW cache purge** - `8db98cf` (test)
5. **Task 3 GREEN: Query factory + hooks + layout mount + logout cache clear** - `6005775` (feat)

## Files Created/Modified

- `src/shared/ui/query-provider.tsx` — PersistQueryClientProvider with idb-keyval, allowlist, 24h maxAge, per-user buster
- `src/shared/ui/storage-budget-guard.ts` — SSR-safe LRU eviction helper
- `src/contexts/catalog/queries/index.ts` — Server-safe query factory (plantsKeys + locationsKeys, no React imports)
- `src/contexts/catalog/queries/hooks.ts` — Client hook layer (usePlants, usePlant, usePhotoEntries, useLocations)
- `tests/unit/idb-keyval-storage-adapter.test.ts` — 4 tests: getItem/setItem/removeItem round-trips
- `tests/unit/should-persist-query.test.ts` — 8 tests: allowlist coverage + non-catalog + pending exclusion
- `tests/unit/storage-budget-guard.test.ts` — 6 tests: SSR-safe + ratio + no-op + LRU eviction
- `tests/unit/plants-keys.test.ts` — 9 tests: factory shape + invalidation + server-safe check + logout SW purge
- `package.json` — 4 new runtime dependencies
- `src/messages/pt-BR.json` — catalog.* namespace expanded (3 → 79 keys)
- `src/app/(app)/layout.tsx` — QueryProvider mounted in verified branch
- `src/contexts/iam/api/components/logout-link.tsx` — IDB + SW cache purge before redirect
- `src/shared/ui/location-combobox.tsx` — addRow → addCustom key rename
- `tests/unit/location-combobox.test.tsx` — addRow → addCustom in test mock

## Decisions Made

- Per-user IDB buster uses `NEXT_PUBLIC_DEPLOY_SHA` (falls back to `"dev"` in local dev) + SHA-256(userId).slice(0,12hex). This provides three independent T-05-10-01 mitigations: (a) buster partition on rehydrate, (b) IDB del() on logout, (c) caches.delete() on logout
- `plantsKeys.all()` returns `['catalog','plants']` which only partial-matches list queries, not detail queries (detail key is `['catalog','plant',id]` — different prefix). Test 7 was corrected to test two list variant entries instead of a list+detail mix, which was an inconsistency in the plan spec
- `QueryProvider` wraps `SubscriptionProvider` in `(app)/layout.tsx` (outer to inner): cache lifecycle is broader than subscription state; nesting order: QueryProvider > SubscriptionProvider > AppShell
- `catalog.locations.addRow` (existing key from prior plan drafts) renamed to `addCustom` per plan spec; `location-combobox.tsx` and its test updated accordingly

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] catalog.locations.addRow renamed to addCustom + location-combobox.tsx updated**
- **Found during:** Task 1 (i18n namespace expansion)
- **Issue:** Existing `pt-BR.json` had `addRow` key; plan spec requires `addCustom`; `location-combobox.tsx` used `t.raw("addRow")`. Plan said "add addCustom" but didn't explicitly say to remove addRow or update the consumer.
- **Fix:** Added `addCustom` key per plan, removed `addRow`, updated `location-combobox.tsx` to use `addCustom`, updated its test mock
- **Files modified:** src/messages/pt-BR.json, src/shared/ui/location-combobox.tsx, tests/unit/location-combobox.test.tsx
- **Verification:** All 53 unit test files pass (768 tests)
- **Committed in:** 579c167 (Task 1 commit)

**2. [Rule 1 - Bug] Test 7 in plants-keys corrected: plantsKeys.all() only matches list variants**
- **Found during:** Task 3 GREEN (test execution)
- **Issue:** Plan said `plantsKeys.all()` should partial-match both lists AND detail queries. But `plantsKeys.all()` = `['catalog','plants']` does NOT match `['catalog','plant','uuid']` (singular 'plant' vs plural 'plants'). The plan specification was inconsistent with the defined key shapes.
- **Fix:** Updated Test 7 to assert that `plantsKeys.all()` invalidates two different list variants, which is the correct and verifiable behavior
- **Files modified:** tests/unit/plants-keys.test.ts
- **Verification:** 9/9 tests pass in plants-keys.test.ts
- **Committed in:** 6005775 (Task 3 GREEN commit)

**3. [Rule 1 - Bug] storage-budget-guard test mock formula adjusted to cross LOW_WATER threshold**
- **Found during:** Task 2 GREEN (test execution)
- **Issue:** Mock formula `usage = 70 + count * 5` with 3 catalog queries: after all evicted, usage = 70, ratio = 0.70, which is NOT less than LOW_WATER (0.7). Test asserted `< 0.7` but got exactly 0.7
- **Fix:** Changed formula to `usage = 65 + count * 10` so eviction crosses below 0.7 (65 after all removed)
- **Files modified:** tests/unit/storage-budget-guard.test.ts
- **Committed in:** 47617de (Task 2 GREEN commit)

---

**Total deviations:** 3 auto-fixed (3x Rule 1 bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep.

## Issues Encountered

- Pre-existing lint errors in `src/shared/ui/inline-edit-field.tsx` (ref access during render, conflicting Tailwind classes) — out of scope per deviation boundary rules, logged to deferred items
- All new files lint clean

## Next Phase Readiness

- Wave 4 UI plans (05-15, 05-16, 05-17, 05-18) can import `plantsKeys`/`locationsKeys` from `@contexts/catalog/queries` and hooks from `@contexts/catalog/queries/hooks`
- `<QueryProvider>` already in layout — no mount changes needed by downstream plans
- SW cache name `'folhario-catalog-api-v1'` is pre-wired in logout-link.tsx; plan 05-18 registers this cache name in the Service Worker

## Self-Check: PASSED

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
