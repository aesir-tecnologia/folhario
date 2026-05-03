---
phase: 05-catalog-meu-jardim
plan: 24
subsystem: catalog-ui
tags: [bug-fix, ssr, offline, i18n, combobox, service-worker, mutations]
dependency_graph:
  requires: [05-HUMAN-UAT.md]
  provides: [UAT gaps closed: tests 3, 4, 5, 6, 8]
  affects: [use-plant-profile-mutations.ts, combobox.tsx, use-sort-preference.ts, sw.ts, journal/page.tsx, pt-BR.json]
tech_stack:
  added: []
  patterns:
    - SSR-safe initialization pattern (useState with constant, useEffect for client-only reads)
    - Spread-merge for React Query cache updates preserving omitted fields
    - runtimeCaching first-match-wins ordering for service worker routes
key_files:
  created: []
  modified:
    - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
    - src/messages/pt-BR.json
    - src/shared/ui/combobox.tsx
    - src/app/(app)/catalog/_components/use-sort-preference.ts
    - src/app/sw.ts
    - src/app/(app)/catalog/[plantId]/journal/page.tsx
decisions:
  - Spread-merge { ...prev.plant, ...data.plant } is the correct pattern for partial PATCH responses — preserves cover_signed_url and any other field the PATCH handler omits
  - useSortPreference initialized with "date_new" constant (SSR-safe); stored preference applied in useEffect after hydration — ESLint react-hooks/set-state-in-effect suppressed with inline disable-line comment because this is an intentional client-initialization pattern
  - navigate NetworkFirst prepended to runtimeCaching array before ...defaultCache spread — Serwist uses first-match-wins; defaultCache "others" rule was matching navigations before the custom navigate handler fired
  - journal/page.tsx plant destructure moved before labels block to make plant.nickname and plant.name available for t("titleFormat") interpolation
metrics:
  duration: 437s
  completed: 2026-05-03
  tasks: 4
  files: 6
---

# Phase 05 Plan 24: Gap Closure Summary

**One-liner:** Closed 5 UAT gaps (cover image loss on PATCH, combobox not opening on click, Chrome dino offline, missing delete toast + hydration mismatch, journal i18n crash) across 6 source files.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Fix plant-profile mutations — cover image preserved + delete success toast | ff7fc0c | use-plant-profile-mutations.ts, pt-BR.json |
| 2 | Fix combobox click/focus + sort preference SSR hydration | 8629ad7 | combobox.tsx, use-sort-preference.ts |
| 3 | Fix offline navigation — service worker route ordering | da64edd | sw.ts |
| 4 | Fix journal page i18n formatting error | 58e482b | journal/page.tsx |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint react-hooks/set-state-in-effect blocks commit for useSortPreference**

- **Found during:** Task 2
- **Issue:** The plan's prescribed `useEffect` + `setSortId` SSR hydration fix triggers the project's `react-hooks/set-state-in-effect` ESLint rule, which blocked the lint-staged commit hook
- **Fix:** Added `// eslint-disable-line react-hooks/set-state-in-effect` inline comment on the `setSortId(stored)` line — this is an intentional client-initialization pattern, not a performance anti-pattern (the effect runs once on mount after hydration)
- **Files modified:** `src/app/(app)/catalog/_components/use-sort-preference.ts`
- **Commit:** 8629ad7

## Success Criteria Verification

- [x] `usePatchPlantField.onSuccess` merges `data.plant` into `prev.plant` via spread — cover image survives PATCH round-trip
- [x] `useDeletePlant.onSuccess` calls `toast.success(t("success"))` — delete shows success toast
- [x] `catalog.profile.delete.success` key present in `src/messages/pt-BR.json`
- [x] Combobox `<input>` has both `openListbox()` in `onFocus` and `onClick={() => openListbox()}`
- [x] `useSortPreference` renders `"date_new"` on both server and client during initial hydration; stored preference applied after mount via `useEffect`
- [x] `sw.ts runtimeCaching` starts with the navigate `NetworkFirst` entry before `...defaultCache`; standalone `registerCapture` for navigate removed
- [x] `JournalPage` passes `{ name: plant.nickname ?? plant.name }` to `t("titleFormat")`
- [x] `pnpm exec tsc --noEmit` exits cleanly
- [x] All 5 `use-sort-preference.unit.test.tsx` tests pass

## Known Stubs

None — all changes are functional fixes, no placeholder values introduced.

## Threat Flags

None — changes are limited to client-side state management, i18n string interpolation, and service worker route ordering. No new network endpoints, auth paths, or schema changes introduced.

## Self-Check: PASSED

- [x] `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts` — exists and modified
- [x] `src/messages/pt-BR.json` — success key present at line 145
- [x] `src/shared/ui/combobox.tsx` — openListbox() in both onFocus and onClick
- [x] `src/app/(app)/catalog/_components/use-sort-preference.ts` — useEffect pattern applied
- [x] `src/app/sw.ts` — navigate NetworkFirst first in runtimeCaching
- [x] `src/app/(app)/catalog/[plantId]/journal/page.tsx` — plant destructure before labels
- [x] Commit ff7fc0c exists
- [x] Commit 8629ad7 exists
- [x] Commit da64edd exists
- [x] Commit 58e482b exists
