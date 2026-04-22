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
