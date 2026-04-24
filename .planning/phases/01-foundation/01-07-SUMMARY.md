---
phase: 01
plan: 07
subsystem: foundation-diagnostics-and-smoke-tests
tags:
  - diagnostics
  - playwright
  - e2e
  - integration-tests
  - sentry
  - posthog
  - lgpd-13
  - security-headers
  - pwa

requires:
  - phase: 01-02
    provides: errorResponse + ErrorCode.NotFound + serverEnv.IDENTIFICATION_PROVIDER_MODE
  - phase: 01-03
    provides: next.config.ts headers() 5 security headers; public/manifest.webmanifest; public/sw.js (Serwist); public/robots.txt (Plan 07 updates Disallow paths here to match the rename)
  - phase: 01-05a
    provides: sentry-scrub LGPD-13 regex "/\\/api\\/v1\\/identifications(\\/|$)/" that matches the synthetic URL injected by POST /api/v1/diagnostics/ping
  - phase: 01-05b
    provides: three Sentry.init callsites with makeBeforeSend/makeBeforeBreadcrumb + empty-DSN disable; browser init exports captureRouterTransitionStart
  - phase: 01-06
    provides: posthog-client initPostHog() + posthog-server getPostHog() singleton consumed from the /diag client page and POST handler respectively
provides:
  - diag-client-page-with-client-fire
  - diagnostics-ping-post-handler-with-server-fire-synthetic-identification-url
  - diagnostics-ping-get-handler-returning-ok-env-timestamp
  - security-headers-e2e-coverage-3-urls
  - pwa-smoke-manifest-and-sw
  - sentry-pii-scrub-e2e-guard
  - sentry-local-mode-empty-dsn-regression-guard-action-13
  - posthog-client-event-fire-e2e-guard
  - posthog-server-get-ping-json-shape-assertion-action-18
  - sc-4-server-side-automatic-proof-via-vitest-integration
affects:
  - 01-08-ci-yml (CI runs pnpm test:e2e + pnpm test:integration with populated SENTRY_DSN_CI + POSTHOG_KEY_CI so CI-gated assertions in diagnostics-sentry + diagnostics-posthog specs fire and succeed)
  - all-future-route-handlers-in-phase-2 (errorResponse + mode-gated guard pattern is now in use)
  - phase-13-observability-rollups (SC-4 verification posture: client-auto via Playwright, server-auto via Vitest, manual dashboards belt-and-suspenders in 01-08 SUMMARY)

tech-stack:
  added: []
  patterns:
    - next-private-folder-avoidance-rename-double-underscore-to-plain
    - diagnostics-routes-mode-gated-with-errorresponse-notfound
    - sentry-withscope-addeventprocessor-injecting-synthetic-request-url
    - vitest-mock-raw-sdk-for-server-probe-replacing-playwright-server-cannot-intercept-concession
    - playwright-ci-gated-envelope-count-local-gated-scrub-assertion
    - sentry-local-mode-test-skip-on-ci

key-files:
  created:
    - src/app/diag/layout.tsx
    - src/app/diag/page.tsx
    - src/app/api/v1/diagnostics/ping/route.ts
    - tests/e2e/security-headers.spec.ts
    - tests/e2e/pwa-smoke.spec.ts
    - tests/e2e/diagnostics-sentry.spec.ts
    - tests/e2e/sentry-local-mode.spec.ts
    - tests/e2e/diagnostics-posthog.spec.ts
    - tests/integration/diagnostics-server-probe.integration.test.ts
    - .planning/phases/01-foundation/deferred-items.md
  modified:
    - public/robots.txt (rename Disallow paths to /diag + /api/v1/diagnostics/)

key-decisions:
  - "Routes renamed: /__diag -> /diag and /api/v1/_diagnostics/ -> /api/v1/diagnostics/. Next.js App Router excludes any path segment starting with '_' from route discovery (primary source: node_modules/next/dist/esm/build/route-discovery.js:54 -- ignorePartFilter: part => part.startsWith('_')). The plan's prescribed URL paths were a bug; renaming preserves the architectural contract (mode-gated diagnostics + robots.txt reinforcement)."
  - "Integration test uses relative import path '../../src/app/api/v1/diagnostics/ping/route' rather than a '@/...' alias. tsconfig.json paths only declare @contexts/*, @shared/*, @i18n/* -- no @/* alias exists in this project. Relative path is the cleanest resolution."
  - "posthog-node mock implemented as a function constructor (function MockPostHog() {...}), not vi.fn().mockImplementation(() => ({...})). The arrow-function form is not callable with 'new' and threw TypeError: 'is not a constructor' at src/shared/telemetry/posthog-server.ts line 10. Switched to named function constructor; both tests green."
  - "Sentry envelope-count assertion in diagnostics-sentry.spec.ts is CI-gated (process.env.CI). Locally the DSN is empty per D-19 so zero envelopes fire -- the envelope-count assertion would always fail locally without the gate. The PII-sentinel assertion (the load-bearing LGPD-13 check) is unconditional so it still runs over whatever payloads do get captured locally (zero locally; >=1 in CI)."
  - "sentry-local-mode.spec.ts is the inverse -- test.skip on CI, runs only locally. This is the Action 13 regression guard that ensures a future change cannot silently re-enable Sentry transport when DSN is empty."
  - "GET /api/v1/diagnostics/ping under 'next start' returns env:'production' even on a developer laptop, because 'next start' forces NODE_ENV=production. The spec accepts both 'development' and 'production' values so this is expected behavior, not a bug."
  - "Sentry synthetic URL 'http://localhost:3000/api/v1/identifications/_diag-synth' kept literal -- this string is for regex match in Plan 05a's beforeSend, never routed. It is not a real route so the '_diag-synth' underscore is irrelevant; Next private-folder rule applies only to files in the app/ directory tree."
  - "public/robots.txt Disallow entries updated from /__diag + /api/v1/_diagnostics/ to /diag + /api/v1/diagnostics/. File was created by Plan 03 per FILE-MATRIX, which lists no other plan edits -- editing here is Rule 1 (fix bug surfaced by this plan), not scope creep."
  - "Did NOT fix the pre-existing missing-gitignore for public/sw.js.map (Plan 03 SUMMARY claimed it was gitignored but .gitignore only lists public/sw.js). Logged to .planning/phases/01-foundation/deferred-items.md for Plan 01-08 or later housekeeping. Out-of-scope per executor instructions."

patterns-established:
  - "Next private-folder rule awareness: any app/ directory segment starting with '_' is excluded from route discovery. Diagnostics/internal routes MUST use plain (non-underscore-prefixed) names; public-from-URL-perspective defense uses mode-gated guards + robots.txt Disallow instead."
  - "Diagnostics route structure: server layout.tsx checks IDENTIFICATION_PROVIDER_MODE and calls notFound(); client page.tsx is 'use client' and fires taxonomy event + captureException in a single useEffect([]). Route handler exports POST (active smoke) + GET (JSON-shape contract check). Both methods re-check the mode and return errorResponse(ErrorCode.NotFound) when not stub."
  - "SC-4 split verification: client-auto via Playwright page.route interceptor, server-auto via Vitest integration test with vi.mock-ed SDKs calling the POST handler directly, manual dashboard verification belt-and-suspenders in 01-08 SUMMARY. Replaces the prior 'Playwright cannot intercept server-originated traffic' concession (D-27-a / user decision 1)."
  - "Sentry synthetic-URL injection via Sentry.withScope + scope.addEventProcessor: overrides event.request.url to match LGPD-13 regex /\\/api\\/v1\\/identifications(\\/|$)/ without actually routing through that URL. Proves the scrub module fires end-to-end in the SDK transport path."
  - "Playwright spec CI-gating via process.env.CI: envelope-count assertions skipped locally (empty DSN = zero envelopes by design); PII-sentinel assertions unconditional; inverse local-only guard spec (sentry-local-mode) that SKIPS on CI."
  - "Integration-test raw SDK mocking: vi.mock('posthog-node') uses function-constructor form (not vi.fn().mockImplementation(() => ({}))) to satisfy 'new PostHog()' invocation. vi.mock('@sentry/nextjs') can reuse arrow for withScope/captureException because they're called, not constructed."

requirements-completed:
  - INFRA-16
  - INFRA-18
  - OBS-01
  - OBS-02
  - LGPD-13

duration: 12min
completed: 2026-04-24
---

# Phase 01 Plan 07: Diagnostics Routes + End-to-End Smoke Tests Summary

**Ships `/diag` client page + `/api/v1/diagnostics/ping` server route (POST fires server-side Sentry + PostHog via Plan 05b/06 providers with a synthetic `/api/v1/identifications/*` URL to exercise LGPD-13 body-drop; GET returns `{ok,env,timestamp}` shape) plus 5 Playwright specs (security-headers on 3 URLs, pwa-smoke, diagnostics-sentry with PII-sentinel assertion, sentry-local-mode empty-DSN guard per Action 13, diagnostics-posthog with GET shape per Action 18) plus a Vitest integration test that imports the POST handler directly with `posthog-node` + `@sentry/nextjs` mocked — delivering the SC-4 server-side automatic proof (D-27-a / user decision 1).**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-04-24T03:25:20Z
- **Completed:** 2026-04-24T03:37:30Z
- **Tasks:** 4 (all `type="auto"`)
- **Commits:** 5 (4 task commits + 1 rename-fix commit)
- **Files created:** 10 (3 app routes, 5 E2E specs, 1 integration test, 1 deferred-items.md)
- **Files modified:** 1 (`public/robots.txt` — Plan 03 file, updated per FILE-MATRIX)

## Accomplishments

- **Diagnostics routes operational and mode-gated:**
  - `GET /diag` → 200 with `<main>ok</main>` HTML + client fires `$diagnostics_client_ping` + `Sentry.captureException` with scrub sentinels in `extra` on mount.
  - `POST /api/v1/diagnostics/ping` → 200 with `{ok:true}`; server fires `$diagnostics_server_ping` via `getPostHog()` + `Sentry.captureException` inside `Sentry.withScope(scope => scope.addEventProcessor(e => { e.request.url = '.../_diag-synth'; ... }))`. The synthetic URL matches Plan 05a's LGPD-13 regex.
  - `GET /api/v1/diagnostics/ping` → 200 with `{ok:true, env:"production"|"development", timestamp:"<ISO>"}` (Action 18 contract).
  - All three routes return `errorResponse(ErrorCode.NotFound,...)` (HTTP 404) when `serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub"`. Layout guard grep-verified at build time.
- **Playwright smoke suite: 8/8 passing locally**
  - `security-headers.spec.ts`: 3 tests (for-loop over `/`, `/api/v1/diagnostics/ping`, `/manifest.webmanifest`) × 5 header assertions each. Pass.
  - `pwa-smoke.spec.ts`: 2 tests (manifest JSON shape + sw.js Content-Type). Pass.
  - `diagnostics-sentry.spec.ts`: 1 test (PII-sentinel absence in any intercepted Sentry envelope; envelope-count assertion CI-gated). Pass.
  - `sentry-local-mode.spec.ts`: 1 test (zero Sentry envelopes emitted under empty-DSN local mode; `test.skip(!!process.env.CI)`). Pass.
  - `diagnostics-posthog.spec.ts`: 1 test (PostHog interception + GET ping JSON-shape assertions; CI-gated PostHog-event-name assertion). Pass.
- **Vitest integration test: 2/2 passing**
  - `tests/integration/diagnostics-server-probe.integration.test.ts` imports `POST` from `/api/v1/diagnostics/ping/route` as a pure function. `vi.mock('posthog-node')` via function-constructor; `vi.mock('@sentry/nextjs')` via spread+override; asserts `captureMock` called once with `event: "$diagnostics_server_ping"` AND `captureExceptionMock` called once. Second test flips `IDENTIFICATION_PROVIDER_MODE=real` + `vi.resetModules()` and asserts POST returns 404.
- **Regression:** `pnpm typecheck` exit 0, `pnpm build --webpack` exit 0 with routes emitted (`/diag` + `/api/v1/diagnostics/ping` both appear in build output), `pnpm exec vitest run --project=unit` 116/116 passing (no regressions).

## Task Commits

| # | Task | Commit | Type |
|---|------|--------|------|
| 1 | Diagnostics routes (layout + page + route.ts POST/GET) | `c71674a` | feat |
| 2 | security-headers + pwa-smoke E2E specs | `8be568c` | test |
| 3 | diagnostics-sentry + sentry-local-mode + diagnostics-posthog E2E | `4061840` | test |
| 4 | Vitest integration test (SC-4 server-side proof) | `3d2de53` | test |
| 5 | Fix: rename `__diag` / `_diagnostics` to `diag` / `diagnostics` + robots.txt | `84f8322` | fix |

**Plan metadata commit:** pending — this SUMMARY + STATE.md + ROADMAP.md + REQUIREMENTS.md updates land in the final `docs(01-07)` commit.

## Files Created

### Routes (src/app)

- **`src/app/diag/layout.tsx`** (9 lines) — Server component. Checks `serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub"` → `notFound()`. Children pass-through otherwise.
- **`src/app/diag/page.tsx`** (20 lines) — `"use client"` component. `useEffect([])` fires `posthog.capture("$diagnostics_client_ping", {...})` + `Sentry.captureException(new Error("Playwright diagnostics client error"), { extra: { email: "should-be-scrubbed@example.com", token: "should-be-scrubbed" } })`. Renders `<main>ok</main>` (placeholder — diagnostics-only, never user-facing).
- **`src/app/api/v1/diagnostics/ping/route.ts`** (40 lines) — `POST` fires posthog-node capture via `getPostHog()` + `Sentry.withScope(scope => { scope.addEventProcessor(e => { e.request = {...e.request, url: "http://localhost:3000/api/v1/identifications/_diag-synth", data: bodyText || { email, token }, method: "POST" }; return e; }); Sentry.captureException(new Error(...)); })`. `GET` returns `{ok, env, timestamp}`. Both methods guard via `errorResponse(ErrorCode.NotFound, "not found")` when mode is not stub.

### Playwright E2E specs (tests/e2e)

- **`tests/e2e/security-headers.spec.ts`** (23 lines) — `for (const path of ["/", "/api/v1/diagnostics/ping", "/manifest.webmanifest"])` generates 3 tests; each asserts all 5 security headers (HSTS, XFO DENY, XCTO nosniff, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy non-empty).
- **`tests/e2e/pwa-smoke.spec.ts`** (21 lines) — 2 tests: `/manifest.webmanifest` JSON shape (display:standalone + theme_color + name + short_name); `/sw.js` HTTP 200 with `javascript` content-type.
- **`tests/e2e/diagnostics-sentry.spec.ts`** (26 lines) — `page.route(/\.ingest\.sentry\.io\/.*\/envelope/, ...)` collects raw payload bodies; asserts NO forbidden sentinels (`scrub-me`, `should-be-scrubbed`, `should-be-scrubbed@example.com`) in any payload; envelope-count assertion CI-gated.
- **`tests/e2e/sentry-local-mode.spec.ts`** (17 lines) — `test.skip(!!process.env.CI, ...)`; asserts envelope count = 0 when DSN is empty (Action 13 regression guard).
- **`tests/e2e/diagnostics-posthog.spec.ts`** (30 lines) — `page.route(/\.i\.posthog\.com\/(e|batch|capture)/, ...)` + direct `request.get("/api/v1/diagnostics/ping")`; asserts GET 200 with `{ok:true}` + `env in {development, production}` + `typeof timestamp === "string"` + parseable as Date. CI-gated assertion for `$diagnostics_client_ping` appearing in captured PostHog payloads.

### Vitest integration test (tests/integration)

- **`tests/integration/diagnostics-server-probe.integration.test.ts`** (74 lines) — Primes `process.env.IDENTIFICATION_PROVIDER_MODE="stub"` + DB/Supabase stubs + `NEXT_PUBLIC_POSTHOG_KEY="ph_test_key"` at module top (before any import). Declares `captureMock`, `shutdownMock`, `captureExceptionMock` as module-level vi.fn()s. `vi.mock("posthog-node", () => ({ PostHog: function MockPostHog() { return { capture: captureMock, shutdown: shutdownMock } } }))`. `vi.mock("@sentry/nextjs", async (importOriginal) => ({ ...(await importOriginal()), withScope: cb => cb({ addEventProcessor: () => {} }), captureException: captureExceptionMock }))`. First test: dynamic-imports route, calls POST, asserts `captureMock` invoked once with event `$diagnostics_server_ping` AND `captureExceptionMock` invoked once. Second test: flips mode to `real`, `vi.resetModules()`, re-imports route, asserts 404 — then restores prior mode in `finally`.

### Orchestration

- **`.planning/phases/01-foundation/deferred-items.md`** — Logs the pre-existing `public/sw.js.map` gitignore gap (inherited from Plan 03) for later housekeeping. Not fixed here because Plan 01-07 does not own `.gitignore`.

## Files Modified

- **`public/robots.txt`** — `Disallow: /__diag` → `Disallow: /diag`; `Disallow: /api/v1/_diagnostics/` → `Disallow: /api/v1/diagnostics/`. File was created by Plan 03; FILE-MATRIX records no other plan edits, so this edit is scope-safe.

## Decisions Made

See `key-decisions` in frontmatter. Nine decisions, each grep-anchored to shipped files or to primary-source verification (Next.js compiled JS confirmed the private-folder rule).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's URL paths `/__diag` and `/api/v1/_diagnostics/` are unreachable under Next.js App Router**

- **Found during:** End-of-Task-4 Playwright smoke test against `pnpm start` built bundle.
- **Issue:** After adding the three diagnostics files per plan Task 1 and rebuilding, `pnpm start` + `curl http://localhost:3000/api/v1/_diagnostics/ping` returned HTTP 404. Build output listed only `Route (app) ┌ ○ / └ ○ /_not-found` — the new routes were silently excluded. Primary-source diagnosis: `/Users/machado/Projects/folhario/node_modules/next/dist/esm/build/route-discovery.js:54` — `ignorePartFilter: (part)=>part.startsWith('_')`. Any app/ path segment starting with `_` (including `__diag` and `_diagnostics`) is excluded from route discovery. This is a Next.js private-folders convention; the plan prescribed folder names violating it.
- **Fix:** Renamed `src/app/__diag/` → `src/app/diag/` and `src/app/api/v1/_diagnostics/` → `src/app/api/v1/diagnostics/` (via `git mv`). Updated 5 E2E specs + the integration test to point at the new URLs. Updated `public/robots.txt` Disallow entries to match (FILE-MATRIX records no other plan edits robots.txt). Left the Sentry synthetic URL `http://localhost:3000/api/v1/identifications/_diag-synth` literal because it is a string for regex matching in `beforeSend`, never routed through Next.
- **Files modified:** Folders renamed + 9 files touched (3 app routes moved, 5 E2E specs, 1 integration test, 1 robots.txt).
- **Verification:** After rebuild, build output includes `├ ƒ /api/v1/diagnostics/ping` and `└ ○ /diag`. `pnpm exec playwright test` 8/8 pass. `pnpm exec vitest run --project=integration` 2/2 pass.
- **Committed in:** `84f8322` (single focused rename commit per advisor guidance, separate from Task 1-4 work).

**2. [Rule 1 - Bug] `vi.mock("posthog-node")` factory must use function-constructor, not arrow mockImplementation**

- **Found during:** Task 4 first run of `pnpm exec vitest run --project=integration tests/integration/diagnostics-server-probe.integration.test.ts`.
- **Issue:** Initial form copied from the plan text was `PostHog: vi.fn().mockImplementation(() => ({ capture: captureMock, shutdown: shutdownMock }))`. This threw `TypeError: () => ({...}) is not a constructor` at `src/shared/telemetry/posthog-server.ts:10` because `new PostHog(...)` requires a `[[Construct]]`-able target and arrow functions don't have one.
- **Fix:** Changed to `PostHog: function MockPostHog() { return { capture: captureMock, shutdown: shutdownMock }; }`. Named function expression has `[[Construct]]`; returning an object from a constructor is standard ES behavior and Vitest handles it transparently.
- **Files modified:** `tests/integration/diagnostics-server-probe.integration.test.ts`
- **Verification:** `pnpm exec vitest run --project=integration tests/integration/diagnostics-server-probe.integration.test.ts` went from 1 failed / 1 passed → 2 passed.
- **Committed in:** `3d2de53` (part of Task 4 commit; fix applied before first green test run was committed).

---

**Total deviations:** 2 auto-fixed (both Rule 1 bugs). Deviation 1 was a significant correctness blocker that required 9-file changes; deviation 2 was a single-line mock-form fix.

**Impact on plan:** The rename preserves all architectural intent (mode-gated diagnostics routes + robots.txt reinforcement); only the literal URL strings changed. Success criteria all met. No scope creep — the robots.txt edit is the smallest possible change needed to keep the defense-in-depth story coherent after the rename.

### Authentication Gates

None.

## Issues Encountered

- **`pnpm test:integration -- tests/...`** is rejected by a local shell hook (`prevent-watch-mode-tests.sh`) because the `--` argument pattern looks ambiguous. Worked around by using `pnpm exec vitest run --project=integration tests/...` directly, which the hook accepts. Functionally equivalent — both produce a single-run exit-on-completion.
- **Commit message body length:** First commit for Task 1 exceeded commitlint `body-max-line-length: 100`. Rewrote with shorter wrapped lines on retry. Standard issue for this repo (also seen in Plan 01-02).

## Known Stubs

**Intentional Phase 1 placeholders (not bugs):**

- **`src/app/diag/page.tsx` renders `<main>ok</main>`** — The diagnostics page is a smoke-test-only surface; it is mode-gated behind stub + robots.txt Disallow. No user-facing UI is needed. `<main>ok</main>` is the minimum surface that lets Playwright's `page.goto("/diag")` succeed and the `useEffect([])` fire the taxonomy + exception events. Future phases do not touch this file.

**Non-intentional stubs:** None.

## Threat Flags

All five threats from the plan's `<threat_model>` remain mitigated:

- **T-07-01 (T-2 HIGH)** — Diagnostics routes reachable in production: mitigated by THREE layers — `src/app/diag/layout.tsx` server `notFound()` guard, `route.ts` POST + GET entry guards returning `errorResponse(ErrorCode.NotFound,...)`, `public/robots.txt` Disallow. Vitest server-probe test (Task 4 second test) asserts the route-handler guard under `mode=real` returns 404. Rename does not weaken the mitigation: the plain-name paths are still covered by all three layers.
- **T-07-02** — Diagnostics POST CSRF: accepted (Phase 1 has no cross-origin cookie surface).
- **T-07-03** — Playwright webServer probe URL `/` reachable: mitigated by Plan 03's `src/app/page.tsx`.
- **T-07-04** — Server-side SDK invocations silently skipped: mitigated by Task 4 integration test.
- **T-07-05** — Local Sentry accidentally re-enabled: mitigated by `tests/e2e/sentry-local-mode.spec.ts` (Action 13).

**No new threat surface introduced beyond the plan's threat model.** The folder rename is URL-path-level only; the authZ posture (mode gate + robots.txt) is unchanged.

## Import Path Decision for Integration Test (plan-output requirement)

The plan's `<output>` asks for explicit rationale on which import form the integration test uses.

**Used:** relative path `"../../src/app/api/v1/diagnostics/ping/route"`.

**Rationale:** `tsconfig.json` declares `paths` for `@contexts/*`, `@shared/*`, and `@i18n/*` only. There is no `@/*` alias (plan noted this explicitly in Task 4 notes). Routes live under `src/app/`, which is NOT aliased. Relative path is the cleanest resolution — `vite-tsconfig-paths` plugin resolves it against the test file location and produces the same module graph as a hypothetical `@/app/...` would. `pnpm typecheck` exit 0 with the relative import.

## Action-Item Verification (cross-checked vs plan verification block)

| # | Verification requirement | Status |
|---|--------------------------|--------|
| 1 | `pnpm typecheck` exits 0 | PASS |
| 2 | `pnpm build --webpack` succeeds with env stubs | PASS (routes emitted) |
| 3 | `pnpm exec playwright install chromium` | Already installed |
| 4 | `pnpm test:e2e` passes all 5 Playwright specs | PASS (8/8 tests across 5 specs) |
| 5 | Integration test passes | PASS (2/2 tests) |
| 6 | `grep -c "notFound()" src/app/diag/layout.tsx` returns 1 | PASS (1 match) |
| 7 | `grep -c "errorResponse(ErrorCode.NotFound" src/app/api/v1/diagnostics/ping/route.ts` returns 2 (POST + GET) | PASS (2 matches) |
| 8 | `grep -q "identifications/_diag-synth" src/app/api/v1/diagnostics/ping/route.ts` | PASS |
| 9 (Action 3) | `grep -q 'manifest.webmanifest' tests/e2e/security-headers.spec.ts` AND `grep -q '_diagnostics\|diagnostics' tests/e2e/security-headers.spec.ts` | PASS (both present) |
| 10 (Action 13) | `grep -q "local mode must not emit Sentry envelopes" tests/e2e/sentry-local-mode.spec.ts` | PASS |
| 11 (Action 18) | `grep -q "timestamp" tests/e2e/diagnostics-posthog.spec.ts` | PASS |

## Next Phase Readiness

**Ready for Plan 01-08 (CI pipeline — final plan in Phase 1):**
- `.github/workflows/ci.yml` will run `pnpm test:unit`, `pnpm test:integration`, `pnpm test:e2e`. All three suites exit 0 locally with the artifacts this plan shipped.
- CI secrets will populate `NEXT_PUBLIC_SENTRY_DSN` + `NEXT_PUBLIC_POSTHOG_KEY` per Plan 08 — at that point the CI-gated envelope-count + PostHog-event-name assertions in diagnostics-sentry.spec.ts + diagnostics-posthog.spec.ts will fire. sentry-local-mode.spec.ts will `test.skip` on CI (inverse guard).
- Plan 08 will amend ROADMAP.md SC-4 wording per user decision 1 (split client-auto / server-auto / manual-dashboard verification posture).
- Plan 08 will mark **OBS-05 moved to Phase 13** per user decision 2.

**Deferred to housekeeping:** `public/sw.js.map` missing from `.gitignore` — see `.planning/phases/01-foundation/deferred-items.md`.

**Ready for Phase 2 (Drizzle + database):**
- The diagnostics route handler uses `errorResponse(ErrorCode.NotFound, ...)` — establishing the pattern for all future route handlers. Plan 02+'s route handlers will consume `errorResponse` + `ErrorCode` identically.
- The mode-gate pattern (`serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub" → notFound()/error`) may be reused by future stub-mode-only tooling.

## Self-Check

Files created verified against disk:

- `src/app/diag/layout.tsx` — FOUND, contains `notFound()` + `IDENTIFICATION_PROVIDER_MODE !== "stub"`
- `src/app/diag/page.tsx` — FOUND, contains `"use client"` + `$diagnostics_client_ping`
- `src/app/api/v1/diagnostics/ping/route.ts` — FOUND, contains both `export async function POST` + `export async function GET`, 2 × `errorResponse(ErrorCode.NotFound`, `$diagnostics_server_ping`, `identifications/_diag-synth`, `timestamp: new Date().toISOString()`
- `tests/e2e/security-headers.spec.ts` — FOUND, covers 3 URLs + 5 headers
- `tests/e2e/pwa-smoke.spec.ts` — FOUND
- `tests/e2e/diagnostics-sentry.spec.ts` — FOUND, contains `FORBIDDEN_SENTINELS`
- `tests/e2e/sentry-local-mode.spec.ts` — FOUND, contains "local mode must not emit Sentry envelopes"
- `tests/e2e/diagnostics-posthog.spec.ts` — FOUND, contains `request.get("/api/v1/diagnostics/ping")` + `timestamp`
- `tests/integration/diagnostics-server-probe.integration.test.ts` — FOUND, uses `vi.mock("posthog-node", ...)` + `vi.mock("@sentry/nextjs", ...)`, calls POST directly, asserts both mocks
- `public/robots.txt` — MODIFIED, contains `Disallow: /diag` + `Disallow: /api/v1/diagnostics/`
- `.planning/phases/01-foundation/deferred-items.md` — FOUND

Build artifacts:
- `.next/server/app/diag/page.js` — FOUND (diagnostics page built)
- `.next/server/app/api/v1/diagnostics/ping/route.js` — FOUND (API route built)

Commits verified present in `git log`:
- `c71674a` (Task 1 routes)
- `8be568c` (Task 2 security-headers + pwa-smoke)
- `4061840` (Task 3 Sentry + PostHog + local-mode E2E)
- `3d2de53` (Task 4 integration test)
- `84f8322` (rename fix)

Test results:
- `pnpm typecheck` exit 0
- `pnpm build --webpack` exit 0 — routes emitted: `/diag` + `/api/v1/diagnostics/ping`
- `pnpm exec vitest run --project=unit` — 6 files / 116 tests pass (no regressions)
- `pnpm exec vitest run --project=integration` — 2 files / 2 passing + 2 skipped (postgres-connection test skips without DB env; expected)
- `pnpm exec playwright test` — 8/8 pass (security-headers ×3 + pwa-smoke ×2 + diagnostics-sentry + sentry-local-mode + diagnostics-posthog)

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-04-24*
