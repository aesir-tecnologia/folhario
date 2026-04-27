---
phase: 5
reviewers: [codex]
reviewed_at: 2026-04-27T02:20:58Z
plans_reviewed:
  - 05-01-wave0-test-infra-PLAN.md
  - 05-02-pending-deletions-schema-cursor-PLAN.md
  - 05-03-catalog-repositories-PLAN.md
  - 05-04-domain-zod-schemas-PLAN.md
  - 05-05-plant-create-use-cases-PLAN.md
  - 05-06-plant-delete-inngest-cleanup-PLAN.md
  - 05-07-patch-photo-entry-cover-use-cases-PLAN.md
  - 05-08-route-handlers-read-create-PLAN.md
  - 05-09-route-handlers-mutate-delete-PLAN.md
  - 05-10-tq-provider-idb-persister-i18n-PLAN.md
  - 05-11-use-subscription-stub-PLAN.md
  - 05-12-combobox-primitive-PLAN.md
  - 05-13-bottom-sheet-primitive-PLAN.md
  - 05-14-lightbox-inline-edit-primitives-PLAN.md
  - 05-15-catalog-page-grid-sort-PLAN.md
  - 05-16-plant-profile-page-PLAN.md
  - 05-17-manual-add-photo-journal-pages-PLAN.md
  - 05-18-home-identify-serwist-offline-banners-PLAN.md
---

# Cross-AI Plan Review — Phase 5

## Codex Review

## Summary

The plans are unusually thorough and generally cover the Phase 5 goal end-to-end: backend catalog APIs, deletion cleanup, UI primitives, catalog/profile/manual-add/photo-journal screens, offline browse, and accessibility validation. The main issue is not missing scope, but **contract drift and execution risk** across 18 tightly coupled plans. Several plans assume upstream Phase 2/3/4 contracts that are not yet implemented, and later UI plans depend on response shapes, auth helpers, storage-path formats, and cache keys that are inconsistent across the plan set. As written, the plan set is directionally strong but high-risk unless normalized before execution.

## Strengths

- Strong requirement coverage: CAT-01 through CAT-11, UI-04/UI-07/UI-08/UI-11, and OFF-08 are all addressed.
- Good separation of concerns in intent: repositories, use cases, route handlers, hooks, and UI surfaces are mostly layered correctly.
- Excellent attention to security risks: storage-path spoofing, IDOR, mass assignment, post-commit cleanup failure, and no-Drizzle-in-routes are repeatedly called out.
- Offline architecture is sensible: TanStack Query persists JSON, Serwist caches images only, explicitly avoiding `/api/*`.
- UI/a11y work is planned seriously: combobox APG pattern, focus-trap use, axe scans, read-only variants, and live regions are included.
- The deletion outbox pattern is the right shape for avoiding orphaned storage.

## Concerns

### Cross-Plan

- **HIGH: Response-shape drift.** Plans alternate between `rows/nextCursor` and `data/next_cursor`, and between camelCase and snake_case fields (`coverPhotoUrl` vs `cover_photo_url`, `identificationCount` vs `identification_count`). This will break RSC prefetch, cache hydration, and UI hooks unless normalized.
- **HIGH: Argument-name drift.** `listPlants` is called with both `sort` and `sortKey`; some plans expect `plantIdFilter`; others assume route-only detail fetching.
- **HIGH: Phase 2/3/4 dependencies are treated as both blocking and stub-able.** Adding stubs for `requireUser`, Inngest, or auth/session can mask integration failures.
- **HIGH: Idempotency contract is unclear.** Route handlers wrap `idempotent(req, fn)`, but the helper likely needs authenticated `userId` for per-user scoping. If auth happens inside the callback, the helper may not be able to scope safely.
- **HIGH: Storage path format is under-specified.** Some examples use `{userId}/{plantId}/file`, others bucket-prefixed paths or `/path/photo.jpg`. This affects the load-bearing spoofing defense.
- **MEDIUM: Many E2E tests are authored but skipped until Phase 4.** That is acceptable for planning, but the phase should not be considered verified until they run unskipped.

### Plan-Specific

| Plan | Concern |
|---|---|
| 05-01 | Good bootstrap, but network-dependent `npm view` version resolution can block execution in restricted environments. |
| 05-02 | **HIGH:** `array_length(storage_paths, 1) > 0` does not reject empty arrays in Postgres because `array_length('{}', 1)` is `NULL`; use `cardinality(storage_paths) > 0` or `coalesce(...) > 0`. |
| 05-03 | Cursor pagination for nullable/acquired/name/location sorts is complex and under-specified; raw SQL/date serialization must be nailed down. |
| 05-04 | **HIGH:** drizzle-zod field names likely use Drizzle property names, not DB snake_case names. Schemas using `cover_photo_url`/`created_at` may not compile or may omit the wrong fields. |
| 05-05 | Create-from-identification invents a result JSON shape that may not match Phase 6. Also PostHog serverless flush behavior is not addressed. |
| 05-06 | Reconciler mentions `dispatched_at` in resolved Q2, but schema has no such column. This can cause repeated re-dispatch of the same pending job. |
| 05-07 | **HIGH:** `setCoverPhoto` may use raw SQL in the use-case layer, violating the repository-only data access rule. |
| 05-08 | Auth/domain error mapping may turn `requireUser` failures into 500s unless auth errors are explicitly mapped. |
| 05-09 | **HIGH:** Reusing `plant.deleted` for single PhotoEntry deletion is semantically dangerous for future subscribers/metrics. Use `storage.cleanup_requested` or `photo_entry.deleted`. |
| 05-10 | Single global IDB key `folhario:tq-cache` can persist multiple users’ data on shared devices. Needs logout/user-switch clearing or user-scoped persistence. |
| 05-11 | Fine as a stub; the “only status key” test will intentionally break Phase 10 when richer subscription data is added. |
| 05-12 | **HIGH:** Combobox calls `onChange` on every keystroke, but consumers treat `onChange` as commit. Plant Profile would PATCH location while typing. |
| 05-13 | Swipe-down dismissal is deferred even though the modal-sheet contract expects it. Either implement it or engage Vaul sooner. |
| 05-14 | InlineEditField should hide the pencil affordance when `disabled/readOnly`, not just disable the button. |
| 05-15 | RSC prefetch result shape likely mismatches `usePlants`; also `<style>` inside `<ul>` should be moved outside the list. |
| 05-16 | Plant detail cache is seeded from list data but UI expects detail snake_case fields and `identification_count`; likely broken without an adapter. |
| 05-17 | **HIGH:** Manual Add uses `anonymous-draft` because no client user id is available, violating per-user draft keys. Also optimistic cover update uses `thumbnailUrl` as `cover_photo_url`; server uses full `photo_url`. |
| 05-18 | Home route placement must resolve `src/app/page.tsx` vs `src/app/(home)/page.tsx`; both cannot define `/`. |

## Suggestions

- Add a single **API/data contract document** before execution: canonical field names, list/detail response shapes, cursor args, and hook cache keys.
- Normalize on one boundary convention:
  - DB/repo internals may be camelCase.
  - HTTP JSON should be snake_case or camelCase, but not both.
  - UI hooks should adapt once at the API layer.
- Fix `pending_storage_deletions` schema before execution:
  - Use `cardinality(storage_paths) > 0`.
  - Add `dispatched_at` or `locked_at` if the reconciler depends on dispatch state.
- Replace `plant.deleted` reuse for photo-entry cleanup with a storage-specific event.
- Require Phase 2/3/4 readiness instead of stubbing critical infra, especially auth, UoW, idempotency, and Inngest.
- Change Combobox API to separate typing from commit, e.g. `inputValue/onInputValueChange` plus `onCommit`.
- Make Manual Add receive the real `userId` from an auth/session provider or server wrapper before implementing draft persistence.
- Add a route/integration test strategy that uses the same transaction/UoW as the handler, or run against a disposable DB. Current in-process route tests may leak state.
- Move per-photo deletion cleanup decision into 05-07 instead of overriding it in 05-09.
- Add a user-cache lifecycle plan for TanStack persisted IDB data: clear on logout, account switch, token expiry, or consent revocation.

## Risk Assessment

**Overall risk: HIGH.**

The plan set is comprehensive and thoughtfully designed, but execution risk is high because many later plans depend on unstable or inconsistent contracts from earlier plans. The largest risks are data-shape drift, auth/idempotency assumptions, storage-path ambiguity, cursor correctness, and skipped E2E validation until upstream phases land. If the team first normalizes contracts and fixes the few load-bearing schema/event issues, the risk drops to medium.

---

## Consensus Summary

Only one external reviewer (Codex / `gpt-5-codex`) was invoked for this review (per `--codex` flag, with Claude skipped because the runtime is Claude Code itself). There is no cross-AI consensus, but Codex flagged a coherent set of HIGH-severity execution risks worth tracking before plan execution.

### Agreed Strengths

Single-reviewer pass — no cross-AI agreement, but Codex called out:

- Strong requirement coverage across CAT-01..11, UI-04/07/08/11, and OFF-08.
- Layered separation (repositories → use cases → route handlers → hooks → UI) is mostly correct in intent.
- Security risks (storage-path spoofing, IDOR, mass assignment, post-commit cleanup, no-Drizzle-in-routes) are repeatedly called out across plans.
- Offline architecture is sensible: TanStack Query persists JSON, Serwist caches images only, `/api/*` explicitly excluded from runtime cache.
- A11y work taken seriously: WAI-ARIA APG combobox, focus-trap usage, axe scans, read-only variants, live regions.
- Deletion outbox (`pending_storage_deletions`) is the right pattern for avoiding orphaned storage objects.

### Agreed Concerns

Single-reviewer pass — these are Codex's HIGH-severity concerns, ordered by load-bearing impact:

1. **Response-shape and field-name drift across plans** — alternation between `rows/nextCursor` ↔ `data/next_cursor` and `coverPhotoUrl` ↔ `cover_photo_url` ↔ `identificationCount` ↔ `identification_count`. Will break RSC prefetch, persisted cache hydration, and UI hooks unless normalized before execution.
2. **Argument-name drift** — `listPlants` is called with both `sort` and `sortKey`; `plantIdFilter` is assumed by some plans and not by others; some plans assume route-only detail fetching.
3. **Schema bug in 05-02** — `array_length(storage_paths, 1) > 0` returns `NULL` for empty arrays in Postgres, defeating the non-empty CHECK constraint. Use `cardinality(storage_paths) > 0`.
4. **Reconciler references missing `dispatched_at` column** (05-06) — can cause repeated re-dispatch of the same pending job.
5. **`plant.deleted` event reused for single PhotoEntry deletion** (05-09) — semantically dangerous for future subscribers and metrics. Should be `storage.cleanup_requested` or `photo_entry.deleted`.
6. **Combobox commit semantics** (05-12) — `onChange` fires on every keystroke, but Plant Profile consumers treat `onChange` as commit, which would PATCH location while typing.
7. **Manual Add `anonymous-draft` key** (05-17) — falls back when no client user id is available, violating per-user draft-key isolation. Optimistic cover update also uses `thumbnailUrl` where the server stores `photo_url`.
8. **Persisted IDB cache key `folhario:tq-cache` is global** (05-10) — persists across users on shared devices; needs clearing on logout / user-switch / consent revocation.
9. **Phase 2/3/4 dependencies are stub-able and blocking simultaneously** — stubbing `requireUser`, Inngest, or auth/session can mask integration failures.
10. **Idempotency helper scoping** — `idempotent(req, fn)` likely needs authenticated `userId` for per-user scoping; if auth happens inside the callback, scoping cannot be enforced safely.
11. **Storage path format under-specified** — alternates between `{userId}/{plantId}/file`, bucket-prefixed, and `/path/photo.jpg`. Affects the load-bearing path-spoofing defense.
12. **Home route placement collision** (05-18) — `src/app/page.tsx` vs `src/app/(home)/page.tsx` cannot both define `/`.

### Divergent Views

N/A — single reviewer.
