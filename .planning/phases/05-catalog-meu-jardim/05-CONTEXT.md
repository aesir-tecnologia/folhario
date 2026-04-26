# Phase 5: Catalog — Meu Jardim - Context

**Gathered:** 2026-04-26 (power mode)
**Status:** Ready for planning
**Source:** Synthesized from `.planning/phases/05-catalog-meu-jardim/05-QUESTIONS.json` (27/27 answered, all with rationale notes)

<domain>
## Phase Boundary

Phase 5 delivers the Catalog ("Meu Jardim") surface — the "something to identify INTO" that Phase 6 needs:

- A verified user can manually add plants (name + ≥1 photo, `species_id=null`).
- A responsive Catalog grid (2/3/4 columns at 375/600/900 breakpoints) sorted by `acquisition_date desc` (null dates last) with a session-persisted sort control.
- A Plant Profile with cover + thumbnail gallery, inline-editable name/nickname/room/acquisition_date/notes, active-reminders placeholder, photo-journal preview, ID-history link (hidden when no Identifications), and a delete overflow.
- A Location picker exposing prior locations + defaults `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]` + free text (free text becomes reusable).
- Photo Journal: add entry (photo + optional note → `PhotoEntry`), reverse-chronological list, lightbox with edit affordances.
- Plant deletion cascading PhotoEntry + Reminder rows, scheduling storage objects for deletion, setting `Identification.plant_id` NULL while preserving the history row.
- Previously-loaded catalog browsable offline with a clear offline banner.
- Empty Home + empty Catalog states per `UI-04` / `CAT-11`.

**Explicitly NOT in scope (handled by other phases):**

- Identification flow (Phase 6) — the camera button on Home empty state wires to a placeholder route only.
- Care guides + toxicity badges (Phase 7) — Plant Profile shows a hidden care-card slot; Phase 7 fills it.
- Reminders create/done/snooze + push (Phase 8) — the Plant Profile shows an "active reminders" stub only.
- Offline write queue (Phase 9) — Phase 5 ships **read-only offline browse** of cached catalog. Mutating actions while offline are out of scope here.
- Subscription state machine (Phase 10) — read-only mode UI variants ship in Phase 5 behind a stubbed `useSubscription()` hook that always returns `'trialing'`.
- LGPD deletion grace + storage hard-delete (Phase 11) — Phase 5 emits `catalog.plant.deleted` and trusts an Inngest function to clean Storage objects.

</domain>

<decisions>
## Implementation Decisions

### Data Model & Schema

- **D-01 (Q-01a):** `Plant.location` is a denormalized `text NULL` column — no separate `Location` table. Prior locations for the picker are derived via `SELECT DISTINCT location FROM plants WHERE user_id = $1 AND location IS NOT NULL`. Mitigate "Sala" vs "sala" collisions by trimming + lowercasing on case-insensitive compare while preserving the user's display case on storage.
- **D-02 (Q-02b):** `Plant.cover_photo_url` is an explicit nullable text column (matches PRD §4 schema verbatim). On manual create + first PhotoEntry add it is set to that PhotoEntry's `photo_url`. A "Set as cover" affordance (D-18) on any PhotoEntry overwrites it.
- **D-03 (Q-03a):** Cascade is enforced at the **DB level** via FK actions: `PhotoEntry.plant_id` → CASCADE, `Reminder.plant_id` → CASCADE, `Identification.plant_id` → SET NULL. Phase 2 D-07 already commits to this; Phase 5 simply uses it. A single `DELETE FROM plants WHERE id = $1 AND user_id = $2` atomically performs the cascade.
- **D-04 (Q-04b):** Storage object deletion is **asynchronous via Inngest**. The `DELETE /api/v1/plants/:id` request:
  1. Reads all PhotoEntry `photo_url`/`thumbnail_url` paths inside the txn (cover too).
  2. Performs the SQL DELETE (FK cascade fires).
  3. Emits `catalog.plant.deleted` with `{ user_id, plant_id, storage_paths[] }` in the payload.
  4. Returns 204 immediately.

  An Inngest function `catalog/cleanup-storage` reads paths from the event and deletes them in batches via `StorageAdapter`. Durable retries handle transient Storage failures. Phase 4 brings Inngest online; Phase 5 is the second async consumer (after `iam/send-verification-email`).

### Data Fetching & State Management

- **D-05 (Q-05a):** **TanStack Query (React Query)** is the project's server-state library. Adopted in Phase 5 and used in Phases 6-10. Versions resolved during planning. Includes `useInfiniteQuery` (D-06), optimistic mutations (D-07), and a persister to IndexedDB (D-20).
- **D-06 (Q-06a):** **Cursor-paginated infinite scroll** for Catalog list using Phase 2 D-36 cursor format (`base64(JSON.stringify({ id, createdAt }))`). Default page size 50 (matches Phase 2 PRD §5 default), max 200. IntersectionObserver triggers next page near grid bottom.
- **D-07 (Q-07d):** **Hybrid optimistic UI** — optimistic for in-place edits (sort changes, inline field edits) via `useMutation` `onMutate`; **pessimistic** for create + delete (skeleton or button-loading until server response). Sort/edit feel instant; create/delete are commit-y and tolerate a roundtrip.

### Catalog Grid

- **D-08 (Q-08a):** Sort selection persists to **sessionStorage** keyed by `user_id` (e.g. `folhario:catalog:sort:${userId}`). Matches PRD CAT-08 wording "persists for the session" literally. Cleared on tab close. If users complain about reload-resets later, swap to localStorage.
- **D-09 (Q-09a):** **CAT-08 sort scope clarification — sort applies to Catalog only.** Photo Journal stays fixed reverse-chronological per CAT-06. ROADMAP SC-4's wording ("the photo journal screen lists entries reverse-chronologically; a sort control offers name A-Z, ...") is two facts in one breath: journal is reverse-chrono, AND the catalog has a sort control. The sort options (name, location) literally don't apply to PhotoEntry rows.

### Plant Profile

- **D-10 (Q-10a):** Profile layout is a **single-scroll long page**: cover → details (name/nickname/room/acquisition_date/notes) → care-card slot (hidden in Phase 5; Phase 7 fills) → active reminders (stub in Phase 5) → photo journal preview → ID history link (hidden if no Identifications, per D-26). Mobile-native, no hidden state, matches PRD §16's natural vertical reading.
- **D-11 (Q-11b):** Inline edit pattern is **click-to-edit per field**. Read mode shows clean text + a subtle pencil affordance on tap/focus; tap → field becomes a §17-styled input; blur → saves. Read mode preserves the "photography-first, calm" atmosphere; edit mode is field-scoped.
- **D-12 (Q-12a):** Save trigger for inline edits is **save on blur** (auto-commit when the field loses focus). Matches PRD §17 inputs spec ("Validate on BLUR, not keystroke"). Single round-trip per field. No save buttons in profile.

### Manual Add Plant

- **D-13 (Q-13a):** Manual add is a **full-screen route** at `/catalog/new` (or the equivalent App Router segment). Five-field form (name required, ≥1 photo required, nickname/location/acquisition_date/notes optional). Bookmarkable, browser-back works, simpler than a near-full-height bottom sheet on mobile.
- **D-14 (Q-14a):** Manual-add entry points are: (1) Home empty-state CTA "Adicionar manualmente" (text link, per UI-04); (2) Catalog header **"+" button (top-right)** when ≥1 plant exists. **No floating action button** — keeps the §17 atmosphere clean.

### Location Picker (CAT-05)

- **D-15 (Q-15a):** Location picker is a **combobox**: a §17-styled text input that opens a dropdown showing prior locations + the 8 default rooms. Type-to-filter the merged list; tap a suggestion to fill; type new text + Enter/blur to commit a free-text location. Custom component (no native HTML combobox is good enough). One ship, reused for any future picker.

### Photo Journal (CAT-06, UI-11)

- **D-16 (Q-16a):** Photo Journal **add-entry** is a **bottom sheet modal** from the Plant Profile per §17 modal sheet specs (drag handle, focus trap, swipe-down to dismiss, "Fechar" labelled close). Photo + optional note in one focused sheet. Quick "I just took a photo, drop it in" flow.
- **D-17 (Q-17c):** **Tap on a Photo Journal entry opens a fullscreen lightbox + edit overlay** — swipe between photos, note shown in a bottom strip with "Editar nota" / "Excluir" / "Definir como capa" actions. Best of immersion + edit affordances.
- **D-18 (Q-18c):** Per-PhotoEntry actions: **Delete + Edit note + "Set as cover"**. The "Set as cover" action overwrites `Plant.cover_photo_url` (D-02). Couples with D-17's lightbox bottom strip.

### Plant Deletion (CAT-09)

- **D-19 (Q-19a):** Deletion confirmation is the **standard §17 destructive modal**: title "Excluir [name]?", body "Isso apagará as fotos e lembretes desta planta. A ação não pode ser desfeita.", "Cancelar" primary in layout, "Excluir" destructive (Urgent Poppy) secondary. PRD §17 explicitly bans freemium dark patterns on delete flows — text-typed confirmation feels corporate-harsh for a personal plant.

### Offline Browse (OFF-08)

- **D-20 (Q-20d):** Offline cache is a **two-layer hybrid**:
  - **TanStack Query persister to IndexedDB** (`@tanstack/query-persist-client-core` + `idb-keyval` adapter) for `/api/v1/plants` list + per-plant profile JSON + photo-journal JSON. Couples with D-05.
  - **Serwist runtime caching** (Service Worker Cache Storage) for cover/thumbnail images. Stale-while-revalidate.

  Each layer does what it does best. Phase 1 ships Serwist as skeleton; Phase 3 enables runtime caching; Phase 5 owns both the TQ persister config and the Serwist runtime route for image caching.
- **D-21 (Q-21b):** **Cache scope** is `plants list + every previously-visited plant profile + photo-journal JSON for visited plants + cover/thumbnail images`. Per-plant lazy hydration (visiting a plant online caches its profile/journal); doesn't blow cache quota for users with many plants. Pinch-zoom on photo-journal originals when offline is **deferred** (Phase 9 or later).

### API Endpoints

- **D-22 (Q-22a):** **Plant create is a two-step request** reusing Phase 2 D-27 photo upload pipeline:
  1. Client compresses + strips EXIF → `POST /api/v1/photos/upload` (Phase 2's route) → returns `{ photo_url, thumbnail_url }`.
  2. Client `POST /api/v1/plants` with `{ name, nickname?, location?, acquisition_date?, notes?, photo_urls: [...] }` and an `Idempotency-Key`. Server creates Plant + initial PhotoEntry + sets `cover_photo_url` to the first photo. Returns the created Plant.

  Idempotency-Key on `/plants` makes Plant create replay-safe (Phase 2 D-37/D-38). The photo upload is its own idempotent operation.
- **D-23 (Q-23a):** **PhotoEntry add is a two-step request** mirroring D-22: `POST /api/v1/photos/upload` → `POST /api/v1/plants/:id/photos` with `{ photo_url, thumbnail_url, note? }`. Nested resource path is RESTful, ownership-clear. Reuses upload pipeline.

### Cross-Phase Coupling

- **D-24 (Q-24a):** **Read-only mode UI variants ship in Phase 5** behind a stubbed `useSubscription()` hook that always returns `'trialing'`. All branches land now (hidden Add button, hidden inline-edit affordances, hidden delete overflow, persistent read-only banner stub). Phase 10 swaps the hook implementation to read live `Subscription.status` — zero retrofit cost. Locate the hook at `src/contexts/billing/api/use-subscription.ts` (or equivalent) so Phase 10 owns the file.
- **D-25 (Q-25a):** **Camera button → Phase 6 placeholder** = a route exists at `/identify` showing a §17 empty-state composition (Sage line-art illustration + Source Serif 4 headline "Identificação em breve" + Calm Slate hint + a single Canopy CTA "Voltar ao catálogo"). Calm, on-brand. Phase 6 replaces this page wholesale with the real capture flow.
- **D-26 (Q-26a):** **ID-history link is hidden when there are no Identifications** for that Plant (matches PRD §16 "ID history (if applicable)" literally). Zero placeholder UI. Phase 6 starts creating Identification rows; the link appears automatically once `count(Identification WHERE plant_id = $1) > 0`.

### Form Drafts

- **D-27 (Q-27a):** **Manual-add form auto-saves a draft to sessionStorage** on every change (per PRD §17 inputs mandate "Forms >3 fields auto-save draft state locally" — manual-add has 5 fields). Key `folhario:catalog:new-plant-draft:${userId}`. Cleared on successful create. Inline plant-profile edits are single-field saves (D-12) and don't need draft state. Photo-journal note is <3 fields and below the design-system threshold.

### Claude's Discretion

- Exact Tailwind class composition + naming for catalog cards, modals, and form inputs (constrained by PRD §17 specifications).
- Exact lightbox library or hand-rolled component (constrained by §17 motion + §18 accessibility — no react-image-lightbox if it ships an Inter override or violates focus-trap rules).
- Exact IntersectionObserver root margin / threshold values for infinite scroll.
- Exact serializer format for the sort sessionStorage key, provided it's namespaced and per-user.
- Exact Inngest concurrency / retry settings on `catalog/cleanup-storage` (sane defaults: concurrency=5 per user, max retries=5, exponential backoff).
- Exact Drizzle column types for `cover_photo_url` and `location` (nullable text, indexed where needed).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + scope

- `.planning/PROJECT.md` — Core value, constraints, locale (pt-BR), accessibility (WCAG 2.1 AA ship blocker), platform (mobile-first PWA), launch blockers, key decisions.
- `.planning/REQUIREMENTS.md` — `CAT-01` through `CAT-11`, `OFF-08`, `UI-04`, `UI-07`, `UI-08`, `UI-11` (also referenced: `UI-17` skeletons, `UI-18` empty states, `UI-19` error states, `UI-20` motion, `UI-21` safe areas, `UI-22` accessibility, `UI-23` i18n, `UI-24` persistent banners, `UI-25` design-system guardrails).
- `.planning/ROADMAP.md` §Phase 5 — Goal + 5 success criteria.
- `CLAUDE.md` — Stack lock-in (Next 16.2.3, React 19.2.5, Drizzle, `@serwist/next` 9.5.7, `next-intl` 4.9.1, `postgres-js`).

### Prior phase decisions (mandatory)

- `.planning/phases/01-foundation/01-CONTEXT.md` — D-07 path aliases, D-08 no barrels, D-10/D-11/D-12 closed error registry, D-25 Postgres 17, D-29 server/client env split, security headers via `next.config.ts`.
- `.planning/phases/02-data-layer/02-CONTEXT.md` — **read this in full before planning Phase 5.** Specifically:
  - D-01 per-context schema ownership (`src/contexts/catalog/infrastructure/db/schema.ts`).
  - D-07 FK actions (Phase 5 D-03 builds on this).
  - D-16 functional repositories (no classes); D-17 ESLint+Vitest guard "no Drizzle in route handlers".
  - D-18 Unit-of-Work; D-19 domain-layer Zod schemas.
  - D-20-D-23 RLS posture (`auth.uid()` in policies); user-owned tables get `FOR ALL TO authenticated USING ((select auth.uid()) = user_id)`.
  - D-24-D-27 Storage adapter, private buckets, server proxy upload route, path layout `{user_id}/{aggregate_id}/{file_id}.{ext}`.
  - D-28-D-31 image pipeline (browser-image-compression, exifr, sharp thumbnails synchronously in upload route).
  - D-32-D-35 AuthAdapter + JWT verify (Phase 4 extends).
  - D-36 cursor format `base64(JSON.stringify({ id, createdAt }))`; D-37/D-38 idempotency table + 7-day TTL.
  - D-43 transaction-rollback integration tests; D-45 Playwright over real HTTP.

### PRD anchors (single source of truth)

- `docs/CAVE-PRD.md` §2 — Tech stack table; folder layout; route-handler thinness rule.
- `docs/CAVE-PRD.md` §3 — Bounded contexts (Phase 5 owns `catalog`).
- `docs/CAVE-PRD.md` §4 — Data model (`Plant`, `PhotoEntry`, `Identification` with cascade rules).
- `docs/CAVE-PRD.md` §5 — API rules (cursor pagination defaults, idempotency, error codes — closed registry).
- `docs/CAVE-PRD.md` §7 — Catalog ("Meu Jardim"): add plant, plant profile, location picker, photo journal, sorting (verbatim source for D-15 location picker behavior).
- `docs/CAVE-PRD.md` §10 — Offline & Sync (cached catalog browsable; Phase 9 ships the queue, Phase 5 ships **read-only browse only**).
- `docs/CAVE-PRD.md` §11 — Image handling (≤1MB, EXIF strip client-side, GPS reject server-side, thumbnail gen, no per-user storage limit MVP).
- `docs/CAVE-PRD.md` §16 — Screens: Home (empty + default), Catalog, Plant Profile (cover + thumbnail gallery + inline-edit + care-card preview + active reminders + photo-journal preview + ID-history link + delete overflow), Photo Journal (per-plant chronological + add entry).
- `docs/CAVE-PRD.md` §17 — Design system: color tokens (Paper Cream / Night Cream), typography (Source Serif 4 + Plus Jakarta Sans), Lucide icons, cards (`Plant card (catalog): Warm Ivory bg, 16px radius, 4:5 portrait photo top, 16px padding`), modal sheets (drag handle, focus trap, "Fechar" label), inputs (validate on blur, error = 3 redundant signals), buttons (destructive secondary to Cancelar in layout), bottom navigation, loading states (skeletal shimmer 300ms delay threshold), empty states (Sage line art + Source Serif headline + Calm Slate hint + single Canopy CTA), error states (inline + calm, never full-screen red), layout (8pt grid, breakpoints 375/600/900), motion (spring stiffness 120 / damping 18), safe areas (`min-h-[100dvh]`, `env(safe-area-inset-*)`), banned patterns.
- `docs/CAVE-PRD.md` §18 — Accessibility (color never sole signal, image alt from plant name + nickname, live regions for async state, modal focus trap, decorative illustrations `aria-hidden`).
- `docs/CAVE-PRD.md` §19 — Testing layers (unit + real-Postgres integration + Playwright).
- `docs/CAVE-PRD.md` §20 — Environments + observability events (`plant_added` PostHog event lands here).

### Phase 5 explicit dependencies on incomplete phases

- **Phase 3** (Design System + App Shell): supplies bottom nav, route shell, base layout, color tokens, typography, motion primitives. Phase 5 plugs catalog/home/identify routes into the shell.
- **Phase 4** (Auth + Email Verification + Inngest onboarding): supplies the JWT-verified `User` row, Inngest infrastructure (D-04 uses it), and the email-verification gate.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets (built or pending)

- **`src/contexts/catalog/{domain,application,infrastructure,api,inngest}/`** — empty `.gitkeep` directories from Phase 1 INFRA-02. Phase 2 fills `infrastructure/db/schema.ts` (D-01) and `infrastructure/db/plants.ts`-style repositories (D-16). Phase 5 fills the rest of `application` (use-cases), `api` (route handlers under `/api/v1/plants`), and `inngest` (`catalog/cleanup-storage` function).
- **`src/contexts/catalog/infrastructure/photo-storage.ts`** — Phase 2 D-25 ships this context-scoped wrapper around the generic `StorageAdapter`. Phase 5 reuses it for `Plant.cover_photo_url` and `PhotoEntry.photo_url`/`thumbnail_url` paths.
- **`src/app/api/v1/photos/upload/route.ts`** — Phase 2 D-27 ships this server proxy upload route (validates GPS, uploads with service role, generates thumbnail via `sharp`, inserts metadata). Phase 5 D-22 + D-23 reuse it as the first step of the two-step Plant create + PhotoEntry add flows.
- **`src/shared/db/client.ts`** + **`src/shared/db/migration-client.ts`** — Phase 2 D-14/D-15 connection entry points. Repositories take a Drizzle client parameter (D-16).
- **`src/shared/config/errors.ts`** — Phase 1 D-10/D-11/D-12 closed error registry. Phase 5 surfaces `validation_failed` (manual-add field validation), `not_found` (deleted/foreign plant), `unauthenticated`/`token_expired` (RLS), `read_only_mode` 402 on mutations when D-24's stubbed hook is later flipped to non-trialing.
- **`src/contexts/billing/api/use-subscription.ts`** (D-24) — file Phase 5 creates as a stub returning `'trialing'`. Phase 10 swaps the implementation.
- **`tests/integration/`** — Phase 1's CI runs `vitest --project=integration` against `postgres:17-alpine`. Phase 5 adds catalog integration tests under this project per Phase 2 D-43 transaction-rollback pattern.
- **Inngest infrastructure** — Phase 4 onboards Inngest. Phase 5's `catalog/cleanup-storage` function (D-04) is the second async consumer.

### Established Patterns (must follow)

- **Repositories are functional modules**, not classes (Phase 2 D-16). Phase 5 catalog repositories live at `src/contexts/catalog/infrastructure/db/{plants,photo-entries}.ts`.
- **No Drizzle in route handlers** — enforced by ESLint + Vitest guard (Phase 2 D-17). Route handlers under `/api/v1/plants` and `/api/v1/plants/:id/photos` validate (Zod) → call use-case → HTTP-map.
- **Domain-layer Zod schemas derived from `drizzle-zod`** (Phase 2 D-19); routes import the domain schemas, not raw Drizzle table definitions.
- **Idempotency-Key on every mutating endpoint** (Phase 2 D-37/D-38). Plant create + delete + PhotoEntry add accept the header.
- **Cursor format `base64(JSON.stringify({ id, createdAt }))`** (Phase 2 D-36) for the catalog list endpoint.
- **`Sentry.setUser({ id })` only — never email** (Phase 1 LGPD-13 / D-22). Plant aggregate emits `plant_added` PostHog event (server-side via `posthog-node` per Phase 1 D-21 client posture; D-21 D-21 dataset only contains identified user_id).
- **i18n via `next-intl`** (Phase 1 D-15 + INFRA-23) — all user-facing strings go through the i18n layer, no hardcoded copy.
- **Server-rendered user-local times via `date-fns-tz`** with the user's `User.timezone` column (Phase 1 INFRA-23 + PROJECT.md locale constraint). Acquisition date display + photo-journal timestamps use this.
- **Closed error registry** — Phase 5 emits only `validation_failed`, `not_found`, `unauthenticated`, `token_expired`, `forbidden`, `read_only_mode` (post-Phase-10). No new error codes.

### Integration Points

- **Phase 2 photo upload route** ↔ Phase 5 manual-add + PhotoEntry add flows (D-22, D-23).
- **Phase 2 `Plant`/`PhotoEntry`/`Identification` schemas** ↔ Phase 5 repositories + cascade SQL (D-03).
- **Phase 4 Inngest** ↔ Phase 5 `catalog/cleanup-storage` function (D-04).
- **Phase 4 JWT auth** ↔ Phase 5 RLS-protected `/api/v1/plants*` routes.
- **Phase 3 design tokens + bottom nav + app shell** ↔ Phase 5 Catalog tab, Home tab, /identify placeholder.
- **Phase 6 Identify capture** ↔ Phase 5 `/identify` placeholder route (D-25) gets replaced wholesale.
- **Phase 7 CareGuide** ↔ Phase 5 Plant Profile care-card slot (rendered hidden until Phase 7 implements).
- **Phase 8 Reminders** ↔ Phase 5 Plant Profile active-reminders stub.
- **Phase 10 Subscription state machine** ↔ Phase 5 `useSubscription()` hook (D-24).

</code_context>

<specifics>
## Specific Ideas

- **Plant aggregate creation event emits `plant_added` PostHog event** (PRD §20 taxonomy) — fire from the Plant repository or use-case layer, not the route handler.
- **Manual-add form draft key shape:** `folhario:catalog:new-plant-draft:${userId}` (D-27).
- **Sort sessionStorage key shape:** `folhario:catalog:sort:${userId}` (D-08). Values: `name_asc | name_desc | acquired_desc | acquired_asc | location_asc`.
- **Catalog card geometry per PRD §17 "Plant card":** Warm Ivory/Embered bg, 16px radius, 4:5 portrait photo top, 16px padding, light shadow `0 2px 12px rgba(20,52,36,0.06)` / dark 1px Hairline Umber border.
- **Loading skeleton geometry per PRD §17:** "Catalog card skeleton: 4:5 Hairline Beige/Umber photo block + 60% title line + 40% metadata line. Shimmer left-to-right 1.4s in Warm Ivory/Embered at 40% opacity. Render only after 300ms delay; faster ops skip shimmer + fade content in over 120ms."
- **Empty-state composition per PRD §17 / CAT-11:** Sage line-art illustration ("estante esperando" — pot/sprout/shelf), Source Serif 4 headline "Sua estante ainda está esperando a primeira planta.", Calm Slate hint, single Canopy primary CTA. Home empty state separately matches UI-04 ("Identifique sua primeira planta" + camera button + "Adicionar manualmente" text link).
- **Delete modal copy (pt-BR):** title "Excluir [name]?", body "Isso apagará as fotos e lembretes desta planta. A ação não pode ser desfeita.", "Cancelar" primary, "Excluir" destructive. No emoji.
- **Inngest event payload shape (D-04):** `{ user_id: string, plant_id: string, storage_paths: string[] }` — paths are pre-collected inside the SQL transaction so the function doesn't have to query a deleted row.
- **PhotoEntry lightbox bottom strip:** note text (Plus Jakarta Sans 14, Calm Slate) + actions row (`Editar nota` text-link, `Definir como capa` text-link, `Excluir` destructive overflow). Keyboard-navigable, focus trap, swipe-down dismiss.
- **Inline-edit pencil affordance:** small Lucide `pencil` icon (16px, Calm Slate, 1.5px stroke per §17 iconography) appears on `:hover` (desktop) or always (mobile) next to editable fields. On focus, the pencil disappears + the field becomes a §17-styled input.

</specifics>

<deferred>
## Deferred Ideas

Captured here so they're not lost; explicitly out of scope for Phase 5.

- **Pinch-zoom on photo-journal originals when offline** (D-21) — Phase 5 caches thumbnails only. Original-image offline access can land in Phase 9 (offline queue + sync) or a later hardening pass.
- **Cross-plant photo journal view** (Q-09 option c) — not in PRD §16. Could surface in v2 ANALYTICS-v2 / a "memories" feed.
- **Photo replacement on PhotoEntry** (Q-18 option d) — uncommon UX, storage cleanup gets murky. Deleting + re-adding the entry is the supported path.
- **Soft-delete with undo banner for plant deletion** (Q-19 option d) — adds DB complexity (every Plant query filters `deleted_at`) and conflicts with D-03 hard cascade. PRD doesn't call for it.
- **Custom plant-tag system / per-plant labels beyond `nickname` + `location`** — not in PRD §7. v2 candidate.
- **Per-plant cover photo cropping / aspect override** — Phase 5 uses 4:5 cards globally per §17. Custom cropping = v2.
- **Catalog filtering (by location, by has-care-guide, by has-active-reminders)** — PRD §16 specifies sort only, no filter UI in MVP. v2 candidate.
- **Bulk delete / multi-select in Catalog grid** — not in PRD §16. v2 candidate.
- **Sharing a plant profile (export, social)** — explicitly out of scope per PROJECT.md "Real-time chat / community / social — not a social app".

</deferred>

---

*Phase: 05-catalog-meu-jardim*
*Context gathered: 2026-04-26 (power mode, 27/27 answered)*
