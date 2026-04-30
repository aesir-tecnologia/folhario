---
phase: 05-catalog-meu-jardim
plan: 12
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/shared/ui/combobox.tsx
  - src/shared/ui/location-combobox.tsx
  - src/messages/pt-BR.json
  - tests/unit/combobox.test.tsx
  - tests/unit/location-combobox.test.tsx
  - src/app/(test)/combobox/page.tsx
  - src/app/(test)/combobox/harness.tsx
  - tests/e2e/axe-combobox.spec.ts
autonomous: true
requirements:
  - CAT-05
tags: [combobox, accessibility, wai-aria, apg, location-picker, i18n, tdd]
must_haves:
  truths:
    - "Focusing the combobox input does NOT auto-open the listbox; ArrowDown opens it"
    - "Esc closes the listbox without committing; second Esc clears the input"
    - "ArrowDown / ArrowUp move highlight; aria-activedescendant updates to highlighted option's id"
    - "Home jumps to first option; End jumps to last option"
    - "Enter commits the highlighted option (or the 'Adicionar {typed}' ghost row) and closes the listbox"
    - "Printable typeahead filters the listbox live (100ms debounce per UI-SPEC §10)"
    - "When typed string is not in suggestions, a ghost row 'Adicionar {typed}' renders at the top of the listbox"
    - "User-typed input is rendered via React text nodes — never executed as HTML (XSS-safe)"
    - "LocationCombobox merges user suggestions + i18n defaults from catalog.locations.defaults, de-duped by normalized label, suggestions first"
    - "axe-core finds 0 serious/critical violations across light/dark × reduced-motion/no-preference combos on the test-only /combobox route"
  artifacts:
    - path: "src/shared/ui/combobox.tsx"
      provides: "WAI-ARIA APG 1.2 Combobox primitive (headless)"
      min_lines: 150
      contains: "role=\"combobox\""
    - path: "src/shared/ui/location-combobox.tsx"
      provides: "Composed LocationCombobox merging user suggestions + i18n defaults + ghost row"
      min_lines: 30
    - path: "src/messages/pt-BR.json"
      provides: "catalog.locations.defaults (8 entries) + catalog.locations.placeholder + catalog.locations.addRow ghost-row template"
      contains: "\"defaults\""
    - path: "tests/unit/combobox.test.tsx"
      provides: "APG keyboard contract + XSS rendering safety unit tests"
      min_lines: 120
    - path: "tests/unit/location-combobox.test.tsx"
      provides: "User suggestions + i18n defaults merge (de-dupe) tests"
      min_lines: 30
    - path: "src/app/(test)/combobox/page.tsx"
      provides: "Test-only route mounting the combobox harness; production-guarded"
      contains: "ENABLE_TEST_ROUTES"
    - path: "src/app/(test)/combobox/harness.tsx"
      provides: "Client harness rendering Combobox + LocationCombobox for axe scans"
    - path: "tests/e2e/axe-combobox.spec.ts"
      provides: "Playwright + AxeBuilder a11y gate (0 serious/critical) across 4 colorScheme×reducedMotion combos"
      contains: "AxeBuilder"
  key_links:
    - from: "src/shared/ui/combobox.tsx"
      to: "input role=\"combobox\""
      via: "aria-activedescendant updates on ArrowDown/ArrowUp"
      pattern: "aria-activedescendant"
    - from: "src/shared/ui/location-combobox.tsx"
      to: "src/messages/pt-BR.json catalog.locations.defaults"
      via: "useTranslations('catalog.locations').raw('defaults')"
      pattern: "catalog\\.locations\\.defaults"
    - from: "src/app/(test)/combobox/page.tsx"
      to: "src/shared/ui/combobox.tsx"
      via: "harness.tsx imports both Combobox + LocationCombobox"
      pattern: "from \"@shared/ui/combobox\""
    - from: "tests/e2e/axe-combobox.spec.ts"
      to: "/combobox test route"
      via: "page.goto('/combobox') + new AxeBuilder({page}).analyze()"
      pattern: "page\\.goto\\(\"/combobox\"\\)"
---

<objective>
Ship the headless **Combobox** primitive at `src/shared/ui/combobox.tsx` that conforms to **WAI-ARIA APG 1.2** (D-08), and the composed **LocationCombobox** wrapper at `src/shared/ui/location-combobox.tsx` that merges user-supplied suggestions with i18n defaults from `catalog.locations.defaults` (D-10) and renders the "Adicionar '{typed}'" ghost row when the user types something not in the suggestion list (UI-SPEC §10 / §11).

This is the first headless ARIA-pattern primitive in the codebase. It is consumed by Wave 4 plans (05-15 catalog grid sort? no — sort uses native `<select>`; 05-16 plant profile inline-edit `combobox` variant; 05-17 manual-add form location field). Phase 5 ships the primitive with full keyboard contract + axe gate so Wave 4 consumers do nothing more than mount it.

Purpose: deliver CAT-05 (location picker: prior locations quick-select + defaults + free text becomes reusable). Without an APG-compliant combobox we cannot ship the location field's free-text-with-suggestions behavior — `<select>` cannot host the ghost row, and `aria-activedescendant` is required to keep DOM focus on the input during typeahead.

Output: 8 files (4 source, 2 unit-dom test files, 1 test-only route + harness, 1 Playwright a11y spec) all green under `pnpm test:unit` and `pnpm test:e2e -- axe-combobox.spec.ts`.
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

# Existing primitives to mirror conventions
@src/shared/ui/modal-sheet.tsx
@src/shared/ui/select.tsx
@src/shared/ui/text-input.tsx

# Existing axe + test-only-route precedents (verbatim patterns to mirror)
@src/app/(test)/modal-sheet/page.tsx
@tests/e2e/axe-modal-focus-trap.spec.ts
@tests/e2e/axe-placeholder-pages.spec.ts

# i18n target
@src/messages/pt-BR.json

<interfaces>
<!-- Contracts the executor implements / consumes. Embedded so executor needs no codebase scavenger hunt. -->

### Combobox public API (this plan creates)

```typescript
// src/shared/ui/combobox.tsx
export interface ComboboxOption {
  /** Stable identifier used for option DOM ids. */
  value: string;
  /** Display label. */
  label: string;
}

export interface ComboboxProps {
  /** Visible label text — paired with input via aria-labelledby. */
  label: string;
  /** Placeholder shown when input is empty. */
  placeholder?: string;
  /** Current committed value (controlled). Empty string when none. */
  value: string;
  /** Fired with the committed value: an option's `value` OR a typed free-text string accepted via the ghost row. */
  onChange: (next: string) => void;
  /** Suggestion list — already de-duped + ordered by the caller. */
  options: ComboboxOption[];
  /**
   * When user types a string not present in `options`, render a ghost row at the top
   * of the listbox with this template (e.g. `"Adicionar '{typed}'"`). Confirming the
   * ghost row calls onChange(typed). Pass `null` to disable the ghost row.
   */
  ghostRowTemplate?: string | null;
  /** Optional id override; otherwise React.useId. */
  id?: string;
  /** Forwarded to the trigger input for forms outside next-intl context. */
  name?: string;
  /** Optional aria-describedby for inline-error pairing (UI-SPEC §10). */
  "aria-describedby"?: string;
  /** Disabled state — affordance hidden, listbox cannot open. */
  disabled?: boolean;
}

export function Combobox(props: ComboboxProps): JSX.Element;
```

### LocationCombobox public API (this plan creates)

```typescript
// src/shared/ui/location-combobox.tsx
export interface LocationComboboxProps {
  label: string;
  placeholder?: string;          // defaults to t('catalog.locations.placeholder')
  value: string;
  onChange: (next: string) => void;
  /** User's prior locations from GET /api/v1/locations (D-09). May be empty. */
  suggestions: string[];
  /** Optional id forwarding. */
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  disabled?: boolean;
}

export function LocationCombobox(props: LocationComboboxProps): JSX.Element;
```

Internals: reads `useTranslations('catalog.locations')` → calls `t.raw('defaults')` to get the 8-entry pt-BR array; concatenates `[...suggestions, ...defaults]`; de-dupes by `label.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim()`; passes the result to `<Combobox options={merged} ghostRowTemplate={t('catalog.locations.addRow')} />`.

### APG 1.2 ARIA contract (verbatim from W3C — RESEARCH §Pattern 7)

```tsx
<input
  role="combobox"
  aria-controls={listboxId}
  aria-expanded={isOpen}
  aria-activedescendant={highlightedOptionId ?? undefined}
  aria-autocomplete="list"
  aria-labelledby={labelId}
  id={inputId}
/>
<ul role="listbox" id={listboxId} aria-labelledby={labelId}>
  {options.map(opt => (
    <li role="option" id={`${listboxId}-${opt.value}`} aria-selected={opt.value === selected}>
      {opt.label}
    </li>
  ))}
</ul>
```

### Required keyboard map (RESEARCH §Pattern 7 + UI-SPEC §10)

| Key             | Behavior                                                                                       |
|-----------------|------------------------------------------------------------------------------------------------|
| ArrowDown       | If listbox closed: open + highlight first. If open: move highlight down (wrap to first at end).|
| ArrowUp         | If open: move highlight up (wrap to last at start). If closed: open + highlight last.          |
| Home            | Highlight first option.                                                                        |
| End             | Highlight last option.                                                                         |
| Enter           | Commit highlighted option (or ghost row if shown) → onChange + close listbox.                  |
| Esc             | Close listbox without committing. Second Esc clears the input value.                           |
| Tab             | Close listbox, advance focus naturally.                                                        |
| Printable char  | Type into input; debounce 100ms then re-filter listbox; reset highlight to first match.        |

### Test-only route precedent (mirror exactly)

`src/app/(test)/modal-sheet/page.tsx` ships the production guard pattern:

```tsx
import { notFound } from "next/navigation";
import { ModalSheetTestHarness } from "./harness";

export default function ModalSheetTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <ModalSheetTestHarness />;
}
```

The new `src/app/(test)/combobox/page.tsx` MUST follow this pattern verbatim. The harness mounts both `<Combobox>` and `<LocationCombobox>` with seeded suggestions so axe can scan both surfaces.

### Existing axe spec pattern (mirror exactly)

`tests/e2e/axe-placeholder-pages.spec.ts:6-44` defines the 4-combo loop:

```ts
const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;
```

The new `tests/e2e/axe-combobox.spec.ts` MUST loop the 4 combos against `/combobox`, asserting 0 serious + 0 critical violations.
</interfaces>

</context>

<feature>
  <name>Combobox + LocationCombobox primitives (D-08, D-10)</name>
  <files>
    src/shared/ui/combobox.tsx,
    src/shared/ui/location-combobox.tsx,
    src/messages/pt-BR.json,
    tests/unit/combobox.test.tsx,
    tests/unit/location-combobox.test.tsx,
    src/app/(test)/combobox/page.tsx,
    src/app/(test)/combobox/harness.tsx,
    tests/e2e/axe-combobox.spec.ts
  </files>
  <behavior>
    The Combobox primitive implements WAI-ARIA APG 1.2 with the keyboard map and ARIA attributes embedded above. The LocationCombobox composes it with i18n defaults + suggestion merge. Behavior is fully testable via @testing-library/react (DOM contract) + Playwright AxeBuilder (a11y gate).

    Cases (each one a unit test):
    1. **Initial render**: input has role="combobox", aria-expanded="false", no aria-activedescendant. Listbox is not in the DOM (or has hidden state — pick one and assert).
    2. **ArrowDown opens + highlights first**: focus input, press ArrowDown → aria-expanded="true", aria-activedescendant matches first option's `id` (format: `${listboxId}-${option.value}`).
    3. **ArrowDown moves highlight down with wrap**: from option 0 → 1 → ... → last → wraps to 0.
    4. **ArrowUp moves highlight up with wrap**: from option 0 ArrowUp → wraps to last.
    5. **Home/End**: Home highlights first, End highlights last.
    6. **Enter commits highlighted option**: ArrowDown ArrowDown Enter → onChange called with `options[1].value`, listbox closes (aria-expanded="false").
    7. **Esc closes without commit**: open listbox, ArrowDown, Esc → listbox closed, onChange NOT called, input value unchanged.
    8. **Second Esc clears input**: with input "foo" and listbox already closed, Esc → input value empty, onChange("") called.
    9. **Printable typeahead with 100ms debounce**: type "j", advance fake timers 100ms → only options matching "j" remain visible (case-insensitive prefix or substring — pick substring per UI-SPEC §10 wording "filter listbox content live"); highlight resets to first match. Use vi.useFakeTimers + vi.advanceTimersByTime(100).
    10. **Ghost row appears for typed-not-in-options**: with `ghostRowTemplate="Adicionar '{typed}'"` and typed value not present in options, a row with text matching `Adicionar 'xyz'` appears at the top of the listbox (role="option").
    11. **Enter on ghost row commits typed value**: type "varanda nova" (not in options), ArrowUp from initial position lands on ghost row at top (or it's first by default), Enter → onChange("varanda nova").
    12. **XSS safety (T-05-12-01)**: pass `value=""` and type `<script>alert(1)</script>`; assert (a) the rendered ghost row contains the literal characters as text content (innerText / textContent equality), and (b) `document.querySelectorAll('script')` count is unchanged after render. No `dangerouslySetInnerHTML` anywhere in the component.
    13. **LocationCombobox merge (separate test file)**: render with `suggestions={["Sala da Mãe", "Sala", "Quintal"]}`. Mocked next-intl returns defaults `["sala","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]`. Assert merged options array passed to inner Combobox: order = suggestions first, then defaults; "sala" deduped (one entry, first-occurrence wins so "Sala da Mãe" + "Sala" remain — or "sala" deduped against "Sala" since normalization lowercases → only first "Sala" remains). Use `label.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim()` as the dedupe key.
    14. **axe-core a11y (Playwright)**: `/combobox` route renders the harness; AxeBuilder finds 0 serious/critical violations across all 4 colorScheme × reducedMotion combos.

    Non-cases (out of scope, document and skip):
    - Multi-select (D-08 single-value only).
    - Async option loading (suggestions arrive synchronously from props; LocationCombobox's network fetch is the consumer's job, not this primitive).
    - Mobile virtual keyboard quirks (manual VoiceOver/TalkBack gate is a Phase 5 manual-only verification per VALIDATION.md, not in this plan).
  </behavior>
  <implementation>
    Implementation guidance for the GREEN phase (after RED tests fail):

    1. **`src/shared/ui/combobox.tsx`** — `"use client"` directive. Use `useId()` for `inputId`, `listboxId`, `labelId`. Internal state via `useReducer` is fine; `useState` is also fine (~200 LOC budget).
       - State shape: `{ open: boolean; highlightIndex: number | null; query: string }`. Committed `value` is controlled by parent.
       - Computed `visibleOptions` from `options` filtered by `query` (case-insensitive substring on label). When `query` is non-empty AND no exact label match AND `ghostRowTemplate` is non-null/non-empty → prepend a synthetic ghost option at index 0 with value=`query` and label=interpolation of template.
       - Debounce typeahead filtering 100ms via a single `setTimeout` ref (cleared on each keystroke). DO NOT debounce the input value — only the filtering side-effect. Per CONTEXT Discretion + UI-SPEC §10.
       - Render layout per UI-SPEC §10 visual contract: input mirrors `<TextInput>` geometry classes (Warm Ivory bg, 1.5px Hairline → Canopy on focus, 8px radius, 48px tall). Listbox absolutely positioned below; max-height 240px with overflow-y auto. Highlighted `<li>` gets Hairline Beige bg via `data-highlighted` or className.
       - Render typed input via JSX text node (`{visibleOptionLabel}` inside `<span>`); NEVER `dangerouslySetInnerHTML`. Threat T-05-12-01 mitigation. Asserted by test case 12.
       - Cleanup the debounce timer in a `useEffect` cleanup return.
       - When `disabled` is true, the input renders with `disabled` attribute and the listbox cannot open (ArrowDown is no-op).

    2. **`src/shared/ui/location-combobox.tsx`** — `"use client"`. Imports `useTranslations` from `next-intl`. Reads defaults via `t.raw('defaults')` (returns `string[]` because the messages key is a string array). Builds:
       ```ts
       const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
       const merged: ComboboxOption[] = [];
       const seen = new Set<string>();
       for (const label of [...suggestions, ...defaults]) {
         const key = norm(label);
         if (key && !seen.has(key)) { seen.add(key); merged.push({ value: label, label }); }
       }
       ```
       Then `<Combobox options={merged} ghostRowTemplate={t('catalog.locations.addRow')} placeholder={placeholder ?? t('catalog.locations.placeholder')} ... />`.

    3. **`src/messages/pt-BR.json`** — extend `catalog` namespace per UI-SPEC §11:
       ```json
       "locations": {
         "placeholder": "Adicionar local",
         "addRow": "Adicionar '{typed}'",
         "defaults": ["sala", "varanda", "quarto", "banheiro", "cozinha", "escritório", "jardim", "outro"]
       }
       ```
       PRESERVE existing `catalog.*` keys exactly (do not reorder or remove). Use a JSON-aware edit that injects the `locations` key inside the existing `catalog` object. Verify by re-reading the file after the edit and grep'ing `catalog.locations.defaults` is parseable.

    4. **`src/app/(test)/combobox/page.tsx`** — verbatim mirror of `src/app/(test)/modal-sheet/page.tsx`. Production guard: `if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") notFound();` at the top of the default export.

    5. **`src/app/(test)/combobox/harness.tsx`** — `"use client"` component. Renders TWO sections:
       - Section A: bare `<Combobox label="Genérico" options={[{value:"a",label:"Alpha"},{value:"b",label:"Beta"}]} ghostRowTemplate="Adicionar '{typed}'" value={...} onChange={setX} />` — controlled with local `useState`.
       - Section B: `<LocationCombobox label="Localização" suggestions={["Sala da Mãe","Quintal"]} value={...} onChange={setY} />`.
       Both wrapped in a `<main>` with a heading so axe doesn't flag missing landmarks.

    6. **`tests/e2e/axe-combobox.spec.ts`** — copy the 4-combo loop from `axe-placeholder-pages.spec.ts:6-44` exactly; replace the routes loop with a single route `/combobox`. Spec also performs ONE keyboard-contract programmatic verification (RESEARCH §Pattern 7 line "keyboard APG contract tested programmatically"): focus the first combobox input, press ArrowDown, assert `aria-expanded="true"` and `aria-activedescendant` is set to a string matching `/^.+-a$/` (first option id). This is light-touch — heavy keyboard contract assertion lives in unit-dom (Task 1).

    7. **`tests/unit/combobox.test.tsx` and `tests/unit/location-combobox.test.tsx`** — `@testing-library/react` + `@testing-library/user-event` (already in package.json per package.json:87-89). For LocationCombobox tests, mock `next-intl` `useTranslations` via `vi.mock` to return a function that resolves keys against an in-test message bag (mirror existing pattern from `tests/unit/empty-state.test.tsx` if it mocks intl; otherwise stub minimally — the only keys needed are `catalog.locations.placeholder`, `catalog.locations.addRow`, and `catalog.locations.defaults` via `.raw()`).
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (RED): Write failing keyboard-contract + XSS + LocationCombobox merge tests</name>
  <files>
    tests/unit/combobox.test.tsx,
    tests/unit/location-combobox.test.tsx
  </files>
  <behavior>
    Write the unit-dom tests described in `<feature>` cases 1–13. Use `@testing-library/react` + `@testing-library/user-event` (already installed). Use `vi.useFakeTimers()` + `vi.advanceTimersByTime(100)` for the typeahead debounce test. Mock `next-intl` `useTranslations` for the LocationCombobox test file via `vi.mock("next-intl", () => ({ useTranslations: () => Object.assign((key: string) => mapping[key] ?? key, { raw: (key: string) => rawMapping[key] }) }))`.

    Each test asserts a single behavior. Naming convention: `it("commits highlighted option on Enter")`, `it("Esc closes without committing onChange")`, `it("renders typed input as text node — does not execute injected <script>")`, etc. Test the public API only (props in / behavior out); never reach into component internals.

    Imports point to the not-yet-created files: `import { Combobox } from "@shared/ui/combobox";` and `import { LocationCombobox } from "@shared/ui/location-combobox";` — these MUST fail at module-resolution time, which is the RED signal.

    File MUST place a single XSS regression test at the top of `combobox.test.tsx` with explicit comment referencing T-05-12-01.
  </behavior>
  <action>
    1. Create `tests/unit/combobox.test.tsx` with all 12 unit cases (1–12 from `<behavior>`). Per UI-SPEC §10 the typeahead debounce is 100ms — assert with `vi.advanceTimersByTime(100)`. Per T-05-12-01 the XSS test asserts `<script>alert(1)</script>` typed-input renders as literal text (`textContent` equality) and `document.querySelectorAll('script').length` is unchanged.
    2. Create `tests/unit/location-combobox.test.tsx` with case 13: mock `useTranslations` to return defaults `["sala","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]` via `.raw()`. Render with `suggestions={["Sala da Mãe","Sala","Quintal"]}`. Assert that the rendered listbox (after ArrowDown to open) contains `Sala da Mãe`, `Quintal`, then defaults — but NOT the duplicate `Sala` (deduped against the user's first `Sala da Mãe`? — actually no: `norm("Sala da Mãe") = "sala da mae"` ≠ `norm("Sala") = "sala"`, so both remain. The dedupe collapses the second `"Sala"` from suggestions against the third occurrence in defaults). State the expected order in a comment so the GREEN implementer can match.
    3. Run `pnpm test:unit -- combobox` — MUST fail with module-not-found errors for `@shared/ui/combobox` and `@shared/ui/location-combobox`. This failure IS the RED state. Commit only if module-not-found is the failure (no syntax errors in the test files themselves).
    4. Commit: `test(05-12): add failing combobox keyboard + XSS + LocationCombobox merge tests` — per gsd TDD convention.

    Specificity notes:
    - DO NOT mock `useId` — it's React 19 stable; rely on real ids.
    - DO use `userEvent.setup({ advanceTimers: vi.advanceTimersByTime })` so user events advance the fake timer.
    - DO assert `aria-activedescendant` value via `.toHaveAttribute("aria-activedescendant", expect.stringMatching(/^.+-b$/))` for the second option (value="b").
    - DO NOT add a snapshot test — explicit assertions only (banned-patterns-snapshot.test.ts only allows specific snapshots).
  </action>
  <verify>
    <automated>pnpm test:unit -- combobox 2>&1 | grep -E "FAIL|Cannot find module|combobox" | head -20</automated>
  </verify>
  <done>Both test files exist, contain 12 + 1 = 13 individual `it(...)` blocks total, and `pnpm test:unit -- combobox` fails with `Cannot find module '@shared/ui/combobox'` (module-resolution RED — not syntax error). XSS test exists with explicit T-05-12-01 comment. Commit created.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (GREEN): Implement Combobox + LocationCombobox + extend pt-BR.json so all unit tests pass</name>
  <files>
    src/shared/ui/combobox.tsx,
    src/shared/ui/location-combobox.tsx,
    src/messages/pt-BR.json
  </files>
  <behavior>
    Implement the headless Combobox per WAI-ARIA APG 1.2 (RESEARCH §Pattern 7) so all 12 unit tests in `combobox.test.tsx` pass. Implement LocationCombobox so the 1 merge test in `location-combobox.test.tsx` passes. Extend `src/messages/pt-BR.json` `catalog` namespace with `locations.{placeholder,addRow,defaults}` per UI-SPEC §11.
  </behavior>
  <action>
    1. **Create `src/shared/ui/combobox.tsx`** following the implementation guide in `<feature>`. Mirror `src/shared/ui/modal-sheet.tsx` for `"use client"` + ReactNode + prop-shape conventions. Mirror `src/shared/ui/text-input.tsx:49-50` for `aria-invalid`/`aria-describedby` wiring. Use `useId()` for `inputId`, `listboxId`, `labelId`. Implement keyboard handler in a single `onKeyDown` handler on the input. Implement debounce via a `useRef<ReturnType<typeof setTimeout> | null>` cleared on each keystroke (clear in `useEffect` cleanup). NEVER use `dangerouslySetInnerHTML` (T-05-12-01). Render typed values via JSX text nodes only.

    2. **Create `src/shared/ui/location-combobox.tsx`** per the implementation guide. Use `useTranslations('catalog.locations')` and `t.raw('defaults')`. Compute the merged + de-duped options list with the diacritic-stripping normalizer. Pass `ghostRowTemplate={t('catalog.locations.addRow')}` and `placeholder={placeholder ?? t('catalog.locations.placeholder')}` to the inner `<Combobox>`. Forward `value`, `onChange`, `id`, `name`, `aria-describedby`, `disabled` 1:1.

    3. **Extend `src/messages/pt-BR.json`** — locate the existing `"catalog": { ... }` object and inject a `"locations"` key with three entries: `placeholder` (`"Adicionar local"`), `addRow` (`"Adicionar '{typed}'"`), `defaults` (8-entry array `["sala","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]`). Preserve every existing key in the file. Verify post-edit by re-reading the file once and confirming the JSON parses (no trailing commas, no duplicate keys).

    4. **Run `pnpm test:unit -- combobox`** — all 13 tests MUST pass. If a test fails, fix the implementation (NOT the test); the test is the contract.

    5. **Run `pnpm test:unit`** in full to confirm no regressions in adjacent tests (especially `messages-coverage.test.ts` which scans the i18n bundle, and `banned-patterns-snapshot.test.ts`).

    6. Commit: `feat(05-12): implement Combobox + LocationCombobox primitives (D-08, D-10)`.

    Specificity / anti-pattern guards:
    - DO NOT import a headless library (D-08 explicit: hand-rolled).
    - DO NOT add CSS modules or styled-components — Tailwind utility classes only (project convention).
    - DO use `Math.max`/`Math.min` for highlight wrap; DO NOT use modulo on negative numbers (`-1 % 5 === -1` in JS, not 4).
    - DO use `Set<string>` for the dedupe key store.
    - DO NOT call `t('defaults')` (returns string formatted) — must be `t.raw('defaults')` (returns `string[]`). next-intl `.raw()` is the authoritative escape hatch for non-string values.
  </action>
  <verify>
    <automated>pnpm test:unit -- combobox</automated>
  </verify>
  <done>
    All 13 unit tests pass under `pnpm test:unit -- combobox`. Full `pnpm test:unit` is also green (no regressions). `src/shared/ui/combobox.tsx` exists with `role="combobox"`, `aria-controls`, `aria-expanded`, `aria-activedescendant` attributes (verified by `grep -c "aria-activedescendant" src/shared/ui/combobox.tsx | grep -v 0`). `src/messages/pt-BR.json` parses (verified by `node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"` exits 0). No `dangerouslySetInnerHTML` in either source file (verified by `grep -L "dangerouslySetInnerHTML" src/shared/ui/combobox.tsx src/shared/ui/location-combobox.tsx`). Commit created.
  </done>
</task>

<task type="auto">
  <name>Task 3: Test-only /combobox route + Playwright axe-core a11y gate</name>
  <files>
    src/app/(test)/combobox/page.tsx,
    src/app/(test)/combobox/harness.tsx,
    tests/e2e/axe-combobox.spec.ts
  </files>
  <action>
    1. **Create `src/app/(test)/combobox/page.tsx`** — verbatim mirror of `src/app/(test)/modal-sheet/page.tsx`. Production guard:
       ```tsx
       import { notFound } from "next/navigation";
       import { ComboboxTestHarness } from "./harness";
       export default function ComboboxTestPage() {
         if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
           notFound();
         }
         return <ComboboxTestHarness />;
       }
       ```

    2. **Create `src/app/(test)/combobox/harness.tsx`** — `"use client"` component rendering both primitives. Wrap in a `<main>` with an `<h1>` so axe finds the landmark and heading. Section A: bare `<Combobox>` with 3 hardcoded `options=[{value:"a",label:"Alpha"},{value:"b",label:"Beta"},{value:"c",label:"Gamma"}]`, controlled via `useState`. Section B: `<LocationCombobox>` with hardcoded `suggestions={["Sala da Mãe","Quintal"]}`, controlled via `useState`. Each section labeled. Add `data-testid="combobox-generic-input"` and `data-testid="location-combobox-input"` so the spec can target inputs deterministically.

    3. **Create `tests/e2e/axe-combobox.spec.ts`** — copy the 4-combo loop verbatim from `tests/e2e/axe-placeholder-pages.spec.ts:6-44`, replacing the `ROUTES` array with a single-element navigation to `/combobox`. The spec runs axe with no rules disabled and asserts `serious + critical violations === []`. Add ONE additional non-axe assertion at the bottom of the file: focus `data-testid="combobox-generic-input"`, press `ArrowDown`, assert `aria-expanded="true"` and `aria-activedescendant` matches `/^.+-a$/` (first option id). This satisfies RESEARCH §Pattern 7 line "APG keyboard contract tested programmatically".

    4. **Run `pnpm test:e2e -- axe-combobox.spec.ts`** with `ENABLE_TEST_ROUTES=1` if needed in dev (the production guard lets the route through in NODE_ENV=development by default — verify by reading the existing modal-sheet page guard).

    5. Commit: `test(05-12): add /combobox test route + axe a11y gate (4 colorScheme×reducedMotion combos)`.

    Anti-pattern guards:
    - DO NOT add the `/combobox` route to `axe-placeholder-pages.spec.ts` ROUTES array — that file is for SHIPPED placeholder pages. The combobox is a PRIMITIVE, scanned via its own dedicated harness route. Wave 4 plans (05-15..05-17) extend `axe-placeholder-pages.spec.ts` for shipped catalog routes.
    - DO use `page.emulateMedia({ colorScheme, reducedMotion })` BEFORE `page.goto("/combobox")`, mirroring the existing pattern.
    - DO NOT mark this task as `tdd="true"` — it is glue code (test-only route + spec) not production code. The TDD cycle is closed by Tasks 1 + 2.
  </action>
  <verify>
    <automated>pnpm test:e2e -- axe-combobox.spec.ts</automated>
  </verify>
  <done>
    `/combobox` test route exists with production guard mirroring `(test)/modal-sheet`. Harness mounts both primitives with seeded data. `tests/e2e/axe-combobox.spec.ts` exists with the 4-combo loop + 1 keyboard-contract assertion. `pnpm test:e2e -- axe-combobox.spec.ts` passes (4 axe runs + 1 keyboard run = 5 green tests). axe finds 0 serious/critical violations under any theme/motion combo. Commit created.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| User keyboard input → DOM render | The combobox echoes user-typed values into the ghost row label (`Adicionar '{typed}'`). Untrusted input crosses this boundary at every keystroke. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-12-01 | I (Information disclosure / XSS) | `src/shared/ui/combobox.tsx` ghost-row rendering | mitigate | Render the typed string via JSX text node only — `<span>{ghostLabel}</span>` where `ghostLabel = template.replace('{typed}', query)`; React auto-escapes text-node children. NEVER `dangerouslySetInnerHTML` anywhere in the file. Unit test in Task 1 (`tests/unit/combobox.test.tsx`) asserts that typing `<script>alert(1)</script>` produces literal text content (textContent equality) and `document.querySelectorAll('script').length` is unchanged after render. axe-core E2E in Task 3 catches any accidentally introduced HTML injection sinks. Block-on: high. |

(No additional threats — Combobox is a controlled, presentation-only primitive. Network calls happen in caller (LocationCombobox suggestions are fetched by Wave 3 `05-08` route; Wave 4 consumers fetch via TanStack Query). Repudiation/Tampering/DoS/Elevation surfaces are zero for this primitive. Spoofing is N/A — no auth boundary.)
</threat_model>

<verification>
- All 13 unit tests in `tests/unit/combobox.test.tsx` + `tests/unit/location-combobox.test.tsx` green.
- All 5 E2E tests in `tests/e2e/axe-combobox.spec.ts` green (4 axe runs + 1 keyboard contract run).
- No regressions in `pnpm test:unit` full suite (especially `messages-coverage.test.ts`, `banned-patterns-snapshot.test.ts`).
- `grep -L "dangerouslySetInnerHTML" src/shared/ui/combobox.tsx src/shared/ui/location-combobox.tsx` lists both files (i.e., NEITHER contains the string).
- `node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"` exits 0 (i18n bundle remains valid JSON).
- `grep -v '^\s*//' src/shared/ui/combobox.tsx | grep -c "aria-activedescendant"` returns ≥1 (attribute present in non-comment code).
</verification>

<success_criteria>
- WAI-ARIA APG 1.2 keyboard contract verified by 12 unit-dom tests + 1 programmatic Playwright assertion.
- LocationCombobox de-dupes user suggestions against i18n defaults using diacritic-insensitive normalization.
- "Adicionar '{typed}'" ghost row appears for not-in-list typed values; Enter on ghost row commits the typed value via onChange.
- XSS attempt via typed input renders as literal text (T-05-12-01 mitigated and tested).
- axe-core finds 0 serious/critical violations across light/dark × reduced-motion/no-preference on `/combobox`.
- pt-BR i18n bundle extended with `catalog.locations.{placeholder,addRow,defaults}` per UI-SPEC §11.
- Production guard on `/combobox` route prevents leak (mirrors `(test)/modal-sheet` precedent).
- CAT-05 location-picker primitive is shippable: Wave 4 consumers (05-15/16/17) can mount `<LocationCombobox>` with no further primitive work.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-12-combobox-primitive-SUMMARY.md` per `@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md`. Include:
- Components delivered: `<Combobox>` (200 LOC target) + `<LocationCombobox>` (~50 LOC).
- Test coverage: 13 unit tests + 5 E2E (4 axe + 1 keyboard).
- i18n keys added (3): `catalog.locations.placeholder`, `catalog.locations.addRow`, `catalog.locations.defaults`.
- Threat T-05-12-01 mitigation evidence (test name + assertion).
- Hand-off note for Wave 4 plans: import path is `@shared/ui/location-combobox` (LocationCombobox) or `@shared/ui/combobox` (generic Combobox).
</output>
