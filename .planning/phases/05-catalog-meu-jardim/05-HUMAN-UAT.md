---
status: partial
phase: 05-catalog-meu-jardim
source: [05-VERIFICATION.md]
started: "2026-05-01T22:30:00Z"
updated: "2026-05-01T22:30:00Z"
---

## Current Test

[awaiting human testing]

## Tests

### 1. Home + Catalog empty states render correctly (visual + a11y)

expected: Open `/catalog` as a user with 0 plants. Verify Home empty state ("Identifique sua primeira planta" + camera + "Adicionar manualmente") and Catalog empty state ("Sua estante ainda está esperando a primeira planta." + Canopy CTA) render with correct line-art / typography per PRD §17. Visual + screen-reader announcement matches spec.
result: [pending]

### 2. Catalog grid is responsive 2/3/4-col across breakpoints

expected: Add a plant manually. Verify the catalog grid is 2 cols at ≤375px, 3 cols at 600–899px, 4 cols at ≥900px. Default sort `acquisition_date` DESC NULLS LAST is applied. Breakpoints + sort hold across viewport resize.
result: [pending]

### 3. Plant profile inline-edit save/cancel/error flow

expected: On plant-profile, attempt inline-edit of name/nickname/location/acquisition_date/notes (tap-to-edit, blur-to-save, Esc-to-cancel). Verify optimistic UI + sonner failure toast on PATCH failure. Fields save on blur, revert on Esc.
result: [pending]

### 4. Location picker shows saved + 8 defaults + free-text affordance

expected: Open the location-picker on plant-profile and on `/catalog/add`. Verify it shows prior user locations + 8 i18n defaults (sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro) + free-text "Adicionar '{typed}'" affordance. Combobox renders all three sources with APG keyboard nav; outside-click closes listbox.
result: [pending]

### 5. Online → offline transition keeps catalog browseable, blocks identify

expected: Online → offline transition while browsing `/catalog` and `/catalog/[plantId]`. Verify offline banner appears, previously-loaded plants stay visible (Serwist SWR cache), identify is blocked with clear message. OFF-08 catalog browseable + identify blocked banner.
result: [pending]

### 6. Plant-profile delete flow end-to-end (newly unblocked by Plan 05-20)

expected: Plant-profile delete flow on a real device. Tap overflow → "Excluir planta" → confirm sheet → confirm. CR-02 was blocking this in the prior cycle; Plan 05-20 closed it. This re-test confirms: plant disappears from grid, redirect to `/catalog`, cascade-counts preview correct in sheet. Delete completes; redirect to `/catalog`; toasts and cache invalidation behave correctly.
result: [pending]

### 7. Lightbox carousel + thumbnail strip composition (advisory NEW-CR-01)

expected: Lightbox + thumbnail strip on a plant with ≥2 photos. The new code-review NEW-CR-01 (advisory, post-gap-closure) flagged that `listPhotoEntries` reverses to newest-first while `plant-profile.tsx:120,216,341` still slices(1) — newest photo may be missing from carousel; cover may render twice (once as cover, once via slice that includes oldest). Open lightbox from cover, swipe through carousel; verify (a) newest photo is reachable, (b) cover does not appear twice, (c) thumbnail strip below cover does not duplicate the cover.
result: [pending]

### 8. Idempotency-Key behavior on photo-journal add retry (advisory NEW-CR-05)

expected: Idempotency-key behavior on photo-journal add when the network fails mid-request. Code-review NEW-CR-05 flagged that `journal-add-sheet.tsx:138,143` regenerates the key on retry — defeats the duplicate-protection purpose of the Idempotency-Keys table. Two POSTs of the same payload after a transient 5xx should reach the server with the SAME Idempotency-Key (server returns the previous response, no duplicate row). Currently the client may produce a fresh key, creating a duplicate PhotoEntry.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
