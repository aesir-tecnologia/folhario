# Phase 5: Catalog — Meu Jardim - Context

**Gathered:** 2026-04-29 (power mode)
**Status:** 29/29 answered with chat-more nuance on every question
**Source:** Synthesized from `.planning/phases/05-catalog-meu-jardim/05-QUESTIONS.json` (full coverage; Q-04 originally "Other" → reset to option (a) per user direction with chat-more nuance preserved as binding refinement)

<domain>
## Phase Boundary

A verified user can manually add plants, see them as a responsive 2/3/4-column grid sorted by acquisition_date DESC (default), open a plant profile with cover + thumbnail gallery + photo journal + inline-edit fields + location picker + delete, and browse a previously-loaded catalog offline — producing the "something to identify INTO" that Phase 6 needs.

Phase 5 also ships **Wave 0 test infrastructure** (axe-core + fake-indexeddb + transaction-rollback + authedUser Playwright fixture + in-memory StorageAdapter), the **Combobox / BottomSheet (extended) / Lightbox / InlineEditField primitives** that later phases reuse, and the **TanStack Query + IndexedDB persister + Serwist runtime cache** plumbing that Phase 9 (offline queue) will extend with mutation queueing.

**Explicitly NOT in scope for Phase 5:**

- Plant creation from identification (`species_id` populated, `Identification.plant_id` FK set) — Phase 6
- LGPD consent modal at first identification — Phase 6
- Care card rendering on plant profile (section ships HIDDEN with no-care-guide variant; appears in Phase 7)
- Active reminders surface on plant profile (placeholder only; ships in Phase 8)
- ID history surface on plant profile (placeholder only; ships in Phase 6)
- Toxicity badge composition (Phase 7)
- Subscription state machine (Phase 5 stubs `useSubscription()` returning `{active: true, readOnly: false}`; Phase 10 wires real Stripe state)
- Offline mutation queue (Phase 5 ships read-side offline browsing only; queueing photo adds + reminder dones is Phase 9 scope)
- Push permission prompt (Phase 8, on first reminder creation only)
- LGPD bulk deletion / 7-day grace (Phase 11; the `pending_storage_deletions` table introduced here is reused)

</domain>

<decisions>
## Implementation Decisions

### Manual Plant Add — UX & Sequencing

- **D-01 (Q-01):** **Single-screen manual add page.** One full-page form: name (required), photo picker (renders local preview immediately on selection — bytes deferred to submit), optional nickname, location combobox, acquisition_date, notes. Lowest perceived friction; matches PRD §17 anti-wizard ethos. Q-02 supersedes the "upload-on-selection" detail from the original option text — there is no upload until submit.
- **D-02 (Q-02):** **Single multipart POST `/api/v1/plants`** atomically creates Plant + first PhotoEntry. Multipart body carries name + optional fields + photo file. Server uploads bytes to plant-photos + plant-thumbnails buckets, then inserts Plant + PhotoEntry inside one DB transaction. On TX rollback the existing `deleteSinglePlantPhotoBestEffort` compensating-delete pattern (`src/contexts/catalog/application/upload-photo.ts:217`) cleans bytes. No draft-photo route, no orphan cleanup. PhotoEntry.plant_id NOT NULL invariant preserved at every observable instant.
- **D-03 (Q-03):** **Cover photo auto-tracks the oldest non-deleted PhotoEntry.** No user override in MVP. `Plant.cover_photo_url` = `(SELECT photo_url FROM photo_entries WHERE plant_id = $1 ORDER BY created_at ASC LIMIT 1)`. Deleting the current cover triggers auto-promotion to next-oldest in the same TX. Removes a secondary control from the profile UI; can evolve later if users ask to choose the hero photo. Phase 5 does NOT ship a `PATCH /plants/:id/cover` endpoint.
- **D-04 (Q-04):** **Inline per-field error + summary block when 2+ errors invalid** (NOTE: tightened from the option's 3+ threshold per user nuance). Per-field Overdue Rust border + helper text under input. `role="alert"` announces first invalid field. Submit auto-focuses first invalid. Summary block (anchor links per error) appears when ≥2 errors — covers the canonical "missing name AND missing photo" case the PRD §16 Catalog AC-CAT-003 highlights. Field-validation color is Overdue Rust/Copper, never Urgent Poppy/Blossom (PRD §17 banned).

### Plant Profile — Inline Edits & Delete

- **D-05 (Q-05):** **Tap-to-edit fields with save on blur (or Enter for single-line); cancel on Esc.** Field renders read-only by default with a subtle hover affordance. Tap converts to input element, focused, current value selected. Blur OR Enter triggers `PATCH /api/v1/plants/:id` with the single dirty field. Esc reverts to pre-edit value. Optimistic UI; PATCH failure rolls back display value + sonner toast "Não conseguimos salvar agora — tentar de novo?". Matches PRD §17 validate-on-blur literal. No explicit Save button per field.
- **D-06 (Q-06):** **Optimistic update + last-write-wins; no client-side conflict detection.** PATCH always wins on server (LWW per `updated_at`). Client optimistic update; on PATCH response the server row is merged into the TanStack Query cache as truth. No "Atualizado em outro dispositivo" warning, no `If-Unmodified-Since` header, no 409 conflict UI. Matches PRD §10 "NO merge UI" literal.
- **D-07 (Q-07):** **Bottom-sheet confirm with cascade-counts preview.** Tap delete from overflow → ModalSheet opens: headline "Excluir {name}?" + body "Isso vai apagar {N} fotos do diário e {M} lembretes. O histórico de identificações é mantido." Cancelar primary, Excluir destructive (Urgent Poppy fill, Warm Ivory label). Cascade counts come from a fresh `GET /plants/:id` shape (server returns `_meta: { photo_entry_count, reminder_count }`) so they're up-to-date when the sheet opens. PRD §17 destructive-button rule: Excluir is ALWAYS layout-secondary to Cancelar.

### Location Picker — Combobox & Suggestions

- **D-08 (Q-08):** **Roll our own headless `Combobox` primitive (~200 LOC) at `src/shared/ui/combobox.tsx`.** Implements WAI-ARIA APG 1.2: `useId` for ids, `aria-controls`, `aria-expanded`, `aria-activedescendant`, keyboard nav (Arrow/Home/End/Esc/Enter/printable typeahead), focus management. Zero new deps. Tested via `@axe-core/playwright` (Phase 3 D-33) — APG keyboard + axe coverage are non-negotiable acceptance gates. Surface is narrow (one field; reused by Phase 7+ if any). Adopting cmdk/react-aria isn't justified for a single-field surface.
- **D-09 (Q-09):** **Separate `location_suggestions` table** with `(user_id, label_normalized, label_display, usage_count, last_used_at)`. PK `(user_id, label_normalized)`. Upsert on plant create + plant edit (location field). DELETE plant does NOT decrement usage (suggestions stick — user-entered locations preserved across plant deletions). Query: `SELECT label_display FROM location_suggestions WHERE user_id = $1 ORDER BY usage_count DESC, last_used_at DESC LIMIT 20`. RLS owner-only (`auth.uid() = user_id`). Stable, small query surface for the IDB cache.
- **D-10 (Q-10):** **Default location labels live in `messages/pt-BR.json` under `catalog.locations.defaults`** as a string array `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]`. Combobox merges user suggestions (D-09) + i18n defaults (de-duped by normalized label). Zero schema impact; respects CLAUDE.md "no hardcoded strings"; future locales add their own message file entry. Defaults are static identifiers, NOT user-mutable.

### Catalog Grid — Sort, Pagination, Empty State

- **D-11 (Q-11):** **Sort persisted via `sessionStorage` key `folhario.catalog.sort`.** Stores `sort_id ∈ {name_asc, name_desc, date_new, date_old, location}`. Default `date_new` (PRD §16 + ROADMAP SC-2). Clears on tab close. Matches PRD literal "persists for session" and Phase 3 D-23's existing browser-state pattern.
- **D-12 (Q-12):** **Opaque base64 cursor pagination + first-page total count.** Cursor encodes `{sort_id, last_value, last_id}` with `plant.id` as stable tiebreak. NULLS LAST for `acquisition_date` ASC + DESC handled via sentinel cursor value. Page size 50 default, 200 max (PRD §5). First page response also returns `total_count` (gate it behind `?include_count=1` so subsequent cursor pages stay light). Total count drives the catalog header affordance ("12 plantas") and the empty/grid switch (D-13).
- **D-13 (Q-13):** **Server-render the catalog page based on first-page count.** `src/app/(app)/catalog/page.tsx` is a Server Component that fetches first page (cursor + count) — zero rows → renders `<CatalogEmpty />` inline, non-zero → renders `<CatalogGrid />` with first 50 SSR'd. TanStack Query takes over for further pages, hydrating from the SSR'd initial data via `dehydrate(queryClient)` / `<HydrationBoundary>`. Eliminates skeleton flash on the first-plant transition.

### Photo Journal — Lightbox & Add-Entry Flow

- **D-14 (Q-14):** **Roll our own Lightbox primitive (~150 LOC) at `src/shared/ui/lightbox.tsx`** — full-screen overlay over Radix Dialog. Reuses Radix for focus trap, return focus, Esc dismiss. Adds horizontal swipe between photos (touch events). Visible Fechar button top-right (PRD §17 modal sheet: "VISIBLE close affordance required"). Tap-anywhere-to-close allowed only in addition. Animation via `transform` + `opacity` only (PRD §17 motion); reduced-motion fallback to instant fade. Pinch-zoom = native browser default.
- **D-15 (Q-15):** **Photo-journal add via bottom-sheet (ModalSheet).** Tap "+ Foto" on journal screen → `<ModalSheet>` opens with photo picker. After selection, sheet shows preview + note textarea + Adicionar primary button. Single multipart POST `/api/v1/plants/:id/photo-entries` carries photo + note in one call (existing `/api/v1/photos/upload` pattern reused / extended). Upload progress visible inside sheet (sonner toast). On success: sheet closes, journal optimistically prepends new entry. On failure: sheet stays open with retry, photo bytes retained client-side.

### Client State — TanStack Query + IndexedDB Persistence

- **D-16 (Q-16):** **`@tanstack/query-async-storage-persister` + `idb-keyval`** for the IDB persister. Async (non-main-thread-blocking) rehydration; IndexedDB capacity (50% of disk). Standard TanStack v6 pattern. ~3.5kB for idb-keyval. Wired in a client `<QueryProvider>` mounted inside `(app)/layout.tsx` after the auth gate.
- **D-17 (Q-17):** **Persisted query allowlist: catalog list + plant detail + photo journal + locations + storage-budget guard.** Explicit `dehydrate({ shouldDehydrateQuery })` filter limits IDB writes to query-key prefixes `['catalog','plants',...]`, `['catalog','plant',...]`, `['catalog','photo-entries',...]`, `['catalog','locations',...]`. Mutation queries excluded. `maxAge: 24h`. Quota guard: on each persist, call `navigator.storage.estimate()`; if used/quota > 0.8, evict oldest queries via TanStack `removeQueries` + manual `idb-keyval` delete. Locations included so offline plant-add still has reusable suggestions. Photos themselves served from Serwist runtime cache (D-19/D-20), not the query cache.
- **D-18 (Q-18):** **Query factory pattern (Tkdodo-style) at `src/contexts/catalog/queries/index.ts`.** Exports factory functions `plantsKeys.lists({sort})`, `plantsKeys.detail(id)`, `plantsKeys.photoEntries(plantId)`, `locationsKeys.all()`. Each factory returns `{queryKey, queryFn, staleTime, ...}`. Mutations invalidate via `queryClient.invalidateQueries({queryKey: plantsKeys.lists()})` (partial-match invalidation). Types co-located with each query. Prevents key drift across the 5+ query surfaces this phase ships and the identification-history query Phase 6 will add.

### Offline & Service Worker — Catalog Cache

- **D-19 (Q-19):** **Serwist runtime cache: StaleWhileRevalidate for whitelisted catalog GETs, max age 7d.** Whitelist in `src/app/sw.ts`: `/api/v1/plants*`, `/api/v1/photo-entries*`, `/api/v1/locations`. SWR returns cache instantly + revalidates in background. NetworkOnly stays the default for everything else (mutations, identification, auth). Cache survives 7d (matches LGPD grace expectation from PRD §13). Belt + braces with TanStack persister: SW serves bytes, TQ serves shape.
- **D-20 (Q-20):** **24h-TTL signed URLs for catalog/journal photos + thumbnails; SW byte-cache by URL.** Server signs photo URLs with 24h expiry on every catalog/journal read. SW caches the byte response keyed by signed URL. As long as the JSON is in cache (D-19), the embedded URL stays valid for offline reads. Online refreshes mint fresh URLs on each catalog refetch. No public buckets; no per-photo signing endpoint.
- **D-21 (Q-21):** **`useSubscription()` stub returns `{active, readOnly}`; mutating affordances hidden when `readOnly: true`.** Hook lives at `src/contexts/billing/application/use-subscription.ts` (stub for Phase 5 — returns `{active: true, readOnly: false}` constant; Phase 10 wires real Stripe state). When `readOnly: true`: Add Plant button hidden, inline-edit fields render as read-only text (no tap affordance), delete overflow item missing, photo-journal "+ Foto" hidden. `<ReadOnlyBanner active={readOnly} />` (Phase 3 D-31 component) flips on. Test harness in `tests/e2e/fixtures/read-only.ts` flips the flag for Playwright specs. Matches PRD §16 "hidden/disabled" literal.

### Async Cleanup — Inngest catalog/cleanup-storage

- **D-22 (Q-22):** **Same-TX `pending_storage_deletions` insert + `plant.deleted` Inngest event.** DELETE `/api/v1/plants/:id` transaction: cascades PhotoEntry + Reminder rows, sets `Identification.plant_id = NULL` (preserving history rows), INSERTs two `pending_storage_deletions` rows (one for `plant-photos` bucket, one for `plant-thumbnails`, both with prefix `{userId}/{plantId}/`, status=`pending`), commits, then emits `plant.deleted` Inngest event. The Inngest function `catalog/cleanup-storage` consumes the event → calls `storageAdapter.deletePrefix(...)` → updates row status to `completed` (or `failed` with `error_message`). Reconciler cron (D-24) picks up stuck rows. Belt + braces: durable recovery for both storage failures and event-delivery gaps.
- **D-23 (Q-23):** **`pending_storage_deletions` schema:** `id UUID PK`, `user_id UUID NOT NULL`, `bucket TEXT NOT NULL`, `prefix TEXT NOT NULL`, `status pending_deletion_status NOT NULL DEFAULT 'pending'` (ENUM `pending|in_progress|completed|failed`), `attempts INT NOT NULL DEFAULT 0`, `last_error TEXT`, `scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `completed_at TIMESTAMPTZ`. Index on `(status, scheduled_at)` for the reconciler cursor. RLS owner-only. NO `plant_id` FK — the prefix already carries the deleted-plant scope, and an FK would be fragile once the plant row is gone (Phase 11 LGPD bulk delete also benefits). Phase 11 reuses this table for full-account sweeps.
- **D-24 (Q-24):** **Hourly Inngest cron `catalog/cleanup-storage-reconciler`, batch 50, max 5 attempts with exponential backoff.** Backoff: 5min → 30min → 4h → 24h → 72h. Cron query: `SELECT ... FROM pending_storage_deletions WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at LIMIT 50 FOR UPDATE SKIP LOCKED`. After 5 attempts → `status = 'failed'` surfaces in OBS-05 Phase 13 alert. Reconciler is fail-safe; the happy-path cleanup runs through Inngest's per-event retry (4 attempts default).

### Wave 0 Test Infrastructure

- **D-25 (Q-25):** **`fake-indexeddb` in Vitest unit setup only; Playwright uses real Chromium IDB.** Add `fake-indexeddb` as dev dep. `tests/unit/setup-idb.ts` imports `fake-indexeddb/auto`. Per-test isolation via `beforeEach { indexedDB.deleteDatabase(...); }` or unique DB name per test. Playwright tests run real IDB; per-spec setup clears `storageState`. Two clean layers — unit tests for persister logic, E2E for actual offline + persistence behavior.
- **D-26 (Q-26):** **`authedUser` Playwright fixture** at `tests/e2e/fixtures/authed-user.ts`. Calls `supabase.auth.admin.createUser` server-side, INSERTs verified `public.users` (with `email_verified_at` set, `age_confirmed_at` set, valid timezone) + ConsentLog × 2 + `Subscription` (status=`trialing`, `trial_end_date` = now + 14d), then injects Supabase session cookies into the test browser via `context.addCookies(...)`. Tests start at the catalog already authenticated. ~50ms per spec. Phase 4's real-auth specs stay in their phase only — Phase 5 specs do not exercise the signup/verify/login surfaces.
- **D-27 (Q-27):** **In-memory `StorageAdapter` for integration tests via `__setStorageAdapterForTests`.** `tests/integration/setup.ts` swaps in `InMemoryStorageAdapter` (`Map<bucket, Map<key, Buffer>>`). Zero real-bucket writes. Phase 2 D-43 transaction-rollback handles DB cleanup. Hermetic, fast, parallel-safe. The Supabase storage adapter itself is tested separately in `src/shared/adapters/supabase-storage.unit.test.ts`. Catalog integration tests focus on use-case behavior without external bucket flakes.

### Telemetry — PostHog Events

- **D-28 (Q-28):** **`plant_added` event properties:** `{ source: 'manual', has_nickname: bool, has_location: bool, has_acquisition_date: bool, has_notes: bool, photo_count: int }`. Privacy-clean — no plant identifiers, names, locations, notes, or plant_id. Fires server-side via `posthog-node` from the `/api/v1/plants` POST handler after TX commit. `source` field forward-compatible: Phase 6 reuses with `'identification'`.
- **D-29 (Q-29):** **Two privacy-clean engagement events: `plant_edited` + `plant_deleted`.** `plant_edited` fires from PATCH route with property `field ∈ {name, nickname, location, acquisition_date, notes}` (use the schema field name `acquisition_date`, NOT a `ack_date` shorthand — avoids telemetry drift with Phase 6+ joins). `plant_deleted` fires from DELETE route with `{ photo_count: int, journal_entry_count: int, reminder_count: int }`. Both server-side via `posthog-node`. Funnels: "do users add notes after a week?" "do users delete plants in their first session?"

### Claude's Discretion

The agent has discretion on (within the locks above):

- Exact Tailwind class compositions for inline-edit visual states (read / hover / focused / saving / error)
- Sonner toast copy strings (initial pt-BR drafts; founder reviews per Phase 4 D-30 pattern)
- Combobox keyboard typeahead debounce (50–250ms range)
- Lightbox swipe-velocity + dismiss thresholds (per platform conventions)
- Storage budget eviction policy specifics (LRU vs query-key-prefix priority within the 80% ceiling)
- IndexedDB DB name + object-store name for `idb-keyval`
- Exact order/grouping of fields on the manual-add screen (within "name + photo first, optional fields below")
- TanStack Query default `staleTime` per query (suggested: catalog list 30s, plant detail 60s, locations 5min)
- Sharp resize options for cover-photo thumbnail (current upload-photo.ts already locks 512px / quality 80)
- Optional `Idempotency-Key` enforcement on POST `/plants` and POST `/plants/:id/photo-entries` (Phase 2 D-37 idempotency_keys table available)
- File splits inside `src/contexts/catalog/{domain,application,infrastructure,api,inngest}/` provided D-09 schema ownership and D-22 cleanup pattern are preserved

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + scope
- `.planning/PROJECT.md` — Core value (<2 min from email verification — Phase 5 sets up the catalog destination), constraints, key decisions, launch blockers
- `.planning/REQUIREMENTS.md` — Phase 5 requirements: CAT-01..11 + OFF-08 + UI-04, UI-07, UI-08, UI-11 (16 requirements total)
- `.planning/ROADMAP.md` §Phase 5 — Goal + 5 success criteria + 18-plan list (incl. Wave 0 test-infra plan 05-01)

### Catalog domain (PRD)
- `docs/CAVE-PRD.md` §1 — Anti-patterns (no fabricated metrics, no fake names, no broken Unsplash hotlinks); core value clock starts at verification
- `docs/CAVE-PRD.md` §3 — Bounded contexts table; Catalog aggregates (Plant, PhotoEntry); cross-context events `plant.created`, `plant.deleted`, listens to `identification.succeeded` (Phase 6)
- `docs/CAVE-PRD.md` §4 — Data model: Plant (with cover_photo_url, location, acquisition_date, notes, nickname), PhotoEntry; **plant deletion cascade rules** (PhotoEntry + Reminder cascade; Identification.plant_id NULL but row preserved; storage scheduled for delete)
- `docs/CAVE-PRD.md` §5 — Error code registry (`validation_failed`, `not_found`, `forbidden`, `read_only_mode`, `subscription_required`); cursor pagination contract; idempotency-key contract
- `docs/CAVE-PRD.md` §7 — Catalog ("Meu Jardim"): Add plant rules (manual: name + ≥1 photo required), Plant profile fields, Room/location combined input rules, Photo journal, Sorting (name A-Z/Z-A, acquisition_date DESC default/oldest, location; null dates last; persists for session)
- `docs/CAVE-PRD.md` §10 — Offline & Sync: Cached catalog browsable offline, last-write-wins by server timestamp, NO merge UI, plant-deleted-server-side discard summary (Phase 9 wires)
- `docs/CAVE-PRD.md` §11 — Image handling: client-side ≤1MB compression, EXIF/GPS strip client-side (server defense in depth), thumbnail gen on upload (already wired in Phase 2)
- `docs/CAVE-PRD.md` §12 — Subscription state machine context (read-only mode triggers; Phase 10 wires real, Phase 5 stubs hook)
- `docs/CAVE-PRD.md` §16 — Screens: Home empty (zero plants) → Identify CTA + manual-add link; Catalog grid (2/3/4 cols at 375/600/900) + sort + read-only Add hidden; Plant Profile (cover + thumbnail gallery + inline-edit + photo-journal preview + ID-history link + delete overflow); Photo Journal screen
- `docs/CAVE-PRD.md` §17 — Design System: validate-on-blur + autocomplete contract; modal-sheet behavior (focus trap, drag handle, visible close); empty-state composition (Sage line-art + Source Serif headline + Calm Slate hint + ONE Canopy CTA); error states (Overdue Rust for form errors NEVER Urgent Poppy); banned patterns (no full-screen red wall, no confetti, no fabricated metrics, no centered hero); plant card geometry (16px radius, 4:5 photo top, 16px padding); skeleton timing (300ms gate + 120ms fade + reduced-motion fallback)
- `docs/CAVE-PRD.md` §20 — PostHog event taxonomy (server-side via posthog-node; identified_only persons per Phase 1 D-21)
- `docs/CAVE-PRD.md` §23 — Acceptance criteria AC-CAT-001..010, AC-OFF-008 (testable assertions for Phase 5 verification)

### Prior phase patterns (locked decisions to honor)
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-10/D-11/D-12 closed error registry, D-21 PostHog identified_only person profiles, D-22 Sentry PII scrubbing, D-29 server-env vs client-env split
- `.planning/phases/02-data-layer/02-CONTEXT.md` — D-01 per-context schema ownership, D-13 IdentificationLimit + ProviderBudget seeded (Phase 6 use), D-14 runtime DB client `{ prepare: false }`, D-16 functional repositories, D-17 NO Drizzle in route handlers, D-19 drizzle-zod refined schemas, D-20/D-21/D-22 RLS strategy (`auth.uid()` ownership), D-23/D-25 storage adapters + signed URLs, D-26 storage path conventions (`{userId}/{plantId}/{photoId}.{ext}`), D-27 server proxy upload route delegates to application, D-30 server GPS rejection BEFORE adapter write, D-31 synchronous thumbnail via sharp, D-36 cursor pagination contract, D-37 idempotency_keys table (apply to POST /plants + POST /plants/:id/photo-entries), D-43 transaction-rollback test pattern, D-44 hybrid auth-test posture, D-45 Playwright + smoke-route JWT validation
- `.planning/phases/03-design-system-app-shell/03-CONTEXT.md` — D-10 Radix UI primitive library, D-11 sonner toast, D-14 SW NetworkOnly default for `/api/*` (Phase 5 D-19 extends), D-21 (app) layout group + scroll restoration via sessionStorage (Phase 5 D-11 reuses pattern), D-22 (app) layout owns mutating-affordance gate, D-25 composed primitives list (ModalSheet — Phase 5 reuses + extends; ReadOnlyBanner — Phase 5 D-21 toggles), D-30 useOnlineStatus hook + heartbeat (offline detection)
- `.planning/phases/04-iam-auth-verification-consent/04-CONTEXT.md` — D-21 `requireVerifiedUser()` helper for gated handlers (Phase 5 plant routes are gated), D-23 UNVERIFIED_ALLOWED_PATHS allowlist (NO Phase 5 routes added — they all require verified email), D-26 Settings sub-routes (`/settings/account` exists; Phase 5 does NOT add a Catalog settings section)

### Code anchors (existing artifacts that constrain Phase 5)
- `src/contexts/catalog/infrastructure/db/schema.ts` — `plants` + `photo_entries` Drizzle tables already wired with FK delete rules (plants.user_id → users.id ON DELETE CASCADE; plants.species_id → species.id ON DELETE SET NULL; photo_entries.plant_id → plants.id ON DELETE CASCADE). Phase 5 schema work = add `pending_storage_deletions` + `location_suggestions`.
- `src/contexts/catalog/infrastructure/db/plants.ts` — `findByIdForUser` repository with explicit ownership filter (RLS defense in depth). Phase 5 extends with `list({sort, cursor, limit})`, `create`, `update`, `delete`, `countForUser`.
- `src/contexts/catalog/infrastructure/db/photo-entries.ts` — already exists; Phase 5 extends with `list({plantId})`, `create`, `delete`.
- `src/contexts/catalog/infrastructure/photo-storage.ts` — D-26 path conventions + `__setStorageAdapterForTests` test seam (Phase 5 D-27 leverages); existing helpers `uploadOriginalPlantPhoto`, `uploadPlantThumbnail`, `deleteSinglePlantPhotoBestEffort`. Phase 5 adds `deleteAllPlantMediaForUser({userId, plantId})` if not already present and `signCatalogPhotoUrl({key, ttl: 24*3600})`.
- `src/contexts/catalog/application/upload-photo.ts` — existing single-photo upload use-case with compensating-delete pattern on TX failure (line 217). Phase 5 D-02 reuses this contract for the manual-add multipart endpoint and for the photo-journal add-entry endpoint.
- `src/contexts/catalog/domain/schemas.ts` — drizzle-zod-derived `plantSelectSchema`, `plantInsertSchema`, `photoEntrySelectSchema`, `photoEntryInsertSchema` (no consumers yet). Phase 5 extends with refined Zod schemas for create/update routes.
- `src/app/(app)/catalog/page.tsx` — currently renders empty state unconditionally; Phase 5 D-13 makes this server-component fetch first-page count.
- `src/shared/ui/modal-sheet.tsx` — Radix Dialog wrapper (Phase 3 D-25); Phase 5 reuses for delete-confirm sheet (D-07) and photo-journal add-entry sheet (D-15).
- `src/shared/ui/empty-state.tsx`, `src/shared/ui/read-only-banner.tsx`, `src/shared/ui/skeleton.tsx`, `src/shared/ui/inline-error.tsx` — Phase 3 primitives Phase 5 composes.
- `src/shared/db/unit-of-work.ts` — `withUnitOfWork(userId, async (tx) => ...)` binds RLS GUC (Phase 2 D-22). Phase 5 mutations all flow through this.
- `src/shared/config/errors.ts` — closed error registry; Phase 5 emits `validation_failed`, `not_found`, `forbidden`, `read_only_mode`, `subscription_required`. NO ad-hoc codes.
- `src/app/sw.ts` — Serwist runtime cache (Phase 3 D-14: NetworkOnly for `/api/*`). Phase 5 D-19 extends with SWR allowlist.
- `package.json` — existing deps: `sharp@0.34.5`, `exifr@7.1.3`, `@radix-ui/react-dialog@1.1.15`, `lucide-react@1.11.0`, `sonner` (Phase 3). Phase 5 adds: `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `idb-keyval`, `fake-indexeddb` (dev).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **Storage adapter + photo helpers** at `src/contexts/catalog/infrastructure/photo-storage.ts` and `src/shared/adapters/storage.ts` — Phase 5 reuses for cover/journal photo persistence (D-02), 24h signed-URL minting (D-20), and bulk prefix-delete on plant deletion (D-22). `__setStorageAdapterForTests` is the seam for Phase 5 D-27 in-memory adapter.
- **Existing upload-photo use-case** at `src/contexts/catalog/application/upload-photo.ts` — its compensating-delete pattern (line 217) is the template for the manual-add multipart endpoint's TX-rollback story (D-02).
- **Drizzle catalog schema** at `src/contexts/catalog/infrastructure/db/schema.ts` — `plants` + `photo_entries` shipped in Phase 2; FK cascades already correct. Phase 5 adds two tables: `pending_storage_deletions` (D-23) + `location_suggestions` (D-09).
- **drizzle-zod schemas** at `src/contexts/catalog/domain/schemas.ts` — Phase 5 extends with refined Zod schemas (`createPlantInputSchema`, `updatePlantInputSchema`, `createPhotoEntryInputSchema`) per Phase 2 D-19.
- **Phase 2 RLS posture** (D-20/D-21/D-22) — `plants` + `photo_entries` already have owner-RLS via Drizzle migration. Phase 5 adds matching policies for `pending_storage_deletions` + `location_suggestions`.
- **Phase 2 idempotency_keys** (D-37) — Phase 5 mutating endpoints (POST /plants, POST /plants/:id/photo-entries, PATCH /plants/:id, DELETE /plants/:id) accept `Idempotency-Key` header.
- **Phase 2 cursor pagination contract** (D-36) — Phase 5 D-12 extends with the composite `{sort_id, last_value, last_id}` opaque cursor shape.
- **Phase 3 Radix-Dialog ModalSheet** — Phase 5 D-07 (delete confirm) + D-15 (photo-journal add) reuse.
- **Phase 3 Empty State + Read-only Banner + Skeleton + Inline Error + Sonner Toast** — Phase 5 composes for all UI surfaces.
- **Phase 3 (app) layout gate + scroll restoration** — Phase 5 plant routes inherit verified-email gate from Phase 4 (`(app)/layout.tsx`).
- **Phase 4 `requireVerifiedUser()` helper + AuthAdapter** — every Phase 5 mutating handler calls this first.

### Established Patterns

- **No Drizzle in route handlers** (Phase 2 D-17) — Phase 5 `/api/v1/plants/*` and `/api/v1/photo-entries/*` handlers stay thin: validate (Zod) → call use-case → map HTTP. Use-cases live in `src/contexts/catalog/application/`. Drizzle confined to `src/contexts/catalog/infrastructure/db/`.
- **Single shared error response shape** `{error: {code, message, details?}}` — every Phase 5 handler returns this on failure (Phase 1 D-11).
- **Per-context schema ownership** (Phase 2 D-01) — Phase 5 owns the two new tables (`pending_storage_deletions`, `location_suggestions`) inside `src/contexts/catalog/infrastructure/db/schema.ts`; cross-context FK to `users.id` is conventional Drizzle (NOT a D-01 violation).
- **Inngest event flow** — Phase 5 emits `plant.created` and `plant.deleted` (PRD §3 events). `plant.deleted` consumed by `catalog/cleanup-storage` (D-22). `plant.created` is informational for Phase 6+ (no Phase 5 consumer; Phase 6 may listen for "first plant" funnel events).
- **Server-side PostHog capture** (Phase 1 D-21) — `plant_added`, `plant_edited`, `plant_deleted` fire server-side via `posthog-node` (D-28/D-29). `Sentry.setUser({id})` already wired; never email.
- **Validate-on-blur + autocomplete + summary block** input contract (PRD §17) — Phase 5 inline-edit fields and manual-add form follow.

### Integration Points

- `src/contexts/catalog/infrastructure/db/schema.ts` — extend with `pending_storage_deletions` + `location_suggestions` tables + status ENUM (`pending_deletion_status`)
- `src/contexts/catalog/infrastructure/db/plants.ts` — extend repository with `list({sort, cursor, limit})`, `create`, `update`, `delete`, `countForUser`, `getCascadeCounts(plantId)` for D-07 confirm sheet
- `src/contexts/catalog/infrastructure/db/photo-entries.ts` — extend with `list({plantId})`, `create`, `delete`, `bumpCoverFor(plantId)` (D-03 auto-promote)
- `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` — NEW repository (D-22/D-23)
- `src/contexts/catalog/infrastructure/db/location-suggestions.ts` — NEW repository (D-09)
- `src/contexts/catalog/infrastructure/photo-storage.ts` — add `deleteAllPlantMediaForUser({userId, plantId})` and `signCatalogPhotoUrl({key, ttl: 24*3600})`
- `src/contexts/catalog/application/create-plant.ts` — NEW (D-02 multipart manual create)
- `src/contexts/catalog/application/update-plant.ts` — NEW (inline-edit PATCH)
- `src/contexts/catalog/application/delete-plant.ts` — NEW (D-22 cascade + pending_storage_deletions insert + event emit)
- `src/contexts/catalog/application/list-plants.ts` — NEW (D-12 cursor pagination + count)
- `src/contexts/catalog/application/get-plant.ts` — NEW (returns plant + cascade counts for D-07)
- `src/contexts/catalog/application/list-photo-entries.ts` — NEW
- `src/contexts/catalog/application/create-photo-entry.ts` — NEW (D-15 reuses upload-photo flow)
- `src/contexts/catalog/application/delete-photo-entry.ts` — NEW (auto-promote cover per D-03)
- `src/contexts/catalog/application/list-locations.ts` — NEW (D-09 + D-10 merged response)
- `src/contexts/catalog/api/route-handlers/*` — NEW handlers split per ROADMAP plan list (5 read + 6 mutate + delete endpoints across plans 05-08 and 05-09)
- `src/contexts/catalog/inngest/functions.ts` — NEW: `cleanupStorage` event handler (D-22) + `cleanupStorageReconciler` cron (D-24); export array for `src/shared/inngest/registry.ts`
- `src/contexts/catalog/queries/index.ts` — NEW client-only query factory (D-18)
- `src/contexts/billing/application/use-subscription.ts` — NEW stub (D-21); Phase 10 replaces with real impl
- `src/shared/ui/combobox.tsx` — NEW primitive (D-08)
- `src/shared/ui/lightbox.tsx` — NEW primitive (D-14)
- `src/shared/ui/inline-edit-field.tsx` — NEW primitive (D-05)
- `src/shared/ui/query-provider.tsx` — NEW client provider mounting TanStack Query + IDB persister (D-16/D-17/D-18)
- `src/shared/ui/storage-budget-guard.ts` — NEW navigator.storage.estimate eviction helper (D-17)
- `src/app/sw.ts` — extend with SWR allowlist for catalog GETs (D-19)
- `src/app/(app)/catalog/page.tsx` — replace empty-only render with server-component first-page fetch (D-13)
- `src/app/(app)/catalog/add/page.tsx` — NEW manual add page (D-01)
- `src/app/(app)/catalog/[plantId]/page.tsx` — NEW plant profile (D-05/D-07)
- `src/app/(app)/catalog/[plantId]/journal/page.tsx` — NEW photo journal (D-14/D-15)
- `src/app/api/v1/plants/route.ts` — POST (D-02 multipart) + GET (D-12 list)
- `src/app/api/v1/plants/[plantId]/route.ts` — GET + PATCH (D-05) + DELETE (D-22)
- `src/app/api/v1/plants/[plantId]/photo-entries/route.ts` — POST (D-15 multipart) + GET
- `src/app/api/v1/photo-entries/[photoEntryId]/route.ts` — DELETE (D-03 auto-promote)
- `src/app/api/v1/locations/route.ts` — GET (D-09 + D-10)
- `messages/pt-BR.json` — extend `catalog.*` namespace (locations.defaults, empty states, sort labels, delete confirm copy, photo journal copy, validation messages)
- `tests/e2e/fixtures/authed-user.ts` — NEW Playwright fixture (D-26)
- `tests/e2e/fixtures/read-only.ts` — NEW Playwright fixture flipping `useSubscription` stub (D-21)
- `tests/integration/setup.ts` — extend to swap in `InMemoryStorageAdapter` (D-27)
- `tests/unit/setup-idb.ts` — NEW: `import 'fake-indexeddb/auto'` (D-25)

</code_context>

<specifics>
## Specific Ideas

- **Manual-add submit copy**: "Adicionar à minha estante" (Canopy primary, full width). Loading state replaces label with sonner toast progress; button disabled.
- **Validation summary header (D-04, 2+ errors case)**: "Falta preencher: Nome, Foto" with anchor links to each invalid field. Plus Jakarta Sans 14 w600 Forest Ink, Overdue Rust left border 4px on the summary block.
- **Plant profile inline-edit hover hint**: On desktop, tap-to-edit fields show a 1.5px Hairline Beige outline on hover; on mobile, no hover affordance — the affordance is the fact that tapping the value text opens the editor.
- **Delete confirm copy template**: `Excluir {nickname || name}?` headline (Source Serif 4 24/30 w500). Body (Plus Jakarta Sans 16/24 w400 Calm Slate): `Isso vai apagar {photo_count} fotos do diário e {reminder_count} lembretes. O histórico de identificações é mantido.` Pluralization via next-intl ICU MessageFormat. Pure-zero counts collapse the line ("Esta planta ainda não tem fotos no diário ou lembretes.").
- **Combobox empty-state copy**: When user types a string not in suggestions: ghost row "Adicionar '{typed}'" appears with Canopy + icon (Plus Jakarta Sans 14 w600). Confirms with Enter or tap.
- **Catalog grid cards**: Reuse plant-card geometry from PRD §17 (16px radius, 4:5 photo top, 16px padding, light shadow `0 2px 12px rgba(20,52,36,0.06)`). Skeleton pre-render uses Phase 3 `<Skeleton>` + 300ms gate.
- **Empty catalog hero**: PRD §17 empty-state composition — Sage line-art (terracotta pot OR sprout, founder asset), Source Serif 4 headline "Sua estante ainda está esperando a primeira planta.", Calm Slate hint "Identifique sua primeira planta ou adicione manualmente.", ONE Canopy primary CTA "Identificar planta" linking to `/identify` (Phase 6 placeholder route in Phase 5).
- **Sort control rendering**: native `<Select>` styled per Phase 3 primitive; placed top-right of the catalog grid header. 5 options. Default state shows current selection name.
- **Scientific name component**: Phase 3 D-25 plans `src/shared/typography/scientific-name.tsx` (`<i lang="la">`); Phase 5 plant profile uses it ONLY when `species_id` is non-null (Phase 6 path, not Phase 5 manual-add path) — so manual-add-only Phase 5 may not exercise it. Defer first consumer to Phase 6.
- **Photo-journal entry card**: Photo (4:5 thumbnail), date in Calm Slate (`dd/MM/yyyy` via `Intl.DateTimeFormat('pt-BR')`), optional note in Forest Ink Plus Jakarta Sans 14 w400, tap-to-open-lightbox affordance.
- **Read-only banner copy**: PRD §16 literal "Sua assinatura expirou. Reative para identificar e receber lembretes." Linked to `/settings/subscription` (Phase 10 destination; Phase 5 leaves the link inert pointing to Settings → Em breve placeholder).
- **Two new Drizzle migrations** in this phase: `XXXX_add_pending_storage_deletions.sql` + `XXXX_add_location_suggestions.sql`. Both with RLS owner-only policies. Phase 2 migration ordering preserved.
- **`pending_storage_deletions` ENUM**: name it `pending_deletion_status` (NOT `storage_status` or generic). Future Phase 11 LGPD sweeps add row(s) with the same ENUM values.
- **PostHog event server-side timing**: All Phase 5 events fire AFTER TX commit (via `tx.afterCommit(() => posthog.capture(...))` or equivalent), never before. A failed TX must NOT leak a `plant_added` event into PostHog.

</specifics>

<deferred>
## Deferred Ideas

### Future-phase deferrals (out of scope for Phase 5)

- **Plant create from identification** (`Plant.species_id` populated; `Identification.plant_id` FK set; name pre-filled from selected result; cover from identification upload) — Phase 6. Phase 5's `create-plant.ts` use-case will be invoked by Phase 6 with a different input shape (`source: 'identification'`).
- **Care-card section on plant profile** — Phase 7 (no-care-guide variant ships HIDDEN by default; Phase 7 augmentation flips on for species with a care guide).
- **Toxicity badge composition** — Phase 7 (PRD §17 7-part non-negotiable spec).
- **Active reminders surface on plant profile** — Phase 8 placeholder line "Você ainda não tem lembretes para esta planta." with a "Criar lembrete" CTA linking to `/settings/notifications` Em breve.
- **ID history link on plant profile** — Phase 6 (placeholder hidden in Phase 5 because no Identifications can exist yet).
- **Augmented "Gerado por IA" persistent badge** — Phase 7.
- **Push permission prompt** — Phase 8 first-reminder-creation flow.
- **Offline mutation queue** — Phase 9. Phase 5 ships read-side offline browsing only; photo-add and inline-edit while offline currently fail immediately (sonner toast "Sem conexão — tente novamente quando voltar online"). Phase 9 wires the queue.
- **Discard-summary toast for plant deleted on another device** — Phase 9 wires the actual queue outcome; the toast surface itself ships in Phase 3 (D-31a).
- **Real `useSubscription()` hook** — Phase 10 wires Stripe subscription state into the Phase 5 stub.
- **LGPD bulk delete + 7-day grace** — Phase 11 reuses `pending_storage_deletions` table for full-account sweeps.
- **Custom cover photo override** (PATCH `/plants/:id/cover`) — post-MVP backlog if user feedback demands hero-photo control. Captured per D-03.

### Reviewed but not folded
- *None — no todos cross-referenced for Phase 5 (the two open todos in STATE.md — GitHub Actions bump + vite-tsconfig-paths replacement — are tooling and unrelated to catalog scope)*

</deferred>

---

*Phase: 05-catalog-meu-jardim*
*Context gathered: 2026-04-29 (power mode, 29/29 answered with chat-more nuance on every question)*
