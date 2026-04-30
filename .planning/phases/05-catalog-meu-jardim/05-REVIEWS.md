---
phase: 5
reviewers: [codex]
reviewed_at: 2026-04-30T20:46:44Z
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

# Cross-AI Plan Review — Phase 5: Catalog — Meu Jardim

## Codex Review

## Summary

Overall, these are unusually thorough plans with strong traceability from decisions to files, tests, and requirements. The phase is likely to achieve the five success criteria if executed carefully. The main risk is not missing scope; it is integration drift across 18 plans: several plans define conflicting DTOs, query keys, component props, i18n paths, transaction boundaries, and cache behavior. I would treat the plan set as strong but not yet execution-ready without a contract-normalization pass.

## Strengths

- Clear phase decomposition and coverage matrix. The outline maps all CAT/OFF/UI requirements and explicitly calls out CAT-01 as Phase 6 closure, which avoids dishonest completion claims.
- Strong test infrastructure up front in `05-01-wave0-test-infra-PLAN.md`, especially auth bypass, fake IndexedDB, and opt-in storage adapter fixtures.
- Good security posture in `05-02`, `05-03`, `05-04`, `05-08`, and `05-09`: owner-scoped repositories, RLS tests, closed error registry, verified-user gate, and no Drizzle in route handlers.
- Durable storage cleanup design in `05-06-plant-delete-inngest-cleanup-PLAN.md` is directionally right: same-TX pending rows plus Inngest happy path plus reconciler.
- Accessibility is treated as a first-class deliverable in `05-12`, `05-13`, and `05-14`, with APG keyboard behavior, focus trap tests, reduced-motion handling, and manual SR gate for BottomSheet.
- Offline architecture is thoughtfully split between TanStack Query persistence in `05-10` and Serwist runtime caching in `05-18`.

## Concerns

- **HIGH — Cross-plan API contract mismatches.** `05-08` says `GET /api/v1/plants` returns `{ items, next_cursor }`, while `05-15` expects `{ plants, next_cursor }`. `05-14` defines `Lightbox` with `src/index/onIndexChange/plantName`, while `05-17` consumes `url/initialIndex/ariaLabel`. `05-14` avoids a hard `combobox` variant via render prop, while `05-16` consumes `variant: "combobox"`. These will cause integration failures.

- **HIGH — Authenticated Service Worker cache can leak user data across accounts.** `05-18` caches `/api/v1/plants*`, `/api/v1/photo-entries*`, and `/api/v1/locations` by URL. `05-10` clears IDB on logout, but not Serwist CacheStorage. On a shared device, user B could receive user A's cached catalog JSON or photo URLs before revalidation.

- **HIGH — Idempotency and transaction boundaries are under-specified.** `05-05` and `05-07` use-cases appear to own their own `withUnitOfWork`, while `05-08`/`05-09` wrap them in `withIdempotency(tx)`. That only works if use-cases accept and use the outer transaction. Also, UI plans `05-16` and `05-17` do not explicitly generate required `Idempotency-Key` headers for PATCH/POST calls.

- **HIGH — Cleanup state machine may strand rows.** `05-06` marks rows `in_progress`, but `05-03`'s `fetchPendingBatch` only fetches `status='pending'`. A crash after `markInProgress` can leave cleanup permanently stuck unless the reconciler picks stale `in_progress` rows or `recordError` returns them to `pending`.

- **HIGH — Storage path validator does not match deletion-prefix usage.** `05-04` validates object paths like `{userId}/{plantId}/{photoId}.{ext}`, but `05-06` deletes prefixes like `{userId}/{plantId}/`. Add separate validators for object keys and plant prefixes.

- **MEDIUM — Wave graph inconsistency.** `05-09-route-handlers-mutate-delete-PLAN.md` is Wave 4, but UI plans `05-16` and `05-17` also Wave 4 depend on it. The outline had `05-09` in Wave 3. Move `05-09` back to Wave 3 or explicitly split Wave 4 into sub-waves.

- **MEDIUM — Query factory/server component boundary is confused.** `05-10` suggests query factories may be client-oriented, while `05-15` imports them into a Server Component for `fetchQuery`. Ensure query factories are server-safe, or split server query options from client hooks.

- **MEDIUM — Media signing is incomplete and potentially expensive.** Plans clearly sign photo-entry URLs, but catalog grid/profile cover URLs also need signing if buckets are private. First-page catalog may require signing up to 50 covers; consider batch signing or thumbnail-only signing.

- **MEDIUM — i18n ownership/path drift.** Multiple plans modify location/default catalog copy, and several cite `src/messages/pt-BR.json` while the project context uses `messages/pt-BR.json`. This will create merge conflicts or missed keys.

- **MEDIUM — Read-only test strategy likely cannot flip per spec via env.** `SUBSCRIPTION_READ_ONLY=1` is process-level. A Playwright fixture cannot reliably toggle it per test after the dev server is running. Use a separate Playwright project/server, or a server-only test cookie/header gated by `ENABLE_TEST_ROUTES`.

## Suggestions

- Add a short pre-execution "Phase 5 contracts" patch covering DTO shapes, query keys, component props, idempotency policy, signed URL fields, and i18n file ownership.
- Move `05-09` to Wave 3 and make UI Wave 4 depend on it cleanly.
- In `05-10`/`05-18`, isolate SW caches per user or purge catalog API/photo caches on logout and plant delete. Do not rely only on IDB busters.
- Standardize idempotent use-case signatures: route owns `withIdempotency`; use-cases accept optional `tx`; telemetry/Inngest fire only after outer transaction success and failures are caught/logged.
- Update `05-06` reconciler to recover stale `in_progress` rows and avoid failing user-visible deletes if post-commit Inngest/PostHog calls fail.
- Fix `messages/pt-BR.json` path in all plans and assign one plan as i18n namespace owner.
- Add explicit `Idempotency-Key: crypto.randomUUID()` generation to `05-16` PATCH and `05-17` POST clients.
- Add signed cover URL handling to `listPlants`/`getPlant`, with a batch-signing or capped-page performance note.

## Risk Assessment

**Overall risk: HIGH** until the contract mismatches and authenticated cache isolation are fixed. The plan quality is strong, but the phase spans schema, repositories, route handlers, async cleanup, custom a11y primitives, offline caching, and multiple app surfaces. The biggest risks are integration drift and privacy leakage through caches, not lack of product coverage.

---

## Consensus Summary

Only one reviewer (Codex) participated in this review run, so this section reflects Codex's findings rather than cross-reviewer consensus. To strengthen this section, re-run `/gsd-review --phase 5 --gemini` (or other CLIs) and merge results.

### Top Concerns

The five HIGH-severity findings warrant action before execution begins:

1. **Cross-plan API contract mismatches** — DTO field names, component prop shapes, and combobox variant handling diverge between repository/use-case plans and UI consumer plans.
2. **Service Worker cache cross-user leakage** — `05-18` runtime caches authenticated API responses without per-user partitioning or logout invalidation.
3. **Idempotency / transaction boundary under-specification** — use-cases own UoW while route handlers wrap with `withIdempotency`; UI plans omit `Idempotency-Key` generation.
4. **Cleanup state machine row-stranding** — `in_progress` rows are unrecoverable without reconciler updates.
5. **Storage path validator vs deletion-prefix mismatch** — object-key validator cannot validate plant-prefix deletions.

### Recommended Pre-Execution Patch

A short "Phase 5 contracts" pass that pins the DTO shapes (`{ items, next_cursor }` vs `{ plants, next_cursor }`), Lightbox/Combobox prop signatures, transaction handoff convention, i18n file path, and SW cache scoping rules — applied to plans 05-08, 05-09, 05-10, 05-14, 05-15, 05-16, 05-17, 05-18 — would likely move overall risk from HIGH to MEDIUM.

---

## How to Use This Review

To incorporate feedback into planning:

```
/gsd-plan-phase 5 --reviews
```

The planner will read this REVIEWS.md and patch the affected plans against the concerns raised.
