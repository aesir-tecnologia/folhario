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

**Launch blockers (tracked separately in PRD §24):**
1. Subscription pricing (BRL monthly) — required before Stripe live mode
2. NFS-e (Brazilian service-invoice) issuance strategy — Stripe does not issue these; decide third-party integration or manual pre-launch
3. DPO (Encarregado) appointment — contact published in privacy policy + Settings before first identification
4. Privacy policy + ToS authoring and publication — before consent flow ships
5. ≥200 curated care guides — founder-owned corpus

## Constraints

- **Tech stack**: Next.js 16 App Router + React 19 + TS, PWA via `@serwist/next` — Single codebase for web/PWA now, native later; route handlers under `/api/v1` in same deploy.
- **Tech stack**: Supabase Postgres via Supavisor transaction-mode pooler, Drizzle ORM inside repositories only, `postgres-js` driver with `{ prepare: false }` mandatory — RLS as defense in depth; adapters keep auth/storage swappable.
- **Tech stack**: Inngest for all async work — events, cron, durable `step.sleepUntil` — no raw cron, no BullMQ. Free-tier `sleepUntil` cap is 7 days (exact size of LGPD deletion grace window); upgrade if budget allows headroom.
- **Tech stack**: Vercel hosting, deploys from GitHub Actions ONLY. Vercel git integration DISABLED so tests, migrations, and deploys share one pipeline. Preview env per PR with Supabase branch DB.
- **Locale**: pt-BR only at launch — `next-intl` mandatory day one, `<html lang="pt-BR">`, `date-fns-tz` for server-rendered user-local times, numbers/currency via `Intl.*` with `pt-BR` (`R$ 29,90`, `dd/MM/yyyy`, 24h).
- **Platform**: Mobile-first PWA, tablet-width centered on desktop (bg fills sides). No wide-screen design. Bottom-nav only, max 5 tabs (MVP uses 4).
- **Accessibility**: WCAG 2.1 AA = ship blocker — every state combines redundant cues, color never sole signal, focus ring global 3px Canopy @ 40% opacity offset 2px, `prefers-reduced-motion` honored, reading order matches visual order.
- **Compliance (LGPD)**: DPO appointed + privacy policy published before first identification — Art. 33 consent before first upload, Art. 18 data rights (export, correction, deletion, portability, consent revocation), 7-day deletion grace via Inngest durable sleep, ANPD breach notification within Art. 48 timeframes.
- **Performance**: Vercel function budgets for identification — total wall-clock 50s, per-call cap 30s, fallover requires ≥10s remaining budget, else short-circuit `provider_unavailable`.
- **Performance**: Images compressed client-side to ≤1MB, EXIF/GPS stripped client-side (server rejects GPS-bearing uploads as defense in depth `validation_failed`).
- **Budget**: Per-provider daily cost ceilings enforced in DB + atomic counters — default USD 5/day each for Plant ID + OpenAI-compat; operator alert email via Resend at 80%. Cap check executes BEFORE any `ProviderUsageCounter` increment or provider call.
- **Content**: ≥200 curated care guides shipped before MVP launch (founder-owned, LAUNCH BLOCKER).
- **Payments**: Single monthly tier, Stripe (card + Pix), 14-day organic / 30-day partner trial — Pricing TBD is a LAUNCH BLOCKER. `BillingProvider` adapter allows future swap to Pagar.me / Mercado Pago / Iugu.
- **Security**: Per-device JWT, no server sessions, narrow per-IP throttle on public auth endpoints — only place `rate_limited` 429 is emitted in MVP. Standard security headers via Next.js middleware. RLS on all user-owned tables, service-role key server-side only.
- **Data**: Timestamps ISO-8601 UTC with `Z`; exception: `User.notification_time_local` as `HH:MM` in `User.timezone`. `next_due_at` computed at create/advance, not at fire time.
- **Error codes**: Closed registry in PRD §5 — no ad-hoc error codes. `cost_ceiling_reached` and `breaker_open` are INTERNAL-only and surface as `provider_unavailable` to clients.
- **Observability**: Sentry (release = git SHA, source maps uploaded post-build from CI because Turbopack requires it), PostHog EU cloud (LGPD residency), SQL rollups via Inngest cron for identification quality metrics. `Sentry.setUser({ id })` only — never email.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next 16 App Router + Serwist (not next-pwa) | `next-pwa` abandoned; Serwist is the official successor referenced in Next.js PWA guide | — Pending |
| Drizzle ORM (not Prisma) + `postgres-js` + `{ prepare: false }` | Cold-start weight + Supavisor txn-pooler friction disqualify Prisma; prepared statements break with pooled connections | — Pending |
| Inngest (not Trigger.dev / raw cron / BullMQ) | First-class Vercel integration, mature durable `sleepUntil` for 7d LGPD grace, simple mental model | — Pending |
| Stripe (card + Pix) behind `BillingProvider` adapter | Start with Stripe for DX and Pix Automático support, keep option to swap to Pagar.me/Mercado Pago if NFS-e integration forces it | — Pending |
| Plant ID primary + OpenAI-compat fallback (not PlantNet / vision-LLM only) | Kindwise benchmark: Plant.id top-1 error 12% vs vision-LLM 58%. Gap is load-bearing for <2-min promise. | — Pending |
| Single daily nudge push (not per-reminder) | Respects user attention; Home screen is source of truth; simplifies multi-device fanout; self-healing on 410/404 | — Pending |
| Email verification gate before first identification | The "value <2 min" clock starts at verification, not signup. Keeps consent + LGPD gates coherent. | — Pending |
| Push permission deferred to first reminder creation | Never at signup, first visit, or first identify — non-negotiable from PRD §1 | — Pending |
| Per-user caps + per-provider ceilings + circuit breaker, DB-tunable | Runtime-tunable without redeploy; atomic counters prevent lost writes; breakers isolate bad providers | — Pending |
| Bounded contexts with Inngest events for async | DDD-lite; cross-context reads via thin query services only; each context owns its aggregates | — Pending |
| Real Postgres for integration tests (no DB mocking) | Mocks mask schema/migration/query bugs; dedicated test DB per run, migrations applied as in production | — Pending |
| pt-BR locale via `next-intl` day one | Even though only pt-BR ships, i18n layer is mandatory — no hardcoded strings | — Pending |
| Veranda-at-dusk dark mode (not inverted greyscale) | Design discipline — palette designed in both modes from scratch | — Pending |
| Bottom-nav only, asymmetric hero, Source Serif 4 + Plus Jakarta Sans | Anti-generic brand identity; humanist pt-BR diacritic rendering; banned: Inter, generic serifs, gradient text, glass/neuro-morphism | — Pending |
| Vercel git integration OFF, all deploys from GitHub Actions | Tests + migrations + deploys share one pipeline — no split-brain | — Pending |

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
*Last updated: 2026-04-14 after initialization from docs/CAVE-PRD.md*
