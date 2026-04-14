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

<!-- Current scope. Building toward v1 MVP. All hypotheses until shipped. -->

- [ ] Email+password and Google OAuth signup with LGPD-compliant consent flow
- [ ] Email-verification gate for email+password accounts before any mutation
- [ ] Cloud plant identification via provider abstraction (Plant ID + OpenAI-compat fallback, top-3 results ranked by confidence)
- [ ] Per-user and per-provider cost caps enforced BEFORE provider dispatch (daily + period, DB-driven)
- [ ] LGPD consent gate for first-ever identification (Art. 33 international transfer disclosure)
- [ ] "Meu Jardim" catalog with plant profiles, photo journal, room/location picker, sort options
- [ ] Curated care-guide corpus (≥200 domestic species, pt-BR) shipped pre-launch
- [ ] Runtime AI-augmented care guides with persistent "Gerado por IA" badge (async, off critical path)
- [ ] Toxicity warnings with mandatory redundant signals (icon + color + text + striped border + SR alert + haptic)
- [ ] Watering and fertilization reminders with `from_scheduled`/`from_acted` advance rules
- [ ] Single daily push nudge per user (never per-reminder), permission deferred to first reminder creation
- [ ] Multi-device sync with per-device JWT and independent `PushSubscription` revocation
- [ ] Offline queue (photos, reminder-done, edits) with client-UUID idempotency and conflict resolution
- [ ] Stripe subscription (card + Pix), single monthly tier, 14-day organic / 30-day partner trial
- [ ] Read-only catalog mode when subscription not in trialing/active (no data held hostage)
- [ ] Stripe webhook handler (signature verify → BillingEvent insert → Inngest enqueue, idempotent on event_id)
- [ ] LGPD data export (JSON + original photos zip via signed URL)
- [ ] LGPD 7-day-grace account deletion using Inngest `step.sleepUntil`
- [ ] Per-consent revocation in Settings (never breaks catalog view access)
- [ ] Password reset (unauthed) and change password (authed)
- [ ] Partner code flow (signup + late-entry in Settings, strictly before `trial_end_date`)
- [ ] Age-gate ≥13 confirmation at signup (Art. 14)
- [ ] PWA shell with service worker, manifest, installable, app-update toast
- [ ] Image handling: client-side compression, EXIF/GPS stripping (defense in depth server reject)
- [ ] Design system — Folhário "Sunlit morning on a Brazilian veranda": Paper Cream + Canopy Green palette, Source Serif 4 + Plus Jakarta Sans, Lucide icons, light + dark variants, WCAG 2.1 AA
- [ ] Bottom-nav-only navigation (4 tabs: Home, Catálogo, Identificar, Perfil), tablet-width on desktop
- [ ] i18n layer from day one (pt-BR only at launch, no hardcoded strings)
- [ ] Testing: Vitest unit + real-Postgres integration + Playwright E2E against preview URL
- [ ] CI/CD via GitHub Actions with Supabase branch DBs per PR (Vercel git integration OFF)
- [ ] Observability: Sentry (PII-scrubbed) + PostHog EU + scheduled SQL rollups for ID quality

### Out of Scope

<!-- Explicit boundaries. Includes reasoning to prevent re-adding. -->

- Freemium tier — single paid tier is the business model; free users dilute the <2-min promise
- Native iOS/Android apps (MVP) — PWA ships first; native after validation. All decisions keep the native door open
- On-device / offline plant identification — cloud-only; latency + accuracy require real models
- Real-time chat / social — outside core loop (identify → catalog → care → remind)
- Anonymous accounts — trial requires a real account to tie subscription state
- Change-email flow — post-MVP, reduces credential-management surface for v1
- Logout-all-devices — post-MVP, per-device tokens are independently revocable already
- Editor review queue for augmented care guides — augmented guides go live immediately with persistent "Gerado por IA" badge; review queue adds latency without proven value
- Admin UI for caps/budgets — MVP tunes via direct DB writes; operator alert emails handle visibility
- Wide-screen desktop layouts — tablet-width on desktop, bg fill sides. Mobile-first is the shape
- Per-reminder notification times — all reminders fire at `User.notification_time_local`; per-reminder times add UX complexity without demand
- Travel-aware timezone handling — changing tz in Settings affects future computations only; traveling users aren't tending plants
- Suggestions/prompts to create reminders — user-initiated from plant profile only, no nagging
- Done/Snooze controls inside push payload — push is a nudge to open the app; Home is the source of truth
- GPS / location-based features — LGPD minimization, EXIF GPS stripped client-side
- Per-user storage limits — MVP, monitored later
- Stock photo empty states — all illustrations custom Sage line art
- Locales beyond pt-BR (MVP) — i18n layer built day one, but only pt-BR strings ship
- Emojis in UI copy — banned in brand guardrails; Lucide icons only
- Inter font and generic serifs — banned; Source Serif 4 + Plus Jakarta Sans only
- Freemium/onboarding tour dark patterns — banned
- Dark-mode-as-inverted-greyscale — dark palette is "veranda at dusk", hand-tuned

## Context

**Source of truth:** `docs/CAVE-PRD.md` (CAVE-PRD — Folhário MVP, dated 2026-04-12). That document merges PRD, acceptance criteria, behavior spec, data model, API contract, high-level design, screens, user flows, UX goals, accessibility, and design system. Every ambiguity is resolved there; anything not in the PRD is either open question (§25) or deferred.

**Greenfield repo.** No source code exists yet — only `.planning/`, `docs/`, and tooling configs. Working directory is `/Users/machado/Projects/folhario`.

**Hemisphere + locale:** Southern hemisphere, pt-BR only at launch, IANA timezones captured at signup.

**Domain background:**
- BR plant-parent beginners are the target. Voice is "knowledgeable friend, not textbook." No Latin without common name. No jargon.
- LGPD (Brazilian GDPR equivalent) is load-bearing: international-transfer consent (Art. 33), age-gate ≥13 (Art. 14), data rights (Art. 18), 7-day deletion grace, DPO (Encarregado) mandatory.
- Plant ID providers (Plant ID, OpenAI-compatible vision) are the identification backend; there is no editorial corpus we author. Curated care guides come from founder + PlantNet open data + RHS/Embrapa + LLM-assisted drafting.
- Toxicity data is safety-critical — redundant signals required. Disclaimer "Informação gerada por IA — confirme com um veterinário" always visible.

**Technical environment:**
- Next.js App Router + React + TS, App Router Route Handlers under `/api/v1`
- Supabase (Postgres via Supavisor txn pooler, Auth, Storage) with RLS as defense in depth
- Drizzle ORM inside repositories only (no Drizzle in handlers)
- Inngest for async, cron, and durable `step.sleepUntil` (used for 7-day deletion grace)
- Resend (transactional email, React Email templates)
- Sentry (errors + traces, source maps from CI, heavy PII scrubbing)
- PostHog EU cloud (product analytics)
- Vercel hosting, deploys from GitHub Actions ONLY (git integration disabled)
- Stripe (card + Pix), webhook signature verified + idempotent BillingEvent insert → Inngest async processing
- Web Push via `web-push` + VAPID, dispatched from Inngest
- Vitest unit + real-Postgres integration + Playwright E2E against preview URL

**Bounded contexts (DDD):** IAM, Catalog, Species & Care, Identification, Reminders, Billing, Notifications. Cross-context communication via Inngest events (async) or thin read-only query services (sync reads). Repo layout: `src/contexts/{context}/{domain,application,infrastructure,api,inngest}/` + `src/shared/{db,events,adapters,config,telemetry}/`.

**Voice & brand:** "Sunlit morning on a Brazilian veranda." Warm, humanist, tactile. Photography-first (user's plant photos are hero). NOT clinical, NOT minty wellness, NEVER textbook. Paper Cream + Canopy Green. Source Serif 4 + Plus Jakarta Sans. Lucide icons, 1.5px stroke, rounded caps. Spring-physics motion, not easing curves. One perpetual micro-interaction in the whole app (empty-home capture button breathing loop).

**Non-negotiables** (from PRD §1):
1. Value <2 min from email verification (the core promise)
2. Toxicity warnings always redundant + disclaimed
3. Honest AI (show confidence %, mark augmented guides)
4. i18n day one (no hardcoded strings, pt-BR only ships)
5. Never hold data hostage (read-only catalog mode)
6. Push permission ONLY on first reminder creation
7. Cap-hit + provider-unavailable always offer manual entry
8. Mobile-first PWA, tablet-width on desktop
9. WCAG 2.1 AA = ship blocker

## Constraints

- **Tech stack**: Next.js App Router + React + TS + PWA — Single codebase for web/PWA now, native later; same repo houses frontend and API route handlers
- **Tech stack**: Supabase (Postgres + Auth + Storage) with Drizzle ORM in repositories only — RLS as defense in depth, adapters allow future swap
- **Tech stack**: Inngest for all async work — events, cron, durable sleep (7-day grace). No raw cron, no BullMQ
- **Tech stack**: Vercel + GitHub Actions only — Vercel git integration DISABLED so tests/migrations/deploys share one pipeline
- **Locale**: pt-BR only at launch — i18n layer mandatory day one, but only pt-BR strings ship
- **Platform**: Mobile-first PWA, tablet-width on desktop (bg fills sides) — No wide-screen design, bottom-nav only, max 5 tabs (MVP uses 4)
- **Accessibility**: WCAG 2.1 AA = ship blocker — Every state combines redundant cues, color never sole signal, focus ring global 3px, `prefers-reduced-motion` honored
- **Compliance (LGPD)**: DPO appointed + privacy policy published before first identification — Art. 33 consent before first upload, Art. 18 data rights, 7-day deletion grace, ANPD breach notification
- **Performance**: Vercel function budgets for identification — total wall-clock 50s, per-call cap 30s, fallover requires ≥10s remaining budget
- **Performance**: Images compressed client-side to ≤1MB, EXIF/GPS stripped client-side (server rejects GPS-bearing uploads as defense in depth)
- **Budget**: Per-provider daily cost ceilings enforced in DB + atomic counters — default $5/day each for Plant ID + OpenAI-compat; operator alert email at 80%
- **Content**: ≥200 curated care guides shipped before MVP launch (founder-owned, LAUNCH BLOCKER)
- **Payments**: Single monthly tier, Stripe (card + Pix), 14-day organic / 30-day partner trial — Pricing TBD is a LAUNCH BLOCKER
- **Security**: Per-device JWT, no server sessions, narrow per-IP throttle on public auth endpoints — only place `rate_limited` 429 is emitted in MVP
- **Data**: Timestamps ISO-8601 UTC with `Z`; exception: `User.notification_time_local` as `HH:MM` in `User.timezone` — `next_due_at` computed at create/advance, not at fire time

## Key Decisions

<!-- Decisions locked in by the PRD. Add new decisions throughout lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA first, native later | Faster to ship, cheaper, installable on both platforms. Every architectural decision keeps the native door open (provider abstraction, per-device tokens, offline queue, IANA timezones). | — Pending |
| Single paid tier, no freemium | Freemium dilutes the <2-min-to-value promise and pays the LGPD + provider-cost bill without recovery. 14/30-day trial provides try-before-buy. | — Pending |
| Cloud-only plant identification | Accuracy + latency of on-device models don't hit beginner expectations. Provider abstraction allows swap. | — Pending |
| DDD bounded contexts with Inngest events | Keeps cross-context coupling async; read models stay thin query services; enables future context-level splitting. | — Pending |
| Inngest `step.sleepUntil` for 7-day deletion grace | Durable, no cron scanning, simpler failure semantics than DB-polling jobs. | — Pending |
| Provider abstractions for identification, care-guide augmentation, billing | Allows swap (Pagar.me/Iugu for billing, alternate ID providers) without touching business logic. | — Pending |
| pt-BR only at launch (with i18n layer day one) | Brazilian beginner audience is the wedge; multi-locale is scope creep. i18n layer is cheap if built day one, expensive if retrofitted. | — Pending |
| Email-verification gate on email+password accounts | Anti-spam + the <2-min clock starts at verification (not signup) so the first-value metric is honest. | — Pending |
| Push permission deferred to first reminder creation | Users who never create a reminder never see a permission prompt. Prevents the "signup → immediate permission denial" trap that kills later prompts. | — Pending |
| Augmented care guides go live immediately, permanent "Gerado por IA" badge | Editor review queue would block value. Persistent badge keeps AI provenance honest. | — Pending |
| Stripe webhook = insert BillingEvent then enqueue Inngest | Signature verify + unique `event_id` constraint gives idempotency; heavy state transitions run async and can be retried safely. | — Pending |
| Vercel git integration OFF, deploys from GitHub Actions only | One pipeline owns tests, migrations, and deploy. No "deployed without CI" class of bugs. | — Pending |
| Real-Postgres integration tests (no DB mocking) | Mocks hide schema, migration, and query bugs. Ephemeral Supabase branch DBs make this cheap. | — Pending |
| Tablet-width on desktop with bottom nav (no sidebar) | Folhário is ONE shape across devices. Mobile first, desktop is just centered tablet. No wide-screen design debt. | — Pending |
| Toxicity: icon + color + text + striped border + SR alert + haptic | Color alone is a WCAG fail and a safety fail. Redundant signals are the only approved treatment. | — Pending |
| Honey Amber / Terracotta / Urgent Poppy / Overdue Rust / Trust Teal as SEMANTIC signals only | Accent discipline keeps Canopy Green as the brand anchor; prevents slide into "just to add warmth" color slop. | — Pending |
| Daily nudge push is ONE per user-day, never per-reminder | Prevents permission-withdrawal spiral. Home is the source of truth; push is a nudge to open the app. | — Pending |
| Never hold data hostage: read-only catalog mode on billing lapse | View access preserved (plants, photos, journal, care guides), only mutations + identification blocked. Ethical baseline + churn softener. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-14 after initialization from `docs/CAVE-PRD.md`*
