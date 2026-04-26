---
phase: 5
slug: catalog-meu-jardim
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-26
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of truth for layer mapping: `05-RESEARCH.md` § Validation Architecture (line 1455).

---

## Test Infrastructure

| Property               | Value                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Framework (unit)**   | Vitest 4.1.4 (`--project=unit`, jsdom)                                                                         |
| **Framework (integration)** | Vitest 4.1.4 (`--project=integration`, real Postgres 17 service container per Phase 1 D-25)               |
| **Framework (e2e)**    | Playwright 1.59.1 (Chromium-only per Phase 1 D-26)                                                             |
| **Framework (a11y)**   | `@axe-core/playwright` (Wave 0 install)                                                                        |
| **Config files**       | `vitest.config.ts` + `playwright.config.ts` (already exist)                                                    |
| **Quick run command**  | `pnpm test:unit`                                                                                               |
| **Full suite command** | `pnpm test:unit && pnpm test:integration && pnpm test:e2e`                                                     |
| **Estimated runtime**  | ~30s unit, ~120s integration (with PG container), ~180s e2e (Chromium)                                         |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit` (max latency ~30s).
- **After every plan wave:** Run `pnpm test:unit && pnpm test:integration` (full unit + real-Postgres integration).
- **Before `/gsd:verify-work`:** Full suite green — `pnpm test:unit && pnpm test:integration && pnpm test:e2e`.
- **Max feedback latency:** 30 seconds (unit suite).

---

## Per-Task Verification Map

> Filled in by planner after PLAN.md files are produced. Each task in every plan must
> map to at least one row here. The Nyquist rule (every behavior sampled at ≥2 layers)
> is encoded in `05-RESEARCH.md § Validation Architecture > Phase Requirements → Test Map`.

| Task ID    | Plan | Wave | Requirement | Threat Ref | Secure Behavior                                             | Test Type   | Automated Command                                                                                            | File Exists | Status     |
| ---------- | ---- | ---- | ----------- | ---------- | ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------ | ----------- | ---------- |
| _pending_  | _pending_ | _pending_ | CAT-01     | T-5-01     | Create-from-identification: ownership re-check + plant_id link verifies Identification.user_id matches JWT. | unit        | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/create-plant-from-identification.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-01     | T-5-01     | Cross-context Identification.plant_id update inside same transaction.                                       | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-from-identification.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-02     | T-5-02     | Two-step photo upload + plant create happy-path; idempotency replay returns same row.                       | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/create-plant-manual.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-02     | T-5-02     | Server rejects spoofed `photo_url` whose path prefix is not `{user_id}/{plant_id}/`.                        | unit        | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/storage-path-ownership.test.ts`           | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-03     | —          | Domain validation: missing name → `validation_failed`; missing photo → `validation_failed`.                 | unit        | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/plant-create-input-schema.test.ts`        | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-03     | —          | E2E `validation_failed` UX: form-level summary + per-field highlight, no DB row persisted.                  | e2e         | `pnpm exec playwright test tests/e2e/catalog/manual-add-validation.spec.ts`                                  | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-04     | —          | Plant Profile renders cover, details, care-card slot, reminders stub, journal preview, ID-history conditional. | e2e         | `pnpm exec playwright test tests/e2e/catalog/plant-profile-render.spec.ts`                                   | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-04     | —          | ID-history link hidden when `count(Identification WHERE plant_id) = 0`; visible otherwise.                  | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/id-history-visibility.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-05     | —          | Combobox filter logic + dedupe case-insensitive (`Sala` ≡ `sala`).                                          | unit        | `pnpm exec vitest --run --project=unit tests/unit/shared/ui/combobox-filter.test.ts`                          | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-05     | —          | Combobox keyboard navigation (ArrowDown/Up/Enter/Escape) + axe-core a11y open/closed.                       | e2e + a11y  | `pnpm exec playwright test tests/e2e/catalog/location-picker-keyboard.spec.ts tests/e2e/catalog/location-picker-a11y.spec.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-06     | —          | PhotoEntry add via two-step flow (upload → POST /:id/photos).                                               | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/add-photo-entry.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-06     | —          | Bottom-sheet add UX (open/dismiss/submit) + axe-core scan (gates hand-roll vs Vaul fallback).               | e2e + a11y  | `pnpm exec playwright test tests/e2e/catalog/photo-journal-add.spec.ts tests/e2e/catalog/photo-journal-add-a11y.spec.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-07     | —          | Cursor pagination ORDER BY acquisition_date DESC NULLS LAST + tiebreak on (id, createdAt).                  | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/list-plants-cursor.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-08     | —          | sessionStorage sort persistence (write + reload reads back).                                                | unit        | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/sort-storage.test.ts`                     | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-08     | —          | Sort persistence across reload within session (Playwright).                                                 | e2e         | `pnpm exec playwright test tests/e2e/catalog/sort-persistence.spec.ts`                                       | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-09     | T-5-03     | Atomic delete: SQL DELETE + outbox row insert + post-commit event dispatch in single transaction.           | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/delete-plant-atomic.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-09     | T-5-03     | `catalog/cleanup-storage` Inngest function deletes paths from StorageAdapter (mock).                        | unit        | `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/inngest/cleanup-storage.test.ts`          | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-09     | T-5-03     | Reconciler picks up orphan pending row when post-commit event dispatch failed.                              | integration | `pnpm exec vitest --run --project=integration tests/integration/catalog/reconcile-pending-deletions.integration.test.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-09     | T-5-03     | E2E delete user flow (modal → confirm → row gone → inngest event sent).                                     | e2e         | `pnpm exec playwright test tests/e2e/catalog/delete-plant-flow.spec.ts`                                      | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-10     | —          | Catalog grid responsive at 375 / 600 / 900 viewports + axe-core a11y per breakpoint.                        | e2e + a11y  | `pnpm exec playwright test tests/e2e/catalog/grid-responsive.spec.ts tests/e2e/catalog/grid-a11y.spec.ts`    | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | CAT-11     | —          | Empty Catalog composition (Sage illustration + Source Serif 4 headline + Calm Slate hint + single Canopy CTA). | e2e         | `pnpm exec playwright test tests/e2e/catalog/empty-catalog.spec.ts`                                          | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | OFF-08     | —          | Offline browse: cached catalog renders with `page.context().setOffline(true)`.                              | e2e         | `pnpm exec playwright test tests/e2e/catalog/offline-browse.spec.ts`                                         | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | OFF-08     | —          | TQ persister hydrates from IndexedDB on app reload (assert via IDB inspection).                             | e2e         | `pnpm exec playwright test tests/e2e/catalog/persister-hydration.spec.ts`                                    | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | OFF-08     | —          | Offline banner present + correct pt-BR copy.                                                                | e2e         | `pnpm exec playwright test tests/e2e/catalog/offline-banner.spec.ts`                                         | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | UI-04      | —          | Empty Home composition (asymmetric, NOT centered hero) + camera button → /identify placeholder route.       | e2e         | `pnpm exec playwright test tests/e2e/home/empty-home.spec.ts tests/e2e/home/identify-placeholder.spec.ts`    | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | UI-07      | —          | Catalog card geometry (4:5 photo, 16px radius, name/nickname/location, light shadow / Hairline Umber border). | e2e (visual) | `pnpm exec playwright test tests/e2e/catalog/card-geometry.spec.ts`                                          | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | UI-08      | —          | Inline edit per-field save-on-blur; live-region announces "Atualizado".                                     | e2e + a11y  | `pnpm exec playwright test tests/e2e/catalog/inline-edit-per-field.spec.ts tests/e2e/catalog/inline-edit-announcements.spec.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | UI-08      | —          | Save-on-blur logic (debounce / no double-submit).                                                           | unit        | `pnpm exec vitest --run --project=unit tests/unit/shared/ui/inline-edit-field.test.ts`                       | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | UI-11      | —          | Lightbox keyboard handlers + focus trap.                                                                    | unit        | `pnpm exec vitest --run --project=unit tests/unit/shared/ui/lightbox.test.ts`                                | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | UI-11      | —          | Lightbox swipe between photos + axe-core a11y scan.                                                         | e2e + a11y  | `pnpm exec playwright test tests/e2e/catalog/lightbox-swipe.spec.ts tests/e2e/catalog/lightbox-a11y.spec.ts` | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | (D-24)     | —          | `useSubscription()` stub returns `'trialing'`.                                                              | unit        | `pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts`                 | ❌ W0       | ⬜ pending |
| _pending_  | _pending_ | _pending_ | (D-24)     | —          | Read-only-mode UI variants — when stub flipped to non-trialing via env, all branches behave (Add hidden, edit affordances hidden, delete overflow hidden, persistent banner stub visible). | e2e         | `pnpm exec playwright test tests/e2e/catalog/read-only-mode.spec.ts`                                         | ❌ W0       | ⬜ pending |

_Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky_

---

## Wave 0 Requirements

- [ ] `tests/unit/contexts/catalog/` directory + helpers — none exist yet.
- [ ] `tests/integration/catalog/` directory + transaction-rollback fixture (per Phase 2 D-43) — depends on Phase 2 wave 5 landing.
- [ ] `tests/e2e/catalog/` + `tests/e2e/home/` directories + Playwright fixtures (auth bypass for E2E using a verified test user JWT) — depends on Phase 2 wave 4 (auth) + Phase 4 (verified user).
- [ ] `@axe-core/playwright` install + `expectNoA11yViolations(page)` helper.
- [ ] `fake-indexeddb` install for unit-testing the TanStack Query persister (jsdom does not ship IDB).
- [ ] Hand-rolled bottom-sheet test harness — `<dialog>` polyfill in jsdom may be needed.
- [ ] Test fixtures: a Plant + PhotoEntry seed helper, a stub Inngest send (capture event payload to assert), a fake `User.timezone` user.
- [ ] Hand-roll bottom-sheet axe + VoiceOver smoke before declaring D-16 done; if it fails, swap to Vaul 1.1.2 (fallback path documented in RESEARCH.md Pattern 7).

---

## Manual-Only Verifications

| Behavior                                                    | Requirement | Why Manual                                                                                                                            | Test Instructions                                                                                                                                                                                                              |
| ----------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bottom-sheet hand-roll a11y under VoiceOver / TalkBack      | CAT-06      | axe-core does not validate screen-reader semantics fully. Wave 0 gate per UI-SPEC Registry Safety.                                    | (1) Open Plant Profile in Safari iOS with VoiceOver on. (2) Tap "Adicionar foto" → bottom sheet opens. (3) Verify focus moves into sheet, swipe-down dismiss is announced, "Fechar" label is read. (4) Repeat with Chrome Android + TalkBack. |
| Lightbox swipe under VoiceOver                              | UI-11       | Native swipe gesture is intercepted by VoiceOver — verify edit affordances remain reachable.                                          | (1) Open photo journal entry → lightbox opens. (2) Swipe right with VO three-finger gesture. (3) Verify next-photo announcement; verify "Editar nota" / "Excluir" / "Definir como capa" appear in rotor.                                            |
| Catalog grid pinch-to-zoom on photo-journal originals offline | OFF-08      | Deferred to Phase 9 per CONTEXT.md D-21. Document that Phase 5 caches thumbnails only — verify offline lightbox shows thumbnail-quality, not original. | (1) Browse catalog online, open one plant + lightbox to cache thumbnails. (2) Enable airplane mode. (3) Re-open plant profile + lightbox. (4) Verify thumbnails render (original may show a low-quality placeholder).                              |

---

## Validation Sign-Off

- [ ] All planned tasks have `<automated>` verify rows in this map (planner fills task IDs after PLAN.md files exist)
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags (ban: `pnpm test`, `pnpm exec vitest`, `pnpm exec playwright test --ui`)
- [ ] Feedback latency < 30s on per-task commit (unit-only)
- [ ] Hand-rolled bottom-sheet axe + VoiceOver / TalkBack smoke gate complete (else Vaul fallback engaged)
- [ ] `nyquist_compliant: true` set in frontmatter only after planner fills task-ID rows AND Wave 0 verification commands exist on disk

**Approval:** pending
