---
phase: 05-catalog-meu-jardim
plan: 12
subsystem: shared/ui
tags: [combobox, accessibility, wai-aria, apg, location-picker, i18n, tdd]
dependency_graph:
  requires:
    - "05-10 (catalog i18n namespace scaffold — catalog.* top-level structure)"
  provides:
    - "src/shared/ui/combobox.tsx — WAI-ARIA APG 1.2 headless Combobox primitive"
    - "src/shared/ui/location-combobox.tsx — composed LocationCombobox with i18n defaults + suggestion merge"
    - "catalog.locations.{placeholder,addRow,defaults} i18n keys"
  affects:
    - "05-15, 05-16, 05-17 — Wave 4 plans consume <LocationCombobox> via @shared/ui/location-combobox"
tech_stack:
  added: []
  patterns:
    - "WAI-ARIA APG 1.2 combobox pattern (hand-rolled, ~260 LOC)"
    - "useRef<ReturnType<typeof setTimeout>> debounce pattern (100ms)"
    - "Ghost row via __ghost__ prefix to avoid value key collisions"
    - "Diacritic-insensitive NFD normalization for i18n suggestion deduplication"
    - "@testing-library/jest-dom/vitest import in setup-env.ts (Rule 2 auto-add)"
key_files:
  created:
    - src/shared/ui/combobox.tsx
    - src/shared/ui/location-combobox.tsx
    - src/app/(test)/combobox/page.tsx
    - src/app/(test)/combobox/harness.tsx
    - tests/unit/combobox.test.tsx
    - tests/unit/location-combobox.test.tsx
    - tests/e2e/axe-combobox.spec.ts
  modified:
    - src/messages/pt-BR.json
    - tests/unit/setup-env.ts
decisions:
  - "Ghost row uses __ghost__ value prefix to avoid id collision with real options sharing the same string value"
  - "Combobox uses fireEvent (not userEvent) in tests to avoid fake-timer interaction deadlock with async userEvent delays"
  - "data-testid forwarded as explicit prop on both Combobox and LocationCombobox (not via rest spread) to keep the ARIA input clean"
  - "@testing-library/jest-dom/vitest imported in setup-env.ts to enable toHaveAttribute matcher (was installed but not wired)"
metrics:
  duration: "~11 minutes"
  completed: "2026-05-01"
  tasks: 3
  files: 9
---

# Phase 05 Plan 12: Combobox + LocationCombobox Primitives Summary

One-liner: WAI-ARIA APG 1.2 headless Combobox with 100ms-debounced typeahead, XSS-safe ghost row, and LocationCombobox wrapping i18n defaults + diacritic-normalized suggestion deduplication.

## What Was Built

### Components

**`<Combobox>` (`src/shared/ui/combobox.tsx`)** — 260 LOC headless primitive:
- Full WAI-ARIA APG 1.2 contract: `role="combobox"`, `aria-controls`, `aria-expanded`, `aria-activedescendant`, `aria-autocomplete="list"`, `aria-labelledby`
- Keyboard map: ArrowDown (open+highlight first), ArrowUp (wrap to last), Home, End, Enter (commit), Esc (close; second Esc clears), Tab (close)
- 100ms debounce via `useRef<setTimeout>` — only the filter side-effect is debounced, not the input value itself
- Ghost row (`Adicionar '{typed}'`) rendered at top of listbox when typed value is not in suggestions; uses `__ghost__` prefix on `value` to avoid key collision with real options
- XSS-safe: typed values rendered via JSX text nodes only — no `dangerouslySetInnerHTML` anywhere (T-05-12-01)
- `disabled` prop: ArrowDown is no-op, listbox cannot open
- `data-testid` prop forwarded to the `<input>` for E2E targeting

**`<LocationCombobox>` (`src/shared/ui/location-combobox.tsx`)** — 65 LOC composed wrapper:
- `useTranslations('catalog.locations')` reads defaults via `t.raw('defaults')` (returns `string[]`)
- Merges `[...suggestions, ...defaults]` — deduplicated by `label.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim()`
- Uses `Set<string>` for O(n) deduplication; suggestions first (first-occurrence wins)
- Forwards `ghostRowTemplate={t.raw('addRow') as string}` and `placeholder={placeholder ?? t('placeholder')}`

### i18n Keys Added

Three new keys under `catalog.locations` in `src/messages/pt-BR.json`:
- `catalog.locations.placeholder` → `"Adicionar local"`
- `catalog.locations.addRow` → `"Adicionar '{typed}'"` (single-quotes are literal; Combobox uses string replace, not ICU)
- `catalog.locations.defaults` → `["sala","varanda","quarto","banheiro","cozinha","escritório","jardim","outro"]`

## Test Coverage

### Unit Tests (13 total)

**`tests/unit/combobox.test.tsx`** (12 tests):
1. T-05-12-01 XSS: `<script>alert(1)</script>` renders as literal textContent, script count unchanged
2. Initial render: `aria-expanded=false`, no `aria-activedescendant`
3. Listbox not visible on initial render
4. ArrowDown opens + highlights first option (`aria-activedescendant` matches `/^.+-a$/`)
5. ArrowDown wrap: last option → first
6. ArrowUp wrap: first → last
7. Home highlights first; End highlights last
8. Enter commits second option, closes listbox
9. Esc closes without committing (`onChange` not called)
10. Second Esc clears input (calls `onChange('')`)
11. Typeahead 100ms debounce: typing `"alp"` + advancing 100ms shows only Alpha
12. Ghost row `Adicionar 'xyz'` appears for not-in-list typed value + Enter commits typed value

**`tests/unit/location-combobox.test.tsx`** (1 test):
13. Merge + dedupe: suggestions `["Sala da Mãe","Sala","Quintal"]` + defaults → 10 options, "sala" from defaults dropped (normed against "Sala" from suggestions)

### E2E Tests (5 total — `tests/e2e/axe-combobox.spec.ts`)

- 4 axe scans: `/combobox` × {light,dark} × {no-preference,reduce} → 0 serious/critical violations each
- 1 APG keyboard contract: focus input → ArrowDown → assert `aria-expanded="true"` + `aria-activedescendant` matches `/^.+-a$/`

## Threat Model Mitigation

**T-05-12-01 (XSS — ghost row rendering)**:
- Mitigation: `{opt.label}` inside `<li>` — React auto-escapes text-node children
- No `dangerouslySetInnerHTML` in combobox.tsx or location-combobox.tsx (verified by `grep -L`)
- Test: `combobox.test.tsx` case 1 asserts `document.querySelectorAll('script').length` unchanged after typing XSS payload

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 — Missing] `@testing-library/jest-dom/vitest` not imported in setup-env.ts**

- **Found during:** Task 2 GREEN
- **Issue:** Package installed in `package.json` but not wired into Vitest setup; `toHaveAttribute` matcher not available
- **Fix:** Added `import "@testing-library/jest-dom/vitest"` to `tests/unit/setup-env.ts`
- **Files modified:** `tests/unit/setup-env.ts`
- **Commit:** `69303c0`

**2. [Rule 1 — Bug] Ghost row value collides with real option value when query matches an option's `value` field**

- **Found during:** Task 2 GREEN (duplicate React key warning)
- **Issue:** Ghost row was using `value: query` as key, colliding with real options that have `value: "a"` when query is `"a"`
- **Fix:** Ghost row uses `value: "__ghost__" + query`; `commitOption` strips the prefix when calling `onChange`
- **Files modified:** `src/shared/ui/combobox.tsx`
- **Commit:** `69303c0`

**3. [Rule 1 — Bug] `userEvent.setup({ advanceTimers })` deadlocks with `vi.useFakeTimers()`**

- **Found during:** Task 2 GREEN (5000ms timeouts)
- **Issue:** `user.type()` with fake timers active + `advanceTimers` hook causes deadlock in jsdom environment
- **Fix:** Replaced `userEvent.type` with `fireEvent.change` for tests that need fake-timer control; fake timers now wrapped in `vi.useFakeTimers()` / `vi.useRealTimers()` try/finally blocks per test
- **Files modified:** `tests/unit/combobox.test.tsx`
- **Commit:** `69303c0`

**4. [Rule 2 — Missing] `data-testid` prop not in original Combobox/LocationCombobox interface**

- **Found during:** Task 3 (harness needs deterministic E2E targeting)
- **Issue:** Plan requires `data-testid` on the combobox inputs for Playwright targeting; original interface lacked this
- **Fix:** Added `data-testid?: string` prop to both `ComboboxProps` and `LocationComboboxProps`, forwarded to `<input>`
- **Files modified:** `src/shared/ui/combobox.tsx`, `src/shared/ui/location-combobox.tsx`
- **Commit:** `738c55d`

## Hand-off Note for Wave 4 Plans

- **Generic Combobox**: `import { Combobox, type ComboboxOption } from "@shared/ui/combobox"`
- **Location Combobox**: `import { LocationCombobox } from "@shared/ui/location-combobox"`
- LocationCombobox accepts `suggestions: string[]` (user's prior locations from `GET /api/v1/locations`) + standard controlled `value`/`onChange`
- Wave 4 consumers (05-16 plant profile inline-edit, 05-17 manual-add form) need only mount `<LocationCombobox>` — all primitive work is done

## Self-Check: PASSED

All created files exist on disk:
- FOUND: src/shared/ui/combobox.tsx
- FOUND: src/shared/ui/location-combobox.tsx
- FOUND: src/app/(test)/combobox/page.tsx
- FOUND: src/app/(test)/combobox/harness.tsx
- FOUND: tests/unit/combobox.test.tsx
- FOUND: tests/unit/location-combobox.test.tsx
- FOUND: tests/e2e/axe-combobox.spec.ts

All task commits exist in git:
- c520334: test(05-12): add failing combobox keyboard + XSS + LocationCombobox merge tests
- 69303c0: feat(05-12): implement Combobox + LocationCombobox primitives (D-08, D-10)
- 738c55d: test(05-12): add /combobox test route + axe a11y gate (4 colorScheme×reducedMotion combos)
