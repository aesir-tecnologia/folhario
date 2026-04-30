# Phase 5: Catalog — Meu Jardim - Research

**Researched:** 2026-04-29
**Domain:** Full-stack catalog: Drizzle schema + Postgres RLS, TanStack Query v5 + IDB persister, Serwist SWR runtime cache, Inngest cleanup cron, WAI-ARIA APG 1.2 Combobox, accessibility primitives
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01**: Single-screen manual add page; no wizard. Name + photo picker first, optional fields below. Photo bytes NOT uploaded until submit.
- **D-02**: Single multipart POST `/api/v1/plants` atomically creates Plant + first PhotoEntry in one DB transaction. Compensating-delete pattern (`src/contexts/catalog/application/upload-photo.ts:217`) on TX rollback. No draft-photo route.
- **D-03**: Cover photo auto-tracks oldest non-deleted PhotoEntry — no user override. DELETE cover → auto-promote next-oldest in same TX. No `PATCH /plants/:id/cover` endpoint in Phase 5.
- **D-04**: Inline per-field error + summary block when ≥2 errors (NOT 3+). Overdue Rust/Copper only. Submit auto-focuses first invalid field. `role="alert"` on first invalid.
- **D-05**: Tap-to-edit inline fields. Save on blur or Enter (single-line). Cancel on Esc. Optimistic UI; PATCH failure rolls back + sonner toast. No explicit Save button.
- **D-06**: LWW optimistic update, no conflict detection. PATCH always wins. Server row merged into TQ cache on response. No 409 UI.
- **D-07**: Bottom-sheet delete confirm with cascade counts (`photo_entry_count`, `reminder_count`) from fresh GET shape. Cancelar primary, Excluir destructive (Urgent Poppy). PRD §17: destructive always layout-secondary.
- **D-08**: Roll our own headless `Combobox` primitive (~200 LOC) at `src/shared/ui/combobox.tsx`. WAI-ARIA APG 1.2. `useId`, `aria-controls`, `aria-expanded`, `aria-activedescendant`, Arrow/Home/End/Esc/Enter/printable typeahead.
- **D-09**: Separate `location_suggestions` table `(user_id, label_normalized, label_display, usage_count, last_used_at)`. PK `(user_id, label_normalized)`. Upsert on create + edit. DELETE plant does NOT decrement. Query: top-20 by `usage_count DESC, last_used_at DESC`. RLS owner-only.
- **D-10**: Default location labels in `messages/pt-BR.json` under `catalog.locations.defaults`. De-duped merge with user suggestions at query time.
- **D-11**: Sort persisted via `sessionStorage` key `folhario.catalog.sort`. Values: `name_asc | name_desc | date_new | date_old | location`. Default `date_new`. Clears on tab close.
- **D-12**: Opaque base64 cursor `{sort_id, last_value, last_id}`. NULLS LAST sentinel for nullable `acquisition_date`. Page size 50, max 200. First page includes `total_count` gated on `?include_count=1`.
- **D-13**: Server Component catalog page fetches first-page count at SSR. Zero rows → `<CatalogEmpty />`. Non-zero → `<CatalogGrid />` with SSR'd data via `dehydrate(queryClient)` / `<HydrationBoundary>`.
- **D-14**: Roll our own Lightbox primitive (~150 LOC) at `src/shared/ui/lightbox.tsx`. Full-screen overlay over Radix Dialog. Horizontal swipe. Visible Fechar button. Reduced-motion fallback.
- **D-15**: Photo-journal add via ModalSheet. Single multipart POST `/api/v1/plants/:id/photo-entries`. Upload progress via sonner. Sheet stays open on failure with retry.
- **D-16**: `@tanstack/query-async-storage-persister` + `idb-keyval` for IDB persister. Wired in `<QueryProvider>` inside `(app)/layout.tsx`.
- **D-17**: Persisted query allowlist: `['catalog','plants']`, `['catalog','plant']`, `['catalog','photo-entries']`, `['catalog','locations']`. `maxAge: 24h`. Quota guard: `navigator.storage.estimate()` > 0.8 → evict oldest.
- **D-18**: Query factory pattern (Tkdodo-style) at `src/contexts/catalog/queries/index.ts`. Factories: `plantsKeys.lists({sort})`, `plantsKeys.detail(id)`, `plantsKeys.photoEntries(plantId)`, `locationsKeys.all()`.
- **D-19**: Serwist runtime cache: `StaleWhileRevalidate` for whitelisted catalog GETs (`/api/v1/plants*`, `/api/v1/photo-entries*`, `/api/v1/locations`). 7d maxAge. NetworkOnly default preserved for everything else.
- **D-20**: 24h-TTL signed URLs for catalog/journal photos. SW byte-cache by signed URL. Online refreshes mint fresh URLs on each refetch.
- **D-21**: `useSubscription()` stub at `src/contexts/billing/application/use-subscription.ts` returning `{active: true, readOnly: false}`. Phase 10 wires real Stripe. When `readOnly: true`: Add hidden, inline-edit disabled, delete overflow hidden, `+ Foto` hidden, `<ReadOnlyBanner>` flips on.
- **D-22**: Same-TX `pending_storage_deletions` INSERT + `plant.deleted` Inngest event. `catalog/cleanup-storage` consumes event → `storageAdapter.deletePrefix(...)` → updates row status.
- **D-23**: `pending_storage_deletions` schema: `id UUID PK`, `user_id UUID NOT NULL`, `bucket TEXT NOT NULL`, `prefix TEXT NOT NULL`, `status pending_deletion_status NOT NULL DEFAULT 'pending'` (ENUM `pending|in_progress|completed|failed`), `attempts INT NOT NULL DEFAULT 0`, `last_error TEXT`, `scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`, `completed_at TIMESTAMPTZ`. Index on `(status, scheduled_at)`. RLS owner-only. NO `plant_id` FK.
- **D-24**: Hourly Inngest cron `catalog/cleanup-storage-reconciler`. Batch 50, max 5 attempts. Backoff: 5min→30min→4h→24h→72h. `FOR UPDATE SKIP LOCKED`. After 5 attempts → `status = 'failed'`.
- **D-25**: `fake-indexeddb` in unit setup only. `tests/unit/setup-idb.ts` imports `fake-indexeddb/auto`. Per-test isolation via `indexedDB = new IDBFactory()` or unique DB name. Playwright uses real Chromium IDB.
- **D-26**: `authedUser` Playwright fixture at `tests/e2e/fixtures/authed-user.ts`. Calls `supabase.auth.admin.createUser` server-side, inserts verified `public.users` + ConsentLog × 2 + `Subscription` (trialing, 14d), injects session cookies. ~50ms per spec.
- **D-27**: In-memory `StorageAdapter` for integration tests via `__setStorageAdapterForTests`. `tests/integration/setup.ts` swaps in `InMemoryStorageAdapter (Map<bucket, Map<key, Buffer>>)`. Phase 2 D-43 transaction-rollback handles DB cleanup.
- **D-28**: `plant_added` event: `{ source: 'manual', has_nickname: bool, has_location: bool, has_acquisition_date: bool, has_notes: bool, photo_count: int }`. Server-side via `posthog-node` AFTER TX commit.
- **D-29**: `plant_edited` event: `{ field: 'name'|'nickname'|'location'|'acquisition_date'|'notes' }`. `plant_deleted` event: `{ photo_count: int, journal_entry_count: int, reminder_count: int }`. Both server-side.

### Claude's Discretion

- Exact Tailwind class compositions for inline-edit visual states
- Sonner toast copy strings (pt-BR drafts; founder reviews)
- Combobox keyboard typeahead debounce (50–250ms range)
- Lightbox swipe-velocity + dismiss thresholds
- Storage budget eviction policy specifics (LRU vs query-key-prefix within 80% ceiling)
- IndexedDB DB name + object-store name for idb-keyval
- Exact order/grouping of fields on manual-add screen (name + photo first, optional below)
- TanStack Query default `staleTime` per query (catalog list 30s, plant detail 60s, locations 5min suggested)
- Sharp resize options for cover-photo thumbnail (current upload-photo.ts locks 512px / quality 80)
- Optional `Idempotency-Key` enforcement on POST endpoints
- File splits inside context subfolders provided D-09 ownership and D-22 cleanup are preserved

### Deferred Ideas (OUT OF SCOPE)

- Plant create from identification (Phase 6)
- LGPD consent modal at first identification (Phase 6)
- Care-card rendering on plant profile (Phase 7)
- Active reminders surface on plant profile (Phase 8, placeholder only)
- ID history surface on plant profile (Phase 6, placeholder only)
- Toxicity badge composition (Phase 7)
- Subscription state machine real wiring (Phase 10)
- Offline mutation queue (Phase 9; Phase 5 = read-side offline only)
- Push permission prompt (Phase 8)
- LGPD bulk deletion / 7-day grace (Phase 11)
- Custom cover photo override (post-MVP)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Plant created from identification with `species_id`, name pre-filled, cover from ID upload | Phase 6 scope — Phase 5 create-plant use-case receives `source: 'manual'`; Phase 6 calls same use-case with `source: 'identification'` |
| CAT-02 | Manual plant creation: name + ≥1 photo → Plant `species_id=null` + PhotoEntry | D-02 multipart POST; compensating-delete pattern at upload-photo.ts:217; D-03 cover auto-track |
| CAT-03 | Missing name OR photo → `validation_failed`, no row, field highlighted | D-04 validation; Zod schema refinements; drizzle-zod approach; closed error registry |
| CAT-04 | Plant profile: name, nickname, room, acquisition_date, notes, cover, care-card link, reminders, journal, ID history | D-05 inline-edit; D-07 delete confirm; UI-SPEC §6; placeholder sections for Phase 6/7/8 surfaces |
| CAT-05 | Location picker: prior locations quick-select + defaults + free text becomes reusable | D-08 Combobox APG 1.2; D-09 location_suggestions table; D-10 i18n defaults |
| CAT-06 | Add photo to journal with optional note → PhotoEntry; reverse-chronological timeline | D-15 ModalSheet add flow; photo-entries repository; upload-photo pattern |
| CAT-07 | Catalog default sort: `acquisition_date` DESC, null dates last | D-12 cursor pagination with NULLS LAST sentinel; D-11 sessionStorage persistence |
| CAT-08 | Sort control: 5 options, selection persists for session | D-11 sessionStorage; D-12 cursor sort_id field |
| CAT-09 | Delete: cascade PhotoEntry + Reminder rows, schedule storage deletion, set Identification.plant_id NULL, preserve history row | D-22 same-TX pending_storage_deletions + Inngest event; identifications.plant_id FK verified: `ON DELETE SET NULL` at `src/contexts/identification/infrastructure/db/schema.ts:44` |
| CAT-10 | Catalog grid responsive: 2 cols ≤375px, 3 cols 600-899px, 4 cols ≥900px | UI-SPEC §2 — CatalogGrid Tailwind breakpoints |
| CAT-11 | Empty catalog state: "Sua estante ainda está esperando a primeira planta." with Sage line-art + single Canopy CTA | D-13 SSR zero-count → `<CatalogEmpty />`; UI-SPEC §4 empty-state composition |
| OFF-08 | Previously loaded catalog browsable offline; new identifications blocked | D-19 Serwist SWR 7d allowlist; D-16/D-17 TQ IDB persister; D-25 Playwright real IDB |
| UI-04 | Home screen empty state: full-bleed CTA + camera button + "Adicionar manualmente" text link | UI-SPEC §4.5; Phase 3 empty-state composition contract |
| UI-07 | Catalog grid responsive (2/3/4 cols) with card geometry + sort control | UI-SPEC §1 Plant Card + §2 CatalogGrid + §3 CatalogHeader |
| UI-08 | Plant profile: cover + thumbnail gallery + inline-edit + delete overflow + care/reminder/journal/ID-history variants | UI-SPEC §6; D-05 InlineEditField; D-07 delete confirm sheet |
| UI-11 | Photo journal: per-plant chronological list + add entry flow; read-only variant | UI-SPEC §8; D-15 ModalSheet; D-14 Lightbox |
</phase_requirements>

---

## Summary

Phase 5 is the catalog's full-stack foundation. It wires four coordinated subsystems that later phases extend: (1) the DB layer adds two new tables (`pending_storage_deletions`, `location_suggestions`) plus repository methods on existing ones; (2) the API layer adds nine route handlers following the thin-handler pattern already established; (3) the client state layer introduces TanStack Query v5 with an IDB persister (the read-side offline infrastructure Phase 9 extends with write queueing); and (4) the Serwist service worker gets a SWR allowlist for catalog GETs layered on top of the existing NetworkOnly default for `/api/*`.

The WAI-ARIA APG 1.2 Combobox and a custom Lightbox are the only greenfield UI primitives with significant complexity. Both have clear specifications from W3C APG and can be built headless (~200 LOC and ~150 LOC respectively). The remaining UI primitives (`InlineEditField`, `BottomSheet` for delete confirm + photo-journal) compose existing Radix Dialog and sonner infrastructure.

The Inngest `catalog/cleanup-storage` event handler plus `catalog/cleanup-storage-reconciler` hourly cron form a belt-and-braces storage cleanup pipeline: happy-path cleanup on event delivery, reconciler picks up stuck rows. The `FOR UPDATE SKIP LOCKED` query pattern combined with exponential backoff (5min→30min→4h→24h→72h) and max 5 attempts maps directly to Inngest's `RetryAfterError` pattern.

**Primary recommendation:** Start with Wave 0 test infrastructure (plan 05-01) and the two new schema migrations (plan 05-02) before any application code — the authedUser Playwright fixture and InMemoryStorageAdapter unlock all downstream integration + E2E specs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Manual plant add (name + photo) | API / Backend | Database | TX + storage upload happen server-side; client sends multipart |
| Cover auto-track on delete | Database (TX) | API | Must happen atomically inside the same DELETE TX |
| Catalog grid read + sort | Frontend (RSC + Client) | API | SSR first page via RSC, TQ owns subsequent pages |
| Cursor pagination | API / Backend | Database | `{sort_id, last_value, last_id}` cursor decoded + applied at DB query |
| Inline field edit | Frontend (Client) | API | Optimistic update on client; PATCH fires to server on blur/Enter |
| Location combobox suggestions | API / Backend | Database | `location_suggestions` table with usage-count ranking |
| Photo journal add entry | API / Backend | Browser/Client | Server handles multipart upload + DB row; client shows progress |
| Lightbox | Browser/Client | — | Pure client-side overlay using Radix Dialog focus trap |
| IDB query persistence | Browser/Client | — | `@tanstack/query-async-storage-persister` + `idb-keyval` — fully client |
| Serwist runtime cache | Browser/Service Worker | API | SW intercepts catalog GET responses; API signs URLs |
| Signed URL rotation | API / Backend | CDN/Storage | Supabase Storage mints 24h-TTL tokens server-side on every read |
| Plant delete + storage cleanup | API → Inngest → Storage | Database | API does TX + enqueues; Inngest does durable storage deletion |
| Subscription read-only gate | Frontend (Client) | — | `useSubscription()` stub; read-only banner flips on client |
| PostHog telemetry | API / Backend | — | Server-side capture via `posthog-node` after TX commit |

---

## Standard Stack

### Core

| Library | Verified Version | Purpose | Why Standard |
|---------|-----------------|---------|--------------|
| `@tanstack/react-query` | 5.100.6 [VERIFIED: npm registry] | Server-state cache, pagination, optimistic updates | Industry standard; v5 RSC HydrationBoundary is the canonical pattern |
| `@tanstack/query-async-storage-persister` | 5.100.6 [VERIFIED: npm registry] | Bridge TQ cache ↔ AsyncStorage interface | Required companion to persist-client; idb-keyval plugs in as storage |
| `@tanstack/react-query-persist-client` | 5.100.6 [VERIFIED: npm registry] | `PersistQueryClientProvider` component | Wraps provider + wires persister |
| `idb-keyval` | 6.2.2 [VERIFIED: npm registry] | Tiny IndexedDB key-value store (3.5 kB) | Non-blocking async IDB; perfect AsyncStorage adapter shape |
| `fake-indexeddb` (dev) | 6.2.5 [VERIFIED: npm registry] | In-memory IDB for unit tests | Auto-inject via `import 'fake-indexeddb/auto'`; per-test reset via `new IDBFactory()` |
| `inngest` | 4.2.6 (package.json pins `^4.2.4`) [VERIFIED: package.json + npm] | Durable event + cron functions | CLAUDE.md mandatory; `step.run` with `RetryAfterError` enables exponential backoff |
| `serwist` | 9.5.7 (package.json) [VERIFIED: package.json] | Service worker runtime caching | Already wired; Phase 5 extends with SWR allowlist |
| `drizzle-orm` | 0.45.2 [VERIFIED: package.json + npm] | Type-safe ORM; `pgEnum` + `pgPolicy` for new tables | CLAUDE.md mandatory; `pgEnum` for `pending_deletion_status` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@axe-core/playwright` | 4.11.2 (already installed) [VERIFIED: package.json] | Per-route a11y scanning in E2E | Combobox + BottomSheet + InlineEditField a11y gates |
| `@radix-ui/react-dialog` | 1.1.15 (already installed) [VERIFIED: package.json] | Focus trap + return focus for Lightbox | Reuse Phase 3 ModalSheet; Lightbox wraps same primitive |
| `sonner` | 2.0.7 (already installed) [VERIFIED: package.json] | Upload progress + error toasts | Phase 3 D-11; Phase 5 uses for PATCH rollback, photo upload progress |
| `posthog-node` | 5.29.7 (already installed) [VERIFIED: package.json] | Server-side event capture | D-28/D-29 events fire from route handlers after TX commit |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand-rolled `Combobox` (D-08) | `cmdk`, `react-aria` Combobox | Single narrow surface doesn't justify dep; hand-roll is ~200 LOC with full APG 1.2 coverage |
| `idb-keyval` adapter | `localforage` | `idb-keyval` is 3.5 kB tree-shakeable vs 8.5 kB; both expose AsyncStorage-compatible API |
| `experimental_createQueryPersister` | `createAsyncStoragePersister` (chosen) | Per-query persister is more granular; whole-client persister via `PersistQueryClientProvider` fits the allowlist pattern better for this use case |

**Installation:**
```bash
pnpm add @tanstack/react-query @tanstack/query-async-storage-persister @tanstack/react-query-persist-client idb-keyval
pnpm add -D fake-indexeddb
```

---

## Architecture Patterns

### System Architecture Diagram

```
Browser
  │
  ├─ RSC (catalog/page.tsx) ──── fetchFirstPage() ──► API GET /api/v1/plants?include_count=1
  │     └─ dehydrate(queryClient)                                │
  │           └─ <HydrationBoundary>                    DB (plants, cursor pagination)
  │                 │                                            │
  ├─ QueryProvider (<PersistQueryClientProvider>)       ◄── plants[] + total_count + nextCursor
  │     └─ IDB persister (idb-keyval)
  │           │
  ├─ <CatalogGrid> (useInfiniteQuery)
  │     └─ plantsKeys.lists({sort}) ──────────────── GET /api/v1/plants?cursor=...
  │
  ├─ <PlantProfile> (useQuery plantsKeys.detail(id))
  │     ├─ useMutation PATCH ──────────────────────► PATCH /api/v1/plants/:id
  │     │     └─ optimistic update → rollback on err        │ withUnitOfWork → plants repo
  │     └─ useMutation DELETE ────────────────────► DELETE /api/v1/plants/:id
  │           └─ bottom-sheet confirm first                  │ TX: cascade rows +
  │                                                          │   INSERT pending_storage_deletions
  │                                                          │   + inngest.send('plant.deleted')
  │
  ├─ <LocationCombobox>
  │     └─ locationsKeys.all() ──────────────────► GET /api/v1/locations
  │           merge: DB suggestions + i18n defaults
  │
Service Worker (sw.ts)
  ├─ NetworkOnly  ◄──── /api/* (default, preserved)
  └─ StaleWhileRevalidate  ◄── /api/v1/plants*, /api/v1/photo-entries*, /api/v1/locations
        └─ ExpirationPlugin(maxAgeSeconds: 7*86400)
              Byte-cache keyed by full signed URL (24h TTL)

Inngest
  ├─ catalog/cleanup-storage (event: plant.deleted)
  │     step.run: storageAdapter.deletePrefix(plant-photos, userId/plantId/)
  │     step.run: storageAdapter.deletePrefix(plant-thumbnails, userId/plantId/)
  │     step.run: UPDATE pending_storage_deletions SET status='completed'
  │     RetryAfterError on failure → max 4 retries (Inngest default)
  │
  └─ catalog/cleanup-storage-reconciler (cron: 0 * * * *)
        SELECT ... WHERE status='pending' AND scheduled_at <= NOW()
        ORDER BY scheduled_at LIMIT 50 FOR UPDATE SKIP LOCKED
        → for each row: same deletePrefix pattern, update attempts+1
        → attempts >= 5: SET status='failed'
```

### Recommended Project Structure

```
src/contexts/catalog/
├── api/                       # Thin route handler wrappers only
│   └── route-handlers/
│       ├── list-plants-handler.ts
│       ├── create-plant-handler.ts
│       ├── get-plant-handler.ts
│       ├── update-plant-handler.ts
│       ├── delete-plant-handler.ts
│       ├── list-photo-entries-handler.ts
│       ├── create-photo-entry-handler.ts
│       ├── delete-photo-entry-handler.ts
│       └── list-locations-handler.ts
├── application/               # Use-case functions (no Drizzle)
│   ├── create-plant.ts
│   ├── update-plant.ts
│   ├── delete-plant.ts
│   ├── list-plants.ts
│   ├── get-plant.ts
│   ├── list-photo-entries.ts
│   ├── create-photo-entry.ts
│   ├── delete-photo-entry.ts
│   └── list-locations.ts
├── domain/
│   └── schemas.ts             # drizzle-zod refined Zod schemas
├── infrastructure/
│   └── db/
│       ├── schema.ts          # extend with 2 new tables + pgEnum
│       ├── plants.ts
│       ├── photo-entries.ts
│       ├── pending-storage-deletions.ts  # NEW
│       └── location-suggestions.ts       # NEW
└── inngest/
    └── functions.ts           # cleanupStorage + cleanupStorageReconciler

src/contexts/billing/
└── application/
    └── use-subscription.ts    # NEW stub (Phase 5 D-21)

src/contexts/catalog/queries/
└── index.ts                   # NEW: Tkdodo-style query factory (D-18)

src/shared/ui/
├── combobox.tsx               # NEW: WAI-ARIA APG 1.2 headless (~200 LOC)
├── lightbox.tsx               # NEW: Radix Dialog wrap + swipe (~150 LOC)
└── inline-edit-field.tsx      # NEW: tap-to-edit with blur/Enter/Esc

src/app/(app)/catalog/
├── page.tsx                   # Server Component: first-page SSR (D-13)
├── add/page.tsx               # NEW: manual add
├── [plantId]/
│   ├── page.tsx               # NEW: plant profile
│   └── journal/page.tsx       # NEW: photo journal

src/app/api/v1/
├── plants/
│   ├── route.ts               # GET (list) + POST (create)
│   └── [plantId]/
│       ├── route.ts           # GET + PATCH + DELETE
│       └── photo-entries/route.ts  # GET + POST
├── photo-entries/
│   └── [photoEntryId]/route.ts     # DELETE
└── locations/route.ts         # GET

tests/
├── unit/
│   └── setup-idb.ts           # NEW: import 'fake-indexeddb/auto'
├── integration/
│   └── setup.ts               # extend: InMemoryStorageAdapter swap
└── e2e/
    └── fixtures/
        ├── authed-user.ts     # NEW (D-26)
        └── read-only.ts       # NEW (D-21 flip)
```

### Pattern 1: TanStack Query v5 RSC + HydrationBoundary (D-13)

**What:** Server Component pre-fetches first catalog page and passes dehydrated state to the client via `HydrationBoundary`. Client picks up with TQ and continues with cursor pagination.

**When to use:** Any catalog page where SSR eliminates skeleton flash on first load.

```tsx
// src/app/(app)/catalog/page.tsx
// Source: https://tanstack.com/query/v5/docs/framework/react/guides/advanced-ssr
import { dehydrate, HydrationBoundary, QueryClient } from '@tanstack/react-query'
import { plantsKeys } from '@contexts/catalog/queries'

export default async function CatalogPage() {
  const queryClient = new QueryClient()
  const data = await queryClient.fetchQuery(plantsKeys.lists({ sort: 'date_new' }))

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {data.total_count === 0 ? <CatalogEmpty /> : <CatalogGrid />}
    </HydrationBoundary>
  )
}
```

**Key note:** Use `fetchQuery()` (not `prefetchQuery()`) when you need the SSR result to drive conditional rendering. `prefetchQuery()` returns void — safe for pre-warming without branching on the result.

### Pattern 2: Async Storage Persister with idb-keyval (D-16/D-17)

**What:** `createAsyncStoragePersister` expects `{ getItem, setItem, removeItem }`. `idb-keyval` exposes `get/set/del`. A 10-line adapter bridges them. `PersistQueryClientProvider` wraps the app; `dehydrateOptions.shouldDehydrateQuery` enforces the allowlist.

**When to use:** In `src/shared/ui/query-provider.tsx` (client component, mounted inside `(app)/layout.tsx`).

```tsx
// Source: https://tanstack.com/query/v5/docs/framework/react/plugins/createAsyncStoragePersister
import { get, set, del } from 'idb-keyval'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { defaultShouldDehydrateQuery } from '@tanstack/react-query'

const idbStorage = {
  getItem: (key: string) => get(key),
  setItem: (key: string, value: string) => set(key, value),
  removeItem: (key: string) => del(key),
}

const persister = createAsyncStoragePersister({
  storage: idbStorage,
  key: 'folhario.query-cache',
  throttleTime: 1000,
})

const ALLOWED_PREFIXES = [
  ['catalog', 'plants'],
  ['catalog', 'plant'],
  ['catalog', 'photo-entries'],
  ['catalog', 'locations'],
]

function shouldPersist(query: Query) {
  if (!defaultShouldDehydrateQuery(query)) return false
  return ALLOWED_PREFIXES.some(prefix =>
    prefix.every((part, i) => query.queryKey[i] === part)
  )
}

// In QueryProvider:
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{
    persister,
    maxAge: 24 * 60 * 60 * 1000, // 24h
    dehydrateOptions: { shouldDehydrateQuery: shouldPersist },
  }}
>
  {children}
</PersistQueryClientProvider>
```

### Pattern 3: Tkdodo-style Query Factory (D-18)

**What:** Centralised key factories with co-located `queryFn` and `staleTime`. Prevents key drift across 5+ query surfaces.

**When to use:** All catalog queries read through this module; mutations invalidate via partial-match.

```tsx
// src/contexts/catalog/queries/index.ts
// Source: Based on TanStack Query docs + tkdodo.eu/blog/effective-react-query-keys
export const plantsKeys = {
  all: () => ['catalog', 'plants'] as const,
  lists: (params: ListPlantsParams) => ({
    queryKey: ['catalog', 'plants', 'list', params],
    queryFn: () => listPlants(params),
    staleTime: 30_000,
  }),
  detail: (id: string) => ({
    queryKey: ['catalog', 'plant', id],
    queryFn: () => getPlant(id),
    staleTime: 60_000,
  }),
  photoEntries: (plantId: string) => ({
    queryKey: ['catalog', 'photo-entries', plantId],
    queryFn: () => listPhotoEntries(plantId),
    staleTime: 60_000,
  }),
}

export const locationsKeys = {
  all: () => ({
    queryKey: ['catalog', 'locations'],
    queryFn: () => listLocations(),
    staleTime: 5 * 60_000,
  }),
}

// Mutation invalidation (partial match — invalidates ALL list variants):
queryClient.invalidateQueries({ queryKey: plantsKeys.all() })
```

### Pattern 4: Serwist SWR Allowlist for Catalog GETs (D-19)

**What:** Layer `StaleWhileRevalidate` with `ExpirationPlugin` on top of the existing `NetworkOnly` for `/api/*`. The allowlist captures are registered BEFORE the `NetworkOnly` catch-all so Serwist route matching is first-match-wins.

**When to use:** In `src/app/sw.ts` — add before the existing `registerCapture` for `/api/`.

```typescript
// Source: https://context7.com/serwist/serwist (Serwist docs)
import { StaleWhileRevalidate, ExpirationPlugin } from "serwist"

const catalogGetsStrategy = new StaleWhileRevalidate({
  cacheName: 'catalog-api-v1',
  plugins: [
    new ExpirationPlugin({
      maxAgeSeconds: 7 * 24 * 60 * 60, // 7d
      purgeOnQuotaError: true,
    }),
  ],
})

// Register BEFORE the NetworkOnly /api/* catch
serwist.registerCapture(
  ({ url }) =>
    url.pathname.startsWith('/api/v1/plants') ||
    url.pathname.startsWith('/api/v1/photo-entries') ||
    url.pathname === '/api/v1/locations',
  catalogGetsStrategy,
  'GET',
)
```

### Pattern 5: Inngest Cleanup Handler with RetryAfterError Backoff (D-22/D-24)

**What:** `catalog/cleanup-storage` consumes `plant.deleted` event. `catalog/cleanup-storage-reconciler` runs hourly via cron. Both use `RetryAfterError` to implement the 5min→30min→4h→24h→72h backoff.

```typescript
// Source: https://context7.com/inngest/inngest-js (Inngest docs)
import { RetryAfterError, NonRetriableError } from 'inngest'

export const cleanupStorage = inngest.createFunction(
  { id: 'catalog/cleanup-storage', retries: 4 },
  [{ event: 'plant.deleted' }],
  async ({ event, step }) => {
    const { userId, plantId, bucket, prefix } = event.data

    await step.run('delete-storage-prefix', async () => {
      const row = await pendingDeletionsRepo.markInProgress(bucket, prefix)
      try {
        await storageAdapter.deletePrefix({ bucket, prefix })
        await pendingDeletionsRepo.markCompleted(row.id)
      } catch (err) {
        await pendingDeletionsRepo.recordError(row.id, String(err))
        throw err // triggers Inngest retry with default backoff
      }
    })
  },
)

export const cleanupStorageReconciler = inngest.createFunction(
  { id: 'catalog/cleanup-storage-reconciler', retries: 0 },
  [{ cron: '0 * * * *' }], // hourly
  async ({ step }) => {
    await step.run('reconcile-batch', async () => {
      const rows = await pendingDeletionsRepo.fetchPendingBatch(50)
      // FOR UPDATE SKIP LOCKED in repo query
      for (const row of rows) {
        if (row.attempts >= 5) {
          await pendingDeletionsRepo.markFailed(row.id)
          continue
        }
        const delayMs = [5, 30, 240, 1440, 4320][row.attempts] * 60 * 1000
        if (Date.now() < new Date(row.scheduledAt).getTime() + delayMs) continue
        try {
          await storageAdapter.deletePrefix({ bucket: row.bucket, prefix: row.prefix })
          await pendingDeletionsRepo.markCompleted(row.id)
        } catch (err) {
          await pendingDeletionsRepo.recordError(row.id, String(err))
          // bump attempts + update scheduled_at for next backoff window
        }
      }
    })
  },
)
```

### Pattern 6: Drizzle pgEnum + RLS for pending_storage_deletions (D-23)

**What:** `pgEnum` defines the ENUM type; `pgPolicy` adds owner-only RLS. Both land in the same Drizzle migration.

```typescript
// Source: https://context7.com/drizzle-team/drizzle-orm (Drizzle docs)
import { pgEnum, pgTable, pgPolicy, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const pendingDeletionStatus = pgEnum('pending_deletion_status', [
  'pending', 'in_progress', 'completed', 'failed',
])

export const pendingStorageDeletions = pgTable(
  'pending_storage_deletions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    bucket: text('bucket').notNull(),
    prefix: text('prefix').notNull(),
    status: pendingDeletionStatus('status').notNull().default('pending'),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('psd_status_scheduled_at_idx').on(table.status, table.scheduledAt),
    pgPolicy('owner-select', { for: 'select', using: sql`auth.uid() = user_id` }),
    pgPolicy('owner-insert', { for: 'insert', withCheck: sql`auth.uid() = user_id` }),
    pgPolicy('owner-update', { for: 'update', using: sql`auth.uid() = user_id` }),
  ],
).enableRLS()
```

### Pattern 7: WAI-ARIA APG 1.2 Combobox with Listbox Popup (D-08)

**What:** The exact ARIA attribute and keyboard contract required for the `Combobox` primitive at `src/shared/ui/combobox.tsx`. DOM focus stays on the input; AT focus moves within listbox via `aria-activedescendant`.

**Keyboard map (verbatim from W3C APG 1.2):** [CITED: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/]

| Key | Action |
|-----|--------|
| `ArrowDown` | Moves focus to next option; selects it |
| `ArrowUp` | Moves focus to previous option; selects it |
| `Home` (optional) | Moves to first option |
| `End` (optional) | Moves to last option |
| `Enter` | Accepts focused option; closes popup; places value in input |
| `Escape` | Closes popup; returns focus to input |
| Printable char | Returns focus to input and types character (editable combobox) |

**Required ARIA attributes:**

```tsx
// Source: https://www.w3.org/WAI/ARIA/apg/patterns/combobox/
<input
  role="combobox"
  aria-controls={listboxId}        // ID of the listbox element
  aria-expanded={isOpen}           // false when closed, true when open
  aria-activedescendant={activeId} // ID of currently highlighted option, or undefined
  aria-autocomplete="list"
  aria-labelledby={labelId}
  id={inputId}
/>
<ul
  role="listbox"
  id={listboxId}
  aria-labelledby={labelId}
>
  {options.map(opt => (
    <li
      role="option"
      id={`${listboxId}-${opt.value}`}
      aria-selected={opt.value === selected}
    >
      {opt.label}
    </li>
  ))}
</ul>
```

### Pattern 8: Fake-IndexedDB Per-Test Reset (D-25)

**What:** `import 'fake-indexeddb/auto'` in the unit setup file injects all IDB globals. Per-test isolation via `indexedDB = new IDBFactory()`.

```typescript
// tests/unit/setup-idb.ts
// Source: https://context7.com/dumbmatter/fakeindexeddb
import 'fake-indexeddb/auto'

beforeEach(() => {
  // Reset IDB state between tests for full isolation
  indexedDB = new IDBFactory()
})
```

### Anti-Patterns to Avoid

- **Drizzle in route handlers:** Route handlers call use-cases → use-cases call repositories. Drizzle is never imported in `/api/**/*.ts` (Phase 2 D-17). Enforced by `no-drizzle-in-routes.test.ts`.
- **Ad-hoc error codes:** Only `validation_failed`, `not_found`, `forbidden`, `read_only_mode`, `subscription_required` are emitted to clients. `cost_ceiling_reached` / `breaker_open` are internal-only (Phase 1 D-10).
- **PostHog capture before TX commit:** Events fire in `tx.afterCommit(...)` or equivalent. A rolled-back TX must not leak telemetry.
- **Hardcoded pt-BR strings:** All copy in `messages/pt-BR.json` under `catalog.*`; accessed via `useTranslations('catalog')` (Phase 3 D-26).
- **`useSubscription()` side-effects in read-only check:** The stub returns a constant — Phase 5 must never conditionally fetch from a billing endpoint.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Focus trap in Lightbox / BottomSheet | Custom focus-trap logic | Radix Dialog (`@radix-ui/react-dialog`) | Handles tricky edge cases: nested dialogs, portal elements, dynamically added focusable items |
| Toast notifications | Custom toast state | `sonner` (already installed) | Phase 3 D-11; already wired |
| Multipart form parsing | Manual `request.formData()` parsing + validation | Zod + Next.js `request.formData()` (built-in) | Zod `.superRefine()` for cross-field validation (name AND photo both required) |
| Prefix-based storage delete | Loop over individual keys | `storageAdapter.deletePrefix()` (already exists in `photo-storage.ts`) | Supabase Storage SDK's bulk remove; existing contract tested |
| Exponential backoff in reconciler | `Date.now()` arithmetic | `RetryAfterError` in Inngest event handler | Inngest tracks attempt count + schedules retry; reconciler uses attempt index into backoff table |
| IDB storage implementation | Custom IndexedDB wrapper | `idb-keyval` | 3.5 kB, fully tested, non-blocking |
| ARIA combobox semantics | Using `<select>` or a generic dropdown | WAI-ARIA APG 1.2 pattern with `role="combobox"` + `aria-activedescendant` | `<select>` cannot support the custom "Adicionar '{typed}'" ghost row; `aria-activedescendant` keeps DOM focus on the input (required for typeahead) |

**Key insight:** The storage cleanup pipeline looks simple (just delete files) but requires durable failure recovery — orphaned bytes accumulate silently if event delivery fails. The belt-and-braces (event handler + reconciler cron) is the correct architecture; a single delete-on-request would leave orphans after any transient storage failure.

---

## Common Pitfalls

### Pitfall 1: TanStack Persister + RSC Hydration Mismatch

**What goes wrong:** `PersistQueryClientProvider` rehydrates from IDB asynchronously on the client. If the IDB data is stale and the RSC sends fresh data via `HydrationBoundary`, the merge precedence matters: TQ v5 merges by `dataUpdatedAt` — whichever is newer wins. The pitfall is that a stale-but-present IDB entry can briefly show old data before the server hydration overwrites it, causing a flash.

**Why it happens:** IDB rehydration fires before React paint; `HydrationBoundary` merges server state into the same cache. If IDB `dataUpdatedAt` > server `dataUpdatedAt` (clock skew, cached after a mutation), IDB wins and the freshly SSR'd data is discarded.

**How to avoid:** Set `maxAge: 24 * 60 * 60 * 1000` on the persister so IDB entries expire after 24h and don't outlive their usefulness. Use `buster` string on `PersistQueryClientProvider` tied to a deployment hash so cache is invalidated on deploys.

**Warning signs:** Plant count in catalog header is stale after adding a plant from another device. TQ devtools show `dataUpdatedAt` is older than expected.

### Pitfall 2: Signed URL Expiry vs Serwist Cache Key Collision

**What goes wrong:** Supabase signed URLs include query parameters like `token=...&expires=...`. Serwist caches by full URL. A 24h-TTL signed URL becomes a new cache entry every time it is refreshed (every catalog refetch), leaving dead entries until `ExpirationPlugin` evicts them. With many photos this accumulates hundreds of stale byte-cache entries.

**Why it happens:** Signed URL uniqueness is by design (security) — each token is different even for the same photo. Serwist treats each as a different resource.

**How to avoid:** Configure `ExpirationPlugin` with `maxEntries` (e.g., 200) to cap cache growth. Alternatively, use `ignoreSearch: true` in the `matchOptions` — but only if all photo paths are unique (they are: `{userId}/{plantId}/{photoId}.ext`), so there is no cross-photo collision risk.

**Recommended approach:** Use `maxEntries: 200` + `purgeOnQuotaError: true` on the image byte cache. The 7d `maxAgeSeconds` naturally cleans up entries once the corresponding signed URL has expired.

**Warning signs:** `caches.open('catalog-api-v1')` shows hundreds of entries; app storage estimate approaches quota.

### Pitfall 3: IDB Eviction Race on Quota Guard (D-17)

**What goes wrong:** `navigator.storage.estimate()` is called during `onSuccess` of persist. Between the check and the eviction, another tab may write more data, pushing the quota over. The guard is approximate, not transactional.

**Why it happens:** No cross-tab locking on IDB writes; multiple tabs can trigger writes concurrently.

**How to avoid:** The 0.8 threshold gives 20% headroom to absorb concurrent writes. Eviction should target the oldest query by `dataUpdatedAt` — remove queries with `queryClient.getQueryCache().findAll()` sorted by `updatedAt`, remove the oldest N until used/quota < 0.7.

**Warning signs:** `DOMException: QuotaExceededError` in Sentry on IDB write — caught by `purgeOnQuotaError: true` on ExpirationPlugin but surfaces for the IDB persister separately.

### Pitfall 4: FOR UPDATE SKIP LOCKED Must Use Service Role

**What goes wrong:** The reconciler cron runs outside a request context — there is no JWT, so `SET LOCAL ROLE authenticated` would fail or produce wrong RLS results. `pending_storage_deletions` RLS is owner-based (`auth.uid() = user_id`) — running as `authenticated` without a JWT would deny access to all rows.

**Why it happens:** `withUnitOfWork` is designed for per-request use-cases with a known `userId`. The reconciler processes rows across all users.

**How to avoid:** The reconciler's DB query must use the service-role connection (the raw `db` client with `BYPASSRLS`), not `withUnitOfWork`. The Inngest handler runs server-side with access to `DATABASE_URL` — use the admin db client directly for the reconciler.

**Warning signs:** Reconciler step returns 0 rows processed even though `pending_storage_deletions` has pending rows.

### Pitfall 5: Inngest v4 (NOT v3) — Breaking Change in Task Brief

**What goes wrong:** The task brief says "Inngest v3 events". The project actually uses `inngest@^4.2.4` (package.json). Inngest v3 → v4 had a breaking change in function registration syntax.

**Why it happens:** Research task brief had stale version reference.

**How to avoid:** Use `inngest.createFunction({...}, [...triggers], handler)` — the v4 API. Check `src/contexts/identification/inngest/functions.ts` (already uses v4 pattern) and `src/shared/inngest/registry.ts` for the export pattern.

**Warning signs:** TypeScript error on `triggers` array format or `{ event: ... }` shape.

### Pitfall 6: `deletePrefix` Idempotency on Partial Failures

**What goes wrong:** `storageAdapter.deletePrefix()` is called; it deletes 50 of 53 objects, then fails. The Inngest retry re-runs the step and calls `deletePrefix` again — this must succeed even though 50 objects are already gone.

**Why it happens:** Supabase Storage `remove([...keys])` returns success even for keys that don't exist (idempotent by design). `deletePrefix` iterates keys via list + remove.

**How to avoid:** Verify `deletePrefix` implementation handles "key not found" from the SDK as a success case — it already does in `src/shared/adapters/supabase-storage.ts` (standard pattern). No action needed if the existing adapter is idempotent.

**Warning signs:** Inngest step repeatedly fails after partial prefix delete.

### Pitfall 7: `navigator.storage.estimate()` Not Available in SSR

**What goes wrong:** The storage budget guard in `storage-budget-guard.ts` calls `navigator.storage.estimate()`. If this module is accidentally imported in a Server Component or a server-side test, it throws `ReferenceError: navigator is not defined`.

**Why it happens:** `navigator` is a browser global. The IDB persister and quota guard are client-only.

**How to avoid:** Guard with `typeof navigator !== 'undefined'`. Wrap the entire module in a `'use client'` boundary or ensure it is only imported from within `<QueryProvider>` (already a `'use client'` component).

---

## Code Examples

### Cursor Pagination with NULLS LAST (D-12)

```typescript
// Composite cursor: {sort_id, last_value, last_id} — base64 encoded
// For acquisition_date DESC with NULL dates last:
// WHERE (acquisition_date IS NULL AND created_at < :last_date)
//    OR (acquisition_date < :last_value)
//    OR (acquisition_date = :last_value AND id < :last_id)
// NULLS LAST sentinel: pass null as last_value when last row had null acquisition_date

type Cursor = { sort_id: string; last_value: string | null; last_id: string }

function encodeCursor(c: Cursor): string {
  return Buffer.from(JSON.stringify(c)).toString('base64url')
}
function decodeCursor(s: string): Cursor {
  return JSON.parse(Buffer.from(s, 'base64url').toString())
}
```

### Cover Auto-Track on Photo Delete (D-03)

```typescript
// In delete-photo-entry.ts use-case
// After deleting the PhotoEntry row, if it was the cover:
async function deletePhotoEntry(input: { plantId: string; photoEntryId: string; userId: string }) {
  await withUnitOfWork(input.userId, async (tx) => {
    const deleted = await photoEntriesRepo.delete(tx, input.photoEntryId)
    if (deleted.photoUrl === currentCoverUrl) {
      // Promote oldest remaining entry (or null if no entries)
      const oldest = await photoEntriesRepo.findOldestForPlant(tx, input.plantId)
      await plantsRepo.updateCoverPhotoUrl(tx, input.plantId, oldest?.photoUrl ?? null)
    }
  })
}
```

### Optimistic PATCH Rollback on InlineEditField (D-05/D-06)

```tsx
// In plant profile
const { mutate } = useMutation({
  mutationFn: (update: PatchPlantInput) => patchPlant(plantId, update),
  onMutate: async (update) => {
    await queryClient.cancelQueries({ queryKey: plantsKeys.detail(plantId).queryKey })
    const prev = queryClient.getQueryData(plantsKeys.detail(plantId).queryKey)
    queryClient.setQueryData(plantsKeys.detail(plantId).queryKey, (old) => ({ ...old, ...update }))
    return { prev }
  },
  onError: (_err, _update, context) => {
    queryClient.setQueryData(plantsKeys.detail(plantId).queryKey, context?.prev)
    toast.error('Não conseguimos salvar agora — tentar de novo?')
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: plantsKeys.detail(plantId).queryKey })
  },
})
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `experimental_createQueryPersister` (per-query) | `createAsyncStoragePersister` + `PersistQueryClientProvider` (whole-cache with allowlist) | TQ v5.0 | Allowlist via `shouldDehydrateQuery` is the current recommended pattern for selective persistence |
| Workbox (Google) | Serwist (fork) | 2023 — Workbox development stalled | Serwist has same API, active maintenance; already in use |
| Inngest v3 `createFunction` triggers as second arg | Inngest v4 triggers array is second arg of `createFunction` | Inngest v4.0 | **Project already uses v4 (`^4.2.4`)** — task brief said "v3" but this is incorrect. Use v4 API. |
| TanStack Query v4 `useQuery({queryKey, queryFn})` inline | TQ v5 query factory (Tkdodo pattern) | TQ v5.0 | Type inference improved; partial-match invalidation works correctly |

**Deprecated/outdated:**
- `TanStack Query v6`: Does NOT exist as of 2026-04-29. Latest stable is 5.100.6. The task brief's "v6" reference is erroneous.
- `@serwist/next` v9 changed `runtimeCaching` config format: use `registerCapture` / `registerRoute` directly on the `Serwist` instance (as already done in `src/app/sw.ts`) rather than the old Workbox config array.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥22 | All server code | ✓ | 22.x (engines field) | — |
| pnpm | Package manager | ✓ | 9.15.5 | — |
| Supabase local | Integration tests | ✓ | 2.95.0 CLI | — |
| `@tanstack/react-query` | D-16 TQ provider | ✗ (not yet installed) | — | Must install |
| `@tanstack/query-async-storage-persister` | D-16 IDB persister | ✗ (not yet installed) | — | Must install |
| `@tanstack/react-query-persist-client` | D-16 PersistQueryClientProvider | ✗ (not yet installed) | — | Must install |
| `idb-keyval` | D-16 IDB storage adapter | ✗ (not yet installed) | — | Must install |
| `fake-indexeddb` (dev) | D-25 unit IDB tests | ✗ (not yet installed) | — | Must install |
| `@axe-core/playwright` | A11y E2E gates | ✓ | 4.11.2 | — |

**Missing dependencies with no fallback:**
- `@tanstack/react-query`, `@tanstack/query-async-storage-persister`, `@tanstack/react-query-persist-client`, `idb-keyval` — must be installed as part of plan 05-10.
- `fake-indexeddb` (dev) — must be installed as part of plan 05-01.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `withUnitOfWork` cannot be used for the reconciler cron because it requires a known `userId` for RLS | Pitfall 4 | If the reconciler can be redesigned to bypass RLS via a different mechanism, the architectural guidance changes |
| A2 | `storageAdapter.deletePrefix()` is idempotent (handles already-deleted keys as success) | Pitfall 6 | If not idempotent, Inngest retries of cleanup steps will fail after partial deletes, requiring explicit key-existence checks |
| A3 | `ExpirationPlugin` `maxEntries` cap is sufficient to prevent signed-URL cache bloat | Pitfall 2 | If photo volumes are very high (many users, many photos), a custom cache-key normalizer stripping the token query param may be needed — but this risks cross-user collisions if paths are ever shared |

---

## Open Questions

1. **`useSubscription()` stub test harness (D-21)**
   - What we know: E2E fixture flips the stub return value; `tests/e2e/fixtures/read-only.ts` is new.
   - What's unclear: Does the stub need to be environment-variable-driven (so the running Next.js process flips it) or MSW-intercepted (client-side mock)?
   - Recommendation: Environment variable approach matches the `IDENTIFICATION_PROVIDER_MODE=stub` pattern already used in playwright.config.ts. Set `SUBSCRIPTION_READ_ONLY=1` in the webServer env when the `read-only.ts` fixture is active.

2. **Inngest function registry export (D-22)**
   - What we know: `src/shared/inngest/registry.ts` exists (referenced in CONTEXT.md). The export array for new catalog functions must be added.
   - What's unclear: The exact shape of the registry (array of functions vs object).
   - Recommendation: Grep `src/shared/inngest/registry.ts` at plan-write time and follow existing pattern from Phase 4 Inngest functions.

---

## Validation Architecture

> `workflow.nyquist_validation` key absent from `.planning/config.json` — treated as enabled.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 (unit + unit-dom + integration projects) + Playwright 1.59.1 (E2E) |
| Config file | `/Users/machado/Projects/folhario/vitest.config.ts` |
| Unit run command | `pnpm test:unit` (runs `vitest --run --project=unit --project=unit-dom`) |
| Integration run command | `pnpm test:integration` (runs `vitest --run --project=integration`) |
| E2E run command | `pnpm test:e2e` (runs `playwright test`) |
| Full suite command | `pnpm test:run` (unit + integration) then `pnpm test:e2e` |

### Validation Strata

| Stratum | Scope | Tooling | Plans Covered |
|---------|-------|---------|---------------|
| **Unit: Drizzle schema** | pgEnum values, table column types, FK onDelete rules for new tables | Vitest unit | 05-02, 05-03 |
| **Unit: Repository logic** | `list({sort, cursor, limit})`, `countForUser`, `getCascadeCounts`, `fetchPendingBatch`, location upsert, cover auto-promote | Vitest unit + fake-indexeddb | 05-03 |
| **Unit: Zod schema refinement** | `createPlantInputSchema` cross-field (name AND photo required), `updatePlantInputSchema` partial | Vitest unit | 05-04 |
| **Unit: Cursor encoding** | `encodeCursor/decodeCursor` round-trip; NULLS LAST sentinel; base64url safety | Vitest unit | 05-03, 05-07 |
| **Unit: IDB persister adapter** | `idb-keyval` AsyncStorage adapter `getItem/setItem/removeItem`; per-test reset via `new IDBFactory()` | Vitest unit-dom + fake-indexeddb | 05-10 |
| **Unit: Storage budget guard** | `navigator.storage.estimate()` mock; eviction fires at >0.8; eviction selects oldest queries | Vitest unit-dom | 05-10 |
| **Unit: Query factory** | Key shape correctness; `plantsKeys.lists({sort})` produces stable keys; partial-match invalidation type-checks | Vitest unit | 05-10 |
| **Unit: Combobox keyboard** | Arrow nav, Home/End, Enter accepts, Esc closes, printable-char typeahead, `aria-activedescendant` value updates | Vitest unit-dom + @testing-library/react | 05-12 |
| **Unit: InlineEditField** | Blur saves, Enter saves (single-line), Esc reverts to pre-edit value; `role="alert"` announcements | Vitest unit-dom | 05-14 |
| **Unit: Lightbox** | Touch swipe events; Esc closes; Fechar button visible; `dialog` role | Vitest unit-dom | 05-14 |
| **Integration: Plant create** | Multipart POST creates Plant + PhotoEntry in one TX; rollback on storage failure triggers compensating delete; PostHog event NOT fired on rollback | Vitest integration + InMemoryStorageAdapter | 05-05, 05-08 |
| **Integration: Plant delete** | DELETE cascades PhotoEntry + Reminder rows; Identification.plant_id set to NULL; `pending_storage_deletions` row inserted; Inngest event emitted | Vitest integration | 05-06, 05-09 |
| **Integration: Location upsert** | `usage_count` increments on create+edit; `last_used_at` updated; DELETE plant does NOT decrement | Vitest integration | 05-03 |
| **Integration: Inngest cleanup** | `catalog/cleanup-storage` handler: mock Inngest; assert `deletePrefix` called; assert row status='completed'; assert retry on storage error | Vitest integration + mock-inngest fixture | 05-06 |
| **Integration: Cursor pagination** | All 5 sort modes return correct ordering; cursor round-trip; NULLS LAST for `acquisition_date`; `?include_count=1` returns total; subsequent cursor pages omit count | Vitest integration | 05-07, 05-08 |
| **Integration: RLS owner-only** | `pending_storage_deletions` and `location_suggestions` reject cross-user access under authenticated role | Vitest integration + `rls-real-jwt.integration.test.ts` pattern | 05-02, 05-03 |
| **Integration: Idempotency** | POST /plants with same `Idempotency-Key` returns 200 + cached response without duplicate row | Vitest integration (Phase 2 D-37 idempotency_keys table) | 05-08 |
| **E2E: authedUser fixture** | `supabase.auth.admin.createUser` + session cookies injected; catalog accessible without login flow | Playwright | 05-01, 05-26 |
| **E2E: Catalog grid + sort** | Grid renders 2/3/4 cols at 375/600/900 breakpoints; sort persists across navigation within session; sessionStorage key present | Playwright | 05-15 |
| **E2E: Manual add happy path** | Form submit → plant appears in grid → profile reachable → PostHog `plant_added` event in devtools | Playwright | 05-17 |
| **E2E: Manual add validation** | Missing name + photo → ≥2 errors → summary block visible; per-field Overdue Rust border; submit auto-focuses first invalid | Playwright | 05-17 |
| **E2E: Inline edit** | Tap field → input focused → blur saves → server reflects update; Esc reverts; Enter saves single-line | Playwright | 05-16 |
| **E2E: Delete confirm sheet** | Cascade counts (photo_count + reminder_count) shown; Excluir destructive; plant disappears from grid | Playwright | 05-16 |
| **E2E: Photo journal** | Add photo via ModalSheet → prepended to journal; Lightbox opens on tap | Playwright | 05-17 |
| **E2E: Offline browsing (OFF-08)** | Load catalog online → airplane mode → navigate → plants visible; offline banner present; identify attempt shows blocked message | Playwright (real IDB + SW) | 05-18 |
| **Axe a11y: Combobox** | `@axe-core/playwright` — 0 serious/critical violations; keyboard APG contract tested programmatically | Playwright + AxeBuilder | 05-12 |
| **Axe a11y: BottomSheet** | Focus trap cycles inside Dialog; return focus to invoker on Esc/close (mirrors axe-modal-focus-trap.spec.ts pattern) | Playwright + AxeBuilder | 05-13 |
| **Axe a11y: InlineEditField** | Edit-mode announced to SR via `role="alert"`; focus placement on edit-open; revert announced | Playwright + AxeBuilder | 05-14 |
| **Axe a11y: Catalog routes** | All Phase 5 routes (catalog, add, profile, journal) pass axe-placeholder-pages.spec.ts loop (extend ROUTES array) | Playwright + AxeBuilder | 05-15, 05-16, 05-17 |
| **Nyquist: SW offline + IDB persistence** | `navigator.storage.estimate()` mock in unit tests; real IDB + SW in Playwright E2E offline spec | Playwright | 05-18, 05-10 |
| **Nyquist: Signed URL TTL** | Unit-test: URL with `expires` query param cached by full URL; after `maxAgeSeconds` the entry is evicted; confirmed via `ExpirationPlugin` mock | Vitest unit-dom (SW mocked) | 05-18 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command |
|--------|----------|-----------|-------------------|
| CAT-02 | Manual plant creation → Plant + PhotoEntry | Integration | `pnpm test:integration` (catalog-create.integration.test.ts) |
| CAT-03 | Missing name/photo → `validation_failed` | Integration + E2E | Integration + Playwright add spec |
| CAT-04 | Plant profile inline-edit | E2E | `pnpm test:e2e` (catalog-profile.spec.ts) |
| CAT-05 | Location combobox | E2E + Axe | Playwright combobox spec + AxeBuilder |
| CAT-06 | Photo journal add | E2E | Playwright journal spec |
| CAT-07 | Default sort date DESC NULLS LAST | Integration | pnpm test:integration (list-plants.integration.test.ts) |
| CAT-08 | Sort persists session | E2E | Playwright catalog-sort.spec.ts |
| CAT-09 | Delete cascade + storage schedule | Integration + E2E | Integration (delete-plant) + Playwright |
| CAT-10 | Grid responsive breakpoints | E2E | Playwright responsive viewport test |
| CAT-11 | Empty catalog state | E2E | Playwright (zero plants fixture) |
| OFF-08 | Offline catalog browsable | E2E (real SW + IDB) | Playwright offline spec |
| UI-04 | Home empty state | E2E | Playwright (zero plants fixture) |
| UI-07 | Grid + sort control | E2E | Playwright catalog spec |
| UI-08 | Plant profile surfaces | E2E + Axe | Playwright profile spec + AxeBuilder |
| UI-11 | Photo journal | E2E | Playwright journal spec |

### Sampling Rate

- **Per task commit:** `pnpm test:unit` (fast, < 30 seconds)
- **Per wave merge:** `pnpm test:run` (unit + integration)
- **Phase gate:** Full suite (`pnpm test:run && pnpm test:e2e`) green before `/gsd-verify-work`

### Wave 0 Gaps (plan 05-01 must close these)

- [ ] `tests/unit/setup-idb.ts` — `import 'fake-indexeddb/auto'` + `beforeEach(() => { indexedDB = new IDBFactory() })` — covers D-25
- [ ] `tests/e2e/fixtures/authed-user.ts` — D-26 Playwright fixture with `supabase.auth.admin.createUser` + cookie injection
- [ ] `tests/e2e/fixtures/read-only.ts` — D-21 Playwright fixture flipping `SUBSCRIPTION_READ_ONLY` env
- [ ] `tests/integration/setup.ts` extension — `InMemoryStorageAdapter` swap via `__setStorageAdapterForTests` — covers D-27
- [ ] vitest.config.ts: add `setup-idb.ts` to `unit-dom` project `setupFiles` array
- [ ] Install `fake-indexeddb` dev dep: `pnpm add -D fake-indexeddb`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireVerifiedUser()` (Phase 4 D-21) on all mutating handlers |
| V3 Session Management | no | Phase 4 handles; Phase 5 inherits |
| V4 Access Control | yes | RLS owner-only on all catalog tables; `withUnitOfWork` GUC binding; explicit `user_id` filter in all repos |
| V5 Input Validation | yes | Zod schemas on all route inputs; multipart file MIME + size validation; GPS strip defense-in-depth (server rejects) |
| V6 Cryptography | no | Supabase Storage signed URLs via SDK — never hand-rolled |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user plant access | Spoofing | RLS `auth.uid() = user_id` + explicit repo filter |
| IDOR via `plantId` in URL | Spoofing | `requireVerifiedUser()` + `findByIdForUser` (owner check in query) |
| GPS data in uploaded photos | Information Disclosure | Client strips EXIF/GPS before upload; server rejects any file with GPS as `validation_failed` (defense in depth) |
| Pending storage deletion across users | Elevation | `pending_storage_deletions` RLS; reconciler uses service role (BYPASSRLS) only for reading pending rows, not writing user data |
| IDB cache data exposure on shared device | Information Disclosure | IDB is origin-scoped; session clear on logout must also clear `idb-keyval` store (`del('folhario.query-cache')`) |

---

## Sources

### Primary (HIGH confidence)
- `/tanstack/query` (Context7) — dehydrate/HydrationBoundary/RSC pattern, createAsyncStoragePersister, shouldDehydrateQuery allowlist, PersistQueryClientProvider
- `/jakearchibald/idb-keyval` (Context7) — createStore, get/set/del API, custom store pattern
- `/dumbmatter/fakeindexeddb` (Context7) — `fake-indexeddb/auto` import, `new IDBFactory()` per-test reset
- `/serwist/serwist` (Context7) — StaleWhileRevalidate, ExpirationPlugin, registerCapture, NetworkOnly
- `/inngest/inngest-js` (Context7) — createFunction, cron triggers, RetryAfterError, retries config
- `/drizzle-team/drizzle-orm` (Context7) — pgEnum, pgPolicy, enableRLS
- `https://www.w3.org/WAI/ARIA/apg/patterns/combobox/` — keyboard map + ARIA attribute requirements (verified via WebFetch)
- `src/contexts/catalog/infrastructure/db/schema.ts` — existing plants + photo_entries tables (VERIFIED: read in session)
- `src/contexts/identification/infrastructure/db/schema.ts:44` — `identifications.plant_id ON DELETE SET NULL` confirmed (VERIFIED: read in session)
- `src/contexts/catalog/infrastructure/photo-storage.ts` — compensating-delete, `__setStorageAdapterForTests` seam (VERIFIED: read in session)
- `src/app/sw.ts` — existing NetworkOnly `/api/*` + registerCapture pattern (VERIFIED: read in session)
- `package.json` — all existing deps + engines (VERIFIED: read in session)
- `vitest.config.ts` — 3-project test structure (VERIFIED: read in session)
- `playwright.config.ts` — webServer env, E2E test infrastructure (VERIFIED: read in session)
- npm registry — `@tanstack/react-query@5.100.6`, `idb-keyval@6.2.2`, `fake-indexeddb@6.2.5`, `inngest@4.2.6` (VERIFIED: npm view)

### Secondary (MEDIUM confidence)
- `.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md` — component compositions, UI surface list, a11y surface gates (CITED: read TOC + §1-§12)
- `tests/e2e/axe-placeholder-pages.spec.ts` — existing `@axe-core/playwright` usage pattern (VERIFIED: read in session)
- `tests/e2e/axe-modal-focus-trap.spec.ts` — existing focus-trap + return-focus test pattern (VERIFIED: read in session)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry and package.json
- Architecture: HIGH — all code anchors confirmed by reading source files; `identifications.plant_id ON DELETE SET NULL` verified at `schema.ts:44`; W3C APG Combobox attributes verified via WebFetch
- Pitfalls: HIGH — signed-URL cache collision and IDB hydration mismatch are well-documented TanStack + Serwist patterns; Inngest v3/v4 confirmed by package.json
- Test infrastructure: HIGH — vitest.config.ts projects read; existing axe-core + IDB patterns confirmed in test files

**Research date:** 2026-04-29
**Valid until:** 2026-05-29 (stable libraries; Inngest + TanStack update frequently — reverify in 30 days)

---

## RESEARCH COMPLETE
