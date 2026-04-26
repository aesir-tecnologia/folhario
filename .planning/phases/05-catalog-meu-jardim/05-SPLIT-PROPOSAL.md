# Phase 5 Split Proposal

**Decided:** 2026-04-26
**Decided by:** User (via /gsd:plan-phase split prompt)
**Reason:** Phase 5 covers 16 requirement IDs spanning data layer, API surface, async storage cleanup, hand-rolled UI primitives, 5 page surfaces, TQ + IDB persister + Serwist runtime cache, and read-only-mode variants. Under TDD mode + `<deep_work_rules>` + per-plan threat models, honest plan count is ~18 plans, exceeding what one planning unit can produce at full fidelity.

---

## Sub-phase 5.1 — `catalog-data-api`

**Goal:** Catalog domain + storage path ownership defense, all `/api/v1/plants*` mutating + read endpoints with idempotency + cursor pagination, atomic plant DELETE with transactional outbox + Inngest `catalog/cleanup-storage` consumer + reconciler cron — producing the verifiable backend surface that 5.2 will skin.

**Requirement IDs covered:** CAT-01, CAT-02, CAT-03 (server-side validation), CAT-04 (data model), CAT-05 (server-side `location-suggestions` query), CAT-07, CAT-09, OFF-08 (server-side cache headers).

**Estimated plans:** 9

**Plan outline (proposed by planner):**

| Plan | Purpose | TDD? |
|------|---------|------|
| 05.1-01 | Wave 0 test infra (axe-core, fake-indexeddb, transaction-rollback fixture, test directories + Playwright auth-bypass fixture) | no |
| 05.1-02 | `pending_storage_deletions` schema + cursor extension (resolves Open Q1: extend Phase 2 D-36 to encode sort key + value); [BLOCKING] `npx drizzle-kit push` | TDD (encoder/decoder) |
| 05.1-03 | Catalog repositories (`plants`, `photo-entries`, `pending-storage-deletions`, `location-suggestions`) | TDD |
| 05.1-04 | Domain Zod schemas + `validateStoragePathOwnership` helper (Pitfall 1 / T-5-02 mitigation) | TDD |
| 05.1-05 | Plant create use cases — `createPlantManual` + `createPlantFromIdentification` (CAT-01, CAT-02); resolves Open Q6 (PostHog `plant_added` payload `{ source, has_species }`) | TDD |
| 05.1-06 | Plant delete use case + Inngest `catalog/cleanup-storage` + reconciler cron (CAT-09, T-5-03); resolves Open Q2 (own reconciler locally, defensive) | TDD |
| 05.1-07 | PATCH/PhotoEntry/cover use cases (`updatePlant`, `addPhotoEntry`, `updatePhotoEntryNote`, `deletePhotoEntry`, `setCoverPhoto`, `listPlants`, `listPhotoEntries`) | TDD |
| 05.1-08 | Route handlers — read + Plant create (5 endpoints, paired by domain) | TDD |
| 05.1-09 | Route handlers — mutate + delete (6 endpoints) | TDD |

**Open Questions resolved in 5.1:** Q1 (cursor extension — 05.1-02), Q2 (reconciler placement — 05.1-06), Q6 (PostHog payload — 05.1-05).

**[BLOCKING] gates in 5.1:** `npx drizzle-kit push` after `pending_storage_deletions` table creation (05.1-02).

**Threat model coverage in 5.1:** T-5-01 photo URL spoofing (04+05+08), T-5-02 IDOR (every route + repo), T-5-03 storage object leak after delete (05.1-06), mass-assignment on PATCH (07+09), idempotency replay (08+09).

**Upstream dependencies (BLOCKING execution):** Phase 2 wave 2-7 (schema-registry, migration tooling, db client, UoW, idempotency helper, AuthAdapter, photo upload route, StorageAdapter), Phase 4 (Inngest client at `@shared/events/inngest-client` — verify before 05.1-06 execution; if absent, plan a defensive stub).

---

## Sub-phase 5.2 — `catalog-ui-offline`

**Goal:** All catalog UI surfaces (Catalog grid, Plant Profile, Manual Add, Photo Journal, Home empty, /identify placeholder), 4 hand-rolled UI primitives (combobox, bottom-sheet, lightbox, inline-edit-field), TQ provider + IDB persister, Serwist runtime cache for catalog images, offline banner, `useSubscription` stub + read-only mode UI variants — producing the user-visible "Meu Jardim" surface that consumes the 5.1 backend.

**Requirement IDs covered:** CAT-03 (form-level UX), CAT-04 (UI rendering), CAT-05 (combobox UI), CAT-06 (photo journal UI), CAT-08 (sort UI + sessionStorage), CAT-10 (responsive grid), CAT-11 (empty state), OFF-08 (offline browse + persister + Serwist + banner), UI-04 (Home empty), UI-07 (catalog card), UI-08 (Plant Profile + inline edit), UI-11 (photo journal screen + lightbox).

**Estimated plans:** 9

**Plan outline (proposed by planner):**

| Plan | Purpose | TDD? |
|------|---------|------|
| 05.2-01 | TQ provider + IDB persister + i18n catalog message file; resolves Open Q3 (`useSubscription` location) | TDD (idb-persister) |
| 05.2-02 | `useSubscription()` stub at `src/contexts/billing/api/use-subscription.ts` (per Q3 resolution) + read-only mode test harness | TDD |
| 05.2-03 | Combobox primitive per WAI-ARIA APG 1.2 list-autocomplete; resolves Open Q4 (combobox "Outro" literal value) | TDD (filter logic + dedupe case-insensitive) |
| 05.2-04 | Bottom-sheet primitive [BLOCKING axe + VoiceOver/TalkBack gate]; resolves Open Q5 (hand-roll first; Vaul 1.1.2 fallback if Wave 0 a11y fails) | no (UI primitive); axe-core gate |
| 05.2-05 | Lightbox + InlineEditField primitives (D-11/D-12/D-17/UI-11) | TDD (lightbox keyboard + focus trap, inline-edit save-on-blur debounce) |
| 05.2-06 | Catalog page + sort + infinite scroll + responsive grid (CAT-04, CAT-07, CAT-08, CAT-10, CAT-11, UI-07) | TDD (sort sessionStorage, useSortPreference) |
| 05.2-07 | Plant Profile page (D-10 single-scroll, inline edits wired to PATCH, care-card slot hidden, photo journal preview, ID-history conditional, delete overflow) | no (composition) |
| 05.2-08 | Manual Add page + Photo Journal page (CAT-02, CAT-03, CAT-06, UI-11) | no (composition) |
| 05.2-09 | Home empty + /identify placeholder + Serwist runtime cache + offline banner + read-only banner stub (OFF-08, UI-04) | no (composition) |

**Open Questions resolved in 5.2:** Q3 (`useSubscription` location — 05.2-01), Q4 (combobox "Outro" — 05.2-03), Q5 (bottom-sheet hand-roll vs Vaul + axe gate — 05.2-04).

**[BLOCKING] gates in 5.2:** axe + VoiceOver/TalkBack smoke for bottom-sheet (05.2-04). Vaul fallback if it fails — API surface intentionally Vaul-shaped to make swap a one-line import change.

**Threat model coverage in 5.2:** XSS via plant name/nickname/notes (07+08 — React JSX escaping + 80/2000 char caps), Sentry breadcrumb leak on image URLs (06+07 — confirm `photo_url` scrub coverage), Serwist double-cache pitfall (09 — explicit no-/api/* rule). Most plans declare `<threat_model>none</threat_model>` with rationale (frontend composition only).

**Upstream dependencies (BLOCKING execution):** All of 5.1's surface (specifically 05.1-08 + 05.1-09 routes for any UI plan), Phase 3 design tokens (`--scrim`, `--surface`, `--canopy`, `--calm-slate`, `--overdue` CSS custom properties + bottom nav + app shell).

---

## Why this seam (data ↔ UI) is right

1. 5.1 is verifiable end-to-end via curl/Vitest integration without any UI.
2. 5.2 is implementable purely from 5.1's HTTP contract — does not need to read 5.1's repository internals.
3. Wave 0 test infra (axe-core + fake-indexeddb + transaction-rollback fixture) lives in 5.1; 5.2 inherits.
4. Open Question resolutions distribute cleanly — Q1/Q2/Q6 are server-side (5.1), Q3/Q4/Q5 are client-side (5.2).
5. The [BLOCKING] schema push (Drizzle) lands in 5.1 where the table is created.
6. The [BLOCKING] axe + VoiceOver/TalkBack bottom-sheet gate lands in 5.2 where the primitive is hand-rolled.
7. Each sub-phase respects the executor context budget per plan while every requirement ID is covered.
8. Read-only-mode variants ship in 5.2 behind 5.1-independent stub.

---

## Shared artifacts (already produced; do NOT regenerate)

These artifacts are valid for both 5.1 and 5.2 — both sub-phases should `<files_to_read>` the originals:

- `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` — 27/27 power-mode answers covering both halves
- `.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md` — Patterns 1-10, Common Pitfalls 1-10, Validation Architecture (per requirement → test map), Security Domain
- `.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md` — 30 files mapped, 9 on-disk anchors, cross-phase sequencing notes
- `.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md` — UI design contract (most relevant to 5.2)
- `.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md` — pre-seeded per-task verification map (planner fills task IDs as plans land)

---

## Recommended next actions

1. **Insert decimal Phase 5.1:** `/gsd:insert-phase 5 catalog-data-api` (replaces or follows Phase 5 — your call; recommend "follows Phase 5 with Phase 5 marked as umbrella + scope replaced by 5.1+5.2")
2. **Insert decimal Phase 5.2:** `/gsd:insert-phase 5.1 catalog-ui-offline`
3. **Distribute requirement IDs in ROADMAP.md** between 5.1 and 5.2 per the tables above
4. **Plan 5.1 first:** `/gsd:plan-phase 5.1 --skip-research` — RESEARCH.md from Phase 5 is referenced via `<files_to_read>` (no need to re-research)
5. **After 5.1 SUMMARY.md exists:** `/gsd:plan-phase 5.2 --skip-research`

If `/gsd:insert-phase` doesn't fit the umbrella-replacement use case cleanly, the alternative (less invasive to ROADMAP) is to:
- Keep Phase 5 as one phase in ROADMAP
- Plan 5.1's 9 plans now as `05-01-*-PLAN.md` ... `05-09-*-PLAN.md` in `.planning/phases/05-catalog-meu-jardim/`
- Plan 5.2's 9 plans later as `05-10-*-PLAN.md` ... `05-18-*-PLAN.md` in the same directory
- Use wave numbering to enforce sequencing (waves 0-3 = 5.1; waves 4-7 = 5.2)
- Trade-off: ROADMAP doesn't reflect the split, but no risky ROADMAP renumbering required

The split is durable in this proposal regardless of which path you take.
