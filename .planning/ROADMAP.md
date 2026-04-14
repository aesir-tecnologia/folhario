# Roadmap: Folhário MVP

## Overview

Folhário is a pt-BR plant identification + care-guide + reminder PWA for Brazilian beginners. The MVP journey goes from an empty greenfield repo to a shippable PWA where a verified user can, in under two minutes, photograph an unknown plant, see an honest top-3 identification, file it in "Meu Jardim" with a care guide, and schedule a watering reminder — all under LGPD compliance, WCAG 2.1 AA, a single paid tier with a 14/30-day trial, and atomic per-provider cost caps. Phases are derived from the DDD bounded contexts (IAM, Catalog, Species & Care, Identification, Reminders, Billing, Notifications) plus the cross-cutting Foundation and Launch phases that every context depends on or converges into. Phase 3 (Billing), Phase 4 (Catalog) and Phase 5 (Species & Care) are parallelizable — they all depend on IAM but not on each other's writes. The curated ≥200 pt-BR care-guide corpus runs as a founder-owned content track in parallel with engineering and is a hard launch blocker surfaced in Phase 8.

**Milestone:** v1.0 MVP (8 phases)
**Granularity:** Standard (parallelization enabled)
**Source of truth:** `docs/CAVE-PRD.md` (CAVE-PRD dated 2026-04-12)

## Phases

**Phase Numbering:**
- Integer phases (1..8): Planned MVP milestone work
- Decimal phases (e.g., 3.1): Reserved for urgent insertions post-planning

- [ ] **Phase 1: Foundation** - Scaffold + CI/CD + PWA shell + design system + testing + observability infra
- [ ] **Phase 2: IAM (Auth + LGPD)** - Signup, verification, OAuth, consent ledger, data export, 7-day deletion grace
- [ ] **Phase 3: Billing** - Stripe card-only checkout, webhook idempotency, trial, dunning, read-only catalog mode
- [ ] **Phase 4: Catalog + Offline** - Meu Jardim, photo journal, image pipeline, offline queue, multi-device sync
- [ ] **Phase 5: Species & Care** - Species table, curated corpus loader, care card, runtime AI augmentation, toxicity signals
- [ ] **Phase 6: Identification** - Provider abstraction, atomic caps, top-3 UI, LGPD identification consent, manual fallback
- [ ] **Phase 7: Reminders & Notifications** - Water/fertilize reminders, daily push nudge, email dispatch, permission lifecycle
- [ ] **Phase 8: Hardening + Launch** - WCAG audit pass, NFS-e path, DPO/policy publication, prod env, observability dashboards

**Parallel content track:** ≥200 curated pt-BR care guides (founder-owned, launch blocker, consumed by Phase 5).

## Phase Details

### Phase 1: Foundation
**Goal**: Every following phase inherits a correct-by-construction substrate — Supavisor-safe DB client, DDD-lite context skeleton, green CI with real-Postgres integration, PWA shell with pt-BR i18n, design system primitives, observability wrappers with PII scrub — so no later phase relitigates cross-cutting invariants.
**Depends on**: Nothing (first phase)
**Requirements**: FDN-01, FDN-02, FDN-03, FDN-04, FDN-05, FDN-06, FDN-07, FDN-08, FDN-09, FDN-10, FDN-11, FDN-12, FDN-13, FDN-14, FDN-15, TEST-01, TEST-02, TEST-03, SEC-02, SEC-03, OBS-01, OBS-02, UX-01, UX-06, UX-07, UX-08, UX-09, UX-11, UX-12, A11Y-02, A11Y-03, A11Y-04, A11Y-05
**Success Criteria** (what must be TRUE):
  1. A developer can clone the repo, run `pnpm install && pnpm test` and see Vitest unit + real-Postgres integration tests pass against a disposable `postgres:16` container with migrations applied.
  2. A GitHub PR provisions a Supabase branch DB, deploys a Vercel preview, and runs Playwright against the preview URL — and Vercel's git integration is demonstrably OFF (deploy only via GitHub Actions).
  3. An unauthenticated visitor can load the PWA at its Vercel preview URL, see pt-BR strings rendered through `next-intl`, install the app to their home screen (manifest + service worker), receive the app-update toast on a new SW version, and see the bottom nav shell (Home/Catálogo/Identificar/Perfil) respecting `env(safe-area-inset-*)` on iOS.
  4. Sentry `beforeSend` scrubs `email`, `Authorization`, `Cookie`, `photo_url`, and identification request bodies — verified by an integration test that throws with a PII-bearing payload and asserts the captured event carries none of it — and PostHog EU is initialized with session replay OFF.
  5. A design-system Storybook / gallery page renders the Paper Cream + Canopy Green light palette and the "veranda at dusk" dark palette, Source Serif 4 + Plus Jakarta Sans variable fonts, Lucide 1.5px-stroke icons, the 3px Canopy focus ring, and the shared empty-state / error-state / form-validation / skeletal-shimmer primitives — all honoring `prefers-reduced-motion`.
**Plans**: TBD
**UI hint**: yes

### Phase 2: IAM (Auth + LGPD)
**Goal**: A Brazilian beginner can create an account, verify their email (which starts the <2-min first-value clock), grant granular LGPD consent on a Contract basis at signup and Consent basis per-purpose later, export their data, and request account deletion with a durable 7-day grace that cancels cleanly — all without any later context being able to accidentally bypass the email-verification gate.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-05, LGPD-06, LGPD-07, LGPD-08, LGPD-09, LGPD-10, LGPD-11, LGPD-12, SEC-01, SEC-04, UX-02, UX-04
**Success Criteria** (what must be TRUE):
  1. A new user can sign up with email + password (age ≥13 confirmed, ToS + privacy policy accepted, timezone captured from the browser, optional partner code applied), sees a full-screen "Verifique seu e-mail" blocker (UX-02) served by middleware — not per-handler — until verification completes, then lands in the authenticated shell with a per-device JWT.
  2. A user can sign in with Google OAuth and is treated as pre-verified; a user can reset their password (unauthed, always 200) via a single-use hashed Resend token with 1h expiry; a user can change password from Settings; OAuth-only accounts see no change-password control.
  3. ConsentLog contains two distinct records after the first identification attempt — `tos_privacy_policy` (Contract basis, recorded at signup) and `identification_third_party` (Consent basis, recorded from the blocking Art. 33 modal) — and revoking `identification_third_party` in Settings blocks future identification with `consent_required` 403 but leaves catalog view intact (LGPD-04 integration test).
  4. A user can request an LGPD data export from Settings, receive a "pronto" email via Resend, and download a zip containing `data.json` + original `photos/` via a time-limited signed URL; a user can request account deletion, see the 7-day grace disclosure modal, cancel within the window and resume normal access, OR let it lapse and see the Inngest `iam/process-deletion` function wake from `step.sleepUntil` and hard-delete their data (verified in integration against a 15-second sleep override).
  5. Settings exposes DPO contact, privacy policy link, and ToS link (content fields may be TBD pre-launch, page structure ships), and middleware blocks every non-allowlisted `/api/v1/*` request lacking a valid JWT OR lacking verified email.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Billing
**Goal**: A verified user can enter paid status through Stripe card checkout, a `trialing` state opens on account creation (14 days organic, 30 days with a valid partner code at signup OR before `trial_end_date` in Settings), the Stripe webhook is sub-200ms and idempotent, and any lapse drops the catalog to read-only mode without holding data hostage.
**Depends on**: Phase 2
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SUB-08, SUB-09, SUB-10, SUB-11, SUB-12, SUB-13, SUB-14, SUB-15, SUB-16, SUB-17, SEC-05
**Success Criteria** (what must be TRUE):
  1. On account creation a Subscription row lands in `status=trialing` with `trial_end_date = now + 14d` (organic) or `now + 30d` (valid partner code); a user can complete Stripe Checkout with a card and transition to `active`; a user can cancel from Settings, see the `current_period_end` date, retain full access until then, and reactivate from Settings (including during the 7-day deletion grace).
  2. The Stripe webhook endpoint (a) rejects bad signatures with `webhook_signature_invalid` 401 and writes NO BillingEvent, (b) inserts a BillingEvent row with a UNIQUE constraint violation returning 200 on replay, (c) enqueues to Inngest — all in under 200ms — and the `billing/process-webhook` Inngest function is the ONLY path that mutates `Subscription.status`, verified by an integration test that replays the same `event_id` twice and asserts one state transition.
  3. A user whose subscription leaves `trialing`/`active` sees a persistent top banner ("Sua assinatura expirou...") linking to Settings billing, can still view plants/photos/journal/care guides, gets `subscription_required` 402 on identify, `read_only_mode` 402 on mutations, reminders paused, AND full Settings access (payment update, reactivate, export, delete).
  4. Dunning (4 retries over 7 days) fires a Resend-delivered payment-failed email per attempt with a PM update link; recovered → active; exhausted → canceled → read-only; the `billing/trial-ending-notifier` cron emits T-3 and T-1 trial-ending emails.
  5. Late partner-code entry in Settings is accepted ONLY while `status=trialing` AND wall-clock strictly before `trial_end_date`, sets `trial_end_date = created_at + 30d` in ONE write, never stacks, never resets the clock — verified by an integration test that attempts a late code 1 second after `trial_end_date` and asserts rejection.
**Plans**: TBD
**UI hint**: yes

### Phase 4: Catalog + Offline
**Goal**: A user can build "Meu Jardim" — add plants manually or from an identification (deferred until Phase 6), view plant profiles with photo journal and room picker, and keep working offline with a queue that survives app close/reopen, replays with client-UUID idempotency, and resolves conflicts without merge UIs.
**Depends on**: Phase 2 (User + JWT); parallelizable with Phase 3 and Phase 5
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08, CAT-09, CAT-10, IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07, OFF-08, UX-03
**Success Criteria** (what must be TRUE):
  1. A user can add a plant manually (name + ≥1 photo required, optional nickname/location/acquisition_date/notes), see the client-side compression + EXIF-GPS strip (server rejects any GPS-bearing upload as `validation_failed`), view the plant profile with cover + gallery + inline-editable nickname + room picker (quick-select + defaults + free-text-becomes-reusable), and see the catalog grid respect the 2/3/4-column breakpoints with 4:5 portrait cards and context-generated alt text.
  2. A user can add a dated photo journal entry per plant with an optional note; entries render reverse-chronological as PhotoEntry rows; deleting a plant cascades PhotoEntry + Reminder rows, schedules storage objects for deletion, and preserves Identification rows with `plant_id=NULL`.
  3. A user who goes offline sees the persistent "Você está offline..." banner (UX-03), can browse their cached catalog + care guides, queues photo adds and edits to IndexedDB with client-UUID Idempotency-Key headers, and on reconnect replays them in ascending client-timestamp order — server dedupes and returns original results on replay (OFF-01 integration test).
  4. Queued actions targeting a plant deleted server-side are dropped en masse with a single tappable summary toast on next app open listing discarded actions by type; field-edit conflicts resolve last-write-wins by SERVER timestamp; reminder-done for a gone-remote reminder drops silently.
  5. An action that fails sync 5 times writes an `OfflineSyncFailure` row, is removed from the active queue, and surfaces in a Settings "Needs attention" list with per-item retry/discard.
**Plans**: TBD
**UI hint**: yes

### Phase 5: Species & Care
**Goal**: A plant profile can display a seven-field pt-BR care guide (curated where available, runtime-augmented where not — always with a persistent "Gerado por IA" badge when augmented), and toxicity warnings always present icon + color + text + striped border + SR alert + haptic together so color is never the sole signal.
**Depends on**: Phase 2 (User); parallelizable with Phase 3 and Phase 4
**Requirements**: CARE-01, CARE-02, CARE-03, CARE-04, CARE-05, CARE-06, CARE-07, CARE-08, CARE-09
**Success Criteria** (what must be TRUE):
  1. The curated pt-BR care-guide corpus (≥200 domestic species, founder-owned track — content shipped pre-launch) is loaded into `Species` + `CareGuide` tables via a repeatable import pipeline, and a plant whose `species_id` is curated renders the full 7-field care card (watering, light, soil, temperature, humidity, toxicity, difficulty) plus seasonal tips (SH) and compatibility block when present.
  2. An `identification.succeeded` event for a species with missing or incomplete CareGuide triggers the `care-guide/augment` Inngest function which calls the `CareGuideProvider.augment()` adapter, upserts CareGuide with `source=augmented`, and the care card thereafter renders a permanent "Gerado por IA" Trust Teal chip — identification response NEVER blocks on augmentation (integration test asserts <500ms response even with augmentation queued).
  3. A toxic-species care card renders the full redundant-signal composition: Urgent Poppy filled rounded-rect badge, paw+child filled icon, literal "Tóxico para pets e crianças" text, 3px diagonal striped accent on the left edge, `role="alert"` SR announcement reading the full phrase, and a warning haptic on first-reveal-per-session — verified by an axe-core + manual audit checklist item.
  4. The first-ever care-guide view per user shows a one-time toxicity-AI disclaimer modal, persists acknowledgement in `User.toxicity_disclaimer_acknowledged_at`, and never shows it again; missing-CareGuide plants hide the care card entirely while flagging `Species.flag_reason=missing_care_guide` and incrementing `identification_count`.
  5. Care-guide augmentation consumes a separate `(provider, purpose=care_guide)` budget row; exhausting it logs `cost_ceiling_reached` and pauses augmentation WITHOUT touching the identification budget or existing CareGuide rows — verified by an integration test that maxes the care_guide budget and asserts subsequent identification still succeeds.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Identification
**Goal**: A verified user with granted identification consent can upload 1..N photos, receive an honest top-3 result ladder under a combined 50s Vercel budget, see caps enforced atomically before any provider call, and always have a manual-entry fallback when providers fail or caps hit — so the core <2-min value moment is honest, fast, and never broken by a runaway bill.
**Depends on**: Phase 2 (Consent), Phase 3 (Subscription tier for cap), Phase 4 (Catalog for prefill), Phase 5 (Species ref, augmentation trigger)
**Requirements**: ID-01, ID-02, ID-03, ID-04, ID-05, ID-06, ID-07, ID-08, ID-09, ID-10, ID-11, ID-12, ID-13, ID-14, ID-15, ID-16, UX-05, UX-10, TEST-04, OBS-03
**Success Criteria** (what must be TRUE):
  1. A user on their first-ever identification sees the blocking LGPD consent modal disclosing Plant.id + OpenAI-compat providers and Art. 33 international transfer; denying keeps them out of the provider call path; granting writes the `identification_third_party` ConsentLog row and proceeds — no provider call ever happens without that row present.
  2. From the Identify tab a user sees the static pre-capture guide (leaf + flower + whole plant + "Mais fotos melhoram a precisão"), taps the 72px Canopy circular capture button (UX-05, the only non-rounded-rectangle shape in the app and the one tactile bounce in the system), uploads 1..N photos, and sees the top-3 result ladder with the 4-signal confidence presentation (colored bar + segment count + numeric % + SR announcement — UX-10) with OpenAI-compat fallback results visibly labeled "confiança estimada pela IA".
  3. Two concurrent identification requests at the per-user daily cap boundary produce exactly one success and one `cap_hit` 429, with exactly one ProviderUsageCounter increment and zero orphan Identification rows (TEST-04 atomicity integration test against real Postgres via the `INSERT ... ON CONFLICT ... WHERE counter + cost <= cap RETURNING *` pattern); zero-results-above-threshold persists an Identification row and shows retake + manual-entry fallback UI (ID-03).
  4. A `provider_unavailable` 503 (circuit breaker open, cost ceiling reached, or wall-clock budget exhausted) always offers the manual-entry fallback; an 80% provider-ceiling breach fires a Resend operator alert email exactly once per `(provider, purpose, utc_date)` row via the `alert_80_sent_at` latch — verified by an integration test that simulates two 80%-trip passes and asserts one email.
  5. The Identification history screen lists every attempt (success + failure with `failure_reason`), the re-associate-with-catalog-entry detail view works end-to-end, and an Inngest cron SQL rollup (OBS-03) populates per-provider confidence distribution, manual-correction rate, cap-hit rate, and latency p50/p95/p99 into a queryable metrics table.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Reminders & Notifications
**Goal**: A user can create watering + fertilization reminders from a plant profile (never suggested), receive exactly ONE daily push nudge per user-day (never per-reminder) at their `notification_time_local`, never see a push permission prompt except on first-reminder save, and get email dispatch for trial-ending / payment-failed / deletion-confirmation via a single Notifications fan-out layer.
**Depends on**: Phase 2 (User tz), Phase 4 (Plants), Phase 5 (CareGuide frequency prefill), Phase 6 (identification-driven plants)
**Requirements**: REM-01, REM-02, REM-03, REM-04, REM-05, REM-06, REM-07, REM-08, REM-09, REM-10, REM-11, REM-12, REM-13, PUSH-01, PUSH-02, PUSH-03, PUSH-04, PUSH-05, PUSH-06, PUSH-07, PUSH-08
**Success Criteria** (what must be TRUE):
  1. A user can create a watering or fertilization reminder ONLY from a plant profile (no prompts, no suggestions), with frequency prefilled from CareGuide when available, `advance_rule` defaulting to `from_scheduled`, and the global `User.notification_time_local` (default 09:00, editable in Settings) applying to every reminder — never per-reminder override.
  2. A `from_scheduled` reminder snoozed to "tomorrow" and later marked done computes the next `next_due_at` from the ORIGINAL scheduled date + frequency (not the snooze or done time) — verified by an integration test; marking done advances per `advance_rule`; Home's "Hoje" list is the source of truth, derived live, with overdue visually distinct but not escalating.
  3. The `reminders/dispatch` Inngest cron runs every 5 minutes and emits `daily_reminder_summary.due` exactly ONCE per user per day at their local notification time WHEN at least one reminder is due/overdue AND subscription is in `trialing`/`active` — suppressed otherwise; the `notifications/send-push` function fans out a single push per device with NO Done/Snooze controls, deep-linking to Home.
  4. The push-permission browser prompt fires ONLY on save of the first-ever reminder (never at signup, first visit, or first identify); granting creates a per-device `PushSubscription` row keyed `(user_id, device_id)`; logout revokes only the current device; a push-service 410/404 DELETES the subscription row in the same Inngest step (reactive self-healing, zero cron prune).
  5. Global mute and per-plant mute both take effect globally across devices; React Email pt-BR templates for trial-ending, payment-failed, and deletion-confirmation dispatch via the `notifications/send-email` Inngest function and Resend — verified by a Playwright E2E that creates a first reminder, sees the permission prompt, and a fake-dispatch integration test that asserts the daily nudge fires exactly once.
**Plans**: TBD
**UI hint**: yes

### Phase 8: Hardening + Launch
**Goal**: Every pre-launch blocker identified in research (NFS-e path, DPO appointed + policy published, WCAG 2.1 AA audit pass, Plant.id paid balance, production VAPID keys, Resend domain verification, production env vars, first-value funnel wired) is resolved, observability dashboards are live, and the final end-to-end pass against a production-equivalent preview is green.
**Depends on**: Phases 1-7
**Requirements**: A11Y-01, OBS-04, OBS-05
**Success Criteria** (what must be TRUE):
  1. A WCAG 2.1 AA audit pass is documented and signed off — every interactive element has sufficient contrast, redundant state cues, SR-labeled role, focus-ring compliance, browser zoom + Dynamic Type honoring, and axe-core CI checks green across every Playwright E2E screen (A11Y-01 ship-blocker gate).
  2. The NFS-e issuance path is committed and implemented (third-party vendor integration OR manual SLA OR on-request-only policy), the DPO (Encarregado) contact is published in Settings, the privacy policy + ToS are published in pt-BR at stable URLs linked from signup and Settings, and the Stripe live price in BRL is set and wired.
  3. Production VAPID keys are generated and persisted, Resend domain is verified, Plant.id account has a paid credit balance, Supabase Pro plan and Inngest Hobby plan are active, and production env vars are set in Vercel (no branch/preview secrets leaking to prod).
  4. Sentry dashboards alert on new issues and error-rate spikes; Resend operator alerts fire on 80% provider ceiling breach, Stripe signature failure, and Inngest function failure-after-retries (OBS-04); the PostHog EU "first-value funnel" (signup → email verification → first identification within 2 minutes) is wired and emits the `identification_started`, `identification_succeeded`, and `plant_added` events against the ≥60%-of-verified-users target (OBS-05).
  5. A final Playwright E2E pass against the production-equivalent preview URL exercises every primary screen's happy path AND documented failure states (cap-reached, provider-unavailable, offline queue discard, augmented care-guide badge, read-only catalog mode) green.
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 ‖ 4 ‖ 5 → 6 → 7 → 8

Phases 3, 4, and 5 are parallelizable — they all depend on Phase 2 (IAM) but not on each other's writes. Execution order across the triplet is not strict; the roadmap records them sequentially for numbering but they may be planned and executed in parallel per `config.json` `parallelization=true`.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/TBD | Not started | - |
| 2. IAM (Auth + LGPD) | 0/TBD | Not started | - |
| 3. Billing | 0/TBD | Not started | - |
| 4. Catalog + Offline | 0/TBD | Not started | - |
| 5. Species & Care | 0/TBD | Not started | - |
| 6. Identification | 0/TBD | Not started | - |
| 7. Reminders & Notifications | 0/TBD | Not started | - |
| 8. Hardening + Launch | 0/TBD | Not started | - |

## Coverage

**Total v1 requirements:** 153 (REQUIREMENTS.md as of 2026-04-14 — FDN 15 + AUTH 9 + LGPD 12 + IMG 5 + ID 16 + CAT 10 + CARE 9 + REM 13 + PUSH 8 + OFF 8 + SUB 17 + UX 12 + A11Y 5 + OBS 5 + TEST 4 + SEC 5)

> Note: the initialization instructions stated 138 items; the authoritative REQUIREMENTS.md file ships 153 v1 items across 16 categories. Coverage below reflects the actual file contents.

**Mapped:** 153 / 153 ✓
**Orphans:** 0
**Duplicates:** 0

| Phase | Requirements | Count |
|-------|--------------|-------|
| 1. Foundation | FDN-01..15, TEST-01, TEST-02, TEST-03, SEC-02, SEC-03, OBS-01, OBS-02, UX-01, UX-06, UX-07, UX-08, UX-09, UX-11, UX-12, A11Y-02, A11Y-03, A11Y-04, A11Y-05 | 33 |
| 2. IAM (Auth + LGPD) | AUTH-01..09, LGPD-01..12, SEC-01, SEC-04, UX-02, UX-04 | 25 |
| 3. Billing | SUB-01..17, SEC-05 | 18 |
| 4. Catalog + Offline | CAT-01..10, IMG-01..05, OFF-01..08, UX-03 | 24 |
| 5. Species & Care | CARE-01..09 | 9 |
| 6. Identification | ID-01..16, UX-05, UX-10, TEST-04, OBS-03 | 20 |
| 7. Reminders & Notifications | REM-01..13, PUSH-01..08 | 21 |
| 8. Hardening + Launch | A11Y-01, OBS-04, OBS-05 | 3 |
| **Total** | | **153** |

### Cross-cutting distribution rationale

- **UX** split by surface: UX-01/06/07/08/09/11/12 are design-system primitives → Phase 1; UX-02 (unverified-email gate) + UX-04 (consent/push modal shell) → Phase 2; UX-03 (offline banner) → Phase 4; UX-05 (capture button) + UX-10 (confidence ladder) → Phase 6.
- **A11Y** split: A11Y-02 (zoom / Dynamic Type), A11Y-03 (haptic system), A11Y-04 (live regions), A11Y-05 (decorative-image rules) are infrastructure → Phase 1; A11Y-01 (WCAG audit ship-blocker gate) → Phase 8 because the audit is a cross-phase verification, not a feature.
- **OBS** split: OBS-01 (Sentry PII-scrubbed) + OBS-02 (PostHog init) are Foundation → Phase 1; OBS-03 (ID quality SQL rollups) → Phase 6 because it reads only Identification data; OBS-04 (alerting wiring consolidation) + OBS-05 (first-value funnel) → Phase 8.
- **TEST** split: TEST-01/02/03 (unit + real-Postgres integration + Playwright harness) → Phase 1; TEST-04 (cap atomicity concurrency) → Phase 6 because the atomic cap pattern is Identification-specific.
- **SEC** split: SEC-01 (JWT middleware) + SEC-04 (email-verification middleware) → Phase 2; SEC-02 (RLS) + SEC-03 (security headers) → Phase 1; SEC-05 (Stripe webhook signature) → Phase 3.

### Parallel content track (outside the numbered phases)

- **Curated ≥200 pt-BR care guides (CARE-01 content)** — founder-owned, drafted throughout engineering phases, loaded into Phase 5 via the curated-import pipeline, final QA in Phase 8 as a launch blocker. Not an engineering phase; reflected here so it is never confused with CareGuideProvider runtime augmentation (which IS engineered in Phase 5).

### Decisions already resolved (carried from SUMMARY.md — not re-litigated in this roadmap)

- Card-only billing for MVP; Pix Automático deferred to v1.1 (PIX-01..03 in v2 section of REQUIREMENTS.md)
- Disease diagnosis deferred to v2 (DIAG-01..02 in v2 section)
- Supabase Auth custom-token flow with React Email for voice consistency (Phase 2)
- Vision-LLM confidence calibration via JSON schema forcing self-reported confidence (ID-15, Phase 6)
- Email-verification resend throttle is narrow per-email + per-IP (AUTH-08, Phase 2)
- Contextual help allowed only as inline expansion within consent/push modals (Phase 2 constraint on UX-04)

---

*Roadmap created: 2026-04-14*
*Source: PROJECT.md + REQUIREMENTS.md + research/SUMMARY.md + research/ARCHITECTURE.md + research/PITFALLS.md + research/STACK.md*
