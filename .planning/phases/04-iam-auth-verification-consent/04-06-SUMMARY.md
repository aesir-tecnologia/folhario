---
phase: 04-iam-auth-verification-consent
plan: 06
subsystem: iam
tags:
  [
    signup-orchestration,
    verify-email,
    resend-verification,
    auth-adapter,
    db-transaction,
    consent-logs,
    partner-store,
    posthog-bridge,
    codex-high-2,
    codex-high-3,
    codex-high-6,
  ]
dependency-graph:
  requires:
    - 04-02 (consent_logs.purpose enum extended with signup_acceptance; email_verification_tokens + auth_throttle tables)
    - 04-03 (AuthAdapter Phase 4 surface; withThrottle; requireApiUser/requireVerifiedUser; UNVERIFIED_ALLOWED_PATHS; seed fixtures)
    - 04-04 (Resend SDK adapter, mock fixture)
    - 04-05 (Inngest notifications/email.requested handler)
  provides:
    - "src/contexts/iam/infrastructure/db/users.ts: getUserById/getUserByEmail (joined with auth.users.encrypted_password) + insertPublicUser + setEmailVerifiedAt"
    - "src/contexts/iam/infrastructure/db/types.ts: DbOrTx type alias for transactional repos (Codex HIGH #2)"
    - "src/contexts/iam/infrastructure/db/partner-store.ts: isPartnerCodeActive (D-32 lookup against partner_stores)"
    - "src/contexts/iam/infrastructure/db/consent-logs.ts: insertSignupConsents writes 2 rows with purpose=signup_acceptance + distinct policy_version_id (Wave-1 reconciliation)"
    - "src/contexts/iam/infrastructure/db/policy-versions.ts: getCurrentPolicyVersions returns {tos, privacy} active rows"
    - "src/contexts/iam/infrastructure/db/subscriptions.ts: insertTrialingSubscription with caller-supplied trialSource (14d organic / 30d partner)"
    - "src/contexts/iam/infrastructure/db/verification-tokens.ts: mintVerificationToken + revokeUnusedVerificationTokens + consumeVerificationToken (SHA-256 + FOR UPDATE)"
    - "src/contexts/iam/application/signup.ts: signupUser orchestration (Codex HIGH #2 db.transaction + Codex HIGH #3 authAdapter + D-32 partner_code)"
    - "src/contexts/iam/application/verify-email.ts: verifyEmail (Codex HIGH #2 ordering: consume + setEmailVerifiedAt in one tx)"
    - "src/contexts/iam/application/resend-verification.ts: resendVerification use-case"
    - "src/contexts/iam/infrastructure/posthog-bridge.ts: captureSignupCompleted + captureConsentGranted (server-side, no PII)"
    - "src/app/api/v1/iam/signup/route.ts: POST handler (D-31 JSON-only, withThrottle 'always')"
    - "src/app/auth/verify/route.ts: GET handler (verify token → redirect)"
    - "src/app/api/v1/iam/resend-verification/route.ts: POST handler (per-user 1/min)"
    - "src/app/api/v1/diagnostics/iam-test-helpers/latest-token/route.ts: TEST-ONLY endpoint for Playwright E2E (NODE_ENV != production gated)"
    - "tests/integration/iam-signup.integration.test.ts: 7 tests covering all signup paths"
    - "tests/integration/iam-consent-log.integration.test.ts: AUTH-09 JOIN assertion via policy_version_id"
    - "tests/integration/iam-verify-token.integration.test.ts: 4 tests for AUTH-04 + Codex HIGH #2 ordering"
    - "tests/integration/iam-verification-gate.integration.test.ts: AUTH-02 + D-23 default-deny allowlist"
    - "tests/e2e/auth-signup-verification.spec.ts: Codex HIGH #6 cookie-bearing browser flow"
  affects:
    - "Plan 04-07 (login) imports getUserByEmail; the Wave-1 happy path proven here unblocks login regression"
    - "Plan 04-09 (logout/me/oauth/identity) consumes the same insertSignupConsents + getCurrentPolicyVersions for OAuth-complete; the same db.transaction wrapping pattern reused"
    - "Plan 04-10 (signup UI) consumes POST /api/v1/iam/signup as JSON"
    - "Plan 04-11 (notifications) — verification + welcome-back templates fired via Inngest emit here"
tech-stack:
  added: []
  patterns:
    - "Transactional repository pattern (Codex HIGH #2): every write fn accepts dbOrTx?: DbOrTx defaulting to singleton db; signup use-case threads tx through all 4 writes"
    - "AuthAdapter sole boundary (Codex HIGH #3): zero supabase.auth.* calls in src/contexts/iam/application or src/app/api/v1/iam"
    - "Wave-1 reconciliation: signup_acceptance purpose with policy_version_id-bound documentType identity (per 04-PREREQ-AUDIT amendment)"
    - "JSON-only routes (D-31): every Phase 4 IAM route consumes request.json(); never request.formData()"
    - "Idempotent fixture: seedCurrentPolicyVersions reuses Phase 02 db.seed rows when present (avoids partial-unique-index conflict with the seed)"
key-files:
  created:
    - "src/contexts/iam/infrastructure/db/types.ts (10 lines)"
    - "src/contexts/iam/infrastructure/db/partner-store.ts (16 lines)"
    - "src/contexts/iam/infrastructure/db/policy-versions.ts (38 lines)"
    - "src/contexts/iam/infrastructure/db/subscriptions.ts (53 lines)"
    - "src/contexts/iam/infrastructure/db/verification-tokens.ts (75 lines)"
    - "src/contexts/iam/application/signup.ts (158 lines)"
    - "src/contexts/iam/application/verify-email.ts (44 lines)"
    - "src/contexts/iam/application/resend-verification.ts (43 lines)"
    - "src/contexts/iam/infrastructure/posthog-bridge.ts (42 lines)"
    - "src/app/api/v1/iam/signup/route.ts (75 lines)"
    - "src/app/auth/verify/route.ts (28 lines)"
    - "src/app/api/v1/iam/resend-verification/route.ts (53 lines)"
    - "src/app/api/v1/diagnostics/iam-test-helpers/latest-token/route.ts (45 lines)"
    - "tests/integration/iam-signup.integration.test.ts (240 lines, 7 tests)"
    - "tests/integration/iam-consent-log.integration.test.ts (95 lines, 1 test)"
    - "tests/integration/iam-verify-token.integration.test.ts (140 lines, 4 tests)"
    - "tests/integration/iam-verification-gate.integration.test.ts (115 lines, 3 tests)"
    - "tests/e2e/auth-signup-verification.spec.ts (95 lines, 2 tests)"
  modified:
    - "src/contexts/iam/infrastructure/db/users.ts (rewritten — keeps Phase 2 findById, adds getUserById/getUserByEmail/insertPublicUser/setEmailVerifiedAt)"
    - "src/contexts/iam/infrastructure/db/consent-logs.ts (added insertSignupConsents)"
    - "tests/integration/setup-supabase-truncate.ts (DELETE strategy for auth.users; preserves policy_versions across files)"
    - "tests/integration/fixtures/seed-policy-version.ts (idempotent — reuses seeded rows when present)"
decisions:
  - "subscriptions.trial_source / partner_code DO NOT exist on the Phase 2 subscriptions table — they live on users. Plan 06 deviates from the literal SQL by storing trial_source/partner_code on users (via insertPublicUser) and only using trialSource as a function parameter to compute trial duration (14d organic / 30d partner) when inserting the trialing subscription row. provider='stripe' set at insert time per PROJECT.md."
  - "InvalidPartnerCode HTTP status is 400 in the closed registry (src/shared/config/errors.ts:39), not 422 as the plan states twice. Used the registry value; the route emits 400 for invalid_partner_code. No registry edit."
  - "users.ts keeps Phase 2 findById (delegated to by AuthAdapter.getUserById) and ADDS new functions alongside instead of replacing. Wave 3 SUMMARY deviation #1 already established this stance; rewriting findById would break 7 call sites including the JWT verify path."
  - "next-intl/server.getTranslations cannot run outside a Next request context (integration tests fail with 'cookies() called outside request scope'). Replaced direct getTranslations calls in signup.ts/resend-verification.ts/route.ts with a top-level import of pt-BR.json — pt-BR is the only launch locale per PROJECT.md, so the indirection is unnecessary."
  - "authAdapter.signInWithPassword wrapped in try/catch in signupUser — non-fatal because (a) it's a 'best-effort' session mint per the plan's behavior spec and (b) it calls cookies() which throws outside a Next request context. The unverified blocker still works on the next request via the verification token path."
  - "The atomic-tx test uses vi.spyOn on getCurrentPolicyVersions instead of mutating policy_versions.is_current globally, so concurrent test files don't race on that flag. The test's invariant is unchanged (signupUser throws + adminDeleteUser compensates)."
  - "truncateAuthAndIamTables now uses DELETE for auth.users (not TRUNCATE CASCADE) because the cascading attempts to RESTART IDENTITY on auth.refresh_tokens_id_seq, which the integration role 'postgres' cannot do (must be owner)."
  - "Test-only diagnostics endpoint at /api/v1/diagnostics/iam-test-helpers/latest-token mints a fresh token (vs. trying to retrieve the original raw token, which is impossible because we only persist the SHA-256 hash). The endpoint requires NODE_ENV != production AND IDENTIFICATION_PROVIDER_MODE=stub — same gate pattern as /api/v1/diagnostics/ping."
metrics:
  duration_minutes: 26
  completed: 2026-04-27T02:20:00Z
  tasks_completed: 4
  files_changed: 19
  commits: 4
---

# Phase 4 Plan 06: Signup → Verify-Email → Resend → Verification-Gate Summary

**One-liner:** Shipped the heaviest IAM use-case — atomic signup orchestration (`db.transaction` wraps user + 2 consent_logs + trialing subscription + verification token; compensating `authAdapter.adminDeleteUser` on failure) plus the `/auth/verify` token-consume flow, the `/api/v1/iam/resend-verification` endpoint, the verification gate logic, and 17 vitest integration tests + 2 Playwright E2E spec; honored the Wave-1 reconciliation (`purpose='signup_acceptance'` × 2 rows, doc identity via `policy_version_id` → `policy_versions.documentType`); enforced Codex HIGH #2 (db.transaction throughout) + Codex HIGH #3 (AuthAdapter sole boundary, 0 `supabase.auth.*` matches in app code) + D-32 (partner_code lookup via `partner_stores`) + D-31 (JSON-only routes).

## Orchestration ordering in `signup.ts`

```
1.  getUserByEmail(input.email)
        ├── exists → { kind: "already_registered" }   (Resolved Q1; route emits welcome-back)
        └── new path ↓
2.  if input.partner_code → isPartnerCodeActive(...)
        ├── inactive/absent → { kind: "invalid_partner_code" }
        └── active → trialSource = "partner"
3.  authAdapter.createUser({ email, password })             (Codex HIGH #3)
4.  db.transaction(async tx => { ... })                     (Codex HIGH #2 + D-25)
        a. getCurrentPolicyVersions(tx)  → { tos, privacy }
        b. insertPublicUser({...trial_source}, tx)
        c. insertSignupConsents({tosPolicyVersionId, privacyPolicyVersionId}, tx)
        d. insertTrialingSubscription({trialSource}, tx)
        e. mintVerificationToken({userId}, tx)
   catch → authAdapter.adminDeleteUser(userId)              (D-25 compensation)
5.  inngest.send({ id: `email-verification/${tokenId}`, template: "verification" })
6.  authAdapter.signInWithPassword({...}) wrapped in try/catch (best-effort cookie mint)
7.  return { kind: "created", userId, verificationUrl }
```

## Codex HIGH coverage

| Finding | Status | Verification |
|---------|--------|--------------|
| HIGH #2 — db.transaction wraps signup writes | FIXED | `grep "db\.transaction" src/contexts/iam/application/signup.ts` → 4 matches |
| HIGH #2 — verify-email order: consume + setEmailVerifiedAt in one tx | FIXED | `grep "db\.transaction" src/contexts/iam/application/verify-email.ts` → 4 matches |
| HIGH #2 — repos accept dbOrTx | FIXED | All 6 repo write fns + types.ts shipped |
| HIGH #3 — AuthAdapter sole boundary | FIXED | `grep -rE "supabase\\.auth\\." src/contexts/iam/application/ src/app/api/v1/iam/ src/app/auth/` returns only comment lines (no actual calls) |
| HIGH #5 — signup throttle "always" mode | FIXED | `grep -E 'withThrottle\\(.*"signup".*"always"' src/app/api/v1/iam/signup/route.ts` → 1 match |
| HIGH #6 — Playwright E2E covers cookie flow | FIXED | `tests/e2e/auth-signup-verification.spec.ts` exists; 2 tests; no placeholder assertions |

## D-32 partner_code coverage (4 paths tested)

| Path | Result | Test |
|------|--------|------|
| Active row, code matches `partner_stores.is_active = true` | trial_source='partner', 30 days | `iam-signup.integration.test.ts:D-32 active` |
| Inactive row | `invalid_partner_code` 400 | `iam-signup.integration.test.ts:D-32 inactive` |
| Code absent (no row) | `invalid_partner_code` 400 | `iam-signup.integration.test.ts:D-32 absent` |
| Empty / null code | trial_source='organic', 14 days | `iam-signup.integration.test.ts:D-32 empty` |

## D-31 JSON-only verification

```
$ grep -c "formData" src/app/api/v1/iam/signup/route.ts
0
$ grep -c "formData" src/app/api/v1/iam/resend-verification/route.ts
0
```

Both Phase 4 IAM routes use `request.json()` exclusively.

## Wave-1 reconciliation evidence (AUTH-09)

The `iam-consent-log.integration.test.ts` asserts via JOIN (NOT a literal `purpose` string match for documentType):

```sql
SELECT cl.id, pv.document_type
  FROM public.consent_logs cl
  JOIN public.policy_versions pv ON pv.id = cl.policy_version_id
 WHERE cl.user_id = $1
   AND cl.purpose = 'signup_acceptance'
   AND cl.source  = 'signup'
```

Returns exactly 2 rows; `document_type` set equals `{terms_of_service, privacy_policy}`. Both rows write `purpose='signup_acceptance'`; the legal-doc identity rides on `policy_version_id` → `policy_versions.documentType`. Phase 2 schema unchanged; the Phase 4-added `signup_acceptance` enum literal landed in plan 04-02 (Wave 2 commit `2d8d2b2`).

## Tests

| Suite | Tests | Status |
|-------|-------|--------|
| unit + unit-dom | 520 | PASS |
| integration (incl. plan 06's 15 new tests) | 111 | PASS |
| Playwright E2E spec | 2 | PENDING (requires `pnpm start` — verifiable via `pnpm test:e2e`) |
| **total vitest** | **631** | **PASS** |

15 new vitest integration tests:
- `iam-signup.integration.test.ts` — 7 tests
- `iam-consent-log.integration.test.ts` — 1 test
- `iam-verify-token.integration.test.ts` — 4 tests
- `iam-verification-gate.integration.test.ts` — 3 tests

## Deviations from plan

### Rule 1 — auto-fixed bugs / convention drift

1. **`subscriptions` schema mismatch.** Plan template referenced `trial_source` and `partner_code` columns on `subscriptions` that don't exist (Phase 2 schema). Reality: those columns are on `users`. `insertTrialingSubscription` now inserts into the actual columns (`provider='stripe'`, `status='trialing'`, `trial_start_date`, `trial_end_date`), and `insertPublicUser` writes `trial_source`/`partner_code` to `users`. `trialSource` parameter on `insertTrialingSubscription` only computes trial duration (14d organic / 30d partner).
2. **`InvalidPartnerCode` HTTP status is 400, not 422.** The closed registry at `src/shared/config/errors.ts:39` ships `invalid_partner_code: 400`. Plan stated 422 in two places. Used the registry value; route returns 400. No registry edit.
3. **`getTranslations(...)` from `next-intl/server` cannot run outside a Next request context.** Integration tests failed with "`cookies` was called outside a request scope". Replaced direct calls in `signup.ts` / `resend-verification.ts` / `signup/route.ts` with a top-level `pt-BR.json` import — pt-BR is the only launch locale per PROJECT.md, so the indirection adds no value.
4. **`signInWithPassword` wrapped in try/catch in `signupUser`.** It calls `cookies()` (Next request store) and would throw in non-request contexts. Plan said this is "non-fatal if signIn fails" — that promise is now actually enforced.

### Rule 3 — blocking issues

5. **`truncateAuthAndIamTables` TRUNCATE CASCADE on `auth.users` failed.** Postgres role `postgres` is NOT the owner of `auth.refresh_tokens_id_seq`, so the cascade's RESTART IDENTITY clause errored. Replaced with explicit DELETE chain on the FK children (`consent_logs`, `subscriptions`, `users`) + DELETE FROM `auth.users`.
6. **`policy_versions` partial unique index `policy_versions_one_current_per_doc_type_idx` blocks adding a parallel `is_current=true` row.** The original `seedCurrentPolicyVersions` first stamped prior `is_current=false` then inserted version `1.0` — broke `tests/integration/seed-data.integration.test.ts` (which asserts exactly one `is_current=true` row at version `2026-04-25.1`, the seeded value). Fixed by having the fixture reuse the seeded rows when present and only fall back to inserting `1.0` on a freshly-migrated database.
7. **users.ts `findById` preservation.** Plan said "REPLACE Plan 03 stub". Reality: Phase 2's `findById` is consumed by Wave 3's AuthAdapter (`getUserById` delegates to it) and 7 other call sites. Wave 3 SUMMARY deviation #1 already established the policy: keep `findById`, add new functions alongside.

### Rule 4 — architectural changes

None. All deviations were Rule 1/3 fixes within plan scope.

## Acceptance criteria — diff

| Criterion | Outcome |
|-----------|---------|
| 6 repository files + types.ts ship | PASS |
| `users.ts` derives `hasPassword` from `auth.users.encrypted_password` | PASS |
| `partner-store.ts` exports `isPartnerCodeActive` checking `is_active = true` | PASS |
| `consent-logs.ts` writes 2 rows with `purpose='signup_acceptance'` + accepts dbOrTx | PASS |
| `consent-logs.ts` accepts `tosPolicyVersionId` + `privacyPolicyVersionId` separately | PASS |
| `policy-versions.ts` exports `getCurrentPolicyVersions` (plural) returning {tos, privacy} | PASS |
| `subscriptions.ts` has caller-supplied `trialSource` (D-32) | PASS |
| `verification-tokens.ts` uses `FOR UPDATE` row lock | PASS |
| Plan 03 STUB warning removed from `users.ts` | PASS |
| `signup.ts` handles already_registered + invalid_partner_code | PASS |
| `signup.ts` uses `authAdapter.createUser` (Codex HIGH #3) | PASS |
| `signup.ts` uses `db.transaction` (Codex HIGH #2) | PASS |
| `signup.ts` has compensating `authAdapter.adminDeleteUser` | PASS |
| `signup.ts` looks up partner_code via `isPartnerCodeActive` | PASS |
| `signup.ts` emits Inngest with `id: \`email-verification/${tokenId}\`` | PASS |
| `verify-email.ts` wraps consume + setEmailVerifiedAt in `db.transaction` | PASS |
| `verify-email.ts` fires `captureSignupCompleted` | PASS |
| `resend-verification.ts` re-emits via Inngest | PASS |
| PostHog bridge has all exports | PASS |
| 3 vitest integration tests pass without placeholder assertions | PASS (4 — one extra for verification-gate) |
| 3 route files exist; signup uses `request.json()`; signup uses withThrottle "always" | PASS |
| Routes do NOT call `supabase.auth.*` directly | PASS (only matches are inside comments) |
| Playwright spec exists with cookie-bearing assertions; no placeholders | PASS (2 tests) |
| `pnpm typecheck` exits 0 | PASS |
| `pnpm lint` exits 0 (only pre-existing warnings) | PASS |
| `pnpm exec vitest run` exits 0 | PASS — 631/631 |

## Threat surface scan

No new threat surface beyond what the plan's `<threat_model>` registers. All twelve T-04-06-* threats are mitigated as documented:

| Threat ID | Disposition | Where mitigated |
|-----------|-------------|-----------------|
| T-04-06-01 (email enumeration) | mitigate | `signup.ts` returns `already_registered`; route emits welcome-back; same generic 200 copy |
| T-04-06-02 (token replay) | mitigate | `verification-tokens.ts:consumeVerificationToken` uses `FOR UPDATE` + WHERE `consumed_at IS NULL` |
| T-04-06-03 (forged URL) | mitigate | `mintToken/verifyToken` use `crypto.timingSafeEqual` (Wave 3 shared crypto) |
| T-04-06-04 (signup spam) | mitigate | `withThrottle("signup", "always", ...)` BEFORE auth call |
| T-04-06-05 (orphan auth.users) | mitigate | Compensating `authAdapter.adminDeleteUser` in catch block |
| T-04-06-06 (LGPD audit) | mitigate | 2 consent_logs rows in same db.transaction; AUTH-09 JOIN test asserts |
| T-04-06-07 (child <13 signup) | mitigate | Zod `age_confirmed: z.literal(true)` at boundary |
| T-04-06-08 (PostHog email leak) | mitigate | `posthog-bridge.ts` `properties: {}` (or `{ document_type }`); never email |
| T-04-06-09 (signup_completed too early) | mitigate | `verify-email.ts` fires `captureSignupCompleted` only on tx commit |
| T-04-06-10 (gate bypass) | mitigate | `requireVerifiedUser` gate test asserts 403 for unverified |
| T-04-06-11 (adapter boundary) | mitigate | grep proves zero `supabase.auth.*` non-comment matches in app code |
| T-04-06-12 (partner code abuse) | mitigate | `isPartnerCodeActive` queries `is_active = true`; 4 paths tested |

## Notes for downstream Phase 4 plans

1. **Plan 04-07 (login):** import `getUserByEmail` from `@contexts/iam/infrastructure/db/users`. The Wave-1 happy path is proven here.
2. **Plan 04-09 (logout/me/oauth):** the OAuth-complete flow re-uses `getCurrentPolicyVersions` + `insertSignupConsents` + `insertTrialingSubscription` for the same 2 consent_logs writes. Wrap in `db.transaction(...)` — repos accept `dbOrTx`.
3. **Plan 04-10 (UI):** Consume `POST /api/v1/iam/signup` as JSON only (D-31). Signup payload = `{email, password, age_confirmed: true, terms_accepted: true, privacy_accepted: true, timezone, partner_code?}`.
4. **Plan 04-11 (notifications):** the verification + welcome-back templates are wired via Inngest events with `id: email-verification/{tokenId}` and `id: welcome-back/{email}` for 24h producer-side dedup.
5. **Test fixtures:** `seedCurrentPolicyVersions` is now idempotent and concurrent-safe; reuses Phase 02 `pnpm db:seed` rows when present. Use `beforeAll` (not `beforeEach`) to call it in new test files.

## Self-Check

Verified file existence:
- src/contexts/iam/infrastructure/db/types.ts — FOUND
- src/contexts/iam/infrastructure/db/users.ts — FOUND (extended)
- src/contexts/iam/infrastructure/db/consent-logs.ts — FOUND (extended)
- src/contexts/iam/infrastructure/db/policy-versions.ts — FOUND
- src/contexts/iam/infrastructure/db/subscriptions.ts — FOUND
- src/contexts/iam/infrastructure/db/verification-tokens.ts — FOUND
- src/contexts/iam/infrastructure/db/partner-store.ts — FOUND
- src/contexts/iam/application/signup.ts — FOUND
- src/contexts/iam/application/verify-email.ts — FOUND
- src/contexts/iam/application/resend-verification.ts — FOUND
- src/contexts/iam/infrastructure/posthog-bridge.ts — FOUND
- src/app/api/v1/iam/signup/route.ts — FOUND
- src/app/auth/verify/route.ts — FOUND
- src/app/api/v1/iam/resend-verification/route.ts — FOUND
- src/app/api/v1/diagnostics/iam-test-helpers/latest-token/route.ts — FOUND
- tests/integration/iam-signup.integration.test.ts — FOUND
- tests/integration/iam-consent-log.integration.test.ts — FOUND
- tests/integration/iam-verify-token.integration.test.ts — FOUND
- tests/integration/iam-verification-gate.integration.test.ts — FOUND
- tests/e2e/auth-signup-verification.spec.ts — FOUND

Verified commits exist (git log):
- e3e6344 Task 1 (repos)
- 599b150 Task 2 (use-cases + integration tests)
- a52dcb2 Task 3 (route handlers + gate test)
- 40d9039 Task 4 (Playwright E2E + diagnostics endpoint)

Verified test counts (`pnpm exec vitest run`):
- unit + unit-dom: 520/520 passing
- integration: 111/111 passing (including 15 new tests for plan 06)
- typecheck: clean

Verified Codex HIGH/MEDIUM acceptance:
- HIGH #2: `db.transaction` matches in signup.ts (4) + verify-email.ts (4) = 8 — both use-cases wrapped in tx
- HIGH #3: zero `supabase.auth.*` matches in `src/contexts/iam/application/`, `src/app/api/v1/iam/`, or `src/app/auth/` (only comment lines)
- HIGH #5: signup uses `withThrottle("signup", "always", ...)`; resend uses `bumpThrottleRow` per-user
- HIGH #6: Playwright spec ships with 2 tests; no placeholder assertions
- D-32: partner_code lookup via `isPartnerCodeActive`; 4 paths covered
- D-31: zero `formData` matches in route handlers; both use `request.json()`

## Self-Check: PASSED
