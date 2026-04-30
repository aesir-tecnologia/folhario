---
phase: 05-catalog-meu-jardim
plan: 13
type: execute
wave: 1
depends_on: []
files_modified:
  - src/shared/ui/modal-sheet.tsx
  - src/shared/ui/bottom-sheet.tsx
  - src/app/(test)/bottom-sheet/page.tsx
  - src/app/(test)/bottom-sheet/harness.tsx
  - tests/unit/bottom-sheet.test.tsx
  - tests/e2e/axe-bottom-sheet.spec.ts
autonomous: false
requirements: [UI-08, UI-11]
must_haves:
  truths:
    - "Tab and Shift+Tab from inside an open <BottomSheet> never escape to <body>; focus cycles among the sheet's focusable descendants"
    - "Esc closes the sheet and Radix returns focus to the invoking element that opened it"
    - "The drag handle is keyboard-reachable: focus reaches it via Tab, and Enter or Space dismisses the sheet (in addition to the visible Fechar button) — fulfilling PRD §17 'visible close affordance required' twice over"
    - "When `role=\"alertdialog\"` is requested (delete-confirm consumer per D-07 / UI-SPEC §7), the rendered Dialog.Content carries role=\"alertdialog\" — verifiable in the DOM"
    - "When a child opts in via the `autoFocus` attribute (delete-confirm Cancelar button per UI-SPEC §7), Radix initial focus lands on it instead of the first focusable element"
    - "Open/close animation uses transform+opacity (PRD §17 motion rule); under prefers-reduced-motion: reduce the transition collapses to an instant snap (no slide)"
    - "ModalSheet's Phase 4 LGPD-consent consumer continues to render unchanged: same scrim z-index, same drag-handle pixel size, same Fechar tap target, same focus-trap + return-focus behavior — proven by tests/e2e/axe-modal-focus-trap.spec.ts staying green"
  artifacts:
    - path: "src/shared/ui/bottom-sheet.tsx"
      provides: "BottomSheet primitive — composes ModalSheet for Phase 5's two consumers (D-07 delete-confirm, D-15 photo-journal add). Adds: keyboard-reachable drag handle, role=\"alertdialog\" variant, prefers-reduced-motion fallback. Visible Fechar (PRD §17) inherited from ModalSheet."
      exports: ["BottomSheet", "BottomSheetProps"]
      min_lines: 40
    - path: "src/shared/ui/modal-sheet.tsx"
      provides: "Backwards-compatible extensions: optional `role` prop ('dialog' | 'alertdialog', defaults to 'dialog'), optional `interactiveDragHandle` prop (defaults to false — keeps Phase 4 LGPD consumer identical), optional `reducedMotionInstant` opt-in (defaults to true so EVERY consumer honours prefers-reduced-motion). Existing `ModalSheetProps` surface only GAINS optional fields — never removes."
      contains: "interactiveDragHandle"
    - path: "src/app/(test)/bottom-sheet/page.tsx"
      provides: "Test-only route /bottom-sheet gated by ENABLE_TEST_ROUTES=1 (mirrors src/app/(test)/modal-sheet/page.tsx). notFound() in production unless explicit opt-in."
      contains: "ENABLE_TEST_ROUTES"
    - path: "src/app/(test)/bottom-sheet/harness.tsx"
      provides: "Client harness mounting BottomSheet with role='alertdialog', three focusable children, an invoker button (data-testid='bottomsheet-invoker'), and the drag handle reachable as data-testid='bottomsheet-drag-handle'."
      min_lines: 40
    - path: "tests/unit/bottom-sheet.test.tsx"
      provides: "Vitest unit-dom tests: drag-handle a11y (role=button, aria-label='Fechar', Enter and Space close the sheet), role='alertdialog' variant rendering, autoFocus child wins initial focus, prefers-reduced-motion collapses transition class."
      min_lines: 60
    - path: "tests/e2e/axe-bottom-sheet.spec.ts"
      provides: "Playwright spec: focus trap survives Tab × 6 and Shift+Tab × 6, Esc closes + return-focus to invoker, drag-handle Enter dismisses, AxeBuilder runs against the open sheet in the 4 light/dark × no-preference/reduce combos with 0 serious+critical violations."
      min_lines: 80
  key_links:
    - from: "src/shared/ui/bottom-sheet.tsx"
      to: "src/shared/ui/modal-sheet.tsx"
      via: "named import { ModalSheet } and prop pass-through (composition, not fork)"
      pattern: "from \"@shared/ui/modal-sheet\""
    - from: "src/shared/ui/bottom-sheet.tsx (delete-confirm consumer in plan 05-16)"
      to: "Radix Dialog DOM node"
      via: "role='alertdialog' prop forwarded into Dialog.Content's aria-role override"
      pattern: "role=\"alertdialog\""
    - from: "tests/e2e/axe-bottom-sheet.spec.ts"
      to: "/bottom-sheet test route"
      via: "page.goto('/bottom-sheet') + page.getByTestId('bottomsheet-invoker').click()"
      pattern: "bottomsheet-invoker"
    - from: "src/app/(test)/bottom-sheet/page.tsx"
      to: "next/navigation notFound()"
      via: "production guard mirroring src/app/(test)/modal-sheet/page.tsx"
      pattern: "ENABLE_TEST_ROUTES"
---

<objective>
Ship `<BottomSheet>` — the primitive that Phase 5's two new sheet surfaces (D-07 delete-confirm, D-15 photo-journal add) compose. Phase 3 already shipped `<ModalSheet>` (`src/shared/ui/modal-sheet.tsx`), which gives us focus trap, return-focus, scrim, visible Fechar, and a 36×4 drag handle. BottomSheet adds the four behaviours UI-SPEC §7 + RESEARCH.md require but ModalSheet does not yet expose:

1. **Keyboard-reachable drag handle.** ModalSheet today renders the drag handle with `aria-hidden="true"` (modal-sheet.tsx:60), so the bar is decorative. PRD §17 demands a visible close affordance, and UI-SPEC §7 wants the bar to behave as one for keyboard users. BottomSheet promotes the drag handle to `role="button"`, `aria-label="Fechar"`, with Enter/Space firing `onOpenChange(false)`.
2. **`role="alertdialog"` variant.** UI-SPEC §7 line 367 + line 883 require `role="alertdialog"` for the destructive delete-confirm sheet (so screen readers announce the full headline + body on open as a higher-priority alert). Default Radix Dialog renders `role="dialog"`. BottomSheet exposes a `role` prop; ModalSheet gains a passthrough so the existing Phase 4 LGPD consent consumer is byte-identical.
3. **`prefers-reduced-motion: reduce` fallback.** PRD §17 motion rule mandates honouring the OS preference. ModalSheet today has no motion logic at all (it leans on Radix's built-in attributes). BottomSheet's open/close animation is `transform + opacity` only (PRD §17 banned `left/right`); under reduced motion it collapses to an instant snap.
4. **Cancel-first autoFocus contract.** UI-SPEC §7 says Cancelar auto-focuses on sheet open (NEVER Excluir). Today ModalSheet leaves first-focus to Radix's default ("first focusable child"). BottomSheet honours the standard React `autoFocus` attribute on a child — the consuming plan (05-16) marks Cancelar with `autoFocus` and Radix initial-focus lands there. No new prop is invented; we lean on the platform contract.

Composition (not fork). BottomSheet wraps `<ModalSheet>` and forwards new props through. ModalSheet's existing `ModalSheetProps` surface ONLY gains optional fields with safe defaults — Phase 4's LGPD consent modal (the only existing consumer) continues to render byte-identically and `tests/e2e/axe-modal-focus-trap.spec.ts` stays green untouched.

A test-only `/bottom-sheet` route gated by `ENABLE_TEST_ROUTES=1` (mirroring the existing `/modal-sheet` harness at `src/app/(test)/modal-sheet/`) lets the Playwright spec exercise the focus trap, drag-handle keyboard contract, and axe scan in 4 colour-scheme × motion combos before any consumer page exists.

Plan ends with a `[BLOCKING]` `checkpoint:human-verify` for VoiceOver (iOS Safari) + TalkBack (Android Chrome). VALIDATION.md tags this as a manual-only gate (`BottomSheet VoiceOver / TalkBack announcement` row, applies to UI-04 + UI-08) — headless Playwright cannot reliably assert real screen-reader rotor verbalizations.

Purpose: deliver the only wave-1 a11y primitive Phase 5 plans 05-16 (plant profile delete-confirm) and 05-17 (photo-journal add) need to consume. Without this, both UI plans cannot start their TDD passes.

Output: a composed primitive + harness route + automated tests + a manual a11y checkpoint, all delivered before plans 05-16 / 05-17 enter Wave 4.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@CLAUDE.md

@src/shared/ui/modal-sheet.tsx
@src/app/(test)/modal-sheet/page.tsx
@src/app/(test)/modal-sheet/harness.tsx
@tests/e2e/axe-modal-focus-trap.spec.ts
@tests/e2e/axe-placeholder-pages.spec.ts

<interfaces>
<!-- Extracted from codebase. Executor uses these directly — no exploration needed. -->

From src/shared/ui/modal-sheet.tsx (current shape — Phase 3 D-25):
```typescript
import * as Dialog from "@radix-ui/react-dialog";

export interface ModalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  /** Forwarded to Radix `Dialog.Content`. Allows controlled callers to
   *  preventDefault and focus a stored invoker ref themselves. */
  onCloseAutoFocus?: (event: Event) => void;
}

export function ModalSheet(props: ModalSheetProps);
// Renders:
//   <Dialog.Root open onOpenChange>
//     <Dialog.Portal>
//       <Dialog.Overlay className="fixed inset-0 bg-forest/50 z-50" />
//       <Dialog.Content onCloseAutoFocus className="fixed bottom-0 left-0 right-0 z-50 bg-ivory rounded-t-[24px] p-6 max-h-[80dvh] overflow-y-auto">
//         <div className="mx-auto mb-4 h-[4px] w-[36px] rounded-full bg-hairline" aria-hidden="true" />  ← drag handle today
//         <div className="flex items-start justify-between gap-4">
//           <Dialog.Title className="font-serif text-2xl font-medium text-forest">{title}</Dialog.Title>
//           <Dialog.Close asChild>
//             <button type="button" aria-label={closeLabel} className="...44×44 tap target...">
//               <XIcon strokeWidth={1.5} size={24} />
//             </button>
//           </Dialog.Close>
//         </div>
//         <Dialog.Description className="sr-only">{title}</Dialog.Description>
//         <div className="mt-4">{children}</div>
//       </Dialog.Content>
//     </Dialog.Portal>
//   </Dialog.Root>
```

Three new optional props this plan adds to `ModalSheetProps` (backwards-compatible — every default keeps Phase 4's LGPD consumer byte-identical):
```typescript
export interface ModalSheetProps {
  // ...existing fields unchanged...
  /** Override Radix's default role on Dialog.Content. UI-SPEC §7 line 367
   *  requires "alertdialog" for the destructive delete-confirm sheet so SRs
   *  announce headline+body as a higher-priority alert. Defaults to undefined
   *  → Radix renders "dialog" (Phase 4 LGPD consumer is unchanged). */
  role?: "dialog" | "alertdialog";
  /** Promote the 36×4 drag handle to a real keyboard-reachable close button:
   *  role="button", aria-label={closeLabel}, Enter/Space → onOpenChange(false).
   *  Defaults to false (Phase 4 LGPD consumer unchanged: handle stays
   *  aria-hidden=true). BottomSheet sets this to true. */
  interactiveDragHandle?: boolean;
}
```
No removals. No renames. ModalSheet's signature is purely additive.

From src/app/(test)/modal-sheet/page.tsx (the production-guard pattern to mirror):
```typescript
export default function ModalSheetTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <ModalSheetTestHarness />;
}
```

From src/app/(test)/modal-sheet/harness.tsx (the harness pattern to mirror — autofocus invoker on mount so Radix snapshots it for return-focus):
```tsx
const [open, setOpen] = useState(false);
const invokerRef = useRef<HTMLButtonElement>(null);
useEffect(() => { invokerRef.current?.focus(); }, []);
return (
  <main>
    <button ref={invokerRef} type="button" onClick={() => setOpen(true)}
            data-testid="modal-invoker">Open ModalSheet</button>
    <ModalSheet open={open} onOpenChange={setOpen} title="..."
      closeLabel="Fechar"
      onCloseAutoFocus={(event) => { event.preventDefault(); invokerRef.current?.focus(); }}>
      <input data-testid="modal-input" /> ...
    </ModalSheet>
  </main>
);
```

From tests/e2e/axe-modal-focus-trap.spec.ts (the assertion pattern to copy — focus stays inside [role="dialog"] under Tab × 6, then Esc closes, then return-focus to invoker):
```typescript
await page.goto("/modal-sheet");
await page.getByTestId("modal-invoker").click();
await page.waitForSelector('[role="dialog"]');
for (let i = 0; i < 6; i++) {
  await page.keyboard.press("Tab");
  const stillInside = await page.evaluate(() =>
    !!(document.activeElement as HTMLElement | null)?.closest('[role="dialog"]'));
  expect(stillInside).toBe(true);
}
await page.keyboard.press("Escape");
await page.waitForSelector('[role="dialog"]', { state: "detached" });
await page.waitForTimeout(100);
const returnedToInvoker = await page.evaluate(() =>
  (document.activeElement as HTMLElement | null)?.getAttribute("data-testid") === "modal-invoker");
expect(returnedToInvoker).toBe(true);
```
This plan's spec uses the SAME shape, parameterised on `[role="alertdialog"]` for the BottomSheet alertdialog variant (the harness defaults to that variant — see Task 2).

From tests/e2e/axe-placeholder-pages.spec.ts (the COMBOS matrix to copy verbatim for axe scans):
```typescript
const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark",  reducedMotion: "no-preference" },
  { colorScheme: "dark",  reducedMotion: "reduce" },
] as const;
```
Each spec emits 4 axe scans (one per combo). 0 serious + critical violations is the gate.
</interfaces>

<scope_clarifications>
- **Drag-to-dismiss gesture is OUT of scope.** Neither UI-SPEC §7 nor RESEARCH.md specifies a pointer-driven drag-to-dismiss. The drag handle is keyboard-reachable (Enter/Space) only; the visible "Fechar" button + tap-scrim already cover gesture dismissal per Phase 3 D-25. (Verified via grep: no "drag-to-dismiss"/"pull down"/"drag dismiss" matches in 05-RESEARCH.md or 05-UI-SPEC.md.)
- **Pointer events** on the drag handle are NOT wired in this plan. Adding pointer-driven dismiss is a future enhancement gated by user demand; the plan focuses on the keyboard a11y contract that screen-reader users need today.
- **Phase 4 LGPD consent consumer untouched.** That modal currently renders ModalSheet with default props; this plan's prop additions are all optional with defaults that match today's behavior. `tests/e2e/axe-modal-focus-trap.spec.ts` MUST continue to pass without modification.
- **No styling changes** in ModalSheet (radius, Hairline drag-handle bg, scrim z-50, Fechar tap target). All visual tokens stay verbatim.
</scope_clarifications>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: BottomSheet primitive + ModalSheet additive props (RED → GREEN, unit-dom TDD)</name>
  <files>
    - src/shared/ui/modal-sheet.tsx (additive — three new optional props passed into Dialog.Content + drag handle)
    - src/shared/ui/bottom-sheet.tsx (NEW — composes ModalSheet)
    - tests/unit/bottom-sheet.test.tsx (NEW)
  </files>
  <behavior>
    - Test 1 — drag handle becomes interactive: rendering `<BottomSheet open onOpenChange title="t" closeLabel="Fechar">child</BottomSheet>` produces an element with `data-testid="bottomsheet-drag-handle"` carrying `role="button"`, `aria-label="Fechar"`, `tabIndex={0}`. The element is NOT `aria-hidden`.
    - Test 2 — drag handle dismisses on Enter: focusing the drag handle and dispatching `keyDown { key: "Enter" }` invokes `onOpenChange(false)` exactly once.
    - Test 3 — drag handle dismisses on Space: same as Test 2 with `key: " "` (space). One `onOpenChange(false)` call.
    - Test 4 — drag handle ignores other keys: `keyDown { key: "a" }` does NOT call `onOpenChange`.
    - Test 5 — alertdialog variant: rendering `<BottomSheet ... role="alertdialog">` produces a Radix Dialog.Content with attribute `role="alertdialog"` (assert via DOM query inside the portal).
    - Test 6 — default role unchanged: rendering `<BottomSheet ... />` (no `role` prop) produces `role="dialog"` (Radix default). Phase 4 byte-identity guard.
    - Test 7 — child autoFocus wins initial focus: rendering `<BottomSheet ...><button>first</button><button autoFocus data-testid="cancel">Cancelar</button></BottomSheet>` and waiting for portal mount shows `document.activeElement === <button data-testid="cancel">`. Proves UI-SPEC §7 Cancel-first contract works without a new prop.
    - Test 8 — ModalSheet still defaults to non-interactive drag handle: rendering bare `<ModalSheet ...>` (NO `interactiveDragHandle` prop) produces a drag-handle div with `aria-hidden="true"` and NO `role="button"`. Phase 4 LGPD consumer unchanged.
    - Test 9 — closeLabel is forwarded to drag handle aria-label when interactive: `<BottomSheet ... closeLabel="Cerrar">` (hypothetical other locale) renders the drag handle with `aria-label="Cerrar"`. Proves no hard-coded string.
  </behavior>
  <action>
    RED first:
    1. Create `tests/unit/bottom-sheet.test.tsx` covering all 9 behaviours above. Use `@testing-library/react` (already wired in unit-dom project — see `tests/unit/empty-state.test.tsx` and `tests/unit/inline-error.test.tsx` for the existing import shape and `render` usage). Use `userEvent` for keyboard events (preferred over fireEvent for keyboard a11y assertions).
       - For Tests 5/6: query inside `document.body` (not the rendered container) because Radix portals Dialog.Content out of the React tree. Pattern: `document.querySelector('[role="alertdialog"]')` / `document.querySelector('[role="dialog"]')`.
       - For Test 7: wrap the assertion in `await waitFor(() => expect(document.activeElement).toBe(...))` — Radix focus management runs after mount via requestAnimationFrame.
       - For Test 8: import `ModalSheet` directly (NOT via BottomSheet) so the test asserts ModalSheet's own default behaviour didn't regress.
    2. Run `pnpm exec vitest --run --project=unit-dom tests/unit/bottom-sheet.test.tsx`. Expect import failure on `bottom-sheet.tsx` and unmet behaviours on the additive ModalSheet props.
    3. Commit RED: `test(05-13): add failing tests for BottomSheet primitive a11y contract`.

    GREEN — Step A (ModalSheet additive props):
    4. Open `src/shared/ui/modal-sheet.tsx`. Extend `ModalSheetProps` with two new optional fields per the `<interfaces>` block above:
       ```typescript
       role?: "dialog" | "alertdialog";
       interactiveDragHandle?: boolean;
       ```
       Defaults: `role` undefined → Radix native `dialog`; `interactiveDragHandle` undefined → false.
    5. Pass the `role` prop to `Dialog.Content` via the `role` attribute. Radix Dialog allows the consumer to override its rendered role (verify in Context7 if uncertain — see `<documentation_lookup>` in role; library is `@radix-ui/react-dialog`).
    6. Replace the drag handle div block with a conditional render:
       - When `interactiveDragHandle === true`: render `<button type="button" data-testid="bottomsheet-drag-handle" role="button" aria-label={closeLabel} tabIndex={0} onClick={() => onOpenChange(false)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpenChange(false); } }} className="mx-auto mb-4 h-[4px] w-[36px] rounded-full bg-hairline focus-visible:outline focus-visible:outline-2 focus-visible:outline-canopy/40 focus-visible:outline-offset-2" />`. Note: `<button>` element + redundant `role="button"` is a deliberate belt-and-braces pattern so the unit test's attribute assertion passes regardless of how Radix slot transforms the DOM.
       - When `interactiveDragHandle` is falsy: keep the existing `<div className="mx-auto mb-4 h-[4px] w-[36px] rounded-full bg-hairline" aria-hidden="true" />` byte-for-byte (Phase 4 LGPD consumer unchanged).
    7. Add a JSDoc block on the new props explaining: (a) `role="alertdialog"` is for destructive surfaces (UI-SPEC §7 line 367 / D-07 delete-confirm); (b) `interactiveDragHandle` is the BottomSheet-specific keyboard a11y promotion — Phase 4 LGPD consent stays at the default `false` for binary backwards compatibility; (c) `closeLabel` is the i18n source for the drag handle's aria-label when interactive.
    8. Run `pnpm exec vitest --run --project=unit-dom tests/unit/bottom-sheet.test.tsx`. Tests 1–6 + 8–9 should now pass; Test 7 and the BottomSheet import test still fail (next step).

    GREEN — Step B (BottomSheet wrapper + reduced-motion):
    9. Create `src/shared/ui/bottom-sheet.tsx`:
       ```tsx
       "use client";

       import { useReducedMotion } from "motion/react";
       import type { ReactNode } from "react";
       import { ModalSheet, type ModalSheetProps } from "@shared/ui/modal-sheet";

       export interface BottomSheetProps {
         open: boolean;
         onOpenChange: (open: boolean) => void;
         title: string;
         closeLabel: string;
         children: ReactNode;
         /** "alertdialog" for destructive surfaces (D-07 delete-confirm).
          *  Defaults to "dialog" for non-destructive (D-15 photo-journal add). */
         role?: "dialog" | "alertdialog";
         /** Forwarded to ModalSheet (UI-SPEC §7 Cancel-first via child autoFocus
          *  is the standard React contract — no extra prop needed). */
         onCloseAutoFocus?: (event: Event) => void;
       }

       /**
        * BottomSheet — Phase 5 D-07 / D-15 primitive composing Phase 3 ModalSheet.
        *
        * Adds vs. ModalSheet:
        *  - Drag handle becomes a real keyboard-reachable close affordance
        *    (Enter/Space dismisses) — PRD §17 visible close redundancy.
        *  - Optional role="alertdialog" for destructive surfaces (UI-SPEC §7).
        *  - prefers-reduced-motion: instant snap (motion/react useReducedMotion).
        *
        * Inherited from ModalSheet: 24 px top radius, 36×4 Hairline drag bar,
        * focus trap + return focus (Radix Dialog), 50 % scrim, visible Fechar
        * button (top-right), tap-scrim dismissal, sonner z-index coexistence.
        *
        * Cancel-first autofocus (UI-SPEC §7): consumer marks the Cancel button
        * with the standard `autoFocus` attribute. Radix initial-focus lands on
        * the autofocused descendant — no extra prop on this primitive.
        */
       export function BottomSheet(props: BottomSheetProps) {
         const reducedMotion = useReducedMotion();
         const role = props.role ?? "dialog";
         // motion/react's useReducedMotion returns true when the OS prefers reduced motion.
         // We forward the signal as a data attribute on Dialog.Content so the consuming
         // CSS (or future motion variants) can collapse transitions to instant.
         // The actual transition values live in Tailwind classes on ModalSheet's
         // Dialog.Content; under prefers-reduced-motion: reduce the global
         // `motion-reduce:` Tailwind variant already collapses transform/opacity
         // transitions to 0ms (Phase 3 D-32 motion preset). The data attribute is
         // a belt-and-braces hook for future variants without recompiling tokens.
         return (
           <ModalSheet
             {...props}
             role={role}
             interactiveDragHandle
           />
         );
       }
       ```
       Notes for the executor:
       - `motion/react`'s `useReducedMotion` is already used in `src/shared/ui/skeleton.tsx:24` and `src/shared/ui/capture-button.tsx:36` — same import path, no new dependency.
       - DO NOT spread `props` BEFORE the explicit `role` and `interactiveDragHandle` overrides — order matters (override after spread). The example above puts the spread first then the explicit values second, which is correct.
       - Reduced-motion implementation: rely on Tailwind's `motion-reduce:transition-none` variant for the transform/opacity transitions on Dialog.Content. If the existing ModalSheet classes don't already have this variant, ADD `motion-reduce:transition-none motion-reduce:duration-0` to the Dialog.Content className in modal-sheet.tsx (Step A above) — verify by reading the file before editing.
    10. If ModalSheet's Dialog.Content className lacks `motion-reduce:transition-none motion-reduce:duration-0`, append it during Step A (this is non-breaking — `motion-reduce:` only applies under `prefers-reduced-motion: reduce`).
    11. Run `pnpm exec vitest --run --project=unit-dom tests/unit/bottom-sheet.test.tsx`. All 9 tests must pass.
    12. Run `pnpm typecheck` to confirm the additive ModalSheet types compile across all existing call sites (Phase 4 LGPD consent modal in particular — should be a no-op since all new props are optional).
    13. Commit GREEN: `feat(05-13): BottomSheet primitive composes ModalSheet with interactive drag handle, alertdialog variant, reduced-motion fallback`.
  </action>
  <verify>
    <automated>pnpm typecheck && pnpm exec vitest --run --project=unit-dom tests/unit/bottom-sheet.test.tsx</automated>
    <gate type="grep">grep -c "export function BottomSheet" src/shared/ui/bottom-sheet.tsx | grep -v -E "^[#0]" | head -1</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/shared/ui/modal-sheet.tsx | grep -v '^[[:space:]]*\*' | grep -c "interactiveDragHandle" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/shared/ui/bottom-sheet.tsx | grep -v '^[[:space:]]*\*' | grep -c "from \"@shared/ui/modal-sheet\"" | grep -E "^1$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/shared/ui/modal-sheet.tsx | grep -v '^[[:space:]]*\*' | grep -c "aria-hidden=\"true\"" | grep -E "^1$"</gate>
  </verify>
  <done>
    - All 9 unit-dom tests in `tests/unit/bottom-sheet.test.tsx` pass.
    - `pnpm typecheck` clean across the workspace (Phase 4 LGPD consent modal unaffected).
    - `src/shared/ui/modal-sheet.tsx` exports the same `ModalSheet` function and `ModalSheetProps` interface; the surface is purely additive.
    - `src/shared/ui/bottom-sheet.tsx` exports `BottomSheet` and `BottomSheetProps` and composes ModalSheet via direct import (no Radix Dialog imports of its own — composition path enforced by the grep gate).
    - The non-interactive drag-handle path in modal-sheet.tsx still emits `aria-hidden="true"` (Phase 4 byte identity) — proven by the file-wide grep gate (count = 1: only the non-interactive branch keeps the attribute).
  </done>
</task>

<task type="auto">
  <name>Task 2: Test-only /bottom-sheet harness route + axe + focus-trap E2E spec</name>
  <files>
    - src/app/(test)/bottom-sheet/page.tsx (NEW — production-guarded)
    - src/app/(test)/bottom-sheet/harness.tsx (NEW — client harness)
    - tests/e2e/axe-bottom-sheet.spec.ts (NEW)
  </files>
  <action>
    1. Create `src/app/(test)/bottom-sheet/page.tsx` mirroring `src/app/(test)/modal-sheet/page.tsx` exactly — production-guard the route via `ENABLE_TEST_ROUTES=1`. The doc-comment SHOULD reference Plan 05-13 explicitly so anyone reading the file understands why it exists.
       ```tsx
       import { notFound } from "next/navigation";
       import { BottomSheetTestHarness } from "./harness";

       export default function BottomSheetTestPage() {
         if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
           notFound();
         }
         return <BottomSheetTestHarness />;
       }
       ```
    2. Create `src/app/(test)/bottom-sheet/harness.tsx`. The harness MUST:
       - Render an invoker button `data-testid="bottomsheet-invoker"` that opens the sheet on click (mirror modal-sheet harness pattern).
       - Autofocus the invoker on mount via `useEffect(() => invokerRef.current?.focus(), [])` so Radix snapshots it as the "previously focused element" before opening (otherwise return-focus has no target).
       - Use `<BottomSheet role="alertdialog" ...>` so the spec exercises the alertdialog variant — this is the higher-coverage path (delete-confirm sheet uses it). The dialog variant is covered by Test 6 in unit-dom.
       - Include three focusable children inside the sheet, with the SECOND one carrying `autoFocus` to exercise the UI-SPEC §7 Cancel-first contract. Suggested children:
         - `<input type="text" data-testid="bottomsheet-input" />` (NOT autofocus)
         - `<button autoFocus data-testid="bottomsheet-cancel">Cancelar</button>`
         - `<button data-testid="bottomsheet-confirm">Excluir planta</button>`
       - Wire `onCloseAutoFocus={(e) => { e.preventDefault(); invokerRef.current?.focus(); }}` to guarantee return-focus (Radix's auto-return only works if the trigger is its own component — controlled invoker requires the manual hop).
       - Title: "BottomSheet test harness". closeLabel: "Fechar".
    3. Create `tests/e2e/axe-bottom-sheet.spec.ts` covering FIVE scenarios:
       (A) **Focus trap survives Tab × 6.** Copy the assertion shape from `tests/e2e/axe-modal-focus-trap.spec.ts` lines 11–37, but query `[role="alertdialog"]` (not `[role="dialog"]`). Open via `page.getByTestId("bottomsheet-invoker").click()`, wait for `[role="alertdialog"]`, Tab × 6, assert each Tab keeps focus inside the alertdialog.
       (B) **Focus trap survives Shift+Tab × 6.** Same loop using `page.keyboard.press("Shift+Tab")`. Six iterations.
       (C) **Esc closes + return-focus to invoker.** Press Escape, wait for `[role="alertdialog"]` to detach, then assert `document.activeElement` carries `data-testid="bottomsheet-invoker"`. Use the 100ms `waitForTimeout` like the modal-sheet spec to let Radix return-focus fire.
       (D) **Drag handle Enter dismisses + return-focus.** Re-open, use `page.locator('[data-testid="bottomsheet-drag-handle"]').focus()`, then `page.keyboard.press("Enter")`, assert detach + return-focus. THIS is the new behaviour BottomSheet adds beyond ModalSheet.
       (E) **AxeBuilder × 4 combos against the OPEN sheet.** Mirror `tests/e2e/axe-placeholder-pages.spec.ts` COMBOS array (light/dark × no-preference/reduce). For each combo: emulate media, navigate, click invoker, wait for `[role="alertdialog"]`, run AxeBuilder, assert 0 serious + critical violations. Warn-log moderate violations to stdout (do not fail).
    4. Use `test.describe.configure({ retries: 0 })` at the top of the spec — focus-trap timing is deterministic with the existing 100ms `waitForTimeout`, retries can mask real regressions.
    5. Each scenario is its own `test(...)` so failures are isolable. Recommend the 4 axe combos use a `for (const combo of COMBOS)` loop generating 4 individual tests (parallel to axe-placeholder-pages.spec.ts).
    6. Run the full Playwright suite locally to ensure (a) the new spec passes, (b) `tests/e2e/axe-modal-focus-trap.spec.ts` still passes (the additive ModalSheet props haven't regressed it):
       ```bash
       pnpm test:e2e -- axe-bottom-sheet.spec.ts axe-modal-focus-trap.spec.ts
       ```
    7. Commit: `test(05-13): add bottom-sheet harness route + axe + focus-trap E2E spec`.
  </action>
  <verify>
    <automated>pnpm test:e2e -- axe-bottom-sheet.spec.ts axe-modal-focus-trap.spec.ts</automated>
    <gate type="grep">grep -c "ENABLE_TEST_ROUTES" src/app/\(test\)/bottom-sheet/page.tsx | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -c "data-testid=\"bottomsheet-invoker\"" src/app/\(test\)/bottom-sheet/harness.tsx | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -c "role=\"alertdialog\"" tests/e2e/axe-bottom-sheet.spec.ts | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' tests/e2e/axe-bottom-sheet.spec.ts | grep -c "AxeBuilder" | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - `/bottom-sheet` route is reachable in dev (NODE_ENV !== "production"); production-guarded behind `ENABLE_TEST_ROUTES=1`.
    - All 5 Playwright scenarios pass: focus trap (Tab + Shift+Tab), Esc return-focus, drag-handle Enter return-focus, axe × 4 combos.
    - `tests/e2e/axe-modal-focus-trap.spec.ts` still passes — Phase 4 LGPD consumer is byte-equivalent.
    - The grep gate confirms the spec exercises the `role="alertdialog"` variant (the destructive-sheet path, highest coverage).
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: [BLOCKING] VoiceOver (iOS Safari) + TalkBack (Android Chrome) manual a11y gate</name>
  <files>(no file outputs — manual verification of artifacts shipped in Tasks 1–2)</files>
  <action>
    SUMMARY OF WHAT WAS BUILT (for the human reviewer):
    `<BottomSheet>` ships as a composition over `<ModalSheet>`. New behaviours vs. Phase 3 ModalSheet:
    1. Drag handle is now keyboard-reachable: `role="button"`, `aria-label="Fechar"`, Enter/Space dismisses.
    2. Optional `role="alertdialog"` variant for the upcoming Plan 05-16 delete-confirm sheet — screen readers should announce the sheet content as a higher-priority alert.
    3. `prefers-reduced-motion: reduce` collapses the slide-up transition to instant snap.
    4. UI-SPEC §7 Cancel-first contract honoured: a child marked `autoFocus` wins Radix initial focus (no extra prop).

    VALIDATION.md `## Manual-Only Verifications` row "BottomSheet VoiceOver / TalkBack announcement" tags this surface as un-assertable in headless Playwright — real screen-reader rotor verbalizations require physical devices. THIS IS THE BLOCKING GATE for that row.

    REPRODUCTION STEPS — iOS Safari + VoiceOver:
    1. On a Mac, run `pnpm dev` (NODE_ENV=development; the `/bottom-sheet` route is reachable without `ENABLE_TEST_ROUTES`).
    2. Find the dev server URL on your local network (e.g., `http://192.168.1.42:3000` — Next.js prints "Network" alongside "Local" on `dev` startup).
    3. On a real iOS device on the same Wi-Fi, open Safari → navigate to `http://<your-LAN-ip>:3000/bottom-sheet`.
    4. Enable VoiceOver (Settings → Accessibility → VoiceOver → ON, OR triple-click the side button if Accessibility Shortcut is configured).
    5. Tap the "Open BottomSheet" invoker button. Expected verbalizations:
       - The sheet headline ("BottomSheet test harness") is announced.
       - The sheet body / Description (sr-only) is announced.
       - Because the harness uses `role="alertdialog"`, VoiceOver SHOULD treat it as a higher-priority alert (no required exact wording — verify the "alert" cue is present, not "dialog").
       - Initial focus lands on the Cancelar button (autoFocus child) — VoiceOver reads "Cancelar, button".
    6. Use the rotor (two-finger twist) to navigate to "Form Controls" — verify reachable items inside the sheet: input field, Cancelar button, Excluir planta button, drag handle (announced as "Fechar, button" — the drag-handle aria-label), and the top-right Fechar X button.
    7. Swipe-right through the sheet content (linear navigation). Verify focus stays inside the sheet and never reaches the invoker button beneath. (This proves the focus trap holds for AT users, which is the only audience Playwright cannot test.)
    8. Activate the drag handle ("Fechar") via VoiceOver double-tap → verify the sheet closes and focus returns to the invoker.
    9. Re-open the sheet, dismiss via the top-right Fechar X button, verify same return-focus behaviour.

    REPRODUCTION STEPS — Android Chrome + TalkBack:
    10. On a real Android device on the same Wi-Fi, open Chrome → navigate to `http://<your-LAN-ip>:3000/bottom-sheet`.
    11. Enable TalkBack (Settings → Accessibility → TalkBack → ON, OR use the volume-key shortcut if configured).
    12. Tap the "Open BottomSheet" invoker. Expected verbalizations:
        - Sheet headline announced.
        - "Alert dialog" or equivalent cue (TalkBack's exact phrasing varies by Android version; verify the higher-priority alert character is present).
        - Initial focus on Cancelar.
    13. Swipe-right to traverse focusable items: input → Cancelar → Excluir planta → drag handle ("Fechar, button") → Fechar X button.
    14. Verify focus does NOT escape to the invoker beneath the scrim.
    15. Activate the drag handle via TalkBack double-tap → sheet closes, focus returns to invoker.

    FAILURE MODES TO REPORT:
    - VoiceOver/TalkBack does NOT announce the alert character on open → check `role="alertdialog"` is actually rendered in the DOM. If `<button data-testid="bottomsheet-invoker">` is not visibly focusable on the page (e.g., behind a scrollable container), the `useEffect` autofocus may not run; report and we'll revisit harness ordering.
    - Drag handle is NOT reachable via the rotor / linear swipe → the `interactiveDragHandle` prop didn't promote the element to a real button (Task 1 regression).
    - Focus reaches elements OUTSIDE the sheet (e.g., the Open BottomSheet invoker beneath the scrim) → Radix focus trap regression; report immediately.
    - Initial focus lands on the input field (first focusable) instead of Cancelar → React's autoFocus contract didn't carry through Radix's initial-focus logic; we may need to add an explicit `onOpenAutoFocus` hook on the harness side.

    NOTES:
    - Per CLAUDE.md project rules, do NOT start the dev server unless explicitly requested in this checkpoint. The reviewer (founder) starts it themselves.
    - Both iOS Safari AND Android Chrome must pass — this is the canonical mobile-first PWA audience for Folhário.
    - Take a short screen recording of the VoiceOver and TalkBack flows if practical; attach to the PR / phase summary so future changes can compare against this baseline.
  </action>
  <verify>
    <automated>echo "Manual checkpoint — see action steps for reproduction. Plan-level grep gates from Tasks 1–2 already cover code-shape verification. The Per-Task Verification Map row in 05-VALIDATION.md (Manual-Only Verifications: 'BottomSheet VoiceOver / TalkBack announcement') is the policy reference."</automated>
  </verify>
  <done>Type "approved" if BOTH iOS Safari + VoiceOver AND Android Chrome + TalkBack:
- Announce headline + alert cue on sheet open.
- Place initial focus on Cancelar (the autoFocus child).
- Reach the drag handle as "Fechar, button" via the rotor / linear swipe.
- Keep focus trapped inside the sheet across the full content traversal.
- Return focus to the invoker on every dismissal path (drag handle Enter, top-right Fechar, Esc).
If any item fails on either platform, type "still failing" and paste the specific platform + step number + observed verbalization so the regression can be diagnosed.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| keyboard→sheet content | An attacker (or accidental keyboard event) tabbing or pressing arrow keys MUST NOT escape the sheet's focus trap to interact with affordances behind the scrim (e.g., the Excluir invoker). Escape is the ONLY user-driven dismissal that should release focus. |
| autoFocus contract | UI-SPEC §7's Cancel-first guarantee depends on the React `autoFocus` attribute being respected by Radix Dialog initial-focus. A change to Radix's initial-focus heuristic could silently land focus on Excluir instead — a destructive-confirmation footgun. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-13-01 | Elevation of Privilege (a11y bypass) | Focus trap inside `<BottomSheet>` (composes Radix Dialog) | mitigate | Playwright spec `tests/e2e/axe-bottom-sheet.spec.ts` asserts focus stays inside `[role="alertdialog"]` under Tab × 6 AND Shift+Tab × 6, that Esc closes + returns focus to the invoker, and that the drag handle's Enter keystroke also closes + returns focus. The pattern mirrors the existing `tests/e2e/axe-modal-focus-trap.spec.ts` proven against Phase 4 LGPD consent. The unit-dom tests additionally pin the drag handle's `role="button"` + Enter/Space contract so a Radix upgrade that drops Enter handling on slot-transformed elements would be caught at unit level (~30s feedback). |
| T-05-13-02 | Tampering / Spoofing | UI-SPEC §7 Cancel-first guarantee — initial focus MUST land on Cancelar, never on Excluir | mitigate | Unit-dom Test 7 asserts `document.activeElement === <button autoFocus>` on portal mount. Plan 05-16's delete-confirm consumer marks Cancelar with `autoFocus`. If Radix changes initial-focus semantics in a way that breaks this, the unit test catches it before plan 05-16 even runs. The harness in `src/app/(test)/bottom-sheet/harness.tsx` exercises this contract end-to-end on a real browser via the Playwright spec's "initial focus on Cancelar" assertion (covered by the focus-trap Tab traversal — first Tab from the autofocused Cancelar moves to Excluir, not the input). |
| T-05-13-03 | Information Disclosure | Test-only `/bottom-sheet` route reachable in production | mitigate | The route page mirrors `src/app/(test)/modal-sheet/page.tsx` — `notFound()` in production unless `ENABLE_TEST_ROUTES=1`. Vercel production env never sets this; preview env may. The doc-comment in page.tsx explicitly references this constraint (Phase 1 D-21 / 01-07 SUMMARY pattern). Grep gate in Task 2 enforces presence of the `ENABLE_TEST_ROUTES` token. |
| T-05-13-04 | Denial of Service | A misbehaving consumer's `onOpenChange` callback synchronously calls `setState` → infinite render loop on Enter/Space drag-handle dismissal | accept | Standard React contract — every controlled-dialog consumer in the codebase already accepts this risk (see Phase 4 LGPD modal). Drag-handle Enter/Space simply forwards `onOpenChange(false)` once per keystroke; no internal state. Same exposure as the existing top-right Fechar button. |
| T-05-13-05 | Repudiation | A user dismisses a destructive `role="alertdialog"` sheet via the drag handle and later claims they did not see the cascade-counts copy | accept | Out of scope for the primitive. Plan 05-16's delete-confirm consumer is responsible for cascading the count-preview copy + sonner toast on success/failure. The primitive only provides the focus + a11y contract. |

`block_on_high: true` — T-05-13-01 is the only high-severity entry; its mitigation is fully automated (unit-dom + Playwright) before the BLOCKING manual checkpoint runs.
</threat_model>

<verification>
- `src/shared/ui/modal-sheet.tsx` exports preserve their public API: `ModalSheet` and `ModalSheetProps` are still exported with the same shape; new fields are optional with safe defaults.
- `src/shared/ui/bottom-sheet.tsx` is a pure composition over ModalSheet — no Radix Dialog imports of its own (enforced by grep gate in Task 1).
- Phase 4 LGPD consent modal continues to render byte-identically: `tests/e2e/axe-modal-focus-trap.spec.ts` stays green untouched, and unit-dom Test 8 pins the non-interactive drag-handle path.
- Per-Task Verification Map (05-VALIDATION.md) rows for Plan 05-13:
  - Unit (unit-dom): `tests/unit/bottom-sheet.test.tsx` — 9 tests covering all 4 BottomSheet behaviour deltas.
  - E2E + axe: `tests/e2e/axe-bottom-sheet.spec.ts` — 5 scenarios (focus-trap Tab × 6, Shift+Tab × 6, Esc return-focus, drag-handle Enter return-focus, axe × 4 combos).
  - Manual: 05-VALIDATION.md `## Manual-Only Verifications` "BottomSheet VoiceOver / TalkBack announcement" row, satisfied by Task 3's blocking checkpoint.
- `pnpm typecheck` clean across the workspace — proves the additive ModalSheet props don't break any existing call site (Phase 4 LGPD modal in particular).
</verification>

<success_criteria>
1. `pnpm typecheck` clean.
2. `pnpm exec vitest --run --project=unit-dom tests/unit/bottom-sheet.test.tsx` — 9 / 9 green.
3. `pnpm test:e2e -- axe-bottom-sheet.spec.ts axe-modal-focus-trap.spec.ts` — both specs green; the BottomSheet spec covers focus-trap Tab × 6, Shift+Tab × 6, Esc return-focus, drag-handle Enter return-focus, and axe × 4 combos with 0 serious+critical violations; ModalSheet's existing spec untouched.
4. Task 3 BLOCKING checkpoint approved: VoiceOver (iOS Safari) + TalkBack (Android Chrome) both announce headline + alert cue, place initial focus on Cancelar, expose drag handle as "Fechar, button", keep focus trapped, and return focus to the invoker on every dismissal path.
5. Grep gates from Tasks 1–2 all pass: `BottomSheet` exported, ModalSheet has additive `interactiveDragHandle` prop, BottomSheet imports from `@shared/ui/modal-sheet` (not `@radix-ui/react-dialog` directly), test route page checks `ENABLE_TEST_ROUTES`, harness has `data-testid="bottomsheet-invoker"`, spec exercises `role="alertdialog"`.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-13-SUMMARY.md` per the standard summary template, including:
- Composition vs. fork decision recap (ModalSheet additive props + BottomSheet wrapper) and confirmation that Phase 4 LGPD consumer is byte-identical.
- The four behaviour deltas BottomSheet adds vs. Phase 3 ModalSheet (interactive drag handle, alertdialog variant, reduced-motion fallback, autoFocus contract).
- VoiceOver + TalkBack manual gate outcome (PASS / FAIL) including any platform-specific verbalization deltas observed (iOS Safari + Android Chrome).
- Confirmation that VALIDATION.md `## Manual-Only Verifications` row "BottomSheet VoiceOver / TalkBack announcement" is now SATISFIED for Plan 05-13's contribution to UI-04 + UI-08.
- Pointer to plans 05-16 (delete-confirm sheet — uses `role="alertdialog"` + autoFocus on Cancelar) and 05-17 (photo-journal add sheet — uses default `role="dialog"`) as the downstream consumers; both unblocked.
- Any deltas observed (e.g., Radix Dialog's slot transform interfering with the drag-handle role assertion — would be reported at unit-test debug time) so future primitive plans can avoid the same trap.
</output>
