---
phase: 05-catalog-meu-jardim
plan: 16
subsystem: catalog
tags:
  - catalog
  - plant-profile
  - inline-edit
  - delete-confirm
  - cascade-counts
  - read-only
  - axe
  - tdd
dependency_graph:
  requires:
    - 05-07 (getPlant + listPhotoEntries use-cases)
    - 05-08 (GET /api/v1/plants/[plantId] route handler)
    - 05-09 (PATCH + DELETE /api/v1/plants/[plantId] route handlers)
    - 05-10 (plantsKeys query factory + locationsKeys)
    - 05-11 (useSubscription stub + SubscriptionContext)
    - 05-12 (LocationCombobox primitive)
    - 05-13 (BottomSheet with role=alertdialog)
    - 05-14 (InlineEditField × 5 + Lightbox)
    - 05-15 (CatalogGrid base — /catalog page)
  provides:
    - /catalog/[plantId] plant profile page (Server Component + Client composition)
    - usePatchPlantField — LWW optimistic mutation hook with Idempotency-Key
    - useDeletePlant — optimistic catalog removal + redirect hook
    - DeleteConfirmSheet — ICU cascade-count body, alertdialog role, autoFocus
  affects:
    - 05-17 (manual-add + photo-journal pages — seedPlant E2E helper reusable)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN per-task
    - Server Component + HydrationBoundary (dehydrate/rehydrate)
    - TanStack Query optimistic updates + LWW rollback (D-06)
    - Idempotency-Key header per logical user save action (HIGH-3)
    - autoFocus Cancel-first focus on alertdialog (D-07 + UI-SPEC §7)
    - ReadOnlyError class for defense-in-depth subscription gate
key_files:
  created:
    - src/app/(app)/catalog/[plantId]/page.tsx
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx
    - src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx
    - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
    - tests/unit/use-plant-profile-mutations.test.tsx
    - tests/unit/delete-confirm-sheet.test.tsx
    - tests/e2e/plant-profile.spec.ts
  modified: []
decisions:
  - "Used relative path imports in test files (no @app/* tsconfig alias exists; only @contexts/* and @shared/*)"
  - "Committed all source files (page, plant-profile, delete-confirm-sheet, mutation hooks) in one feat commit after both RED/GREEN cycles completed"
  - "listPhotoEntries result sliced to first 4 items server-side (preview strip limit) and stored under queryKey without limit param to match plantsKeys.photoEntries(plantId) key shape"
  - "PlantDetailCache uses snake_case _meta shape (photo_entry_count / reminder_count) to match what route handler returns and what E2E assertions check"
metrics:
  duration_minutes: 67
  completed_date: "2026-05-01T19:01:39Z"
  task_count: 3
  file_count: 7
---

# Phase 05 Plan 16: Plant Profile Page Summary

Plant profile page at `/catalog/[plantId]` — Server Component data fetch via `getPlant` + `listPhotoEntries`, five `<InlineEditField>` instances with LWW optimistic updates and Idempotency-Key headers, `<DeleteConfirmSheet>` with ICU cascade-count body variants (role=alertdialog, autoFocus Cancelar), `useSubscription()` read-only gate, full Playwright E2E suite with axe-core.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | Failing tests for mutation hooks | a5c4846, 5118235 | tests/unit/use-plant-profile-mutations.test.tsx |
| 1 GREEN | Mutation hooks + Server Component + PlantProfile | 6d70e91 | use-plant-profile-mutations.ts, page.tsx, plant-profile.tsx, delete-confirm-sheet.tsx |
| 2 RED | Failing tests for DeleteConfirmSheet | eb9fe60 | tests/unit/delete-confirm-sheet.test.tsx |
| 2 GREEN | DeleteConfirmSheet implementation (included in Task 1 GREEN commit) | 6d70e91 | delete-confirm-sheet.tsx |
| 3 | Playwright E2E spec | f2372e6, 7977987 | tests/e2e/plant-profile.spec.ts |

## Unit Test Results

- `tests/unit/use-plant-profile-mutations.test.tsx`: 7 tests, all pass
- `tests/unit/delete-confirm-sheet.test.tsx`: 10 tests, all pass
- Full unit-dom suite: 121 tests, 15 files, all pass
- Full unit (node) suite: 669 tests, 41 files, all pass

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] No @app/* tsconfig path alias**

- **Found during:** Task 1 (RED — test import)
- **Issue:** Tests imported via `@app/(app)/catalog/[plantId]/use-plant-profile-mutations` but `tsconfig.json` only defines `@contexts/*` and `@shared/*` — no `@app/*` alias. Vitest resolution failed.
- **Fix:** Changed all test imports to relative paths (`../../src/app/(app)/catalog/[plantId]/...`), matching the pattern used by other unit tests in the codebase.
- **Files modified:** `tests/unit/use-plant-profile-mutations.test.tsx`, `tests/unit/delete-confirm-sheet.test.tsx`
- **Commits:** 5118235

**2. [Rule 1 - Bug] TypeScript narrowing on mutable variable**

- **Found during:** Task 3 typecheck
- **Issue:** `capturedIdempotencyKey: string | null` combined with `expect(...).not.toBeNull()` narrowed the type to `never` due to TypeScript's inability to narrow mutable variables after an expect call.
- **Fix:** Changed to `string | undefined` and used `.toBeDefined()` assertion with explicit `!== undefined` guard.
- **Files modified:** `tests/e2e/plant-profile.spec.ts`
- **Commit:** 7977987

**3. [Rule 1 - Bug] TypeScript type mismatch on next-intl t() call**

- **Found during:** typecheck after Task 2 GREEN
- **Issue:** `t(bodyKey, bodyValues as Record<string, unknown>)` failed typecheck — `next-intl` expects `Record<string, string | number | Date>`.
- **Fix:** Cast to `Record<string, string | number | Date>`.
- **Files modified:** `src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx`
- **Commit:** included in 6d70e91

### Structural Notes

The plan described Task 2 GREEN as a separate commit from Task 1 GREEN. In practice, the `delete-confirm-sheet.tsx` was part of the same commit as `plant-profile.tsx` and `page.tsx` (6d70e91) because they all compose together and `plant-profile.tsx` imports from `delete-confirm-sheet.tsx` — splitting them would have caused a transient typecheck failure. This is a minor sequencing deviation; all artifacts are present and tested.

## Verification Gates

All plan verification gates pass:

| Gate | Result |
|------|--------|
| InlineEditField count ≥ 5 | 6 (includes import) |
| notFound() count ≥ 1 | 3 |
| useSubscription count ≥ 1 | 3 |
| HydrationBoundary count ≥ 1 | 3 |
| role="alertdialog" in DeleteConfirmSheet | 1 |
| autoFocus in DeleteConfirmSheet | 1 |
| 4 body key variants | 4 (bodyBoth, bodyPhotosOnly, bodyRemindersOnly, bodyEmpty) |
| AxeBuilder in E2E spec | 2 |
| alertdialog in E2E spec | 1 |
| read-only fixture in E2E spec | 6 |
| typecheck clean | PASS |
| unit-dom suite (17 new tests) | 17/17 PASS |

## Known Stubs

- **Phase 6 placeholder**: ID history section renders nothing (HIDDEN per UI-SPEC §6 Section 5) — intentional per CONTEXT.md scope boundary, Phase 6 wires it.
- **Phase 7 placeholder**: Care card section renders nothing (HIDDEN per UI-SPEC §6 Section 6) — intentional, Phase 7 wires it.
- **Phase 8 placeholder**: Active reminders section shows static copy + inert link to `/settings/notifications` — intentional, Phase 8 wires real data.

These are intentional phase deferrals documented in CONTEXT.md `<deferred>`, not accidental stubs.

## Threat Surface

No new network endpoints introduced — all routes were shipped by 05-08/05-09. The Server Component passes ownership-checked data via `HydrationBoundary` (T-05-16-01 mitigated). Read-only gate is UI-only as documented in T-05-16-04 (acceptable stub; Phase 10 closes server-side).

## Self-Check: PASSED

- All 7 source + test files exist on disk: FOUND
- All commits (a5c4846, 5118235, eb9fe60, 6d70e91, f2372e6, 7977987) exist in git log: FOUND
- Typecheck: CLEAN
- unit-dom: 121/121 PASS
- unit: 669/669 PASS
