---
phase: 05-catalog-meu-jardim
plan: 24
type: execute
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
  - src/shared/ui/combobox.tsx
  - src/app/sw.ts
  - src/app/(app)/catalog/_components/use-sort-preference.ts
  - src/messages/pt-BR.json
  - src/app/(app)/catalog/[plantId]/journal/page.tsx
autonomous: true
requirements: [CAT-03, CAT-04, CAT-07, OFF-08]
must_haves:
  truths:
    - "Plant profile cover image stays visible after inline-editing any field"
    - "Location combobox opens its listbox on click or focus, without requiring typing"
    - "Previously-cached catalog pages remain visible when offline; Chrome dino does not appear"
    - "Deleting a plant shows a success toast and catalog header renders without hydration mismatch"
    - "Journal page title renders as '{plantName} — Diário' without i18n formatting errors"
  artifacts:
    - path: "src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts"
      provides: "Spread-merge onSuccess for useUpdatePlant; toast.success in useDeletePlant.onSuccess"
    - path: "src/shared/ui/combobox.tsx"
      provides: "openListbox() called on both onFocus and onClick"
    - path: "src/app/sw.ts"
      provides: "navigate NetworkFirst entry prepended before defaultCache in runtimeCaching array"
    - path: "src/app/(app)/catalog/_components/use-sort-preference.ts"
      provides: "useState initialized with 'date_new' always; stored value applied in useEffect"
    - path: "src/messages/pt-BR.json"
      provides: "catalog.profile.delete.success key added"
    - path: "src/app/(app)/catalog/[plantId]/journal/page.tsx"
      provides: "t('titleFormat') called with { name: plant.nickname ?? plant.name }"
  key_links:
    - from: "useUpdatePlant.onSuccess"
      to: "cached plant query"
      via: "spread merge preserves cover_signed_url"
      pattern: "prev\\.plant,\\s*\\.\\.\\.data\\.plant"
    - from: "combobox input"
      to: "openListbox()"
      via: "onFocus and onClick handlers"
      pattern: "openListbox\\(\\)"
    - from: "sw.ts runtimeCaching"
      to: "navigate NetworkFirst"
      via: "first entry in array before defaultCache spread"
      pattern: "request\\.mode.*navigate"
    - from: "useSortPreference"
      to: "sessionStorage"
      via: "useEffect after mount"
      pattern: "useEffect"
    - from: "JournalPage t('titleFormat')"
      to: "plant.name"
      via: "{ name: plant.nickname ?? plant.name }"
      pattern: "titleFormat.*name.*nickname"
---

<objective>
Close 5 major gaps identified in the Phase 05 UAT cycle.

Purpose: All five gaps are major severity — they produce either a broken UX (disappearing cover image, non-opening combobox, Chrome offline dino, missing toast, i18n crash) or a hydration mismatch that breaks server/client rendering parity.

Output: 4 modified source files + 1 updated i18n JSON, closing gaps from tests 3, 4, 5, 6, and 8 of the UAT report.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@/Users/machado/Projects/folhario/.planning/PROJECT.md
@/Users/machado/Projects/folhario/.planning/ROADMAP.md

@/Users/machado/Projects/folhario/.planning/phases/05-catalog-meu-jardim/05-HUMAN-UAT.md
</context>

<tasks>

<task type="auto">
  <name>Task 1: Fix plant-profile mutations — cover image preserved + delete success toast</name>
  <files>src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts, src/messages/pt-BR.json</files>
  <action>
Two bugs in the same file and one missing i18n key.

**Bug A — Cover image disappears on inline-edit (UAT test 3):**

In `useUpdatePlant` (actually `usePatchPlantField`), the `onSuccess` handler at lines 88-94 fully replaces the cached plant with `data.plant` from the PATCH response. The PATCH handler returns `toPlantSnakeCase()` which omits `cover_signed_url`. Result: the cover image disappears.

Fix — change the `onSuccess` callback:

BEFORE (line 88-93):
```ts
onSuccess: (data) => {
  qc.setQueryData<PlantDetailDto>(
    ["catalog", "plant", plantId],
    (prev) => (prev ? { ...prev, plant: data.plant } : prev),
  );
},
```

AFTER (spread-merge to preserve any field the PATCH response omits, including `cover_signed_url`):
```ts
onSuccess: (data) => {
  qc.setQueryData<PlantDetailDto>(
    ["catalog", "plant", plantId],
    (prev) =>
      prev
        ? { ...prev, plant: { ...prev.plant, ...data.plant } }
        : prev,
  );
},
```

**Bug B — Missing success toast on delete (UAT test 6):**

`useDeletePlant.onSuccess` (line 163-165) only calls `opts?.onSuccess?.()` — `toast.success()` is never called.

The translations namespace is already `useTranslations("catalog.profile.delete")` (line 107). The key `success` doesn't exist yet in pt-BR.json — add it.

Fix — change the `onSuccess` callback:

BEFORE:
```ts
onSuccess: () => {
  opts?.onSuccess?.();
},
```

AFTER:
```ts
onSuccess: () => {
  toast.success(t("success"));
  opts?.onSuccess?.();
},
```

**i18n key:**

In `src/messages/pt-BR.json`, inside the existing `catalog.profile.delete` object (which already contains `title`, `bodyBoth`, `bodyPhotosOnly`, `bodyRemindersOnly`, `bodyEmpty`, `cancel`, `confirm`, `deleting`, `failure`), add:

```json
"success": "Planta excluída com sucesso."
```

Place it after `"failure"` at the end of the `delete` object.
  </action>
  <verify>
    <automated>cd /Users/machado/Projects/folhario && pnpm exec tsc --noEmit 2>&1 | grep -E "use-plant-profile-mutations|pt-BR" | head -20</automated>
  </verify>
  <done>
    - `usePatchPlantField.onSuccess` uses `{ ...prev.plant, ...data.plant }` spread merge
    - `useDeletePlant.onSuccess` calls `toast.success(t("success"))` before `opts?.onSuccess?.()`
    - `catalog.profile.delete.success` key exists in `src/messages/pt-BR.json`
    - `pnpm exec tsc --noEmit` reports zero errors in affected files
  </done>
</task>

<task type="auto">
  <name>Task 2: Fix combobox click/focus + sort preference SSR hydration</name>
  <files>src/shared/ui/combobox.tsx, src/app/(app)/catalog/_components/use-sort-preference.ts</files>
  <action>
Two separate bugs handled in the same task (both are small, single-concern UI fixes).

**Bug A — Location combobox only opens on typing, not on click/focus (UAT test 4):**

In `src/shared/ui/combobox.tsx` around line 224, the `<input>` element's `onFocus` handler syncs query state but never calls `openListbox()`. There is also no `onClick` handler. The listbox therefore stays closed until `handleInputChange` (typing) or arrow keys fire.

Add `openListbox()` to the existing `onFocus` handler, AND add `onClick={() => openListbox()}` to the input element:

BEFORE:
```tsx
onFocus={() => {
  if (value && !query) {
    setQuery(value);
  }
}}
```

AFTER:
```tsx
onFocus={() => {
  if (value && !query) {
    setQuery(value);
  }
  openListbox();
}}
onClick={() => openListbox()}
```

The `openListbox` function is already defined in the component — only the call sites need adding.

**Bug B — Hydration mismatch in CatalogHeader sort announcement (UAT test 6):**

`src/app/(app)/catalog/_components/use-sort-preference.ts` initializes `useState` with `readStoredSort` as the initializer function. When Next.js SSR renders this hook, `typeof window === "undefined"` is true so it returns `"date_new"`. On the client, the hook is called again at hydration time — but now `window` exists, so `readStoredSort()` may return a stored value (e.g., `"date_old"`). This text difference causes the aria-live announcement in `catalog-header.tsx:75` to mismatch between server and client, triggering React's hydration error.

Fix: initialize `useState` with `"date_new"` always (matching server output exactly), then apply the stored preference in a `useEffect` that runs only on the client after mount.

BEFORE:
```ts
export function useSortPreference(): [SortId, (next: SortId) => void] {
  const [sortId, setSortId] = useState<SortId>(readStoredSort);

  function setSort(next: SortId): void {
    sessionStorage.setItem(STORAGE_KEY, next);
    setSortId(next);
  }

  return [sortId, setSort];
}
```

AFTER (add `useEffect` import alongside `useState`):
```ts
import { useState, useEffect } from "react";

export function useSortPreference(): [SortId, (next: SortId) => void] {
  const [sortId, setSortId] = useState<SortId>("date_new");

  useEffect(() => {
    const stored = readStoredSort();
    if (stored !== "date_new") {
      setSortId(stored);
    }
  }, []);

  function setSort(next: SortId): void {
    sessionStorage.setItem(STORAGE_KEY, next);
    setSortId(next);
  }

  return [sortId, setSort];
}
```

The existing test file `use-sort-preference.unit.test.tsx` has a "Test 2 (round-trip)" test that expects a remounted hook to return the stored value. This test runs in jsdom where `useEffect` fires synchronously via `act()`, so the round-trip assertion still passes. Test 1 (default-when-absent) and Test 4 (SSR-safe) remain valid. Run the test suite to confirm.
  </action>
  <verify>
    <automated>cd /Users/machado/Projects/folhario && pnpm vitest run src/app/\(app\)/catalog/_components/use-sort-preference.unit.test.tsx 2>&1 | tail -20</automated>
  </verify>
  <done>
    - Combobox `<input>` has both `onFocus={() => { ...; openListbox(); }}` and `onClick={() => openListbox()}`
    - `useSortPreference` initializes with `"date_new"` and applies stored value in `useEffect`
    - All 5 tests in `use-sort-preference.unit.test.tsx` pass
    - `pnpm exec tsc --noEmit` reports zero errors in both files
  </done>
</task>

<task type="auto">
  <name>Task 3: Fix offline navigation — service worker route ordering</name>
  <files>src/app/sw.ts</files>
  <action>
**Root cause (UAT test 5):**

`src/app/sw.ts` passes `runtimeCaching: defaultCache` to the Serwist constructor. `defaultCache` is an array where the second-to-last entry is:

```js
{
  matcher: ({ url: { pathname }, sameOrigin }) => sameOrigin && !pathname.startsWith("/api/"),
  handler: new NetworkFirst({ cacheName: "others", ... })
}
```

This "others" rule matches ALL same-origin non-API requests — including HTML navigations — because it only checks `sameOrigin && !startsWith("/api/")`, with no `request.mode` check. Routes are evaluated first-match-wins.

The custom `serwist.registerCapture(({ request }) => request.mode === "navigate", ...)` block registered AFTER the constructor runs AFTER all defaultCache routes in the matching chain. The "others" rule wins, uses the `"others"` cache (which has no `networkTimeoutSeconds`), and when offline the request hangs then falls through to the browser's native offline page (Chrome dino) instead of serving the precached shell.

**Fix:**

Replace the `runtimeCaching: defaultCache` constructor option with an array that prepends the navigate handler FIRST, then spreads defaultCache. Remove the standalone `serwist.registerCapture(...)` block for navigate (lines 102-108 in the current file).

The route object shape for `runtimeCaching` is `{ matcher, handler }` — same as the entries in `defaultCache` itself (verified from `@serwist/next/dist/index.worker.js`).

BEFORE (in Serwist constructor):
```ts
const serwist = new Serwist({
  precacheEntries,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: { ... },
});

// ... later:
serwist.registerCapture(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages",
    networkTimeoutSeconds: 3,
  }),
);
```

AFTER (navigation rule prepended, registerCapture block removed):
```ts
const serwist = new Serwist({
  precacheEntries,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [
    {
      matcher: ({ request }) => request.mode === "navigate",
      handler: new NetworkFirst({
        cacheName: "pages",
        networkTimeoutSeconds: 3,
      }),
    },
    ...defaultCache,
  ],
  fallbacks: { ... },
});
```

Remove the standalone `serwist.registerCapture(...)` block for navigate entirely (the block between the catalog SWR `registerCapture` and the api `NetworkOnly` `registerCapture` sections — lines approximately 102-108). Keep the catalog API SWR `registerCapture` and the `/api/` `NetworkOnly` `registerCapture` blocks — they are unaffected by this change.

Note: `NetworkFirst` is already imported at the top of sw.ts.
  </action>
  <verify>
    <automated>cd /Users/machado/Projects/folhario && pnpm exec tsc --noEmit 2>&1 | grep sw.ts | head -10 && grep -n "request\.mode.*navigate" src/app/sw.ts</automated>
  </verify>
  <done>
    - `runtimeCaching` array starts with `{ matcher: ({ request }) => request.mode === "navigate", handler: new NetworkFirst(...) }`
    - The standalone `serwist.registerCapture(({ request }) => request.mode === "navigate", ...)` block is removed
    - `pnpm exec tsc --noEmit` reports zero errors in sw.ts
    - `grep -n "request.mode.*navigate" src/app/sw.ts` returns exactly one line (the runtimeCaching entry)
  </done>
</task>

<task type="auto">
  <name>Task 4: Fix journal page i18n formatting error</name>
  <files>src/app/(app)/catalog/[plantId]/journal/page.tsx</files>
  <action>
**Root cause (UAT test 8):**

In `src/app/(app)/catalog/[plantId]/journal/page.tsx`, the `labels` object is built starting at line 37. At line 38:

```ts
titleFormat: t("titleFormat"),
```

The i18n key `catalog.journal.titleFormat` is `"{name} — Diário"` — it requires a `name` variable. The call at line 38 passes no variables, causing the FORMATTING_ERROR.

The `plant` variable is destructured from `plantResult` at line 61 (`const { plant } = plantResult;`), which is AFTER the `labels` block (lines 37-57). So `plant` is not in scope when `titleFormat` is built.

**Fix:**

Move the `const { plant } = plantResult;` destructure to BEFORE the `labels` block, and pass `{ name: plant.nickname ?? plant.name }` to the `t("titleFormat")` call.

The current order in the file:
1. Lines 27-31: `photoEntriesResult` + `photoEntryItems`
2. Lines 33-36: `t`, `tAdd`, `tEmpty` awaits
3. Lines 37-57: `labels` block ← `titleFormat` is here without `name`
4. Line 59: `const readOnly = ...`
5. Line 61: `const { plant } = plantResult;` ← plant available here

Move the destructure and readOnly to before the labels block:

```ts
const { plant } = plantResult;
const readOnly = process.env.SUBSCRIPTION_READ_ONLY === "1";

const labels = {
  titleFormat: t("titleFormat", { name: plant.nickname ?? plant.name }),
  // ... rest of labels unchanged
};
```

The remaining lines of `labels` (add, empty, lightboxClose) do not use `plant` directly, so no other changes are needed. The `plantForClient` block (lines 62-66) still assembles the client-safe subset from `plant` — leave it intact after the `labels` block or reorder naturally. Either way, TypeScript will confirm `plant` is in scope.
  </action>
  <verify>
    <automated>cd /Users/machado/Projects/folhario && pnpm exec tsc --noEmit 2>&1 | grep "journal/page" | head -10</automated>
  </verify>
  <done>
    - `const { plant } = plantResult;` appears before the `labels` block in `journal/page.tsx`
    - `t("titleFormat", { name: plant.nickname ?? plant.name })` is the call at the titleFormat line
    - `pnpm exec tsc --noEmit` reports zero errors in journal/page.tsx
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
| --- | --- |
| Service worker → cached pages | SW serves precached HTML documents to unauthenticated browser contexts |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
| --- | --- | --- | --- | --- |
| T-gc-01 | Tampering | sw.ts navigate handler | accept | Navigate handler is NetworkFirst — no cached response is served for requests that succeed online; offline serving is limited to precached same-origin routes already installed at SW install time |
| T-gc-02 | Information Disclosure | combobox onFocus opens listbox | accept | Listbox only shows user's own prior locations + i18n defaults; no server round-trip on open; no cross-user data exposure |
| T-gc-03 | Spoofing | toast.success on delete | accept | Toast is client-side confirmation of a server-confirmed DELETE response; no auth bypass path |

</threat_model>

<verification>
After all four tasks complete, run a full typecheck to confirm no regressions:

```bash
cd /Users/machado/Projects/folhario && pnpm exec tsc --noEmit 2>&1 | head -30
```

Run the sort-preference unit tests:

```bash
cd /Users/machado/Projects/folhario && pnpm vitest run src/app/\(app\)/catalog/_components/use-sort-preference.unit.test.tsx
```

Spot-check i18n key presence:

```bash
cd /Users/machado/Projects/folhario && grep -v '^#' src/messages/pt-BR.json | grep '"success"' | head -5
```
</verification>

<success_criteria>
- `usePatchPlantField.onSuccess` merges `data.plant` into `prev.plant` via spread — cover image survives PATCH round-trip
- `useDeletePlant.onSuccess` calls `toast.success(t("success"))` — delete shows success toast
- `catalog.profile.delete.success` key present in `src/messages/pt-BR.json`
- Combobox `<input>` has both `openListbox()` in `onFocus` and `onClick={() => openListbox()}`
- `useSortPreference` renders `"date_new"` on both server and client during initial hydration; stored preference applied after mount via `useEffect`
- `sw.ts runtimeCaching` starts with the navigate `NetworkFirst` entry before `...defaultCache`; standalone `registerCapture` for navigate removed
- `JournalPage` passes `{ name: plant.nickname ?? plant.name }` to `t("titleFormat")`
- `pnpm exec tsc --noEmit` exits cleanly
- All 5 `use-sort-preference.unit.test.tsx` tests pass
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-gap-closure-SUMMARY.md`
</output>
