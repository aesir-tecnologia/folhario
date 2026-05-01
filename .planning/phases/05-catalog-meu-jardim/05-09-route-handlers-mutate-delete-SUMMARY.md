---
phase: 05-catalog-meu-jardim
plan: 09
subsystem: api
tags: [catalog, route-handlers, patch, delete, read-only-mode, idempotency, tdd, threat-model]

requires:
  - phase: 05-catalog-meu-jardim
    provides: "05-06 deletePlant use-case; 05-07 deletePhotoEntry + updatePlant use-cases; 05-08 GET handler + snake-case mappers; 05-11 resolveSubscriptionState helper; 05-04 updatePlantInputSchema.strict()"
  - phase: 02-auth
    provides: "withIdempotency (D-37); requireVerifiedUser; UoW tx boundary (CR-01)"

provides:
  - "PATCH /api/v1/plants/[plantId] — update plant handler with 6-step check order + withIdempotency"
  - "DELETE /api/v1/plants/[plantId] — delete plant handler with withIdempotency + postCommit closure-capture"
  - "DELETE /api/v1/photo-entries/[photoEntryId] — delete photo-entry handler with withIdempotency + D-03 cover auto-promote"
  - "src/contexts/catalog/api/route-handlers/_shared.ts — errorStatusFor() + resolveReadOnlyFromRequest() helpers"
  - "28 integration tests: 11 PATCH + 8 DELETE plant + 9 DELETE photo-entry"

affects:
  - "05-15 (catalog grid — DELETE plant triggers queryClient invalidation)"
  - "05-16 (plant profile — PATCH for inline-edit save; DELETE for delete-confirm sheet)"
  - "05-17 (photo-journal — DELETE /photo-entries for entry deletion)"

tech-stack:
  added: []
  patterns:
    - "6-step handler check order: auth → read-only → idempotency-key → Zod validate → withIdempotency → postCommit"
    - "Closure-capture postCommit: captured inside withIdempotency closure, awaited AFTER commit, undefined on replay"
    - "resolveReadOnlyFromRequest: reads ENABLE_TEST_ROUTES + cookie from request headers (no cookies() async API needed in route handlers)"
    - "deletePlant optional deps.tx: own-UoW path preserved; caller-owned-tx path returns postCommit callback"
    - "deletePhotoEntry optional plantId: route handler has only photoEntryId in URL; use-case derives plantId by looking up photo entry first"

key-files:
  created:
    - src/contexts/catalog/api/route-handlers/update-plant-handler.ts
    - src/contexts/catalog/api/route-handlers/delete-plant-handler.ts
    - src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts
    - src/contexts/catalog/api/route-handlers/_shared.ts
    - src/app/api/v1/photo-entries/[photoEntryId]/route.ts
    - tests/integration/catalog-mutate-delete-routes.integration.test.ts
  modified:
    - src/app/api/v1/plants/[plantId]/route.ts
    - src/contexts/catalog/application/delete-plant.ts
    - src/contexts/catalog/application/delete-photo-entry.ts

key-decisions:
  - "resolveReadOnlyFromRequest uses ENABLE_TEST_ROUTES + __test_subscription_read_only cookie (matches 05-11 actual implementation, not plan's SUBSCRIPTION_READ_ONLY fiction)"
  - "deletePlant extended to accept optional deps.tx for withIdempotency CR-01 compliance; own-UoW path preserved for backward compat"
  - "deletePhotoEntry made plantId optional; when absent, use-case derives plantId via photo entry lookup (route URL has only photoEntryId)"
  - "errorStatusFor() shared helper used ONLY inside withIdempotency closures; all top-level error paths use errorResponse(ErrorCode.X)"
  - "Test 10 for DELETE photo-entries simplified: no PostHog/Inngest telemetry in deletePhotoEntry, so postCommitFn is always undefined — replay no-op is still verified via use-case spy count"

patterns-established:
  - "Route file = thin re-export only (D-17). Handler logic in src/contexts/catalog/api/route-handlers/"
  - "withIdempotency postCommit closure-capture: let postCommitFn; ... inside closure: postCommitFn = inner.postCommit; ... after: try { await postCommitFn?.(); } catch (e) { Sentry.captureException(e); }"
  - "Delete handlers derive requestHash from URL path + method (stable for DELETE; no body to hash)"

requirements-completed: [CAT-04, CAT-06, CAT-09]

duration: 9min
completed: 2026-05-01
---

# Phase 5 Plan 09: Route Handlers Mutate/Delete Summary

**PATCH + DELETE plant and DELETE photo-entry handlers with 6-step auth/read-only/idempotency check order, withIdempotency CR-01 tx wrapping, postCommit closure-capture telemetry, and 28 integration tests covering T-05-09-01..04 STRIDE mitigations**

## Performance

- **Duration:** 9 min
- **Started:** 2026-05-01T15:10:37Z
- **Completed:** 2026-05-01T15:20:00Z
- **Tasks:** 3 (TDD: RED + GREEN per task group)
- **Files modified:** 9

## Accomplishments

- Wired `PATCH /api/v1/plants/[plantId]` with full 6-step check order: `requireVerifiedUser` → `resolveReadOnlyFromRequest` → idempotency-key required → `updatePlantInputSchema.strict()` Zod validation → `withIdempotency` wraps `updatePlant` → `postCommit?.()` after commit
- Wired `DELETE /api/v1/plants/[plantId]` with `withIdempotency` wrapping `deletePlant` (D-22 cascade: photo_entries, reminders FK cascade, identifications.plant_id SET NULL, 2 pending_storage_deletions rows, Inngest event, PostHog via postCommit closure-capture)
- Wired `DELETE /api/v1/photo-entries/[photoEntryId]` with `withIdempotency` wrapping `deletePhotoEntry` (D-03 cover auto-promote in same UoW tx)
- Created `src/app/api/v1/photo-entries/[photoEntryId]/route.ts` — new route file (thin re-export per D-17)
- Extended `plants/[plantId]/route.ts` with PATCH + DELETE re-exports (GET unchanged, zero Drizzle imports preserved)
- 28 integration tests covering: happy path, idempotency replay, hash mismatch, auth gates, read-only gate, cross-user IDOR, postCommit firing (first call only, not on replay)

## Task Commits

TDD cycle (RED then GREEN across all three handlers together):

1. **RED: All three handlers** - `a8138a6` (test: add failing tests for PATCH and DELETE route handlers)
2. **GREEN: All implementations** - `a9e31d1` (feat: PATCH and DELETE handlers for plants and photo-entries)

## Files Created/Modified

- `src/contexts/catalog/api/route-handlers/update-plant-handler.ts` — PATCH handler (NEW)
- `src/contexts/catalog/api/route-handlers/delete-plant-handler.ts` — DELETE plant handler (NEW)
- `src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts` — DELETE photo-entry handler (NEW)
- `src/contexts/catalog/api/route-handlers/_shared.ts` — errorStatusFor() + resolveReadOnlyFromRequest() (NEW)
- `src/app/api/v1/photo-entries/[photoEntryId]/route.ts` — new route file, DELETE re-export (NEW)
- `src/app/api/v1/plants/[plantId]/route.ts` — adds PATCH + DELETE re-exports (MODIFIED)
- `src/contexts/catalog/application/delete-plant.ts` — extended to accept deps.tx + return postCommit (MODIFIED)
- `src/contexts/catalog/application/delete-photo-entry.ts` — made plantId optional (MODIFIED)
- `tests/integration/catalog-mutate-delete-routes.integration.test.ts` — 28 tests (NEW)

## Decisions Made

- Used `resolveSubscriptionState({ enableTestRoutes, cookieValue })` (what 05-11 actually shipped) not `resolveSubscriptionStateFromEnv` (plan fiction)
- Extended `deletePlant` to support `deps.tx` (required for withIdempotency CR-01 compliance — plan's must-have)
- Made `deletePhotoEntry.plantId` optional (route URL has only `photoEntryId`; use-case derives plantId by lookup)
- Dropped "postCommit fires on first call" assertion for DELETE photo-entries (deletePhotoEntry has no telemetry, so postCommitFn is always undefined — test still verifies spy count = 1 across two requests)
- `_shared.ts` helper: `errorStatusFor()` for withIdempotency closure use; `resolveReadOnlyFromRequest()` for request-cookie-based subscription gate

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Subscription gate function mismatch**
- **Found during:** Pre-implementation analysis
- **Issue:** Plan's `<interfaces>` described `resolveSubscriptionStateFromEnv({ SUBSCRIPTION_READ_ONLY })` and `serverEnv.SUBSCRIPTION_READ_ONLY`, neither of which exists. 05-11 actually shipped `resolveSubscriptionState({ enableTestRoutes, cookieValue })` + `ENABLE_TEST_ROUTES` env var.
- **Fix:** Created `resolveReadOnlyFromRequest(request)` in `_shared.ts` that reads `cookie` header for `__test_subscription_read_only` and calls the actual `resolveSubscriptionState`. Integration tests use `vi.stubEnv("ENABLE_TEST_ROUTES", "1")` + `cookie: "__test_subscription_read_only=1"` header.
- **Files modified:** `src/contexts/catalog/api/route-handlers/_shared.ts`
- **Committed in:** a9e31d1

**2. [Rule 2 - Missing Critical] deletePlant did not support deps.tx / postCommit**
- **Found during:** Task 2 (DELETE /plants handler implementation)
- **Issue:** The plan's must-have truth requires `withIdempotency` passes `tx` to `deletePlant` via deps. The existing `deletePlant(input)` had no `deps.tx` parameter and managed its own `withUnitOfWork` — putting it INSIDE withIdempotency would create a nested transaction (the CR-01 violation warned in `idempotency.ts:25-35`).
- **Fix:** Extended `deletePlant` to accept `deps: { tx?: TransactionalDb }`. When `deps.tx` provided: use caller's tx, return `postCommit` callback for Inngest+PostHog. When absent: own-UoW path fires Inngest+PostHog inline (backward-compatible; all existing tests pass).
- **Files modified:** `src/contexts/catalog/application/delete-plant.ts`
- **Committed in:** a9e31d1

**3. [Rule 3 - Blocking] deletePhotoEntry required plantId not available in route URL**
- **Found during:** Task 3 (DELETE /photo-entries handler implementation)
- **Issue:** Plan's `<interfaces>` described `deletePhotoEntry({ userId, photoEntryId })` but the actual use-case required `{ userId, plantId, photoEntryId }`. The route URL `DELETE /api/v1/photo-entries/[photoEntryId]` has no `plantId` segment.
- **Fix:** Made `plantId` optional in `DeletePhotoEntryInput`. When absent, the use-case looks up the photo entry to derive `plantId` (one extra SELECT before the ownership check). When provided, uses it directly (existing callers unaffected). All existing `catalog-delete-photo-entry.integration.test.ts` tests still pass.
- **Files modified:** `src/contexts/catalog/application/delete-photo-entry.ts`
- **Committed in:** a9e31d1

**4. [Rule 1 - Deviation] DELETE photo-entry postCommit test simplified**
- **Found during:** Task 3 (Test 10 authoring)
- **Issue:** Plan's Test 10 for DELETE photo-entries asserted "PostHog/Inngest spies called on first DELETE, NOT on replay". But `deletePhotoEntry` fires no telemetry (no PostHog, no Inngest). `postCommitFn` is always `undefined`.
- **Fix:** Replaced with a simpler assertion: use-case spy called exactly once across two requests with same Idempotency-Key (verifies replay correctness without requiring nonexistent telemetry). The fundamental contract (no re-invocation on replay) is still verified.
- **Files modified:** `tests/integration/catalog-mutate-delete-routes.integration.test.ts`
- **Committed in:** a8138a6

---

**Total deviations:** 4 auto-fixed (1 Rule 3 blocking — subscription gate mismatch, 1 Rule 2 missing critical — deletePlant tx support, 1 Rule 3 blocking — deletePhotoEntry plantId, 1 Rule 1 — test simplification)
**Impact on plan:** All auto-fixes necessary for correctness and API contract compliance. No scope creep.

## Wave 4 UI Handoff Notes

- **05-16 InlineEditField save:** calls `PATCH /api/v1/plants/[plantId]` with `{ [field]: newValue }` and a fresh Idempotency-Key per save. D-06 LWW: optimistic rollback on non-200 (server wins).
- **05-16 Delete-confirm sheet:** calls `DELETE /api/v1/plants/[plantId]` after user confirms; triggers `queryClient.invalidateQueries({ queryKey: plantsKeys.all() })`.
- **05-17 Photo-journal entry delete:** calls `DELETE /api/v1/photo-entries/[photoEntryId]`; cover auto-promote is server-side, client refetches `plantsKeys.detail(plantId)` to pick up new `cover_photo_url`.

## Threat Flags

No new network surface introduced beyond the three endpoints specified in the plan. All HIGH STRIDE threats (T-05-09-01..04) have integration test assertions:

- **T-05-09-01 (cross-user mutation):** PATCH Test 7, DELETE plant Test 3, DELETE photo-entry Test 4 — all assert 404 `not_found`
- **T-05-09-02 (prefix mis-scope):** DELETE plant Test 3 asserts no `pending_storage_deletions` rows inserted on cross-user attempt
- **T-05-09-03 (idempotency collision):** PATCH Test 3 asserts 409 `conflict` on hash mismatch with spy not called
- **T-05-09-04 (read-only bypass):** PATCH Test 10, DELETE plant Test 4, DELETE photo-entry Test 5 — all assert 402 + use-case spy not called

## Issues Encountered

Pre-existing test isolation flakiness in the combined `vitest run --project=unit --project=unit-dom` run (5 tests in `supabase-middleware-update-session.test.ts` fail when running both projects together but pass individually). Confirmed pre-existing by verifying the failures exist on the HEAD prior to all 05-09 changes. Out of scope.

## Self-Check: PASSED

Files verified to exist:
- `/Users/machado/Projects/folhario/src/contexts/catalog/api/route-handlers/update-plant-handler.ts` — FOUND
- `/Users/machado/Projects/folhario/src/contexts/catalog/api/route-handlers/delete-plant-handler.ts` — FOUND
- `/Users/machado/Projects/folhario/src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts` — FOUND
- `/Users/machado/Projects/folhario/src/app/api/v1/photo-entries/[photoEntryId]/route.ts` — FOUND
- `/Users/machado/Projects/folhario/tests/integration/catalog-mutate-delete-routes.integration.test.ts` — FOUND

Commits verified:
- `a8138a6` — test(05-09): RED test file — FOUND
- `a9e31d1` — feat(05-09): GREEN implementation — FOUND

## Next Phase Readiness

All three mutation API endpoints are live. Wave 4 UI plans (05-15..05-17) can build against:
- `PATCH /api/v1/plants/[plantId]` — inline-edit save
- `DELETE /api/v1/plants/[plantId]` — delete-confirm cascade
- `DELETE /api/v1/photo-entries/[photoEntryId]` — journal entry deletion with cover auto-promote

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
