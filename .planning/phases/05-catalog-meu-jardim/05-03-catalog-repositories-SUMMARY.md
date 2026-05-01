---
phase: 05-catalog-meu-jardim
plan: "03"
subsystem: database
tags: [catalog, repositories, drizzle, rls, cursor, locations, pending-deletions, tdd, plants, photo-entries]

requires:
  - phase: 05-catalog-meu-jardim
    plan: "02"
    provides: "Drizzle schema for pendingStorageDeletions + locationSuggestions, sort-aware cursor codec (encodeSortCursor/decodeSortCursor/SORT_IDS)"

provides:
  - "plants.ts: list (5 sort modes + cursor), create, update, deletePlant, countForUser, getCascadeCounts"
  - "photo-entries.ts: list (plantId, created_at ASC), deletePhotoEntry, bumpCoverFor (TransactionalDb-only)"
  - "pending-storage-deletions.ts: create, markInProgress, markCompleted, recordError, markFailed, fetchPendingBatch (DbClient-only)"
  - "location-suggestions.ts: upsert (ON CONFLICT diacritic-fold), listForUser"
  - "domain/locations.ts: normalizeLocationLabel (pt-BR NFD fold)"
  - "49 integration tests + 6 unit tests proving RLS, cursor, state-machine contracts"

affects:
  - "05-05-plant-create-use-cases"
  - "05-06-plant-delete-inngest-cleanup"
  - "05-07-patch-photo-entry-cover-use-cases"
  - "05-08-route-handlers-read-create"
  - "05-09-route-handlers-mutate-delete"

tech-stack:
  added: []
  patterns:
    - "functional repo modules: no class wrappers, each file exports named async functions"
    - "deletePlant / deletePhotoEntry naming convention (avoids JS reserved word `delete`)"
    - "bumpCoverFor accepts TransactionalDb only (strict type — not the union)"
    - "fetchPendingBatch accepts DbClient only (service-role discipline)"
    - "Drizzle FOR UPDATE SKIP LOCKED: .for('update', { skipLocked: true }) is the v0.45.2 API"
    - "NULLS LAST expressed via sql raw fragment: sql`${table.col} desc nulls last`"
    - "Cursor WHERE predicates built via sql template literal (not Drizzle operators) for NULLS-LAST boundary crossing"

key-files:
  created:
    - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
    - src/contexts/catalog/infrastructure/db/location-suggestions.ts
    - src/contexts/catalog/domain/locations.ts
    - tests/unit/catalog-locations-normalize.test.ts
    - tests/integration/catalog-plants-repo.integration.test.ts
    - tests/integration/catalog-photo-entries-repo.integration.test.ts
    - tests/integration/catalog-pending-storage-deletions-repo.integration.test.ts
    - tests/integration/catalog-location-suggestions-repo.integration.test.ts
  modified:
    - src/contexts/catalog/infrastructure/db/plants.ts
    - src/contexts/catalog/infrastructure/db/photo-entries.ts

key-decisions:
  - "deletePlant (not delete_) as the plants delete function — matches plan spec and avoids reserved keyword"
  - "deletePhotoEntry (not delete_) as the photo-entries delete function — same convention"
  - "bumpCoverFor parameter type is strictly TransactionalDb (not the PlantsDb union) — SELECT + UPDATE atomicity"
  - "fetchPendingBatch parameter type is strictly DbClient (not the union) — service-role discipline T-05-03-02"
  - "Drizzle .for('update', { skipLocked: true }) is the correct v0.45.2 API (LockStrength + LockConfig)"
  - "staleInProgressMinutes interval uses '(n || ' minutes')::interval' rather than make_interval (portability)"
  - "Cursor strict-after WHERE predicates use sql template literals to express NULLS-LAST boundary crossing correctly"
  - "getCascadeCounts asserts findByIdForUser ownership before running counts (T-05-03-05 mitigation)"
  - "normalizeLocationLabel: trim + toLocaleLowerCase('pt-BR') + NFD + Unicode Diacritic property regex + whitespace collapse"

patterns-established:
  - "TDD discipline: RED commit then GREEN commit per task (6 commits for 3 tasks)"
  - "Integration tests create real Supabase users via admin API for RLS proof (pattern from rls-real-jwt.integration.test.ts)"
  - "Cross-user cursor test: mint cursor as userA, query under userB's authenticated role, assert zero rows"
  - "Service-role discipline test: SET LOCAL ROLE authenticated WITHOUT request.jwt.claim.sub → auth.uid()=NULL → RLS denies all"

requirements-completed:
  - "CAT-05"
  - "CAT-07"
  - "CAT-08"
  - "CAT-09"

duration: 65min
completed: 2026-05-01
---

# Phase 05 Plan 03: Catalog Repositories Summary

**Four Drizzle repositories with 5-sort cursor pagination, cover auto-promote, pending-deletion state machine (FOR UPDATE SKIP LOCKED), and location suggestions (ON CONFLICT + pt-BR diacritic fold) — all proven by 55 RED→GREEN tests including RLS owner-only and service-role discipline proofs.**

## Performance

- **Duration:** ~65 min
- **Started:** 2026-05-01T15:07:00Z
- **Completed:** 2026-05-01T16:12:00Z
- **Tasks:** 3 (each with RED + GREEN TDD cycle)
- **Files modified:** 10 (2 extended, 8 created)

## Accomplishments

- Extended `plants.ts` with `list` (5 sort modes + NULLS LAST cursor), `create`, `update`, `deletePlant`, `countForUser`, `getCascadeCounts` — full CAT-07/08 compliance
- Extended `photo-entries.ts` with `list` (oldest-first), `deletePhotoEntry`, `bumpCoverFor` (TransactionalDb-only, D-03 cover auto-promote)
- Created `pending-storage-deletions.ts` state machine with FOR UPDATE SKIP LOCKED concurrent reconciler safety (D-24), stale-recovery opts, and `fetchPendingBatch(DbClient)` service-role discipline
- Created `location-suggestions.ts` with ON CONFLICT upsert + pt-BR diacritic folding via `normalizeLocationLabel`
- Created `domain/locations.ts` pure helper (NFD fold, trim, pt-BR lowercase, whitespace collapse)
- 49 integration tests + 6 unit tests all green; TypeScript `--noEmit` passes

## Task Commits

Each task was committed atomically (RED then GREEN):

1. **Task 1 RED: plants repo read suite** - `da22230` (test)
2. **Task 1 GREEN: plants.list + countForUser + getCascadeCounts** - `d54efcb` (feat)
3. **Task 2 RED: plants mutations + photo-entries suites** - `2db2213` (test)
4. **Task 2 GREEN: plants mutations + photo-entries list/delete/bumpCoverFor** - `11d621d` (feat)
5. **Task 3 RED: pending-deletions + location-suggestions + normalize suites** - `daf3daa` (test)
6. **Task 3 GREEN: pending-storage-deletions + location-suggestions + normalize helper** - `0817e05` (feat)

## Files Created/Modified

- `src/contexts/catalog/infrastructure/db/plants.ts` — Extended with list (5 sort modes), create, update, deletePlant, countForUser, getCascadeCounts (alongside existing findByIdForUser)
- `src/contexts/catalog/infrastructure/db/photo-entries.ts` — Extended with list (plantId, ASC), deletePhotoEntry, bumpCoverFor (alongside existing create)
- `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` — NEW: create, markInProgress, markCompleted, recordError, markFailed, fetchPendingBatch (DbClient-only, FOR UPDATE SKIP LOCKED)
- `src/contexts/catalog/infrastructure/db/location-suggestions.ts` — NEW: upsert (ON CONFLICT increment + touch), listForUser (usage_count DESC, last_used_at DESC)
- `src/contexts/catalog/domain/locations.ts` — NEW: normalizeLocationLabel pure helper
- `tests/unit/catalog-locations-normalize.test.ts` — 6 unit tests for normalizeLocationLabel
- `tests/integration/catalog-plants-repo.integration.test.ts` — 23 integration tests (list 5 sorts, cursor round-trips, NULL boundary, cross-user T-05-03-01, countForUser, getCascadeCounts, create/update/deletePlant)
- `tests/integration/catalog-photo-entries-repo.integration.test.ts` — 5 integration tests (list, deletePhotoEntry, bumpCoverFor D-03, user_id defense in depth)
- `tests/integration/catalog-pending-storage-deletions-repo.integration.test.ts` — 13 integration tests (state machine, fetchPendingBatch, FOR UPDATE SKIP LOCKED concurrency, T-05-03-02 discipline, RLS proofs)
- `tests/integration/catalog-location-suggestions-repo.integration.test.ts` — 8 integration tests (upsert, diacritic fold, listForUser, RLS T-05-03-03)

## Decisions Made

- **deletePlant / deletePhotoEntry naming:** `delete` is a JS/TS reserved keyword. Trailing underscore `delete_` was considered but `deletePlant` is clearer and matches plan spec. All downstream plans expect this name.
- **Drizzle .for() API:** Confirmed `.for("update", { skipLocked: true })` is the Drizzle 0.45.2 signature (`LockStrength = 'update'`, `LockConfig = { skipLocked: true }`). The behavioral concurrent-fetch test is the empirical ground truth.
- **Interval SQL:** Used `(${staleMinutes} || ' minutes')::interval` rather than `make_interval(mins => ...)` for Supabase Postgres portability. Both are injection-safe because `staleMinutes` is a TypeScript `number`.
- **NULLS LAST:** Drizzle 0.45.x has no first-class NULLS LAST helper — used `sql\`${plants.acquisitionDate} desc nulls last\`` raw fragments in `orderBy()`.
- **Cursor WHERE predicates:** Built via `sql\`...\`` template literals to handle the NULL-sentinel boundary-crossing correctly (cannot compose NULLS LAST semantics from Drizzle operators alone).
- **fetchPendingBatch type is DbClient (not union):** TypeScript enforces the service-role discipline at compile time. Integration test proves behavioral consequence (no JWT sub → zero rows).
- **bumpCoverFor type is TransactionalDb (not union):** Ensures atomicity is structural, not a convention.

## Deviations from Plan

None — plan executed exactly as written. The `make_interval` → interval-cast substitution was noted as an explicitly offered alternative in the plan's action text.

## Known Stubs

None — all repositories return real data from the live Postgres database. No placeholder values in any exported function.

## Threat Flags

No new network endpoints, auth paths, or schema changes introduced in this plan. All repositories operate on tables and RLS policies established in Phase 2 and Plan 05-02.

## Issues Encountered

None — all tests passed on first GREEN attempt. The concurrent FOR UPDATE SKIP LOCKED test passed cleanly with two parallel postgres-js connections.

## Repository Exports Reference (for downstream plans 05-05, 05-06, 05-07)

```ts
// plants.ts
export { findByIdForUser, list, create, update, deletePlant, countForUser, getCascadeCounts }
export type { PlantRow, PlantInsert, PlantUpdate, PlantListParams, PlantListResult }

// photo-entries.ts
export { create, list, deletePhotoEntry, bumpCoverFor }
export type { PhotoEntryRow, PhotoEntryInsert }

// pending-storage-deletions.ts
export { create, markInProgress, markCompleted, recordError, markFailed, fetchPendingBatch }
export type { PendingStorageDeletionRow, PendingStorageDeletionInsert }

// location-suggestions.ts
export { upsert, listForUser }
export type { LocationSuggestionRow }

// domain/locations.ts
export { normalizeLocationLabel }
```

## Test Count Summary

| File | Count | Runner |
|------|-------|--------|
| catalog-locations-normalize.test.ts | 6 | unit |
| catalog-plants-repo.integration.test.ts | 23 | integration |
| catalog-photo-entries-repo.integration.test.ts | 5 | integration |
| catalog-pending-storage-deletions-repo.integration.test.ts | 13 | integration |
| catalog-location-suggestions-repo.integration.test.ts | 8 | integration |
| **Total** | **55** | |

Integration runtime: ~3s for all 49 tests (parallel setup via separate Supabase admin API user creation).

## Next Phase Readiness

- 05-05 (plant-create use-cases): can import `list`, `create`, `countForUser`, `upsert` directly
- 05-06 (plant-delete + Inngest cleanup): can import `deletePlant`, `getCascadeCounts`, `create` (psd), `fetchPendingBatch`, `markInProgress`, `markCompleted`, `recordError`
- 05-07 (photo-entry/cover use-cases): can import `bumpCoverFor`, `deletePhotoEntry`, `list` (photo-entries), `update` (plants)
- All contracts proven by integration tests on live Postgres — no stubs, no fake data

## Self-Check: PASSED

All files confirmed present, all commit hashes verified, all 55 tests green (6 unit + 49 integration), `tsc --noEmit` passes with zero errors.

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
