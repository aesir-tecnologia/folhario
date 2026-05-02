---
created: 2026-05-02T18:50:00.000Z
title: Run the full Playwright E2E suite in CI (not just the 4-spec smoke)
area: tooling
files:
  - .github/workflows/ci.yml:151
  - package.json:21
---

## Problem

CI today runs `pnpm test:e2e:smoke`, which is hardcoded to four specs:

```
"test:e2e:smoke": "playwright test security-headers pwa-smoke legal-links horizontal-scroll-guard"
```

Every other E2E spec under `tests/e2e/` is committed but never executes
on CI. This is how three production-impacting bugs landed undetected and
sat on `main`:

1. **Proxy bearer-gate locks out cookie-session catalog routes**
   (`src/proxy.ts` — fixed in `ca15b7d`). Phase 5 shipped without adding
   `/api/v1/plants*` and `/api/v1/locations` to `PUBLIC_API_ENDPOINTS`,
   so every browser-issued catalog mutation 401'd at the proxy. The
   catalog feature was unusable for cookie-session users in production.

2. **`next.config.ts` had no `images.remotePatterns`** for Supabase
   Storage hosts (fixed in `e12b480`). Every plant-profile SSR render
   with a cover photo threw `Invalid src prop` and 500'd.

3. **`Combobox` had no outside-click handler** — WR-08 carryover from
   the prior verification cycle (fixed in `dc2dc9e`).

`tests/e2e/plant-profile.spec.ts`, `tests/e2e/catalog-grid-sort.spec.ts`,
`tests/e2e/catalog-photo-journal.spec.ts`, and `tests/e2e/catalog-offline.spec.ts`
have all been silently broken by these bugs since they were committed —
the smoke list never exercised them.

## Solution

Replace `pnpm test:e2e:smoke` in `.github/workflows/ci.yml:151` with the
full `pnpm test:e2e` suite. The job already provisions:

- a `postgres:17-alpine` service container,
- the test JWKS server via `tests/e2e/global-setup.ts`,
- the `pnpm start` Next webServer with `IDENTIFICATION_PROVIDER_MODE=stub`
  + `ENABLE_TEST_ROUTES=1` + `INNGEST_DEV=1`,
- Playwright browsers cached via `actions/cache`,
- `SENTRY_DSN_CI` + `POSTHOG_KEY_CI` injected only into the E2E step.

Migration steps:

1. Run the full suite locally (`pnpm db:start && pnpm test:e2e`) to
   confirm every spec passes after the three fixes above; expect any
   remaining red specs to surface their own root causes for separate
   follow-up.
2. Update `.github/workflows/ci.yml:151` to `pnpm test:e2e` (remove the
   smoke alias from the workflow; keep the `test:e2e:smoke` script in
   `package.json` as a developer convenience).
3. Watch the first CI run for flakes — if any spec is environmentally
   sensitive (network, race conditions), tag it with
   `test.describe.configure({ retries: 2 })` rather than excluding it.
4. Optionally split the suite into smoke + full-suite jobs so PR feedback
   stays fast; full-suite can run on `main` push only.

## Why this didn't get caught earlier

The smoke list dates back to Phase 1 plan 01-08 when only the four
listed specs existed. Each subsequent phase (4, 5) shipped E2E coverage
but the smoke list was never expanded. CI green was a false signal.

## Acceptance

- Catalog/plant-profile E2E specs run on every PR (or at minimum on
  `main` push).
- A regression like commits 1–3 above would fail CI before merge.
- Doc note (or commit subject) explains the smoke→full transition.
