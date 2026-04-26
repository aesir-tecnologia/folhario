# Phase 5: Catalog — Meu Jardim - Discussion Log (Power Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in `05-CONTEXT.md` — this log preserves the full Q&A trail.

**Date:** 2026-04-26
**Phase:** 05-catalog-meu-jardim
**Mode:** power (file-based bulk question generation)
**Total questions:** 27 across 12 sections
**Answered:** 27 / 27 (all with rationale notes)
**Source files:**
- `.planning/phases/05-catalog-meu-jardim/05-QUESTIONS.json` (state)
- `.planning/phases/05-catalog-meu-jardim/05-QUESTIONS.html` (companion UI)

## Section: Data Model & Cascade

### Q-01 — Plant.location storage
- **Selected:** `a` — Denormalized text on Plant + DISTINCT query
- **Rationale:** Matches PRD §4 schema verbatim. Simplest. Mitigation for "Sala" vs "sala" collisions: trim + lowercase compare on write while preserving display case.
- **Mapped to:** D-01

### Q-02 — Cover photo source
- **Selected:** `b` — Explicit `Plant.cover_photo_url`, defaults to first PhotoEntry, "Set as cover" overwrites
- **Rationale:** Matches PRD §4 schema; flexible without schema change. Couples with Q-18(c) "Set as cover" affordance.
- **Mapped to:** D-02

### Q-03 — Cascade mechanism on plant deletion
- **Selected:** `a` — DB-level FK actions (PhotoEntry/Reminder CASCADE; Identification SET NULL)
- **Rationale:** Phase 2 D-07 already commits to FK actions. Single SQL DELETE atomically cascades. Storage object deletion handled separately via Q-04.
- **Mapped to:** D-03

### Q-04 — Storage object deletion timing
- **Selected:** `b` — Inngest event `catalog.plant.deleted` → background sweep function
- **Rationale:** Phase 4 brings Inngest online. Durable retries handle Storage transient failures. Repository emits the event with pre-collected paths so the row is gone before the function runs.
- **Mapped to:** D-04

## Section: Data Fetching & State Management

### Q-05 — Server-state library
- **Selected:** `a` — TanStack Query (React Query)
- **Rationale:** Pairs with Q-06(a) cursor pagination, Q-07(d) hybrid optimism, Q-20(d) IndexedDB persister, Q-27 form drafts. Sets the project pattern for Phases 6-10.
- **Mapped to:** D-05

### Q-06 — Pagination strategy for Catalog list
- **Selected:** `a` — Cursor-paginated infinite scroll
- **Rationale:** Honors PRD §5 + Phase 2 D-36. `useInfiniteQuery` from TanStack Query is the standard pattern.
- **Mapped to:** D-06

### Q-07 — Optimistic UI for mutations
- **Selected:** `d` — Hybrid: optimistic for in-place edits (sort/inline-edit), pessimistic for create/delete
- **Rationale:** Sort/inline-edit feel instant; create/delete show skeleton or button-loading. Matches user intuition (edits cheap, structural changes commit-y) and minimizes rollback complexity.
- **Mapped to:** D-07

## Section: Catalog Grid

### Q-08 — Sort persistence storage
- **Selected:** `a` — sessionStorage keyed by `user_id`
- **Rationale:** Matches PRD literal "persists for the session". Simplest. If users complain about reload-resets later, swap to localStorage.
- **Mapped to:** D-08

### Q-09 — CAT-08 sort scope clarification
- **Selected:** `a` — Sort applies to Catalog only; Photo Journal stays fixed reverse-chronological
- **Rationale:** Cleanest reading. Photo Journal stays fixed reverse-chrono per CAT-06 wording. SC-4 sentence is two facts in one breath: journal is reverse-chrono AND catalog has a sort control.
- **Mapped to:** D-09

## Section: Plant Profile

### Q-10 — Profile layout pattern
- **Selected:** `a` — Single-scroll long page
- **Rationale:** Mobile-native, no hidden state. PRD §16 reads as a vertical stack. Tabs/collapsibles add navigation overhead conflicting with §17 unhurried atmosphere.
- **Mapped to:** D-10

### Q-11 — Inline edit pattern
- **Selected:** `b` — Click-to-edit per field (text → input on tap, blur to save)
- **Rationale:** Read mode stays calm (matches §17 atmosphere); subtle pencil affordance on tap. Lighter than full edit mode, more discoverable than modal sheets.
- **Mapped to:** D-11

### Q-12 — Save pattern for inline edits
- **Selected:** `a` — Save on blur
- **Rationale:** Matches PRD §17 "Validate on BLUR, not keystroke". Single round-trip per field. Pairs with Q-11(b) click-to-edit.
- **Mapped to:** D-12

## Section: Manual Add Plant

### Q-13 — Manual-add UI surface
- **Selected:** `a` — Full-screen route `/catalog/new`
- **Rationale:** Page-y form for 5 fields. Bookmarkable. Browser back. Simpler than a near-full-height bottom sheet on small viewports.
- **Mapped to:** D-13

### Q-14 — Manual-add entry points
- **Selected:** `a` — Home empty CTA + Catalog header "+" button (top-right)
- **Rationale:** Empty CTA on Home + discreet "+" in Catalog header for non-empty state. Avoids floating elements (§17 atmosphere). Standard mobile pattern.
- **Mapped to:** D-14

## Section: Location Picker (CAT-05)

### Q-15 — Location picker UI pattern
- **Selected:** `a` — Combobox: text input with dropdown showing prior + defaults; free text on Enter/blur
- **Rationale:** Single control, fast. Type-to-filter the merged list. Custom combobox component matches §17 input geometry. Ships once, reused for any future picker.
- **Mapped to:** D-15

## Section: Photo Journal (CAT-06, UI-11)

### Q-16 — Add-entry UI surface
- **Selected:** `a` — Bottom sheet modal from Plant Profile (per §17 modal sheet)
- **Rationale:** Matches §17 modal sheet specs. Quick "I just took a photo, drop it in" flow. Photo + note in one focused sheet.
- **Mapped to:** D-16

### Q-17 — Tap-on-entry behavior
- **Selected:** `c` — Lightbox + edit button overlay
- **Rationale:** Best of lightbox immersion + edit affordances. Pairs with Q-18(c) by exposing per-entry actions in the lightbox bottom strip.
- **Mapped to:** D-17

### Q-18 — Per-PhotoEntry actions
- **Selected:** `c` — Delete + edit note + "Set as cover"
- **Rationale:** Full power. Couples with Q-02(b) explicit cover. Low marginal cost given the lightbox surface from Q-17(c).
- **Mapped to:** D-18

## Section: Plant Deletion (CAT-09)

### Q-19 — Confirmation pattern
- **Selected:** `a` — Standard §17 destructive modal with "Cancelar" primary + "Excluir" destructive secondary
- **Rationale:** Matches §17 destructive button rules exactly. Calm, on-brand. PRD §17 explicitly bans dark patterns on delete flows — text-typed confirms feel corporate-harsh for a personal plant.
- **Mapped to:** D-19

## Section: Offline Browse (OFF-08)

### Q-20 — Offline cache strategy
- **Selected:** `d` — Hybrid: TanStack Query persister to IndexedDB (JSON) + Serwist runtime cache (images)
- **Rationale:** Couples with Q-05(a). Two-layer split, each tool doing what it does best: TQ persister for plants list + profile JSON, Service Worker for cover/thumbnail images. Most robust.
- **Mapped to:** D-20

### Q-21 — Cache scope
- **Selected:** `b` — Plants list + every previously-visited plant profile + photo journal preview
- **Rationale:** Matches "previously-loaded" literally. Per-plant lazy hydration. Doesn't blow cache quota for users with many plants. Pinch-zoom on photo-journal originals deferred.
- **Mapped to:** D-21

## Section: API Endpoint Shapes

### Q-22 — Plant create endpoint shape
- **Selected:** `a` — Two-step: client uploads photo via Phase 2's `/api/v1/photos/upload` then `POST /api/v1/plants` with photo refs
- **Rationale:** Reuses Phase 2 D-27 pipeline. Consistent with Q-23. Idempotency-Key on `/plants` makes Plant create replay-safe; photo upload is its own idempotent op.
- **Mapped to:** D-22

### Q-23 — PhotoEntry add endpoint shape
- **Selected:** `a` — Two-step: `/api/v1/photos/upload` → `POST /api/v1/plants/:id/photos`
- **Rationale:** Mirrors Q-22(a). Nested resource path is RESTful, ownership-clear. Reuses upload pipeline.
- **Mapped to:** D-23

## Section: Cross-Phase Coupling

### Q-24 — Read-only mode handling in Phase 5
- **Selected:** `a` — Build all read-only branches now using a stubbed `useSubscription()` hook (always returns `'trialing'`)
- **Rationale:** All UI variants ship in Phase 5; Phase 10 swaps the hook implementation. Zero retrofit cost. The variants are small (hidden Add button, hidden edit affordances, banner stub).
- **Mapped to:** D-24

### Q-25 — Camera button → Phase 6 placeholder
- **Selected:** `a` — Route exists at `/identify` showing a §17 empty-state composition placeholder
- **Rationale:** Calm, on-brand placeholder using §17 empty-state composition (Sage line art + Source Serif headline + single Canopy CTA back to Catalog). Phase 6 replaces the page wholesale.
- **Mapped to:** D-25

### Q-26 — ID history link placeholder
- **Selected:** `a` — Hidden when zero Identifications (matches PRD §16 "if applicable")
- **Rationale:** Matches PRD §16 literally. Zero placeholder UI. When Phase 6 lands and creates Identifications, the link appears automatically.
- **Mapped to:** D-26

## Section: Form Draft Persistence

### Q-27 — Form draft persistence (per UI design system mandate)
- **Selected:** `a` — Auto-save manual-add form draft to sessionStorage on every change; clear on success
- **Rationale:** Manual-add (5 fields) is the only Phase 5 form clearly above the >3 threshold. sessionStorage is the simplest mandate-compliant choice. Inline edits are single-field saves so don't need draft state.
- **Mapped to:** D-27

---

## Cross-question coupling summary

The following decisions reinforce each other and should be implemented together:

1. **TanStack Query stack** — Q-05 + Q-06 + Q-07 + Q-20 (TQ + cursor + hybrid optimism + IDB persister)
2. **Cover photo flexibility** — Q-02 + Q-18 (explicit `cover_photo_url` + "Set as cover" lightbox action)
3. **Two-step upload pattern** — Q-22 + Q-23 (Plant create + PhotoEntry add both reuse Phase 2's `/api/v1/photos/upload`)
4. **Cascade pipeline** — Q-03 + Q-04 (DB FK actions for atomic row delete; Inngest async for Storage object delete)
5. **Calm read-mode profile** — Q-10 + Q-11 + Q-12 (single-scroll + click-to-edit + save-on-blur)

## Power mode artifacts

- `05-QUESTIONS.json` — answered state, kept for audit
- `05-QUESTIONS.html` — answered state visible (every card highlighted green)
