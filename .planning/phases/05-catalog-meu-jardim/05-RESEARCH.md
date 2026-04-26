# Phase 5: Catalog — Meu Jardim - Research

**Researched:** 2026-04-26
**Domain:** Server-state caching (TanStack Query + persister), bottom-sheet/lightbox/combobox accessibility, Inngest event consumer with transactional outbox, two-step photo upload + Plant create, drizzle-zod domain schemas, Service Worker runtime caching.
**Confidence:** HIGH on locked stack (CONTEXT.md 27/27 answered), MEDIUM on a11y-grade UI primitive choices (Vaul vs hand-rolled), MEDIUM on TQ-persister + Serwist coordination (no canonical reference recipe — pattern is sound but bespoke).

## Summary

Phase 5 is **almost entirely a "wire pre-locked decisions together" phase**. CONTEXT.md (27/27 answered) locked TanStack Query as the project's server-state library, IDB persister via `@tanstack/react-query-persist-client` + `idb-keyval` for offline JSON, Serwist runtime caching for cover/thumbnail images, hybrid optimistic UI (sort + inline edits = optimistic; create + delete = pessimistic), cursor-paginated infinite scroll with the Phase 2 D-36 cursor format, hand-rolled combobox/bottom-sheet/lightbox per WAI-ARIA APG, an Inngest `catalog/cleanup-storage` consumer fed by a durable pending-deletion table written atomically with the plant DELETE, and a `useSubscription()` stub returning `'trialing'` so all read-only-mode UI branches ship now.

The research found:

1. **TanStack Query 5.100.5** is current and works with React 19.2.5 + Next 16.2.3 App Router. The `PersistQueryClientProvider` ships built-in race protection via the internal `useIsRestoring` hook — this is the exact mechanism that prevents the persister-hydration race. Use it; do not hand-roll a `useEffect`-based restorer.
2. **TQ persister and Serwist do not overlap** — TQ owns JSON in IndexedDB, Serwist owns images in Cache Storage. The two layers cache different MIME types and never collide. Document this explicitly so the planner does not chase phantom dedup work.
3. **Atomic transaction + Inngest event = two-stage outbox**. The DB transaction commits both the plant DELETE and a `pending_storage_deletion` row; an event is then dispatched. If the event dispatch fails after commit, a reconciler/poller scans for `pending` rows older than threshold. Inngest's `step.sendEvent` is durable when called inside another Inngest function, but the API route handler that originated the DELETE is a one-shot HTTP request — there is no retry loop unless you explicitly build one (or rely on the reconciler).
4. **Vaul 1.1.2** is a credible accessible bottom-sheet primitive and matches the §17 modal-sheet contract (drag handle, snap points, focus trap, swipe-down). It does NOT ship Inter or override fonts. Recommend adopting it instead of hand-rolling — saves significant a11y testing surface.
5. **Hand-roll the combobox** per WAI-ARIA APG 1.2 "Editable Combobox with List Autocomplete" pattern (DOM focus stays on input, visual focus moves via `aria-activedescendant`). No good library fits the §17 atmosphere without overriding fonts.
6. **Hand-roll the lightbox** — `yet-another-react-lightbox` (0.27.19) is current but ships its own font/theme system that conflicts with §17 (Source Serif 4 + Plus Jakarta Sans, no Inter). Use `focus-trap` (7.1.3) for the focus-trap primitive only.
7. **Two-step Plant create flow has a critical security pitfall** — server MUST verify the storage path prefix `{user_id}/{plant_id}/{photo_id}` in every submitted `photo_url` matches the authenticated user AND the submitted plant id. Otherwise photo-URL spoofing on `POST /api/v1/plants` lets a malicious client claim any other user's photo as part of their plant.

**Primary recommendation:** Plan Phase 5 as a small set of TDD waves: (1) catalog repo + UoW + drizzle-zod domain schemas; (2) `/api/v1/plants*` route handlers with idempotency + ownership validation; (3) Inngest `catalog/cleanup-storage` + outbox table; (4) TQ provider + persister + IDB adapter; (5) Catalog grid + Plant Profile + Manual Add screens; (6) Combobox + Bottom Sheet (Vaul) + Lightbox; (7) Read-only-mode hook + variants; (8) Playwright E2E + a11y smoke. Wave 0 must add the test infrastructure for a11y (axe-core), Vaul, focus-trap, and the IDB-keyval test harness.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Data Model & Schema:**

- **D-01:** `Plant.location` is a denormalized `text NULL` column — no separate `Location` table. Prior locations for the picker derived via `SELECT DISTINCT location FROM plants WHERE user_id = $1 AND location IS NOT NULL`. Mitigate "Sala" vs "sala" via trim + lowercase compare; preserve user's display case on storage.
- **D-02:** `Plant.cover_photo_url` is an explicit nullable text column. On manual create + first PhotoEntry add it is set to that PhotoEntry's `photo_url`. "Set as cover" affordance overwrites it.
- **D-03:** Cascade enforced at DB level via FK actions: `PhotoEntry.plant_id` → CASCADE, `Reminder.plant_id` → CASCADE, `Identification.plant_id` → SET NULL. (Phase 2 D-07 already commits to this.)
- **D-04:** Storage object deletion is **asynchronous via Inngest with a durable DB schedule**. The `DELETE /api/v1/plants/:id` request flow:
  1. Open transaction; read PhotoEntry-owned `photo_url`/`thumbnail_url` storage paths for the plant. Must NOT schedule Identification-owned upload paths even if currently used as `Plant.cover_photo_url`.
  2. Insert durable pending storage-deletion/outbox record in same transaction.
  3. Perform SQL DELETE (FK cascade fires).
  4. Commit transaction.
  5. Emit canonical `plant.deleted` with `{ user_id, plant_id, storage_deletion_job_id, storage_paths[] }`.
  6. Return 204 only after deletion is committed AND cleanup event is dispatched or durably queued for dispatch.
  An Inngest function `catalog/cleanup-storage` listens to `plant.deleted`, loads the pending storage-deletion job as the source of truth, deletes paths in batches via `StorageAdapter`, marks the job complete. If event dispatch fails after commit, the pending job remains visible to a retry dispatcher/reconciler. Phase 5 owns a small catalog-local pending storage-deletion table plus tests proving the row is committed atomically with the plant delete (Phase 4 may not provide a generic event outbox/dispatcher).

**Data Fetching & State Management:**

- **D-05:** **TanStack Query (React Query)** is the project's server-state library. Adopted in Phase 5 and used in Phases 6-10. Includes `useInfiniteQuery` (D-06), optimistic mutations (D-07), and a persister to IndexedDB (D-20).
- **D-06:** **Cursor-paginated infinite scroll** for Catalog list using Phase 2 D-36 cursor format (`base64(JSON.stringify({ id, createdAt }))`). Default page size 50, max 200. IntersectionObserver triggers next page near grid bottom.
- **D-07:** **Hybrid optimistic UI** — optimistic for in-place edits (sort changes, inline field edits) via `useMutation` `onMutate`; **pessimistic** for create + delete (skeleton or button-loading until server response).

**Catalog Grid:**

- **D-08:** Sort selection persists to **sessionStorage** keyed by `user_id` (e.g. `folhario:catalog:sort:${userId}`). Cleared on tab close.
- **D-09:** **CAT-08 sort scope = Catalog only.** Photo Journal stays fixed reverse-chronological per CAT-06.

**Plant Profile:**

- **D-10:** Profile layout is a **single-scroll long page**: cover → details → care-card slot (hidden Phase 5; Phase 7 fills) → active reminders (stub) → photo journal preview → ID history link (hidden if no Identifications).
- **D-11:** Inline edit pattern is **click-to-edit per field**. Read mode shows clean text + subtle pencil affordance; tap → §17-styled input; blur → saves.
- **D-12:** Save trigger for inline edits is **save on blur**.

**Manual Add Plant:**

- **D-13:** Manual add is a **full-screen route** at `/catalog/new` (or equivalent App Router segment). Five-field form (name required, ≥1 photo required, nickname/location/acquisition_date/notes optional).
- **D-14:** Manual-add entry points: (1) Home empty-state CTA "Adicionar manualmente" text link; (2) Catalog header **"+" button (top-right)** when ≥1 plant exists. **No floating action button.**

**Location Picker (CAT-05):**

- **D-15:** Location picker is a **combobox** — §17-styled text input opens dropdown showing prior locations + 8 default rooms. Type-to-filter merged list. Custom component (no native HTML combobox is good enough). Reused for any future picker.

**Photo Journal (CAT-06, UI-11):**

- **D-16:** Photo Journal **add-entry** is a **bottom sheet modal** from Plant Profile per §17 modal sheet specs (drag handle, focus trap, swipe-down dismiss, "Fechar" labelled close).
- **D-17:** **Tap on a Photo Journal entry opens a fullscreen lightbox + edit overlay** — swipe between photos, note shown in bottom strip with "Editar nota" / "Excluir" / "Definir como capa" actions.
- **D-18:** Per-PhotoEntry actions: **Delete + Edit note + "Set as cover"**. "Set as cover" overwrites `Plant.cover_photo_url` (D-02).

**Plant Deletion (CAT-09):**

- **D-19:** Deletion confirmation = **standard §17 destructive modal**: title "Excluir [name]?", body "Isso apagará as fotos e lembretes desta planta. A ação não pode ser desfeita.", "Cancelar" primary in layout, "Excluir" destructive (Urgent Poppy) secondary. No text-typed confirmation, no freemium dark patterns.

**Offline Browse (OFF-08):**

- **D-20:** Offline cache is a **two-layer hybrid**:
  - **TanStack Query persister to IndexedDB** (`@tanstack/react-query-persist-client` + `idb-keyval` adapter) for `/api/v1/plants` list + per-plant profile JSON + photo-journal JSON.
  - **Serwist runtime caching** (Service Worker Cache Storage) for cover/thumbnail images. Stale-while-revalidate.
- **D-21:** **Cache scope** = `plants list + every previously-visited plant profile + photo-journal JSON for visited plants + cover/thumbnail images`. Per-plant lazy hydration.

**API Endpoints:**

- **D-22:** **Plant create is a two-step request** reusing Phase 2 D-27 photo upload pipeline:
  1. Client reserves/generates a Plant UUID for the manual-add draft, compresses + strips EXIF, calls `POST /api/v1/photos/upload` with that aggregate id. Returns `{ photo_url, thumbnail_url }`.
  2. Client `POST /api/v1/plants` with `{ id, name, nickname?, location?, acquisition_date?, notes?, initial_photos: [{ photo_url, thumbnail_url }] }` and an `Idempotency-Key`. Server validates every uploaded path belongs to the authenticated user + submitted plant id, creates Plant + initial PhotoEntry rows, sets `cover_photo_url` to the first `photo_url`. Returns the created Plant.
- **D-23:** **PhotoEntry add is a two-step request**: `POST /api/v1/photos/upload` → `POST /api/v1/plants/:id/photos` with `{ photo_url, thumbnail_url, note? }`.
- **D-23A (CAT-01):** **Create-from-identification is a catalog-side mutation, not the full identification flow.** Phase 5 ships `POST /api/v1/plants/from-identification` with an `Idempotency-Key` and body `{ identification_id, selected_result_id, name?, nickname?, location?, acquisition_date?, notes? }`. Verifies Identification belongs to user and is not already linked, creates Plant with `species_id` from selected result, pre-fills `name`, sets `cover_photo_url` from identification upload, updates `Identification.plant_id`. Phase 6 owns creating Identification rows.
- **D-23B:** **Complete Phase 5 API mutation surface** — all of these accept `Idempotency-Key`: `POST /api/v1/plants`, `POST /api/v1/plants/from-identification`, `PATCH /api/v1/plants/:id` for inline fields, `DELETE /api/v1/plants/:id`, `POST /api/v1/plants/:id/photos`, `PATCH /api/v1/plants/:id/photos/:photoEntryId` for note edits, `DELETE /api/v1/plants/:id/photos/:photoEntryId`, `PATCH /api/v1/plants/:id/cover-photo` for "Definir como capa". Read endpoints: `GET /api/v1/plants`, `GET /api/v1/plants/:id`, `GET /api/v1/plants/:id/photos`.

**Cross-Phase Coupling:**

- **D-24:** **Read-only mode UI variants ship in Phase 5** behind a stubbed `useSubscription()` hook that always returns `'trialing'`. All branches land now (hidden Add button, hidden inline-edit affordances, hidden delete overflow, persistent read-only banner stub). Phase 10 swaps the hook implementation. Locate the hook at `src/contexts/billing/api/use-subscription.ts`.
- **D-25:** **Camera button → Phase 6 placeholder** — a route exists at `/identify` showing a §17 empty-state composition (Sage line-art illustration + Source Serif 4 headline "Identificação em breve" + Calm Slate hint + Canopy CTA "Voltar ao catálogo"). Phase 6 replaces wholesale.
- **D-26:** **ID-history link is hidden when there are no Identifications** for that Plant. Zero placeholder UI.

**Form Drafts:**

- **D-27:** **Manual-add form auto-saves a draft to sessionStorage** on every change (PRD §17 inputs mandate "Forms >3 fields auto-save draft state locally" — manual-add has 5 fields). Key `folhario:catalog:new-plant-draft:${userId}`. Cleared on successful create. Inline plant-profile edits are single-field saves and don't need draft state. Photo-journal note is <3 fields and below threshold.

### Claude's Discretion

- Exact Tailwind class composition + naming for catalog cards, modals, and form inputs (constrained by PRD §17 specifications).
- Exact lightbox library or hand-rolled component (constrained by §17 motion + §18 accessibility — no react-image-lightbox if it ships an Inter override or violates focus-trap rules).
- Exact IntersectionObserver root margin / threshold values for infinite scroll.
- Exact serializer format for the sort sessionStorage key, provided it's namespaced and per-user.
- Exact Inngest concurrency / retry settings on `catalog/cleanup-storage` (sane defaults: concurrency=5 per user, max retries=5, exponential backoff).
- Exact Drizzle column types for `cover_photo_url` and `location` (nullable text, indexed where needed).

### Deferred Ideas (OUT OF SCOPE)

- **Pinch-zoom on photo-journal originals when offline** (D-21) — Phase 5 caches thumbnails only. Original-image offline access lands in Phase 9 or later.
- **Cross-plant photo journal view** — not in PRD §16. v2 candidate.
- **Photo replacement on PhotoEntry** — uncommon UX, storage cleanup gets murky. Delete + re-add is the supported path.
- **Soft-delete with undo banner for plant deletion** — adds DB complexity, conflicts with D-03 hard cascade. PRD doesn't call for it.
- **Custom plant-tag system / per-plant labels beyond `nickname` + `location`** — not in PRD §7. v2 candidate.
- **Per-plant cover photo cropping / aspect override** — Phase 5 uses 4:5 cards globally per §17. Custom cropping = v2.
- **Catalog filtering** (by location, by has-care-guide, by has-active-reminders) — PRD §16 specifies sort only, no filter UI in MVP. v2.
- **Bulk delete / multi-select in Catalog grid** — not in PRD §16. v2.
- **Sharing a plant profile** — explicitly out of scope per PROJECT.md "Real-time chat / community / social — not a social app".

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID         | Description                                                                                                                                                                              | Research Support                                                                                                                                                                                   |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **CAT-01** | From identification + selected result, Plant created with `species_id`, name pre-filled, cover photo from identification upload                                                          | Standard Stack §"Catalog API + Use Cases", Architecture §"Cross-context catalog mutation pattern", Code Examples §"`/api/v1/plants/from-identification` use case skeleton"                         |
| **CAT-02** | Manual plant creation with name + ≥1 photo creates Plant `species_id=null` + PhotoEntry for initial photo                                                                                | Architecture §"Two-step Plant create flow (D-22)", Pitfall §"Storage path ownership validation"                                                                                                    |
| **CAT-03** | Manual create missing name OR missing photo → `validation_failed`, no row, field highlighted                                                                                             | Standard Stack §"drizzle-zod domain schema", Architecture §"Zod boundary validation in route handler"                                                                                              |
| **CAT-04** | Plant profile shows name, nickname, room, acquisition_date, notes, cover, care-card link (if CareGuide exists), active reminders, photo journal, identification history                  | Architecture §"Single-scroll Plant Profile with stub sections" (care-card slot hidden, reminders stub, ID-history link conditional)                                                                |
| **CAT-05** | Location picker shows user's prior locations + defaults `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]` + free text; free text becomes reusable                  | Standard Stack §"Combobox primitive", Architecture §"WAI-ARIA APG 1.2 combobox pattern", Code Examples §"Combobox keyboard contract"                                                               |
| **CAT-06** | Add photo to photo journal with optional note → PhotoEntry with plant_id, photo_url, thumbnail_url, note; reverse-chronological timeline                                                 | Architecture §"Two-step PhotoEntry add (D-23)", Standard Stack §"Vaul bottom-sheet" for the add modal                                                                                              |
| **CAT-07** | Catalog default sort: `acquisition_date` desc, null dates last                                                                                                                           | Architecture §"Cursor pagination with secondary sort", Pitfall §"Cursor pagination edge case (NULL acquisition_date)"                                                                              |
| **CAT-08** | Sort control offers name A-Z, name Z-A, date newest, date oldest, location; selected sort persists for session                                                                           | Architecture §"sessionStorage sort persistence", Code Examples §"`useSortPreference` hook"                                                                                                         |
| **CAT-09** | Deleting a plant cascades PhotoEntry + Reminder rows, schedules storage objects for deletion, sets `Identification.plant_id` NULL but preserves the history row                          | Architecture §"Atomic delete + transactional outbox", Standard Stack §"Inngest event consumer", Pitfall §"Post-commit event-dispatch failure", Code Examples §"`catalog/cleanup-storage` function" |
| **CAT-10** | Catalog grid responsive: 2 cols ≤375px, 3 cols 600–899px, 4 cols ≥900px                                                                                                                  | Architecture §"Responsive CSS Grid breakpoints (375/600/900 — NOT 768/1024)"                                                                                                                       |
| **CAT-11** | Empty catalog state: "Sua estante ainda está esperando a primeira planta." with Sage line-art illustration + single Canopy primary CTA                                                   | UI-SPEC.md verbatim copy + composition rules (PRD §17 empty-state spec)                                                                                                                            |
| **OFF-08** | Previously loaded catalog browsable offline; new identifications blocked with clear message                                                                                              | Standard Stack §"TanStack Query persister to IDB" + Serwist runtime caching, Architecture §"Two-layer offline cache", Pitfall §"TQ persister + SW double-cache"                                    |
| **UI-04**  | Home screen — empty: full-bleed "Identifique sua primeira planta" CTA + camera button + "Adicionar manualmente" text link                                                                | UI-SPEC.md "Empty Home" composition (asymmetric, NOT centered hero stack); D-25 placeholder route at `/identify`                                                                                   |
| **UI-07**  | Catalog grid responsive breakpoints with card 4:5 photo + name + nickname + location; sort control                                                                                       | Architecture §"Responsive grid", §"Catalog card geometry", Standard Stack §"Next/Image with Supabase loader"                                                                                       |
| **UI-08**  | Plant profile — cover + thumbnail gallery, inline-edit name/nickname/room/acquisition_date/notes, care card (or hidden), active reminders, photo journal preview, ID history link        | Architecture §"Inline edit pattern (click-to-edit per field, save on blur)", §"Conditional sections (care/ID hidden when empty)"                                                                   |
| **UI-11**  | Photo journal screen — per-plant chronological list with add entry flow; read-only variant                                                                                               | Standard Stack §"Bottom sheet (Vaul) for add", §"Lightbox (hand-rolled with focus-trap)" for entry view + edit                                                                                     |

</phase_requirements>

## Architectural Responsibility Map

Phase 5 is a **single-tier full-stack feature** but spans browser/server/storage tiers per capability. Mapping prevents misassignment in plans (e.g., putting EXIF strip on the server when CONTEXT requires client-side strip per LGPD minimization).

| Capability                                  | Primary Tier                  | Secondary Tier                         | Rationale                                                                                                                                                                                                                  |
| ------------------------------------------- | ----------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Image compression to ≤1MB + EXIF/GPS strip  | Browser (`browser-image-compression`) | API (defense-in-depth GPS reject)      | LGPD minimization mandates client-side strip; server only verifies GPS absence.                                                                                                                                            |
| Photo upload                                | API (`/api/v1/photos/upload` from Phase 2) | Storage (Supabase Storage)             | Server proxies multipart with service-role key; client never talks to Storage directly (Phase 2 D-23, D-27).                                                                                                               |
| Plant create (manual)                       | API (`/api/v1/plants`)        | DB (transaction with PhotoEntry rows) + Browser (form draft to sessionStorage) | Two-step flow per D-22; idempotency at API layer.                                                                                                                                                                          |
| Plant create-from-identification            | API (`/api/v1/plants/from-identification`) | DB (cross-context update of `Identification.plant_id`) | Catalog context owns the mutation per D-23A; identification context owns the query that surfaces unlinked Identifications.                                                                                                 |
| Plant Profile view                          | API (server-render initial)   | Browser (TQ hydration + inline edits)  | Use Next 16 RSC + `dehydrate`/`HydrationBoundary` for first paint; client takes over for inline edits.                                                                                                                     |
| Inline field edit                           | Browser (TQ optimistic mutation) | API (`PATCH /api/v1/plants/:id`)       | Optimistic per D-07 with `onMutate` snapshot + `onError` rollback.                                                                                                                                                         |
| Catalog grid (initial render)               | Browser (client-component with `useInfiniteQuery`) | API (`GET /api/v1/plants?cursor=&limit=`) | Cursor-paginated; server prefetches first page via RSC for fast first paint.                                                                                                                                               |
| Sort control                                | Browser (sessionStorage + TQ refetch) | API (server-side ORDER BY)             | Sort key forwarded to API; sessionStorage persists user preference per D-08.                                                                                                                                               |
| Photo journal — list                        | Browser (TQ query)            | API (`GET /api/v1/plants/:id/photos`)  | Reverse-chronological per CAT-06; cursor-paginated.                                                                                                                                                                        |
| Photo journal — add entry                   | Browser (Vaul bottom sheet) → API (two-step upload + create) | DB (PhotoEntry row + cover-photo update) | Add modal hosts the photo picker + note input; submit triggers two-step flow.                                                                                                                                              |
| Photo journal — lightbox                    | Browser (hand-rolled with focus-trap) | API (PATCH/DELETE/cover endpoints) | Fullscreen overlay; edit actions issue separate API calls (each idempotent).                                                                                                                                               |
| Plant delete                                | API (transaction + outbox row + event dispatch) | Inngest (`catalog/cleanup-storage`) + Storage (delete files) | Atomic transaction owns DB cascade + outbox row; Inngest function handles storage deletion async.                                                                                                                          |
| Offline JSON cache                          | Browser (TQ persister to IDB) | —                                      | TQ persister with `@tanstack/react-query-persist-client` + `idb-keyval`.                                                                                                                                                   |
| Offline image cache                         | Service Worker (Serwist runtime caching) | CDN/Storage (Supabase signed URLs)     | Stale-while-revalidate; max-age 30 days; max entries TBD by planner per D-21 scope.                                                                                                                                         |
| Read-only mode UI variants                  | Browser (`useSubscription()` hook) | —                                      | Stub returns `'trialing'` until Phase 10 swaps. All branches present in Phase 5.                                                                                                                                           |
| pt-BR date rendering                        | API (server-render with `date-fns-tz` + `User.timezone`) | Browser (re-render after hydration with same timezone) | Avoid hydration mismatch by computing user-local time on the server using `User.timezone` per Phase 1 INFRA-23.                                                                                                            |

## Standard Stack

### Core (locked by CONTEXT.md)

| Library                                       | Version           | Purpose                                                          | Why Standard / Citation                                                                                                                                                                              |
| --------------------------------------------- | ----------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@tanstack/react-query`                       | 5.100.5           | Server-state caching, mutations, infinite query, hydration       | [VERIFIED: npm registry] CONTEXT D-05 locks adoption in Phase 5. v5 is the current major; React 19 + Next 16 supported. [CITED: tanstack.com/query/v5/docs/react/guides/migrating-to-v5]              |
| `@tanstack/react-query-persist-client`        | 5.100.5           | `PersistQueryClientProvider` with built-in `useIsRestoring` race protection | [VERIFIED: npm registry] CONTEXT D-20 names `@tanstack/query-persist-client-core`; the React-friendly variant is the package above (provides the React provider component).                             |
| `@tanstack/query-async-storage-persister`     | 5.100.5           | Async-storage adapter for the persister                          | [VERIFIED: npm registry] Required when storage backend returns Promises (IDB does). [CITED: tanstack.com/query/latest/docs/framework/react/plugins/createAsyncStoragePersister]                       |
| `idb-keyval`                                  | 6.2.2             | Tiny key/value wrapper around IndexedDB                          | [VERIFIED: npm registry] CONTEXT D-20 names this verbatim. Implements the persister interface with three methods (`set`/`get`/`del`). [CITED: github.com/jakearchibald/idb-keyval]                    |
| `serwist` + `@serwist/next`                   | 9.5.7             | Service Worker runtime caching for cover/thumbnail images        | [VERIFIED: package.json] Already pinned by Phase 1. Phase 3 enables runtime caching; Phase 5 owns the catalog-image route registration.                                                              |
| `inngest`                                     | 4.2.4             | Durable async event consumer for `catalog/cleanup-storage`       | [VERIFIED: npm registry] Phase 4 onboards (first async consumer = verification email); Phase 5 is second consumer. Use `inngest.createFunction({ triggers: [{ event: "plant.deleted" }] }, ...)`.    |
| `drizzle-orm` + `drizzle-zod`                 | 0.45.2 + 0.8.3    | Domain schema + zod schema derivation for route validation       | [VERIFIED: npm registry] Phase 2 D-19 mandates `drizzle-zod`-derived domain schemas. `createInsertSchema` / `createSelectSchema` / `createUpdateSchema` are the three primitives. [CITED: drizzle-team/drizzle-orm-docs/zod.mdx] |
| `vaul`                                        | 1.1.2             | Bottom-sheet primitive (drag handle, snap points, focus trap)    | [VERIFIED: npm registry] Headless, accessible, mobile-friendly; satisfies §17 modal-sheet contract. Does not ship Inter or override fonts. [CITED: vaul.emilkowal.ski]                               |
| `focus-trap`                                  | 7.1.3             | Vanilla focus-trap primitive for hand-rolled lightbox            | [VERIFIED: npm registry] Maintained by `focus-trap` org (sibling to `tabbable`). Use `createFocusTrap(container, options)` API. [CITED: github.com/focus-trap/focus-trap]                             |
| `@axe-core/playwright`                        | 4.10.x (verify in Wave 0) | Automated a11y assertions in Playwright E2E                  | Required for §18 a11y verification across catalog flows. Standard for axe-based testing in Playwright.                                                                                               |
| `date-fns-tz`                                 | 3.2.0             | Server-render user-local times with `User.timezone`              | [VERIFIED: npm registry] Phase 1 INFRA-23 mandate; Phase 5 uses for acquisition date display + photo-journal timestamps.                                                                             |

### Already in Repo (verify only — Phase 1/2 ships)

| Library                       | Version    | Source                                                                                |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------- |
| `next`                        | 16.2.3     | [VERIFIED: package.json]                                                              |
| `react` / `react-dom`         | 19.2.5     | [VERIFIED: package.json]                                                              |
| `next-intl`                   | 4.9.1      | [VERIFIED: package.json] All catalog copy must go through this layer.                 |
| `@serwist/next`               | 9.5.7      | [VERIFIED: package.json]                                                              |
| `postgres`                    | 3.4.9      | [VERIFIED: package.json] Phase 2 uses with `{ prepare: false }` for Supavisor.        |
| `zod`                         | 4.3.6      | [VERIFIED: package.json]                                                              |
| `vitest`                      | 4.1.4      | [VERIFIED: package.json]                                                              |
| `@playwright/test`            | 1.59.1     | [VERIFIED: package.json]                                                              |
| `browser-image-compression`   | 2.0.2      | [VERIFIED: npm registry] Phase 2 D-28 ships; Phase 5 reuses on manual-add + journal.  |
| `exifr`                       | 7.1.3      | [VERIFIED: npm registry] Phase 2 D-30 ships server-side GPS detection.                |
| `sharp`                       | 0.34.5     | [VERIFIED: npm registry] Phase 2 D-31 ships thumbnail generation.                     |

### Supporting (planner discretion — only adopt if needed)

| Library                                       | Version           | When to Use                                                                                                                                                                                                          |
| --------------------------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tabbable`                                    | 6.4.0             | Lightweight (no React) tabbable-element finder. Pull in only if hand-rolling combobox needs to query tabbables; `focus-trap` already includes it transitively.                                                       |
| `@floating-ui/react`                          | 0.27.19           | Optional positioning primitive for combobox dropdown anchor. Phase 5 dropdown is a simple below-input listbox — likely not needed; CSS positioning with `position: absolute; top: 100%;` is enough.                  |
| `react-aria-components`                       | 1.17.0            | A full headless UI kit with combobox / popover / dialog primitives. **Skip:** kit is heavy, ships its own focus management that conflicts with our hand-rolled approach, and CONTEXT D-15 specifies "custom build". |

### Alternatives Considered

| Instead of                              | Could Use                                       | Tradeoff                                                                                                                                                                                                                                                                           |
| --------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Vaul bottom-sheet                       | Hand-roll over `focus-trap` + custom drag       | Vaul wins on time-to-ship and a11y maturity. Hand-roll only if Vaul conflicts with §17 motion specs (unlikely — Vaul uses spring physics that match §17's `stiffness: 120, damping: 18, mass: 1`). Recommend Vaul; planner should A/B against UI-SPEC requirements in Wave 0.       |
| Hand-roll lightbox                      | `yet-another-react-lightbox` 3.31.0             | YARL ships its own theme tokens and does not respect §17 atmosphere (Source Serif 4 + Plus Jakarta Sans, no Inter). Forking the theme adds maintenance cost. Hand-roll wins; use `focus-trap` for the focus-trap + `IntersectionObserver`/`PointerEvent` for swipe.                  |
| Hand-roll combobox per APG              | `react-aria-components` Combobox                | RAC is heavier and brings its own popover positioning + portal logic. CONTEXT D-15 explicitly chose hand-rolled. Hand-roll wins.                                                                                                                                                   |
| `idb-keyval` for TQ persister storage   | `@tanstack/query-async-storage-persister` + custom IDB wrapper | `idb-keyval` is 1.5KB minified, three-method API (`get`/`set`/`del`), exact match for the persister contract documented in TanStack Query docs. CONTEXT D-20 names it. No reason to swap.                                                                                          |
| `useInfiniteQuery` + IntersectionObserver | `react-intersection-observer` library         | Native `IntersectionObserver` is fine; the library only saves a few lines. CONTEXT does not lock either way; use native to keep deps lean.                                                                                                                                          |

**Installation:**

```bash
pnpm add @tanstack/react-query @tanstack/react-query-persist-client @tanstack/query-async-storage-persister idb-keyval vaul focus-trap date-fns-tz inngest
pnpm add -D @axe-core/playwright
```

**Version verification (2026-04-26):**

| Package                                | npm version | Notes                                                                                          |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `@tanstack/react-query`                | 5.100.5     | All `@tanstack/*` packages share this version line                                              |
| `@tanstack/react-query-persist-client` | 5.100.5     | Use this (not `query-persist-client-core`) — it ships `PersistQueryClientProvider`              |
| `@tanstack/query-async-storage-persister` | 5.100.5  | Required for IDB (returns Promises)                                                            |
| `idb-keyval`                           | 6.2.2       | Stable, small, exact match for persister contract                                              |
| `vaul`                                 | 1.1.2       | React 19 compatible                                                                            |
| `focus-trap`                           | 7.1.3       | Vanilla, no React dependency                                                                   |
| `date-fns-tz`                          | 3.2.0       | Already considered standard                                                                    |
| `inngest`                              | 4.2.4       | Phase 4 will pin                                                                               |
| `drizzle-orm`                          | 0.45.2      | Phase 2 will pin                                                                               |
| `drizzle-zod`                          | 0.8.3       | Phase 2 will pin                                                                               |

**Version-pinning policy:** Per Phase 1 D-04 / Plan 01-04 commits — pin EXACT versions in `package.json` (not `^x.y` ranges) for deterministic CI. Verify the version is current at planning time, not at research time, since this research may sit for days before planning runs.

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ Browser (Phase 5 surfaces)                                          │
│                                                                     │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────┐  ┌──────────┐  │
│  │ Catalog    │  │ Plant        │  │ Manual Add    │  │ /identify│  │
│  │ grid (RSC  │  │ Profile      │  │ (5-field form │  │ stub     │  │
│  │ prefetch + │  │ (single-     │  │ + sessStor    │  │ (D-25)   │  │
│  │ infinite)  │  │ scroll +     │  │ draft)        │  │          │  │
│  │            │  │ inline edit) │  │               │  │          │  │
│  └─────┬──────┘  └──────┬───────┘  └──────┬────────┘  └────┬─────┘  │
│        │                │                 │                │        │
│        └─────────┬──────┴─────────────────┴────────────────┘        │
│                  │                                                  │
│      ┌───────────▼────────────────────────────────────┐             │
│      │ TanStack Query 5 (PersistQueryClientProvider)  │             │
│      │  • useInfiniteQuery (cursor pagination)        │             │
│      │  • useMutation (optimistic for edits/sort,     │             │
│      │    pessimistic for create/delete)              │             │
│      │  • useSubscription() stub → 'trialing'         │             │
│      └────────┬───────────────────────┬───────────────┘             │
│               │                       │                             │
│      ┌────────▼─────────┐    ┌────────▼────────┐                    │
│      │ idb-keyval       │    │ Service Worker  │                    │
│      │ (JSON cache)     │    │ (Serwist        │                    │
│      │ Persister →      │    │ runtime cache   │                    │
│      │ IndexedDB        │    │ — images SWR)   │                    │
│      └──────────────────┘    └─────────────────┘                    │
└─────────────────────────────────────────────────────────────────────┘
                  │                       ▲
                  │                       │
                  ▼                       │
┌─────────────────────────────────────────────────────────────────────┐
│ Next.js Route Handlers (/api/v1/*)  — thin: validate → use-case     │
│                                                                     │
│  POST /api/v1/photos/upload  (Phase 2 — multipart, GPS reject,      │
│                               sharp thumbnail, signed-URL response) │
│         │                                                           │
│         ▼ returns { photo_url, thumbnail_url }                      │
│                                                                     │
│  POST   /api/v1/plants                  (Idempotency-Key)           │
│  POST   /api/v1/plants/from-identification (Idempotency-Key)        │
│  GET    /api/v1/plants?cursor=&limit=&sort=                         │
│  GET    /api/v1/plants/:id                                          │
│  PATCH  /api/v1/plants/:id              (Idempotency-Key, partial)  │
│  DELETE /api/v1/plants/:id              (atomic + outbox)           │
│  GET    /api/v1/plants/:id/photos       (cursor)                    │
│  POST   /api/v1/plants/:id/photos       (Idempotency-Key)           │
│  PATCH  /api/v1/plants/:id/photos/:peId (Idempotency-Key, note)     │
│  DELETE /api/v1/plants/:id/photos/:peId                             │
│  PATCH  /api/v1/plants/:id/cover-photo  (Idempotency-Key)           │
│                                                                     │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Application Layer (use cases)  — domain rules, no Drizzle           │
│                                                                     │
│  createPlantManual / createPlantFromIdentification / updatePlant    │
│  deletePlant (calls UoW.transaction → cascade + outbox + emit)      │
│  addPhotoEntry / updatePhotoEntryNote / deletePhotoEntry            │
│  setCoverPhoto / listPlants(cursor, sort, userId)                   │
│                                                                     │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Infrastructure: Repositories (functional modules per Phase 2 D-16) │
│                                                                     │
│  contexts/catalog/infrastructure/db/                                │
│    plants.ts  (findById, findByCursor, create, update, delete)      │
│    photo-entries.ts (findByPlant, create, updateNote, delete)       │
│    pending-storage-deletions.ts (insert, findOlderThan, complete)   │
│    location-suggestions.ts (distinctByUser)                         │
│  contexts/catalog/infrastructure/photo-storage.ts (Phase 2 D-25)    │
│                                                                     │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼
┌─────────────────────────────────────────────────────────────────────┐
│ DB (Supabase Postgres 17 via Supavisor txn pooler, RLS enforced)   │
│   plants / photo_entries / pending_storage_deletions               │
│                                                                     │
└──────┬──────────────────────────────────────────────────────────────┘
       │
       ▼ on plant.deleted event
┌─────────────────────────────────────────────────────────────────────┐
│ Inngest function: catalog/cleanup-storage                           │
│   1. step.run("load-job") → fetch pending row by id                 │
│   2. step.run("delete-batch") → StorageAdapter.deleteMany(paths)    │
│   3. step.run("mark-complete") → UPDATE pending_storage_deletions   │
│   onFailure → keep row pending; reconciler picks up later           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

```
src/
├── app/
│   ├── catalog/
│   │   ├── page.tsx                  # Catalog grid (RSC + HydrationBoundary + client island)
│   │   ├── new/
│   │   │   └── page.tsx              # Manual Add (full-screen route, D-13)
│   │   └── [plantId]/
│   │       ├── page.tsx              # Plant Profile (single-scroll, D-10)
│   │       └── photos/
│   │           └── page.tsx          # Photo Journal full-screen (UI-11)
│   ├── identify/
│   │   └── page.tsx                  # Phase 6 placeholder (D-25)
│   └── (home)/
│       └── page.tsx                  # Home empty + default (UI-04, UI-05 stub)
│
├── contexts/catalog/
│   ├── domain/
│   │   ├── plant.ts                  # Plant type + drizzle-zod schemas (D-19)
│   │   ├── photo-entry.ts
│   │   ├── pending-storage-deletion.ts
│   │   └── events.ts                 # 'plant.created', 'plant.deleted' event payloads
│   ├── application/
│   │   ├── create-plant-manual.ts    # use-case (orchestrates UoW + emit)
│   │   ├── create-plant-from-identification.ts
│   │   ├── update-plant.ts
│   │   ├── delete-plant.ts           # atomic + outbox + emit (D-04)
│   │   ├── add-photo-entry.ts
│   │   ├── update-photo-entry-note.ts
│   │   ├── delete-photo-entry.ts
│   │   ├── set-cover-photo.ts
│   │   ├── list-plants.ts            # cursor + sort + RLS-aware
│   │   └── list-photo-entries.ts
│   ├── infrastructure/
│   │   ├── db/
│   │   │   ├── schema.ts             # Phase 2 D-01 — extended in Phase 5 with pending table
│   │   │   ├── plants.ts             # functional repo
│   │   │   ├── photo-entries.ts
│   │   │   ├── pending-storage-deletions.ts
│   │   │   └── location-suggestions.ts
│   │   └── photo-storage.ts          # Phase 2 D-25
│   ├── api/                          # client-only API hook layer (Phase 1 D-08 no barrels)
│   │   ├── use-plants.ts             # useInfiniteQuery
│   │   ├── use-plant.ts              # useQuery for single plant
│   │   ├── use-create-plant.ts       # useMutation (pessimistic)
│   │   ├── use-update-plant.ts       # useMutation (optimistic)
│   │   ├── use-delete-plant.ts       # useMutation (pessimistic)
│   │   ├── use-photo-entries.ts
│   │   ├── use-add-photo-entry.ts
│   │   ├── use-update-photo-entry-note.ts
│   │   ├── use-delete-photo-entry.ts
│   │   ├── use-set-cover-photo.ts
│   │   └── use-location-suggestions.ts
│   └── inngest/
│       └── cleanup-storage.ts        # 'plant.deleted' consumer (D-04)
│
├── contexts/billing/
│   └── api/
│       └── use-subscription.ts       # D-24 stub returning 'trialing'
│
├── shared/
│   ├── react-query/
│   │   ├── query-client.ts           # singleton factory + persister setup
│   │   ├── persist-client-provider.tsx # PersistQueryClientProvider wrapper (client component)
│   │   └── idb-persister.ts          # idb-keyval-backed persister
│   ├── ui/                           # Phase 3 owns most of this
│   │   ├── bottom-sheet.tsx          # thin wrapper around Vaul (Phase 5 owns)
│   │   ├── combobox.tsx              # hand-rolled APG combobox (Phase 5 owns)
│   │   ├── lightbox.tsx              # hand-rolled (Phase 5 owns)
│   │   └── inline-edit-field.tsx     # click-to-edit + save-on-blur (Phase 5 owns)
│   └── i18n/
│       └── catalog.ts                # message keys (next-intl)
│
└── messages/
    └── pt-BR/
        └── catalog.json              # all Phase 5 copy (UI-SPEC.md verbatim)
```

### Pattern 1: TanStack Query + Next 16 App Router (RSC prefetch + HydrationBoundary)

**What:** Server-side prefetch the first page of the catalog list in the RSC, then dehydrate the QueryClient and pass it to a client component wrapped in `HydrationBoundary`. The client component uses `useInfiniteQuery` against the same query key — TQ recognizes the prefetched data and skips the initial fetch.

**When to use:** Always for the Catalog grid initial render (CAT-04, CAT-07, CAT-10) and the Plant Profile initial render (CAT-04). Saves a roundtrip on first paint and works with the persister.

**Example:**

```tsx
// src/app/catalog/page.tsx (RSC, no "use client")
// Source: tanstack/query/docs/framework/react/guides/advanced-ssr.md
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { listPlants } from "@contexts/catalog/application/list-plants";
import { CatalogGridClient } from "./catalog-grid-client";

export default async function CatalogPage() {
  const queryClient = new QueryClient();
  await queryClient.prefetchInfiniteQuery({
    queryKey: ["plants", { sort: "acquired_desc" }],
    queryFn: async ({ pageParam }) =>
      listPlants({ cursor: pageParam, limit: 50, sort: "acquired_desc" }),
    initialPageParam: null,
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <CatalogGridClient />
    </HydrationBoundary>
  );
}
```

```tsx
// src/contexts/catalog/api/use-plants.ts (client)
"use client";
import { useInfiniteQuery } from "@tanstack/react-query";

export function usePlants(sort: SortKey) {
  return useInfiniteQuery({
    queryKey: ["plants", { sort }],
    queryFn: async ({ pageParam }) => {
      const url = new URL("/api/v1/plants", window.location.origin);
      if (pageParam) url.searchParams.set("cursor", pageParam);
      url.searchParams.set("limit", "50");
      url.searchParams.set("sort", sort);
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`plants_fetch_failed_${res.status}`);
      return res.json() as Promise<{ data: PlantListItem[]; next_cursor: string | null }>;
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.next_cursor,
  });
}
```

### Pattern 2: PersistQueryClientProvider with IndexedDB

**What:** Wrap the app once at the layout level with `PersistQueryClientProvider`, configured with an `idb-keyval`-backed async persister. TQ's built-in `useIsRestoring` hook prevents the hydration race — `useQuery` waits for restore to complete before firing.

**When to use:** Once at the root layout (or a top-level client provider). Phase 5 owns adding it.

**Example:**

```tsx
// src/shared/react-query/idb-persister.ts
// Source: tanstack/query/docs/framework/react/plugins/persistQueryClient.md
import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

export function createIdbPersister(idbValidKey: IDBValidKey = "folhario:tq-cache"): Persister {
  return {
    persistClient: async (client: PersistedClient) => {
      await set(idbValidKey, client);
    },
    restoreClient: async () => {
      return (await get<PersistedClient>(idbValidKey)) ?? undefined;
    },
    removeClient: async () => {
      await del(idbValidKey);
    },
  };
}
```

```tsx
// src/shared/react-query/persist-client-provider.tsx
"use client";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { useState } from "react";
import { createIdbPersister } from "./idb-persister";

export function ReactQueryProvider({ children }: { children: React.ReactNode }) {
  // Lazy-init per-render so we don't share QueryClient across users in SSR
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // gcTime > maxAge so persister can keep entries while app is closed.
            // 24h matches the persister maxAge below.
            gcTime: 1000 * 60 * 60 * 24,
            staleTime: 1000 * 60 * 5, // 5min — reduce refetch on focus during a session
            refetchOnWindowFocus: true,
          },
        },
      }),
  );
  const [persister] = useState(() => createIdbPersister());

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: 1000 * 60 * 60 * 24, // 24h — purge stale persisted entries
        // Bust cache on schema changes; bump on Phase 5 ship.
        buster: "folhario-catalog-v1",
      }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
```

### Pattern 3: Optimistic mutation (sort change, inline field edit)

**What:** Use `onMutate` to snapshot prior cache + apply optimistic value; `onError` to roll back; `onSettled` to invalidate and refetch authoritative server state.

**When to use:** Inline edits (D-07 — name, nickname, room, acquisition_date, notes), sort selection (sessionStorage write).

**Example:**

```tsx
// src/contexts/catalog/api/use-update-plant.ts
// Source: tanstack/query/docs/framework/react/guides/optimistic-updates.md
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

type PatchInput = { id: string; patch: Partial<Plant> };

export function useUpdatePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: PatchInput) => {
      const res = await fetch(`/api/v1/plants/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error(`update_failed_${res.status}`);
      return res.json() as Promise<Plant>;
    },
    onMutate: async ({ id, patch }) => {
      await queryClient.cancelQueries({ queryKey: ["plants", "detail", id] });
      const previous = queryClient.getQueryData<Plant>(["plants", "detail", id]);
      if (previous) {
        queryClient.setQueryData<Plant>(["plants", "detail", id], { ...previous, ...patch });
      }
      return { previous };
    },
    onError: (_err, { id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["plants", "detail", id], context.previous);
      }
    },
    onSettled: (_data, _err, { id }) => {
      queryClient.invalidateQueries({ queryKey: ["plants", "detail", id] });
      // Also invalidate list so any list-visible field (name, location) re-renders.
      queryClient.invalidateQueries({ queryKey: ["plants"] });
    },
  });
}
```

### Pattern 4: Pessimistic mutation (create + delete)

**What:** Show a button-loading state during the request; do not optimistically write to cache. Useful for create/delete because failure rollback would be jarring (user sees plant flash in then disappear).

**When to use:** `POST /api/v1/plants`, `DELETE /api/v1/plants/:id`, `POST /api/v1/plants/:id/photos`, `DELETE /api/v1/plants/:id/photos/:peId`.

```tsx
"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeletePlant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/v1/plants/${id}`, {
        method: "DELETE",
        headers: { "Idempotency-Key": crypto.randomUUID() },
      });
      if (!res.ok) throw new Error(`delete_failed_${res.status}`);
    },
    onSuccess: (_data, id) => {
      // Remove the plant from all list pages in one pass.
      queryClient.setQueriesData<{ pages: { data: Plant[] }[] }>(
        { queryKey: ["plants"] },
        (old) => {
          if (!old) return old;
          return {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              data: p.data.filter((plant) => plant.id !== id),
            })),
          };
        },
      );
      queryClient.removeQueries({ queryKey: ["plants", "detail", id] });
      queryClient.removeQueries({ queryKey: ["plants", id, "photos"] });
    },
  });
}
```

### Pattern 5: Atomic plant DELETE + Inngest event consumer (transactional outbox)

**What:** A single DB transaction (a) collects PhotoEntry storage paths owned by THIS plant, (b) inserts a `pending_storage_deletions` row with those paths, (c) runs `DELETE FROM plants WHERE id = $1 AND user_id = $2` (FK cascade fires), (d) commits. Then dispatch the `plant.deleted` event to Inngest. If event dispatch fails after commit, a reconciler scans `pending_storage_deletions` rows older than threshold (e.g., 5 minutes since `created_at` and `status='pending'`) and re-emits.

**When to use:** Always for `DELETE /api/v1/plants/:id` (CAT-09).

**Example:**

```tsx
// src/contexts/catalog/application/delete-plant.ts
// Source: synthesized from CONTEXT D-04 + Inngest docs + transactional outbox pattern
import type { UnitOfWork } from "@shared/db/unit-of-work";
import { inngest } from "@shared/events/inngest-client";

export async function deletePlant({
  plantId,
  userId,
  uow,
}: {
  plantId: string;
  userId: string;
  uow: UnitOfWork;
}): Promise<void> {
  // 1-4: atomic in a single transaction
  const job = await uow.transaction(async (tx) => {
    const photoPaths = await photoEntries.listStoragePathsForPlant(tx, { plantId, userId });
    if (photoPaths.length === 0) {
      // Skip outbox row when there is nothing to clean up.
      const deleted = await plants.deleteByIdAndUser(tx, { plantId, userId });
      if (!deleted) throw notFoundError();
      return null;
    }
    const job = await pendingStorageDeletions.insert(tx, {
      userId,
      plantId,
      storagePaths: photoPaths,
      status: "pending",
    });
    const deleted = await plants.deleteByIdAndUser(tx, { plantId, userId });
    if (!deleted) throw notFoundError();
    return job;
  });

  // 5: dispatch event (outside transaction; reconciler covers failure)
  if (job) {
    await inngest.send({
      name: "plant.deleted",
      data: {
        user_id: userId,
        plant_id: plantId,
        storage_deletion_job_id: job.id,
        storage_paths: job.storagePaths,
      },
    });
  }
}
```

```tsx
// src/contexts/catalog/inngest/cleanup-storage.ts
// Source: synthesized from CONTEXT D-04 + Inngest createFunction docs
import { inngest } from "@shared/events/inngest-client";
import { storageAdapter } from "@shared/adapters/storage";

export const cleanupStorage = inngest.createFunction(
  {
    id: "catalog/cleanup-storage",
    triggers: [{ event: "plant.deleted" }],
    concurrency: { limit: 5, key: "event.data.user_id" }, // per-user concurrency
    retries: 5, // exponential backoff is the default
  },
  async ({ event, step }) => {
    const { storage_deletion_job_id, storage_paths, user_id, plant_id } = event.data;

    const job = await step.run("load-job", async () =>
      pendingStorageDeletions.findById(storage_deletion_job_id),
    );

    if (!job || job.status === "complete") {
      return { skipped: true, reason: "already_complete_or_missing" };
    }

    // Use job paths as authoritative — event paths can drift if outbox row was updated.
    const paths = job.storagePaths;

    // Delete in batches; StorageAdapter rejects unknown paths gracefully.
    await step.run("delete-storage", async () => {
      await storageAdapter.deleteMany(paths);
    });

    await step.run("mark-complete", async () =>
      pendingStorageDeletions.markComplete(storage_deletion_job_id),
    );

    return { user_id, plant_id, deleted_count: paths.length };
  },
);
```

### Pattern 6: WAI-ARIA APG combobox (hand-rolled, list autocomplete)

**What:** Editable combobox with list autocomplete per [W3C WAI-ARIA APG combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/). DOM focus stays on the input; visual focus moves through `aria-activedescendant`.

**When to use:** Location picker (CAT-05). One ship; reuse for any future picker per CONTEXT D-15.

**Required ARIA contract:**

| Element | Role | Attributes |
| ------- | ---- | ---------- |
| `<input>` | `role="combobox"` | `aria-autocomplete="list"`, `aria-controls="listbox-id"`, `aria-expanded="true|false"`, `aria-activedescendant="option-id"` (only when listbox open + option focused) |
| `<ul>` | `role="listbox"` | `aria-label="Locais"` (pt-BR) |
| `<li>` | `role="option"` | `aria-selected="true"` only on visually-focused option, `id="option-{i}"` |

**Keyboard map (per APG 1.2 list-autocomplete example):**

| Key | When closed | When open |
| --- | ----------- | --------- |
| ArrowDown | Open listbox, focus first option | Move to next option (wrap) |
| ArrowUp | Open listbox, focus last option | Move to previous option (wrap) |
| Enter | Submit value as-typed | Select focused option, close, return focus to input cursor at end |
| Escape | Clear input | Close listbox, return DOM focus to input |
| Home / End | Move cursor in input | Move cursor in input (closes listbox) |
| Tab | Default tab navigation | Close listbox, default tab navigation |
| Printable char | Filter list (re-open if needed) | Filter list (keep open) |

**Free-text commit semantics (D-15):** if user types text not in suggestions and presses Enter or blurs while non-empty, commit the typed value as-is (preserve display case; the next render of the picker will show it under "Usados antes" because `SELECT DISTINCT location` returns it).

### Pattern 7: Bottom-sheet via Vaul

**What:** Adopt Vaul as the bottom-sheet primitive. Vaul matches the §17 modal-sheet contract: drag handle, snap points, focus trap, swipe-down dismiss, configurable scrim.

**Why Vaul over hand-rolled:** Battle-tested a11y (focus trap built-in, ESC dismiss, scrim ARIA), spring physics under the hood, no font/theme override conflicts. CONTEXT D-16 left implementation choice to discretion. Vaul is a high-quality fit.

**Example skeleton:**

```tsx
// src/shared/ui/bottom-sheet.tsx
// Source: vaul docs (vaul.emilkowal.ski)
"use client";
import { Drawer } from "vaul";
import type { ReactNode } from "react";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  children,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 bg-[var(--scrim)]" />
        <Drawer.Content
          className="fixed bottom-0 inset-x-0 rounded-t-3xl bg-[var(--surface)] outline-none"
          // Honor §17 motion: spring stiffness 120 / damping 18 (Vaul defaults are close)
        >
          <Drawer.Handle className="mx-auto mt-4 h-1 w-9 rounded-full bg-[var(--hairline)]" />
          <Drawer.Title className="px-5 pt-3 text-2xl font-medium font-serif">
            {title}
          </Drawer.Title>
          <div className="px-5 pb-[calc(theme(spacing.6)+env(safe-area-inset-bottom))] pt-4">
            {children}
          </div>
          <Drawer.Close className="absolute top-4 right-4 text-sm font-semibold text-[var(--canopy)]">
            Fechar
          </Drawer.Close>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
```

**a11y verification checklist (Wave 0 ADR):**

- [ ] Vaul's `Drawer.Root` produces `role="dialog"` + `aria-modal="true"` (verify in DevTools).
- [ ] `Drawer.Title` is wired as `aria-labelledby`.
- [ ] Tab cycles focus inside; Shift+Tab reverses; ESC closes.
- [ ] No font override (Vaul ships no CSS fonts; uses `inherit`).
- [ ] Reduced-motion fallback honored.
- [ ] axe-core scan inside open sheet returns 0 violations.

If any check fails, fall back to hand-rolled with `focus-trap` + `dialog`-role wrapper.

### Pattern 8: Hand-rolled lightbox (focus trap + IntersectionObserver swipe)

**What:** Fullscreen overlay that hosts a horizontal-swipeable photo strip + bottom action strip. Use `focus-trap` for the focus trap; use `PointerEvent`s with `setPointerCapture` for swipe; use `keydown` listeners for arrow / ESC.

**When to use:** Photo Journal entry tap (D-17 + UI-11).

```tsx
// src/shared/ui/lightbox.tsx
// Source: focus-trap docs (github.com/focus-trap/focus-trap) + WAI-ARIA modal dialog pattern
"use client";
import { createFocusTrap, type FocusTrap } from "focus-trap";
import { useEffect, useRef, useState } from "react";

type Props = {
  entries: PhotoEntry[];
  startIndex: number;
  open: boolean;
  onClose: () => void;
  onEditNote: (entry: PhotoEntry) => void;
  onSetCover: (entry: PhotoEntry) => void;
  onDelete: (entry: PhotoEntry) => void;
};

export function Lightbox(props: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const trapRef = useRef<FocusTrap | null>(null);
  const [index, setIndex] = useState(props.startIndex);

  useEffect(() => {
    if (!props.open || !containerRef.current) return;
    trapRef.current = createFocusTrap(containerRef.current, {
      onDeactivate: props.onClose,
      escapeDeactivates: true,
      clickOutsideDeactivates: false, // Require explicit close per §17 (visible "Fechar")
      returnFocusOnDeactivate: true,
    });
    trapRef.current.activate();
    return () => trapRef.current?.deactivate();
  }, [props.open, props.onClose]);

  useEffect(() => {
    if (!props.open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") setIndex((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIndex((i) => Math.min(props.entries.length - 1, i + 1));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [props.open, props.entries.length]);

  if (!props.open) return null;
  const entry = props.entries[index];
  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Foto de ${entry.plantName}, ${entry.formattedDate}`}
      className="fixed inset-0 z-50 bg-[var(--scrim)]"
    >
      {/* photo strip + bottom action strip + visible "Fechar" button */}
    </div>
  );
}
```

### Pattern 9: Inline-edit field (click-to-edit, save-on-blur)

**What:** Read mode shows clean text + 16px Lucide pencil. Click → field becomes a §17-styled input pre-filled with current value + `autoFocus`. Blur → fire `useUpdatePlant().mutate({ id, patch: { [field]: value } })`. Escape → revert without saving.

**When to use:** Plant Profile name / nickname / room (location) / acquisition_date / notes (D-11, D-12, UI-08).

**a11y notes:**

- The pencil affordance must have `aria-label="Editar [field name]"` (D-11 + UI-SPEC.md image-alt section).
- Validation alert (e.g. acquisition_date in the future) MUST use `aria-live="polite"` and MUST NOT steal focus — see Pitfall §"Inline edit save-on-blur losing focus".
- Save success must be announced via `aria-live="polite"` ("Atualizado").

```tsx
// src/shared/ui/inline-edit-field.tsx
// Source: synthesized from CONTEXT D-11/D-12 + PRD §17 input spec + WAI-ARIA live regions
"use client";
import { useState, useId } from "react";
import { Pencil } from "lucide-react";

export function InlineEditField({
  label,
  value,
  onSave,
  validate,
}: {
  label: string;
  value: string;
  onSave: (next: string) => Promise<void>;
  validate?: (v: string) => string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const errorId = useId();

  if (!editing) {
    return (
      <button
        type="button"
        className="group flex items-center gap-2 text-left"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        aria-label={`Editar ${label}`}
      >
        <span>{value || "—"}</span>
        <Pencil size={16} className="text-[var(--calm-slate)] opacity-60 group-hover:opacity-100" />
      </button>
    );
  }

  return (
    <div>
      <label htmlFor={inputId} className="sr-only">{label}</label>
      <input
        id={inputId}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setDraft(value);
            setError(null);
            setEditing(false);
          }
          if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur();
        }}
        onBlur={async () => {
          const v = validate?.(draft) ?? null;
          if (v) {
            setError(v);
            return; // stay in edit mode; do not steal focus
          }
          if (draft !== value) await onSave(draft);
          setEditing(false);
        }}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="..." // §17-styled input
      />
      {error && (
        <p id={errorId} role="alert" aria-live="polite" className="mt-1 text-[var(--overdue)]">
          {error}
        </p>
      )}
    </div>
  );
}
```

### Pattern 10: drizzle-zod domain schemas

**What:** Phase 5 imports the catalog schema (Phase 2 D-01 owns it at `src/contexts/catalog/infrastructure/db/schema.ts`) and derives Zod schemas at the **domain** layer. Routes import the domain schema, not the Drizzle table.

**When to use:** All `/api/v1/plants*` and `/api/v1/plants/:id/photos*` routes.

```typescript
// src/contexts/catalog/domain/plant.ts
// Source: drizzle-team/drizzle-orm-docs/zod.mdx
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { plants } from "@contexts/catalog/infrastructure/db/schema";
import { z } from "zod";

export const PlantSchema = createSelectSchema(plants);
export type Plant = z.infer<typeof PlantSchema>;

export const PlantCreateInputSchema = createInsertSchema(plants, {
  name: (s) => s.min(1, { message: "name_required" }).max(80),
  location: (s) => s.max(40).nullable().optional(),
  notes: (s) => s.max(2000).nullable().optional(),
}).extend({
  initial_photos: z
    .array(
      z.object({
        photo_url: z.string().min(1),
        thumbnail_url: z.string().min(1),
      }),
    )
    .min(1, { message: "photo_required" }),
}).omit({
  cover_photo_url: true, // server-set from initial_photos[0]
  created_at: true,
});
export type PlantCreateInput = z.infer<typeof PlantCreateInputSchema>;

export const PlantPatchSchema = createUpdateSchema(plants, {
  acquisition_date: (s) => s.nullable().optional(),
}).pick({
  name: true,
  nickname: true,
  location: true,
  acquisition_date: true,
  notes: true,
});
export type PlantPatch = z.infer<typeof PlantPatchSchema>;
```

```typescript
// src/app/api/v1/plants/route.ts
import { NextRequest, NextResponse } from "next/server";
import { PlantCreateInputSchema } from "@contexts/catalog/domain/plant";
import { createPlantManual } from "@contexts/catalog/application/create-plant-manual";
import { httpMapError } from "@shared/config/errors";
import { requireUser } from "@shared/auth/require-user";
import { idempotent } from "@shared/api/idempotent";

export async function POST(req: NextRequest) {
  return idempotent(req, async () => {
    const user = await requireUser(req); // throws unauthenticated/token_expired
    const body = await req.json().catch(() => null);
    const parsed = PlantCreateInputSchema.safeParse(body);
    if (!parsed.success) {
      return httpMapError("validation_failed", { issues: parsed.error.issues });
    }
    const plant = await createPlantManual({ userId: user.id, input: parsed.data });
    return NextResponse.json(plant, { status: 201 });
  });
}
```

### Anti-Patterns to Avoid

- **Mounting `useQuery` before `PersistQueryClientProvider` finishes restore.** TQ ships the guard internally — but only when `useQuery` is called inside a tree wrapped by `PersistQueryClientProvider`. If the catalog grid is rendered outside the provider, the race re-emerges. Always wrap at the root.
- **Using TQ persister AND Serwist for the same response.** TQ owns JSON in IndexedDB; Serwist owns images in Cache Storage. Do NOT register a Serwist runtime cache rule for `/api/v1/plants` — it would shadow TQ's cache and produce stale-after-online-update bugs.
- **Optimistic update on `POST /api/v1/plants` (create).** Failure rollback would flash a card in then remove it. CONTEXT D-07 explicitly says pessimistic for create.
- **Skipping `Idempotency-Key` on PATCH endpoints.** Plant 5 D-23B says ALL mutating endpoints accept it. Network retries on flaky mobile connections will produce duplicates without it.
- **Computing `next_due_at` for reminders in Phase 5.** Phase 5 only stubs the active-reminders section. Phase 8 owns reminder math.
- **Adding `top`/`left`/`width`/`height` to motion.** PRD §17 banned: animate ONLY via `transform` + `opacity`.
- **Using a centered hero stack on Home empty state.** UI-SPEC.md "Empty Home" composition is asymmetric, NEVER centered hero stack.
- **Hardcoding `"sala"` etc. in the combobox.** Defaults must go through `next-intl` like every other string.
- **Storing `sort` in localStorage.** D-08 explicitly chose sessionStorage. localStorage is a v2 swap if users complain.
- **Using `h-screen`.** PRD §17 banned: use `min-h-[100dvh]`.
- **Emoji anywhere.** Plant icons = Lucide.

## Don't Hand-Roll

| Problem                              | Don't Build                                           | Use Instead                                          | Why                                                                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Server-state caching                 | Custom hook over `fetch` + `useState`                  | TanStack Query                                       | Cache invalidation, refetch-on-focus, race-condition-safe optimistic mutations, persister, cursor pagination — all in one battle-tested library.                                  |
| Cursor pagination on the client      | Manual `useEffect` + `cursor` state                    | `useInfiniteQuery`                                   | Built-in `getNextPageParam`, `hasNextPage`, page management, scroll-restore behavior on back-nav.                                                                                |
| Offline JSON cache                   | Custom IDB wrapper writing TQ cache shape              | `@tanstack/react-query-persist-client` + `idb-keyval` | Race-condition guard via internal `useIsRestoring`, throttled writes (1/s), built-in `buster` versioning, garbage collection.                                                  |
| Service Worker runtime caching       | Hand-write SW fetch handlers                          | Serwist `runtimeCaching` config (Phase 1 + 3 wire)   | Dehydration is brittle; Serwist provides battle-tested strategies (`StaleWhileRevalidate`, `CacheFirst`, `NetworkFirst`) with `ExpirationPlugin`.                                |
| Bottom-sheet (drawer)                | Custom drag + scrim + focus trap                      | Vaul                                                 | a11y baseline, spring physics, snap points, swipe-down dismiss — all production-tested.                                                                                          |
| Focus trap                           | Manual `tabindex` cycling on keydown                   | `focus-trap` (vanilla)                                | Edge cases (shadow DOM, animated trigger return-focus delay, fallback focus when no tabbables) handled.                                                                          |
| Combobox a11y                        | Native `<select>` or naive `<input>` + `<ul>`         | Hand-rolled per WAI-ARIA APG 1.2 (no library)        | Native `<select>` doesn't support free-text + dropdown filtering. CONTEXT D-15 is explicit: hand-rolled, but FOLLOW THE APG PATTERN — don't invent.                              |
| Image optimization for Catalog cards | Hand-roll resizing                                    | Next 16 `<Image>` + Supabase image-loader (or static cover/thumbnail URLs from Phase 2's `sharp` thumbnail generation) | Next/Image handles `srcset`, lazy-loading, blur-up. The thumbnails in `plant-thumbnails` bucket are already correctly-sized.                                                       |
| ID generation (idempotency keys)     | `Date.now()` + counter                                 | `crypto.randomUUID()`                                | Browser-native, collision-resistant, RFC 4122 v4.                                                                                                                                |
| Async event consumer / retries       | `setTimeout` + manual retry queue                      | Inngest `createFunction` with `concurrency`/`retries` | Durable, observable, exponential backoff, dead-letter via `onFailure`. Phase 4 onboards.                                                                                          |
| Transactional outbox                 | Direct `await` on event dispatch from API handler      | Atomic transaction inserts pending row + DB-level reconciler scans `pending` rows older than threshold | Post-commit dispatch can fail; the pending row is the source of truth. Without a reconciler, storage objects leak forever.                                                       |
| Image EXIF strip                     | Custom EXIF parser                                    | `browser-image-compression` (Phase 2 D-28/D-29 ships) | Phase 2 already wires `preserveExif: false`. Phase 5 reuses.                                                                                                                     |
| Server-side EXIF GPS detection       | Custom binary parsing                                 | `exifr` (Phase 2 D-30 ships)                         | Phase 2 already integrates as defense-in-depth.                                                                                                                                  |
| Thumbnail generation                 | Browser-side `<canvas>` thumbnail                     | `sharp` server-side (Phase 2 D-31 ships)             | Server-side thumbnails are deterministic, not subject to browser canvas quirks, and live in `plant-thumbnails` bucket.                                                            |
| Pagination cursor encoding           | Custom `id|date` string                                | `base64(JSON.stringify({ id, createdAt }))` per Phase 2 D-36 | Already specified; reuse the helper Phase 2 ships.                                                                                                                              |

**Key insight:** Phase 5 is a **glue phase**. The clever bits (image pipeline, RLS, idempotency, cursor encoding, EXIF, thumbnails, JWT verify) all come from Phase 2. Phase 5 should be ~2000 lines of orchestration + UI, not infrastructure.

## Common Pitfalls

### Pitfall 1: Storage path ownership spoofing on POST `/plants`

**What goes wrong:** Client uploads a photo via `POST /api/v1/photos/upload`, gets back `photo_url = "{user_a_id}/{plant_id}/{file_id}.jpg"`. Then calls `POST /api/v1/plants` with `initial_photos: [{ photo_url: "{user_b_id}/{plant_id}/{file_id}.jpg", ... }]` — referencing another user's photo. If the server only validates the URL is well-formed, it will create a Plant whose cover_photo_url silently references user B's photo.

**Why it happens:** Two-step flow trusts the client to pass back the URL it got from the upload. Most server-side validation focuses on shape, not ownership.

**How to avoid:**

- In the `createPlantManual` use case (Phase 5), parse every submitted `photo_url` and `thumbnail_url` and verify the prefix matches `{authenticated_user_id}/{submitted_plant_id}/`.
- Reject with `validation_failed` (closed-registry code; per Phase 1 D-10) if any path fails the check.
- Phase 2's `StorageAdapter` paths follow `{user_id}/{aggregate_id}/{file_id}.{ext}` per D-26, so the check is a single string-prefix comparison.

**Warning signs:** A code review that sees `photo_url` flow from request body to DB without a validator function call.

### Pitfall 2: TanStack Query persister hydration race

**What goes wrong:** App boot. TQ creates QueryClient. `useQuery` mounts and fires a network request immediately. Persister's async `restoreClient` resolves a moment later, overwriting the in-flight request's prior cache. User sees flicker (cache value → network value).

**Why it happens:** Persister restore is async; by default `useQuery` does not wait.

**How to avoid:** Use `PersistQueryClientProvider` (NOT `persistQueryClient` standalone). It exposes `useIsRestoring()` and TQ internally checks this hook before firing queries — `useQuery` waits for restore to complete. This is the single most important "use the official primitive" decision in the phase.

**Warning signs:** Any code that imports `persistQueryClient` instead of `PersistQueryClientProvider`.

### Pitfall 3: TQ persister + Serwist double-cache

**What goes wrong:** Developer registers a Serwist `NetworkFirst` rule for `/api/v1/plants*` JSON. Now both the SW and TQ have a copy. After an update, TQ's cache invalidates and refetches — but the SW returns its own stale copy, defeating the invalidation.

**Why it happens:** Default Serwist recipes (`pageCache`, `staticResourceCache`) match navigation requests + JS/CSS. A naive `runtimeCaching` rule can accidentally match `/api/*`.

**How to avoid:**

- Serwist runtime cache rules in Phase 5 must match **only** image MIME types or `request.destination === "image"` and the Supabase Storage signed-URL host(s). Explicitly exclude `/api/*`.
- TQ owns JSON; Serwist owns images. Document this in the Phase 5 plan and the Serwist config.
- Verify with a test: open Catalog, go offline, update plant via mock — confirm only image fetches hit the SW.

**Warning signs:** Any Serwist rule whose matcher includes `/api` or `application/json`.

### Pitfall 4: Post-commit event dispatch failure (orphan storage)

**What goes wrong:** Plant DELETE transaction commits. `await inngest.send(...)` throws (network blip, Inngest API down). API returns 5xx but the DB rows are gone. Storage objects are now orphaned forever.

**Why it happens:** Inngest's `step.sendEvent` is durable when called inside another Inngest function, but a Next.js route handler is a one-shot HTTP request — there's no retry loop unless you build one.

**How to avoid:**

- Insert the `pending_storage_deletions` row inside the transaction (D-04 step 2). The row is the source of truth.
- Add a reconciler — either a periodic Inngest cron `catalog/reconcile-deletions` (every 5 minutes) that selects pending rows older than 5 minutes with `status='pending'` and re-emits `plant.deleted`, OR add a try/catch around the Inngest send that returns 204 successfully but logs the failure (then the cron picks up).
- Test: simulate `inngest.send` failure; verify the row stays pending; verify the next reconciler run dispatches the event; verify the storage gets deleted.

**Warning signs:** A delete handler that returns 204 ONLY after `await inngest.send` resolves successfully without a fallback path.

### Pitfall 5: Cursor pagination instability on duplicate `acquisition_date`

**What goes wrong:** Two plants have `acquisition_date = NULL`. Cursor encodes `{ id, createdAt }`. Sorting by `acquisition_date desc, NULLS LAST` is stable, but a second sort key is needed for the cursor to advance deterministically.

**Why it happens:** `ORDER BY acquisition_date DESC NULLS LAST` returns rows in unspecified order when `acquisition_date` is the same.

**How to avoid:**

- Always include a tiebreaker: `ORDER BY acquisition_date DESC NULLS LAST, created_at DESC, id DESC`.
- Cursor decode passes BOTH values to the WHERE clause: `(acquisition_date, created_at, id) < (cursor.acquisition_date, cursor.createdAt, cursor.id)` (or for nulls-last, the SQL gets verbose — use a subquery or `ROW(...) < ROW(...)` syntax).
- Phase 2 D-36 specifies the cursor is `base64({ id, createdAt })`. Phase 5 may need to extend the cursor shape to include the sort key value (e.g., `{ id, createdAt, acquisitionDate, location, name }`) — surface this as an open question for the planner.

**Warning signs:** Test fails when N plants share the same `acquisition_date`.

### Pitfall 6: Inline edit save-on-blur losing focus to validation message

**What goes wrong:** User edits acquisition_date inline. Blurs to confirm. Validation says "future date not allowed". Validation message renders with `aria-live="polite"`. If the message is rendered as a focusable element (e.g. with `tabindex="0"`), focus jumps away from the input, blowing up the user's flow.

**Why it happens:** Naive a11y implementations make announce-regions focusable.

**How to avoid:**

- Validation alert region must be `aria-live="polite"` only — NEVER `tabindex="0"` and NEVER `role="alert"` followed by focus stealing.
- On validation failure, stay in edit mode; do NOT exit edit mode. Re-focus the input on next render.
- Test with VoiceOver / TalkBack: type invalid value → blur → message announced → input keeps focus → cursor remains in field.

**Warning signs:** Any `<div role="alert" tabindex="0">` in the inline-edit component.

### Pitfall 7: `useSubscription()` placement conflict with Phase 1 D-08 (no barrels)

**What goes wrong:** CONTEXT D-24 puts the hook at `src/contexts/billing/api/use-subscription.ts`. Phase 1 D-08 says no barrels — direct imports. Phase 2 D-16 says repositories live at `infrastructure/db/`. There is no precedent for a hook (client-only React) living at `api/`.

**Why it happens:** CONTEXT was written before Phase 2's per-context `api/` layer was clearly scoped. Phase 2 reserves `api/` for route handler implementations.

**How to avoid:**

- Surface as an Open Question: planner should decide whether `use-subscription.ts` lives at `src/contexts/billing/api/` (matches CONTEXT verbatim), `src/contexts/billing/application/`, or a new `src/contexts/billing/client/` (or `react-hooks/`) sub-folder.
- Recommendation: consult Phase 2's plans to see where data-fetching hooks for OTHER contexts will eventually live (catalog `use-plants.ts` will face the same question). Whatever convention emerges should be applied uniformly.

**Warning signs:** A Phase 5 plan that creates `use-plants.ts` in one location and `use-subscription.ts` in another.

### Pitfall 8: Idempotency response body bloating IDs table

**What goes wrong:** Phase 2 D-37 idempotency table caches `response_body`. Photo journal list responses can be 500KB+ (50 photos × ~10KB JSON). At scale, the idempotency table grows fast.

**Why it happens:** Idempotency table caches the full response so retries get identical bytes.

**How to avoid:**

- Idempotency-Key applies to **mutating** endpoints (POST/PATCH/DELETE). GET endpoints in Phase 5 must NOT accept Idempotency-Key (cursor pagination handles caching at the client layer).
- Cap response body size cached in `idempotency_keys` table (e.g. 32KB). Larger responses should not be replayable from the cache; re-execute the mutation (which is itself idempotent at the DB level via UNIQUE constraints if applicable).
- Phase 2 D-37/D-38 says 7-day TTL — that helps cap growth.
- Surface to planner: the policy on response-body size cap should be a Phase 2 concern; Phase 5 inherits.

**Warning signs:** A 1MB row in `idempotency_keys` for a single PhotoEntry list response.

### Pitfall 9: Hydration mismatch on server-rendered pt-BR dates

**What goes wrong:** Server renders "12 de abril de 2026" using `User.timezone = "America/Sao_Paulo"`. Browser hydration runs `new Date().toLocaleDateString()` which uses the device's local timezone. If the device is in a different timezone, React logs a hydration mismatch warning.

**Why it happens:** `toLocaleDateString` reads `Intl.DateTimeFormat().resolvedOptions().timeZone` which is the device timezone, not `User.timezone`.

**How to avoid:**

- All Phase 5 date renders use `date-fns-tz`'s `formatInTimeZone(date, User.timezone, "...")` — both server and client.
- Pass `User.timezone` from the server to the client via the initial RSC payload (e.g. as a context prop or query data).
- Tests: render a Plant Profile in CI with `process.env.TZ = "UTC"` while user's timezone is `America/Sao_Paulo`; assert the rendered date is `12 de abril de 2026`, not `April 12, 2026` or `Apr 11`.

**Warning signs:** Any `new Date(x).toLocaleDateString("pt-BR")` in a component.

### Pitfall 10: Combobox "outro" free-text option vs default suggestion conflict

**What goes wrong:** Defaults include "Outro". User types "Outro" — combobox shows it as both a default suggestion and the matched typed value. If the user picks the suggestion, the picker commits "Outro" — but UX-wise "Outro" was meant as a placeholder for free-text, not a real location.

**Why it happens:** "Outro" is one of the 8 defaults but semantically belongs in the picker UI as an opt-out.

**How to avoid:**

- Treat "Outro" as a suggestion that, when selected, focuses an input for the free text — not as a literal location value.
- OR: drop "Outro" from the defaults and rely on the combobox's free-text affordance (anything not in suggestions IS the free text path).
- Recommend the latter: the combobox's free-text contract IS the "outro" path. Defaults stay 7 items.
- Surface to planner — could change UI-SPEC.md's stated default list. (UI-SPEC.md lists 8 items; CAT-05 also lists 8 items; this is a UX decision the planner should escalate or accept verbatim.)

**Warning signs:** A user types a custom location and then sees "Outro" pre-selected because their input matched the literal string.

## Runtime State Inventory

**SKIPPED — greenfield phase, no rename/refactor/migration.** Phase 5 fills empty `.gitkeep`-stubbed context directories created in Phase 1 INFRA-02 + Phase 2 wave 1. No prior runtime state exists to inventory.

## Code Examples

(See "Architecture Patterns" section above for verified, working snippets — Patterns 1-10 cover the canonical operations Phase 5 needs.)

### Common operation: cursor-paginated infinite scroll with IntersectionObserver

```tsx
// Source: tanstack/query/docs/framework/react/guides/infinite-queries.md (cited in research)
"use client";
import { useCallback, useRef } from "react";
import { usePlants } from "@contexts/catalog/api/use-plants";

export function CatalogGridClient() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = usePlants("acquired_desc");
  const observerRef = useRef<IntersectionObserver | null>(null);

  const lastCardRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();
      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0]?.isIntersecting && hasNextPage) fetchNextPage();
        },
        { rootMargin: "200px" },
      );
      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage],
  );

  // ...render grid; attach lastCardRef to the final card in the last page
}
```

### Common operation: Serwist runtime cache for catalog images

```typescript
// src/sw.ts (or wherever Phase 3 sets up the SW entry)
// Source: serwist docs (context7.com/serwist/serwist) + CONTEXT D-20
import { Serwist, StaleWhileRevalidate, ExpirationPlugin, CacheableResponsePlugin } from "serwist";

declare const self: ServiceWorkerGlobalScope & { __SW_MANIFEST: any[] };

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  runtimeCaching: [
    {
      // Match Supabase Storage signed-URL host(s); replace REGEX with the real host pattern.
      matcher: ({ request, url }) =>
        request.destination === "image" &&
        url.hostname.endsWith(".supabase.co"),
      handler: new StaleWhileRevalidate({
        cacheName: "folhario-catalog-images",
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }),
          new ExpirationPlugin({
            maxEntries: 200, // Phase 5 D-21 scope is limited; 200 covers most users
            maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
            maxAgeFrom: "last-used",
          }),
        ],
      }),
    },
    // DO NOT add an /api/* rule. TQ persister owns JSON.
  ],
});
serwist.addEventListeners();
```

## State of the Art

| Old Approach                                       | Current Approach (2026-04)                                 | When Changed     | Impact                                                                                                                                                                |
| -------------------------------------------------- | ---------------------------------------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TanStack Query v4 `cacheTime`                      | TQ v5 `gcTime`                                             | TQ v5.0 (2023)   | API rename. Use `gcTime` not `cacheTime`. [CITED: tanstack.com/query/v5/docs/react/guides/migrating-to-v5]                                                           |
| `next/legacy/image`                                 | `next/image` (App Router)                                  | Next 13          | Use `next/image`. Set `images.remotePatterns` for Supabase Storage host.                                                                                              |
| WAI-ARIA APG 1.0 "combobox dialog popup"           | WAI-ARIA APG 1.2 "combobox listbox popup"                  | APG 1.2 (2021)   | Use 1.2 pattern. DOM focus stays on input; `aria-activedescendant` for visual focus. [CITED: w3.org/TR/2021/NOTE-wai-aria-practices-1.2-20211129]                    |
| Sentry next.js 7.x `sentry.client.config.ts`       | Sentry 10.x `instrumentation-client.ts`                    | Sentry SDK v9-10 | Already adopted in Phase 1 (Plan 01-05b). Phase 5 has no Sentry-specific work but inherits this convention.                                                          |
| `next-pwa`                                          | `@serwist/next` (Workbox fork)                             | Phase 1 D-13     | Already adopted.                                                                                                                                                     |
| Hand-roll bottom sheet                             | Vaul                                                       | 2024+ adoption   | Vaul is now the dominant React bottom-sheet primitive (Radix-style API, accessible by default).                                                                       |

**Deprecated/outdated (do NOT use):**

- TQ v5 `experimental_createQueryPersister` — works but is per-query, not per-client. CONTEXT D-20 wants whole-client persistence. Use `PersistQueryClientProvider` instead.
- `react-image-lightbox` — abandoned, ships its own theme system that overrides fonts.
- `react-modal` — predates `<dialog>` and is aria-modal-fragile compared to Vaul + focus-trap.

## Assumptions Log

| #  | Claim                                                                                                                                                | Section                                       | Risk if Wrong                                                                                                                                                                                       |
| -- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1 | Phase 4 will provision the Inngest infrastructure (client at `@shared/events/inngest-client`, `serve()` route handler, env vars).                    | Standard Stack §"Inngest"                     | If Phase 4 names the client export differently or routes Inngest under a different path, the Phase 5 plan must adapt. Verify Phase 4's CONTEXT.md before Phase 5 planning starts.                  |
| A2 | Phase 2 will provide a `UnitOfWork` abstraction (D-18) usable from Phase 5's application layer with a `transaction()` method.                        | Architecture §"Atomic plant DELETE pattern"   | If Phase 2 ships a different transaction primitive (e.g. raw `db.transaction(async (tx) => ...)` only), Phase 5 must wrap it. Either approach works; surface in plan.                              |
| A3 | Phase 2's `pending_storage_deletions` table (D-04 catalog-local) will be created by Phase 5 because Phase 4 does not provide a generic event outbox. | Architecture §"Outbox pattern"                | If Phase 4 ships a generic outbox/dispatcher, Phase 5 should reuse it. Surface as "verify before planning" item.                                                                                   |
| A4 | The Supabase Storage signed-URL host pattern is `*.supabase.co` for the Serwist runtime cache rule.                                                  | Code Examples §"Serwist runtime cache"        | Self-hosted Supabase or a CDN proxy would shift the host. Verify in Phase 1 / Phase 2 storage adapter configuration before committing the rule.                                                     |
| A5 | The catalog application layer can safely emit `plant.deleted` outside the transaction without losing events, because the outbox row IS the source of truth and the reconciler handles dispatch failure. | Architecture §"Atomic plant DELETE pattern"   | If the reconciler is omitted, events lost to dispatch failure leak storage forever. The plan MUST include the reconciler cron OR an in-process retry with backoff.                                  |
| A6 | The combobox in CAT-05 should drop "Outro" from the defaults and rely on free-text commit semantics for that intent.                                 | Pitfall §"Combobox 'outro' conflict"          | UI-SPEC.md and CAT-05 both list 8 defaults including "Outro". Dropping it changes the spec. Surface to user before implementation.                                                                  |
| A7 | The cursor format from Phase 2 D-36 (`base64({ id, createdAt })`) needs extension in Phase 5 to include sort-key values when sorting by acquisition_date / location / name. | Pitfall §"Cursor pagination instability"      | If the cursor doesn't include the sort key, pagination drifts when the sort key has duplicates. Either extend the cursor (Phase 5 expands D-36) or always tiebreak by (created_at, id) — verify with planner. |
| A8 | The `useSubscription()` hook lives at `src/contexts/billing/api/use-subscription.ts` per CONTEXT D-24 verbatim, even though `api/` is conventionally route handlers. | Pitfall §"useSubscription placement conflict" | If the team prefers `application/` or a new `client/` sub-folder, the file path changes. Surface to planner (or accept CONTEXT verbatim and document the deviation from convention).               |
| A9 | TanStack Query 5.100.5 + React 19.2.5 + Next 16.2.3 (Turbopack) work together without a known showstopper bug.                                       | Standard Stack §"Core"                         | While the search confirmed TQ v5 works with React 19 and Next 16, there could be subtle Turbopack issues with `dehydrate`/`HydrationBoundary` that surface in production. Smoke-test in Wave 0.    |
| A10 | Vaul will satisfy §17 modal-sheet requirements (focus trap, ESC dismiss, swipe-down, drag handle, no font override).                                | Standard Stack §"Vaul" + Pattern §"Bottom-sheet" | Verify in Wave 0 with axe-core + manual VoiceOver test. If Vaul fails any check, fall back to hand-rolled with `focus-trap`.                                                                       |

## Open Questions

1. **Cursor format extension for sort-key inclusion (CAT-07/CAT-08).**
   - What we know: Phase 2 D-36 specifies `base64({ id, createdAt })`. CAT-07 default sort is `acquisition_date desc nulls last`.
   - What's unclear: Should the cursor include the sort key value (e.g. `{ id, createdAt, sortValue: "2026-04-12" }`)? Or always tiebreak by `(created_at, id)` regardless of sort?
   - Recommendation: Extend cursor to include sort key when the sort is not `created_at`-based. Keep `id` + `created_at` as universal tiebreakers. Surface to planner for confirmation.

2. **Reconciler placement — Phase 5 cron vs Phase 4 generic outbox dispatcher.**
   - What we know: CONTEXT D-04 says Phase 5 owns its own pending storage-deletion table if Phase 4 does not provide a generic event outbox.
   - What's unclear: Phase 4's plans haven't been written yet. If Phase 4 ships a generic dispatcher, Phase 5 should reuse it (less code). If not, Phase 5 owns a small Inngest cron `catalog/reconcile-deletions`.
   - Recommendation: Write Phase 5 to expect Phase 4 NOT to ship a generic outbox (defensive default). If Phase 4 lands one first, Phase 5 plan can collapse the cron.

3. **`useSubscription()` location.**
   - What we know: CONTEXT D-24 says `src/contexts/billing/api/use-subscription.ts`.
   - What's unclear: `api/` in this repo is conventionally for route handler implementations (Phase 2 D-16). Hooks may belong elsewhere.
   - Recommendation: Planner picks one of: (a) accept CONTEXT verbatim; (b) move to `src/contexts/billing/application/use-subscription.ts`; (c) introduce a new `src/contexts/{ctx}/client/` segment for client-only hooks. Whatever choice is made, apply uniformly (the catalog's `use-plants.ts` etc. should follow the same convention).

4. **Combobox "Outro" default — keep as suggestion or drop in favor of free-text commit?**
   - What we know: CAT-05 + UI-SPEC.md both list 8 defaults including "Outro".
   - What's unclear: Whether selecting "Outro" should focus a free-text input or commit literal "Outro" as the location.
   - Recommendation: Surface to user. Default behavior in code: commit literal "Outro" if selected from the suggestion list (simpler).

5. **PostHog `plant_added` event payload shape (PRD §20 taxonomy).**
   - What we know: PRD §20 defines the event but not the payload shape. CONTEXT specifics call out emitting from the use-case layer (server-side via `posthog-node`).
   - What's unclear: Should the event include `species_id` (for create-from-identification) vs `null` (for manual)? Should it include source = `"manual" | "from_identification"`?
   - Recommendation: Include `{ source: "manual" | "from_identification", has_species: boolean }`. Phase 13 (analytics rollup) will benefit from the dimension. Surface to planner.

## Environment Availability

Phase 5 has no NEW external CLI dependencies — every tool used is already pinned by Phase 1/2/3/4. The "availability" question collapses to **upstream phase deliverables**, which is a **planning-time** check, not a runtime one.

| Dependency                                              | Required By                                             | Available Today                  | Source                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------ |
| Local Supabase (Postgres 17 + Storage)                  | Integration tests                                       | ✓                                | Phase 1 D-16 / Plan 01-04 ships `supabase start`                                     |
| Drizzle ORM + migrations                                | Catalog repos                                           | ✗ (Phase 2 wave 2)               | Phase 2 D-08, D-09 ships migration tooling                                           |
| Catalog schema (`plants`, `photo_entries`)              | Phase 5 repos                                            | ✗ (Phase 2 wave 2/3)             | Phase 2 D-01 mandates per-context schema ownership                                   |
| `StorageAdapter` + private buckets                      | Photo upload reuse                                       | ✗ (Phase 2 wave 4)               | Phase 2 D-24, D-25 ship buckets + adapter                                            |
| `POST /api/v1/photos/upload` route                      | Two-step Plant create + PhotoEntry add                  | ✗ (Phase 2 wave 4)               | Phase 2 D-27 ships server proxy upload                                               |
| AuthAdapter (JWT verify + `getUserById`)                | RLS-protected `/api/v1/plants*` routes                  | ✗ (Phase 2 wave 4)               | Phase 2 D-32, D-33 ship `jose` + JWKS                                                |
| Idempotency table + helper                              | All mutating endpoints                                  | ✗ (Phase 2 wave 4/5)             | Phase 2 D-37, D-38 ship table + 7-day TTL                                            |
| Cursor encode/decode helper                             | List endpoints                                           | ✗ (Phase 2 wave 4/5)             | Phase 2 D-36 ships format                                                            |
| Closed error registry (`validation_failed`, etc.)       | All routes                                               | ✓                                | Phase 1 D-10/D-11/D-12 (Plan 01-02) ships                                            |
| `next-intl` setup + pt-BR routing                       | All copy                                                 | ✓                                | Phase 1 D-15 (Plan 01-03) ships                                                      |
| Design tokens + bottom-nav + app shell                  | Catalog/Home/Profile route shells                        | ✗ (Phase 3)                      | Phase 3 owns                                                                         |
| Inngest infrastructure (`serve()` route + client)       | `catalog/cleanup-storage` consumer                       | ✗ (Phase 4)                      | Phase 4 onboards Inngest as first async consumer                                     |
| Sentry SDK + scrub                                      | Error reporting                                          | ✓                                | Phase 1 (Plans 01-05a/b) ships                                                       |
| PostHog server-side (`posthog-node`) for `plant_added`  | Analytics                                                | ✓                                | Phase 1 (Plan 01-06) ships                                                           |
| `User.timezone` column accessible to server-render      | pt-BR date display                                       | ✗ (Phase 2)                      | Phase 2 D-46 says full PRD §4 User schema in Phase 2; Phase 4 wires signup population |

**Missing dependencies with no fallback (BLOCK Phase 5 execution):**

- Phase 2 wave 2-5 (schema, repos, UoW, photo upload route, idempotency, cursors, JWT verify, RLS).
- Phase 3 (design tokens, bottom-nav, app shell).
- Phase 4 (Inngest infrastructure).

**Missing dependencies with fallback:**

- None — the listed gaps cannot be plausibly stubbed.

**Planner action:** Before Phase 5 wave 1 starts, verify in this worktree's actual code that all upstream phases have landed. STATE.md as of 2026-04-26 shows Phase 1 complete, Phase 2 planned but not executed. **Phase 5 is NOT executable today.** This research is appropriate to write now (planning artifact) but execution waits for the upstream phases.

## Validation Architecture

(workflow.nyquist_validation = true per .planning/config.json)

### Test Framework

| Property           | Value                                                                                                       |
| ------------------ | ----------------------------------------------------------------------------------------------------------- |
| Framework (unit)   | Vitest 4.1.4                                                                                                |
| Framework (integration) | Vitest 4.1.4 with `--project=integration` (real Postgres 17 service container per Phase 1 D-25)        |
| Framework (E2E)    | Playwright 1.59.1 (Chromium only per Phase 1 D-26)                                                          |
| Framework (a11y)   | `@axe-core/playwright` (Wave 0 install)                                                                     |
| Config files       | `vitest.config.ts` + `playwright.config.ts` (already exist)                                                 |
| Quick run command  | `pnpm test:unit` (runs unit project only)                                                                   |
| Full suite command | `pnpm test:unit && pnpm test:integration && pnpm test:e2e`                                                  |

### Phase Requirements → Test Map

| Req ID  | Behavior                                                                | Test Type            | Automated Command                                                                                            | File Exists?        |
| ------- | ----------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------- |
| CAT-01  | Create-from-identification with ownership check + Identification.plant_id update | unit                 | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/create-plant-from-identification.test.ts` | ❌ Wave 0           |
| CAT-01  | Cross-context Identification update inside transaction                  | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-from-identification.integration.test.ts` | ❌ Wave 0           |
| CAT-01  | Happy-path E2E (mock identification, confirm, plant appears in catalog) | e2e                  | `pnpm exec playwright test tests/e2e/catalog/create-from-identification.spec.ts`                              | ❌ Wave 0           |
| CAT-02  | Manual create with name + photo creates Plant + PhotoEntry              | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-manual.integration.test.ts` | ❌ Wave 0           |
| CAT-02  | Two-step photo upload + plant create happy-path                         | e2e                  | `pnpm exec playwright test tests/e2e/catalog/manual-add-plant.spec.ts`                                       | ❌ Wave 0           |
| CAT-02  | Server rejects spoofed photo_url (path prefix mismatch)                 | unit                 | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/storage-path-ownership.test.ts`           | ❌ Wave 0           |
| CAT-03  | Domain validation: missing name → validation_failed                     | unit                 | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/plant-create-input-schema.test.ts`        | ❌ Wave 0           |
| CAT-03  | E2E validation_failed UX (form-level summary + per-field highlight)     | e2e                  | `pnpm exec playwright test tests/e2e/catalog/manual-add-validation.spec.ts`                                  | ❌ Wave 0           |
| CAT-04  | Plant Profile renders all sections (cover, details, care-card slot, reminders stub, journal preview, ID-history conditional) | e2e                  | `pnpm exec playwright test tests/e2e/catalog/plant-profile-render.spec.ts`                                   | ❌ Wave 0           |
| CAT-04  | ID-history link hidden when count=0; visible when count>0               | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/id-history-visibility.integration.test.ts` | ❌ Wave 0       |
| CAT-05  | Combobox filter logic + dedupe case-insensitive                         | unit                 | `pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox-filter.test.ts`                          | ❌ Wave 0           |
| CAT-05  | Combobox keyboard-driven (ArrowDown/Up/Enter/Escape)                    | e2e                  | `pnpm exec playwright test tests/e2e/catalog/location-picker-keyboard.spec.ts`                                | ❌ Wave 0           |
| CAT-05  | Combobox axe-core a11y scan (open + closed states)                      | a11y                 | `pnpm exec playwright test tests/e2e/catalog/location-picker-a11y.spec.ts` (uses `@axe-core/playwright`)     | ❌ Wave 0           |
| CAT-06  | PhotoEntry add via two-step flow                                        | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/add-photo-entry.integration.test.ts` | ❌ Wave 0           |
| CAT-06  | Bottom sheet add UX (open/dismiss/submit)                               | e2e                  | `pnpm exec playwright test tests/e2e/catalog/photo-journal-add.spec.ts`                                      | ❌ Wave 0           |
| CAT-06  | Bottom sheet axe-core scan                                              | a11y                 | `pnpm exec playwright test tests/e2e/catalog/photo-journal-add-a11y.spec.ts`                                 | ❌ Wave 0           |
| CAT-07  | Cursor pagination ORDER BY acquisition_date DESC NULLS LAST + tiebreak  | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/list-plants-cursor.integration.test.ts` | ❌ Wave 0      |
| CAT-08  | sessionStorage sort persistence (write + reload reads back)             | unit                 | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/sort-storage.test.ts`                     | ❌ Wave 0           |
| CAT-08  | Sort persistence across reload within session (Playwright)              | e2e                  | `pnpm exec playwright test tests/e2e/catalog/sort-persistence.spec.ts`                                       | ❌ Wave 0           |
| CAT-09  | Atomic delete + outbox row + event dispatch in transaction              | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/delete-plant-atomic.integration.test.ts` | ❌ Wave 0      |
| CAT-09  | `catalog/cleanup-storage` Inngest function (mock storage)               | unit                 | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/inngest/cleanup-storage.test.ts`          | ❌ Wave 0           |
| CAT-09  | E2E delete user flow (modal → confirm → row gone → inngest event sent)  | e2e                  | `pnpm exec playwright test tests/e2e/catalog/delete-plant-flow.spec.ts`                                      | ❌ Wave 0           |
| CAT-09  | Reconciler picks up orphan pending row when event dispatch fails        | integration          | `pnpm exec vitest --run --project=integration tests/integration/catalog/reconcile-pending-deletions.integration.test.ts` | ❌ Wave 0  |
| CAT-10  | Catalog grid responsive at 375/600/900 viewports                        | e2e (visual+layout)  | `pnpm exec playwright test tests/e2e/catalog/grid-responsive.spec.ts`                                        | ❌ Wave 0           |
| CAT-10  | Catalog grid axe-core scan at each breakpoint                           | a11y                 | `pnpm exec playwright test tests/e2e/catalog/grid-a11y.spec.ts`                                              | ❌ Wave 0           |
| CAT-11  | Empty Catalog composition (Sage illustration + headline + Canopy CTA)   | e2e                  | `pnpm exec playwright test tests/e2e/catalog/empty-catalog.spec.ts`                                          | ❌ Wave 0           |
| OFF-08  | Offline browse: cached catalog renders with `setOffline(true)`          | e2e                  | `pnpm exec playwright test tests/e2e/catalog/offline-browse.spec.ts`                                         | ❌ Wave 0           |
| OFF-08  | TQ persister hydrates from IDB on app reload                            | e2e                  | `pnpm exec playwright test tests/e2e/catalog/persister-hydration.spec.ts` (asserts cached data via IDB inspection) | ❌ Wave 0       |
| OFF-08  | Offline banner present + correct copy                                   | e2e                  | `pnpm exec playwright test tests/e2e/catalog/offline-banner.spec.ts`                                         | ❌ Wave 0           |
| UI-04   | Empty Home composition (asymmetric, NOT centered hero)                  | e2e                  | `pnpm exec playwright test tests/e2e/home/empty-home.spec.ts`                                                | ❌ Wave 0           |
| UI-04   | Empty Home camera button → /identify placeholder route renders          | e2e                  | `pnpm exec playwright test tests/e2e/home/identify-placeholder.spec.ts`                                      | ❌ Wave 0           |
| UI-07   | Catalog card geometry (4:5 photo, 16px radius, name/nickname/location)  | e2e (visual)         | `pnpm exec playwright test tests/e2e/catalog/card-geometry.spec.ts`                                          | ❌ Wave 0           |
| UI-08   | Inline edit per-field save-on-blur                                      | e2e                  | `pnpm exec playwright test tests/e2e/catalog/inline-edit-per-field.spec.ts`                                  | ❌ Wave 0           |
| UI-08   | Inline edit live-region announces "Atualizado" success                  | e2e (a11y assertion) | `pnpm exec playwright test tests/e2e/catalog/inline-edit-announcements.spec.ts`                              | ❌ Wave 0           |
| UI-08   | Save-on-blur logic (debounce / no double-submit)                        | unit                 | `pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts`                       | ❌ Wave 0           |
| UI-11   | Lightbox keyboard handlers + focus trap                                 | unit                 | `pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts`                                | ❌ Wave 0           |
| UI-11   | Lightbox swipe between photos                                           | e2e                  | `pnpm exec playwright test tests/e2e/catalog/lightbox-swipe.spec.ts`                                         | ❌ Wave 0           |
| UI-11   | Lightbox axe-core a11y scan                                             | a11y                 | `pnpm exec playwright test tests/e2e/catalog/lightbox-a11y.spec.ts`                                          | ❌ Wave 0           |
| (D-24)  | `useSubscription()` stub returns 'trialing'                              | unit                 | `pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts`                 | ❌ Wave 0           |
| (D-24)  | Read-only-mode UI variants — when stub flipped, all branches behave     | e2e                  | `pnpm exec playwright test tests/e2e/catalog/read-only-mode.spec.ts` (env-flag the stub to non-trialing for one suite run) | ❌ Wave 0 |

**Nyquist coverage summary (every behavior sampled at ≥2 layers):**

- Manual add Plant: domain validation (unit) + route+repo cascade (integration) + Playwright happy-path + Playwright validation_failed ✓
- Create-from-identification: unit ownership check + integration cross-context Identification update + Playwright happy-path ✓
- Catalog grid responsive breakpoints: Playwright at 375/600/900 + axe-core a11y scan ✓
- Sort persistence: unit (sessionStorage helper) + Playwright session-survival ✓
- Plant Profile inline edit: unit (save-on-blur logic) + Playwright per-field edit + a11y live-region ✓
- Location picker combobox: unit (filter + dedupe) + Playwright keyboard-driven + axe-core ✓
- Photo Journal add + lightbox: unit (lightbox keyboard + focus trap) + Playwright add entry + Playwright lightbox swipe + axe-core ✓
- Plant delete cascade + Inngest: integration (transaction-scoped) + unit (Inngest function) + Playwright user-flow + integration (reconciler) ✓
- Offline browse: Playwright `setOffline(true)` + Playwright TQ persister hydration + Playwright offline banner i18n ✓
- Read-only mode stub: unit + Playwright (with stub flipped via env) ✓

### Sampling Rate

- **Per task commit:** `pnpm test:unit` (runs unit project only — < 30s).
- **Per wave merge:** `pnpm test:unit && pnpm test:integration` (full unit + real-Postgres integration).
- **Phase gate:** Full suite green before `/gsd-verify-work` — `pnpm test:unit && pnpm test:integration && pnpm test:e2e`.

### Wave 0 Gaps

- [ ] `tests/unit/contexts/catalog/` directory + helpers — none exist yet.
- [ ] `tests/integration/catalog/` directory + transaction-rollback fixture (per Phase 2 D-43) — depends on Phase 2 wave 5 landing.
- [ ] `tests/e2e/catalog/` directory + Playwright fixtures (auth bypass for E2E using a test user JWT) — depends on Phase 2 wave 4 (auth) + Phase 4 (verified user).
- [ ] `@axe-core/playwright` install + helper `expectNoA11yViolations(page)`.
- [ ] Vaul + focus-trap test harness — initialize Vaul `Drawer.Root` inside JSDOM may need `<dialog>` polyfill.
- [ ] IDB-keyval test harness — JSDOM does NOT ship IndexedDB; install `fake-indexeddb` dev dep for unit tests of the persister.
- [ ] Test fixtures: a Plant + PhotoEntry seed helper, a stub Inngest send (capture event payload to assert), a fake `User.timezone` user.

## Security Domain

`security_enforcement` is enabled (no explicit `false` in config.json — implicit ON).

### Applicable ASVS Categories

| ASVS Category         | Applies | Standard Control                                                                                                                                                                |
| --------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V2 Authentication     | Yes     | Phase 4 ships JWT verification middleware (Phase 2 D-32, D-33). Phase 5 routes inherit; do not re-implement.                                                                    |
| V3 Session Management | Yes     | Per-device JWT per Phase 1 stack lock-in. Phase 5 attaches no new session state.                                                                                                |
| V4 Access Control     | Yes     | RLS on `plants`, `photo_entries`, `pending_storage_deletions` (Phase 2 D-22 ownership policy). Server-side ownership re-check on photo path (Pitfall 1). `Identification.plant_id` update only when Identification.user_id matches. |
| V5 Input Validation   | Yes     | drizzle-zod `PlantCreateInputSchema` / `PlantPatchSchema` / `PhotoEntryCreateSchema`. Server rejects malformed JSON, oversize bodies, unknown fields.                          |
| V6 Cryptography       | No      | Phase 5 introduces no crypto; Idempotency-Key is `crypto.randomUUID()` only. No password / token handling.                                                                      |
| V7 Error Handling     | Yes     | Closed error registry (Phase 1 D-10/D-12) — Phase 5 surfaces only `validation_failed`, `not_found`, `unauthenticated`, `token_expired`, `forbidden`, `read_only_mode`.          |
| V8 Data Protection    | Yes     | EXIF/GPS strip client-side (Phase 2 D-29) + server reject (Phase 2 D-30). Sentry `Sentry.setUser({ id })` only — never email (Phase 1 LGPD-13). PostHog server-side capture similarly redacted. |
| V11 Business Logic    | Yes     | Per-user catalog isolation enforced at multiple layers (RLS + repo `userId` filter + ownership re-check on photo path).                                                         |
| V12 File and Resources | Yes    | Storage paths follow `{user_id}/{plant_id}/{file_id}` (Phase 2 D-26). Photo path ownership validation (Pitfall 1) is the load-bearing defense.                                 |
| V13 API Security      | Yes     | Idempotency-Key on all mutating endpoints (D-23B). Cursor opacity (clients never parse, server validates and returns `validation_failed` on tamper).                            |
| V14 Configuration     | Yes     | Service-role key server-side only (Phase 2 D-23). RLS policies cover all user-owned tables (Phase 2 D-21).                                                                      |

### Known Threat Patterns for Phase 5 stack

| Pattern                                                            | STRIDE                | Standard Mitigation                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------ | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Photo URL spoofing on POST /plants** (Pitfall 1)                 | Tampering             | Server validates submitted `photo_url`/`thumbnail_url` paths begin with `{authenticated_user_id}/{submitted_plant_id}/`. Reject `validation_failed` otherwise. Pattern: parse the path string in the application use-case, not in the route handler.                                  |
| **IDOR on Plant/PhotoEntry endpoints**                             | Information Disclosure | RLS + repository functions take explicit `userId` parameter (Phase 2 D-22). Each route extracts user from JWT and passes to the repo; the repo's WHERE clause includes `user_id = $userId`. Cursor pagination filters by user automatically.                                          |
| **Cross-context Identification.plant_id link** (CAT-01)            | Tampering             | Use-case verifies `Identification.user_id === authenticated_user_id` AND `Identification.plant_id IS NULL` before linking. Reject `forbidden` or `conflict` otherwise.                                                                                                                |
| **Idempotency replay disclosure**                                  | Information Disclosure | Idempotency table is per-user (Phase 2 D-37 `user_id` column). Cross-user replay returns `not_found` or fresh execution.                                                                                                                                                              |
| **Mass-assignment on PATCH /plants/:id**                           | Tampering             | `PlantPatchSchema` is `pick({ name, nickname, location, acquisition_date, notes })` — server-controlled fields (`id`, `user_id`, `species_id`, `cover_photo_url`, `created_at`) cannot be patched via this endpoint.                                                                  |
| **EXIF GPS leak**                                                  | Information Disclosure | Client-side strip via `browser-image-compression` (`preserveExif: false`). Server-side reject with `exifr` (Phase 2 D-30) as defense-in-depth.                                                                                                                                          |
| **Storage object leak after delete**                               | Repudiation           | Outbox pattern + reconciler. The pending row in `pending_storage_deletions` is the source of truth; if Inngest event dispatch fails, reconciler picks up.                                                                                                                              |
| **CSRF on `/api/v1/plants*` mutating endpoints**                   | Spoofing              | JWT bearer in `Authorization` header (per-device, no cookies). CSRF irrelevant for header-based auth (no automatic browser attachment). Phase 1 INFRA-18 ships standard security headers.                                                                                              |
| **XSS in user-supplied plant name / nickname / notes**             | Tampering             | React's default JSX escaping covers ~99%. Notes field with line breaks should NOT use `dangerouslySetInnerHTML`. Schema caps name at 80, notes at 2000 chars (drizzle-zod refinement). HTML in notes renders as text.                                                                  |
| **Sentry breadcrumb leak (image URLs, etc.)**                      | Information Disclosure | Phase 1 LGPD-13 scrubs `photo_url`. Phase 5 routes that touch identification responses explicitly drop request bodies via Phase 1 D-22 `beforeSend` hook; Phase 5's `/api/v1/plants*` are not on the explicit drop list — surface to planner whether to extend the drop list.        |
| **Inline-edit timing attack** (PATCH name with sensitive validation) | N/A                   | None — Phase 5 fields (name, nickname, location, etc.) carry no security secrets. Validation is shape-based.                                                                                                                                                                          |

## Sources

### Primary (HIGH confidence)

- Context7 `/tanstack/query` - App Router prefetch + HydrationBoundary, useInfiniteQuery, persistQueryClient, optimistic updates
- Context7 `/inngest/inngest-js` - createFunction with concurrency/retries, step.run + step.sendEvent durability
- Context7 `/serwist/serwist` - runtimeCaching strategies, ExpirationPlugin, recipes
- Context7 `/emilkowalski/vaul` - Drawer.Root/Content/Handle/Title API + drag handle + snap points
- Context7 `/focus-trap/focus-trap` - createFocusTrap options API
- Context7 `/drizzle-team/drizzle-orm-docs` - createInsertSchema/createSelectSchema/createUpdateSchema
- Context7 `/vercel/next.js` - Image component remote patterns + Supabase loader pattern
- W3C WAI-ARIA APG `https://www.w3.org/WAI/ARIA/apg/patterns/combobox/` and `https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-autocomplete-list/` - Combobox 1.2 spec
- npm registry verifications (npm view ... version) for all package versions cited
- Phase 1 / Phase 2 CONTEXT.md - upstream contract anchors (D-XX references throughout)
- Phase 5 CONTEXT.md - locked decisions (27/27 answered)
- Phase 5 UI-SPEC.md - approved visual / interaction contract

### Secondary (MEDIUM confidence)

- TanStack Query App Router discussion thread (`tanstack/query#6267`) - server/client component split with HydrationBoundary
- TanStack Query persister discussion (`tanstack/query#3198`, `#1638`) - IDB persister race protection via `useIsRestoring`
- MDN `navigator.storage.estimate()` - quota awareness
- W3C/MDN `dialog` role + `aria-modal="true"` - modal a11y semantics
- npiontko.pro / event-driven.io - transactional outbox patterns
- chrome developer blog - Estimating Available Storage Space

### Tertiary (LOW confidence)

- Vaul medium articles - confirms a11y posture but not authoritative; rely on primary Vaul docs + actual axe scan in Wave 0.
- Various blog posts on TQ + Next.js 16 - confirm compatibility but specific Turbopack issues should be empirically verified.

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - All versions verified against npm registry on 2026-04-26; TQ + persister + idb-keyval combo is the canonical pattern documented by TanStack.
- Architecture (TQ + RSC + persister + Serwist coordination): HIGH for individual layers, MEDIUM for the integration as a whole — no canonical reference combines all four. Wave 0 smoke must validate.
- Combobox / Lightbox / Inline-edit patterns: HIGH (WAI-ARIA APG primary source + focus-trap docs).
- Bottom sheet via Vaul: MEDIUM-HIGH — Vaul is a credible primitive but the §17 modal-sheet contract has many specific requirements that need a Wave 0 validation pass.
- Atomic transaction + outbox + Inngest: HIGH (well-known pattern, Inngest docs confirm step.sendEvent + createFunction semantics).
- Pitfalls: HIGH for the stack-coupling pitfalls (TQ persister race, Serwist double-cache, photo-URL spoofing); MEDIUM for the Phase-2-coupling pitfalls (cursor format extension, useSubscription placement) — surface as Open Questions.
- Validation Architecture: HIGH (mirrors the explicit checklist provided in the research task; concrete file paths + commands).
- Security Domain: HIGH (ASVS categorization is standard; threat patterns are established for the stack).

**Research date:** 2026-04-26
**Valid until:** 2026-05-26 (30 days — TQ + Vaul + Inngest are stable libraries; React/Next move faster but the Phase 5 patterns aren't on the bleeding edge).

## RESEARCH COMPLETE
