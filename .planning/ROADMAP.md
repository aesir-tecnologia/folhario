# Roadmap: Folhário MVP v1

## Overview

Folhário is a Brazilian plant-identification + care-guide + reminder PWA whose core promise is "identified, cataloged, with care guidance in under 2 minutes from email verification." The journey from empty repo to launch goes: first lay down the local-dev foundation (Phase 1 — Next 16 scaffold, local Supabase in Docker, Sentry + PostHog baseline), then the data layer (Phase 2), then the design system and app shell (Phase 3), then unlock the verified-account gate (Phase 4 — which also onboards Inngest + Resend because email verification is the first async consumer), then build the catalog so there's something to identify INTO (Phase 5), then the identification flow itself with its architectural cost controls (Phase 6), then render care guides — the retention hook's supporting content (Phase 7), then close the retention loop with reminders and the single daily push nudge (Phase 8), then harden the offline queue that every mutating flow assumed (Phase 9), then wire the billing state machine that gates mutations across the whole app (Phase 10 — also onboards Stripe), then land LGPD data rights with the 7-day deletion grace via Inngest durable sleep (Phase 11), then wire up the Vercel deploy pipeline + Supabase branch DBs + preview-URL E2E (Phase 12) so production traffic has a real landing strip, and finally the observability rollups and launch-blocker sign-off (Phase 13). Every phase ships observable end-to-end behavior; no horizontal-layer phases. Tools are onboarded in the phase that first needs them, not upfront.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - Next 16 + Serwist scaffold, local Supabase + Docker dev, Sentry + PostHog baseline with verification, security headers, error registry, ci.yml-only (no deploy)
- [ ] **Phase 2: Data Layer & Bounded Contexts** - Drizzle schema, Supabase adapters, image pipeline, API conventions
- [ ] **Phase 3: Design System & App Shell** - Paper Cream tokens, bottom-nav, PWA manifest, a11y base, next-intl pt-BR strings
- [ ] **Phase 4: IAM — Auth, Verification, Consent** - Email+Google signup, verification gate, per-IP throttle, Inngest `serve()` + Resend transactional-email backbone (first async consumer)
- [ ] **Phase 5: Catalog — Meu Jardim** - Manual plant add, plant profile, photo journal, location picker, offline-browsable catalog
- [ ] **Phase 6: Identification Flow & Cost Controls** - Plant.id + OpenAI-compat adapters, per-user caps, per-provider ceilings, breakers, LGPD transfer consent, confidence ladder
- [ ] **Phase 7: Species, Care Guides & Augmentation** - Curated launch corpus rendering, toxicity badge spec, Inngest care-guide augmentation with "Gerado por IA" chip
- [ ] **Phase 8: Reminders & Single Daily Push Nudge** - Reminder creation/done/snooze, `reminders/dispatch` cron, deferred push permission, self-healing PushSubscription
- [ ] **Phase 9: Offline Queue & Sync Resilience** - IndexedDB queue replayer, Idempotency-Key dedupe, discard-summary, OfflineSyncFailure surface
- [ ] **Phase 10: Billing, Trials & Read-Only Mode** - Stripe adapter (card + Pix), webhook-driven state machine, partner codes, dunning 4×7d, subscription-gated mutations
- [ ] **Phase 11: LGPD Data Rights & 7-Day Deletion Grace** - Export ZIP + deletion via Inngest `step.sleepUntil`, consent revocation, Privacy panel, DPO contact
- [ ] **Phase 12: Deploy Pipeline** - Vercel project (git integration OFF), deploy-preview.yml + deploy-production.yml + deploy-preview-cleanup.yml, Supabase branch DB per PR, Playwright against preview URL, Sentry source-map upload
- [ ] **Phase 13: Observability Rollups & Launch Readiness** - PostHog event taxonomy, identification-quality SQL rollups, launch-blocker checklist sign-off

## Phase Details

### Phase 1: Foundation
**Goal**: A Next 16 skeleton that a developer can run locally end-to-end — `pnpm dev` against a local Supabase Docker stack — with Sentry + PostHog wired and verified, security headers applied, the closed error-code registry in place, and `ci.yml` running lint + typecheck + Vitest unit + integration + a local-build Playwright smoke. No Vercel, no preview URLs, no deploy workflows, no Inngest yet — those land in the phases that first need them.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-12, INFRA-16, INFRA-17, INFRA-18, INFRA-20, INFRA-23, INFRA-26, OBS-01, OBS-02, LGPD-13 *(OBS-05 deferred to Phase 13 on 2026-04-23 per user decision 2)*
**Success Criteria** (what must be TRUE):
  1. An empty Next 16 App Router app with TS strict + pt-BR locale + `@serwist/next` PWA wiring builds locally and on CI, with the bounded-context folder layout from PRD §2 in place.
  2. `supabase start` launches a local Postgres + Auth + Storage + Studio stack in Docker; the app running via `pnpm dev` connects to it through a local `DATABASE_URL`; `supabase db reset` rebuilds the stack from migrations.
  3. Opening a PR runs `ci.yml`: lint + typecheck + Vitest unit + Vitest integration (against a `postgres:17-alpine` service container) + `next build` + a Playwright smoke against `next start` on the CI runner. No deploy, no preview URL.
  4. A deliberately thrown error in the local app appears in Sentry with `Authorization`, `Cookie`, `email`, `password`, `token`, and `photo_url` scrubbed, `Sentry.setUser({ id })` only, and request bodies dropped on `/api/v1/identifications/*` routes. A PostHog ping event fires from both the client and `posthog-node` server. Client-side envelopes are verified automatically by the Playwright smoke (Sentry transport + PostHog `$pageview` intercepted at the network layer). Server-side envelopes are verified in two ways: (a) an automated Vitest integration test (`tests/integration/diagnostics-server-probe.integration.test.ts`) that imports the server route handler directly, mocks `posthog-node` + `@sentry/nextjs`, and asserts `capture()` + `captureException()` were invoked; and (b) a manual dashboard check recorded in `01-08-SUMMARY.md` with screenshot links.
  5. The closed error-code registry enum exists as a single importable source, standard security headers (CSP, HSTS, X-Frame-Options) apply to every response, and the `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real providers so any future environment cannot accidentally burn real provider credit.
**Plans**: 9 plans

Plans:
- [x] 01-01-PLAN.md -- Repo tooling bootstrap
- [x] 01-02-PLAN.md -- Scaffold + TDD error registry + TDD Zod env
- [x] 01-03-PLAN.md -- Next 16 app + i18n + proxy + Serwist + next.config.ts
- [x] 01-04-PLAN.md -- Local Supabase Docker stack + env sync script
- [x] 01-05a-PLAN.md -- TDD Sentry scrub module (LGPD-13 load-bearing)
- [x] 01-05b-PLAN.md -- Three Sentry.init files (server + edge + browser) + instrumentation.ts cleanup
- [x] 01-06-PLAN.md -- Hand-rolled PostHog providers
- [x] 01-07-PLAN.md -- Diagnostics routes + 5 Playwright E2E specs + Vitest server-probe
- [x] 01-08-PLAN.md -- ci.yml + REQUIREMENTS.md + ROADMAP.md amendments (final plan)
**UI hint**: no

### Phase 2: Data Layer & Bounded Contexts
**Goal**: Every entity from PRD §4 exists in Postgres with Drizzle migrations applied, auth/storage/inngest adapters are wired behind their interfaces, and route handlers have the conventions (Zod, Idempotency-Key, cursor pagination, RLS) needed for feature phases to write thin use-cases without reinventing plumbing.
**Depends on**: Phase 1
**Requirements**: INFRA-03, INFRA-04, INFRA-05, INFRA-06, INFRA-07, INFRA-08, INFRA-09, INFRA-19, INFRA-21, INFRA-22, INFRA-24
**Success Criteria** (what must be TRUE):
  1. Drizzle schema + migrations for all 19 entities (User, Plant, Species, CareGuide, PhotoEntry, Identification, Reminder, ReminderLog, PartnerStore, ConsentLog, DataExportRequest, DataDeletionRequest, Subscription, BillingEvent, IdentificationLimit, ProviderBudget, ProviderUsageCounter, OfflineSyncFailure, PushSubscription) are applied to a fresh DB from `drizzle-kit`, with RLS enabled on every user-owned table.
  2. A single shared `db/client.ts` exports a Drizzle client built on `postgres-js` with `{ prepare: false }` against the Supavisor txn pooler, and integration tests fail loudly if any route handler imports Drizzle directly (repositories only).
  3. `AuthAdapter` and `StorageAdapter` (with `plant-photos`, `plant-thumbnails`, `data-exports` private buckets + signed-URL helpers) boot without errors and are exercised by integration tests. Inngest is NOT wired here — it lands in Phase 4 alongside the first async consumer (verification email).
  4. A smoke `/api/v1/*` route handler validates body with a `drizzle-zod`-derived Zod schema, enforces JWT verification via Next middleware, returns cursor-paginated responses (`?cursor=&limit=`, default 50 / max 200, opaque `next_cursor`), and dedupes POSTs by `Idempotency-Key` header.
  5. A client-side image pipeline (compression ≤1MB + EXIF/GPS strip) uploads through the storage adapter and the server-side upload endpoint rejects any image carrying GPS EXIF with `validation_failed`; `ConsentLog` + policy-version + legal-basis registry seed data is loaded into every environment.
**Plans**: TBD
**UI hint**: no

### Phase 3: Design System & App Shell
**Goal**: A PWA-installable app shell renders with the full Paper Cream / Night Cream design system, bottom-nav, dark mode, motion, pt-BR strings, and accessibility guardrails — so every later feature phase just drops composed screens into already-finished chrome.
**Depends on**: Phase 2
**Requirements**: UI-01, UI-02, UI-03, UI-14, UI-17, UI-18, UI-19, UI-20, UI-21, UI-22, UI-23, UI-24, UI-25, OFF-09, OFF-10
**Success Criteria** (what must be TRUE):
  1. A visitor installs the PWA (manifest with all icon sizes, `display: standalone`, theme color matching brand, viewport allowing user scaling), launches it from the home screen, and sees the Paper Cream light theme — or the Night Cream dark theme if system prefers dark — with Source Serif 4 headings, Plus Jakarta Sans body, Lucide icons, and every string fetched through `next-intl` with `<html lang="pt-BR">`.
  2. Keyboard users can tab through the bottom-nav (4 items: Home, Catálogo, Identificar, Perfil; 28px Lucide + labels always, Canopy active bar, 56px + safe-area padding, per-tab scroll preservation) with a 3px Canopy-at-40% focus ring 2px offset, tab order matching visual order, and route changes moving focus to main content.
  3. Loading states render as skeletal shimmers (never circular spinners) with a 300ms threshold and 120ms fade-in, reducing to static blocks + 80ms fade under `prefers-reduced-motion`; the capture-button 1.00→1.03 bounce, 3.2s breathing loop on empty CTA, and 60ms cascade on list reveal all honor reduced motion.
  4. Placeholder screens demonstrate every composed primitive: empty state (Sage line-art + Source Serif headline + Calm Slate hint + single Canopy CTA), inline calm error (never full-screen red wall, cause + recovery copy, retry path exposed), persistent offline banner, safe-area-respecting `min-h-[100dvh]` layout with no horizontal scroll, and strings piped through the i18n layer with `dd/MM/yyyy` dates, 24h times, and `R$ 29,90` currency.
  5. When a new service worker version is detected, a non-blocking bottom toast "Nova versão disponível" + "Atualizar" appears, tapping triggers `skipWaiting` + reload, and the app never auto-reloads mid-session; a design-system lint confirms absence of emoji, pure black/white, gradient text, glassmorphism, neumorphism, Inter, and generic serifs.
**Plans**: TBD
**UI hint**: yes

### Phase 4: IAM — Auth, Verification, Consent
**Goal**: A Brazilian beginner can sign up with email+password or Google, confirm age ≥13, accept T&C + privacy policy, receive + click a pt-BR verification email from Resend, and land in the app shell with the verification gate lifted — and the Settings shell exists with an "Account" section so profile basics and password change work end-to-end. This phase also onboards Inngest (`serve()` handler + all async function registrations) because the verification email is the first async consumer, and onboards Resend (React Email templates + sandbox domain) for the same reason.
**Depends on**: Phase 3
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, AUTH-07, AUTH-08, AUTH-09, AUTH-10, AUTH-11, AUTH-12, AUTH-13, AUTH-14, AUTH-15, INFRA-10, NOTIF-01, NOTIF-02, UI-13
**Success Criteria** (what must be TRUE):
  1. A new user submits the signup form with email+password, confirms age ≥13, accepts T&C + privacy policy (ConsentLog row recorded against the active `policy_version`), optionally enters a partner code, and their browser's `Intl.DateTimeFormat().resolvedOptions().timeZone` is captured into `User.timezone`; a `Subscription` row is created `status=trialing`; a verification email arrives in pt-BR via Resend (rendered from a React Email template); until they click the link, any gated endpoint returns `email_unverified` 403 and the app shell is replaced by a full-screen blocker "Verifique seu e-mail para começar." with resend-verification + logout links.
  2. A Google-OAuth signup treats the user as pre-verified — no verification email sent, gated endpoints reachable immediately — while the email+password user who clicks the verification link has `User.email_verified_at` set, the blocker cleared, and the "value <2 min" clock started.
  3. Returning users log in with email+password via per-device JWT (no server sessions), log out of the current device (revoking that JWT and its push subscription only), request a password reset from a public endpoint that always returns 200 (no enumeration) and — when the email exists — receive a Resend email with a single-use hashed token expiring in 1h that lets them set a new password while existing JWTs remain valid.
  4. From `Settings → Account`, an email+password user changes their password with current + new (wrong current → `invalid_credentials` 401); OAuth-only accounts see the change-password UI hidden and the endpoint rejects with `forbidden`; the Settings shell renders with placeholder sections for Notifications, Subscription & billing, Privacy & LGPD, Needs attention, and App info that later phases will fill.
  5. The signup, login, and OAuth callback endpoints enforce a narrow per-IP attempt throttle returning `rate_limited` 429 when tripped, independent of the target account and without consuming the failure budget on successful logins, and `notifications/send-email` Inngest function is wired to Resend with pt-BR React Email templates for verification + password-reset as the first consumers (later phases add templates).
**Plans**: TBD
**UI hint**: yes

### Phase 5: Catalog — Meu Jardim
**Goal**: A verified user can manually add plants, see them as a responsive 2/3/4-column grid sorted by acquisition date, open a plant profile with photo journal + location picker + delete, and browse a previously-loaded catalog offline — producing the "something to identify INTO" that Phase 6 needs.
**Depends on**: Phase 4
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08, CAT-09, CAT-10, CAT-11, OFF-08, UI-04, UI-07, UI-08, UI-11
**Success Criteria** (what must be TRUE):
  1. A user with zero plants sees the full-bleed Home empty state "Identifique sua primeira planta" with a camera button + "Adicionar manualmente" text link (the camera button is wired to the Phase 6 placeholder route), and the Catalog tab shows "Sua estante ainda está esperando a primeira planta." with a single Canopy CTA.
  2. "Adicionar manualmente" creates a Plant with name + ≥1 photo (species_id null) and an initial PhotoEntry; missing name or photo returns `validation_failed` with field highlighting and no row persisted; the new plant appears in the catalog grid which is responsive at 2 cols ≤375px, 3 cols 600-899px, 4 cols ≥900px and defaults to `acquisition_date` DESC (null dates last).
  3. A plant profile opens with cover + thumbnail gallery, inline-editable name/nickname/room/acquisition_date/notes, active-reminders placeholder, photo-journal preview, ID-history link placeholder, and a delete overflow; the location picker shows the user's prior locations as quick-select plus defaults `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]` plus free text that becomes reusable next time.
  4. A user adds a new photo-journal entry with an optional note (creating a `PhotoEntry` linked to the plant), and the photo journal screen lists entries reverse-chronologically; a sort control offers name A-Z, name Z-A, date newest, date oldest, location, and the selection persists for the session.
  5. Deleting a plant cascades its PhotoEntry + Reminder rows, schedules its storage objects for deletion, sets `Identification.plant_id` NULL while preserving the history row, and a user who had previously loaded the catalog online can go offline (airplane mode) and still browse those cached plants with a clear offline banner visible.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Identification Flow & Cost Controls
**Goal**: A verified, trial-active user opens the Identify screen, snaps or picks 1-N photos, accepts the first-time LGPD Art. 33 third-party transfer consent, and — within the 50s function budget — receives ≤3 honest top-3 results with confidence-ladder UI, selects one, and lands in their catalog with a Plant+Species linked; meanwhile the platform enforces per-user caps, per-provider daily ceilings, atomic counters, and a circuit breaker so a runaway provider can never blow the $5/day budget.
**Depends on**: Phase 5
**Requirements**: IDENT-01, IDENT-02, IDENT-03, IDENT-04, IDENT-05, IDENT-06, IDENT-07, IDENT-08, IDENT-09, IDENT-10, IDENT-11, IDENT-12, IDENT-13, IDENT-14, IDENT-15, IDENT-16, IDENT-17, IDENT-18, IDENT-19, IDENT-20, IDENT-21, COST-01, COST-02, COST-03, COST-04, COST-05, COST-06, COST-07, COST-08, COST-09, COST-10, LGPD-09, UI-06, UI-12, UI-15
**Success Criteria** (what must be TRUE):
  1. A verified trialing user on Identify with no prior consent sees the LGPD consent modal disclosing Plant.id + OpenAI-compat providers and Art. 33 international transfer; granting records a ConsentLog and capturing `consent_version` is persisted on every subsequent `Identification` row; denying or revoking returns `consent_required` 403 with no provider call and no Identification row.
  2. With consent, the capture guide (leaf + flower + whole plant + "Mais fotos melhoram a precisão") is visible, the user uploads 1-N EXIF/GPS-stripped photos ≤1MB each (server rejects any with GPS as `validation_failed`), and `POST /v1/identifications` returns ≤3 results above `ProviderBudget.min_confidence` ordered desc via the `IdentificationProvider` adapter (Plant.id primary, OpenAI-compat fallback), persists `Identification status=success` with provider/model/latency/consent_version/photo_urls, emits `identification.succeeded`, and the user selects a result to create a Plant linked to Species with name pre-filled and `Identification.plant_id` FK set.
  3. The confidence ladder renders three states (high ≥70%, medium 40-69%, low threshold-39%) with redundant signals (bar + segments + percentage + SR label), zero-results shows "could not identify" + retake guidance (with the Identification row still persisted for history), and the identification-history screen lists every success/timeout/provider_unavailable attempt with status + failure_reason plus a re-associate-with-catalog link.
  4. Per-user caps are enforced BEFORE any `ProviderUsageCounter` increment or provider call: a trialing user over 5/day or 75/period sees `cap_hit` 429 with a reset time and a manual-entry link (no retry button); an active user over 15/day or 200/period sees `cap_hit` 429; two concurrent requests to the same provider serialize atomically with zero lost writes; the 80% ceiling triggers an operator Resend alert; operator DB tuning of `IdentificationLimit` or `ProviderBudget` takes effect on next request past cache TTL.
  5. When Plant.id hits its $5/day ceiling or trips its circuit breaker, the router skips it (logging internal `cost_ceiling_reached` / `breaker_open`) and fallovers to OpenAI-compat with ≥10s remaining budget (else short-circuits `provider_unavailable`); the `care_guide` provider budget is independent from `identification` so exhausting one never starves the other; clients only ever see `provider_unavailable` 503, `timeout` 504, `cap_hit` 429, `consent_required` 403, `validation_failed`, or `subscription_required` 402 — internal reasons never leak; offline identify shows "Identificação requer conexão à internet." and read-only-mode shows the "Reative sua assinatura para identificar novas plantas." paywall modal.
**Plans**: TBD
**UI hint**: yes

### Phase 7: Species, Care Guides & Augmentation
**Goal**: Every identified plant links to a care guide — either from the ≥200 founder-curated launch corpus or, for missing species, from a post-identification Inngest augmentation that lands with a persistent "Gerado por IA" badge — and every toxicity signal renders with the non-negotiable 7-part composition + mandatory vet disclaimer.
**Depends on**: Phase 6
**Requirements**: CARE-01, CARE-02, CARE-03, CARE-04, CARE-05, CARE-06, CARE-07, CARE-08, CARE-09, CARE-10, UI-09, UI-16
**Success Criteria** (what must be TRUE):
  1. A plant whose Species has a published CareGuide (curated or augmented) opens a care card rendering all 7 fields — watering, light, soil, temperature, humidity, toxicity, difficulty — plus seasonal tips and compatibility block, with Calm Slate secondary text and the photography-first atmosphere from PRD §17.
  2. The toxicity badge renders the non-negotiable 7-part spec on every surface where toxicity appears (top of care card, top of plant profile): filled rounded-rect, 18px paw+child Lucide icon, literal text, 3px diagonal striped accent border, disclaimer "Informação gerada por IA — confirme com um veterinário" on the same viewport, SR `role="alert"` full phrase, and a haptic warning on first reveal per session; the first-ever care-guide view shows the one-time toxicity disclaimer modal persisted via `User.toxicity_disclaimer_acknowledged_at`.
  3. A plant whose Species has no CareGuide hides the care card section but keeps every other plant-profile feature; `Species.flag_reason=missing_care_guide`, `flag_status=open`, and `identification_count` is incremented on each match.
  4. An `identification.succeeded` event for a species missing a care guide triggers `care-guide/augment` via `CareGuideProvider.augment`, upserts a `CareGuide source=augmented` row with bumped version, sets `Species.flag_status=resolved`, emits `care_guide.augmented`, and the user sees the new card on next view with a persistent Trust Teal "Gerado por IA" chip at top that never disappears; the identification response itself is not delayed by augmentation.
  5. When the `ProviderBudget` row for `purpose=care_guide` is at/above its daily ceiling, the augment function exits without a provider call, logs internal `cost_ceiling_reached`, and leaves the CareGuide untouched — while the `purpose=identification` budget for the same provider is unaffected; the founder-curated ≥200-species launch corpus is loaded into the database and surfaces on matched identifications (LAUNCH BLOCKER: corpus authoring is tracked separately in the launch-blocker checklist, not as a dev task in this phase).
**Plans**: TBD
**UI hint**: yes

### Phase 8: Reminders & Single Daily Push Nudge
**Goal**: A user creates a watering or fertilization reminder from a plant profile, the Home "Hoje" section becomes the authoritative due/overdue list, and — the first time they create a reminder — the browser push permission is surfaced so the `reminders/dispatch` cron can emit exactly ONE daily nudge per user at their `notification_time_local` when anything is due, fanned out across every active PushSubscription with 410/404 self-healing.
**Depends on**: Phase 7
**Requirements**: REM-01, REM-02, REM-03, REM-04, REM-05, REM-06, REM-07, REM-08, REM-09, REM-10, REM-11, REM-12, REM-13, REM-14, REM-15, REM-16, REM-17, REM-18, REM-19, REM-20, REM-21, NOTIF-03, NOTIF-04, NOTIF-05, UI-05, UI-10
**Success Criteria** (what must be TRUE):
  1. On a plant profile with zero reminders, no prompt or suggestion to create one is shown (respecting "reminders never nagged"); opening "Criar lembrete" lets the user pick type (watering/fertilization), frequency (prefilled from care guide if available), and advance_rule (default `from_scheduled`, persisted when untouched), and submitting it creates the very first reminder which triggers the browser-native push permission prompt (never surfaced at signup, first visit, or first identify).
  2. The Home "Hoje" section is the authoritative due/overdue list derived live from Reminder + ReminderLog — overdue reminders appear in a visually distinct section that does NOT auto-mute, auto-complete, or change visual weight as they age — and the Reminders management screen lists reminders grouped by plant with edit/delete, showing current global notification time with a "Change in Settings" link.
  3. A new user has `notification_time_local=09:00` by default and can edit it in Settings → Notifications with global mute + per-plant mute (global across devices); `next_due_at` is computed at create/advance (UTC) from `notification_time_local` + `User.timezone`, the dispatcher queries by UTC only (no per-request tz math at fire time), and changing `User.timezone` does NOT retroactively shift already-scheduled reminders.
  4. At the user's `notification_time_local` the `reminders/dispatch` Inngest cron emits exactly ONE `daily_reminder_summary.due` event when ≥1 reminder is due/overdue (zero due → no event, no nudge), and `notifications/send-push` fans out a single daily nudge via `web-push` + VAPID to every active `PushSubscription` keyed `(user_id, device_id)` — the payload carries no Done/Snooze, and tapping it deep-links to Home; a 410/404 response from the push service deletes that PushSubscription row in the same step.
  5. Tapping Done on device A writes a `ReminderLog action=done` (never reachable from the push payload), device B clears it on next sync, `next_due_at` advances per `advance_rule` (`from_scheduled` = previous scheduled + frequency regardless of snooze/late-done; `from_acted` = done timestamp + frequency); Snooze offers 1h/3h/tomorrow writing `snoozed` + `snooze_until`; subscription not in trialing/active pauses dispatch without advancing `next_due_at` and resumes on return; no push permission OR all devices offline means no nudge delivered and no missed-push backlog.
**Plans**: TBD
**UI hint**: yes

### Phase 9: Offline Queue & Sync Resilience
**Goal**: Every mutating flow shipped in Phases 5-8 (plant add, photo-journal add, reminder create/done/snooze, profile edits) tolerates airplane mode by queueing in IndexedDB, replays exactly-once after reconnect via `Idempotency-Key = client UUID`, handles stale rows with last-write-wins, drops actions targeting server-deleted plants with a single discard-summary toast, and surfaces 5-attempt failures in Settings → Needs attention.
**Depends on**: Phase 8
**Requirements**: OFF-01, OFF-02, OFF-03, OFF-04, OFF-05, OFF-06, OFF-07
**Success Criteria** (what must be TRUE):
  1. A user goes offline, performs several mutations (add plant, add photo-journal entry, mark reminder done, snooze another), closes the browser/app, reopens it while still offline, and sees the queued actions preserved in IndexedDB; going online replays them in ascending client-timestamp order and each action lands exactly once (replaying the same client UUID returns the original result via server-side `Idempotency-Key` dedupe).
  2. A queued field edit on a row that changed server-side resolves last-write-wins by server timestamp with no merge UI, and the conflict is invisible to the user.
  3. A queued action targeting a plant that was deleted server-side is dropped silently along with every other queued action for that plant; on next app open a single discard-summary toast appears, tappable to a modal grouping discarded actions by type with client timestamps (read-only).
  4. A queued action failing sync 5 times creates an `OfflineSyncFailure` row, is removed from the active queue, and appears in Settings → Needs attention with per-entry retry and discard controls.
  5. The Idempotency-Key mutation-dedupe contract from Phase 2 is verified to apply uniformly across every mutating endpoint touched by Phases 4-8, and integration tests cover duplicate replay, ordered replay, deleted-target drop, stale-row LWW, and 5-attempt failure paths against real Postgres.
**Plans**: TBD
**UI hint**: yes

### Phase 10: Billing, Trials & Read-Only Mode
**Goal**: Stripe Checkout (card + Pix) lands behind a `BillingProvider` adapter, the webhook-only state machine moves subscriptions through `trialing → active → past_due → canceled / expired` with 4×7d dunning, partner-code trials (14d organic / 30d partner) work correctly, Settings → Subscription & billing surfaces plan/PM/billing history/cancel/reactivate/partner code, and subscription-not-in-trialing/active flips the app into read-only mode (catalog readable, mutations → `read_only_mode` 402, identification → `subscription_required` 402, reminders paused).
**Depends on**: Phase 9
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04, SUB-05, SUB-06, SUB-07, SUB-08, SUB-09, SUB-10, SUB-11, SUB-12, SUB-13, SUB-14, SUB-15, SUB-16, SUB-17, SUB-18, SUB-19, SUB-20, SUB-21, SUB-22, SUB-23, NOTIF-06
**Success Criteria** (what must be TRUE):
  1. A new signup without a partner code gets `Subscription status=trialing`, `trial_end_date = created_at + 14d`, `trial_source=organic`; with a valid partner code → 30d + `trial_source=partner` + `partner_code` recorded; unknown/inactive code → `invalid_partner_code` inline error that the user clears to proceed with 14d; an organic trialing user inside-window can enter a valid partner code in Settings to extend to `created_at + 30d` (clock NOT reset); a partner trialing user cannot stack a second code and deactivating a PartnerStore does not affect already-established trials; a T-3d and T-1d `trial.ending` Inngest cron fires the right Resend emails.
  2. Trial ends with a valid PM → Stripe webhook transitions status to `active`; without PM → `expired` + read-only; an active renewal charge failure → `past_due` + payment-failed Resend email; past_due recovered → `active`; past_due exhausting 4-retry / 7-day dunning → `canceled`; user-cancel from Settings → `cancel_at_period_end=true` with UI confirming access-ends date (full access until `current_period_end`); canceled reaching `current_period_end` → `expired`; a canceled/expired non-deleted account with valid PM can reactivate as a NEW subscription in `active`; `Subscription.status` mutates ONLY via webhook handler.
  3. The Stripe webhook path is: verify signature (bad → `webhook_signature_invalid` 401, no BillingEvent, Sentry critical) → insert BillingEvent (UNIQUE(event_id) → duplicate deliveries are no-op 200) → enqueue `billing.webhook.received` → `billing/process-webhook` Inngest function transitions state + emits `subscription.status_changed` + triggers dunning email via Resend; every Stripe SDK call lives inside the `BillingProvider` adapter (`create_customer`, `start_subscription`, `cancel_subscription`, `reactivate_subscription`, `update_payment_method`, `get_subscription`, `handle_webhook`) and business logic never touches the Stripe SDK directly.
  4. A user in Stripe Checkout can pay with card or Pix and subsequently sees Settings → Subscription & billing with: current plan + status, renewal/trial-end date, PM (last-4 for card / Pix indicator), update-PM button, partner-code input (ONLY while trialing AND wall-clock < trial_end_date), cancel button, reactivate button (when canceled/expired), and billing history.
  5. A subscription not in `trialing`/`active` flips the app into read-only mode: catalog/photos/journal/care guides remain viewable; identification returns `subscription_required` 402 with the paywall modal from Phase 6; every other mutation returns `read_only_mode` 402; reminders/dispatch sends no pushes and does not advance `next_due_at`; Settings is fully accessible; a persistent read-only banner is shown — and a user reactivating with a valid PM returns all of this to normal.
**Plans**: TBD
**UI hint**: yes

### Phase 11: LGPD Data Rights & 7-Day Deletion Grace
**Goal**: A user can export every record + original photo as a zip, request account deletion with a 7-day grace window implemented via Inngest `step.sleepUntil` (cancellation races handled by embedding `grace_period_ends_at` in the event payload), revoke consents without losing catalog access, and access the Privacy & LGPD panel with DPO contact — fulfilling Art. 18 data rights and the deletion-grace ship blocker.
**Depends on**: Phase 10
**Requirements**: LGPD-01, LGPD-02, LGPD-03, LGPD-04, LGPD-05, LGPD-06, LGPD-07, LGPD-08, LGPD-10, LGPD-11, LGPD-12, LGPD-14
**Success Criteria** (what must be TRUE):
  1. From Settings → Privacy & LGPD, a user taps "Exportar meus dados" → a `DataExportRequest status=pending` row is created → `iam/generate-export` Inngest function builds a zip containing `data.json` (all the user's records) + a `photos/` directory (originals) → uploads it to the `data-exports` bucket → sets status to `ready` with a signed `download_url` (time-limited) → a "data export ready" pt-BR Resend email lands in the user's inbox with the signed URL.
  2. From the same panel, "Excluir minha conta" opens a confirm modal that — on confirmation — creates a `DataDeletionRequest` with `grace_period_ends_at = now + 7d`, sets `User.deletion_requested_at`, sends the confirmation email, and suspends the account immediately: inside grace, only cancel-deletion and read-only LGPD endpoints are reachable and every other request returns `deletion_in_progress` 403.
  3. A cancellation during grace sets `DataDeletionRequest.status=cancelled`; the `iam/process-deletion` Inngest function — which was durably asleep via `step.sleepUntil(grace_period_ends_at)` with `grace_period_ends_at` EMBEDDED in the event payload (not fetched at wake time, surviving cancellation races) — wakes, observes the cancellation, exits without deleting, and the account returns to normal access.
  4. Grace elapsed without cancellation → the function resumes, hard-deletes the user's photos + plants + ID history + reminder logs + consent rows (preserving a minimal deletion-audit record), sends a "deletion complete" email via Resend, and the deletion is reflected in the next full backup cycle within 30 days.
  5. Consent revocation from the panel records a `ConsentLog` row, preserves existing catalog access, blocks only the affected processing activity going forward, and if the privacy policy version bumps and flags material change for an activity, the next use of that activity triggers a fresh consent prompt whose grant records the new `policy_version`; the published privacy policy + ToS are live, versioned, and the DPO contact is visible both in the privacy policy and in the Settings Privacy & LGPD panel alongside links to both policies.
**Plans**: TBD
**UI hint**: yes

### Phase 12: Deploy Pipeline
**Goal**: The app ships to a real URL. Vercel project created (git integration OFF), GitHub Actions deploy workflows wire up preview-per-PR with Supabase branch DBs and production deploys to `main`, a Playwright smoke runs against each preview URL, and Sentry source maps upload post-build so production errors are symbolicated.
**Depends on**: Phase 11
**Requirements**: INFRA-11, INFRA-13, INFRA-14, INFRA-15
**Success Criteria** (what must be TRUE):
  1. A Vercel project exists for Folhário with git integration confirmed OFF (builds only run from GitHub Actions, never from Vercel's own git connector); `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are stored as GH Actions repo secrets.
  2. `deploy-preview.yml` runs on PR open/sync: depends on `ci.yml` → `supabase branches create pr-{N}` (pinned CLI version) → apply migrations to the branch DB via `drizzle-kit migrate` → `vercel pull` preview env → `vercel build` → `vercel deploy --prebuilt` → Playwright smoke against the returned preview URL → comment the URL on the PR. Concurrency group per PR so rapid pushes don't race branch creation.
  3. `deploy-preview-cleanup.yml` runs on PR close: delete the Supabase branch `pr-{N}` (pinned CLI version) and remove the Vercel preview alias.
  4. `deploy-production.yml` runs on push to `main`: depends on `ci.yml` → apply migrations to prod Supabase (manual approval gate for destructive changes) → `vercel pull` prod env → `vercel build --prod` → `vercel deploy --prebuilt --prod` → create a Sentry release tagged `$GITHUB_SHA` with Turbopack source maps uploaded → sync Inngest functions.
  5. A Playwright run against a fresh preview URL green-lights signup → verify → consent → identify happy path (against stub providers with `IDENTIFICATION_PROVIDER_MODE=stub`), and a deliberately thrown error in production is symbolicated in Sentry back to the originating TypeScript line.
**Plans**: TBD
**UI hint**: no

### Phase 13: Observability Rollups & Launch Readiness
**Goal**: Every PostHog event from the PRD taxonomy fires from the right place across all contexts, identification-quality SQL rollups run via Inngest cron and surface confidence/correction/latency/error/cap-hit/breaker/augment metrics, and the launch-blocker checklist (pricing, NFS-e, DPO, privacy policy, ≥200 care guides) is explicitly signed off before go-live.
**Depends on**: Phase 12
**Requirements**: OBS-03, OBS-04, OBS-05, INFRA-25 *(OBS-05 deferred from Phase 1 on 2026-04-23 per user decision; alert rules need real traffic to tune thresholds)*
**Success Criteria** (what must be TRUE):
  1. The PostHog event taxonomy is wired end-to-end and every event from the PRD list (`signup_completed`, `consent_granted`, `identification_started`, `identification_succeeded`, `identification_cap_hit`, `plant_added`, `reminder_created`, `reminder_acted`, `care_guide_viewed`, `trial_started`, `subscription_activated`, `subscription_canceled`, `data_export_requested`, `data_deletion_requested`) is observed in the PostHog US project during an end-to-end test run, fired from the correct layer (client vs `posthog-node` server for Inngest-emitted events).
  2. Scheduled SQL rollups via Inngest cron over the `Identification` table populate dashboards for confidence distribution, manual-correction rate, success rate, provider latency p50/p95/p99, error rate, cap-hit rate, breaker open minutes/day, augmentation success rate, and augmentation cost — and a single dashboard view surfaces them together.
  3. The launch-blocker checklist — (1) BRL monthly pricing, (2) NFS-e issuance strategy, (3) DPO appointment, (4) privacy policy + ToS published, (5) ≥200 curated care guides — is surfaced in the repo (e.g. `.planning/LAUNCH-BLOCKERS.md`) with each item explicitly checked off before production deploy, and the `IDENTIFICATION_PROVIDER_MODE` env var is set to real providers in production only.
  4. A full end-to-end Playwright run against the production-preview URL executes the <2-min core loop (signup → verify → consent → identify → catalog → care guide → reminder → push permission) and all 12 phases' acceptance criteria are green.
**Plans**: TBD
**UI hint**: no

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12 → 13

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 8/9 | In progress | - |
| 2. Data Layer & Bounded Contexts | 0/TBD | Not started | - |
| 3. Design System & App Shell | 0/TBD | Not started | - |
| 4. IAM — Auth, Verification, Consent | 0/TBD | Not started | - |
| 5. Catalog — Meu Jardim | 0/TBD | Not started | - |
| 6. Identification Flow & Cost Controls | 0/TBD | Not started | - |
| 7. Species, Care Guides & Augmentation | 0/TBD | Not started | - |
| 8. Reminders & Single Daily Push Nudge | 0/TBD | Not started | - |
| 9. Offline Queue & Sync Resilience | 0/TBD | Not started | - |
| 10. Billing, Trials & Read-Only Mode | 0/TBD | Not started | - |
| 11. LGPD Data Rights & 7-Day Deletion Grace | 0/TBD | Not started | - |
| 12. Deploy Pipeline | 0/TBD | Not started | - |
| 13. Observability Rollups & Launch Readiness | 0/TBD | Not started | - |

## Launch-Blocker Dependencies (Not Phase Tasks)

These are founder-owned prerequisites that must land before production launch but are NOT dev tasks within any phase:

1. **BRL monthly pricing decided** — required before Stripe live mode (Phase 10 uses test-mode pricing until this is set)
2. **NFS-e issuance strategy** — Stripe does not issue Brazilian service invoices; decide manual municipal portal vs NFE.io/eNotas/Omie/Enotas integration (Phase 10 lands without NFS-e; integration is v2 unless strategy chosen pre-launch)
3. **DPO (Encarregado) appointed** — contact published in privacy policy + Settings before first identification lands in production
4. **Privacy policy + ToS authored and published** — required before the Phase 4 consent flow ships to real users
5. **≥200 curated pt-BR care guides published** — founder-owned content; Phase 7 renders them but authoring is separate (CARE-09 is tracked here, not as a Phase 7 dev task)

Phase 13 gates production deploy on all five being checked off.
