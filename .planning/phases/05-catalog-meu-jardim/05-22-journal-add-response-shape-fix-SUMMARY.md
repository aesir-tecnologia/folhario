---
phase: 05-catalog-meu-jardim
plan: 22
subsystem: ui
tags: [catalog, photo-journal, response-shape, optimistic-cache, gap-closure, tdd]

requires:
  - phase: 05-catalog-meu-jardim
    provides: photo-journal POST route + JournalAddSheet component (Plan 05-15 / pre-WR-05 baseline)
provides:
  - Aligned client read of POST /api/v1/plants/:plantId/photo-entries response shape with locked server contract (`{ photo_entry: ... }`)
  - Unit test (`tests/unit/journal-add-sheet.test.tsx`) asserting cache transition contains real entry, never undefined
  - Stale photo-journal.test.tsx mocks updated to match server contract (Tests 4, 7, 8)
affects: [05-catalog-meu-jardim, 06-care-engine]

tech-stack:
  added: []
  patterns:
    - "Test pattern: render JournalAddSheet inside QueryClientProvider, use `gcTime: Infinity` so unobserved queries are not garbage-collected during React 19 effects/Radix portal mount cycles"
    - "Snake-case `{ photo_entry: ... }` response key — canonical shape matching all other Phase-5 route handlers (`{ plant: ... }`, `{ photo_entries: ... }`, `{ locations: ... }`)"

key-files:
  created:
    - tests/unit/journal-add-sheet.test.tsx
  modified:
    - src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx
    - tests/unit/photo-journal.test.tsx

key-decisions:
  - "Plan 05-22: existing photo-journal.test.tsx Tests 4, 7, 8 had mocks emitting `{ data: ... }` mirroring the buggy client; updated to `{ photo_entry: ... }` per the locked route contract (route.ts:112). Bundled with the GREEN commit so unit-dom suite stays green at HEAD (Rule 1 — stale test mocks)."
  - "Plan 05-22: new test uses `gcTime: Infinity, staleTime: Infinity` on the controlled QueryClient. With `gcTime: 0` (initial attempt), TanStack Query garbage-collected the seeded `setQueryData({ items: [] })` entry between seed and component mount — the optimistic write then created a new cache entry the test did not seed, and assertions saw `[]` regardless. Pattern recorded for future colocated component tests that read cache after async flows."
  - "Plan 05-22: no defense-in-depth `entries.filter(Boolean)` added to photo-journal.tsx — out-of-scope per the plan threat model T-05-22-02 disposition (the fix removes the undefined window entirely; render-time filtering is unnecessary)."

patterns-established:
  - "WR-05 closure: response-shape contract verified via TanStack Query cache-transition assertion in unit-dom test; no Playwright dependency for an internal-state contract."

requirements-completed: [CAT-06, UI-11]

duration: ~12 min
completed: 2026-05-01
---

# Phase 05 Plan 22: Journal-Add Response Shape Fix Summary

**Closed WR-05 by changing 2 characters in `journal-add-sheet.tsx` (`body.data` → `body.photo_entry`) and added a unit test asserting the post-success cache contains the real entry instead of an `undefined` row; aligned 3 stale photo-journal.test.tsx mocks to the locked route contract.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-05-01T21:28Z (approx — plan dispatched in current session)
- **Completed:** 2026-05-01T21:41Z
- **Tasks:** 1 (RED + GREEN as a single TDD task per plan structure)
- **Files modified:** 3 (1 source, 2 tests — 1 created, 1 modified)

## Accomplishments

- WR-05 closed: optimistic temp entry is now replaced with the real `body.photo_entry` from the POST response — the previous code wrote `undefined` into the cache, risking a render crash on `entries.map((e) => e.id)` between cache-set and the follow-up `invalidateQueries` refetch.
- Server contract preserved verbatim: `src/app/api/v1/plants/[plantId]/photo-entries/route.ts:109-115` was not touched. The fix was client-only.
- New unit test (`tests/unit/journal-add-sheet.test.tsx`) drives the file-input + submit flow against a controlled QueryClient and asserts no undefined rows enter the cache after a successful POST. Test was empirically RED before the source change, GREEN after.
- Aligned 3 stale mocks in `tests/unit/photo-journal.test.tsx` (Tests 4, 7, 8) that previously emitted `{ data: realEntry }` mirroring the bug. Updated to `{ photo_entry: realEntry }` matching the route handler contract — keeps the unit-dom suite green at HEAD (139/139 passing).

## Task Commits

Each task was committed atomically:

1. **Task 1 (RED): failing test for body.photo_entry contract** — `e39e2fb` (test)
2. **Task 1 (GREEN): journal-add-sheet reads body.photo_entry; aligned stale mocks** — `d358a2f` (feat)

_TDD gate sequence: RED `test(...)` → GREEN `feat(...)` — both commits present in `git log`._

## Files Created/Modified

- `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx` — type assertion `as { data: PhotoEntry }` → `as { photo_entry: PhotoEntry }`; field access `body.data` → `body.photo_entry` at lines 127-129 (2-character delta as designed in the plan).
- `tests/unit/journal-add-sheet.test.tsx` — NEW. Single test mocks fetch with `{ photo_entry: realEntry }`, drives file-input + submit through the rendered Radix Dialog, asserts the QueryClient cache transitions from `{ items: [tempEntry] }` to `{ items: [realEntry] }` with no undefined rows.
- `tests/unit/photo-journal.test.tsx` — Tests 4, 7, 8 fetch mocks updated: `{ data: ... }` → `{ photo_entry: ... }` (3 occurrences, all matching the route contract at `route.ts:112`).

## Decisions Made

- **`gcTime: Infinity` in test QueryClient** — initial test attempt with `gcTime: 0` returned an empty cache because TanStack Query immediately garbage-collected the seeded `setQueryData({ items: [] })` entry once no observer was attached. Setting `gcTime: Infinity, staleTime: Infinity` keeps the seed intact across the optimistic update and final assertion. Pattern noted for future colocated component tests.
- **Stale mocks in photo-journal.test.tsx are part of WR-05** — the existing tests pre-dated the gap-closure plan; their mocks were written to match the bug, not the route contract. Bundled their alignment with the GREEN commit so the unit-dom suite stays green at HEAD. Documented as a Rule 1 deviation.
- **No defense-in-depth `entries.filter(Boolean)` in photo-journal.tsx** — explicitly out-of-scope per plan threat model T-05-22-02 (`accept` disposition: the fix removes the undefined window; render-time filtering is unnecessary).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale mocks in `tests/unit/photo-journal.test.tsx` mirrored the buggy client**

- **Found during:** Task 1 (GREEN — running full unit-dom suite per advisor recommendation before committing GREEN)
- **Issue:** Tests 4, 7, and 8 in `photo-journal.test.tsx` mocked the POST response as `{ data: realEntry }` — matching the bug, not the route contract. Test 4 in particular would have crashed on `items.some((e) => e.id === "real-id")` after the source fix because `body.photo_entry` would be undefined under the stale mock, leaving `[undefined, ENTRY_A]` in the cache.
- **Fix:** Updated 3 mock occurrences from `{ data: ... }` to `{ photo_entry: ... }` in `tests/unit/photo-journal.test.tsx`.
- **Verification:** Full unit-dom suite green (139/139). Plan acceptance gates unchanged (they only grep the source file).
- **Committed in:** `d358a2f` (GREEN commit, bundled with source fix)

**2. [Rule 3 - Blocking] `gcTime: 0` in test QueryClient garbage-collected seeded cache**

- **Found during:** Task 1 (GREEN — initial attempt to verify GREEN test passes)
- **Issue:** Test seeded `qc.setQueryData(QUERY_KEY, { items: [] })` then mounted `<JournalAddSheet>`. With `gcTime: 0`, TanStack Query immediately garbage-collected the seeded entry because no observer was attached. The optimistic update inside the component then created a fresh cache entry the test never observed; assertion saw an empty `[]` regardless of source behavior. Test failed both before AND after the fix — couldn't distinguish RED from GREEN.
- **Fix:** Changed test QueryClient defaults to `gcTime: Infinity, staleTime: Infinity`.
- **Verification:** Pre-fix: test correctly fails with `hasReal: false` (body.data undefined). Post-fix: test passes with cache containing realEntry.
- **Committed in:** `d358a2f` (GREEN commit, part of the new test file)

---

**Total deviations:** 2 auto-fixed (1 Rule 1 bug, 1 Rule 3 blocking)
**Impact on plan:** Both deviations were necessary for the test to be a meaningful RED/GREEN gate. No scope creep — both deviations stayed inside the test/source surface defined by the plan.

## Issues Encountered

- **Initial test pattern with `gcTime: 0` masked the bug** — see deviation #2 above. Resolved by switching to `Infinity` per established pattern from neighbouring `photo-journal.test.tsx` (which uses `gcTime: 0` but seeds + asserts within `act()` boundaries that hold observer references). For component tests that mount → submit → assert across multiple `act()` cycles, `Infinity` is the safer default.
- **Pre-existing test mocks mirrored the bug** — see deviation #1 above. Caught by running the full unit-dom suite before commit per advisor recommendation; would have been a silent regression in CI otherwise.

## TDD Gate Compliance

- RED commit (`e39e2fb`): `test(05-22): add failing test for journal-add-sheet body.photo_entry contract (WR-05)` — verified empirically failing before source change.
- GREEN commit (`d358a2f`): `feat(05-22): journal-add-sheet reads body.photo_entry from POST response (WR-05)` — verified passing after source change + mock alignment.
- REFACTOR: skipped — GREEN is a 2-character source delta + 1 new test file; no duplication or cleanup target.

## Verification

```
$ pnpm typecheck
> tsc --noEmit
(clean)

$ pnpm vitest run --project=unit-dom tests/unit/journal-add-sheet.test.tsx
Test Files  1 passed (1)
     Tests  1 passed (1)

$ pnpm vitest run --project=unit-dom
Test Files  18 passed (18)
     Tests  139 passed (139)

$ grep -c photo_entry tests/unit/journal-add-sheet.test.tsx
2

$ grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/journal/journal-add-sheet.tsx | grep -c body.photo_entry
1

$ grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/journal/journal-add-sheet.tsx | grep -c body\.data
0
```

All plan acceptance gates pass.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- WR-05 fully closed; SC-4 photo-journal "add entry" flow no longer flickers undefined rows.
- CAT-06 + UI-11 photo-journal CRUD contract now consistent with the locked server response shape.
- No remaining client misreads of the photo-entries POST response (`grep -rn body\.data src/` returns zero matches outside this file).
- Plan 21 (CR-03 lightbox signed-URL fix) is independent — `body.photo_entry` will gain `photo_signed_url` + `thumbnail_signed_url` automatically once Plan 21 lands the snake-case mapper extension.

## Self-Check: PASSED

Files verified to exist:
- FOUND: src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx (modified)
- FOUND: tests/unit/journal-add-sheet.test.tsx (created)
- FOUND: tests/unit/photo-journal.test.tsx (modified)

Commits verified to exist:
- FOUND: e39e2fb (RED)
- FOUND: d358a2f (GREEN)

---
*Phase: 05-catalog-meu-jardim*
*Plan: 22*
*Completed: 2026-05-01*
