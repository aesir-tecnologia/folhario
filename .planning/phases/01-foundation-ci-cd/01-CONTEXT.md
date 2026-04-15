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
