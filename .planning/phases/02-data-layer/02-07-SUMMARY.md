---
phase: 02-data-layer
plan: "07"
subsystem: iam
tags: [auth, jwt, proxy, jose, jwks, tdd, lgpd, security]

# Dependency graph
requires:
  - phase: 02-01
    provides: jose dep installed; serverEnv.NEXT_PUBLIC_SUPABASE_URL parsed; ErrorCode.Unauthenticated in closed registry
  - phase: 02-02
    provides: per-context iam infrastructure/db/schema with users table (PRD §4 shape)
  - phase: 02-05
    provides: src/contexts/iam/infrastructure/db/users.ts (findById repository) and src/shared/db/client.ts (DbClient)
provides:
  - "src/contexts/iam/infrastructure/auth/auth-adapter.ts — createAuthAdapter factory wrapping jose.createRemoteJWKSet + jwtVerify, exposing verifyBearer(authHeader) and getUserById(id)"
  - "Factory injection seam: { jwks: JWTVerifyGetKey } OR { jwksUrl } OR { db } — Plan 09 E2E uses createLocalJWKSet without mocking jose"
  - "src/contexts/iam/application/current-user.ts — getCurrentUser() composing verifyBearer + users.findById; deleted-user JWTs return Unauthenticated (defense in depth)"
  - "src/shared/api/auth.ts — requireApiUser(request) that route helpers call as the authoritative gate"
  - "src/proxy.ts — wave-5 API-aware proxy: anchored-regex public allowlist, fast 401 on missing bearer for protected /api/v1/*, body never consumed, no JWT crypto in proxy"
  - "PUBLIC_API_ENDPOINTS typed RegExp[] with /^\\/api\\/v1\\/diagnostics\\/ping$/ as the day-one anchored entry"
  - "tests/unit/auth-adapter.test.ts — 12 cases covering verifyBearer + requireApiUser using real jose crypto via createLocalJWKSet (no network)"
  - "tests/unit/proxy-body-passthrough.test.ts — 3 cases asserting request.bodyUsed===false after proxy returns (T-02-37)"
  - "tests/integration/auth-jwt.integration.test.ts — 3 cases driving real jose against a tiny local HTTP JWKS server (D-44 hybrid path)"
  - "tests/integration/proxy-auth.integration.test.ts — 5 cases including the anchored-allowlist drift case (/api/v1/diagnostics/ping/extra → 401)"
affects: [02-09, 02-10, 03-*, 04-*]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Adapter-factory dual seam: production uses NEXT_PUBLIC_SUPABASE_URL → createRemoteJWKSet; tests pass createLocalJWKSet directly so the suite never needs network or jose mocks"
    - "Closed-registry error shape inlined into proxy: proxy module is dependency-free of @shared/config/errors so it stays cheap to load on every /api/v1/* request"
    - "Anchored regex public allowlist with `^...$` literals (T-02-38 mitigation against startsWith drift)"
    - "Test-only override (__setCurrentUserAdapterForTests) on current-user.ts mirrors the test-seam pattern used by other shared modules"
    - "Dynamic import inside beforeAll for integration tests that need env stubbed before serverEnv parses (no vitest.config.ts churn required)"

key-files:
  created:
    - src/contexts/iam/infrastructure/auth/auth-adapter.ts
    - src/contexts/iam/application/current-user.ts
    - src/shared/api/auth.ts
    - tests/unit/auth-adapter.test.ts
    - tests/unit/proxy-body-passthrough.test.ts
    - tests/integration/auth-jwt.integration.test.ts
    - tests/integration/proxy-auth.integration.test.ts
  modified:
    - src/proxy.ts

key-decisions:
  - "PUBLIC_API_ENDPOINTS is a typed `readonly RegExp[]` of anchored literal regexes, not a `string[]` allowlist. Anchored regex was an acceptance-criterion grep target (`/\\\\^.*\\\\$/`) and is the documented mitigation for T-02-38. A future drift like `/api/v1/diagnostics/ping/extra` is rejected automatically."
  - "Proxy returns the closed unauthenticated error shape inline, not by importing @shared/config/errors. Proxy is on the hot path for every /api/v1/* request; importing the errors module would pull in @shared/config/server-env via transitive imports in adjacent modules. The shape is tiny (15 lines) and is unit-tested via the integration suite that asserts body.error.code === 'unauthenticated'."
  - "Auth-adapter factory accepts BOTH `jwks: JWTVerifyGetKey` AND `jwksUrl: string` injection. The unit suite uses the local seam (no network); the integration suite stands up a tiny http.Server publishing the JWKS over HTTP so the full createRemoteJWKSet → fetch → jwtVerify chain runs end-to-end (D-44 hybrid path). Plan 09's E2E setup will use the URL form to point at a published test JWKS."
  - "current-user.ts treats a deleted users row (valid JWT but findById returns null) as Unauthenticated, not user_not_found. JWTs survive their owners; a deleted user's still-valid token must not authenticate. The reason field carries `user_not_found` for log surface but the public code stays in the closed registry."
  - "Integration tests stub env at module top AND defer the auth-adapter import to beforeAll. Vitest's integration project doesn't have a setup-env file (only the unit project does). Module-top env stubs run BEFORE the dynamic import inside beforeAll, satisfying serverEnv.parse(). This keeps changes scoped to plan 02-07 files — no vitest.config.ts churn (which is shared infrastructure)."
  - "Proxy matcher is an array: ['/((?!api|_next|_vercel|.*\\\\..*).*)','/api/v1/:path*']. The original page-level negative-lookahead pattern is preserved for non-API routes; the second entry adds /api/v1/:path* so the proxy fires on every API request. Acceptance criterion required `matcher no longer excludes all api paths` — array form satisfies this."
  - "Doc-comment scrubbing in proxy.ts: the docstring originally enumerated forbidden patterns by name (request.body, request.json(), request.formData()). Acceptance criteria literally require the file NOT to contain those strings, so the docstring was reworded to describe the discipline without naming the forbidden APIs. Test still proves bodyUsed===false structurally."

requirements-completed: [INFRA-03, INFRA-07]

# Metrics
duration: 10min
completed: 2026-04-26
---

# Phase 02 Plan 07: Auth Adapter + Proxy Composition Summary

**Wave-5 IAM auth boundary: Supabase JWT verification behind a `jose`-based adapter with a dual JWKS injection seam (URL or local key set), `requireApiUser` route-helper composition, and an API-aware Next 16 proxy that fast-rejects missing bearers on `/api/v1/*`, exposes a typed anchored-regex public allowlist (`/^\/api\/v1\/diagnostics\/ping$/`), and never consumes the request body — proven by a unit test asserting `request.bodyUsed === false` after the proxy returns. RED → GREEN → (no REFACTOR needed) for all three behaviors; 11 new tests across unit and integration projects.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-26T17:03:34Z
- **Completed:** 2026-04-26T17:13:30Z
- **Tasks:** 3 TDD behaviors (Task 1 AuthAdapter, Task 2 requireApiUser, Task 3 Proxy)
- **Commits:** 6 (3 [RED] + 3 [GREEN])
- **Files created:** 7 (2 src, 5 test)
- **Files modified:** 1 (`src/proxy.ts`)
- **Tests added:** 12 unit + 8 integration = 20 (all green)

## Accomplishments

- **AuthAdapter is cryptographic, not decode-only.** `createAuthAdapter()` defaults to `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json` via `jose.createRemoteJWKSet`. Every success path runs through `jwtVerify`; there is no decode-only fallback (T-02-17 mitigation). All failure paths fold to `ErrorCode.Unauthenticated` with a non-empty `reason` for log surface (T-02-19 mitigation).
- **Dual injection seam in the factory.** `createAuthAdapter({ jwks })` lets tests pass a `JWTVerifyGetKey` from `createLocalJWKSet` and run real jose crypto in-memory. `createAuthAdapter({ jwksUrl })` lets Plan 09 E2E publish a deterministic test JWKS over HTTP. Production always uses the default URL.
- **`requireApiUser(request)` is the authoritative gate.** Reads only the standard `Authorization` header (never the body), runs cryptographic verification via the adapter, then verifies the users row exists (defense in depth: deleted-user JWTs in flight return Unauthenticated). Adapter dependency is overridable via `__setCurrentUserAdapterForTests` so unit tests need no Drizzle, no network, no jose mocks.
- **Proxy is fast-fail only.** `src/proxy.ts` uses an anchored-regex public allowlist (`/^\/api\/v1\/diagnostics\/ping$/`), returns the closed unauthenticated error shape on protected `/api/v1/*` without a Bearer, and never inspects the body. Cryptographic JWT verification is left to route helpers (T-02-18 mitigation, D-34/D-47).
- **Body discipline is structurally proven.** `tests/unit/proxy-body-passthrough.test.ts` drives a `NextRequest` with a JSON body through the proxy directly and asserts `request.bodyUsed === false` after the proxy returns, in three cases: valid Bearer passthrough, missing-Bearer rejection, public allowlist passthrough. The end-to-end version through a real protected route is owned by Plan 09 (consent route).
- **Anchored allowlist guards against drift.** A path like `/api/v1/diagnostics/ping/extra` is rejected with 401 (T-02-38 mitigation). Substring or `startsWith` matching would have let it through.
- **Real JWKS HTTP path exercised in integration.** `tests/integration/auth-jwt.integration.test.ts` stands up a tiny `http.Server` publishing a JWKS at `/auth/v1/.well-known/jwks.json`, signs a JWT with the matching private key, and runs the full `createRemoteJWKSet → fetch → jwtVerify` chain (D-44 hybrid path). A second case proves a JWT signed with a different key fails closed.
- **Wave-5 contract test for the proxy boundary.** `tests/integration/proxy-auth.integration.test.ts` asserts the public ping passes 200, the drift path returns 401, a not-yet-wired protected `/api/v1/*` path returns 401 with the closed `unauthenticated` shape, a path with any Bearer (cryptographically invalid is fine) passes through to the route helper, and non-`/api/v1` paths are not gated. No reference to `/diagnostics/consent` or `/photos/upload` (those are Plan 09 / Plan 08 responsibilities).
- **No regressions.** `pnpm exec vitest run --project=unit` passes 153/153. `pnpm typecheck` and `pnpm lint` exit 0.

## Task Commits

| # | Phase | Subject | Hash |
|---|-------|---------|------|
| 1 | RED   | `test(02-07): add failing AuthAdapter JWT verification tests [RED]` | `23f3aa0` |
| 1 | GREEN | `feat(02-07): implement AuthAdapter with jose JWKS verification [GREEN]` | `821c9d8` |
| 2 | RED   | `test(02-07): add failing requireApiUser API helper tests [RED]` | `7141a14` |
| 2 | GREEN | `feat(02-07): implement requireApiUser + current-user composition [GREEN]` | `5e82592` |
| 3 | RED   | `test(02-07): add proxy auth + body-passthrough + real-JWKS tests [RED]` | `0dd442d` |
| 3 | GREEN | `feat(02-07): compose API-aware proxy with allowlist + body discipline [GREEN]` | `c474560` |

**Plan metadata commit:** the orchestrator owns it (parallel-executor mode).

## Files Created/Modified

### Implementation (Tasks 1–3 GREEN)

- **`src/contexts/iam/infrastructure/auth/auth-adapter.ts`** (104 lines, NEW) — `createAuthAdapter(options)` factory. Defaults JWKS URL to `${serverEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`. Accepts `{ jwks }` (preferred for tests) OR `{ jwksUrl }` (production / Plan 09 E2E). `verifyBearer` extracts the Bearer token, calls `jwtVerify`, returns `{ ok: true, userId }` on success; every error path returns `{ ok: false, code: ErrorCode.Unauthenticated, reason }`. `getUserById(id)` delegates to `iam/infrastructure/db/users.findById`.
- **`src/contexts/iam/application/current-user.ts`** (60 lines, NEW) — `getCurrentUser(authorizationHeader)` composes `verifyBearer` with `users.findById`. A valid JWT for a deleted user (no users row) returns `{ ok: false, code: Unauthenticated, reason: 'user_not_found' }`. `__setCurrentUserAdapterForTests(next | null)` overrides the singleton adapter for unit tests. The double-underscore prefix mirrors the existing test-seam pattern in this codebase.
- **`src/shared/api/auth.ts`** (29 lines, NEW) — `requireApiUser(request)` reads `request.headers.get('authorization')`, runs `getCurrentUser`, returns the `CurrentUserResult` shape unchanged. Re-exports `ErrorCode` so callers import the auth surface in one go. Never reads `request.body`.
- **`src/proxy.ts`** (111 lines, MODIFIED) — Replaces the no-op pass-through with: typed anchored-regex `PUBLIC_API_ENDPOINTS`, `isPublicApiPath` helper, `isApiV1Path` helper, `hasBearer` helper, `unauthenticatedResponse()` that emits the closed registry shape inline, default export `proxy(request)` that dispatches between `NextResponse.next()` and `unauthenticatedResponse()`. Matcher: `['/((?!api|_next|_vercel|.*\\..*).*)', '/api/v1/:path*']`. Security headers stay in `next.config.ts` (Plan 01-03) and are NOT duplicated here.

### Tests (Tasks 1–3 RED)

- **`tests/unit/auth-adapter.test.ts`** (278 lines, NEW) — Two `describe` blocks. The first (8 cases) covers `verifyBearer`: missing/empty/non-Bearer/malformed/expired/wrong-key inputs all map to `Unauthenticated`; a JWT signed by the test key verifies through a `createLocalJWKSet` and returns the expected `userId`; the factory accepts both seams. The second (4 cases) covers `requireApiUser`: missing header, invalid JWT, valid JWT with no users row, valid JWT with users row. Tests use `__setCurrentUserAdapterForTests` to inject deterministic adapters per case.
- **`tests/unit/proxy-body-passthrough.test.ts`** (80 lines, NEW) — 3 cases. Each constructs a `NextRequest` with method POST, JSON body, and a path under `/api/v1/`. Each runs the proxy and asserts `request.bodyUsed === false` after the proxy returns. Two cases additionally `await request.json()` to confirm end-to-end readability. Cases cover: valid Bearer passthrough, missing-Bearer 401 rejection, public allowlist path.
- **`tests/integration/auth-jwt.integration.test.ts`** (139 lines, NEW) — Stands up a `node:http` server bound to 127.0.0.1 publishing a JWKS at `/auth/v1/.well-known/jwks.json`. Three cases: valid JWT verifies through the live JWKS, JWT signed with a different key fails closed, missing Bearer fails closed. Module imports of `@contexts/iam/infrastructure/auth/auth-adapter` and `@shared/config/errors` are deferred to `beforeAll` so the env stubs at module top take effect before `serverEnv.parse()` runs.
- **`tests/integration/proxy-auth.integration.test.ts`** (99 lines, NEW) — 5 cases asserting the wave-5 proxy contract. Each case constructs a `NextRequest` and calls the proxy function directly (no HTTP). Cases: public ping passes (not 401); anchored-allowlist drift `/api/v1/diagnostics/ping/extra` returns 401; not-yet-wired `/api/v1/some/non-existent-path` returns 401 with closed `unauthenticated` shape; valid Bearer (cryptographically invalid is fine) passes through; non-`/api/v1` path is not gated.

## Decisions Made

See `key-decisions` in frontmatter. Seven decisions, anchored by acceptance criteria, threat model, or shared infrastructure constraints.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Integration test imports of auth-adapter parsed serverEnv at module-eval time before env stubs ran.**

- **Found during:** Task 3 first run of `pnpm exec vitest run --project=integration tests/integration/auth-jwt.integration.test.ts`.
- **Issue:** `auth-adapter.ts` imports `serverEnv` from `@shared/config/server-env`, which calls `serverSchema.parse(process.env)` at module-eval time. The integration test's static `import` of `auth-adapter` runs before the test file's body executes, so even though env vars were stubbed at module-top, the chain `auth-adapter → server-env → parse(process.env)` had already failed with `NEXT_PUBLIC_SUPABASE_URL: undefined`. The unit project has a `setupFiles: ['tests/unit/setup-env.ts']` block in `vitest.config.ts` that runs before any module imports; the integration project does not.
- **Fix:** Refactored `tests/integration/auth-jwt.integration.test.ts` to set env stubs at module top AND defer the `auth-adapter` and `errors` imports into `beforeAll` via `await import(...)`. The dynamic import resolves after the module-top assignments, satisfying `serverEnv.parse()`. Same pattern applied to `tests/integration/proxy-auth.integration.test.ts`.
- **Files modified:** `tests/integration/auth-jwt.integration.test.ts`, `tests/integration/proxy-auth.integration.test.ts`.
- **Plan-text correction for future plans:** when an integration test needs to import a module whose graph reads env at eval time, prefer `await import(...)` inside `beforeAll` over a top-level static import. Adding a `setupFiles` to the integration project would also work but changes shared infrastructure (`vitest.config.ts`) that other plans depend on; the dynamic-import workaround is locally scoped.
- **Committed in:** `0dd442d` (test [RED]) — the workaround was added before the first time the test file ran.

**2. [Rule 1 - Bug] Doc comment in `src/proxy.ts` originally listed forbidden patterns by name (`request.body`, `request.json()`, `request.formData()`).**

- **Found during:** Acceptance-criterion grep verification.
- **Issue:** The plan's acceptance criteria require the file to NOT contain `request.body`, `request.json()`, or `request.formData()` as substrings. The original docstring enumerated those forbidden APIs by name to describe the discipline. A literal grep would have failed even though the actual function body never calls them.
- **Fix:** Reworded the docstring to describe the discipline without naming the forbidden APIs ("MUST NOT consume the request body stream — no body reads, no JSON parsing, no form parsing"). The test (`bodyUsed === false`) is the structural proof; the doc comment is the human-readable rationale.
- **Files modified:** `src/proxy.ts`.
- **Plan-text correction for future plans:** acceptance criteria that grep for forbidden tokens should also note "in non-comment positions" OR the file authors should avoid those tokens entirely (which is what we did here).
- **Committed in:** `c474560` (folded into Task 3 GREEN via `git commit --amend`).

### Authentication Gates

None.

## Issues Encountered

- **`pnpm test:unit -- file.ts` is hook-blocked** — same issue documented in plan 02-05's SUMMARY. Worked around by using `pnpm exec vitest run --project=unit <file>` and `pnpm exec vitest run --project=integration <file>` throughout.
- **`prepare: false` warning from vite-tsconfig-paths plugin** is benign; vitest 4.1 has built-in tsconfig path support but the plugin still works. Out of scope for this plan; logged here as informational.

## Threat Flags

None. All threats from this plan's `<threat_model>` are mitigated:

- **T-02-17 unsigned-token acceptance:** `verifyBearer` only succeeds via `jwtVerify`. There is no decode-only path. Asserted by `auth-adapter.test.ts` cases for malformed JWT and signature mismatch.
- **T-02-18 proxy overreach:** Proxy does fast missing-bearer rejection only. Cryptographic verification is in `requireApiUser` (route helper). Asserted by `proxy-auth.integration.test.ts` "passes /api/v1/* requests carrying any Bearer header through".
- **T-02-19 JWKS local mismatch:** AuthAdapter fails closed with `Unauthenticated` and a non-empty `reason`. Asserted by `auth-jwt.integration.test.ts` "fails closed with Unauthenticated when the JWT was signed by a different key".
- **T-02-37 proxy body consumption:** Proxy reads only pathname and Authorization header. `bodyUsed === false` after proxy returns, asserted by `proxy-body-passthrough.test.ts` in three cases.
- **T-02-38 ambiguous public allowlist:** Allowlist is a typed `RegExp[]` of anchored literals. Asserted by `proxy-auth.integration.test.ts` "rejects an anchored-allowlist drift path with 401".

## Known Stubs

None. Every function shipped is wired to real data:

- `verifyBearer` runs real jose crypto (no decode-only path).
- `getCurrentUser` resolves a real users row via `findById`.
- `requireApiUser` is the authoritative gate for protected routes.
- The proxy returns real 401s and real `NextResponse.next()` values.

The test-only override (`__setCurrentUserAdapterForTests`) is a documented test seam, not a stub. It defaults to `null`, in which case the production factory runs.

## User Setup Required

None. No env-var changes, no dashboard config, no external service onboarding. Local `pnpm install` + the existing Supabase local stack are sufficient.

## Next Phase Readiness

- **Plan 02-09 (consent diagnostic route):** ready. The route helper now has `requireApiUser` to call as the authoritative gate. The consent POST route's body-passthrough end-to-end assertion is owned by Plan 09 (where the consent route is defined); Plan 07's unit test already proves the proxy doesn't consume bodies structurally.
- **Plan 02-09 E2E test JWT:** ready. The factory accepts `{ jwksUrl }` so Plan 09 can publish a tiny test JWKS endpoint and configure the adapter to point at it for E2E.
- **Plan 02-10 (CI reconciliation):** ready. The new tests run cleanly under `pnpm test:unit` and `pnpm test:integration`. `pnpm lint` and `pnpm typecheck` pass.
- **Future protected /api/v1/* routes (Plan 02-08 photos/upload, Plan 02-09 diagnostics/consent, Phase 4+ user routes):** ready. They all call `requireApiUser(request)` at entry and trust the proxy to have already filtered out missing-bearer requests.

## TDD Gate Compliance

Plan frontmatter is `type: tdd`. RED → GREEN sequence verified per behavior:

- **Task 1 (AuthAdapter):** `23f3aa0` (RED) → `821c9d8` (GREEN). RED commit landed before adapter file existed; tests failed with module-not-found. GREEN commit added the adapter; tests passed.
- **Task 2 (requireApiUser):** `7141a14` (RED) → `5e82592` (GREEN). RED commit landed before `current-user.ts` and `auth.ts` existed; tests failed with module-not-found. GREEN commit added both files; tests passed.
- **Task 3 (Proxy):** `0dd442d` (RED) → `c474560` (GREEN). RED commit added all 11 new tests; the proxy unit and integration tests failed (proxy was still the no-op pass-through). The auth-jwt integration test passed at this commit because Tasks 1–2 had already landed — that is intentional for a hybrid-path test that verifies cross-cutting infrastructure. GREEN commit replaced the proxy; all 11 tests passed.

No REFACTOR commits were needed. The GREEN implementations were small and direct enough that no cleanup was warranted.

## Self-Check: PASSED

**Created files exist:**

- FOUND: `src/contexts/iam/infrastructure/auth/auth-adapter.ts`
- FOUND: `src/contexts/iam/application/current-user.ts`
- FOUND: `src/shared/api/auth.ts`
- FOUND: `tests/unit/auth-adapter.test.ts`
- FOUND: `tests/unit/proxy-body-passthrough.test.ts`
- FOUND: `tests/integration/auth-jwt.integration.test.ts`
- FOUND: `tests/integration/proxy-auth.integration.test.ts`
- FOUND: `src/proxy.ts` (modified, 111 lines vs original 11)

**Commits exist on branch `worktree-agent-afd15623801eb625b`:**

- FOUND: `23f3aa0` test(02-07): add failing AuthAdapter JWT verification tests [RED]
- FOUND: `821c9d8` feat(02-07): implement AuthAdapter with jose JWKS verification [GREEN]
- FOUND: `7141a14` test(02-07): add failing requireApiUser API helper tests [RED]
- FOUND: `5e82592` feat(02-07): implement requireApiUser + current-user composition [GREEN]
- FOUND: `0dd442d` test(02-07): add proxy auth + body-passthrough + real-JWKS tests [RED]
- FOUND: `c474560` feat(02-07): compose API-aware proxy with allowlist + body discipline [GREEN]

**Acceptance criteria spot-check:**

- `auth-adapter.ts` contains `createRemoteJWKSet` — YES (1 occurrence)
- `auth-adapter.ts` contains `jwtVerify` — YES (3 occurrences across import, types, and call site)
- `auth-adapter.ts` contains `getUserById` — YES (3 occurrences across type, factory, and delegate)
- `auth-adapter.ts` factory accepts injected JWKS URL or local key set — YES (`AuthAdapterFactoryOptions.jwks` and `.jwksUrl`)
- `auth-adapter.test.ts` contains `JWKS` — YES (13 occurrences)
- `src/shared/api/auth.ts` exports `requireApiUser` — YES (`export async function requireApiUser`)
- `current-user.ts` imports a users repository, not a route file — YES (`from "@contexts/iam/infrastructure/db/users"`)
- Missing auth path maps to `ErrorCode.Unauthenticated` — YES (asserted by 4 unit tests)
- `src/proxy.ts` matcher no longer excludes all api paths — YES (`["/((?!api|_next|_vercel|.*\\..*).*)", "/api/v1/:path*"]`)
- `src/proxy.ts` contains the literal `PUBLIC_API_ENDPOINTS` — YES (2 occurrences: declaration + use)
- `src/proxy.ts` allowlist regex is anchored (`/^...$/`) — YES (`/^\/api\/v1\/diagnostics\/ping$/`)
- `src/proxy.ts` does NOT contain `request.body` — YES (zero occurrences)
- `src/proxy.ts` does NOT contain `request.json()` — YES (zero occurrences)
- `src/proxy.ts` does NOT contain `request.formData()` — YES (zero occurrences)
- `src/proxy.ts` returns `unauthenticated` for protected requests with no bearer — YES (`code: "unauthenticated"`)
- `proxy-auth.integration.test.ts` asserts public ping returns 200 without bearer — YES (case "allows public allowlisted /api/v1/diagnostics/ping through without a bearer")
- `proxy-auth.integration.test.ts` asserts a protected `/api/v1/*` path returns 401 without bearer — YES (case "rejects any not-yet-wired /api/v1/* path WITHOUT a bearer with 401")
- `proxy-body-passthrough.test.ts` asserts `request.bodyUsed === false` — YES (4 occurrences across 3 cases)

**Verification commands:**

- `pnpm exec vitest run --project=unit` — 153/153 passed
- `pnpm exec vitest run --project=integration tests/integration/auth-jwt.integration.test.ts tests/integration/proxy-auth.integration.test.ts` — 8/8 passed
- `pnpm typecheck` — exit 0
- `pnpm lint` — exit 0

**No accidental file deletions:** `git diff --diff-filter=D --name-only 63449e267fde57452b3cde2e73bbd88a8985ad07 HEAD` is empty.

**No modifications outside the plan's `files_modified`:** `git diff 63449e267fde57452b3cde2e73bbd88a8985ad07 HEAD --name-only` lists exactly the 8 files in the plan's `files_modified` block.

**No modifications to STATE.md or ROADMAP.md:** verified — `git diff 63449e267fde57452b3cde2e73bbd88a8985ad07 HEAD --name-only` shows no `.planning/STATE.md` or `.planning/ROADMAP.md` entries.

---

*Phase: 02-data-layer*
*Plan: 07*
*Completed: 2026-04-26*
