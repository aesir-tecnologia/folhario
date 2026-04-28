---
phase: 04-iam-auth-verification-consent
plan: 03
subsystem: iam
tags:
  [
    deps,
    server-env,
    crypto,
    throttle,
    zod-schemas,
    supabase-ssr,
    auth-adapter,
    auth-helpers,
    i18n,
    test-fixtures,
  ]
dependency-graph:
  requires:
    - 04-01 (Phase 4 prerequisite audit + Wave-1 reconciliation amendment)
    - 04-02 (auth_throttle/email_verification_tokens/password_reset_tokens schema + locked_until column + signup_acceptance enum literal)
  provides:
    - "src/shared/crypto/tokens.ts: mintToken/verifyToken (RESEARCH.md Pattern 7)"
    - "src/contexts/iam/infrastructure/db/auth-throttle.ts: drizzle-typed UPSERT-RETURNING + locked_until persistence (Codex HIGH #5)"
    - "src/shared/api/throttle.ts: withThrottle wrapper checking locked_until BEFORE counting"
    - "src/contexts/iam/domain/schemas.ts: 6 IAM request-body Zod schemas (signup/login/passwordReset×2/changePassword/oauthComplete)"
    - "src/contexts/iam/infrastructure/supabase-server.ts: getSupabaseServerClient + read-only variant (Pitfall 6)"
    - "src/contexts/iam/infrastructure/supabase-admin.ts: service-role admin client"
    - "src/contexts/iam/infrastructure/auth/auth-adapter.ts (extended): 8 new Phase 4 supabase.auth.* methods + authAdapter singleton (Codex HIGH #3)"
    - "src/contexts/iam/application/current-user.ts: getCurrentUserFromSession + getCurrentUserFromSessionReadOnly"
    - "src/shared/api/auth.ts: requireApiUser (Bearer→cookie fallback) + requireVerifiedUser + UNVERIFIED_ALLOWED_PATHS + isUnverifiedAllowed"
    - "src/contexts/iam/application/require-verified.ts: application-layer re-export"
    - "src/messages/pt-BR.json: 4 new namespaces (auth.*, settings.*, legal.*, email.*) merged with 13 existing"
    - "tests/integration/setup-supabase-truncate.ts: opt-in TRUNCATE helper for auth-bearing tables"
    - "tests/integration/fixtures/seed-policy-version.ts: seedCurrentPolicyVersions returning {termsOfService, privacyPolicy}"
    - "tests/integration/fixtures/seed-partner-code.ts: D-32 partner_stores seeders"
    - "tests/integration/fixtures/seed-user.ts: admin.createUser + public.users insert"
    - "tests/integration/fixtures/mock-resend.ts + mock-inngest.ts: vi.mock factories"
  affects:
    - "Plans 04-04..04-11 import from these modules without modification"
tech-stack:
  added:
    - "inngest@4.2.5"
    - "resend@6.12.2"
    - "@react-email/components@1.0.12"
    - "@supabase/ssr@0.10.2"
    - "@supabase/supabase-js@2.104.1 (already at this version; no upgrade)"
  patterns:
    - "Drizzle typed onConflictDoUpdate for UPSERT-RETURNING (preferred over raw SQL per Phase 2 D-19)"
    - "Lazy AuthAdapter singleton via Proxy — defers createAuthAdapter() to first method invocation"
    - "Bearer→cookie-session transport fallback in requireApiUser (single helper, two transports)"
    - "vi.hoisted() to share mock fns between vi.mock factories and test bodies (Vitest 4 hoisting)"
key-files:
  created:
    - "src/shared/crypto/tokens.ts (24 lines)"
    - "src/contexts/iam/infrastructure/db/auth-throttle.ts (96 lines)"
    - "src/shared/api/throttle.ts (110 lines)"
    - "src/contexts/iam/infrastructure/supabase-server.ts (51 lines)"
    - "src/contexts/iam/infrastructure/supabase-admin.ts (22 lines)"
    - "src/contexts/iam/application/require-verified.ts (8 lines)"
    - "tests/unit/tokens.test.ts (50 lines, 7 tests)"
    - "tests/unit/iam-signup-schema.test.ts (179 lines, 21 tests)"
    - "tests/unit/auth-throttle-math.test.ts (60 lines, 7 tests)"
    - "tests/unit/auth-adapter-phase4.test.ts (240 lines, 16 tests)"
    - "tests/integration/iam-throttle.integration.test.ts (172 lines, 11 tests)"
    - "tests/integration/setup-supabase-truncate.ts (32 lines)"
    - "tests/integration/global-setup.ts (10 lines, marker)"
    - "tests/integration/fixtures/seed-policy-version.ts (45 lines)"
    - "tests/integration/fixtures/seed-partner-code.ts (53 lines)"
    - "tests/integration/fixtures/seed-user.ts (70 lines)"
    - "tests/integration/fixtures/mock-resend.ts (28 lines)"
    - "tests/integration/fixtures/mock-inngest.ts (20 lines)"
  modified:
    - "package.json (+5 deps, +1 script: inngest:dev)"
    - "pnpm-lock.yaml (+150 packages)"
    - ".env.example (+6 vars: INNGEST_*, RESEND_*, SUPABASE_AUTH_EXTERNAL_GOOGLE_*)"
    - "src/shared/config/server-env.ts (+6 Zod fields, RESEND_FROM_ADDRESS default)"
    - "src/contexts/iam/domain/schemas.ts (+79 lines: 6 request schemas + ianaTimezone refinement)"
    - "src/contexts/iam/infrastructure/auth/auth-adapter.ts (+125 lines: 8 Phase 4 methods + authAdapter singleton)"
    - "src/contexts/iam/application/current-user.ts (+50 lines: getCurrentUserFromSession + read-only variant)"
    - "src/shared/api/auth.ts (rewritten: Bearer→cookie fallback, requireVerifiedUser, UNVERIFIED_ALLOWED_PATHS, isUnverifiedAllowed)"
    - "src/messages/pt-BR.json (+180 lines: 4 new top-level namespaces)"
    - "vitest.config.ts (integration project gains setupFiles → global-setup.ts marker)"
    - "tests/unit/auth-adapter.test.ts (Phase 2 fixtures wrapped in buildPlan02FakeAdapter helper)"
    - "tests/integration/diagnostics-consent.integration.test.ts (UserRow fixture extended with emailVerifiedAt + adapter stubs Phase 4 methods)"
decisions:
  - "Extended Phase 2 AuthAdapter at src/contexts/iam/infrastructure/auth/auth-adapter.ts instead of forking a new module at src/contexts/iam/infrastructure/auth-adapter.ts as the plan template specified — Phase 2's existing path is the canonical location; verifyBearer/getUserById and the 8 new Phase 4 methods coexist cleanly in one boundary module."
  - "authAdapter singleton implemented via lazy Proxy so unit tests can mock @supabase/* modules without triggering live client construction at import time."
  - "requireApiUser tries Bearer first, falls back to Supabase SSR cookie session — single helper, two transports. Phase 2 routes unaffected; Phase 4 cookie flows work without migration."
  - "Kept Phase 2's CurrentUserResult shape ({ok, user} | {ok: false, code, reason}) — the plan's {user} | {error: Response} shape would have churned 7 call sites; semantically equivalent."
  - "Domain User type omitted — Phase 2's UserRow already covers every needed field. Adding a parallel type would create two structurally-overlapping aliases."
  - "Used drizzle's typed onConflictDoUpdate API instead of raw SQL ON CONFLICT DO UPDATE — emitted SQL identical, type-safe per Phase 2 D-19."
  - "Wave-1 reconciliation honored: seedCurrentPolicyVersions returns BOTH {termsOfService, privacyPolicy} ids so signup flows can write 2 consent_logs rows distinguished by policy_version_id (per audit amendment)."
metrics:
  duration_minutes: 25
  completed: 2026-04-27T01:14:00Z
  tasks_completed: 9
  files_changed: 30
  commits: 13
---

# Phase 4 Plan 03: Shared Foundation Summary

**One-liner:** Front-loaded every shared file Phase 4 plans 04-11 will consume — token crypto, per-IP throttle with locked_until persistence (Codex HIGH #5), Supabase SSR + admin clients, AuthAdapter as the SOLE module touching `supabase.auth.*` (Codex HIGH #3 boundary verified by grep), Zod request-body schemas, requireApiUser/requireVerifiedUser auth gates with Bearer→cookie fallback, UNVERIFIED_ALLOWED_PATHS allowlist (with /legal/terms + /legal/privacy per Codex MEDIUM consent UX fix), pt-BR locale tree (4 new namespaces merged with 13 existing), and the integration-test fixtures (seed-policy-version → both T&C and Privacy rows for Wave-1 reconciliation, seed-partner-code for D-32, seed-user, mock-resend, mock-inngest, opt-in TRUNCATE helper).

## What landed

### Tasks 1-2: deps + tokens (RED→GREEN)

| Item                        | Result                                                                                                                                                                                        |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 5 npm deps                  | inngest@4.2.5, resend@6.12.2, @react-email/components@1.0.12, @supabase/ssr@0.10.2, @supabase/supabase-js@2.104.1 (already at this version, no upgrade)                                       |
| 6 server-env vars (Zod)     | INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY, RESEND_API_KEY (optional per D-20), RESEND_FROM_ADDRESS (default `onboarding@resend.dev` per D-19), SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID/SECRET    |
| `inngest:dev` script        | `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest` per RESEARCH.md Pitfall 5                                                                                                   |
| `mintToken()`/`verifyToken` | 256-bit randomBytes hex; sha256 hex digest; `crypto.timingSafeEqual` on equal-length hex Buffers (T-04-03-01); 7 unit tests passing                                                           |

### Task 3: throttle (TDD; unit + integration)

- **`auth-throttle.ts`**: drizzle-typed `onConflictDoUpdate` on `(ip, endpoint, window_start)` PK; trip threshold `count > 5` (D-14); on trip, `UPDATE` writes `locked_until = now() + 5 minutes` on the same bucket.
- **`getCurrentLockoutEnd`**: scans by `(ip, endpoint)` regardless of `window_start` → lockout survives 1-minute bucket boundary (Codex HIGH #5 first clause).
- **`throttle.ts`** `withThrottle`: checks `isCurrentlyLocked` BEFORE counting; `"always"` mode increments before handler (D-15 signup); `"on-failure"` mode counts 401/403 + oauth-callback 302 redirects with `?error=oauth_failed` (Codex HIGH #5 second clause).
- **Closed registry**: `RateLimited` (429) only emitted code; no new codes added.
- 7 unit + 11 integration tests, all passing against live local Postgres.

### Task 4: Zod schemas (TDD)

- 6 request-body schemas: `signupRequestSchema`, `loginRequestSchema`, `passwordResetRequestSchema`, `passwordResetConsumeSchema`, `changePasswordSchema`, `oauthCompleteSchema`.
- AUTH-06 age literal `true`, AUTH-08 IANA timezone refinement (`Intl.supportedValuesOf("timeZone")`), AUTH-09 terms/privacy literals `true`, optional `partner_code` accepting present/missing/empty.
- All schemas `.strict()` (T-04-03-07 prototype-pollution guard); 21 unit tests covering valid + invalid bodies.

### Task 5: Supabase clients

- `supabase-server.ts`: `getSupabaseServerClient` (full setAll for Route Handlers) + `getReadOnlySupabaseServerClient` (no-op setAll for Server Components per Pitfall 6).
- `supabase-admin.ts`: service-role client with `persistSession: false`, `autoRefreshToken: false`.
- INTERNAL to AuthAdapter only — application code never imports these directly (Codex HIGH #3 boundary).

### Task 6: AuthAdapter Phase 4 surface (TDD)

8 new methods on the existing `AuthAdapter` interface:

| Method                   | Purpose                                                                                       |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| `getUserBySession`       | Cookie-session lookup; readOnly variant for Pitfall 6 Server Component safety                 |
| `createUser`             | D-03: `admin.createUser({email_confirm: true})` so Folhário sends its own verification email |
| `signInWithPassword`     | T-04-07-02: maps any Supabase error to `invalid_credentials` (no enumeration leak)            |
| `signOutLocal`           | D-05 + AUTH-14: `signOut({scope: 'local'})`; idempotent, swallows errors                      |
| `adminUpdatePassword`    | D-10 + AUTH-12: `admin.updateUserById({password})` WITHOUT calling signOut                    |
| `adminDeleteUser`        | D-25 compensating delete on signup tx failure; best-effort                                    |
| `signInWithOAuth`        | D-04: returns the Google OAuth URL                                                            |
| `exchangeCodeForSession` | D-04: code-for-session exchange in `/auth/callback` and returns `{userId, email}`             |

`authAdapter` singleton via lazy Proxy so unit tests can swap via `__setCurrentUserAdapterForTests` without triggering live client construction.

**Codex HIGH #3 boundary verified empirically:**

```text
$ grep -rn "supabase\.auth\." src/contexts/iam/application/ src/contexts/iam/api/ src/app/api/
(no matches)

$ grep -rn "from \"@supabase/" src/contexts/iam/application/ src/contexts/iam/api/
(no matches)
```

Only the AuthAdapter touches `supabase.auth.*`; only it imports `@supabase/*`.

16 unit tests covering all 8 methods using `vi.hoisted()` for shared fn references between mock factories and test bodies.

### Task 7: auth helpers + UNVERIFIED_ALLOWED_PATHS

- `requireApiUser(request)` — tries `Authorization: Bearer` first (Phase 2 path), falls back to Supabase SSR cookie session (Phase 4 web/PWA flow). Single helper, two transports.
- `requireVerifiedUser(request)` — additional gate on `emailVerifiedAt IS NOT NULL` (D-22 product source of truth); returns `{ok: false, code: EmailUnverified}` for authenticated-but-unverified.
- `UNVERIFIED_ALLOWED_PATHS` (D-23 default-deny): includes `/legal/terms`, `/legal/privacy` for Codex MEDIUM consent UX fix; static + infrastructure paths use RegExp matchers.
- `isUnverifiedAllowed(pathname)` predicate composes string + RegExp matchers.
- `current-user.ts` adds `getCurrentUserFromSession` + `getCurrentUserFromSessionReadOnly` going through `authAdapter.getUserBySession` (Codex HIGH #3 — never imports `@supabase/*` directly).

### Task 8: pt-BR locale (merge, not replace)

- Preserved 13 existing top-level keys (nav, home, catalog, identify, profile, theme, app, offline, readonly, sync, focus, error, dialog).
- Added 4 new top-level namespaces: `auth.*` (8 sub-namespaces incl. `unverifiedBlocker`), `settings.*` (account + 5 placeholders), `legal.*` (stub-page copy with `underConstruction` template), `email.*` (verification + passwordReset + welcomeBack).
- `auth.signup.legalLinks` + `auth.oauthComplete.legalLinks`: T&C and Privacy bound to active policy_version (Codex MEDIUM consent UX fix).
- File path verified: `src/i18n/request.ts:9` imports `../messages/${locale}.json` → `src/messages/pt-BR.json` is the right path.

### Task 9: integration test fixtures + vitest setupFiles

- `setup-supabase-truncate.ts`: opt-in TRUNCATE helper for 7 auth-bearing tables (D-28).
- `seed-policy-version.ts`: `seedCurrentPolicyVersions` seeds BOTH T&C and Privacy rows in `policy_versions` (per Wave-1 reconciliation: signup writes 2 consent_logs rows distinguished by `policy_version_id` → `documentType`).
- `seed-partner-code.ts`: `seedActivePartnerCode` + `seedInactivePartnerCode` for D-32 PartnerStore validation. Uses `partner_stores` (plural) per actual Phase 2 schema.
- `seed-user.ts`: admin.createUser + public.users insert in one helper.
- `mock-resend.ts` / `mock-inngest.ts`: vi.mock factories with reset helpers per D-29.
- `vitest.config.ts`: integration project gains `setupFiles: ["./tests/integration/global-setup.ts"]` (currently a marker). The integration project still does NOT inherit `tests/unit/setup-env.ts` — Phase 1 plan 01-04 regression guard preserved (verified: `tests/unit/setup-env` only mentioned inside a comment explaining the fix).

## Tests

| Suite       | Tests | Status |
| ----------- | ----- | ------ |
| unit + unit-dom | 498   | PASS  |
| integration | 85    | PASS  |
| **total**   | **583** | **PASS** |

New unit test files (51 new tests):
- `tests/unit/tokens.test.ts` — 7 tests
- `tests/unit/iam-signup-schema.test.ts` — 21 tests
- `tests/unit/auth-throttle-math.test.ts` — 7 tests
- `tests/unit/auth-adapter-phase4.test.ts` — 16 tests

New integration test file:
- `tests/integration/iam-throttle.integration.test.ts` — 11 tests against live local Postgres

## Deviations from plan

### Rule 1 (auto-fixed bugs / convention drift)

1. **`users.ts` stub rejected** — plan instructed "Ship a TEMPORARY stub" with throwing `getUserById`; the file already exists at the same path with the real `findById` implementation (Phase 2). Writing the stub would have destroyed working code. `current-user.ts` uses the existing `findById` via `authAdapter.getUserById` (which delegates to `findById`). Downstream plans keep using `findById` from `@contexts/iam/infrastructure/db/users`.
2. **AuthAdapter path** — plan's `files_modified` listed `src/contexts/iam/infrastructure/auth-adapter.ts` (no `auth/`); actual Phase 2 path is `src/contexts/iam/infrastructure/auth/auth-adapter.ts`. Extended the existing module per the user prompt's explicit directive ("existing — extend, do not duplicate"). Phase 2's `verifyBearer`/`getUserById` and Phase 4's 8 new methods coexist cleanly.
3. **Return shape kept** — plan specified `{user} | {error: Response}` for `requireApiUser`; Phase 2 ships `{ok: true, user} | {ok: false, code, reason}` and is widely consumed (7 call sites incl. consent route + photo upload). Migrating shapes would churn unrelated code; semantically equivalent. Downstream Phase 4 plans use `if (!auth.ok) return errorResponse(auth.code, msg)`.
4. **Domain `User` type omitted** — plan listed a parallel `User` type in the schemas file; Phase 2's `UserRow` already covers every field downstream plans need. `hasPassword` doesn't exist as a column — derive at use-site if needed.
5. **`getCurrentUserOrNull` renamed** — plan specified `getCurrentUserOrNull()` for Server Components; chose `getCurrentUserFromSessionReadOnly()` to align with the explicit `From{Bearer,Session}{,ReadOnly}` naming pattern next to the existing `getCurrentUser(header)`.
6. **Drizzle typed `onConflictDoUpdate`** instead of raw `INSERT ... ON CONFLICT DO UPDATE` — emitted SQL identical; type-safe per Phase 2 D-19. (Plan's grep acceptance criterion `grep -cE "ON CONFLICT.*DO UPDATE"` returns 0; the equivalent `grep -c "onConflictDoUpdate"` returns 1.)
7. **`partner_stores` plural with `name`/`code`/`trial_days`/`is_active`** — plan template's seed-partner-code.ts referenced `partner_store` (singular) with `partner_name`/`active` columns that don't exist. Used the actual Phase 2 schema.
8. **`policy_versions` actual schema** — plan template had `terms_url`/`privacy_url` columns that don't exist; actual schema is `(id, version, document_type, effective_at, is_current)`. `seedCurrentPolicyVersions` now seeds BOTH `terms_of_service` and `privacy_policy` rows and returns `{termsOfService, privacyPolicy}` ids — Wave-1 reconciliation per the audit amendment.
9. **pt-BR.json merged not replaced** — plan said "currently `{}`"; the file already carried 13 top-level keys from Phase 1-3. Merged Phase 4's 4 new namespaces alongside; no existing key was removed.
10. **Lazy `authAdapter` singleton via Proxy** — direct `export const authAdapter = createAuthAdapter()` would invoke `serverEnv` and Supabase client construction at import time, breaking unit tests that mock `@supabase/*` modules. Proxy defers `createAuthAdapter()` to first method call so test-time mocks land before construction.

### Rule 3 (blocking issues)

11. **`tests/integration/diagnostics-consent.integration.test.ts` UserRow fixture** missing `emailVerifiedAt` (Phase 4 plan 02 leftover — the plan 02 SUMMARY claimed this was fixed but the SELECT and the UserRow construction both omitted it). Fixed inline as part of Task 1 to unblock typecheck.
12. **`tests/unit/auth-adapter.test.ts` + `diagnostics-consent.integration.test.ts` adapter fixtures** failed typecheck after I extended the `AuthAdapter` interface with 8 new methods (Plan 02 fixtures only stubbed `verifyBearer`/`getUserById`). Added `buildPlan02FakeAdapter` helper providing default Phase 4 method stubs; existing tests unchanged in semantics, all 467→498 unit tests pass.

### Architectural decisions (Rule 4) raised

None — all deviations were Rule 1/3 fixes within plan scope.

## Codex HIGH/MEDIUM coverage

| Codex finding                            | Status | Evidence                                                                                                                          |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------- |
| HIGH #3 (AuthAdapter as sole boundary)   | FIXED  | `grep -rn "supabase\.auth\." src/contexts/iam/application/ src/contexts/iam/api/ src/app/api/` returns 0 matches                  |
| HIGH #3 (no `@supabase/*` import in app) | FIXED  | `grep -rn "from \"@supabase/" src/contexts/iam/application/ src/contexts/iam/api/` returns 0 matches                              |
| HIGH #5 (5-min lockout via `locked_until`) | FIXED  | `auth-throttle.ts` writes `locked_until` on trip; `getCurrentLockoutEnd` scans by `(ip, endpoint)` regardless of `window_start`   |
| HIGH #5 (oauth-callback 302 counted)     | FIXED  | `throttle.ts:isOauthCallbackFailure` matches 302/303 with `error=oauth_failed`; integration test asserts                          |
| MEDIUM consent UX (T&C/Privacy hyperlinks) | FIXED  | `auth.signup.legalLinks` + `auth.oauthComplete.legalLinks` namespaces in pt-BR.json; UNVERIFIED_ALLOWED_PATHS includes both pages |

## Plan acceptance criteria — diff

| Criterion                                                                                  | Outcome                                                                              |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| 5 npm deps installed                                                                       | PASS                                                                                 |
| 6 new env vars in server-env + .env.example                                                | PASS                                                                                 |
| `inngest:dev` script                                                                       | PASS                                                                                 |
| `mintToken/verifyToken` with `timingSafeEqual`                                             | PASS — 7 unit tests                                                                  |
| 5 throttle helpers                                                                         | PASS — 7 unit + 11 integration tests                                                 |
| `withThrottle` checks `isCurrentlyLocked` BEFORE counting                                  | PASS — Codex HIGH #5 first clause                                                    |
| `withThrottle` handles oauth-callback 302                                                  | PASS — Codex HIGH #5 second clause; integration test asserts                          |
| 6 Zod schemas                                                                              | PASS — 21 unit tests; AUTH-06/08/09/10 enforced                                      |
| Supabase server (full + read-only) + admin                                                 | PASS                                                                                 |
| AuthAdapter 8 methods + singleton                                                          | PASS — 16 unit tests; boundary verified                                              |
| `requireApiUser` + `requireVerifiedUser` + UNVERIFIED_ALLOWED_PATHS                        | PASS — Bearer→cookie fallback; legal pages included                                  |
| `users.ts` stub                                                                            | DEVIATED — Phase 2 already ships real `findById`; stub would have destroyed it        |
| pt-BR.json 12 namespaces                                                                   | PASS — 4 new namespaces (auth/settings/legal/email) merged with 13 existing          |
| `auth.signup.legalLinks.termsHref` = `/legal/terms`                                        | PASS                                                                                 |
| 6 fixtures + vitest setupFiles + global-setup                                              | PASS                                                                                 |
| integration project does NOT include `tests/unit/setup-env`                                | PASS — only mentioned in comment explaining Phase 1 plan 01-04 fix                    |

## Open question / PRD doc-fix queued

None.

## Notes for downstream Phase 4 plans

1. **Path discipline:** import the AuthAdapter from `@contexts/iam/infrastructure/auth/auth-adapter` (Phase 2 path). Do NOT create `@contexts/iam/infrastructure/auth-adapter`.
2. **Auth result shape:** `if (!auth.ok) return errorResponse(auth.code, msg);` — closed-registry codes are `Unauthenticated` and (for `requireVerifiedUser`) `EmailUnverified`.
3. **AuthAdapter is the SOLE boundary:** application/api/route code calls `authAdapter.X()`. Never import `@supabase/*` outside the adapter.
4. **Wave-1 reconciliation:** consent flows write 2 rows with `purpose='signup_acceptance'` distinguished by `policy_version_id` → `policy_versions.documentType`. The `seedCurrentPolicyVersions` fixture returns `{termsOfService, privacyPolicy}` ids for tests.
5. **Throttle middleware:** `withThrottle(request, "signup", "always", handler)` for signup; `"on-failure"` for login/oauth-callback. The wrapper handles all 429 emission — handler code never returns `rate_limited` itself.
6. **i18n:** add new keys ONLY under existing `auth.*`/`settings.*`/`email.*`/`legal.*` namespaces. Do not introduce new top-level keys.
7. **Test fixtures:** `truncateAuthAndIamTables()` is opt-in — call from `beforeEach` in suites that touch auth tables.

## Self-Check

Verified file existence:
- src/shared/crypto/tokens.ts — FOUND
- src/contexts/iam/infrastructure/db/auth-throttle.ts — FOUND
- src/shared/api/throttle.ts — FOUND
- src/contexts/iam/domain/schemas.ts — FOUND (extended)
- src/contexts/iam/infrastructure/supabase-server.ts — FOUND
- src/contexts/iam/infrastructure/supabase-admin.ts — FOUND
- src/contexts/iam/infrastructure/auth/auth-adapter.ts — FOUND (extended)
- src/contexts/iam/application/current-user.ts — FOUND (extended)
- src/contexts/iam/application/require-verified.ts — FOUND
- src/shared/api/auth.ts — FOUND (rewritten)
- src/messages/pt-BR.json — FOUND (merged)
- vitest.config.ts — FOUND (extended)
- tests/integration/global-setup.ts — FOUND
- tests/integration/setup-supabase-truncate.ts — FOUND
- tests/integration/fixtures/seed-policy-version.ts — FOUND
- tests/integration/fixtures/seed-partner-code.ts — FOUND
- tests/integration/fixtures/seed-user.ts — FOUND
- tests/integration/fixtures/mock-resend.ts — FOUND
- tests/integration/fixtures/mock-inngest.ts — FOUND
- tests/unit/tokens.test.ts — FOUND
- tests/unit/iam-signup-schema.test.ts — FOUND
- tests/unit/auth-throttle-math.test.ts — FOUND
- tests/unit/auth-adapter-phase4.test.ts — FOUND
- tests/integration/iam-throttle.integration.test.ts — FOUND

Verified commits exist (git log):
- ac7b918 Task 1
- 396efec Task 2 RED
- 8713480 Task 2 GREEN
- dc0744d Task 4 RED
- 52cd033 Task 4 GREEN
- 584a11a Task 5
- cd4a4aa Task 3 RED
- 013cfc6 Task 3 GREEN
- 049890d Task 6 RED
- 6cd653a Task 6 GREEN
- 395f6c5 Task 7
- 8d9ad7c Task 8
- 037b759 Task 9

Verified test counts (`pnpm exec vitest run --project=...`):
- unit + unit-dom: 498/498 passing
- integration: 85/85 passing
- typecheck: clean

Verified Codex HIGH/MEDIUM acceptance:
- HIGH #3: zero `supabase.auth.*` matches in app code
- HIGH #3: zero `@supabase/*` imports in iam/application or iam/api
- HIGH #5: lockout persists across window boundaries (integration test 4)
- HIGH #5: oauth-callback 302 redirects counted (integration test 11)
- MEDIUM consent UX: `/legal/terms` + `/legal/privacy` in UNVERIFIED_ALLOWED_PATHS; auth.signup.legalLinks namespace exists

## Self-Check: PASSED
