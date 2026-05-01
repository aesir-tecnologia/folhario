---
phase: 05-catalog-meu-jardim
plan: "05"
subsystem: api
tags: [catalog, use-case, transaction, posthog, inngest, zod, storage, tdd]

requires:
  - phase: 05-03-catalog-repositories
    provides: plantsRepo.create, photoEntriesRepo.create, deleteSinglePlantPhotoBestEffort
  - phase: 05-04-domain-zod-schemas
    provides: createPlantInputSchema (route-layer shape; use-case ships own discriminated-union schema)
  - phase: 02-unit-of-work
    provides: withUnitOfWork, TransactionalDb type
  - phase: 02-photo-upload
    provides: upload-photo.ts pattern (compensating-delete, pre-UoW storage upload, MIME validation)

provides:
  - "createPlant use-case with source:manual + source:identification branches"
  - "postCommit-callback return pattern for telemetry deferred to outer-tx callers"
  - "D-28 PostHog plant_added event with privacy-clean property set"
  - "Inngest plant.created event emitted post-commit"
  - "Compensating-delete on storage-vs-DB split-brain via deleteSinglePlantPhotoBestEffort"

affects:
  - 05-08-route-handlers-read-create (invokes createPlant with withIdempotency outer-tx)
  - 05-09-route-handlers-mutate-delete (photo upload pattern reference)
  - phase-06-identification (source:identification branch closed end-to-end)

tech-stack:
  added: []
  patterns:
    - "postCommit-callback return: when deps.tx provided, createPlant returns postCommit fn; caller awaits after outer commit"
    - "Discriminated-union Zod schema in use-case: photo.buffer:Buffer, source:manual|identification"
    - "Pre-UoW storage upload + compensating-delete on UoW catch (mirrors upload-photo.ts pattern)"
    - "T-05-05-01 leak guard: telemetry never fires on TX rollback (own-UoW or outer-tx path)"

key-files:
  created:
    - src/contexts/catalog/application/create-plant.ts
    - tests/unit/create-plant.unit.test.ts
    - tests/integration/create-plant.integration.test.ts
  modified: []

key-decisions:
  - "Local discriminated-union Zod schema in create-plant.ts — existing createPlantInputSchema is route-layer shaped (byteLength not buffer); use-case ships its own schema with Buffer and source discrimination"
  - "postCommit-callback return pattern chosen over tx.afterCommit hook (not exported by withUnitOfWork)"
  - "Pre-generate plantId + photoId before UoW to set cover_photo_url on Plant insert, avoiding a subsequent UPDATE"
  - "speciesId: null for manual branch inserted explicitly (not omitted) to satisfy DB NOT NULL default"

patterns-established:
  - "Use-case deps.tx pattern: callers providing outer TX receive postCommit callback; use-case never auto-commits"
  - "T-05-05-01 mitigation pattern: own-UoW path — telemetry block reachable only after withUnitOfWork resolves; outer-tx path — telemetry packaged as postCommit never auto-invoked"

requirements-completed: [CAT-01, CAT-02, CAT-03]

duration: 45min
completed: 2026-05-01
---

# Phase 05 Plan 05: Plant Create Use-Case Summary

**TX-atomic Plant + PhotoEntry create with compensating-delete on split-brain, postCommit-callback telemetry deferred to outer-tx callers (D-37), and D-28 PostHog privacy-clean properties**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-05-01T13:25:00Z
- **Completed:** 2026-05-01T13:35:00Z
- **Tasks:** 3 (RED unit, RED integration, GREEN implementation)
- **Files modified:** 3 created

## Accomplishments

- Shipped `createPlant` use-case at `src/contexts/catalog/application/create-plant.ts` (341 lines)
- 16 tests GREEN: 8 unit (U1-U8) + 8 integration (I1-I7 + I7b rollback variant)
- T-05-05-01 mitigated: telemetry never fires on TX rollback in both own-UoW and outer-tx paths (I3, I7b)
- T-05-05-02 mitigated: GPS + oversize rejection before any storage write (U4, U5, I4)
- T-05-05-03 mitigated: userId JSDoc documents caller-only origin; UoW UUID validation enforces it
- D-28 PostHog `plant_added` props verified: EXACTLY `{source, has_nickname, has_location, has_acquisition_date, has_notes, photo_count}` (U8, I1)

## Task Commits

Each task committed atomically (TDD discipline maintained):

1. **Task 1 (RED): Failing unit tests** - `9cb1a42` (test)
2. **Task 2 (RED): Failing integration tests** - `cf66b3e` (test)
3. **Task 3 (GREEN): Implementation + bug fixes** - `91f9ee9` (feat)

## Files Created/Modified

- `src/contexts/catalog/application/create-plant.ts` — createPlant use-case (341 lines); exports createPlant, CreatePlantInput, CreatePlantDeps, CreatePlantResult, PostCommitCallback
- `tests/unit/create-plant.unit.test.ts` — 8 unit tests (U1-U8): validation rejections + D-28 telemetry property shape
- `tests/integration/create-plant.integration.test.ts` — 8 integration tests (I1-I7 + I7b): TX atomicity, compensating-delete round-trip, telemetry leak guard, GPS rejection, identification branch, RLS defense, outer-tx postCommit contract

## Decisions Made

**1. Local discriminated-union Zod schema in use-case (not imported from schemas.ts)**

The plan's `<interfaces>` section claimed 05-04 ships `createPlantInputSchema` with `source` discrimination, `userId`, and `photo: { buffer, contentType }`. The actual 05-04 schema uses `photo: { contentType, byteLength }` — correctly shaped for the route layer where `multipart` parser yields byte counts, not buffers. Importing and extending that schema for the use-case layer would pollute the route-layer contract. The use-case ships its own `z.discriminatedUnion("source", [manual, identification])` schema with `photo.buffer: z.instanceof(Buffer)`.

**2. postCommit-callback return pattern**

`withUnitOfWork` has no `tx.afterCommit` hook. The plan specifies returning a `postCommit` callback when `deps.tx` is provided by the caller. This is implemented exactly: `{ ok: true, plant, photoEntry, postCommit }` on outer-tx path; telemetry runs inline on own-UoW path (no `postCommit` field).

**3. Pre-generate IDs before UoW**

`plantId` and `photoId` are generated before the UoW so `cover_photo_url` can be set on the Plant insert without a post-insert UPDATE. Matches the `upload-photo.ts:165-184` pattern.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] I5 integration test used wrong species table column names**

- **Found during:** Task 3 (GREEN) — running integration suite against local DB
- **Issue:** Test I5 seeded a species row with `common_name_pt` and `family` columns that don't exist in the actual `species` schema (`common_name` and `scientific_name` are the real columns, with `scientific_name` having a unique constraint)
- **Fix:** Changed INSERT to use `scientific_name` (with randomUUID suffix for unique constraint) and `common_name`
- **Files modified:** `tests/integration/create-plant.integration.test.ts`
- **Verification:** I5 passes against local DB
- **Committed in:** `91f9ee9` (feat task commit)

**2. [Rule 1 - Bug] U7 and U8 TypeScript type errors in unit tests**

- **Found during:** Task 3 (GREEN) — `pnpm typecheck` run
- **Issue:** U7 tried to add `speciesId` to a `manual` branch object literal (TypeScript catches this). U8 `withUnitOfWork` spy `mockImplementationOnce` was typed incompatibly with `UnitOfWorkCallback<T>`.
- **Fix:** U7: extracted the cross-branch object to a variable then `as any` cast. U8: added `(uowSpy as any).mockImplementationOnce(...)`.
- **Files modified:** `tests/unit/create-plant.unit.test.ts`
- **Verification:** `npx tsc --noEmit` passes with 0 errors
- **Committed in:** `91f9ee9` (feat task commit)

**3. [Rule 3 - Deviation] createPlantInputSchema from schemas.ts not used**

- **Found during:** Task 1 (RED) — pre-implementation orientation
- **Issue:** Plan's `<interfaces>` described `createPlantInputSchema` as having `source`, `userId`, and `photo: {buffer, contentType}` — but the actual 05-04 schema has `photo: {contentType, byteLength}` and no source/userId/speciesId. Using it would require extending the route-layer schema in a way that breaks its intended shape.
- **Fix:** create-plant.ts ships its own local discriminated-union schema. The `key_links` pattern `createPlantInputSchema` is informational only; the `<verification>` block does not grep for it.
- **Impact:** None to downstream plans; the exported types (`CreatePlantInput`, etc.) are the contract 05-08 uses, not the internal Zod schema.

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 blocking/adaptation)
**Impact on plan:** All deviations necessary for correctness. No scope creep.

## Threat Dispositions Confirmed

| Threat | Disposition | Evidence |
|--------|-------------|---------|
| T-05-05-01 (telemetry on rollback) | MITIGATED | I3: inngest+posthog not called on own-UoW rollback. I7b: postCommit not called on outer-tx rollback, zero telemetry. |
| T-05-05-02 (GPS/oversize before storage) | MITIGATED | U4, U5: uploadObject not called. I4: zero storage calls + zero rows on GPS rejection. |
| T-05-05-03 (userId from caller only) | MITIGATED | JSDoc on CreatePlantInput.userId. UoW UUID validation rejects non-UUID userId. |
| T-05-05-04 (Inngest delivery failure) | ACCEPTED | Failure post-commit captured via Sentry (surface: catalog.create-plant.notify). plant.created is informational; no Phase 5 consumer. |
| T-05-05-05 (duplicate create on retry) | ACCEPTED | Idempotency-Key wired in 05-08 via withIdempotency wrapper + deps.tx. This plan proves the use-case supports outer-tx (I7). |

## Known Stubs

None — use-case writes real DB rows and emits real events. No stub values flow to UI.

## Threat Flags

None — no new network endpoints, auth paths, or schema changes introduced. The use-case is an internal function called by route handlers only.

## Issues Encountered

- Pre-existing integration test failures in `seed-data.integration.test.ts` (provider_budgets, policy_versions, identification_limits counts wrong) and `iam-signup.integration.test.ts` (1 test). These are unrelated to plan 05-05 — they exist on the base branch and are in scope of the local test environment seed, not this plan's changes. Logged to deferred-items.

## Next Phase Readiness

- `createPlant` use-case is ready for 05-08 route handler to wrap with `withIdempotency` + `requireVerifiedUser` + multipart parsing
- `source: 'identification'` branch type-checks and I5 proves it works; Phase 6 closes the Identification.plant_id FK update
- CAT-02 (name required) + CAT-03 (photo required) use-case halves complete; route + UI halves close in 05-08 + 05-17

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*

## Self-Check: PASSED

Files confirmed present:
- `src/contexts/catalog/application/create-plant.ts` — FOUND
- `tests/unit/create-plant.unit.test.ts` — FOUND
- `tests/integration/create-plant.integration.test.ts` — FOUND
- `.planning/phases/05-catalog-meu-jardim/05-05-plant-create-use-cases-SUMMARY.md` — FOUND

Commits confirmed:
- `9cb1a42` (test(05-05): add failing unit tests for createPlant) — FOUND
- `cf66b3e` (test(05-05): add failing integration tests for createPlant TX + telemetry) — FOUND
- `91f9ee9` (feat(05-05): implement createPlant use-case with postCommit-callback pattern) — FOUND
