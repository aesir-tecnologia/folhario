---
phase: 03-design-system-app-shell
plan: "03"
subsystem: design-system
tags: [motion, ui-primitives, skeleton, empty-state, inline-error, capture-button, modal-sheet, button, text-input, select, toggle, tdd]
dependency_graph:
  requires: ["03-01", "03-02"]
  provides: [springs.ts, use-reduced-motion.ts, Skeleton, SkeletonGroup, EmptyState, InlineError, CaptureButton, Button, TextInput, Select, Toggle, ModalSheet]
  affects: ["03-04", "03-05"]
tech_stack:
  added:
    - motion@12.38.0
    - lucide-react@1.11.0
    - sonner@2.0.7
    - "@radix-ui/react-dialog@1.1.15"
    - "@radix-ui/react-tabs@1.1.13"
    - "@radix-ui/react-dropdown-menu@2.1.16"
  patterns:
    - TDD RED/GREEN for all 4 behavioral primitives (Skeleton, EmptyState, InlineError, CaptureButton)
    - vi.hoisted() for mock factories that are referenced inside vi.mock() factory
    - act() wrapping for vi.advanceTimersByTime() when testing React state updates
    - Conditional prop spread (animateProps) to OMIT animate prop under reduced-motion
key_files:
  created:
    - src/shared/motion/springs.ts
    - src/shared/motion/use-reduced-motion.ts
    - src/shared/ui/skeleton.tsx
    - src/shared/ui/empty-state.tsx
    - src/shared/ui/inline-error.tsx
    - src/shared/ui/capture-button.tsx
    - src/shared/ui/button.tsx
    - src/shared/ui/text-input.tsx
    - src/shared/ui/select.tsx
    - src/shared/ui/toggle.tsx
    - src/shared/ui/modal-sheet.tsx
    - src/app/(test)/modal-sheet/page.tsx
    - src/app/(test)/modal-sheet/harness.tsx
    - tests/unit/skeleton-group.test.tsx
    - tests/unit/empty-state.test.tsx
    - tests/unit/inline-error.test.tsx
    - tests/unit/breathing-loop.test.tsx
  modified:
    - package.json (6 new runtime deps)
    - pnpm-lock.yaml
decisions:
  - "vi.hoisted() required for mock factories in breathing-loop.test.tsx — top-level const mocks are in TDZ when vi.mock factory is hoisted"
  - "act() wrapping required for vi.advanceTimersByTime() in skeleton-group.test.tsx — React state updates need flush"
  - "TextInput: {...rest} spread placed BEFORE explicit onFocus/onBlur handlers so callers cannot override the focused state update"
  - "Build failure (ZodError in /api/v1/photos/upload + /api/v1/diagnostics/consent) confirmed pre-existing from Plan 03-02, not caused by this plan"
metrics:
  duration: "~17 minutes"
  completed: "2026-04-27"
  tasks_completed: 6
  files_created: 17
  files_modified: 2
---

# Phase 03 Plan 03: Motion Utilities + UI Primitives Summary

**One-liner:** 11 UI primitives (springs.ts, motion utilities, Skeleton/SkeletonGroup with 300ms gate, EmptyState with inline SVG fallback, InlineError with Overdue Rust, CaptureButton with breathing loop UI-20 pitfall fix, Button/TextInput/Select/Toggle/ModalSheet) backed by 4 TDD test files (19 tests).

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Install deps + motion utilities | d08e50e | springs.ts, use-reduced-motion.ts, package.json |
| 2 | TDD Skeleton+SkeletonGroup (RED+GREEN) | 4fb76a6 (RED), 04fac03 (GREEN) | skeleton.tsx, skeleton-group.test.tsx |
| 3 | TDD EmptyState (RED+GREEN) | 1b3d0f5 (RED), 3da61cc (GREEN) | empty-state.tsx, empty-state.test.tsx |
| 4 | TDD InlineError (RED+GREEN) | 3eebed9 (RED), 876192e (GREEN) | inline-error.tsx, inline-error.test.tsx |
| 5 | TDD CaptureButton (RED+GREEN) | 866ea23 (RED), cd8ba06 (GREEN) | capture-button.tsx, breathing-loop.test.tsx |
| 6 | Button/TextInput/Select/Toggle/ModalSheet + test route | 0a90c2a | 5 primitives + harness/page |

## Installed Versions

| Package | Pinned | Installed |
|---------|--------|-----------|
| motion | 12.38.0 | 12.38.0 |
| lucide-react | 1.11.0 | 1.11.0 |
| sonner | 2.0.7 | 2.0.7 |
| @radix-ui/react-dialog | 1.1.15 | 1.1.15 |
| @radix-ui/react-tabs | 1.1.13 | 1.1.13 |
| @radix-ui/react-dropdown-menu | 2.1.16 | 2.1.16 |

## TDD Gate Compliance

All 4 TDD tasks have both RED (`test(03-03):`) and GREEN (`feat(03-03):`) gate commits:

| Primitive | RED commit | GREEN commit |
|-----------|------------|--------------|
| Skeleton+SkeletonGroup | 4fb76a6 | 04fac03 |
| EmptyState | 1b3d0f5 | 3da61cc |
| InlineError | 3eebed9 | 876192e |
| CaptureButton | 866ea23 | cd8ba06 |

## Verification Results

- `pnpm typecheck` — PASSED (0 errors, 11 new primitives compile under strict)
- `pnpm lint` (new files only) — PASSED (0 errors; 4 pre-existing errors in heartbeat-route-contract.test.ts from Plan 03-02 are out of scope)
- Unit tests — PASSED (373/373 tests, 24 test files including all 4 new TDD files)
- `tests/unit/banned-patterns-snapshot.test.ts` — PASSED against all 11 new ui/ + 2 motion/ files (no banned literals)
- `pnpm build` — FAILED (pre-existing ZodError in /api/v1/photos/upload + /api/v1/diagnostics/consent, confirmed pre-existing before Plan 03-03 changes via git stash test)

## Shimmer Keyframes + Stylelint

The `@keyframes shimmer` + `@utility animate-shimmer` CSS block was pre-installed in `src/app/globals.css` by Plan 03-01 (Wave 0 gap closure). The `linear-gradient()` call in that CSS is a decorative background-image (shimmer), NOT a banned text fill. Stylelint's narrowed gradient ban targets gradient TEXT (`background-clip: text + -webkit-text-fill-color: transparent` per MEDIUM 8 codex review), so no inline disable was required.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] skeleton-group.test.tsx: wrapped vi.advanceTimersByTime in act()**

- **Found during:** Task 2 GREEN phase
- **Issue:** `vi.advanceTimersByTime()` fires the timer callback but React state update via `setShow(true)` wasn't flushed to the DOM before the assertion. Test failed: `expected null not to be null`.
- **Fix:** Wrapped `vi.advanceTimersByTime(299)` and `vi.advanceTimersByTime(2)` calls in `act(() => { ... })` from `@testing-library/react`
- **Files modified:** `tests/unit/skeleton-group.test.tsx`
- **Commit:** 04fac03

**2. [Rule 1 - Bug] breathing-loop.test.tsx: vi.hoisted() to escape temporal dead zone**

- **Found during:** Task 5 GREEN phase
- **Issue:** `motionButtonMock` defined as a top-level `const` was in the temporal dead zone when the hoisted `vi.mock()` factory tried to reference it. Error: `ReferenceError: Cannot access 'motionButtonMock' before initialization`.
- **Fix:** Wrapped the mock function declaration in `vi.hoisted(() => { ... })` which executes before the hoist happens.
- **Files modified:** `tests/unit/breathing-loop.test.tsx`
- **Commit:** cd8ba06

**3. [Rule 1 - Bug] breathing-loop.test.tsx: replaced any param with typed MockButtonProps**

- **Found during:** Task 6 lint verification
- **Issue:** `({ children, ...props }: any)` in the mock function triggered `@typescript-eslint/no-explicit-any` lint error.
- **Fix:** Extracted `interface MockButtonProps` with typed fields (`children?: React.ReactNode`, `animate?: unknown`, `transition?: unknown`, `className?: string`, `[key: string]: unknown`).
- **Files modified:** `tests/unit/breathing-loop.test.tsx`
- **Commit:** 0a90c2a

**4. [Rule 1 - Bug] text-input.tsx: spread {…rest} before explicit event handlers**

- **Issue (advisor flag):** Plan's prescribed code had `{...rest}` AFTER the explicit `onFocus`/`onBlur` handlers. JSX spread order-sensitive — later wins. A caller passing `onFocus` would override the handler that calls `setFocused(true)`, breaking the visual state.
- **Fix:** Moved `{...rest}` before the explicit handlers so callers can pass extra props but the focused state logic always runs.
- **Files modified:** `src/shared/ui/text-input.tsx`
- **Commit:** 0a90c2a

## Known Stubs

None — all primitives are functional implementations with correct data wiring. No hardcoded empty values, placeholder text, or unconnected props flow to UI rendering.

## Deferred Items (out of scope)

- **Pre-existing build failure:** `pnpm build` fails with ZodError in `/api/v1/photos/upload` and `/api/v1/diagnostics/consent`. Confirmed pre-existing before Plan 03-03 changes. Deferred to the plan that owns those route handlers.

## Self-Check: PASSED

Files exist:
- `src/shared/motion/springs.ts` ✓
- `src/shared/motion/use-reduced-motion.ts` ✓
- `src/shared/ui/skeleton.tsx` ✓
- `src/shared/ui/empty-state.tsx` ✓
- `src/shared/ui/inline-error.tsx` ✓
- `src/shared/ui/capture-button.tsx` ✓
- `src/shared/ui/button.tsx` ✓
- `src/shared/ui/text-input.tsx` ✓
- `src/shared/ui/select.tsx` ✓
- `src/shared/ui/toggle.tsx` ✓
- `src/shared/ui/modal-sheet.tsx` ✓
- `src/app/(test)/modal-sheet/page.tsx` ✓
- `src/app/(test)/modal-sheet/harness.tsx` ✓
- `tests/unit/skeleton-group.test.tsx` ✓
- `tests/unit/empty-state.test.tsx` ✓
- `tests/unit/inline-error.test.tsx` ✓
- `tests/unit/breathing-loop.test.tsx` ✓
