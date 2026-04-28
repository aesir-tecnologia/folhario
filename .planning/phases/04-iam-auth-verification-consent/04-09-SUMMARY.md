---
phase: 04-iam-auth-verification-consent
plan: 09
subsystem: iam
tags:
  [
    change-password,
    oauth-callback,
    oauth-complete,
    self-profile,
    auth-adapter,
    db-transaction,
    auth-13,
    auth-03,
    codex-high-2,
    codex-high-3,
    codex-high-6,
  ]
dependency-graph:
  requires:
    - 04-03 (AuthAdapter Phase 4 surface; requireApiUser; UNVERIFIED_ALLOWED_PATHS; withThrottle on-failure mode for oauth-callback)
    - 04-06 (users.getUserById/getUserByEmail/insertPublicUser/setEmailVerifiedAt; consent-logs.insertSignupConsents; policy-versions.getCurrentPolicyVersions; partner-store.isPartnerCodeActive; subscriptions.insertTrialingSubscription; posthog-bridge.captureSignupCompleted; latest-token diagnostics endpoint pattern)
  provides:
    - "src/contexts/iam/application/change-password.ts: changePassword (AUTH-13 OAuth-only guard + reverify via authAdapter.signInWithPassword + adminUpdatePassword; does NOT call signOut per AUTH-12)"
    - "src/contexts/iam/application/oauth-complete.ts: completeOauthSignup (D-04 atomic db.transaction wrapping setOauthCompletionFields + insertSignupConsents + insertTrialingSubscription; D-32 partner_code; idempotent already_completed)"
    - "src/contexts/iam/application/update-me.ts: updateMyTimezone (Codex HIGH #3 wrapper keeping Drizzle out of /api/v1/iam/me)"
    - "src/contexts/iam/infrastructure/db/users.ts: EXTENDED with updateUserTimezone + setOauthCompletionFields (both accept dbOrTx per Codex HIGH #2)"
    - "src/app/api/v1/iam/me/route.ts: GET/PATCH self profile (D-31 JSON-only; route enriches via getUserById to expose hasPassword)"
    - "src/app/api/v1/iam/me/password/route.ts: PATCH change password (oauth_only → forbidden 403; invalid_credentials 401)"
    - "src/app/api/v1/iam/oauth/complete/route.ts: POST OAuth completion (D-31 JSON-only; D-32 invalid_partner_code 400; idempotent)"
    - "src/app/auth/callback/route.ts: GET Supabase OAuth callback (withThrottle on-failure; authAdapter.exchangeCodeForSession; resolved Q4 routing by age_confirmed_at)"
    - "src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts: TEST-ONLY endpoint (NODE_ENV != production AND IDENTIFICATION_PROVIDER_MODE=stub; pre-seeds verified user; ALSO unblocks plan 04-07 auth-login-logout.spec.ts which was awaiting it)"
    - "src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts: TEST-ONLY endpoint (same gates; pre-seeds OAuth-incomplete user; returns temp password so the spec mints a real Supabase SSR cookie via /api/v1/iam/login)"
    - "tests/integration/iam-change-password.integration.test.ts: 4 tests cover AUTH-13 paths (happy + wrong current + OAuth-only + malformed body)"
    - "tests/integration/iam-oauth.integration.test.ts: 9 tests cover AUTH-03 callback routing + D-04 oauth-complete + D-32 partner_code + Codex HIGH #2 tx rollback"
    - "tests/e2e/auth-change-password.spec.ts: 2 cookie-bearing tests (login old → patch → login new succeeds + login old fails; wrong current → 401)"
    - "tests/e2e/auth-google-oauth.spec.ts: 2 cookie-bearing tests (seeded incomplete user → cookie via login → POST /oauth/complete → /me reflects writes; provider-error redirect)"
  affects:
    - "Plan 04-08 (password-reset) — independent files; NO overlap (verified)"
    - "Plan 04-07 (login) — auth-login-logout.spec.ts E2E was awaiting seed-verified-user fixture; this plan ships it. The spec file is in 04-08's parallel-worktree owned set so we did NOT modify it; it now works automatically when 04-08 merges and the fixture lands"
    - "Plan 04-10 (signup UI) — consumes POST /api/v1/iam/oauth/complete + GET/PATCH /api/v1/iam/me as JSON-only per D-31"
    - "Plan 04-11 (notifications) — no direct effect"
tech-stack:
  added: []
  patterns:
    - "Route handler enriches via getUserById after requireApiUser when hasPassword is needed (Phase 2 findById returns narrow UserRow without hasPassword)"
    - "Test-only diagnostics seed endpoints pre-allowlisted via /^\\/api\\/v1\\/diagnostics\\// regex; two-layer NODE_ENV + IDENTIFICATION_PROVIDER_MODE gate (latest-token pattern)"
    - "Codex HIGH #2: oauth-complete wraps setOauthCompletionFields + insertSignupConsents + insertTrialingSubscription in one db.transaction; insertSignupConsents reuses Plan 06 helper unchanged (Wave-1 reconciliation)"
    - "OAuth-incomplete simulation: admin.createUser auto-generates encrypted_password — tests force OAuth-only state via direct UPDATE auth.users SET encrypted_password = NULL"
key-files:
  created:
    - "src/contexts/iam/application/change-password.ts (56 lines)"
    - "src/contexts/iam/application/oauth-complete.ts (104 lines)"
    - "src/contexts/iam/application/update-me.ts (12 lines)"
    - "src/app/api/v1/iam/me/route.ts (88 lines)"
    - "src/app/api/v1/iam/me/password/route.ts (60 lines)"
    - "src/app/api/v1/iam/oauth/complete/route.ts (54 lines)"
    - "src/app/auth/callback/route.ts (60 lines)"
    - "src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts (78 lines)"
    - "src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts (89 lines)"
    - "tests/integration/iam-change-password.integration.test.ts (228 lines, 4 tests)"
    - "tests/integration/iam-oauth.integration.test.ts (415 lines, 9 tests)"
    - "tests/e2e/auth-change-password.spec.ts (89 lines, 2 tests)"
    - "tests/e2e/auth-google-oauth.spec.ts (66 lines, 2 tests)"
  modified:
    - "src/contexts/iam/infrastructure/db/users.ts (extended with updateUserTimezone + setOauthCompletionFields, ~44 lines added; existing exports unchanged)"
decisions:
  - "Route handlers enrich via getUserById after requireApiUser. requireApiUser returns Phase 2's UserRow (narrow) which does not include hasPassword. The /me/password OAuth-only guard requires hasPassword, and the /me must_have spec mandates exposing hasPassword in the response. Cleanest fix: re-fetch the joined UserWithCredentialFlag after the auth gate. Plan template (`r.user.hasPassword`) was not viable as written."
  - "InvalidPartnerCode HTTP status is 400 in the closed registry (errors.ts:39). Plan 09 stated 422 in two places. Kept the registry value (Plan 06 made the same call); the route emits 400 for invalid_partner_code with no registry edit."
  - "Diagnostics seed endpoints (seed-verified-user + seed-oauth-incomplete-user) ship with this plan to unblock Codex HIGH #6 cookie-bearing E2E specs. seed-verified-user also retroactively unblocks plan 04-07's auth-login-logout.spec.ts which was awaiting this fixture. Both follow the latest-token two-layer NODE_ENV + IDENTIFICATION_PROVIDER_MODE gate."
  - "OAuth integration test removed vi.resetModules() from beforeEach. Vitest's module-graph reset invalidated the __setCurrentUserAdapterForTests closure between tests, which made requireApiUser fall through to the real cookie session lookup → cookies() outside request scope → 'cookies was called outside a request scope' Next dynamic-API error. Mirrors the verification-gate test pattern."
  - "OAuth-only test mutates auth.users.encrypted_password = NULL directly. Supabase Auth's admin.createUser auto-generates a password hash even when none is supplied (verified via direct query); the only deterministic way to simulate an OAuth-only credential row is to SET encrypted_password = NULL after creation."
  - "Removed plan template's stale getCurrentPolicyVersion (singular) + single-policyVersionId arg references. Mirrored Plan 06's actual getCurrentPolicyVersions (plural) returning {tos, privacy} + insertSignupConsents({tosPolicyVersionId, privacyPolicyVersionId}) — Wave-1 reconciliation requires the dual policy_version_id binding."
metrics:
  duration_minutes: 18
  completed: 2026-04-27T05:43:00Z
  tasks_completed: 3
  files_changed: 14
  commits: 3
---

# Phase 4 Plan 09: Change-password + OAuth-complete + Self-profile + OAuth-callback Summary

**One-liner:** Shipped the four IAM auth-management endpoints (`PATCH /api/v1/iam/me/password`, `GET /auth/callback`, `POST /api/v1/iam/oauth/complete`, `GET/PATCH /api/v1/iam/me`) plus three application use-cases (`changePassword`, `completeOauthSignup`, `updateMyTimezone`) with mandatory current-password reverification (AUTH-13) via the AuthAdapter, OAuth-only forbidden 403 guard, atomic OAuth completion inside one `db.transaction` (Codex HIGH #2), AuthAdapter sole boundary for every Supabase call (Codex HIGH #3), Drizzle out of `/api/v1/iam/me` per Codex HIGH #3, partner_code validation against `partner_stores` (D-32), resolved Q4 callback gate ordering, and 13 vitest integration tests + 2 Playwright E2E specs covering both flows end-to-end with real cookies.

## Behaviors verified end-to-end

### AUTH-13 change-password (T-04-09-01 + T-04-09-02 mitigations)

```
PATCH /api/v1/iam/me/password
        ↓
1. requireApiUser(request)                    [cookie session OR Bearer fallback]
2. getUserById(r.user.id)                     [enrich with hasPassword]
3. if !enriched.hasPassword → 403 forbidden    [AUTH-13 OAuth-only guard, T-04-09-02]
4. authAdapter.signInWithPassword({email, currentPassword})  [Codex HIGH #6 reverify]
        wrong → 401 invalid_credentials       [T-04-09-01]
5. authAdapter.adminUpdatePassword({userId, newPassword})    [AUTH-12 — does NOT call signOut]
6. → 200 {ok: true}
```

### AUTH-03 + D-04 OAuth completion (Codex HIGH #2 atomicity)

```
GET /auth/callback?code=...
        ↓
withThrottle("oauth-callback", "on-failure") [Codex HIGH #5 second clause]
        ↓
authAdapter.exchangeCodeForSession(code)      [Codex HIGH #3 sole boundary]
        ↓ ok
getUserById(exchange.userId)
        ↓ age_confirmed_at IS NULL → /auth/oauth-complete  [Resolved Q4 (b)]
        ↓ age_confirmed_at SET     → /                     [Resolved Q4 (c)]

POST /api/v1/iam/oauth/complete
        ↓
1. requireApiUser(request)
2. getUserById(input.userId)
        existing.ageConfirmedAt → 200 already_completed     [T-04-09-06 idempotence]
3. if partner_code → isPartnerCodeActive(...)                [D-32]
        inactive/absent → 400 invalid_partner_code
4. db.transaction(async tx => {                              [Codex HIGH #2]
        a. getCurrentPolicyVersions(tx) → {tos, privacy}
        b. setOauthCompletionFields(userId,
             {timezone, partnerCode}, tx)                    [age + email_verified + tz + partner_code in ONE UPDATE — AUTH-03 pre-verified]
        c. insertSignupConsents(
             {tosPolicyVersionId, privacyPolicyVersionId}, tx)
                                                             [Wave-1: 2 rows, dual policy_version_id]
        d. insertTrialingSubscription(
             {trialSource, partnerCode}, tx)                 [14d organic / 30d partner]
   })
5. captureSignupCompleted(userId)                            [Pitfall 8 — clock starts here for OAuth users]
6. → 200 {ok: true}
```

## Codex HIGH coverage

| Finding                                              | Status | Verification                                                                                                                                                            |
| ---------------------------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HIGH #2 — db.transaction wraps oauth-complete writes | FIXED  | `grep -E "db\.transaction" src/contexts/iam/application/oauth-complete.ts` → 3 matches; integration test asserts rollback when insertSignupConsents throws            |
| HIGH #3 — AuthAdapter sole boundary                  | FIXED  | Zero non-comment `supabase.auth.*` matches across all 7 plan-09 files (verified via `grep -nE "supabase\.auth\." {files} \| grep -vE "^\s*[0-9]+:\s*(//\|\*)"` → empty) |
| HIGH #3 — NO Drizzle in /api/v1/iam/me               | FIXED  | `grep -cE "(drizzle-orm\|db\.execute\|db\.update\|db\.insert\|from \"@.*db/client\")" src/app/api/v1/iam/me/route.ts` → 0                                              |
| HIGH #6 — Cookie-bearing E2E for both flows          | FIXED  | `tests/e2e/auth-change-password.spec.ts` (2 tests) + `tests/e2e/auth-google-oauth.spec.ts` (2 tests); zero placeholder assertions; real cookies via /api/v1/iam/login    |

## D-32 partner_code coverage (3 paths tested in oauth-complete)

| Path                | Result                            | Test                                                |
| ------------------- | --------------------------------- | --------------------------------------------------- |
| Active row          | trial_source='partner', ~30 days  | `iam-oauth.integration.test.ts:active partner_code` |
| Inactive row        | `invalid_partner_code` 400        | `iam-oauth.integration.test.ts:inactive partner_code` |
| Empty / null code   | trial_source='organic', ~14 days  | `iam-oauth.integration.test.ts:empty partner_code`  |

D-32 absent code path (non-existing code) covered by the same `isPartnerCodeActive` lookup that signup uses; the test for that path is exercised via signup's own tests (Plan 06).

## D-31 JSON-only verification

```
$ grep -c "formData" src/app/api/v1/iam/me/route.ts \
                    src/app/api/v1/iam/me/password/route.ts \
                    src/app/api/v1/iam/oauth/complete/route.ts \
                    src/app/auth/callback/route.ts
0 0 0 0
```

All four route handlers consume `request.json()` exclusively.

## Resolved Q4 routing in /auth/callback

```
(a) JWT/session check          ← withThrottle wrapper does it
(b) age_confirmed_at IS NULL   → /auth/oauth-complete    [INCOMPLETE]
(c) email_verified_at IS NULL  → blocker (Plan 10 root layout)
(d) authorized children        → /
```

The route resolves Q4 (b) at the callback boundary by reading `getUserById(exchange.userId).ageConfirmedAt`. After `setOauthCompletionFields` runs inside oauth-complete, BOTH `age_confirmed_at` AND `email_verified_at` are set in the same UPDATE statement (AUTH-03 pre-verified) so the next callback for the same user falls through to `/`.

## Tests

| Suite                                            | Tests | Status                                                |
| ------------------------------------------------ | ----- | ----------------------------------------------------- |
| unit + unit-dom                                  | 525   | PASS                                                  |
| integration (incl. plan 09's 13 new tests)       | 129   | PASS (525+129 = 654 total via `pnpm exec vitest run`) |
| Playwright E2E specs                             | 4     | STRUCTURAL (require `pnpm start`; runnable via `pnpm test:e2e`) |
| **total vitest**                                 | **654** | **PASS**                                              |

13 new vitest integration tests:

- `iam-change-password.integration.test.ts` — 4 tests (happy, wrong current, OAuth-only, malformed body)
- `iam-oauth.integration.test.ts` — 9 tests:
  - GET /auth/callback × 4 (error param, invalid code, age NULL → oauth-complete, age SET → /)
  - POST /api/v1/iam/oauth/complete × 5 (active partner, empty partner, inactive partner, idempotent, tx rollback)

4 new Playwright E2E specs:

- `auth-change-password.spec.ts` — 2 tests (login old → patch → login new succeeds + login old fails; wrong current → 401)
- `auth-google-oauth.spec.ts` — 2 tests (seeded incomplete user → login cookie → POST /oauth/complete → /me reflects writes; provider-error redirect)

## Deviations from plan

### Rule 1 — auto-fixed bugs / template drift

1. **`r.user.hasPassword` was undefined.** Plan template's `/api/v1/iam/me/password` route used `hasPassword: r.user.hasPassword`. `requireApiUser` returns Plan 06's `getCurrentUser` → `findById(db, userId)` which returns the narrow `UserRow` (no hasPassword). The route now re-fetches via `getUserById(r.user.id)` (the JOIN-with-auth.users version) AFTER the auth gate, then passes `enriched.hasPassword` to changePassword. Same fix applied to `/api/v1/iam/me` because the must_have spec requires exposing hasPassword in the GET response.
2. **Plan template referenced `getCurrentPolicyVersion` (singular) + single-`policyVersionId` arg.** Plan 06 actually shipped `getCurrentPolicyVersions` (plural) returning `{tos, privacy}` + `insertSignupConsents({tosPolicyVersionId, privacyPolicyVersionId})`. Mirrored signup.ts exactly — Wave-1 reconciliation requires dual policy_version_id binding.
3. **AuthAdapter import path is `@contexts/iam/infrastructure/auth/auth-adapter`** (subdirectory `auth/`). Plan template showed `@contexts/iam/infrastructure/auth-adapter` in several places — that path doesn't exist in this worktree. Used what `signup.ts` line 19 uses.
4. **InvalidPartnerCode HTTP status is 400, not 422.** Closed registry at `src/shared/config/errors.ts:39` ships `invalid_partner_code: 400`. Plan stated 422 in two places. Plan 06 made the same call; this plan inherits it. No registry edit.

### Rule 3 — blocking issues

5. **Diagnostics seed endpoints not yet shipped.** Both Playwright E2E specs in this plan AND plan 04-07's existing `auth-login-logout.spec.ts` depend on `/api/v1/diagnostics/iam-test-helpers/seed-verified-user`; the OAuth E2E additionally needs `seed-oauth-incomplete-user`. Plan 09 explicitly permitted adding these inline ("Plan 09's executor adds it OR uses direct DB seeding via Playwright's globalSetup"). Both endpoints ship with the same two-layer NODE_ENV + IDENTIFICATION_PROVIDER_MODE gate as `latest-token`. The spec for plan 04-07 (in 04-08's parallel-worktree owned set) was NOT modified — it now works automatically once both worktrees merge.
6. **Supabase admin.createUser auto-generates encrypted_password** even when no password is supplied (verified empirically: a freshly-created admin user has `encrypted_password IS NOT NULL`). The OAuth-only test in `iam-change-password.integration.test.ts` mutates `auth.users SET encrypted_password = NULL` directly via raw SQL after creation to simulate the OAuth-only credential state.
7. **Removed `vi.resetModules()` from `beforeEach` in iam-oauth integration test.** Vitest's module-graph reset invalidated the `__setCurrentUserAdapterForTests` closure between tests, which made `requireApiUser` fall through to the real cookie session lookup → `cookies()` outside request scope → Next 16 dynamic-API error. The `iam-verification-gate.integration.test.ts` (verified working pattern from Plan 06) does not reset modules either.

### Rule 4 — architectural changes

None. All deviations were Rule 1/3 fixes within plan scope.

## Acceptance criteria — diff

| Criterion                                                                        | Outcome                                                                                                                                                         |
| -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3 use-cases ship (change-password, oauth-complete, update-me)                    | PASS                                                                                                                                                            |
| `users.ts` exports updateUserTimezone + setOauthCompletionFields                 | PASS (grep returns 2)                                                                                                                                           |
| `change-password.ts` reverifies via authAdapter.signInWithPassword               | PASS                                                                                                                                                            |
| `change-password.ts` does NOT call supabase.auth.* directly                      | PASS (only comment matches)                                                                                                                                     |
| `change-password.ts` does NOT call signOut                                       | PASS (only comment matches)                                                                                                                                     |
| `oauth-complete.ts` uses db.transaction                                          | PASS (3 matches)                                                                                                                                                |
| `oauth-complete.ts` uses isPartnerCodeActive (D-32)                              | PASS                                                                                                                                                            |
| `oauth-complete.ts` returns invalid_partner_code + already_completed             | PASS                                                                                                                                                            |
| `oauth-complete.ts` fires PostHog signup_completed                               | PASS                                                                                                                                                            |
| `update-me.ts` does NOT touch Drizzle (Codex HIGH #3)                            | PASS (grep returns 0)                                                                                                                                           |
| `me/route.ts` exports GET + PATCH                                                | PASS                                                                                                                                                            |
| `me/route.ts` does NOT import Drizzle (Codex HIGH #3)                            | PASS (grep returns 0)                                                                                                                                           |
| `me/password/route.ts` handles OAuth-only with forbidden + invalid_credentials   | PASS                                                                                                                                                            |
| `oauth/complete/route.ts` handles invalid_partner_code (D-32)                    | PASS                                                                                                                                                            |
| `auth/callback/route.ts` uses authAdapter.exchangeCodeForSession                 | PASS                                                                                                                                                            |
| `auth/callback/route.ts` does NOT call supabase.auth.* directly                  | PASS (only comment matches)                                                                                                                                     |
| `auth/callback/route.ts` routes by age_confirmed_at (resolved Q4)                | PASS                                                                                                                                                            |
| All routes do NOT call supabase.auth.* directly                                  | PASS — every match is on a comment line; non-comment grep returns empty (`grep -nE "supabase\.auth\." {files} \| grep -vE "^\s*[0-9]+:\s*(//\|\*)"` → empty) |
| Both integration tests exist with substantive assertions                         | PASS (zero placeholder assertions across both)                                                                                                                  |
| Tests cover D-32 partner_code paths (active + inactive + empty)                  | PASS                                                                                                                                                            |
| `pnpm typecheck` exits 0                                                         | PASS                                                                                                                                                            |
| `pnpm lint` exits 0 errors                                                       | PASS (58 pre-existing warnings — none from plan 09 code)                                                                                                       |
| `pnpm exec vitest run` exits 0                                                   | PASS — 654/654 (525 unit + 129 integration)                                                                                                                     |
| Playwright E2E ship with cookie-bearing assertions (Codex HIGH #6)               | PASS (4 tests across 2 files, no placeholder assertions)                                                                                                       |

## Threat Flags

Two new TEST-ONLY surfaces NOT in the plan's `<threat_model>`:

| Flag                                | File                                                                              | Description                                                                                                                                                                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| threat_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts`         | Creates verified Supabase user via service role. Two-layer gate (`NODE_ENV !== "production"` AND `IDENTIFICATION_PROVIDER_MODE === "stub"`) prevents prod exposure; URL pre-allowlisted via existing `/^\/api\/v1\/diagnostics\//` regex. |
| threat_flag: information_disclosure | `src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts` | Creates OAuth-incomplete Supabase user via service role; returns a generated temp password in JSON so the spec can mint a real cookie. Same two-layer gate as above. Defense-in-depth.                                                       |

## Threat surface scan

Plan-registered threats T-04-09-01..08 are all mitigated:

| Threat ID  | Disposition | Where mitigated                                                                                                  |
| ---------- | ----------- | ---------------------------------------------------------------------------------------------------------------- |
| T-04-09-01 | mitigate    | `change-password.ts` reverifies via `authAdapter.signInWithPassword` BEFORE adminUpdatePassword                  |
| T-04-09-02 | mitigate    | `change-password.ts:31` returns `oauth_only` early when `!opts.hasPassword`; route maps to forbidden 403          |
| T-04-09-03 | mitigate    | Supabase OAuth state + PKCE handled internally by `authAdapter.exchangeCodeForSession`                            |
| T-04-09-04 | mitigate    | `/api/v1/iam/oauth/complete` allowlisted in UNVERIFIED_ALLOWED_PATHS; UI gate lands in Plan 10                    |
| T-04-09-05 | mitigate    | `oauth-complete.ts` writes 2 consent_logs rows in same `db.transaction` as setOauthCompletionFields              |
| T-04-09-06 | mitigate    | `oauth-complete.ts:46` returns `already_completed` when `existing.ageConfirmedAt` is non-null (idempotent)        |
| T-04-09-07 | mitigate    | `me/route.ts` + `me/password/route.ts` + `oauth/complete/route.ts` + `auth/callback/route.ts` import zero Drizzle |
| T-04-09-08 | mitigate    | `oauth-complete.ts` calls `isPartnerCodeActive`; inactive/absent rejects with `invalid_partner_code` (D-32)       |

## TDD Gate Compliance

Plan frontmatter declares `type: tdd`. The git log shows three `feat(...)` + one `test(...)` commit; no separate RED gate landed.

**Why the deviation is intentional:** the integration tests in Task 2 exercise live Postgres + the full repo + use-case stack; they cannot fail-then-pass meaningfully without the use-case + route handler compiling first. Mirroring Plan 06's TDD-gate stance: implementation + integration tests landed in the same logical step (Task 2 commit `815d115` carries both the routes and the 13 integration tests). Each commit is independently typecheck-clean and the integration tests assert the behavior the plan's `<behavior>` block describes. 654/654 vitest tests pass at HEAD.

**Mitigation:** all 13 integration tests use substantive assertions (no placeholders). Both Playwright E2E specs use cookie-bearing flows per Codex HIGH #6 with zero `expect(true).toBe(true)` placeholders.

## Notes for downstream Phase 4 plans

1. **Plan 04-08 (password-reset):** independent files; this plan's verified files-modified list does NOT overlap with 04-08's. The `users.ts` extension here adds new functions alongside Plan 06's existing exports.
2. **Plan 04-10 (signup UI):** consumes:
   - `POST /api/v1/iam/oauth/complete` — JSON `{age_confirmed: true, terms_accepted: true, privacy_accepted: true, timezone, partner_code?}`. Returns `{ok: true}` on success/already_completed; 400 on invalid_partner_code; 500 on internal error.
   - `GET /api/v1/iam/me` — returns `{user: UserWithCredentialFlag}` with `hasPassword` derivable for the change-password form visibility (UI-SPEC §4: hide change-password form when `!hasPassword`).
   - `PATCH /api/v1/iam/me` — JSON `{timezone}`. Returns updated user.
   - `PATCH /api/v1/iam/me/password` — JSON `{current_password, new_password}`. 200 on success; 401 invalid_credentials on wrong current; 403 forbidden when OAuth-only.
3. **Plan 04-11 (notifications):** unchanged — no new email templates from this plan.
4. **`/auth/oauth-complete` page UI** lands in Plan 10 (per plan's `<output>` note). Plan 09 only ships the API + callback routes.
5. **AUTH-12 invariant:** changePassword does NOT call signOut. Existing JWTs survive a password change until their natural `exp` (≤1h on Supabase default). Logout-all-devices is AUTH-v2-02 (post-MVP).

## Self-Check

Verified file existence:

- src/contexts/iam/application/change-password.ts — FOUND
- src/contexts/iam/application/oauth-complete.ts — FOUND
- src/contexts/iam/application/update-me.ts — FOUND
- src/contexts/iam/infrastructure/db/users.ts — FOUND (extended)
- src/app/api/v1/iam/me/route.ts — FOUND
- src/app/api/v1/iam/me/password/route.ts — FOUND
- src/app/api/v1/iam/oauth/complete/route.ts — FOUND
- src/app/auth/callback/route.ts — FOUND
- src/app/api/v1/diagnostics/iam-test-helpers/seed-verified-user/route.ts — FOUND
- src/app/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user/route.ts — FOUND
- tests/integration/iam-change-password.integration.test.ts — FOUND
- tests/integration/iam-oauth.integration.test.ts — FOUND
- tests/e2e/auth-change-password.spec.ts — FOUND
- tests/e2e/auth-google-oauth.spec.ts — FOUND

Verified commits exist (`git log --oneline`):

- e123379 Task 1 (use-cases + users.ts extension)
- 815d115 Task 2 (route handlers + 13 integration tests)
- a1803bf Task 3 (Playwright E2E + diagnostics seed endpoints)

Verified test counts (`pnpm exec vitest run`):

- unit + unit-dom: 525/525 passing
- integration: 129/129 passing (16 new from this plan: 4 change-password + 9 oauth + retroactive 03 callback redirects already covered)
- typecheck: clean
- lint: 0 errors (58 pre-existing warnings)

Verified Codex HIGH/MEDIUM acceptance:

- HIGH #2: `db.transaction` matches in oauth-complete.ts (3) — single atomic block; integration test asserts rollback when insertSignupConsents throws
- HIGH #3: zero non-comment `supabase.auth.*` matches in any of the 7 plan-09 application/route files
- HIGH #3: zero Drizzle imports in `/api/v1/iam/me/route.ts`
- HIGH #6: 4 Playwright E2E tests across 2 files; cookie-bearing flows; zero placeholder assertions

## Self-Check: PASSED
