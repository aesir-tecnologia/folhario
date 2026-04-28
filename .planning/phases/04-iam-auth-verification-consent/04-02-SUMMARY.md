---
phase: 04-iam-auth-verification-consent
plan: 02
subsystem: iam
tags: [schema, drizzle, migration, rls, auth, throttle, email-verification, password-reset]
dependency-graph:
  requires:
    - 04-01 (Phase 4 prerequisite audit + Wave-1 reconciliation amendment)
    - Phase 2 plans 02-01..02-11 (base IAM schema + RLS posture)
  provides:
    - "emailVerificationTokens, passwordResetTokens, authThrottle Drizzle exports importable from @contexts/iam/infrastructure/db/schema"
    - "users.email_verified_at column (D-22 product source of truth)"
    - "auth_throttle.locked_until column (D-14 5-min lockout per Codex HIGH #5)"
    - "consent_logs.purpose extended TS enum with 'signup_acceptance' literal (Wave-1 reconciliation)"
    - "Live local Postgres state matching schema, RLS verifiably enabled"
  affects:
    - "Plan 04-03 (throttle middleware) — reads auth_throttle.locked_until"
    - "Plan 04-04 (email verification) — writes email_verification_tokens"
    - "Plan 04-05 (password reset) — writes password_reset_tokens"
    - "Plan 04-06 (signup) — writes consent_logs rows with purpose='signup_acceptance'"
tech-stack:
  added:
    - "primaryKey, bigint imports from drizzle-orm/pg-core (already had pgTable, varchar, etc.)"
  patterns:
    - "Composite PK via primaryKey({ columns: [...] }) builder in table extras array"
    - "TS-only enum narrowing on varchar(64) — drizzle-kit emits zero SQL diff (correct behavior)"
    - "Hand-appended RLS SQL after drizzle-kit generate; drizzle-kit migrate (not push) executes verbatim"
key-files:
  created:
    - "drizzle/migrations/0003_phase04_iam_extensions.sql"
    - "drizzle/migrations/meta/0003_snapshot.json"
    - "tests/integration/iam-schema-phase4.integration.test.ts"
  modified:
    - "src/contexts/iam/infrastructure/db/schema.ts (+59 lines: 3 new tables, emailVerifiedAt, signup_acceptance literal)"
    - "src/shared/db/schema-registry.ts (+3 re-exports for drizzle-kit visibility)"
    - "src/contexts/iam/application/record-consent.ts (RecordConsentInput.purpose extended for signup_acceptance)"
    - "tests/integration/diagnostics-consent.integration.test.ts (UserRow fixture extended with emailVerifiedAt)"
    - "tests/unit/auth-adapter.test.ts (UserRow fixture extended with emailVerifiedAt)"
    - "drizzle/migrations/meta/_journal.json (idx 3 entry for phase04_iam_extensions)"
decisions:
  - "Used mode: \"string\" on all new timestamp columns per project D-46 convention (NOT mode: \"date\" as plan suggested) — every existing timestamp in schema.ts uses string mode for ISO-8601 round-trip"
  - "Used varchar(64) for token_hash columns (SHA-256 hex is deterministic 64 chars) — matches existing varchar pattern (email is varchar(320), code is varchar(64)); plan suggested text() but varchar is more idiomatic here. Functionally equivalent."
  - "Used varchar(45) for auth_throttle.ip (IPv6 max length); varchar(64) for endpoint. Plan's text() would have worked but varchar bounds the storage."
  - "Schema-registry.ts re-exports updated alongside the schema.ts edits — drizzle.config.ts schema points at the registry, so missing re-exports would have caused drizzle-kit to emit zero diff for the new tables. This was caught pre-generate via the advisor pass."
  - "Updated downstream RecordConsentInput type to include 'signup_acceptance' (Rule 3: blocking issue caused by my schema change). Plan 06 will write rows with this purpose."
metrics:
  duration_minutes: 18
  completed: 2026-04-27T00:46:00Z
  tasks_completed: 4
  files_changed: 8
  commits: 4
---

# Phase 4 Plan 02: Schema Additions (Verification/Reset Tokens + auth_throttle + email_verified_at) Summary

**One-liner:** Phase 4's three new tables (`email_verification_tokens`, `password_reset_tokens`, `auth_throttle` with `locked_until`) plus `users.email_verified_at` and the `consent_logs.purpose` `signup_acceptance` literal landed in `schema.ts`, generated as `drizzle/migrations/0003_phase04_iam_extensions.sql`, applied via `drizzle-kit migrate` (not `push`), and verified on live local Postgres with `relrowsecurity = true` on all three new tables.

## What landed

### Tables added (3)

| Table | Columns | Constraints |
|-------|---------|-------------|
| `email_verification_tokens` | id (uuid PK), user_id (uuid FK→users CASCADE), token_hash (varchar(64) UNIQUE), expires_at (timestamptz NOT NULL), consumed_at (timestamptz NULL), created_at (timestamptz NOT NULL DEFAULT now()), sent_to_email (varchar(320) NOT NULL) | Unique index on token_hash; index on user_id; RLS service_role_only |
| `password_reset_tokens` | Same shape as email_verification_tokens | Same indexes + policy |
| `auth_throttle` | ip (varchar(45) NOT NULL), endpoint (varchar(64) NOT NULL), window_start (bigint NOT NULL), count (integer NOT NULL DEFAULT 1), locked_until (timestamptz NULL), created_at (timestamptz NOT NULL DEFAULT now()) | Composite PK (ip, endpoint, window_start); btree index on window_start; partial index on locked_until WHERE NOT NULL; RLS service_role_only |

### Columns added (1)

- `users.email_verified_at TIMESTAMPTZ NULL` — Phase 4 D-22 product source of truth (NOT `auth.users.email_confirmed_at`).

### TS enum extension (TS-only, no SQL diff)

- `consent_logs.purpose` (varchar(64)) added 5th literal `signup_acceptance` for AUTH-09 — Phase 4 Wave-1 reconciliation per `04-PREREQ-AUDIT.md` amendment. Drizzle-kit emitted zero SQL diff for `consent_logs` (correct behavior — no CHECK constraint exists; the enum lives in TS-land only).

### Migration file (auto-numbered)

- `drizzle/migrations/0003_phase04_iam_extensions.sql` — drizzle-kit assigned the `0003_` prefix at generate time (Codex MEDIUM fix observed: prefix not hardcoded).

## Live database verification

```text
=== \dt (filtered) ===
 public | auth_throttle             | table | postgres
 public | email_verification_tokens | table | postgres
 public | password_reset_tokens     | table | postgres

=== users.email_verified_at ===
 email_verified_at | timestamp with time zone | (nullable)

=== auth_throttle.locked_until ===
 locked_until | timestamp with time zone | (nullable)
 partial idx: "auth_throttle_locked_until_idx" btree (locked_until) WHERE locked_until IS NOT NULL

=== Codex HIGH #1 smoking gun (relrowsecurity) ===
          relname          | relrowsecurity
---------------------------+----------------
 auth_throttle             | t
 email_verification_tokens | t
 password_reset_tokens     | t
(3 rows)
```

All three new tables have `relrowsecurity = t`, proving `drizzle-kit migrate` (not `push`) executed the appended `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` statements verbatim from the SQL file.

## Tests

`tests/integration/iam-schema-phase4.integration.test.ts` — 7 tests, all passing against live local Postgres:

1. `email_verification_tokens` columns shape (information_schema)
2. `password_reset_tokens` columns shape (information_schema)
3. `auth_throttle` composite PK (pg_index)
4. `auth_throttle.locked_until` exists + nullable + timestamptz (D-14)
5. `users.email_verified_at` exists + nullable + timestamptz (D-22)
6. RLS smoking gun: `relrowsecurity = true` on all three (Codex HIGH #1)
7. service_role can INSERT + SELECT through the policy (rolled back)

Skip-when-DATABASE_POOL_URL-unset behavior verified (`describe.skipIf` pattern from Phase 1).

## Deviations from plan

### Auto-fixed issues

**1. [Rule 1 - Convention] Used `mode: "string"` instead of plan's `mode: "date"` on every timestamp column.**
- **Found during:** Task 1
- **Issue:** Plan's `<interfaces>` block specified `timestamp({ withTimezone: true, mode: "date" })`, but every existing timestamp in `src/contexts/iam/infrastructure/db/schema.ts` uses `mode: "string"` per project D-46 convention ("reads round-trip as ISO-8601 UTC strings without an extra `.toISOString()` step"). Following the plan literal would have introduced two timestamp modes in one file — drift risk.
- **Fix:** Used `mode: "string"` on all 9 new timestamp columns. The plan's grep acceptance criterion `grep -c "withTimezone: true, mode: \"date\""` would have returned 0 under correct project convention; the underlying intent (TZ-aware mode on every timestamp) is preserved and verifiable via `grep -c "withTimezone: true, mode: \"string\""`.
- **Files modified:** `src/contexts/iam/infrastructure/db/schema.ts`
- **Commit:** `2d8d2b2`

**2. [Rule 1 - Convention] Used camelCase TS property names with snake_case column names.**
- **Found during:** Task 1
- **Issue:** Plan's interface examples used snake_case property names (`user_id`, `token_hash`, etc.) but every existing column in the file uses `camelCaseProperty: type("snake_case_column", ...)`.
- **Fix:** All new tables use camelCase TS properties (`userId`, `tokenHash`, `expiresAt`, etc.) mapped to snake_case SQL columns. Live SQL output is identical to the plan's intent.
- **Files modified:** `src/contexts/iam/infrastructure/db/schema.ts`
- **Commit:** `2d8d2b2`

**3. [Rule 1 - Convention] Used array form for table extras (not object form).**
- **Found during:** Task 1
- **Issue:** Plan suggested `(t) => ({ pk: primaryKey(...) })`; existing tables use `(table) => [primaryKey(...), index(...)]`.
- **Fix:** Used array form. Drizzle-kit accepts both, but consistency wins.
- **Commit:** `2d8d2b2`

**4. [Rule 2 - Missing critical functionality] Updated `src/shared/db/schema-registry.ts` to re-export the three new tables.**
- **Found during:** Task 1 orientation (caught by advisor before generate ran)
- **Issue:** `drizzle.config.ts` points its `schema:` field at `src/shared/db/schema-registry.ts`, NOT the per-context module. Without adding the new tables to the registry, `drizzle-kit generate` would have emitted zero diff and the migration file would have been empty.
- **Fix:** Added `authThrottle, emailVerificationTokens, passwordResetTokens` to the iam re-export block in `schema-registry.ts`.
- **Files modified:** `src/shared/db/schema-registry.ts`
- **Commit:** `2d8d2b2`

**5. [Rule 3 - Blocking] Extended `RecordConsentInput.purpose` type to include `signup_acceptance`.**
- **Found during:** Task 1 typecheck
- **Issue:** After extending `consent_logs.purpose` enum array with `signup_acceptance`, the route handler's `parsed.value.purpose` (derived from drizzle-zod) became `... | "signup_acceptance"` but `recordConsent`'s `RecordConsentInput.purpose` type was hand-rolled to the original 4 literals only. TS error TS2322 at `src/contexts/iam/api/consent-route.ts:81`.
- **Fix:** Added `"signup_acceptance"` to the literal union in `RecordConsentInput`. This aligns with Plan 06's `insertSignupConsents` which the planning amendment says will write rows with `purpose='signup_acceptance'`.
- **Files modified:** `src/contexts/iam/application/record-consent.ts`
- **Commit:** `2d8d2b2`

**6. [Rule 3 - Blocking] Added `emailVerifiedAt: null` to test fixtures.**
- **Found during:** Task 1 typecheck
- **Issue:** Adding `emailVerifiedAt` to `users` made the `UserRow` type require it. Two test fixtures synthesizing `UserRow` values broke (TS2741):
  - `tests/unit/auth-adapter.test.ts:265` (buildFakeUserRow)
  - `tests/integration/diagnostics-consent.integration.test.ts:180` (manual UserRow construction in beforeAll)
- **Fix:** Added `emailVerifiedAt: null` (or `email_verified_at`-derived value via the SELECT in the integration fixture) to both fixture call-sites.
- **Files modified:** `tests/unit/auth-adapter.test.ts`, `tests/integration/diagnostics-consent.integration.test.ts`
- **Commit:** `2d8d2b2`

**7. [Rule 1 - Bug] Test 7 used `gen_random_uuid()` for user_id, which violated FK to users.**
- **Found during:** Task 4 first test run
- **Issue:** The service_role policy test inserted into `email_verification_tokens` with `gen_random_uuid()` as user_id, but the `email_verification_tokens_user_id_users_id_fk` constraint requires the user to exist. `PostgresError: violates foreign key constraint`.
- **Fix:** Insert a real `users` row inside the same rolled-back transaction first, then use that user's id.
- **Files modified:** `tests/integration/iam-schema-phase4.integration.test.ts`
- **Commit:** `f37eb42`

### Architectural decisions (Rule 4) raised

None — all deviations were Rule 1/2/3 fixes within the plan's scope.

## Open question / PRD doc-fix queued

- **Open Question 3 (resolved):** Phase 4 implements `users.email_verified_at` here (Plan 02). PRD §4 data-model doc-fix to add `email_verified_at` to the User row formal definition is queued for Plan 11.

## Notes

- **Codex HIGH #1 fixed:** `drizzle-kit migrate` (not `push`) was used. The smoking-gun integration test (Test 6) asserts `relrowsecurity = true` on all three new tables, which is the proof.
- **Codex HIGH #5 fixed:** `auth_throttle.locked_until` column exists, with a partial index for the throttle-middleware lookup hot path.
- **Codex MEDIUM (filename brittleness) fixed:** Migration prefix is `0003_` (auto-assigned), not hardcoded.
- **Wave-1 reconciliation honored:** `consent_logs.purpose` TS enum extended with `signup_acceptance`. Live SQL diff is empty (correct — varchar(64) with no CHECK constraint), but the application boundary now narrows correctly. Plan 06 (signup) will write 2 rows with this purpose, distinguished via `policy_version_id`.

## Self-Check: PASSED

Verified:
- `src/contexts/iam/infrastructure/db/schema.ts` exports `emailVerificationTokens`, `passwordResetTokens`, `authThrottle` (3/3 grep hits)
- `users.email_verified_at` and `auth_throttle.locked_until` exist on live DB (psql `\d` confirms timestamp with time zone, nullable)
- `relrowsecurity = t` on all three new tables (psql `pg_class` query)
- Migration file `drizzle/migrations/0003_phase04_iam_extensions.sql` exists with auto-numbered prefix
- Journal updated: `idx 3 phase04_iam_extensions` in `drizzle/migrations/meta/_journal.json`
- `pnpm typecheck` exits 0
- 7/7 integration tests pass against live local Postgres
- Skip-when-DATABASE_POOL_URL-unset behavior verified (7/7 skipped with empty env var)
- Commits `2d8d2b2`, `5e6f87d`, `00ce34b`, `f37eb42` exist in git log
