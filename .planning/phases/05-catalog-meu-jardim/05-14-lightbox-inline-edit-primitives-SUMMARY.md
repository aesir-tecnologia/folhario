---
phase: 05-catalog-meu-jardim
plan: 14
subsystem: shared/ui
tags: [lightbox, inline-edit, accessibility, wai-aria, axe, focus-trap, reduced-motion, tdd, primitives, radix-dialog]

dependency_graph:
  requires:
    - "Phase 3 ModalSheet (src/shared/ui/modal-sheet.tsx) — Radix Dialog composition pattern"
    - "05-12 (combobox primitive — a11y + test patterns; render-prop slot avoids hard import dependency)"
    - "05-13 (bottom-sheet primitive — autoFocus + reduced-motion Tailwind patterns)"
  provides:
    - "src/shared/ui/lightbox.tsx — Full-screen photo overlay built on Radix Dialog with swipe + reduced-motion fallback"
    - "src/shared/ui/inline-edit-field.tsx — Tap-to-edit state machine with text/textarea/date variants + renderEditor slot"
    - "src/app/(test)/lightbox/ — test-only harness route for axe + focus-trap scans"
    - "src/app/(test)/inline-edit-field/ — test-only harness route for axe + role=alert scans"
    - "tests/e2e/axe-lightbox.spec.ts — 5 E2E gates: 4 axe combos + T-05-14-02 focus-trap"
    - "tests/e2e/axe-inline-edit-field.spec.ts — 5 E2E gates: 4 axe combos + E2E case 21 revert alert"
  affects:
    - "05-16 (plant profile — composes InlineEditField for inline editing; Lightbox for photo gallery)"
    - "05-17 (photo journal — composes Lightbox for photo viewing)"

tech_stack:
  added: []
  patterns:
    - "Radix Dialog wrap for Lightbox: Dialog.Root → Portal → Overlay + Content (focus trap + return-focus + Esc dismiss inherited)"
    - "useReducedMotion from motion/react to branch animation classes: transform+opacity (normal) vs opacity-only (reduced)"
    - "onCloseAutoFocus with event.preventDefault() + invokerRef.current?.focus() for controlled return-focus"
    - "renderEditor slot pattern: render-prop replaces built-in input during editing — avoids cross-plan dependency on combobox"
    - "Strict-mode-safe Playwright alert selector: scope inside data-testid container to avoid Next.js route-announcer conflict"

key_files:
  created:
    - src/shared/ui/lightbox.tsx
    - src/shared/ui/inline-edit-field.tsx
    - tests/unit/lightbox.test.tsx
    - tests/unit/inline-edit-field.test.tsx
    - src/app/(test)/lightbox/page.tsx
    - src/app/(test)/lightbox/harness.tsx
    - src/app/(test)/inline-edit-field/page.tsx
    - src/app/(test)/inline-edit-field/harness.tsx
    - tests/e2e/axe-lightbox.spec.ts
    - tests/e2e/axe-inline-edit-field.spec.ts
  modified:
    - src/shared/ui/lightbox.tsx (type fix: changedTouches[0] optional guard)

key_decisions:
  - "Lightbox ArrowLeft/Right clamped at boundaries — NO wrap-around (Decision D: wrap creates surprise with hundreds of journal photos)"
  - "Lightbox swipe thresholds locked: distance >=80px AND velocity >=0.3px/ms (Decision B: UI-SPEC §9 line 439 — not left to discretion)"
  - "Multi-touch (pinch-zoom): touchStart guard resets ref + returns without preventDefault (Decision C: native browser default per UI-SPEC §9 line 442)"
  - "InlineEditField combobox variant via renderEditor slot, NOT a builtin variant (Decision A: avoids hard import from @shared/ui/combobox in parallel-execute waves)"
  - "Revert announcement cleared on enterEditing() — no setTimeout, no stale timer (keeps implementation simple; no test asserts auto-clear)"
  - "onCloseAutoFocus added to LightboxProps + forwarded to Dialog.Content — required for harness to return focus to invoker on close"
  - "Playwright alert assertions scoped inside data-testid container — Next.js route announcer (aria-live=assertive) also has role=alert; strict-mode locators require uniqueness"

patterns_established:
  - "Test-route production guard: notFound() unless NODE_ENV!==production OR ENABLE_TEST_ROUTES=1 (mirrors modal-sheet pattern)"
  - "Harness invoker autofocus on mount: invokerRef.current?.focus() in useEffect([]) so Radix snapshots it as return-focus target"
  - "State-controlled wrapper in XSS test: functional component wrapping InlineEditField with useState so displayed value updates after save"

requirements_completed: [UI-08, UI-11]

duration: ~9min
completed: "2026-05-01"
---

# Phase 05 Plan 14: Lightbox + InlineEditField Primitives Summary

**Radix Dialog-wrapped Lightbox with 80px/0.3px/ms swipe thresholds and opacity-only reduced-motion fallback, plus hand-rolled tap-to-edit InlineEditField state machine with renderEditor slot — both shipping 0 serious/critical axe violations across 4 colorScheme×reducedMotion combos.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-05-01T15:44:58Z
- **Completed:** 2026-05-01T15:54:45Z
- **Tasks:** 3 (Task 1 RED + Task 2 GREEN + Task 3 harness/E2E)
- **Files modified:** 10 created + 1 modified (type fix)

## Accomplishments

- `<Lightbox>` ships at `src/shared/ui/lightbox.tsx` (163 LOC): Radix Dialog wrap (focus trap + return-focus + Esc dismiss inherited), horizontal swipe with distance ≥80px AND velocity ≥0.3px/ms thresholds (both required), visible Fechar button (44×44px), `useReducedMotion` animation branch (opacity-only under reduce, transform+opacity normal), ArrowLeft/Right clamped navigation with no wrap, `aria-live="polite"` index indicator for ≥2 photos, pinch-zoom non-interference (no `touch-action:none`, no multi-touch preventDefault)
- `<InlineEditField>` ships at `src/shared/ui/inline-edit-field.tsx` (307 LOC): tap-to-edit state machine (`read → editing → saving → read` + Esc revert + rejection revert + required-empty guard), text/textarea/date built-in variants, `renderEditor` slot for combobox variant (avoids cross-plan dep on 05-12), `role="alert"` for rejection revert + required-empty validation, `aria-busy="true"` + "Salvando…" text label during save (NO spinner), `readOnly` mode (no button role, no tap affordance)
- TDD discipline: RED commit before GREEN commit; 34 unit tests across both files, all passing
- 10 E2E tests all pass: 4 axe combos per primitive (0 serious/critical violations) + T-05-14-02 focus-trap assertion + E2E case 21 revert announcement

## Task Commits

Each task was committed atomically:

1. **Task 1 RED: add failing unit tests** - `9dddd83` (test)
2. **Task 2 GREEN: implement primitives** - `a28086d` (feat)
3. **Task 3: test routes + axe + focus-trap E2E** - `7c47e31` (test)

_TDD gate compliance: RED commit `9dddd83` precedes GREEN commit `a28086d`. Gate sequence verified in git log._

## Files Created/Modified

- `src/shared/ui/lightbox.tsx` — 163 LOC; Radix Dialog wrap + swipe + reduced-motion + keyboard navigation
- `src/shared/ui/inline-edit-field.tsx` — 307 LOC; state machine + 3 built-in variants + renderEditor slot
- `tests/unit/lightbox.test.tsx` — 223 LOC; 16 test cases (12 Lightbox behaviors from plan)
- `tests/unit/inline-edit-field.test.tsx` — 370 LOC; 18 test cases (17 InlineEditField behaviors from plan + slot cancel)
- `src/app/(test)/lightbox/page.tsx` — production-guarded test route
- `src/app/(test)/lightbox/harness.tsx` — invoker autofocus, 3 fixture data-URI photos, onCloseAutoFocus
- `src/app/(test)/inline-edit-field/page.tsx` — production-guarded test route
- `src/app/(test)/inline-edit-field/harness.tsx` — 5 sections: text/textarea/date success, always-fails, read-only
- `tests/e2e/axe-lightbox.spec.ts` — 4 axe combo loop + T-05-14-02 focus-trap mirror test
- `tests/e2e/axe-inline-edit-field.spec.ts` — 4 axe combo loop + E2E case 21 revert assertion

## Decisions Made

- **renderEditor slot over builtin combobox variant** (Decision A): InlineEditField never imports `@shared/ui/combobox`. Wave 4 plan 05-16 wires `<LocationCombobox>` into the slot at the location field's render site.
- **Clamped ArrowLeft/Right** (Decision D): no wrap-around at photo boundaries. Code comment added to lightbox.tsx documenting the decision to prevent future silent reversal.
- **Swipe thresholds locked** (Decision B): 80px AND 0.3px/ms — both as defined in UI-SPEC §9 line 439. Not discretionary.
- **Revert announcement clears on enterEditing()** — no timeout cleanup. Simple lifecycle: rendered while `mode === "error-revert"`, reset when user taps to re-edit. No `setTimeout`, no flaky cleanup effect.
- **onCloseAutoFocus forwarded** from LightboxProps to Dialog.Content — required addition not in plan text, discovered during E2E testing when focus didn't return to invoker. Rule 2 addition (missing critical behavior for the T-05-14-02 focus-trap contract).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] TypeScript type error: `changedTouches[0]` can be undefined**

- **Found during:** Task 2 GREEN (production build typecheck)
- **Issue:** `e.changedTouches[0].clientX` produced `TS2532: Object is possibly 'undefined'` in the production build because `TouchList` index access returns `Touch | undefined`
- **Fix:** Added null guard (`const touch = e.changedTouches[0]; if (!touch) return;`) in both `handleTouchStart` and `handleTouchEnd`
- **Files modified:** `src/shared/ui/lightbox.tsx`
- **Committed in:** `7c47e31` (Task 3 commit — build required before E2E; fix bundled into same file change)

**2. [Rule 2 — Missing] `onCloseAutoFocus` prop not in original LightboxProps**

- **Found during:** Task 3 E2E run — focus-trap spec (T-05-14-02) assertion failed: focus returned to `<body>` rather than `data-testid="lightbox-invoker"` after Esc
- **Issue:** Radix Dialog.Content `onCloseAutoFocus` was not forwarded from LightboxProps; harness had no way to call `event.preventDefault() + invokerRef.current?.focus()`
- **Fix:** Added `onCloseAutoFocus?: (event: Event) => void` to `LightboxProps`; forwarded to `Dialog.Content`; updated harness to pass the handler
- **Files modified:** `src/shared/ui/lightbox.tsx`, `src/app/(test)/lightbox/harness.tsx`
- **Committed in:** `7c47e31` (Task 3 commit)

**3. [Rule 1 — Bug] Playwright strict-mode violation: `getByRole("alert")` matches 2 elements**

- **Found during:** Task 3 E2E run — inline-edit-field axe specs and E2E case 21 failed with "strict mode violation: 2 elements"
- **Issue:** Next.js App Router ships a `<div role="alert" aria-live="assertive" id="__next-route-announcer__">` element on every page; `page.getByRole("alert")` in strict mode cannot resolve when 2 elements match
- **Fix:** Scoped alert selectors to `page.getByTestId("inline-text-failure").getByRole("alert")` — narrows to just our announcement element within the relevant section
- **Files modified:** `tests/e2e/axe-inline-edit-field.spec.ts`
- **Committed in:** `7c47e31` (Task 3 commit)

---

**Total deviations:** 3 auto-fixed (1 Rule 1 type bug, 1 Rule 2 missing prop, 1 Rule 1 test bug)
**Impact on plan:** All fixes necessary for correctness and test integrity. No scope creep.

## Known Stubs

None — both primitives are fully functional with no placeholder data flows.

## Threat Flags

None — both primitives are presentation-only with no auth boundary, no persistence, no network calls (callers handle persistence).

## Threat Model Mitigations Applied

| Threat | Status |
|--------|--------|
| T-05-14-01 XSS via typed value rendering (InlineEditField) | MITIGATED — JSX text nodes only; no `dangerouslySetInnerHTML`; unit test case 17 + XSS wrapper verifies literal angle brackets in read state; `grep -L "dangerouslySetInnerHTML"` lists both source files |
| T-05-14-02 Focus trap escape (Lightbox) | MITIGATED — Radix Dialog.Content provides focus trap; E2E spec axe-lightbox.spec.ts Tab×6 assertion + Esc return-focus to invoker assertion passes in all 4 combos |

## Downstream Consumers Unblocked

- **Plan 05-16** (plant profile): compose `<InlineEditField>` for name/nickname/location/acquisition-date/notes fields; compose `<Lightbox>` for photo journal gallery view
- **Plan 05-17** (photo journal / manual add): compose `<Lightbox>` for journal entry photo viewing
- Location field in plant profile: wire `<LocationCombobox>` into `InlineEditField`'s `renderEditor` slot

## Self-Check: PASSED

All created files exist on disk:
- FOUND: src/shared/ui/lightbox.tsx
- FOUND: src/shared/ui/inline-edit-field.tsx
- FOUND: tests/unit/lightbox.test.tsx
- FOUND: tests/unit/inline-edit-field.test.tsx
- FOUND: src/app/(test)/lightbox/page.tsx
- FOUND: src/app/(test)/lightbox/harness.tsx
- FOUND: src/app/(test)/inline-edit-field/page.tsx
- FOUND: src/app/(test)/inline-edit-field/harness.tsx
- FOUND: tests/e2e/axe-lightbox.spec.ts
- FOUND: tests/e2e/axe-inline-edit-field.spec.ts

All task commits exist in git log:
- FOUND: 9dddd83 (RED — failing unit tests)
- FOUND: a28086d (GREEN — Lightbox + InlineEditField implementation)
- FOUND: 7c47e31 (Task 3 — test routes + E2E specs)

All verification sentinels pass:
- grep -L "dangerouslySetInnerHTML" lists both source files: PASS
- grep -L "@shared/ui/combobox" lists both source files: PASS
- grep -c "Galeria — " lightbox.tsx = 2: PASS
- grep -c "useReducedMotion" lightbox.tsx = 2: PASS
- grep -c 'role="button"' inline-edit-field.tsx = 2: PASS
- grep -c 'role="alert"' inline-edit-field.tsx = 2: PASS
- touch-none count in lightbox.tsx = 0: PASS
- ENABLE_TEST_ROUTES in both test pages = 1 each: PASS
- All 10 E2E tests pass (4+1 lightbox, 4+1 inline-edit-field): PASS
- All 34 unit tests pass: PASS
- Full suite: 665 tests pass (0 failures): PASS

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
