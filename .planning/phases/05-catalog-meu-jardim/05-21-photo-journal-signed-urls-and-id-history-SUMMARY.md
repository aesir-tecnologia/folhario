---
phase: 05-catalog-meu-jardim
plan: 21
subsystem: catalog
tags:
  - catalog
  - photo-journal
  - signed-urls
  - plant-profile
  - id-history-placeholder
  - gap-closure
gap_closure: true
requires:
  - 05-20 (cover_signed_url field on plant detail; same wave-2 partner shipped first)
  - 05-10 (TanStack Query photoEntries cache + IDB persister consumer)
  - 05-08 (catalog route handlers: GET /api/v1/plants/:plantId/photo-entries)
  - 05-07 (listPhotoEntries use-case)
provides:
  - photoSignedUrl + thumbnailSignedUrl on listPhotoEntries result rows (24h-TTL)
  - photo_signed_url + thumbnail_signed_url on PhotoEntrySnakeCase mapper (and GET /photo-entries response)
  - catalog.profile.sections.history + catalog.profile.history.empty i18n keys
  - ID-history placeholder section structurally present in plant-profile (Phase-6 swap target)
affects:
  - photo-journal lightbox (`src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx`) — lightbox `src` now reads signed URL
  - plant-profile gallery (`src/app/(app)/catalog/[plantId]/plant-profile.tsx`) — `allPhotos` mapping now reads signed URL on non-cover entries
tech-stack:
  added: []
  patterns:
    - "Promise.all parallel signing of photo + thumbnail in list use-case (replaces serial single-thumbnail signing)"
    - "Snake-case mapper accepts augmented row type with optional signed-url props (PhotoEntryRow & { photoSignedUrl?, thumbnailSignedUrl? })"
    - "Client-side signed-URL fallback chain (e.photo_signed_url ?? e.photo_url) preserves journal-add-sheet ObjectURL temp-entry shape"
    - "ID-history placeholder ships structurally so Phase-6 swaps body copy + adds link without DOM-shape changes"
key-files:
  created: []
  modified:
    - src/contexts/catalog/application/list-photo-entries.ts (use-case signs both URLs, augments result)
    - src/contexts/catalog/api/snake-case.ts (mapper emits *_signed_url; input type accepts optional signed props)
    - src/app/api/v1/plants/[plantId]/photo-entries/route.ts (GET inline-map replaced with toPhotoEntrySnakeCase)
    - src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx (PhotoEntry type + lightbox src)
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx (PhotoEntrySnakeCase type + allPhotos branches + ID-history section)
    - src/messages/pt-BR.json (sections.history + history.empty keys)
    - tests/integration/catalog-list-photo-entries.integration.test.ts (Test 5 RED)
    - tests/integration/catalog-routes-read-create.integration.test.ts (Test 5.4 RED)
decisions:
  - "Preserve thumbnailUrl as the signed URL on the use-case result (Phase-5 legacy carry-over) — Test 3 of catalog-list-photo-entries pins this shape; renaming would cascade into 05-10 IDB persister + journal consumers. New code consumes thumbnailSignedUrl explicitly; legacy override stays until Phase 6+ stabilizes the new field name."
  - "Preserve photoUrl as raw {bucket}/{key} on the use-case result (do NOT mirror the thumbnailUrl override). delete-photo-entry.ts:123 reads from the DB row directly via extractObjectKey, so the use-case shape doesn't impact deletion — but keeping photoUrl raw on the use-case row also keeps the contract explicit (raw input, signed output as a separate field)."
  - "ID-history placeholder shows in both readOnly and read-write modes (no useSubscription gate). The section is read-only by definition (it's a Phase-6 swap point); gating it would create reading-order divergence between modes that screen-reader users would notice."
  - "history.empty copy chosen as 'O histórico de identificações ainda não está disponível.' (terse, version-neutral) per planner discretion clause — avoids 'após a Fase 6' phrasing that leaks internal phasing to end users."
  - "GET route inline mapping replaced with toPhotoEntrySnakeCase mapper for consistency with POST handler (POST already uses the mapper at route.ts:112). DRY win + auto-propagation of any future PhotoEntrySnakeCase additions."
metrics:
  duration_minutes: 9
  tasks_completed: 3
  commits: 4
  tests_added: 2
  tests_run: 52
  tests_pass: 52
  files_modified: 7
  files_created: 0
  completed_at: "2026-05-01"
---

# Phase 5 Plan 21: Photo-Journal Signed URLs + ID-History Placeholder Summary

CR-03 closed: `listPhotoEntries` now signs both `photoUrl` and `thumbnailUrl` in parallel (24h TTL each), the snake-case mapper emits `photo_signed_url` + `thumbnail_signed_url`, and the photo-journal lightbox + plant-profile gallery consume the signed URLs with raw bucket-key fallback. ID-history placeholder section ships structurally with new i18n keys, restoring UI-SPEC §6 Section 5 reading order so Phase 6 only needs to swap copy + add a link — not change the DOM shape.

## Objective Reached

The two gaps flagged by the verifier (`05-VERIFICATION.md`) and the planning checkpoint are closed:

1. **CR-03 (CRITICAL):** Lightbox + gallery `<img src>` is no longer the raw `{bucket}/{key}` string. SC-4 photo-journal full-size view now renders the actual signed URL.
2. **ID-history placeholder (UI-08):** UI-SPEC §6 Section 5 is structurally present (label + body copy, no link). Reading order, scroll position, and a11y heading outline match Phase-6 target.

## Tasks Executed

### Task 1 (TDD RED + GREEN) — Backend signed URLs

**RED commit:** `affc361 test(05-21): add failing tests for listPhotoEntries signed URLs (CR-03 RED)`

- Added `Test 5 (CR-03)` to `catalog-list-photo-entries.integration.test.ts` — asserts result items expose `photoSignedUrl` + `thumbnailSignedUrl` (property-bag check via `toHaveProperty` so the test typechecks before the use-case ships the new fields).
- Added `Test 5.4 (CR-03: photo_signed_url surfaces in GET response items)` to `catalog-routes-read-create.integration.test.ts` — pre-seeds in-memory storage with photo + thumbnail bytes, asserts response items include both `photo_signed_url` and `thumbnail_signed_url`.
- Verified RED: 2 tests fail with `AssertionError: expected ... to have property "photoSignedUrl"` / `"photo_signed_url"`. All 38 pre-existing tests in the two files pass unchanged.

**GREEN commit:** `7deb2ce feat(05-21): listPhotoEntries signs both photoUrl + thumbnailUrl; snake-case mapper emits *_signed_url fields (CR-03 backend)`

- `listPhotoEntries`: result row gains `photoSignedUrl` + `thumbnailSignedUrl`. Both URLs signed in parallel via `Promise.all([signCatalogPhotoUrl(thumbnail), signCatalogPhotoUrl(photo)])` per row. `thumbnailUrl` preserved as the signed URL (Phase-5 legacy carry-over for existing consumers + Test 3 invariant). `photoUrl` preserved as raw `{bucket}/{key}` (delete-photo-entry path reads from DB row directly, but keeping the use-case shape explicit).
- `toPhotoEntrySnakeCase`: input type widened to `PhotoEntryRow & { photoSignedUrl?: string | null; thumbnailSignedUrl?: string | null }`. Output type gains `photo_signed_url` + `thumbnail_signed_url`. Optional input fields default to `null` when absent — POST handler call site (`toPhotoEntrySnakeCase(usecase.photoEntry)`) compiles unchanged because `photoEntry` is the bare `PhotoEntryRow`; mapper emits null for the new fields.
- GET route handler (`src/app/api/v1/plants/[plantId]/photo-entries/route.ts`): inline `items.map(...)` (was lines 159-167) replaced with `items: result.items.map((item) => toPhotoEntrySnakeCase(item))`. The augmented item type carries `photoSignedUrl` + `thumbnailSignedUrl`; the mapper picks them up automatically.
- Verified GREEN: 52 tests across 4 integration files (`catalog-list-photo-entries`, `catalog-routes-read-create`, `catalog-create-photo-entry`, `catalog-delete-photo-entry`) all pass; typecheck clean.

### Task 2 — Frontend wiring

**Commit:** `6d34735 feat(05-21): photo-journal lightbox + plant-profile gallery consume photo_signed_url (CR-03 frontend)`

- `photo-journal.tsx` `PhotoEntry` type gains optional `photo_signed_url?: string | null` + `thumbnail_signed_url?: string | null`. `lightboxPhotos` mapping uses `e.photo_signed_url ?? e.photo_url` — signed URL primary, raw bucket-key fallback only when the server didn't sign (e.g. journal-add-sheet temp entries with ObjectURL strings).
- `plant-profile.tsx` `PhotoEntrySnakeCase` type mirrored. `allPhotos` mapping updated in both branches: cover-present branch (line 118 `photoEntries.slice(1)`) and no-cover branch (line 124 `photoEntries.map`). Cover continues to use `plant.cover_signed_url` (already signed by Plan 05-20).
- Verified: 16 unit tests in `tests/unit/photo-journal.test.tsx` + `tests/unit/use-plant-profile-mutations.test.tsx` pass unchanged. Typecheck clean.

### Task 3 — ID-history placeholder + i18n

**Commit:** `fe27265 feat(05-21): plant-profile renders ID-history placeholder section + new i18n keys (UI-08)`

- `pt-BR.json` adds `catalog.profile.sections.history` (`"HISTÓRICO DE IDENTIFICAÇÃO"`) following the existing all-caps tracking-widest pattern alongside `sections.reminders` and `sections.journal`. Adds `catalog.profile.history.empty` (`"O histórico de identificações ainda não está disponível."`) — terse, version-neutral copy per planner discretion clause (avoids leaking internal "Fase 6" phasing).
- JSON validated via `JSON.parse(...)`.
- `plant-profile.tsx` adds new `<section className="px-4 py-4">` between the photo-journal preview (closes line 370) and the Lightbox (line 372+). Matches the reminders section pattern (`h2.text-xs.font-semibold.tracking-widest.text-slate` + body `p.text-sm.text-slate`). No CTA, no link, no `!readOnly &&` gate.
- A11y: heading outline now has three siblings under the profile (Lembretes ativos / Diário de fotos / Histórico de identificação), so screen-reader navigation matches the visual outline. Phase 6 swaps the body copy + adds a `Link` without changing this DOM shape.
- Typecheck clean.

## Verification

```
pnpm typecheck                                       → ok (0 errors)
node -e "JSON.parse(...pt-BR.json)"                  → json ok
pnpm exec vitest run --project=integration \
  catalog-list-photo-entries.integration.test.ts \
  catalog-routes-read-create.integration.test.ts \
  catalog-create-photo-entry.integration.test.ts \
  catalog-delete-photo-entry.integration.test.ts     → 52 / 52 passed
pnpm exec vitest run --project=unit-dom \
  tests/unit/photo-journal.test.tsx \
  tests/unit/use-plant-profile-mutations.test.tsx    → 16 / 16 passed
```

Acceptance grep gates:

```
grep -c "photoSignedUrl" src/contexts/catalog/application/list-photo-entries.ts                        → 2 (>=2)
grep -c "photo_signed_url" src/contexts/catalog/api/snake-case.ts                                       → 2 (>=2)
grep -c "toPhotoEntrySnakeCase" src/app/api/v1/plants/[plantId]/photo-entries/route.ts                  → 3 (>=2)
grep -c "photo_signed_url" src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx                    → 2 (>=2)
grep -c "photo_signed_url" src/app/(app)/catalog/[plantId]/plant-profile.tsx                            → 3 (>=2)
grep -c "history.empty" src/messages/pt-BR.json                                                         → 5 (>=1)
grep -c "sections.history" src/app/(app)/catalog/[plantId]/plant-profile.tsx                            → 1 (>=1)
```

All gates pass.

## Deviations from Plan

None — plan executed exactly as written. The advisor's two pre-execution flags were honored:

1. **Integration env loading.** Vite's auto `.env.local` load was incomplete in this worktree (only `DATABASE_POOL_URL` and `NEXT_PUBLIC_SUPABASE_URL` propagated; `SUPABASE_SERVICE_ROLE_KEY` did not, causing `supabaseKey is required` on first attempt). Resolved by `set -a && source .env.local && set +a` before each `npx vitest run` invocation. RED gate observed empirically (2 failures, not skipped). No code change.
2. **RED test typecheck.** RED assertions intentionally use `as Record<string, unknown>` + `toHaveProperty` instead of typed property access, so the failing test compiles cleanly against the pre-GREEN `ListPhotoEntriesResult` type. Plan-allowed pattern; no change to plan text required.

## Threat Model Mitigations Verified

| Threat ID  | Mitigation                                                                                       | Status                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| T-05-21-01 | 24h TTL bounds blast radius if signed URL leaks via PostHog/Sentry                               | Met — `SIGN_TTL_SECONDS = 24 * 3600` unchanged; D-21 telemetry contract already redacts `/api/v1/*` response bodies.                |
| T-05-21-02 | Client falls back to raw `e.photo_url` when signing fails so failure is visible (not silent)     | Met — `lightboxPhotos` and `allPhotos` branches both use `?? e.photo_url` / `?? pe.photo_url`. Broken image surfaces signing failure. |
| T-05-21-03 | Cross-user signed URLs cannot be generated (RLS + ownership check before signing)                | Met (existing) — `plantsRepo.findByIdForUser` ownership gate runs before the parallel signing block.                                |
| T-05-21-04 | Placeholder copy doesn't leak Phase-6 plans                                                      | Met — chose version-neutral copy "ainda não está disponível" instead of suggested "após a Fase 6".                                 |

## TDD Gate Compliance

Plan-level TDD scope per `<objective>` is Task 1 only (use-case + route layer). Tasks 2-3 ship as plain `feat` commits (mechanical UI wiring + i18n; no behavior to drive via tests). Gate sequence verified in git log:

```
affc361 test(05-21): add failing tests for listPhotoEntries signed URLs (CR-03 RED)
7deb2ce feat(05-21): listPhotoEntries signs both photoUrl + thumbnailUrl ... (GREEN)
6d34735 feat(05-21): photo-journal lightbox + plant-profile gallery ... (Task 2)
fe27265 feat(05-21): plant-profile renders ID-history placeholder ... (Task 3)
```

RED gate (`test(05-21): ...`) precedes GREEN gate (`feat(05-21): ... CR-03 backend`). REFACTOR gate skipped — GREEN is minimal (single Promise.all rewrite + mapper extension); zero duplication to clean up.

## Self-Check: PASSED

- [x] `tests/integration/catalog-list-photo-entries.integration.test.ts` — Test 5 added (RED commit affc361, passing in GREEN commit 7deb2ce)
- [x] `tests/integration/catalog-routes-read-create.integration.test.ts` — Test 5.4 added (RED commit affc361, passing in GREEN commit 7deb2ce)
- [x] `src/contexts/catalog/application/list-photo-entries.ts` — modified (commit 7deb2ce; `grep "photoSignedUrl"` returns 2)
- [x] `src/contexts/catalog/api/snake-case.ts` — modified (commit 7deb2ce; `grep "photo_signed_url"` returns 2)
- [x] `src/app/api/v1/plants/[plantId]/photo-entries/route.ts` — modified (commit 7deb2ce; uses `toPhotoEntrySnakeCase`)
- [x] `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx` — modified (commit 6d34735; `grep "photo_signed_url"` returns 2)
- [x] `src/app/(app)/catalog/[plantId]/plant-profile.tsx` — modified (commit 6d34735 + fe27265; `grep "photo_signed_url"` returns 3, ID-history section grep "sections.history" returns 1)
- [x] `src/messages/pt-BR.json` — modified (commit fe27265; sections.history + history.empty present, valid JSON)
- [x] All 4 commits exist in git log between e507e2a and HEAD: affc361, 7deb2ce, 6d34735, fe27265
- [x] No file deletions in any of the 4 commits
- [x] Plan verification command exits 0 (52 / 52 integration tests pass; typecheck clean; pt-BR.json valid)
