# Phase 1: Foundation - Context

**Gathered:** 2026-04-22 (power mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

A Next 16 App Router skeleton that a developer can run **locally end-to-end** — `pnpm dev` against a **local Supabase Docker stack** — with:
- TypeScript strict + pt-BR locale + `@serwist/next` PWA wiring
- Bounded-context folder layout from PRD §2 established (empty)
- Sentry + PostHog wired and **verified in CI only** (disabled locally)
- Security headers applied via Next middleware
- Closed error-code registry from PRD §5 as a single importable source
- `IDENTIFICATION_PROVIDER_MODE` env gate
- `ci.yml` running lint + typecheck + Vitest unit + Vitest integration (Postgres service container) + `next build` + local-build Playwright smoke

**Explicitly NOT in scope for Phase 1:**
- Vercel project, preview URLs, deploy workflows (Phase 12)
- Inngest onboarding (Phase 4 — first async consumer = verification email)
- Resend onboarding (Phase 4)
- Stripe onboarding (Phase 10)
- Drizzle schema / migrations / adapters (Phase 2)
- Design system, bottom-nav, app shell (Phase 3)

</domain>

<decisions>
## Implementation Decisions

### Tooling & Scaffold
- **D-01:** Node **22 LTS**, pinned via `.nvmrc` + `engines` field in `package.json`. `.nvmrc` is committed at the repo root.
- **D-02:** pnpm activated via **Corepack** using the `packageManager` field in `package.json` (e.g. `pnpm@9.x.y`). No global install step for devs.
- **D-03:** **ESLint (Next.js flat config) + Prettier**. Separate tools, standard ecosystem.
- **D-04:** **Husky + lint-staged + commitlint** (Conventional Commits). Pre-commit runs format + lint on staged files; commit messages must follow Conventional Commits.
- **D-05:** **npm scripts only** for task orchestration. No justfile, no turbo. Everything in `package.json` `scripts`.

### TypeScript & Code Style
- **D-06:** TS strictness = the locked INFRA-01 minimum: `strict: true` + `noUncheckedIndexedAccess: true`. No additional strict flags added (kept tight vs exactOptional / noPropertyAccessFromIndexSignature to avoid friction during early phases).
- **D-07:** Path aliases **per-root**: `@contexts/*` → `src/contexts/*`, `@shared/*` → `src/shared/*`. No generic `@/*` alias.
- **D-08:** **No barrel files.** Direct imports only (`import { X } from '@contexts/iam/domain/user'`). Avoids cycles and preserves tree-shaking.

### Folder Structure & Error Registry
- **D-09:** Phase 1 ships the full PRD §2 folder tree as **empty directories with `.gitkeep`** — 7 contexts × 5 layers + 5 shared subdirs. No README stubs, no layer-marker files. Downstream phases fill the folders.
- **D-10:** Error-code registry shape = **`as const` object + string-literal union type**. ESM-friendly, tree-shakeable, no enum footguns. Example:
  ```ts
  export const ErrorCode = { Unauthenticated: 'unauthenticated', /*...*/ } as const;
  export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];
  ```
- **D-11:** Error response body = **`{ error: { code, message, details? } }`** (nested error object). Top-level reserved for success fields.
- **D-12:** Registry location = **`src/shared/config/errors.ts`** — co-located with config. The HTTP mapper helper ships alongside it in the same module.

### PWA & Internationalization
- **D-13:** Serwist = **skeleton only**. `@serwist/next` wired + service worker registers, but no precache, no offline page. Phase 3 ships the functional offline shell.
- **D-14:** Manifest = **minimal placeholder** (`name`, `short_name`, `display: standalone`, `theme_color`). No icons yet. Phase 3 rewrites with the Paper Cream assets.
- **D-15:** next-intl routing = **`as-needed` prefix** (pt-BR served at root, future locales get `/en-US/...`). Clean URLs today, zero migration when v2 adds locales.

### Local Supabase Dev Environment
- **D-16:** Supabase CLI pinned via **npm devDependency** (`supabase` package in `package.json`). Runs via `pnpm supabase ...`. Everyone matches the lockfile automatically. **Supabase local stack runs Postgres 17** — CLI version pinned to whatever ships Postgres 17.
- **D-17:** **No seed file** at Phase 1. `supabase/seed.sql` is introduced in Phase 2 alongside the Drizzle schema.
- **D-18:** Local env sync via **automated script `scripts/sync-supabase-env.sh`**. Script parses `supabase status` output and writes `.env.local` with `DATABASE_URL`, `DATABASE_POOL_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Developers run once per `supabase start` / reset.

### Observability — Sentry + PostHog
- **D-19:** Sentry **disabled locally**; verification happens in CI via the Playwright smoke against a dedicated Sentry project. Local `NEXT_PUBLIC_SENTRY_DSN` empty by default. Resolves the PRD §20 vs ROADMAP success-criterion-4 conflict in favor of the PRD §20 table.
- **D-20:** PostHog **disabled locally**; CI-only verification. Local `NEXT_PUBLIC_POSTHOG_KEY` empty by default. Matches D-19 posture.
- **D-21:** PostHog autocapture **disabled**. Only the explicit PRD §20 taxonomy events fire. Smallest payload, safest LGPD stance.
- **D-22:** Sentry PII scrubbing = **SDK built-ins (`denyUrls`, `sendDefaultPii: false`) + minimal `beforeSend` hook** that drops request bodies on `/api/v1/identifications/*`. Scrub rules cover `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`. `Sentry.setUser({ id })` only — never email.

### Security Headers Middleware
- **D-23:** **No CSP at Phase 1.** CSP deferred to a later phase (see Deferred Ideas). User directive: "CSP is a bitch — defer to as late as possible."
- **D-24:** Header set = **minimum viable**: HSTS + `X-Frame-Options: DENY` + `X-Content-Type-Options: nosniff`. `Referrer-Policy` and `Permissions-Policy` deferred to a later hardening phase (see Deferred Ideas).

### CI Pipeline Design
- **D-25:** Integration tests run against **`postgres:17-alpine`** service container in `ci.yml`. Resolves the ROADMAP success-criterion-3 vs INFRA-12/PRD §20 conflict in favor of Postgres 17 to match local Supabase. **The version is pinned locally too** — the Supabase CLI devDependency (D-16) locks Postgres 17. **Requirement doc update needed:** INFRA-12 says `postgres:16-alpine`; update to `postgres:17-alpine`. Configure the service container with **only needed features** (no extensions beyond what Phase 2's Drizzle schema will require).
- **D-26:** Playwright browsers = **Chromium only** in Phase 1 CI smoke. WebKit + Firefox can be added later when iOS-specific concerns emerge.
- **D-27 (Claude's Discretion):** Phase 1 Playwright smoke asserts via **dedicated diagnostics routes** — a throwaway `/__diag` client page + `/api/v1/_diagnostics/ping` server route that together trigger `Sentry.captureException` and `posthog.capture` on both layers. Playwright intercepts outbound transport calls to Sentry + PostHog endpoints and asserts: (a) the events fire, (b) scrubbing removed the forbidden fields. Routes are gated to CI/preview via an env flag and never exposed in production. _(User instructed Claude to decide; this is the clean, testable approach.)_
- **D-28:** CI caching + concurrency = **pnpm store cache + Playwright browser cache via `actions/cache`** + **GitHub Actions concurrency group per PR** (cancels superseded in-flight runs).

### Env Management
- **D-29:** Typed env validation = **custom `src/shared/config/env.ts` with Zod**. No extra dep (Zod is already pulled in for route body validation via Phase 2). Fails fast at module load. Splits server vs client via `NEXT_PUBLIC_` prefix convention.
- **D-30:** `.env.example` = **all PRD §20 vars listed with dummy values**. Forward-looking onboarding artifact. Comments group vars by phase of first use so devs know which services are live.

### Claude's Discretion
- **D-27** (Playwright smoke assertion design) — user instructed Claude to decide; approach documented above.
- Exact Node 22 patch version (lock the latest LTS patch available at Phase 1 start)
- Exact pnpm version pinned in `packageManager` field (lock latest stable in the 9.x line)
- Exact commitlint config (start from `@commitlint/config-conventional`; no custom rules yet)
- Exact Zod schemas in `src/shared/config/env.ts` (shape derived from PRD §20 table, with server/client split)
- The exact set of scripts in `package.json` (`dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:integration`, `test:e2e`, `db:start`, `db:reset`, `db:sync-env`, `supabase`, etc.)
- Folder structure under `scripts/` for dev helpers

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product + scope
- `.planning/PROJECT.md` — Core value, constraints, key decisions, launch blockers
- `.planning/REQUIREMENTS.md` — INFRA-01, INFRA-02, INFRA-12, INFRA-16, INFRA-17, INFRA-18, INFRA-20, INFRA-23, INFRA-26, OBS-01, OBS-02, OBS-05, LGPD-13
- `.planning/ROADMAP.md` §Phase 1 — Goal + 5 success criteria
- `CLAUDE.md` — Stack lock-in (Next 16.2.3, React 19.2.5, Serwist 9.5.7, Sentry 10.48.0, PostHog 1.368.0, next-intl 4.9.1, Vitest 4.1.4, Playwright 1.59.1)

### Repo layout + tech stack
- `docs/CAVE-PRD.md` §2 — Tech Stack table; `src/contexts/{...}/{domain,application,infrastructure,api,inngest}/` + `src/shared/{db,events,adapters,config,telemetry}/` folder tree; route-handler rules (thin: validate → use-case → HTTP map; no Drizzle in handlers)
- `docs/CAVE-PRD.md` §3 — Bounded contexts + their aggregates/events (reference for future phases)

### Error model
- `docs/CAVE-PRD.md` §5 — CLOSED error-code registry (20 codes with HTTP statuses), pagination + idempotency conventions, timestamp format

### LGPD + Sentry scrubbing
- `docs/CAVE-PRD.md` §13.7 (Sentry PII scrubbing) — scrub `Authorization`, `Cookie`, `email`, `password`, `token`, `photo_url`; DROP request bodies on identification routes; users MUST NOT appear in breadcrumbs by email
- `docs/CAVE-PRD.md` §13 — Legal basis table, Art. 18 rights, Art. 33 international transfer (informs env var naming + PostHog region choice)

### Security + observability
- `docs/CAVE-PRD.md` §21 — Security checklist (JWT middleware, Stripe webhook sig, RLS, scrubbing, headers, rate limiting) + Observability targets

### Testing + CI/CD + environments
- `docs/CAVE-PRD.md` §19 — Testing layers: unit + integration (REAL Postgres, zero DB mocking, migrations applied as in production) + Playwright E2E
- `docs/CAVE-PRD.md` §20 — Environments table (Local/Preview/Prod for each tool), GitHub Actions workflow contract (`ci.yml` for Phase 1; others deferred), env var table (20+ vars)

### Design system (for Phase 3 awareness, not Phase 1 implementation)
- `docs/CAVE-PRD.md` §17, §18 — Not implemented in Phase 1 but referenced by Serwist/manifest D-13/D-14 deferral reasoning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`.env`** at repo root already contains slots for `NEXT_PUBLIC_SUPABASE_URL`, `SENTRY_*`, `INNGEST_*`, `VERCEL_*`, `IDENTIFICATION_PROVIDER_MODE`, `DATABASE_URL`/`DATABASE_POOL_URL`. Variable names match PRD §20 — `.env.example` per D-30 should mirror these names. Developer has already provisioned real credentials; scripts must never overwrite `.env` itself (sync only to `.env.local`).
- **No pre-existing code** at `src/`, no `package.json`, no `tsconfig.json`. Phase 1 creates the repo scaffold from zero. `.gitignore` contains only `.DS_Store` — Phase 1 must extend it (`node_modules`, `.env.local`, `.next`, `coverage`, `playwright-report`, `test-results`, `.supabase`, etc.).

### Established Patterns
- **None yet** — this is the founding phase. Patterns established here propagate to every later phase.

### Integration Points
- `src/shared/config/errors.ts` (D-10, D-12) — imported by every future route handler
- `src/shared/config/env.ts` (D-29) — imported at boot by server + client entry points
- Middleware at `src/middleware.ts` — security headers (D-24) + placeholder for Phase 2's JWT verification on `/api/v1/*`
- `src/contexts/*/` empty dirs — Phase 2 fills `infrastructure/db` and `api/`; Phases 4+ fill feature code
- `scripts/sync-supabase-env.sh` (D-18) — invoked via `pnpm db:sync-env`; other phases may add to `scripts/` as needed

</code_context>

<specifics>
## Specific Ideas

- **Create `.nvmrc` locally** (user note on Q-01). Commit it at repo root. Content: `22` or the exact Node 22 LTS patch version chosen.
- **Postgres version lock parity** (user note on Q-25): local Supabase runs Postgres 17 → CI Postgres service container runs Postgres 17 → both pinned to the same major. "Enable only the needed features" on the CI service container — no Postgres extensions beyond what the Drizzle schema (Phase 2) demands. Phase 1 pins the service image but doesn't yet install extensions (there's no schema yet).
- **Local dev never pings Sentry or PostHog** — this is a deliberate developer-experience choice. Devs who need to eyeball scrubbing can flip env vars on a per-session basis, but the committed `.env.local` template keeps them blank.
- **Diagnostics routes are CI/preview-only** — `/__diag` and `/api/v1/_diagnostics/ping` must refuse to render in production (`IDENTIFICATION_PROVIDER_MODE !== 'stub'` OR equivalent guard) to avoid surface area leakage.
- **`.env.example` mirrors PRD §20** — variable names must match exactly (case-sensitive) so copy-paste into real `.env` works.
- **Zod for env validation** (not @t3-oss/env-nextjs) — aligns with D-29 "no extra dep" plus Zod will be reused for route body validation starting Phase 2.

</specifics>

<deferred>
## Deferred Ideas

Moved out of Phase 1 scope for later phases / hardening passes:

- **CSP (Content Security Policy)** — explicitly deferred per user directive ("CSP is a bitch, defer to as late as possible"). Candidate landing spots: Phase 3 (once the design-system surface is known and inline styles/scripts are minimized) or a dedicated "security hardening" phase before launch. Should land in report-only mode first, then enforce.
- **Expanded security headers** (`Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` denying camera/mic/geolocation except for Phase 6's identify route) — user note: "defer this to the very end if possible." Candidate: late-phase hardening pass before Phase 12 (Deploy Pipeline).
- **Playwright WebKit + Firefox** — Chromium-only at Phase 1. Add WebKit when iOS PWA install issues surface; add Firefox if usage data justifies.
- **Full manifest with Paper Cream icon set** — Phase 3 (Design System).
- **Functional offline shell + precache rules + app-update toast** — Phase 3 (Design System, per UI-17, UI-24, OFF-09, OFF-10).
- **Drizzle schema, migrations, RLS, adapters, image pipeline** — Phase 2 (per INFRA-03..09, 19, 21, 22, 24).
- **Inngest onboarding** — Phase 4 (first async consumer = verification email, per INFRA-10).
- **Resend + React Email templates** — Phase 4 (per NOTIF-01, 02).
- **Vercel project + deploy workflows + Supabase branch DBs** — Phase 12 (per INFRA-11, 13, 14, 15).
- **Sentry source-map upload** — Phase 12 (currently OBS-01 is mapped to Phase 1 in the traceability table, but source-map upload requires a production build + Sentry CLI in the deploy workflow — document the source-map config in Phase 1, actual upload runs in Phase 12's `deploy-production.yml`).
- **Explicit `Sentry.setUser({ id })` wiring** — Phase 4 (when auth lands and a user id exists).

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-22 (power mode, 29/30 answered + 1 Claude's discretion)*
