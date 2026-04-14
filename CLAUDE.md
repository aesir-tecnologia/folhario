<!-- GSD:project-start source:PROJECT.md -->
## Project

**Folhário**

Folhário is a plant identification, care-guide, and reminder PWA for Brazilian beginners who just bought their first plant and don't want to kill it. Users snap a photo, the app identifies the plant using cloud AI, files it in their personal catalog ("Meu Jardim"), shows a pt-BR care guide, and nudges them when it's time to water. Mobile-first PWA at launch, with every architectural decision kept native-compatible for a future app build.

**Core Value:** **A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.**

Reminders are the retention engine; without the <2-min first-value moment there's no retention to engineer.

### Constraints

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
<!-- GSD:project-end -->

<!-- GSD:stack-start source:STACK.md -->
## Technology Stack

Technology stack not yet documented. Will populate after codebase mapping or first phase.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
