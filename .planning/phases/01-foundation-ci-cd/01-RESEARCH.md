# Phase 1: Foundation & CI/CD — Research

**Researched:** 2026-04-14
**Domain:** Next.js 16 greenfield scaffold + GitHub-Actions-only CI/CD + observability baseline (Sentry + PostHog) + security headers + Serwist PWA shell + Supabase branching
**Confidence:** HIGH on stack/versions; HIGH on patterns; MEDIUM on CI orchestration specifics (Supabase branching API surface changes frequently); HIGH on Sentry scrubbing patterns

## Summary

Phase 1 is a greenfield, zero-feature foundation phase. It proves a deployable Next 16 skeleton where every PR runs lint + typecheck + Vitest unit + Vitest integration (against `postgres:16-alpine`) + Playwright (against a real Vercel preview URL bound to a per-PR Supabase branch DB), and where merging to `main` deploys to production via `vercel deploy --prebuilt --prod` with Sentry release + source maps + Inngest sync — all orchestrated exclusively from GitHub Actions (Vercel git integration OFF).

The stack is 100% locked by `CONTEXT.md` and `CLAUDE.md`. This research confirms that **every locked decision is still implementable with current library versions**, surfaces **one important contradiction** between CONTEXT.md D-19 and current Sentry Next.js docs (the explicit `sentry-cli sourcemaps upload` step is no longer required — `withSentryConfig` handles post-build upload natively for Turbopack as of `@sentry/nextjs@10.13.0+` and `next@15.4.1+`, and we are on `10.48.0` / `16.2.3`), and surfaces **one important simplification** from Next.js 16's release notes (Turbopack is now the default — `next build --turbopack` flag is unnecessary).

**Primary recommendation:** Scaffold with `pnpm dlx create-next-app@16.2.3 --ts --app --no-src-dir=false --no-tailwind --no-eslint=false --import-alias "@/*"` (or hand-author `package.json` — there's nothing magical in the scaffold output), then layer on: `@serwist/next@9.5.7`, `next-intl@4.9.1` in single-locale no-routing mode, `drizzle-orm@0.45.2` + `drizzle-kit@0.31.10` + `postgres@3.4.9` with `{ prepare: false }`, `@sentry/nextjs@10.48.0` with `withSentryConfig` native source map upload (NOT explicit sentry-cli), `posthog-js@1.369.0` client with `opt_out_capturing_by_default: true` + `posthog-node@5.29.2` server with US host, `inngest@4.2.2` serving from `/api/inngest/route.ts`, and middleware-based CSP + HSTS + X-Frame-Options. All four GitHub Actions workflows (ci, deploy-preview, deploy-production, deploy-preview-cleanup) use the `pnpm/action-setup` + `actions/setup-node@v4` + Vercel CLI + Supabase CLI toolchain.

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
- **D-20:** CSP is **report-only in preview** for at least the first week after Phase 1 ships, **enforced in production** day 1 using `default-src 'self'` + explicit allowlists for `sentry.io`, `us.i.posthog.com`, `*.supabase.co`, `api.stripe.com`. Violation reports to a Sentry transport. No nonce-based scripts in Phase 1.
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
| OBS-02 | PostHog US cloud integrated (client + server via `posthog-node`); LGPD Art. 33 transfer basis (PostHog SCCs) compliant | Standard Stack; Code Examples > PostHog client init with `api_host: 'https://us.i.posthog.com'` + server `posthog-node` |
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
| `posthog-js` | 1.369.0 | Product analytics client | [VERIFIED: npm registry] US host via `api_host: 'https://us.i.posthog.com'`; `opt_out_capturing_by_default: true` for LGPD consent [CITED: posthog/posthog-js Context7] |
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
                     │          │           │         │  PostHog US cloud    │
                     │          ▼           │         │  (us.i.posthog.com)    │
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
    'https://us.i.posthog.com',
    'https://us-assets.i.posthog.com',
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
- The Sentry project and PostHog US project (must exist for DSN/API key to issue).

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
| PostHog default `capture_pageview: 'history_change'` + autocapture on | PostHog `autocapture: false` + explicit named events + consent-gated opt-in | D-17/D-18 decision + LGPD Art. 33 transfer basis (PostHog SCCs) | Lower event volume, predictable taxonomy, clean LGPD posture |
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
| A9 | CSP allowlist for PostHog US includes both `us.i.posthog.com` and `us-assets.i.posthog.com` | Code Examples > middleware | Medium — PostHog has ingest vs asset hostnames; the exact set should be verified against PostHog's current docs at plan time |
| A10 | Vercel git integration being OFF is a one-time manual dashboard toggle that cannot be automated via CLI | Phase Requirements INFRA-11 | Low — this is a known Vercel dashboard-only setting; document in Phase 1 runbook |

**Empty-table escape:** Not applicable — assumptions above are real and the planner should weigh them.

## Open Questions

1. **D-19 is contradicted by current Sentry docs. What does the user want to do?**
   - What we know: CONTEXT.md D-19 locks an explicit `sentry-cli sourcemaps upload` step citing "Turbopack compatibility risk." Current Sentry docs confirm that `@sentry/nextjs@10.13.0+` (we're on 10.48.0) natively handles Turbopack post-build upload via `withSentryConfig`, on `next@15.4.1+` (we're on 16.2.3).
   - What's unclear: Did the user know about the native path when they locked D-19, or was their information stale?
   - Recommendation: Planner should flag this as a single-question mini-discussion before planning writes tasks. If the user says "keep D-19 as-is," the plan implements the explicit sentry-cli step exactly as specified. If the user switches, the plan is simpler (one less CI step) and uses `withSentryConfig` native upload.

2. **Does the human operator need to pre-create the Supabase project, Vercel project, Sentry project, and PostHog US project before Phase 1's first CI run?**
   - What we know: Yes — all four services must have a project existing and secrets issued before CI can consume them.
   - What's unclear: Has this been done? CONTEXT.md mentions "Supabase project must exist with branching enabled" in the integration points section but doesn't confirm status.
   - Recommendation: Plan should include a Wave 0 "operator setup" task that is a checklist (not a code task) for the human to tick off before Wave 1 runs. If this is already done, the task is a no-op verification.

3. **What Supabase Postgres version should `postgres:16-alpine` mirror in CI?**
   - What we know: Supabase's default Postgres version varies by project creation date — recent projects default to 17.x, older to 15.x.
   - What's unclear: Which version is the Folhário Supabase project on?
   - Recommendation: Pick the version matching the actual Supabase project. If 17.x is the Supabase version, use `postgres:17-alpine` in CI for parity.

4. **Exact CSP allowlist strings for PostHog US, Sentry ingest, and Stripe.**
   - What we know: The allowlist needs to include PostHog US ingest + assets hosts, Sentry ingest host, Stripe API host, Supabase project host.
   - What's unclear: PostHog specifically has been migrating between `us.i.posthog.com` and `us-assets.i.posthog.com` hosts; exact strings should be pulled from PostHog's current US hostname list at plan time.
   - Recommendation: Plan task includes "curl + grep PostHog docs for current US hostnames before writing the CSP constant."

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
| PostHog US project + API key | OBS-02 | ⚠ Unknown | — | **Blocks first CI run until human creates project.** See Open Question 2. |
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
| SC-4 part e / OBS-02 | PostHog US client + `posthog-node` server are connected | e2e + unit | Unit: PostHog client factory asserted to use `api_host: 'https://us.i.posthog.com'` + `opt_out_capturing_by_default: true`. E2E: smoke fires a ping event via server-side `posthog-node` from a health endpoint, asserts HTTP 200 to `us.i.posthog.com` (mocked via Playwright route() OR verified via PostHog events API) | ❌ Wave 0 |
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
- **PostHog US cloud (LGPD Art. 33 transfer basis (PostHog SCCs))** — locked in Standard Stack
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
- **Context7** `/posthog/posthog-js` — `opt_out_capturing_by_default` + US host + `opt_in_capturing(...)` pattern
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
- Exact current PostHog US hostnames for CSP allowlist — flagged in Open Question 4
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
