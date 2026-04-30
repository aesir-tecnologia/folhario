# Phase 5: Catalog — Meu Jardim - Discussion Log (Power Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `05-CONTEXT.md` — this log preserves the discussion mechanics.

**Date:** 2026-04-29
**Phase:** 05-catalog-meu-jardim
**Mode:** power (file-based question UI)
**Sections:** 10 (manual-add-ux, plant-profile-edits, location-picker, catalog-grid-sort, photo-journal, client-cache, offline-sw, async-cleanup, test-infra, telemetry)
**Total questions:** 29
**Final answer state:** 29/29 answered, 29/29 chat-more (every question received supplemental nuance)

## Process Notes

- All questions generated upfront into `05-QUESTIONS.json` + companion `05-QUESTIONS.html` self-contained file
- User answered offline in the HTML companion, saved JSON, returned for `refresh`
- First refresh: 28/29 answered, 1 remaining (Q-04 originally option "d" Other with empty `answer_other`; nuance lived in chat-more)
- Resolution: user chose option (1) — switch Q-04 to option (a) and let the chat-more text bind as the refinement (tightened summary-block threshold from 3+ to 2+ errors)
- `finalize` triggered CONTEXT.md + this log + checkpoint cleanup

## Section: Manual Plant Add — UX & Sequencing

### Q-01: Manual add page flow
- **Picked:** (a) Single screen — name + photo picker + optional fields all inline
- **Chat-more:** "Use the single-screen flow because it is fastest for a beginner and keeps optional fields discoverable without turning manual add into a wizard. Treat the upload-on-selection detail as overridden by Q-02: show a local preview immediately, then submit photo + fields together."

### Q-02: Photo + Plant atomicity strategy
- **Picked:** (c) Single multipart POST `/plants` accepting photo + form fields atomically
- **Chat-more:** "A single multipart create is the cleanest fit for the PRD requirement that name + photo succeed together and missing fields persist no row. It avoids draft-photo orphan cleanup and still allows compensating storage delete if the DB transaction fails."
- **Note:** Supersedes the "upload-on-selection" wording in Q-01 option text — local preview only until submit.

### Q-03: Cover photo policy
- **Picked:** (a) Auto-tracks first PhotoEntry; auto-promote next-oldest on deletion
- **Chat-more:** "For MVP, keep cover behavior automatic. First photo as cover with next-oldest promotion on deletion is predictable, removes a secondary control from the profile UI, and can evolve later if users ask to choose the hero photo."

### Q-04: validation_failed UX for missing name or photo
- **Original answer:** (d) Other — empty `answer_other`, intent in chat-more
- **Final answer (post-refresh):** (a) Inline + summary block, with chat-more refinement threshold lowered from 3+ to 2+ errors
- **Chat-more:** "Use inline field errors plus auto-focus/role=alert for every invalid field, and show the summary block when there are 2+ errors. That keeps the common one-error case calm while matching the PRD's multi-error summary requirement for missing name + photo."
- **Resolution:** User chose option (1) when reviewing Q-04 — keep option (a) with chat-more as binding refinement.

## Section: Plant Profile — Inline Edits & Delete

### Q-05: Inline edit save trigger
- **Picked:** (a) Tap-to-edit field → save on blur (or Enter for single-line); cancel on Esc
- **Chat-more:** "Save-on-blur matches the product rule exactly and keeps inline editing lightweight on mobile. Keep Enter for single-line fields, Esc to revert, and make failures roll back the optimistic value with one clear toast."

### Q-06: Inline-edit conflict resolution (cross-device)
- **Picked:** (a) Optimistic update + LWW; no client-side conflict detection
- **Chat-more:** "The PRD explicitly calls for server timestamp last-write-wins and no merge UI. Let the optimistic client value be temporary, then replace the cache with the server row so cross-device edits converge without extra conflict surfaces."

### Q-07: Plant delete confirm pattern
- **Picked:** (a) Bottom-sheet confirm with cascade preview + destructive Excluir button
- **Chat-more:** "The bottom-sheet confirmation matches mobile ergonomics and the established destructive-action pattern. Showing cascade counts gives the user useful consequence clarity without adding the heavy type-the-name flow reserved for account deletion."

## Section: Location Picker — Combobox & Suggestion Storage

### Q-08: Combobox primitive — build vs adopt
- **Picked:** (a) Roll our own (~200 LOC) headless, APG 1.2 compliant
- **Chat-more:** "Build the small headless combobox because the surface is narrow, Radix has no native primitive, and adding a large dependency for one field is not justified. Make APG keyboard behavior and axe coverage non-negotiable so accessibility is proven, not assumed."

### Q-09: location_suggestions storage model
- **Picked:** (a) Separate table — `location_suggestions(user_id, label_normalized, label_display, usage_count, last_used_at)`
- **Chat-more:** "A separate suggestions table preserves user-entered locations even after plant deletion and supports ordering by real reuse rather than incidental plant recency. It also gives offline caching a stable, small query surface."

### Q-10: Default-locations source
- **Picked:** (a) next-intl messages — `catalog.locations.defaults` as a string array
- **Chat-more:** "Keep default labels in next-intl messages so the pt-BR-only launch still follows the no-hardcoded-strings rule. There is no reason to seed per-user rows for static defaults that are not user-owned data."

## Section: Catalog Grid — Sort, Pagination, Empty State

### Q-11: Sort persistence storage
- **Picked:** (a) sessionStorage — clears on tab close
- **Chat-more:** "sessionStorage is the literal reading of 'persists for session' and matches the existing Phase 3 browser-state pattern. Server or localStorage persistence would overstate the importance of an MVP sort preference."

### Q-12: Catalog list query — pagination strategy
- **Picked:** (c) Cursor + first-page total count for grid affordance
- **Chat-more:** "Use the opaque cursor shape from option a, but include total_count on the first page or behind include_count=1. The count supports the catalog header and empty/grid switch while keeping subsequent cursor pages light."
- **Note:** Hybrid of (a) cursor shape + (c) count — captured in CONTEXT D-12.

### Q-13: Empty-state vs grid switch
- **Picked:** (a) Server-render: read total count → render `<CatalogEmpty/>` or `<CatalogGrid/>`
- **Chat-more:** "Server-rendering the first page avoids a skeleton flash in the exact first-plant transition this phase cares about. Hydrating TanStack Query from that data keeps later pagination and invalidation on the client without duplicating the initial fetch."

## Section: Photo Journal — Lightbox & Add-Entry Flow

### Q-14: Lightbox primitive — build vs adopt
- **Picked:** (a) Roll our own (~150 LOC) — full-screen overlay over Radix Dialog
- **Chat-more:** "A Radix Dialog-backed overlay gives the required focus trap, return focus, Esc dismiss, and visible close affordance while allowing a real full-screen photo experience. A bottom sheet is too constrained for inspecting plant photos."

### Q-15: Photo journal add-entry flow
- **Picked:** (a) Bottom-sheet from journal — picker → preview + note textarea → 'Adicionar'
- **Chat-more:** "The sheet flow keeps the journal page stable while giving preview, note, progress, retry, and cancel in one contained place. Reusing the existing upload route with the note in the same multipart call avoids unnecessary two-step client state."

## Section: Client State — TanStack Query + IndexedDB Persistence

### Q-16: TanStack Query persister choice
- **Picked:** (a) `@tanstack/query-async-storage-persister` + `idb-keyval`
- **Chat-more:** "The async persister plus idb-keyval is the right fit for a photo-heavy PWA cache because it avoids localStorage limits and main-thread blocking. It is also the standard TanStack path, so maintenance risk stays low."

### Q-17: What gets persisted to IDB
- **Picked:** (c) Persist catalog + journal + locations; explicit dehydrate filter; storage budget watched via `navigator.storage.estimate`
- **Chat-more:** "Persist catalog, plant detail, journal, and locations with an explicit allowlist. Locations are part of the catalog experience, and adding a quota guard is cheap insurance for long-lived PWA installs where photo-heavy metadata can accumulate."
- **Note:** Choice (c) extends option (a)'s allowlist with `locations` + the quota guard.

### Q-18: Query keys + invalidation pattern
- **Picked:** (a) Query factory pattern (Tkdodo-style) — `createPlantsQuery`, `createPlantQuery` factories
- **Chat-more:** "Centralized query factories prevent key drift once list, detail, journal, locations, and later identification-history queries start invalidating each other. This is worth the small upfront structure because mutations in this phase touch multiple cached surfaces."

## Section: Offline & Service Worker — Catalog Cache Strategy

### Q-19: Serwist runtime cache strategy for catalog GETs
- **Picked:** (a) StaleWhileRevalidate for whitelisted GETs; max age 7d
- **Chat-more:** "StaleWhileRevalidate gives the offline-browse behavior users expect from a PWA while still refreshing in the background when online. Keep the whitelist tight to catalog GETs so mutations and identification remain network-only."

### Q-20: Photo URL strategy for offline thumbnails
- **Picked:** (a) Bump signed-URL TTL to 24h for catalog views; cache bytes in SW
- **Chat-more:** "A 24h signed URL is a pragmatic middle ground: it improves warm-cache reliability without making thumbnails public. The service worker byte cache can still serve already-fetched images offline, while online refreshes mint fresh URLs."

### Q-21: Read-only mode UX in catalog (`useSubscription` stub)
- **Picked:** (a) `useSubscription()` returns `{active, readOnly}`; mutating affordances hidden when `readOnly`
- **Chat-more:** "Read-only mode should remove or disable mutation affordances before the user hits them, matching the PRD and avoiding paywall-like dead ends. The stubbed hook gives Phase 5 a clean test seam until Stripe state exists."

## Section: Async Cleanup — Inngest catalog/cleanup-storage

### Q-22: Storage cleanup trigger after plant delete
- **Picked:** (a) Same-TX `pending_storage_deletions` insert + emit `plant.deleted` event
- **Chat-more:** "The pending table plus event gives durable recovery for both storage failures and event-delivery gaps. It is the right level of operational bookkeeping for data deletion work, especially with later LGPD sweeps reusing the pattern."

### Q-23: pending_storage_deletions schema shape
- **Picked:** (a) `id, user_id, bucket, prefix, status, attempts, last_error, scheduled_at, created_at, completed_at` — owner-RLS, no `plant_id` FK
- **Chat-more:** "Keep the schema focused on the sweep itself: user, bucket, prefix, status, attempts, errors, and timestamps. The prefix already carries the deleted plant scope, and a plant FK would be fragile once the plant row is gone."

### Q-24: Reconciler cron schedule + max attempts
- **Picked:** (a) Hourly cron, batch 50, max 5 attempts with exponential backoff (5min/30min/4h/24h/72h)
- **Chat-more:** "Hourly reconciliation is fast enough for cleanup that is invisible to the user and conservative on function-run budget. Five attempts with widening backoff covers transient outages while producing a clear failed state for ops alerts."

## Section: Wave 0 Test Infrastructure

### Q-25: fake-indexeddb scope
- **Picked:** (a) Vitest unit setup only; Playwright uses real Chromium IDB
- **Chat-more:** "Use fake-indexeddb only for Vitest/jsdom where the browser API is missing. Playwright should exercise real Chromium storage so offline and persistence specs validate the actual runtime behavior."

### Q-26: Playwright auth-bypass fixture
- **Picked:** (a) `authedUser` fixture: `admin.createUser` + verified User + trialing Subscription, inject session cookies
- **Chat-more:** "A dedicated authedUser fixture keeps Phase 5 feature specs isolated and fast without repeating the Phase 4 auth journey. Real signup/login coverage belongs in Phase 4; catalog specs should start from a verified, trialing user state."

### Q-27: Storage cleanup pattern for integration tests
- **Picked:** (a) In-memory `StorageAdapter` via `__setStorageAdapterForTests`
- **Chat-more:** "The in-memory adapter keeps integration tests hermetic because DB rollback cannot clean real storage. Test the Supabase storage adapter separately, and let catalog integration tests focus on use-case behavior without external bucket flakes."

## Section: Telemetry — PostHog Events

### Q-28: plant_added event properties
- **Picked:** (a) `{ source: 'manual', has_nickname, has_location, has_acquisition_date, has_notes, photo_count }`
- **Chat-more:** "These properties measure optional-field engagement without sending plant names, locations, notes, or plant IDs to PostHog. Keeping source prepares the same event for Phase 6 identification-created plants."

### Q-29: Inline-edit + delete telemetry depth
- **Picked:** (a) Single `plant_edited` event with `field` property + `plant_deleted` event
- **Chat-more:** "Two privacy-clean events are enough to answer whether users maintain and prune their gardens after adding plants. Use the schema field name acquisition_date rather than ack_date in the implementation to avoid telemetry drift."
- **Note:** Implementation must use `acquisition_date` (schema field name) NOT `ack_date` (option text shorthand) — captured in CONTEXT D-29.

## Deferred Ideas (during discussion)

None surfaced — the question set was scoped to Phase 5; no scope-creep redirections triggered.

## Resolved Question (Q-04)

After first `refresh`, Q-04 was the only unanswered question (option "d" Other with empty `answer_other` field; intent lived in chat-more). User chose option (1) — switch to option (a) and bind chat-more text as the refinement. Effect: validation summary-block threshold tightened from option (a)'s default 3+ errors to user's preferred 2+ errors. Captured in CONTEXT D-04.

---

*This log is for human reference (audits, retrospectives) and is NOT consumed by downstream agents.*
