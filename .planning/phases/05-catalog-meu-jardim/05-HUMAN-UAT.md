---
status: complete
phase: 05-catalog-meu-jardim
source: [05-VERIFICATION.md]
started: "2026-05-01T22:30:00Z"
updated: "2026-05-03T01:00:00Z"
---

## Current Test

[testing complete]

## Tests

### 1. Home + Catalog empty states render correctly (visual + a11y)

expected: Open `/catalog` as a user with 0 plants. Verify Home empty state ("Identifique sua primeira planta" + camera + "Adicionar manualmente") and Catalog empty state ("Sua estante ainda está esperando a primeira planta." + Canopy CTA) render with correct line-art / typography per PRD §17. Visual + screen-reader announcement matches spec.
result: pass

### 2. Catalog grid is responsive 2/3/4-col across breakpoints

expected: Add a plant manually. Verify the catalog grid is 2 cols at ≤375px, 3 cols at 600–899px, 4 cols at ≥900px. Default sort `acquisition_date` DESC NULLS LAST is applied. Breakpoints + sort hold across viewport resize.
result: pass

### 3. Plant profile inline-edit save/cancel/error flow

expected: On plant-profile, attempt inline-edit of name/nickname/location/acquisition_date/notes (tap-to-edit, blur-to-save, Esc-to-cancel). Verify optimistic UI + sonner failure toast on PATCH failure. Fields save on blur, revert on Esc.
result: issue
reported: "it works but the image disappears"
severity: major

### 4. Location picker shows saved + 8 defaults + free-text affordance

expected: Open the location-picker on plant-profile and on `/catalog/add`. Verify it shows prior user locations + 8 i18n defaults (sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro) + free-text "Adicionar '{typed}'" affordance. Combobox renders all three sources with APG keyboard nav; outside-click closes listbox.
result: issue
reported: "everything works except that the list only shows after I start typing inside the box. it doesn't show the list when I just click."
severity: major

### 5. Online → offline transition keeps catalog browseable, blocks identify

expected: Online → offline transition while browsing `/catalog` and `/catalog/[plantId]`. Verify offline banner appears, previously-loaded plants stay visible (Serwist SWR cache), identify is blocked with clear message. OFF-08 catalog browseable + identify blocked banner.
result: issue
reported: "no. the banner appears briefly then the whole page goes offline and I get the chrome dino"
severity: major

### 6. Plant-profile delete flow end-to-end (newly unblocked by Plan 05-20)

expected: Plant-profile delete flow on a real device. Tap overflow → "Excluir planta" → confirm sheet → confirm. CR-02 was blocking this in the prior cycle; Plan 05-20 closed it. This re-test confirms: plant disappears from grid, redirect to `/catalog`, cascade-counts preview correct in sheet. Delete completes; redirect to `/catalog`; toasts and cache invalidation behave correctly.
result: issue
reported: "no toast and I get this error: hydration failed because the server rendered text didn't match the client. CatalogHeader sort announcement mismatch: server='Catálogo reordenado por Adicionadas antigas' vs client='Catálogo reordenado por Adicionadas recentes'. src/app/(app)/catalog/_components/catalog-header.tsx:75"
severity: major

### 7. Lightbox carousel + thumbnail strip composition (advisory NEW-CR-01)

expected: Lightbox + thumbnail strip on a plant with ≥2 photos. The new code-review NEW-CR-01 (advisory, post-gap-closure) flagged that `listPhotoEntries` reverses to newest-first while `plant-profile.tsx:120,216,341` still slices(1) — newest photo may be missing from carousel; cover may render twice (once as cover, once via slice that includes oldest). Open lightbox from cover, swipe through carousel; verify (a) newest photo is reachable, (b) cover does not appear twice, (c) thumbnail strip below cover does not duplicate the cover.
result: issue
reported: "browser console warning: CSS chunk preloaded but not used — http://localhost:3000/_next/static/chunks/[root-of-the-server]__10azt31._.css preloaded but not used within a few seconds of window load"
severity: minor

### 8. Idempotency-Key behavior on photo-journal add retry (advisory NEW-CR-05)

expected: Idempotency-key behavior on photo-journal add when the network fails mid-request. Code-review NEW-CR-05 flagged that `journal-add-sheet.tsx:138,143` regenerates the key on retry — defeats the duplicate-protection purpose of the Idempotency-Keys table. Two POSTs of the same payload after a transient 5xx should reach the server with the SAME Idempotency-Key (server returns the previous response, no duplicate row). Currently the client may produce a fresh key, creating a duplicate PhotoEntry.
result: issue
reported: "yes, both headers used the same key. but I got this error when opening the journal page: FORMATTING_ERROR: The intl string context variable 'name' was not provided to the string '{name} — Diário' at JournalPage src/app/(app)/catalog/[plantId]/journal/page.tsx:38"
severity: major

## Summary

total: 8
passed: 2
issues: 6
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "No browser console warnings about unused preloaded CSS chunks"
  status: failed
  reason: "User reported: browser console warning: CSS chunk preloaded but not used — _next/static/chunks/[root-of-the-server]__10azt31._.css preloaded but not used within a few seconds of window load"
  severity: minor
  test: 7
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Delete flow redirects to /catalog with success toast; no hydration errors on return to catalog"
  status: failed
  reason: "User reported: no toast and I get this error: hydration failed because the server rendered text didn't match the client. CatalogHeader sort announcement mismatch: server='Catálogo reordenado por Adicionadas antigas' vs client='Catálogo reordenado por Adicionadas recentes'. src/app/(app)/catalog/_components/catalog-header.tsx:75"
  severity: major
  test: 6
  root_cause: ""
  artifacts:
    - path: "src/app/(app)/catalog/_components/catalog-header.tsx"
      issue: "Sort announcement text differs between SSR and client render — sort state initialized differently on server vs client"
  missing: []
  debug_session: ""

- truth: "Catalog and plant-profile pages remain visible from Serwist cache when going offline; offline banner stays visible and identify is blocked"
  status: failed
  reason: "User reported: no. the banner appears briefly then the whole page goes offline and I get the chrome dino"
  severity: major
  test: 5
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Location picker listbox opens on click/focus without requiring any typing"
  status: failed
  reason: "User reported: everything works except that the list only shows after I start typing inside the box. it doesn't show the list when I just click."
  severity: major
  test: 4
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Plant profile cover image remains visible during and after inline-edit of any field"
  status: failed
  reason: "User reported: it works but the image disappears"
  severity: major
  test: 3
  root_cause: ""
  artifacts: []
  missing: []
  debug_session: ""

- truth: "Journal page title renders correctly as '{plantName} — Diário' without i18n formatting errors"
  status: failed
  reason: "User reported: FORMATTING_ERROR: The intl string context variable 'name' was not provided to the string '{name} — Diário' at JournalPage src/app/(app)/catalog/[plantId]/journal/page.tsx:38"
  severity: major
  test: 8
  root_cause: ""
  artifacts:
    - path: "src/app/(app)/catalog/[plantId]/journal/page.tsx"
      issue: "t('titleFormat') called without passing { name: plant.name } interpolation variable"
  missing: []
  debug_session: ""
