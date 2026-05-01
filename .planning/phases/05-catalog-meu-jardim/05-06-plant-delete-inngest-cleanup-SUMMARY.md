---
phase: 05-catalog-meu-jardim
plan: "06"
subsystem: api
tags: [catalog, delete, inngest, storage-cleanup, reconciler, tdd, pending-storage-deletions]

requires:
  - phase: 05-03-catalog-repositories
    provides: "deletePlant, getCascadeCounts, pending-storage-deletions repo (create, markInProgress, fetchPendingBatch, etc.)"
  - phase: 05-04-domain-zod-schemas
    provides: "validateStorageDeletionPrefix (storage path guard for T-05-06-01)"
  - phase: 05-05-plant-create-use-cases
    provides: "UoW + after-commit telemetry pattern, create-plant.ts as reference"
  - phase: 02-photo-storage
    provides: "getStorageAdapter (cachedAdapter test seam)"

provides:
  - "deletePlant use-case: ownership check → UoW (cascade + 2 psd inserts) → after-commit inngest.send + PostHog"
  - "cleanupStorage Inngest event handler (plant.deleted, retries: 4): validateStorageDeletionPrefix + deletePrefix + state machine"
  - "cleanupStorageReconciler Inngest hourly cron (retries: 0): BACKOFF_MINUTES, MAX_ATTEMPTS=5, stale in_progress recovery"
  - "catalogFunctions export wired into registry (9 → 11)"
  - "findById added to pending-storage-deletions repo"
  - "markInProgress now conditional on status='pending' (T-05-06-02)"
  - "getStorageAdapter exported from photo-storage.ts (test seam for Inngest functions)"

affects:
  - 05-09-route-handlers-mutate-delete (invokes deletePlant)
  - "Phase 13 OBS-05 (status='failed' rows surface in alert dashboard)"

tech-stack:
  added: []
  patterns:
    - "cleanupStorageHandler / cleanupStorageReconcilerHandler: extracted and exported from inngest.createFunction for direct test invocation"
    - "step.run shim: { run: async (_name, fn) => fn() } used in integration tests for Inngest handler isolation"
    - "Stale in_progress recovery: reconciler skips markInProgress for rows already in_progress (avoids condition conflict)"
    - "BACKOFF_MINUTES[5,30,240,1440,4320] indexed by (attempts-1); attempts=0 = no wait"

key-files:
  created:
    - src/contexts/catalog/application/delete-plant.ts
    - src/contexts/catalog/inngest/functions.ts
    - tests/integration/delete-plant.integration.test.ts
    - tests/integration/cleanup-storage.integration.test.ts
    - tests/integration/cleanup-storage-reconciler.integration.test.ts
  modified:
    - src/contexts/catalog/domain/events.ts
    - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
    - src/contexts/catalog/infrastructure/photo-storage.ts
    - src/shared/inngest/registry.ts
    - tests/integration/inngest-serve.integration.test.ts
    - tests/integration/notifications-send-email.integration.test.ts

key-decisions:
  - "Exported cleanupStorageHandler and cleanupStorageReconcilerHandler separately from inngest.createFunction so integration tests can invoke them without spinning up the Inngest runtime"
  - "markInProgress conditional WHERE status='pending': prevents duplicate in-progress transitions; stale in_progress recovery in reconciler bypasses markInProgress and processes directly"
  - "getStorageAdapter() exported from photo-storage.ts: Inngest cleanup functions share the same cachedAdapter test seam as the application layer"
  - "findById added to pending-storage-deletions repo: needed by cleanupStorage handler to read row state before marking in_progress"
  - "Stale in_progress recovery: scheduled_at must be past the backoff window for the reconciler to pick up the row (backoff applies to scheduled_at, not started_at)"
  - "Pre-existing seed-data.integration.test.ts failures confirmed as unrelated to this plan's changes (verified by git stash test)"

patterns-established:
  - "TDD discipline: RED commit then GREEN commit per task (3 pairs across 3 tasks)"
  - "Handler extraction pattern: export handler fn before createFunction for testability"
  - "Registry update discipline: update count comment + affected topology tests in same commit"

requirements-completed: ["CAT-09"]

duration: 14min
completed: 2026-05-01
---

# Phase 05 Plan 06: Plant Delete + Inngest Cleanup Summary

**Atomic plant DELETE cascade + durable storage cleanup pipeline: UoW inserts two pending_storage_deletions rows, cleanupStorage event handler (retries: 4) runs the happy path, hourly reconciler recovers stuck rows with 5-attempt cap and D-24 backoff schedule.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-01T13:40:29Z
- **Completed:** 2026-05-01T13:55:00Z
- **Tasks:** 3 (each with TDD RED + GREEN)
- **Files modified:** 11 (5 created, 6 modified)

## Accomplishments

- `deletePlant` use-case: ownership check → UoW (getCascadeCounts + deletePlant + 2 pending_storage_deletions inserts) → after-commit `inngest.send` + PostHog `plant_deleted` (privacy-clean D-29 props)
- `cleanupStorage` Inngest handler: validates prefix via `validateStorageDeletionPrefix` (T-05-06-01), `markInProgress` conditional on `status='pending'` (T-05-06-02), `RetryAfterError` on storage failure, idempotent (Pitfall 6)
- `cleanupStorageReconciler` hourly cron: BACKOFF_MINUTES D-24, MAX_ATTEMPTS=5 (T-05-06-03), stale in_progress recovery (started_at < 30min ago), BYPASSRLS service-role db (Pitfall 4 proven by 3C test)
- Registry updated 9 → 11 functions; two pre-existing topology tests updated
- Pre-task fixups: `findById`, conditional `markInProgress`, exported `getStorageAdapter`

## Task Commits

Pre-task fixups (Rule 3 — missing repo function, Rule 1 — concurrent guard, Rule 3 — test seam):
- `984cb6a` (fix): add findById, conditional markInProgress, export getStorageAdapter

Task 1 — delete-plant use-case:
1. `5ae18ef` (feat): extend PlantDeletedPayload with deletionRowIds tuple (D-22)
2. `4b28fa9` (test RED): add failing tests for delete-plant (cycles 1A, 1B, 1C)
3. `9ac9001` (feat GREEN): implement delete-plant happy path (D-22, CAT-09)

Task 2 — cleanupStorage handler:
4. `eb9c017` (test RED): add failing tests for cleanupStorage handler (cycles 2A, 2B, 2C)
5. `a984c4b` (feat GREEN): implement cleanupStorage Inngest handler (D-22)

Task 3 — reconciler + registry:
6. `4e271a9` (test RED): add failing tests for cleanupStorageReconciler (cycles 3A, 3B, 3C, 3D)
7. `7dbc2ce` (feat GREEN): implement cleanupStorageReconciler + registry wiring (9 → 11)

## Files Created/Modified

- `src/contexts/catalog/application/delete-plant.ts` — NEW: deletePlant use-case (exports deletePlant, DeletePlantInput, DeletePlantResult)
- `src/contexts/catalog/inngest/functions.ts` — NEW: cleanupStorageHandler + cleanupStorageReconcilerHandler + catalogFunctions export
- `src/contexts/catalog/domain/events.ts` — MODIFIED: PlantDeletedPayload extended with deletionRowIds: [string, string]
- `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` — MODIFIED: findById added, markInProgress conditional on status='pending'
- `src/contexts/catalog/infrastructure/photo-storage.ts` — MODIFIED: getStorageAdapter() exported
- `src/shared/inngest/registry.ts` — MODIFIED: catalogFunctions imported and spread; comment updated to EXACTLY 11 functions
- `tests/integration/delete-plant.integration.test.ts` — NEW: 11 tests (cycles 1A-8, 1B-2, 1C-1)
- `tests/integration/cleanup-storage.integration.test.ts` — NEW: 8 tests (cycles 2A-2, 2B-2, 2C-3 + config invariant)
- `tests/integration/cleanup-storage-reconciler.integration.test.ts` — NEW: 9 tests (cycles 3A-3, 3B-3, 3C-1, 3D-1)
- `tests/integration/inngest-serve.integration.test.ts` — MODIFIED: count assertions updated 9 → 11
- `tests/integration/notifications-send-email.integration.test.ts` — MODIFIED: count assertion updated 9 → 11

## Deviations from Plan

### Auto-fixed Issues (Rule 3 — blocking issues)

**1. [Rule 3 - Blocking] findById missing from pending-storage-deletions repo**

- **Found during:** Task 2 GREEN (plan skeleton calls `pendingDeletionsRepo.findById` but 05-03 didn't export it)
- **Fix:** Added `findById(db, id)` to `pending-storage-deletions.ts`
- **Files modified:** `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts`
- **Commit:** `984cb6a`

**2. [Rule 1 - Bug] markInProgress not conditional on status='pending'**

- **Found during:** Pre-task review; plan requires T-05-06-02 mitigation but 05-03's implementation used plain `WHERE id = $1`
- **Fix:** Added `AND status='pending'` to UPDATE WHERE clause in `markInProgress`; reconciler skips `markInProgress` for stale `in_progress` rows (processes them directly)
- **Files modified:** `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts`, `src/contexts/catalog/inngest/functions.ts`
- **Commit:** `984cb6a`, `7dbc2ce`

**3. [Rule 3 - Blocking] getStorageAdapter not exported from photo-storage.ts**

- **Found during:** Task 2 GREEN (plan references `__getStorageAdapterForCleanup` which doesn't exist)
- **Fix:** Added `getStorageAdapter()` export wrapping the private `getAdapter()` (reads same `cachedAdapter` test seam)
- **Files modified:** `src/contexts/catalog/infrastructure/photo-storage.ts`
- **Commit:** `984cb6a`

**4. [Rule 1 - Bug] Plan's getCascadeCounts / deletePlant signatures wrong**

- **Found during:** Task 1 GREEN
- **Actual signatures:** `getCascadeCounts(db, { userId, plantId })` returns `{ photo_entry_count, reminder_count }` (snake_case); `deletePlant(db, { userId, plantId })` (not `delete_`)
- **Fix:** Adapted implementation to match actual 05-03 repo exports
- **Files modified:** `src/contexts/catalog/application/delete-plant.ts`
- **Commit:** `9ac9001`

**5. [Rule 3 - Blocking] Integration tests: reminders/identifications INSERT schema mismatch**

- **Found during:** Task 1 GREEN test run
- **Fix:** Corrected reminders schema (type/frequency_days, no user_id column); corrected identifications INSERT (all NOT NULL columns: photo_urls, model, results, latency_ms, consent_version)
- **Files modified:** `tests/integration/delete-plant.integration.test.ts`
- **Commit:** `9ac9001`

**6. [Rule 1 - Bug] Pre-existing topology tests expected 9 functions (now 11)**

- **Found during:** Task 3 GREEN
- **Fix:** Updated `inngest-serve.integration.test.ts` and `notifications-send-email.integration.test.ts` count assertions from 9 → 11; updated function ID list to include two catalog entries
- **Files modified:** Both test files
- **Commit:** `7dbc2ce`

### Out-of-scope items (logged, not fixed)

- `seed-data.integration.test.ts`: 4 pre-existing failures (policy_versions, identification_limits, provider_budgets) confirmed pre-existing via git stash verification. Not caused by this plan's changes.

## Known Stubs

None — all new functions implement real behavior. No placeholder values in any exported function.

## Threat Flags

No new network endpoints introduced. The Inngest handlers are consumed via the existing `/api/inngest` route established in Phase 4. The `getStorageAdapter()` export does not create new surface (it's a read-only accessor of the existing adapter).

## Test Count Summary

| File | Count | Runner |
|------|-------|--------|
| delete-plant.integration.test.ts | 11 | integration |
| cleanup-storage.integration.test.ts | 8 | integration |
| cleanup-storage-reconciler.integration.test.ts | 9 | integration |
| **Total (this plan)** | **28** | |

## Self-Check: PASSED

All 7 key files confirmed present. All 8 plan commits verified in git log. 28/28 integration tests green (11 delete-plant + 8 cleanup-storage + 9 reconciler).
