---
phase: 05-catalog-meu-jardim
plan: 14
type: tdd
wave: 1
depends_on: []
files_modified:
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
autonomous: true
requirements:
  - UI-08
  - UI-11
tags: [lightbox, inline-edit, accessibility, axe, focus-trap, reduced-motion, tdd, primitives]
must_haves:
  truths:
    - "Lightbox renders Radix Dialog with role=\"dialog\" + aria-label=\"Galeria — {plantName}\""
    - "Lightbox visible Fechar button (aria-label=\"Fechar\") top-right with 44×44 tap target — always rendered when open"
    - "Lightbox horizontal swipe (touchstart/touchend) advances next/prev when distance ≥ 80px AND velocity ≥ 0.3 px/ms (per UI-SPEC §9)"
    - "Lightbox under prefers-reduced-motion=reduce uses opacity-only transition (no transform/scale animation) — instant fade per UI-SPEC §9 line 449"
    - "Lightbox respects native pinch-zoom — no `touch-action: none` and no preventDefault on multi-touch"
    - "Lightbox Esc closes; Tab/Shift+Tab cycles inside the Dialog (Radix-provided focus trap); focus returns to invoker on close (mirrors UI-22 modal contract)"
    - "Lightbox arrow keys (←/→) advance prev/next photo; index indicator has aria-live=\"polite\""
    - "InlineEditField read state has role=\"button\" + tabIndex=0 + aria-label paired with current value/placeholder"
    - "InlineEditField tap or Enter/Space converts to native input element with current value selected; aria-label preserved"
    - "InlineEditField saves on blur OR Enter (single-line); cancels on Esc reverting to pre-edit value with no callback"
    - "InlineEditField applies optimistic update; on rejected onSave promise reverts display value AND announces revert via role=\"alert\""
    - "InlineEditField saving state sets aria-busy=\"true\" on the field wrapper and renders text label \"Salvando…\" — never a circular spinner"
    - "InlineEditField required=true + empty submit shows 1.5px Overdue Rust border + helper line role=\"alert\" with required error copy"
    - "InlineEditField user-typed values render via React text nodes only — never dangerouslySetInnerHTML (XSS-safe per T-05-14-01)"
    - "axe-core finds 0 serious/critical violations on /lightbox + /inline-edit-field routes across 4 colorScheme×reducedMotion combos"
    - "Playwright focus-trap spec mirrors tests/e2e/axe-modal-focus-trap.spec.ts pattern: Tab cycle stays inside Lightbox; Esc returns focus to invoker (T-05-14-02 mitigation)"
  artifacts:
    - path: "src/shared/ui/lightbox.tsx"
      provides: "Full-screen photo overlay primitive — Radix Dialog wrap + horizontal swipe + reduced-motion fallback"
      min_lines: 130
      contains: "@radix-ui/react-dialog"
    - path: "src/shared/ui/inline-edit-field.tsx"
      provides: "Tap-to-edit field primitive (text/textarea/date variants + render-prop slot for combobox)"
      min_lines: 130
      contains: "role=\"button\""
    - path: "tests/unit/lightbox.test.tsx"
      provides: "Lightbox swipe + reduced-motion + ARIA contract unit tests"
      min_lines: 130
    - path: "tests/unit/inline-edit-field.test.tsx"
      provides: "InlineEditField state-machine + XSS + role=alert + optimistic-rollback unit tests"
      min_lines: 150
    - path: "src/app/(test)/lightbox/page.tsx"
      provides: "Test-only /lightbox route mounting harness; production-guarded via ENABLE_TEST_ROUTES"
      contains: "ENABLE_TEST_ROUTES"
    - path: "src/app/(test)/lightbox/harness.tsx"
      provides: "Client harness opening Lightbox with 3 fixture photos for axe + focus-trap scans"
    - path: "src/app/(test)/inline-edit-field/page.tsx"
      provides: "Test-only /inline-edit-field route mounting harness; production-guarded"
      contains: "ENABLE_TEST_ROUTES"
    - path: "src/app/(test)/inline-edit-field/harness.tsx"
      provides: "Client harness rendering text/textarea/date variants + slot variant for axe scans"
    - path: "tests/e2e/axe-lightbox.spec.ts"
      provides: "Playwright + AxeBuilder a11y gate (0 serious/critical) across 4 combos + Tab focus-trap assertion (T-05-14-02)"
      contains: "AxeBuilder"
    - path: "tests/e2e/axe-inline-edit-field.spec.ts"
      provides: "Playwright + AxeBuilder a11y gate (0 serious/critical) across 4 combos + role=alert revert assertion"
      contains: "AxeBuilder"
  key_links:
    - from: "src/shared/ui/lightbox.tsx"
      to: "@radix-ui/react-dialog"
      via: "Dialog.Root → Dialog.Portal → Dialog.Overlay + Dialog.Content (focus trap inherited)"
      pattern: "@radix-ui/react-dialog"
    - from: "src/shared/ui/lightbox.tsx"
      to: "useReducedMotion (motion/react)"
      via: "import + branch on reduced flag for transition class selection"
      pattern: "useReducedMotion"
    - from: "src/shared/ui/inline-edit-field.tsx"
      to: "InlineEditField read DOM"
      via: "role=\"button\" + tabIndex=0 + aria-label pairing"
      pattern: "role=\"button\""
    - from: "src/shared/ui/inline-edit-field.tsx"
      to: "InlineEditField error/revert announcement"
      via: "role=\"alert\" container rendered when save rejects OR required-empty submit"
      pattern: "role=\"alert\""
    - from: "tests/e2e/axe-lightbox.spec.ts"
      to: "/lightbox test route"
      via: "page.goto('/lightbox') + AxeBuilder({page}).analyze()"
      pattern: "page\\.goto\\(\"/lightbox\"\\)"
    - from: "tests/e2e/axe-inline-edit-field.spec.ts"
      to: "/inline-edit-field test route"
      via: "page.goto('/inline-edit-field') + AxeBuilder({page}).analyze()"
      pattern: "page\\.goto\\(\"/inline-edit-field\"\\)"
---

<objective>
Ship two NEW headless UI primitives required by Phase 5 plant profile + photo journal:

1. **Lightbox** at `src/shared/ui/lightbox.tsx` (~150 LOC, D-14) — full-screen photo overlay built on `@radix-ui/react-dialog` (focus trap + return-focus + Esc dismiss inherited). Adds horizontal swipe between photos via touch events with thresholds locked by UI-SPEC §9 line 439 (distance ≥ 80px AND velocity ≥ 0.3 px/ms). Visible "Fechar" button top-right (PRD §17 modal-sheet rule "VISIBLE close affordance required"). Animation strictly `transform` + `opacity`; under `prefers-reduced-motion: reduce` falls back to opacity-only instant fade per UI-SPEC §9 lines 446-449. Pinch-zoom is the native browser default — no `touch-action: none`, no `preventDefault` on multi-touch.

2. **InlineEditField** at `src/shared/ui/inline-edit-field.tsx` (~150 LOC, D-05) — tap-to-edit field with state machine `read → tap → editing → blur/Enter → saving → success → read` plus `Esc → read (revert)` and `error → read (revert + role="alert" toast trigger)` per UI-SPEC §12. Variants `text` / `textarea` / `date` ship in this plan; the `combobox` variant from UI-SPEC §12 ships as a **render-prop slot** (`renderEditor?: (slot) => ReactNode`) so the combobox primitive (Plan 05-12) is NOT a hard import dependency — see `<implementation>` Decision A. Optimistic update + rollback on rejected `onSave` promise; revert is announced via `role="alert"` (RESEARCH.md line 867 + VALIDATION.md line 96).

Both primitives ship with:
- TDD: failing unit-dom tests first (RED), implementation second (GREEN), test harness routes + Playwright + AxeBuilder a11y gates third.
- Threat coverage: T-05-14-01 (XSS via typed value rendering — InlineEditField), T-05-14-02 (focus trap escape — Lightbox).
- axe-core 0 serious/critical violations across light/dark × reduced-motion/no-preference combos.

Purpose: deliver UI-08 (plant profile inline-edit) and UI-11 (photo journal lightbox) as reusable primitives so Wave 4 plant-profile + photo-journal plans (05-16, 05-17) compose them with no further primitive work.

Output: 10 files (2 source, 2 unit-dom test files, 4 test-only route+harness pairs, 2 Playwright a11y specs) all green under `pnpm test:unit` and `pnpm test:e2e -- axe-lightbox.spec.ts axe-inline-edit-field.spec.ts`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md

# Existing primitives — convention donors
@src/shared/ui/modal-sheet.tsx
@src/shared/ui/text-input.tsx
@src/shared/ui/inline-error.tsx
@src/shared/ui/skeleton.tsx

# Test-only route + axe + focus-trap precedents (mirror verbatim)
@src/app/(test)/modal-sheet/page.tsx
@tests/e2e/axe-modal-focus-trap.spec.ts
@tests/e2e/axe-placeholder-pages.spec.ts
@tests/e2e/axe-combobox.spec.ts

# Sibling primitive plan (mirror frontmatter + structure shape)
@.planning/phases/05-catalog-meu-jardim/05-12-combobox-primitive-PLAN.md

# Test patterns (motion/react mock, fake timers, role=alert assertions)
@tests/unit/skeleton-group.test.tsx
@tests/unit/inline-error.test.tsx

<interfaces>
<!-- Public APIs the executor implements / consumes. Embedded so executor needs no scavenger hunt. -->

### Lightbox public API (this plan creates)

```typescript
// src/shared/ui/lightbox.tsx
export interface LightboxPhoto {
  /** Stable identifier for keying. */
  id: string;
  /** Source URL (signed catalog photo URL — already mints 24h TTL upstream per D-20). */
  src: string;
  /** Optional caption — when present, renders below photo and used as alt; when absent, alt is `Foto {n} de {total}`. */
  caption?: string;
}

export interface LightboxProps {
  /** Controlled open state. */
  open: boolean;
  /** Open-state callback (Radix Dialog onOpenChange). */
  onOpenChange: (open: boolean) => void;
  /** Photos in display order. */
  photos: LightboxPhoto[];
  /** Index of currently displayed photo. */
  index: number;
  /** Index-change callback (next/prev arrow OR swipe). Caller is the source of truth. */
  onIndexChange: (next: number) => void;
  /** Plant name — composed into aria-label="Galeria — {plantName}" (UI-SPEC §9 line 456). */
  plantName: string;
  /** i18n-resolved label for the visible Fechar button (default placeholder is "Fechar"). */
  closeLabel: string;
}

export function Lightbox(props: LightboxProps): JSX.Element;
```

Internals:
- Wraps `@radix-ui/react-dialog` (focus trap + return focus + Esc dismiss inherited — mirrors `src/shared/ui/modal-sheet.tsx`).
- `useReducedMotion()` from `motion/react` (already used in `src/shared/ui/skeleton.tsx:24`) selects animation class:
  - `reduced === false`: open transition `transform: scale(0.95 → 1) + opacity 0 → 1` over ~240ms.
  - `reduced === true`: opacity-only ~80ms fade. NO transform animation under reduced-motion (UI-SPEC §9 line 449).
- Photo navigation: `transform: translateX()` slide via Tailwind utility class — NEVER `left`/`right` (Phase 3 banned).
- Touch handlers: `onTouchStart` records `{ x: changedTouches[0].clientX, t: performance.now() }`; `onTouchEnd` reads `{ x, t }` from `changedTouches[0]`; `dx = endX - startX`, `dt = endT - startT`, `velocity = Math.abs(dx) / Math.max(dt, 1)`. Trigger prev (dx > 0) or next (dx < 0) when `Math.abs(dx) >= 80` AND `velocity >= 0.3` (UI-SPEC §9 line 439). Both thresholds must hold; either alone is no-op (prevents accidental advance on slow drift OR fast micro-tap).
- Keyboard: `onKeyDown` on Dialog.Content — ArrowLeft → prev, ArrowRight → next. Esc dismiss is Radix default.
- Index indicator: `<span aria-live="polite">{index + 1} / {photos.length}</span>` rendered when `photos.length >= 2`.
- Pinch-zoom contract: NEVER set `touch-action: none` on Dialog.Content. NEVER call `e.preventDefault()` inside `onTouchStart` or `onTouchEnd` when `e.touches.length > 1`. Single-touch drift is the only case the swipe handler reads.

### InlineEditField public API (this plan creates)

```typescript
// src/shared/ui/inline-edit-field.tsx
import type { ReactNode } from "react";

export type InlineEditFieldVariant = "text" | "textarea" | "date";

export interface InlineEditFieldRenderEditorArgs {
  /** Current draft value during editing. */
  value: string;
  /** Update draft (controlled by InlineEditField, exposed for slot consumers like Combobox). */
  setValue: (next: string) => void;
  /** Commit callback — caller invokes when slot's commit gesture fires (e.g. Enter, blur, option-select). */
  commit: () => void;
  /** Cancel callback — caller invokes when slot's cancel gesture fires (e.g. Esc). */
  cancel: () => void;
  /** Required for the slot's input to pair with the field label and inline error. */
  ariaLabel: string;
  ariaInvalid: boolean;
  ariaDescribedBy?: string;
}

export interface InlineEditFieldProps {
  /** i18n-resolved label rendered ABOVE the value (Plus Jakarta Sans 14/18 w600 Calm Slate per UI-SPEC §12). */
  label: string;
  /** Current persisted value (controlled — caller updates from server response). */
  value: string | null;
  /** Placeholder shown in italic Calm Slate when value is null/empty. */
  placeholder: string;
  /** Field variant. The "combobox" variant of UI-SPEC §12 is delivered via `renderEditor` slot — NOT a builtin variant. */
  variant: InlineEditFieldVariant;
  /**
   * Save callback. Called with the committed string. Must return a Promise.
   * On resolved promise: editing exits, displayed value updates to `next`, no toast (silent success per UI-SPEC §12).
   * On rejected promise: displayed value reverts to pre-edit value AND a `role="alert"` revert announcement renders below the field with copy from `requiredErrorCopy` is reused — actually no: a generic "Não conseguimos salvar agora — tentar de novo?" sonner toast is the consumer's responsibility (caller wires sonner.toast.error in onSave's catch). InlineEditField only renders the in-place role="alert" announcement; the sonner toast is OUT OF SCOPE for this primitive.
   */
  onSave: (next: string) => Promise<void>;
  /** When true, renders read state with no hover/tap affordance, cursor: default (D-21 read-only). */
  readOnly?: boolean;
  /** When true, empty submit (blur/Enter with empty trimmed value) blocks save and shows in-place required error via role="alert". */
  required?: boolean;
  /** i18n-resolved required-empty error copy (e.g. catalog.profile.fields.name.requiredError → "Não pode ficar vazio."). Required when required=true. */
  requiredErrorCopy?: string;
  /** i18n-resolved revert announcement copy (e.g. catalog.profile.saveFailure → "Não conseguimos salvar agora — tentar de novo?"). Optional; when omitted, revert is silent (still aria-busy=false on exit). */
  revertAnnouncementCopy?: string;
  /** textarea-only — minimum visible rows (default 3). */
  minRows?: number;
  /** textarea-only — maximum visible rows (default 8). */
  maxRows?: number;
  /**
   * Render-prop slot for the `combobox` variant per UI-SPEC §12.
   * When provided, replaces the default native input/textarea/date input during the `editing` and `saving` states.
   * Slot consumers (LocationCombobox wrapper) read `value`/`setValue`/`commit`/`cancel` and wire them into the headless Combobox primitive.
   * Pass null/undefined when variant is `text` | `textarea` | `date`.
   */
  renderEditor?: (args: InlineEditFieldRenderEditorArgs) => ReactNode;
}

export function InlineEditField(props: InlineEditFieldProps): JSX.Element;
```

State machine (matches UI-SPEC §12 lines 561-567):

```
        tap | Enter | Space
read ──────────────────────► editing ────► saving ──onSave resolves──► read (new value)
 ▲                              │  │                    │
 │                              │  └─ Esc               └─onSave rejects──► read (reverted) + role="alert" announcement
 │                              ▼
 └────────────── (revert / silent / cancel) ◄─── editing
```

Saving label per UI-SPEC §12 line 575: inline "Salvando…" text rendered next to the value during the `saving` state. NO circular spinner. NO color-only signal — text label IS the redundant cue.

Required-empty guard per UI-SPEC §12 line 588: when `required && trimmed-value === ""` on commit, do NOT call onSave; stay in editing state and surface a `role="alert"` helper line with `requiredErrorCopy`. The helper line is an Overdue Rust 1.5px stroke + alert text per UI-SPEC §12 line 588.

### Visual states (UI-SPEC §Plant Profile inline-edit visual states above, lines 290-300) — class strategy

Use Tailwind utility composition; no new tokens (UI-SPEC §Color line 628 confirms zero new colors this phase). Reference donors:
- `src/shared/ui/text-input.tsx` for Warm Ivory bg + 1.5px stroke (Hairline → Canopy on focus → Overdue Rust on error).
- `src/shared/ui/inline-error.tsx` for `role="alert"` container Tailwind shape.

| State | Read DOM (role="button") | Editor DOM | Helper |
|-------|--------------------------|------------|--------|
| `read` | label + value (or italic placeholder if empty) | (not rendered) | — |
| `read-hover` | desktop-only `:hover` adds `outline-1.5 outline-offset-4 outline-hairline cursor-text` | — | — |
| `editing` | (hidden) | native `<input>`/`<textarea>`/`<input type="date">` OR slot output; bordered Canopy stroke; aria-label paired | — |
| `saving` | (hidden) | editor with `aria-busy=true`; "Salvando…" text label adjacent | — |
| `error` (revert announce) | label + reverted value | (hidden) | `role="alert"` container with `revertAnnouncementCopy` (if provided) |
| `required-empty` (validation) | (hidden — still in editing) | editor with `border-rust` 1.5px + alert icon | `role="alert"` with `requiredErrorCopy` |
| `read-only` (D-21) | label + value (NO hover, cursor `default`, NOT focusable) | — | — |

### Test-only route precedent (mirror exactly — `src/app/(test)/modal-sheet/page.tsx`)

```tsx
import { notFound } from "next/navigation";
import { LightboxTestHarness } from "./harness";

export default function LightboxTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <LightboxTestHarness />;
}
```

The InlineEditField test page follows the same template.

### Existing axe spec pattern (mirror verbatim — `tests/e2e/axe-placeholder-pages.spec.ts:6-44`)

```ts
const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;
```

Both new specs (`axe-lightbox.spec.ts`, `axe-inline-edit-field.spec.ts`) loop the 4 combos against their own `(test)` route. Lightbox spec ALSO mirrors `tests/e2e/axe-modal-focus-trap.spec.ts` for the Tab-cycle assertion (T-05-14-02 mitigation).
</interfaces>

</context>

<feature>
  <name>Lightbox + InlineEditField primitives (D-05, D-14)</name>
  <files>
    src/shared/ui/lightbox.tsx,
    src/shared/ui/inline-edit-field.tsx,
    tests/unit/lightbox.test.tsx,
    tests/unit/inline-edit-field.test.tsx,
    src/app/(test)/lightbox/page.tsx,
    src/app/(test)/lightbox/harness.tsx,
    src/app/(test)/inline-edit-field/page.tsx,
    src/app/(test)/inline-edit-field/harness.tsx,
    tests/e2e/axe-lightbox.spec.ts,
    tests/e2e/axe-inline-edit-field.spec.ts
  </files>
  <behavior>
    Both primitives implement the contracts in `<interfaces>`. Behavior is fully testable via @testing-library/react (DOM contract + state machine) + Playwright AxeBuilder (a11y gate) + Playwright Tab/Shift+Tab (focus-trap structural assertion).

    ## Lightbox unit cases (tests/unit/lightbox.test.tsx)

    1. **Renders Radix Dialog with role="dialog" + aria-label**: `open={true}`, `plantName="Manjericão"` → `getByRole("dialog", { name: /Galeria — Manjericão/ })` returns an element.
    2. **Visible Fechar button is rendered**: `getByRole("button", { name: closeLabel })` finds the Fechar button when open.
    3. **Photo index indicator renders for ≥ 2 photos with aria-live="polite"**: 2-photo lightbox renders `1 / 2` text inside a node with `aria-live="polite"`. Single-photo lightbox: indicator is NOT in the DOM (assert `queryByText("1 / 1")` is null).
    4. **Esc closes the dialog**: open=true, fireEvent.keyDown(document, { key: "Escape" }) → onOpenChange called with `false`.
    5. **ArrowRight calls onIndexChange with next index** (clamped — 0 → 1 in a 3-photo lightbox; 2 → 2 stays clamped, NO wrap).
    6. **ArrowLeft calls onIndexChange with prev index** (clamped — 1 → 0; 0 → 0 stays clamped, NO wrap). Document the no-wrap decision in a code comment so future revisions don't introduce surprise wrap behavior.
    7. **Touch swipe LEFT (dx < 0) advances next when distance ≥ 80 AND velocity ≥ 0.3**: `fireEvent.touchStart(content, { changedTouches: [{ clientX: 200, clientY: 100 }] })`, advance fake timers/perf-now by 100ms, `fireEvent.touchEnd(content, { changedTouches: [{ clientX: 90, clientY: 100 }] })` → onIndexChange called with index+1. Mock `performance.now` via `vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(100)` so dt=100ms, |dx|=110, velocity=1.1.
    8. **Touch swipe RIGHT (dx > 0) advances prev when both thresholds met** (mirror of case 7 with positive dx).
    9. **Touch swipe under threshold is no-op**: |dx|=50, dt=100 → no onIndexChange call. AND |dx|=100, dt=400 → velocity 0.25 < 0.3 → no onIndexChange call. Both subcases assert onIndexChange NOT called.
    10. **Multi-touch onTouchStart does NOT preventDefault**: `fireEvent.touchStart(content, { touches: [{ clientX: 100 }, { clientX: 200 }], changedTouches: [{ clientX: 100 }] })` — assert the synthetic event's `defaultPrevented` is false. (Pinch-zoom non-interference per UI-SPEC §9 line 442.)
    11. **Reduced-motion class branch**: mock `useReducedMotion` from `motion/react` to return `true` (mirror of `tests/unit/skeleton-group.test.tsx:5-13`); render Lightbox open; assert content className does NOT include any `scale-` or `transition-transform` token, and DOES include an opacity-only transition class (e.g. `transition-opacity` or `duration-[80ms]`). Also assert: with `useReducedMotion = false`, the content className DOES include a `scale-` token (e.g. `data-[state=open]:scale-100` or equivalent).
    12. **No `touch-action: none`**: `expect(container.innerHTML).not.toMatch(/touch-action:\s*none/)` AND `expect(content.className).not.toContain("touch-none")`. Pinch-zoom regression sentinel.

    ## InlineEditField unit cases (tests/unit/inline-edit-field.test.tsx)

    1. **Read state DOM**: `read` state renders `role="button"` with `tabIndex={0}` and `aria-label` matching `${label}: ${value || placeholder}`.
    2. **Empty value renders placeholder in italic**: value=null, placeholder="Adicionar apelido" → text "Adicionar apelido" rendered with italic class (`italic` Tailwind utility).
    3. **Tap converts to editing**: click on read button → native input rendered, focused (`document.activeElement === input`), input.value === current value (or "" if value=null), text selection covers the full value.
    4. **Enter on read button enters editing** (keyboard activation parity with click).
    5. **Space on read button enters editing** (UI-SPEC §12 line 593 — keyboard activation).
    6. **Blur (single-line text variant) commits via onSave**: edit, change input, fireEvent.blur → `onSave` called with new value exactly once. State transitions to `saving` (assert `aria-busy="true"` on field wrapper) until promise resolves; then state returns to `read` showing the new value.
    7. **Enter (single-line text variant) commits via onSave**: edit, change input, press Enter → onSave called once with new value.
    8. **Esc reverts to pre-edit value with no callback**: edit, change input, press Esc → onSave NOT called; state returns to `read`; displayed value === original pre-edit value.
    9. **Saving state shows "Salvando…" label and aria-busy=true**: with onSave returning a never-resolving promise, after commit the rendered DOM contains text matching `/Salvando…/` adjacent to the editor (NOT inside the input value); the field wrapper has `aria-busy="true"`. Bonus assertion: assert there is NO element with `role="progressbar"` (UI-SPEC §12 line 575 — no spinner).
    10. **onSave rejection reverts displayed value AND announces revert via role="alert"**: with `revertAnnouncementCopy="Não conseguimos salvar agora — tentar de novo?"` and onSave returning `Promise.reject(new Error("503"))`, after commit + rejection: displayed value === pre-edit value; an element with `role="alert"` is in the DOM with the revert copy. Use `await waitFor(() => ...)` to bridge the microtask boundary.
    11. **onSave rejection without `revertAnnouncementCopy` is silent**: same as case 10 but `revertAnnouncementCopy` undefined → value reverts but NO `role="alert"` is rendered. (Confirms the prop opt-in semantics.)
    12. **Required + empty submit blocks save**: `required=true`, `requiredErrorCopy="Não pode ficar vazio."`, edit to empty string, blur → onSave NOT called; field stays in editing state with `aria-busy="false"`; a `role="alert"` element renders the required copy; the editor has `aria-invalid="true"` and a 1.5px Overdue stroke (assert className includes `border-rust`).
    13. **readOnly=true renders read state with no hover/tap affordance**: button DOM has `aria-disabled="true"` (or omits `role="button"` entirely — pick one and document); click does NOT enter editing state; `tabIndex` is omitted or `-1`.
    14. **textarea variant — Cmd/Ctrl+Enter commits, Enter inserts newline**: render `variant="textarea"`. Type "linha 1", press Enter → onSave NOT called; input value === "linha 1\n" (newline inserted). Press Cmd+Enter (or Ctrl+Enter) → onSave called with full value. NOTE: per UI-SPEC §12 line 305 multiline saves on Cmd/Ctrl-Enter, NOT plain Enter.
    15. **date variant — blur commits**: render `variant="date"`, change to "2025-04-29", fireEvent.blur → onSave called with `"2025-04-29"`. (Native date input emits an ISO string in valueAsString — keep callbacks identity-preserving.)
    16. **renderEditor slot replaces editor in editing state**: pass a `renderEditor` returning `<div data-testid="custom-slot">{value}</div>`. Click read button → editing state renders the slot; default `<input>` is NOT in the DOM. The slot's `commit`/`cancel` callbacks invoke onSave / revert respectively.
    17. **XSS safety (T-05-14-01)**: pass `value=""`, type `<script>alert(1)</script>`, blur → onSave called with the literal string. Assert `document.querySelectorAll("script").length` is unchanged after render. Assert the value rendered into the read state (after onSave resolves) appears as text content (textContent equality), NOT as parsed HTML. Test file MUST cite T-05-14-01 in a leading comment.

    ## E2E cases — Lightbox (tests/e2e/axe-lightbox.spec.ts)

    18. **axe a11y across 4 combos on /lightbox**: 0 serious + 0 critical violations.
    19. **Focus trap (T-05-14-02)**: open Lightbox via harness invoker, press Tab six times, assert focus stays inside `[role="dialog"]` (mirror `tests/e2e/axe-modal-focus-trap.spec.ts:30-37`); press Escape, assert focus returns to `data-testid="lightbox-invoker"`.

    ## E2E cases — InlineEditField (tests/e2e/axe-inline-edit-field.spec.ts)

    20. **axe a11y across 4 combos on /inline-edit-field**: 0 serious + 0 critical violations.
    21. **Revert announcement is reachable as alert role**: simulate save failure on the harness's "always-fails" field (the harness wires one onSave to `() => Promise.reject(new Error("test"))`). Click the field, type, blur → assert `page.getByRole("alert")` becomes visible with the revert copy. (Programmatic complement to unit case 10 against a real browser.)

    ## Non-cases (out of scope)

    - VoiceOver / TalkBack rotor verbalization is a manual-only verification per VALIDATION.md line 128. Not asserted here.
    - Sonner toast on save failure is the CONSUMER's responsibility (Wave 4 plant profile wires `sonner.toast.error` in onSave's catch). InlineEditField only renders the in-place `role="alert"` announcement.
    - Lightbox photo preloading / caching is the consumer's job (catalog photos are signed URLs with Serwist runtime cache per D-19/D-20).
    - Combobox variant of InlineEditField — delivered via `renderEditor` slot only (Decision A in `<implementation>`). The plant-profile location field (Wave 4 plan 05-16) wires LocationCombobox into the slot.
  </behavior>
  <implementation>
    ## Decision A: combobox variant via render-prop slot (resolves cross-plan dependency)

    UI-SPEC §12 line 538 lists 4 variants: `text` / `textarea` / `date` / `combobox`. Plan 05-12 (Combobox primitive) ships in the same Wave 1 with `depends_on: []` — meaning 05-12 and 05-14 can execute in parallel. If `inline-edit-field.tsx` imports from `@shared/ui/combobox`, this plan acquires a hidden dependency on 05-12 and breaks the parallelism contract.

    **Resolution:** This plan ships built-in `text` / `textarea` / `date` variants AND a render-prop slot (`renderEditor?: (args) => ReactNode`) that consumers use to inject any custom editor — including the headless Combobox. The combobox variant of UI-SPEC §12 is delivered by the slot. Wave 4 plan 05-16 (plant profile) wires `<LocationCombobox>` into the slot at the location field's render site. InlineEditField never imports Combobox.

    ## Decision B: lock UI-SPEC §9 thresholds; do NOT leave to discretion

    UI-SPEC §9 line 439 specifies swipe distance ≥ 80px AND velocity ≥ 0.3 px/ms. UI-SPEC §9 line 446-449 specifies open=240ms, reduced-motion=80ms instant fade. Implementation MUST use these values verbatim. CONTEXT.md `<discretion>` line 98 ("Lightbox swipe-velocity + dismiss thresholds") is overridden by UI-SPEC's concrete values.

    ## Decision C: pinch-zoom non-interference is a verifiable invariant

    UI-SPEC §9 line 442: "Pinch-zoom: native browser default (no custom JS — accessibility + simplicity)." Implementation MUST NOT:
    - Set `touch-action: none` (or `touch-none` Tailwind utility) on Dialog.Content.
    - Call `e.preventDefault()` inside `onTouchStart`/`onTouchEnd` when `e.touches.length > 1`.

    Verification by unit test (case 12) AND `<verification>` block grep sentinel.

    ## Decision D: ArrowLeft/ArrowRight clamp at boundaries; do NOT wrap

    UI-SPEC §9 lines 437-441 do not specify wrap-around. Photo journals can have hundreds of entries; wrapping in keyboard navigation creates surprise. Clamp at 0 and `photos.length - 1`. Document the choice in a code comment so future revisions don't silently flip behavior.

    ## Implementation guidance — Lightbox (src/shared/ui/lightbox.tsx)

    1. `"use client"` directive.
    2. Imports: `import * as Dialog from "@radix-ui/react-dialog"; import { XIcon } from "lucide-react"; import { useReducedMotion } from "motion/react"; import { useRef, type KeyboardEvent, type TouchEvent } from "react";`
    3. Mirror `src/shared/ui/modal-sheet.tsx:48-79` for Dialog.Root + Dialog.Portal + Dialog.Overlay + Dialog.Content nesting. Replace the bottom-sheet positioning class with full-screen positioning: `fixed inset-0 z-50 flex items-center justify-center bg-forest/90` on Overlay; Content is the photo + chrome layer.
    4. Use `useRef<{ x: number; t: number } | null>(null)` for `touchStartRef`. Reset to `null` after touchEnd or when multi-touch detected.
    5. `onTouchStart`: if `e.touches.length > 1`, set `touchStartRef.current = null` and RETURN (no preventDefault). Otherwise record `{ x: e.changedTouches[0].clientX, t: performance.now() }`.
    6. `onTouchEnd`: read `touchStartRef.current`; if null, return. Compute `dx = e.changedTouches[0].clientX - start.x`, `dt = Math.max(performance.now() - start.t, 1)`, `velocity = Math.abs(dx) / dt`. If `Math.abs(dx) >= 80 && velocity >= 0.3`: call `onIndexChange(dx < 0 ? Math.min(index + 1, photos.length - 1) : Math.max(index - 1, 0))`. Reset ref to null.
    7. `onKeyDown` on Dialog.Content: ArrowLeft → `onIndexChange(Math.max(index - 1, 0))`. ArrowRight → `onIndexChange(Math.min(index + 1, photos.length - 1))`. (Esc is Radix default — do NOT add custom Esc handler.)
    8. Reduced-motion branch:
       - `const reduced = useReducedMotion();`
       - `const animationClass = reduced ? "transition-opacity duration-[80ms]" : "transition-all duration-[240ms] data-[state=open]:scale-100 data-[state=closed]:scale-95";`
       - Apply to Dialog.Content className. NEVER include `scale-` token in the reduced branch.
    9. `<img>` rendering: `alt={photos[index].caption ?? `Foto ${index + 1} de ${photos.length}`}`. Source: `photos[index].src`. Style: `max-w-[90vw] max-h-[90vh] object-contain`.
    10. Index indicator: only when `photos.length >= 2`; `<span aria-live="polite" className="absolute bottom-6 left-1/2 -translate-x-1/2 text-ivory text-sm font-semibold">{`${index + 1} / ${photos.length}`}</span>`.
    11. Fechar button: top-right 44×44px, `aria-label={closeLabel}`, mirrors `src/shared/ui/modal-sheet.tsx:65-73` pattern with `<Dialog.Close asChild><button>...XIcon...</button></Dialog.Close>`.
    12. Caption under photo (when present): `<p className="absolute bottom-16 left-6 right-6 text-ivory text-sm line-clamp-2">{photos[index].caption}</p>`.
    13. Dialog root accessibility: pass `aria-label={`Galeria — ${plantName}`}` to `Dialog.Content` (Radix lifts to `[role="dialog"]`).

    ## Implementation guidance — InlineEditField (src/shared/ui/inline-edit-field.tsx)

    1. `"use client"` directive.
    2. Imports: `import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";`
    3. Local state: `mode: "read" | "editing" | "saving" | "error"`, `draft: string`, `revertCopy: string | null`. Pre-edit snapshot in a ref.
    4. Read DOM:
       - When `readOnly === true`: render label + value (italic placeholder if empty); plain `<div>` (NO `role="button"`, NO `tabIndex`, cursor `default`).
       - Else: `<button type="button" role="button" tabIndex={0} aria-label={`${label}: ${value || placeholder}`} onClick={enterEditing} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); enterEditing(); } }} className={"hover:outline hover:outline-1.5 hover:outline-offset-4 hover:outline-hairline hover:cursor-text"}>...</button>`.
    5. Editor DOM (when slot is provided, replace native input with slot output):
       - `text` variant: `<input type="text" value={draft} onChange autoFocus onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); else if (e.key === "Escape") cancel(); }} aria-label={label} aria-invalid={validationError !== null} aria-describedby={validationError ? helperId : undefined} className={validationError ? "border-rust" : "border-canopy"} />`.
       - `textarea` variant: same shape with `<textarea>`. Enter inserts newline (default browser behavior — do NOT preventDefault on Enter). Cmd/Ctrl+Enter commits: `if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }`.
       - `date` variant: `<input type="date">`; commit on blur.
       - **Slot variant**: when `renderEditor` is provided, render `props.renderEditor({ value: draft, setValue: setDraft, commit, cancel, ariaLabel: label, ariaInvalid: ..., ariaDescribedBy: ... })`. The slot is mutually exclusive with the built-in editor for that field instance.
    6. Selection on entering editing: `useEffect(() => { if (mode === "editing" && !renderEditor && inputRef.current) inputRef.current.select(); }, [mode]);`. Skip selection logic for slot variant — the slot's caller manages it.
    7. `commit` logic:
       - If `required && draft.trim() === ""`: set validation error to `requiredErrorCopy`, render `<p role="alert" id={helperId} className="text-sm text-rust">{requiredErrorCopy}</p>` next to editor; STAY in editing; do NOT call onSave.
       - Else: set mode = "saving"; field wrapper gets `aria-busy="true"`; render `<span className="text-sm text-slate">Salvando…</span>` adjacent to value; await `onSave(draft.trim())`. On resolve: mode = "read", clear validation error. On reject: mode = "read" (revert to pre-edit value); IF `revertAnnouncementCopy` provided, render `<p role="alert" className="text-sm text-rust mt-1">{revertAnnouncementCopy}</p>` for ~5s (or until next interaction — pick a single mechanism: timeout cleared on next read-state interaction). Document the lifecycle in the source comment.
    8. `cancel` logic: mode = "read"; restore draft = pre-edit snapshot; do NOT call onSave; clear any validation error.
    9. NEVER `dangerouslySetInnerHTML` (T-05-14-01 — XSS-safe). User-typed values flow through React text nodes only.

    ## Implementation guidance — test routes + harnesses

    Mirror `src/app/(test)/modal-sheet/page.tsx` verbatim for both test pages. Each harness is a `"use client"` component:

    1. `src/app/(test)/lightbox/harness.tsx`: invoker button (`data-testid="lightbox-invoker"`) opens Lightbox with 3 fixture photos (use Tailwind `bg-canopy` colored 1×1 SVG data URIs to avoid network). Lightbox state controlled via `useState<{ open: boolean; index: number }>`. Plant name "Manjericão" (provides distinct aria-label for the focus-trap spec).

    2. `src/app/(test)/inline-edit-field/harness.tsx`: 4 fields rendered:
       - text variant — `onSave={async (v) => {/* resolves */}}`.
       - textarea variant — onSave resolves.
       - date variant — onSave resolves.
       - "always-fails" text variant — `onSave={() => Promise.reject(new Error("test"))}` with `revertAnnouncementCopy="Não conseguimos salvar agora — tentar de novo?"`. Used by E2E case 21.
       Also one read-only field (`readOnly={true}`) so axe scans the read-only state.

    All harnesses wrap content in `<main>` with `<h1>` (axe landmark + heading).

    ## Implementation guidance — E2E specs

    1. `tests/e2e/axe-lightbox.spec.ts`:
       - Copy 4-combo loop verbatim from `tests/e2e/axe-placeholder-pages.spec.ts:6-44`. Replace ROUTES with single-route navigation; on each combo, open the Lightbox via the invoker BEFORE running AxeBuilder so the Dialog DOM is in scope.
       - Append the focus-trap test mirroring `tests/e2e/axe-modal-focus-trap.spec.ts:3-52` verbatim — replace `/modal-sheet` with `/lightbox`, replace `data-testid="modal-invoker"` with `data-testid="lightbox-invoker"`. Tab six times asserting focus stays inside `[role="dialog"]`; Esc returns focus to invoker. (T-05-14-02 mitigation.)

    2. `tests/e2e/axe-inline-edit-field.spec.ts`:
       - Copy the 4-combo loop. On each combo, click the "always-fails" field, type "x", press Tab to blur → wait for `page.getByRole("alert")` with the revert copy to be visible. Then run AxeBuilder against the page (announcement DOM in scope).
       - Append a single non-axe test: same flow as above, but assert `await page.getByRole("alert").isVisible()` returns true with the revert copy text. (E2E case 21.)
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (RED): Write failing Lightbox + InlineEditField unit-dom tests</name>
  <files>
    tests/unit/lightbox.test.tsx,
    tests/unit/inline-edit-field.test.tsx
  </files>
  <behavior>
    Write all 17 unit-dom tests (12 Lightbox cases 1-12 + 13 InlineEditField cases 1-13... wait — 1-17 InlineEditField cases per `<feature>`). Use `@testing-library/react` + `@testing-library/user-event` (already installed per package.json). Use `vi.useFakeTimers()` + `vi.advanceTimersByTime` where needed. Use `vi.spyOn(performance, "now").mockReturnValueOnce(...)` for swipe velocity measurement. Mock `motion/react` `useReducedMotion` for the reduced-motion test (mirror `tests/unit/skeleton-group.test.tsx:5-13`).

    Each test asserts a single behavior. Naming convention: `it("commits via onSave on blur (text variant)")`, `it("Esc reverts to pre-edit value with no callback")`, `it("renders typed value as text node — does not execute injected <script>")`, etc. Test the public API only (props in / behavior out); do not reach into component internals.

    Imports point to the not-yet-created files: `import { Lightbox } from "@shared/ui/lightbox";` and `import { InlineEditField } from "@shared/ui/inline-edit-field";` — these MUST fail at module-resolution time, which is the RED signal.

    File MUST place a single XSS regression test at the top of `inline-edit-field.test.tsx` with explicit comment referencing T-05-14-01.
  </behavior>
  <action>
    1. Create `tests/unit/lightbox.test.tsx` covering all 12 Lightbox cases from `<feature>` (cases 1-12). Critical specifics:
       - For touch event synthesis (jsdom does NOT support `userEvent.touch` — that API does not exist). Use `fireEvent.touchStart(content, { changedTouches: [{ clientX: 200, clientY: 100 }], touches: [{ clientX: 200 }] })` and `fireEvent.touchEnd(content, { changedTouches: [{ clientX: 90, clientY: 100 }] })`. The element to dispatch on is the Dialog.Content (acquire via `getByRole("dialog")`).
       - For `performance.now`: `const nowSpy = vi.spyOn(performance, "now"); nowSpy.mockReturnValueOnce(0); nowSpy.mockReturnValueOnce(100);` before the swipe. Restore with `nowSpy.mockRestore()` in afterEach.
       - For reduced-motion: `vi.mock("motion/react", () => ({ useReducedMotion: vi.fn() }))` then `vi.mocked(useReducedMotion).mockReturnValue(true)` per case.
       - Multi-touch case: assert `fireEvent.touchStart` returned event has `defaultPrevented === false` (use the boolean returned by `fireEvent` per testing-library docs, OR query the synthetic event).
       - Pinch-zoom regression: `expect(content.className).not.toMatch(/touch-none/); expect(getComputedStyle(content).touchAction).not.toBe("none");` (jsdom may not compute styles — check via `style` attribute or className grep instead).

    2. Create `tests/unit/inline-edit-field.test.tsx` covering all 17 InlineEditField cases from `<feature>` (cases 1-17). Critical specifics:
       - Top-of-file leading comment: `// T-05-14-01 — XSS regression: user-typed values must render as text nodes, never as parsed HTML.`
       - For onSave promise resolution: use `vi.fn().mockResolvedValue(undefined)` for the success path; `vi.fn().mockRejectedValue(new Error("503"))` for the rejection path.
       - For never-resolving promise (case 9): `vi.fn(() => new Promise(() => {}))`. Assert aria-busy via `screen.getByRole("...").closest("[aria-busy='true']")` or via `getByText("Salvando…")` proximity.
       - For role="alert" assertions: `await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Não conseguimos..."))`. The microtask boundary matters — the rejection settles asynchronously.
       - For required-empty (case 12): `userEvent.type` to clear, then `userEvent.tab()` to blur. Assert onSave NOT called via `expect(onSave).not.toHaveBeenCalled()`.
       - For the slot variant (case 16): pass `renderEditor={(args) => <div data-testid="custom-slot">{args.value}</div>}`. Click read button → `getByTestId("custom-slot")` exists. Test commit/cancel by exposing the args via a `useImperativeHandle`-free pattern: render-prop returns a button that calls `args.commit()` on click. Then click the button — assert onSave called.
       - For Cmd+Enter (case 14): `userEvent.keyboard("{Meta>}{Enter}{/Meta}")` (testing-library/user-event v14 syntax).
       - For XSS (case 17): `userEvent.type(input, "<script>alert(1)</script>")`, blur. Assert `document.querySelectorAll("script").length === preCount`. Re-render the read state; assert `screen.getByRole("button").textContent.includes("<script>alert(1)</script>")` (literal angle brackets, not parsed HTML).

    3. Run `pnpm test:unit -- lightbox` — MUST fail with `Cannot find module '@shared/ui/lightbox'`.
       Run `pnpm test:unit -- inline-edit-field` — MUST fail with `Cannot find module '@shared/ui/inline-edit-field'`.
       Both failures are the RED state. Commit only if module-not-found is the failure (not syntax errors in the test files).

    4. Commit: `test(05-14): add failing Lightbox + InlineEditField unit tests` — per gsd TDD convention.

    Specificity / anti-pattern guards:
    - DO NOT mock `useId` — React 19 stable; rely on real ids.
    - DO NOT add snapshot tests — explicit assertions only (project bans snapshots outside `banned-patterns-snapshot.test.ts`).
    - DO NOT import the source modules from path aliases differently than the rest of the codebase: use `@shared/ui/lightbox` (matches tsconfig path aliases used by 05-12 plan).
    - DO use `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` so user events advance the fake timer.
    - DO assert `aria-live="polite"` exact value: `expect(indicator).toHaveAttribute("aria-live", "polite")`.
  </action>
  <verify>
    <automated>pnpm test:unit -- lightbox inline-edit-field 2>&1 | grep -E "FAIL|Cannot find module|lightbox|inline-edit" | head -30</automated>
  </verify>
  <done>
    Both test files exist. `tests/unit/lightbox.test.tsx` contains 12 individual `it(...)` blocks (cases 1-12). `tests/unit/inline-edit-field.test.tsx` contains 17 `it(...)` blocks (cases 1-17) with leading T-05-14-01 comment. `pnpm test:unit -- lightbox inline-edit-field` fails with `Cannot find module '@shared/ui/lightbox'` AND `Cannot find module '@shared/ui/inline-edit-field'` (module-resolution RED — not syntax error). Commit created.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (GREEN): Implement Lightbox + InlineEditField so all unit tests pass</name>
  <files>
    src/shared/ui/lightbox.tsx,
    src/shared/ui/inline-edit-field.tsx
  </files>
  <behavior>
    Implement the two primitives per the contracts and implementation guidance in `<feature>`. All 12 Lightbox tests + 17 InlineEditField tests in Task 1 MUST pass. NO regressions in `pnpm test:unit` full suite.
  </behavior>
  <action>
    1. **Create `src/shared/ui/lightbox.tsx`** following `<implementation>` Lightbox guidance:
       - `"use client"` directive.
       - Mirror `src/shared/ui/modal-sheet.tsx:48-79` for Dialog.Root / Dialog.Portal / Dialog.Overlay / Dialog.Content nesting; replace bottom-sheet positioning with full-screen.
       - Use `useReducedMotion` from `motion/react` (already used in `src/shared/ui/skeleton.tsx:24`). Branch animation classes — under reduced, opacity-only (`transition-opacity duration-[80ms]`); else, transform+opacity (`transition-all duration-[240ms] data-[state=open]:scale-100 data-[state=closed]:scale-95`).
       - Touch handlers per `<implementation>` step 5-6. THRESHOLDS LOCKED: distance ≥ 80, velocity ≥ 0.3 (Decision B). Multi-touch is a no-op — do NOT preventDefault (Decision C).
       - Keyboard handler per `<implementation>` step 7. Boundaries CLAMP, do NOT wrap (Decision D — add code comment).
       - Photo `<img>` with `alt={caption ?? `Foto ${index + 1} de ${photos.length}`}`.
       - Index indicator only when `photos.length >= 2`, `aria-live="polite"`.
       - Fechar button top-right (mirror `src/shared/ui/modal-sheet.tsx:65-73`).
       - Pass `aria-label={`Galeria — ${plantName}`}` on Dialog.Content (NOT on a wrapper div — Radix lifts attrs from Content to the dialog node).
       - Caption rendering via React text node only — never `dangerouslySetInnerHTML`.

    2. **Create `src/shared/ui/inline-edit-field.tsx`** following `<implementation>` InlineEditField guidance:
       - `"use client"` directive.
       - State machine via `useState`. Pre-edit value snapshot in `useRef<string>("")`.
       - Read DOM differs based on `readOnly` per `<implementation>` step 4.
       - Editor DOM differs per `variant` AND `renderEditor` slot per `<implementation>` step 5. Slot variant takes precedence: when `renderEditor` is provided, the built-in editor is NOT rendered.
       - `enterEditing()` snapshots current value, sets mode = "editing", sets draft = current value or "".
       - `commit()` per `<implementation>` step 7. Required-empty path renders `role="alert"` helper INLINE with the editor (NOT after exit). Save-reject path renders `role="alert"` revert announcement adjacent to the read state value AFTER exit.
       - `cancel()` per `<implementation>` step 8.
       - For text variant Enter commits; for textarea Cmd/Ctrl+Enter commits (Enter is newline default); for date blur commits.
       - Auto-select on entering editing (built-in variants only): `useEffect(() => { if (mode === "editing" && !renderEditor) inputRef.current?.select(); }, [mode]);`
       - Saving label "Salvando…" rendered adjacent (sibling) to the editor, NOT inside the input. Field wrapper carries `aria-busy={mode === "saving" ? "true" : "false"}`.
       - User-typed value rendered via React text nodes only — NEVER `dangerouslySetInnerHTML` (T-05-14-01 mitigation).
       - readOnly: render `<div>` with NO role/tabIndex; cursor: default. Click is no-op.

    3. **Run `pnpm test:unit -- lightbox inline-edit-field`** — all 29 tests MUST pass. If any fails, fix the implementation (NOT the test); the test is the contract.

    4. **Run `pnpm test:unit`** in full to confirm no regressions in adjacent tests (especially `messages-coverage.test.ts`, `banned-patterns-snapshot.test.ts`, `skeleton-group.test.tsx`).

    5. Commit: `feat(05-14): implement Lightbox + InlineEditField primitives (D-05, D-14)`.

    Specificity / anti-pattern guards:
    - DO NOT import a headless library for InlineEditField — hand-rolled per UI-SPEC §12.
    - DO NOT import from `@shared/ui/combobox` (Plan 05-12 may not have shipped at execution time — they run parallel). Combobox variant is delivered via `renderEditor` slot per Decision A.
    - DO NOT use `dangerouslySetInnerHTML` anywhere in either source file.
    - DO NOT add `touch-action: none` (Tailwind `touch-none`) anywhere in `lightbox.tsx`. Pinch-zoom non-interference per Decision C.
    - DO NOT call `e.preventDefault()` in `onTouchStart`/`onTouchEnd` for multi-touch events.
    - DO NOT add wrap-around to ArrowLeft/ArrowRight (Decision D — clamp).
    - DO use Tailwind utility classes only (no CSS modules, no styled-components).
    - DO use `Math.min`/`Math.max` for index clamping; do NOT use modulo on negative numbers.
  </action>
  <verify>
    <automated>pnpm test:unit -- lightbox inline-edit-field</automated>
  </verify>
  <done>
    All 29 unit tests pass under `pnpm test:unit -- lightbox inline-edit-field`. Full `pnpm test:unit` is also green (no regressions). `src/shared/ui/lightbox.tsx` exists with `@radix-ui/react-dialog` import + `useReducedMotion` import + `aria-label` containing "Galeria — " (verified by `grep "Galeria" src/shared/ui/lightbox.tsx`). `src/shared/ui/inline-edit-field.tsx` exists with `role="button"` literal + `role="alert"` literal in the source. Neither file contains `dangerouslySetInnerHTML` (`grep -L "dangerouslySetInnerHTML" src/shared/ui/lightbox.tsx src/shared/ui/inline-edit-field.tsx` lists both). `lightbox.tsx` does NOT contain `touch-none` or `touch-action.*none` (`grep -E "touch-none|touch-action.*none" src/shared/ui/lightbox.tsx | grep -v '^[[:space:]]*//' | wc -l` returns 0). Commit created.
  </done>
</task>

<task type="auto">
  <name>Task 3: Test-only routes + Playwright axe + focus-trap E2E gates</name>
  <files>
    src/app/(test)/lightbox/page.tsx,
    src/app/(test)/lightbox/harness.tsx,
    src/app/(test)/inline-edit-field/page.tsx,
    src/app/(test)/inline-edit-field/harness.tsx,
    tests/e2e/axe-lightbox.spec.ts,
    tests/e2e/axe-inline-edit-field.spec.ts
  </files>
  <action>
    1. **Create `src/app/(test)/lightbox/page.tsx`** — verbatim mirror of `src/app/(test)/modal-sheet/page.tsx`. Production guard:
       ```tsx
       import { notFound } from "next/navigation";
       import { LightboxTestHarness } from "./harness";
       export default function LightboxTestPage() {
         if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
           notFound();
         }
         return <LightboxTestHarness />;
       }
       ```

    2. **Create `src/app/(test)/lightbox/harness.tsx`** — `"use client"` component:
       - Wrap in `<main className="min-h-[100dvh] bg-paper p-6">` with `<h1>` (axe landmark).
       - Invoker button `data-testid="lightbox-invoker"` opens Lightbox.
       - Lightbox state controlled via `useState<{ open: boolean; index: number }>({ open: false, index: 0 })`.
       - Three fixture photos (use 1×1 inline data URIs to avoid network — e.g. `src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0i..."` for canopy/sage/rust colored squares).
       - `plantName="Manjericão"`, `closeLabel="Fechar"`.
       - Autofocus the invoker on mount (mirror `src/app/(test)/modal-sheet/harness.tsx` `useEffect(() => { invokerRef.current?.focus(); }, [])` pattern) so Radix can snapshot the previously-focused element for return-focus-on-close.

    3. **Create `src/app/(test)/inline-edit-field/page.tsx`** — same mirror pattern as Lightbox page, importing `InlineEditFieldTestHarness` from `./harness`.

    4. **Create `src/app/(test)/inline-edit-field/harness.tsx`** — `"use client"` component:
       - Wrap in `<main>` with `<h1>`.
       - 5 fields rendered (each with its own controlled value via local `useState`):
         - Section A (text variant, success): `<InlineEditField label="Nome" value={...} placeholder="Sem nome" variant="text" onSave={async (v) => setName(v)} />`. data-testid="inline-text-success".
         - Section B (textarea variant, success). data-testid="inline-textarea-success".
         - Section C (date variant, success). data-testid="inline-date-success".
         - Section D (text variant, "always-fails"): `onSave={() => Promise.reject(new Error("test"))}` with `revertAnnouncementCopy="Não conseguimos salvar agora — tentar de novo?"`. data-testid="inline-text-failure".
         - Section E (text variant, read-only): `readOnly={true}`. data-testid="inline-text-readonly".

    5. **Create `tests/e2e/axe-lightbox.spec.ts`**:
       - Copy the 4-combo loop verbatim from `tests/e2e/axe-placeholder-pages.spec.ts:6-44`. Replace ROUTES with single-route loop on `/lightbox`. Inside the per-combo body: `await page.goto("/lightbox"); await page.getByTestId("lightbox-invoker").click(); await page.waitForSelector('[role="dialog"]'); const results = await new AxeBuilder({page}).analyze(); ...`
       - Append a SECOND test mirroring `tests/e2e/axe-modal-focus-trap.spec.ts` verbatim (copy that file's test, then replace `/modal-sheet` → `/lightbox` and `data-testid="modal-invoker"` → `data-testid="lightbox-invoker"`). The Tab cycle assertion + Esc-returns-focus assertion mitigate threat T-05-14-02.

    6. **Create `tests/e2e/axe-inline-edit-field.spec.ts`**:
       - Copy the 4-combo loop on `/inline-edit-field`. Inside each combo: navigate, click `data-testid="inline-text-failure"` (enters editing), type "x", press Tab to blur, `await page.getByRole("alert").waitFor({ state: "visible" });` — then run AxeBuilder. This ensures the role="alert" announcement DOM is in scope during the axe scan.
       - Append a SECOND test asserting `await expect(page.getByRole("alert")).toContainText("Não conseguimos salvar agora")` after the failure flow. (E2E case 21.)

    7. **Run `pnpm test:e2e -- axe-lightbox.spec.ts axe-inline-edit-field.spec.ts`** with `ENABLE_TEST_ROUTES=1` if needed (the production guard lets the route through in NODE_ENV=development by default — verify by reading `(test)/modal-sheet/page.tsx:25-27`).

    8. Commit: `test(05-14): add /lightbox + /inline-edit-field test routes + axe + focus-trap E2E gates`.

    Anti-pattern guards:
    - DO NOT add `/lightbox` or `/inline-edit-field` to `axe-placeholder-pages.spec.ts` ROUTES array — that file is for SHIPPED placeholder pages. These are PRIMITIVE harnesses, scanned via dedicated specs. Wave 4 plans (05-15..05-17) extend `axe-placeholder-pages.spec.ts` for shipped catalog routes.
    - DO use `page.emulateMedia({ colorScheme, reducedMotion })` BEFORE `page.goto(...)`, mirroring the existing pattern.
    - DO NOT mark this task as `tdd="true"` — it is glue code (test-only routes + specs), not production code. The TDD cycle is closed by Tasks 1 + 2.
  </action>
  <verify>
    <automated>pnpm test:e2e -- axe-lightbox.spec.ts axe-inline-edit-field.spec.ts</automated>
  </verify>
  <done>
    Both `/lightbox` and `/inline-edit-field` test routes exist with production guards mirroring `(test)/modal-sheet`. Both harnesses mount their primitives with seeded fixture data (Lightbox: 3 photos + invoker; InlineEditField: 5 sections covering all 3 variants + always-fails + read-only). `tests/e2e/axe-lightbox.spec.ts` exists with 4-combo axe loop + focus-trap mirror test (T-05-14-02). `tests/e2e/axe-inline-edit-field.spec.ts` exists with 4-combo axe loop + role="alert" revert assertion (E2E case 21). `pnpm test:e2e -- axe-lightbox.spec.ts axe-inline-edit-field.spec.ts` passes (4 axe runs + 1 focus-trap test on /lightbox; 4 axe runs + 1 alert test on /inline-edit-field = 10 green tests). axe-core finds 0 serious/critical violations under any theme/motion combo. Commit created.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User typed input → DOM render (InlineEditField) | The InlineEditField echoes user-typed values into the read-state value display and into the `<input>` element. Untrusted input crosses this boundary at every keystroke and on every successful save. |
| Modal Dialog focus management (Lightbox) | Radix Dialog focus trap defines the boundary between the Dialog's interactive surface and the page beneath. Escaped focus would expose user gestures to elements outside the trap. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-14-01 | I (Information disclosure / XSS) | `src/shared/ui/inline-edit-field.tsx` value rendering — both read state and editor input echo path | mitigate | Render the value via JSX text node only — `<span>{value}</span>` and `<input value={draft} />`; React auto-escapes text-node children and treats `value` as string. NEVER `dangerouslySetInnerHTML` anywhere in the file (verified by grep in Task 2 done criteria + `<verification>` block). Unit test in Task 1 (`tests/unit/inline-edit-field.test.tsx` case 17) asserts that typing `<script>alert(1)</script>` produces literal text content (textContent equality) and `document.querySelectorAll('script').length` is unchanged after render. axe-core E2E in Task 3 catches any accidentally introduced HTML injection sinks. Block-on: high. |
| T-05-14-02 | E (Elevation of privilege / focus escape) | `src/shared/ui/lightbox.tsx` Dialog.Content focus trap | mitigate | Wrap content in `@radix-ui/react-dialog` `Dialog.Root → Dialog.Portal → Dialog.Content` — Radix's well-tested focus-trap implementation handles nested focusable elements + portal nodes. Do NOT add custom focus-trap logic that could bypass Radix's. Verified by Playwright spec in Task 3 (`tests/e2e/axe-lightbox.spec.ts`) which mirrors `tests/e2e/axe-modal-focus-trap.spec.ts` — Tab six times asserting focus stays inside `[role="dialog"]`; Esc returns focus to invoker (`data-testid="lightbox-invoker"`). Block-on: high. |

(No Spoofing/Tampering/Repudiation/DoS — both primitives are presentation-only with no auth boundary, no persistence, no rate-limited surface. Network calls happen in callers, not in these primitives.)
</threat_model>

<verification>
- All 12 Lightbox unit tests + 17 InlineEditField unit tests in `tests/unit/lightbox.test.tsx` + `tests/unit/inline-edit-field.test.tsx` green under `pnpm test:unit`.
- All E2E tests in `tests/e2e/axe-lightbox.spec.ts` (5 = 4 axe + 1 focus-trap) and `tests/e2e/axe-inline-edit-field.spec.ts` (5 = 4 axe + 1 alert) green under `pnpm test:e2e -- axe-lightbox.spec.ts axe-inline-edit-field.spec.ts`.
- No regressions in `pnpm test:unit` full suite (especially `banned-patterns-snapshot.test.ts`, `skeleton-group.test.tsx`).
- `grep -L "dangerouslySetInnerHTML" src/shared/ui/lightbox.tsx src/shared/ui/inline-edit-field.tsx` lists both files (NEITHER contains the string).
- Pinch-zoom non-interference sentinel: `grep -nE "touch-none|touch-action[^a-zA-Z-]*:[^;]*none" src/shared/ui/lightbox.tsx | grep -v '^[[:space:]]*//' | wc -l` returns `0` (no inline `touch-action: none` and no Tailwind `touch-none` utility outside comments).
- No multi-touch preventDefault: `grep -nE "preventDefault|stopPropagation" src/shared/ui/lightbox.tsx | head` shows ONLY occurrences inside ArrowLeft/ArrowRight key handlers (if any), NOT inside touch handlers (manual review of grep output).
- Reduced-motion class branch is exercised: `grep -c "useReducedMotion" src/shared/ui/lightbox.tsx` returns ≥ 1.
- Lightbox aria-label format: `grep -c "Galeria — " src/shared/ui/lightbox.tsx` returns ≥ 1 (UI-SPEC §9 line 456).
- InlineEditField role exposure: `grep -c "role=\"button\"" src/shared/ui/inline-edit-field.tsx` returns ≥ 1 AND `grep -c "role=\"alert\"" src/shared/ui/inline-edit-field.tsx` returns ≥ 1.
- No import from `@shared/ui/combobox` in this plan's source files (cross-plan-dependency sentinel — Decision A): `grep -L "@shared/ui/combobox" src/shared/ui/lightbox.tsx src/shared/ui/inline-edit-field.tsx` lists both files.
- Both test routes are production-guarded: `grep -c "ENABLE_TEST_ROUTES" src/app/\(test\)/lightbox/page.tsx src/app/\(test\)/inline-edit-field/page.tsx` returns 1 each.
</verification>

<success_criteria>
- D-14 Lightbox primitive shipped at `src/shared/ui/lightbox.tsx`: Radix Dialog wrap + horizontal swipe (distance ≥ 80px AND velocity ≥ 0.3 px/ms per UI-SPEC §9 line 439) + visible Fechar + reduced-motion fallback to instant fade (UI-SPEC §9 line 449) + arrow-key navigation + index indicator with `aria-live="polite"` + native pinch-zoom non-interference (no `touch-action: none`).
- D-05 InlineEditField primitive shipped at `src/shared/ui/inline-edit-field.tsx`: tap-to-edit state machine (`read → editing → saving → read` with `Esc → revert` and `error → revert + role="alert"` branches) + variants `text` / `textarea` / `date` + `renderEditor` slot for combobox variant (Decision A — avoids cross-plan dependency on 05-12) + optimistic update with rejected-promise revert announced via `role="alert"` (per RESEARCH.md line 867 + VALIDATION.md line 96) + required-empty validation guard.
- WAI / a11y contracts verified by 12 + 17 = 29 unit-dom tests + 8 + 2 = 10 Playwright tests (8 axe runs across 4 colorScheme×reducedMotion combos × 2 routes + 1 focus-trap + 1 alert).
- Threats T-05-14-01 (XSS via typed value) and T-05-14-02 (focus escape) mitigated and tested.
- UI-08 (plant profile inline-edit) and UI-11 (photo journal lightbox) primitive surfaces shippable: Wave 4 consumers (05-16 plant profile, 05-17 photo journal) can mount `<InlineEditField>` and `<Lightbox>` with no further primitive work; the location field on plant profile passes `<LocationCombobox>` via the InlineEditField `renderEditor` slot.
- Both test-only routes (`/lightbox`, `/inline-edit-field`) are production-guarded mirroring `(test)/modal-sheet` precedent.
- Plan executes Wave 1 in parallel with 05-12 (Combobox primitive) — no shared file modifications, no shared symbol imports.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-14-lightbox-inline-edit-primitives-SUMMARY.md` per `@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md`. Include:
- Components delivered: `<Lightbox>` (~150 LOC target) + `<InlineEditField>` (~150 LOC target).
- Test coverage: 29 unit tests (12 Lightbox + 17 InlineEditField) + 10 E2E tests (8 axe runs + 1 focus-trap + 1 alert).
- Threat T-05-14-01 (XSS) mitigation evidence (test name + assertion).
- Threat T-05-14-02 (focus escape) mitigation evidence (Playwright spec name + assertion).
- Decision A documentation: combobox variant delivered via `renderEditor` slot — Wave 4 plant-profile location field wires `<LocationCombobox>` into the slot. No hard import dependency on Plan 05-12.
- Hand-off note for Wave 4 plans: import paths are `@shared/ui/lightbox` and `@shared/ui/inline-edit-field`. Slot pattern usage example for the combobox variant.
</output>
