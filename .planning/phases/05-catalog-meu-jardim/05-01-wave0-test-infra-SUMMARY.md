---
phase: 05-catalog-meu-jardim
plan: 01
subsystem: testing
tags: [fake-indexeddb, playwright, fixtures, supabase-ssr, storage-adapter, indexeddb]

requires:
  - phase: 04-iam-auth-verification-consent
    provides: seedUser + seedCurrentPolicyVersions fixtures reused by authedUser Playwright fixture
  - phase: 02-data-layer
    provides: __setStorageAdapterForTests seam in photo-storage.ts; StorageAdapter contract

provides:
  - fake-indexeddb dev dep registered in unit-dom project setupFiles for IDB unit tests (D-25)
  - InMemoryStorageAdapter: hermetic opt-in Storage swap for catalog integration tests (D-27)
  - useInMemoryStorageAdapter(): beforeAll/afterAll helper for per-suite adapter injection
  - authedUser Playwright fixture: verified user + ConsentLog x2 + trialing Subscription + SSR cookies (D-26)
  - readOnly Playwright fixture: extends authedUser + sets __test_subscription_read_only=1 (D-21)

affects:
  - 05-catalog-meu-jardim (all Wave 1+ plans use these fixtures)
  - 05-03 (catalog repository integration tests use InMemoryStorageAdapter)
  - 05-10 (idb-persister unit tests use fake-indexeddb)
  - 05-15 through 05-18 (E2E catalog specs use authedUser/readOnly fixtures)

tech-stack:
  added:
    - fake-indexeddb@6.2.5 (devDependency)
  patterns:
    - Opt-in StorageAdapter swap via beforeAll/afterAll (per-suite, not global)
    - Playwright fixture chaining via test.extend for layered authenticated contexts
    - @supabase/ssr createServerClient cookie sink for minting SSR session cookies in tests
    - eslint-disable react-hooks/rules-of-hooks for Playwright fixture files (use() param)

key-files:
  created:
    - tests/unit/setup-idb.ts
    - tests/integration/fixtures/in-memory-storage-adapter.ts
    - tests/integration/fixtures/use-in-memory-storage-adapter.ts
    - tests/e2e/fixtures/authed-user.ts
    - tests/e2e/fixtures/read-only.ts
  modified:
    - package.json (fake-indexeddb devDependency)
    - pnpm-lock.yaml
    - vitest.config.ts (unit-dom setupFiles extended)

key-decisions:
  - "Used @supabase/ssr createServerClient cookie sink instead of hand-rolling base64url encoding for SSR session cookies — avoids project-ref derivation hacks for local Supabase URL (http://127.0.0.1:54321)"
  - "eslint-disable react-hooks/rules-of-hooks at file level in authed-user.ts — ESLint misidentifies Playwright's use() param as a React Hook call; directive is file-scoped and test-only"
  - "legal_basis for ConsentLog rows is 'contract' (verified from insertSignupConsents SQL at consent-logs.ts:105)"
  - "InMemoryStorageAdapter.deletePrefix guards prefix.endsWith('/') to mirror real Supabase semantics (CR-01 pattern from photo-upload integration test)"
  - "Cloud-Supabase guard in authedUser throws on startup if DATABASE_POOL_URL matches /supabase\\.co/ (T-05-02 mitigation)"
  - "Policy version IDs come from seedCurrentPolicyVersions() helper (export confirmed: { termsOfService: { id, version }, privacyPolicy: { id, version } })"

patterns-established:
  - "Playwright fixture SSR auth: createServerClient cookie sink → context.addCookies; no manual JWT/cookie encoding"
  - "Cleanup ordering: DELETE FROM public.users (cascades subscriptions + consent_logs) then supabase.auth.admin.deleteUser"

requirements-completed: []

duration: 4min
completed: "2026-05-01"
---

# Phase 5 Plan 01: Wave 0 Test Infrastructure Summary

**fake-indexeddb dev dep + InMemoryStorageAdapter opt-in fixture + authedUser/readOnly Playwright fixtures seeding verified user with SSR cookies via @supabase/ssr**

## Performance

- **Duration:** ~4 min
- **Started:** 2026-05-01T01:19:33Z
- **Completed:** 2026-05-01T01:23:46Z
- **Tasks:** 3
- **Files modified:** 7 (5 created, 2 edited)

## Accomplishments

- Installed `fake-indexeddb@6.2.5` and registered it in the `unit-dom` Vitest project with per-test `IDBFactory` reset — unblocks plan 05-10 idb-persister unit tests
- Shipped `InMemoryStorageAdapter` implementing the full `StorageAdapter` contract via `Map<bucket, Map<key, ObjectEntry>>` with correct `deletePrefix` folder semantics — opt-in per integration test suite, no global setup changes
- Shipped `authedUser` Playwright fixture that seeds verified user + 2 ConsentLog rows + trialing Subscription, then mints SSR cookies via `@supabase/ssr` `createServerClient` cookie sink and injects via `context.addCookies` — ~50ms per spec vs ~30s for full signup flow
- Shipped `readOnly` fixture extending `authedUser` that sets `__test_subscription_read_only=1` cookie for per-spec read-only mode testing (honoured by 05-11 stub when `ENABLE_TEST_ROUTES=1`)

## Task Commits

1. **Task 1: Install fake-indexeddb and wire into unit-dom setup** - `c694f2c` (chore)
2. **Task 2: InMemoryStorageAdapter + useInMemoryStorageAdapter fixture** - `d024c82` (feat)
3. **Task 3: authedUser + readOnly Playwright fixtures** - `d4ada66` (feat)

## Files Created/Modified

- `tests/unit/setup-idb.ts` — fake-indexeddb/auto import + beforeEach IDBFactory reset (D-25)
- `tests/integration/fixtures/in-memory-storage-adapter.ts` — InMemoryStorageAdapter class implementing StorageAdapter (D-27)
- `tests/integration/fixtures/use-in-memory-storage-adapter.ts` — opt-in beforeAll/afterAll helper calling __setStorageAdapterForTests
- `tests/e2e/fixtures/authed-user.ts` — authedUser Playwright fixture with cloud guard, seeding, SSR cookie injection (D-26)
- `tests/e2e/fixtures/read-only.ts` — readOnly fixture extending authedUser (D-21)
- `vitest.config.ts` — unit-dom setupFiles extended with setup-idb.ts
- `package.json` / `pnpm-lock.yaml` — fake-indexeddb devDependency

## Decisions Made

- **Cookie minting via @supabase/ssr createServerClient cookie sink** rather than hand-crafting base64url-encoded `sb-{ref}-auth-token` cookies. The `createServerClient` `setAll` callback captures whatever cookies the library writes (including chunked cookies for large sessions) and the `addCookies` call injects them exactly as the server-side SSR auth path expects. This eliminates the need to derive the project ref from `http://127.0.0.1:54321` (where the first DNS label is `127`, not a meaningful ref).

- **`legal_basis = 'contract'`** for signup ConsentLog rows — confirmed from `insertSignupConsents` SQL at `src/contexts/iam/infrastructure/db/consent-logs.ts:105` (same value as the integration test assertion at line 127 of iam-signup test).

- **`eslint-disable react-hooks/rules-of-hooks`** at file level in `authed-user.ts` — `eslint-config-next/typescript` (react-hooks plugin) misidentifies Playwright's `use()` fixture parameter as a React Hook call inside the `authedUser` function. The disable is file-scoped; `tests/` files are not linted for React hook rules in production context.

- **`policy_version_id` export confirmed**: `seedCurrentPolicyVersions()` returns `{ termsOfService: { id: string; version: string }, privacyPolicy: { id: string; version: string } }` — used `.termsOfService.id` and `.privacyPolicy.id` for ConsentLog inserts.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ESLint react-hooks/rules-of-hooks blocks commit of authed-user.ts**

- **Found during:** Task 3 (commit)
- **Issue:** lint-staged eslint --fix rejected the file because `use()` in the `authedUser` fixture function is flagged as a React Hook called outside a React component. The plan's code template uses `use` as the Playwright fixture parameter name (standard convention).
- **Fix:** Added `/* eslint-disable react-hooks/rules-of-hooks */` directive after the TEST-ONLY comment header. The disable is file-scoped (only affects the single test fixture file).
- **Files modified:** `tests/e2e/fixtures/authed-user.ts`
- **Verification:** `pnpm exec eslint tests/e2e/fixtures/authed-user.ts` exits 0.
- **Committed in:** `d4ada66` (Task 3 commit)

**2. [Rule 1 - Bug] TypeScript error in read-only.ts: readOnly fixture type not declared**

- **Found during:** Task 3 (`tsc --noEmit`)
- **Issue:** `authedTest.extend({readOnly: [...]})` without a type parameter caused TS2353 "Object literal may only specify known properties" since `readOnly` is not in the base fixture type.
- **Fix:** Added explicit `type ReadOnlyFixtures = { readOnly: boolean }` and used `authedTest.extend<ReadOnlyFixtures>({...})`. Also typed the fixture function parameters explicitly to satisfy TS7031/TS7006.
- **Files modified:** `tests/e2e/fixtures/read-only.ts`
- **Verification:** `pnpm exec tsc --noEmit` exits 0.
- **Committed in:** `d4ada66` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - compile/lint bugs)
**Impact on plan:** Both fixes required for correctness. No scope changes.

### Plan Wording Deviations (documented per plan output spec)

- **`tests/integration/setup.ts` does NOT exist** — the plan acknowledges this in the objective note. Used opt-in `useInMemoryStorageAdapter()` helper (per-suite beforeAll/afterAll) instead of a global setup extension. No tests/integration/global-setup.ts was modified (Phase 1 plan 01-04 lock preserved).
- **`tests/integration/db-rollback.ts`** — deferred to plan 05-02 per plan text. Not touched here.
- **TanStack/idb-keyval deps** — deferred to plan 05-10 per plan text.
- **Plan verify grep `grep -F "test.extend" tests/e2e/fixtures/read-only.ts`** — actual code has `authedTest.extend` (the imported `test` alias is named `authedTest`); structural requirement is satisfied.

## Known Stubs

None — this plan ships only test infrastructure (no UI rendering, no placeholder data).

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Trust boundary mitigations T-05-01 through T-05-04 implemented as specified.

## Self-Check: PASSED

All 5 created files confirmed present on disk. All 3 task commits confirmed in git log.

---

*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
