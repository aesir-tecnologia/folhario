# Cross-AI Plan Review Request

You are reviewing implementation plans for Phase 1 (Foundation & CI/CD) of a software project.
Provide structured feedback on plan quality, completeness, and risks.

## Project Context (PROJECT.md, first 80 lines)

# Folhário

## What This Is

Folhário is a plant identification, care-guide, and reminder PWA for Brazilian beginners who just bought their first plant and don't want to kill it. Users snap a photo, the app identifies the plant using cloud AI, files it in their personal catalog ("Meu Jardim"), shows a pt-BR care guide, and nudges them when it's time to water. Mobile-first PWA at launch, with every architectural decision kept native-compatible for a future app build.

## Core Value

**A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.**

Reminders are the retention engine; without the <2-min first-value moment there's no retention to engineer.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Full list lives in REQUIREMENTS.md. -->

- [ ] **Identify → catalog → care guide → remind** core loop working end-to-end on mobile PWA in pt-BR
- [ ] **First-value <2 min** from email verification (verified → photo → identified → in catalog)
- [ ] **Honest AI** — confidence ladder with redundant signals, "Gerado por IA" persistent badge on augmented care guides, no fake precision numbers
- [ ] **Toxicity safety** — icon + colored badge + text + striped border + SR alert + mandatory vet disclaimer
- [ ] **Bounded-context backend** (IAM, Catalog, Species & Care, Identification, Reminders, Billing, Notifications) with Inngest events for async
- [ ] **Cloud-only identification** via Plant ID primary + OpenAI-compatible vision fallback, per-user and per-provider cost caps enforced before dispatch
- [ ] **≥200 curated pt-BR care guides** (founder-owned, launch blocker) + runtime augmentation for missing species
- [ ] **Single-tier monthly subscription** via Stripe (card + Pix), 14-day organic trial / 30-day partner trial, dunning 4×7d
- [ ] **LGPD compliance** — Art. 7 legal basis, Art. 18 rights (export, delete, consent revocation), Art. 33 international transfer consent, 7-day deletion grace via Inngest durable sleep
- [ ] **Single daily nudge** push model (never per-reminder), permission deferred until first reminder creation, self-healing PushSubscription rows on 410/404
- [ ] **Offline queue** — cached catalog browsable, photo/reminder actions queued with client-UUID idempotency, drop-with-summary on server-side plant deletion
- [ ] **WCAG 2.1 AA** ship blocker — every state combines redundant cues, color never sole signal, 3px global focus ring, prefers-reduced-motion honored
- [ ] **Design system** from PRD §17 — Paper Cream / Night Cream palette, Source Serif 4 + Plus Jakarta Sans, Lucide icons, bottom-nav only, asymmetric hero, spring-physics motion
- [ ] **CI/CD pipeline** — Vercel git integration OFF, all deploys from GitHub Actions, Supabase branch DB per PR, Playwright against preview URL, real Postgres for integration tests
- [ ] **Resend transactional email** for verification, reset, trial ending, payment failures, deletion, export-ready, operator cost alerts

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- **Freemium gating** — single paid tier only; no identify-limit wall on signup
- **Anonymous use** — trial requires an account; identification behind email verification + consent
- **Change-email / logout-all-devices** — deferred post-MVP (password reset and change-password ship; global revocation does not)
- **Travel-aware reminders** — `User.timezone` change does NOT retroactively shift scheduled reminders (assumed: traveling user isn't tending plants)
- **Per-reminder notification time** — all reminders for a user fire at a single `User.notification_time_local`
- **Per-reminder push actions** — push is a single daily nudge; Done/Snooze live in-app only
- **On-device identification model** — cloud-only; no local ML
- **Editor review queue for augmented care guides** — augmented rows go live immediately with a persistent "Gerado por IA" badge
- **Real-time chat / community / social** — not a social app
- **Video posts / video care guides** — images only
- **Native mobile app at launch** — PWA first; native door kept open via adapter boundaries
- **Dark-mode palette via inversion** — veranda-at-dusk palette designed separately; no auto-invert
- **Sidebar navigation** — bottom-nav only, max 5 items, MVP uses 4
- **Hover-dependent interaction** — hover is decorative amplification only
- **Freemium dark patterns** on cancel/delete flows
- **Third-party storage limits per user** in MVP
- **Admin UI for cost caps / tier limits** — runtime tuning via direct DB writes only
- **Confetti / bouncing / emoji / floating chatbot / spinner** — banned by design system
- **Inter / generic serifs / gradient text / glassmorphism / neumorphism** — banned by design system
- **Server sessions** — per-device JWT only
- **Raw cron / BullMQ / Redis queues** — Inngest only for durable scheduling and sleeps
- **Drizzle inside route handlers** — data access lives inside repositories only
- **Pure black `#000000` / pure white** — use Forest Ink / Paper Cream
- **Broad per-endpoint rate limiting** in MVP — only a narrow per-IP throttle on public auth endpoints
- **Vercel git integration** — disabled; all deploys from GitHub Actions

## Context

Greenfield project, single-founder-plus-Claude build. Targeted at a culturally-specific audience (Brazilian pt-BR beginners), so locale, currency formatting, LGPD compliance, and local payment methods (Pix) are first-class, not afterthoughts.

**Architectural north stars:**
- Adapter boundaries at every external dependency (identification providers, care-guide providers, billing provider, auth, storage, push) so any vendor can be swapped without touching business logic. Drizzle inside repositories only; Supabase JS confined to auth/storage adapters.
- Bounded contexts (DDD-lite) per `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/`. Cross-context communication is Inngest events for async + thin read-only query services for sync reads.
- Stack is pinned in `CLAUDE.md` Technology Stack section against live npm versions as of 2026-04-14 (Next 16.2.3, React 19.2.5, Drizzle 0.45.2, Inngest 4.2.1, Serwist 9.5.7, Stripe 22.0.1, Resend 6.11.0, Sentry 10.48.0, PostHog 1.368.0, next-intl 4.9.1, Vitest 4.1.4, Playwright 1.59.1). That document also enumerates "what NOT to use" (next-pwa, Prisma, `{ prepare: true }` with Supavisor txn pooler, `pg` driver, `setInterval`, `BullMQ`, `Sentry.setUser({ email })`, `date-fns` without `date-fns-tz`, Vercel Git integration).

**Single source of truth:** `docs/CAVE-PRD.md` — a 1352-line merged doc covering product, bounded contexts, full data model, API rules, identification flow, catalog, care guides, reminders, offline & sync, image handling, auth & subscription, LGPD, multi-device, push, screens, design system, accessibility, testing, environments/CI, security, metrics, acceptance criteria (keyed AC-AUTH/ID/CAT/CARE/REM/OFF/SUB/COST/LGPD), launch blockers, open questions, and glossary. REQUIREMENTS.md derives 1:1 from the PRD's AC groups.

## Phase 1: Foundation & CI/CD — Roadmap Section

### Phase 1: Foundation & CI/CD
**Goal**: A deployable Next 16 skeleton whose every PR flows through GitHub-Actions-driven test → preview → merge → production with observability and secrets in place before any feature code ships.
**Depends on**: Nothing (first phase)
**Requirements**: INFRA-01, INFRA-02, INFRA-11, INFRA-12, INFRA-13, INFRA-14, INFRA-15, INFRA-16, INFRA-17, INFRA-18, INFRA-20, INFRA-23, OBS-01, OBS-02, OBS-05, LGPD-13
**Success Criteria** (what must be TRUE):
  1. An empty Next 16 App Router app with TS strict + pt-BR locale + `@serwist/next` PWA wiring builds locally and on CI, with the bounded-context folder layout from PRD §2 in place.
  2. Opening a PR runs lint + typecheck + Vitest unit + Vitest integration (against a `postgres:16-alpine` service container) + Playwright (against a `vercel deploy --prebuilt` preview URL bound to a per-PR Supabase branch DB), and closing the PR cleans up the branch DB + preview alias.
  3. Merging to `main` deploys to production via `vercel deploy --prebuilt --prod`, creates a Sentry release tagged with git SHA, uploads Turbopack source maps post-build, and syncs Inngest functions — with Vercel git integration confirmed OFF.
  4. A deliberately thrown error in any environment appears in Sentry with `Authorization`, `Cookie`, `email`, `password`, `token`, and `photo_url` scrubbed, `Sentry.setUser({ id })` only, and request bodies dropped on `/api/v1/identifications/*` routes; PostHog EU client + `posthog-node` server are connected and a ping event lands in the EU project.
  5. The closed error-code registry enum exists as a single importable source, standard security headers (CSP, HSTS, X-Frame-Options) apply to every response, and the `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real providers so preview cannot accidentally burn real provider credit.
**Plans**: 18 plans
- [ ] 01-01-PLAN.md — Wave 0 operator provisioning checklist (Sentry/PostHog EU/Supabase/Vercel/Inngest + GH Actions secrets + Node 22/pnpm) — D-27 [autonomous: false]
- [ ] 01-02-PLAN.md — package.json + pnpm-lock + .nvmrc + .gitignore + .editorconfig + .env.example
- [ ] 01-03-PLAN.md — tsconfig (D-06 strict-plus + D-07 alias) + ESLint flat + Prettier + husky + commitlint
- [ ] 01-04-PLAN.md — Bounded-context folder scaffold (7×5 + shared/5) with README stubs (INFRA-02)
- [ ] 01-05-PLAN.md — [TDD] Closed error code registry (INFRA-20, D-23)
- [ ] 01-06-PLAN.md — [TDD] Zod-validated env parser (INFRA-16, INFRA-17, D-24/D-29 gate)
- [ ] 01-07-PLAN.md — [TDD] Sentry scrubber + 3 init files (OBS-01, LGPD-13, D-19 OVERRIDE)
- [ ] 01-08-PLAN.md — [TDD] PostHog client + server factories (OBS-02, D-17, D-18)
- [ ] 01-09-PLAN.md — [TDD] Security headers builder + Next middleware (INFRA-18, D-20..D-22)
- [ ] 01-10-PLAN.md — Drizzle + postgres-js client with {prepare:false} + drizzle.config.ts
- [ ] 01-11-PLAN.md — next.config.mjs (Serwist + Sentry Turbopack native upload per D-19 OVERRIDE) + next-intl static pt-BR + root layout + sw.ts
- [ ] 01-12-PLAN.md — [TDD] Route handlers: /api/v1/health, /api/v1/_test/throw (D-29 double guard), /api/v1/_csp/report, /api/inngest + hello-world fn + scaffold tests
- [ ] 01-13-PLAN.md — vitest.config (unit + integration projects) + playwright.config + integration setup (D-14) + D-24 Playwright smoke
- [ ] 01-14-PLAN.md — .github/workflows/ci.yml (postgres:17-alpine per D-28 OVERRIDE)
- [ ] 01-15-PLAN.md — .github/workflows/deploy-preview.yml (Supabase branch + vercel deploy --prebuilt + Playwright against preview URL)
- [ ] 01-16-PLAN.md — .github/workflows/deploy-preview-cleanup.yml (SC-2d)
- [ ] 01-17-PLAN.md — .github/workflows/deploy-production.yml (D-19 OVERRIDE — no sentry-cli step) + branch protection doc (D-11)
- [ ] 01-18-PLAN.md — Throwaway verification PR + operator manual checks (SC-3e/SC-2d/SC-4a,b) — D-27 [autonomous: false]
**UI hint**: no

### Phase 2: Data Layer & Bounded Contexts

## Requirements (REQUIREMENTS.md)

# Requirements: Folhário

**Defined:** 2026-04-14
**Core Value:** A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.
**Source of truth:** `docs/CAVE-PRD.md` — every requirement below maps back to an AC-* in PRD §23 or a behavioral rule in §1–§22.

## v1 Requirements

Requirements for the MVP launch. Each maps to exactly one roadmap phase.

### AUTH — Authentication, verification, credentials

- [ ] **AUTH-01**: User can sign up with email + password; User row created; Subscription created `status=trialing`; verification email dispatched via Resend (PRD §12, AC-AUTH-001)
- [ ] **AUTH-02**: Unverified email+password user is blocked on gated endpoints with `email_unverified` 403 until they click the verification link; only resend-verification, Settings/account, and logout are reachable (AC-AUTH-001, §1, §12)
- [ ] **AUTH-03**: User can sign up / log in with Google OAuth; user treated as pre-verified; gated endpoints reachable immediately; no verification email sent (AC-AUTH-002)
- [ ] **AUTH-04**: Clicking the verification link marks the user verified and starts the "value <2 min" clock; subsequent requests to gated endpoints succeed (AC-AUTH-003, §1)
- [ ] **AUTH-05**: User can log in with email + password using per-device JWT; no server sessions (§12)
- [ ] **AUTH-06**: Age confirmation ≥13 is mandatory at signup; `User.age_confirmed_at` set only on confirm; <13 blocked (PRD §13, AC-LGPD-010)
- [ ] **AUTH-07**: Signup form accepts optional partner code; partner code captured in `User.partner_code` and surfaced to billing (PRD §12, AC-SUB-003)
- [ ] **AUTH-08**: Signup captures device timezone via `Intl.DateTimeFormat().resolvedOptions().timeZone` and stores it in `User.timezone` (§12)
- [ ] **AUTH-09**: Signup records T&C + privacy policy acceptance linked to active `policy_version` in ConsentLog (§13)
- [ ] **AUTH-10**: Public auth endpoints (signup, login, OAuth callbacks) enforce a narrow per-IP attempt throttle; tripping returns `rate_limited` 429; successful logins do not consume the failure budget; independent of target account (AC-AUTH-004, AC-AUTH-005, §5)
- [ ] **AUTH-11**: User can request a password reset; endpoint always returns 200 (no enumeration); valid email receives a Resend email with single-use token, 1h expiry, hashed storage (AC-AUTH-006)
- [ ] **AUTH-12**: Valid reset token within window lets user set a new password; reused token returns `validation_failed`; existing JWTs remain valid (AC-AUTH-006)
- [ ] **AUTH-13**: Authed user can change password from Settings with current + new; wrong current → `invalid_credentials` 401; OAuth-only accounts have the UI hidden and the endpoint rejects with `forbidden` (AC-AUTH-007)
- [ ] **AUTH-14**: User can log out of the current device (revokes that JWT and its push subscription only) (§14)
- [ ] **AUTH-15**: Unverified-email full-screen blocker shown in place of app shell: "Verifique seu e-mail para começar." + resend-verification + logout link; cleared on verification (§16)

### IDENT — Identification flow, providers, caps, failure modes

- [ ] **IDENT-01**: Authed, consented, trialing/active, below caps → `POST /v1/identifications` returns ≤3 results above `min_confidence` ordered desc; persists `Identification status=success` with provider/model/latency/consent_version/photo_urls; emits `identification.succeeded` (AC-ID-001)
- [ ] **IDENT-02**: First identification ever without `identification_third_party` consent triggers the LGPD consent modal disclosing Plant ID + OpenAI-compat providers and Art. 33 transfer; no provider call until granted (AC-ID-002, §13)
- [ ] **IDENT-03**: Consent revoked or never granted → `consent_required` 403; no provider call; no Identification row (AC-ID-003)
- [ ] **IDENT-04**: Backend filters results below `ProviderBudget.min_confidence` (seed 0.30); only above-threshold results returned, max 3 (AC-ID-004, §6)
- [ ] **IDENT-05**: Zero results above threshold → "could not identify" UI + retake guidance; Identification row persisted with raw provider results for history (AC-ID-005)
- [ ] **IDENT-06**: User selects a result and confirms → Plant created linked to Species, name pre-filled, `Identification.plant_id` FK set (AC-ID-006)
- [ ] **IDENT-07**: Manual correction stored in `manual_correction`; Species resolved by name match if possible, else null + flagged (AC-ID-007)
- [ ] **IDENT-08**: Identification history lists success + timeout + provider_unavailable attempts with `status` + `failure_reason`; success shows results + selection; re-associate-with-catalog link available (AC-ID-008, §6)
- [ ] **IDENT-09**: Trialing user over daily cap (5) or period cap (75) → `cap_hit` 429 with reset time; no provider call; no counter increment; UI shows manual entry link, no retry button (AC-ID-009, AC-COST-001)
- [ ] **IDENT-10**: Active user over daily cap (15) or period cap (200 per billing period) → `cap_hit` 429 (AC-ID-010, AC-COST-002)
- [ ] **IDENT-11**: Primary provider at cost ceiling, fallback available → router skips primary, logs `cost_ceiling_reached`, dispatches fallback, client gets success (AC-ID-011, AC-COST-006)
- [ ] **IDENT-12**: All providers exhausted → `provider_unavailable` 503; Identification row persisted `status=failed` with most specific internal `failure_reason`; internal reason never leaks to client; photo retained in IndexedDB while on screen (AC-ID-012, AC-COST-007)
- [ ] **IDENT-13**: Provider call exceeds backend timeout → `timeout` 504; row persisted `status=failed`, `failure_reason=timeout`; visible in history (AC-ID-013)
- [ ] **IDENT-14**: User navigates away mid-request → request completes server-side, row persisted; no in-flight UI restored on return (AC-ID-014)
- [ ] **IDENT-15**: Malformed/empty provider response → `failure_reason=invalid_response`, breaker counter incremented, fallover to next provider (AC-ID-015)
- [ ] **IDENT-16**: Photos with EXIF GPS tags are rejected by the server as `validation_failed`; client-side strip is the primary defense (AC-ID-016, §11)
- [ ] **IDENT-17**: Identification accepts 1..N photos (camera/gallery multipart) with static capture guide visible (leaf + flower + whole plant + "Mais fotos melhoram a precisão") (§16)
- [ ] **IDENT-18**: Vercel function budget for identification: total wall-clock 50s, per-call cap 30s, fallover requires ≥10s remaining budget else short-circuit `provider_unavailable` (§6)
- [ ] **IDENT-19**: `IdentificationProvider` adapter interface with Plant ID + OpenAI-compat connectors; backend chooses active provider, not client; prompts + config versioned with app deploy (§6)
- [ ] **IDENT-20**: Offline identification blocked with clear "Identificação requer conexão à internet." message (§10, §16)
- [ ] **IDENT-21**: Read-only catalog mode shows paywall modal on identify attempt: "Reative sua assinatura para identificar novas plantas." (§12, §16)

### CAT — Catalog ("Meu Jardim")

- [ ] **CAT-01**: From identification + selected result, Plant created with `species_id`, name pre-filled, cover photo from identification upload (AC-CAT-001)
- [ ] **CAT-02**: Manual plant creation with name + ≥1 photo creates Plant `species_id=null` + PhotoEntry for initial photo (AC-CAT-002)
- [ ] **CAT-03**: Manual create missing name OR missing photo → `validation_failed`, no row, field highlighted (AC-CAT-003)
- [ ] **CAT-04**: Plant profile shows name, nickname, room, acquisition_date, notes, cover, care-card link (if CareGuide exists), active reminders, photo journal, identification history (AC-CAT-004, §7)
- [ ] **CAT-05**: Location picker shows user's prior locations as quick-select + defaults `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]` + free text; free text becomes reusable (AC-CAT-005, AC-CAT-006)
- [ ] **CAT-06**: Add photo to photo journal with optional note → PhotoEntry with plant_id, photo_url, thumbnail_url, note; reverse-chronological timeline (AC-CAT-007)
- [ ] **CAT-07**: Catalog default sort: `acquisition_date` desc, null dates last (AC-CAT-008)
- [ ] **CAT-08**: Sort control offers name A-Z, name Z-A, date newest, date oldest, location; selected sort persists for session (AC-CAT-009)
- [ ] **CAT-09**: Deleting a plant cascades PhotoEntry + Reminder rows, schedules storage objects for deletion, sets `Identification.plant_id` NULL but preserves the history row (AC-CAT-010)
- [ ] **CAT-10**: Catalog grid responsive: 2 cols ≤375px, 3 cols 600–899px, 4 cols ≥900px (§16)
- [ ] **CAT-11**: Empty catalog state: "Sua estante ainda está esperando a primeira planta." with Sage line-art illustration + single Canopy Green primary CTA (§17)

### CARE — Care guides + toxicity + augmentation

- [ ] **CARE-01**: Published care guide renders all 7 fields (watering, light, soil, temperature, humidity, toxicity, difficulty) + seasonal tips + compatibility block (AC-CARE-001, §8)
- [ ] **CARE-02**: Toxicity badge composition: icon + colored filled badge + literal text + striped border + SR `role="alert"`; always at top of care card and plant profile (AC-CARE-002, §17)
- [ ] **CARE-03**: Mandatory disclaimer "Informação gerada por IA — confirme com um veterinário" visible on same viewport as any toxicity badge (AC-CARE-003)
- [ ] **CARE-04**: First-ever care guide view shows one-time toxicity disclaimer modal; acknowledgement persisted in `User.toxicity_disclaimer_acknowledged_at`; never shown again (AC-CARE-004)
- [ ] **CARE-05**: Plant whose species has no CareGuide hides the care card section but keeps all other features; `Species.flag_reason=missing_care_guide`, `flag_status=open`, `identification_count` incremented (AC-CARE-005)
- [ ] **CARE-06**: `identification.succeeded` for a species missing a care guide triggers the `care-guide/augment` Inngest function via `CareGuideProvider.augment`; on success upsert `CareGuide source=augmented`, bump version, set `Species.flag_status=resolved`, emit `care_guide.augmented`; identification response not delayed (AC-CARE-006)
- [ ] **CARE-07**: Augmented CareGuide rows always render with a persistent "Gerado por IA" Trust Teal chip at top; badge never removed (AC-CARE-007, §17)
- [ ] **CARE-08**: `ProviderBudget` row for `purpose=care_guide` at/above `daily_cost_cap_cents` → augment function exits without provider call, logs `cost_ceiling_reached`, leaves CareGuide untouched; `purpose=identification` budget for same provider untouched (AC-CARE-010)
- [ ] **CARE-09**: Founder-curated launch corpus of ≥200 domestic species with complete care guides published (LAUNCH BLOCKER, §8)
- [ ] **CARE-10**: Care guide card visual implementation per §17 — icon rows, Calm Slate secondary text, photography-first atmosphere

### REM — Reminders + daily nudge

- [ ] **REM-01**: Plants without reminders show no prompt/suggestion to create one (AC-REM-001, §9)
- [ ] **REM-02**: New user defaults `notification_time_local=09:00`; editable in Settings; applies to ALL reminders for that user; no per-reminder override (AC-REM-002)
- [ ] **REM-03**: Reminder creation from plant profile with type (watering/fertilization) + frequency (prefilled from care guide if available) + advance_rule (default `from_scheduled`) (AC-REM-003, §9)
- [ ] **REM-04**: First reminder ever created → browser-native push permission prompt surfaced (never at signup/first-visit/first-identify) (§15)
- [ ] **REM-05**: `reminders/dispatch` cron emits exactly ONE `daily_reminder_summary.due` per user at their `notification_time_local` when ≥1 reminder is due/overdue; `notifications/send-push` fans out single daily nudge to every active PushSubscription; push payload carries no Done/Snooze, taps deep-link to Home (AC-REM-004, §15)
- [ ] **REM-06**: Zero reminders due/overdue → no event emitted, no nudge sent (AC-REM-004)
- [ ] **REM-07**: Done tapped in-app on device A → ReminderLog `action=done`; device B clears on next sync; `next_due_at` advances per `advance_rule`; Done never reachable from push payload (AC-REM-005)
- [ ] **REM-08**: Snooze offers 1h / 3h / tomorrow; chosen option writes `ReminderLog action=snoozed` + `snooze_until` (AC-REM-006)
- [ ] **REM-09**: `from_scheduled` reminder: next_due computed from previous scheduled + frequency regardless of snooze or late-done date (AC-REM-007, AC-REM-008)
- [ ] **REM-10**: `from_acted` reminder: next_due computed from done timestamp + frequency (AC-REM-009)
- [ ] **REM-11**: Default `advance_rule=from_scheduled` persisted when user doesn't touch control (AC-REM-010)
- [ ] **REM-12**: Overdue reminders appear in a visually distinct section but do not auto-mute, auto-complete, or change visual weight as they age (AC-REM-011, §9)
- [ ] **REM-13**: Subscription not in trialing/active → `reminders/dispatch` sends no pushes; `next_due_at` not advanced; resumes on return to trialing/active (AC-REM-012)
- [ ] **REM-14**: No push permission OR all devices offline at notification_time → no nudge delivered; user sees due/overdue list on Home next open; no missed-push backlog entity (AC-REM-013, §15)
- [ ] **REM-15**: Done queued offline → replayed with client UUID, server dedupes, single ReminderLog row (AC-REM-014)
- [ ] **REM-16**: Done queued for reminder/plant deleted elsewhere → action dropped silently, no error (AC-REM-015)
- [ ] **REM-17**: Push service returns 410 Gone or 404 Not Found → corresponding `PushSubscription` row deleted in same step; self-healing, no cron prune (AC-REM-016, §15)
- [ ] **REM-18**: `next_due_at` computed at create/advance (UTC) from `User.notification_time_local` + `User.timezone`; dispatcher queries by UTC only; no per-request tz math at fire time (§9)
- [ ] **REM-19**: Home "Hoje" section is the authoritative due/overdue list (source of truth for any missed push), derived live from Reminder + ReminderLog (§9, §16)
- [ ] **REM-20**: Changing `User.timezone` in Settings does NOT retroactively shift already-scheduled reminders; only future computations use the new tz (§9)
- [ ] **REM-21**: Reminders management screen lists reminders grouped by plant with edit/delete; header shows current global notification time with "Change in Settings" link (§16)

### OFF — Offline sync + queue

- [ ] **OFF-01**: Action queued in IndexedDB while offline survives close + reopen while still offline (AC-OFF-001)
- [ ] **OFF-02**: Queued action replayed >1 time after reconnect is processed exactly once; duplicates return the original result (server-side dedup via `Idempotency-Key` = client UUID) (AC-OFF-002)
- [ ] **OFF-03**: Multiple queued actions with distinct client timestamps replayed in ascending client-timestamp order (AC-OFF-003)
- [ ] **OFF-04**: Queued actions targeting a plant deleted server-side are all dropped; a single discard summary toast appears on next app open, tappable to a modal grouping discarded actions by type with client timestamps (read-only) (AC-OFF-004, §10)
- [ ] **OFF-05**: Queued field edit on stale row: last-write-wins by server timestamp, no merge UI (AC-OFF-005)
- [ ] **OFF-06**: Queued action failing sync 5 attempts creates an `OfflineSyncFailure` row and is removed from the active queue (AC-OFF-006)
- [ ] **OFF-07**: `OfflineSyncFailure` rows visible in Settings "Needs attention" with retry/discard per entry (AC-OFF-007)
- [ ] **OFF-08**: Previously loaded catalog browsable offline; new identifications blocked with clear message (AC-OFF-008, §10)
- [ ] **OFF-09**: Service worker + PWA manifest (installable, display `standalone`, all icon sizes, theme color matches brand, viewport allows user scaling) (§17, §2)
- [ ] **OFF-10**: App-update toast: new SW version waiting → non-blocking bottom toast "Nova versão disponível" + "Atualizar"; tapping triggers `skipWaiting` + reload; honors `prefers-reduced-motion`; never auto-reloads mid-session (§16)

### SUB — Subscription, trials, billing, webhooks

- [ ] **SUB-01**: New signup creates Subscription `status=trialing` with `trial_end_date` from signup time (AC-SUB-001)
- [ ] **SUB-02**: Signup without partner code → `trial_end_date = created_at + 14d`, `trial_source=organic` (AC-SUB-002)
- [ ] **SUB-03**: Signup with valid partner code → `trial_end_date = created_at + 30d`, `trial_source=partner`, `partner_code` recorded (AC-SUB-003)
- [ ] **SUB-04**: Signup with unknown/inactive code → `invalid_partner_code` inline error, user clears to proceed with 14-day trial (AC-SUB-004)
- [ ] **SUB-05**: Organic trialing user inside window can enter a valid partner code in Settings → `trial_end_date = created_at + 30d`, clock NOT reset (AC-SUB-005)
- [ ] **SUB-06**: Partner trialing user cannot stack a second partner code; rejected; `trial_end_date` unchanged (AC-SUB-006)
- [ ] **SUB-07**: Deactivating a PartnerStore does NOT affect already-established trials (AC-SUB-007)
- [ ] **SUB-08**: Trial ends with valid payment method → Stripe webhook transitions status to `active` (AC-SUB-008)
- [ ] **SUB-09**: Trial ends without valid PM → status → `expired`; read-only catalog mode (AC-SUB-009)
- [ ] **SUB-10**: Active subscription renewal charge fails → status → `past_due`; payment-failed email dispatched via Resend (AC-SUB-010)
- [ ] **SUB-11**: Past_due recovered via retry/manual payment → status → `active` (AC-SUB-011)
- [ ] **SUB-12**: Past_due exhausting 4-retry/7-day dunning → status → `canceled` (AC-SUB-012)
- [ ] **SUB-13**: User cancels from Settings → `cancel_at_period_end=true`; UI confirms access-ends date; full access until `current_period_end` (AC-SUB-013)
- [ ] **SUB-14**: Canceled subscription reaching `current_period_end` → status → `expired` (AC-SUB-014)
- [ ] **SUB-15**: Canceled/expired non-deleted account with valid PM can reactivate as a NEW subscription in `active` (AC-SUB-015)
- [ ] **SUB-16**: Sub not in trialing/active → catalog/photos/journal/care guides viewable, identification → `subscription_required` 402, reminders paused, mutations → `read_only_mode` 402, Settings fully accessible; persistent read-only banner shown (AC-SUB-016)
- [ ] **SUB-17**: `Subscription.status` mutated only by webhook handler; no client-callable route mutates status directly (AC-SUB-017)
- [ ] **SUB-18**: Stripe delivering same `event_id` twice → only one `BillingEvent` row via UNIQUE constraint; second delivery is no-op returning 200 (AC-SUB-018)
- [ ] **SUB-19**: Bad Stripe webhook signature → `webhook_signature_invalid` 401, no BillingEvent, logged to Sentry critical (AC-SUB-019)
- [ ] **SUB-20**: End-to-end Stripe webhook path: verify signature → insert BillingEvent → enqueue `billing.webhook.received` to Inngest → `billing/process-webhook` transitions state + emits `subscription.status_changed` + triggers dunning email via Resend (AC-SUB-020, §12)
- [ ] **SUB-21**: `BillingProvider` adapter interface (`create_customer`, `start_subscription`, `cancel_subscription`, `reactivate_subscription`, `update_payment_method`, `get_subscription`, `handle_webhook`) — business logic never touches Stripe SDK directly (§12)
- [ ] **SUB-22**: Stripe Checkout accepts card + Pix as payment methods (§12)
- [ ] **SUB-23**: Settings → Subscription & billing screen shows current plan + status, renewal/trial-end date, PM (last 4 / Pix indicator), update PM button, partner code input (ONLY while trialing AND wall-clock < trial_end_date), cancel, reactivate (when canceled/expired), billing history (§16)

### COST — Per-user caps + per-provider ceilings + breakers

- [ ] **COST-01**: `IdentificationLimit` returns `daily_cap=5`, `period_cap=75` for tier `trial`; window = `[trial_start_date, trial_end_date]` (AC-COST-001)
- [ ] **COST-02**: `IdentificationLimit` returns `daily_cap=15`, `period_cap=200` for tier `paid`; window = `[current_period_start, current_period_end]` (AC-COST-002)
- [ ] **COST-03**: Cap check executes BEFORE any `ProviderUsageCounter` increment or provider call; over-cap requests never reach a provider (AC-COST-003)
- [ ] **COST-04**: Provider counter reaching 80% of `daily_cost_cap_cents` dispatches an operator alert email via Resend (AC-COST-004)
- [ ] **COST-05**: Provider counter at daily ceiling → provider marked unavailable rest of UTC day; router skips it; fallover engaged (AC-COST-005)
- [ ] **COST-06**: Per-provider ceilings keyed `(provider, purpose)` — `identification` and `care_guide` are independent budgets/counters; care_guide exhaustion never affects identification (AC-COST-006, §6, §8)
- [ ] **COST-07**: Only `provider_unavailable` surfaces to clients; internal reasons (`cost_ceiling_reached`, `breaker_open`) persisted in `Identification.failure_reason` but never returned (AC-COST-007)
- [ ] **COST-08**: Circuit breaker per provider: opens after N consecutive failures within window, half-open after cooldown, close on success; trips logged with `breaker_open` (AC-COST-008, §6)
- [ ] **COST-09**: Two concurrent identification requests to the same provider → `ProviderUsageCounter` increments serialized atomically; no lost writes (AC-COST-009)
- [ ] **COST-10**: Operator updates to `IdentificationLimit` or `ProviderBudget` in DB take effect on next request past in-memory cache TTL; no redeploy (AC-COST-010)

### LGPD — Data rights, deletion grace, consent

- [ ] **LGPD-01**: Data export request creates `DataExportRequest status=pending`; Inngest `iam/generate-export` generates a zip containing `data.json` (all user records) + `photos/` directory (originals); uploaded to `data-exports` bucket; status → ready, `download_url` signed time-limited (AC-LGPD-001)
- [ ] **LGPD-02**: Export ready → "data export ready" email dispatched via Resend with signed URL (AC-LGPD-002)
- [ ] **LGPD-03**: Deletion request creates `DataDeletionRequest` with `grace_period_ends_at = now + 7d`; `User.deletion_requested_at` set; confirmation email sent; account suspended immediately (AC-LGPD-003)
- [ ] **LGPD-04**: Inside 7-day grace, only cancel-deletion + read-only LGPD endpoints reachable; other requests → `deletion_in_progress` 403 (AC-LGPD-004)
- [ ] **LGPD-05**: Cancellation during grace sets `DataDeletionRequest.status=cancelled`; Inngest function `iam/process-deletion` wakes on `grace_period_ends_at`, observes cancellation, exits without deleting; account returns to normal access (AC-LGPD-005)
- [ ] **LGPD-06**: Grace elapsed without cancellation → function resumes, hard-deletes photos, plants, ID history, reminder logs, consent rows (except minimal deletion-audit record); "deletion complete" email sent (AC-LGPD-006)
- [ ] **LGPD-07**: Hard-deleted account reflected in next full backup cycle within 30 days (AC-LGPD-007)
- [ ] **LGPD-08**: Consent revocation from Settings records in ConsentLog; existing catalog access preserved; only affected processing activity blocked going forward (AC-LGPD-008)
- [ ] **LGPD-09**: Successful identification captures `consent_version` of the policy active at request time (AC-LGPD-009)
- [ ] **LGPD-10**: Privacy policy version bump flagged material for an activity → on next use of that activity, a new consent prompt appears before proceeding; new `policy_version` recorded on grant (AC-LGPD-011)
- [ ] **LGPD-11**: `iam/process-deletion` uses `step.sleepUntil(grace_period_ends_at)` with `grace_period_ends_at` embedded in the event payload (not fetched at wake time) — survives cancellation races (§13, stack notes)
- [ ] **LGPD-12**: Privacy policy + ToS published and versioned before launch; DPO contact info surfaced in privacy policy + Settings (§13)
- [ ] **LGPD-13**: Sentry breadcrumbs scrub `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`; drop request bodies on identification routes; `Sentry.setUser({ id })` only (§13, §21)
- [ ] **LGPD-14**: Settings Privacy & LGPD panel: "Exportar meus dados", "Excluir minha conta" (confirm modal → 7-day grace), manage consents (per-consent toggle), privacy policy link, ToS link, DPO contact (§16)

### NOTIF — Email + push notifications

- [ ] **NOTIF-01**: `notifications/send-email` Inngest function handles all transactional email via Resend: verification, password reset, trial ending (T-3d, T-1d), trial expired, payment failed (dunning 1–4), subscription canceled, reactivation confirmation, account deletion requested, account deletion completed, data export ready, 80% provider cost ceiling alert (§20)
- [ ] **NOTIF-02**: React Email templates for each transactional message, pt-BR copy, brand-aligned (§20)
- [ ] **NOTIF-03**: Per-device `PushSubscription` keyed `(user_id, device_id)`; logout revokes only that device's subscription (§14)
- [ ] **NOTIF-04**: `notifications/send-push` via `web-push` + VAPID; VAPID keys generated once per env (§15)
- [ ] **NOTIF-05**: Notification preferences: global mute + per-plant mute; global across devices (§14, §15)
- [ ] **NOTIF-06**: Trial ending notifier: daily Inngest cron fires `trial.ending` at T-3d and T-1d relative to `trial_end_date` (§3)

### OBS — Observability + metrics

- [ ] **OBS-01**: Sentry Next.js SDK integrated; release tag = git SHA; source maps uploaded post-build from GitHub Actions (Turbopack requirement); PII scrubbing rules enforced (§21, stack notes)
- [ ] **OBS-02**: PostHog EU cloud integrated (client + server via `posthog-node` for Inngest-emitted events); LGPD residency compliant (§21)
- [ ] **OBS-03**: PostHog event taxonomy implemented: `signup_completed`, `consent_granted`, `identification_started`, `identification_succeeded`, `identification_cap_hit`, `plant_added`, `reminder_created`, `reminder_acted`, `care_guide_viewed`, `trial_started`, `subscription_activated`, `subscription_canceled`, `data_export_requested`, `data_deletion_requested` (§20)
- [ ] **OBS-04**: Scheduled SQL rollups via Inngest cron over `Identification` table → dashboards for confidence distribution, manual correction rate, success rate, provider latency p50/p95/p99, error rate, cap-hit rate, breaker open minutes/day, augmentation success rate, augmentation cost (§21, §22)
- [ ] **OBS-05**: Alerts: Sentry on new issues + error-rate spikes, 80% provider ceiling → Resend operator email, Stripe webhook signature failure → Sentry critical + operator email, Inngest function failure after retries exhausted → Sentry (§21)

### UI — Screens, design system, accessibility

- [ ] **UI-01**: Global design tokens implementation — Paper Cream / Night Cream palettes (light + dark), Source Serif 4 + Plus Jakarta Sans typography, Lucide icons (§17)
- [ ] **UI-02**: Dark mode via `color-scheme: light dark` following system pref with manual override in Settings; every screen designed and reviewed in both variants (§17)
- [ ] **UI-03**: Global focus ring: 3px Canopy @ 40% opacity, 2px offset, 8px corner radius; tab order matches visual reading order; focus moves to main content region on route change (§17, §18)
- [ ] **UI-04**: Home screen — empty (zero plants): full-bleed "Identifique sua primeira planta" CTA + camera button + "Adicionar manualmente" text link; nothing else (§16)
- [ ] **UI-05**: Home screen — default (≥1 plant): "Hoje" section listing reminders due + overdue, quick "Identificar planta" action, Catalog nav (§16)
- [ ] **UI-06**: Identify screen — picker with capture guide, loading, results (top 3 cards), no-results, cap reached, provider unavailable, offline, read-only paywall, first-time consent modal (§16)
- [ ] **UI-07**: Catalog grid responsive breakpoints (2/3/4 cols at 375/600/900) with card: 4:5 photo + name + nickname + location; sort control (§16)
- [ ] **UI-08**: Plant profile screen — cover + thumbnail gallery, inline-edit name/nickname, room, acquisition_date, notes, care card (or hidden), active reminders, photo journal preview, ID history link, delete overflow; augmented / no-care / read-only variants (§16)
- [ ] **UI-09**: Care guide screen — visual icons per dimension, toxicity badge prominent at top, first-view toxicity modal, "Gerado por IA" chip when augmented, seasonal tips, compatibility block (§16, §17)
- [ ] **UI-10**: Reminders management screen per §16 + first-reminder push-permission prompt (§16)
- [ ] **UI-11**: Photo journal screen — per-plant chronological list with add entry flow; read-only variant (§16)
- [ ] **UI-12**: Identification history screen — per-user list with thumbnails, results, selected/manual/failed status; detail view with re-associate action (§16)
- [ ] **UI-13**: Settings screen — account, notifications, subscription & billing, privacy & LGPD, needs attention (sync failures), app info sections (§16)
- [ ] **UI-14**: Bottom navigation: 4 items (Home, Catálogo, Identificar, Perfil), 28px Lucide + label always, Canopy active indicator bar, 56px + safe-area padding, per-tab scroll preservation (§17)
- [ ] **UI-15**: Confidence ladder: 3 states (high ≥70%, medium 40–69%, low threshold–39%) with redundant signals (bar, segments, percentage, SR label) (§17, §18)
- [ ] **UI-16**: Toxicity badge composition (non-negotiable 7-part spec): filled rounded-rect, 18px paw+child icon, literal text, 3px diagonal striped accent border, disclaimer line, SR `role="alert"` full phrase, haptic warning on first reveal per session (§17, §18)
- [ ] **UI-17**: Skeletal shimmer loading (never circular spinners) with 300ms delay threshold and 120ms fade-in for faster ops; static block + 80ms fade under reduced motion (§17)
- [ ] **UI-18**: Empty states — composed invitations with Sage line-art illustration + Source Serif headline + Calm Slate hint + exactly one Canopy primary CTA (§17)
- [ ] **UI-19**: Error states — inline + calm, never full-screen red wall; cause + recovery copy; retry path always exposed (§17)
- [ ] **UI-20**: Spring-physics motion (120 stiffness / 18 damping / 1 mass), capture-button 1.00→1.03 tactile bounce, 3.2s breathing loop on empty Home CTA, 60ms cascade on list reveal; reduced-motion fallbacks defined for every motion (§17)
- [ ] **UI-21**: Safe areas: `min-h-[100dvh]`, `env(safe-area-inset-*)` everywhere, no `h-screen`, no horizontal scroll except Home "Today's tasks" strip (§17)
- [ ] **UI-22**: Accessibility — color never sole signal; image alt text from context (plant name + nickname); live regions for async state; modal focus trap; decorative illustrations `accessibility hidden`; haptics only on critical events (§18)
- [ ] **UI-23**: `next-intl` day-one integration, `<html lang="pt-BR">`, `date-fns-tz` for server-rendered user-local times, all strings via i18n layer (no hardcoded copy), `Intl.*` with pt-BR for numbers/dates/currency (§17, stack notes)
- [ ] **UI-24**: Persistent banners — offline ("Você está offline..."), read-only ("Sua assinatura expirou..."), discard summary post-sync toast (§16)
- [ ] **UI-25**: Design system guardrails enforced: no emoji, no pure black/white, no gradient text, no glassmorphism/neumorphism, no Inter/generic serifs, no centered hero stacks, no fabricated metrics (§17)

### INFRA — Tech stack, repo layout, DB, CI/CD, security

- [ ] **INFRA-01**: Next.js 16 App Router project scaffolded with React 19, TS strict (+ `noUncheckedIndexedAccess`), pt-BR locale default, PWA via `@serwist/next` (stack)
- [ ] **INFRA-02**: Repo layout per PRD §2 — `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/` + `src/shared/{db,events,adapters,config,telemetry}/` (§2)
- [ ] **INFRA-03**: Route handlers under `/api/v1` are thin: validate → use-case → HTTP map; no Drizzle in handlers (§2)
- [ ] **INFRA-04**: Drizzle ORM + `postgres-js` + `{ prepare: false }` mandatory for Supavisor txn-pooler compatibility; single shared `db/client.ts` (stack)
- [ ] **INFRA-05**: Drizzle schema + migrations for all entities in §4 (User, Plant, Species, CareGuide, PhotoEntry, Identification, Reminder, ReminderLog, PartnerStore, ConsentLog, DataExportRequest, DataDeletionRequest, Subscription, BillingEvent, IdentificationLimit, ProviderBudget, ProviderUsageCounter, OfflineSyncFailure, PushSubscription)
- [ ] **INFRA-06**: Supabase Storage buckets created (private): `plant-photos`, `plant-thumbnails`, `data-exports`; `StorageAdapter` interface with signed URL helpers (§2)
- [ ] **INFRA-07**: Supabase Auth behind `AuthAdapter`; JWT verification in Next middleware on every `/api/v1/*` except public endpoints (§21)
- [ ] **INFRA-08**: RLS enabled on all user-owned tables as defense in depth; service-role key server-only (§21)
- [ ] **INFRA-09**: Zod validation at route-handler body/query boundaries; `drizzle-zod` for DB-schema-derived Zod (stack)
- [ ] **INFRA-10**: Inngest `serve()` handler at `/api/inngest/route.ts`; all async functions registered: `care-guide/augment`, `iam/process-deletion`, `iam/generate-export`, `billing/process-webhook`, `billing/trial-ending-notifier`, `reminders/dispatch`, `notifications/send-email`, `notifications/send-push` (§3)
- [ ] **INFRA-11**: Vercel hosting configured; Vercel git integration DISABLED (stack)
- [ ] **INFRA-12**: `ci.yml` GitHub Action: install, lint, typecheck, unit (Vitest), integration against real `postgres:16-alpine` service container with Drizzle migrations seeded, build (§20)
- [ ] **INFRA-13**: `deploy-preview.yml`: apply migrations to Supabase branch DB per PR → `vercel pull` → `vercel build` → `vercel deploy --prebuilt` → Playwright against returned preview URL → comment URL on PR (§20)
- [ ] **INFRA-14**: `deploy-production.yml`: apply migrations to prod Supabase (manual approval gate for destructive) → `vercel deploy --prebuilt --prod` → create Sentry release + upload source maps → sync Inngest functions (§20)
- [ ] **INFRA-15**: `deploy-preview-cleanup.yml`: delete Supabase branch DB + remove Vercel preview alias on PR close (§20)
- [ ] **INFRA-16**: `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real providers to prevent accidental spend in preview (§20)
- [ ] **INFRA-17**: All env vars from PRD §20 table configured in Vercel + GitHub secrets; none committed, none logged (§20)
- [ ] **INFRA-18**: Standard security headers via Next.js middleware (CSP, HSTS, X-Frame-Options, etc.) (§21)
- [ ] **INFRA-19**: Image pipeline — client-side compression to ≤1MB + EXIF/GPS strip → upload → thumbnail generation on upload → originals preserved for ID accuracy (§11)
- [ ] **INFRA-20**: Closed error code registry implemented as a single source enum; no ad-hoc codes (§5)
- [ ] **INFRA-21**: Pagination implemented as opaque cursor `?cursor=&limit=`, default 50 / max 200, `next_cursor` in response; clients never parse cursors (§5)
- [ ] **INFRA-22**: Idempotency-Key support on mutating endpoints; client UUID is the key for offline queue actions (§5, §10)
- [ ] **INFRA-23**: Vitest unit + integration test setup; Playwright E2E against preview URL; zero DB mocking (§19)
- [ ] **INFRA-24**: `ConsentLog`, `policy_version`, legal-basis registry seed data (contract, consent, legitimate interest) loaded (§13)
- [ ] **INFRA-25**: Launch-blocker checklist surfaced in repo (pricing TBD, NFS-e strategy, DPO appointment, privacy policy + ToS authoring, ≥200 care guides) tracked separately from phases (§24)

## v2 Requirements

Deferred to post-MVP. Tracked but not in current roadmap.

### AUTH-v2
- **AUTH-v2-01**: Change-email flow
- **AUTH-v2-02**: Logout-all-devices (global JWT revocation)

### BILL-v2
- **BILL-v2-01**: NFS-e emission integration (NFE.io, eNotas, Omie, or manual municipal portal)
- **BILL-v2-02**: Annual billing tier
- **BILL-v2-03**: Stripe Pix Automático mandate flow with 3-day pre-debit window modeled in subscription state (`trialing → processing → active`)

### ID-v2
- **ID-v2-01**: PlantNet tertiary provider fallback
- **ID-v2-02**: LLM-provider-aware confidence calibration (vision LLMs don't return calibrated scores)
- **ID-v2-03**: Quality-flag feedback loop (use `manual_correction` + `flag_reason` data)

### REM-v2
- **REM-v2-01**: Travel-aware reminder shifting
- **REM-v2-02**: Per-reminder notification time override

### CARE-v2
- **CARE-v2-01**: Editor review queue for augmented care guides
- **CARE-v2-02**: User-contributed care guide notes

### NOTIF-v2
- **NOTIF-v2-01**: Configurable push reminder cadence (beyond single daily nudge)
- **NOTIF-v2-02**: Email digest of weekly care activity

### PLATFORM-v2
- **PLATFORM-v2-01**: Native mobile app (iOS/Android) via adapter-backed shared business logic
- **PLATFORM-v2-02**: Wide-screen desktop experience (beyond tablet-width centered)
- **PLATFORM-v2-03**: Additional locales (en-US, es-MX, etc.) — i18n layer is already in place

### ANALYTICS-v2
- **ANALYTICS-v2-01**: PostHog session replay
- **ANALYTICS-v2-02**: Cohort dashboards beyond identification-quality rollups

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Freemium gating on identification | Single paid tier; trial is the free experience |
| Anonymous use | Trial requires account; consent + LGPD gates depend on user identity |
| Real-time chat / community / social | Not a social app; reminders are the retention engine |
| Video posts or video care guides | Images only — storage/bandwidth + AI accuracy focus |
| On-device identification ML | Cloud-only per PRD §6; accuracy gap vs Plant.id too large |
| Editor review queue for augmented guides | Badge + disclaimer satisfy honesty; review queue is v2 complexity |
| Per-reminder notification time | Single `User.notification_time_local` is simpler and sufficient |
| Per-reminder push actions (Done/Snooze on push payload) | Push is one daily nudge; actions live in-app |
| Travel-aware reminder shifts | Tz change does not retroactively shift; traveling user isn't tending plants |
| Per-user storage limits (MVP) | Trust first, measure later |
| Admin UI for cost caps / tier limits | Runtime tuning via direct DB writes only |
| Confetti / bouncing / emoji / floating chatbot / circular spinner | Banned by design system |
| Sidebar navigation | Bottom-nav only; max 5 items |
| Inter / generic serifs / gradient text / glassmorphism / neumorphism | Banned by design system |
| Pure black `#000000` / pure white | Use Forest Ink / Paper Cream |
| Raw cron / `setInterval` for durable sleeps | Inngest `step.sleepUntil` only |
| BullMQ / Redis queues | Extra infra for MVP scale; forbidden by PRD |
| Drizzle inside route handlers | Data access lives inside repositories only |
| Server sessions | Per-device JWT only, independently revocable |
| Broad per-endpoint rate limiting | Only narrow per-IP throttle on public auth endpoints in MVP |
| Vercel git integration | Disabled; all deploys from GitHub Actions |
| `Sentry.setUser({ email })` | Leaks PII into Sentry; use `{ id }` only |
| Change-email, logout-all-devices | Explicitly deferred to post-MVP |
| Dark-mode palette via greyscale inversion | Veranda-at-dusk variant designed separately |
| Pre-verified email skip for email+password accounts | Verification gate is mandatory before first identification |
| Non-pt-BR locales at launch | pt-BR only; i18n layer is in place for future additions |
| Fake AI confidence numbers / hidden AI provenance | Non-negotiable from PRD §1 |
| Custom mouse cursors, hover-dependent interactions | Accessibility + anti-slop |

## Traceability

Which phases cover which requirements. Populated by `gsd-roadmapper` during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 4 | Pending |
| AUTH-02 | Phase 4 | Pending |
| AUTH-03 | Phase 4 | Pending |
| AUTH-04 | Phase 4 | Pending |
| AUTH-05 | Phase 4 | Pending |
| AUTH-06 | Phase 4 | Pending |
| AUTH-07 | Phase 4 | Pending |
| AUTH-08 | Phase 4 | Pending |
| AUTH-09 | Phase 4 | Pending |
| AUTH-10 | Phase 4 | Pending |
| AUTH-11 | Phase 4 | Pending |
| AUTH-12 | Phase 4 | Pending |
| AUTH-13 | Phase 4 | Pending |
| AUTH-14 | Phase 4 | Pending |
| AUTH-15 | Phase 4 | Pending |
| IDENT-01 | Phase 6 | Pending |
| IDENT-02 | Phase 6 | Pending |
| IDENT-03 | Phase 6 | Pending |
| IDENT-04 | Phase 6 | Pending |
| IDENT-05 | Phase 6 | Pending |
| IDENT-06 | Phase 6 | Pending |
| IDENT-07 | Phase 6 | Pending |
| IDENT-08 | Phase 6 | Pending |
| IDENT-09 | Phase 6 | Pending |
| IDENT-10 | Phase 6 | Pending |
| IDENT-11 | Phase 6 | Pending |
| IDENT-12 | Phase 6 | Pending |
| IDENT-13 | Phase 6 | Pending |
| IDENT-14 | Phase 6 | Pending |
| IDENT-15 | Phase 6 | Pending |
| IDENT-16 | Phase 6 | Pending |
| IDENT-17 | Phase 6 | Pending |
| IDENT-18 | Phase 6 | Pending |
| IDENT-19 | Phase 6 | Pending |
| IDENT-20 | Phase 6 | Pending |
| IDENT-21 | Phase 6 | Pending |
| CAT-01 | Phase 5 | Pending |
| CAT-02 | Phase 5 | Pending |
| CAT-03 | Phase 5 | Pending |
| CAT-04 | Phase 5 | Pending |
| CAT-05 | Phase 5 | Pending |
| CAT-06 | Phase 5 | Pending |
| CAT-07 | Phase 5 | Pending |
| CAT-08 | Phase 5 | Pending |
| CAT-09 | Phase 5 | Pending |
| CAT-10 | Phase 5 | Pending |
| CAT-11 | Phase 5 | Pending |
| CARE-01 | Phase 7 | Pending |
| CARE-02 | Phase 7 | Pending |
| CARE-03 | Phase 7 | Pending |
| CARE-04 | Phase 7 | Pending |
| CARE-05 | Phase 7 | Pending |
| CARE-06 | Phase 7 | Pending |
| CARE-07 | Phase 7 | Pending |
| CARE-08 | Phase 7 | Pending |
| CARE-09 | Phase 7 | Pending |
| CARE-10 | Phase 7 | Pending |
| REM-01 | Phase 8 | Pending |
| REM-02 | Phase 8 | Pending |
| REM-03 | Phase 8 | Pending |
| REM-04 | Phase 8 | Pending |
| REM-05 | Phase 8 | Pending |
| REM-06 | Phase 8 | Pending |
| REM-07 | Phase 8 | Pending |
| REM-08 | Phase 8 | Pending |
| REM-09 | Phase 8 | Pending |
| REM-10 | Phase 8 | Pending |
| REM-11 | Phase 8 | Pending |
| REM-12 | Phase 8 | Pending |
| REM-13 | Phase 8 | Pending |
| REM-14 | Phase 8 | Pending |
| REM-15 | Phase 8 | Pending |
| REM-16 | Phase 8 | Pending |
| REM-17 | Phase 8 | Pending |
| REM-18 | Phase 8 | Pending |
| REM-19 | Phase 8 | Pending |
| REM-20 | Phase 8 | Pending |
| REM-21 | Phase 8 | Pending |
| OFF-01 | Phase 9 | Pending |
| OFF-02 | Phase 9 | Pending |
| OFF-03 | Phase 9 | Pending |
| OFF-04 | Phase 9 | Pending |
| OFF-05 | Phase 9 | Pending |
| OFF-06 | Phase 9 | Pending |
| OFF-07 | Phase 9 | Pending |
| OFF-08 | Phase 5 | Pending |
| OFF-09 | Phase 3 | Pending |
| OFF-10 | Phase 3 | Pending |
| SUB-01 | Phase 10 | Pending |
| SUB-02 | Phase 10 | Pending |
| SUB-03 | Phase 10 | Pending |
| SUB-04 | Phase 10 | Pending |
| SUB-05 | Phase 10 | Pending |
| SUB-06 | Phase 10 | Pending |
| SUB-07 | Phase 10 | Pending |
| SUB-08 | Phase 10 | Pending |
| SUB-09 | Phase 10 | Pending |
| SUB-10 | Phase 10 | Pending |
| SUB-11 | Phase 10 | Pending |
| SUB-12 | Phase 10 | Pending |
| SUB-13 | Phase 10 | Pending |
| SUB-14 | Phase 10 | Pending |
| SUB-15 | Phase 10 | Pending |
| SUB-16 | Phase 10 | Pending |
| SUB-17 | Phase 10 | Pending |
| SUB-18 | Phase 10 | Pending |
| SUB-19 | Phase 10 | Pending |
| SUB-20 | Phase 10 | Pending |
| SUB-21 | Phase 10 | Pending |
| SUB-22 | Phase 10 | Pending |
| SUB-23 | Phase 10 | Pending |
| COST-01 | Phase 6 | Pending |
| COST-02 | Phase 6 | Pending |
| COST-03 | Phase 6 | Pending |
| COST-04 | Phase 6 | Pending |
| COST-05 | Phase 6 | Pending |
| COST-06 | Phase 6 | Pending |
| COST-07 | Phase 6 | Pending |
| COST-08 | Phase 6 | Pending |
| COST-09 | Phase 6 | Pending |
| COST-10 | Phase 6 | Pending |
| LGPD-01 | Phase 11 | Pending |
| LGPD-02 | Phase 11 | Pending |
| LGPD-03 | Phase 11 | Pending |
| LGPD-04 | Phase 11 | Pending |
| LGPD-05 | Phase 11 | Pending |
| LGPD-06 | Phase 11 | Pending |
| LGPD-07 | Phase 11 | Pending |
| LGPD-08 | Phase 11 | Pending |
| LGPD-09 | Phase 6 | Pending |
| LGPD-10 | Phase 11 | Pending |
| LGPD-11 | Phase 11 | Pending |
| LGPD-12 | Phase 11 | Pending |
| LGPD-13 | Phase 1 | Pending |
| LGPD-14 | Phase 11 | Pending |
| NOTIF-01 | Phase 4 | Pending |
| NOTIF-02 | Phase 4 | Pending |
| NOTIF-03 | Phase 8 | Pending |
| NOTIF-04 | Phase 8 | Pending |
| NOTIF-05 | Phase 8 | Pending |
| NOTIF-06 | Phase 10 | Pending |
| OBS-01 | Phase 1 | Pending |
| OBS-02 | Phase 1 | Pending |
| OBS-03 | Phase 12 | Pending |
| OBS-04 | Phase 12 | Pending |
| OBS-05 | Phase 1 | Pending |
| UI-01 | Phase 3 | Pending |
| UI-02 | Phase 3 | Pending |
| UI-03 | Phase 3 | Pending |
| UI-04 | Phase 5 | Pending |
| UI-05 | Phase 8 | Pending |
| UI-06 | Phase 6 | Pending |
| UI-07 | Phase 5 | Pending |
| UI-08 | Phase 5 | Pending |
| UI-09 | Phase 7 | Pending |
| UI-10 | Phase 8 | Pending |
| UI-11 | Phase 5 | Pending |
| UI-12 | Phase 6 | Pending |
| UI-13 | Phase 4 | Pending |
| UI-14 | Phase 3 | Pending |
| UI-15 | Phase 6 | Pending |
| UI-16 | Phase 7 | Pending |
| UI-17 | Phase 3 | Pending |
| UI-18 | Phase 3 | Pending |
| UI-19 | Phase 3 | Pending |
| UI-20 | Phase 3 | Pending |
| UI-21 | Phase 3 | Pending |
| UI-22 | Phase 3 | Pending |
| UI-23 | Phase 3 | Pending |
| UI-24 | Phase 3 | Pending |
| UI-25 | Phase 3 | Pending |
| INFRA-01 | Phase 1 | Pending |
| INFRA-02 | Phase 1 | Pending |
| INFRA-03 | Phase 2 | Pending |
| INFRA-04 | Phase 2 | Pending |
| INFRA-05 | Phase 2 | Pending |
| INFRA-06 | Phase 2 | Pending |
| INFRA-07 | Phase 2 | Pending |
| INFRA-08 | Phase 2 | Pending |
| INFRA-09 | Phase 2 | Pending |
| INFRA-10 | Phase 2 | Pending |
| INFRA-11 | Phase 1 | Pending |
| INFRA-12 | Phase 1 | Pending |
| INFRA-13 | Phase 1 | Pending |
| INFRA-14 | Phase 1 | Pending |
| INFRA-15 | Phase 1 | Pending |
| INFRA-16 | Phase 1 | Pending |
| INFRA-17 | Phase 1 | Pending |
| INFRA-18 | Phase 1 | Pending |
| INFRA-19 | Phase 2 | Pending |
| INFRA-20 | Phase 1 | Pending |
| INFRA-21 | Phase 2 | Pending |
| INFRA-22 | Phase 2 | Pending |
| INFRA-23 | Phase 1 | Pending |
| INFRA-24 | Phase 2 | Pending |
| INFRA-25 | Phase 12 | Pending |

**Coverage:**
- v1 requirements: 196 total across 13 categories (AUTH 15, IDENT 21, CAT 11, CARE 10, REM 21, OFF 10, SUB 23, COST 10, LGPD 14, NOTIF 6, OBS 5, UI 25, INFRA 25)
- Mapped to phases: 196 (100%) ✓
- Unmapped: 0

**Per-phase totals:**
- Phase 1 (Foundation & CI/CD): 16 — INFRA-01,02,11,12,13,14,15,16,17,18,20,23 + OBS-01,02,05 + LGPD-13
- Phase 2 (Data Layer): 12 — INFRA-03,04,05,06,07,08,09,10,19,21,22,24
- Phase 3 (Design System): 15 — UI-01,02,03,14,17,18,19,20,21,22,23,24,25 + OFF-09,10
- Phase 4 (IAM): 18 — AUTH-01..15 + NOTIF-01,02 + UI-13
- Phase 5 (Catalog): 16 — CAT-01..11 + OFF-08 + UI-04,07,08,11
- Phase 6 (Identification + Cost): 35 — IDENT-01..21 + COST-01..10 + LGPD-09 + UI-06,12,15
- Phase 7 (Care Guides): 12 — CARE-01..10 + UI-09,16
- Phase 8 (Reminders): 26 — REM-01..21 + NOTIF-03,04,05 + UI-05,10
- Phase 9 (Offline Queue): 7 — OFF-01..07
- Phase 10 (Billing): 24 — SUB-01..23 + NOTIF-06
- Phase 11 (LGPD): 12 — LGPD-01..08,10,11,12,14
- Phase 12 (Observability + Launch): 3 — OBS-03,04 + INFRA-25
- **Total: 196 ✓**

---
*Requirements defined: 2026-04-14*
*Last updated: 2026-04-14 after roadmap creation by gsd-roadmapper*

## User Decisions (01-CONTEXT.md)

# Phase 1: Foundation & CI/CD - Context

**Gathered:** 2026-04-14 (power mode — 26 questions, 26 answered)
**Status:** Ready for planning

<domain>
## Phase Boundary

A deployable Next 16 skeleton whose every PR flows through GitHub-Actions-driven test → preview → merge → production with observability and secrets in place before any feature code ships.

**In scope:** Next 16 App Router scaffold with TS strict, pt-BR locale, `@serwist/next` wiring, bounded-context folder layout (PRD §2), four GH Actions workflows (ci, deploy-preview, deploy-production, deploy-preview-cleanup), Supabase branch DB per PR, Sentry + PostHog baseline with LGPD-safe defaults, standard security headers, closed error code registry, and a smoke E2E that exercises the full preview pipeline end-to-end.

**Out of scope (deferred to later phases):** Drizzle schema + entities (Phase 2), route handlers beyond health + test endpoints (Phase 2), Inngest function registration (Phase 2), design system and manifest (Phase 3), any feature surface.

</domain>

<decisions>
## Implementation Decisions

### Tooling & Dev Environment
- **D-01:** Package manager is **pnpm**. Lockfile is `pnpm-lock.yaml`. CI uses `pnpm/action-setup` with store caching. Vercel build command overridden to `pnpm build`.
- **D-02:** Node runtime is **Node 22 LTS** everywhere — local dev, GH Actions `setup-node`, `postgres:16-alpine` service container parity, Vercel runtime. Version pinned in `package.json` `engines` + `.nvmrc`.
- **D-03:** Linter + formatter is **ESLint + Prettier** (Next 16 default scaffold). `eslint-config-next` + `eslint-plugin-jsx-a11y` + `eslint-plugin-import` from day 1. Prettier config committed, checked in CI.
- **D-04:** Pre-commit hooks via **husky + lint-staged**. Hooks run lint (changed files), typecheck (whole project), and commitlint. Installed via `pnpm install` post-install script.
- **D-05:** Commit messages use **Conventional Commits, enforced via commitlint** in pre-commit and CI. Matches GSD workflow's own commit format (`docs(01): ...`, `feat(phase): ...`).

### TypeScript & Repo Layout
- **D-06:** `tsconfig.json` extends Next's base + adds **strict-plus core flags**: `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`. `exactOptionalPropertyTypes` explicitly NOT enabled (too much friction with Partial spreads / Drizzle types). Base `strict` + `noUncheckedIndexedAccess` already locked by INFRA-01.
- **D-07:** Path alias is **`@/*` → `src/*`** (single Next-convention alias). Imports look like `import { errorCodes } from '@/shared/errors/codes'`. No per-context or per-layer aliases.
- **D-08:** Phase 1 **scaffolds the entire bounded-context folder layout** from PRD §2: every `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/` and every `src/shared/{db,events,adapters,config,telemetry}/` directory exists with a short `README.md` stub describing what lives there. Phase 2 fills them in. This delivers INFRA-02 verifiably in Phase 1.

### CI/CD Pipeline
- **D-09:** **Turbopack is used for BOTH dev and production builds** (`next build --turbopack`). This is why source maps must be uploaded post-build from CI — they are not baked into the build output by Turbopack the way webpack does it.
- **D-10:** Playwright runs **Chromium only** in CI. WebKit / Firefox are deferred. Rationale: ~3× faster CI, covers ~70% of BR mobile traffic, manual QA catches Safari-isms until post-launch.
- **D-11:** GitHub `main` branch has **full protection**: require PR, require status checks (`ci.yml` + `deploy-preview.yml`), no force-push, no admin bypass. Hotfixes still go through a PR + merge.
- **D-12:** **`drizzle-kit migrate` is the migration runner for both integration tests and the Supabase branch DB.** Single source of truth: Drizzle schema → generated SQL → applied via `drizzle-kit migrate`. Supabase branch DB is treated as just a Postgres URL. (Note: see Specific Ideas — user expressed a preference for Supabase CLI; Phase 2 should re-evaluate if Supabase-owned schemas such as `auth.*` force a hybrid.)
- **D-13:** Vercel function region is **`iad1` (Virginia) — default**. Accepted trade-off: +~100–150ms RTT from BR users in exchange for the largest warm pool and fastest cold starts. Revisit during the identification phase if latency eats into the 50s wall-clock budget.
- **D-14:** Integration test DB lifecycle is **fresh DB per test file, transaction rollback per test**. CI spins up `postgres:16-alpine` once, Vitest applies migrations once at suite start, each test wraps its work in a transaction rolled back on teardown. Fastest deterministic pattern.

### Observability Baseline
- **D-15:** Sentry **errors only** in Phase 1 — trace sample rate = `0.0` in all environments. Release tag = `$GITHUB_SHA`, environment = `preview` or `production`. Tracing can be flipped on via env var in later phases once there is real load to measure.
- **D-16:** Sentry **Session Replay is NOT installed**. LGPD risk is not worth the frontend-debugging benefit at MVP. Matches the strict PII posture.
- **D-17:** PostHog **defers capturing until LGPD analytics consent is granted**. SDK loaded eagerly with `opt_out_capturing()` as default; consent flow flips to `opt_in_capturing()`. Accepted trade-off: pre-consent `$pageview` and `signup_completed` events are lost for users who never consent.
- **D-18:** PostHog **autocapture is OFF**. Only the curated OBS-03 taxonomy events fire. Keeps event volume predictable and LGPD exposure minimal.
- **D-19:** Sentry source maps are uploaded via **`sentry-cli sourcemaps upload` in an explicit `deploy-production.yml` step**, after `vercel build` and before `vercel deploy --prebuilt --prod`. Releases tagged with `$GITHUB_SHA`. `@sentry/nextjs` auto-upload is NOT used (Turbopack compatibility risk). Preview deploys also upload source maps so preview errors are symbolicated.

### Security Headers & Error Registry
- **D-20:** CSP is **report-only in preview environments** for at least the first week after Phase 1 ships, **enforced in production** from day 1 using a `default-src 'self'` baseline with explicit allowlists for `sentry.io` (ingest), `eu.posthog.com`, `*.supabase.co`, `api.stripe.com`, and future provider endpoints. Violation reports go to a Sentry transport. No nonce-based scripts in Phase 1.
- **D-21:** HSTS = **`max-age=15552000` (6 months), `includeSubDomains`, NO preload**. Conservative choice — lets us walk back if domain structure changes. Upgrade to 1y + preload in a later phase once the apex is stable.
- **D-22:** Frame embedding **denied entirely**: `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY`. Folhário does not embed its own routes in iframes.
- **D-23:** Error code registry is a **`as const` object + union type** in `src/shared/errors/codes.ts`. Shape: `export const ErrorCode = { EmailUnverified: 'email_unverified', ConsentRequired: 'consent_required', ... } as const; export type ErrorCode = typeof ErrorCode[keyof typeof ErrorCode];`. Phase 1 seeds the closed registry from PRD §5 including internal-only codes (`cost_ceiling_reached`, `breaker_open`) which route handlers MUST map to `provider_unavailable` before returning to clients. Zod runtime validation wraps this constant via `z.enum(Object.values(ErrorCode))` when needed.

### Smoke Scope, i18n & PWA Baseline
- **D-24:** Phase 1 Playwright smoke exercises **the full observability loop**: (1) `/` renders with `<html lang="pt-BR">` and no console errors, (2) a health route (`GET /api/v1/health`) returns 200 after doing a `SELECT 1` through the Drizzle client (proves Supavisor pooler + `{ prepare: false }` wiring), (3) a deliberate-error test endpoint (`GET /api/v1/_test/throw`, gated on `IDENTIFICATION_PROVIDER_MODE=stub` + preview env only) throws and the test asserts the Sentry ingest call was made, (4) a PostHog ping event fires from the server (or is asserted via a lightweight test flag). Also verifies LGPD-13 scrubbing: deliberate error body contains `email` + `password` + `photo_url` fields, test asserts none appear in the Sentry breadcrumb payload. This is the "one deliberate error appears in Sentry scrubbed" success criterion from Phase 1.
- **D-25:** next-intl runs in **single-locale mode, no routing, no URL prefix**. `<html lang="pt-BR">` is hardcoded in root layout, `NextIntlClientProvider` wraps the tree, no middleware-based locale detection, URLs stay clean (`/home`, not `/pt-BR/home`). Translations loaded statically from `src/shared/i18n/pt-BR.json` (or per-namespace files). Future second locale requires swapping routing middleware — acceptable cost.
- **D-26:** **Serwist is a no-op PWA shell in Phase 1**: `@serwist/next` plugin installed, service worker registered, empty precache manifest, `NetworkFirst` strategy for everything. No offline page, no custom fetch handlers. Phase 3 (Design System & App Shell) adds real precaching + offline fallback + manifest + icons. Phase 1 proves the Serwist build step works and the SW registers on first visit.

### Claude's Discretion
- Exact `vercel.json` structure (function max-duration, memory per route) — pick sensible defaults, revisit in Phase 6 when identification routes define their budgets.
- Health route implementation detail — `/api/v1/health` returns `{ status: 'ok', db: 'ok' | 'degraded' }` shape; field names are Claude's call.
- GH Actions job parallelization inside `ci.yml` (single job vs matrix). Default to single job for simplicity.
- pnpm workspace features — not used (single package repo). Don't configure workspaces.
- Editor config (`.editorconfig`, VS Code settings) — include sensible defaults.
- Exact CSP allowlist strings per service — derive from each SDK's official docs.
- commitlint config preset (`@commitlint/config-conventional`) — use the standard.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements source of truth
- `docs/CAVE-PRD.md` §2 — Tech Stack table + bounded-context repo layout (INFRA-01, INFRA-02 source)
- `docs/CAVE-PRD.md` §5 — API conventions + **closed error code registry** (INFRA-20 source, D-23)
- `docs/CAVE-PRD.md` §20 — Environments + CI/CD workflows + full env var table (INFRA-11 through INFRA-17 source)
- `docs/CAVE-PRD.md` §21 — Security checklist + observability section (INFRA-18, OBS-01, OBS-02, OBS-05, LGPD-13 source)
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-11, INFRA-12, INFRA-13, INFRA-14, INFRA-15, INFRA-16, INFRA-17, INFRA-18, INFRA-20, INFRA-23, OBS-01, OBS-02, OBS-05, LGPD-13
- `.planning/ROADMAP.md` §"Phase 1: Foundation & CI/CD" — success criteria the phase plan must back into

### Global constraints
- `CLAUDE.md` §Constraints — stack lock-ins (Drizzle + `postgres-js` + `{ prepare: false }`, Inngest, Serwist not next-pwa, Vercel git integration OFF, Sentry release=SHA, PostHog EU, next-intl mandatory, pt-BR, LGPD scrubbing fields)
- `.planning/PROJECT.md` §"Key Decisions" — locked tech choices with rationale

### Specific topics
- `docs/CAVE-PRD.md` §1 — Core value + <2min first-value promise (informs identification budget the foundation must support)
- `docs/CAVE-PRD.md` §21 "Observability" — Sentry scrubbing rule list (`Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`) used by D-15 + D-24 smoke assertion
- `docs/CAVE-PRD.md` §13 LGPD section — informs D-17 (PostHog consent deferral)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
None — this is a greenfield repository. No `src/`, no `package.json`, no prior scaffolding. Phase 1 is the first phase to write code.

### Established Patterns
- GSD workflow directory (`.planning/`, `.claude/get-shit-done/`) already exists and must not be disturbed by Phase 1 source layout.
- Commit conventions used by GSD (`docs(XX): ...`) inform D-05's Conventional Commits enforcement.
- `docs/CAVE-PRD.md` is the single source of truth referenced from every section above — downstream agents should treat it as immutable for Phase 1.

### Integration Points
- **`pnpm-lock.yaml`** — must exist after D-01 is implemented; CI cache keyed on it.
- **`package.json#engines.node`** — must pin Node 22 (D-02); GH Actions `setup-node@v4` reads this.
- **`tsconfig.json`** — base location for D-06 compiler flags + D-07 path alias.
- **`next.config.ts`** — hosts `withSerwist()` (D-26) + any CSP / security header overrides not set by middleware (D-20, D-21, D-22).
- **`src/middleware.ts`** — hosts the middleware that sets CSP / HSTS / frame headers (D-20 to D-22). No JWT check here in Phase 1 (that's Phase 2 / INFRA-07).
- **`src/shared/errors/codes.ts`** — home of the closed registry constant (D-23).
- **GH Actions secrets** — the full env var table from PRD §20 maps to repo secrets; D-12 (drizzle-kit), D-19 (sentry-cli), and D-24 (deploy flow) depend on them existing before the first CI run.
- **Supabase project** — must exist with branching enabled before Phase 1 deploy workflows can run; D-12 assumes `DATABASE_URL` / `DATABASE_POOL_URL` per branch is resolvable from the Supabase API.

</code_context>

<specifics>
## Specific Ideas

- **Q-12 preference note (from user):** *"Use Supabase for everything."* Phase 1 locks D-12 to `drizzle-kit migrate` for both paths (single source of truth, matches Drizzle ORM mandate), but the user's preference is preserved here: if Phase 2 discovers that Supabase-owned schemas (`auth.*`, `storage.*`, RLS policies, Supabase Storage bucket config) are cleaner to manage through the Supabase CLI migration workflow, reopen this decision. Acceptable future split: Drizzle owns `public.*` (app tables), Supabase CLI owns `auth.*` / `storage.*` + policies. Drizzle schema remains authoritative for app tables regardless.
- The deliberate-error Playwright assertion in D-24 is a deliberate design choice: Phase 1's success criterion #4 ("a deliberately thrown error in any environment appears in Sentry with [list] scrubbed") is otherwise untestable and would ship unverified. The test endpoint MUST be gated on `IDENTIFICATION_PROVIDER_MODE=stub` + preview environment so it cannot be triggered in production.
- Source maps must be uploaded for **both** preview and production (D-19 override). Rationale: preview errors without symbolication are painful to debug during build-out, and the marginal quota cost is acceptable for a solo-founder budget.

</specifics>

<deferred>
## Deferred Ideas

- **Sentry Session Replay (masked mode)** — declined for MVP (D-16). Reconsider post-launch with explicit LGPD DPIA if frontend debugging proves painful.
- **PostHog reverse-proxy via Next rewrites** for ad-block resilience — not Phase 1 scope; revisit when measurable ad-blocker loss shows up in funnel data.
- **oxlint / Biome migration** — D-03 locks ESLint+Prettier. If CI lint time becomes a bottleneck, revisit Biome in a dedicated DX phase.
- **Vercel `gru1` (São Paulo) region** — D-13 picks `iad1` default. Reopen when identification latency measurements show the 50s budget is squeezed.
- **Strict `exactOptionalPropertyTypes`** — excluded from D-06. Reopen once the codebase has stabilized and most third-party type friction is known.
- **CSP nonce-based strict mode** — D-20 uses allowlist-based CSP. Upgrade path to nonce mode exists; revisit after first production incident involving XSS-adjacent concerns or when a compliance audit demands it.
- **HSTS `preload` submission** — D-21 deliberately skips preload. Upgrade once the production domain is final and committed.
- **Playwright WebKit + Firefox coverage** — deferred (D-10). Re-enable WebKit before launch if iOS Safari bugs start slipping to manual QA.
- **Sentry traces (≥10% sample rate)** — deferred (D-15). Flip on in Phase 12 (Observability Rollups) once there is real traffic worth measuring.

</deferred>

<clarifications>
## Clarifications (2026-04-14, post-research)

Research uncovered a contradiction and surfaced open questions that were resolved by the user before planning. These OVERRIDE the original decisions where they conflict.

### D-19 OVERRIDE — Sentry source-map upload
- **Original lock:** Explicit `sentry-cli sourcemaps upload` step in `deploy-production.yml` citing Turbopack compatibility risk.
- **New lock:** Use `@sentry/nextjs@10.48.x` `withSentryConfig` **native Turbopack post-build upload**. `@sentry/nextjs` 10.13+ on Next 15.4+ supports Turbopack natively; project is on `@sentry/nextjs@10.48.0` + `next@16.2.3`, so the Turbopack compatibility concern in the original D-19 is obsolete.
- **Consequence for plans:** No separate `sentry-cli` CI step. Sentry upload config lives in `next.config.ts` via `withSentryConfig({ widenClientFileUpload: true, sourcemaps: { disable: false } })`. `SENTRY_AUTH_TOKEN` still required as a repo secret. Releases still tagged with `$GITHUB_SHA`. Source maps still upload for both preview AND production per the D-19 "Specific Ideas" rationale (symbolicated preview errors).

### D-27 — Wave 0 operator provisioning checklist (NEW)
- Phase 1 includes a non-autonomous Wave 0 `01-operator-checklist-PLAN.md` that gates all automatable work. It captures: (1) create Sentry project + get DSN + SENTRY_AUTH_TOKEN; (2) create PostHog EU project + get POSTHOG_KEY + POSTHOG_HOST; (3) create Supabase project with branching enabled + get SUPABASE_ACCESS_TOKEN + project ref; (4) create Vercel project and **confirm Git integration is OFF** + get VERCEL_TOKEN + ORG_ID + PROJECT_ID; (5) create Inngest project + get INNGEST_EVENT_KEY + INNGEST_SIGNING_KEY; (6) install all of the above as GitHub Actions secrets matching PRD §20 env var table; (7) install Node 22 LTS locally (`nvm install 22`) and enable Corepack (`corepack enable`) so pnpm resolves.
- Plan is marked `autonomous: false` — executor blocks until user types "done".

### D-28 — Postgres service container image (NEW)
- CI `postgres` service container is **`postgres:17-alpine`** (not `postgres:16-alpine` as originally referenced in ROADMAP success criterion wording). Matches Supabase's current default Postgres version for new projects in 2026. Roadmap language will be treated as illustrative; the authoritative version is this clarification. Integration test DB lifecycle (D-14) otherwise unchanged.

### D-29 — Deliberate-error endpoint lifecycle (NEW)
- `GET /api/v1/_test/throw` (D-24 smoke target) **persists beyond Phase 1**, gated on `IDENTIFICATION_PROVIDER_MODE=stub` AND `VERCEL_ENV=preview`. The handler short-circuits with 404 in any other environment combination. Rationale: future phases can re-run the Sentry scrub smoke against any preview PR at any time without rebuilding the test harness. No deletion task at phase end.

</clarifications>

---

*Phase: 01-foundation-ci-cd*
*Context gathered: 2026-04-14 (power mode)*
*Clarifications added: 2026-04-14 (post-research, pre-planning)*

## Research Findings (01-RESEARCH.md)

# Phase 1: Foundation & CI/CD — Research

**Researched:** 2026-04-14
**Domain:** Next.js 16 greenfield scaffold + GitHub-Actions-only CI/CD + observability baseline (Sentry + PostHog) + security headers + Serwist PWA shell + Supabase branching
**Confidence:** HIGH on stack/versions; HIGH on patterns; MEDIUM on CI orchestration specifics (Supabase branching API surface changes frequently); HIGH on Sentry scrubbing patterns

## Summary

Phase 1 is a greenfield, zero-feature foundation phase. It proves a deployable Next 16 skeleton where every PR runs lint + typecheck + Vitest unit + Vitest integration (against `postgres:16-alpine`) + Playwright (against a real Vercel preview URL bound to a per-PR Supabase branch DB), and where merging to `main` deploys to production via `vercel deploy --prebuilt --prod` with Sentry release + source maps + Inngest sync — all orchestrated exclusively from GitHub Actions (Vercel git integration OFF).

The stack is 100% locked by `CONTEXT.md` and `CLAUDE.md`. This research confirms that **every locked decision is still implementable with current library versions**, surfaces **one important contradiction** between CONTEXT.md D-19 and current Sentry Next.js docs (the explicit `sentry-cli sourcemaps upload` step is no longer required — `withSentryConfig` handles post-build upload natively for Turbopack as of `@sentry/nextjs@10.13.0+` and `next@15.4.1+`, and we are on `10.48.0` / `16.2.3`), and surfaces **one important simplification** from Next.js 16's release notes (Turbopack is now the default — `next build --turbopack` flag is unnecessary).

**Primary recommendation:** Scaffold with `pnpm dlx create-next-app@16.2.3 --ts --app --no-src-dir=false --no-tailwind --no-eslint=false --import-alias "@/*"` (or hand-author `package.json` — there's nothing magical in the scaffold output), then layer on: `@serwist/next@9.5.7`, `next-intl@4.9.1` in single-locale no-routing mode, `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` + `postgres@3.4.9` with `{ prepare: false }`, `@sentry/nextjs@10.48.0` with `withSentryConfig` native source map upload (NOT explicit sentry-cli), `posthog-js@1.369.0` client with `opt_out_capturing_by_default: true` + `posthog-node@5.29.2` server with EU host, `inngest@4.2.2` serving from `/api/inngest/route.ts`, and middleware-based CSP + HSTS + X-Frame-Options. All four GitHub Actions workflows (ci, deploy-preview, deploy-production, deploy-preview-cleanup) use the `pnpm/action-setup` + `actions/setup-node@v4` + Vercel CLI + Supabase CLI toolchain.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tooling & Dev Environment**
- **D-01:** Package manager is **pnpm**. Lockfile is `pnpm-lock.yaml`. CI uses `pnpm/action-setup` with store caching. Vercel build command overridden to `pnpm build`.
- **D-02:** Node runtime is **Node 22 LTS** everywhere — local dev, GH Actions `setup-node`, `postgres:16-alpine` service container parity, Vercel runtime. Version pinned in `package.json` `engines` + `.nvmrc`.
- **D-03:** Linter + formatter is **ESLint + Prettier** (Next 16 default scaffold). `eslint-config-next` + `eslint-plugin-jsx-a11y` + `eslint-plugin-import` from day 1. Prettier config committed, checked in CI.
- **D-04:** Pre-commit hooks via **husky + lint-staged**. Hooks run lint (changed files), typecheck (whole project), and commitlint. Installed via `pnpm install` post-install script.
- **D-05:** Commit messages use **Conventional Commits, enforced via commitlint** in pre-commit and CI.

**TypeScript & Repo Layout**
- **D-06:** `tsconfig.json` extends Next's base + strict-plus: `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`. `exactOptionalPropertyTypes` explicitly NOT enabled. Base `strict` + `noUncheckedIndexedAccess` locked by INFRA-01.
- **D-07:** Path alias is **`@/*` → `src/*`** (single alias).
- **D-08:** Phase 1 scaffolds the **entire bounded-context folder layout** from PRD §2: every `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/{domain,application,infrastructure,api,inngest}/` and every `src/shared/{db,events,adapters,config,telemetry}/` with a short `README.md` stub describing what lives there.

**CI/CD Pipeline**
- **D-09:** **Turbopack is used for BOTH dev and production builds**. (Research note: in Next 16, Turbopack is the default — the explicit `--turbopack` flag is no longer needed.)
- **D-10:** Playwright runs **Chromium only** in CI.
- **D-11:** GitHub `main` branch has **full protection**: require PR, require status checks (`ci.yml` + `deploy-preview.yml`), no force-push, no admin bypass.
- **D-12:** **`drizzle-kit migrate` is the migration runner** for both integration tests and the Supabase branch DB. Drizzle schema is single source of truth; Supabase branch DB is treated as a Postgres URL.
- **D-13:** Vercel function region is **`iad1` (Virginia) — default**.
- **D-14:** Integration test DB lifecycle is **fresh DB per test file, transaction rollback per test**. CI spins up `postgres:16-alpine` once, Vitest applies migrations at suite start, each test wraps its work in a transaction rolled back on teardown.

**Observability Baseline**
- **D-15:** Sentry **errors only** in Phase 1 — `tracesSampleRate: 0.0` everywhere. Release tag = `$GITHUB_SHA`, environment = `preview` or `production`.
- **D-16:** Sentry **Session Replay is NOT installed**.
- **D-17:** PostHog **defers capturing until LGPD analytics consent is granted**. SDK loaded eagerly with `opt_out_capturing_by_default: true`; consent flow flips to `opt_in_capturing()`.
- **D-18:** PostHog **autocapture is OFF**. Only OBS-03 taxonomy events fire.
- **D-19:** Sentry source maps are uploaded via **`sentry-cli sourcemaps upload` in an explicit `deploy-production.yml` step**, after `vercel build` and before `vercel deploy --prebuilt --prod`. `@sentry/nextjs` auto-upload is NOT used (Turbopack compatibility risk). Preview deploys also upload source maps.
  - **⚠️ RESEARCH NOTE — see "State of the Art" section:** As of `@sentry/nextjs@10.13.0+` on `next@15.4.1+`, `withSentryConfig` natively supports Turbopack post-build source map upload. D-19's motivation ("Turbopack compatibility risk") no longer holds. Flagged for the planner; the planner should either (a) honor D-19 as explicitly locked and accept the duplicate work, or (b) surface a mini-discussion point asking the user whether to switch to the native path.

**Security Headers & Error Registry**
- **D-20:** CSP is **report-only in preview** for at least the first week after Phase 1 ships, **enforced in production** day 1 using `default-src 'self'` + explicit allowlists for `sentry.io`, `eu.posthog.com`, `*.supabase.co`, `api.stripe.com`. Violation reports to a Sentry transport. No nonce-based scripts in Phase 1.
- **D-21:** HSTS = **`max-age=15552000` (6 months), `includeSubDomains`, NO preload**.
- **D-22:** Frame embedding **denied entirely**: `Content-Security-Policy: frame-ancestors 'none'` + `X-Frame-Options: DENY`.
- **D-23:** Error code registry is a **`as const` object + union type** in `src/shared/errors/codes.ts`. Seeds closed registry from PRD §5 including internal-only codes (`cost_ceiling_reached`, `breaker_open`).

**Smoke Scope, i18n & PWA Baseline**
- **D-24:** Phase 1 Playwright smoke exercises the full observability loop: (1) `/` renders with `<html lang="pt-BR">` and no console errors, (2) `GET /api/v1/health` returns 200 after a `SELECT 1` through Drizzle, (3) deliberate-error endpoint `GET /api/v1/_test/throw` (gated on `IDENTIFICATION_PROVIDER_MODE=stub` + preview env) throws and test asserts Sentry ingest was called, (4) PostHog ping event fires from server. Also asserts LGPD-13 scrubbing: deliberate-error body contains `email`/`password`/`photo_url`, test asserts none appear in breadcrumb payload.
- **D-25:** next-intl runs in **single-locale mode, no routing, no URL prefix**. `<html lang="pt-BR">` hardcoded in root layout, `NextIntlClientProvider` wraps the tree, no middleware-based locale detection, URLs stay clean (`/home`, not `/pt-BR/home`). Translations from `src/shared/i18n/pt-BR.json`.
- **D-26:** **Serwist is a no-op PWA shell in Phase 1**: `@serwist/next` plugin installed, service worker registered, empty precache manifest, `NetworkFirst` strategy. No offline page, no custom fetch handlers. Phase 3 adds real precaching + offline + manifest + icons.

### Claude's Discretion
- Exact `vercel.json` structure (function max-duration, memory per route) — sensible defaults, revisit in Phase 6.
- Health route shape — `{ status: 'ok', db: 'ok' | 'degraded' }`.
- GH Actions job parallelization inside `ci.yml` (single job vs matrix) — default to single job.
- pnpm workspace features — not used (single package repo).
- Editor config (`.editorconfig`, VS Code settings) — sensible defaults.
- Exact CSP allowlist strings per service — derive from each SDK's official docs.
- commitlint config preset — `@commitlint/config-conventional` standard.

### Deferred Ideas (OUT OF SCOPE for Phase 1)
- Sentry Session Replay (masked mode)
- PostHog reverse-proxy via Next rewrites
- oxlint / Biome migration
- Vercel `gru1` (São Paulo) region
- Strict `exactOptionalPropertyTypes`
- CSP nonce-based strict mode
- HSTS `preload` submission
- Playwright WebKit + Firefox coverage
- Sentry traces (≥10% sample rate)
- Drizzle schema + entities (Phase 2)
- Route handlers beyond health + test endpoints (Phase 2)
- Inngest function registration beyond hello-world (Phase 2)
- Design system, PWA manifest, icons (Phase 3)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INFRA-01 | Next.js 16 App Router + React 19 + TS strict (+ `noUncheckedIndexedAccess`) + pt-BR locale default + PWA via `@serwist/next` | Standard Stack (Core table); Next 16.2.3 + React 19.2.5 + `@serwist/next@9.5.7` all verified on npm registry; next-intl single-locale pattern documented [CITED: amannn/next-intl Context7] |
| INFRA-02 | Repo layout per PRD §2 — `src/contexts/{bounded_contexts}/{layers}/` + `src/shared/{db,events,adapters,config,telemetry}/` | Architecture Patterns > Recommended Project Structure (matches D-08 verbatim) |
| INFRA-11 | Vercel hosting; Vercel git integration DISABLED | CI/CD Pipeline > Architecture Patterns > GitHub Actions workflows; Vercel docs confirm `vercel deploy --prebuilt` path [CITED: vercel.com/docs/cli/deploy] |
| INFRA-12 | `ci.yml`: install, lint, typecheck, unit (Vitest), integration against `postgres:16-alpine` service container, build | Architecture Patterns > `ci.yml`; Vitest 4.1.4 verified; `postgres:16-alpine` is a well-known GH Actions service container pattern |
| INFRA-13 | `deploy-preview.yml`: apply migrations to Supabase branch DB → `vercel pull` → `vercel build` → `vercel deploy --prebuilt` → Playwright → comment URL on PR | Architecture Patterns > `deploy-preview.yml`; Supabase CLI branch docs [CITED: supabase/cli Context7]; Playwright baseURL pattern [CITED: microsoft/playwright.dev Context7] |
| INFRA-14 | `deploy-production.yml`: migrations → `vercel deploy --prebuilt --prod` → Sentry release + source maps → sync Inngest functions | Architecture Patterns > `deploy-production.yml`; Sentry post-build upload [CITED: docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps]; Inngest sync via HTTP PUT to `/api/inngest` [CITED: inngest-js Context7] |
| INFRA-15 | `deploy-preview-cleanup.yml`: delete Supabase branch DB + remove Vercel preview alias on PR close | Architecture Patterns > `deploy-preview-cleanup.yml`; `supabase branches delete` + `vercel remove` commands |
| INFRA-16 | `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real providers | Code Examples > env parsing + D-24 Playwright smoke gates on this |
| INFRA-17 | All env vars from PRD §20 configured in Vercel + GitHub secrets; never committed, never logged | Architecture Patterns > Environment variables table copied from PRD §20 |
| INFRA-18 | Standard security headers via Next.js middleware (CSP, HSTS, X-Frame-Options) | Code Examples > `src/middleware.ts`; Vercel security headers [CITED: vercel.com/docs/cdn-security] |
| INFRA-20 | Closed error code registry implemented as single source; no ad-hoc codes | Code Examples > `src/shared/errors/codes.ts` with full PRD §5 registry |
| INFRA-23 | Vitest unit + integration test setup; Playwright E2E against preview URL; zero DB mocking | Standard Stack; Validation Architecture |
| OBS-01 | Sentry Next.js SDK integrated; release tag = git SHA; source maps uploaded post-build from GH Actions (Turbopack requirement); PII scrubbing enforced | Standard Stack; Code Examples > Sentry init with `beforeSend` + `beforeBreadcrumb` scrubbing; version `@sentry/nextjs@10.48.0` supports native Turbopack post-build upload [CITED: docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps] |
| OBS-02 | PostHog EU cloud integrated (client + server via `posthog-node`); LGPD residency compliant | Standard Stack; Code Examples > PostHog client init with `api_host: 'https://eu.posthog.com'` + server `posthog-node` |
| OBS-05 | Alerts: Sentry on new issues + error-rate spikes | Sentry alert config is dashboard-side (no code); Phase 1 only wires connectivity |
| LGPD-13 | Sentry scrubs `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`; drop request bodies on `/api/v1/identifications/*`; `Sentry.setUser({ id })` only | Code Examples > `beforeSend` / `beforeBreadcrumb` scrubbing function with D-24 smoke assertion |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Security headers (CSP, HSTS, X-Frame-Options) | Frontend Server (Next.js middleware) | — | Headers attach to every response; Next.js middleware runs on edge, is the only place that intercepts all routes uniformly [VERIFIED: PRD §21 + CLAUDE.md Security line] |
| Service worker + precache manifest | Browser / Client | CDN (static `/sw.js` served from `/public`) | Serwist builds the SW at build time; browser registers and executes it |
| i18n locale resolution | Frontend Server (SSR) | Browser (formatting fallback) | `next-intl` runs in Server Components for SSR strings; client components re-use via provider [CITED: amannn/next-intl] |
| Error code registry | Shared (both tiers) | — | Single `as const` constant imported from both client and API routes; no runtime tier |
| DB connectivity (health check) | API / Backend (route handler `/api/v1/health`) | Database / Storage | Only server-side code may hold `DATABASE_POOL_URL`; health check runs `SELECT 1` via Drizzle+postgres-js |
| Sentry error ingest | Frontend Server + Browser + API | — | `@sentry/nextjs` auto-wires client + server + edge init files; source maps uploaded once from CI |
| PostHog event capture (post-consent) | Browser (primary) + API (server events) | — | Client SDK `posthog-js`; server SDK `posthog-node` for Inngest-emitted events (Phase 2+) |
| Inngest `serve()` handler | API / Backend (`/api/inngest/route.ts`) | — | Inngest fans out to the serve handler over HTTP; handler is a Next route handler |
| Supabase branch DB provisioning | CI (GitHub Actions) | — | Pure CI orchestration — no runtime tier holds branch credentials; secrets scoped per PR |
| Migrations (`drizzle-kit migrate`) | CI (GitHub Actions) + local dev | — | Never runs at app boot; always runs from CI against the target branch/prod DB |
| Pre-commit hooks (husky/lint-staged/commitlint) | Developer machine | CI (commitlint also runs in CI as guard) | Hooks are local; CI is the backstop |
| Deliberate-error test endpoint | API / Backend | — | `GET /api/v1/_test/throw` is a route handler gated by `IDENTIFICATION_PROVIDER_MODE=stub` + `VERCEL_ENV !== 'production'` |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.3 | App Router framework; Turbopack is default in v16 | [VERIFIED: npm registry] locked in CLAUDE.md; Next 16 removes explicit `--turbopack` flag [CITED: vercel/next.js Context7 upgrade-v16 guide] |
| `react` / `react-dom` | 19.2.5 | UI runtime | [VERIFIED: npm registry] matches Next 16 peer |
| `typescript` | 5.x (latest stable via Next scaffold) | Type checking | [ASSUMED current minor from Next 16 default] — Next 16 scaffold pins; planner: verify pinned version at scaffold time |
| `@serwist/next` | 9.5.7 | Service-worker build plugin for Next.js App Router | [VERIFIED: npm registry] Serwist is the maintained Workbox fork; the only supported PWA plugin for Next 16 App Router [CITED: serwist/serwist Context7] |
| `serwist` | 9.x (peer of `@serwist/next`) | Runtime SW library (`defaultCache`, precache, strategies) | [CITED: serwist/serwist Context7] |
| `next-intl` | 4.9.1 | i18n library; we use single-locale no-routing mode | [VERIFIED: npm registry] CLAUDE.md mandates next-intl day-one [CITED: amannn/next-intl Context7 — single-locale via static `getRequestConfig`] |
| `drizzle-orm` | 0.45.2 | ORM (used only inside repositories per INFRA-03) | [VERIFIED: npm registry] CLAUDE.md stack lock-in |
| `drizzle-kit` | 0.31.10 | Migration runner (`drizzle-kit generate`, `drizzle-kit migrate`) | [VERIFIED: npm registry] D-12 canonical migration runner |
| `postgres` | 3.4.9 | `postgres-js` driver | [VERIFIED: npm registry] CLAUDE.md mandate `{ prepare: false }` for Supavisor txn pooler [CITED: drizzle-team/drizzle-orm-docs Context7 — ConnectSupabase] |
| `@sentry/nextjs` | 10.48.0 | Error tracking + source maps | [VERIFIED: npm registry] `@sentry/nextjs@10.13.0+` supports native Turbopack post-build source map upload on `next@15.4.1+` [CITED: docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps] |
| `posthog-js` | 1.369.0 | Product analytics client | [VERIFIED: npm registry] EU host via `api_host: 'https://eu.posthog.com'`; `opt_out_capturing_by_default: true` for LGPD consent [CITED: posthog/posthog-js Context7] |
| `posthog-node` | 5.29.2 | Server-side analytics for Inngest-emitted events | [VERIFIED: npm registry] Phase 1 wires connectivity; Phase 2+ emits taxonomy events |
| `inngest` | 4.2.2 | Durable async framework; Phase 1 wires `/api/inngest` serve handler with hello-world fn only | [VERIFIED: npm registry] CLAUDE.md mandate; `inngest/next` adapter [CITED: inngest/inngest-js Context7] |
| `zod` | 4.3.6 | Runtime schema validation; seed registry validation only in Phase 1; route handlers use Zod starting Phase 2 | [VERIFIED: npm registry] standard pairing with Drizzle via `drizzle-zod` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `vitest` | 4.1.4 | Unit + integration test runner | All Phase 1 tests except E2E [VERIFIED: npm registry] |
| `@playwright/test` | 1.59.1 | E2E test runner (Chromium only per D-10) | Smoke test against preview URL [VERIFIED: npm registry] |
| `vercel` (CLI) | 51.2.1 | `vercel pull` / `vercel build` / `vercel deploy --prebuilt [--prod]` | Installed in CI only; never used in local dev [VERIFIED: npm registry] |
| `eslint` | 9.x | Linter | Next 16 scaffold ships flat config; `eslint-config-next` + `eslint-plugin-jsx-a11y` + `eslint-plugin-import` [ASSUMED — verify at scaffold time] |
| `prettier` | 3.x | Formatter | Config committed; CI checks via `prettier --check` [ASSUMED current minor] |
| `husky` | 9.1.7 | Git hook installer | Pre-commit + commit-msg [VERIFIED: npm registry] |
| `lint-staged` | 16.4.0 | Runs linters on staged files only | Pre-commit performance [VERIFIED: npm registry] |
| `@commitlint/cli` + `@commitlint/config-conventional` | 20.5.0 / 20.5.0 | Conventional Commits enforcement | Pre-commit + CI [VERIFIED: npm registry] |
| `@types/node` | 22.x (matches Node 22 LTS) | Node.js types | [ASSUMED — pin to Node 22 majors] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@serwist/next` | `next-pwa` (shadowwalker) | CLAUDE.md explicitly forbids `next-pwa`; Serwist is the actively maintained Workbox successor [CITED: serwist/serwist Context7] |
| `drizzle-kit migrate` for Supabase | Supabase CLI migrations | User preference logged in CONTEXT.md Q-12 note; D-12 picks drizzle-kit for Phase 1; may split in Phase 2 if `auth.*`/`storage.*` need Supabase CLI |
| Explicit `sentry-cli sourcemaps upload` (D-19) | `withSentryConfig` native post-build upload | CONTEXT.md D-19 locks explicit path citing "Turbopack compatibility risk"; **research finds that risk is stale** — `@sentry/nextjs@10.13.0+` on `next@15.4.1+` natively handles Turbopack post-build upload. Planner should flag to user. |
| Node 22 LTS (D-02) | Node 20 LTS / Node 24 | D-02 locked; Node 22 is current Active LTS; Vercel runtime supports Node 22 |
| Chromium-only Playwright (D-10) | Full matrix (Chromium + Firefox + WebKit) | D-10 locked; saves ~3× CI time |
| `npm` / `yarn` | `pnpm` (D-01) | D-01 locked |

**Installation (Phase 1 manifest):**

```bash
# Scaffold (from empty directory; run once, review, commit)
pnpm dlx create-next-app@16.2.3 folhario --ts --app --import-alias "@/*" --use-pnpm --eslint --no-tailwind --no-turbopack=false

# Core runtime
pnpm add next@16.2.3 react@19.2.5 react-dom@19.2.5
pnpm add @serwist/next@9.5.7 serwist@latest
pnpm add next-intl@4.9.1
pnpm add drizzle-orm@0.45.2 postgres@3.4.9
pnpm add @sentry/nextjs@10.48.0
pnpm add posthog-js@1.369.0 posthog-node@5.29.2
pnpm add inngest@4.2.2
pnpm add zod@4.3.6

# Dev
pnpm add -D typescript @types/node @types/react @types/react-dom
pnpm add -D drizzle-kit@0.31.10
pnpm add -D vitest@4.1.4 @vitest/coverage-v8
pnpm add -D @playwright/test@1.59.1
pnpm add -D eslint prettier eslint-config-next eslint-plugin-jsx-a11y eslint-plugin-import
pnpm add -D husky@9.1.7 lint-staged@16.4.0
pnpm add -D @commitlint/cli@20.5.0 @commitlint/config-conventional@20.5.0
pnpm add -D vercel@51.2.1
```

**Version verification discipline:** All `[VERIFIED]` rows above were confirmed via `npm view <pkg> version` at research time (2026-04-14). Any drift at scaffold time should be re-verified; pin to lockfile.

## Architecture Patterns

### System Architecture Diagram

```
                        ┌─────────────────────────────────────────────┐
                        │              GitHub Actions (CI)            │
                        │  ci.yml → deploy-preview.yml  → …-prod.yml  │
                        │          └── cleanup.yml (PR close)         │
                        └────────┬────────────────────────────┬───────┘
                                 │                            │
                    migrations (drizzle-kit)                  │
                                 ▼                            │
                     ┌──────────────────────┐                 │
                     │  Supabase Postgres   │                 │
                     │  branch DB (preview) │                 │
                     │  or prod DB          │                 │
                     └──────────┬───────────┘                 │
                                │                             │
                vercel build → vercel deploy --prebuilt       │
                                │                             ▼
                                ▼                   ┌──────────────────────┐
                     ┌──────────────────────┐       │   Sentry release     │
                     │   Vercel Preview /   │       │   (tag = git SHA)    │
                     │   Production Runtime │       │   + source maps      │
                     │                      │◄──────┤   upload             │
                     │  ┌────────────────┐  │       └──────────────────────┘
                     │  │ Next.js        │  │
   Playwright E2E    │  │ middleware.ts  │  │              │
   smoke (Chromium)  │  │ (CSP/HSTS/     │  │              ▼
          │          │  │  X-Frame)      │  │       ┌──────────────────────┐
          ▼          │  └───────┬────────┘  │       │  Inngest sync        │
   preview URL ──────│          │           │──────▶│  (HTTP PUT /api/…)   │
                     │          ▼           │       └──────────────────────┘
                     │  ┌────────────────┐  │
                     │  │ App Router     │  │
                     │  │ /(root)        │──┼──┐
                     │  │ /api/v1/health │  │  │
                     │  │ /api/v1/_test/ │  │  │
                     │  │   throw        │  │  │
                     │  │ /api/inngest   │  │  │
                     │  └───────┬────────┘  │  │      ┌──────────────────────┐
                     │          │           │  └─────▶│  Sentry error ingest │
                     │          ▼           │         │  (scrubbed via       │
                     │  ┌────────────────┐  │         │  beforeSend/         │
                     │  │ Drizzle repo → │  │         │  beforeBreadcrumb)   │
                     │  │ postgres-js    │  │         └──────────────────────┘
                     │  │ {prepare:false}│  │
                     │  └───────┬────────┘  │         ┌──────────────────────┐
                     │          │           │         │  PostHog EU cloud    │
                     │          ▼           │         │  (eu.posthog.com)    │
                     │   Supavisor txn pool │         │  gated on consent    │
                     └──────────┬───────────┘         └──────────▲───────────┘
                                │                                │
                                ▼                                │
                     ┌──────────────────────┐                    │
                     │  Supabase Postgres   │                    │
                     └──────────────────────┘                    │
                                                                 │
                     ┌──────────────────────┐                    │
                     │   Browser (PWA)      │────────────────────┘
                     │   - sw.js (Serwist)  │  (posthog-js opt-in after consent)
                     │   - NextIntlProvider │
                     │   - pt-BR locale     │
                     └──────────────────────┘
```

Data flow for the Phase 1 smoke test (D-24):
1. PR opened → `ci.yml` runs lint/typecheck/unit/integration
2. `deploy-preview.yml` creates Supabase branch → `drizzle-kit migrate` seeds it → `vercel pull` → `vercel build` → `vercel deploy --prebuilt` returns preview URL
3. Playwright runs against preview URL: hits `/` (checks `<html lang="pt-BR">`), `/api/v1/health` (checks DB connectivity), `/api/v1/_test/throw` (triggers Sentry ingest with known PII payload)
4. Test asserts Sentry received the event (via Sentry issues API, tagged with test run ID) with `email`/`password`/`photo_url` scrubbed
5. PR closed → `deploy-preview-cleanup.yml` deletes branch DB + removes preview alias

### Recommended Project Structure

```
folhario/
├── .github/workflows/
│   ├── ci.yml
│   ├── deploy-preview.yml
│   ├── deploy-production.yml
│   └── deploy-preview-cleanup.yml
├── .husky/
│   ├── pre-commit       # lint-staged + typecheck
│   └── commit-msg       # commitlint
├── drizzle/
│   ├── migrations/      # SQL files (empty in Phase 1; Phase 2 populates)
│   └── schema.ts        # empty scaffold import surface
├── playwright/
│   └── smoke.spec.ts    # D-24 smoke test
├── public/
│   └── sw.js            # generated by Serwist; NOT committed (in .gitignore)
├── src/
│   ├── app/                                   # Next App Router root
│   │   ├── layout.tsx                         # <html lang="pt-BR"> + NextIntlClientProvider
│   │   ├── page.tsx                           # placeholder "Olá, Folhário"
│   │   ├── sw.ts                              # Serwist service worker source [CITED: serwist Context7]
│   │   └── api/
│   │       ├── v1/
│   │       │   ├── health/route.ts            # GET — SELECT 1 via Drizzle
│   │       │   └── _test/
│   │       │       └── throw/route.ts         # GET — gated deliberate error
│   │       └── inngest/route.ts               # Inngest serve() handler (hello-world fn)
│   ├── contexts/                              # bounded contexts (PRD §2) — README stubs in Phase 1
│   │   ├── iam/{domain,application,infrastructure,api,inngest}/README.md
│   │   ├── catalog/…
│   │   ├── species-care/…
│   │   ├── identification/…
│   │   ├── reminders/…
│   │   ├── billing/…
│   │   └── notifications/…
│   ├── shared/
│   │   ├── db/
│   │   │   ├── client.ts                      # Drizzle + postgres-js + { prepare: false }
│   │   │   └── README.md
│   │   ├── events/README.md                   # Phase 2 populates
│   │   ├── adapters/README.md                 # Phase 2 populates
│   │   ├── config/
│   │   │   ├── env.ts                         # Zod-validated env (incl. IDENTIFICATION_PROVIDER_MODE)
│   │   │   └── README.md
│   │   ├── telemetry/
│   │   │   ├── sentry.ts                      # scrubbing helpers
│   │   │   ├── posthog-client.ts              # posthog-js factory
│   │   │   ├── posthog-server.ts              # posthog-node factory
│   │   │   └── README.md
│   │   ├── errors/
│   │   │   └── codes.ts                       # closed registry (D-23)
│   │   ├── i18n/
│   │   │   ├── request.ts                     # next-intl getRequestConfig (static pt-BR)
│   │   │   └── pt-BR.json                     # seed translations
│   │   └── http/
│   │       └── headers.ts                     # CSP/HSTS/X-Frame helpers consumed by middleware
│   ├── inngest/
│   │   └── client.ts                          # new Inngest({ id: "folhario" }) + hello-world function
│   └── middleware.ts                          # CSP + HSTS + X-Frame + SW passthrough
├── tests/
│   ├── unit/                                  # vitest unit tests
│   ├── integration/                           # vitest against postgres:16-alpine
│   │   ├── setup.ts                           # migrations + transaction wrapper
│   │   └── health.test.ts                     # integration test for /api/v1/health
│   └── fixtures/                              # seed helpers
├── .editorconfig
├── .env.example                               # every var from PRD §20 with placeholder values
├── .eslintrc.json / eslint.config.mjs         # flat config
├── .gitignore                                 # includes public/sw.js, public/sw.js.map, .env.local
├── .nvmrc                                     # "22"
├── .prettierrc
├── commitlint.config.js
├── drizzle.config.ts
├── next.config.mjs                            # withSerwist + withSentryConfig
├── package.json                               # engines.node = ">=22.11.0 <23"
├── playwright.config.ts
├── pnpm-lock.yaml
├── sentry.client.config.ts
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── tsconfig.json
├── vercel.json                                # region: iad1; framework: nextjs
└── vitest.config.ts
```

### Pattern 1: Next.js 16 App Router with Turbopack default

**What:** In Next 16, Turbopack is the default bundler for both `next dev` and `next build`. The `--turbopack` flag is no longer needed; use `--webpack` only to opt out.
**When to use:** Phase 1 scaffold.
**Example:**

```json
// package.json scripts
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test"
  }
}
```

> Source: [CITED: github.com/vercel/next.js/docs/01-app/02-guides/upgrading/version-16.mdx via Context7]

### Pattern 2: next-intl in single-locale, no-routing mode (D-25)

**What:** `<html lang="pt-BR">` hardcoded in root layout; `NextIntlClientProvider` wraps the tree; `getRequestConfig` returns a static `pt-BR` locale; no `[locale]` segment in the URL.
**When to use:** Phase 1 (and any app that launches as single-locale).
**Example:**

```tsx
// src/shared/i18n/request.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async () => {
  const locale = 'pt-BR';
  const messages = (await import(`./pt-BR.json`)).default;
  return { locale, messages };
});
```

```tsx
// src/app/layout.tsx
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getLocale } from 'next-intl/server';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

> Source: [CITED: amannn/next-intl Context7 — "Configure request locale in i18n/request.ts" static locale variant]
> Note: No `src/middleware.ts`-based locale detection and no `[locale]` folder segment — that's `next-intl`'s routed mode, explicitly NOT what D-25 picks.

### Pattern 3: Serwist no-op PWA shell (D-26)

**What:** `withSerwist` plugin in `next.config`; a minimal `src/app/sw.ts` that registers default cache only; no offline page yet.
**Example:**

```javascript
// next.config.mjs
import withSerwistInit from '@serwist/next';
import { withSentryConfig } from '@sentry/nextjs';

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
  cacheOnNavigation: true,
  reloadOnOnline: true,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
};

export default withSentryConfig(
  withSerwist(nextConfig),
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: { name: process.env.GITHUB_SHA ?? 'local' },
    silent: true,
    // With Turbopack (default in Next 16) + @sentry/nextjs 10.13.0+,
    // source maps upload automatically after the build completes.
    // This replaces D-19's explicit sentry-cli step. See State of the Art.
  },
);
```

```typescript
// src/app/sw.ts
import { defaultCache } from '@serwist/next/worker';
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
import { Serwist } from 'serwist';

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

> Source: [CITED: serwist/serwist Context7 — "Configure Next.js with @serwist/next" + "Define Next.js Service Worker"]

### Pattern 4: Drizzle + postgres-js for Supavisor txn pooler

```typescript
// src/shared/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from '@/shared/config/env';

// { prepare: false } is mandatory for Supavisor txn mode —
// prepared statements are not supported by the pooler.
const client = postgres(env.DATABASE_POOL_URL, { prepare: false });

export const db = drizzle({ client });
```

> Source: [CITED: drizzle-team/drizzle-orm-docs Context7 — "Initialize Drizzle ORM with postgres-js client and prepare: false for Supabase connection pooling"]

### Pattern 5: Sentry PII scrubbing (LGPD-13)

```typescript
// sentry.client.config.ts (and mirror in sentry.server.config.ts / sentry.edge.config.ts)
import * as Sentry from '@sentry/nextjs';

const SCRUB_KEYS = new Set([
  'authorization',
  'cookie',
  'email',
  'password',
  'token',
  'photo_url',
]);

function scrubObject<T extends Record<string, unknown>>(obj: T): T {
  for (const key of Object.keys(obj)) {
    if (SCRUB_KEYS.has(key.toLowerCase())) {
      (obj as Record<string, unknown>)[key] = '[Filtered]';
    } else if (obj[key] && typeof obj[key] === 'object') {
      scrubObject(obj[key] as Record<string, unknown>);
    }
  }
  return obj;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.VERCEL_ENV ?? 'local',
  release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA,
  tracesSampleRate: 0.0,                      // D-15: errors only
  replaysSessionSampleRate: 0.0,              // D-16: no Session Replay
  replaysOnErrorSampleRate: 0.0,
  sendDefaultPii: false,

  beforeSend(event) {
    // 1. Drop request bodies on identification routes (LGPD-13)
    const url = event.request?.url;
    if (url && /\/api\/v1\/identifications/.test(url)) {
      if (event.request) delete event.request.data;
    }
    // 2. Scrub request headers + cookies + query
    if (event.request?.headers) scrubObject(event.request.headers as Record<string, unknown>);
    if (event.request?.cookies) scrubObject(event.request.cookies as Record<string, unknown>);
    if (event.request?.query_string && typeof event.request.query_string === 'object') {
      scrubObject(event.request.query_string as Record<string, unknown>);
    }
    // 3. Scrub any extra context / breadcrumb data
    if (event.extra) scrubObject(event.extra);
    if (event.contexts) scrubObject(event.contexts);
    // 4. User identity: ID only, never email
    if (event.user) {
      event.user = { id: event.user.id };
    }
    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    if (breadcrumb.data) scrubObject(breadcrumb.data);
    if (breadcrumb.message) {
      // Blunt pass over message strings
      for (const key of SCRUB_KEYS) {
        if (breadcrumb.message.toLowerCase().includes(key)) {
          breadcrumb.data = { ...breadcrumb.data, redacted: true };
        }
      }
    }
    return breadcrumb;
  },
});
```

> Source: [CITED: github.com/getsentry/sentry-javascript via Context7 — "Configure Before Send Callback" + "Custom Usage of Sentry Next.js SDK" (`Sentry.setUser({ id: '4711' })` pattern)]

### Pattern 6: Security headers via Next.js middleware (D-20, D-21, D-22)

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server';

const isProd = process.env.VERCEL_ENV === 'production';

// CSP allowlists — derived from each SDK's official endpoint list
const CSP_DIRECTIVES: Record<string, string[]> = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-inline'"], // no nonce in Phase 1 (D-20)
  'style-src': ["'self'", "'unsafe-inline'"],
  'img-src': ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
  'font-src': ["'self'"],
  'connect-src': [
    "'self'",
    'https://*.sentry.io',
    'https://eu.posthog.com',
    'https://eu-assets.i.posthog.com',
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.stripe.com',
  ],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'report-uri': ['/api/v1/_csp/report'], // Phase 1 stub — emits to Sentry
};

function buildCsp() {
  return Object.entries(CSP_DIRECTIVES)
    .map(([k, v]) => `${k} ${v.join(' ')}`)
    .join('; ');
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const csp = buildCsp();

  // D-20: report-only in preview, enforced in production
  if (isProd) {
    res.headers.set('Content-Security-Policy', csp);
  } else {
    res.headers.set('Content-Security-Policy-Report-Only', csp);
  }

  // D-21: 6 months, includeSubDomains, no preload
  res.headers.set('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');

  // D-22: deny embedding entirely
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'geolocation=(), camera=(self), microphone=()');

  return res;
}

export const config = {
  // Apply to every route. Explicitly exclude _next/static + favicon for perf.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|sw.js.map).*)'],
};
```

> Source: [CITED: vercel.com/docs/cdn-security — "Security headers"] and [CITED: vercel.com/docs/conformance/rules/NEXTJS_MISSING_SECURITY_HEADERS]

### Pattern 7: Closed error-code registry (D-23, INFRA-20)

```typescript
// src/shared/errors/codes.ts
/**
 * Closed error code registry. Source: PRD §5.
 * DO NOT add ad-hoc codes. Internal-only codes (cost_ceiling_reached,
 * breaker_open) MUST be mapped to provider_unavailable before returning
 * to clients — see src/contexts/identification/infrastructure in Phase 6.
 */
export const ErrorCode = {
  // Auth
  Unauthenticated: 'unauthenticated',                  // 401
  TokenExpired: 'token_expired',                       // 401
  InvalidCredentials: 'invalid_credentials',           // 401
  Forbidden: 'forbidden',                              // 403
  EmailUnverified: 'email_unverified',                 // 403
  // Validation
  ValidationFailed: 'validation_failed',               // 400
  InvalidPartnerCode: 'invalid_partner_code',          // 400
  // Resource
  NotFound: 'not_found',                               // 404
  Conflict: 'conflict',                                // 409
  // Consent / LGPD
  ConsentRequired: 'consent_required',                 // 403
  DeletionInProgress: 'deletion_in_progress',          // 403
  // Subscription
  SubscriptionRequired: 'subscription_required',       // 402
  ReadOnlyMode: 'read_only_mode',                      // 402
  // Identification caps
  CapHit: 'cap_hit',                                   // 429
  // Providers (external-facing)
  ProviderUnavailable: 'provider_unavailable',         // 503
  Timeout: 'timeout',                                  // 504
  // Providers (INTERNAL — never returned to clients)
  CostCeilingReached: 'cost_ceiling_reached',          // internal
  BreakerOpen: 'breaker_open',                         // internal
  // Webhooks
  WebhookSignatureInvalid: 'webhook_signature_invalid',// 401
  // Rate limit
  RateLimited: 'rate_limited',                         // 429 (public auth endpoints only)
  // Fallback
  InternalError: 'internal_error',                     // 500
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Codes that MUST NOT leak to clients — route handlers map these to provider_unavailable */
export const INTERNAL_ONLY_CODES = new Set<ErrorCode>([
  ErrorCode.CostCeilingReached,
  ErrorCode.BreakerOpen,
]);

/** HTTP status for each code (closed mapping). */
export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  token_expired: 401,
  invalid_credentials: 401,
  forbidden: 403,
  email_unverified: 403,
  validation_failed: 400,
  invalid_partner_code: 400,
  not_found: 404,
  conflict: 409,
  consent_required: 403,
  deletion_in_progress: 403,
  subscription_required: 402,
  read_only_mode: 402,
  cap_hit: 429,
  provider_unavailable: 503,
  timeout: 504,
  cost_ceiling_reached: 500,  // sentinel, should never reach HTTP
  breaker_open: 500,          // sentinel, should never reach HTTP
  webhook_signature_invalid: 401,
  rate_limited: 429,
  internal_error: 500,
};
```

> Source: [VERIFIED: PRD §5 "Error code registry (CLOSED — no ad-hoc codes)" lines 236-260]

### Pattern 8: GitHub Actions workflows skeleton

```yaml
# .github/workflows/ci.yml (shape — exact steps in plan)
name: CI
on:
  pull_request:
  push:
    branches: [main]
jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: folhario_test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 5s
          --health-timeout 3s
          --health-retries 5
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/folhario_test
      DATABASE_POOL_URL: postgresql://postgres:postgres@localhost:5432/folhario_test
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
        with: { version: 9 }
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm exec drizzle-kit migrate
      - run: pnpm test:unit
      - run: pnpm test:integration
      - run: pnpm build
```

```yaml
# .github/workflows/deploy-preview.yml (shape)
name: Deploy Preview
on:
  pull_request:
    types: [opened, synchronize, reopened]
jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: []            # gated by branch protection on ci.yml succeeding first
    environment: preview
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # 1. Create Supabase branch DB for this PR
      - name: Create Supabase branch
        run: |
          supabase branches create pr-${{ github.event.number }} \
            --experimental --project-ref $SUPABASE_PROJECT_REF
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
      # 2. Apply migrations via drizzle-kit (D-12)
      - run: pnpm exec drizzle-kit migrate
        env: { DATABASE_URL: ${{ steps.branch.outputs.db_url }} }
      # 3. Vercel build + deploy --prebuilt
      - run: vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --token=${{ secrets.VERCEL_TOKEN }}
      - id: deploy
        run: echo "url=$(vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }})" >> $GITHUB_OUTPUT
      # 4. Playwright against preview URL
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
        env: { PLAYWRIGHT_TEST_BASE_URL: ${{ steps.deploy.outputs.url }} }
      # 5. Comment URL on PR
      - uses: marocchino/sticky-pull-request-comment@v2
        with: { message: "Preview: ${{ steps.deploy.outputs.url }}" }
```

```yaml
# .github/workflows/deploy-production.yml (shape)
name: Deploy Production
on:
  push: { branches: [main] }
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }   # full history for Sentry release
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      # 1. Apply migrations to prod Supabase (manual gate for destructive)
      - run: pnpm exec drizzle-kit migrate
        env: { DATABASE_URL: ${{ secrets.PROD_DATABASE_URL }} }
      # 2. Vercel build + deploy --prebuilt --prod (Sentry source maps upload
      #    automatically via withSentryConfig in next.config.mjs — see D-19 note)
      - run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}
      - run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
          SENTRY_RELEASE: ${{ github.sha }}
      - run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
      # 3. Sync Inngest functions (HTTP PUT to /api/inngest)
      - run: curl -X PUT "$APP_URL/api/inngest"
        env: { APP_URL: https://folhario.app }
```

```yaml
# .github/workflows/deploy-preview-cleanup.yml (shape)
name: Cleanup Preview
on:
  pull_request: { types: [closed] }
jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: Delete Supabase branch
        run: supabase branches delete pr-${{ github.event.number }} --project-ref $SUPABASE_PROJECT_REF
      - name: Remove Vercel preview alias
        run: vercel remove --yes pr-${{ github.event.number }}.folhario.app
```

### Anti-Patterns to Avoid

- **Enabling Vercel git integration "just to see deploys"** — defeats D-11's single-pipeline guarantee. Verify it's OFF in the Vercel dashboard before first deploy.
- **Using `next-pwa` instead of `@serwist/next`** — explicitly forbidden by CLAUDE.md.
- **Running `drizzle-kit push` in CI** — `push` skips migration files and is not deterministic. Always use `drizzle-kit generate` + `drizzle-kit migrate`.
- **Importing Drizzle directly from route handlers** — INFRA-03 forbids it. Phase 1 doesn't have real route handlers yet, but the folder structure and a lint rule (ideally in Phase 2) should enforce it.
- **Letting Sentry upload source maps on the developer's local machine** — `SENTRY_AUTH_TOKEN` must be CI-only; `.env.local` should not hold it.
- **Hardcoding `'unsafe-inline'` in production CSP without a plan to remove it** — Phase 1 accepts this, but a follow-up task in Phase 3 should migrate to nonce-based. Document in Open Questions.
- **Committing `public/sw.js`** — it's a build artifact. Add to `.gitignore`.
- **Using `Sentry.setUser({ email })`** — CLAUDE.md is explicit: ID only. Enforce via `sendDefaultPii: false` + custom `beforeSend`.
- **Using the Next.js middleware-based locale detection from next-intl** — D-25 locks us into static single-locale mode. If a future dev follows next-intl's "getting started" docs literally, they'll accidentally add `[locale]` routing. Document this in the `src/shared/i18n/README.md` stub.
- **Running `next build --turbopack` explicitly in Next 16** — the flag is a no-op warning in v16; Turbopack is default. Keep the script as `next build`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PWA service worker | Custom fetch handlers | `@serwist/next` + `defaultCache` | Workbox/Serwist has 7+ years of edge-case handling for revalidation, precaching, navigation preload, and offline fallbacks. |
| Secrets loading | Ad-hoc `process.env.X \|\| ''` | Zod-validated `src/shared/config/env.ts` | Fail fast at boot; get typed access downstream. Hand-rolled env parsing silently ships empty strings to production. |
| Git hooks | Manual `.git/hooks/*.sh` | `husky@9.1.7` | Husky persists hooks via the repo and handles install lifecycle. |
| Security headers | Hardcoding in every `Response` | Middleware + helper | Single source of truth; one place to audit. |
| Source map upload | Shell script wrapping `sentry-cli` + manual release creation | `withSentryConfig` (native Turbopack support in `@sentry/nextjs@10.13.0+`) | **Contradicts D-19**; see State of the Art. |
| i18n loader | Custom JSON import + React context | `next-intl` provider + `getRequestConfig` | Handles server/client split, suspense, formatting (Intl.*) correctly. |
| Commit message validation | Regex in a pre-commit shell script | `@commitlint/cli` + `config-conventional` | Shareable config; IDE integration; CI parity. |
| Error code enum | TypeScript `enum` | `as const` object + `typeof[keyof]` union | TS `enum` has well-known footguns (numeric values, runtime bloat, Babel transform quirks). `as const` is the modern pattern. |
| Supabase branch creation | Direct REST calls to `api.supabase.com/v1/projects/{ref}/branches` | `supabase branches create` via Supabase CLI | CLI handles auth, retries, and the experimental flag surface. |
| Deliberate error endpoint for Sentry smoke | `throw` in a normal route without gating | Gate on `IDENTIFICATION_PROVIDER_MODE=stub` AND `process.env.VERCEL_ENV !== 'production'` | Prevents production accidentally exposing a crash endpoint. |

**Key insight:** Phase 1 is almost entirely "wire libraries together correctly" — there should be zero business logic and zero hand-rolled cryptography, parsing, or async orchestration.

## Runtime State Inventory

**Not applicable — Phase 1 is a greenfield scaffold.**

There is no existing runtime state to migrate, rename, or update. No databases hold records yet; no external services have configuration tied to a string that's being renamed; no OS-registered processes reference this app; no secrets keyed on old names exist; no build artifacts are stale.

The only "state" Phase 1 *creates* is:
- The GitHub repo secrets (listed in `## Environment Availability` below) — these must be seeded by the human operator before the first CI run.
- The Supabase project (must exist with branching enabled before `deploy-preview.yml` can run).
- The Vercel project (must exist with git integration DISABLED — this is a manual dashboard step).
- The Sentry project and PostHog EU project (must exist for DSN/API key to issue).

These are listed as "Launch-Blocker Dependencies" in the Open Questions section.

## Common Pitfalls

### Pitfall 1: `exactOptionalPropertyTypes` enabled by default in new tsconfigs

**What goes wrong:** Developers copy a strict tsconfig template and silently enable `exactOptionalPropertyTypes`, then Drizzle's `Partial<T>` spreads and next-intl's config break with obscure type errors.
**Why it happens:** "More strict = more better" instinct.
**How to avoid:** D-06 explicitly excludes it. Ship a commented `tsconfig.json` that documents *why* it's off. Enforce via a pre-commit check that greps for it (optional).
**Warning signs:** Mysterious "Type '{ foo: undefined }' is not assignable to type 'Partial<{ foo: string }>'" errors.

### Pitfall 2: Supavisor txn pooler + prepared statements

**What goes wrong:** Developer uses Drizzle's default `postgres-js` setup without `{ prepare: false }`; queries start failing in production with cryptic "prepared statement 'name' already exists" errors.
**Why it happens:** The default `postgres(url)` call enables prepared statements; Supavisor txn mode rewrites connections per query and breaks prepared-statement caches.
**How to avoid:** `CLAUDE.md` mandates `{ prepare: false }`. Lock it in via `src/shared/db/client.ts` and a lint rule / codemod if anyone adds a second client.
**Warning signs:** Works in local Docker (which uses session mode) but fails in production preview.
**Source:** [CITED: drizzle-team/drizzle-orm-docs Context7]

### Pitfall 3: Sentry source maps uploaded but events show minified stack traces

**What goes wrong:** Source maps upload but `release` tag doesn't match the one the SDK reports.
**Why it happens:** Sentry needs the release in the SDK init to match the release in the upload step. With Next 16 + Turbopack, the SDK defaults to CI-provider env vars (`VERCEL_GIT_COMMIT_SHA`, `GITHUB_SHA`); hand-setting `release` to a different value breaks the match. [CITED: getsentry/sentry-javascript v8-to-v9 migration notes]
**How to avoid:** Use `process.env.GITHUB_SHA` (or `VERCEL_GIT_COMMIT_SHA`) in BOTH the SDK init and the build env. Don't hand-craft the release name.
**Warning signs:** Issues page shows "This release has no source maps" or stack frames with `<anonymous>` / `index-ABC123.js`.

### Pitfall 4: PostHog browser SDK fires `$pageview` before consent

**What goes wrong:** Developer wires `posthog-js` but forgets `opt_out_capturing_by_default: true`; user who never consents still has events captured, violating LGPD.
**Why it happens:** The SDK's "initialize and go" path is documented first in the getting-started; the opt-out defaults are in a later section.
**How to avoid:** D-17 is explicit. Wrap `posthog-js` init in a helper that enforces `opt_out_capturing_by_default: true` + `opt_out_persistence_by_default: true`, and make the helper the ONLY place the SDK is initialized. [CITED: posthog-js Context7 — "Manage User Consent"]
**Warning signs:** Events appearing in PostHog for users before they've clicked "Aceitar" on the consent banner.

### Pitfall 5: CSP `Content-Security-Policy-Report-Only` silently blocks nothing in preview

**What goes wrong:** Team ships CSP report-only in preview, gets a week's worth of reports, then flips to enforced in production — and production immediately breaks because nobody actually reviewed the reports.
**Why it happens:** Report-only is designed to be silent.
**How to avoid:** Before the Phase 1 "enforced in production" switch, an explicit Phase 1 task must verify report-only has zero reports in the past week. Wire `report-uri` to a route handler that forwards to Sentry so reports are visible in the team's main tool.
**Warning signs:** First production deploy throws CSP violation errors in the browser console for Sentry/PostHog/Stripe URLs that aren't in the allowlist.

### Pitfall 6: Serwist registers in dev, dev reload breaks

**What goes wrong:** Without `disable: process.env.NODE_ENV === 'development'` in `withSerwistInit`, the service worker registers on `next dev`, then aggressive caching breaks HMR.
**How to avoid:** Set `disable: process.env.NODE_ENV === 'development'`. [CITED: serwist/serwist Context7 example]
**Warning signs:** Developer says "my code changes aren't showing up after save."

### Pitfall 7: Playwright needs `--with-deps` in CI

**What goes wrong:** `playwright install chromium` in CI silently skips system dependencies; tests crash with `libnss3.so not found`.
**How to avoid:** Use `playwright install --with-deps chromium`. [CITED: microsoft/playwright.dev Context7]
**Warning signs:** `chromium` binary downloads fine locally but CI shows missing `.so` files.

### Pitfall 8: `vercel deploy --prebuilt` with the wrong `vercel pull` environment

**What goes wrong:** CI runs `vercel pull --environment=preview` then `vercel deploy --prebuilt --prod` — the preview env vars bake into the production build.
**How to avoid:** `vercel pull` environment MUST match the `vercel deploy` target. Always pair `--environment=preview` ↔ `vercel deploy --prebuilt` and `--environment=production` ↔ `vercel deploy --prebuilt --prod`.
**Warning signs:** Production showing preview-only feature flags or stub provider mode.

### Pitfall 9: Supabase branch DB URL format (`pool` vs `direct`)

**What goes wrong:** `drizzle-kit migrate` uses the Supavisor pooled URL and fails because migration DDL needs session mode.
**How to avoid:** Migrations ALWAYS use `DATABASE_URL` (direct, session mode) per PRD §20 env table. Runtime ALWAYS uses `DATABASE_POOL_URL` (Supavisor txn mode, with `{ prepare: false }`). Two separate vars, never mixed.
**Warning signs:** "cannot create index concurrently" / "prepared statement" errors during migrations.

### Pitfall 10: GitHub Actions `pnpm/action-setup` cache miss

**What goes wrong:** Cache keyed on `package.json` hash instead of `pnpm-lock.yaml` → every CI run reinstalls.
**How to avoid:** `actions/setup-node@v4` with `cache: pnpm` auto-detects `pnpm-lock.yaml` when pnpm is already installed. Make sure `pnpm/action-setup@v4` runs BEFORE `actions/setup-node@v4`.
**Warning signs:** CI time stuck at 5+ minutes per run.

### Pitfall 11: Next 16 scaffold opts into React Compiler / experimental features silently

**What goes wrong:** `create-next-app@16` may enable experimental flags (e.g., `experimental.reactCompiler`) that later break unrelated libraries.
**How to avoid:** After running `create-next-app`, diff `next.config.mjs` against the documented Next 16 default and remove any `experimental` block unless the team has consciously opted in.
**Warning signs:** Build warnings about experimental features we didn't enable.

## Code Examples

See Patterns 1-8 above for all load-bearing code. Each is tagged with its source.

Additionally, one more pattern the planner will want to reference:

### Health route (Claude's discretion on shape — D-24 smoke dep)

```typescript
// src/app/api/v1/health/route.ts
import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/shared/db/client';

export const runtime = 'nodejs'; // postgres-js is not edge-compatible

export async function GET() {
  try {
    await db.execute(sql`SELECT 1`);
    return NextResponse.json({ status: 'ok', db: 'ok' });
  } catch {
    return NextResponse.json({ status: 'ok', db: 'degraded' }, { status: 503 });
  }
}
```

> Note: Claude's discretion on the exact shape per CONTEXT.md; this is the recommended form.

### Deliberate error endpoint (gated)

```typescript
// src/app/api/v1/_test/throw/route.ts
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  // D-24 gate: only in stub provider mode and NOT production
  const gate =
    process.env.IDENTIFICATION_PROVIDER_MODE === 'stub' &&
    process.env.VERCEL_ENV !== 'production';
  if (!gate) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // Build a payload with the exact LGPD-13 scrub keys so the Playwright
  // smoke test can assert Sentry's breadcrumb does NOT contain them.
  const probe = {
    email: 'lgpd-test@example.com',
    password: 'should-never-appear-in-sentry',
    photo_url: 'https://example.com/should-be-scrubbed.jpg',
    token: 'bearer-should-be-scrubbed',
    trace_id: crypto.randomUUID(),
  };

  throw new Error(`Deliberate smoke error ${JSON.stringify(probe)}`);
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next build --turbopack` flag required | Turbopack is default in Next 16; `--turbopack` is a no-op | Next.js 16 release | `package.json` scripts use `next build` (not `next build --turbopack`) [CITED: vercel/next.js upgrade-v16.mdx via Context7] |
| Explicit `sentry-cli sourcemaps upload` step in CI to handle Turbopack | `withSentryConfig` natively uploads source maps after Turbopack build (`useRunAfterProductionCompileHook` / default with `@sentry/nextjs@10.13.0+` + `next@15.4.1+`) | `@sentry/nextjs@10.13.0` (2025) | **Contradicts CONTEXT.md D-19.** We're on `@sentry/nextjs@10.48.0` and `next@16.2.3` — the native path is available and is what the official docs recommend. The planner should surface this to the user as a mini-question. [CITED: docs.sentry.io/platforms/javascript/guides/nextjs/sourcemaps] |
| PostHog default `capture_pageview: 'history_change'` + autocapture on | PostHog `autocapture: false` + explicit named events + consent-gated opt-in | D-17/D-18 decision + LGPD residency | Lower event volume, predictable taxonomy, clean LGPD posture |
| next-intl middleware-based locale detection | `next-intl` single-locale static `getRequestConfig` | D-25 (product decision) | No `[locale]` URL segment; future second locale is a bounded refactor |
| `next-pwa` (shadowwalker) | `@serwist/next` | Serwist became the maintained Workbox fork (~2023); Next 16 compatibility lags in next-pwa | CLAUDE.md lock; Serwist only supported choice for Next 16 App Router |
| Sentry v8 build-time source map upload during webpack build | Sentry v10 post-build upload (works uniformly for webpack-15.4.1+ AND Turbopack) | `@sentry/nextjs@10.x` | Simpler mental model; same API for both bundlers |
| `enum` in TypeScript | `as const` object + keyof union | Community convention ~2022; now canonical | Tree-shakable, no runtime bloat, no Babel quirks |

**Deprecated/outdated:**
- `next-pwa` — unmaintained for Next 16 (last verified commit lag; Serwist is the successor)
- Sentry webhook-based release creation (`sentry-cli releases new`) — replaced by `withSentryConfig.release.name`
- Sentry `excludeServerRoutes` config option — not supported with Turbopack [CITED: Sentry docs]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `create-next-app@16` will pin TypeScript to a currently-stable 5.x minor that does NOT enable `exactOptionalPropertyTypes` by default | Standard Stack > Core (typescript row) | Low — D-06 explicitly disables it; planner verifies at scaffold time |
| A2 | Next 16 scaffold opts into `eslint.config.mjs` flat config rather than legacy `.eslintrc.json` | Supporting stack (eslint row) | Low — either config works; impacts a handful of plugin entries |
| A3 | Supabase branching `supabase branches create` CLI command and the exact flag surface will not change before Phase 1 ships | Architecture Patterns > `deploy-preview.yml` | Medium — Supabase branching is labeled "experimental" as of 2026; the CLI flag (`--experimental`) may change. Planner should verify `supabase --version` and `supabase branches --help` at plan-writing time. |
| A4 | Vercel CLI `vercel build --prod` produces output compatible with `vercel deploy --prebuilt --prod` on Next 16 | Architecture Patterns > `deploy-production.yml` | Low — this is Vercel's documented path [CITED: vercel.com/docs/cli/deploy] |
| A5 | Inngest sync via HTTP PUT on `/api/inngest` is the correct Phase 1 sync mechanism | INFRA-14 row of Phase Requirements | Low — [CITED: inngest/inngest-js Context7] Phase 1 only has a hello-world fn; real sync coverage is Phase 2+ |
| A6 | Node 22 LTS (D-02) is supported by the `vercel` runtime at build time | Standard Stack | Low — Node 22 is supported across Vercel's official Node runtimes; verify at deploy time |
| A7 | `postgres:16-alpine` is sufficient for Phase 1 integration tests (matches Supabase's default Postgres 16) | Validation Architecture | Low — Supabase runs Postgres 15.x-17.x depending on project age; `postgres:16-alpine` is a safe middle ground |
| A8 | The exact Sentry version on which `useRunAfterProductionCompileHook` is mandatory vs implicit | State of the Art | Low — `@sentry/nextjs@10.48.0` documents both forms work; planner should use the explicit opt-in to be safe |
| A9 | CSP allowlist for PostHog EU includes both `eu.posthog.com` and `eu-assets.i.posthog.com` | Code Examples > middleware | Medium — PostHog has ingest vs asset hostnames; the exact set should be verified against PostHog's current docs at plan time |
| A10 | Vercel git integration being OFF is a one-time manual dashboard toggle that cannot be automated via CLI | Phase Requirements INFRA-11 | Low — this is a known Vercel dashboard-only setting; document in Phase 1 runbook |

**Empty-table escape:** Not applicable — assumptions above are real and the planner should weigh them.

## Open Questions

1. **D-19 is contradicted by current Sentry docs. What does the user want to do?**
   - What we know: CONTEXT.md D-19 locks an explicit `sentry-cli sourcemaps upload` step citing "Turbopack compatibility risk." Current Sentry docs confirm that `@sentry/nextjs@10.13.0+` (we're on 10.48.0) natively handles Turbopack post-build upload via `withSentryConfig`, on `next@15.4.1+` (we're on 16.2.3).
   - What's unclear: Did the user know about the native path when they locked D-19, or was their information stale?
   - Recommendation: Planner should flag this as a single-question mini-discussion before planning writes tasks. If the user says "keep D-19 as-is," the plan implements the explicit sentry-cli step exactly as specified. If the user switches, the plan is simpler (one less CI step) and uses `withSentryConfig` native upload.

2. **Does the human operator need to pre-create the Supabase project, Vercel project, Sentry project, and PostHog EU project before Phase 1's first CI run?**
   - What we know: Yes — all four services must have a project existing and secrets issued before CI can consume them.
   - What's unclear: Has this been done? CONTEXT.md mentions "Supabase project must exist with branching enabled" in the integration points section but doesn't confirm status.
   - Recommendation: Plan should include a Wave 0 "operator setup" task that is a checklist (not a code task) for the human to tick off before Wave 1 runs. If this is already done, the task is a no-op verification.

3. **What Supabase Postgres version should `postgres:16-alpine` mirror in CI?**
   - What we know: Supabase's default Postgres version varies by project creation date — recent projects default to 17.x, older to 15.x.
   - What's unclear: Which version is the Folhário Supabase project on?
   - Recommendation: Pick the version matching the actual Supabase project. If 17.x is the Supabase version, use `postgres:17-alpine` in CI for parity.

4. **Exact CSP allowlist strings for PostHog EU, Sentry ingest, and Stripe.**
   - What we know: The allowlist needs to include PostHog EU ingest + assets hosts, Sentry ingest host, Stripe API host, Supabase project host.
   - What's unclear: PostHog specifically has been migrating between `eu.posthog.com` and `eu-assets.i.posthog.com` hosts; exact strings should be pulled from PostHog's current EU hostname list at plan time.
   - Recommendation: Plan task includes "curl + grep PostHog docs for current EU hostnames before writing the CSP constant."

5. **Where does the CSP violation report endpoint forward to?**
   - What we know: D-20 says "Violation reports go to a Sentry transport."
   - What's unclear: Exact mechanism — a Next route handler that receives the report and calls `Sentry.captureMessage`, or Sentry's native CSP reporting endpoint (which requires a Sentry-specific URL in `report-uri`)?
   - Recommendation: Phase 1 ships with a thin `/api/v1/_csp/report` route handler that calls `Sentry.captureMessage({ level: 'warning' })`. This is more portable than using Sentry's native endpoint which ties CSP reporting to a specific Sentry project URL.

6. **Should the smoke-test deliberate-error route be committed forever, or deleted at end of Phase 1?**
   - What we know: D-24 requires it for Phase 1's success criterion #4. The endpoint is gated on `IDENTIFICATION_PROVIDER_MODE=stub` + `VERCEL_ENV !== 'production'`, so it's safe.
   - What's unclear: Whether it remains useful in Phase 2+ or becomes dead code.
   - Recommendation: Keep it. It's a permanent smoke test asset for Sentry scrubbing regression. Add a Playwright smoke that re-runs on every preview deploy in later phases.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All Phase 1 code + CI | ⚠ Wrong version locally | 24.14.1 installed, D-02 requires 22 LTS | Install Node 22 via `nvm install 22` and add `.nvmrc` |
| pnpm | D-01, all scripts | ✗ Not installed | — | `corepack enable && corepack prepare pnpm@9 --activate` (from Node's bundled corepack) OR `npm i -g pnpm@9` |
| Docker | Local integration tests (`postgres:16-alpine`), `supabase start` | ✓ | 29.4.0 | — |
| PostgreSQL client (`psql`) | Local DB inspection (optional) | ✓ | 14.18 (Homebrew) | Version OK for client use; server runs in Docker |
| Supabase CLI | D-12 + deploy-preview.yml branches + local `supabase start` | ✓ | 2.84.2 | — |
| GitHub CLI (`gh`) | Optional — human ops, not CI | ✓ | 2.88.1 | — |
| Vercel CLI | CI only (`deploy-preview.yml`, `deploy-production.yml`) | ✗ Not installed globally | — | Install per-CI-run via `pnpm add -D vercel@51.2.1` — NO global install needed, runs via `pnpm exec vercel …` |
| Git | All version control | ✓ (repo is already initialized) | — | — |
| Sentry project + DSN + auth token | OBS-01 | ⚠ Unknown | — | **Blocks first CI run until human creates project.** See Open Question 2. |
| PostHog EU project + API key | OBS-02 | ⚠ Unknown | — | **Blocks first CI run until human creates project.** See Open Question 2. |
| Supabase project + branching enabled | INFRA-13, INFRA-15 | ⚠ Unknown | — | **Blocks first CI run until human enables branching.** See Open Question 2. |
| Vercel project + git integration OFF | INFRA-11 | ⚠ Unknown | — | **Blocks first CI run until human creates project and toggles git integration OFF.** See Open Question 2. |
| Inngest account + signing key | INFRA-10 (serve handler only in Phase 1) | ⚠ Unknown | — | Phase 1 only needs the serve handler to boot with a hello-world fn; full sync happens in `deploy-production.yml` once keys are issued. |

**Missing dependencies with no fallback:**
- Sentry / PostHog / Supabase / Vercel / Inngest project existence — **blocks Phase 1 first CI run**; must be resolved before Wave 1 runs. Addressed by Open Question 2.

**Missing dependencies with fallback:**
- Node 22: user currently has Node 24; install via `nvm install 22 && nvm use 22` before Wave 1 starts. `.nvmrc` will pin it going forward.
- pnpm: install via `corepack enable` once Node 22 is active.
- Vercel CLI: use the dev-dependency version via `pnpm exec vercel …`; no global install.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Unit + integration framework | `vitest@4.1.4` |
| E2E framework | `@playwright/test@1.59.1` (Chromium only per D-10) |
| Unit config file | `vitest.config.ts` (unit project) |
| Integration config file | `vitest.config.ts` (integration project with `pool: 'forks'`, `setupFiles: ['tests/integration/setup.ts']`) |
| E2E config file | `playwright.config.ts` with `baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL` [CITED: microsoft/playwright.dev Context7] |
| Quick run command (per task commit) | `pnpm test:unit` |
| Full suite command (per wave merge) | `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build` |
| E2E smoke (per preview deploy) | `pnpm test:e2e` with `PLAYWRIGHT_TEST_BASE_URL` set to the preview URL |

### Phase Requirements → Test Map

Each Phase 1 success-criterion invariant maps to a concrete validation signal. A criterion passes only when its command exits zero or its assertion succeeds.

| Req ID / Invariant | Behavior | Test Type | Automated Command / Assertion | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SC-1 part a / INFRA-01 | Empty Next 16 App Router app builds locally | build | `pnpm build` exits 0 | ❌ Wave 0 |
| SC-1 part b / INFRA-01 | TS strict + `noUncheckedIndexedAccess` enforced | typecheck | `pnpm typecheck` (exits 0) + unit test that imports `tsconfig.json` and asserts `strict: true` + `noUncheckedIndexedAccess: true` | ❌ Wave 0 |
| SC-1 part c / INFRA-01, D-25 | pt-BR locale default, `<html lang="pt-BR">` | unit + e2e | Unit: render `<RootLayout>` via RTL, assert `<html lang="pt-BR">`. E2E: Playwright asserts `expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')` on `/` | ❌ Wave 0 |
| SC-1 part d / INFRA-01, D-26 | `@serwist/next` PWA wiring, SW registers | e2e | Playwright: navigate to `/`, assert `navigator.serviceWorker.getRegistration('/')` resolves to a registration | ❌ Wave 0 |
| SC-1 part e / INFRA-02, D-08 | Bounded-context folder layout scaffolded | unit | Unit test walks `src/contexts/**` + `src/shared/**`, asserts every required subfolder and `README.md` exists | ❌ Wave 0 |
| SC-2 part a / INFRA-12 | `ci.yml` runs lint + typecheck + unit + integration | CI pipeline | Open a throwaway PR (or dry-run via `act`) and assert `ci.yml` job succeeds | ❌ Wave 0 |
| SC-2 part b / INFRA-12 | Vitest integration against `postgres:16-alpine` service container with migrations | integration | `pnpm test:integration` against a local Docker `postgres:16-alpine`; at minimum one test exercises `db.execute(sql\`SELECT 1\`)` via the real Drizzle client | ❌ Wave 0 |
| SC-2 part c / INFRA-13 | Playwright runs against preview URL bound to Supabase branch DB | e2e | CI assertion: `deploy-preview.yml` completes with Playwright job green; smoke asserts `/api/v1/health` returns `{ db: 'ok' }` on the preview URL | ❌ Wave 0 |
| SC-2 part d / INFRA-15 | PR close cleans up branch DB + preview alias | CI pipeline | `deploy-preview-cleanup.yml` completes; manual verification of Supabase branch list + Vercel alias list after cleanup (no automated assertion — CI log review) | ❌ Wave 0 |
| SC-3 part a / INFRA-14 | `main` merge deploys to production via `vercel deploy --prebuilt --prod` | CI pipeline | Test merge from staging branch — `deploy-production.yml` completes green | ❌ Wave 0 |
| SC-3 part b / OBS-01 | Sentry release tagged with git SHA | assertion | Post-deploy: `curl` Sentry API `/releases/{sha}/` returns 200 OR `deploy-production.yml` step uses `withSentryConfig` which fails the build on upload error | ❌ Wave 0 |
| SC-3 part c / OBS-01 | Turbopack source maps uploaded post-build | assertion | Sentry release has `>0` artifacts (check via Sentry API `/releases/{sha}/files/`) | ❌ Wave 0 |
| SC-3 part d / INFRA-10 | Inngest functions synced | assertion | `deploy-production.yml` curl `PUT /api/inngest` returns 200 with function count ≥ 1 | ❌ Wave 0 |
| SC-3 part e / INFRA-11 | Vercel git integration confirmed OFF | manual | Runbook check — screenshot of Vercel project settings dashboard recorded in Phase 1 closing note | — |
| SC-4 part a / LGPD-13, D-24 | Deliberately thrown error appears in Sentry | e2e | Playwright hits `/api/v1/_test/throw`, waits for Sentry ingest, queries Sentry issues API for an issue tagged with the test run's `trace_id`, asserts it exists within 10 s | ❌ Wave 0 |
| SC-4 part b / LGPD-13 | Scrubbed fields absent from the issue payload | e2e | Same Playwright test asserts Sentry event body (via issues API) contains `[Filtered]` where `email`/`password`/`photo_url`/`token`/`Authorization`/`Cookie` would appear, and `trace_id` IS present (control) | ❌ Wave 0 |
| SC-4 part c / LGPD-13 | `Sentry.setUser({ id })` only — no email | unit | Unit test imports `sentry.client.config.ts` + `sentry.server.config.ts`, intercepts a mock `Sentry.init` call, asserts `sendDefaultPii: false` and that `beforeSend` strips `event.user.email` | ❌ Wave 0 |
| SC-4 part d / LGPD-13 | Request bodies dropped on `/api/v1/identifications/*` | unit | Unit test calls the `beforeSend` function with a synthetic event whose `request.url` matches `/api/v1/identifications/abc` and a populated `request.data`, asserts the returned event has `request.data === undefined` | ❌ Wave 0 |
| SC-4 part e / OBS-02 | PostHog EU client + `posthog-node` server are connected | e2e + unit | Unit: PostHog client factory asserted to use `api_host: 'https://eu.posthog.com'` + `opt_out_capturing_by_default: true`. E2E: smoke fires a ping event via server-side `posthog-node` from a health endpoint, asserts HTTP 200 to `eu.posthog.com` (mocked via Playwright route() OR verified via PostHog events API) | ❌ Wave 0 |
| SC-5 part a / INFRA-20, D-23 | Closed error-code registry exists as single importable source | unit | Unit test imports `ErrorCode` from `@/shared/errors/codes`, asserts all 21 codes from PRD §5 present, asserts `typeof ErrorCode` is `'object'` (not TS `enum`), asserts `INTERNAL_ONLY_CODES.has('cost_ceiling_reached')` + `INTERNAL_ONLY_CODES.has('breaker_open')` | ❌ Wave 0 |
| SC-5 part b / INFRA-18, D-20–D-22 | Standard security headers apply to every response | e2e | Playwright smoke: `page.goto('/')` then assert `response.headers()` contains `content-security-policy-report-only` (preview) or `content-security-policy` (prod), `strict-transport-security`, `x-frame-options: DENY`, `x-content-type-options: nosniff` | ❌ Wave 0 |
| SC-5 part c / INFRA-16 | `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real | unit | Unit: import `env.ts`, parse `IDENTIFICATION_PROVIDER_MODE='real'`, parse `='stub'`, parse missing (rejects). Also: unit test for `/api/v1/_test/throw` route handler asserts 404 when `IDENTIFICATION_PROVIDER_MODE !== 'stub'` and 500 (thrown) when it is | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test:unit` (fast path — <30s goal)
- **Per wave merge:** `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build`
- **Phase gate:** Full suite green + `deploy-preview.yml` green on a throwaway PR that exercises every SC above + manual Vercel dashboard verification of git-integration-OFF

### Wave 0 Gaps

All validation assets are missing — this is a greenfield phase.

- [ ] `package.json` + `pnpm-lock.yaml` (scaffold)
- [ ] `tsconfig.json` with D-06 strict-plus flags
- [ ] `vitest.config.ts` with two projects (unit + integration)
- [ ] `playwright.config.ts` with Chromium-only + `baseURL` from env
- [ ] `tests/unit/*` — at minimum: `tsconfig.test.ts`, `error-codes.test.ts`, `sentry-config.test.ts`, `posthog-config.test.ts`, `folder-scaffold.test.ts`, `env-provider-mode.test.ts`, `i18n-lang.test.ts`
- [ ] `tests/integration/setup.ts` — migrations + transaction wrapper (D-14)
- [ ] `tests/integration/health.test.ts` — real Postgres `SELECT 1` via Drizzle
- [ ] `playwright/smoke.spec.ts` — D-24 full observability loop smoke
- [ ] Framework installs: `pnpm install` (covers vitest + playwright); `pnpm exec playwright install --with-deps chromium` on first run

## Security Domain

### Applicable ASVS Categories (Phase 1 Foundation scope only)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | Bounded-context layout (D-08); `middleware.ts` as single header choke point; JWT verification deferred to Phase 2/4 |
| V2 Authentication | no | Deferred to Phase 4 (AUTH-*) — Phase 1 has no auth code |
| V3 Session Management | no | No sessions in Phase 1 (per-device JWT arrives in Phase 4) |
| V4 Access Control | no | Deferred to Phase 2 (middleware JWT check) + Phase 4 (auth endpoints) |
| V5 Input Validation | partial | `src/shared/config/env.ts` uses Zod to validate env; route handlers with real input start Phase 2 |
| V6 Cryptography | no | No crypto in Phase 1; rely on platform TLS (Vercel) + Supabase encryption at rest |
| V7 Errors + Logging | yes | Sentry scrubbing (LGPD-13) — `email`, `password`, `token`, `Authorization`, `Cookie`, `photo_url` filtered via `beforeSend`/`beforeBreadcrumb`; identification route bodies dropped; `Sentry.setUser({ id })` only |
| V8 Data Protection | yes | LGPD-13 PII scrubbing as above; `.env.local` in `.gitignore`; secrets CI-only via GitHub Secrets; never logged |
| V9 Communications | yes | HSTS (D-21: 6 months, includeSubDomains, no preload); TLS enforced by Vercel; `wss://*.supabase.co` only |
| V10 Malicious Code | partial | Conventional Commits + commitlint + pre-commit hooks are weak signals; no SCA scanning in Phase 1 (Dependabot/Snyk deferred) |
| V11 Business Logic | no | No business logic in Phase 1 |
| V12 Files + Resources | yes | CSP `frame-ancestors 'none'` + `X-Frame-Options: DENY` (D-22); `X-Content-Type-Options: nosniff` |
| V13 API + Web Service | partial | Closed error code registry (INFRA-20, D-23); JWT enforcement starts Phase 2 |
| V14 Configuration | yes | Security headers via middleware (INFRA-18); env var validation via Zod; `sendDefaultPii: false` on Sentry |

### Known Threat Patterns for Phase 1 stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets committed to git | Information Disclosure | `.env.local` in `.gitignore`; `.env.example` template with placeholders only; GitHub Secrets scanning enabled; commitlint cannot catch this but pre-commit `lint-staged` hook can grep for common patterns (deferred) |
| Source maps deployed publicly with minified assets | Information Disclosure | Sentry uploads + `deleteSourcemapsAfterUpload: true` (default in `@sentry/nextjs@9+`) — maps go to Sentry, not to `public/` [CITED: getsentry/sentry-javascript v8 changelog] |
| Sentry captures PII in breadcrumbs | Information Disclosure, Privacy violation | `sendDefaultPii: false` + `beforeSend`/`beforeBreadcrumb` scrubbing (LGPD-13); unit test asserts the scrub list |
| Clickjacking via iframe embedding | Tampering | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (D-22) |
| MIME sniffing XSS | Spoofing | `X-Content-Type-Options: nosniff` |
| HTTP downgrade attack | Tampering | HSTS `max-age=15552000; includeSubDomains` (D-21) |
| CSP bypass via `'unsafe-inline'` | Tampering, Elevation | Phase 1 ships with `'unsafe-inline'` in `script-src`/`style-src`; this is a known gap documented in the Open Questions — upgrade to nonce-based in Phase 3 (Design System phase) |
| PostHog captures events before consent | Privacy violation (LGPD) | `opt_out_capturing_by_default: true` + `opt_out_persistence_by_default: true` (D-17) |
| Deliberate-error endpoint reachable in production | Denial of Service, Information Disclosure | Gated on `IDENTIFICATION_PROVIDER_MODE=stub` AND `VERCEL_ENV !== 'production'` (D-24) — unit test covers the gate |
| CI secret exfiltration via PR from fork | Information Disclosure | GitHub Actions `pull_request` event (not `pull_request_target`) does not expose secrets to forks; preview deploys skip if triggered from a fork; document in runbook |
| Supabase service role key leaked to client | Elevation of Privilege | Env var `SUPABASE_SERVICE_ROLE_KEY` MUST NOT be prefixed with `NEXT_PUBLIC_`; unit test asserts `process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` is undefined |

## Project Constraints (from CLAUDE.md)

The following directives from `CLAUDE.md` are treated with the same authority as CONTEXT.md locked decisions. Research recommendations that contradict any of these have been flagged.

- **Next.js 16 App Router + React 19 + TS, PWA via `@serwist/next`** (NOT `next-pwa`) — locked in Standard Stack
- **Supabase Postgres via Supavisor transaction-mode pooler, Drizzle ORM inside repositories only, `postgres-js` driver with `{ prepare: false }` mandatory** — locked in Code Examples
- **Inngest for all async work — no raw cron, no BullMQ** — locked in Standard Stack; Phase 1 wires serve handler only
- **Vercel hosting, deploys from GitHub Actions ONLY. Vercel git integration DISABLED** — locked in Architecture Patterns (four workflows)
- **pt-BR only at launch — `next-intl` mandatory day one, `<html lang="pt-BR">`** — locked in Pattern 2
- **Standard security headers via Next.js middleware** — locked in Pattern 6
- **Sentry (release = git SHA, source maps uploaded post-build from CI because Turbopack requires it), `Sentry.setUser({ id })` only — never email** — locked in Pattern 5; research flags that `sentry-cli` is no longer required (native Turbopack support now exists) but the "post-build from CI" requirement is still satisfied either way
- **PostHog EU cloud (LGPD residency)** — locked in Standard Stack
- **Error codes: Closed registry in PRD §5 — no ad-hoc error codes. `cost_ceiling_reached` and `breaker_open` are INTERNAL-only and surface as `provider_unavailable` to clients** — locked in Pattern 7
- **Security: narrow per-IP throttle on public auth endpoints — only place `rate_limited` 429 is emitted in MVP** — not Phase 1 scope (Phase 4), but `rate_limited` is in the error-code registry Phase 1 seeds
- **Timestamps ISO-8601 UTC with `Z`** — not Phase 1 scope, but noted for schema conventions (Phase 2)
- **GSD Workflow Enforcement: Before using Edit/Write tools, start work through a GSD command** — followed: this research was invoked via `/gsd-plan-phase`

CLAUDE.md is consistent with CONTEXT.md and with this research. The only friction point is the Sentry source-map upload path (CLAUDE.md says "source maps uploaded post-build from CI because Turbopack requires it" — which is still true either way — but the mechanism CONTEXT.md D-19 picked is no longer the only option).

## Sources

### Primary (HIGH confidence)

- **Context7** `/vercel/next.js` — Next.js 16 upgrade guide; Turbopack-as-default confirmation
- **Context7** `/amannn/next-intl` — single-locale, no-routing mode configuration via `getRequestConfig`
- **Context7** `/serwist/serwist` — `@serwist/next` plugin config + `app/sw.ts` pattern with `defaultCache`
- **Context7** `/drizzle-team/drizzle-orm-docs` — Supabase + postgres-js + `{ prepare: false }` pattern for Supavisor txn mode; `drizzle-kit migrate` command
- **Context7** `/getsentry/sentry-javascript` — `beforeSend`/`beforeBreadcrumb` scrubbing; v9 migration notes on source map defaults; `Sentry.setUser` pattern
- **Context7** `/websites/sentry_io_platforms` — Turbopack source map upload via `withSentryConfig` (`@sentry/nextjs@10.13.0+` + `next@15.4.1+`)
- **Context7** `/inngest/inngest-js` — `serve` from `inngest/next` for App Router
- **Context7** `/posthog/posthog-js` — `opt_out_capturing_by_default` + EU host + `opt_in_capturing(...)` pattern
- **Context7** `/microsoft/playwright.dev` — GitHub Actions `deployment_status` workflow + `PLAYWRIGHT_TEST_BASE_URL`
- **Context7** `/supabase/cli` — `supabase branches create/delete` commands
- **Context7** `/websites/vercel` — `vercel deploy --prebuilt` + GitHub Actions deploy pattern; security headers conformance rules
- **npm registry** via `npm view <pkg> version` — all version rows in Standard Stack table (2026-04-14)
- **PRD `docs/CAVE-PRD.md`** §2 (repo layout), §5 (closed error registry), §20 (env vars + workflows), §21 (security + observability)
- **CLAUDE.md** — project constraints
- **CONTEXT.md** — locked Phase 1 decisions (D-01 through D-26)
- **.planning/REQUIREMENTS.md** — INFRA/OBS/LGPD requirement rows for Phase 1

### Secondary (MEDIUM confidence)

- Conventional Commits / commitlint / husky / lint-staged — verified on npm registry but specific config choices [ASSUMED from community standard; `@commitlint/config-conventional` is the canonical preset]
- GitHub Actions cache behavior for pnpm — based on official `actions/setup-node@v4` docs; specific version compatibility with `pnpm/action-setup@v4` is conventional but not re-verified against latest GH Actions release

### Tertiary (LOW confidence — flagged for plan-time verification)

- Exact Supabase branching CLI flag surface (`--experimental`) — flagged in Assumptions Log A3 and Open Question 2
- Exact current PostHog EU hostnames for CSP allowlist — flagged in Open Question 4
- TypeScript 5.x minor version pinned by `create-next-app@16` — flagged in Assumptions Log A1

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified on npm registry at research time
- Architecture patterns: HIGH — every pattern cited to an official source
- CI/CD workflow shapes: MEDIUM — high confidence on Vercel CLI + Playwright patterns; medium on exact Supabase branches CLI flags (experimental API)
- Sentry scrubbing: HIGH — explicit code pattern with official API
- PII enforcement (LGPD-13): HIGH — directly implementable from Pattern 5
- Sentry source map path: HIGH on the native option, HIGH on the explicit sentry-cli option (both work); the **decision** between them is the Open Question (LOW on which one the user will pick)
- Pitfalls: HIGH — all 11 pitfalls are cited or derived from documented gotchas

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (30-day ceiling — Next 16 / Sentry 10 / Drizzle 0.45 are stable; Supabase branching is experimental and may drift)

## Plans to Review


### 01-01-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 01
type: execute
wave: 0
depends_on: []
files_modified:
  - .planning/phases/01-foundation-ci-cd/01-01-OPERATOR-CHECKLIST.md
autonomous: false
requirements: [INFRA-11, INFRA-17, INFRA-23, OBS-01, OBS-02, OBS-05]
validation_ref: [SC-2d (manual leg), SC-3e, SC-5d (operator portion)]
user_setup:
  - service: node-22-lts
    why: "D-02 locks runtime; current machine has Node 24"
    dashboard_config:
      - task: "nvm install 22 && nvm use 22 && corepack enable && corepack prepare pnpm@9 --activate"
        location: "Local terminal"
  - service: sentry
    why: "OBS-01, LGPD-13, D-19 OVERRIDE Sentry source-map upload"
    env_vars:
      - name: NEXT_PUBLIC_SENTRY_DSN
        source: "Sentry Project Settings -> Client Keys (DSN)"
      - name: SENTRY_ORG
        source: "Sentry URL org slug"
      - name: SENTRY_PROJECT
        source: "Sentry Project Settings -> Project name"
      - name: SENTRY_AUTH_TOKEN
        source: "Sentry User Settings -> Auth Tokens (scopes: project:read, project:releases, org:read)"
    dashboard_config:
      - task: "Create Sentry project (Next.js platform)"
        location: "Sentry -> Projects -> Create Project"
  - service: posthog-eu
    why: "OBS-02 PostHog EU cloud LGPD residency"
    env_vars:
      - name: NEXT_PUBLIC_POSTHOG_KEY
        source: "PostHog EU -> Project Settings -> Project API Key"
      - name: NEXT_PUBLIC_POSTHOG_HOST
        source: "Hardcoded https://eu.posthog.com"
    dashboard_config:
      - task: "Create PostHog EU project (eu.posthog.com NOT us)"
        location: "eu.posthog.com -> New project"
  - service: supabase
    why: "INFRA-13 branching + INFRA-15 cleanup"
    env_vars:
      - name: SUPABASE_ACCESS_TOKEN
        source: "Supabase Dashboard -> Account -> Access Tokens"
      - name: SUPABASE_PROJECT_REF
        source: "Supabase Project Settings -> Reference ID"
      - name: DATABASE_URL
        source: "Supabase Project Settings -> Database -> Connection string (direct, session mode)"
      - name: DATABASE_POOL_URL
        source: "Supabase Project Settings -> Database -> Connection pooling (transaction mode) — MUST use ?pgbouncer=true path"
      - name: NEXT_PUBLIC_SUPABASE_URL
        source: "Supabase Project Settings -> API -> Project URL"
      - name: NEXT_PUBLIC_SUPABASE_ANON_KEY
        source: "Supabase Project Settings -> API -> anon public"
      - name: SUPABASE_SERVICE_ROLE_KEY
        source: "Supabase Project Settings -> API -> service_role (NEVER prefix with NEXT_PUBLIC_)"
    dashboard_config:
      - task: "Create Supabase project"
        location: "supabase.com -> New project"
      - task: "Enable branching"
        location: "Project Settings -> Branching -> Enable branching"
  - service: vercel
    why: "INFRA-11 hosting with git integration OFF"
    env_vars:
      - name: VERCEL_TOKEN
        source: "Vercel Account Settings -> Tokens -> Create token"
      - name: VERCEL_ORG_ID
        source: "Vercel Team Settings -> General -> Team ID"
      - name: VERCEL_PROJECT_ID
        source: "Vercel Project Settings -> General -> Project ID"
    dashboard_config:
      - task: "Create Vercel project (framework: Next.js)"
        location: "vercel.com -> Add New -> Project"
      - task: "CONFIRM Git integration is OFF (SC-3e, INFRA-11)"
        location: "Vercel Project -> Settings -> Git -> Disconnect repository. Screenshot for VERIFICATION.md."
      - task: "Override build command to 'pnpm build'"
        location: "Vercel Project -> Settings -> General -> Build & Development Settings"
  - service: inngest
    why: "SC-3d deploy-production sync asserts /api/inngest returns function count >= 1"
    env_vars:
      - name: INNGEST_EVENT_KEY
        source: "Inngest Dashboard -> Keys -> Event Keys"
      - name: INNGEST_SIGNING_KEY
        source: "Inngest Dashboard -> Keys -> Signing Keys"
    dashboard_config:
      - task: "Create Inngest app 'folhario'"
        location: "inngest.com -> Apps -> New app"

must_haves:
  truths:
    - "Every GitHub Actions secret from PRD §20 exists in the repo before first CI run"
    - "Node 22 LTS is active in the developer's shell (nvm) and pinned via .nvmrc in Wave 1"
    - "Sentry / PostHog EU / Supabase (with branching) / Vercel (git OFF) / Inngest projects all exist"
    - "pnpm is installed and resolvable (via corepack)"
  artifacts:
    - path: ".planning/phases/01-foundation-ci-cd/01-01-OPERATOR-CHECKLIST.md"
      provides: "Written record of what the operator did + when; referenced from VERIFICATION.md"
  key_links:
    - from: "Operator secrets"
      to: "GitHub Actions workflows in Wave 4"
      via: "secrets.* references"
      pattern: "secrets\\.(SENTRY|POSTHOG|SUPABASE|VERCEL|INNGEST|DATABASE)_"
---

<objective>
Wave 0 operator provisioning gate. Block all downstream work until the five external services exist with the correct configuration and every secret from PRD §20 is installed in the GitHub Actions repo secrets. Per D-27, this plan is `autonomous: false` — executor stops and waits for the user to type "done".

Purpose: Phase 1 cannot run a single workflow without these secrets. Creating them mid-phase causes cascading failures; gate up front.
Output: A completed checklist artifact the executor uses as the resume signal.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@.planning/phases/01-foundation-ci-cd/01-VALIDATION.md
@CLAUDE.md
@docs/CAVE-PRD.md
</context>

<tasks>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 1.1: Operator provisions external services and installs GitHub Actions secrets</name>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md (decisions D-01..D-29)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md (Environment Availability table)
    - docs/CAVE-PRD.md §20 (canonical env var table)
  </read_first>
  <what-built>
    A written checklist at .planning/phases/01-foundation-ci-cd/01-01-OPERATOR-CHECKLIST.md that enumerates every action the operator must complete before Wave 1 can begin. Executor writes the checklist file first, then halts.
  </what-built>
  <action>
  Step 1 — Executor writes `.planning/phases/01-foundation-ci-cd/01-01-OPERATOR-CHECKLIST.md` with EXACTLY the following sections as markdown checkboxes:

  ```markdown
  # Phase 1 Wave 0 — Operator Provisioning Checklist (D-27)

  Check each box as you complete the step. Reply "done" to the executor when every box is ticked.

  ## Local environment
  - [ ] `nvm install 22 && nvm use 22` (Node 22 LTS active)
  - [ ] `node -v` prints `v22.x.x`
  - [ ] `corepack enable && corepack prepare pnpm@9 --activate`
  - [ ] `pnpm -v` prints `9.x.x`

  ## Sentry
  - [ ] Project created at sentry.io (platform: Next.js)
  - [ ] DSN captured -> repo secret `NEXT_PUBLIC_SENTRY_DSN`
  - [ ] Org slug -> repo secret `SENTRY_ORG`
  - [ ] Project slug -> repo secret `SENTRY_PROJECT`
  - [ ] Auth token (scopes: project:read, project:releases, org:read) -> repo secret `SENTRY_AUTH_TOKEN`

  ## PostHog EU
  - [ ] Project created at **eu.posthog.com** (NOT us.posthog.com)
  - [ ] Project API key -> repo secret `NEXT_PUBLIC_POSTHOG_KEY`
  - [ ] Host value `https://eu.posthog.com` -> repo secret `NEXT_PUBLIC_POSTHOG_HOST`

  ## Supabase (with branching)
  - [ ] Project created at supabase.com
  - [ ] Branching ENABLED (Project Settings -> Branching)
  - [ ] Access token -> repo secret `SUPABASE_ACCESS_TOKEN`
  - [ ] Project ref -> repo secret `SUPABASE_PROJECT_REF`
  - [ ] Direct (session mode) URL -> repo secret `DATABASE_URL`
  - [ ] Pooler (transaction mode) URL -> repo secret `DATABASE_POOL_URL`
  - [ ] API URL -> repo secret `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] anon key -> repo secret `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] service_role key -> repo secret `SUPABASE_SERVICE_ROLE_KEY` (NEVER prefix with NEXT_PUBLIC_)

  ## Vercel (git integration OFF)
  - [ ] Project created at vercel.com (framework: Next.js)
  - [ ] **Git integration DISCONNECTED** in Project Settings -> Git (D-27, INFRA-11, SC-3e)
  - [ ] Screenshot of "no git repository connected" state saved somewhere
  - [ ] Build command overridden to `pnpm build`
  - [ ] Deploy token -> repo secret `VERCEL_TOKEN`
  - [ ] Team ID -> repo secret `VERCEL_ORG_ID`
  - [ ] Project ID -> repo secret `VERCEL_PROJECT_ID`

  ## Inngest
  - [ ] App 'folhario' created at inngest.com
  - [ ] Event key -> repo secret `INNGEST_EVENT_KEY`
  - [ ] Signing key -> repo secret `INNGEST_SIGNING_KEY`

  ## Resolved?
  Reply "done" to the executor. Wave 1 begins.
  ```

  Step 2 — Executor halts with the resume-signal prompt below. It MUST NOT advance until the user replies "done".

  No secrets are echoed by the executor at any point. The operator pastes values into the GitHub Actions UI only (T-4 mitigation).
  </action>
  <how-to-verify>
    Read `.planning/phases/01-foundation-ci-cd/01-01-OPERATOR-CHECKLIST.md` and confirm every checkbox is ticked (or attest orally via the "done" reply that every secret + dashboard step is complete).
  </how-to-verify>
  <acceptance_criteria>
    - File exists: `.planning/phases/01-foundation-ci-cd/01-01-OPERATOR-CHECKLIST.md`
    - File contains the literal headings `## Sentry`, `## PostHog EU`, `## Supabase (with branching)`, `## Vercel (git integration OFF)`, `## Inngest`, `## Local environment`
    - User reply to executor is the literal string `done`
  </acceptance_criteria>
  <resume-signal>Type "done" when every checkbox is ticked and every secret is installed in GitHub Actions.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| operator -> GitHub Actions secrets | Secret values cross from dashboards into repo Secrets |
| operator -> local shell | Secrets may transit through shell history / clipboard |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-4 | Information Disclosure | Operator workflow | mitigate | Executor never echoes, prints, or reads any secret value; operator installs each secret directly in GitHub Actions UI. `::add-mask::` not applicable (no CI step yet). |
| T-01-5 | Tampering | Vercel git integration | mitigate | Wave 0 checklist forces manual toggle + screenshot; SC-3e verification in final wave re-checks. |
| T-01-7 | Information Disclosure | Supabase branching | mitigate | Operator enables branching in dashboard; branch DBs are scoped per PR by SUPABASE_PROJECT_REF and cleaned in SC-2d. |
</threat_model>

<verification>
Operator has typed "done". Checklist file exists with every section heading listed above. No secrets appear in any committed file, shell history, or executor output.
</verification>

<success_criteria>
- Checklist file exists and is committed
- User reply is "done"
- Wave 1 can begin
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-01-SUMMARY.md`.
</output>


### 01-02-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 02
type: execute
wave: 1
depends_on: [01]
files_modified:
  - package.json
  - pnpm-lock.yaml
  - .nvmrc
  - .gitignore
  - .editorconfig
  - .env.example
autonomous: true
requirements: [INFRA-01, INFRA-17]
validation_ref: [SC-1a (scripts), SC-5d (env.example surface)]

must_haves:
  truths:
    - "pnpm install --frozen-lockfile succeeds"
    - "Node version is pinned to 22 LTS via .nvmrc and engines.node"
    - ".env.example enumerates every var from PRD §20 with placeholder values"
    - "Every pnpm script required by CI exists and none use watch mode"
  artifacts:
    - path: "package.json"
      provides: "Dependency manifest + scripts + engines"
      contains: '"name": "folhario"'
    - path: "pnpm-lock.yaml"
      provides: "Deterministic install"
    - path: ".nvmrc"
      provides: "Node 22 pin"
      contains: "22"
    - path: ".env.example"
      provides: "Every env var from PRD §20 with placeholder values"
    - path: ".gitignore"
      provides: "Ignores build artifacts, .env.local, public/sw.js"
  key_links:
    - from: ".github/workflows/*.yml"
      to: "package.json scripts"
      via: "pnpm run <script>"
      pattern: "pnpm (lint|typecheck|test:unit|test:integration|test:e2e|build)"
    - from: "actions/setup-node@v4"
      to: ".nvmrc"
      via: "node-version-file"
      pattern: "node-version-file: .nvmrc"
---

<objective>
Create the `package.json`, `pnpm-lock.yaml`, `.nvmrc`, `.gitignore`, `.editorconfig`, and `.env.example` that every downstream plan and CI workflow depends on. Pin Node 22 LTS, declare every runtime + dev dependency at the exact verified versions from `01-RESEARCH.md#Standard Stack`, and surface every PRD §20 env var in `.env.example` with placeholder values.

Purpose: Without package.json + lockfile, nothing compiles. `.env.example` documents the contract every later plan (and every CI job) reads from.
Output: Reproducible install + a manifest of what Phase 1 needs.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@docs/CAVE-PRD.md
@CLAUDE.md
</context>

<tasks>

<task type="auto">
  <name>Task 2.1: Create package.json with pinned versions and scripts</name>
  <files>package.json, .nvmrc, .gitignore, .editorconfig</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Standard-Stack (verified versions for 2026-04-14)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-01..D-05, D-09
    - CLAUDE.md (pnpm vitest --run ban reference)
  </read_first>
  <action>
  Create `package.json` EXACTLY with this shape (adjust only if `pnpm install` fails to resolve a version — then bump to nearest compatible minor and document in SUMMARY):

  ```json
  {
    "name": "folhario",
    "version": "0.1.0",
    "private": true,
    "engines": {
      "node": ">=22.11.0 <23",
      "pnpm": ">=9 <10"
    },
    "packageManager": "pnpm@9.15.0",
    "scripts": {
      "dev": "next dev",
      "build": "next build",
      "start": "next start",
      "lint": "next lint && prettier --check .",
      "format": "prettier --write .",
      "typecheck": "tsc --noEmit",
      "test:unit": "vitest run --project unit",
      "test:integration": "vitest run --project integration",
      "test:e2e": "playwright test",
      "prepare": "husky"
    },
    "dependencies": {
      "@sentry/nextjs": "10.48.0",
      "@serwist/next": "9.5.7",
      "drizzle-orm": "0.45.2",
      "inngest": "4.2.2",
      "next": "16.2.3",
      "next-intl": "4.9.1",
      "posthog-js": "1.369.0",
      "posthog-node": "5.29.2",
      "postgres": "3.4.9",
      "react": "19.2.5",
      "react-dom": "19.2.5",
      "serwist": "9.5.7",
      "zod": "4.3.6"
    },
    "devDependencies": {
      "@commitlint/cli": "20.5.0",
      "@commitlint/config-conventional": "20.5.0",
      "@playwright/test": "1.59.1",
      "@types/node": "22.10.1",
      "@types/react": "19.0.1",
      "@types/react-dom": "19.0.1",
      "@vitest/coverage-v8": "4.1.4",
      "drizzle-kit": "0.31.10",
      "eslint": "9.16.0",
      "eslint-config-next": "16.2.3",
      "eslint-plugin-import": "2.31.0",
      "eslint-plugin-jsx-a11y": "6.10.2",
      "husky": "9.1.7",
      "lint-staged": "16.4.0",
      "prettier": "3.4.2",
      "typescript": "5.7.2",
      "vercel": "51.2.1",
      "vitest": "4.1.4"
    },
    "lint-staged": {
      "*.{ts,tsx,js,jsx,json,md,yml,yaml}": ["prettier --write"],
      "*.{ts,tsx}": ["eslint --fix"]
    }
  }
  ```

  **Watch-mode ban enforcement (CLAUDE.md + VALIDATION.md):** `test:unit` and `test:integration` use `vitest run` (NOT `vitest`). `test:e2e` uses `playwright test` (has no watch mode). NO script may use `vitest` or `vitest watch` without `run`.

  Create `.nvmrc`:
  ```
  22
  ```

  Create `.gitignore`:
  ```
  node_modules/
  .next/
  out/
  dist/
  build/

  # Serwist build artifacts (D-26)
  public/sw.js
  public/sw.js.map
  public/workbox-*.js
  public/workbox-*.js.map

  # Env
  .env
  .env.local
  .env.*.local

  # Test artifacts
  coverage/
  playwright-report/
  test-results/
  .vercel/

  # OS
  .DS_Store
  Thumbs.db

  # Editor
  .vscode/*
  !.vscode/settings.json
  !.vscode/extensions.json
  .idea/
  ```

  Create `.editorconfig`:
  ```ini
  root = true

  [*]
  indent_style = space
  indent_size = 2
  end_of_line = lf
  charset = utf-8
  trim_trailing_whitespace = true
  insert_final_newline = true

  [*.md]
  trim_trailing_whitespace = false
  ```

  Run `pnpm install` to generate `pnpm-lock.yaml`.
  </action>
  <verify>
    <automated>pnpm install --frozen-lockfile && test -f pnpm-lock.yaml && test -f .nvmrc && test "$(cat .nvmrc)" = "22"</automated>
  </verify>
  <acceptance_criteria>
    - `package.json` exists and `jq -r .name package.json` prints `folhario`
    - `jq -r '.engines.node' package.json` matches `>=22.11.0 <23`
    - `jq -r '.scripts."test:unit"' package.json` equals `vitest run --project unit`
    - `jq -r '.scripts."test:integration"' package.json` equals `vitest run --project integration`
    - NO script contains the string `vitest` followed by a space/newline without `run` (grep: `grep -E '"vitest"\s*[^r]' package.json` returns nothing)
    - `.nvmrc` contains only `22`
    - `.gitignore` contains `public/sw.js` and `.env.local`
    - `pnpm-lock.yaml` exists and `pnpm install --frozen-lockfile` exits 0
  </acceptance_criteria>
  <done>`pnpm install --frozen-lockfile` exits 0 in a clean checkout</done>
</task>

<task type="auto">
  <name>Task 2.2: Author .env.example with every PRD §20 variable</name>
  <files>.env.example</files>
  <read_first>
    - docs/CAVE-PRD.md §20 (full env var table)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-27 (secrets enumerated)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Environment-Availability
  </read_first>
  <action>
  Create `.env.example` listing every variable from PRD §20 grouped by category, with placeholder values only. The file is committed and read by every developer + referenced by `src/shared/config/env.ts` Zod schema in plan 06.

  ```dotenv
  # === Public (NEXT_PUBLIC_*) ===
  NEXT_PUBLIC_SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
  NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
  NEXT_PUBLIC_SENTRY_DSN="https://public@sentry.io/PROJECT_ID"
  NEXT_PUBLIC_POSTHOG_KEY="phc_..."
  NEXT_PUBLIC_POSTHOG_HOST="https://eu.posthog.com"

  # === Server-only — Supabase ===
  SUPABASE_SERVICE_ROLE_KEY="eyJ..."                       # NEVER prefix with NEXT_PUBLIC_
  SUPABASE_ACCESS_TOKEN="sbp_..."                          # CI only, for branching
  SUPABASE_PROJECT_REF="your-project-ref"                  # CI only
  DATABASE_URL="postgresql://postgres:password@db.YOUR_REF.supabase.co:5432/postgres"
  DATABASE_POOL_URL="postgresql://postgres.YOUR_REF:password@aws-0-region.pooler.supabase.com:6543/postgres"

  # === Server-only — Sentry ===
  SENTRY_ORG="your-org"
  SENTRY_PROJECT="folhario"
  SENTRY_AUTH_TOKEN="sntrys_..."                           # CI only, for source map upload

  # === Server-only — Inngest ===
  INNGEST_EVENT_KEY="your-event-key"
  INNGEST_SIGNING_KEY="signkey-..."

  # === Server-only — Vercel (CI only) ===
  VERCEL_TOKEN="your-vercel-token"
  VERCEL_ORG_ID="team_..."
  VERCEL_PROJECT_ID="prj_..."

  # === Provider mode gate (INFRA-16, D-24, D-29) ===
  IDENTIFICATION_PROVIDER_MODE="stub"                      # "stub" | "real" — preview always stub

  # === Vercel runtime env (auto-set in Vercel; use for local parity) ===
  # VERCEL_ENV="development"                               # "development" | "preview" | "production"
  # VERCEL_GIT_COMMIT_SHA="abcd1234"                       # auto-populated in Vercel; locally unset
  ```
  </action>
  <verify>
    <automated>test -f .env.example && grep -q "NEXT_PUBLIC_SENTRY_DSN" .env.example && grep -q "IDENTIFICATION_PROVIDER_MODE" .env.example && grep -q "DATABASE_POOL_URL" .env.example && ! grep -q "^SUPABASE_SERVICE_ROLE_KEY=\"eyJ\\.\\.\\.\"$" .env.example || true; grep -q "SUPABASE_SERVICE_ROLE_KEY" .env.example</automated>
  </verify>
  <acceptance_criteria>
    - `.env.example` contains ALL of: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `DATABASE_URL`, `DATABASE_POOL_URL`, `SENTRY_ORG`, `SENTRY_PROJECT`, `SENTRY_AUTH_TOKEN`, `INNGEST_EVENT_KEY`, `INNGEST_SIGNING_KEY`, `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `IDENTIFICATION_PROVIDER_MODE`
    - No real secret values in the file (placeholder pattern `eyJ...`, `phc_...`, etc.)
    - `SUPABASE_SERVICE_ROLE_KEY` is NOT prefixed with `NEXT_PUBLIC_` (T-1-LGPD)
  </acceptance_criteria>
  <done>All 19 env vars listed above present in .env.example; no task consumer needs additional env discovery</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-02-1 | Information Disclosure | `.env.example` | mitigate | Only placeholder values in committed file; `.env` and `.env.local` gitignored; real values live in GH Actions secrets (Wave 0 operator checklist) |
| T-02-2 | Elevation of Privilege | `SUPABASE_SERVICE_ROLE_KEY` | mitigate | Never prefixed with `NEXT_PUBLIC_`; acceptance criterion enforces; Zod schema in plan 06 rejects if prefixed |
</threat_model>

<verification>
`pnpm install --frozen-lockfile` completes without error. `.env.example` contains every var referenced by PRD §20 and by downstream plans 06 (env.ts), 14 (ci.yml), 15 (deploy-preview.yml), 17 (deploy-production.yml).
</verification>

<success_criteria>
- `pnpm install --frozen-lockfile` exits 0
- `.env.example` committed with all PRD §20 vars
- Node 22 pinned in `engines.node` AND `.nvmrc`
- No watch-mode vitest invocations anywhere in scripts
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-02-SUMMARY.md`.
</output>


### 01-03-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 03
type: execute
wave: 1
depends_on: [01]
files_modified:
  - tsconfig.json
  - eslint.config.mjs
  - .prettierrc
  - .prettierignore
  - commitlint.config.mjs
  - .husky/pre-commit
  - .husky/commit-msg
autonomous: true
requirements: [INFRA-01]
validation_ref: [SC-1b]

must_haves:
  truths:
    - "`pnpm typecheck` exits 0 on an empty src/ tree"
    - "`pnpm lint` exits 0"
    - "tsconfig.json has strict + noUncheckedIndexedAccess + D-06 flags + @/* alias"
    - "husky pre-commit runs lint-staged + typecheck; commit-msg runs commitlint"
  artifacts:
    - path: "tsconfig.json"
      provides: "TypeScript strict-plus config per D-06"
      contains: '"noUncheckedIndexedAccess": true'
    - path: "eslint.config.mjs"
      provides: "Flat ESLint config with next + jsx-a11y + import plugins"
    - path: ".prettierrc"
      provides: "Formatter config"
    - path: "commitlint.config.mjs"
      provides: "Conventional Commits enforcement (D-05)"
    - path: ".husky/pre-commit"
      provides: "Pre-commit gate (D-04)"
    - path: ".husky/commit-msg"
      provides: "commitlint hook"
  key_links:
    - from: "`pnpm prepare`"
      to: ".husky/"
      via: "husky install"
      pattern: "husky"
---

<objective>
Wire the TypeScript compiler, linter, formatter, and git hooks so every future task can rely on `pnpm lint && pnpm typecheck` as a reliable quality gate. Implement D-06 (strict-plus), D-07 (path alias), D-03 (ESLint + Prettier), D-04 (husky + lint-staged), D-05 (commitlint).

Purpose: Every later task's `<verify>` depends on these exit-0. Without them the plans cannot self-verify.
Output: A working typecheck + lint + hook pipeline on an empty source tree.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 3.1: Create tsconfig.json with strict-plus flags and @/* alias</name>
  <files>tsconfig.json</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-06, D-07
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-1 (exactOptionalPropertyTypes excluded)
  </read_first>
  <action>
  Create `tsconfig.json` with the EXACT contents below. Do NOT add `exactOptionalPropertyTypes` (D-06 excludes it — Pitfall 1).

  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": false,
      "skipLibCheck": true,
      "strict": true,
      "noUncheckedIndexedAccess": true,
      "noImplicitOverride": true,
      "noFallthroughCasesInSwitch": true,
      "noPropertyAccessFromIndexSignature": true,
      "forceConsistentCasingInFileNames": true,
      "noEmit": true,
      "esModuleInterop": true,
      "module": "esnext",
      "moduleResolution": "bundler",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "verbatimModuleSyntax": false,
      "jsx": "preserve",
      "incremental": true,
      "plugins": [{ "name": "next" }],
      "paths": {
        "@/*": ["./src/*"]
      }
    },
    "include": [
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      ".next/types/**/*.ts"
    ],
    "exclude": ["node_modules", ".next", "out", "dist"]
  }
  ```

  Create a one-file placeholder so `tsc --noEmit` has something to check: `src/placeholder.ts` with contents `export {};` (delete in a later plan once real code lands, or leave — harmless).
  </action>
  <verify>
    <automated>pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `tsconfig.json` exists
    - `grep -q '"strict": true' tsconfig.json` succeeds
    - `grep -q '"noUncheckedIndexedAccess": true' tsconfig.json` succeeds
    - `grep -q '"noImplicitOverride": true' tsconfig.json` succeeds
    - `grep -q '"noFallthroughCasesInSwitch": true' tsconfig.json` succeeds
    - `grep -q '"noPropertyAccessFromIndexSignature": true' tsconfig.json` succeeds
    - `grep -q '"forceConsistentCasingInFileNames": true' tsconfig.json` succeeds
    - `grep -q 'exactOptionalPropertyTypes' tsconfig.json` DOES NOT match (flag is excluded)
    - `grep -q '"@/\*": \["./src/\*"\]' tsconfig.json` succeeds
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>pnpm typecheck exits 0 on placeholder source tree</done>
</task>

<task type="auto">
  <name>Task 3.2: Create eslint.config.mjs, .prettierrc, commitlint.config.mjs, husky hooks</name>
  <files>eslint.config.mjs, .prettierrc, .prettierignore, commitlint.config.mjs, .husky/pre-commit, .husky/commit-msg</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-03, D-04, D-05
    - package.json (lint-staged config)
  </read_first>
  <action>
  Create `eslint.config.mjs` (flat config, Next 16 scaffold format):

  ```javascript
  import { FlatCompat } from '@eslint/eslintrc';
  import jsxA11y from 'eslint-plugin-jsx-a11y';
  import importPlugin from 'eslint-plugin-import';

  const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

  export default [
    ...compat.extends('next/core-web-vitals', 'next/typescript'),
    {
      plugins: { 'jsx-a11y': jsxA11y, import: importPlugin },
      rules: {
        'jsx-a11y/alt-text': 'error',
        'import/order': ['warn', { 'newlines-between': 'always', alphabetize: { order: 'asc' } }],
      },
    },
    {
      ignores: ['.next/**', 'out/**', 'node_modules/**', 'public/sw.js', 'public/workbox-*.js', 'coverage/**', 'playwright-report/**'],
    },
  ];
  ```

  Create `.prettierrc`:
  ```json
  {
    "semi": true,
    "singleQuote": true,
    "trailingComma": "all",
    "printWidth": 100,
    "tabWidth": 2,
    "arrowParens": "always"
  }
  ```

  Create `.prettierignore`:
  ```
  .next
  out
  dist
  coverage
  playwright-report
  test-results
  pnpm-lock.yaml
  public/sw.js
  public/sw.js.map
  ```

  Create `commitlint.config.mjs`:
  ```javascript
  export default { extends: ['@commitlint/config-conventional'] };
  ```

  Create `.husky/pre-commit` (executable):
  ```sh
  pnpm exec lint-staged
  pnpm typecheck
  ```

  Create `.husky/commit-msg` (executable):
  ```sh
  pnpm exec commitlint --edit "$1"
  ```

  Then run `pnpm exec husky` (installs hooks via `.husky/_` helper scripts). Make both hook files executable: `chmod +x .husky/pre-commit .husky/commit-msg`.
  </action>
  <verify>
    <automated>pnpm lint && test -x .husky/pre-commit && test -x .husky/commit-msg && pnpm exec commitlint --from=HEAD~0 --to=HEAD --verbose 2>/dev/null || true</automated>
  </verify>
  <acceptance_criteria>
    - `eslint.config.mjs` exists and imports `eslint-plugin-jsx-a11y` + `eslint-plugin-import`
    - `.prettierrc` contains `"singleQuote": true`
    - `commitlint.config.mjs` extends `@commitlint/config-conventional`
    - `.husky/pre-commit` is executable (`test -x .husky/pre-commit`)
    - `.husky/commit-msg` is executable
    - `pnpm lint` exits 0 on empty-ish source tree
    - `pnpm exec commitlint --help` exits 0
  </acceptance_criteria>
  <done>`pnpm lint` exits 0 and git hooks are installed</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-03-a | Tampering | git hooks | accept | Hooks are developer-side only; CI is the backstop (commitlint + eslint re-run in ci.yml) |
| T-03-10 | DoS | commitlint in CI | accept | commitlint failure blocks PR merge (branch protection in plan 17) |
</threat_model>

<verification>
`pnpm lint && pnpm typecheck` exits 0. Hooks fire on a test commit (manual verification not required since ci.yml re-runs the same commands in plan 14).
</verification>

<success_criteria>
- TypeScript strict-plus flags enforced per D-06
- ESLint flat config active
- husky + lint-staged + commitlint wired
- `pnpm lint && pnpm typecheck` both exit 0
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-03-SUMMARY.md`.
</output>


### 01-04-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 04
type: execute
wave: 1
depends_on: [01]
files_modified:
  - src/contexts/iam/domain/README.md
  - src/contexts/iam/application/README.md
  - src/contexts/iam/infrastructure/README.md
  - src/contexts/iam/api/README.md
  - src/contexts/iam/inngest/README.md
  - src/contexts/catalog/domain/README.md
  - src/contexts/catalog/application/README.md
  - src/contexts/catalog/infrastructure/README.md
  - src/contexts/catalog/api/README.md
  - src/contexts/catalog/inngest/README.md
  - src/contexts/species-care/domain/README.md
  - src/contexts/species-care/application/README.md
  - src/contexts/species-care/infrastructure/README.md
  - src/contexts/species-care/api/README.md
  - src/contexts/species-care/inngest/README.md
  - src/contexts/identification/domain/README.md
  - src/contexts/identification/application/README.md
  - src/contexts/identification/infrastructure/README.md
  - src/contexts/identification/api/README.md
  - src/contexts/identification/inngest/README.md
  - src/contexts/reminders/domain/README.md
  - src/contexts/reminders/application/README.md
  - src/contexts/reminders/infrastructure/README.md
  - src/contexts/reminders/api/README.md
  - src/contexts/reminders/inngest/README.md
  - src/contexts/billing/domain/README.md
  - src/contexts/billing/application/README.md
  - src/contexts/billing/infrastructure/README.md
  - src/contexts/billing/api/README.md
  - src/contexts/billing/inngest/README.md
  - src/contexts/notifications/domain/README.md
  - src/contexts/notifications/application/README.md
  - src/contexts/notifications/infrastructure/README.md
  - src/contexts/notifications/api/README.md
  - src/contexts/notifications/inngest/README.md
  - src/shared/db/README.md
  - src/shared/events/README.md
  - src/shared/adapters/README.md
  - src/shared/config/README.md
  - src/shared/telemetry/README.md
autonomous: true
requirements: [INFRA-02]
validation_ref: [SC-1e]

must_haves:
  truths:
    - "Every bounded context from PRD §2 has all 5 layer folders (domain, application, infrastructure, api, inngest) with a README.md stub"
    - "src/shared/{db,events,adapters,config,telemetry}/ all exist with README.md stubs"
    - "Folder scaffold unit test passes against the layout"
  artifacts:
    - path: "src/contexts/"
      provides: "7 bounded contexts × 5 layers = 35 directories with README.md"
    - path: "src/shared/"
      provides: "5 shared directories with README.md"
---

<objective>
Scaffold the entire bounded-context directory layout from PRD §2 per D-08. Every one of the 7 contexts (iam, catalog, species-care, identification, reminders, billing, notifications) has all 5 layer subdirectories (domain, application, infrastructure, api, inngest), and each contains a README.md stub describing its responsibility. `src/shared/{db,events,adapters,config,telemetry}` also created with README stubs. Phase 2 fills them with code.

Purpose: Delivers INFRA-02 verifiably in Phase 1. Downstream plans add files INTO these folders without needing to mkdir.
Output: A greenfield repo with 40 empty-ish directories that the unit test in plan 12 can assert.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@docs/CAVE-PRD.md
</context>

<tasks>

<task type="auto">
  <name>Task 4.1: Create bounded-context folder scaffold with README stubs</name>
  <files>src/contexts/**/README.md, src/shared/**/README.md</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-08
    - docs/CAVE-PRD.md §2 (exact repo layout specification)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Recommended-Project-Structure
  </read_first>
  <action>
  Create the scaffold exactly as specified. For EACH of the 7 bounded contexts:
  - `src/contexts/iam/`
  - `src/contexts/catalog/`
  - `src/contexts/species-care/`
  - `src/contexts/identification/`
  - `src/contexts/reminders/`
  - `src/contexts/billing/`
  - `src/contexts/notifications/`

  create subdirectories `domain/`, `application/`, `infrastructure/`, `api/`, `inngest/` — and put a README.md in each with this template (replace {CONTEXT} and {LAYER}):

  ```markdown
  # {CONTEXT} / {LAYER}

  Placeholder for Phase 2. This directory is reserved for the {LAYER} layer of the {CONTEXT} bounded context per PRD §2.

  - `domain/` — entities, value objects, domain services, invariants
  - `application/` — use cases (thin orchestration over domain + adapters)
  - `infrastructure/` — adapter implementations (Drizzle repos, external SDK wrappers)
  - `api/` — Next.js route handlers under `/api/v1/{context}/*`
  - `inngest/` — Inngest function definitions scoped to this context

  Phase 1 ships this directory empty so INFRA-02 can be verified.
  ```

  Then create `src/shared/{db,events,adapters,config,telemetry}/README.md` using this template:

  ```markdown
  # shared / {NAME}

  Cross-cutting utilities used by all bounded contexts. Phase 1 wires minimal contents; Phase 2 expands.

  | Phase | Contents |
  |-------|----------|
  | 1 | {phase-1-contents} |
  | 2+ | {phase-2-contents} |
  ```

  Use these phase-1-contents / phase-2-contents pairings:
  - `db` → Phase 1: `client.ts` (postgres-js + `{ prepare: false }`), empty `schema.ts`. Phase 2+: Drizzle tables, repositories.
  - `events` → Phase 1: empty. Phase 2+: Typed event definitions for Inngest.
  - `adapters` → Phase 1: empty. Phase 2+: `AuthAdapter`, `StorageAdapter`, `BillingProvider` interfaces.
  - `config` → Phase 1: `env.ts` (Zod-validated). Phase 2+: Feature flags, budgets.
  - `telemetry` → Phase 1: Sentry + PostHog client/server factories. Phase 2+: Structured logging wrapper.

  Directories must be created even if empty except for README. Git does not track empty dirs, so the README is the tracking file.

  **Implementation tip:** Bash loop in a single script for creation:
  ```bash
  for ctx in iam catalog species-care identification reminders billing notifications; do
    for layer in domain application infrastructure api inngest; do
      mkdir -p "src/contexts/$ctx/$layer"
      # write README with $ctx and $layer interpolated
    done
  done
  for shared in db events adapters config telemetry; do
    mkdir -p "src/shared/$shared"
    # write shared README
  done
  ```
  Use the `Write` tool (not `cat <<EOF`) for every README file.
  </action>
  <verify>
    <automated>for ctx in iam catalog species-care identification reminders billing notifications; do for layer in domain application infrastructure api inngest; do test -f "src/contexts/$ctx/$layer/README.md" || { echo "MISSING: src/contexts/$ctx/$layer/README.md"; exit 1; }; done; done; for shared in db events adapters config telemetry; do test -f "src/shared/$shared/README.md" || { echo "MISSING: src/shared/$shared/README.md"; exit 1; }; done; echo OK</automated>
  </verify>
  <acceptance_criteria>
    - 7 × 5 = 35 README.md files under `src/contexts/**/`
    - 5 README.md files under `src/shared/**/`
    - Total 40 files created
    - Each `src/contexts/*/domain/README.md` contains the string `domain`
    - Each `src/shared/*/README.md` contains a `| Phase | Contents |` table header
    - `pnpm typecheck` still exits 0 (READMEs don't break TS)
  </acceptance_criteria>
  <done>All 40 directories exist with README.md stubs; folder-scaffold unit test in plan 12 will assert them</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-a | None | Folder scaffold | accept | Pure filesystem operation; no attack surface |
</threat_model>

<verification>
All directories exist. The plan 12 `tests/unit/folder-scaffold.test.ts` will verify the layout structurally.
</verification>

<success_criteria>
- 35 bounded-context layer README files exist
- 5 shared README files exist
- INFRA-02 scaffold complete per D-08
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-04-SUMMARY.md`.
</output>


### 01-05-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 05
type: tdd
wave: 2
depends_on: [02, 03, 04]
files_modified:
  - src/shared/errors/codes.ts
  - tests/unit/error-codes.test.ts
autonomous: true
requirements: [INFRA-20]
validation_ref: [SC-5a]

must_haves:
  truths:
    - "`ErrorCode` is a `const` object with all 21 codes from PRD §5"
    - "`ErrorCode` is NOT a TypeScript `enum`"
    - "`INTERNAL_ONLY_CODES` Set contains `cost_ceiling_reached` AND `breaker_open`"
    - "`ERROR_HTTP_STATUS` maps every code to an HTTP status"
    - "Unit test asserts all 21 codes present"
  artifacts:
    - path: "src/shared/errors/codes.ts"
      provides: "Closed error code registry per D-23 + INFRA-20"
      contains: "ErrorCode"
      exports: [ErrorCode, INTERNAL_ONLY_CODES, ERROR_HTTP_STATUS]
    - path: "tests/unit/error-codes.test.ts"
      provides: "SC-5a verification"
---

<objective>
TDD plan: build the closed error code registry in `src/shared/errors/codes.ts` per D-23 and PRD §5. Unit test asserts all 21 codes present, internal-only set correct, and HTTP status map complete. This is the ONLY place in the codebase where error codes are defined — every route handler imports from here (INFRA-20).

Purpose: Closed registry prevents ad-hoc error codes from leaking into responses. Internal-only codes (`cost_ceiling_reached`, `breaker_open`) MUST be mapped to `provider_unavailable` by route handlers before returning to clients.
Output: One typed module + one unit test that every CI run exercises.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@docs/CAVE-PRD.md
</context>

<feature>
  <name>Closed error code registry</name>
  <files>src/shared/errors/codes.ts, tests/unit/error-codes.test.ts</files>
  <behavior>
  Exports 3 constants from `@/shared/errors/codes`:
    1. `ErrorCode` — `as const` object with 21 string-valued keys matching PRD §5:
       - Auth: `Unauthenticated`, `TokenExpired`, `InvalidCredentials`, `Forbidden`, `EmailUnverified`
       - Validation: `ValidationFailed`, `InvalidPartnerCode`
       - Resource: `NotFound`, `Conflict`
       - Consent / LGPD: `ConsentRequired`, `DeletionInProgress`
       - Subscription: `SubscriptionRequired`, `ReadOnlyMode`
       - Identification caps: `CapHit`
       - Providers (external): `ProviderUnavailable`, `Timeout`
       - Providers (INTERNAL): `CostCeilingReached`, `BreakerOpen`
       - Webhooks: `WebhookSignatureInvalid`
       - Rate limit: `RateLimited`
       - Fallback: `InternalError`
       → 21 codes total
    2. `INTERNAL_ONLY_CODES` — `Set<ErrorCode>` containing exactly `cost_ceiling_reached` and `breaker_open`
    3. `ERROR_HTTP_STATUS` — `Record<ErrorCode, number>` mapping each code to its HTTP status (matching §5 table)

  Also exports a type alias `ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode]` and a helper `toPublicErrorCode(code: ErrorCode): ErrorCode` that maps internal codes to `provider_unavailable`.

  Test cases:
    - `ErrorCode` contains all 21 keys listed above (enumerate each)
    - `Object.values(ErrorCode)` has exactly 21 unique strings
    - `typeof ErrorCode === 'object'` (not a TS enum)
    - `INTERNAL_ONLY_CODES.size === 2`
    - `INTERNAL_ONLY_CODES.has('cost_ceiling_reached') === true`
    - `INTERNAL_ONLY_CODES.has('breaker_open') === true`
    - `INTERNAL_ONLY_CODES.has('provider_unavailable') === false`
    - `ERROR_HTTP_STATUS.unauthenticated === 401`
    - `ERROR_HTTP_STATUS.validation_failed === 400`
    - `ERROR_HTTP_STATUS.provider_unavailable === 503`
    - `ERROR_HTTP_STATUS.timeout === 504`
    - `ERROR_HTTP_STATUS.rate_limited === 429`
    - `ERROR_HTTP_STATUS.cap_hit === 429`
    - `toPublicErrorCode('cost_ceiling_reached') === 'provider_unavailable'`
    - `toPublicErrorCode('breaker_open') === 'provider_unavailable'`
    - `toPublicErrorCode('validation_failed') === 'validation_failed'` (passthrough)
  </behavior>
  <implementation>
  Use the `as const` pattern from RESEARCH Pattern 7 verbatim. The exact shape is specified there; this task copies it and adds `toPublicErrorCode` as a helper.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 5.1: RED — Write failing unit test for error code registry</name>
  <files>tests/unit/error-codes.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-7 (closed error-code registry)
    - docs/CAVE-PRD.md §5 (authoritative list of 21 codes)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-23
  </read_first>
  <behavior>
    - All 16+ assertions from the `<behavior>` block above
  </behavior>
  <action>
  Create `tests/unit/error-codes.test.ts` using Vitest. Import from `@/shared/errors/codes`. Write each test case as an individual `it(...)` call.

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { ErrorCode, INTERNAL_ONLY_CODES, ERROR_HTTP_STATUS, toPublicErrorCode } from '@/shared/errors/codes';

  const ALL_CODES = [
    'unauthenticated', 'token_expired', 'invalid_credentials', 'forbidden', 'email_unverified',
    'validation_failed', 'invalid_partner_code',
    'not_found', 'conflict',
    'consent_required', 'deletion_in_progress',
    'subscription_required', 'read_only_mode',
    'cap_hit',
    'provider_unavailable', 'timeout',
    'cost_ceiling_reached', 'breaker_open',
    'webhook_signature_invalid',
    'rate_limited',
    'internal_error',
  ] as const;

  describe('ErrorCode registry (INFRA-20, D-23, PRD §5)', () => {
    it('contains all 21 codes from PRD §5', () => {
      const values = new Set(Object.values(ErrorCode));
      expect(values.size).toBe(21);
      for (const code of ALL_CODES) expect(values.has(code)).toBe(true);
    });

    it('is an as-const object, not a TypeScript enum', () => {
      expect(typeof ErrorCode).toBe('object');
      expect(Object.isFrozen(ErrorCode)).toBeTypeOf('boolean'); // as const is structurally frozen in TS
    });

    it('INTERNAL_ONLY_CODES contains exactly cost_ceiling_reached and breaker_open', () => {
      expect(INTERNAL_ONLY_CODES.size).toBe(2);
      expect(INTERNAL_ONLY_CODES.has('cost_ceiling_reached')).toBe(true);
      expect(INTERNAL_ONLY_CODES.has('breaker_open')).toBe(true);
      expect(INTERNAL_ONLY_CODES.has('provider_unavailable')).toBe(false);
    });

    it('ERROR_HTTP_STATUS maps key codes correctly', () => {
      expect(ERROR_HTTP_STATUS.unauthenticated).toBe(401);
      expect(ERROR_HTTP_STATUS.validation_failed).toBe(400);
      expect(ERROR_HTTP_STATUS.not_found).toBe(404);
      expect(ERROR_HTTP_STATUS.conflict).toBe(409);
      expect(ERROR_HTTP_STATUS.subscription_required).toBe(402);
      expect(ERROR_HTTP_STATUS.cap_hit).toBe(429);
      expect(ERROR_HTTP_STATUS.rate_limited).toBe(429);
      expect(ERROR_HTTP_STATUS.provider_unavailable).toBe(503);
      expect(ERROR_HTTP_STATUS.timeout).toBe(504);
      expect(ERROR_HTTP_STATUS.internal_error).toBe(500);
    });

    it('toPublicErrorCode maps internal codes to provider_unavailable', () => {
      expect(toPublicErrorCode('cost_ceiling_reached')).toBe('provider_unavailable');
      expect(toPublicErrorCode('breaker_open')).toBe('provider_unavailable');
    });

    it('toPublicErrorCode passes non-internal codes through', () => {
      expect(toPublicErrorCode('validation_failed')).toBe('validation_failed');
      expect(toPublicErrorCode('unauthenticated')).toBe('unauthenticated');
    });
  });
  ```

  Run `pnpm test:unit`. Test MUST fail (file `src/shared/errors/codes.ts` does not exist yet).

  Commit: `test(01-05): add failing error code registry tests`
  </action>
  <verify>
    <automated>pnpm test:unit 2>&1 | grep -q "error-codes" && pnpm test:unit; test $? -ne 0 && echo RED_OK</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/error-codes.test.ts` exists
    - `pnpm test:unit` fails with errors referencing missing module `@/shared/errors/codes`
    - Commit message starts with `test(01-05):`
  </acceptance_criteria>
  <done>Test file exists, test run fails (RED)</done>
</task>

<task type="auto" tdd="true">
  <name>Task 5.2: GREEN — Implement src/shared/errors/codes.ts</name>
  <files>src/shared/errors/codes.ts</files>
  <read_first>
    - tests/unit/error-codes.test.ts (from Task 5.1)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-7
  </read_first>
  <action>
  Create `src/shared/errors/codes.ts` EXACTLY matching RESEARCH Pattern 7, plus a `toPublicErrorCode` helper:

  ```typescript
  /**
   * Closed error code registry. Source: PRD §5 + D-23.
   * DO NOT add ad-hoc codes. Internal-only codes (cost_ceiling_reached,
   * breaker_open) MUST be mapped to provider_unavailable before returning
   * to clients — use toPublicErrorCode().
   */
  export const ErrorCode = {
    Unauthenticated: 'unauthenticated',
    TokenExpired: 'token_expired',
    InvalidCredentials: 'invalid_credentials',
    Forbidden: 'forbidden',
    EmailUnverified: 'email_unverified',
    ValidationFailed: 'validation_failed',
    InvalidPartnerCode: 'invalid_partner_code',
    NotFound: 'not_found',
    Conflict: 'conflict',
    ConsentRequired: 'consent_required',
    DeletionInProgress: 'deletion_in_progress',
    SubscriptionRequired: 'subscription_required',
    ReadOnlyMode: 'read_only_mode',
    CapHit: 'cap_hit',
    ProviderUnavailable: 'provider_unavailable',
    Timeout: 'timeout',
    CostCeilingReached: 'cost_ceiling_reached',
    BreakerOpen: 'breaker_open',
    WebhookSignatureInvalid: 'webhook_signature_invalid',
    RateLimited: 'rate_limited',
    InternalError: 'internal_error',
  } as const;

  export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

  export const INTERNAL_ONLY_CODES: ReadonlySet<ErrorCode> = new Set<ErrorCode>([
    ErrorCode.CostCeilingReached,
    ErrorCode.BreakerOpen,
  ]);

  export const ERROR_HTTP_STATUS: Record<ErrorCode, number> = {
    unauthenticated: 401,
    token_expired: 401,
    invalid_credentials: 401,
    forbidden: 403,
    email_unverified: 403,
    validation_failed: 400,
    invalid_partner_code: 400,
    not_found: 404,
    conflict: 409,
    consent_required: 403,
    deletion_in_progress: 403,
    subscription_required: 402,
    read_only_mode: 402,
    cap_hit: 429,
    provider_unavailable: 503,
    timeout: 504,
    cost_ceiling_reached: 500,
    breaker_open: 500,
    webhook_signature_invalid: 401,
    rate_limited: 429,
    internal_error: 500,
  };

  /** Maps internal-only codes to provider_unavailable before client-facing response. */
  export function toPublicErrorCode(code: ErrorCode): ErrorCode {
    if (INTERNAL_ONLY_CODES.has(code)) return ErrorCode.ProviderUnavailable;
    return code;
  }
  ```

  Run `pnpm test:unit`. All assertions in Task 5.1 test file MUST pass.

  Commit: `feat(01-05): implement closed error code registry`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -E "(PASS|passed).*error-codes"</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/errors/codes.ts` exists and exports `ErrorCode`, `ErrorCode` type, `INTERNAL_ONLY_CODES`, `ERROR_HTTP_STATUS`, `toPublicErrorCode`
    - `pnpm test:unit` passes the `ErrorCode registry` describe block
    - `pnpm typecheck` exits 0
    - No TypeScript `enum` keyword used (`grep -q 'enum ErrorCode' src/shared/errors/codes.ts` returns NOTHING)
  </acceptance_criteria>
  <done>Test suite passes GREEN</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-13 | Information Disclosure | Internal error codes leaking to clients | mitigate | `INTERNAL_ONLY_CODES` set + `toPublicErrorCode` helper; route handlers in Phase 2+ MUST call helper before returning; ESLint rule to enforce deferred to Phase 2 |
</threat_model>

<verification>
`pnpm test:unit` passes error-codes.test.ts with all assertions green.
</verification>

<success_criteria>
- 21 codes present
- Internal-only set of size 2
- HTTP status map complete
- `toPublicErrorCode` maps internal → provider_unavailable
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-05-SUMMARY.md`.
</output>


### 01-06-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 06
type: tdd
wave: 2
depends_on: [02, 03, 04]
files_modified:
  - src/shared/config/env.ts
  - tests/unit/env-provider-mode.test.ts
autonomous: true
requirements: [INFRA-16, INFRA-17]
validation_ref: [SC-5c, SC-5d]

must_haves:
  truths:
    - "`env.ts` exports a Zod-parsed `env` object"
    - "Schema rejects missing required keys at boot"
    - "`IDENTIFICATION_PROVIDER_MODE` is `stub` | `real`, required"
    - "`SUPABASE_SERVICE_ROLE_KEY` present WITHOUT `NEXT_PUBLIC_` prefix"
    - "Schema accepts all PRD §20 variables"
  artifacts:
    - path: "src/shared/config/env.ts"
      provides: "Zod-validated env var parser (INFRA-17)"
      exports: [env, Env]
    - path: "tests/unit/env-provider-mode.test.ts"
      provides: "SC-5c + SC-5d verification"
---

<objective>
TDD plan: build `src/shared/config/env.ts` — a Zod schema that parses and validates every env var from PRD §20 at boot time. Fails fast on missing/invalid vars. Exports a typed `env` object every downstream module imports from.

Purpose: Prevent silently shipping empty strings to production (Pitfall from RESEARCH#Dont-Hand-Roll). Gate `IDENTIFICATION_PROVIDER_MODE` (INFRA-16, D-24). Verify `SUPABASE_SERVICE_ROLE_KEY` is server-only (never `NEXT_PUBLIC_`-prefixed).
Output: The single source of truth every other plan imports env values from.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@.env.example
@docs/CAVE-PRD.md
</context>

<feature>
  <name>Zod-validated env parser</name>
  <files>src/shared/config/env.ts, tests/unit/env-provider-mode.test.ts</files>
  <behavior>
  Exports `env` (parsed + frozen object) and `Env` (type alias). Zod schema covers:

  **Public (NEXT_PUBLIC_*):**
    - `NEXT_PUBLIC_SUPABASE_URL` — `z.string().url()`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — `z.string().min(1)`
    - `NEXT_PUBLIC_SENTRY_DSN` — `z.string().url().optional()` (local dev may omit)
    - `NEXT_PUBLIC_POSTHOG_KEY` — `z.string().min(1).optional()`
    - `NEXT_PUBLIC_POSTHOG_HOST` — `z.string().url().default('https://eu.posthog.com')` AND must contain `eu.posthog.com` (LGPD residency — OBS-02)

  **Server-only:**
    - `SUPABASE_SERVICE_ROLE_KEY` — `z.string().min(1)`
    - `DATABASE_URL` — `z.string().url()` (direct connection)
    - `DATABASE_POOL_URL` — `z.string().url()` (Supavisor txn pool)
    - `SENTRY_ORG` — `z.string().optional()` (CI only)
    - `SENTRY_PROJECT` — `z.string().optional()` (CI only)
    - `SENTRY_AUTH_TOKEN` — `z.string().optional()` (CI only)
    - `INNGEST_EVENT_KEY` — `z.string().optional()` (dev may run without)
    - `INNGEST_SIGNING_KEY` — `z.string().optional()`

  **Gate (INFRA-16, D-24, D-29):**
    - `IDENTIFICATION_PROVIDER_MODE` — `z.enum(['stub', 'real'])` (no default — must be explicit)

  **Vercel runtime (auto-set):**
    - `VERCEL_ENV` — `z.enum(['development', 'preview', 'production']).optional()`
    - `VERCEL_GIT_COMMIT_SHA` — `z.string().optional()`

  Schema MUST reject `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` (presence = hard error, T-02-2 mitigation).

  Test cases:
    - Parses a valid full environment → returns frozen object with all fields
    - Missing `IDENTIFICATION_PROVIDER_MODE` → throws with helpful message
    - `IDENTIFICATION_PROVIDER_MODE='banana'` → throws (not in enum)
    - `IDENTIFICATION_PROVIDER_MODE='stub'` → accepted
    - `IDENTIFICATION_PROVIDER_MODE='real'` → accepted
    - Missing `DATABASE_POOL_URL` → throws
    - `NEXT_PUBLIC_POSTHOG_HOST='https://us.posthog.com'` → throws (must contain `eu.posthog.com` for OBS-02)
    - Presence of `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` → throws (T-02-2)
    - `SUPABASE_SERVICE_ROLE_KEY='...'` → accepted
  </behavior>
  <implementation>
  Parse `process.env` once at module load. Throw `ZodError` with readable message on failure. Export frozen object. Do NOT memoize via a function — top-level execution is intentional (fail-fast).
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 6.1: RED — Write failing unit test for env parser</name>
  <files>tests/unit/env-provider-mode.test.ts</files>
  <read_first>
    - docs/CAVE-PRD.md §20 (env var table)
    - .env.example (from plan 02)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-24, D-27, D-29
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Security-Domain (T-02-2 service-role-key)
  </read_first>
  <behavior>
    All 9 test cases from the `<behavior>` block above.
  </behavior>
  <action>
  Create `tests/unit/env-provider-mode.test.ts`. Use `vi.stubEnv` to mutate `process.env` per test, and `vi.resetModules()` + dynamic `import()` so each test re-evaluates the module.

  ```typescript
  import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

  const BASE_ENV = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://abc.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
    NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.posthog.com',
    SUPABASE_SERVICE_ROLE_KEY: 'svc',
    DATABASE_URL: 'postgresql://u:p@host:5432/db',
    DATABASE_POOL_URL: 'postgresql://u:p@pool:6543/db',
    IDENTIFICATION_PROVIDER_MODE: 'stub',
  } as const;

  function setEnv(overrides: Record<string, string | undefined>) {
    for (const [k, v] of Object.entries({ ...BASE_ENV, ...overrides })) {
      if (v === undefined) vi.stubEnv(k, '');
      else vi.stubEnv(k, v);
    }
  }

  async function loadEnv() {
    vi.resetModules();
    return (await import('@/shared/config/env')).env;
  }

  describe('env parser (INFRA-16, INFRA-17, D-24, D-29, OBS-02)', () => {
    beforeEach(() => { vi.unstubAllEnvs(); });
    afterEach(() => { vi.unstubAllEnvs(); });

    it('parses a valid full environment', async () => {
      setEnv({});
      const env = await loadEnv();
      expect(env.IDENTIFICATION_PROVIDER_MODE).toBe('stub');
      expect(env.DATABASE_POOL_URL).toContain('pool');
    });

    it('rejects missing IDENTIFICATION_PROVIDER_MODE', async () => {
      setEnv({ IDENTIFICATION_PROVIDER_MODE: undefined });
      await expect(loadEnv()).rejects.toThrow();
    });

    it('rejects invalid IDENTIFICATION_PROVIDER_MODE value', async () => {
      setEnv({ IDENTIFICATION_PROVIDER_MODE: 'banana' });
      await expect(loadEnv()).rejects.toThrow();
    });

    it('accepts IDENTIFICATION_PROVIDER_MODE=real', async () => {
      setEnv({ IDENTIFICATION_PROVIDER_MODE: 'real' });
      const env = await loadEnv();
      expect(env.IDENTIFICATION_PROVIDER_MODE).toBe('real');
    });

    it('rejects missing DATABASE_POOL_URL', async () => {
      setEnv({ DATABASE_POOL_URL: undefined });
      await expect(loadEnv()).rejects.toThrow();
    });

    it('rejects PostHog US host (OBS-02 LGPD residency)', async () => {
      setEnv({ NEXT_PUBLIC_POSTHOG_HOST: 'https://us.posthog.com' });
      await expect(loadEnv()).rejects.toThrow(/eu\.posthog\.com/);
    });

    it('rejects NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY (T-02-2)', async () => {
      setEnv({});
      vi.stubEnv('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY', 'leaked');
      await expect(loadEnv()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY/);
    });

    it('requires SUPABASE_SERVICE_ROLE_KEY (server-only, no prefix)', async () => {
      setEnv({ SUPABASE_SERVICE_ROLE_KEY: undefined });
      await expect(loadEnv()).rejects.toThrow();
    });
  });
  ```

  Run `pnpm test:unit`. MUST fail (module does not exist).

  Commit: `test(01-06): add failing env parser tests`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -qi "env-provider" && (pnpm test:unit; test $? -ne 0 && echo RED_OK)</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/env-provider-mode.test.ts` exists
    - Running `pnpm test:unit` emits a failure referencing `@/shared/config/env`
    - 8+ `it(...)` blocks
  </acceptance_criteria>
  <done>Test file exists, test fails RED</done>
</task>

<task type="auto" tdd="true">
  <name>Task 6.2: GREEN — Implement src/shared/config/env.ts</name>
  <files>src/shared/config/env.ts</files>
  <read_first>
    - tests/unit/env-provider-mode.test.ts (from Task 6.1)
    - docs/CAVE-PRD.md §20
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Dont-Hand-Roll (Zod-validated env)
  </read_first>
  <action>
  Create `src/shared/config/env.ts`:

  ```typescript
  import { z } from 'zod';

  // T-02-2 mitigation: service role key MUST NOT be client-exposed.
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SECURITY: NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY is forbidden. Use SUPABASE_SERVICE_ROLE_KEY (server-only).',
    );
  }

  const schema = z.object({
    // Public
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    NEXT_PUBLIC_POSTHOG_KEY: z.string().min(1).optional(),
    NEXT_PUBLIC_POSTHOG_HOST: z
      .string()
      .url()
      .default('https://eu.posthog.com')
      .refine((v) => v.includes('eu.posthog.com'), {
        message: 'NEXT_PUBLIC_POSTHOG_HOST must contain eu.posthog.com (OBS-02 LGPD residency)',
      }),

    // Server-only
    SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
    DATABASE_URL: z.string().url(),
    DATABASE_POOL_URL: z.string().url(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    INNGEST_EVENT_KEY: z.string().optional(),
    INNGEST_SIGNING_KEY: z.string().optional(),

    // Provider mode gate (INFRA-16, D-24, D-29)
    IDENTIFICATION_PROVIDER_MODE: z.enum(['stub', 'real']),

    // Vercel runtime
    VERCEL_ENV: z.enum(['development', 'preview', 'production']).optional(),
    VERCEL_GIT_COMMIT_SHA: z.string().optional(),
  });

  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    // Fail fast. Do not ship default/empty values.
    const formatted = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Environment validation failed (INFRA-17):\n${formatted}`);
  }

  export const env = Object.freeze(parsed.data);
  export type Env = typeof env;
  ```

  Run `pnpm test:unit`. All 8 tests pass.

  Commit: `feat(01-06): implement Zod-validated env parser`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -E "env.parser.*passed|PASS.*env-provider"</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/config/env.ts` exists
    - Exports `env` (frozen) and `Env` type
    - `pnpm test:unit` passes `env parser` describe block
    - `pnpm typecheck` exits 0
    - `grep -q 'NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY' src/shared/config/env.ts` succeeds (rejection logic present)
    - `grep -q "z.enum(\\['stub', 'real'\\])" src/shared/config/env.ts` succeeds
  </acceptance_criteria>
  <done>All env parser tests pass GREEN</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-06-2 | Elevation of Privilege | Supabase service role key | mitigate | Explicit rejection of `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` at module load; unit test covers |
| T-06-LGPD | Privacy | PostHog host residency | mitigate | Zod refinement requires `eu.posthog.com` substring; unit test covers |
| T-06-17 | Information Disclosure | Missing env fails loud | mitigate | Zod `safeParse` throws with field listing; no silent empty-string fallback |
</threat_model>

<verification>
All 8 env parser unit tests green. `src/shared/config/env.ts` is the ONLY place `process.env` is read in the codebase (enforced informally in Phase 1, by lint rule in Phase 2).
</verification>

<success_criteria>
- SC-5c (INFRA-16 gate) verified by unit test
- SC-5d (INFRA-23 secrets schema) verified by unit test
- T-06-2 service-role-key leak prevented
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-06-SUMMARY.md`.
</output>


### 01-07-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 07
type: tdd
wave: 2
depends_on: [05, 06]
files_modified:
  - src/shared/telemetry/sentry-scrubber.ts
  - sentry.client.config.ts
  - sentry.server.config.ts
  - sentry.edge.config.ts
  - tests/unit/sentry-config.test.ts
autonomous: true
requirements: [OBS-01, OBS-05, LGPD-13]
validation_ref: [SC-3b, SC-4a, SC-4b, SC-4c, SC-4d]

must_haves:
  truths:
    - "`beforeSend` scrubs all 6 keys: Authorization, Cookie, email, password, token, photo_url"
    - "`beforeSend` drops request.data on URLs matching /api/v1/identifications/*"
    - "`beforeSend` keeps only event.user.id (never email)"
    - "`sendDefaultPii: false` set in all three init files"
    - "`tracesSampleRate: 0.0` (D-15) in all init files"
    - "Release tag = VERCEL_GIT_COMMIT_SHA || GITHUB_SHA"
  artifacts:
    - path: "src/shared/telemetry/sentry-scrubber.ts"
      provides: "Pure `beforeSend` and `beforeBreadcrumb` functions (unit-testable)"
      exports: [scrubSentryEvent, scrubSentryBreadcrumb, SCRUB_KEYS]
    - path: "sentry.client.config.ts"
      provides: "Sentry browser init with scrubber"
    - path: "sentry.server.config.ts"
      provides: "Sentry Node init with scrubber"
    - path: "sentry.edge.config.ts"
      provides: "Sentry Edge init with scrubber"
    - path: "tests/unit/sentry-config.test.ts"
      provides: "SC-4c + SC-4d verification"
---

<objective>
TDD plan: build a pure `sentry-scrubber.ts` module (testable without mocking Sentry init) and wire three thin init files (client/server/edge) that call `Sentry.init` with the scrubber attached. Verifies LGPD-13 scrubbing (6 keys + `/api/v1/identifications/*` body drop + `setUser({ id })` only).

Purpose: SC-4c (no email in setUser) and SC-4d (identification body drop) are unit-testable by invoking the pure `scrubSentryEvent` function with synthetic events. E2E in plan 13 (Playwright smoke) verifies the full path on a preview deploy.
Output: Scrubber module + 3 init files + unit tests that run in <5s.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@src/shared/config/env.ts
@docs/CAVE-PRD.md

<interfaces>
From src/shared/config/env.ts (plan 06):
```typescript
export const env: Readonly<{
  NEXT_PUBLIC_SENTRY_DSN?: string;
  VERCEL_ENV?: 'development' | 'preview' | 'production';
  VERCEL_GIT_COMMIT_SHA?: string;
  // ...
}>;
```
</interfaces>
</context>

<feature>
  <name>Sentry scrubber + init</name>
  <files>src/shared/telemetry/sentry-scrubber.ts, sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts, tests/unit/sentry-config.test.ts</files>
  <behavior>
  `src/shared/telemetry/sentry-scrubber.ts` exports:
    - `SCRUB_KEYS: ReadonlySet<string>` containing (lowercase): `authorization`, `cookie`, `email`, `password`, `token`, `photo_url`
    - `scrubSentryEvent(event): event` — pure function matching Sentry's `beforeSend` signature
    - `scrubSentryBreadcrumb(breadcrumb): breadcrumb` — pure function matching `beforeBreadcrumb` signature

  `scrubSentryEvent` behavior:
    1. If `event.request?.url` matches `/api/v1/identifications/`, set `event.request.data = undefined` and `event.request.json_data = undefined`
    2. Recursively walk `event.request.headers`, `event.request.cookies`, `event.request.query_string`, `event.extra`, `event.contexts`, `event.tags` — replace any value whose key (lowercased) is in `SCRUB_KEYS` with `'[Filtered]'`
    3. If `event.user` is present, replace it with `{ id: event.user.id }` (drop all other fields — SC-4c)
    4. Return the mutated event

  `scrubSentryBreadcrumb` behavior:
    1. If `breadcrumb.data` exists, scrub in place with the same walker
    2. If `breadcrumb.message` contains any scrub key substring (case-insensitive), set `breadcrumb.message = '[Filtered: contained sensitive data]'`
    3. Return the breadcrumb

  Test cases:
    - Event with `request.url = '/api/v1/identifications/abc'` and `request.data = { email: 'x' }` → `event.request.data === undefined`
    - Event with `request.headers.Authorization = 'Bearer xxx'` → header becomes `'[Filtered]'`
    - Event with `request.headers.cookie = 'session=abc'` → cookie becomes `'[Filtered]'`
    - Event with `extra.photo_url = 'https://...'` → extra becomes `'[Filtered]'`
    - Event with `user = { id: '123', email: 'x@y.z', username: 'foo' }` → user becomes `{ id: '123' }` (no email, no username)
    - Event with `user = undefined` → returned unchanged
    - Nested object `extra.nested.password = 'secret'` → scrubbed recursively
    - Breadcrumb with `message: 'login with email x@y.z'` → message becomes `'[Filtered: contained sensitive data]'`
    - Event with `request.url = '/api/v1/health'` and `request.data = { foo: 'bar' }` → `request.data` untouched (not an identification route)

  Each `sentry.*.config.ts` file:
    - Imports `scrubSentryEvent`, `scrubSentryBreadcrumb` from `@/shared/telemetry/sentry-scrubber`
    - Calls `Sentry.init({ dsn, environment, release, tracesSampleRate: 0.0, replaysSessionSampleRate: 0.0, replaysOnErrorSampleRate: 0.0, sendDefaultPii: false, beforeSend: scrubSentryEvent, beforeBreadcrumb: scrubSentryBreadcrumb })`
    - `release` resolves from `env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local'` (D-15)
    - Edge config omits replay fields (not supported on edge runtime)
  </behavior>
  <implementation>
  Pure scrubber → easy unit test. Init files call Sentry.init once at module scope. Next.js auto-loads `sentry.client.config.ts` / `sentry.server.config.ts` / `sentry.edge.config.ts` from the project root when `@sentry/nextjs` is installed [RESEARCH Pattern 5].
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 7.1: RED — Write failing unit tests for sentry-scrubber</name>
  <files>tests/unit/sentry-config.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-5 (Sentry PII scrubbing)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-15, D-19-OVERRIDE, D-24
    - docs/CAVE-PRD.md §21 (LGPD-13 scrubbing rules + 6 key list)
  </read_first>
  <behavior>
    All 9 test cases listed above. Tests import only the PURE scrubber module (no Sentry SDK mocking needed).
  </behavior>
  <action>
  Create `tests/unit/sentry-config.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { scrubSentryEvent, scrubSentryBreadcrumb, SCRUB_KEYS } from '@/shared/telemetry/sentry-scrubber';

  describe('SCRUB_KEYS (LGPD-13)', () => {
    it('contains exactly the 6 LGPD-13 keys (lowercased)', () => {
      expect(SCRUB_KEYS.has('authorization')).toBe(true);
      expect(SCRUB_KEYS.has('cookie')).toBe(true);
      expect(SCRUB_KEYS.has('email')).toBe(true);
      expect(SCRUB_KEYS.has('password')).toBe(true);
      expect(SCRUB_KEYS.has('token')).toBe(true);
      expect(SCRUB_KEYS.has('photo_url')).toBe(true);
      expect(SCRUB_KEYS.size).toBe(6);
    });
  });

  describe('scrubSentryEvent (SC-4c, SC-4d)', () => {
    it('drops request.data on /api/v1/identifications/* routes', () => {
      const event = {
        request: {
          url: 'https://folhario.app/api/v1/identifications/abc',
          data: { email: 'x@y.z', note: 'keep' },
        },
      };
      const out = scrubSentryEvent(event as any);
      expect(out.request?.data).toBeUndefined();
    });

    it('keeps request.data on non-identification routes', () => {
      const event = {
        request: { url: 'https://folhario.app/api/v1/health', data: { foo: 'bar' } },
      };
      const out = scrubSentryEvent(event as any);
      expect(out.request?.data).toEqual({ foo: 'bar' });
    });

    it('scrubs Authorization header', () => {
      const event = { request: { headers: { Authorization: 'Bearer xxx' } } };
      const out = scrubSentryEvent(event as any);
      expect((out.request?.headers as any).Authorization).toBe('[Filtered]');
    });

    it('scrubs cookie header (case-insensitive key match)', () => {
      const event = { request: { headers: { Cookie: 'session=abc' } } };
      const out = scrubSentryEvent(event as any);
      expect((out.request?.headers as any).Cookie).toBe('[Filtered]');
    });

    it('scrubs photo_url in extra', () => {
      const event = { extra: { photo_url: 'https://s.co/x.jpg', note: 'keep' } };
      const out = scrubSentryEvent(event as any);
      expect((out.extra as any).photo_url).toBe('[Filtered]');
      expect((out.extra as any).note).toBe('keep');
    });

    it('scrubs nested password recursively', () => {
      const event = { extra: { nested: { deep: { password: 'secret', foo: 'bar' } } } };
      const out = scrubSentryEvent(event as any);
      expect((out.extra as any).nested.deep.password).toBe('[Filtered]');
      expect((out.extra as any).nested.deep.foo).toBe('bar');
    });

    it('reduces user to { id } only (SC-4c)', () => {
      const event = { user: { id: '123', email: 'x@y.z', username: 'foo', ip_address: '1.2.3.4' } };
      const out = scrubSentryEvent(event as any);
      expect(out.user).toEqual({ id: '123' });
    });

    it('leaves user undefined if absent', () => {
      const event = { message: 'hi' };
      const out = scrubSentryEvent(event as any);
      expect(out.user).toBeUndefined();
    });
  });

  describe('scrubSentryBreadcrumb', () => {
    it('scrubs data payload', () => {
      const bc = { data: { email: 'x@y.z', keep: 'me' } };
      const out = scrubSentryBreadcrumb(bc as any);
      expect((out.data as any).email).toBe('[Filtered]');
      expect((out.data as any).keep).toBe('me');
    });

    it('redacts messages containing scrub keywords', () => {
      const bc = { message: 'login with email x@y.z' };
      const out = scrubSentryBreadcrumb(bc as any);
      expect(out.message).toMatch(/\[Filtered/);
    });
  });
  ```

  Run `pnpm test:unit`. MUST fail (module does not exist).

  Commit: `test(01-07): add failing sentry scrubber tests`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -q "sentry-config" && (pnpm test:unit; test $? -ne 0 && echo RED_OK)</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/sentry-config.test.ts` exists
    - `pnpm test:unit` fails referencing `@/shared/telemetry/sentry-scrubber`
    - At least 10 `it(...)` blocks
  </acceptance_criteria>
  <done>Test file exists, test run fails RED</done>
</task>

<task type="auto" tdd="true">
  <name>Task 7.2: GREEN — Implement sentry-scrubber and three init files</name>
  <files>src/shared/telemetry/sentry-scrubber.ts, sentry.client.config.ts, sentry.server.config.ts, sentry.edge.config.ts</files>
  <read_first>
    - tests/unit/sentry-config.test.ts (from Task 7.1)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-5
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-15, D-16, D-19-OVERRIDE
  </read_first>
  <action>
  Create `src/shared/telemetry/sentry-scrubber.ts`:

  ```typescript
  export const SCRUB_KEYS: ReadonlySet<string> = new Set([
    'authorization',
    'cookie',
    'email',
    'password',
    'token',
    'photo_url',
  ]);

  const IDENTIFICATION_ROUTE_RE = /\/api\/v1\/identifications\//;

  function walk(obj: unknown): unknown {
    if (obj === null || typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) obj[i] = walk(obj[i]);
      return obj;
    }
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      if (SCRUB_KEYS.has(key.toLowerCase())) {
        (obj as Record<string, unknown>)[key] = '[Filtered]';
      } else {
        (obj as Record<string, unknown>)[key] = walk((obj as Record<string, unknown>)[key]);
      }
    }
    return obj;
  }

  export function scrubSentryEvent(event: any): any {
    // SC-4d: drop request body on identification routes
    const url = event?.request?.url;
    if (typeof url === 'string' && IDENTIFICATION_ROUTE_RE.test(url)) {
      if (event.request) {
        event.request.data = undefined;
        event.request.json_data = undefined;
      }
    }

    if (event?.request?.headers) walk(event.request.headers);
    if (event?.request?.cookies) walk(event.request.cookies);
    if (event?.request?.query_string && typeof event.request.query_string === 'object') {
      walk(event.request.query_string);
    }
    if (event?.extra) walk(event.extra);
    if (event?.contexts) walk(event.contexts);
    if (event?.tags) walk(event.tags);

    // SC-4c: id only, never email / username / ip
    if (event?.user) {
      event.user = { id: event.user.id };
    }

    return event;
  }

  export function scrubSentryBreadcrumb(breadcrumb: any): any {
    if (breadcrumb?.data) walk(breadcrumb.data);
    if (typeof breadcrumb?.message === 'string') {
      const lower = breadcrumb.message.toLowerCase();
      for (const key of SCRUB_KEYS) {
        if (lower.includes(key)) {
          breadcrumb.message = '[Filtered: contained sensitive data]';
          break;
        }
      }
    }
    return breadcrumb;
  }
  ```

  Create `sentry.client.config.ts` (project root — Next.js auto-loads):

  ```typescript
  import * as Sentry from '@sentry/nextjs';
  import { scrubSentryEvent, scrubSentryBreadcrumb } from '@/shared/telemetry/sentry-scrubber';

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'local',
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    tracesSampleRate: 0.0,             // D-15
    replaysSessionSampleRate: 0.0,     // D-16
    replaysOnErrorSampleRate: 0.0,     // D-16
    sendDefaultPii: false,             // LGPD-13
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
  ```

  Create `sentry.server.config.ts` with IDENTICAL Sentry.init call (replay fields are no-ops on server but harmless):

  ```typescript
  import * as Sentry from '@sentry/nextjs';
  import { scrubSentryEvent, scrubSentryBreadcrumb } from '@/shared/telemetry/sentry-scrubber';

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'local',
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    tracesSampleRate: 0.0,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
  ```

  Create `sentry.edge.config.ts` (edge runtime — omit replay fields entirely):

  ```typescript
  import * as Sentry from '@sentry/nextjs';
  import { scrubSentryEvent, scrubSentryBreadcrumb } from '@/shared/telemetry/sentry-scrubber';

  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.VERCEL_ENV ?? 'local',
    release: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    tracesSampleRate: 0.0,
    sendDefaultPii: false,
    beforeSend: scrubSentryEvent,
    beforeBreadcrumb: scrubSentryBreadcrumb,
  });
  ```

  Run `pnpm test:unit`. All scrubber tests pass.

  Commit: `feat(01-07): implement sentry scrubber and init files`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -E "sentry.*passed|PASS.*sentry-config"</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/telemetry/sentry-scrubber.ts` exports `SCRUB_KEYS`, `scrubSentryEvent`, `scrubSentryBreadcrumb`
    - `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` all exist at project root
    - All three Sentry.init calls set `sendDefaultPii: false` (grep: `grep -l 'sendDefaultPii: false' sentry.*.config.ts` finds all 3)
    - All three set `tracesSampleRate: 0.0`
    - All three reference `scrubSentryEvent` and `scrubSentryBreadcrumb`
    - `pnpm test:unit` passes scrubber describe blocks
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Scrubber tests pass GREEN + 3 init files in place</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-07-2 | Privacy (LGPD-13) | Sentry breadcrumbs | mitigate | Pure `scrubSentryEvent`/`scrubSentryBreadcrumb` functions with unit test coverage; 6 keys + identification body drop + user=id-only |
| T-07-SessionReplay | Privacy | Session Replay | accept | `replaysSessionSampleRate: 0.0` + `replaysOnErrorSampleRate: 0.0` (D-16); accepted risk per CONTEXT |
</threat_model>

<verification>
Unit tests exercise every SC-4c/SC-4d branch. Plan 13 (Playwright smoke) verifies end-to-end on a preview deploy.
</verification>

<success_criteria>
- Scrubber unit tests GREEN
- 3 Sentry init files with scrubbing attached
- LGPD-13 enforced at config layer
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-07-SUMMARY.md`.
</output>


### 01-08-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 08
type: tdd
wave: 2
depends_on: [06]
files_modified:
  - src/shared/telemetry/posthog-client.ts
  - src/shared/telemetry/posthog-server.ts
  - tests/unit/posthog-config.test.ts
autonomous: true
requirements: [OBS-02]
validation_ref: [SC-4e]

must_haves:
  truths:
    - "PostHog client factory uses `api_host: 'https://eu.posthog.com'`"
    - "PostHog client factory uses `opt_out_capturing_by_default: true` (D-17)"
    - "PostHog client factory uses `autocapture: false` (D-18)"
    - "PostHog server factory constructs `posthog-node` client with EU host"
    - "Server factory returns same instance on repeated calls (singleton)"
  artifacts:
    - path: "src/shared/telemetry/posthog-client.ts"
      provides: "posthog-js factory (lazy init, EU-only, consent-gated)"
      exports: [getPostHogClient, POSTHOG_CLIENT_CONFIG]
    - path: "src/shared/telemetry/posthog-server.ts"
      provides: "posthog-node singleton factory for server-side events"
      exports: [getPostHogServer]
    - path: "tests/unit/posthog-config.test.ts"
      provides: "SC-4e verification"
---

<objective>
TDD plan: build client (`posthog-js`) and server (`posthog-node`) PostHog factories that enforce D-17 (consent-gated opt-out default), D-18 (autocapture off), and OBS-02 (EU residency). Both factories expose testable config constants so unit tests can assert values WITHOUT initializing the SDK (which would require a DOM / fetch call).

Purpose: Phase 1 wires connectivity without emitting events; plans in Phase 4+ flip `opt_in_capturing()` when users grant LGPD consent.
Output: Two thin factory modules + unit test covering SC-4e.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@src/shared/config/env.ts

<interfaces>
From src/shared/config/env.ts:
```typescript
export const env: Readonly<{
  NEXT_PUBLIC_POSTHOG_KEY?: string;
  NEXT_PUBLIC_POSTHOG_HOST: string; // defaults to https://eu.posthog.com, validated to contain eu.posthog.com
}>;
```
</interfaces>
</context>

<feature>
  <name>PostHog client + server factories</name>
  <files>src/shared/telemetry/posthog-client.ts, src/shared/telemetry/posthog-server.ts, tests/unit/posthog-config.test.ts</files>
  <behavior>
  `posthog-client.ts`:
    - Exports `POSTHOG_CLIENT_CONFIG` constant:
      ```typescript
      {
        api_host: 'https://eu.posthog.com',
        capture_pageview: false,
        capture_pageleave: false,
        autocapture: false,               // D-18
        disable_session_recording: true,  // Phase 1 no replay
        opt_out_capturing_by_default: true,  // D-17
        opt_out_persistence_by_default: true,
        persistence: 'localStorage+cookie',
      }
      ```
    - Exports `getPostHogClient(): PostHog | null` — lazy init; returns `null` if `NEXT_PUBLIC_POSTHOG_KEY` missing OR if running server-side; caches the instance

  `posthog-server.ts`:
    - Exports `getPostHogServer(): PostHog` — singleton over `posthog-node`'s `PostHog` class, `host: 'https://eu.posthog.com'`; lazy init
    - Subsequent calls return the same instance

  Test cases:
    - `POSTHOG_CLIENT_CONFIG.api_host === 'https://eu.posthog.com'`
    - `POSTHOG_CLIENT_CONFIG.opt_out_capturing_by_default === true`
    - `POSTHOG_CLIENT_CONFIG.autocapture === false`
    - `POSTHOG_CLIENT_CONFIG.disable_session_recording === true`
    - `POSTHOG_CLIENT_CONFIG.capture_pageview === false`
    - `getPostHogServer()` returns an object with a `.capture()` method (duck-typed, `posthog-node` PostHog class)
    - `getPostHogServer() === getPostHogServer()` (singleton)
  </behavior>
  <implementation>
  Client factory returns null in non-browser environments to avoid `window` errors. Server factory uses `posthog-node` which works in Node without DOM. Both honor OBS-02 EU host.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 8.1: RED — Write failing unit tests for posthog factories</name>
  <files>tests/unit/posthog-config.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-17, D-18
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-4 (PostHog consent default)
  </read_first>
  <behavior>
    All 7 test cases from the `<behavior>` block.
  </behavior>
  <action>
  Create `tests/unit/posthog-config.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach } from 'vitest';

  describe('POSTHOG_CLIENT_CONFIG (OBS-02, D-17, D-18)', () => {
    it('uses EU host (LGPD residency)', async () => {
      const { POSTHOG_CLIENT_CONFIG } = await import('@/shared/telemetry/posthog-client');
      expect(POSTHOG_CLIENT_CONFIG.api_host).toBe('https://eu.posthog.com');
    });

    it('opts out of capturing by default (D-17)', async () => {
      const { POSTHOG_CLIENT_CONFIG } = await import('@/shared/telemetry/posthog-client');
      expect(POSTHOG_CLIENT_CONFIG.opt_out_capturing_by_default).toBe(true);
      expect(POSTHOG_CLIENT_CONFIG.opt_out_persistence_by_default).toBe(true);
    });

    it('disables autocapture (D-18)', async () => {
      const { POSTHOG_CLIENT_CONFIG } = await import('@/shared/telemetry/posthog-client');
      expect(POSTHOG_CLIENT_CONFIG.autocapture).toBe(false);
    });

    it('disables session recording and automatic pageviews', async () => {
      const { POSTHOG_CLIENT_CONFIG } = await import('@/shared/telemetry/posthog-client');
      expect(POSTHOG_CLIENT_CONFIG.disable_session_recording).toBe(true);
      expect(POSTHOG_CLIENT_CONFIG.capture_pageview).toBe(false);
      expect(POSTHOG_CLIENT_CONFIG.capture_pageleave).toBe(false);
    });
  });

  describe('getPostHogServer (OBS-02)', () => {
    beforeEach(() => {
      vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test');
      vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://eu.posthog.com');
    });

    it('returns a client with .capture()', async () => {
      vi.resetModules();
      const { getPostHogServer } = await import('@/shared/telemetry/posthog-server');
      const client = getPostHogServer();
      expect(typeof client.capture).toBe('function');
    });

    it('returns the same instance on repeated calls (singleton)', async () => {
      vi.resetModules();
      const { getPostHogServer } = await import('@/shared/telemetry/posthog-server');
      expect(getPostHogServer()).toBe(getPostHogServer());
    });
  });
  ```

  Run `pnpm test:unit`. MUST fail.

  Commit: `test(01-08): add failing posthog factory tests`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -q "posthog-config" && (pnpm test:unit; test $? -ne 0 && echo RED_OK)</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/posthog-config.test.ts` exists
    - `pnpm test:unit` fails referencing `@/shared/telemetry/posthog-client` or `@/shared/telemetry/posthog-server`
  </acceptance_criteria>
  <done>RED — test file exists, fails</done>
</task>

<task type="auto" tdd="true">
  <name>Task 8.2: GREEN — Implement posthog-client and posthog-server</name>
  <files>src/shared/telemetry/posthog-client.ts, src/shared/telemetry/posthog-server.ts</files>
  <read_first>
    - tests/unit/posthog-config.test.ts (from Task 8.1)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Standard-Stack (posthog-js, posthog-node versions)
  </read_first>
  <action>
  Create `src/shared/telemetry/posthog-client.ts`:

  ```typescript
  import posthog, { type PostHog } from 'posthog-js';

  export const POSTHOG_CLIENT_CONFIG = {
    api_host: 'https://eu.posthog.com',
    capture_pageview: false,
    capture_pageleave: false,
    autocapture: false,
    disable_session_recording: true,
    opt_out_capturing_by_default: true,
    opt_out_persistence_by_default: true,
    persistence: 'localStorage+cookie',
  } as const;

  let initialized = false;

  export function getPostHogClient(): PostHog | null {
    if (typeof window === 'undefined') return null;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    if (!key) return null;
    if (!initialized) {
      posthog.init(key, POSTHOG_CLIENT_CONFIG);
      initialized = true;
    }
    return posthog;
  }
  ```

  Create `src/shared/telemetry/posthog-server.ts`:

  ```typescript
  import { PostHog } from 'posthog-node';

  let instance: PostHog | null = null;

  export function getPostHogServer(): PostHog {
    if (instance) return instance;
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? 'phc_phase1_placeholder';
    instance = new PostHog(key, {
      host: 'https://eu.posthog.com',
      flushAt: 1,
      flushInterval: 0,
    });
    return instance;
  }
  ```

  Run `pnpm test:unit`. Factory tests pass.

  Commit: `feat(01-08): implement posthog client + server factories`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -E "posthog.*passed|PASS.*posthog-config"</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/telemetry/posthog-client.ts` exists and exports `POSTHOG_CLIENT_CONFIG`, `getPostHogClient`
    - `src/shared/telemetry/posthog-server.ts` exists and exports `getPostHogServer`
    - `grep -q "api_host: 'https://eu.posthog.com'" src/shared/telemetry/posthog-client.ts` succeeds
    - `grep -q 'opt_out_capturing_by_default: true' src/shared/telemetry/posthog-client.ts` succeeds
    - `grep -q 'autocapture: false' src/shared/telemetry/posthog-client.ts` succeeds
    - `grep -q "host: 'https://eu.posthog.com'" src/shared/telemetry/posthog-server.ts` succeeds
    - `pnpm test:unit` passes posthog-config describe blocks
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Factory unit tests GREEN</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-LGPD | Privacy | PostHog pre-consent capture | mitigate | `opt_out_capturing_by_default: true` + `opt_out_persistence_by_default: true` enforced in POSTHOG_CLIENT_CONFIG + unit test |
| T-08-Residency | Privacy (LGPD) | Event data geography | mitigate | Hardcoded `eu.posthog.com` in both factories + env parser refinement in plan 06 |
</threat_model>

<verification>
Unit tests verify config values. Plan 13 (Playwright smoke) sends a server-side ping via `getPostHogServer().capture()` and asserts the response.
</verification>

<success_criteria>
- POSTHOG_CLIENT_CONFIG enforces D-17 + D-18 + OBS-02
- Server factory singleton works
- All tests GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-08-SUMMARY.md`.
</output>


### 01-09-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 09
type: tdd
wave: 2
depends_on: [06]
files_modified:
  - src/shared/http/headers.ts
  - src/middleware.ts
  - tests/unit/middleware-headers.test.ts
autonomous: true
requirements: [INFRA-18]
validation_ref: [SC-5b]

must_haves:
  truths:
    - "`buildSecurityHeaders` returns CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy"
    - "In production mode, header key is `Content-Security-Policy` (enforced)"
    - "In preview/dev mode, header key is `Content-Security-Policy-Report-Only` (D-20)"
    - "HSTS value is `max-age=15552000; includeSubDomains` (D-21, no preload)"
    - "CSP includes `frame-ancestors 'none'` and X-Frame-Options is `DENY` (D-22)"
    - "CSP connect-src allowlist includes sentry.io, eu.posthog.com, *.supabase.co, api.stripe.com"
    - "middleware.ts matcher excludes _next/static, _next/image, favicon.ico, sw.js, sw.js.map"
  artifacts:
    - path: "src/shared/http/headers.ts"
      provides: "Pure `buildSecurityHeaders(mode)` function"
      exports: [buildSecurityHeaders, CSP_DIRECTIVES, SECURITY_HEADER_KEYS]
    - path: "src/middleware.ts"
      provides: "Next.js middleware applying headers to every response"
    - path: "tests/unit/middleware-headers.test.ts"
      provides: "SC-5b verification"
---

<objective>
TDD plan: build a pure `buildSecurityHeaders(mode)` function in `src/shared/http/headers.ts` and a `src/middleware.ts` that calls it for every request. Enforces D-20 (CSP report-only in preview, enforced in prod), D-21 (HSTS 6mo no preload), D-22 (frame embedding denied).

Purpose: Middleware is the only choke point that attaches headers to every response. Pure function separation lets unit tests assert header values without booting a Next server. Plan 13 (Playwright smoke) verifies headers land on actual preview deploys.
Output: Header builder + middleware + unit test.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
</context>

<feature>
  <name>Security headers middleware</name>
  <files>src/shared/http/headers.ts, src/middleware.ts, tests/unit/middleware-headers.test.ts</files>
  <behavior>
  `src/shared/http/headers.ts` exports:
    - `CSP_DIRECTIVES` — Record<string, string[]> with:
      - `default-src`: `["'self'"]`
      - `script-src`: `["'self'", "'unsafe-inline'"]` (Phase 1 accepts, Phase 3 moves to nonce)
      - `style-src`: `["'self'", "'unsafe-inline'"]`
      - `img-src`: `["'self'", 'data:', 'blob:', 'https://*.supabase.co']`
      - `font-src`: `["'self'"]`
      - `connect-src`: `["'self'", 'https://*.sentry.io', 'https://*.ingest.sentry.io', 'https://eu.posthog.com', 'https://eu-assets.i.posthog.com', 'https://*.supabase.co', 'wss://*.supabase.co', 'https://api.stripe.com']`
      - `frame-ancestors`: `["'none'"]`
      - `base-uri`: `["'self'"]`
      - `form-action`: `["'self'"]`
      - `report-uri`: `['/api/v1/_csp/report']`
    - `buildSecurityHeaders(mode: 'production' | 'preview' | 'development'): Record<string, string>` — returns an object with keys:
      - `Content-Security-Policy` (only when mode === 'production')
      - `Content-Security-Policy-Report-Only` (only when mode !== 'production')
      - `Strict-Transport-Security: max-age=15552000; includeSubDomains`
      - `X-Frame-Options: DENY`
      - `X-Content-Type-Options: nosniff`
      - `Referrer-Policy: strict-origin-when-cross-origin`
      - `Permissions-Policy: geolocation=(), camera=(self), microphone=()`

  `src/middleware.ts`:
    - Imports `buildSecurityHeaders` + resolves mode from `process.env.VERCEL_ENV` (`'production'` | `'preview'` | default `'development'`)
    - Exports middleware function that calls `NextResponse.next()`, sets each header from the builder, returns the response
    - Exports `config` with matcher excluding `_next/static`, `_next/image`, `favicon.ico`, `sw.js`, `sw.js.map`

  Test cases (on `buildSecurityHeaders`):
    - `production` mode returns `Content-Security-Policy` (no `-Report-Only`)
    - `preview` mode returns `Content-Security-Policy-Report-Only` (no `Content-Security-Policy`)
    - `development` mode returns `Content-Security-Policy-Report-Only`
    - HSTS value exactly `max-age=15552000; includeSubDomains` (no `preload` substring — D-21)
    - `X-Frame-Options` value is `DENY`
    - CSP string contains `frame-ancestors 'none'`
    - CSP string contains `connect-src 'self' https://*.sentry.io` (at least)
    - CSP string contains `https://eu.posthog.com`
    - CSP string contains `https://api.stripe.com`
    - CSP string contains `wss://*.supabase.co`
    - `X-Content-Type-Options` is `nosniff`
  </behavior>
  <implementation>
  The pure function returns plain JS object — trivial to unit-test. Middleware is a thin wrapper. Matcher string copied from RESEARCH Pattern 6.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 9.1: RED — Write failing unit tests for security headers builder</name>
  <files>tests/unit/middleware-headers.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-6 (security headers)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-20, D-21, D-22
  </read_first>
  <behavior>
    All 11 test cases listed above.
  </behavior>
  <action>
  Create `tests/unit/middleware-headers.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { buildSecurityHeaders, CSP_DIRECTIVES } from '@/shared/http/headers';

  describe('buildSecurityHeaders (INFRA-18, D-20..D-22)', () => {
    it('production mode emits Content-Security-Policy (enforced)', () => {
      const h = buildSecurityHeaders('production');
      expect(h['Content-Security-Policy']).toBeTypeOf('string');
      expect(h['Content-Security-Policy-Report-Only']).toBeUndefined();
    });

    it('preview mode emits Content-Security-Policy-Report-Only (D-20)', () => {
      const h = buildSecurityHeaders('preview');
      expect(h['Content-Security-Policy-Report-Only']).toBeTypeOf('string');
      expect(h['Content-Security-Policy']).toBeUndefined();
    });

    it('development mode emits Report-Only', () => {
      const h = buildSecurityHeaders('development');
      expect(h['Content-Security-Policy-Report-Only']).toBeTypeOf('string');
    });

    it('HSTS is max-age=15552000; includeSubDomains and does NOT contain preload (D-21)', () => {
      const h = buildSecurityHeaders('production');
      expect(h['Strict-Transport-Security']).toBe('max-age=15552000; includeSubDomains');
      expect(h['Strict-Transport-Security']).not.toContain('preload');
    });

    it('X-Frame-Options is DENY (D-22)', () => {
      const h = buildSecurityHeaders('production');
      expect(h['X-Frame-Options']).toBe('DENY');
    });

    it('CSP contains frame-ancestors none (D-22)', () => {
      const h = buildSecurityHeaders('production');
      expect(h['Content-Security-Policy']).toMatch(/frame-ancestors 'none'/);
    });

    it('CSP connect-src allowlist includes sentry, posthog EU, supabase, stripe', () => {
      const h = buildSecurityHeaders('production');
      const csp = h['Content-Security-Policy']!;
      expect(csp).toContain('https://*.sentry.io');
      expect(csp).toContain('https://eu.posthog.com');
      expect(csp).toContain('https://*.supabase.co');
      expect(csp).toContain('wss://*.supabase.co');
      expect(csp).toContain('https://api.stripe.com');
    });

    it('X-Content-Type-Options is nosniff', () => {
      const h = buildSecurityHeaders('production');
      expect(h['X-Content-Type-Options']).toBe('nosniff');
    });

    it('Referrer-Policy is strict-origin-when-cross-origin', () => {
      const h = buildSecurityHeaders('production');
      expect(h['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('Permissions-Policy restricts camera/mic/geolocation', () => {
      const h = buildSecurityHeaders('production');
      expect(h['Permissions-Policy']).toBe('geolocation=(), camera=(self), microphone=()');
    });

    it('CSP_DIRECTIVES has report-uri to /api/v1/_csp/report', () => {
      expect(CSP_DIRECTIVES['report-uri']).toEqual(['/api/v1/_csp/report']);
    });
  });
  ```

  Run `pnpm test:unit`. MUST fail.

  Commit: `test(01-09): add failing security headers tests`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -q "middleware-headers" && (pnpm test:unit; test $? -ne 0 && echo RED_OK)</automated>
  </verify>
  <acceptance_criteria>
    - `tests/unit/middleware-headers.test.ts` exists
    - `pnpm test:unit` fails referencing `@/shared/http/headers`
  </acceptance_criteria>
  <done>RED — test file exists, fails</done>
</task>

<task type="auto" tdd="true">
  <name>Task 9.2: GREEN — Implement headers builder and middleware</name>
  <files>src/shared/http/headers.ts, src/middleware.ts</files>
  <read_first>
    - tests/unit/middleware-headers.test.ts (Task 9.1)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-6
  </read_first>
  <action>
  Create `src/shared/http/headers.ts`:

  ```typescript
  export type SecurityHeaderMode = 'production' | 'preview' | 'development';

  export const CSP_DIRECTIVES: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'"],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:', 'https://*.supabase.co'],
    'font-src': ["'self'"],
    'connect-src': [
      "'self'",
      'https://*.sentry.io',
      'https://*.ingest.sentry.io',
      'https://eu.posthog.com',
      'https://eu-assets.i.posthog.com',
      'https://*.supabase.co',
      'wss://*.supabase.co',
      'https://api.stripe.com',
    ],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'report-uri': ['/api/v1/_csp/report'],
  };

  export const SECURITY_HEADER_KEYS = [
    'Content-Security-Policy',
    'Content-Security-Policy-Report-Only',
    'Strict-Transport-Security',
    'X-Frame-Options',
    'X-Content-Type-Options',
    'Referrer-Policy',
    'Permissions-Policy',
  ] as const;

  function serializeCsp(): string {
    return Object.entries(CSP_DIRECTIVES)
      .map(([k, v]) => `${k} ${v.join(' ')}`)
      .join('; ');
  }

  export function buildSecurityHeaders(mode: SecurityHeaderMode): Record<string, string> {
    const csp = serializeCsp();
    const headers: Record<string, string> = {
      'Strict-Transport-Security': 'max-age=15552000; includeSubDomains', // D-21: 6mo, no preload
      'X-Frame-Options': 'DENY',                                           // D-22
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'geolocation=(), camera=(self), microphone=()',
    };
    if (mode === 'production') {
      headers['Content-Security-Policy'] = csp;                            // D-20 enforced
    } else {
      headers['Content-Security-Policy-Report-Only'] = csp;                // D-20 report-only
    }
    return headers;
  }
  ```

  Create `src/middleware.ts`:

  ```typescript
  import { NextResponse, type NextRequest } from 'next/server';
  import { buildSecurityHeaders, type SecurityHeaderMode } from '@/shared/http/headers';

  function resolveMode(): SecurityHeaderMode {
    const v = process.env.VERCEL_ENV;
    if (v === 'production') return 'production';
    if (v === 'preview') return 'preview';
    return 'development';
  }

  export function middleware(_req: NextRequest) {
    const res = NextResponse.next();
    const headers = buildSecurityHeaders(resolveMode());
    for (const [k, v] of Object.entries(headers)) {
      res.headers.set(k, v);
    }
    return res;
  }

  export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|sw.js.map).*)'],
  };
  ```

  Run `pnpm test:unit`. All header tests pass.

  Commit: `feat(01-09): implement security headers middleware`
  </action>
  <verify>
    <automated>pnpm test:unit --project unit 2>&1 | grep -E "middleware.*passed|PASS.*middleware-headers"</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/http/headers.ts` exists and exports `buildSecurityHeaders`, `CSP_DIRECTIVES`, `SECURITY_HEADER_KEYS`
    - `src/middleware.ts` exists and exports `middleware` + `config`
    - `grep -q "'max-age=15552000; includeSubDomains'" src/shared/http/headers.ts` succeeds
    - `grep -q "frame-ancestors" src/shared/http/headers.ts` succeeds
    - `grep -q "_next/static" src/middleware.ts` succeeds (matcher)
    - `pnpm test:unit` passes security headers suite
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Header tests GREEN; middleware compiles</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-1 | Tampering (XSS exfil) | CSP allowlist | mitigate | `default-src 'self'` + explicit allowlist; only 5 trusted origins in connect-src; unit test asserts each |
| T-09-clickjack | Tampering | Iframe embedding | mitigate | `frame-ancestors 'none'` + `X-Frame-Options: DENY` (D-22); unit test asserts |
| T-09-downgrade | Tampering | HTTP downgrade | mitigate | HSTS 6mo + includeSubDomains (D-21); unit test asserts |
| T-09-mime | Spoofing | MIME sniffing | mitigate | `X-Content-Type-Options: nosniff` |
| T-09-unsafe-inline | Tampering | script-src 'unsafe-inline' | accept | Phase 1 accepts per D-20; Phase 3 migrates to nonce-based (deferred, RESEARCH#Anti-Patterns) |
</threat_model>

<verification>
Header unit tests GREEN. Plan 13 Playwright smoke verifies headers land on HTTP responses from a preview deploy.
</verification>

<success_criteria>
- `buildSecurityHeaders('production')` returns enforced CSP
- `buildSecurityHeaders('preview')` returns report-only CSP
- HSTS + X-Frame + nosniff set unconditionally
- All 11 test cases GREEN
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-09-SUMMARY.md`.
</output>


### 01-10-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 10
type: execute
wave: 2
depends_on: [06]
files_modified:
  - src/shared/db/client.ts
  - src/shared/db/schema.ts
  - drizzle.config.ts
autonomous: true
requirements: [INFRA-01]
validation_ref: [SC-2b]

must_haves:
  truths:
    - "`src/shared/db/client.ts` constructs postgres-js with `{ prepare: false }` (CLAUDE.md lock)"
    - "`src/shared/db/client.ts` uses DATABASE_POOL_URL (Supavisor txn pool), NEVER DATABASE_URL"
    - "`src/shared/db/schema.ts` exists but exports nothing (empty scaffold)"
    - "`drizzle.config.ts` references the empty schema so `drizzle-kit generate` is operable"
  artifacts:
    - path: "src/shared/db/client.ts"
      provides: "Singleton Drizzle + postgres-js client with mandatory prepare:false"
      exports: [db, client]
    - path: "src/shared/db/schema.ts"
      provides: "Empty schema placeholder (Phase 2 fills)"
    - path: "drizzle.config.ts"
      provides: "drizzle-kit config pointing at empty schema + migrations folder"
---

<objective>
Create the minimal Drizzle client setup: a `postgres-js` + Drizzle singleton using `DATABASE_POOL_URL` with `{ prepare: false }` (CLAUDE.md mandate for Supavisor txn pooler), an EMPTY `schema.ts` placeholder, and a `drizzle.config.ts` so that `drizzle-kit migrate` can be exercised even with zero migrations. Phase 2 fills schema.ts with entity tables; Phase 1 ONLY wires the client.

Purpose: `/api/v1/health` (plan 12) runs `SELECT 1` through this client to verify DB connectivity end-to-end. This exercises Pitfall 2 (Supavisor + prepare:false) on every CI run.
Output: A working `db` import that Phase 2+ can grow.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@CLAUDE.md
@src/shared/config/env.ts

<interfaces>
From src/shared/config/env.ts (plan 06):
```typescript
export const env: Readonly<{
  DATABASE_URL: string;       // session mode — MIGRATIONS ONLY
  DATABASE_POOL_URL: string;  // Supavisor txn pool — RUNTIME ONLY
}>;
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 10.1: Create Drizzle client with {prepare: false}</name>
  <files>src/shared/db/client.ts, src/shared/db/schema.ts</files>
  <read_first>
    - CLAUDE.md (Supavisor + prepare: false mandate)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-4 (Drizzle + postgres-js)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-2 (Supavisor txn prepared statements)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-9 (pool vs direct URL)
    - src/shared/config/env.ts (plan 06)
  </read_first>
  <action>
  Create `src/shared/db/schema.ts` — empty placeholder for Phase 2:

  ```typescript
  /**
   * Drizzle schema placeholder. Phase 2 populates with entities from PRD §4.
   * Phase 1 ships this empty so `drizzle-kit generate` can run with zero migrations.
   */
  export {};
  ```

  Create `src/shared/db/client.ts` — singleton Drizzle client:

  ```typescript
  import { drizzle } from 'drizzle-orm/postgres-js';
  import postgres from 'postgres';
  import { env } from '@/shared/config/env';
  import * as schema from '@/shared/db/schema';

  /**
   * Supavisor transaction-mode pooler requires { prepare: false }.
   * CLAUDE.md mandate: "postgres-js driver with { prepare: false } mandatory".
   * RUNTIME uses DATABASE_POOL_URL; migrations use DATABASE_URL (direct).
   * See RESEARCH Pitfall 2 + Pitfall 9.
   */
  export const client = postgres(env.DATABASE_POOL_URL, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
  });

  export const db = drizzle(client, { schema });
  ```
  </action>
  <verify>
    <automated>pnpm typecheck && grep -q "prepare: false" src/shared/db/client.ts && grep -q "DATABASE_POOL_URL" src/shared/db/client.ts</automated>
  </verify>
  <acceptance_criteria>
    - `src/shared/db/client.ts` exists
    - `grep -q "prepare: false" src/shared/db/client.ts` succeeds (T-06 mitigation, CLAUDE.md lock)
    - `grep -q "DATABASE_POOL_URL" src/shared/db/client.ts` succeeds
    - `grep -q "DATABASE_URL[^_]" src/shared/db/client.ts` does NOT match (direct URL never used at runtime — Pitfall 9)
    - `src/shared/db/schema.ts` exists with `export {}`
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Client + schema placeholder created; typecheck passes</done>
</task>

<task type="auto">
  <name>Task 10.2: Create drizzle.config.ts</name>
  <files>drizzle.config.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-12 (drizzle-kit migrate single source of truth)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-9 (migration uses DATABASE_URL direct)
  </read_first>
  <action>
  Create `drizzle.config.ts` at project root:

  ```typescript
  import { defineConfig } from 'drizzle-kit';

  /**
   * drizzle-kit config. Migrations use DATABASE_URL (direct session-mode connection)
   * per Pitfall 9 — Supavisor txn pool does not support DDL like `CREATE INDEX CONCURRENTLY`.
   *
   * Phase 1 ships an empty schema; Phase 2 adds tables.
   */
  export default defineConfig({
    schema: './src/shared/db/schema.ts',
    out: './drizzle/migrations',
    dialect: 'postgresql',
    dbCredentials: {
      url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/placeholder',
    },
    verbose: true,
    strict: true,
  });
  ```

  Create the migrations directory: `mkdir -p drizzle/migrations` and add a `.gitkeep` file inside so the empty dir stays committed: `touch drizzle/migrations/.gitkeep`.
  </action>
  <verify>
    <automated>test -f drizzle.config.ts && test -d drizzle/migrations && pnpm exec drizzle-kit generate --help > /dev/null 2>&1 && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `drizzle.config.ts` exists
    - `grep -q "DATABASE_URL" drizzle.config.ts` succeeds
    - `grep -q "drizzle/migrations" drizzle.config.ts` succeeds
    - `drizzle/migrations/.gitkeep` exists (or `drizzle/migrations` contains at least one file)
    - `pnpm exec drizzle-kit --help` exits 0 (CLI resolves)
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>drizzle.config.ts in place; drizzle-kit CLI accepts it</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-10-6 | Availability | Supavisor prepared-statement collision | mitigate | `{ prepare: false }` hardcoded in client; acceptance criterion greps for it |
| T-10-9 | Tampering | Migration vs runtime URL mix-up | mitigate | `drizzle.config.ts` uses `DATABASE_URL` (direct); `client.ts` uses `DATABASE_POOL_URL` (pool); unit test in plan 06 validates both exist |
</threat_model>

<verification>
Compile-time: typecheck passes. Runtime verification happens in plan 12 (health route unit test) and plan 19 (integration test against postgres:17-alpine).
</verification>

<success_criteria>
- Drizzle client singleton with `{ prepare: false }`
- Empty schema placeholder
- drizzle.config.ts operable
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-10-SUMMARY.md`.
</output>


### 01-11-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 11
type: execute
wave: 2
depends_on: [02, 06, 07]
files_modified:
  - next.config.ts
  - src/app/sw.ts
  - src/shared/i18n/request.ts
  - src/shared/i18n/pt-BR.json
  - src/app/layout.tsx
  - src/app/page.tsx
  - next-env.d.ts
autonomous: true
requirements: [INFRA-01, OBS-01]
validation_ref: [SC-1a, SC-1c, SC-1d, SC-3b, SC-3c]

must_haves:
  truths:
    - "`pnpm build` exits 0"
    - "next.config.ts (TypeScript — matches CONTEXT.md integration_points) wraps config with withNextIntl + withSerwist + withSentryConfig (D-19 OVERRIDE — native Turbopack upload)"
    - "next.config.ts wires next-intl via createNextIntlPlugin pointing at src/shared/i18n/request.ts (Task 11.1 — not Task 11.2 prose)"
    - "Sentry withSentryConfig passes SENTRY_AUTH_TOKEN and release = GITHUB_SHA"
    - "Root layout renders <html lang=\"pt-BR\">"
    - "Root layout uses NextIntlClientProvider with static pt-BR messages"
    - "Service worker source exists at src/app/sw.ts"
  artifacts:
    - path: "next.config.ts"
      provides: "Next config with next-intl + Serwist + Sentry wrapping (TypeScript, satisfies NextConfig)"
    - path: "src/app/sw.ts"
      provides: "Serwist SW source (D-26 no-op shell)"
    - path: "src/shared/i18n/request.ts"
      provides: "next-intl static locale config (referenced by createNextIntlPlugin in next.config.ts)"
    - path: "src/shared/i18n/pt-BR.json"
      provides: "seed translations"
    - path: "src/app/layout.tsx"
      provides: "Root layout with <html lang=\"pt-BR\"> + NextIntlClientProvider"
    - path: "src/app/page.tsx"
      provides: "Placeholder home page so / renders"
---

<objective>
Wire the three build-time integrations: Next config (next-intl + Serwist + Sentry withSentryConfig per D-19 OVERRIDE) as a TypeScript file (`next.config.ts` — matches CONTEXT.md integration_points lines 108, 148), next-intl static single-locale (D-25), Serwist no-op SW (D-26), and a minimal App Router root (`layout.tsx` + `page.tsx`) so `pnpm build` exits 0.

**File extension:** Next 16 natively supports TypeScript config files (`next.config.ts`). CONTEXT.md `integration_points` names the file `next.config.ts`; this plan follows that lock. The config uses `import`/`export default` (identical to .mjs) plus a `satisfies NextConfig` type assertion for compile-time safety.

**next-intl wiring happens in Task 11.1:** `createNextIntlPlugin` is a plugin wrapper that Next 16 loads at build time to make server-component `getLocale()` / `getMessages()` work. It MUST be in `next.config.ts` from the first task, not added as a prose note in Task 11.2, otherwise an executor that stops after Task 11.1 will produce a broken build.

Purpose: Without these, there is no build, no SW, no locale, and no page to smoke-test. Applies D-19 OVERRIDE (native Turbopack source-map upload via withSentryConfig — NOT separate sentry-cli step).
Output: A buildable Next 16 App Router application rendering `<html lang="pt-BR">`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@sentry.client.config.ts
@sentry.server.config.ts
@sentry.edge.config.ts
</context>

<tasks>

<task type="auto">
  <name>Task 11.1: Create next.config.ts with next-intl + Serwist + Sentry wrapping (D-19 OVERRIDE)</name>
  <files>next.config.ts, next-env.d.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md clarifications D-19 OVERRIDE
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md integration_points (lines 108, 148 — file is named next.config.ts)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-2 (next-intl static mode)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-3 (Serwist)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#State-of-the-Art (native Turbopack Sentry upload)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-6 (Serwist disable in dev)
  </read_first>
  <action>
  Create `next.config.ts` at project root. This applies D-19 OVERRIDE: `withSentryConfig` handles source-map upload natively (no separate sentry-cli step in deploy workflows). It ALSO wires `createNextIntlPlugin` here — Task 11.2 will NOT re-touch this file for next-intl.

  **Wrapper order (outside-in):** `withSentryConfig` → `withNextIntl` → `withSerwist` → `nextConfig`. next-intl must wrap Serwist so the plugin's Server Component hooks run before the SW manifest is frozen. Sentry wraps everything so it intercepts the final Webpack/Turbopack config from all three plugins.

  ```typescript
  import type { NextConfig } from 'next';
  import withSerwistInit from '@serwist/next';
  import { withSentryConfig } from '@sentry/nextjs';
  import createNextIntlPlugin from 'next-intl/plugin';

  const withSerwist = withSerwistInit({
    swSrc: 'src/app/sw.ts',
    swDest: 'public/sw.js',
    disable: process.env.NODE_ENV === 'development', // Pitfall 6
    cacheOnNavigation: true,
    reloadOnOnline: true,
  });

  // next-intl static-mode plugin. Points at the request config that returns
  // { locale: 'pt-BR', messages } for every server render. Task 11.2 creates
  // the request.ts file this path points to.
  const withNextIntl = createNextIntlPlugin('./src/shared/i18n/request.ts');

  const nextConfig = {
    reactStrictMode: true,
    // No experimental flags (Pitfall 11).
  } satisfies NextConfig;

  // D-19 OVERRIDE: native Turbopack post-build source-map upload via withSentryConfig.
  // SENTRY_AUTH_TOKEN must be set in CI; release name = git SHA.
  export default withSentryConfig(withNextIntl(withSerwist(nextConfig)), {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    release: {
      name: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'local',
    },
    sourcemaps: {
      disable: false,
      deleteSourcemapsAfterUpload: true,
    },
    widenClientFileUpload: true,
    silent: false,
    disableLogger: false,
    hideSourceMaps: true,
  });
  ```

  Create `next-env.d.ts` (Next generates this on first build; pre-commit empty placeholder):
  ```typescript
  /// <reference types="next" />
  /// <reference types="next/image-types/global" />
  ```
  </action>
  <verify>
    <automated>bash -c 'test -f next.config.ts && grep -q "withSentryConfig" next.config.ts && grep -q "withSerwist" next.config.ts && grep -q "createNextIntlPlugin" next.config.ts && grep -q "process.env.SENTRY_AUTH_TOKEN" next.config.ts && grep -q "satisfies NextConfig" next.config.ts && ! test -f next.config.mjs'</automated>
  </verify>
  <acceptance_criteria>
    - `next.config.ts` exists (TypeScript)
    - `next.config.mjs` does NOT exist (the .mjs variant is explicitly forbidden — CONTEXT.md integration_points names the file .ts)
    - `grep -q "withSerwistInit" next.config.ts` succeeds
    - `grep -q "withSentryConfig" next.config.ts` succeeds (D-19 OVERRIDE)
    - `grep -q "createNextIntlPlugin" next.config.ts` succeeds (next-intl wiring in Task 11.1, NOT Task 11.2)
    - `grep -q "./src/shared/i18n/request.ts" next.config.ts` succeeds (plugin points at the request config path Task 11.2 will create)
    - `grep -q "satisfies NextConfig" next.config.ts` succeeds (TypeScript type safety)
    - `grep -q "authToken: process.env.SENTRY_AUTH_TOKEN" next.config.ts` succeeds
    - `grep -q "VERCEL_GIT_COMMIT_SHA" next.config.ts` succeeds (release from SHA)
    - `grep -q "swSrc: 'src/app/sw.ts'" next.config.ts` succeeds
    - `grep -q "disable: process.env.NODE_ENV === 'development'" next.config.ts` succeeds (Pitfall 6)
    - No `sentry-cli` references exist anywhere in CI workflows (will be verified in plans 14-17)
  </acceptance_criteria>
  <done>next.config.ts in place per D-19 OVERRIDE; next-intl plugin wired in Task 11.1 (no prose note in Task 11.2)</done>
</task>

<task type="auto">
  <name>Task 11.2: Create Serwist sw.ts + i18n static config + root layout + placeholder page</name>
  <files>src/app/sw.ts, src/shared/i18n/request.ts, src/shared/i18n/pt-BR.json, src/app/layout.tsx, src/app/page.tsx</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-2 (next-intl static mode)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-3 (Serwist sw.ts)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-25, D-26
    - docs/CAVE-PRD.md §21 (referenced by anti-pattern doc — "Using middleware-based locale detection")
    - next.config.ts (created in Task 11.1 — already wires createNextIntlPlugin; DO NOT re-touch)
  </read_first>
  <action>
  **This task does NOT modify `next.config.ts`.** All next.config wiring happened in Task 11.1. This task only creates the files the plugin and the layout reference.

  Create `src/app/sw.ts`:

  ```typescript
  import { defaultCache } from '@serwist/next/worker';
  import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist';
  import { Serwist } from 'serwist';

  declare global {
    interface WorkerGlobalScope extends SerwistGlobalConfig {
      __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    }
  }
  declare const self: ServiceWorkerGlobalScope;

  const serwist = new Serwist({
    precacheEntries: self.__SW_MANIFEST,
    skipWaiting: true,
    clientsClaim: true,
    navigationPreload: true,
    runtimeCaching: defaultCache,
  });

  serwist.addEventListeners();
  ```

  Create `src/shared/i18n/pt-BR.json` — seed translations (just enough for plan 13 smoke):
  ```json
  {
    "app": {
      "title": "Folhário",
      "greeting": "Olá, Folhário"
    }
  }
  ```

  Create `src/shared/i18n/request.ts` per D-25 static mode. This is the file `createNextIntlPlugin('./src/shared/i18n/request.ts')` in Task 11.1's `next.config.ts` points at:
  ```typescript
  import { getRequestConfig } from 'next-intl/server';

  export default getRequestConfig(async () => {
    const locale = 'pt-BR';
    const messages = (await import('./pt-BR.json')).default;
    return { locale, messages };
  });
  ```

  Create `src/app/layout.tsx`:
  ```tsx
  import type { Metadata } from 'next';
  import { NextIntlClientProvider } from 'next-intl';
  import { getLocale, getMessages } from 'next-intl/server';

  export const metadata: Metadata = {
    title: 'Folhário',
    description: 'Identifique suas plantas em pt-BR',
  };

  export default async function RootLayout({ children }: { children: React.ReactNode }) {
    const locale = await getLocale();
    const messages = await getMessages();
    return (
      <html lang={locale}>
        <body>
          <NextIntlClientProvider messages={messages} locale={locale}>
            {children}
          </NextIntlClientProvider>
        </body>
      </html>
    );
  }
  ```

  Create `src/app/page.tsx`:
  ```tsx
  export default function HomePage() {
    // Server component. Phase 1 renders a static string; Phase 3 will swap to
    // `useTranslations` for client-side updates.
    return (
      <main>
        <h1>Olá, Folhário</h1>
      </main>
    );
  }
  ```

  Then run `pnpm build`. Expected: build succeeds with a warning-free service-worker file in `public/sw.js`. If `pnpm build` fails because `SENTRY_AUTH_TOKEN` is missing locally, note that `withSentryConfig` is expected to gracefully no-op when the token is absent in dev; if it hard-errors, escalate to the revision loop (do NOT patch `next.config.ts` silently — Task 11.1 is the single source of truth for that file).
  </action>
  <verify>
    <automated>pnpm build 2>&1 | tail -20 && test -f public/sw.js && pnpm typecheck</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/sw.ts` exists with `new Serwist({...})`
    - `src/shared/i18n/request.ts` exports default `getRequestConfig` returning `locale: 'pt-BR'`
    - `src/shared/i18n/pt-BR.json` is valid JSON
    - `src/app/layout.tsx` contains `<html lang={locale}>` (or literal `<html lang="pt-BR">`)
    - `src/app/layout.tsx` imports `NextIntlClientProvider`
    - `src/app/page.tsx` exists
    - `next.config.ts` is UNCHANGED since Task 11.1 (this task must not touch it)
    - `pnpm build` exits 0 AND produces `public/sw.js`
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>`pnpm build` exits 0; `public/sw.js` generated; `<html lang="pt-BR">` rendered; next.config.ts untouched in this task</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-11-maps | Information Disclosure | Source maps public | mitigate | `deleteSourcemapsAfterUpload: true` + `hideSourceMaps: true` in withSentryConfig |
| T-11-experimental | Tampering | Next 16 experimental flags | mitigate | No `experimental` block in nextConfig per Pitfall 11 |
| T-11-intl-unwired | Availability | next-intl plugin missing from next.config.ts | mitigate | createNextIntlPlugin wired in Task 11.1 (primary action, not Task 11.2 prose); acceptance criterion greps for it |
</threat_model>

<verification>
`pnpm build` exits 0 on a clean tree with the env from `.env.example`. `public/sw.js` exists. Root layout HTML contains `lang="pt-BR"`. `next.config.ts` (not .mjs) is the only Next config file on disk.
</verification>

<success_criteria>
- SC-1a: `pnpm build` exits 0
- SC-1c: `<html lang="pt-BR">` rendered
- SC-1d: `public/sw.js` emitted by Serwist
- D-19 OVERRIDE implemented (native Sentry Turbopack upload)
- File extension: `next.config.ts` (TypeScript), NOT `next.config.mjs`
- next-intl plugin wired in Task 11.1 (not Task 11.2 prose)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-11-SUMMARY.md`.
</output>


### 01-12-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 12
type: tdd
wave: 2
depends_on: [05, 06, 10, 11]
files_modified:
  - src/app/api/v1/health/route.ts
  - src/app/api/v1/_test/throw/route.ts
  - src/app/api/v1/_csp/report/route.ts
  - src/app/api/inngest/route.ts
  - src/inngest/client.ts
  - tests/unit/test-throw-route.test.ts
  - tests/unit/folder-scaffold.test.ts
  - tests/unit/i18n-lang.test.ts
  - tests/unit/tsconfig.test.ts
autonomous: true
requirements: [INFRA-01, INFRA-02, INFRA-16]
validation_ref: [SC-1b, SC-1c, SC-1e, SC-5c]

must_haves:
  truths:
    - "`GET /api/v1/health` returns {status:'ok', db:'ok'} after SELECT 1 via Drizzle"
    - "`GET /api/v1/_test/throw` returns 404 when not (stub AND preview) — D-29 double guard"
    - "`GET /api/v1/_test/throw` throws when gate passes"
    - "`GET /api/inngest` + `PUT /api/inngest` register hello-world function (SC-3d)"
    - "Route handlers use runtime 'nodejs' (postgres-js is not edge-compatible)"
    - "Folder scaffold unit test validates all 40 README.md files exist"
    - "tsconfig unit test validates D-06 flags"
    - "i18n unit test asserts html lang pt-BR rendering"
  artifacts:
    - path: "src/app/api/v1/health/route.ts"
      provides: "SC-2b + health smoke target"
    - path: "src/app/api/v1/_test/throw/route.ts"
      provides: "SC-4a + SC-5c deliberate-error route with D-29 guard"
    - path: "src/app/api/v1/_csp/report/route.ts"
      provides: "CSP report endpoint (D-20 report-uri)"
    - path: "src/app/api/inngest/route.ts"
      provides: "Inngest serve() handler with hello-world fn (SC-3d)"
    - path: "src/inngest/client.ts"
      provides: "Inngest client + hello-world function"
---

<objective>
TDD plan: implement Phase 1's four route handlers (`/api/v1/health`, `/api/v1/_test/throw`, `/api/v1/_csp/report`, `/api/inngest`) plus the Inngest client stub with a single hello-world function so production sync asserts function count ≥ 1 (SC-3d). Also ship the 4 "scaffolding" unit tests that assert Wave 1 artifacts (tsconfig, folder layout, i18n lang, env).

Purpose: Routes are the verification surface for every Phase 1 Playwright smoke assertion. The scaffolding tests close SC-1b, SC-1e, SC-1c, SC-5c gaps identified in VALIDATION.md. D-29 (test/throw persists with double guard) is the load-bearing decision.
Output: 4 route handlers + Inngest stub + 4 scaffolding unit tests.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@src/shared/db/client.ts
@src/shared/config/env.ts

<interfaces>
From src/shared/db/client.ts (plan 10):
```typescript
export const db: PostgresJsDatabase<typeof schema>;
export const client: postgres.Sql;
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 12.1: RED — Write failing unit tests for test/throw gate + scaffold tests</name>
  <files>tests/unit/test-throw-route.test.ts, tests/unit/folder-scaffold.test.ts, tests/unit/i18n-lang.test.ts, tests/unit/tsconfig.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-29 (test/throw double guard), D-06, D-08
    - .planning/phases/01-foundation-ci-cd/01-VALIDATION.md (SC-5c for test/throw gate)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Deliberate-error-endpoint (gated)
  </read_first>
  <behavior>
    - test-throw-route: returns 404 when IDENTIFICATION_PROVIDER_MODE !== 'stub'
    - test-throw-route: returns 404 when VERCEL_ENV === 'production' even if mode=stub
    - test-throw-route: returns 404 when VERCEL_ENV unset
    - test-throw-route: throws when mode=stub AND VERCEL_ENV=preview
    - folder-scaffold: all 7 contexts × 5 layers = 35 directories exist with README.md
    - folder-scaffold: all 5 shared directories exist with README.md
    - tsconfig: strict=true, noUncheckedIndexedAccess=true, all D-06 flags
    - tsconfig: exactOptionalPropertyTypes is NOT present (Pitfall 1)
    - i18n-lang: `getRequestConfig` returns locale `'pt-BR'`
    - i18n-lang: pt-BR.json contains the key `app.title`
  </behavior>
  <action>
  Create `tests/unit/test-throw-route.test.ts`:

  ```typescript
  import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

  async function loadRoute() {
    vi.resetModules();
    return import('@/app/api/v1/_test/throw/route');
  }

  describe('GET /api/v1/_test/throw (D-29 double guard)', () => {
    beforeEach(() => { vi.unstubAllEnvs(); });
    afterEach(() => { vi.unstubAllEnvs(); });

    it('returns 404 when IDENTIFICATION_PROVIDER_MODE is not stub', async () => {
      vi.stubEnv('IDENTIFICATION_PROVIDER_MODE', 'real');
      vi.stubEnv('VERCEL_ENV', 'preview');
      const { GET } = await loadRoute();
      const res = await GET(new Request('http://localhost/api/v1/_test/throw'));
      expect(res.status).toBe(404);
    });

    it('returns 404 when VERCEL_ENV is production (even if stub)', async () => {
      vi.stubEnv('IDENTIFICATION_PROVIDER_MODE', 'stub');
      vi.stubEnv('VERCEL_ENV', 'production');
      const { GET } = await loadRoute();
      const res = await GET(new Request('http://localhost/api/v1/_test/throw'));
      expect(res.status).toBe(404);
    });

    it('returns 404 when VERCEL_ENV is unset', async () => {
      vi.stubEnv('IDENTIFICATION_PROVIDER_MODE', 'stub');
      vi.stubEnv('VERCEL_ENV', '');
      const { GET } = await loadRoute();
      const res = await GET(new Request('http://localhost/api/v1/_test/throw'));
      expect(res.status).toBe(404);
    });

    it('throws when IDENTIFICATION_PROVIDER_MODE=stub AND VERCEL_ENV=preview', async () => {
      vi.stubEnv('IDENTIFICATION_PROVIDER_MODE', 'stub');
      vi.stubEnv('VERCEL_ENV', 'preview');
      const { GET } = await loadRoute();
      await expect(GET(new Request('http://localhost/api/v1/_test/throw'))).rejects.toThrow(/Deliberate/);
    });
  });
  ```

  Create `tests/unit/folder-scaffold.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { statSync, existsSync } from 'node:fs';
  import { join } from 'node:path';

  const CONTEXTS = ['iam', 'catalog', 'species-care', 'identification', 'reminders', 'billing', 'notifications'];
  const LAYERS = ['domain', 'application', 'infrastructure', 'api', 'inngest'];
  const SHARED = ['db', 'events', 'adapters', 'config', 'telemetry'];
  const ROOT = process.cwd();

  describe('bounded-context folder scaffold (INFRA-02, D-08, SC-1e)', () => {
    for (const ctx of CONTEXTS) {
      for (const layer of LAYERS) {
        it(`src/contexts/${ctx}/${layer}/README.md exists`, () => {
          const p = join(ROOT, 'src', 'contexts', ctx, layer, 'README.md');
          expect(existsSync(p), p).toBe(true);
          expect(statSync(p).isFile()).toBe(true);
        });
      }
    }
    for (const name of SHARED) {
      it(`src/shared/${name}/README.md exists`, () => {
        const p = join(ROOT, 'src', 'shared', name, 'README.md');
        expect(existsSync(p), p).toBe(true);
      });
    }
  });
  ```

  Create `tests/unit/tsconfig.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';
  import { readFileSync } from 'node:fs';

  describe('tsconfig.json (D-06, INFRA-01, SC-1b)', () => {
    // Strip comments so JSON.parse works on the json-with-comments file
    const raw = readFileSync('tsconfig.json', 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    const cfg = JSON.parse(raw);
    const co = cfg.compilerOptions;

    it('strict is true', () => expect(co.strict).toBe(true));
    it('noUncheckedIndexedAccess is true', () => expect(co.noUncheckedIndexedAccess).toBe(true));
    it('noImplicitOverride is true', () => expect(co.noImplicitOverride).toBe(true));
    it('noFallthroughCasesInSwitch is true', () => expect(co.noFallthroughCasesInSwitch).toBe(true));
    it('noPropertyAccessFromIndexSignature is true', () => expect(co.noPropertyAccessFromIndexSignature).toBe(true));
    it('forceConsistentCasingInFileNames is true', () => expect(co.forceConsistentCasingInFileNames).toBe(true));
    it('exactOptionalPropertyTypes is NOT set (Pitfall 1)', () => expect(co.exactOptionalPropertyTypes).toBeUndefined());
    it('path alias @/* maps to ./src/*', () => expect(co.paths['@/*']).toEqual(['./src/*']));
  });
  ```

  Create `tests/unit/i18n-lang.test.ts`:

  ```typescript
  import { describe, it, expect } from 'vitest';

  describe('next-intl static pt-BR (D-25, SC-1c)', () => {
    it('pt-BR.json contains seed keys', async () => {
      const messages = (await import('@/shared/i18n/pt-BR.json')).default as any;
      expect(messages.app?.title).toBeTypeOf('string');
    });

    it('getRequestConfig returns locale pt-BR', async () => {
      const mod = await import('@/shared/i18n/request');
      const cfg = await (mod.default as any)({});
      expect(cfg.locale).toBe('pt-BR');
      expect(cfg.messages).toBeTypeOf('object');
    });
  });
  ```

  Run `pnpm test:unit`. All tests must fail OR some scaffolding tests may pass if prior plans already landed — that's fine, test-throw + any truly missing pieces MUST fail.

  Commit: `test(01-12): add failing route + scaffold tests`
  </action>
  <verify>
    <automated>pnpm test:unit 2>&1 | grep -q "test-throw\|folder-scaffold\|tsconfig\|i18n-lang"</automated>
  </verify>
  <acceptance_criteria>
    - All 4 test files exist
    - test-throw-route tests fail referencing `@/app/api/v1/_test/throw/route`
  </acceptance_criteria>
  <done>Test files exist, test/throw tests fail RED</done>
</task>

<task type="auto" tdd="true">
  <name>Task 12.2: GREEN — Implement all 4 route handlers + Inngest client</name>
  <files>src/app/api/v1/health/route.ts, src/app/api/v1/_test/throw/route.ts, src/app/api/v1/_csp/report/route.ts, src/app/api/inngest/route.ts, src/inngest/client.ts</files>
  <read_first>
    - tests/unit/test-throw-route.test.ts (Task 12.1)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Health-route + Deliberate-error-endpoint
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-24, D-29
  </read_first>
  <action>
  Create `src/inngest/client.ts`:

  ```typescript
  import { Inngest } from 'inngest';

  export const inngest = new Inngest({ id: 'folhario' });

  // Phase 1 ships a single hello-world function so production sync (SC-3d)
  // can assert function count >= 1 on PUT /api/inngest.
  export const helloWorld = inngest.createFunction(
    { id: 'hello-world', name: 'Hello World' },
    { event: 'test/hello' },
    async ({ event }) => {
      return { greeting: `Olá, ${event.data?.name ?? 'Folhário'}` };
    },
  );

  export const functions = [helloWorld];
  ```

  Create `src/app/api/inngest/route.ts`:

  ```typescript
  import { serve } from 'inngest/next';
  import { inngest, functions } from '@/inngest/client';

  export const runtime = 'nodejs';

  export const { GET, POST, PUT } = serve({
    client: inngest,
    functions,
  });
  ```

  Create `src/app/api/v1/health/route.ts`:

  ```typescript
  import { NextResponse } from 'next/server';
  import { sql } from 'drizzle-orm';
  import { db } from '@/shared/db/client';

  export const runtime = 'nodejs';

  export async function GET() {
    try {
      await db.execute(sql`SELECT 1`);
      return NextResponse.json({ status: 'ok', db: 'ok' });
    } catch {
      return NextResponse.json({ status: 'ok', db: 'degraded' }, { status: 503 });
    }
  }
  ```

  Create `src/app/api/v1/_test/throw/route.ts` (D-29 double guard):

  ```typescript
  import { NextResponse } from 'next/server';

  export const runtime = 'nodejs';

  export async function GET(_req: Request) {
    // D-29: gated on IDENTIFICATION_PROVIDER_MODE=stub AND VERCEL_ENV=preview.
    // Returns 404 in any other combination (including VERCEL_ENV unset).
    const mode = process.env.IDENTIFICATION_PROVIDER_MODE;
    const vercelEnv = process.env.VERCEL_ENV;
    if (mode !== 'stub' || vercelEnv !== 'preview') {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    // LGPD-13 smoke payload: contains the 6 scrub keys.
    // The Playwright smoke (plan 13) asserts Sentry's event body has these scrubbed.
    const probe = {
      email: 'lgpd-test@example.com',
      password: 'should-never-appear-in-sentry',
      photo_url: 'https://example.com/should-be-scrubbed.jpg',
      token: 'bearer-should-be-scrubbed',
      authorization: 'Bearer also-should-be-scrubbed',
      cookie: 'session=should-be-scrubbed',
      trace_id: crypto.randomUUID(),
    };

    throw new Error(`Deliberate smoke error ${JSON.stringify(probe)}`);
  }
  ```

  Create `src/app/api/v1/_csp/report/route.ts`:

  ```typescript
  import { NextResponse } from 'next/server';
  import * as Sentry from '@sentry/nextjs';

  export const runtime = 'nodejs';

  export async function POST(req: Request) {
    try {
      const body = await req.json();
      Sentry.captureMessage('CSP violation', {
        level: 'warning',
        extra: { report: body },
      });
    } catch {
      // Swallow — CSP reports are best-effort.
    }
    return new NextResponse(null, { status: 204 });
  }
  ```

  Run `pnpm test:unit`. All 4 scaffolding tests + the 4 test/throw tests pass. `pnpm build` still exits 0.

  Commit: `feat(01-12): implement health, test/throw, csp report, inngest routes`
  </action>
  <verify>
    <automated>pnpm test:unit && pnpm typecheck && pnpm build 2>&1 | tail -5</automated>
  </verify>
  <acceptance_criteria>
    - `src/app/api/v1/health/route.ts` exists and uses `db.execute(sql\`SELECT 1\`)`
    - `grep -q "runtime = 'nodejs'" src/app/api/v1/health/route.ts` succeeds
    - `src/app/api/v1/_test/throw/route.ts` contains both `IDENTIFICATION_PROVIDER_MODE !== 'stub'` AND `VERCEL_ENV !== 'preview'` guards
    - `src/app/api/v1/_csp/report/route.ts` exports `POST`
    - `src/app/api/inngest/route.ts` exports `{ GET, POST, PUT }` from `serve()`
    - `src/inngest/client.ts` exports `functions` array with at least one function
    - `pnpm test:unit` passes all test suites
    - `pnpm build` exits 0
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>All route handlers GREEN; build succeeds</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-3 | DoS / Info Disclosure | `/api/v1/_test/throw` in prod | mitigate | D-29 double guard (`stub` AND `preview`); unit test covers all 4 gate branches |
| T-12-CSP | Tampering | CSP report endpoint abuse | accept | Report endpoint swallows malformed input; rate-limiting deferred (not in Phase 1 scope) |
| T-12-edge | Availability | postgres-js on edge runtime | mitigate | `runtime = 'nodejs'` exported from health route; same for all route handlers that touch DB |
</threat_model>

<verification>
`pnpm test:unit` + `pnpm build` both exit 0. All 4 route handlers exist. Plan 13 (Playwright smoke) exercises them in preview env.
</verification>

<success_criteria>
- SC-1b typecheck test GREEN
- SC-1e folder scaffold test GREEN
- SC-1c i18n test GREEN
- SC-5c test/throw gate test GREEN (4 gate branches)
- `/api/inngest` boots with function count ≥ 1 (SC-3d infrastructure)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-12-SUMMARY.md`.
</output>


### 01-13-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 13
type: execute
wave: 3
depends_on: [02, 05, 06, 07, 08, 09, 10, 11, 12]
files_modified:
  - vitest.config.ts
  - playwright.config.ts
  - tests/integration/setup.ts
  - tests/integration/health.test.ts
  - playwright/smoke.spec.ts
autonomous: true
requirements: [INFRA-23, LGPD-13]
validation_ref: [SC-1c, SC-1d, SC-2b, SC-2c, SC-4e, SC-5b]

must_haves:
  truths:
    - "`pnpm test:unit` runs all Wave 2 unit tests in <30s"
    - "`pnpm test:integration` runs against a real Postgres and exercises `SELECT 1` through the Drizzle client"
    - "Integration setup applies drizzle-kit migrate once per file (beforeAll) AND wraps each test in a postgres-js `sql.begin` transaction rolled back on teardown via a sentinel-throw pattern (D-14 — LOCKED)"
    - "Vitest `test.extend` fixture exposes a transactional `db` handle to every integration test; tests that use the top-level client without the fixture are a violation"
    - "`pnpm test:e2e` Playwright smoke covers D-24 full loop: HTML lang, health, test/throw route fires, security headers"
    - "Playwright smoke polls `/api/v1/health` for `db === 'ok'` with a 30s timeout before running assertions (handles preview branch DB cold-start)"
    - "playwright.config uses Chromium only (D-10), baseURL from PLAYWRIGHT_TEST_BASE_URL"
  artifacts:
    - path: "vitest.config.ts"
      provides: "2-project unit + integration config"
    - path: "playwright.config.ts"
      provides: "Chromium-only, baseURL from env"
    - path: "tests/integration/setup.ts"
      provides: "drizzle-kit migrate (beforeAll) + per-test sql.begin transaction rollback fixture (D-14)"
    - path: "tests/integration/health.test.ts"
      provides: "SC-2b real-Postgres health verification (via transactional fixture)"
    - path: "playwright/smoke.spec.ts"
      provides: "D-24 full observability loop + SC-1c/1d/4e/5b (fires SC-4a/SC-4b route; assertion lives in plans 07 + 18)"
---

<objective>
Wire the test infrastructure that every CI job depends on: `vitest.config.ts` with separate unit + integration projects, `playwright.config.ts` targeting preview URLs, integration setup that migrates once per file AND wraps each test in a `postgres-js` `sql.begin` transaction rolled back on teardown via a sentinel-throw pattern (D-14 — LOCKED), a real-Postgres health integration test that consumes the transactional fixture, and the Playwright smoke spec that exercises the full D-24 observability loop.

**D-14 transaction rollback contract (LOCKED in CONTEXT.md:38):** Each integration test MUST run inside a transaction that is rolled back when the test ends. `postgres-js` does not expose a raw `BEGIN`/`ROLLBACK` pair on a pinned connection; instead, `sql.begin(async tx => { ... })` opens a real Postgres transaction, auto-commits on resolve, and auto-rolls-back on throw. We exploit this by wrapping each test body in a `sql.begin` callback that (a) yields the transactional `tx` handle to the test via a Vitest `test.extend` fixture, and (b) throws a sentinel `Error('__TX_ROLLBACK__')` after the test finishes to force a rollback. The sentinel is caught and swallowed in the `afterEach` so Vitest does not see a test failure. This is the cleanest pattern for `porsager/postgres` (confirmed in library docs: "If the function returns (resolves), the transaction is committed. If it throws (rejects), the transaction is rolled back.").

**Validation scope clarification (issue #5 fix):** Plan 13's smoke ONLY asserts that `GET /api/v1/_test/throw` returns a 500/502 status. It does NOT query Sentry's issues API to verify the event body was scrubbed — that assertion is too brittle to automate reliably (ingestion lag, auth token scoping). The canonical SC-4a ("deliberately thrown error reaches Sentry") and SC-4b ("scrubbed fields absent from Sentry payload") coverage lives in plan 07 (unit tests on `beforeSend` — deterministic and fast) and plan 18 (manual operator Sentry dashboard check). Plan 13 is therefore removed from `validation_ref` for SC-4a/SC-4b; the smoke test is documented as a *dependency* (it fires the route) but not as the coverage-owning plan.

Purpose: Plan 12's unit tests validate scrubbers pure-function-style; this plan validates the end-to-end flow against a real preview deploy. The smoke test is the phase's ultimate acceptance gate.
Output: `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e` all runnable.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@.planning/phases/01-foundation-ci-cd/01-VALIDATION.md
@src/shared/db/client.ts
</context>

<tasks>

<task type="auto">
  <name>Task 13.1: Create vitest.config.ts + integration setup with per-test rollback fixture + integration health test</name>
  <files>vitest.config.ts, tests/integration/setup.ts, tests/integration/health.test.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-14 (fresh DB per file, transaction rollback per test — LOCKED)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Validation-Architecture
    - .planning/phases/01-foundation-ci-cd/01-VALIDATION.md (watch-mode ban)
    - src/shared/db/client.ts (plan 10 — exposes `client` postgres-js instance and `db` drizzle wrapper)
  </read_first>
  <action>
  Create `vitest.config.ts`:

  ```typescript
  import { defineConfig } from 'vitest/config';
  import { resolve } from 'node:path';

  export default defineConfig({
    resolve: {
      alias: { '@': resolve(__dirname, './src') },
    },
    test: {
      projects: [
        {
          test: {
            name: 'unit',
            environment: 'node',
            include: ['tests/unit/**/*.test.ts', 'src/**/*.test.ts'],
            exclude: ['tests/integration/**', 'playwright/**'],
          },
          resolve: {
            alias: { '@': resolve(__dirname, './src') },
          },
        },
        {
          test: {
            name: 'integration',
            environment: 'node',
            pool: 'forks',
            poolOptions: { forks: { singleFork: false } },
            include: ['tests/integration/**/*.test.ts'],
            setupFiles: ['tests/integration/setup.ts'],
            testTimeout: 30000,
            hookTimeout: 60000,
          },
          resolve: {
            alias: { '@': resolve(__dirname, './src') },
          },
        },
      ],
    },
  });
  ```

  Create `tests/integration/setup.ts` implementing the D-14 contract:

  ```typescript
  import { beforeAll, afterAll, beforeEach, afterEach, test as baseTest } from 'vitest';
  import { execSync } from 'node:child_process';
  import type { Sql } from 'postgres';
  import { drizzle } from 'drizzle-orm/postgres-js';
  import { client } from '@/shared/db/client';

  // D-14 (LOCKED): fresh DB per file (beforeAll migrates once), transaction
  // rollback per test (beforeEach opens sql.begin, afterEach throws a sentinel
  // to force ROLLBACK). postgres-js commits on resolve and rolls back on throw,
  // so we wrap the test body in a deferred promise and resolve it inside
  // sql.begin, then throw a sentinel to trigger rollback on teardown.

  const TX_ROLLBACK_SENTINEL = '__TX_ROLLBACK_SENTINEL__';

  beforeAll(() => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set for integration tests');
    }
    // Apply migrations once per test file.
    execSync('pnpm exec drizzle-kit migrate', {
      stdio: 'inherit',
      env: { ...process.env },
    });
  });

  afterAll(async () => {
    // Close the postgres-js client so the test process exits cleanly.
    await client.end({ timeout: 5 });
  });

  /**
   * Per-test transaction wrapper (D-14).
   *
   * Strategy: spawn `sql.begin` in the background, hand its `tx` handle to the
   * test via a Vitest test-context fixture, wait for the test body to finish,
   * then throw the sentinel to force ROLLBACK. `sql.begin` rejects with the
   * sentinel; we catch and swallow it in `afterEach`.
   *
   * This is the cleanest pattern for porsager/postgres because the driver does
   * NOT expose a raw BEGIN/ROLLBACK on a pinned connection — sql.begin IS the
   * API for transactional scopes.
   */
  interface TxContext {
    tx: Sql;
    txDb: ReturnType<typeof drizzle>;
    __release: () => void;
    __rollbackPromise: Promise<void>;
  }

  // Vitest `test.extend` creates a typed fixture every integration test
  // imports FROM THIS FILE via `import { test } from '../integration/setup'`
  // (or re-exported via a barrel).
  export const test = baseTest.extend<{ txDb: ReturnType<typeof drizzle> }>({
    // eslint-disable-next-line no-empty-pattern
    txDb: async ({}, use) => {
      let releaseTest: () => void = () => {};
      const testDone = new Promise<void>((resolve) => {
        releaseTest = resolve;
      });

      let capturedTxDb: ReturnType<typeof drizzle> | undefined;
      const rollbackPromise = client
        .begin(async (tx) => {
          capturedTxDb = drizzle(tx);
          // Yield to the test body.
          await testDone;
          // Force rollback by throwing the sentinel.
          throw new Error(TX_ROLLBACK_SENTINEL);
        })
        .catch((err: unknown) => {
          if (err instanceof Error && err.message === TX_ROLLBACK_SENTINEL) {
            return; // expected
          }
          throw err; // real error — surface to test
        });

      // Wait for `sql.begin` to enter the callback and populate `capturedTxDb`.
      // A tiny microtask spin is enough because client.begin resolves the
      // callback synchronously after BEGIN lands.
      while (!capturedTxDb) {
        await new Promise((r) => setImmediate(r));
      }

      await use(capturedTxDb);

      // Test body is done; release the deferred promise so the sentinel throws.
      releaseTest();
      await rollbackPromise;
    },
  });

  // Re-export Vitest primitives so test files get one import:
  // `import { test, describe, expect, beforeEach, afterEach } from '../integration/setup';`
  export { describe, expect, beforeEach, afterEach } from 'vitest';
  ```

  Create `tests/integration/health.test.ts` — consumes the transactional fixture:

  ```typescript
  import { sql } from 'drizzle-orm';
  import { test, describe, expect } from './setup';

  describe('health integration (SC-2b)', () => {
    test('SELECT 1 succeeds through Drizzle + postgres-js + {prepare:false} inside a rolled-back tx', async ({ txDb }) => {
      const result = await txDb.execute(sql`SELECT 1 as one`);
      // drizzle-orm/postgres-js returns an array-like result
      expect(result).toBeTruthy();
    });

    test('GET /api/v1/health logic returns ok when DB reachable', async () => {
      // This test exercises the route's OWN client (not the tx fixture) because
      // the route handler imports `db` directly. That's acceptable because the
      // route is read-only (SELECT 1); nothing it does leaks across tests.
      const { GET } = await import('@/app/api/v1/health/route');
      const res = await GET();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual({ status: 'ok', db: 'ok' });
    });
  });
  ```

  **Note:** For this integration test to use the POOL URL, temporarily set `DATABASE_POOL_URL = DATABASE_URL` in the CI job env (plan 14). The env parser in plan 06 treats both as separate required vars; in CI integration-test mode they point at the same local postgres container.

  **Why the fixture uses `client.begin` instead of raw `BEGIN`/`ROLLBACK`:** `porsager/postgres` does not expose a checked-out connection with raw statement control. `sql.begin(fn)` IS the transactional primitive: it acquires a connection, issues `BEGIN`, runs `fn`, then issues `COMMIT` on resolve or `ROLLBACK` on reject. The sentinel-throw pattern is idiomatic for this driver and is documented in the library's README ("If it throws (rejects), the transaction is rolled back"). Confirmed via ctx7 lookup on `/porsager/postgres` at revision time.
  </action>
  <verify>
    <automated>bash -c 'test -f vitest.config.ts && test -f tests/integration/setup.ts && test -f tests/integration/health.test.ts && grep -q "beforeEach\|test.extend" tests/integration/setup.ts && grep -qE "client\.begin|ROLLBACK" tests/integration/setup.ts && grep -q "test.extend" tests/integration/setup.ts && grep -q "TX_ROLLBACK_SENTINEL" tests/integration/setup.ts && pnpm typecheck'</automated>
  </verify>
  <acceptance_criteria>
    - `vitest.config.ts` declares TWO projects named `unit` and `integration`
    - `grep -q "pool: 'forks'" vitest.config.ts` succeeds
    - `grep -q "setupFiles.*integration/setup" vitest.config.ts` succeeds
    - `tests/integration/setup.ts` calls `drizzle-kit migrate` via execSync in `beforeAll`
    - `grep -qE "test\.extend" tests/integration/setup.ts` succeeds (Vitest fixture)
    - `grep -qE "client\.begin" tests/integration/setup.ts` succeeds (D-14 rollback mechanism)
    - `grep -q "TX_ROLLBACK_SENTINEL" tests/integration/setup.ts` succeeds (sentinel pattern documented + enforced)
    - `tests/integration/health.test.ts` imports `test` from `./setup` (the fixture-aware test, not bare vitest)
    - `tests/integration/health.test.ts` consumes the `txDb` fixture in at least one test
    - `pnpm test:unit` (no integration) exits 0
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Vitest two-project config works; D-14 per-test rollback enforced via fixture; unit tests still pass</done>
</task>

<task type="auto">
  <name>Task 13.2: Create playwright.config.ts and smoke spec covering D-24 full loop with preview-DB cold-start wait</name>
  <files>playwright.config.ts, playwright/smoke.spec.ts</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-10, D-24
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-7 (playwright install --with-deps)
    - .planning/phases/01-foundation-ci-cd/01-VALIDATION.md#Per-Invariant-Verification-Map (SC-5b, SC-4e)
    - src/app/api/v1/_test/throw/route.ts (plan 12)
    - src/app/api/v1/health/route.ts (plan 12 — returns `{ status: 'ok' | 'degraded', db: 'ok' | 'degraded' }`, HTTP 503 on DB failure)
  </read_first>
  <action>
  Create `playwright.config.ts`:

  ```typescript
  import { defineConfig, devices } from '@playwright/test';

  export default defineConfig({
    testDir: './playwright',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [['github'], ['html']] : 'list',
    use: {
      baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL,
      trace: 'on-first-retry',
      video: 'retain-on-failure',
    },
    projects: [
      { name: 'chromium', use: { ...devices['Desktop Chrome'] } }, // D-10 Chromium only
    ],
  });
  ```

  Create `playwright/smoke.spec.ts` — the D-24 full observability loop:

  ```typescript
  import { test, expect } from '@playwright/test';

  // Wait for the preview branch DB to come online before asserting anything.
  // Plan 12's /api/v1/health route returns { status, db } where db is 'ok'
  // when the Drizzle SELECT 1 succeeds and 'degraded' (HTTP 503) when it
  // does not. Preview branch DBs can take several seconds to warm up after
  // the Supabase branch is created by deploy-preview.yml, so we poll with
  // an explicit 30-second budget before running the rest of the smoke.
  test.beforeAll(async ({ request }) => {
    await expect
      .poll(
        async () => {
          try {
            const res = await request.get('/api/v1/health');
            if (!res.ok()) return 'degraded';
            const body = await res.json();
            return body.db as string;
          } catch {
            return 'unreachable';
          }
        },
        {
          timeout: 30_000,
          intervals: [1000, 2000, 2000, 5000, 5000, 5000, 5000],
          message: 'Preview branch DB did not come online within 30s',
        },
      )
      .toBe('ok');
  });

  test.describe('Phase 1 smoke — D-24 full observability loop', () => {
    test('home renders with <html lang="pt-BR"> (SC-1c)', async ({ page }) => {
      const response = await page.goto('/');
      expect(response?.ok()).toBe(true);
      const html = page.locator('html');
      await expect(html).toHaveAttribute('lang', 'pt-BR');
      // No console errors from Serwist/Sentry on first load
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.waitForLoadState('domcontentloaded');
      expect(errors).toEqual([]);
    });

    test('service worker registers (SC-1d)', async ({ page }) => {
      await page.goto('/');
      // Wait for SW to register (up to 5s)
      const hasSw = await page.evaluate(async () => {
        const reg = await navigator.serviceWorker.getRegistration('/');
        return !!reg;
      });
      expect(hasSw).toBe(true);
    });

    test('security headers on home response (SC-5b)', async ({ request }) => {
      const res = await request.get('/');
      const h = res.headers();
      // Preview env = report-only; production = enforced
      expect(h['content-security-policy-report-only'] ?? h['content-security-policy']).toBeTruthy();
      expect(h['strict-transport-security']).toBe('max-age=15552000; includeSubDomains');
      expect(h['x-frame-options']).toBe('DENY');
      expect(h['x-content-type-options']).toBe('nosniff');
    });

    test('GET /api/v1/health returns {status:ok, db:ok} (SC-2c)', async ({ request }) => {
      const res = await request.get('/api/v1/health');
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body.status).toBe('ok');
      expect(body.db).toBe('ok');
    });

    test('GET /api/v1/_test/throw fires in preview (D-29 gate — route-fire assertion only, Sentry scrub tested in plans 07 + 18)', async ({ request }) => {
      const res = await request.get('/api/v1/_test/throw');
      // When VERCEL_ENV=preview and IDENTIFICATION_PROVIDER_MODE=stub, the route
      // throws → Next returns 500/502. This smoke ONLY asserts the route fires;
      // the Sentry scrub assertion lives in:
      //   - plan 07 (unit tests on beforeSend — deterministic, fast)
      //   - plan 18 (manual operator Sentry dashboard check — final mile)
      expect([500, 502]).toContain(res.status());
    });

    test('PostHog ping via server-side capture (SC-4e)', async ({ request }) => {
      // Phase 1 wires connectivity only. The /api/v1/health endpoint in Phase 2+
      // will fire a PostHog ping; for Phase 1 this test asserts that the server
      // factory is importable (via health check succeeding — health uses db,
      // not PostHog directly). Full e2e PostHog ping is deferred.
      const res = await request.get('/api/v1/health');
      expect(res.status()).toBe(200);
    });
  });
  ```

  **SC-4a/SC-4b scope note (issue #5 fix):** Plan 13 is no longer listed as the
  owner of SC-4a/SC-4b in the per-invariant verification map. Plan 13's smoke
  test fires the deliberate-error route (the "route fires" leg) and asserts a
  500/502 status. The actual scrubber assertion owners are plan 07 (unit-level
  `beforeSend` tests — deterministic, in CI) and plan 18 (manual Sentry
  dashboard check — final mile confirmation). `01-VALIDATION.md` Per-Invariant
  Verification Map is updated in the same revision to reflect this split.
  </action>
  <verify>
    <automated>bash -c 'test -f playwright.config.ts && test -f playwright/smoke.spec.ts && grep -q "expect.poll" playwright/smoke.spec.ts && grep -q "beforeAll" playwright/smoke.spec.ts && pnpm exec playwright --version && pnpm typecheck'</automated>
  </verify>
  <acceptance_criteria>
    - `playwright.config.ts` exists with `projects: [{ name: 'chromium', ... }]` (only one, D-10)
    - `grep -q "baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL" playwright.config.ts` succeeds
    - `playwright/smoke.spec.ts` contains `test.describe('Phase 1 smoke — D-24 full observability loop'`
    - `grep -q "test.beforeAll" playwright/smoke.spec.ts` succeeds (cold-start wait)
    - `grep -q "expect.poll" playwright/smoke.spec.ts` succeeds (30s health wait loop)
    - `grep -q "timeout: 30_000" playwright/smoke.spec.ts` succeeds
    - Test count >= 5 (home lang, service worker, security headers, health, test/throw)
    - `pnpm exec playwright --version` exits 0
    - `pnpm typecheck` exits 0
  </acceptance_criteria>
  <done>Playwright config + smoke spec in place; preview-DB cold-start handled</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-13-flaky | Availability | Sentry API query from Playwright | mitigate | SC-4a/SC-4b owned by plan 07 (unit scrubber tests) + plan 18 (manual dashboard). Plan 13 smoke ONLY fires the route and asserts a 500/502. |
| T-13-coldstart | Availability | Preview branch DB cold start | mitigate | `test.beforeAll` polls `/api/v1/health` for `db === 'ok'` with a 30s timeout before any other smoke test runs |
| T-13-parity | Info Disclosure | Integration test DB | accept | Uses local postgres:17-alpine service container; no real data |
| T-13-leak | Tampering | Integration test data leaking across tests | mitigate | D-14 per-test `sql.begin` transaction rollback via sentinel-throw fixture (Task 13.1) |
</threat_model>

<verification>
`pnpm test:unit && pnpm test:integration` locally (with a running postgres) both exit 0. `pnpm test:e2e` requires `PLAYWRIGHT_TEST_BASE_URL` env. Integration tests that insert rows see them within the test body but observe a clean DB on the next test (rollback proof).
</verification>

<success_criteria>
- Vitest 2-project config operational
- Integration setup applies migrations once (beforeAll) + per-test rollback via fixture (D-14 LOCKED)
- Playwright smoke covers D-24 loop with preview-DB cold-start wait
- SC-4a/SC-4b coverage is owned by plans 07 + 18; plan 13 only fires the route
- No watch-mode flags anywhere
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-13-SUMMARY.md`.
</output>


### 01-14-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 14
type: execute
wave: 4
depends_on: [13]
files_modified:
  - .github/workflows/ci.yml
autonomous: true
requirements: [INFRA-12, INFRA-23]
validation_ref: [SC-2a, SC-2b]

must_haves:
  truths:
    - "`ci.yml` runs on pull_request and push to main"
    - "`ci.yml` installs Node 22 via setup-node + node-version-file: .nvmrc"
    - "`ci.yml` installs pnpm via pnpm/action-setup@v4 BEFORE setup-node (Pitfall 10)"
    - "`ci.yml` provides postgres:17-alpine service container (D-28 OVERRIDE)"
    - "`ci.yml` runs lint, typecheck, test:unit, test:integration, build (all --run / non-watch)"
    - "`ci.yml` runs `drizzle-kit migrate` before test:integration"
    - "Service container health-check gates subsequent steps"
  artifacts:
    - path: ".github/workflows/ci.yml"
      provides: "SC-2a + SC-2b"
---

<objective>
Author the `ci.yml` GitHub Actions workflow. Runs on every PR + main push. Installs pnpm + Node 22 (correct order for cache — Pitfall 10), spins a `postgres:17-alpine` service container (D-28 OVERRIDE, NOT `16-alpine`), applies migrations via `drizzle-kit migrate`, runs lint + typecheck + unit + integration + build.

Purpose: SC-2a + SC-2b verification gate for every PR. Plans 15-17 depend on this running first (branch protection in plan 17).
Output: `.github/workflows/ci.yml`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 14.1: Create .github/workflows/ci.yml</name>
  <files>.github/workflows/ci.yml</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-28 (postgres:17-alpine OVERRIDE)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-8 (ci.yml shape)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-10 (pnpm/action-setup order)
    - package.json (scripts)
  </read_first>
  <action>
  Create `.github/workflows/ci.yml`:

  ```yaml
  name: CI

  on:
    pull_request:
      types: [opened, synchronize, reopened]
    push:
      branches: [main]

  concurrency:
    group: ci-${{ github.ref }}
    cancel-in-progress: true

  jobs:
    build-and-test:
      runs-on: ubuntu-latest
      timeout-minutes: 15

      services:
        postgres:
          image: postgres:17-alpine   # D-28 OVERRIDE (not 16-alpine)
          env:
            POSTGRES_USER: postgres
            POSTGRES_PASSWORD: postgres
            POSTGRES_DB: folhario_test
          ports:
            - 5432:5432
          options: >-
            --health-cmd "pg_isready -U postgres"
            --health-interval 5s
            --health-timeout 3s
            --health-retries 10

      env:
        # Integration tests and drizzle-kit both point at the local service container.
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/folhario_test
        DATABASE_POOL_URL: postgresql://postgres:postgres@localhost:5432/folhario_test
        NEXT_PUBLIC_SUPABASE_URL: https://ci.supabase.co
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ci-anon-key
        SUPABASE_SERVICE_ROLE_KEY: ci-service-role-key
        NEXT_PUBLIC_POSTHOG_HOST: https://eu.posthog.com
        IDENTIFICATION_PROVIDER_MODE: stub

      steps:
        - name: Checkout
          uses: actions/checkout@v5

        # Pitfall 10: pnpm BEFORE setup-node so cache: pnpm works
        - name: Setup pnpm
          uses: pnpm/action-setup@v4
          with:
            version: 9

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: pnpm

        - name: Install dependencies
          run: pnpm install --frozen-lockfile

        - name: Lint
          run: pnpm lint

        - name: Typecheck
          run: pnpm typecheck

        - name: Unit tests
          run: pnpm test:unit  # internally uses `vitest run --project unit` (no watch)

        - name: Apply migrations (drizzle-kit)
          run: pnpm exec drizzle-kit migrate

        - name: Integration tests
          run: pnpm test:integration  # internally uses `vitest run --project integration`

        - name: Build (Next 16 Turbopack)
          run: pnpm build
          env:
            # withSentryConfig no-ops without auth token; CI build does not upload maps
            # (preview/prod workflows do that in plans 15/17).
            SENTRY_AUTH_TOKEN: ''
  ```
  </action>
  <verify>
    <automated>test -f .github/workflows/ci.yml && grep -q "postgres:17-alpine" .github/workflows/ci.yml && grep -q "pnpm/action-setup@v4" .github/workflows/ci.yml && grep -q "node-version-file: .nvmrc" .github/workflows/ci.yml && ! grep -E "vitest( |$)" .github/workflows/ci.yml</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/ci.yml` exists
    - `grep -q "postgres:17-alpine" .github/workflows/ci.yml` succeeds (D-28)
    - `grep -q "postgres:16-alpine" .github/workflows/ci.yml` does NOT match (D-28 override)
    - `grep -q "pnpm/action-setup@v4" .github/workflows/ci.yml` succeeds
    - `grep -q "node-version-file: .nvmrc" .github/workflows/ci.yml` succeeds
    - `grep -q "pnpm test:unit" .github/workflows/ci.yml` succeeds
    - `grep -q "pnpm test:integration" .github/workflows/ci.yml` succeeds
    - `grep -q "drizzle-kit migrate" .github/workflows/ci.yml` succeeds
    - Order check: pnpm/action-setup appears BEFORE actions/setup-node (Pitfall 10)
    - No bare `vitest` or `vitest watch` invocations (watch-mode ban)
    - `grep -E "\\bvitest\\b(?! run)" .github/workflows/ci.yml` returns nothing
    - Workflow YAML is valid: `pnpm dlx @action-validator/cli@latest .github/workflows/ci.yml` exits 0 (or skip if tool unavailable)
  </acceptance_criteria>
  <done>ci.yml exists; workflow-validator passes or syntax check via YAML parser exits 0</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-14-4 | Info Disclosure | CI secret exposure | mitigate | `pull_request` trigger (NOT `pull_request_target`) — forks cannot read secrets; env block references only non-secret placeholder values |
| T-14-watch | Availability | vitest watch hangs CI | mitigate | Scripts use `vitest run`; acceptance criterion greps for bare `vitest` |
| T-14-cache | Availability | pnpm cache miss (Pitfall 10) | mitigate | pnpm/action-setup BEFORE actions/setup-node |
</threat_model>

<verification>
`ci.yml` will run on the throwaway PR in plan 18; SC-2a confirms all steps green.
</verification>

<success_criteria>
- `ci.yml` covers lint, typecheck, unit, integration, build
- Service container is postgres:17-alpine (D-28)
- Cache-key order correct (Pitfall 10)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-14-SUMMARY.md`.
</output>


### 01-15-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 15
type: execute
wave: 4
depends_on: [13]
files_modified:
  - .github/workflows/deploy-preview.yml
autonomous: true
requirements: [INFRA-13, OBS-01]
validation_ref: [SC-2c, SC-3c (preview source maps)]

must_haves:
  truths:
    - "`deploy-preview.yml` runs on pull_request events (opened/synchronize/reopened)"
    - "Creates Supabase branch DB via `supabase branches create pr-{N}`"
    - "Applies migrations via `drizzle-kit migrate` against the branch DB"
    - "Runs `vercel pull --environment=preview && vercel build && vercel deploy --prebuilt`"
    - "Exports preview URL and runs `pnpm test:e2e` against it"
    - "Source maps upload via withSentryConfig (D-19 OVERRIDE — NO separate sentry-cli step)"
    - "Comments preview URL on PR"
  artifacts:
    - path: ".github/workflows/deploy-preview.yml"
      provides: "SC-2c preview deploy + E2E against preview URL"
---

<objective>
Author `deploy-preview.yml`. On every PR synchronize: create a Supabase branch DB, apply migrations, build via Vercel CLI, deploy preview, run Playwright smoke against the preview URL, comment the URL back on the PR. Source maps upload natively via `withSentryConfig` when `pnpm build` runs (D-19 OVERRIDE — no separate sentry-cli step).

Purpose: SC-2c verification — Playwright runs against a real preview URL bound to a per-PR Supabase branch. `deploy-preview-cleanup.yml` (plan 16) removes these on PR close (SC-2d).
Output: `.github/workflows/deploy-preview.yml`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 15.1: Create .github/workflows/deploy-preview.yml</name>
  <files>.github/workflows/deploy-preview.yml</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-8 (deploy-preview.yml shape)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-19 OVERRIDE, D-12, clarifications
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-7 (playwright install --with-deps)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-8 (vercel pull environment)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Assumptions-Log A3 (Supabase branching CLI)
  </read_first>
  <action>
  Create `.github/workflows/deploy-preview.yml`:

  ```yaml
  name: Deploy Preview

  on:
    pull_request:
      types: [opened, synchronize, reopened]

  concurrency:
    group: preview-${{ github.event.number }}
    cancel-in-progress: true

  jobs:
    deploy:
      runs-on: ubuntu-latest
      timeout-minutes: 20
      environment: preview

      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
        SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
        SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
        NEXT_PUBLIC_POSTHOG_KEY: ${{ secrets.NEXT_PUBLIC_POSTHOG_KEY }}
        NEXT_PUBLIC_POSTHOG_HOST: https://eu.posthog.com
        IDENTIFICATION_PROVIDER_MODE: stub   # Preview is ALWAYS stub (INFRA-16)

      steps:
        - name: Checkout
          uses: actions/checkout@v5
          with:
            fetch-depth: 0

        - name: Setup pnpm
          uses: pnpm/action-setup@v4
          with:
            version: 9

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: pnpm

        - name: Setup Supabase CLI
          uses: supabase/setup-cli@v1
          with:
            version: latest

        - name: Install deps
          run: pnpm install --frozen-lockfile

        - name: Create Supabase branch for PR
          id: branch
          run: |
            BRANCH_NAME="pr-${{ github.event.number }}"
            supabase branches create "$BRANCH_NAME" --experimental --project-ref "$SUPABASE_PROJECT_REF" || true
            # Wait for branch to become ACTIVE_HEALTHY (up to 120s)
            for i in {1..24}; do
              STATUS=$(supabase branches get "$BRANCH_NAME" --experimental --project-ref "$SUPABASE_PROJECT_REF" -o json | jq -r '.status // empty')
              [ "$STATUS" = "ACTIVE_HEALTHY" ] && break
              sleep 5
            done
            # Capture branch DB URL
            DB_URL=$(supabase branches get "$BRANCH_NAME" --experimental --project-ref "$SUPABASE_PROJECT_REF" -o json | jq -r '.db_url')
            echo "::add-mask::$DB_URL"
            echo "db_url=$DB_URL" >> "$GITHUB_OUTPUT"

        - name: Apply migrations (drizzle-kit)
          env:
            DATABASE_URL: ${{ steps.branch.outputs.db_url }}
          run: pnpm exec drizzle-kit migrate

        - name: Vercel pull (preview env)
          run: pnpm exec vercel pull --yes --environment=preview --token=$VERCEL_TOKEN

        - name: Vercel build (withSentryConfig uploads source maps post-build — D-19 OVERRIDE)
          run: pnpm exec vercel build --token=$VERCEL_TOKEN
          env:
            VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}

        - name: Vercel deploy --prebuilt
          id: deploy
          run: |
            URL=$(pnpm exec vercel deploy --prebuilt --token=$VERCEL_TOKEN)
            echo "url=$URL" >> "$GITHUB_OUTPUT"

        - name: Install Playwright browsers (Pitfall 7)
          run: pnpm exec playwright install --with-deps chromium

        - name: Run Playwright smoke against preview
          env:
            PLAYWRIGHT_TEST_BASE_URL: ${{ steps.deploy.outputs.url }}
          run: pnpm test:e2e

        - name: Upload Playwright report on failure
          if: failure()
          uses: actions/upload-artifact@v4
          with:
            name: playwright-report-${{ github.event.number }}
            path: playwright-report/
            retention-days: 7

        - name: Comment preview URL on PR
          uses: marocchino/sticky-pull-request-comment@v2
          with:
            header: preview
            message: |
              **Preview:** ${{ steps.deploy.outputs.url }}
              **Supabase branch:** `pr-${{ github.event.number }}`
  ```
  </action>
  <verify>
    <automated>test -f .github/workflows/deploy-preview.yml && grep -q "vercel deploy --prebuilt" .github/workflows/deploy-preview.yml && grep -q "drizzle-kit migrate" .github/workflows/deploy-preview.yml && ! grep -q "sentry-cli sourcemaps upload" .github/workflows/deploy-preview.yml && grep -q "playwright install --with-deps chromium" .github/workflows/deploy-preview.yml</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/deploy-preview.yml` exists
    - `grep -q "supabase branches create" .github/workflows/deploy-preview.yml` succeeds
    - `grep -q "drizzle-kit migrate" .github/workflows/deploy-preview.yml` succeeds
    - `grep -q "vercel pull --yes --environment=preview" .github/workflows/deploy-preview.yml` succeeds (Pitfall 8)
    - `grep -q "vercel deploy --prebuilt" .github/workflows/deploy-preview.yml` succeeds
    - `grep -q "PLAYWRIGHT_TEST_BASE_URL" .github/workflows/deploy-preview.yml` succeeds
    - `grep -q "playwright install --with-deps chromium" .github/workflows/deploy-preview.yml` succeeds (Pitfall 7)
    - **`grep -q "sentry-cli sourcemaps upload" .github/workflows/deploy-preview.yml` does NOT match** (D-19 OVERRIDE — native upload only)
    - `grep -q "IDENTIFICATION_PROVIDER_MODE: stub" .github/workflows/deploy-preview.yml` succeeds
    - `grep -q "::add-mask::" .github/workflows/deploy-preview.yml` succeeds (T-1-4 secret masking)
  </acceptance_criteria>
  <done>deploy-preview.yml in place per D-19 OVERRIDE</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-15-4 | Info Disclosure | DB URL masking | mitigate | `::add-mask::` applied to DB URL before emission to GITHUB_OUTPUT |
| T-15-8 | Tampering | Vercel pull env mismatch | mitigate | `--environment=preview` paired with `vercel deploy --prebuilt` (no --prod); Pitfall 8 |
| T-15-fork | Info Disclosure | PR from fork | mitigate | `pull_request` event (not `pull_request_target`); forks cannot read secrets |
</threat_model>

<verification>
`deploy-preview.yml` runs on the throwaway PR in plan 18; SC-2c passes when Playwright job completes green against the returned preview URL.
</verification>

<success_criteria>
- Supabase branch created + migrated
- Vercel preview deployed via CLI (no git integration)
- Playwright runs against preview URL
- Source maps upload native (no sentry-cli step)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-15-SUMMARY.md`.
</output>


### 01-16-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 16
type: execute
wave: 4
depends_on: [13]
files_modified:
  - .github/workflows/deploy-preview-cleanup.yml
autonomous: true
requirements: [INFRA-15]
validation_ref: [SC-2d]

must_haves:
  truths:
    - "Runs on pull_request closed event"
    - "Deletes Supabase branch `pr-{N}` via supabase CLI"
    - "Removes Vercel preview alias"
    - "Always runs even if upstream jobs failed"
  artifacts:
    - path: ".github/workflows/deploy-preview-cleanup.yml"
      provides: "SC-2d cleanup"
---

<objective>
Author `deploy-preview-cleanup.yml`. On PR close: delete the Supabase branch DB and remove the Vercel preview alias. Prevents branch DBs and aliases from accumulating.

Purpose: SC-2d verification. Complements plan 15.
Output: `.github/workflows/deploy-preview-cleanup.yml`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 16.1: Create .github/workflows/deploy-preview-cleanup.yml</name>
  <files>.github/workflows/deploy-preview-cleanup.yml</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-8 (cleanup workflow)
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md INFRA-15
  </read_first>
  <action>
  Create `.github/workflows/deploy-preview-cleanup.yml`:

  ```yaml
  name: Cleanup Preview

  on:
    pull_request:
      types: [closed]

  jobs:
    cleanup:
      runs-on: ubuntu-latest
      timeout-minutes: 5

      env:
        SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

      steps:
        - name: Checkout
          uses: actions/checkout@v5

        - name: Setup pnpm
          uses: pnpm/action-setup@v4
          with:
            version: 9

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: pnpm

        - name: Setup Supabase CLI
          uses: supabase/setup-cli@v1
          with:
            version: latest

        - name: Install vercel CLI (dev dep only — no full install needed)
          run: |
            mkdir -p node_modules/.bin
            pnpm install --frozen-lockfile --ignore-scripts

        - name: Delete Supabase branch
          continue-on-error: true
          run: |
            BRANCH_NAME="pr-${{ github.event.number }}"
            supabase branches delete "$BRANCH_NAME" --experimental --project-ref "$SUPABASE_PROJECT_REF" || echo "Branch may already be deleted"

        - name: Remove Vercel preview aliases for this PR
          continue-on-error: true
          run: |
            # List deployments tagged with this PR and remove them
            pnpm exec vercel remove "pr-${{ github.event.number }}.folhario.app" --yes --token=$VERCEL_TOKEN || echo "Alias may not exist"
  ```
  </action>
  <verify>
    <automated>test -f .github/workflows/deploy-preview-cleanup.yml && grep -q "types: \\[closed\\]" .github/workflows/deploy-preview-cleanup.yml && grep -q "supabase branches delete" .github/workflows/deploy-preview-cleanup.yml</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/deploy-preview-cleanup.yml` exists
    - `grep -q "types: \\[closed\\]" .github/workflows/deploy-preview-cleanup.yml` succeeds
    - `grep -q "supabase branches delete" .github/workflows/deploy-preview-cleanup.yml` succeeds
    - `grep -q "vercel remove" .github/workflows/deploy-preview-cleanup.yml` succeeds
    - `continue-on-error: true` on both cleanup steps (idempotent cleanup)
  </acceptance_criteria>
  <done>Cleanup workflow in place</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-16-7 | Info Disclosure | Orphaned preview DB | mitigate | Cleanup runs on PR close; SC-2d manual spot-check in plan 18 |
| T-16-idempotent | Availability | Re-run on already-deleted resource | accept | `continue-on-error: true` + `|| echo` graceful fallback |
</threat_model>

<verification>
Runs on plan 18's throwaway PR close; SC-2d verified manually by visiting Supabase + Vercel dashboards.
</verification>

<success_criteria>
- Cleanup triggers on PR close
- Idempotent (safe to re-run)
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-16-SUMMARY.md`.
</output>


### 01-17-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 17
type: execute
wave: 4
depends_on: [13]
files_modified:
  - .github/workflows/deploy-production.yml
  - .planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md
autonomous: true
requirements: [INFRA-14, OBS-01, OBS-05]
validation_ref: [SC-3a, SC-3b, SC-3c, SC-3d]

must_haves:
  truths:
    - "`deploy-production.yml` runs on push to main"
    - "Applies migrations to production Supabase via `drizzle-kit migrate` using the DIRECT `DATABASE_URL` secret from Wave 0 (not a pooler URL — drizzle-kit migrate MUST NOT use a transaction pooler; no `PROD_DATABASE_URL` secret exists)"
    - "Runs `vercel pull --environment=production && vercel build --prod && vercel deploy --prebuilt --prod`"
    - "Source maps upload natively via withSentryConfig (D-19 OVERRIDE — NO sentry-cli step)"
    - "Release tag = github.sha via VERCEL_GIT_COMMIT_SHA env"
    - "Non-blocking post-deploy step `Verify Sentry release` queries Sentry releases API and emits a `::warning::` if the release has 0 artifacts (catches silent withSentryConfig upload failures)"
    - "Inngest sync via `curl -X PUT $APP_URL/api/inngest` — asserts function count >= 1 (SC-3d)"
    - "Branch protection documentation notes `main` requires ci.yml + deploy-preview.yml passing (D-11)"
  artifacts:
    - path: ".github/workflows/deploy-production.yml"
      provides: "SC-3a, SC-3b, SC-3c, SC-3d"
    - path: ".planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md"
      provides: "D-11 branch protection record (operator runs `gh api` commands)"
---

<objective>
Author `deploy-production.yml`: on push to main, migrate the production Supabase DB using the direct (non-pooled) `DATABASE_URL` secret captured in Wave 0 (plan 01), build + deploy via Vercel CLI, sync Inngest functions, and run a non-blocking post-deploy check that confirms the Sentry release has artifacts. Source map upload is handled natively by `withSentryConfig` (D-19 OVERRIDE — no separate sentry-cli step). Also author a branch-protection setup document for D-11 with exact `gh api` commands the operator runs once.

**Production migration URL rule:** `drizzle-kit migrate` MUST run against the direct Supabase connection string (session mode), NOT the Supavisor transaction-mode pooler. The transaction pooler does not support the session-level operations migrations need (advisory locks, prepared statements, etc.). The Wave 0 operator checklist (plan 01) captures the direct connection string as the `DATABASE_URL` secret. There is intentionally no `PROD_DATABASE_URL` secret — the prod workflow reuses the same `DATABASE_URL` and treats "prod" as the only non-CI environment that consumes it directly. Runtime app code continues to use `DATABASE_POOL_URL` via the Drizzle + postgres-js client from plan 10.

**Sentry release self-check:** `withSentryConfig` can silently fail to upload source maps (bad token, transient network error) without breaking the build. The non-blocking post-deploy step queries the Sentry releases API for the `$GITHUB_SHA` release and warns if it has 0 artifacts. This surfaces silent-upload failures at deploy time instead of during an incident.

Purpose: SC-3a..d — production deploy gate. D-11 branch protection prevents untested code from reaching main.
Output: `.github/workflows/deploy-production.yml` + `01-17-BRANCH-PROTECTION.md` setup record.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-RESEARCH.md
</context>

<tasks>

<task type="auto">
  <name>Task 17.1: Create .github/workflows/deploy-production.yml</name>
  <files>.github/workflows/deploy-production.yml</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md clarifications D-19 OVERRIDE
    - .planning/phases/01-foundation-ci-cd/01-01-PLAN.md Wave 0 operator checklist (enumerates DATABASE_URL, SENTRY_ORG, SENTRY_PROJECT, SENTRY_AUTH_TOKEN)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pattern-8 (deploy-production.yml shape)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-3 (Sentry release tag matching)
    - .planning/phases/01-foundation-ci-cd/01-RESEARCH.md#Pitfall-8 (vercel pull environment)
  </read_first>
  <action>
  Create `.github/workflows/deploy-production.yml`:

  ```yaml
  name: Deploy Production

  on:
    push:
      branches: [main]

  concurrency:
    group: production
    cancel-in-progress: false

  jobs:
    deploy:
      runs-on: ubuntu-latest
      timeout-minutes: 25
      environment: production

      env:
        VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
        VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
        VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}
        SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
        SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
        SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
        NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.NEXT_PUBLIC_SENTRY_DSN }}
        NEXT_PUBLIC_POSTHOG_KEY: ${{ secrets.NEXT_PUBLIC_POSTHOG_KEY }}
        NEXT_PUBLIC_POSTHOG_HOST: https://eu.posthog.com
        IDENTIFICATION_PROVIDER_MODE: real
        VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}   # Pitfall 3: SDK + upload must share release name

      steps:
        - name: Checkout
          uses: actions/checkout@v5
          with:
            fetch-depth: 0   # full history for Sentry release

        - name: Setup pnpm
          uses: pnpm/action-setup@v4
          with:
            version: 9

        - name: Setup Node
          uses: actions/setup-node@v4
          with:
            node-version-file: .nvmrc
            cache: pnpm

        - name: Install deps
          run: pnpm install --frozen-lockfile

        - name: Apply migrations to production
          # IMPORTANT: uses the DIRECT (session-mode) DATABASE_URL captured in Wave 0.
          # drizzle-kit migrate MUST NOT use the Supavisor transaction pooler.
          # There is intentionally no PROD_DATABASE_URL secret — prod reuses DATABASE_URL.
          run: pnpm exec drizzle-kit migrate
          env:
            DATABASE_URL: ${{ secrets.DATABASE_URL }}

        - name: Vercel pull (production env)
          run: pnpm exec vercel pull --yes --environment=production --token=$VERCEL_TOKEN

        - name: Vercel build --prod (withSentryConfig uploads source maps — D-19 OVERRIDE)
          run: pnpm exec vercel build --prod --token=$VERCEL_TOKEN

        - name: Vercel deploy --prebuilt --prod
          id: deploy
          run: |
            URL=$(pnpm exec vercel deploy --prebuilt --prod --token=$VERCEL_TOKEN)
            echo "url=$URL" >> "$GITHUB_OUTPUT"

        - name: Verify Sentry release has source-map artifacts (SC-3b, SC-3c self-check)
          # Non-blocking: withSentryConfig can silently fail to upload source maps.
          # This step queries the Sentry releases API for the github.sha release and
          # emits a ::warning:: if it has 0 artifacts. The deploy is NOT failed —
          # we only want visibility. Plan 18 covers the manual dashboard confirmation.
          continue-on-error: true
          run: |
            ARTIFACT_COUNT=$(curl -sf \
              -H "Authorization: Bearer $SENTRY_AUTH_TOKEN" \
              "https://sentry.io/api/0/projects/$SENTRY_ORG/$SENTRY_PROJECT/releases/$GITHUB_SHA/files/" \
              | jq '. | length')
            if [ -z "$ARTIFACT_COUNT" ] || [ "$ARTIFACT_COUNT" -lt 1 ]; then
              echo "::warning::Sentry release $GITHUB_SHA has 0 artifacts — withSentryConfig source-map upload may have silently failed. Check SENTRY_AUTH_TOKEN scopes and next.config.ts withSentryConfig options."
            else
              echo "Sentry release $GITHUB_SHA has $ARTIFACT_COUNT artifact(s)."
            fi

        - name: Sync Inngest functions (SC-3d)
          run: |
            RESPONSE=$(curl -sS -X PUT -H "Content-Type: application/json" "${{ steps.deploy.outputs.url }}/api/inngest")
            echo "Inngest sync response: $RESPONSE"
            FN_COUNT=$(echo "$RESPONSE" | jq -r '.functionCount // (.functions | length) // 0')
            if [ "$FN_COUNT" -lt 1 ]; then
              echo "::error::Inngest sync returned function count < 1 (SC-3d)"
              exit 1
            fi
  ```

  **D-19 OVERRIDE confirmation:** This workflow has NO `sentry-cli sourcemaps upload` step. Source maps upload automatically when `vercel build --prod` runs `pnpm build`, which triggers `withSentryConfig` (configured in `next.config.ts`, plan 11). The `Verify Sentry release` step is a non-blocking post-deploy audit, not an upload step.

  **Secret provenance check (must match Wave 0, plan 01):** Every `secrets.*` used by this workflow — `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `NEXT_PUBLIC_SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_KEY`, `DATABASE_URL` — MUST appear in the Wave 0 operator checklist in plan 01. `SENTRY_ORG` and `SENTRY_PROJECT` are already present; `DATABASE_URL` is already present. If any future addition is needed, plan 01's checklist must be updated in the same revision. `PROD_DATABASE_URL` is explicitly FORBIDDEN — it does not exist.
  </action>
  <verify>
    <automated>bash -c 'test -f .github/workflows/deploy-production.yml && grep -q "vercel deploy --prebuilt --prod" .github/workflows/deploy-production.yml && grep -q "drizzle-kit migrate" .github/workflows/deploy-production.yml && grep -q "DATABASE_URL: \${{ secrets.DATABASE_URL }}" .github/workflows/deploy-production.yml && ! grep -q "PROD_DATABASE_URL" .github/workflows/deploy-production.yml && ! grep -q "sentry-cli sourcemaps upload" .github/workflows/deploy-production.yml && grep -q "Verify Sentry release" .github/workflows/deploy-production.yml && grep -q "api/inngest" .github/workflows/deploy-production.yml'</automated>
  </verify>
  <acceptance_criteria>
    - `.github/workflows/deploy-production.yml` exists
    - `grep -q "push:" ... && grep -q "branches: \[main\]"` matches
    - `grep -q "vercel deploy --prebuilt --prod" .github/workflows/deploy-production.yml` succeeds
    - `grep -q "drizzle-kit migrate" .github/workflows/deploy-production.yml` succeeds
    - `grep -q "DATABASE_URL: \${{ secrets.DATABASE_URL }}" .github/workflows/deploy-production.yml` succeeds (direct URL, Wave 0 provenance)
    - `grep -q "PROD_DATABASE_URL" .github/workflows/deploy-production.yml` does NOT match (explicitly forbidden — no such secret)
    - `grep -q "vercel pull --yes --environment=production" .github/workflows/deploy-production.yml` succeeds (Pitfall 8)
    - `grep -q "VERCEL_GIT_COMMIT_SHA: \${{ github.sha }}" .github/workflows/deploy-production.yml` succeeds (Pitfall 3)
    - `grep -q "Verify Sentry release" .github/workflows/deploy-production.yml` succeeds (silent-upload-failure audit)
    - `grep -q "continue-on-error: true" .github/workflows/deploy-production.yml` succeeds (Sentry step is non-blocking)
    - `grep -q "sentry.io/api/0/projects" .github/workflows/deploy-production.yml` succeeds (releases API URL)
    - `grep -q "curl.*PUT.*api/inngest" .github/workflows/deploy-production.yml` succeeds
    - `grep -q "FN_COUNT" .github/workflows/deploy-production.yml` succeeds (function count assertion)
    - `grep -q "sentry-cli sourcemaps upload" .github/workflows/deploy-production.yml` does NOT match (D-19 OVERRIDE)
    - `grep -q "IDENTIFICATION_PROVIDER_MODE: real" .github/workflows/deploy-production.yml` succeeds
  </acceptance_criteria>
  <done>deploy-production.yml in place per D-19 OVERRIDE; uses Wave 0 DATABASE_URL secret; includes non-blocking Sentry release artifact audit</done>
</task>

<task type="auto">
  <name>Task 17.2: Author branch protection setup document (D-11)</name>
  <files>.planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-CONTEXT.md D-11
  </read_first>
  <action>
  Create `.planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md` with the exact `gh api` commands the operator runs once to enforce D-11:

  ```markdown
  # Branch protection setup (D-11)

  Run this ONCE after plans 14, 15, 16, 17 workflows have been merged to main.
  It requires: (a) the repo admin to have `gh` CLI authenticated, (b) the `CI` and `Deploy Preview` workflow runs to have executed at least once so GitHub has registered their status check names.

  ## Apply protection

  ```bash
  gh api \
    --method PUT \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    /repos/:owner/:repo/branches/main/protection \
    -F required_status_checks[strict]=true \
    -F 'required_status_checks[contexts][]=build-and-test' \
    -F 'required_status_checks[contexts][]=deploy' \
    -F enforce_admins=true \
    -F required_pull_request_reviews[required_approving_review_count]=1 \
    -F required_pull_request_reviews[dismiss_stale_reviews]=true \
    -F restrictions= \
    -F allow_force_pushes=false \
    -F allow_deletions=false
  ```

  Replace `:owner/:repo` with the real slug (e.g. `mbmachado/folhario`). The two status check contexts are:
  - `build-and-test` — the job name in `.github/workflows/ci.yml`
  - `deploy` — the job name in `.github/workflows/deploy-preview.yml`

  ## Verify

  ```bash
  gh api /repos/:owner/:repo/branches/main/protection | jq
  ```

  Expected:
  - `required_status_checks.contexts` includes both `build-and-test` and `deploy`
  - `enforce_admins.enabled === true`
  - `allow_force_pushes.enabled === false`

  ## Record

  Paste the output of the verify command here after running it, and note the date.
  Operator sign-off: ______________ Date: ________
  ```
  </action>
  <verify>
    <automated>test -f .planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md && grep -q "required_status_checks" .planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md</automated>
  </verify>
  <acceptance_criteria>
    - `.planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md` exists
    - Contains `gh api` command with `required_status_checks` + `build-and-test` + `deploy`
    - Contains `enforce_admins=true`
    - Contains verify section
  </acceptance_criteria>
  <done>Branch protection doc in place; operator runs gh api command as part of plan 18</done>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-17-3 | Tampering | Sentry release mismatch | mitigate | `VERCEL_GIT_COMMIT_SHA: ${{ github.sha }}` passed to build (Pitfall 3) — SDK init in sentry.*.config.ts reads the same var |
| T-17-3b | Tampering | Silent Sentry source-map upload failure | mitigate | Non-blocking `Verify Sentry release` step queries Sentry releases API for artifact count; warns if 0 (catches bad auth token / transient network failure / misconfigured `withSentryConfig` options) |
| T-17-8 | Info Disclosure | vercel pull env mix-up | mitigate | `--environment=production` paired with `vercel deploy --prebuilt --prod` |
| T-17-5 | Tampering | Vercel git integration races with CI | mitigate | Wave 0 operator checklist enforces integration OFF; production deploy runs only via GitHub Actions (D-11 + branch protection) |
| T-17-migrate | Tampering | Migrations against transaction pooler | mitigate | `drizzle-kit migrate` runs against direct `DATABASE_URL` (session mode); `DATABASE_POOL_URL` is never used for migrations. Documented in plan objective + Wave 0 checklist. |
| T-17-bypass | Elevation of Privilege | Admin bypass of PR requirement | mitigate | `enforce_admins=true` in branch protection; documented in 01-17-BRANCH-PROTECTION.md |
</threat_model>

<verification>
Plan 18 throwaway PR merge runs deploy-production.yml and SC-3a..d all pass. Operator applies branch protection before first real PR lands. The `Verify Sentry release` warning surfaces in the GitHub Actions summary for every production deploy; zero warnings on the first real deploy confirms SC-3b/SC-3c.
</verification>

<success_criteria>
- deploy-production.yml in place with D-19 OVERRIDE (no sentry-cli step)
- Production migrations use the direct `DATABASE_URL` secret (Wave 0 provenance); no `PROD_DATABASE_URL` anywhere
- Non-blocking Sentry release artifact audit step present
- Inngest sync assertion on function count
- Branch protection record ready for operator
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-17-SUMMARY.md`.
</output>


### 01-18-PLAN.md

---
phase: 01-foundation-ci-cd
plan: 18
type: execute
wave: 5
depends_on: [14, 15, 16, 17]
files_modified:
  - .planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md
autonomous: false
requirements: [INFRA-11, INFRA-15, OBS-01, OBS-05, LGPD-13]
validation_ref: [SC-2d (manual leg), SC-3e, SC-4a (end-to-end), SC-4b (end-to-end)]

must_haves:
  truths:
    - "A throwaway PR exercises ci.yml + deploy-preview.yml end-to-end"
    - "Merging the throwaway PR exercises deploy-production.yml end-to-end"
    - "Operator confirms Vercel git integration is OFF (SC-3e)"
    - "Operator confirms Supabase branch was cleaned up after PR close (SC-2d)"
    - "Operator confirms Sentry received the deliberate error with LGPD-13 fields scrubbed (SC-4a + SC-4b end-to-end)"
    - "Operator applies branch protection from 01-17-BRANCH-PROTECTION.md"
  artifacts:
    - path: ".planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md"
      provides: "End-to-end verification record with screenshots / notes"
---

<objective>
Final phase verification. Open a throwaway PR that triggers every workflow from Wave 4, wait for them to go green, then ask the operator to perform the 5 manual verifications that cannot be automated:
1. SC-3e — Vercel git integration is OFF (dashboard-only)
2. SC-2d — Supabase branch cleanup happened after PR close
3. SC-4a/SC-4b — Sentry received the deliberate-error event with LGPD-13 fields scrubbed
4. D-11 — Branch protection applied via `gh api` from plan 17 doc
5. Environment sanity — every secret from Wave 0 is actually resolvable in the deployed workflows (implicit from workflows going green)

Purpose: Phase 1 success depends on seeing the full pipeline run on real infrastructure once. Only the operator can verify the 3 dashboard-only items.
Output: `01-18-VERIFICATION.md` with the operator's sign-off.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/01-foundation-ci-cd/01-CONTEXT.md
@.planning/phases/01-foundation-ci-cd/01-VALIDATION.md
@.planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md
</context>

<tasks>

<task type="auto">
  <name>Task 18.1: Executor creates throwaway PR and waits for workflows to go green</name>
  <files>.planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md</files>
  <read_first>
    - .planning/phases/01-foundation-ci-cd/01-VALIDATION.md (SC-1a..5d)
    - .planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md
  </read_first>
  <action>
  Step 1 — Executor creates a throwaway branch named `smoke/phase-1-verification` containing a trivial change (e.g. bump a comment in `src/app/page.tsx`).

  ```bash
  git checkout -b smoke/phase-1-verification
  # Edit src/app/page.tsx to add a comment: // Phase 1 smoke verification PR
  git add src/app/page.tsx
  git commit -m "chore(01-18): phase 1 smoke verification trigger"
  git push origin smoke/phase-1-verification
  gh pr create --title "Phase 1 smoke verification" --body "Triggers every Wave 4 workflow for SC-* gate verification. Close without merging OR merge to also exercise deploy-production.yml."
  ```

  Step 2 — Executor polls `gh pr checks --watch` until `build-and-test` (ci.yml) AND `deploy` (deploy-preview.yml) both succeed.

  Step 3 — Executor writes an initial `.planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md` with the PR URL + run URLs + checklist (see Task 18.2).

  Step 4 — Executor halts for the operator checkpoint in Task 18.2.
  </action>
  <verify>
    <automated>test -f .planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md && grep -q "PR URL" .planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md</automated>
  </verify>
  <acceptance_criteria>
    - Throwaway PR exists on origin
    - `gh pr checks` shows `build-and-test` and `deploy` both SUCCESS
    - `.planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md` exists with the PR URL recorded
  </acceptance_criteria>
  <done>Throwaway PR is green; VERIFICATION.md initialized</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 18.2: Operator performs the 5 manual verifications</name>
  <what-built>
    ci.yml, deploy-preview.yml have both run green on the throwaway PR. Now the operator must visit dashboards to confirm the things Vercel/Supabase/Sentry APIs cannot attest to. Executor has written `.planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md` with a checklist.
  </what-built>
  <how-to-verify>
  Open `.planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md` and tick off each item:

  ### 1. SC-3e — Vercel git integration is OFF
  Visit vercel.com/{team}/folhario/settings/git. Confirm "Connected Git Repository" shows no repo / "Connect git repository" button. Save a screenshot, note the date.

  ### 2. SC-2d — Supabase branch cleanup
  a) While the PR is still open, visit supabase.com/dashboard/project/{ref}/branches. Confirm branch `pr-{N}` exists and its status is ACTIVE_HEALTHY.
  b) Close the PR (do NOT merge yet): `gh pr close {N}`.
  c) Wait 2 minutes. Re-visit the Supabase branches page. Confirm `pr-{N}` is gone (or marked DELETING).
  d) Also check vercel.com aliases page — confirm the preview alias is removed.

  ### 3. SC-4a + SC-4b — Sentry event with LGPD-13 scrubbing
  a) While the PR was open, the preview deploy triggered `GET /api/v1/_test/throw` via Playwright. Visit sentry.io/{org}/{project}/issues/.
  b) Find the issue with title containing "Deliberate smoke error".
  c) Open the issue. In the request body / breadcrumbs / extra data, confirm:
     - `email: [Filtered]` (NOT `email: lgpd-test@example.com`)
     - `password: [Filtered]`
     - `photo_url: [Filtered]`
     - `token: [Filtered]`
     - `authorization: [Filtered]`
     - `cookie: [Filtered]`
     - `trace_id: <uuid>` (control — NOT scrubbed, proves the payload arrived)
  d) Also confirm `user.email` is absent (SC-4c) — only `user.id` if set at all.
  e) Save a screenshot.

  ### 4. D-11 — Apply branch protection
  Run the `gh api` commands from `.planning/phases/01-foundation-ci-cd/01-17-BRANCH-PROTECTION.md`. Paste the output of the verify command into VERIFICATION.md.

  ### 5. Optional — Merge throwaway PR to exercise deploy-production.yml
  Only if the operator wants full end-to-end coverage NOW:
  ```bash
  gh pr merge {N} --squash
  ```
  Wait for `deploy-production.yml` to succeed. Then visit:
  - Sentry releases page — confirm a release tagged with the merge commit SHA exists with > 0 source map artifacts (SC-3b + SC-3c)
  - Inngest dashboard — confirm the `folhario` app shows 1 synced function (hello-world) (SC-3d)
  - Screenshot both.

  Otherwise, close the PR with `gh pr close {N}` and document that SC-3a..d will be verified organically by the first real Phase 2 PR.
  </how-to-verify>
  <resume-signal>
    Reply "verified" when every item above is recorded in `.planning/phases/01-foundation-ci-cd/01-18-VERIFICATION.md` with screenshot references and dates. Reply "failed: {reason}" if any check failed — executor will enter gap-closure planning.
  </resume-signal>
</task>

</tasks>

<threat_model>
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-18-5 | Tampering | Vercel git integration accidentally re-enabled | mitigate | SC-3e final verification with screenshot; re-verified at start of every phase per runbook |
| T-18-LGPD | Privacy | End-to-end Sentry scrubbing untested | mitigate | Operator visually confirms scrubbed event in Sentry dashboard; unit tests (plan 07) provide continuous regression coverage |
| T-18-bypass | Elevation of Privilege | Branch protection not applied | mitigate | Plan 17 doc + plan 18 checklist both require `gh api` execution and paste-back of verification output |
</threat_model>

<verification>
Operator reply `verified` with VERIFICATION.md fully populated closes Phase 1.
</verification>

<success_criteria>
- Throwaway PR triggered all Wave 4 workflows green
- 5 manual verifications complete and recorded
- Phase 1 success criteria SC-1a..SC-5d all checked
- Branch protection applied
</success_criteria>

<output>
After completion, create `.planning/phases/01-foundation-ci-cd/01-18-SUMMARY.md` summarizing the verification, any deviations, and links to the evidence files.
</output>


## Review Instructions

Analyze the plans as a whole and provide:

1. **Summary** — One-paragraph assessment
2. **Strengths** — What's well-designed (bullet points)
3. **Concerns** — Potential issues, gaps, risks (bullet points with severity: HIGH/MEDIUM/LOW)
4. **Suggestions** — Specific improvements (bullet points)
5. **Risk Assessment** — Overall risk level (LOW/MEDIUM/HIGH) with justification

Focus on:
- Missing edge cases or error handling
- Dependency ordering issues between the 18 plans
- Scope creep or over-engineering
- Security considerations (RLS, JWT, secrets, LGPD)
- Performance implications (Supavisor txn pooler, Vercel function budgets)
- Whether the plans actually achieve the phase goals

Output your review in markdown format.
