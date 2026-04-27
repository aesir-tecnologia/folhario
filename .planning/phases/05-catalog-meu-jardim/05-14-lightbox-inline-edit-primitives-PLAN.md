---
phase: 05-catalog-meu-jardim
plan: 14
type: tdd
wave: 6
depends_on:
  - 05-10
  - 05-11
  - 05-13  # depends on focus-trap@7.1.3 install + the BottomSheet a11y patterns
files_modified:
  - src/shared/ui/lightbox.tsx
  - src/shared/ui/inline-edit-field.tsx
  - tests/unit/shared/ui/lightbox.test.ts
  - tests/unit/shared/ui/inline-edit-field.test.ts
autonomous: true
requirements:
  - UI-08
  - UI-11
decisions:
  pitfall_6_inline_edit_focus_safety: |
    Per RESEARCH Pitfall 6 (lines 1210-1222) — validation alert region MUST
    be aria-live="polite" only; NEVER tabindex="0"; NEVER role="alert" with
    focus stealing. On validation failure, stay in edit mode (do NOT exit);
    re-focus the input on next render. The inline-edit-field test asserts
    NO `tabindex` AND NO `role="alert"` on the alert region as a load-bearing
    UX regression guard.
  lightbox_focus_trap_provider: |
    Reuses `focus-trap@7.1.3` (added by Plan 05-13). NO new dependency.
  lightbox_swipe_deferred: |
    PointerEvent + setPointerCapture swipe-between-photos is DEFERRED to
    a Phase 5+1 hardening pass. Phase 5 ships keyboard navigation
    (ArrowLeft/ArrowRight cycle) + Escape dismiss only. Consumer Plan 05-17
    must expose visible "Próxima foto" / "Foto anterior" buttons inside the
    lightbox so non-keyboard touch users can still cycle entries (per
    UI-SPEC line 297 keyboard navigation requirement combined with PRD §17
    "no hover-dependent interactions").
  inline_edit_save_on_blur_no_debounce: |
    Save fires immediately on blur (no debounce) when draft !== value AND
    validation passes. No double-submit guard needed — blur fires once per
    field exit. Tests verify the call count == 1 per blur event. Consumer
    optimistic mutation hooks (Plan 05-16 useUpdatePlant) handle the
    network roundtrip.
  inline_edit_escape_revert: |
    Escape key reverts draft to last-saved value AND exits edit mode (per
    RESEARCH Pattern 9 line 1006-1010). Verified by unit test I7.
  lucide_react_dependency: |
    `lucide-react` is required by InlineEditField (Pencil icon per
    UI-SPEC § Inline edit pattern). INSTALLED BY PLAN 05-13 alongside
    focus-trap@7.1.3 to consolidate Wave 6 dependency adds and eliminate
    the package.json file conflict between Plans 05-13 and 05-14.
    This plan's Task 2 ASSUMES lucide-react is on disk; if 05-13 hasn't
    landed yet at execution time, fall back to installing it inline (then
    remove the conflict-eliminating change to files_modified).
must_haves:
  truths:
    - "Lightbox renders fullscreen overlay with role='dialog' aria-modal='true' aria-label={alt} containing photo + bottom strip with note + 3 actions (Editar nota, Definir como capa, Excluir)"
    - "Lightbox keyboard handlers: ArrowLeft cycles to previous PhotoEntry; ArrowRight cycles to next; Escape calls onClose; Tab cycles within focus-trap"
    - "Lightbox uses focus-trap@7.1.3 (composed from Plan 05-13's install)"
    - "Lightbox renders 'Próxima'/'Anterior' visible buttons so touch-only users can cycle (swipe deferred per decisions.lightbox_swipe_deferred)"
    - "InlineEditField in read mode renders <button aria-label='Editar {field}'>{value}</button> + 16px Lucide pencil (Calm Slate token)"
    - "InlineEditField click → enters edit mode; rendered <input> autoFocus; on blur calls onSave(draft) IF validation passes AND draft !== value"
    - "InlineEditField Escape key reverts draft to value, exits edit mode, no onSave call"
    - "InlineEditField validation alert region is aria-live='polite' WITHOUT tabindex AND WITHOUT role='alert' (Pitfall 6 mitigation — load-bearing UX regression guard)"
    - "On validation failure, InlineEditField STAYS in edit mode and does NOT call onSave; input re-focuses on next render"
    - "Both primitives use CSS custom properties (var(--canopy), var(--calm-slate), var(--scrim), var(--surface), var(--overdue), var(--hairline)) with hex fallbacks"
  artifacts:
    - path: "src/shared/ui/lightbox.tsx"
      provides: "Lightbox 'use client' component with keyboard navigation + focus-trap"
      min_lines: 110
      contains: "Lightbox"
    - path: "src/shared/ui/inline-edit-field.tsx"
      provides: "InlineEditField 'use client' component (click-to-edit + save-on-blur + Escape-revert + aria-live polite alert)"
      min_lines: 110
      contains: "InlineEditField"
    - path: "tests/unit/shared/ui/lightbox.test.ts"
      provides: "Tests: open=false renders null; open=true renders dialog + 3 action buttons; ArrowLeft/Right cycles index; Escape calls onClose; action buttons fire callbacks"
      min_lines: 80
      contains: "Lightbox"
    - path: "tests/unit/shared/ui/inline-edit-field.test.ts"
      provides: "Tests: read mode + click + blur + Escape + Pitfall 6 a11y guard (NO tabindex AND NO role=alert)"
      min_lines: 100
      contains: "InlineEditField"
  key_links:
    - from: "src/shared/ui/lightbox.tsx"
      to: "focus-trap@7.1.3 (Plan 05-13 install)"
      via: "import + activate on open"
      pattern: "createFocusTrap"
    - from: "src/shared/ui/inline-edit-field.tsx"
      to: "lucide-react Pencil icon"
      via: "import { Pencil } from 'lucide-react'"
      pattern: "Pencil"
    - from: "src/shared/ui/lightbox.tsx"
      to: "Plan 05-17 Photo Journal page"
      via: "named import"
      pattern: "Lightbox"
    - from: "src/shared/ui/inline-edit-field.tsx"
      to: "Plan 05-16 Plant Profile inline edits"
      via: "named import"
      pattern: "InlineEditField"
user_setup: []
---

<objective>
Hand-roll two UI primitives:
1. **Lightbox** at `src/shared/ui/lightbox.tsx` — fullscreen overlay for Photo Journal entry view + edit (D-17, UI-11). Uses focus-trap@7.1.3 (already installed by 05-13). Keyboard nav (ArrowLeft/Right + Escape); swipe is deferred (decisions.lightbox_swipe_deferred).
2. **InlineEditField** at `src/shared/ui/inline-edit-field.tsx` — click-to-edit + save-on-blur per D-11/D-12 + UI-08. Validation alert region uses `aria-live="polite"` ONLY (Pitfall 6 mitigation — load-bearing UX regression guard).

Both ship as TDD: unit tests via @testing-library/react cover keyboard handlers, callback firing, and the load-bearing Pitfall 6 mitigation. Lucide pencil icon used for inline-edit affordance per UI-SPEC. CSS custom properties so Phase 3 design tokens drop in cleanly.

Output: 2 components (~230 lines combined) + 2 unit test files (~180 lines combined). Lucide-react added if absent.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-13-bottom-sheet-primitive-PLAN.md

<interfaces>
```tsx
// src/shared/ui/lightbox.tsx (THIS PLAN)
"use client";

export type LightboxEntry = {
  id: string;
  photoUrl: string;
  thumbnailUrl: string;
  note: string | null;
  alt: string;            // pre-formatted by consumer
  formattedDate: string;  // pt-BR locale, server-formatted
};

export type LightboxProps = {
  entries: LightboxEntry[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  onEditNote?: (entry: LightboxEntry) => void;
  onSetCover?: (entry: LightboxEntry) => void;
  onDelete?: (entry: LightboxEntry) => void;
  closeLabel: string;
  editLabel: string;
  setCoverLabel: string;
  deleteLabel: string;
  prevLabel: string;     // i18n "Foto anterior"
  nextLabel: string;     // i18n "Próxima foto"
};

export function Lightbox(props: LightboxProps): JSX.Element | null;
```

```tsx
// src/shared/ui/inline-edit-field.tsx (THIS PLAN)
"use client";

export type InlineEditFieldProps = {
  label: string;
  value: string;
  onSave: (next: string) => Promise<void> | void;
  validate?: (next: string) => string | null;
  multiline?: boolean;
  disabled?: boolean;
};

export function InlineEditField(props: InlineEditFieldProps): JSX.Element;
```
</interfaces>

<related_files>
- `src/shared/ui/bottom-sheet.tsx` (Plan 05-13) — focus-trap composition pattern; lightbox follows same structure
- `src/messages/pt-BR.json` (Plan 05-10) — `catalog.photoJournal.lightbox.*` keys consumed via props
</related_files>
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: RED — failing tests for InlineEditField (Pitfall 6 a11y guard is load-bearing)</name>
  <files>tests/unit/shared/ui/inline-edit-field.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 9 (lines 944-1033)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pitfall 6 (lines 1210-1222)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-11 + D-12 + Specifics line 236
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Plant Profile cover" lines 266-268
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row UI-08 unit
  </read_first>
  <behavior>
    - I1 read-mode renders button with aria-label="Editar {label}"
    - I2 read-mode contains a Lucide pencil SVG (decorative)
    - I3 empty value renders em-dash placeholder
    - I4 click button enters edit mode; input rendered + value pre-filled
    - I5 blur with changed value calls onSave(draft) once
    - I6 blur with unchanged value does NOT call onSave
    - I7 Escape reverts draft + exits edit mode without saving
    - **I8 LOAD-BEARING (Pitfall 6)**: validation failure stays in edit mode; alert region has aria-live="polite" AND has NO `tabindex` AND has NO `role="alert"`
    - I9 Enter triggers blur path which fires onSave
    - I10 disabled mode does not enter edit mode on click
    - I11 multiline=true renders textarea instead of input
  </behavior>
  <action>
    Create `tests/unit/shared/ui/inline-edit-field.test.ts` with 11 tests per the behavior list. Use `@testing-library/react` (`render`, `screen`, `fireEvent`, `waitFor`). Test I8 explicitly asserts `expect(alertRegion).not.toHaveAttribute("tabindex")` AND `expect(alertRegion).not.toHaveAttribute("role", "alert")` — these are the Pitfall 6 regression guards.

    Run: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts` — MUST FAIL with module-not-found.

    Commit: `git add tests/unit/shared/ui/inline-edit-field.test.ts && git commit -m "test(05-14): add failing tests for InlineEditField + Pitfall 6 a11y guard"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts 2>&amp;1 | grep -qE "(Cannot find module|Failed to resolve)"</automated>
  </verify>
  <done>
    - 11 tests authored
    - I8 explicitly asserts NO tabindex AND NO role="alert" on alert region
    - Vitest fails on module-not-found
    - Commit prefix `test(05-14):`
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: GREEN — implement InlineEditField (Pattern 9 verbatim + Pitfall 6 mitigation)</name>
  <files>src/shared/ui/inline-edit-field.tsx</files>
  <read_first>
    - tests/unit/shared/ui/inline-edit-field.test.ts (Task 1 RED tests)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 9 (lines 956-1033)
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Plant Profile cover" lines 266-268
    - package.json — read-only, verify lucide-react is present (installed by Plan 05-13 Task 1; this task does NOT modify package.json)
  </read_first>
  <action>
    1. Verify lucide-react is on disk: `grep '"lucide-react"' package.json` MUST return a match (Plan 05-13 Task 1 installs it alongside focus-trap to consolidate Wave 6 deps). If grep returns nothing, EITHER halt and have 05-13 land first, OR exceptionally install it inline with the same exact-pin policy and revert the files_modified frontmatter change.

    2. Create `src/shared/ui/inline-edit-field.tsx` (~110 lines). Follow RESEARCH Pattern 9 exactly with these Pitfall 6 mitigations:
       - Alert region: `<p id={errorId} aria-live="polite" className="...">{error}</p>` — NO `role="alert"`, NO `tabindex`
       - On validation failure: `setError(v); return;` — does NOT call `setEditing(false)`
       - useEffect: when `editing && error && inputRef.current` → call `inputRef.current.focus()` (re-focus on next render)
       - Read mode: `<button aria-label={`Editar ${label}`}>` + Lucide Pencil 16px strokeWidth=1.5 with `aria-hidden="true"`
       - Edit mode: `<input>` (or `<textarea>` if multiline) with `autoFocus`, ref forwarded to inputRef
       - Escape: `setDraft(value); setError(null); setEditing(false)`
       - Enter (non-multiline): `(e.currentTarget).blur()` — triggers commitOrFail via onBlur
       - onBlur logic: `commitOrFail` — runs validate; if error, set state and return (stay in edit mode); else if `draft !== value`, await onSave; clear error; exit edit mode
       - Disabled: read-mode button has `disabled` attribute; `enterEdit` early-returns if `disabled`
       - Tailwind: focus-visible:border uses `var(--canopy,#1F4D35)`; error uses `var(--overdue,#A14A2C)`; pencil uses `var(--calm-slate,#5A6358)`

    3. Run tests: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts` — MUST PASS (11 tests).
    4. Run typecheck: `pnpm exec tsc --noEmit` exits 0.
    5. Commit: `git add src/shared/ui/inline-edit-field.tsx && git commit -m "feat(05-14): implement InlineEditField (Pattern 9 + Pitfall 6 a11y guard)"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c 'aria-live="polite"' src/shared/ui/inline-edit-field.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - Component file ~110 lines
    - 11 tests pass (especially I8 — Pitfall 6 a11y guard)
    - tsc --noEmit exits 0
    - `grep -c 'role="alert"' src/shared/ui/inline-edit-field.tsx | grep -v '^#' | grep -c '' == 0` (NO role=alert in code)
    - lucide-react verified present (installed by Plan 05-13 Task 1)
    - Commit prefix `feat(05-14):`
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 3: RED — failing tests for Lightbox (keyboard nav + focus-trap + action callbacks)</name>
  <files>tests/unit/shared/ui/lightbox.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 8 (lines 884-941) — verbatim skeleton
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Lightbox" lines 288-298
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-17 + D-18 + Specifics line 235 — bottom strip actions
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row UI-11 unit
  </read_first>
  <behavior>
    - L1 open=false renders null (queryByRole('dialog') is null)
    - L2 open=true renders <div role="dialog" aria-modal="true" aria-label={current entry alt}>
    - L3 renders <img> with src=entries[startIndex].photoUrl + alt=entries[startIndex].alt
    - L4 renders 3 action buttons (Editar nota / Definir como capa / Excluir) using i18n labels passed as props
    - L5 ArrowRight key → onCloseAction does NOT fire AND aria-label updates to next entry's alt (verifies index advances)
    - L6 ArrowLeft key at index=0 → stays at 0 (boundary; no underflow)
    - L7 ArrowRight key at index=last → stays at last (boundary; no overflow)
    - L8 Escape calls onClose
    - L9 click "Editar nota" calls onEditNote with current entry
    - L10 click "Definir como capa" calls onSetCover with current entry
    - L11 click "Excluir" calls onDelete with current entry
    - L12 click "Próxima" button advances index (read-only mode mobile path)
    - L13 click "Anterior" button at index=0 stays at 0
    - L14 when onEditNote/onSetCover/onDelete ALL omitted (read-only mode), no action buttons render (only Próxima/Anterior + Fechar)
  </behavior>
  <action>
    Create `tests/unit/shared/ui/lightbox.test.ts`:
    ```ts
    import { describe, it, expect, vi } from "vitest";
    import { render, screen, fireEvent } from "@testing-library/react";
    import { Lightbox, type LightboxEntry } from "@shared/ui/lightbox";

    const entries: LightboxEntry[] = [
      { id: "1", photoUrl: "/p1.jpg", thumbnailUrl: "/t1.jpg", note: "primeira", alt: "Foto 1", formattedDate: "12 de abril de 2026" },
      { id: "2", photoUrl: "/p2.jpg", thumbnailUrl: "/t2.jpg", note: null, alt: "Foto 2", formattedDate: "13 de abril de 2026" },
      { id: "3", photoUrl: "/p3.jpg", thumbnailUrl: "/t3.jpg", note: "terceira", alt: "Foto 3", formattedDate: "14 de abril de 2026" },
    ];

    function setup(overrides: Partial<React.ComponentProps<typeof Lightbox>> = {}) {
      const onClose = vi.fn();
      const onEditNote = vi.fn();
      const onSetCover = vi.fn();
      const onDelete = vi.fn();
      const utils = render(
        <Lightbox
          entries={entries}
          startIndex={0}
          open
          onClose={onClose}
          onEditNote={onEditNote}
          onSetCover={onSetCover}
          onDelete={onDelete}
          closeLabel="Fechar"
          editLabel="Editar nota"
          setCoverLabel="Definir como capa"
          deleteLabel="Excluir"
          prevLabel="Foto anterior"
          nextLabel="Próxima foto"
          {...overrides}
        />,
      );
      return { ...utils, onClose, onEditNote, onSetCover, onDelete };
    }

    describe("Lightbox (Pattern 8 + UI-11)", () => {
      it("L1 open=false renders null", () => {
        render(
          <Lightbox entries={entries} startIndex={0} open={false} onClose={vi.fn()} closeLabel="x" editLabel="x" setCoverLabel="x" deleteLabel="x" prevLabel="x" nextLabel="x" />,
        );
        expect(screen.queryByRole("dialog")).toBeNull();
      });

      it("L2 open=true renders dialog with role + aria-modal + aria-label", () => {
        setup();
        const dialog = screen.getByRole("dialog");
        expect(dialog).toHaveAttribute("aria-modal", "true");
        expect(dialog.getAttribute("aria-label")).toBe("Foto 1");
      });

      it("L3 renders <img> with src + alt of current entry", () => {
        setup();
        const img = screen.getByAltText("Foto 1") as HTMLImageElement;
        expect(img.src).toContain("/p1.jpg");
      });

      it("L4 renders 3 action buttons", () => {
        setup();
        expect(screen.getByRole("button", { name: "Editar nota" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Definir como capa" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Excluir" })).toBeInTheDocument();
      });

      it("L5 ArrowRight advances index (aria-label updates)", () => {
        setup();
        const dialog = screen.getByRole("dialog");
        fireEvent.keyDown(window, { key: "ArrowRight" });
        expect(dialog.getAttribute("aria-label")).toBe("Foto 2");
      });

      it("L6 ArrowLeft at index=0 stays at 0 (no underflow)", () => {
        setup();
        const dialog = screen.getByRole("dialog");
        fireEvent.keyDown(window, { key: "ArrowLeft" });
        expect(dialog.getAttribute("aria-label")).toBe("Foto 1");
      });

      it("L7 ArrowRight at last index stays at last (no overflow)", () => {
        setup({ startIndex: 2 });
        const dialog = screen.getByRole("dialog");
        fireEvent.keyDown(window, { key: "ArrowRight" });
        expect(dialog.getAttribute("aria-label")).toBe("Foto 3");
      });

      it("L8 Escape calls onClose", () => {
        const { onClose } = setup();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(onClose).toHaveBeenCalled();
      });

      it("L9 click 'Editar nota' fires callback with current entry", () => {
        const { onEditNote } = setup();
        fireEvent.click(screen.getByRole("button", { name: "Editar nota" }));
        expect(onEditNote).toHaveBeenCalledWith(entries[0]);
      });

      it("L10 click 'Definir como capa' fires callback", () => {
        const { onSetCover } = setup();
        fireEvent.click(screen.getByRole("button", { name: "Definir como capa" }));
        expect(onSetCover).toHaveBeenCalledWith(entries[0]);
      });

      it("L11 click 'Excluir' fires callback", () => {
        const { onDelete } = setup();
        fireEvent.click(screen.getByRole("button", { name: "Excluir" }));
        expect(onDelete).toHaveBeenCalledWith(entries[0]);
      });

      it("L12 click 'Próxima foto' advances index", () => {
        setup();
        fireEvent.click(screen.getByRole("button", { name: "Próxima foto" }));
        expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Foto 2");
      });

      it("L13 click 'Foto anterior' at index=0 stays at 0", () => {
        setup();
        fireEvent.click(screen.getByRole("button", { name: "Foto anterior" }));
        expect(screen.getByRole("dialog").getAttribute("aria-label")).toBe("Foto 1");
      });

      it("L14 read-only mode (no callbacks) hides 3 action buttons; keeps Fechar + Anterior + Próxima", () => {
        render(
          <Lightbox entries={entries} startIndex={0} open onClose={vi.fn()} closeLabel="Fechar" editLabel="Editar nota" setCoverLabel="Definir como capa" deleteLabel="Excluir" prevLabel="Foto anterior" nextLabel="Próxima foto" />,
        );
        expect(screen.queryByRole("button", { name: "Editar nota" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Definir como capa" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Excluir" })).toBeNull();
        expect(screen.getByRole("button", { name: "Fechar" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Foto anterior" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Próxima foto" })).toBeInTheDocument();
      });
    });
    ```

    Run: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts` — MUST FAIL with module-not-found.

    Commit: `git add tests/unit/shared/ui/lightbox.test.ts && git commit -m "test(05-14): add failing tests for Lightbox (keyboard nav + read-only mode)"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts 2>&amp;1 | grep -qE "(Cannot find module|Failed to resolve)"</automated>
  </verify>
  <done>
    - 14 tests authored (L1-L14)
    - Vitest fails on module-not-found
    - Commit prefix `test(05-14):`
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 4: GREEN — implement Lightbox (Pattern 8 + UI-SPEC visual contract)</name>
  <files>src/shared/ui/lightbox.tsx</files>
  <read_first>
    - tests/unit/shared/ui/lightbox.test.ts (Task 3 RED tests)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 8 (lines 884-941)
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Lightbox" lines 288-298
    - src/shared/ui/bottom-sheet.tsx (Plan 05-13) — focus-trap composition pattern to reuse verbatim
  </read_first>
  <action>
    Create `src/shared/ui/lightbox.tsx` (~110 lines):

    ```tsx
    "use client";
    import { createFocusTrap, type FocusTrap } from "focus-trap";
    import { useEffect, useRef, useState } from "react";

    export type LightboxEntry = {
      id: string;
      photoUrl: string;
      thumbnailUrl: string;
      note: string | null;
      alt: string;
      formattedDate: string;
    };

    export type LightboxProps = {
      entries: LightboxEntry[];
      startIndex: number;
      open: boolean;
      onClose: () => void;
      onEditNote?: (entry: LightboxEntry) => void;
      onSetCover?: (entry: LightboxEntry) => void;
      onDelete?: (entry: LightboxEntry) => void;
      closeLabel: string;
      editLabel: string;
      setCoverLabel: string;
      deleteLabel: string;
      prevLabel: string;
      nextLabel: string;
    };

    export function Lightbox({
      entries,
      startIndex,
      open,
      onClose,
      onEditNote,
      onSetCover,
      onDelete,
      closeLabel,
      editLabel,
      setCoverLabel,
      deleteLabel,
      prevLabel,
      nextLabel,
    }: LightboxProps): React.JSX.Element | null {
      const containerRef = useRef<HTMLDivElement | null>(null);
      const trapRef = useRef<FocusTrap | null>(null);
      const [index, setIndex] = useState(startIndex);

      useEffect(() => {
        setIndex(startIndex);
      }, [startIndex, open]);

      useEffect(() => {
        if (!open || !containerRef.current) return;
        trapRef.current = createFocusTrap(containerRef.current, {
          onDeactivate: onClose,
          escapeDeactivates: true,
          clickOutsideDeactivates: false,
          returnFocusOnDeactivate: true,
        });
        try {
          trapRef.current.activate();
        } catch {
          // jsdom may not provide focus management
        }
        return () => {
          try {
            trapRef.current?.deactivate();
          } catch {
            // no-op
          }
        };
      }, [open, onClose]);

      useEffect(() => {
        if (!open) return;
        const handler = (e: KeyboardEvent) => {
          if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
          if (e.key === "ArrowRight") setIndex((i) => Math.min(entries.length - 1, i + 1));
          if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
      }, [open, entries.length, onClose]);

      if (!open || entries.length === 0) return null;
      const entry = entries[Math.min(Math.max(index, 0), entries.length - 1)];
      const showActions = Boolean(onEditNote || onSetCover || onDelete);

      return (
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-label={entry.alt}
          className="fixed inset-0 z-50 flex flex-col bg-[var(--scrim,rgba(20,52,36,0.5))]"
        >
          {/* Top bar with Fechar */}
          <div className="flex justify-end p-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md bg-[var(--surface,#FFFDF7)] px-3 py-2 text-sm font-semibold text-[var(--canopy,#1F4D35)]"
            >
              {closeLabel}
            </button>
          </div>

          {/* Photo + nav buttons */}
          <div className="flex flex-1 items-center justify-center px-4">
            <button
              type="button"
              onClick={() => setIndex((i) => Math.max(0, i - 1))}
              disabled={index === 0}
              aria-label={prevLabel}
              className="mr-2 rounded-full bg-[var(--surface,#FFFDF7)]/80 p-3 disabled:opacity-30"
            >
              {prevLabel}
            </button>
            <img
              src={entry.photoUrl}
              alt={entry.alt}
              className="max-h-[70vh] max-w-full object-contain"
            />
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(entries.length - 1, i + 1))}
              disabled={index === entries.length - 1}
              aria-label={nextLabel}
              className="ml-2 rounded-full bg-[var(--surface,#FFFDF7)]/80 p-3 disabled:opacity-30"
            >
              {nextLabel}
            </button>
          </div>

          {/* Bottom strip — note + actions */}
          <div className="bg-[var(--surface,#FFFDF7)] p-4">
            {entry.note && (
              <p className="mb-3 text-sm text-[var(--calm-slate,#5A6358)]">{entry.note}</p>
            )}
            <p className="mb-3 text-xs text-[var(--calm-slate,#5A6358)]">{entry.formattedDate}</p>
            {showActions && (
              <div className="flex flex-wrap gap-3">
                {onEditNote && (
                  <button
                    type="button"
                    onClick={() => onEditNote(entry)}
                    className="text-sm font-semibold text-[var(--canopy,#1F4D35)]"
                  >
                    {editLabel}
                  </button>
                )}
                {onSetCover && (
                  <button
                    type="button"
                    onClick={() => onSetCover(entry)}
                    className="text-sm font-semibold text-[var(--canopy,#1F4D35)]"
                  >
                    {setCoverLabel}
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => onDelete(entry)}
                    className="text-sm font-semibold text-[var(--overdue,#A14A2C)]"
                  >
                    {deleteLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }
    ```

    Run tests: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts` — MUST PASS (14 tests).
    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/shared/ui/lightbox.tsx && git commit -m "feat(05-14): hand-roll Lightbox per Pattern 8 + UI-SPEC § Lightbox"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c "createFocusTrap" src/shared/ui/lightbox.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - Component file ~110+ lines
    - 14 tests pass
    - tsc --noEmit exits 0
    - role="dialog" + aria-modal + aria-label + createFocusTrap all present
    - Read-only mode (no callbacks) hides 3 action buttons but keeps Fechar/Anterior/Próxima
    - Commit prefix `feat(05-14):`
  </done>
</task>

</tasks>

<threat_model>none — pure interaction primitives with no user-data flow on the network. Both components render consumer-passed strings via React JSX text nodes (auto-escaped). The Lightbox renders an `<img src={photoUrl}>` — `photoUrl` comes from authenticated API responses (Phase 5a 05-08 GET /api/v1/plants/:id/photos returned data, ownership-checked server-side). InlineEditField surfaces a `value` from server data and writes back via consumer-provided `onSave` (Phase 5a 05-09 PATCH endpoints handle validation + auth). No threat is local to these primitives.

(Note: consumer plans 05-16 + 05-17 carry the threat models for the data flowing through these components.)
</threat_model>

<verification>
- `pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts` exits 0 (11 tests)
- `pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts` exits 0 (14 tests)
- `pnpm exec tsc --noEmit` exits 0
- `grep -c 'aria-live="polite"' src/shared/ui/inline-edit-field.tsx` returns ≥ 1
- Pitfall 6 regression guard: `grep -E 'role="alert"' src/shared/ui/inline-edit-field.tsx | grep -v '^//' | grep -v '^\s*\*' | grep -c ''` returns 0 (no role=alert in code)
- Pitfall 6 regression guard: `grep -E 'tabIndex' src/shared/ui/inline-edit-field.tsx | grep -v '^//' | grep -c ''` returns 0
- `grep -c "createFocusTrap" src/shared/ui/lightbox.tsx` returns ≥ 1
- `grep -c 'aria-modal="true"' src/shared/ui/lightbox.tsx` returns ≥ 1
- `grep -c 'lucide-react' package.json` returns ≥ 1
</verification>

<success_criteria>
- InlineEditField implements Pattern 9 with Pitfall 6 mitigation (NO role=alert, NO tabindex on alert region)
- Lightbox implements Pattern 8 with keyboard cycle + Escape + 3 action callbacks + read-only-mode hide-actions branch
- 25 unit tests green (11 inline-edit + 14 lightbox)
- Lucide-react installed at exact pin
- Both primitives use CSS custom properties so Phase 3 design tokens drop in
- Commits prefixed `test(05-14):` (RED), `feat(05-14):` (GREEN)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-14-SUMMARY.md` summarizing:
- Final lucide-react version installed
- Confirmation Pitfall 6 a11y guards are in place (verified by grep + test I8)
- Lightbox swipe deferral note for Plan 05-17 consumer (must expose Próxima/Anterior buttons; cannot rely on swipe)
- Read-only-mode behavior: passing zero of `onEditNote`/`onSetCover`/`onDelete` hides the 3 action buttons; consumers (Plan 05-16/05-17) toggle this based on `useSubscription()` status
- Number of unit tests landed (25)
</output>
</content>
</invoke>