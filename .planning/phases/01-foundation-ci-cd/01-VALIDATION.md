---
phase: 1
slug: foundation-ci-cd
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution. Derived from `01-RESEARCH.md#Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Unit + integration framework** | `vitest@4.1.4` |
| **E2E framework** | `@playwright/test@1.59.1` (Chromium only — D-10) |
| **Unit config file** | `vitest.config.ts` (`projects.unit`) — Wave 0 |
| **Integration config file** | `vitest.config.ts` (`projects.integration`, `pool: 'forks'`, `setupFiles: ['tests/integration/setup.ts']`) — Wave 0 |
| **E2E config file** | `playwright.config.ts` (`baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL`) — Wave 0 |
| **Quick run command** | `pnpm test:unit` |
| **Full suite command** | `pnpm lint && pnpm typecheck && pnpm test:unit && pnpm test:integration && pnpm build` |
| **E2E smoke command** | `pnpm test:e2e` (requires `PLAYWRIGHT_TEST_BASE_URL` set to preview URL) |
| **Estimated runtime** | Unit ≤ 30s · Integration ≤ 90s (first run pulls `postgres:17-alpine`) · Full ≤ 3min · E2E ≤ 60s |

> **Watch-mode ban:** `pnpm test:unit`, `pnpm test:integration`, and `pnpm test:e2e` are the ONLY supported forms. The scripts in `package.json` (plan 02) already use `vitest run --project …` internally — do NOT append `--run` at the call site because the script body already includes it. `pnpm test` (without a `:unit`/`:integration`/`:e2e` suffix) and any form that invokes bare `vitest` are banned (CLAUDE.md rule).

---

## Sampling Rate

- **After every task commit:** Run `pnpm test:unit` (quick path, <30s)
- **After every plan wave:** Run the full suite command above
- **Before `/gsd-verify-work`:** Full suite must be green AND `deploy-preview.yml` must be green on a throwaway PR that exercises every SC invariant below
- **Max feedback latency:** 30 seconds (unit path)

---

## Per-Invariant Verification Map

Phase 1 is greenfield — no task IDs exist yet. Plans will wire task IDs into this map during planning (Nyquist auditor updates post-planning). Each row below corresponds to a Phase 1 success-criterion invariant from `01-RESEARCH.md`.

| Invariant ID | Requirement | Plan (post-planning) | Wave | Secure Behavior | Test Type | Automated Command / Assertion | Wave 0 Gap | Status |
|-----|-----|-----|-----|-----|-----|-----|-----|-----|
| SC-1a | INFRA-01 | TBD | TBD | Next 16 App Router app builds | build | `pnpm build` exits 0 | ✅ | ⬜ pending |
| SC-1b | INFRA-01 | TBD | TBD | TS strict + `noUncheckedIndexedAccess` | unit + typecheck | `pnpm typecheck` exits 0 + `tests/unit/tsconfig.test.ts` imports `tsconfig.json` and asserts `strict: true` + `noUncheckedIndexedAccess: true` + all D-06 flags | ✅ | ⬜ pending |
| SC-1c | INFRA-01, D-25 | TBD | TBD | pt-BR locale, `<html lang="pt-BR">` | unit + e2e | Unit: RTL renders `<RootLayout>`, asserts `<html lang="pt-BR">`. E2E: `expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR')` on `/` | ✅ | ⬜ pending |
| SC-1d | INFRA-01, D-26 | TBD | TBD | Serwist SW registers | e2e | Playwright navigates `/`, asserts `navigator.serviceWorker.getRegistration('/')` resolves | ✅ | ⬜ pending |
| SC-1e | INFRA-02, D-08 | TBD | TBD | Bounded-context folder layout scaffolded | unit | `tests/unit/folder-scaffold.test.ts` walks `src/contexts/**` + `src/shared/**`, asserts every required subfolder and `README.md` exists | ✅ | ⬜ pending |
| SC-2a | INFRA-12 | TBD | TBD | `ci.yml` runs lint + typecheck + unit + integration | CI | `ci.yml` job green on throwaway PR (gate via `act` locally is optional) | ✅ | ⬜ pending |
| SC-2b | INFRA-12 | 13 | 3 | Integration vs `postgres:17-alpine` service container with drizzle-kit migrate + D-14 per-test rollback | integration | `pnpm test:integration` — at minimum `tests/integration/health.test.ts` executes `SELECT 1` through the Drizzle client inside a `sql.begin` fixture that rolls back | ✅ | ⬜ pending |
| SC-2c | INFRA-13 | 13 | 3 | Playwright vs preview URL bound to Supabase branch DB | e2e | `deploy-preview.yml` Playwright job green; smoke polls `GET /api/v1/health` until `db === 'ok'` (30s budget), then asserts `{ status: 'ok', db: 'ok' }` on preview URL | ✅ | ⬜ pending |
| SC-2d | INFRA-15 | TBD | TBD | PR close cleans up branch DB + preview alias | CI + manual | `deploy-preview-cleanup.yml` completes green; manual verification of Supabase branch list + Vercel alias list after cleanup | ✅ | ⚠ manual leg |
| SC-3a | INFRA-14 | 17 | 4 | `main` merge deploys via `vercel deploy --prebuilt --prod` | CI | `deploy-production.yml` green on a staged merge | ✅ | ⬜ pending |
| SC-3b | OBS-01 | 07, 17, 18 | 2, 4, 5 | Sentry release tagged with git SHA | assertion | Plan 07: unit test asserts SDK init uses `VERCEL_GIT_COMMIT_SHA` for release name. Plan 17: non-blocking `Verify Sentry release` step in `deploy-production.yml` queries `https://sentry.io/api/0/projects/{org}/{proj}/releases/{sha}/files/` and emits `::warning::` if the artifact count is 0 (catches silent `withSentryConfig` failures). Plan 18: operator manual dashboard confirmation. | ✅ | ⬜ pending |
| SC-3c | OBS-01 | 11, 17, 18 | 2, 4, 5 | Turbopack source maps uploaded post-build via `withSentryConfig` (D-19 OVERRIDE) | assertion | Plan 11: `next.config.ts` configures `withSentryConfig` with `sourcemaps.disable: false` + `widenClientFileUpload: true`. Plan 17: same non-blocking `Verify Sentry release` step asserts artifact count > 0. Plan 18: operator confirms symbolicated stack traces in Sentry dashboard. | ✅ | ⬜ pending |
| SC-3d | INFRA-10 (cross-phase) / INFRA-14 | 17 | 4 | Inngest registration endpoint reachable (hello-world function) | assertion | `deploy-production.yml` step calls `curl -X PUT https://{prod}/api/inngest` — returns 200 with function count ≥ 1 | ✅ | ⬜ pending |
| SC-3e | INFRA-11 | 01, 18 | 0, 5 | Vercel git integration confirmed OFF | manual | Wave 0 operator checklist screenshot of Vercel project settings; re-verified in Phase 1 closing note | — | ⚠ manual |
| SC-4a | LGPD-13, D-24 | 07, 18 | 2, 5 | Deliberately thrown error reaches Sentry | unit + manual | Plan 07 unit test: `tests/unit/sentry-config.test.ts` calls `beforeSend` with a thrown-error synthetic event, asserts the returned event is non-null (not dropped) and retains `trace_id`. Plan 18: manual operator Sentry dashboard check on preview PR. *Plan 13 smoke fires the `/api/v1/_test/throw` route as a dependency ("route fires") but does NOT own the SC-4a assertion — the Sentry-side verification is too brittle to automate via Playwright (ingestion lag, API scoping).* | ✅ | ⬜ pending |
| SC-4b | LGPD-13 | 07, 18 | 2, 5 | Scrubbed fields absent from Sentry payload | unit + manual | Plan 07 unit test: `tests/unit/sentry-config.test.ts` calls `beforeSend` with synthetic events containing `email` / `password` / `photo_url` / `token` / `Authorization` / `Cookie` in `request.data`/`request.headers`/`breadcrumbs`, asserts all sensitive fields are replaced with `[Filtered]` and `trace_id` is preserved. Plan 18: manual operator dashboard check. *Plan 13 smoke fires the route as a dependency but does NOT own the assertion — see SC-4a note above.* | ✅ | ⬜ pending |
| SC-4c | LGPD-13 | TBD | TBD | `Sentry.setUser({ id })` only — no email | unit | `tests/unit/sentry-config.test.ts` intercepts `Sentry.init`, asserts `sendDefaultPii: false` and that `beforeSend` strips `event.user.email` | ✅ | ⬜ pending |
| SC-4d | LGPD-13 | TBD | TBD | Request bodies dropped on `/api/v1/identifications/*` | unit | `tests/unit/sentry-config.test.ts` calls `beforeSend` with synthetic event `request.url` matching `/api/v1/identifications/abc` and populated `request.data`, asserts `event.request.data === undefined` | ✅ | ⬜ pending |
| SC-4e | OBS-02 | 13 | 3 | PostHog EU client + `posthog-node` server connected | unit + e2e | Unit: `tests/unit/posthog-config.test.ts` asserts factory uses `api_host: 'https://eu.posthog.com'` + `opt_out_capturing_by_default: true` (D-17/D-18). E2E: smoke fires a server-side ping via `posthog-node` from a health endpoint, asserts HTTP 200 to `eu.posthog.com` (Playwright `route()` mock OR PostHog events API) | ✅ | ⬜ pending |
| SC-5a | INFRA-20, D-23 | TBD | TBD | Closed error-code registry (`as const` + union type) | unit | `tests/unit/error-codes.test.ts` imports `ErrorCode` from `@/shared/errors/codes`, asserts all 21 codes from PRD §5 present, asserts `typeof ErrorCode === 'object'` (not TS enum), asserts `INTERNAL_ONLY_CODES.has('cost_ceiling_reached')` + `INTERNAL_ONLY_CODES.has('breaker_open')` | ✅ | ⬜ pending |
| SC-5b | INFRA-18, D-20/D-21/D-22 | 13 | 3 | Standard security headers apply to every response | e2e | Playwright smoke: `page.goto('/')` then assert response headers contain `content-security-policy-report-only` (preview) or `content-security-policy` (prod), `strict-transport-security: max-age=15552000; includeSubDomains`, `x-frame-options: DENY`, `x-content-type-options: nosniff` | ✅ | ⬜ pending |
| SC-5c | INFRA-16 | TBD | TBD | `IDENTIFICATION_PROVIDER_MODE` env var gates stub vs real | unit | `tests/unit/env-provider-mode.test.ts` parses `='real'`, `='stub'`, rejects missing. Also `/api/v1/_test/throw` route unit test asserts 404 when `IDENTIFICATION_PROVIDER_MODE !== 'stub'` and 500 (thrown) when it is (+ `VERCEL_ENV=preview` guard per D-29) | ✅ | ⬜ pending |
| SC-5d | INFRA-23 (secrets) | TBD | TBD | Required GH Actions secrets present | unit/CI | `tests/unit/env.test.ts` imports `src/shared/config/env.ts` and asserts Zod schema rejects missing required keys; CI job surfaces fast failure if any `secrets.*` referenced in workflows is undefined | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All validation assets are missing — this is a greenfield phase. Wave 0 MUST create them before any downstream task can be verified.

- [ ] `package.json` + `pnpm-lock.yaml` with scripts `test:unit`, `test:integration`, `test:e2e`, `lint`, `typecheck`, `build`, `format`
- [ ] `pnpm install` (installs vitest, @playwright/test, eslint, prettier, typescript, drizzle-kit, etc.)
- [ ] `pnpm exec playwright install --with-deps chromium`
- [ ] `tsconfig.json` with D-06 strict-plus flags (`strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noFallthroughCasesInSwitch`, `noPropertyAccessFromIndexSignature`, `forceConsistentCasingInFileNames`; `exactOptionalPropertyTypes: false`) and D-07 path alias (`@/*` → `src/*`)
- [ ] `vitest.config.ts` with two named projects: `unit` (node env, globs `tests/unit/**/*.test.ts` + `src/**/*.test.ts`) and `integration` (node env, `pool: 'forks'`, `setupFiles: ['tests/integration/setup.ts']`, globs `tests/integration/**/*.test.ts`)
- [ ] `playwright.config.ts` — Chromium only, `baseURL: process.env.PLAYWRIGHT_TEST_BASE_URL`, single worker in CI, retries: 2 in CI, artifact upload on failure
- [ ] `tests/unit/tsconfig.test.ts` — asserts D-06 flags
- [ ] `tests/unit/error-codes.test.ts` — asserts PRD §5 closed registry
- [ ] `tests/unit/sentry-config.test.ts` — asserts `beforeSend` scrubbing (LGPD-13) + `setUser({ id })` only (this is the canonical SC-4a + SC-4b assertion owner)
- [ ] `tests/unit/posthog-config.test.ts` — asserts EU host + `opt_out_capturing_by_default: true`
- [ ] `tests/unit/folder-scaffold.test.ts` — asserts PRD §2 bounded-context layout exists with `README.md` stubs
- [ ] `tests/unit/env-provider-mode.test.ts` — asserts Zod schema validates `IDENTIFICATION_PROVIDER_MODE` and the full PRD §20 env var table
- [ ] `tests/unit/i18n-lang.test.ts` — asserts `<html lang="pt-BR">` rendering and next-intl static mode
- [ ] `tests/integration/setup.ts` — per-file `drizzle-kit migrate` (beforeAll) + per-test `sql.begin` transaction fixture rolled back via sentinel-throw on teardown (D-14 LOCKED)
- [ ] `tests/integration/health.test.ts` — real Postgres via `postgres-js` with `{ prepare: false }` → `SELECT 1` inside the transactional fixture
- [ ] `playwright/smoke.spec.ts` — D-24 full observability loop (home, `/api/v1/health` with 30s cold-start poll, `/api/v1/_test/throw` route-fire check, PostHog ping, security headers). SC-4a/SC-4b assertion lives in the unit scrubber test + plan 18 manual check.
- [ ] `.github/workflows/ci.yml` — lint + typecheck + unit + integration (postgres service container) + build
- [ ] `.github/workflows/deploy-preview.yml` — Supabase branch create + `vercel deploy --prebuilt` + `pnpm test:e2e` against preview
- [ ] `.github/workflows/deploy-preview-cleanup.yml` — Supabase branch delete + Vercel alias remove on PR close
- [ ] `.github/workflows/deploy-production.yml` — `vercel deploy --prebuilt --prod` + Inngest sync + non-blocking `Verify Sentry release` step (Sentry release + source-map upload handled by `withSentryConfig` in `next build`, not a separate step — per D-19 OVERRIDE)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vercel git integration is OFF | INFRA-11 | Vercel API does not expose this setting for automated read; dashboard-only | Visit Vercel project → Settings → Git → confirm "Connected Git Repository" is disconnected. Capture screenshot in `01-VERIFICATION.md`. |
| Supabase branching enabled on project | INFRA-13 | One-time project configuration | Visit Supabase dashboard → Project Settings → Branching → confirm "Enable branching" is on. Capture screenshot. |
| GH Actions secrets populated | INFRA-23, OBS-01, OBS-02, LGPD-13 | Secrets are write-only after set; cannot be read back by CI for verification | Wave 0 operator checklist enumerates every required secret from PRD §20; operator confirms each one exists in GitHub repo → Settings → Secrets → Actions. |
| Supabase branch DB cleaned up after PR close | INFRA-15 | `deploy-preview-cleanup.yml` emits a cleanup call, but Supabase may lag; spot-check required first time | After the Phase 1 smoke PR closes, visit Supabase → Branches and confirm the branch was removed within 5 minutes. |
| Sentry project receives LGPD-13 scrubbed event from preview | LGPD-13, SC-4a, SC-4b | Final-mile verification that scrubbing works end-to-end on real Sentry infrastructure (not mocked). Plan 07 unit test is the primary automated signal; this manual check is the last-mile confirmation. | After Phase 1 preview deploy, visit Sentry → Issues → find the deliberate error (plan 13 smoke fires it via `/api/v1/_test/throw`) → confirm `request.data === undefined` and scrubbed fields show `[Filtered]`. |

---

## Validation Sign-Off

- [ ] All task entries wired to invariants above (planner + Nyquist auditor responsibility)
- [ ] Sampling continuity: no 3 consecutive task commits without an automated verify
- [ ] Wave 0 covers every ✅ gap listed above
- [ ] No watch-mode flags anywhere (`pnpm vitest`, `pnpm test` without `--run` are banned)
- [ ] Feedback latency < 30s on the unit path
- [ ] `nyquist_compliant: true` set in frontmatter after task-level wiring complete

**Approval:** pending
