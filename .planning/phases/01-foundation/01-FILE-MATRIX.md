# Phase 1 — File Ownership Matrix

**Purpose:** Surface every cross-plan file mutation so worktree-merge conflicts are diagnosable and no plan silently edits another plan's output without a declared `depends_on` edge.

**Generated:** 2026-04-23 during `/gsd-plan-phase 1 --reviews` (revision pass).

**How to use:** Before executing any plan, grep this matrix for every path that plan's `files_modified` lists. If a file appears in multiple plans, the plan with the LOWER wave number creates it; later-wave plans only edit it.

## Matrix

| File | Created by | Edited by | Notes |
|------|-----------|-----------|-------|
| `vitest.config.ts` | 01-01 | 01-02 | 01-02 adds `setupFiles: ["tests/unit/setup-env.ts"]` to BOTH projects |
| `src/instrumentation.ts` | 01-03 | 01-05b | 01-03 ships guarded try/catch; 01-05b removes guards after init files land |
| `src/app/layout.tsx` | 01-03 | 01-06 | 01-03 ships server layout with `<html lang={locale}>` + `<NextIntlClientProvider>`; 01-06 wraps children in `<PostHogProvider>` |
| `next.config.ts` | 01-03 | — | 01-03 ships composed `withSentryConfig(withSerwist(...))` + `headers()` with security headers applied to every response (`source: '/(.*)'`) per user decision 3 |
| `src/proxy.ts` | 01-03 | — | LOCALE handling ONLY. Security headers MUST NOT live here (moved to `next.config.ts` per user decision 3) |
| `src/shared/config/server-env.ts` | 01-02 | — | Parses server-only vars (DATABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SENTRY_*, IDENTIFICATION_PROVIDER_MODE, …) |
| `src/shared/config/client-env.ts` | 01-02 | — | Parses only `NEXT_PUBLIC_*` vars. `posthog-client.ts` imports from HERE (never from server-env) |
| `src/shared/config/errors.ts` | 01-02 | — | PRD §5 closed registry + `errorResponse` helper |
| `src/shared/telemetry/sentry-scrub.ts` | 01-05a | — | LGPD-13 load-bearing scrub helpers; imported by all three Sentry init files in 01-05b |
| `src/sentry.server.config.ts` | 01-05b | — | consumes `sentry-scrub.ts` |
| `src/sentry.edge.config.ts` | 01-05b | — | consumes `sentry-scrub.ts` |
| `src/instrumentation-client.ts` | 01-05b | — | consumes `sentry-scrub.ts` (supersedes legacy `sentry.client.config.ts` per Sentry 10 docs) |
| `src/shared/telemetry/posthog-client.ts` | 01-06 | — | imports only from `@shared/config/client-env` |
| `src/shared/telemetry/posthog-server.ts` | 01-06 | — | server singleton; imports `client-env.ts` (PostHog public key is not a server secret) |
| `src/app/posthog-provider.tsx` | 01-06 | — | `"use client"` wrapper calling `initPostHog()` on mount |
| `src/app/__diag/layout.tsx` | 01-07 | — | server guard; `notFound()` unless `IDENTIFICATION_PROVIDER_MODE === "stub"` |
| `src/app/__diag/page.tsx` | 01-07 | — | client diagnostics page |
| `src/app/api/v1/_diagnostics/ping/route.ts` | 01-07 | — | server diagnostics route; both POST and GET exercised |
| `tests/e2e/security-headers.spec.ts` | 01-07 | — | MUST assert headers on `/`, `/api/v1/_diagnostics/ping`, AND `/manifest.webmanifest` (per user decision 3 + Action 3) |
| `tests/e2e/pwa-smoke.spec.ts` | 01-07 | — | manifest + sw.js |
| `tests/e2e/diagnostics-sentry.spec.ts` | 01-07 | — | client envelope + PII sentinel absence |
| `tests/e2e/diagnostics-posthog.spec.ts` | 01-07 | — | client `$pageview`-style capture; asserts server handler returned 200 |
| `tests/e2e/sentry-local-mode.spec.ts` | 01-07 | — | local-mode regression guard (Action 13) |
| `tests/integration/diagnostics-server-probe.integration.test.ts` | 01-07 | — | Vitest integration test: imports route POST handler directly, mocks `posthog-node` + `@sentry/nextjs`, asserts server-side `capture()` + `captureException()` invoked (SC-4 server-side automatic proof, Action 13 / user decision 1) |
| `tests/integration/postgres-connection.integration.test.ts` | 01-04 | — | cloud-Supabase hostname guard (`supabase.co`) added per Action 15 |
| `.planning/REQUIREMENTS.md` | (pre-existing) | 01-08 | 01-08 Task 2 amends INFRA-12 (`postgres:17-alpine`) AND moves OBS-05 → Phase 13 per user decision 2 |
| `.planning/ROADMAP.md` | (pre-existing) | 01-08 | 01-08 new task edits SC-4 wording per user decision 1 + OBS-05 map to Phase 13 + Plan 1 plan-list update to 9 plans |
| `.github/workflows/ci.yml` | 01-08 | — | CI pipeline |
| `.planning/phases/01-foundation/01-01-SUMMARY.md` | 01-01 | — | Records resolved patch versions per Action 12 |
| `.planning/phases/01-foundation/01-08-SUMMARY.md` | 01-08 | — | Includes **Manual dashboard verification** section with Sentry issue + PostHog event screenshot-link placeholders (user decision 1) |

## Wave DAG

- **Wave 1:** 01-01
- **Wave 2:** 01-02, 01-03, 01-04
  - 01-03 `depends_on: [01, 02]` defensively (Action 8) to avoid racing Plan 02's `src/shared/config/` files
- **Wave 3:** 01-05a, 01-06
  - 01-05a `depends_on: [02, 03]`
  - 01-06 `depends_on: [02, 03]`
- **Wave 4:** 01-05b
  - 01-05b `depends_on: [02, 03, 05a]`
- **Wave 5:** 01-07
  - 01-07 `depends_on: [02, 03, 05b, 06]`
- **Wave 6:** 01-08
  - 01-08 `depends_on: [01, 02, 03, 04, 05a, 05b, 06, 07]`

**Total:** 9 plans, 6 waves (was 8 plans, 5 waves).
