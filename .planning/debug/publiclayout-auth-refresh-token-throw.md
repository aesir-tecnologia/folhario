---
status: resolved
trigger: "PublicLayout throws AuthApiError: Invalid Refresh Token: Refresh Token Not Found on cold start"
created: 2026-04-28T00:00:00Z
updated: 2026-04-29T16:05:00Z
---

## Current Focus

reasoning_checkpoint:
  hypothesis: |
    The error in the dev overlay is NOT thrown out of PublicLayout/AppLayout. It is
    `console.error(refreshError)` emitted by `@supabase/auth-js` GoTrueClient at
    `dist/main/GoTrueClient.js:3838` inside `_recoverAndRefresh()` when the cold-
    start `supabase.auth.getUser()` call (via `getCurrentUserFromSessionReadOnly()`)
    triggers `initialize()`, which finds a stale Supabase session cookie, calls
    `_callRefreshToken`, gets a non-retryable AuthApiError "Invalid Refresh Token:
    Refresh Token Not Found", and logs it. Next.js 16 dev overlay surfaces this
    console.error as "Console AuthApiError" attributed to the React owner stack
    (PublicLayout / AppLayout). Compounding: the read-only Supabase client's
    no-op `setAll` (Pitfall 6) prevents `_removeSession()` (line 3841) from
    actually clearing the bad cookie, so the error recurs on every Server
    Component render until the cookie is removed client-side. The structural gap
    is that Folhário's `src/proxy.ts` deliberately does NOT do the standard
    `@supabase/ssr` middleware-level cookie-refresh dance (it only fast-rejects
    bearerless `/api/v1/*`), so there is no place where a session client with
    cookie-write capability can clear a stale cookie before Server Components
    run.
  confirming_evidence:
    - 'auth-adapter.ts:216-225 destructures only `data: { user }` from supabase.auth.getUser() — does not read or rethrow `error`. So when getUser returns `{ data: { user: null }, error: AuthApiError }`, getUserBySession correctly returns null. PublicLayout therefore renders cleanly (matches user-supplied "truth" field).'
    - "GoTrueClient.js:3836-3843: `await this._callRefreshToken(...)` returns `{ error: AuthApiError }` for stale tokens; the very next line is `console.error(error)`. This is the unique source of the surfaced error."
    - "GoTrueClient.js:3841: on a non-retryable refresh error, `_removeSession()` is called — which routes through the storage adapter's setAll. supabase-server.ts:46-50 (`getReadOnlySupabaseServerClient`) sets `setAll: () => { /* no-op */ }`, so the stale cookie persists after the failed refresh."
    - "src/proxy.ts has no `createServerClient` / `getUser` call. Its matcher only fires meaningful logic on `/api/v1/*` and only checks for a Bearer header. There is no cookie-refreshing middleware step — the standard supabase/ssr Next.js pattern's first half is missing."
    - "Stack frames in the user report (`fetch.ts:105:9` handleError, `GoTrueClient.ts:4414:18` inside _refreshAccessToken's retryable, `helpers.ts:232:26` retryable's `await fn(attempt)`) all point at the refresh-token POST inside `_refreshAccessToken`. The owner-stack frame `at PublicLayout` is React 19 owner-stack attribution for an awaited operation during that component's render — consistent with console.error during SSR, not an unhandled throw escaping the layout."
  falsification_test: |
    Wrap `await supabase.auth.getUser()` in auth-adapter.ts:222 in a try/catch
    that swallows any thrown error and returns null. If the dev overlay still
    shows "Console AuthApiError", the error is being LOGGED (not thrown) and
    the hypothesis stands. If the overlay clears, the error is being thrown and
    the hypothesis is wrong. Faster falsification: temporarily monkey-patch
    `console.error` in instrumentation-node.ts to push to a Set; load `/` with a
    stale cookie; assert the AuthApiError appears in the Set BEFORE the layout
    awaits anything visible.
  fix_rationale: |
    Two-layer fix needed. (1) Add a `proxy.ts` (or sibling `middleware.ts`)
    layer that, for non-API routes, creates a full read-write `createServerClient`
    using request/response cookies and calls `supabase.auth.getUser()` once.
    This is the standard @supabase/ssr Next.js pattern: middleware refreshes /
    clears the cookie via the response's setAll, so by the time Server
    Components run with the read-only client, cookie state is coherent — no
    stale cookies, no refresh attempts, no console.error. (2) Belt-and-braces:
    in `auth-adapter.ts.getUserBySession`, also read `error` from getUser's
    return shape and treat any AuthApiError as "unauthenticated" + tag it on
    Sentry. The console.error inside auth-js itself is library behavior we
    cannot suppress; structural fix (middleware) is the only way to prevent
    the refresh attempt from happening in Server Components in the first place.
  blind_spots:
    - "Did not run `pnpm dev` and reproduce the overlay locally — diagnosis is from source reading + auth-js library behavior trace. A reproduction would confirm the console.error path is the surfaced one (vs an unhandled rejection from a different call site)."
    - "Did not verify the exact Next.js 16 + React 19 dev overlay attribution rule. Owner-stack attribution for an awaited operation is consistent with the report, but the precise ‘Console’ prefix could also indicate captured rejected-promise output. Either way the source is auth-js's console.error or the unhandled-rejection variant of the same error — fix direction is unchanged."
    - "Did not check whether the OAuth `code` query param flow on /auth/callback is also affected (different code path; not in this repro)."

next_action: Resolved — both fix layers applied and tested. Reproduce manually in `pnpm dev` to confirm overlay is gone (recommended before closing UAT Test 1).

## Symptoms

expected: Cold start with no/stale Supabase cookies routes / -> /auth/login and renders cleanly. No console errors, no thrown errors out of layout components.
actual: Login page renders correctly, but Next.js dev overlay shows "Console AuthApiError — Invalid Refresh Token: Refresh Token Not Found" with a stack ending at PublicLayout. The error is library-side (auth-js console.error), not a thrown error escaping the layout.
errors:
  - 'AuthApiError: Invalid Refresh Token: Refresh Token Not Found'
  - 'at handleError (auth-js/src/lib/fetch.ts:105:9)'
  - 'at _request (auth-js/src/lib/fetch.ts:160:16)'
  - 'at _refreshAccessToken (auth-js/src/GoTrueClient.ts:4414:18)'
  - 'at retryable (auth-js/src/lib/helpers.ts:232:26)'
  - 'at PublicLayout (<anonymous>)'
reproduction: |
  UAT phase 04 Test 1: kill server, clear .next/, `pnpm db:start && pnpm dev`,
  load http://localhost:3000/ with a fresh browser session that nonetheless has
  leftover sb-* cookies from a prior session (or where the local DB was reset
  and the refresh-token row no longer exists).
started: Phase 4 UAT, after Plan 04-10 (commit afc31e9) moved the session-probe gate from root layout into (public)/layout.tsx and (app)/layout.tsx.

## Eliminated

- hypothesis: "PublicLayout throws AuthApiError — uncaught throw out of getUser propagates into the React tree."
  evidence: |
    Traced auth-js getUser path in
    /Users/machado/Projects/folhario/node_modules/.pnpm/@supabase+auth-js@2.104.1/node_modules/@supabase/auth-js/dist/main/GoTrueClient.js:
    `_getUser` (line 2468) wraps `_useSession` in try/catch (line 2494); the
    inner `if (error) throw error` (line 2481) is caught and converted to
    `{ data: { user: null }, error }` (line 2502). `_callRefreshToken` (line
    3881) similarly converts auth errors to a returned `{ error }` shape (line
    3905-3913). End-to-end: `supabase.auth.getUser()` does NOT throw on
    invalid refresh tokens — it returns `{ data: { user: null }, error: ... }`.
    The user's own "truth" field also confirms PublicLayout renders cleanly.
  timestamp: 2026-04-28T00:00:00Z

- hypothesis: "getCurrentUserFromSessionReadOnly() is missing a try/catch around getUserBySession."
  evidence: |
    current-user.ts:103-122 reads `session = await adapter.getUserBySession({ readOnly: true })`
    and treats null as `{ ok: false, code: Unauthenticated, reason: 'no_session' }`.
    Since auth-js returns `{ data: { user: null } }` (not a throw) for invalid
    refresh tokens, this code path works correctly — no try/catch is needed
    for correctness of the boolean session check. (It IS still worth adding
    defensive try/catch for resilience and to surface error details in
    Sentry, but that is not the ROOT cause of the reported overlay error.)
  timestamp: 2026-04-28T00:00:00Z

- hypothesis: "Tag any non-null `error` from getUser to Sentry (initial fix v1)."
  evidence: |
    Pre-second-advisor review: a first pass of fix #2 tagged Sentry whenever
    `error` was truthy. Advisor pointed out that `auth.getUser()` returns a
    non-null `error` (specifically `AuthSessionMissingError`) for the NORMAL
    "no cookie / not signed in" case — every anonymous page render would
    spam Sentry. The two pre-existing test cases ("returns null when no
    session user" / "returns {id, email} when session exists") used
    `error: null` mocks that misrepresented the library contract, so the
    over-broad predicate slipped through. Narrowed predicate via
    `isAuthSessionMissingError` from `@supabase/supabase-js` and added
    explicit "no Sentry on AuthSessionMissingError" test case as a
    discriminator. RED → GREEN confirmed.
  timestamp: 2026-04-29T00:00:00Z

## Evidence

- timestamp: 2026-04-28T00:00:00Z
  checked: "src/app/(public)/layout.tsx and src/app/(app)/layout.tsx"
  found: |
    Both call `getCurrentUserFromSessionReadOnly()` and handle the `!result.ok`
    case correctly (PublicLayout falls through, AppLayout redirects to
    /auth/login). Neither wraps the call in try/catch. The user's "truth"
    field confirms the function does not throw — symptom is purely a console
    error in the dev overlay.
  implication: "Layouts are well-behaved. The error must come from below the layout — inside the supabase client or an internal log call."

- timestamp: 2026-04-28T00:00:00Z
  checked: "src/contexts/iam/infrastructure/auth/auth-adapter.ts:216-225 (getUserBySession)"
  found: |
    Implementation:
    ```
    async getUserBySession({ readOnly = false } = {}) {
      const supabase = readOnly
        ? await getReadOnlySupabaseServerClient()
        : await getSupabaseServerClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !user.email) return null;
      return { id: user.id, email: user.email };
    }
    ```
    The destructure ignores `error`. There is no try/catch.
  implication: "If `auth.getUser()` THROWS, the throw propagates into the calling Server Component (would crash the layout). If it RETURNS `{ data: { user: null }, error }`, the function correctly returns null. The behavior of the auth-js library at version 2.104.1 must be confirmed."

- timestamp: 2026-04-28T00:00:00Z
  checked: "@supabase/auth-js 2.104.1 GoTrueClient internals: _getUser, _useSession, __loadSession, _callRefreshToken, _refreshAccessToken, _recoverAndRefresh"
  found: |
    Trace for stale-cookie cold start (cookie present, refresh token invalid
    on the server):
      1. supabase.auth.getUser() awaits this.initializePromise (line 2459).
      2. initialize() calls _recoverAndRefresh() (init path).
      3. _recoverAndRefresh loads the cookie session, sees it's expired,
         calls `await this._callRefreshToken(currentSession.refresh_token)`
         (line 3836).
      4. _callRefreshToken returns `{ data: null, error: AuthApiError }` for
         non-retryable auth errors (catch block, line 3905-3913).
      5. Back in _recoverAndRefresh line 3837-3843:
           if (error) {
             console.error(error);                       // <— SOURCE
             if (!isAuthRetryableFetchError(error)) {
               await this._removeSession();              // <— blocked by no-op setAll
             }
           }
      6. _removeSession() routes through the storage adapter, which in the
         read-only Supabase client uses `setAll: () => {}` — so the stale
         cookie is NOT actually cleared.
      7. Then getUser proceeds, finds no session, returns
         { data: { user: null }, error: AuthSessionMissingError } — adapter
         sees null user, returns null.
  implication: |
    The console.error at GoTrueClient.js:3838 is the unique source of the
    "Console AuthApiError" surfaced in the Next.js dev overlay. The error is
    LOGGED, not thrown. Owner-stack attribution to PublicLayout is correct
    behavior of Next.js 16 dev overlay capturing console output during SSR.

- timestamp: 2026-04-28T00:00:00Z
  checked: "src/contexts/iam/infrastructure/supabase-server.ts (read-only client)"
  found: |
    `getReadOnlySupabaseServerClient` sets `cookies.setAll: () => {}` per
    Pitfall 6 (Server Components in Next 16 throw on cookie writes). This is
    correct for the layout safety constraint, but it ALSO silently swallows
    auth-js's internal `_removeSession()` calls — so a known-bad cookie
    cannot be cleared from the Server Component pass.
  implication: |
    The read-only client is the second half of a two-part `@supabase/ssr`
    pattern. The first half — middleware that creates a read-write server
    client and calls getUser() to refresh/clear cookies via the response —
    is missing.

- timestamp: 2026-04-28T00:00:00Z
  checked: "src/proxy.ts (Next.js middleware)"
  found: |
    The proxy explicitly does NOT touch supabase.auth.* (T-02-37 body
    discipline; "must not pull in DB, jose, or env modules"). Its matcher
    activates on `/((?!api|_next|_vercel|.*\\..*).*)` and `/api/v1/:path*`,
    but the body of the function does only:
      - Allowlist + bearer-presence check on /api/v1/*
      - NextResponse.next() for everything else
    There is no `createServerClient(...)`, no `supabase.auth.getUser()`, no
    cookie merge into the response. The standard Supabase SSR Next.js
    middleware pattern is absent.
  implication: |
    Without middleware-level cookie refresh, a stale cookie hits Server
    Components directly. Pitfall 6 forces the Server Component path to use
    a read-only client that cannot clear the cookie. Net result: the
    AuthApiError-on-refresh occurs every Server Component render and is
    console.error'd by auth-js every time. This is the structural gap.

- timestamp: 2026-04-29T00:00:00Z
  checked: "RED tests written before fix (TDD)"
  found: |
    Two RED tests added before the fix to lock in falsifiable behaviour:
      1. `tests/unit/proxy-supabase-refresh.test.ts` (new) — asserts the
         proxy creates a `createServerClient` + calls `auth.getUser()`
         exactly once for `/` and `/auth/login`, merges `setAll` cookies
         into the NextResponse `Set-Cookie` header, and SKIPS the dance
         on `/api/v1/*` (preserves T-02-37 body discipline + 401 fast-
         reject).
      2. `tests/unit/auth-adapter-phase4.test.ts` (extended) — new case:
         when `auth.getUser()` returns `{ data: { user: null }, error:
         <AuthApiError-shaped> }`, `getUserBySession` returns null AND
         calls `Sentry.captureException(err, { tags: { surface:
         'iam.getUserBySession' } })`. CLAUDE.md hard rule asserted:
         no email anywhere in the Sentry payload.
    Pre-fix run: 4 failures with the diagnosed shape (`getUser` not
    called for page routes, no Set-Cookie, captureException 0 calls).
  implication: |
    RED was real (tests failed for the right reasons, not on mock setup).
    Each assertion maps 1:1 to a structural claim in the diagnosis.

- timestamp: 2026-04-29T00:00:00Z
  checked: "Advisor review — initial Sentry predicate was over-broad"
  found: |
    First-pass adapter fix tagged Sentry on every truthy `error`. Advisor
    flagged that auth-js returns `{ data: { user: null }, error:
    AuthSessionMissingError }` for the routine "no cookie / not signed
    in" case (every anonymous page render), so the predicate would burn
    Sentry quota on routine traffic. The pre-existing tests used
    `error: null` mocks that misrepresented the library contract, so the
    over-broad predicate passed the suite. Narrowed via
    `isAuthSessionMissingError` from `@supabase/supabase-js` (which auth-
    adapter.ts already depended on transitively via the supabase-admin
    client). Added a NEW test case asserting Sentry is NOT called when
    `error.name === 'AuthSessionMissingError'` — RED before the predicate
    fix, GREEN after — proving the discriminator works. Also corrected
    the existing "returns null when no session user" test to use the
    realistic `AuthSessionMissingError` shape so the suite documents the
    actual library contract.
  implication: |
    Final adapter fix tags Sentry only on operationally interesting auth
    errors (e.g. `AuthApiError "Invalid Refresh Token"`). Routine no-
    cookie traffic is silent. Tests now reflect the real auth-js return
    shape rather than a sanitised stand-in.

- timestamp: 2026-04-29T00:00:00Z
  checked: "GREEN run after both fixes (with narrowed Sentry predicate)"
  found: |
    `pnpm exec vitest run --project=unit --project=unit-dom` — 36 files,
    532 tests passed (up from 528: +5 new cases — 6 in proxy suite minus
    none replaced, 1 new in adapter, 1 corrected adapter case for realism).
    Existing tests unaffected: `proxy-body-passthrough.test.ts` still
    passes (proxy is now async but the test already used
    `await proxy(request)`). `pnpm typecheck` and `pnpm lint` clean (0
    errors; only pre-existing warnings unrelated to the fix).
  implication: |
    Structural fix is in place and locked in by tests. The auth-js
    `console.error` will no longer fire in Server Components on cold
    start because the middleware step refreshes/clears cookies BEFORE
    Server Components render. Belt-and-braces Sentry tagging in the
    adapter ensures any future operationally-interesting error from
    getUser is observable, while routine no-cookie traffic stays silent.

## Resolution

root_cause: |
  Two-layer cause:
    1. PRIMARY (the error appearing): `@supabase/auth-js` 2.104.1's
       GoTrueClient logs failed refresh attempts via `console.error(error)`
       at `node_modules/.../auth-js/dist/main/GoTrueClient.js:3838` inside
       `_recoverAndRefresh()`. Next.js 16's dev overlay captures this
       console output during SSR and attributes it to the awaiting Server
       Component's React owner stack (PublicLayout / AppLayout, depending
       on which route triggered it). The error is NOT thrown out of the
       layout — auth-js correctly returns `{ data: { user: null }, error }`
       and `getUserBySession` correctly returns null.
    2. COMPOUNDING (why it persists across renders): Folhário is missing the
       standard `@supabase/ssr` Next.js MIDDLEWARE step that creates a
       read-write server client and calls `supabase.auth.getUser()` to
       refresh/clear cookies via the response. `src/proxy.ts:96-119` only
       does fast bearer rejection on `/api/v1/*` (per T-02-37 body
       discipline). Server Components only see the read-only client
       (`getReadOnlySupabaseServerClient` at supabase-server.ts:39-53), whose
       no-op `setAll` blocks `_removeSession()` (called at GoTrueClient.js:3841
       after a non-retryable refresh error) from actually clearing the bad
       cookie. So every Server Component render that calls getUser triggers
       the same failed refresh + the same `console.error`.

fix: |
  Two-layer fix (TDD: RED → GREEN, all unit tests pass).

  1. **Structural (`src/proxy.ts`)** — adds the canonical `@supabase/ssr`
     Next.js middleware step for non-API page routes. The proxy is now
     `async`. For any `!isApiV1Path(pathname)` request it:
       a. Builds `NextResponse.next({ request })`.
       b. Creates a real `createServerClient` whose cookie adapter reads
          from `request.cookies.getAll()` and `setAll` writes to BOTH
          `request.cookies.set` (so any downstream code in the same
          request sees refreshed cookies) AND `response.cookies.set`
          (so the browser receives Set-Cookie).
       c. Calls `supabase.auth.getUser()` exactly once. Result is
          intentionally ignored — purely a cookie-coherence pass; route
          handlers and Server Components do their own auth disposition.
       d. Returns the merged response.
     `/api/v1/*` branch is identical to before (T-02-37 body discipline
     preserved; 401 fast-reject for bearerless protected paths
     unchanged; public allowlist regex unchanged).
     Imports added: `@supabase/ssr.createServerClient`,
     `@shared/config/client-env.clientEnv`. Module-header docstring
     updated to reflect both responsibilities and to drop the stale
     "must not pull in env modules" claim that referred to the old
     dependency-free shape.

  2. **Belt-and-braces (`src/contexts/iam/infrastructure/auth/auth-adapter.ts`)**
     — `getUserBySession` now destructures `{ data, error }` from
     `supabase.auth.getUser()`. NARROW predicate (advisor catch — see
     Eliminated #3): tag Sentry only on operationally interesting errors,
     filtering out the routine `AuthSessionMissingError` (anonymous-
     visitor return shape) via `isAuthSessionMissingError` from
     `@supabase/supabase-js`. On any other error, calls
     `Sentry.captureException(error, { tags: { surface:
     'iam.getUserBySession' } })` and returns `null`. CLAUDE.md hard
     rule honoured: payload contains zero email information (no
     `extra`, no `setUser`). The auth-js library's internal
     `console.error` is library behaviour we cannot suppress, but with
     fix #1 in place no failed refresh occurs inside Server Components
     in the first place — and if one ever does, fix #2 ensures the
     on-call signal is preserved instead of swallowed.

  Tests:
    - NEW: `tests/unit/proxy-supabase-refresh.test.ts` — 6 cases.
    - EXTENDED: `tests/unit/auth-adapter-phase4.test.ts` — 2 new cases
      (Sentry tagging on AuthApiError; Sentry NOT tagged on
      AuthSessionMissingError) plus the pre-existing "no session user"
      case rewritten to use the realistic `error: AuthSessionMissingError`
      shape so the suite documents the actual library contract.

verification: |
  Before fix:
    pnpm exec vitest run tests/unit/proxy-supabase-refresh.test.ts
    tests/unit/auth-adapter-phase4.test.ts
    → 4 failures (RED for the right reasons: getUser not called on
       page routes, no Set-Cookie merging, captureException not invoked).

  After fix (with narrowed predicate):
    pnpm exec vitest run tests/unit/proxy-supabase-refresh.test.ts
    tests/unit/auth-adapter-phase4.test.ts
    → 23 passed (all GREEN).
    pnpm exec vitest run --project=unit --project=unit-dom
    → 36 files, 532 tests passed (full unit suite — no regressions).
    pnpm typecheck → clean.
    pnpm lint → 0 errors (only pre-existing warnings unrelated to fix).

  Manual verification still recommended (UAT Test 1):
    Kill the dev server, clear `.next/`, `pnpm db:start && pnpm dev`,
    load http://localhost:3000/ with a stale `sb-*` cookie present.
    Expected: login page renders, NO "Console AuthApiError" in the
    Next dev overlay, and the browser receives a Set-Cookie that
    clears the stale cookie on the response.

files_changed:
  - src/proxy.ts
  - src/contexts/iam/infrastructure/auth/auth-adapter.ts
  - tests/unit/proxy-supabase-refresh.test.ts
  - tests/unit/auth-adapter-phase4.test.ts
  - tests/e2e/auth-cold-start-stale-cookie.spec.ts

## Reopened — fix-mechanism gap (2026-04-29 16:00)

### Empirical finding from regression spec

The Playwright spec `tests/e2e/auth-cold-start-stale-cookie.spec.ts`
exercises the real auth-js + ssr handshake (no mocks). Steps:
seed verified user → login → capture cookies → revoke server-side
via `/api/v1/iam/logout` → expire `expires_at` in the captured blob →
re-plant → navigate to `/auth/login`. Result before the second-pass
fix below:

  - `[WebServer]` log: `Error [AuthApiError]: Invalid Refresh Token:
    Refresh Token Not Found` (the diagnosed symptom IS reproduced).
  - Browser cookie jar after navigation: stale `sb-*-auth-token`
    cookie still present. Spec assertion fails.
  - Diagnostic `console.error` injected into the proxy's `setAll`
    callback NEVER prints — meaning the `@supabase/ssr` internal
    flush path (`onAuthStateChange` → `applyServerStorage` → `setAll`)
    does NOT fire on `_recoverAndRefresh` failure for this version
    pair (`@supabase/auth-js@2.104.1` + `@supabase/ssr@0.10.2`).

The original diagnosis (read-only client's no-op `setAll` blocks
removal) was directionally correct. The first-pass fix (replace with
read-write `setAll` in middleware) was wrong about WHO calls `setAll`
in the failure path: nobody does, in this version pair, despite
`_removeSession()` firing `_notifyAllSubscribers('SIGNED_OUT', null)`.

### Second-pass fix

`src/proxy.ts` no longer relies on `@supabase/ssr` to clear cookies on
refresh failure. Instead the middleware:

  1. Calls `supabase.auth.getUser()` (unchanged — still triggers any
     valid token refresh and propagates refreshed cookies through the
     `setAll` adapter; that path DOES work correctly via
     `TOKEN_REFRESHED` event flow).
  2. On a non-`AuthSessionMissingError` error from `getUser`,
     iterates `request.cookies.getAll()` and explicitly clears every
     `sb-*-auth-token(?:\.\d+)?` chunk with
     `response.cookies.set(name, "", { maxAge: 0, path: "/" })`.
  3. Tags the error on Sentry with `surface:
     proxy.refreshSupabaseSession`.

This sidesteps the entire library-internal storage-flush coordination
for the failure case. Idempotent: clearing absent cookies is a no-op.

### Verification (second pass)

  - `tests/e2e/auth-cold-start-stale-cookie.spec.ts` — 1 passed
    (4 assertions: no AuthApiError on browser console, no page errors,
    stale cookie cleared, explicit clearing Set-Cookie emitted).
  - `tests/unit/proxy-supabase-refresh.test.ts` — 8 passed (6
    original + 2 new: explicit-clear path, narrow predicate against
    `AuthSessionMissingError`).
  - `pnpm vitest run --project=unit` — 503 passed (full unit suite,
    no regressions).
  - `pnpm typecheck` — clean.

### Caveat that does not disappear

`@supabase/auth-js` still calls `console.error(error)` once in
`GoTrueClient._recoverAndRefresh` when the first refresh attempt
fails. This is library-internal and not silenceable without
monkeypatching. Because the fix now actually clears the cookie,
the error fires AT MOST once per cold-start (then the cookie is
gone → no further refresh attempts → no further log lines). Only
visible in dev mode (production builds have no Next 16 dev overlay
surfacing SSR `console.error` to the user).
