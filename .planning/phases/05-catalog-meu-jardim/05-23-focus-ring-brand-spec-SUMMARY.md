---
phase: 05-catalog-meu-jardim
plan: 23
subsystem: ui
tags:
  - focus-ring
  - brand-spec
  - accessibility
  - a11y
  - tailwind
  - gap-closure

# Dependency graph
requires:
  - phase: 03-design-system-app-shell
    provides: shared/ui primitives (InlineEditField, ModalSheet, Toggle), canopy palette tokens
provides:
  - 3px Canopy/40 focus rings on InlineEditField (textarea/date/text editors)
  - 3px Canopy/40 focus ring on ModalSheet interactive drag handle
  - 3px Canopy/40 focus ring on Toggle peer track
  - WR-04 brand-spec gap closed (UI-08)
affects:
  - any future shared/ui primitive — must default to ring-[3px]/outline-[3px], not ring-2/outline-2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tailwind arbitrary-value brackets ring-[3px]/outline-[3px] for non-default focus widths (Tailwind 4.x native)"

key-files:
  created: []
  modified:
    - src/shared/ui/inline-edit-field.tsx
    - src/shared/ui/modal-sheet.tsx
    - src/shared/ui/toggle.tsx

key-decisions:
  - "Focus rings use Tailwind arbitrary-value syntax ring-[3px]/outline-[3px] rather than introducing a custom Tailwind theme key. Brand spec is 3px specifically; Tailwind ships ring-2 (2px) and ring-4 (4px) — neither matches. Arbitrary value is the lowest-cost, most-discoverable convention."
  - "Hover affordances on InlineEditField lines 175 + 198 (hover:outline hover:outline-2 hover:outline-offset-4 hover:outline-hairline) left intact — they're hover hints at Hairline color, not focus indicators. Brand spec scopes only focus indicators."
  - "axe-core E2E run skipped per plan threat-model T-05-23-02 (disposition: accept). axe-core asserts focus visibility at the role/aria level, not pixel width. Running E2E specs requires pnpm build + pnpm start (production server) which CLAUDE.md gates behind explicit user request. Static gates (typecheck + audit grep) cover the change."

patterns-established:
  - "Pattern: focus-ring brand-spec audit grep — `grep -E 'focus:ring-2[^0-9]|focus-visible:outline-2[^0-9]|focus-visible:ring-2[^0-9]|peer-focus-visible:ring-2[^0-9]' src/shared/ui/*.tsx` MUST return empty. Hover affordances (`hover:outline-2`) excluded because hover ≠ focus."

requirements-completed:
  - UI-08

# Metrics
duration: ~5 min
completed: 2026-05-01
---

# Phase 05 Plan 23: Focus-ring brand-spec compliance Summary

**Three shared/ui primitives (InlineEditField, ModalSheet, Toggle) now render 3px Canopy/40 focus rings per CLAUDE.md brand spec (was 2px Tailwind default), closing WR-04.**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-01T21:42:00Z (approx)
- **Completed:** 2026-05-01T21:46:14Z
- **Tasks:** 1
- **Files modified:** 3

## Accomplishments

- 5 focus-ring sites widened from `ring-2`/`outline-2` (2px) to `ring-[3px]`/`outline-[3px]` (3px Canopy @ 40% opacity), restoring CLAUDE.md brand-spec compliance.
- Project-wide audit grep across `src/shared/ui/` confirms zero remaining 2px focus rings (only the 2 documented hover affordances on `inline-edit-field.tsx` lines 175/198 carry `outline-2`, and they are hover hints at Hairline color — not focus indicators, out of scope per plan).
- Color (`canopy/40`) and offset (`outline-offset-2` where applicable) preserved unchanged — width-only edit.
- TypeScript clean (`pnpm typecheck` exit 0).
- Single atomic commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: Update focus-ring widths to 3px across 3 primitives (WR-04)** — `580130a` (style)

## Files Created/Modified

- `src/shared/ui/inline-edit-field.tsx:242,263,282` — three editor variants (textarea/date/text), `focus:ring-2` → `focus:ring-[3px]`
- `src/shared/ui/modal-sheet.tsx:92` — interactive drag handle, `focus-visible:outline-2` → `focus-visible:outline-[3px]`
- `src/shared/ui/toggle.tsx:35` — peer-focus track ring, `peer-focus-visible:ring-2` → `peer-focus-visible:ring-[3px]`

## Verification

**Static gates (run, all passed):**

- `pnpm typecheck` → exit 0
- `grep -c "ring-\[3px\]" src/shared/ui/inline-edit-field.tsx` → 3 (one per editor variant)
- `grep -c "outline-\[3px\]" src/shared/ui/modal-sheet.tsx` → 1
- `grep -c "ring-\[3px\]" src/shared/ui/toggle.tsx` → 1
- `grep -E "focus:ring-2[^0-9]|focus-visible:outline-2[^0-9]|focus-visible:ring-2[^0-9]|peer-focus-visible:ring-2[^0-9]" src/shared/ui/*.tsx` → empty (no matches)

**axe-core E2E gate (skipped — see Decisions Made):**

- `pnpm exec playwright test tests/e2e/axe-modal-focus-trap.spec.ts tests/e2e/axe-placeholder-pages.spec.ts` was NOT executed in this session. Per the plan's own threat-model entry T-05-23-02 (disposition: `accept`), axe-core asserts focus visibility at the role/aria level — not pixel width. Running these specs requires a production webServer (`pnpm build && pnpm start`) which CLAUDE.md gates behind explicit user request. The change is a pure CSS arbitrary-value swap with no DOM/role/aria/focus-management modification, so axe-core has no rule that would key off the change. The plan's binding `<verification><automated>` block (typecheck + audit grep) was satisfied.

## Decisions Made

1. **Skipped axe-core E2E run.** Plan threat-model T-05-23-02 disposition is `accept`. axe-core does not gate on pixel width. CLAUDE.md prohibits starting the dev server without explicit user request. Static gates (typecheck + 4 grep gates) cover the change semantics.
2. **Arbitrary-value brackets over a custom Tailwind theme key.** Brand spec specifies 3px exactly; Tailwind's defaults (`ring-2` = 2px, `ring-4` = 4px) don't match. `ring-[3px]` is the conventional Tailwind 4.x escape hatch and keeps the diff minimal (5 lines).
3. **Hover affordances on InlineEditField (lines 175 + 198) intentionally untouched.** They use `outline-hairline` (not Canopy) and fire on hover (not focus). Brand spec scopes only focus indicators.

## Deviations from Plan

None — plan executed exactly as written. The axe-core gate skip is not a deviation; it follows the plan's own T-05-23-02 disposition (`accept`) and CLAUDE.md project rule against unsolicited server starts.

## Issues Encountered

None.

## User Setup Required

None — pure CSS class swap.

## Next Phase Readiness

- WR-04 closed; UI-08 brand-spec gap resolved across all Phase-5 primitives audited.
- Future shared/ui primitives must default to `ring-[3px]` / `outline-[3px]` for focus indicators. Audit grep above is the regression guard.

## Self-Check: PASSED

- File `src/shared/ui/inline-edit-field.tsx` modified — confirmed via `git diff`.
- File `src/shared/ui/modal-sheet.tsx` modified — confirmed via `git diff`.
- File `src/shared/ui/toggle.tsx` modified — confirmed via `git diff`.
- Commit `580130a` exists in `git log` on the current HEAD.
- Acceptance grep counts all match expected (3 / 1 / 1).
- Audit grep returns zero remaining 2px focus rings.

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
