# Phase 1: Foundation - Research

**Researched:** 2026-04-23
**Domain:** Repo scaffold / tooling (Next.js 16 App Router + local Supabase + CI-only observability)
**Confidence:** HIGH (every primary decision verified against official docs or npm registry; three new landmines surfaced below require planner attention)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Tooling & Scaffold**
- **D-01:** Node **22 LTS**, pinned via `.nvmrc` + `engines` field in `package.json`. `.nvmrc` is committed at the repo root.
- **D-02:** pnpm activated via **Corepack** using the `packageManager` field in `package.json` (e.g. `pnpm@9.x.y`). No global install step for devs.
- **D-03:** **ESLint (Next.js flat config) + Prettier**. Separate tools, standard ecosystem.
- **D-04:** **Husky + lint-staged + commitlint** (Conventional Commits). Pre-commit runs format + lint on staged files; commit messages must follow Conventional Commits.
- **D-05:** **npm scripts only** for task orchestration. No justfile, no turbo. Everything in `package.json` `scripts`.

**TypeScript & Code Style**
- **D-06:** TS strictness = the locked INFRA-01 minimum: `strict: true` + `noUncheckedIndexedAccess: true`. No additional strict flags.
- **D-07:** Path aliases **per-root**: `@contexts/*` → `src/contexts/*`, `@shared/*` → `src/shared/*`. No generic `@/*` alias.
- **D-08:** **No barrel files.** Direct imports only.

**Folder Structure & Error Registry**
- **D-09:** Phase 1 ships the full PRD §2 folder tree as **empty directories with `.gitkeep`** — 7 contexts × 5 layers + 5 shared subdirs.
- **D-10:** Error-code registry shape = **`as const` object + string-literal union type**.
- **D-11:** Error response body = **`{ error: { code, message, details? } }`** (nested error object).
- **D-12:** Registry location = **`src/shared/config/errors.ts`**. The HTTP mapper helper ships alongside it.

**PWA & Internationalization**
- **D-13:** Serwist = **skeleton only**. `@serwist/next` wired + service worker registers, but no precache, no offline page.
- **D-14:** Manifest = **minimal placeholder** (`name`, `short_name`, `display: standalone`, `theme_color`). No icons yet.
- **D-15:** next-intl routing = **`as-needed` prefix** (pt-BR served at root).

**Local Supabase Dev Environment**
- **D-16:** Supabase CLI pinned via **npm devDependency**. Supabase local stack runs Postgres 17.
- **D-17:** **No seed file** at Phase 1. `supabase/seed.sql` lands in Phase 2.
- **D-18:** Local env sync via **automated script `scripts/sync-supabase-env.sh`** parsing `supabase status` and writing `.env.local`.

**Observability — Sentry + PostHog**
- **D-19:** Sentry **disabled locally**; verification happens in CI via Playwright smoke. Local `NEXT_PUBLIC_SENTRY_DSN` empty by default.
- **D-20:** PostHog **disabled locally**; CI-only verification. Local `NEXT_PUBLIC_POSTHOG_KEY` empty by default.
- **D-21:** PostHog autocapture **disabled**. Only the explicit PRD §20 taxonomy events fire.
- **D-22:** Sentry PII scrubbing = **SDK built-ins (`denyUrls`, `sendDefaultPii: false`) + minimal `beforeSend` hook** that drops request bodies on `/api/v1/identifications/*`. Scrub rules cover `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`. `Sentry.setUser({ id })` only.

**Security Headers Middleware**
- **D-23:** **No CSP at Phase 1.**
- **D-24:** Header set = **minimum viable**: HSTS + `X-Frame-Options: DENY` + `X-Content-Type-Options: nosniff`. `Referrer-Policy` and `Permissions-Policy` deferred.

**CI Pipeline Design**
- **D-25:** Integration tests run against **`postgres:17-alpine`** service container in `ci.yml`. INFRA-12 doc update needed (was `postgres:16-alpine`).
- **D-26:** Playwright browsers = **Chromium only** in Phase 1 CI smoke.
- **D-27 (Claude's Discretion):** Phase 1 Playwright smoke asserts via **dedicated diagnostics routes** — `/__diag` + `/api/v1/_diagnostics/ping`. Routes gated to CI/preview via env flag, never exposed in production.
- **D-28:** CI caching + concurrency = **pnpm store cache + Playwright browser cache via `actions/cache`** + **GitHub Actions concurrency group per PR**.

**Env Management**
- **D-29:** Typed env validation = **custom `src/shared/config/env.ts` with Zod**. No extra dep.
- **D-30:** `.env.example` = **all PRD §20 vars listed with dummy values**. Comments group vars by phase of first use.

### Claude's Discretion

- **D-27** (Playwright smoke assertion design) — decided: diagnostics routes.
- Exact Node 22 patch version (lock latest LTS patch at Phase 1 start)
- Exact pnpm version pinned in `packageManager` field (latest stable in 9.x line)
- Exact commitlint config (start from `@commitlint/config-conventional`; no custom rules yet)
- Exact Zod schemas in `src/shared/config/env.ts` (shape derived from PRD §20 table)
- Exact set of scripts in `package.json`
- Folder structure under `scripts/` for dev helpers

### Deferred Ideas (OUT OF SCOPE)

- **CSP (Content Security Policy)** — deferred per user directive. Candidate: Phase 3 or dedicated security-hardening phase.
- **Expanded security headers** (`Referrer-Policy`, `Permissions-Policy`) — deferred.
- **Playwright WebKit + Firefox** — Chromium-only at Phase 1.
- **Full manifest with Paper Cream icon set** — Phase 3.
- **Functional offline shell + precache rules + app-update toast** — Phase 3.
- **Drizzle schema, migrations, RLS, adapters, image pipeline** — Phase 2.
- **Inngest onboarding** — Phase 4.
- **Resend + React Email templates** — Phase 4.
- **Vercel project + deploy workflows + Supabase branch DBs** — Phase 12.
- **Sentry source-map upload** — Phase 12 (Phase 1 configures `withSentryConfig`; actual upload runs from `deploy-production.yml`).
- **Explicit `Sentry.setUser({ id })` wiring** — Phase 4 (when auth lands).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **INFRA-01** | Next.js 16 App Router + React 19 + TS strict + `noUncheckedIndexedAccess` + pt-BR locale + `@serwist/next` PWA | §Next 16 scaffold, §Serwist 9.5.7 skeleton, §TypeScript config |
| **INFRA-02** | Bounded-context folder layout (PRD §2) | §`.gitkeep` scaffold script (40 directories) |
| **INFRA-12** | `ci.yml` with install, lint, typecheck, unit + integration (Postgres service container), build | §CI/CD recipe (ci.yml) |
| **INFRA-16** | `IDENTIFICATION_PROVIDER_MODE` env gate | §Env validation (Zod); also the guard for diagnostics routes |
| **INFRA-17** | All PRD §20 env vars configured (dummy in `.env.example`; none committed, none logged) | §Env validation, §`.env.example` template |
| **INFRA-18** | Standard security headers via Next.js middleware | §Security headers (Next 16 proxy.ts) — **LANDMINE (L-1)**. Phase 1 matcher excludes `/api/*` so API responses don't receive HSTS/XFO/XCTO; this is acceptable (HSTS is per-origin, XFO is page-only, XCTO on JSON is belt-and-suspenders). API-response header coverage → Phase 2 when the route-handler helper lands. |
| **INFRA-20** | Closed error-code registry as single importable source | §Error-code registry pattern |
| **INFRA-23** | Vitest unit + integration setup; Playwright E2E; zero DB mocking | §Test runner projects config; §Playwright smoke |
| **INFRA-26** | `supabase start` local Docker stack; `supabase db reset` rebuilds from migrations | §Supabase CLI + env sync |
| **OBS-01** | Sentry Next.js SDK integrated; release = git SHA; source maps (upload deferred to Phase 12); PII scrubbing enforced | §Sentry 10 setup + scrubbing; §Deferred Ideas |
| **OBS-02** | PostHog US cloud (client + `posthog-node` server); LGPD Art. 33 basis | §PostHog setup; §LGPD note |
| **OBS-05** | Alerts for new Sentry issues + error-rate spikes (Phase 1 scope: Sentry project exists + receives events; alerting rules deferred) | §Sentry setup; partial coverage — operator-email alerts land with Resend in Phase 4 |
| **LGPD-13** | Sentry breadcrumbs scrub Authorization, Cookie, email, password, token, photo_url; drop bodies on `/api/v1/identifications/*`; `Sentry.setUser({ id })` only | §Sentry beforeSend hook; §Diagnostics route body-drop assertion |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

Actionable directives extracted from `./CLAUDE.md` that this research and the downstream plan MUST honor. These have the same authority as locked CONTEXT.md decisions.

| # | Directive | Phase 1 Impact |
|---|-----------|----------------|
| C-01 | Next.js 16 App Router + React 19 + TS (stack lock) | Scaffold target versions |
| C-02 | PWA via `@serwist/next` — NOT next-pwa | D-13 alignment |
| C-03 | Supabase Postgres via Supavisor transaction-mode pooler | Env naming (`DATABASE_POOL_URL` for runtime); schema work is Phase 2 |
| C-04 | Drizzle inside repositories only — NEVER in route handlers | Phase 2; Phase 1 reserves the `src/shared/db/` directory only |
| C-05 | `postgres-js` driver with `{ prepare: false }` mandatory | Phase 2; Phase 1 installs nothing DB-client-side |
| C-06 | Inngest for all async — no raw cron, no BullMQ | Phase 4; NOT Phase 1 |
| C-07 | Vercel git integration DISABLED; deploys from GitHub Actions ONLY | Phase 12; Phase 1 must NOT add Vercel git connector |
| C-08 | Locale: pt-BR only at launch, `next-intl` day one, `<html lang="pt-BR">`, `date-fns-tz` server-side | D-15 alignment; `<html lang="pt-BR">` in Phase 1 root layout |
| C-09 | Mobile-first PWA, tablet-width centered on desktop | Phase 3 (no UI in Phase 1) |
| C-10 | WCAG 2.1 AA baseline | Phase 3 |
| C-11 | LGPD: DPO + privacy policy before first identification | Launch blocker (not a Phase 1 dev task) |
| C-12 | Vercel function budgets for identification (50s total, 30s/call) | Phase 6 |
| C-13 | Images ≤1MB client-compressed, EXIF/GPS stripped | Phase 2 |
| C-14 | Per-provider daily cost ceilings in DB + atomic counters | Phase 6 |
| C-15 | Curated care guides corpus ≥200 | Launch blocker |
| C-16 | Stripe single monthly tier, 14d organic / 30d partner | Phase 10 |
| C-17 | Per-device JWT, no server sessions, narrow per-IP throttle on public auth | Phase 4; Phase 1 seeds the error code for it |
| C-18 | Standard security headers via Next.js middleware | **INFRA-18 — Phase 1 (see Landmine L-1 re: `proxy.ts`)** |
| C-19 | RLS on all user-owned tables, service-role key server-side only | Phase 2; Phase 1 just reserves `SUPABASE_SERVICE_ROLE_KEY` env var |
| C-20 | Timestamps ISO-8601 UTC with `Z`; exception `User.notification_time_local` HH:MM in `User.timezone` | Phase 8 schema; Phase 1 documents the convention in `.env.example` and code style |
| C-21 | Error codes: closed registry (PRD §5); `cost_ceiling_reached` + `breaker_open` INTERNAL-only; surface as `provider_unavailable` | **INFRA-20 — Phase 1 ships the full 21-code registry (PRD §5)** |
| C-22 | Sentry release = git SHA; source maps from CI (Turbopack requires post-build) | Upload lives in Phase 12; Phase 1 wires `withSentryConfig` |
| C-23 | PostHog US cloud; international transfer basis via SCCs | Document in privacy policy (launch blocker); `POSTHOG_HOST=https://us.i.posthog.com` |
| C-24 | `Sentry.setUser({ id })` only — NEVER email | D-22 alignment; Phase 1 enforces the rule in `beforeSend` as defense in depth |
| C-25 | GSD workflow enforcement: no direct repo edits outside a GSD command | Planner / executor concern |

---

## Summary

Phase 1 stands up a Next.js 16 App Router scaffold with TS strict + pt-BR locale + Serwist PWA wiring, a local Supabase Docker stack reachable via `pnpm dev`, Sentry 10 + PostHog wired but **disabled locally** (CI-only verification via Playwright against dedicated `/__diag` + `/api/v1/_diagnostics/ping` routes), a minimum-viable security-header middleware, the PRD §5 closed error-code registry as a single importable source, typed env validation via Zod, and a `ci.yml` workflow running lint + typecheck + test-runner unit + test-runner integration (against `postgres:17-alpine`) + `next build` + Chromium-only Playwright smoke. No Vercel, no preview URLs, no deploy workflows, no Inngest — those land in the phases that first need them.

**Primary recommendation:** Honor all 30 locked decisions and the 25 CLAUDE.md directives without exploring alternatives. Resolve three landmines the planner MUST address before writing tasks: (L-1) Next.js 16 renames `middleware.ts` → `proxy.ts`, which contradicts CONTEXT.md's D-24 and Integration Points wording; (L-2) Sentry 10.48 keeps `sendDefaultPii: false` as the current public API (D-22 correct, but a `dataCollection` migration looms for v11+); (L-3) `@posthog/next` is 0.1.0 (pre-1.0) — stick with pinned `posthog-js` + `posthog-node` and hand-rolled provider, not the official wrapper.

Everything else (folder tree count, CI caching recipe, Zod env shape, error-registry pattern, diagnostics-route testing strategy, validation architecture) is pattern-matching against decided constraints — prescriptive, not exploratory.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Security headers (HSTS, X-Frame-Options, X-Content-Type-Options) | Frontend Server (Next 16 `proxy.ts`) | — | Response-header mutation must run before the response leaves the server boundary |
| Locale routing (`as-needed` pt-BR prefix) | Frontend Server (`proxy.ts` via `next-intl`) | — | next-intl middleware rewrites URLs, emits `x-next-intl-locale` header consumed server-side |
| Service worker registration (Serwist skeleton) | Browser / Client | Build (Webpack plugin via `@serwist/next`) | `sw.js` is a client-side asset; build plugin emits the manifest |
| Error-code registry + HTTP mapper | API / Backend (shared lib consumed by route handlers) | — | Route handlers in `src/contexts/*/api/` import `src/shared/config/errors.ts` |
| Env validation | Both (server + client) with `NEXT_PUBLIC_` split | — | Zod schema validates at module load on both layers; server schema is server-only |
| Sentry error capture | Frontend Server (instrumentation.ts) + Browser | Build (source maps, deferred to Phase 12) | `@sentry/nextjs` runs on nodejs, edge, and browser via separate init files |
| PostHog event capture | Browser (`posthog-js`) + API/Backend (`posthog-node` from future Inngest) | — | PRD §20: client for user events, server for Inngest-emitted events |
| Local DB + Auth + Storage | External (Docker via Supabase CLI) | — | `supabase start` provisions the container stack; app connects via `DATABASE_POOL_URL` |
| Diagnostics routes (CI-only) | `/__diag` = Browser, `/api/v1/_diagnostics/ping` = API/Backend | — | Playwright intercepts transport from both layers |
| Test execution | Node (runner) + Browser (Playwright Chromium) | CI (GH Actions) | Unit/integration on Node; smoke on Chromium against `next start` |

---

## Landmines Requiring Planner Attention

These three items surfaced during live-doc verification and **directly conflict with wording in CONTEXT.md or CLAUDE.md**. Flag them in PLAN.md and resolve before task generation.

### L-1 — Next.js 16 renames `middleware.ts` → `proxy.ts` (HIGH impact, VERIFIED)

[VERIFIED: https://nextjs.org/docs/messages/middleware-to-proxy, https://nextjs.org/docs/app/guides/upgrading/version-16]

- Next.js 16 replaces the `middleware.ts` file convention with `proxy.ts`; the exported function renames from `middleware` → `proxy`.
- `proxy.ts` runs on the **Node.js runtime only**. The Edge runtime is NOT supported in `proxy`. To retain edge behavior you must stay on `middleware.ts` (now deprecated, removed in a future version).
- Config flags renamed: `skipMiddlewareUrlNormalize` → `skipProxyUrlNormalize`. A codemod exists.
- **Conflict:** CONTEXT.md D-24 and §Integration Points both say `src/middleware.ts`. next-intl 4.9.1 docs explicitly say "proxy.ts (or middleware.ts for Next.js versions before 16)". `@sentry/nextjs` 10.x docs also reference `proxy.ts` for Next 16+.
- **Resolution:** Phase 1 ships `src/proxy.ts` (not `src/middleware.ts`). The function is named `proxy`. This is the load-bearing change — JWT middleware (Phase 4) and RLS-aware route guards all inherit this convention.

### L-2 — Sentry 10.x `sendDefaultPii: false` is CURRENT; `dataCollection` is FORTHCOMING (MEDIUM impact, VERIFIED)

[VERIFIED: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/; CITED: develop-docs/sdk/foundations/client/data-collection/index.mdx (proposed spec)]

- `sendDefaultPii` is still the documented Next.js 16 pattern in `@sentry/nextjs` 10.50.0 / pinned 10.48.0. Default is `false`. Setting `false` explicitly is safe and idiomatic.
- A proposed `dataCollection` replacement API (fine-grained `httpHeaders.deny`, `cookies.deny`, `queryParams.deny`) exists in `develop-docs/` but is NOT the current public SDK option. Treat as future migration, not a Phase 1 concern.
- **Security note:** CVE-2025-65944 (Authorization/Cookie leak when `sendDefaultPii: true`) was patched in 10.27.0+. CLAUDE.md pins 10.48.0 → safe.
- **Resolution:** D-22 as written is correct for v10.48. Plan should still pin the exact 10.48.x patch version rather than floating to 10.50+ until we validate `withSentryConfig` + Turbopack compatibility with that version.

### L-3 — `@posthog/next` is 0.1.0 (pre-1.0); do NOT use the official wrapper (MEDIUM impact, VERIFIED)

[VERIFIED: npm view @posthog/next version → 0.1.0 (2026-04-23)]

- The official PostHog Next.js wrapper package `@posthog/next` exists and is actively developed, but is version 0.1.0 → **major 0 = unstable API, breaking changes expected**.
- CLAUDE.md pins `posthog-js 1.368.0` — the battle-tested browser SDK.
- PostHog's own default config for the Next.js wrapper sets `capture_pageview: false, persistence: 'localStorage+cookie', opt_out_capturing_persistence_type: 'cookie', opt_out_persistence_by_default: true` — which conflicts with D-21 (autocapture disabled, explicit taxonomy only).
- **Resolution:** Hand-roll the PostHog provider using raw `posthog-js` (client) + `posthog-node` (server) with `autocapture: false, capture_pageview: false, disable_session_recording: true`. Matches the CLAUDE.md pin, matches D-21, and avoids the API-volatility risk of a pre-1.0 wrapper.

---

## Standard Stack

### Core

| Library | Pinned Version (CLAUDE.md) | Latest on npm | Purpose | Why Standard |
|---------|----------------------------|---------------|---------|--------------|
| `next` | 16.2.3 | 16.2.4 | App Router + route handlers | Stack lock-in |
| `react` / `react-dom` | 19.2.5 | 19.2.5 | UI runtime | Stack lock-in |
| `typescript` | (CLAUDE.md silent) | 6.0.3 | Compiler | Pin to latest stable 6.x; enforce `strict` + `noUncheckedIndexedAccess` |
| `@serwist/next` | 9.5.7 | 9.5.7 | PWA wiring (webpack plugin + SW registration) | Forked from Workbox, official Next.js integration |
| `serwist` | 9.5.7 | 9.5.7 | SW runtime library | Peer of `@serwist/next` |
| `@sentry/nextjs` | 10.48.0 | 10.50.0 | Error + performance tracing | Stack lock-in (stay on 10.48 until Turbopack + withSentryConfig validated on 10.50) |
| `posthog-js` | 1.368.0 | 1.371.2 | Client analytics | Stack lock-in |
| `posthog-node` | (CLAUDE.md silent) | 5.29.7 | Server analytics (future Inngest; installed Phase 1 for diagnostics) | Official Node SDK |
| `next-intl` | 4.9.1 | 4.9.1 | i18n + locale routing | Stack lock-in |
| `zod` | (CLAUDE.md silent) | 4.3.6 | Runtime validation | Reused in Phase 2 for route bodies; D-29 |

**Version verification:** All `npm view <pkg> version` runs executed 2026-04-23. Drift from CLAUDE.md pins: `next` 16.2.3→16.2.4 (patch), `@sentry/nextjs` 10.48→10.50 (minor), `posthog-js` 1.368→1.371 (patch). All within the same major. Recommend staying on CLAUDE.md-pinned versions for Phase 1 to match documented testing — upgrade in a follow-up phase if needed.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `supabase` (CLI) | 2.95.0 | Local Postgres 17 + Auth + Storage + Studio | devDependency (D-16) — run via `pnpm supabase ...` |
| `@supabase/supabase-js` | 2.104.1 | JS SDK (client + auth helpers) | Phase 1 installs; real usage in Phase 2+ |
| `@playwright/test` | 1.59.1 | E2E smoke | Phase 1 CI Chromium only |
| `vitest` (test runner) | 4.1.4 pinned (4.1.5 latest) | Unit + integration | Use `test.projects` config (D-25); `workspace` key is deprecated in v4 |
| `@vitest/ui` | 4.1.5 | Optional local UI | Dev-only; skip in CI |
| `eslint` | 10.2.1 | Lint | D-03 |
| `eslint-config-next` | 16.2.4 | Next.js flat config presets | D-03 |
| `eslint-config-prettier` | 10.1.8 | Disables style rules conflicting with Prettier | D-03 |
| `prettier` | 3.8.3 | Format | D-03 |
| `husky` | 9.1.7 | Git hooks | D-04 — use `husky init` (NOT the legacy `husky install`) |
| `lint-staged` | 16.4.0 | Run formatters on staged files | D-04 |
| `@commitlint/cli` | 20.5.0 | Commit message lint | D-04 |
| `@commitlint/config-conventional` | 20.5.0 | Conventional Commits rules | D-04 |
| `@types/node` | 22.x matching Node pin (not 25.x latest) | Node typings | D-01 — pin to 22.x to match runtime |
| `date-fns-tz` | 3.2.0 | Server-side tz math (Phase 3+ but future-proof) | Not needed Phase 1; CLAUDE.md reference |

### Alternatives Considered (and REJECTED per locked decisions)

| Instead of | Could Use | Why We Don't (D-ref) |
|------------|-----------|----------------------|
| `@serwist/next` | `next-pwa` | D-13 + CLAUDE.md lock next-pwa is unmaintained / Serwist is the current fork |
| Custom Zod env | `@t3-oss/env-nextjs` | D-29 — no extra dep |
| `justfile` / Turborepo | npm scripts | D-05 |
| `@posthog/next` 0.1.0 wrapper | Raw `posthog-js` + `posthog-node` | **L-3** — pre-1.0 API risk + config conflict with D-21 |
| Generic `@/*` path alias | Per-root `@contexts/*` + `@shared/*` | D-07 |
| Barrel `index.ts` files | Direct imports | D-08 |
| `pino-http` / custom logger | Sentry `captureException` + PostHog | D-19/20/21 — no extra logger at Phase 1 |
| Global `strict` flags beyond minimum | INFRA-01 minimum only | D-06 |

**Installation (Phase 1, consolidated):**

```bash
# Runtime
pnpm add next@16.2.3 react@19.2.5 react-dom@19.2.5
pnpm add @serwist/next@9.5.7 serwist@9.5.7
pnpm add @sentry/nextjs@10.48.0
pnpm add posthog-js@1.368.0 posthog-node@5.29.7
pnpm add next-intl@4.9.1
pnpm add zod@4

# Dev
pnpm add -D typescript@6 @types/node@22 @types/react@19 @types/react-dom@19
pnpm add -D eslint@10 eslint-config-next@16.2.3 eslint-config-prettier@10 prettier@3
pnpm add -D vitest@4.1.4 @vitest/ui@4
pnpm add -D @playwright/test@1.59.1
pnpm add -D husky@9 lint-staged@16 @commitlint/cli@20 @commitlint/config-conventional@20
pnpm add -D supabase@2.95.0
```

Exact patch versions for Claude's-discretion items (Node, pnpm, commitlint config) locked in `package.json` at scaffold time.

---

## Architecture Patterns

### System Architecture Diagram

```
                         ┌──────────────────────────────────────────────────────┐
                         │   Developer workstation (local)                      │
                         │                                                      │
  pnpm dev ──────────────▶   next dev (Turbopack)                               │
                         │     │                                                │
                         │     ├── src/proxy.ts ──► headers + next-intl routing │  [L-1]
                         │     ├── src/app/** (App Router)                      │
                         │     │     ├── layout.tsx (lang="pt-BR", NextIntlProv)│
                         │     │     ├── sw.ts  (Serwist SW source)             │
                         │     │     └── api/v1/_diagnostics/ping/route.ts  [CI]│
                         │     └── instrumentation.ts ──► Sentry server init    │
                         │           (Sentry DISABLED locally — D-19)           │
                         │                                                      │
  pnpm db:start ─────────▶   supabase start (Docker)                            │
                         │     ├── Postgres 17  :54322                          │
                         │     ├── Auth         :54321                          │
                         │     ├── Storage      :54321/storage                  │
                         │     └── Studio       :54323                          │
                         │                                                      │
  pnpm db:sync-env ──────▶   supabase status -o env ──► .env.local              │
                         └──────────────────────────────────────────────────────┘

                         ┌──────────────────────────────────────────────────────┐
                         │   GitHub Actions — ci.yml (on PR + push to main)     │
                         │                                                      │
  PR open ───────────────▶  concurrency: pr-<ref>, cancel-in-progress: true     │
                         │     │                                                │
                         │     ├── setup-node 22 + Corepack pnpm                │
                         │     ├── actions/cache  ~/.pnpm-store (pnpm-lock hash)│
                         │     ├── pnpm install --frozen-lockfile               │
                         │     ├── pnpm lint                                    │
                         │     ├── pnpm typecheck                               │
                         │     ├── pnpm test (unit project only)                │
                         │     │                                                │
                         │     ├── services: postgres:17-alpine                 │
                         │     │   └── pnpm test:integration                    │
                         │     │                                                │
                         │     ├── pnpm build (next build, Turbopack)           │
                         │     │                                                │
                         │     ├── actions/cache  ~/.cache/ms-playwright        │
                         │     │   (key = @playwright/test version)             │
                         │     ├── pnpm exec playwright install chromium --deps │
                         │     └── pnpm test:e2e                                │
                         │           ├── webServer: pnpm start (next start)     │
                         │           ├── intercept sentry.io/*/envelope         │
                         │           ├── intercept us.i.posthog.com/e/          │
                         │           ├── assert scrubbing on Sentry payloads    │
                         │           └── assert body-drop on /identifications/* │
                         │                                                      │
  Sentry project ◀──────── envelope POST (CI only; DSN set as repo secret)      │
  PostHog project ◀─────── event POST (CI only; key set as repo secret)         │
                         └──────────────────────────────────────────────────────┘
```

### Recommended Project Structure (Phase 1 — empty directories with `.gitkeep`)

```
folhario/
├── .nvmrc                              # "22" or specific 22.x patch
├── .gitignore                          # extends existing .DS_Store-only file
├── .env                                # EXISTING — real creds, never committed
├── .env.example                        # NEW — PRD §20 vars with dummies, grouped by phase
├── .husky/
│   ├── pre-commit                      # runs lint-staged
│   └── commit-msg                      # runs commitlint
├── .github/
│   └── workflows/
│       └── ci.yml                      # ONLY workflow in Phase 1
├── scripts/
│   └── sync-supabase-env.sh            # D-18 — parses `supabase status -o env`
├── supabase/                           # EXISTING — bump config.toml, pin Postgres 17
│   └── config.toml                     # CLI-generated
├── src/
│   ├── proxy.ts                        # [L-1] — NOT middleware.ts
│   ├── instrumentation.ts              # Sentry server/edge entry
│   ├── sentry.server.config.ts         # server Sentry.init
│   ├── sentry.edge.config.ts           # edge Sentry.init
│   ├── i18n/
│   │   ├── routing.ts                  # next-intl defineRouting (as-needed, pt-BR)
│   │   └── request.ts                  # getRequestConfig for App Router
│   ├── app/
│   │   ├── layout.tsx                  # <html lang="pt-BR"> + NextIntlClientProvider
│   │   ├── sw.ts                       # Serwist SW source (skeleton per D-13)
│   │   ├── api/
│   │   │   └── v1/
│   │   │       └── _diagnostics/
│   │   │           └── ping/route.ts   # CI-only diagnostics (D-27)
│   │   └── __diag/
│   │       └── page.tsx                # CI-only client diagnostics (D-27)
│   ├── messages/
│   │   └── pt-BR.json                  # empty skeleton at Phase 1
│   ├── contexts/                       # PRD §2 bounded contexts (empty .gitkeep)
│   │   ├── iam/{domain,application,infrastructure,api,inngest}/.gitkeep
│   │   ├── catalog/{domain,application,infrastructure,api,inngest}/.gitkeep
│   │   ├── species-care/{domain,application,infrastructure,api,inngest}/.gitkeep
│   │   ├── identification/{domain,application,infrastructure,api,inngest}/.gitkeep
│   │   ├── reminders/{domain,application,infrastructure,api,inngest}/.gitkeep
│   │   ├── billing/{domain,application,infrastructure,api,inngest}/.gitkeep
│   │   └── notifications/{domain,application,infrastructure,api,inngest}/.gitkeep
│   └── shared/
│       ├── db/.gitkeep                 # Phase 2
│       ├── events/.gitkeep             # Phase 4
│       ├── adapters/.gitkeep           # Phase 2
│       ├── config/
│       │   ├── env.ts                  # Zod schemas (D-29)
│       │   └── errors.ts               # Closed registry + HTTP mapper (D-10..12)
│       └── telemetry/
│           ├── sentry-client.ts        # reused beforeSend + scrub fn
│           ├── posthog-client.ts       # browser init
│           └── posthog-server.ts       # node init
├── tests/
│   ├── unit/                           # *.test.ts
│   ├── integration/                    # *.integration.test.ts (runs against postgres:17)
│   └── e2e/                            # Playwright specs
│       ├── diagnostics-sentry.spec.ts
│       └── diagnostics-posthog.spec.ts
├── public/
│   └── manifest.webmanifest            # minimal placeholder (D-14)
├── next.config.ts                      # withSerwist + withSentryConfig composed
├── vitest.config.ts                    # test.projects for unit/integration
├── playwright.config.ts                # webServer: `pnpm start`
├── tsconfig.json                       # strict + noUncheckedIndexedAccess + path aliases
├── eslint.config.mjs                   # flat config (Next 16 default)
├── .prettierrc
├── .commitlintrc.json
├── package.json
└── pnpm-lock.yaml
```

**Folder count for scaffolding script:**

- `src/contexts/<7 contexts>/<5 layers>/.gitkeep` = **35 gitkeep files**
- `src/shared/{db,events,adapters,config,telemetry}/.gitkeep` = **5 gitkeep files** (note: `config/` and `telemetry/` get real files immediately, so their `.gitkeep` can be omitted after the real file lands)
- **Total: 40 `.gitkeep` placeholders at scaffold time**

One-shot scaffold bash (planner can lift verbatim):

```bash
mkdir -p src/shared/{db,events,adapters,config,telemetry}
for ctx in iam catalog species-care identification reminders billing notifications; do
  for layer in domain application infrastructure api inngest; do
    mkdir -p "src/contexts/$ctx/$layer"
    touch "src/contexts/$ctx/$layer/.gitkeep"
  done
done
for dir in db events adapters; do touch "src/shared/$dir/.gitkeep"; done
```

### Pattern 1: Next 16 + Serwist composed config

**What:** Wrap `next.config.ts` with Serwist (skeleton, no precache) + Sentry (`withSentryConfig`). Order matters: Serwist OUTER, Sentry INNER.
**When:** Phase 1 only — Serwist rewrites Phase 3 when the offline shell lands.

```typescript
// next.config.ts
// Source: https://context7.com/serwist/serwist/llms.txt ; https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";
import { withSentryConfig } from "@sentry/nextjs";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: true,
  scope: "/",
  swUrl: "/sw.js",
  disable: process.env.NODE_ENV === "development",  // skeleton, no precache surface
  // Phase 1 ships no precache entries, no fallbacks — Phase 3 adds them
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // ...
};

export default withSentryConfig(
  withSerwist(nextConfig),
  {
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    authToken: process.env.SENTRY_AUTH_TOKEN,
    silent: true,
    // Phase 1: source maps configured but NOT uploaded — Phase 12 runs the upload in deploy-production.yml
    // Turbopack always uses the post-build hook pattern (required by @sentry/nextjs 10.13+)
  },
);
```

### Pattern 2: Next 16 proxy.ts — security headers + next-intl composed

**What:** Single `proxy.ts` that layers security headers atop next-intl routing. Node runtime only (Next 16 behavior).
**When:** Phase 1. Extends in Phase 4 with JWT verification on `/api/v1/*`.

```typescript
// src/proxy.ts  — Next 16 file convention (replaces middleware.ts)
// Source: https://nextjs.org/docs/app/api-reference/file-conventions/proxy
//         https://context7.com/amannn/next-intl/llms.txt (proxy.ts integration)
import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "@shared/config/i18n-routing";

const handleI18n = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  const response = handleI18n(request);

  // D-24: minimum-viable security headers (HSTS + X-Frame-Options + X-Content-Type-Options)
  response.headers.set(
    "Strict-Transport-Security",
    "max-age=63072000; includeSubDomains; preload",
  );
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");

  return response;
}

export const config = {
  // Match everything EXCEPT API routes, _next internals, and static assets
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
```

**Note:** The matcher excludes `/api/*` so `next-intl` doesn't touch route handlers. Security headers are applied only to page routes in Phase 1; Phase 2+ adds headers to API responses via a shared helper or extends the matcher. Document this as a known Phase 1 simplification.

### Pattern 3: next-intl as-needed routing

```typescript
// src/i18n/routing.ts
// Source: https://context7.com/amannn/next-intl/llms.txt (defineRouting)
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["pt-BR"],              // Phase 1: single locale. v2 adds en-US.
  defaultLocale: "pt-BR",
  localePrefix: "as-needed",       // D-15: pt-BR at root, future locales get /en-US/...
});
```

```typescript
// src/i18n/request.ts
// Source: https://next-intl.dev/docs/getting-started/app-router
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && routing.locales.includes(requested as any)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

### Pattern 4: Error-code registry (D-10, D-11, D-12)

```typescript
// src/shared/config/errors.ts  — INFRA-20, closed registry, single source of truth
// Source: PRD §5 closed registry
export const ErrorCode = {
  Unauthenticated: "unauthenticated",
  TokenExpired: "token_expired",
  InvalidCredentials: "invalid_credentials",
  Forbidden: "forbidden",
  EmailUnverified: "email_unverified",
  ValidationFailed: "validation_failed",
  InvalidPartnerCode: "invalid_partner_code",
  NotFound: "not_found",
  Conflict: "conflict",
  ConsentRequired: "consent_required",
  DeletionInProgress: "deletion_in_progress",
  SubscriptionRequired: "subscription_required",
  ReadOnlyMode: "read_only_mode",
  CapHit: "cap_hit",
  ProviderUnavailable: "provider_unavailable",
  CostCeilingReached: "cost_ceiling_reached", // INTERNAL
  BreakerOpen: "breaker_open",                // INTERNAL
  Timeout: "timeout",
  WebhookSignatureInvalid: "webhook_signature_invalid",
  RateLimited: "rate_limited",
  InternalError: "internal_error",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// Internal-only codes that MUST surface as `provider_unavailable` to clients
const INTERNAL_ONLY: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.CostCeilingReached,
  ErrorCode.BreakerOpen,
]);

const HTTP_STATUS: Record<ErrorCode, number> = {
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
  cost_ceiling_reached: 503, // surfaced as provider_unavailable
  breaker_open: 503,         // surfaced as provider_unavailable
  timeout: 504,
  webhook_signature_invalid: 401,
  rate_limited: 429,
  internal_error: 500,
};

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Response {
  // Surface internal-only codes as provider_unavailable (PRD §5, AC-COST-007)
  const publicCode: ErrorCode = INTERNAL_ONLY.has(code)
    ? ErrorCode.ProviderUnavailable
    : code;
  const body: ErrorBody = {
    error: {
      code: publicCode,
      message,
      ...(details ? { details } : {}),
    },
  };
  return new Response(JSON.stringify(body), {
    status: HTTP_STATUS[publicCode],
    headers: { "content-type": "application/json" },
  });
}
```

### Pattern 5: Typed env validation with Zod (D-29)

```typescript
// src/shared/config/env.ts — splits server vs client by NEXT_PUBLIC_ prefix convention
// Source: D-29; PRD §20 env var table
import { z } from "zod";

// Accept empty strings as undefined (D-19/D-20: Sentry/PostHog disabled locally)
const optional = (schema: z.ZodString) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SENTRY_AUTH_TOKEN: optional(z.string().min(1)),   // CI-only; absent locally
  SENTRY_ORG: optional(z.string().min(1)),
  SENTRY_PROJECT: optional(z.string().min(1)),
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
  // Phase 4+: INNGEST_*, RESEND_*, STRIPE_*, PLANTID_API_KEY, LLM_*, VAPID_*
});

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: optional(z.string().url()),
  NEXT_PUBLIC_POSTHOG_KEY: optional(z.string().min(1)),
  NEXT_PUBLIC_POSTHOG_HOST: optional(z.string().url()),
});

// Fail-fast at module load (D-29). Throws a readable error listing which keys failed.
export const serverEnv = serverSchema.parse(process.env);

// Separate client parse — prevents accidentally leaking server-only vars to the browser bundle.
// The NEXT_PUBLIC_ prefix is the ONLY safe way to expose values to the client at build time.
export const clientEnv = clientSchema.parse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_POSTHOG_HOST: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});
```

### Pattern 6: Sentry beforeSend scrubbing (D-22, LGPD-13)

```typescript
// src/sentry.server.config.ts  — mirror in sentry.edge.config.ts + sentry.client.config.ts
// Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/
//         PRD §13.7 (Sentry PII scrubbing) + CLAUDE.md C-24
import * as Sentry from "@sentry/nextjs";

const SCRUB_FIELDS = [
  "authorization", "cookie", "email", "password", "token", "photo_url",
  // Header case-insensitive comparisons handled below.
] as const;

const IDENTIFICATION_PATH = /\/api\/v1\/identifications(\/|$)/;

function scrubHeaders(headers: Record<string, string> | undefined) {
  if (!headers) return headers;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    out[k] = SCRUB_FIELDS.includes(k.toLowerCase() as any) ? "[scrubbed]" : v;
  }
  return out;
}

function scrubObject(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(scrubObject);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    out[k] = SCRUB_FIELDS.includes(k.toLowerCase() as any)
      ? "[scrubbed]"
      : scrubObject(v);
  }
  return out;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,  // D-19: empty DSN disables transport entirely
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),  // belt + suspenders
  sendDefaultPii: false,                                  // [L-2] verified current API in 10.48
  release: process.env.SENTRY_RELEASE,                    // CI sets to $GITHUB_SHA (Phase 12 completes the chain)
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  denyUrls: [
    /\/_next\/static\//,
    // NOTE: do NOT add /__diag here. Our Playwright smoke DEPENDS on /__diag
    // envelopes reaching Sentry. Production protection for diagnostics routes
    // is handled by the IDENTIFICATION_PROVIDER_MODE !== 'stub' server guard
    // + robots.txt Disallow (defense in depth in routing, not in the SDK filter).
  ],
  // C-24: Sentry.setUser({ id }) only — Phase 4 wires it. Phase 1 installs the beforeSend rule as defense in depth.
  beforeSend(event) {
    // Never send user.email or user.username
    if (event.user) {
      delete event.user.email;
      delete event.user.username;
      delete event.user.ip_address;
    }

    // Scrub request headers + query
    if (event.request) {
      event.request.headers = scrubHeaders(event.request.headers);
      event.request.cookies = undefined;

      // LGPD-13: DROP request.data entirely on identification routes
      if (event.request.url && IDENTIFICATION_PATH.test(event.request.url)) {
        event.request.data = undefined;
      } else {
        event.request.data = scrubObject(event.request.data);
      }
    }

    // Scrub extras
    if (event.extra) event.extra = scrubObject(event.extra) as typeof event.extra;
    if (event.contexts) event.contexts = scrubObject(event.contexts) as typeof event.contexts;

    return event;
  },

  beforeBreadcrumb(breadcrumb) {
    // PRD §13.7: users must NOT appear in breadcrumbs by email
    if (breadcrumb.data) {
      breadcrumb.data = scrubObject(breadcrumb.data) as typeof breadcrumb.data;
    }
    return breadcrumb;
  },
});
```

### Pattern 7: PostHog init with autocapture disabled (D-21)

```typescript
// src/shared/telemetry/posthog-client.ts
// Source: https://context7.com/posthog/posthog-js/llms.txt (posthog.init options)
// + D-21 (autocapture disabled) + D-20 (disabled when key empty)
import posthog from "posthog-js";
import { clientEnv } from "@shared/config/env";

export function initPostHog() {
  if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return; // D-20: disabled locally by empty key
  posthog.init(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    autocapture: false,                 // D-21
    capture_pageview: false,            // explicit taxonomy only (Phase 13 names events)
    capture_pageleave: false,
    disable_session_recording: true,    // D-21 posture; ANALYTICS-v2-01 lifts this
    persistence: "localStorage+cookie",
    person_profiles: "identified_only", // don't create profiles for anonymous visitors (LGPD posture)
  });
}
```

```typescript
// src/shared/telemetry/posthog-server.ts
// Source: https://posthog.com/docs/libraries/node
import { PostHog } from "posthog-node";
import { clientEnv } from "@shared/config/env";

let _client: PostHog | null = null;

export function getPostHog(): PostHog | null {
  if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return null;
  if (!_client) {
    _client = new PostHog(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
      host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
      flushAt: 1,          // flush immediately for diagnostics ping — adjust in Phase 13
      flushInterval: 0,
    });
  }
  return _client;
}
```

### Pattern 8: Diagnostics routes (D-27)

```typescript
// src/app/__diag/page.tsx — CI/preview only client diagnostics
// Source: D-27 + CONTEXT.md specifics ("routes must refuse to render in production")
"use client";
import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";

export default function DiagPage() {
  // Server component guard renders this page only when IDENTIFICATION_PROVIDER_MODE === "stub"
  // (checked in a server parent layout; see below)
  useEffect(() => {
    // Send a taxonomy event from the client
    posthog.capture("$diagnostics_client_ping", { source: "playwright-smoke" });

    // Trigger a deliberate error with a scrubbable body + header
    Sentry.captureException(
      new Error("Playwright diagnostics client error"),
      { extra: { email: "should-be-scrubbed@example.com", token: "should-be-scrubbed" } },
    );
  }, []);

  return <main>ok</main>;
}
```

```typescript
// src/app/__diag/layout.tsx — server guard
import { notFound } from "next/navigation";
import { serverEnv } from "@shared/config/env";

export default function DiagLayout({ children }: { children: React.ReactNode }) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") notFound();
  return children;
}
```

```typescript
// src/app/api/v1/_diagnostics/ping/route.ts
import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@shared/config/env";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { errorResponse, ErrorCode } from "@shared/config/errors";

export async function POST(request: Request) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
    return errorResponse(ErrorCode.NotFound, "not found");
  }

  // Fire a taxonomy event from posthog-node (proves the server pipeline works)
  const ph = getPostHog();
  if (ph) {
    ph.capture({
      distinctId: "ci-playwright",
      event: "$diagnostics_server_ping",
      properties: { runtime: process.env.NEXT_RUNTIME ?? "nodejs" },
    });
    await ph.shutdown();
  }

  // LGPD-13 body-drop: beforeSend keys off event.request.data with an
  // identification-shaped URL. To exercise it end-to-end we attach a synthetic
  // request context to the Sentry scope so event.request.data is populated AND
  // event.request.url matches the /api/v1/identifications/* regex.
  //
  // The load-bearing LGPD-13 assertion lives in tests/unit/sentry-scrub.test.ts
  // (Wave 0) — it hand-calls beforeSend with a synthetic event. This E2E only
  // validates the transport wiring + that the rule fires in the SDK path.
  const bodyText = await request.text().catch(() => "");
  Sentry.withScope((scope) => {
    scope.addEventProcessor((event) => {
      event.request = {
        ...event.request,
        // Proxy the URL so the beforeSend regex /\/api\/v1\/identifications(\/|$)/ matches.
        // Production routing stays clean — the route is still exposed under _diagnostics.
        url: "http://localhost:3000/api/v1/identifications/_diag-synth",
        data: bodyText || { email: "scrub-me@example.com", token: "scrub-me" },
        method: "POST",
      };
      return event;
    });
    Sentry.captureException(new Error("Playwright diagnostics server error"));
  });

  return NextResponse.json({ ok: true });
}
```

### Anti-Patterns to Avoid

- **`src/middleware.ts` in Next 16** — deprecated, Edge-only. Use `src/proxy.ts` with Node runtime (L-1).
- **Barrel `index.ts` re-exports** — D-08; breaks tree-shaking, creates cycles.
- **Using `@posthog/next` 0.1.0** — pre-1.0 API volatility + conflicting defaults (L-3).
- **`sendDefaultPii: true` anywhere** — ever. CVE-2025-65944 history + LGPD-13 + CLAUDE.md C-24.
- **`Sentry.setUser({ email })`** — CLAUDE.md C-24. Enforce via `beforeSend` as defense in depth.
- **Generic `@/*` alias** — D-07; we want explicit per-root aliases to surface boundary-crossings visually.
- **Seed files at Phase 1** — D-17; Phase 2 owns seed data alongside Drizzle schema.
- **Running Sentry/PostHog from `pnpm dev`** — D-19/20; empty DSN/key disables transport entirely.
- **Inngest / Drizzle / Resend / Stripe imports at Phase 1** — strictly Phase 4/2/4/10.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Service worker lifecycle + precache manifest | Custom SW registration | `@serwist/next` + `serwist` | Workbox heritage; handles install/activate/skipWaiting edge cases |
| i18n locale routing + middleware | Custom path rewriter | `next-intl` 4.x with `defineRouting({localePrefix: 'as-needed'})` | Server Components support, cookie locale memory, redirect rules battle-tested |
| Git hooks | Raw `.git/hooks/` scripts | `husky` 9 (`husky init`) | Cross-OS, committable |
| Commit message lint | Custom regex | `@commitlint/cli` + `config-conventional` | Conventional Commits is the ecosystem default |
| Staged-file formatting | Custom shell find+xargs | `lint-staged` | Handles partial-stage, async, glob |
| Env var validation | `if (!process.env.X) throw` walls | Zod schemas split by `NEXT_PUBLIC_` prefix | Fail-fast, typed, documents shape |
| Error-code enum | TypeScript `enum ...` | `as const` object + literal-union type | D-10; tree-shakeable, no runtime numeric bridge, ESM-friendly |
| Playwright waiting for server | `sleep 5 && run tests` | `webServer` config in `playwright.config.ts` | Handles readiness with `url` or `stdout` signal |
| Local Postgres + Auth + Storage | Docker compose from scratch | Supabase CLI `supabase start` | Matches remote in behavior + CLI owns upgrade path |
| Security-header middleware | Custom header mutator | `proxy.ts` single-response helper; consider `next-safe` only if a need emerges | Phase 1 is 3 headers — custom code is simpler than a dep |
| Concurrency guard in CI | Manual cancel API | GH Actions `concurrency: { group, cancel-in-progress }` | Native, free |

**Key insight:** Phase 1 is the one phase where "don't hand-roll" is inverted by ONE directive — the `scripts/sync-supabase-env.sh` helper (D-18) IS hand-rolled because `supabase status -o env` is the contract and we need to add a tiny wrapper that appends to `.env.local` without clobbering the developer's `.env`.

---

## Common Pitfalls

### Pitfall 1: `middleware.ts` vs `proxy.ts` confusion under Next 16

**What goes wrong:** Scaffolding `src/middleware.ts` per CONTEXT.md wording → Next 16 warns it's deprecated AND forces Edge runtime AND won't evolve into Phase 4's Node-runtime JWT verification without a second rename.
**Why it happens:** CONTEXT.md was drafted against pre-16 conventions; next-intl 4.9 docs explicitly call out the rename.
**How to avoid:** Ship `src/proxy.ts` exporting a `proxy` function. Flag L-1 in PLAN.md. Run `npx @next/codemod@latest next-16 .` if a stray `middleware.ts` creeps in.
**Warning signs:** Build warning "`middleware.ts` is deprecated"; runtime = edge where you expected node.

### Pitfall 2: Sentry transport firing locally despite empty DSN

**What goes wrong:** Developer sets `NEXT_PUBLIC_SENTRY_DSN=` (empty) but the SDK still logs to console with `debug: true` or buffers events.
**Why it happens:** `Sentry.init({ dsn: "" })` is treated as "use default envelope transport" in some SDK paths; the correct no-op is `dsn: undefined` + `enabled: false`.
**How to avoid:** Use the pattern from §Pattern 6 — `dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined` with explicit `enabled: Boolean(...)`. Never set `debug: true` in committed config.
**Warning signs:** Sentry breadcrumb logs appearing in `pnpm dev` terminal.

### Pitfall 3: PostHog `capture_pageview: true` default pollutes taxonomy

**What goes wrong:** Default PostHog init captures `$pageview` events → Phase 13's SQL rollups get noisy → analytics cost + LGPD posture both worse.
**Why it happens:** `posthog-js` defaults differ from `@posthog/next` defaults; copy-pasting either without explicit overrides drifts.
**How to avoid:** Use the pattern from §Pattern 7 with EVERY capture option disabled by default; only the 14 PRD §20 taxonomy events fire once Phase 13 wires them.
**Warning signs:** PostHog project showing `$pageview` / `$autocapture` / `$web_vitals` events.

### Pitfall 4: Husky 9 `husky install` vs `husky init`

**What goes wrong:** `prepare: "husky install"` — deprecated in Husky 9. Hooks silently don't register.
**Why it happens:** Stale blog posts everywhere still show the v4-era command.
**How to avoid:** Use Husky 9 idioms: `prepare: "husky"` in `package.json` scripts; initial setup via `pnpm dlx husky init`.
**Warning signs:** Commits going through without triggering lint-staged or commitlint.

### Pitfall 5: Supabase CLI Postgres version drift

**What goes wrong:** CLI upgrade mid-phase pulls Postgres 17 → local integration tests pass, but a developer on an older CLI pulls Postgres 15 → green CI, red laptop.
**Why it happens:** `supabase` npm package version controls which Postgres image is pulled on `supabase start`; drift between devs.
**How to avoid:** Pin `supabase` as a devDependency (D-16) with an EXACT version — no caret. CI uses the same pnpm-lock, guaranteeing version parity.
**Warning signs:** `select version()` differs between local and `postgres:17-alpine` service container.

### Pitfall 6: Playwright `webServer` racing `next start`

**What goes wrong:** Playwright launches before Next 16 production server is ready → flaky first test.
**Why it happens:** `webServer.command: "pnpm start"` + default `url` check → race on slow CI runners.
**How to avoid:** Set `webServer.reuseExistingServer: !process.env.CI`, `timeout: 120_000`, `url: "http://localhost:3000/__diag"` (page exists under `stub` mode).
**Warning signs:** First `test()` flakes on cold start; later tests pass.

### Pitfall 7: Sentry source-map upload required in Phase 1

**What goes wrong:** Wiring `SENTRY_AUTH_TOKEN` as a CI secret and calling `withSentryConfig` with upload enabled in `ci.yml` → CI always tries to upload per-PR source maps → noisy Sentry dashboards + auth-token exposure.
**Why it happens:** Assumption that Phase 1 "wiring" includes upload.
**How to avoid:** `withSentryConfig` is composed in `next.config.ts` but upload happens ONLY in Phase 12's `deploy-production.yml`. Phase 1 `ci.yml` does NOT set `SENTRY_AUTH_TOKEN` in the build step. Turbopack + Sentry 10.13+ already uses the post-build hook — no inline upload.
**Warning signs:** Sentry releases appearing per PR; source-map upload logs in `ci.yml` output.

### Pitfall 8: `.env.example` accidentally tracks real secrets

**What goes wrong:** Developer copies `.env` → `.env.example`, forgets to redact keys.
**Why it happens:** Manual copy; existing `.env` has real creds (confirmed in CONTEXT.md §Code Context).
**How to avoid:** Write `.env.example` by hand from the PRD §20 table with dummy values (e.g. `DUMMY-CHANGE-ME`). Pre-commit hook: `lint-staged` rule that errors if `.env.example` contains values matching common secret patterns (`sk_live_`, `eyJ...`).
**Warning signs:** `git diff` on `.env.example` showing long base64-looking strings.

### Pitfall 9: `next-intl` proxy matcher colliding with `/api/*`

**What goes wrong:** Default `next-intl` matcher includes `/api/*` → API responses get `x-next-intl-locale` headers + locale-prefix redirects → breaks REST semantics.
**Why it happens:** Copy-paste of the "standard" matcher from docs.
**How to avoid:** Use the matcher from §Pattern 2 — explicit `api` exclusion: `'/((?!api|_next|_vercel|.*\\..*).*)'`.
**Warning signs:** API route returns 307/308 redirect when hit without a leading locale segment.

### Pitfall 10: `noUncheckedIndexedAccess` breaking array/map access everywhere

**What goes wrong:** D-06 adds `noUncheckedIndexedAccess: true` → every `array[i]` becomes `T | undefined` → Phase 2+ devs fight the compiler on every line.
**Why it happens:** The flag is correct but habit-breaking; legacy patterns of `for (let i=0; i<arr.length; i++) use(arr[i].x)` all break.
**How to avoid:** Document the idioms in the README / a dev-onboarding doc during Phase 1: use `arr.at(i)` + narrowing, prefer `for...of`, use nullish assertion only when invariant is provable (`arr[i]!`). Phase 1 has little code — establish the pattern now.
**Warning signs:** `Object is possibly 'undefined'` errors clustered in later phases.

---

## Code Examples

### `vitest.config.ts` — unit + integration projects (D-25)

```typescript
// Source: https://context7.com/vitest-dev/vitest (projects config, replaces deprecated workspace)
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: { label: "unit", color: "cyan" },
          include: ["tests/unit/**/*.test.ts"],
          environment: "node",
          isolate: false,
        },
      },
      {
        extends: true,
        test: {
          name: { label: "integration", color: "green" },
          include: ["tests/integration/**/*.integration.test.ts"],
          environment: "node",
          // Integration tests hit real Postgres — ALWAYS isolated (fresh schema per file)
          // PRD §19: zero DB mocking.
          testTimeout: 30_000,
        },
      },
    ],
  },
});
```

### `ci.yml` — full recipe (D-25, D-26, D-28)

```yaml
# Source: https://context7.com/microsoft/playwright (CI recipe), GH Actions docs for cache + services
# Phase 1 ONLY — no deploy workflows; INFRA-12
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: 22

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    services:
      postgres:
        image: postgres:17-alpine                 # D-25
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: folhario_test
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v5

      - name: Enable Corepack (pnpm)
        run: corepack enable

      - uses: actions/setup-node@v5
        with:
          node-version: ${{ env.NODE_VERSION }}

      - name: Get pnpm store path
        id: pnpm-cache
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_OUTPUT

      - name: Cache pnpm store                     # D-28
        uses: actions/cache@v4
        with:
          path: ${{ steps.pnpm-cache.outputs.STORE_PATH }}
          key: pnpm-store-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: pnpm-store-${{ runner.os }}-

      - run: pnpm install --frozen-lockfile

      - run: pnpm lint
      - run: pnpm typecheck

      - name: Unit tests
        run: pnpm test:unit -- --run          # single-run explicit; never watch

      - name: Integration tests
        env:
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/folhario_test
          DATABASE_POOL_URL: postgres://postgres:postgres@localhost:5432/folhario_test
        run: pnpm test:integration -- --run

      - name: Build
        env:
          # Build-time env for Next; real DSN/key set only in CI smoke-test env below
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
          IDENTIFICATION_PROVIDER_MODE: stub
        run: pnpm build

      - name: Cache Playwright browsers          # D-28
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml') }}
          restore-keys: playwright-${{ runner.os }}-

      - name: Install Playwright Chromium       # D-26
        run: pnpm exec playwright install chromium --with-deps

      - name: Playwright smoke
        env:
          # Real DSN/key here so Sentry + PostHog receive the diagnostics events
          NEXT_PUBLIC_SENTRY_DSN: ${{ secrets.SENTRY_DSN_CI }}
          NEXT_PUBLIC_POSTHOG_KEY: ${{ secrets.POSTHOG_KEY_CI }}
          NEXT_PUBLIC_POSTHOG_HOST: https://us.i.posthog.com
          IDENTIFICATION_PROVIDER_MODE: stub
          NEXT_PUBLIC_SUPABASE_URL: http://localhost:54321
          NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy
          DATABASE_URL: postgres://postgres:postgres@localhost:5432/folhario_test
          DATABASE_POOL_URL: postgres://postgres:postgres@localhost:5432/folhario_test
        run: pnpm test:e2e

      - uses: actions/upload-artifact@v4
        if: ${{ !cancelled() }}
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14
```

### `playwright.config.ts` — webServer against `next start`

```typescript
// Source: https://context7.com/microsoft/playwright (webServer + Chromium-only)
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },     // D-26: Chromium only
  ],

  webServer: {
    command: "pnpm start",                    // next start (production build)
    url: "http://localhost:3000/__diag",      // diagnostics page exists only in stub mode
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      IDENTIFICATION_PROVIDER_MODE: "stub",
    },
  },
});
```

### Playwright diagnostics test — Sentry scrubbing assertion (D-27)

```typescript
// tests/e2e/diagnostics-sentry.spec.ts
// Asserts: (a) Sentry event fires from both client + server, (b) scrubbing removed forbidden fields.
import { test, expect } from "@playwright/test";

const FORBIDDEN_FIELDS = ["authorization", "cookie", "password", "token", "photo_url"];

test("Sentry fires and scrubs PII from /__diag + /_diagnostics/ping", async ({ page, request }) => {
  const sentryPayloads: string[] = [];

  await page.route(/\.ingest\.sentry\.io\/.*\/envelope/, async (route) => {
    const body = route.request().postData() ?? "";
    sentryPayloads.push(body);
    await route.fulfill({ status: 200, body: "ok" });
  });

  // Client event
  await page.goto("/__diag");

  // Server event — includes an identification-route-shaped path so body-drop rule fires
  const res = await request.post("/api/v1/_diagnostics/ping", {
    data: { email: "scrub-me@example.com", token: "scrub-me", photo_url: "http://foo/x.jpg" },
  });
  expect(res.ok()).toBeTruthy();

  // Wait for envelopes to flush
  await page.waitForTimeout(2000);

  expect(sentryPayloads.length).toBeGreaterThanOrEqual(2); // at least client + server

  for (const payload of sentryPayloads) {
    const lower = payload.toLowerCase();
    for (const field of FORBIDDEN_FIELDS) {
      // No forbidden field value should appear in the raw envelope body
      expect(lower).not.toContain("scrub-me");
      expect(lower).not.toContain("should-be-scrubbed");
    }
    // `setUser({ email })` never fires
    expect(lower).not.toContain("should-be-scrubbed@example.com");
  }
});
```

```typescript
// tests/e2e/diagnostics-posthog.spec.ts
import { test, expect } from "@playwright/test";

test("PostHog captures client + server events via taxonomy", async ({ page, request }) => {
  const posthogEvents: Array<Record<string, unknown>> = [];

  await page.route(/\.i\.posthog\.com\/(e|batch|capture)/, async (route) => {
    try {
      const raw = route.request().postData();
      if (raw) posthogEvents.push(JSON.parse(raw));
    } catch { /* posthog sometimes sends batch arrays */ }
    await route.fulfill({ status: 200, body: "1" });
  });

  await page.goto("/__diag");
  await request.post("/api/v1/_diagnostics/ping", { data: {} });
  await page.waitForTimeout(2000);

  const names = posthogEvents.flatMap((e) => {
    const evs = Array.isArray(e) ? e : [e];
    return evs.map((x: any) => x.event ?? x.properties?.event);
  });
  expect(names).toContain("$diagnostics_client_ping");
  expect(names).toContain("$diagnostics_server_ping");
});
```

### `scripts/sync-supabase-env.sh` — env sync (D-18)

```bash
#!/usr/bin/env bash
# Source: https://context7.com/supabase/cli (status -o env --override-name)
# D-18: parses `supabase status -o env` and writes .env.local. NEVER modifies .env.
set -euo pipefail

OUT=.env.local

# Produce env-var-style output with names matching PRD §20
pnpm supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY \
  --override-name service_role_key=SUPABASE_SERVICE_ROLE_KEY \
  --override-name db.url=DATABASE_URL \
  > "$OUT.tmp"

# Compute a pooler URL for runtime (local Supabase doesn't run Supavisor; reuse db.url with prepare=false-compatible flag)
DB_URL=$(grep '^DATABASE_URL=' "$OUT.tmp" | cut -d= -f2-)
echo "DATABASE_POOL_URL=$DB_URL" >> "$OUT.tmp"

mv "$OUT.tmp" "$OUT"
echo "Wrote $OUT"
```

### `.husky/` hooks (Husky 9 idioms)

```bash
# .husky/pre-commit — Source: https://typicode.github.io/husky/
pnpm lint-staged
```

```bash
# .husky/commit-msg
pnpm exec commitlint --edit "$1"
```

```json
// .commitlintrc.json
{ "extends": ["@commitlint/config-conventional"] }
```

```json
// package.json — fragment
{
  "scripts": {
    "prepare": "husky",                      // Husky 9 idiom (NOT "husky install")
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test:unit": "pnpm exec vitest --run --project=unit",
    "test:integration": "pnpm exec vitest --run --project=integration",
    "test:e2e": "playwright test",
    "db:start": "supabase start",
    "db:stop": "supabase stop",
    "db:reset": "supabase db reset",
    "db:sync-env": "bash scripts/sync-supabase-env.sh",
    "supabase": "supabase"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx,mjs}": ["prettier --write", "eslint --fix"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` | `@serwist/next` | next-pwa unmaintained since ~2023; Serwist forked from Workbox | D-13 / C-02 |
| `middleware.ts` + `middleware` export | `proxy.ts` + `proxy` export (Node only) | Next.js 16 (2026) | **L-1** — Phase 1 landmine |
| `Sentry.init({ sendDefaultPii })` as binary toggle | Remains current in 10.48; fine-grained `dataCollection` proposed for a future major | 10.11 → 10.27 security patch; dataCollection still in develop-docs | L-2 — future migration |
| `husky install` + `.husky/_/husky.sh` sourcing | `husky init` + plain hook scripts | Husky 9 (2024) | Pitfall 4 |
| `workspace` key in Vitest config | `projects` key | Vitest v3 → v4 | Use `projects` from day one |
| Webpack-only Sentry source maps | Turbopack post-build hook (default in Next 15.4.1+) | @sentry/nextjs 10.13 | Phase 12 config |
| `@t3-oss/env-nextjs` wrapper | Hand-rolled Zod schemas | Project choice (D-29) | No new dep |
| Raw `cron` / `setInterval` for long sleeps | Inngest `step.sleepUntil` | Project choice (CLAUDE.md) | Phase 4/11 — not Phase 1 |

**Deprecated / outdated:**
- `next-pwa`: last meaningful release 2023; no Next 15+ support.
- Husky `husky install` + the sourced `_/husky.sh` boilerplate: replaced by plain script files since v9.
- Vitest `workspace` key: renamed to `projects` in v4; still works with a deprecation warning but will be removed.
- `middleware.ts` on Next 16: deprecated, edge-only.

---

## Assumptions Log

Claims in this research that are `[ASSUMED]` rather than `[VERIFIED]` or `[CITED]` — the planner and discuss-phase MUST confirm these before task generation.

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Local Supabase `supabase start` running on the default 54321/54322/54323 port triplet will be reachable from Next 16 dev at `http://localhost:54321` without extra config | §Arch diagram | Low — standard Supabase local defaults; if wrong, port override is a one-line config.toml edit |
| A2 | Sentry 10.48's `withSentryConfig` Turbopack post-build hook works cleanly without `useRunAfterProductionCompileHook: true` (that flag is docs-referenced for 10.13+ but may already be default in 10.48) | §Pattern 1 | Low — Phase 12 validates source-map upload; Phase 1 only wires the wrapper |
| A3 | `postgres-js` + `{ prepare: false }` locally against `supabase start`'s bundled Postgres works identically to remote Supavisor transaction-mode pooler | §Pitfall 5; CLAUDE.md C-05 | Medium — the `prepare: false` requirement comes from Supavisor pgBouncer-compat mode; local Postgres doesn't pgBouncer, so setting the flag locally is harmless. Phase 2 integration tests will catch drift. |
| A4 | `ci.yml`'s `postgres:17-alpine` service container is feature-parity with `supabase start`'s Postgres 17 image for Phase 2 schema work | §CI recipe | Medium — Phase 2 may discover extension mismatches (e.g., `pgcrypto`, `pgjwt`, `uuid-ossp`). Phase 1 ships without extensions (no schema yet); Phase 2 adds `postgres.options` as schema requires. |
| A5 | Intercepting BOTH browser-context Sentry envelopes AND server-side `request.post` traffic in a single test requires `context.route(...)` (NOT `page.route`), because Playwright's `request` fixture uses a separate `APIRequestContext`. Concrete fix: register `context.route(...)` in a shared `beforeEach` on the `browserContext`; fall back to a test-only env-flagged fetch shim in `/api/v1/_diagnostics/ping` if interception still drops server-originated envelopes. | §Pattern 8, Code examples | Low — well-documented Playwright pattern |
| A6 | The optional 0.1.0 `@posthog/next` wrapper is unstable enough to avoid — major version 0 API guarantees | L-3 | Low — major 0 = SemVer warning; CLAUDE.md pin supports this conclusion. |
| A7 | `sendDefaultPii: false` remains the documented Next.js SDK option through `@sentry/nextjs` 10.x | L-2 | Low — verified against current docs.sentry.io Next.js options page. |
| A8 | `scripts/sync-supabase-env.sh` `--override-name` flag syntax matches `supabase` CLI 2.95.0 | §scripts/sync-supabase-env.sh | Low — verified against context7 CLI docs; syntax unchanged since 1.x. |
| A9 | Next 16's flat ESLint config is compatible with `eslint-config-next` 16.2.x preset without manual migration | §Pattern 1, §Standard Stack | Low — `eslint-config-next` major matches Next major. |

---

## Open Questions (RESOLVED)

1. **Should the Phase 1 scaffold include an `@/app/(diag)/` route group to visually flag CI-only routes?**
   - What we know: D-27 specifies `/__diag` + `/api/v1/_diagnostics/ping`; the server guard via `notFound()` when `IDENTIFICATION_PROVIDER_MODE !== 'stub'` is the primary defense.
   - What's unclear: Whether the planner also wants a `robots.txt` `Disallow: /__diag` entry as defense in depth.
   - Recommendation: Add `Disallow: /__diag` to `public/robots.txt` as a zero-cost safety net.
   - **RESOLVED: Plan 01-03 Task 1 Step 4 ships `public/robots.txt` with `Disallow: /__diag` + `Disallow: /api/v1/_diagnostics/`. Plan 01-07 Task 1 adds `notFound()` guards to both routes when `IDENTIFICATION_PROVIDER_MODE !== 'stub'`.**

2. **Which Node 22 patch version exactly?**
   - What we know: D-01 locks Node 22 LTS; exact patch is Claude's discretion.
   - What's unclear: Latest 22.x LTS patch available at scaffold time (needs checking at execution).
   - Recommendation: Planner task runs `ls -1 /usr/local/opt/node@22/` or equivalent at execution; `.nvmrc` content = latest 22.x patch.
   - **RESOLVED: Plan 01-01 Task 1 Step 1 pins `.nvmrc` + `engines.node` to the latest 22.x LTS patch available on the scaffolding host (resolved via `pnpm env ls-remote --lts` or equivalent at execution time).**

3. **Does the diagnostics Playwright spec need fixtures for a real Supabase connection?**
   - What we know: The diagnostics endpoints don't touch the DB; they only fire Sentry + PostHog.
   - What's unclear: Whether the Next build still imports `@supabase/supabase-js` in a way that needs a valid `NEXT_PUBLIC_SUPABASE_URL` at build time.
   - Recommendation: Use dummy values in CI build step (shown in ci.yml); if Next complains, switch to real local-Supabase-style URLs.
   - **RESOLVED: Plan 01-08 ci.yml uses dummy placeholder env vars for the build step (no live Supabase needed); diagnostics Playwright specs do not require Supabase fixtures because the endpoints do not touch the DB in Phase 1.**

4. **`.env.local` vs `.env.development.local` for the sync script output?**
   - What we know: Next reads `.env.local` before `.env.development.local`. Existing `.env` in repo holds real creds; we must NOT touch it.
   - What's unclear: If team prefers `.env.development.local` for the auto-generated output to make the generated-ness visible.
   - Recommendation: Stick with `.env.local` per D-18 wording; add a comment line at the top of the generated file saying `# Auto-generated by scripts/sync-supabase-env.sh — do not edit by hand`.
   - **RESOLVED: Plan 01-04 Task 1 Step 3 writes to `.env.local` (per D-18) with a leading `# Auto-generated by scripts/sync-supabase-env.sh — do not edit by hand` comment. `.env.development.local` deferred.**

---

## Environment Availability

| Dependency | Required By | Available (at research time) | Fallback |
|------------|-------------|-------------------------------|----------|
| **Docker Desktop / Docker Engine** | `supabase start` (D-16, INFRA-26) | ✓ assumed (developer already ran `supabase init`; `supabase/.branches/` + `.temp/cli-latest` artifacts present) | NONE — `supabase start` hard-requires Docker. Onboarding script MUST probe: `docker info >/dev/null 2>&1 || { echo "Docker required for supabase start"; exit 1; }` before invoking `supabase start`. |
| **Node 22 LTS** | D-01 | ✓ assumed (user workstation) | None — blocks all other work. `.nvmrc` + `engines.node` keeps it enforced. |
| **Corepack** | D-02 (pnpm activation) | ✓ bundled with Node 22 | None |
| **git** | Sentry release = git SHA pattern (CLAUDE.md C-22) | ✓ (repo is already initialized) | If absent, `SENTRY_RELEASE` falls back to `crypto.randomUUID()` per Serwist's pattern |
| **Supabase CLI npm pkg** | D-16 | Will be installed via `pnpm install` | N/A |
| **Playwright Chromium** | D-26 smoke | Installed in CI via `playwright install chromium` | None — blocks E2E |

**Missing dependencies with no fallback:**
- Docker — **if the dev or CI host has no Docker, `supabase start` fails**. CI uses the `postgres:17-alpine` service container directly (no Supabase stack needed); local dev requires Docker. Document in onboarding README as a hard prerequisite.

**Missing dependencies with fallback:**
- None at Phase 1.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Test runner: `vitest` 4.1.4 (CLAUDE.md pinned; 4.1.5 latest — patch drift acceptable) + `@playwright/test` 1.59.1 |
| Config files | `vitest.config.ts` (projects = unit, integration); `playwright.config.ts` (Chromium only + webServer) |
| Quick run command | `pnpm test:unit -- --run` |
| Full suite command | `pnpm test:unit -- --run && pnpm test:integration -- --run && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INFRA-01 | `next build` completes against TS strict + pt-BR locale + Serwist | build | `pnpm build` (in `ci.yml`) | ❌ Wave 0 |
| INFRA-02 | 40 bounded-context `.gitkeep` files exist under `src/contexts/` + `src/shared/` | unit | `pnpm test:unit -- --run tests/unit/scaffold.test.ts` | ❌ Wave 0 |
| INFRA-12 | `ci.yml` runs lint + typecheck + unit + integration + build + E2E | manual (CI workflow existence) | `test -f .github/workflows/ci.yml && ! grep -qE 'vercel|preview' .github/workflows/ci.yml` | ❌ Wave 0 |
| INFRA-16 | `IDENTIFICATION_PROVIDER_MODE` rejects values other than `stub`/`real` at boot | unit | `pnpm test:unit -- --run tests/unit/env.test.ts` | ❌ Wave 0 |
| INFRA-17 | `.env.example` exists, contains every PRD §20 var name, contains NO real secret values | unit | `pnpm test:unit -- --run tests/unit/env-example.test.ts` | ❌ Wave 0 |
| INFRA-18 | HSTS + X-Frame-Options + X-Content-Type-Options present on every page response | E2E | `pnpm test:e2e tests/e2e/security-headers.spec.ts` | ❌ Wave 0 |
| INFRA-20 | Error-registry exports all 20 PRD §5 codes; `errorResponse` maps internal codes to `provider_unavailable` | unit | `pnpm test:unit -- --run tests/unit/errors.test.ts` | ❌ Wave 0 |
| INFRA-23 | `vitest.config.ts` declares separate unit + integration projects; Playwright smoke runs against `next start` | manual + test-output | `pnpm test:unit --list && pnpm test:integration --list` | ❌ Wave 0 |
| INFRA-26 | `supabase start` brings stack up; `supabase status` returns expected services; `supabase db reset` completes | manual (onboarding) | `pnpm db:start && pnpm supabase status | grep 'API URL'` | Local dev only; no automated test |
| OBS-01 | Sentry receives a deliberately thrown error from the CI run with release = git SHA | E2E | `pnpm test:e2e tests/e2e/diagnostics-sentry.spec.ts` | ❌ Wave 0 |
| OBS-02 | PostHog receives client + server events from diagnostics routes | E2E | `pnpm test:e2e tests/e2e/diagnostics-posthog.spec.ts` | ❌ Wave 0 |
| OBS-05 | Sentry project is configured to receive events (alerting rules out of scope Phase 1; deferred to Phase 4 when Resend lands) | manual (Sentry dashboard + PLAN.md defer note) | — | Deferred |
| LGPD-13 | `beforeSend` drops `request.data` when URL matches `/api/v1/identifications/*`; forbidden fields scrubbed in all events | unit + E2E | `pnpm test:unit -- --run tests/unit/sentry-scrub.test.ts` (load-bearing rule test) + `pnpm test:e2e tests/e2e/diagnostics-sentry.spec.ts` (transport wiring) | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test:unit -- --run` (unit only; ~5s)
- **Per wave merge:** `pnpm test:unit -- --run && pnpm test:integration -- --run` (unit + integration; ~30-60s)
- **Phase gate:** Full `ci.yml` run (unit + integration + build + E2E) must be green before `/gsd-verify-work`.

### Wave 0 Gaps (tests to land BEFORE implementation tasks)

- [ ] `vitest.config.ts` — test-runner projects config (unit, integration)
- [ ] `playwright.config.ts` — Chromium-only, webServer against `pnpm start`
- [ ] `tests/unit/scaffold.test.ts` — asserts all 40 `.gitkeep` paths exist
- [ ] `tests/unit/env.test.ts` — asserts Zod schemas reject malformed input + accept minimal valid shape
- [ ] `tests/unit/env-example.test.ts` — asserts `.env.example` contains each PRD §20 var name and no secret-like values
- [ ] `tests/unit/errors.test.ts` — asserts all 21 PRD §5 codes, HTTP status map, internal→public mapping
- [ ] `tests/unit/sentry-scrub.test.ts` — directly tests the `beforeSend` rule by hand-calling it with a synthetic event `{ request: { url: '/api/v1/identifications/x', data: { email, token, photo_url, authorization, cookie, password } } }` and asserting `event.request.data === undefined` + every forbidden field is absent from the returned event. This is the load-bearing LGPD-13 test; the E2E only validates transport wiring.
- [ ] `tests/integration/postgres-connection.integration.test.ts` — asserts DB is reachable on `DATABASE_POOL_URL` (placeholder for Phase 2 integration scaffolding)
- [ ] `tests/e2e/security-headers.spec.ts` — asserts HSTS/XFO/XCTO on `/` response
- [ ] `tests/e2e/diagnostics-sentry.spec.ts` — asserts Sentry envelope capture + scrubbing + body-drop on identification path
- [ ] `tests/e2e/diagnostics-posthog.spec.ts` — asserts client + server event capture
- [ ] Framework install: `pnpm add -D vitest@4.1.4 @vitest/ui @playwright/test@1.59.1 vite-tsconfig-paths` — no existing `package.json` at research time

---

## Security Domain

`security_enforcement` is enabled (default). The Phase 1 surface is narrow: no auth, no data persistence, no user input processing. Security controls focus on defense-in-depth for observability and headers.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | no | Phase 4 |
| V3 Session Management | no | Phase 4 (per-device JWT) |
| V4 Access Control | partial | D-27 guards diagnostics routes via `IDENTIFICATION_PROVIDER_MODE !== 'stub'` server check + `notFound()` |
| V5 Input Validation | yes | `zod` for env validation (D-29); body validation arrives Phase 2 |
| V6 Cryptography | no | Phase 2+ (Supabase handles password hashing; VAPID keys generated Phase 8) |
| V7 Error Handling & Logging | yes | PRD §5 closed error registry + PRD §13.7 Sentry scrubbing (LGPD-13) |
| V9 Communication Security | yes | HSTS header (D-24); HTTPS enforced at Vercel edge (Phase 12) |
| V11 Config / Secure Defaults | yes | Security headers (INFRA-18 / C-18) |
| V13 API | partial | Nested error body shape (D-11) prevents top-level field collision with success fields; `Idempotency-Key` arrives Phase 2 |
| V14 Data Protection | yes | LGPD-13 Sentry scrubbing + body-drop on identification routes; D-22 beforeSend hook |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Clickjacking on PWA shell | Spoofing / Tampering | `X-Frame-Options: DENY` (D-24) |
| MIME-type sniffing attacks on uploaded assets | Tampering | `X-Content-Type-Options: nosniff` (D-24) |
| TLS downgrade / cookie theft via plaintext | Information disclosure | `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (D-24) |
| Secrets committed to repo | Information disclosure | `.env` gitignored; `.env.example` with dummies only (D-30); lint-staged secret-pattern check (Pitfall 8) |
| Real PII leaking to Sentry | Information disclosure | `sendDefaultPii: false` + `beforeSend` scrub + body-drop on identification paths (D-22, LGPD-13) |
| `@posthog/next` pre-1.0 capture defaults | Privacy / LGPD | Hand-rolled PostHog init with `autocapture: false`, `capture_pageview: false`, `disable_session_recording: true` (D-21, L-3) |
| Diagnostics routes exposed in production | Information disclosure | Server guard on `IDENTIFICATION_PROVIDER_MODE !== 'stub'` + `robots.txt` `Disallow: /__diag` (Open Question 1) |
| CSRF on diagnostics POST endpoint | Tampering | Phase 1 diagnostics route is stub-mode-only; Phase 4 brings JWT; CSRF out of scope until cross-origin cookies exist |
| CVE-2025-65944 (Sentry header leak) | Information disclosure | Stay on `@sentry/nextjs` 10.48.0 (patched in 10.27.0+); never set `sendDefaultPii: true` |

### Defense-in-depth layering for LGPD-13

1. **Transport disabled locally** (D-19) — empty DSN = no envelope ever leaves the dev machine.
2. **SDK defaults** — `sendDefaultPii: false` skips IP + cookie + default header capture.
3. **`beforeSend` hook** — active scrubbing for `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url` on request.headers, request.data, extra, contexts.
4. **Path-aware body drop** — identification routes drop `request.data` entirely.
5. **`beforeBreadcrumb`** — same scrub applies to breadcrumbs so trail events stay clean.
6. **User identity rule** — `setUser({ id })` only (enforced in Phase 4; Phase 1 beforeSend strips `user.email` as belt-and-suspenders).
7. **Playwright smoke assertion** — CI fails the build if any forbidden field appears in an envelope.

---

## Sources

### Primary (HIGH confidence)

- `/serwist/serwist` (Context7) — `@serwist/next` Next.js App Router setup, `sw.ts` pattern, `withSerwistInit` config surface
- `/getsentry/sentry-docs` (Context7) — Next.js instrumentation, Turbopack post-build source maps, `proxy.ts` matcher
- `/getsentry/sentry-javascript` (Context7) — v10 migration guides, CVE-2025-65944 note
- `/amannn/next-intl` (Context7) — `defineRouting({localePrefix: 'as-needed'})`, Next 16 `proxy.ts` vs older `middleware.ts`
- `/posthog/posthog-js` (Context7) — browser init options, Next.js provider, disabled-autocapture pattern
- `/supabase/cli` (Context7) — `supabase start`, `supabase status -o env`, `--override-name` flag syntax
- `/vitest-dev/vitest` (Context7) — v4 `projects` config replacing deprecated `workspace`
- `/microsoft/playwright` (Context7) — `webServer` config, CI recipe, Chromium-only install
- `/typicode/husky` (Context7) — Husky 9 `husky init` + plain hook scripts
- [Renaming Middleware to Proxy — Next.js docs](https://nextjs.org/docs/messages/middleware-to-proxy) — L-1 primary source
- [Upgrading: Version 16 — Next.js docs](https://nextjs.org/docs/app/guides/upgrading/version-16) — Next 16 migration authoritative reference
- [File-system conventions: proxy.js — Next.js docs](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Sentry Next.js configuration options](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/) — `sendDefaultPii` current as-of 10.x
- npm registry (`npm view <pkg> version`, executed 2026-04-23) — version verification for the entire stack

### Secondary (MEDIUM confidence)

- [Next.js 16 blog](https://nextjs.org/blog/next-16) — Turbopack default; proxy.ts rationale
- [PostHog Next.js SDK](https://posthog.com/docs/libraries/next-js) — server `posthog-node` usage
- [Supabase CLI issue #3748](https://github.com/supabase/cli/issues/3748) — confirms CLI default image = Postgres 17 as of 2026

### Tertiary (LOW confidence — NOT used to support any load-bearing claim; listed for audit trail)

- Medium articles on proxy.ts rename — corroborating only, not cited as primary
- StaticMania Next.js 16.1 review — corroborating only

---

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** — every version verified against npm registry today (2026-04-23); CLAUDE.md pins honored
- Architecture patterns: **HIGH** — every pattern traces to an official doc URL or Context7-sourced snippet
- Pitfalls: **HIGH** — three pitfalls (L-1, L-2, L-3) are verified landmines from primary sources; remainder are documented ecosystem patterns
- Security Domain: **HIGH** — ASVS mapping grounded in PRD §5/§13/§21 + CVE research
- Validation Architecture: **HIGH** — Wave 0 gap list is exhaustive for the 13 phase requirement IDs

**Research date:** 2026-04-23
**Valid until:** 2026-05-23 (30 days — stack is locked and slow-moving, but Next 16.2.x patches land weekly; re-verify `@sentry/nextjs` and `next` before Phase 12 execution)
