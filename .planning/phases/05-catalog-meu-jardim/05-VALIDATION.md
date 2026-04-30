---
phase: 5
slug: catalog-meu-jardim
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-29
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `05-RESEARCH.md` § Validation Architecture.

---

## Test Infrastructure

| Property               | Value                                                                              |
| ---------------------- | ---------------------------------------------------------------------------------- |
| **Framework**          | Vitest 4.1.4 (unit + unit-dom + integration projects) + Playwright 1.59.1 (E2E)    |
| **Config file**        | `vitest.config.ts` + `playwright.config.ts`                                        |
| **Quick run command**  | `pnpm test:unit`                                                                   |
| **Full suite command** | `pnpm test:run` (unit + integration), then `pnpm test:e2e`                         |
| **Estimated runtime**  | ~30s unit · ~90s integration · ~3–5min E2E                                         |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit` (≤30s)
- **After every plan wave:** Run `pnpm test:run` (unit + integration, ~2min)
- **After every UI plan (05-15..05-18):** Run `pnpm test:e2e -- --project=chromium` for the routes touched
- **Before `/gsd-verify-work`:** Full suite + axe-core a11y suite must be green
- **Max feedback latency:** 30s for unit; 5min for full suite

---

## Per-Task Verification Map

> Populated by the planner once per-task IDs exist. Each task in every PLAN.md must reference one row here, OR declare a Wave 0 stub in `wave_0`.

| Task ID   | Plan | Wave | Requirement | Threat Ref | Secure Behavior                     | Test Type | Automated Command | File Exists | Status     |
| --------- | ---- | ---- | ----------- | ---------- | ----------------------------------- | --------- | ----------------- | ----------- | ---------- |
| _placeholder — planner fills after PLAN.md tasks exist_ | | | | | | | | | |

---

## Validation Strata (from RESEARCH.md)

### Unit (Vitest unit + unit-dom)

| Stratum                          | Plans     | Focus                                                                                                       |
| -------------------------------- | --------- | ----------------------------------------------------------------------------------------------------------- |
| Drizzle schema                   | 05-02, 05-03 | pgEnum values, table column types, FK onDelete rules for new tables                                          |
| Repository logic                 | 05-03     | `list({sort,cursor,limit})`, `countForUser`, `getCascadeCounts`, `fetchPendingBatch`, location upsert, cover auto-promote |
| Zod schema refinement            | 05-04     | `createPlantInputSchema` cross-field (name AND photo required), `updatePlantInputSchema` partial             |
| Cursor encoding                  | 05-03, 05-07 | `encodeCursor/decodeCursor` round-trip; NULLS LAST sentinel; base64url safety                                |
| IDB persister adapter            | 05-10     | `idb-keyval` AsyncStorage adapter `getItem/setItem/removeItem`; per-test reset via `new IDBFactory()`        |
| Storage budget guard             | 05-10     | `navigator.storage.estimate()` mock; eviction fires at >0.8; oldest queries evicted first                    |
| Query factory                    | 05-10     | Key shape correctness; `plantsKeys.lists({sort})` produces stable keys; partial-match invalidation type-checks |
| Combobox keyboard                | 05-12     | Arrow nav, Home/End, Enter accepts, Esc closes, printable typeahead, `aria-activedescendant`                 |
| InlineEditField                  | 05-14     | Blur saves, Enter saves (single-line), Esc reverts; `role="alert"` announcements                             |
| Lightbox                         | 05-14     | Touch swipe; Esc closes; Fechar visible; `dialog` role                                                       |

### Integration (Vitest integration project)

| Stratum                          | Plans         | Focus                                                                                                            |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------- |
| Plant create                     | 05-05, 05-08  | Multipart POST atomically creates Plant + PhotoEntry; rollback triggers compensating delete; PostHog NOT fired on rollback |
| Plant delete                     | 05-06, 05-09  | Cascades PhotoEntry + Reminder; `Identification.plant_id` set NULL; `pending_storage_deletions` row inserted; Inngest event emitted |
| Location upsert                  | 05-03         | `usage_count` increments on create+edit; `last_used_at` updated; DELETE plant does NOT decrement                  |
| Inngest cleanup                  | 05-06         | `catalog/cleanup-storage` calls `deletePrefix`; row → `completed`; retry on storage error; reconciler picks stuck rows |
| Cursor pagination                | 05-07, 05-08  | All 5 sort modes ordered correctly; cursor round-trip; NULLS LAST for `acquisition_date`; `?include_count=1` first page only |
| RLS owner-only                   | 05-02, 05-03  | `pending_storage_deletions` and `location_suggestions` reject cross-user access under authenticated role          |
| Idempotency                      | 05-08         | POST `/plants` with same `Idempotency-Key` returns cached response; no duplicate row                              |

### E2E (Playwright)

| Stratum                          | Plans         | Focus                                                                                                                  |
| -------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `authedUser` fixture             | 05-01         | Server-side `supabase.auth.admin.createUser` + session cookies injected; catalog accessible without login flow         |
| Catalog grid + sort              | 05-15         | Grid 2/3/4 cols at 375/600/900; sort persists across navigation within session via sessionStorage `folhario.catalog.sort` |
| Manual add happy path            | 05-17         | Form submit → plant in grid → profile reachable → PostHog `plant_added` event captured                                 |
| Manual add validation            | 05-17         | Missing name + photo → ≥2 errors → summary block; per-field Overdue Rust border; submit auto-focuses first invalid     |
| Inline edit                      | 05-16         | Tap field → input focused → blur saves; Esc reverts; Enter saves single-line                                           |
| Delete confirm sheet             | 05-16         | Cascade counts shown; Excluir destructive secondary; plant disappears from grid                                        |
| Photo journal                    | 05-17         | Add via ModalSheet → optimistic prepend; Lightbox opens on tap                                                         |
| Offline browsing (OFF-08)        | 05-18         | Online load → airplane mode → plants browsable; offline banner present; identify attempt blocked                       |

### Axe a11y (Playwright + AxeBuilder)

| Stratum                          | Plans                 | Focus                                                                                          |
| -------------------------------- | --------------------- | ---------------------------------------------------------------------------------------------- |
| Combobox                         | 05-12                 | 0 serious/critical violations; APG keyboard contract programmatically verified                  |
| BottomSheet                      | 05-13                 | Focus trap inside Dialog; return-focus on Esc/close (mirrors `axe-modal-focus-trap.spec.ts`)    |
| InlineEditField                  | 05-14                 | Edit-mode announced via `role="alert"`; focus placement on edit-open; revert announced          |
| Catalog routes                   | 05-15, 05-16, 05-17   | Every Phase 5 route added to `axe-placeholder-pages.spec.ts` ROUTES array → 0 violations         |

### Nyquist sampling (non-deterministic surfaces)

| Surface                          | Plans         | Approach                                                                                                                |
| -------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Service Worker offline + IDB     | 05-10, 05-18  | `navigator.storage.estimate()` mock in unit; real Chromium IDB + SW in Playwright offline spec                          |
| Signed URL TTL                   | 05-18         | URL with `expires` query param cached by full URL; entry evicted after `maxAgeSeconds`; verified via `ExpirationPlugin` mock |
| Inngest reconciler               | 05-06         | Manually advance fake clock past 5/30/240/1440min backoff windows; assert state machine transitions and final `failed`  |

---

## Wave 0 Requirements

> Plan **05-01** (Wave 0 test infra) ships every fixture/setup file the rest of the phase depends on. Each box below MUST be checked before any later wave runs.

- [ ] `tests/unit/setup-idb.ts` — `import 'fake-indexeddb/auto'` + per-test `new IDBFactory()` reset
- [ ] `tests/integration/setup.ts` — extend to swap in `InMemoryStorageAdapter` via `__setStorageAdapterForTests`
- [ ] `tests/integration/db-rollback.ts` — extend Phase 2 D-43 transaction-rollback fixture to cover Phase 5 tables
- [ ] `tests/e2e/fixtures/authed-user.ts` — server-side `supabase.auth.admin.createUser` + verified `public.users` + ConsentLog ×2 + trial subscription + cookie injection
- [ ] `tests/e2e/fixtures/read-only.ts` — flips `useSubscription` stub for read-only specs
- [ ] `pnpm add -D fake-indexeddb` (dev dep)
- [ ] `pnpm add @tanstack/react-query @tanstack/query-async-storage-persister idb-keyval` (runtime deps)
- [ ] `tests/e2e/axe-placeholder-pages.spec.ts` — placeholder ROUTES extended for new Phase 5 surfaces (filled when surfaces ship in 05-15..05-18; entries added as routes land)

---

## Manual-Only Verifications

| Behavior                                       | Requirement | Why Manual                                                                                       | Test Instructions                                                                                                                                        |
| ---------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BottomSheet VoiceOver / TalkBack announcement  | UI-04, UI-08 | Real screen-reader rotor verbalizations cannot be reliably asserted in headless Playwright       | iOS Safari + VoiceOver: open delete-confirm sheet, confirm headline + body announced + "Cancelar/Excluir" labels reachable via rotor; same on Android Chrome + TalkBack |
| Lightbox swipe physics                         | UI-07       | Touch-velocity heuristics produce per-device variance; manual confirmation under reduced-motion  | iOS + Android device test: swipe between 3 photos; confirm reduced-motion fallback to instant fade                                                       |
| Catalog grid responsive cutoffs                | UI-04       | Pixel-perfect breakpoints on real devices                                                        | Test at 375px (2 col), 600px (3 col), 900px (4 col), and 1024px tablet-width-centered (4 col + bg fills sides per CLAUDE.md mobile-first rule)            |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies (planner fills Per-Task Verification Map after PLANs exist)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (project rule: never `npm test`, always `pnpm test:unit` or `pnpm test:run`)
- [ ] Feedback latency < 30s for unit; < 5min for full suite
- [ ] `nyquist_compliant: true` set in frontmatter (flip after planner fills the Per-Task Verification Map and execute-phase confirms each row green)

**Approval:** pending
