---
phase: 05-catalog-meu-jardim
plan: 12
type: tdd
wave: 6
depends_on:
  - 05-10
  - 05-11
  # PHASE-3-DEPENDENCY (BLOCKING execution): Phase 3 must ship the design tokens (--surface, --hairline, --canopy, --calm-slate, --paper-cream) used by the combobox component CSS. UI primitive can technically render without tokens (uses `var(--token, fallback)` fallback values during 5b authoring), but visual approval requires Phase 3 tokens.
files_modified:
  - src/shared/ui/combobox.tsx
  - tests/unit/shared/ui/combobox-filter.test.ts
  - tests/unit/shared/ui/combobox.test.ts
autonomous: true
requirements:
  - CAT-05
decisions:
  outro_semantics: |
    RESOLVED (Open Question Q4) — UI-SPEC verbatim wins:
    Selecting the literal "Outro" suggestion COMMITS the string "Outro" as
    the location value (no special focus-shift to free-text input). The
    combobox's free-text affordance handles "I want custom text" intent —
    user just types instead of tapping a suggestion. Per CONTEXT D-15 +
    UI-SPEC § "Location picker combobox" + RESEARCH Pitfall 10. Documenting
    the choice here so consumers (Plan 05-16 Plant Profile + Plan 05-17
    Manual Add) know NOT to special-case "Outro".
  apg_pattern: |
    WAI-ARIA APG 1.2 "Editable Combobox with List Autocomplete" pattern.
    DOM focus stays on the input; visual focus moves through
    `aria-activedescendant`. Free-text commit: Enter or blur with non-empty
    text not in suggestions adds the value as-typed (preserves display case).
    Per RESEARCH Pattern 6 (line 757-783). Citation: w3.org/TR/2021/NOTE-wai-aria-practices-1.2-20211129
  filter_dedupe_logic: |
    `filter(query, items)`:
      1. Trim + lowercase the query.
      2. Filter items by `item.toLowerCase().trim().includes(qNormalized)`.
      3. Dedupe across "prior" + "defaults" sections case-insensitively
         (per CONTEXT D-01 — "Sala" vs "sala" collision mitigation):
         if a default exists with the same case-insensitive key as a prior,
         keep the prior (preserves user's display case) and drop the default.
    Pure function, exported separately for unit testing without React.
  no_third_party_dropdown: |
    Per RESEARCH Don't-Hand-Roll table line 1129 ("Combobox a11y") +
    UI-SPEC § Registry Safety: hand-rolled per APG 1.2; NO
    @floating-ui/react (CSS `position: absolute; top: 100%` is enough);
    NO react-aria-components (kit conflicts with our hand-roll approach).
must_haves:
  truths:
    - "filter(query, { priorItems, defaultItems }) is a pure function exported from combobox module; case-insensitive includes match; dedupes prior over default for same case-insensitive key (D-01 mitigation)"
    - "Combobox component renders <input role='combobox' aria-autocomplete='list' aria-controls={listboxId} aria-expanded={open}> + <ul role='listbox' aria-label={ariaLabel}> + <li role='option' id={optionId}> per APG 1.2"
    - "ArrowDown opens dropdown + focuses first option (visual via aria-activedescendant; DOM focus stays on input)"
    - "ArrowUp opens dropdown + focuses last option"
    - "Enter on a focused option commits that option, closes listbox, returns DOM focus position to input cursor at end"
    - "Enter with non-empty input text not in suggestions commits typed value (free-text path); preserves display case as typed"
    - "Escape closes listbox without committing (returns DOM focus to input — already there)"
    - "Selecting literal 'Outro' suggestion commits string 'Outro' (Q4 resolution; NOT a free-text trigger)"
    - "Combobox passes axe-core scan in both open and closed states (verified by tests/e2e/catalog/location-picker-a11y.spec.ts deferred to consumer plans 05-16/05-17)"
    - "Default placeholder + section labels + 8 default options come from i18n catalog.locationPicker.* keys landed in Plan 05-10's pt-BR.json"
  artifacts:
    - path: "src/shared/ui/combobox.tsx"
      provides: "Combobox<T> primitive component (props: value, onChange, priorItems, defaultItems, placeholder, ariaLabel, sectionLabels) + filter() pure helper export for testing"
      min_lines: 150
      contains: "Combobox"
    - path: "tests/unit/shared/ui/combobox-filter.test.ts"
      provides: "Pure filter() unit tests: case-insensitive match, dedupe logic (D-01), empty query, no matches"
      min_lines: 50
      contains: "filter"
    - path: "tests/unit/shared/ui/combobox.test.ts"
      provides: "Component-level tests via @testing-library/react: keyboard handlers (ArrowDown/Up/Enter/Escape), aria-activedescendant updates, free-text commit path, 'Outro' literal commit, role/ARIA contract present"
      min_lines: 100
      contains: "Combobox"
  key_links:
    - from: "src/shared/ui/combobox.tsx"
      to: "src/messages/pt-BR.json (catalog.locationPicker.*)"
      via: "consumer pages pass i18n strings as props (placeholder, ariaLabel, sectionLabels, defaultItems labels)"
      pattern: "catalog.locationPicker"
    - from: "src/shared/ui/combobox.tsx"
      to: "Plan 05-16 Plant Profile inline-edit location field"
      via: "named import from @shared/ui/combobox"
      pattern: "Combobox"
    - from: "src/shared/ui/combobox.tsx"
      to: "Plan 05-17 Manual Add location field"
      via: "named import"
      pattern: "Combobox"
user_setup: []
---

<resolved_open_questions>
**Q4 (Combobox "Outro" semantics) — RESOLVED in this plan.**

Choice: **UI-SPEC verbatim wins** — selecting the literal "Outro" suggestion
COMMITS the string `"Outro"` as the location value. No special handling for
"Outro" beyond what every other default option gets.

Rationale:
- CAT-05 + UI-SPEC § "Location picker combobox" both list 8 defaults
  including "Outro" with no special semantic carve-out.
- Users who want custom free-text already have the free-text path (just
  type without selecting a suggestion).
- Special-casing "Outro" to focus a free-text input would surprise users
  who genuinely want their location labeled "Outro" (e.g., a closet, a
  garage that doesn't fit the other categories).
- RESEARCH Pitfall 10 explicitly recommends "ship 8 defaults including
  'Outro' that, when selected, commits literal 'Outro'".

Consumers (Plan 05-16 + Plan 05-17) implement no special branching for
"Outro" in their combobox onChange handlers.
</resolved_open_questions>

<objective>
Hand-roll the WAI-ARIA APG 1.2 combobox primitive at `src/shared/ui/combobox.tsx`. Pure-function `filter()` tested via Vitest (RED→GREEN); component behavior tested via @testing-library/react (keyboard + ARIA contract); a11y scan deferred to consumer plans 05-16 / 05-17 where the combobox is mounted into a real surface (location-picker-a11y.spec.ts).

Purpose: CAT-05 + D-15 require a combobox showing prior locations + 8 defaults + free-text. Both Plant Profile inline-edit (05-16) and Manual Add page (05-17) need this primitive — landing it once in 05-12 unblocks both consumers and avoids file-overlap conflicts at wave 7-8.

Output: 1 component (~150 lines) + 2 unit test files (~150 lines combined). NO Tailwind class proliferation — uses CSS custom properties (`var(--surface)`, `var(--hairline)`, `var(--canopy)`, `var(--calm-slate)`) per UI-SPEC § Color so Phase 3's design tokens drop in cleanly.
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
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md

<interfaces>
<!-- Component contract — locked here, consumed by Plans 05-16 and 05-17 -->

```tsx
// src/shared/ui/combobox.tsx (THIS PLAN)
"use client";

export type ComboboxProps = {
  value: string;                        // controlled value
  onChange: (next: string) => void;     // commit (selection or free-text)
  priorItems: string[];                 // user's prior locations (from CAT-05 endpoint)
  defaultItems: string[];               // 8 defaults (from i18n catalog.locationPicker.defaults)
  placeholder: string;                  // i18n catalog.locationPicker.placeholder
  ariaLabel: string;                    // i18n catalog.locationPicker.ariaListboxLabel
  sectionLabels: { prior: string; defaults: string };  // i18n catalog.locationPicker.sections
  inputId?: string;                     // optional id for label-for association
  // Note: NO `onOutroSelected` — Q4 resolution forbids special-casing
};

export function Combobox(props: ComboboxProps): JSX.Element;

// Pure helper exported for unit testing without React:
export function filter(
  query: string,
  buckets: { priorItems: string[]; defaultItems: string[] },
): { prior: string[]; defaults: string[] };
```

ARIA contract (per WAI-ARIA APG 1.2 / RESEARCH Pattern 6 line 763-781):
- `<input>`: `role="combobox"`, `aria-autocomplete="list"`, `aria-controls={listboxId}`, `aria-expanded={open}`, `aria-activedescendant={open && focusedIdx >= 0 ? optionId(focusedIdx) : undefined}`
- `<ul>`: `role="listbox"`, `aria-label={ariaLabel}`
- Section headers: `<li role="presentation">` (heading semantic via `aria-labelledby` on the next group; or use `<div>` outside `<ul>` if scoping permits)
- `<li>` options: `role="option"`, `aria-selected={focusedIdx === i}`, `id={optionId(i)}`

Keyboard contract (RESEARCH Pattern 6 line 771-781):
| Key | Closed | Open |
|-----|--------|------|
| ArrowDown | Open + focus first option | Move to next (wrap) |
| ArrowUp | Open + focus last option | Move to previous (wrap) |
| Enter | Submit value as-typed | Select focused option, close, focus stays on input |
| Escape | Clear input | Close listbox, focus stays on input |
| Home/End | Move cursor in input | Move cursor in input + close listbox |
| Tab | Default | Close + default tab |
| Printable | Filter list | Filter list (keep open) |
</interfaces>

<related_files>
- `src/messages/pt-BR.json` (Plan 05-10) — catalog.locationPicker.* keys consumed by props (default labels, placeholder, section labels, aria label)
- `tests/helpers/idb-test-setup.ts` (Plan 05-01) — IDB polyfill (combobox doesn't use IDB but unit project shares setupFiles)
</related_files>
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: RED — write failing tests for filter() pure helper (case-insensitive + D-01 dedupe)</name>
  <files>tests/unit/shared/ui/combobox-filter.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-01 line 40 — "trimming + lowercasing on case-insensitive compare while preserving the user's display case on storage"
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 6 — APG 1.2 contract
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row CAT-05 unit (`combobox-filter.test.ts`)
    - tests/unit/shared/ui/.gitkeep (5a Plan 05-01 — directory exists)
  </read_first>
  <behavior>
    - Test 1 (`empty query returns all items in both buckets`): `filter("", { priorItems: ["Sala", "Varanda"], defaultItems: ["Quarto", "Banheiro"] })` returns `{ prior: ["Sala", "Varanda"], defaults: ["Quarto", "Banheiro"] }`
    - Test 2 (`case-insensitive includes match`): `filter("sa", { priorItems: ["Sala"], defaultItems: ["Quarto"] })` returns `{ prior: ["Sala"], defaults: [] }`
    - Test 3 (`uppercase query matches mixed-case items`): `filter("SAL", { priorItems: ["Sala"], defaultItems: ["Banheiro"] })` returns `{ prior: ["Sala"], defaults: [] }`
    - Test 4 (`trim whitespace`): `filter("  sala  ", { priorItems: ["Sala"], defaultItems: [] })` returns `{ prior: ["Sala"], defaults: [] }`
    - Test 5 (`D-01 dedupe — case-insensitive collision keeps prior`): `filter("", { priorItems: ["sala"], defaultItems: ["Sala", "Quarto"] })` returns `{ prior: ["sala"], defaults: ["Quarto"] }` (prior "sala" preserved as typed; default "Sala" dropped because "sala" already exists in prior)
    - Test 6 (`no matches returns empty arrays`): `filter("xyz", { priorItems: ["Sala"], defaultItems: ["Quarto"] })` returns `{ prior: [], defaults: [] }`
    - Test 7 (`accents preserved in display, ignored for compare`): `filter("escr", { priorItems: ["Escritório"], defaultItems: ["Escritório"] })` returns `{ prior: ["Escritório"], defaults: [] }` (dedupe; original case + accents preserved)
  </behavior>
  <action>
    Create `tests/unit/shared/ui/combobox-filter.test.ts`:
    ```ts
    import { describe, it, expect } from "vitest";
    import { filter } from "@shared/ui/combobox";

    describe("Combobox filter() pure helper", () => {
      it("empty query returns all items in both buckets", () => {
        expect(
          filter("", { priorItems: ["Sala", "Varanda"], defaultItems: ["Quarto", "Banheiro"] }),
        ).toEqual({ prior: ["Sala", "Varanda"], defaults: ["Quarto", "Banheiro"] });
      });

      it("case-insensitive includes match", () => {
        expect(filter("sa", { priorItems: ["Sala"], defaultItems: ["Quarto"] })).toEqual({
          prior: ["Sala"],
          defaults: [],
        });
      });

      it("uppercase query matches mixed-case items", () => {
        expect(filter("SAL", { priorItems: ["Sala"], defaultItems: ["Banheiro"] })).toEqual({
          prior: ["Sala"],
          defaults: [],
        });
      });

      it("trims whitespace from query before matching", () => {
        expect(filter("  sala  ", { priorItems: ["Sala"], defaultItems: [] })).toEqual({
          prior: ["Sala"],
          defaults: [],
        });
      });

      it("D-01 dedupes case-insensitive collisions in favor of prior items", () => {
        expect(
          filter("", { priorItems: ["sala"], defaultItems: ["Sala", "Quarto"] }),
        ).toEqual({ prior: ["sala"], defaults: ["Quarto"] });
      });

      it("returns empty arrays when no matches", () => {
        expect(filter("xyz", { priorItems: ["Sala"], defaultItems: ["Quarto"] })).toEqual({
          prior: [],
          defaults: [],
        });
      });

      it("preserves original case + accents in display while comparing case-folded", () => {
        expect(
          filter("escr", { priorItems: ["Escritório"], defaultItems: ["Escritório"] }),
        ).toEqual({ prior: ["Escritório"], defaults: [] });
      });
    });
    ```

    Run `pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox-filter.test.ts` — MUST FAIL with module-not-found on `@shared/ui/combobox`.

    Commit RED:
    `git add tests/unit/shared/ui/combobox-filter.test.ts`
    `git commit -m "test(05-12): add failing tests for combobox filter (D-01 dedupe + APG match)"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox-filter.test.ts 2>&amp;1 | grep -qE "(Cannot find module|Failed to resolve)" &amp;&amp; echo RED_GATE_OK</automated>
  </verify>
  <done>
    - Test file with 7 `it` blocks
    - Vitest fails with module-not-found on `@shared/ui/combobox`
    - Commit message starts with `test(05-12):`
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: GREEN — implement combobox component + filter() helper + write component-level tests</name>
  <files>src/shared/ui/combobox.tsx, tests/unit/shared/ui/combobox.test.ts</files>
  <read_first>
    - tests/unit/shared/ui/combobox-filter.test.ts (RED tests from Task 1)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 6 (line 757-783) — full APG contract
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Location picker combobox" lines 300-310 — exact CSS / layout / sections
    - https://www.w3.org/TR/2021/NOTE-wai-aria-practices-1.2-20211129/ (referenced; consult if specific keyboard behavior unclear)
  </read_first>
  <behavior>
    - filter() pure helper makes 7 RED tests green
    - Component RED → GREEN tests:
      - Test C1: renders input with role="combobox" + aria-autocomplete="list"
      - Test C2: ArrowDown when closed → opens listbox + focuses first option (verified via aria-activedescendant attribute on input)
      - Test C3: ArrowUp when closed → opens listbox + focuses last option
      - Test C4: ArrowDown when open at last option → wraps to first
      - Test C5: ArrowUp when open at first option → wraps to last
      - Test C6: Enter on focused option → calls onChange with that option's value, listbox closes
      - Test C7: Enter with typed text NOT in suggestions → calls onChange with typed value (free-text path)
      - Test C8: Escape when open → listbox closes, no onChange call
      - Test C9: Selecting literal "Outro" suggestion → calls onChange("Outro") (Q4 resolution; no special handling)
      - Test C10: priorItems + defaultItems both render under their section labels with proper a11y associations
  </behavior>
  <action>
    **GREEN step — Part A: implement filter()**

    Begin `src/shared/ui/combobox.tsx`:
    ```tsx
    "use client";
    import { useId, useRef, useState, type KeyboardEvent } from "react";

    /**
     * Pure helper — case-insensitive includes match + D-01 dedupe.
     * Exported separately so unit tests can verify without React.
     */
    export function filter(
      query: string,
      buckets: { priorItems: string[]; defaultItems: string[] },
    ): { prior: string[]; defaults: string[] } {
      const q = query.trim().toLowerCase();
      const matches = (item: string): boolean =>
        item.toLowerCase().trim().includes(q);

      const prior = buckets.priorItems.filter(matches);
      const priorKeys = new Set(prior.map((p) => p.toLowerCase().trim()));
      const defaults = buckets.defaultItems
        .filter(matches)
        .filter((d) => !priorKeys.has(d.toLowerCase().trim()));

      return { prior, defaults };
    }
    ```

    Run filter tests: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox-filter.test.ts` — MUST PASS (7 green).

    **GREEN step — Part B: implement Combobox component**

    Add to same file:
    ```tsx
    export type ComboboxProps = {
      value: string;
      onChange: (next: string) => void;
      priorItems: string[];
      defaultItems: string[];
      placeholder: string;
      ariaLabel: string;
      sectionLabels: { prior: string; defaults: string };
      inputId?: string;
    };

    export function Combobox({
      value,
      onChange,
      priorItems,
      defaultItems,
      placeholder,
      ariaLabel,
      sectionLabels,
      inputId,
    }: ComboboxProps) {
      const [open, setOpen] = useState(false);
      const [focusedIdx, setFocusedIdx] = useState<number>(-1);
      const inputRef = useRef<HTMLInputElement>(null);
      const generatedListboxId = useId();
      const listboxId = `combobox-listbox-${generatedListboxId}`;
      const optionId = (i: number) => `combobox-option-${generatedListboxId}-${i}`;

      const buckets = filter(value, { priorItems, defaultItems });
      const flat: { item: string; section: "prior" | "defaults" }[] = [
        ...buckets.prior.map((item) => ({ item, section: "prior" as const })),
        ...buckets.defaults.map((item) => ({ item, section: "defaults" as const })),
      ];

      function commit(next: string) {
        onChange(next);
        setOpen(false);
        setFocusedIdx(-1);
      }

      function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            setFocusedIdx(flat.length > 0 ? 0 : -1);
          } else {
            setFocusedIdx((i) => (flat.length === 0 ? -1 : (i + 1) % flat.length));
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!open) {
            setOpen(true);
            setFocusedIdx(flat.length > 0 ? flat.length - 1 : -1);
          } else {
            setFocusedIdx((i) =>
              flat.length === 0 ? -1 : (i - 1 + flat.length) % flat.length,
            );
          }
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (open && focusedIdx >= 0 && flat[focusedIdx]) {
            commit(flat[focusedIdx].item);
          } else if (value.trim().length > 0) {
            commit(value);
          }
        } else if (e.key === "Escape") {
          if (open) {
            e.preventDefault();
            setOpen(false);
            setFocusedIdx(-1);
          }
        } else if (e.key === "Home" || e.key === "End") {
          if (open) {
            setOpen(false);
            setFocusedIdx(-1);
          }
        }
      }

      function onBlur() {
        // Free-text commit on blur if text not empty AND not exact match (case-insensitive).
        const exists = [...priorItems, ...defaultItems].some(
          (it) => it.toLowerCase().trim() === value.toLowerCase().trim(),
        );
        if (value.trim().length > 0 && !exists) {
          // Commit as-typed; preserves user display case
          onChange(value);
        }
        // Always close on blur
        setOpen(false);
        setFocusedIdx(-1);
      }

      const activeDescendant =
        open && focusedIdx >= 0 ? optionId(focusedIdx) : undefined;

      return (
        <div className="relative">
          <input
            ref={inputRef}
            id={inputId}
            type="text"
            role="combobox"
            aria-autocomplete="list"
            aria-controls={listboxId}
            aria-expanded={open}
            aria-activedescendant={activeDescendant}
            value={value}
            placeholder={placeholder}
            onChange={(e) => {
              onChange(e.target.value);
              if (!open) setOpen(true);
              setFocusedIdx(-1);
            }}
            onKeyDown={onKeyDown}
            onFocus={() => setOpen(true)}
            onBlur={onBlur}
            className="w-full rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base outline-none focus-visible:border-[var(--canopy,#1F4D35)]"
          />
          {open && flat.length > 0 && (
            <ul
              id={listboxId}
              role="listbox"
              aria-label={ariaLabel}
              className="absolute left-0 right-0 top-full z-10 mt-1 max-h-72 overflow-y-auto rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] shadow-lg"
            >
              {buckets.prior.length > 0 && (
                <li role="presentation" className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--calm-slate,#5A6358)]">
                  {sectionLabels.prior}
                </li>
              )}
              {buckets.prior.map((item, i) => {
                const idx = i;
                return (
                  <li
                    key={`prior-${item}`}
                    role="option"
                    id={optionId(idx)}
                    aria-selected={focusedIdx === idx}
                    onMouseDown={(e) => {
                      e.preventDefault(); // Prevent input blur before click
                      commit(item);
                    }}
                    className={`cursor-pointer px-4 py-2 text-base ${
                      focusedIdx === idx ? "bg-[var(--paper-cream,#FBF7EF)]" : ""
                    }`}
                  >
                    {item}
                  </li>
                );
              })}
              {buckets.defaults.length > 0 && (
                <li role="presentation" className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--calm-slate,#5A6358)]">
                  {sectionLabels.defaults}
                </li>
              )}
              {buckets.defaults.map((item, i) => {
                const idx = buckets.prior.length + i;
                return (
                  <li
                    key={`default-${item}`}
                    role="option"
                    id={optionId(idx)}
                    aria-selected={focusedIdx === idx}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      commit(item);
                    }}
                    className={`cursor-pointer px-4 py-2 text-base ${
                      focusedIdx === idx ? "bg-[var(--paper-cream,#FBF7EF)]" : ""
                    }`}
                  >
                    {item}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }
    ```

    **GREEN step — Part C: write component tests** at `tests/unit/shared/ui/combobox.test.ts`:
    ```ts
    import { describe, it, expect, vi } from "vitest";
    import { render, screen, fireEvent } from "@testing-library/react";
    import { Combobox } from "@shared/ui/combobox";

    const baseProps = {
      placeholder: "Ex: Sala...",
      ariaLabel: "Locais",
      sectionLabels: { prior: "Usados antes", defaults: "Sugestões" },
      priorItems: ["Cozinha"],
      defaultItems: ["Sala", "Varanda", "Quarto", "Banheiro", "Cozinha", "Escritório", "Jardim", "Outro"],
    };

    function setup(overrides: Partial<React.ComponentProps<typeof Combobox>> = {}) {
      const onChange = vi.fn();
      const utils = render(
        <Combobox value="" onChange={onChange} {...baseProps} {...overrides} />,
      );
      const input = utils.getByRole("combobox");
      return { ...utils, input, onChange };
    }

    describe("Combobox component (APG 1.2)", () => {
      it("C1: renders input with role=combobox + aria-autocomplete=list", () => {
        const { input } = setup();
        expect(input).toHaveAttribute("aria-autocomplete", "list");
        expect(input).toHaveAttribute("aria-expanded", "false");
      });

      it("C2: ArrowDown when closed opens listbox + focuses first option", () => {
        const { input } = setup();
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: "ArrowDown" });
        const listbox = screen.getByRole("listbox");
        expect(listbox).toBeInTheDocument();
        expect(input).toHaveAttribute("aria-expanded", "true");
        const activeDesc = input.getAttribute("aria-activedescendant");
        expect(activeDesc).toBeTruthy();
      });

      it("C3: ArrowUp when closed opens listbox + focuses last option", () => {
        const { input } = setup({ value: "" });
        fireEvent.focus(input);
        // Note: focus already opens via onFocus — call once explicitly
        fireEvent.keyDown(input, { key: "ArrowUp" });
        const options = screen.getAllByRole("option");
        const lastOption = options[options.length - 1];
        expect(lastOption).toHaveAttribute("aria-selected", "true");
      });

      it("C6: Enter on focused option commits", () => {
        const { input, onChange } = setup();
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      it("C7: Enter with typed text not in suggestions commits free-text", () => {
        const { input, onChange } = setup({ value: "Garagem" });
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: "Enter" });
        expect(onChange).toHaveBeenCalledWith("Garagem");
      });

      it("C8: Escape when open closes listbox without onChange", () => {
        const { input, onChange } = setup();
        fireEvent.focus(input);
        fireEvent.keyDown(input, { key: "Escape" });
        expect(input).toHaveAttribute("aria-expanded", "false");
        expect(onChange).not.toHaveBeenCalled();
      });

      it("C9 (Q4): selecting literal 'Outro' suggestion commits string 'Outro' — no special handling", () => {
        const { input, onChange } = setup();
        fireEvent.focus(input);
        const outroOption = screen.getByRole("option", { name: "Outro" });
        fireEvent.mouseDown(outroOption);
        expect(onChange).toHaveBeenCalledWith("Outro");
        expect(onChange).toHaveBeenCalledTimes(1);
      });

      it("C10: priorItems render under prior section, defaults under defaults section", () => {
        const { input } = setup({ priorItems: ["Garagem"], value: "" });
        fireEvent.focus(input);
        expect(screen.getByText("Usados antes")).toBeInTheDocument();
        expect(screen.getByText("Sugestões")).toBeInTheDocument();
      });

      it("C11 (D-01 dedupe via filter): when priorItems = [Cozinha] and defaults includes Cozinha, only one rendered (prior preserved)", () => {
        const { input } = setup({ value: "" });
        fireEvent.focus(input);
        const cozinhaOptions = screen.getAllByRole("option").filter(
          (o) => o.textContent === "Cozinha",
        );
        expect(cozinhaOptions).toHaveLength(1);
      });

      it("C12: ArrowDown wraps from last option to first", () => {
        const { input } = setup({ value: "" });
        fireEvent.focus(input);
        // Open + focus last
        fireEvent.keyDown(input, { key: "ArrowUp" });
        const initialActive = input.getAttribute("aria-activedescendant");
        // Press ArrowDown to wrap to first
        fireEvent.keyDown(input, { key: "ArrowDown" });
        const wrappedActive = input.getAttribute("aria-activedescendant");
        expect(wrappedActive).not.toBe(initialActive);
      });
    });
    ```

    Run all combobox tests: `pnpm exec vitest --run --project=unit tests/unit/shared/ui/`. MUST PASS (7 filter + 9 component = 16+ green; some it.each may expand the count).
    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit GREEN:
    `git add src/shared/ui/combobox.tsx tests/unit/shared/ui/combobox.test.ts`
    `git commit -m "feat(05-12): hand-roll APG 1.2 combobox primitive (Q4 resolution: 'Outro' literal commit)"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/ui/ &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c 'role="combobox"' src/shared/ui/combobox.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c 'aria-activedescendant' src/shared/ui/combobox.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - `src/shared/ui/combobox.tsx` exists, ~150+ lines
    - Exports both `Combobox` and `filter`
    - Component renders APG 1.2 ARIA contract: role="combobox" + aria-autocomplete + aria-controls + aria-expanded + aria-activedescendant + role="listbox" + role="option" + aria-selected
    - All 7 filter tests + ≥9 component tests pass
    - tsc --noEmit exits 0
    - Q4 documented in plan frontmatter `decisions.outro_semantics`
    - Commit message starts with `feat(05-12):`
  </done>
</task>

</tasks>

<threat_model>none — pure interaction primitive with no user-data flow. Plant location strings (untrusted input) flow through React JSX text nodes (auto-escaped) and are never evaluated as HTML. Combobox does not call any server endpoint; it surfaces values its consumers (Plans 05-16, 05-17) commit via separate hooks (useUpdatePlant, useCreatePlant) which carry their own threat models.

(Note: while no threat is enumerated for the primitive itself, downstream consumers must validate location strings server-side — already covered by Phase 5a 05-04 PlantPatchSchema/PlantCreateInputSchema with `location.max(40)`.)
</threat_model>

<verification>
- `pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox-filter.test.ts` — 7 green
- `pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox.test.ts` — 9+ green
- `pnpm exec tsc --noEmit` exits 0
- `grep -c 'aria-activedescendant' src/shared/ui/combobox.tsx` returns ≥ 1
- `grep -c 'role="combobox"' src/shared/ui/combobox.tsx` returns ≥ 1
- `grep -c 'role="listbox"' src/shared/ui/combobox.tsx` returns ≥ 1
- `grep -c 'role="option"' src/shared/ui/combobox.tsx` returns ≥ 1
- `grep -E "var\(--canopy" src/shared/ui/combobox.tsx | grep -c ''` returns ≥ 1 (uses CSS custom properties)
</verification>

<success_criteria>
- Combobox primitive implements WAI-ARIA APG 1.2 list-autocomplete contract (input role + listbox + options + aria-activedescendant focus model)
- `filter()` pure helper case-insensitively dedupes prior over default per D-01
- Q4 resolved: literal "Outro" commits as string, no special handling
- 16+ unit tests green (7 filter + 9 component)
- Component uses `var(--canopy, fallback)` etc. so Phase 3 design tokens drop in cleanly
- Component is consumed by Plans 05-16 (Plant Profile inline-edit location) and 05-17 (Manual Add location field)
- Commits prefixed `test(05-12):` (RED), `feat(05-12):` (GREEN)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-12-SUMMARY.md` summarizing:
- Final ARIA attribute set (so future a11y audits can grep against this list)
- Q4 resolution + the consumer call site convention (no `onOutroSelected` prop ever)
- Confirmation that `var(--canopy)` etc. fall back gracefully if Phase 3 tokens are absent at execution time
- Number of unit tests landed (filter + component)
</output>
</content>
</invoke>