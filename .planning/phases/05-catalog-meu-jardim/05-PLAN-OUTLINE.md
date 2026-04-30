---
phase: 5
slug: catalog-meu-jardim
mode: outline-only
plan_count: 18
generated: 2026-04-29
generator: gsd-plan-phase (chunked outline-only)
---

# Phase 5 — Plan Outline

> Chunked planning artifact. The 18 plans below are the canonical IDs from `ROADMAP.md` § Phase 5. This document fixes the wave assignment, dependency graph, and per-plan requirement coverage so each PLAN.md can be drafted independently in subsequent passes without recomputing topology.

## Deviations from Orchestrator Wave Guidance

Three refinements applied (all called out in advisor pass before write):

1. **05-04 moved to Wave 2** (was Wave 1 in orchestrator hint).
   - Reason: 05-04 ships the catalog domain Zod schemas, which are derived (via `drizzle-zod`) from the two new tables introduced by 05-02 (`pending_storage_deletions`, `location_suggestions`). Same-wave placement contradicts the parenthetical "depends on schema" in the orchestrator's own hint.
   - Effect: shifts 05-04's `depends_on` to `[05-02]`. No downstream wave changes (05-04 was already required upstream of 05-05 and 05-07 in Wave 2/3).

2. **CAT-01 mapped to 05-05 as contributor** (Phase 6 closes).
   - Reason: CAT-01 ("Plant created from identification + selected result, `species_id` populated, name pre-filled, cover from ID upload") is explicitly OUT of Phase 5 scope per `05-CONTEXT.md` line 16. But it appears in the orchestrator's required-IDs list and `REQUIREMENTS.md` row 363 still tags it as Phase 5 (pending). RESEARCH.md row 80 prescribes the contract: `create-plant.ts` use-case ships with a `source: 'manual' | 'identification'` discriminator here; Phase 6 invokes the same use-case with `source: 'identification'`.
   - Resolution: 05-05 lists CAT-01 in its `requirements` field with a note that this is a **contributor** (the from-identification code path is shipped; only the `source: 'manual'` branch is exercised in Phase 5). Phase 6 marks CAT-01 complete. This mirrors the OBS-02 (Plan 01-06 contributes / 01-07 completes) and LGPD-13 (Plan 01-05a contributes / 01-05b completes) pattern already used by the project per STATE.md.
   - Self-check satisfied: every Phase 5 requirement ID is mapped to ≥1 plan (no source-audit gap).

3. **05-11 (useSubscription stub) added to `depends_on` of 05-15, 05-16, 05-17, 05-18.**
   - Reason: D-21 specifies read-only-mode flips affordances on every catalog UI surface — Add Plant button hidden, inline-edit fields disabled, delete overflow hidden, `+ Foto` hidden, `<ReadOnlyBanner>` flipped on. All four UI plans consume the stub. Honest dependency graph; does NOT change wave assignment because 05-11 is Wave 1 (no deps).

## Required Reading For Each PLAN.md Draft

Every PLAN.md draft pass MUST load these:

- `.planning/STATE.md` — current decisions + blockers
- `.planning/REQUIREMENTS.md` — for the specific REQ-IDs the plan covers
- `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` — D-01..D-29 (locked)
- `.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md` — sections matching the plan's scope
- `.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md` — `read_first` analog files
- `.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md` — UI plans only (05-12..05-18)
- `.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md` — Per-Task Verification Map (Nyquist sampling)
- `CLAUDE.md` — project rules

## Threat Model Surface (ASVS L1) — Per-Plan

Each PLAN.md MUST include `<threat_model>` STRIDE register. Surfaces of concern flagged by orchestrator:

| Surface                                              | Plans Affected            | STRIDE Categories |
|------------------------------------------------------|---------------------------|-------------------|
| Signed-URL TTL leakage                               | 05-07, 05-08, 05-09, 05-18 | I (Information Disclosure) |
| IDB cache poisoning across users on shared device    | 05-10                     | T (Tampering), I  |
| RLS bypass via cursor manipulation                   | 05-03, 05-07, 05-08       | E (Elevation)     |
| Idempotency-key collisions                           | 05-08, 05-09              | T, R (Repudiation)|
| Multipart upload size / EXIF leakage                 | 05-08, 05-09              | I, D (DoS)        |
| Plant deletion race exposing other users' data via prefix mis-scope | 05-06, 05-09 | E, I    |

`block_on_high: true` per ASVS L1 — any high-severity threat without a `mitigate` disposition fails the plan.

## TDD Mode

Per orchestrator and `RESEARCH.md`, **TDD candidates** (deterministic I/O — repositories, use-cases, validation, primitives with testable contracts):

- **05-03** (catalog repositories) — RED/GREEN/REFACTOR per repo function
- **05-04** (Zod schemas) — RED/GREEN per refinement (`createPlantInputSchema` cross-field, `updatePlantInputSchema` partial, cursor codec)
- **05-05** (plant create use-case) — RED/GREEN around compensating-delete + post-commit telemetry contract
- **05-06** (delete + Inngest cleanup) — RED/GREEN around cascade contract + reconciler state machine
- **05-07** (PATCH/PhotoEntry/cover use-cases + listing) — RED/GREEN per use-case
- **05-12** (Combobox primitive) — RED for APG keyboard contract; GREEN for component
- **05-13** (BottomSheet primitive) — RED for focus trap + return focus; GREEN for component
- **05-14** (Lightbox + InlineEditField primitives) — RED per behavior

All other plans use `type: execute` (route-handler glue, SSR pages, configuration, fixtures). UI surface plans (05-15..05-18) are still `type: execute` because their behavior is verified via Playwright E2E + axe-core scans — those test types are end-of-task gates, not RED/GREEN drivers.

## Schema Push Requirement (BLOCKING)

Per orchestrator: 05-02 ships the only DB schema modifications in Phase 5. The PLAN MUST include a `[BLOCKING]` task that runs `pnpm db:migrate` (or `npx drizzle-kit push` per project convention — verify against Plan 04-02's pattern; STATE.md notes 04-02 used `migrate` not `push` per Codex HIGH #1) AFTER all schema file modifications are complete but BEFORE verification. Mark `autonomous: true` (the script is non-interactive locally).

## Plan Outline Table

| Plan ID | Objective | Wave | Depends On | Requirements |
|---------|-----------|------|------------|--------------|
| `05-01-wave0-test-infra` | Wave 0 test infra: install `fake-indexeddb` + TanStack v5 deps; `tests/unit/setup-idb.ts` (`fake-indexeddb/auto` + per-test `IDBFactory` reset); extend `tests/integration/setup.ts` to swap in `InMemoryStorageAdapter` via `__setStorageAdapterForTests`; `tests/e2e/fixtures/authed-user.ts` (server-side `supabase.auth.admin.createUser` + verified user + ConsentLog ×2 + trial Subscription + cookie injection); `tests/e2e/fixtures/read-only.ts` (env-driven stub flip per RESEARCH Open Q1); extend `vitest.config.ts` `unit-dom` `setupFiles`. Per D-25, D-26, D-27. | 0 | (none) | (foundation — no REQ owned; unblocks every later plan's automated verify) |
| `05-02-pending-deletions-schema-cursor` | Schema additions: extend `src/contexts/catalog/infrastructure/db/schema.ts` with `pending_deletion_status` pgEnum + `pending_storage_deletions` table (D-23) + `location_suggestions` table (D-09); two new Drizzle migrations (`XXXX_add_pending_storage_deletions.sql`, `XXXX_add_location_suggestions.sql`) with idempotent owner-only RLS policy blocks following Plan 02's pattern. **[BLOCKING] task runs `pnpm db:migrate` (NOT push, per Plan 04-02 / Codex HIGH #1) after both schema files committed.** Cursor extension: extend `src/shared/api/cursor.ts` (or new `list-plants-cursor.ts`) with `{sort_id, last_value, last_id}` opaque cursor + NULLS LAST sentinel handling per D-12 (RESEARCH Open Q1 resolution). | 1 | `05-01` | CAT-09 (storage scheduling row, partial), CAT-12-cursor (n/a — supports CAT-07/08), OFF-08 (cursor used by SWR cache key) |
| `05-03-catalog-repositories` | Catalog repositories (TDD): extend `src/contexts/catalog/infrastructure/db/plants.ts` with `list({sort, cursor, limit})`, `create`, `update`, `delete`, `countForUser`, `getCascadeCounts`; extend `src/contexts/catalog/infrastructure/db/photo-entries.ts` with `list({plantId})`, `create`, `delete`, `bumpCoverFor(plantId)` (D-03); NEW `pending-storage-deletions.ts` repo with `create`, `markInProgress`, `markCompleted`, `recordError`, `markFailed`, `fetchPendingBatch(50)` using `FOR UPDATE SKIP LOCKED` (D-24) + service-role client per RESEARCH Pitfall 4; NEW `location-suggestions.ts` repo with `upsert(userId, label)` (D-09 ON CONFLICT increment) and `listForUser(userId, 20)` ordered by `usage_count DESC, last_used_at DESC`. RLS owner-only integration tests for both new tables. | 2 | `05-02` | CAT-05 (locations repo), CAT-07, CAT-08, CAT-09 |
| `05-04-domain-zod-schemas` | Domain Zod schemas (TDD): extend `src/contexts/catalog/domain/schemas.ts` with refined `createPlantInputSchema` (cross-field `.superRefine` — name AND photo required per D-04 / CAT-03), `updatePlantInputSchema` (partial single-field per D-05), `createPhotoEntryInputSchema` (file + optional note); NEW `validateStoragePathOwnership({userId, plantId, key}: ...)` helper in `src/contexts/catalog/domain/storage-paths.ts` (defends against prefix-mis-scope deletion race per orchestrator threat surface). All schemas drizzle-zod-derived per Phase 2 D-19. | 2 | `05-02` | CAT-02, CAT-03 |
| `05-05-plant-create-use-cases` | Plant create use-cases (TDD): NEW `src/contexts/catalog/application/create-plant.ts` accepting `{source: 'manual' \| 'identification', userId, name, photo, ...optional}` discriminated input; ships compensating-delete pattern from `upload-photo.ts:217`; UoW TX-atomic Plant + first PhotoEntry insert; `tx.afterCommit` PostHog `plant_added` capture (D-28) + `plant.created` Inngest event emit. **CAT-01 contributor:** the `source: 'identification'` branch ships here (cover from ID upload, name pre-fill, `species_id` accepted) but is invoked only by Phase 6 — Phase 5 only exercises `source: 'manual'`. CAT-01 close happens in Phase 6. | 2 | `05-03`, `05-04` | CAT-01 (contributor — Phase 6 completes), CAT-02, CAT-03 |
| `05-06-plant-delete-inngest-cleanup` | Plant delete + Inngest catalog/cleanup-storage: NEW `src/contexts/catalog/application/delete-plant.ts` (TDD) — UoW TX cascades PhotoEntry + Reminder rows, sets `Identification.plant_id = NULL` (preserving history), INSERTs two `pending_storage_deletions` rows (plant-photos + plant-thumbnails buckets, prefix `{userId}/{plantId}/`), commits, then emits `plant.deleted` Inngest event + `plant_deleted` PostHog capture; NEW `src/contexts/catalog/inngest/functions.ts` exporting `cleanupStorage` (event handler — RetryAfterError backoff per RESEARCH Pattern 5) + `cleanupStorageReconciler` (hourly cron, batch 50, max 5 attempts, 5min→30min→4h→24h→72h backoff per D-24); register in `src/shared/inngest/registry.ts` (RESEARCH Open Q2 — grep registry shape at write time). Reconciler uses service-role client per Pitfall 4. | 2 | `05-03` | CAT-09 |
| `05-07-patch-photo-entry-cover-use-cases` | Remaining catalog use-cases (TDD): `update-plant.ts` (PATCH single-field, optimistic LWW per D-06, fires `plant_edited` PostHog after commit per D-29; upserts `location_suggestions` if `location` field is the dirty field), `get-plant.ts` (returns plant + `_meta: {photo_entry_count, reminder_count}` for D-07 confirm sheet), `list-plants.ts` (cursor pagination per D-12; gated `?include_count=1` first-page total), `list-photo-entries.ts` (signed thumbnail URLs at 24h TTL via `signCatalogPhotoUrl`), `create-photo-entry.ts` (D-15 multipart flow reusing upload-photo compensating-delete pattern), `delete-photo-entry.ts` (D-03 cover auto-promote in same TX), `list-locations.ts` (D-09 + D-10 merged: DB suggestions + i18n defaults from `messages/pt-BR.json` `catalog.locations.defaults`). | 2 | `05-03`, `05-04` | CAT-04, CAT-05, CAT-06, CAT-07, CAT-08 |
| `05-08-route-handlers-read-create` | Route handlers — read + create endpoints: `POST /api/v1/plants` (multipart per D-02; `withIdempotency` first consumer per Phase 2 D-37); `GET /api/v1/plants` (cursor + `?include_count=1` first-page total); `GET /api/v1/plants/[plantId]`; `POST /api/v1/plants/[plantId]/photo-entries` (D-15 multipart + `withIdempotency`); `GET /api/v1/plants/[plantId]/photo-entries`; `GET /api/v1/locations`. All gated by `requireVerifiedUser` (Phase 4 D-21 — first route consumer). No Drizzle imports (Phase 2 D-17). snake_case JSON per PRD §5. | 3 | `05-05`, `05-07` | CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08 |
| `05-09-route-handlers-mutate-delete` | Route handlers — mutate + delete endpoints: `PATCH /api/v1/plants/[plantId]` (D-05 single-field + `withIdempotency`); `DELETE /api/v1/plants/[plantId]` (D-22 trigger); `DELETE /api/v1/photo-entries/[photoEntryId]` (D-03 cover auto-promote trigger). `requireVerifiedUser` on all three. Closed error registry only (`validation_failed`, `not_found`, `forbidden`, `read_only_mode`, `subscription_required`). | 3 | `05-06`, `05-07` | CAT-04, CAT-06, CAT-09 |
| `05-10-tq-provider-idb-persister-i18n` | TanStack Query v5 + IDB persister + i18n catalog namespace: install `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `idb-keyval` (deferred from 05-01 to keep Wave 0 lean per orchestrator); NEW `src/shared/ui/query-provider.tsx` (`PersistQueryClientProvider` + `idb-keyval` AsyncStorage adapter + `shouldDehydrateQuery` allowlist `['catalog','plants'\|'plant'\|'photo-entries'\|'locations']` + `maxAge: 24h` + `buster` deploy hash per RESEARCH Pitfall 1); NEW `src/shared/ui/storage-budget-guard.ts` (`navigator.storage.estimate()` LRU eviction at 0.8 threshold, SSR-guarded per Pitfall 7); NEW `src/contexts/catalog/queries/index.ts` (Tkdodo factory: `plantsKeys.lists/detail/photoEntries`, `locationsKeys.all`); mount `<QueryProvider>` inside `(app)/layout.tsx` after auth gate; extend `messages/pt-BR.json` `catalog.*` namespace per UI-SPEC §Copywriting Contract (RESEARCH Open Q3 resolution). | 3 | (none — has no code dependency on use-cases beyond type imports; can run in parallel with 05-08/05-09 once schemas exist) | OFF-08 (TQ persister is half the offline story) |
| `05-11-use-subscription-stub` | `useSubscription()` stub + read-only mode test harness: NEW `src/contexts/billing/application/use-subscription.ts` returning `{active: true, readOnly: false}` constant (D-21); environment-variable-driven flip via `SUBSCRIPTION_READ_ONLY=1` (RESEARCH Open Q1 resolution — matches Phase 1 `IDENTIFICATION_PROVIDER_MODE=stub` pattern); unit tests confirm constant return shape; integration into `tests/e2e/fixtures/read-only.ts` (already created in 05-01 — this plan wires the env-flip target). | 1 | (none) | (supports CAT-04, CAT-06, CAT-09 read-only variants; no REQ owned) |
| `05-12-combobox-primitive` | Combobox primitive (TDD): NEW `src/shared/ui/combobox.tsx` per WAI-ARIA APG 1.2 (D-08, ~200 LOC) — `useId` for ids, `aria-controls`, `aria-expanded`, `aria-activedescendant`, full keyboard map (Arrow/Home/End/Esc/Enter/printable typeahead per RESEARCH Pattern 7); composed `<LocationCombobox>` wrapper merging user suggestions + i18n defaults (D-10) with "Adicionar '{typed}'" ghost row (UI-SPEC §10/§11). axe-core a11y gate (0 serious/critical violations) + Vitest unit-dom keyboard-contract tests. | 1 | (none) | CAT-05 |
| `05-13-bottom-sheet-primitive` | BottomSheet primitive [BLOCKING axe + VoiceOver/TalkBack manual gate] (RESEARCH Open Q5 resolution): NEW `src/shared/ui/bottom-sheet.tsx` extending Phase 3 ModalSheet for Phase 5's two consumers (delete-confirm sheet D-07; photo-journal add sheet D-15); focus trap + return focus + drag handle + visible Fechar (PRD §17 visible close required); axe-modal-focus-trap.spec.ts pattern reused; VALIDATION.md tags this as a manual-only gate (`BottomSheet VoiceOver / TalkBack announcement` for UI-04, UI-08) — plan adds the manual checkpoint after axe automated. | 1 | (none) | UI-08 (delete confirm sheet), UI-11 (photo journal add sheet) |
| `05-14-lightbox-inline-edit-primitives` | Lightbox + InlineEditField primitives (TDD; orchestrator Pitfall 6 a11y guard): NEW `src/shared/ui/lightbox.tsx` (D-14, ~150 LOC) — Radix Dialog wrap + horizontal swipe via touch events + visible Fechar + reduced-motion fallback to instant fade per RESEARCH Pattern + UI-SPEC §9; NEW `src/shared/ui/inline-edit-field.tsx` (D-05) — tap-to-edit, save on blur or Enter, cancel on Esc, optimistic value, `role="alert"` on edit-mode entry. Both ship with axe + Vitest unit-dom + Playwright a11y specs. | 1 | (none) | UI-08 (inline edit), UI-11 (lightbox) |
| `05-15-catalog-page-grid-sort` | Catalog page + responsive grid + sort + sessionStorage hook: replace `src/app/(app)/catalog/page.tsx` (currently empty-only) with Server Component first-page count fetch + `dehydrate(queryClient)` / `<HydrationBoundary>` per RESEARCH Pattern 1 (D-13); NEW `<CatalogGrid>` client component (responsive 2/3/4 cols at 375/600/900 per UI-SPEC §2 / CAT-10); NEW `<CatalogHeader>` with sort `<Select>` (UI-SPEC §3); NEW `useSortPreference` hook (sessionStorage `folhario.catalog.sort` per D-11); NEW `<CatalogEmpty>` (UI-SPEC §4 / CAT-11). UI-SPEC sections referenced in `truths`: §1 Plant Card, §2 CatalogGrid, §3 CatalogHeader, §4 CatalogEmpty. Read-only variant per D-21. axe-placeholder-pages route extension. Playwright responsive-viewport + sort-persists-across-navigation specs. | 4 | `05-08`, `05-10`, `05-11` | CAT-07, CAT-08, CAT-10, CAT-11, UI-04 (catalog tab side), UI-07 |
| `05-16-plant-profile-page` | Plant Profile page: NEW `src/app/(app)/catalog/[plantId]/page.tsx` (Server Component fetches plant detail + cascade counts via `getPlant`); NEW `<PlantProfile>` client component — single-scroll, cover + thumbnail gallery, `<InlineEditField>` × 5 (name/nickname/room/acquisition_date/notes per D-05, D-06 LWW optimistic), delete overflow → `<DeleteConfirmSheet>` (D-07 cascade-counts preview), placeholder sections for care card / active reminders / ID-history (Phase 6/7/8 surfaces hidden per CONTEXT.md scope); read-only variant per D-21 (inline-edit disabled, delete hidden). UI-SPEC §6 + §7 referenced in `truths`. Playwright: inline-edit blur-saves + Esc-reverts + delete-confirm cascade-counts + plant-disappears-from-grid + axe scan. | 4 | `05-08`, `05-09`, `05-12`, `05-13`, `05-14`, `05-11` | CAT-04, CAT-09, UI-08 |
| `05-17-manual-add-photo-journal-pages` | Manual Add page + Photo Journal page: NEW `src/app/(app)/catalog/add/page.tsx` (Server shell + `<AddPlantForm>` client per D-01 — single-screen, name + photo first, optional below; per-field Overdue Rust + summary block at ≥2 errors per D-04; submit auto-focus first invalid; UI-SPEC §5); NEW `src/app/(app)/catalog/[plantId]/journal/page.tsx` (Server fetches photo-entries; `<PhotoJournal>` client renders reverse-chrono with `<Lightbox>` taps + "+ Foto" `<BottomSheet>` per D-15 / UI-SPEC §8; read-only variant hides "+ Foto"). UI-SPEC §5 + §8 referenced in `truths`. Playwright: manual-add happy-path + ≥2-errors validation + journal-add optimistic prepend + lightbox open + axe scans. | 4 | `05-08`, `05-09`, `05-12`, `05-13`, `05-14`, `05-11` | CAT-02, CAT-03, CAT-05, CAT-06, UI-07 (manual-add card geometry), UI-11 |
| `05-18-home-identify-serwist-offline-banners` | Home empty + /identify placeholder + Serwist runtime cache + offline + read-only banners: extend Home (`src/app/(app)/page.tsx` or equivalent) empty state (UI-04 / UI-SPEC §4.5: full-bleed "Identifique sua primeira planta" + camera button wired to /identify + "Adicionar manualmente" text link); NEW `src/app/(app)/identify/page.tsx` placeholder (camera button destination — Phase 6 replaces); extend `src/app/sw.ts` with Serwist `StaleWhileRevalidate` allowlist for `/api/v1/plants*`, `/api/v1/photo-entries*`, `/api/v1/locations` + `ExpirationPlugin` (`maxAgeSeconds: 7*86400`, `maxEntries: 200`, `purgeOnQuotaError: true` per RESEARCH Pitfall 2) — registered BEFORE existing `NetworkOnly("/api/")` per Pattern 4 (D-19); offline + read-only banner wiring across all Phase 5 surfaces (Phase 3 `<ReadOnlyBanner>` flip via D-21 stub; offline banner Phase 3 D-30 `useOnlineStatus`); Playwright real-IDB + real-SW offline-browsing spec (OFF-08): online load → airplane mode → catalog browsable + offline banner + identify-blocked message. | 4 | `05-10`, `05-15` | OFF-08, UI-04 (home tab side), UI-07 (cross-page read-only/offline variants), UI-08 (cross-page), UI-11 (cross-page) |

## Wave Summary

| Wave | Plans | Parallelizable? | Notes |
|------|-------|-----------------|-------|
| **0** | `05-01` | n/a (single plan)            | Test infra blocker — nothing later runs without it |
| **1** | `05-02`, `05-11`, `05-12`, `05-13`, `05-14` | Yes (no shared `files_modified`) | Schema (`05-02` is the only DB-touching plan), independent UI primitives, useSubscription stub |
| **2** | `05-03`, `05-04`, `05-05`, `05-06`, `05-07` | `05-03` and `05-04` parallel; `05-05`/`05-06`/`05-07` depend on those (so really sub-waves: 2a `[05-03, 05-04]`, 2b `[05-05, 05-06, 05-07]` parallel within 2b) | Repository + Zod schemas → use-cases. Each PLAN.md may declare its own sub-wave granularity at draft time if execute-phase parallelism benefits |
| **3** | `05-08`, `05-09`, `05-10` | Yes (touch disjoint files: 05-08/09 = `src/app/api/v1/*`, 05-10 = `src/shared/ui/*` + `src/contexts/catalog/queries/*`) | Route handlers + client state plumbing |
| **4** | `05-15`, `05-16`, `05-17`, `05-18` | Mostly yes. `05-18` depends on `05-15` to verify offline catalog browsing functionally; otherwise files are disjoint per page route ownership | UI surfaces |

## Phase 5 Requirement Coverage Matrix

Every Phase 5 REQ-ID maps to ≥1 plan. Primary owner = first plan that ships the load-bearing code; contributors = supporting plans whose `requirements` field also lists the ID.

| REQ ID | Description (excerpt) | Primary Owner | Contributors | Phase 5 Closes? |
|--------|-----------------------|---------------|--------------|-----------------|
| **CAT-01** | Plant from identification (`species_id`, name pre-filled, cover from ID) | `05-05` (contributor: ships `source: 'identification'` branch) | (none) | **No** — Phase 6 closes |
| **CAT-02** | Manual create: name + ≥1 photo → Plant + PhotoEntry | `05-05` | `05-04`, `05-08`, `05-17` | Yes |
| **CAT-03** | Missing name OR photo → `validation_failed` + field highlight | `05-04` | `05-05`, `05-08`, `05-17` | Yes |
| **CAT-04** | Plant profile surfaces (cover, inline-edit, photo-journal preview, ID-history link, delete overflow) | `05-16` | `05-07`, `05-08`, `05-09` | Yes (Phase 5 ships the variants the spec scopes; care card is Phase 7, ID-history is Phase 6 — placeholders only here per CONTEXT.md) |
| **CAT-05** | Location picker: prior + defaults + free text reusable | `05-12` (Combobox primitive) + `05-03` (location_suggestions repo) | `05-07` (list-locations use-case), `05-08` (`/api/v1/locations`), `05-17` | Yes |
| **CAT-06** | Photo journal add with optional note + reverse-chrono list | `05-17` | `05-07`, `05-08`, `05-09`, `05-14` | Yes |
| **CAT-07** | Default sort `acquisition_date` DESC NULLS LAST | `05-15` (UI) + `05-07` (use-case) + `05-03` (repo) | `05-02` (cursor) | Yes |
| **CAT-08** | Sort control 5 options + persists session | `05-15` | `05-07`, `05-08`, `05-11`-style sessionStorage hook lives here | Yes |
| **CAT-09** | Delete cascade + storage scheduling + Identification.plant_id NULL | `05-06` | `05-02` (schema), `05-03` (repo), `05-09` (route), `05-16` | Yes |
| **CAT-10** | Catalog grid 2/3/4 cols at 375/600/900 | `05-15` | `05-17` (manual-add card uses same geometry) | Yes |
| **CAT-11** | Empty catalog state with Sage line-art + Canopy CTA | `05-15` | (none) | Yes |
| **OFF-08** | Catalog browsable offline + identify blocked | `05-18` | `05-10` (TQ persister), `05-02` (cursor key stability) | Yes |
| **UI-04** | Home empty state | `05-18` (home side) | `05-15` (catalog tab side: "Sua estante ainda está esperando...") | Yes |
| **UI-07** | Catalog grid responsive + card geometry + sort control | `05-15` | `05-17`, `05-18` (cross-variant) | Yes |
| **UI-08** | Plant profile surfaces + variants | `05-16` | `05-13` (delete confirm sheet), `05-14` (inline edit + lightbox), `05-18` (read-only/offline) | Yes |
| **UI-11** | Photo journal + add entry + read-only variant | `05-17` | `05-13` (add sheet), `05-14` (lightbox), `05-18` | Yes |

## Source Audit Result

All 16 Phase 5 REQ-IDs from `REQUIREMENTS.md` mapped (CAT-01..11, OFF-08, UI-04, UI-07, UI-08, UI-11). All 29 D-XX locked decisions from `05-CONTEXT.md` mapped to at least one plan. All key RESEARCH.md patterns/pitfalls assigned. UI-SPEC sections §1..§12 + Copywriting Contract + Read-Only/Offline visual states + Telemetry + Accessibility all assigned to UI plans (05-15..05-18) and primitive plans (05-12..05-14). VALIDATION.md per-task verification map will be populated by each plan's draft pass.

**No unmapped items. No `## ⚠ Source Audit: Unplanned Items Found` situation.**

Note: CAT-01 is mapped as a **contributor** in 05-05 with the explicit understanding that Phase 6 marks it complete. This is the same pattern STATE.md records for OBS-02 (01-06 contributes / 01-07 closes) and LGPD-13 (01-05a contributes / 01-05b closes). The orchestrator's required-IDs list is satisfied: CAT-01 appears in plan 05-05's `requirements` field.

## OUTLINE COMPLETE

Plan count: 18
