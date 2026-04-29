---
status: resolved
trigger: "auth E2E tests fail locally — verify-redirect times out and /api/v1/iam/me returns 401 across browser/request cookie jars (auth-signup-verification.spec.ts:17 and :106)"
created: 2026-04-29T00:00:00Z
updated: 2026-04-29T00:00:00Z
---

## Current Focus

hypothesis: |
  CONFIRMED via primary-source code reads AND empirical verification (post-fix run shows all 3 tests pass). Both failures shared one root cause: Playwright's `request` (APIRequestContext fixture) and `page.context()` (BrowserContext) maintain SEPARATE cookie jars by default. Each test called `request.post("/api/v1/iam/signup", ...)` which caused `signupUser` -> `signInWithPassword` to set a Supabase SSR session cookie via the response's `Set-Cookie` header. That cookie landed in the `request` fixture's jar but NOT in `page.context().cookies()`.

  Concrete failure mechanisms:
  - **Test :17 timeout**: `page.goto('/auth/verify?token=X')` ran without the session cookie. The verify route (`src/app/auth/verify/route.ts`) is token-only — given a valid token it ALWAYS redirects to `/`. But `/` is in the `(app)` route group, and `src/app/(app)/layout.tsx:35-37` calls `getCurrentUserFromSessionReadOnly()` which reads cookies. With no cookie in the page jar, layout redirected to `/auth/login`. `page.waitForURL(/.*\/$/)` matches URL terminators — `/auth/login` does NOT end in `/`, so the regex never matched and the 30s test timeout fired.
  - **Test :106 401**: `page.request.get("/api/v1/iam/me")` ran from the BROWSER context (page.request shares the page jar). No cookie there → `requireApiUser` fell through Bearer (none) -> cookie session lookup (none) -> 401 unauthenticated.

  The spec at line 53-58 already commented that "the cookies set by signup's signInWithPassword carry the Supabase SSR session" — the comment was wrong about Playwright's default fixture topology. The cookies live in the `request` jar, not the `page` jar.
next_action: "DONE — fix applied and verified. The 3 specs in tests/e2e/auth-signup-verification.spec.ts now all pass (5.5s total). A SEPARATE failure remains in tests/e2e/auth-login-logout.spec.ts:34 (stale `name.includes('refresh')` assertion against @supabase/ssr@0.10.2's chunked cookie format) — captured as a follow-up below."

## Symptoms

expected:
  - Test :17 (line 17): signup via `request.post(/api/v1/iam/signup)` -> get raw token via diagnostics endpoint -> `page.goto(/auth/verify?token=X)` -> verify route validates token, sets `email_verified_at`, redirects to `/`. `page.waitForURL(/.*\/$/)` matches. `page.request.get(/api/v1/iam/me)` returns 200 with `emailVerifiedAt` truthy.
  - Test :106 (line 106): signup via `request.post(/api/v1/iam/signup)` -> `page.request.get(/api/v1/iam/me)` returns 200 with `emailVerifiedAt: null` (route is allowlisted while unverified).
actual:
  - Test :17: `page.waitForURL(/.*\/$/)` times out at 30000ms after `page.goto(/auth/verify?token=X)`. Trace logs: 'waiting for navigation until "load"'.
  - Test :106: `meResp.status()` returns 401 instead of 200.
errors:
  - "Test timeout of 30000ms exceeded" at tests/e2e/auth-signup-verification.spec.ts:51 (page.waitForURL)
  - "Expected: 200, Received: 401" at tests/e2e/auth-signup-verification.spec.ts:137
reproduction: |
  Full repro chain (tested 2026-04-29 13:30 local):
  1. `set -a; source .env.local; set +a; export RESEND_API_KEY="re_test_only_local_e2e"; export ENABLE_TEST_ROUTES=1`
  2. `pnpm build` (production build needed — playwright webServer uses `pnpm start`)
  3. `pnpm exec playwright test tests/e2e/auth-signup-verification.spec.ts --reporter=list`
  4. Result: 1 passed (the new convergence test added in commit 2852450), 2 failed (:17 and :106).

  Webserver env (per playwright.config.ts:54-79): IDENTIFICATION_PROVIDER_MODE=stub, AUTH_JWKS_OVERRIDE_URL=<test JWKS server>, AUTH_AUDIENCE_OVERRIDE, AUTH_ISSUER_OVERRIDE, ENABLE_TEST_ROUTES=1, INNGEST_DEV=1.
  Database: local Supabase via .env.local DATABASE_POOL_URL (port 54322).
  Inngest dev runner was NOT running during the test run (npx inngest-cli dev terminated earlier). With INNGEST_DEV=1 and no runner, events no-op — non-issue for these two tests since they don't assert on email delivery.
started: |
  Discovered 2026-04-29 during the post-commit full-suite run for plan 04-13 / commit 2852450 (the /auth/check-email convergence fix). The two failing tests were authored at plan 04-06 and have not been touched since. Unknown whether they have ever passed locally on this machine — the previous time the full E2E suite was run here is unclear. The earlier integration-test pipelines (plan 04-13 acceptance) only ran vitest, not Playwright E2E. The CI run referenced in STATE.md (24911496475) was for plan 01-08 — predates plan 04-06. So these tests may never have run green outside of the plan author's machine.

## Eliminated

- "Verify route depends on session cookie": ELIMINATED. `src/app/auth/verify/route.ts` is purely token-driven (validates the token via `verifyEmail(token)`, redirects to `/` on success or `/auth/verify-error` on invalid). The token-only path means signup-jar cookies are NOT required to reach `/`. The downstream blocker is the `(app)/layout.tsx` cookie check on `/`, NOT the verify route itself.
- "/me allowlist regression since plan 04-06": ELIMINATED. `src/proxy.ts:42` includes `/^\/api\/v1\/iam\/me$/` in PUBLIC_API_ENDPOINTS (so the proxy doesn't 401 it for missing Bearer). `src/shared/api/auth.ts:83` includes `/api/v1/iam/me` in UNVERIFIED_ALLOWED_PATHS. The 401 in `:106` came from `requireApiUser`'s cookie fallback finding no session, not from a layered allowlist denial.
- "AUTH_*_OVERRIDE config drift": ELIMINATED for these two tests. The test JWKS override only affects Bearer JWT verification. Both failing tests use cookie-session path (no Authorization header sent), which goes through `getCurrentUserFromSession` (Supabase SSR client), bypassing the JWKS override entirely.

## Evidence

- timestamp: 2026-04-29
  checked: tests/e2e/auth-signup-verification.spec.ts:17-73 (test 1), :106-140 (test 2)
  found: |
    Test 1 (`:17`):
      - Line 25-36: `request.post("/api/v1/iam/signup", ...)` returns 200 (asserted).
      - Line 40-45: `request.get(.../latest-token?email=...)` returns 200 with rawToken matching `^[a-f0-9]{64}$`.
      - Line 49: `await page.goto(\`/auth/verify?token=${rawToken}\`)`.
      - Line 51: `await page.waitForURL(/.*\/$/)` — TIMES OUT at 30s.
      - Lines 53-58 comment: "cookies set by signup's signInWithPassword carry the Supabase SSR session." (presumption that turns out to be the bug.)

    Test 2 (`:106`):
      - Line 113-124: `request.post("/api/v1/iam/signup", ...)` returns 200 (asserted).
      - Line 127: `await page.request.get("/api/v1/iam/me")` — returns 401 instead of 200.
      - Line 137 expectation: 200; received 401.
      - Line 139 unreached: `expect(body.user.emailVerifiedAt).toBeNull()`.
  implication: |
    Both tests depend on Supabase SSR session cookies being readable from the `page` context (or `page.request`) AFTER a signup performed via the `request` fixture. Playwright fixtures `request` (test-level APIRequestContext) and `page.context()` (BrowserContext) maintain SEPARATE cookie jars by default. There is no shared topology unless explicitly configured (e.g. via `storageState`).

- timestamp: 2026-04-29
  checked: src/contexts/iam/application/signup.ts:178-192 (signInWithPassword call site)
  found: |
    After the DB tx commits, `authAdapter.signInWithPassword({ email, password })` is invoked inline. The wrapper catches "cookies()" thrown error (expected outside Next request scope, e.g. integration tests), and Sentry-captures any other failure. Inside a real Next request scope (which is what Playwright's `request.post(/signup)` runs in), `signInWithPassword` -> Supabase SSR client sets the session cookies via `response.cookies.setAll(...)`.
  implication: |
    The cookies ARE set on the response. They will land in whichever cookie jar made the request. Since `request.post` uses the APIRequestContext jar, the cookies go there. The `page` BrowserContext jar remains empty.

- timestamp: 2026-04-29
  checked: node_modules/.pnpm/playwright@1.59.1/node_modules/playwright/lib/index.js:439-453 (Playwright 1.59.1 `request` fixture wiring)
  found: |
    PRIMARY-SOURCE confirmation that Playwright's built-in `request` fixture creates a SEPARATE APIRequestContext jar:

    ```js
    request: async ({ playwright }, use) => {
      const request = await playwright.request.newContext();
      await use(request);
      ...
    }
    ```

    `playwright.request.newContext()` returns a fresh APIRequestContext with its own cookie jar. The browser `context` fixture is built independently in the same file. There is no storageState linkage in playwright.config.ts, so the two jars are unconditionally separate.
  implication: |
    Playwright's documented default behavior is to keep `request` and `page.context()` jars separate. The only documented bridge is `page.request.*` (which uses the BROWSER context jar — the same one `page.context().cookies()` reads). So the FIX is to do signup through `page.request.post(...)` instead of `request.post(...)`, putting the cookies in the page jar where downstream `page.goto(...)` and `page.request.get(...)` will read them.

- timestamp: 2026-04-29
  checked: src/app/auth/verify/route.ts (verify route)
  found: |
    The verify route is purely token-driven. It reads `request.url`'s `token` query param, calls `verifyEmail(token)`, and redirects to `/` on success, `/auth/verify-error?error=token_expired` on invalid, or `/auth/login?error=missing_token` on missing token. NO cookie reads, NO session checks.
  implication: |
    The verify-route step itself does not depend on session cookies. The redirect to `/` always happens given a valid token. So `:17`'s timeout cannot be caused by the verify route — the downstream blocker is whatever happens at `/`.

- timestamp: 2026-04-29
  checked: src/app/(app)/layout.tsx:31-37 ((app) route-group layout — the gate at `/`)
  found: |
    The (app) route group layout calls `getCurrentUserFromSessionReadOnly()` and, if the result is `!ok` (no session), `redirect("/auth/login")`. This runs on every navigation to `/`. With no cookie in the `page` jar, the layout's session lookup returns no_session and the user lands on `/auth/login`.
  implication: |
    `:17`'s `page.waitForURL(/.*\/$/)` regex matches URL terminators ending in `/`. `/auth/login` does NOT end in `/`, so the regex never matches and the 30s timeout fires. This pinpoints the proximate cause: cookie-jar split → no session at `/` → layout redirects to `/auth/login` → waitForURL never satisfied.

- timestamp: 2026-04-29
  checked: tests/e2e/auth-login-logout.spec.ts:34-111 (orthogonal test — discriminator)
  found: |
    The test uses `page.request.post('/api/v1/iam/login', ...)` (line 54) — the BROWSER context's APIRequestContext, which DOES share the page jar. Then `page.context().cookies()` (line 62) reads the same jar. Single jar, no split. This test should NOT exhibit the cookie-jar bug. The seed-verified-user diagnostic endpoint exists at `src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts` and is gated by `IDENTIFICATION_PROVIDER_MODE=stub` + `ENABLE_TEST_ROUTES=1`, both of which are set in playwright.config.ts:60-70.
  implication: |
    `auth-login-logout.spec.ts:34` failing in the full-suite run must have a DIFFERENT root cause from the cookie-jar split. Will re-run after the cookie-jar fix lands (see post-fix evidence below).

- timestamp: 2026-04-29 (post-fix verification)
  checked: empirical run of `pnpm exec playwright test tests/e2e/auth-signup-verification.spec.ts --reporter=list`
  found: |
    All 3 tests pass:
    ```
    ✓  unverified user (no verify click) sees emailVerifiedAt=null on /api/v1/iam/me (2.1s)
    ✓  signup form: successful submit converges to /auth/check-email with calm verify-email page (2.4s)
    ✓  signup → email arrival → verify link → /api/v1/iam/me returns 200 with verified user (2.9s)

    3 passed (5.5s)
    ```
  implication: |
    Cookie-jar split hypothesis is empirically confirmed. The fix (route signup through `page.request.post` instead of `request.post`) puts the Supabase SSR cookies in the page jar where (a) the page-navigation gate at `/` can read them, and (b) `page.request.get('/api/v1/iam/me')` can read them.

- timestamp: 2026-04-29 (post-fix follow-up: auth-login-logout)
  checked: empirical run of `pnpm exec playwright test tests/e2e/auth-login-logout.spec.ts --reporter=list`
  found: |
    Test :113 (`unauthenticated logout returns 200`) passes. Test :34 still fails — but at line 75:
    ```
    expect(refreshTokenValue).toBeTruthy();
    Received: undefined
    ```
    The test does:
    ```ts
    const supabaseCookies = cookiesAfterLogin.filter((c) => c.name.startsWith("sb-"));
    expect(supabaseCookies.length).toBeGreaterThan(0);   // PASSES
    ...
    const refreshCookie = supabaseCookies.find((c) => c.name.includes("refresh"));
    const refreshTokenValue = refreshCookie?.value;
    expect(refreshTokenValue).toBeTruthy();              // FAILS
    ```
    `@supabase/ssr@0.10.2` does NOT mint a separate "refresh" named cookie — it stores the full session (access token + refresh token + user) in chunked `sb-...-auth-token.0`, `.1`, ... cookies. The `name.includes("refresh")` filter returns nothing because there is no cookie with "refresh" in its name. This is a STALE assertion against an older Supabase SSR cookie schema, NOT the cookie-jar split bug.
  implication: |
    `auth-login-logout.spec.ts:34` has a different root cause than the cookie-jar split. The cookie-jar fix is correct and complete for the original symptom set. The login-logout failure should be opened as a SEPARATE debug session (suggested next action: rework the refresh-token capture path — either parse the chunked auth-token cookie value as JSON to extract `refresh_token`, or remove the post-logout `supabaseDirect.auth.refreshSession({ refresh_token })` assertion and rely on `meAfterLogoutResp.status() === 401` as the proof that the cookie was cleared).

## Resolution

root_cause: |
  Playwright's built-in `request` fixture (1.59.1) creates a SEPARATE APIRequestContext cookie jar from the `page` (BrowserContext) jar. The two failing tests in `tests/e2e/auth-signup-verification.spec.ts` performed signup via `request.post(...)` — landing the Supabase SSR session cookie in the request jar — then operated on `page` / `page.request`, which read an empty page jar. Test :17 timed out waiting for the (app)/layout's "no session → redirect to /auth/login" path to settle on `/`; test :106 saw `requireApiUser` find no cookie and emit 401.

fix: |
  Ported `tests/e2e/auth-signup-verification.spec.ts:17` and `:106` to use `page.request.post(...)` (and `page.request.get(...)`) instead of the test-level `request` fixture. `page.request` uses the BROWSER context's APIRequestContext, which DOES share the page jar. Now signup cookies land where `page.goto`, `page.context().cookies()`, and `page.request.get` can read them. Aligns with the existing `auth-login-logout.spec.ts:34` pattern (also uses `page.request.post`). Dropped the unused `request` fixture from both test signatures. Test `:81` (the convergence-regression test) was unchanged.

  TDD framing note: the failing tests ARE the red — but the bug was in the SPECs, not in production code. The fix amends the specs to match Playwright's documented cookie-jar behavior. No new test artifact authored; the existing `:81` test serves as the in-suite green covering page-only flow.

verification: |
  `pnpm exec playwright test tests/e2e/auth-signup-verification.spec.ts --reporter=list` — 3/3 pass (5.5s).

follow_ups:
  - "Open separate debug session for `tests/e2e/auth-login-logout.spec.ts:34`. Failure mode: `name.includes('refresh')` filter against `@supabase/ssr@0.10.2` returns nothing because that lib chunks the full session blob into `sb-{ref}-auth-token.{n}` cookies — there is no separately-named refresh cookie. Suggested fix: either decode the chunked auth-token blob to extract `refresh_token`, or remove the resolved-Q-AUTH-14 refresh-token-rotation assertion and rely on `meAfterLogoutResp.status() === 401` as the proof of cookie clearance. Since Q-AUTH-14 specifically resolved that the OLD refresh token must not work post-logout, decoding the chunked cookie is the correct path."
