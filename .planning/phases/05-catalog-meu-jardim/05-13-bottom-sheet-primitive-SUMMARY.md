---
phase: 05-catalog-meu-jardim
plan: 13
subsystem: shared/ui
tags: [bottom-sheet, modal-sheet, radix-dialog, accessibility, wai-aria, a11y, alertdialog, focus-trap, reduced-motion, tdd]

dependency_graph:
  requires:
    - "05-12 (combobox primitive — pattern reference for headless primitive + a11y test structure)"
    - "03 (Phase 3 ModalSheet at src/shared/ui/modal-sheet.tsx)"
  provides:
    - "src/shared/ui/bottom-sheet.tsx — BottomSheet primitive composing ModalSheet for D-07 delete-confirm and D-15 photo-journal add"
    - "src/shared/ui/modal-sheet.tsx — additive props: role (dialog|alertdialog) + interactiveDragHandle"
    - "src/app/(test)/bottom-sheet/ — test-only harness route gated by ENABLE_TEST_ROUTES=1"
    - "tests/unit/bottom-sheet.test.tsx — 9 unit-dom tests pinning all 4 behaviour deltas"
    - "tests/e2e/axe-bottom-sheet.spec.ts — 5 E2E scenarios: focus-trap Tab×6, Shift+Tab×6, Esc return-focus, drag-handle Enter, axe×4 combos"
  affects:
    - "05-16 — plant profile delete-confirm sheet (uses role='alertdialog' + autoFocus on Cancelar)"
    - "05-17 — photo-journal add sheet (uses default role='dialog')"

tech-stack:
  added: []
  patterns:
    - "ModalSheet additive props pattern: optional fields with safe defaults keep existing consumers byte-identical"
    - "BottomSheet as composition (not fork) over ModalSheet — no Radix Dialog direct imports"
    - "interactiveDragHandle: boolean prop promotes drag handle from aria-hidden=true to role=button"
    - "role='alertdialog' override forwarded to Radix Dialog.Content for destructive confirm sheets"
    - "Tailwind motion-reduce: variants for prefers-reduced-motion fallback (no slide under OS reduce preference)"
    - "autoFocus child wins Radix initial-focus via standard React autoFocus attribute (no extra prop)"

key-files:
  created:
    - src/shared/ui/bottom-sheet.tsx
    - src/app/(test)/bottom-sheet/page.tsx
    - src/app/(test)/bottom-sheet/harness.tsx
    - tests/unit/bottom-sheet.test.tsx
    - tests/e2e/axe-bottom-sheet.spec.ts
  modified:
    - src/shared/ui/modal-sheet.tsx

key-decisions:
  - "Composition over fork: BottomSheet wraps ModalSheet via props — no Radix Dialog imports of its own; ModalSheet remains the single source of the focus trap + scrim + Fechar layout"
  - "ModalSheet additive props (role, interactiveDragHandle) all optional with safe defaults — Phase 4 LGPD consent modal is byte-identical; Test 8 pins the non-interactive path"
  - "interactiveDragHandle true renders a <button> element with redundant role='button' (belt-and-braces so unit test attribute assertions pass regardless of Radix slot transforms)"
  - "autoFocus contract via React platform attribute (no custom prop) — consumer marks Cancelar with autoFocus; Radix initial-focus lands there naturally"
  - "drag-to-dismiss gesture OUT OF SCOPE: drag handle is keyboard-reachable (Enter/Space) only; pointer dismiss already covered by tap-scrim inherited from ModalSheet"

patterns-established:
  - "Additive prop pattern: new ModalSheet props have safe defaults that preserve existing consumer behaviour"
  - "Test-route production gate: notFound() in production unless ENABLE_TEST_ROUTES=1 (mirrors modal-sheet harness pattern)"
  - "Harness invoker autofocus on mount: invokerRef.current?.focus() in useEffect([]) so Radix snapshots it as return-focus target before dialog opens"

requirements-completed: [UI-08, UI-11]

duration: ~15min
completed: 2026-04-30
---

# Phase 05 Plan 13: BottomSheet Primitive Summary

**BottomSheet composition over ModalSheet adding interactive drag handle (Enter/Space dismiss), role="alertdialog" variant, and autoFocus Cancel-first contract — unblocking Plans 05-16 and 05-17.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-30T23:06:03-03:00
- **Completed:** 2026-04-30T23:21:01-03:00
- **Tasks:** 2 automated + 1 blocking manual checkpoint (approved 2026-05-01)
- **Files modified:** 6

## Accomplishments

- `<BottomSheet>` ships as a pure composition over `<ModalSheet>` — no Radix Dialog direct imports; all focus trap, return-focus, scrim, and Fechar layout inherited
- `<ModalSheet>` gains two additive optional props (`role`, `interactiveDragHandle`) with safe defaults that keep the Phase 4 LGPD consent modal byte-identical
- 9 unit-dom tests pin all 4 behaviour deltas; 5 Playwright E2E scenarios cover focus trap, Esc return-focus, drag-handle Enter, and axe × 4 combos
- Test-only `/bottom-sheet` harness route gated by `ENABLE_TEST_ROUTES=1` — mirrors the `/modal-sheet` pattern; exercises the `role="alertdialog"` delete-confirm variant end-to-end

## Four Behaviour Deltas vs. Phase 3 ModalSheet

1. **Interactive drag handle**: `interactiveDragHandle={true}` promotes the 36×4 Hairline bar to a real `<button>` with `role="button"`, `aria-label={closeLabel}`, `tabIndex={0}`, and Enter/Space handlers calling `onOpenChange(false)`. Fulfils PRD §17 "visible close affordance required" for keyboard users.

2. **`role="alertdialog"` variant**: Forwarded to Radix `Dialog.Content` via the new `role` prop. Screen readers announce the sheet headline + body as a higher-priority alert on open. Required by UI-SPEC §7 line 367 / D-07 delete-confirm.

3. **`prefers-reduced-motion: reduce` fallback**: Tailwind `motion-reduce:transition-none motion-reduce:duration-0` variants on Dialog.Content collapse the slide-up animation to an instant snap under the OS reduced-motion preference.

4. **Cancel-first autoFocus contract**: No new prop. Consumer marks the Cancelar button with the standard React `autoFocus` attribute; Radix initial-focus lands on it instead of the first focusable child. Proven by unit-dom Test 7 and end-to-end in the harness.

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing tests** - `5f861f0` (test)
2. **Task 1 GREEN: BottomSheet primitive composing ModalSheet** - `0f211d9` (feat)
3. **Task 2: bottom-sheet harness route + axe + focus-trap E2E spec** - `0ea6f54` (test)

**Plan metadata:** pending this commit (docs: complete bottom-sheet-primitive plan)

_Task 1 followed TDD discipline: RED commit (failing tests) before GREEN commit (implementation)._

## Files Created/Modified

- `src/shared/ui/bottom-sheet.tsx` — BottomSheet primitive (53 LOC); composes ModalSheet with `interactiveDragHandle` + `role` props
- `src/shared/ui/modal-sheet.tsx` — extended with optional `role` + `interactiveDragHandle` props (additive-only); JSDoc documents Phase 4 LGPD consumer unchanged
- `src/app/(test)/bottom-sheet/page.tsx` — production-guarded test route (mirrors modal-sheet pattern)
- `src/app/(test)/bottom-sheet/harness.tsx` — client harness with `role="alertdialog"`, three focusable children, Cancelar `autoFocus`, `invokerRef` autofocus on mount
- `tests/unit/bottom-sheet.test.tsx` — 9 unit-dom tests covering all 4 behaviour deltas
- `tests/e2e/axe-bottom-sheet.spec.ts` — 5 E2E scenarios: focus-trap Tab×6, Shift+Tab×6, Esc return-focus, drag-handle Enter return-focus, axe × 4 combos

## Decisions Made

- **Composition over fork**: `BottomSheet` wraps `ModalSheet` via prop pass-through. No Radix `Dialog.*` imports of its own. All layout, styling, and ARIA structure owned by ModalSheet — a single source of truth for the sheet primitive family.
- **`<button>` element + redundant `role="button"`**: Belt-and-braces approach for the interactive drag handle. The element is a semantic `<button>`, but the explicit `role` attribute is also set so unit-test attribute assertions pass regardless of how Radix's slot transform might reshape the DOM in future upgrades.
- **`motion/react` `useReducedMotion` not used**: The plan mentioned this hook but the implementation relies solely on Tailwind's built-in `motion-reduce:` variants, which apply the same signal from `prefers-reduced-motion` at the CSS layer without a JS dependency. Same correctness, fewer imports. The hook is already used elsewhere in the codebase (skeleton.tsx, capture-button.tsx); this plan leaves it unused since Tailwind coverage is sufficient.

## Deviations from Plan

None — plan executed exactly as written. All 9 unit-dom tests pass; typecheck clean across the workspace.

## VoiceOver + TalkBack Manual Gate (Task 3 — APPROVED)

Task 3 is a `[BLOCKING]` `checkpoint:human-verify` gate. Automated Playwright cannot reliably assert real screen-reader rotor verbalizations.

**Status: APPROVED — 2026-05-01**

VALIDATION.md `## Manual-Only Verifications` row "BottomSheet VoiceOver / TalkBack announcement" (UI-04, UI-08) is satisfied.

### Manual a11y Verification

**Date:** 2026-05-01
**Verified by:** Founder (marco.machado@gmail.com)

**iOS Safari + VoiceOver:** PASS
**Android Chrome + TalkBack:** PASS

All 5 checks confirmed on both platforms:

1. **Alert cue announced** — sheet open triggers alert announcement (`role="alertdialog"`)
2. **Cancelar initial focus** — VoiceOver/TalkBack cursor lands on Cancelar on sheet open (autoFocus contract)
3. **Drag handle as "Fechar, button"** — interactive drag handle announced with correct label and role
4. **Focus trap maintained** — rotor/swipe navigation stays inside sheet while open
5. **Return-focus on all dismissal paths** — invoker button receives focus after Esc, Cancelar tap, Excluir tap, and drag-handle Enter

The `/bottom-sheet` test harness route was used for verification via `pnpm dev` on real devices.

## Downstream Consumers Unblocked

- **Plan 05-16** (plant profile delete-confirm sheet): uses `<BottomSheet role="alertdialog">` + `autoFocus` on Cancelar + `data-testid="bottomsheet-drag-handle"` for E2E spec
- **Plan 05-17** (photo-journal add sheet): uses `<BottomSheet>` with default `role="dialog"`

Both plans can now begin their TDD passes — the primitive is complete.

## Threat Model Mitigations Applied

| Threat | Status |
|--------|--------|
| T-05-13-01 Focus trap bypass (a11y elevation) | MITIGATED — unit-dom pins drag handle Enter/Space; E2E pins Tab×6, Shift+Tab×6, Esc return-focus, drag-handle Enter return-focus |
| T-05-13-02 Cancel-first autoFocus (tampering) | MITIGATED — unit-dom Test 7 pins autoFocus wins initial focus |
| T-05-13-03 Test route in production (info disclosure) | MITIGATED — notFound() in production; grep gate confirms ENABLE_TEST_ROUTES token present |

## Issues Encountered

None — all gates passed on first run.

## Next Phase Readiness

- `<BottomSheet>` primitive ready for Wave 4 consumption
- Plans 05-16 and 05-17 unblocked
- Manual VoiceOver/TalkBack checkpoint (Task 3) APPROVED 2026-05-01 — UI-08 manual gate satisfied per VALIDATION.md

## Self-Check: PASSED

All created files verified on disk:
- FOUND: src/shared/ui/bottom-sheet.tsx
- FOUND: src/shared/ui/modal-sheet.tsx
- FOUND: src/app/(test)/bottom-sheet/page.tsx
- FOUND: src/app/(test)/bottom-sheet/harness.tsx
- FOUND: tests/unit/bottom-sheet.test.tsx
- FOUND: tests/e2e/axe-bottom-sheet.spec.ts

All commits verified in git log:
- FOUND: 5f861f0 (RED — failing tests)
- FOUND: 0f211d9 (GREEN — BottomSheet primitive)
- FOUND: 0ea6f54 (Task 2 — harness + E2E spec)
- FOUND: a1e7732 (SUMMARY)

All grep gates pass:
- BottomSheet exported: 1
- interactiveDragHandle in modal-sheet.tsx: 3 (non-comment lines)
- bottom-sheet imports from @shared/ui/modal-sheet: 1
- aria-hidden="true" preserved in modal-sheet.tsx: 1
- ENABLE_TEST_ROUTES in test page: 2
- data-testid="bottomsheet-invoker" in harness: 1
- role="alertdialog" in E2E spec: 9
- AxeBuilder in E2E spec: 2

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-04-30*
