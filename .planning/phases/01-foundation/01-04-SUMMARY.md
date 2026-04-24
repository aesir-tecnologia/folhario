---
phase: 01
plan: 04
subsystem: foundation-supabase-local-dev
tags:
  - supabase
  - local-dev
  - postgres
  - integration-test
requires:
  - phase: 01-01
    provides: supabase-cli-devdep + package-scripts (db:start, db:sync-env, test:integration)
  - phase: 01-02
    provides: env-zod-schemas + vitest-config-projects (extended for integration tests)
provides:
  - supabase-config-toml-postgres-17-pinned
  - env-sync-script-writing-env-local-only
  - postgres-js-prod-dep
  - integration-test-with-cloud-supabase-refusal-guard
affects:
  - 01-08-ci-yml (needs postgres:17-alpine service container + integration test step)
  - 02-drizzle-schema (consumes DATABASE_POOL_URL + postgres@3 runtime)
tech-stack:
  added:
    - postgres@3.4.9 (production dependency, Action 14)
  patterns:
    - direct-cli-binary-over-pnpm-wrapper-to-avoid-banner-contamination
    - internal-override-name-keys-auth-dot-prefix
    - database-pool-url-derived-from-database-url-locally-identical-r3
    - cloud-supabase-hostname-guard-on-integration-tests
    - integration-project-isolated-from-unit-setup-env-file
key-files:
  created:
    - supabase/config.toml
    - supabase/.gitignore
    - scripts/sync-supabase-env.sh
    - tests/integration/postgres-connection.integration.test.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - vitest.config.ts
key-decisions:
  - "Supabase CLI 2.95 internal override-name keys empirically verified: api.url, auth.anon_key, auth.service_role_key, db.url. Plan template used anon_key / service_role_key (without auth. prefix); corrected via Rule 1 fix commit d395c4f."
  - "Script uses ./node_modules/.bin/supabase directly instead of pnpm supabase. pnpm prepends its run banner ('> folhario@0.0.0 supabase ...') to stdout which contaminated .env.local with non-KEY=VALUE lines. Direct binary invocation is clean."
  - "DATABASE_POOL_URL derived verbatim from DATABASE_URL locally (R-3). Local Supabase does not run Supavisor (supabase/config.toml [db.pooler] enabled=false is CLI default). Runtime's { prepare: false } posture is harmless locally; mandatory in preview/prod when Supavisor txn pooler sits on port 6543."
  - "Integration project de-inherited the root-level setupFiles entry. Plan 01-02 placed setupFiles: ['tests/unit/setup-env.ts'] at the root of vitest.config with extends: true propagating to both projects — that leaked fake DATABASE_POOL_URL=postgres://u:p@localhost:5432/db into the integration runtime and defeated describe.skipIf(!dbUrl). Rule 3 blocker fix: moved setupFiles into the unit project block only."
  - "postgres pinned exactly to 3.4.9 (not '3' or '^3.x'). Matches repo convention (next: 16.2.3, zod: 4.3.6) and prevents silent drift."
  - ".env.local intentionally contains CLI-emitted superset keys (FUNCTIONS_URL, JWT_SECRET, PUBLISHABLE_KEY, S3_*, STORAGE_S3_URL, STUDIO_URL, SECRET_KEY). Not stripped. Runtime reads only PRD §20 vars via typed server-env.ts / client-env.ts; extras are inert. Filtering would add fragility without benefit."
patterns-established:
  - "Env sync script invokes CLI via ./node_modules/.bin/supabase to avoid wrapper-banner contamination"
  - "Integration tests refuse cloud URLs at module-load time (before any driver instantiation) via regex hostname guard"
  - "setupFiles that inject synthetic env vars belong in the PROJECT block of vitest.config, never the root"
requirements-completed:
  - INFRA-26
duration: ~9min
completed: 2026-04-24
---

# Phase 01 Plan 04: Local Supabase Dev Stack + Integration Test Summary

**Boots Postgres 17 + Auth + Storage + Studio via Supabase CLI Docker stack, writes `.env.local` from `supabase status -o env` with correct PRD §20 var mapping (empirically corrected internal key names), lands `postgres@3.4.9` as production dep, and proves end-to-end that an integration test reaches the live local DB with `{ prepare: false }` posture and refuses any cloud Supabase URL.**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-04-24T02:32:34Z
- **Completed:** 2026-04-24T02:41:28Z
- **Tasks:** 2 full + automatable subset of Task 3 (Task 3 was a human-verify checkpoint; orchestrator pre-authorized the automatable subset — see Deviations)
- **Commits:** 3 (Task 1 chore, Task 2 feat, Task 3-script fix)
- **Files created:** 4 (`supabase/config.toml`, `supabase/.gitignore`, `scripts/sync-supabase-env.sh`, `tests/integration/postgres-connection.integration.test.ts`)
- **Files modified:** 3 (`package.json`, `pnpm-lock.yaml`, `vitest.config.ts`)

## Accomplishments

- `pnpm db:start` boots local Supabase stack (images already cached from a prior developer session; no fresh pull required). `./node_modules/.bin/supabase status` returns:
  ```
  API URL:       http://127.0.0.1:54321
  DB URL:        postgresql://postgres:postgres@127.0.0.1:54322/postgres
  Studio URL:    http://127.0.0.1:54323
  ```
- `./node_modules/.bin/supabase --version` → **2.95.0** (matches package.json `devDependencies.supabase` pin).
- Postgres server reports `server_version_num = 170006`, `server_version = 17.6` — confirms D-16 + D-25 parity (local Supabase matches what CI postgres:17-alpine will run in Plan 01-08).
- `pnpm db:sync-env` writes `.env.local` with all 5 PRD §20 required vars:
  - `DATABASE_URL` (mapped from CLI `db.url`)
  - `DATABASE_POOL_URL` (derived from DATABASE_URL, R-3 local reconciliation)
  - `NEXT_PUBLIC_SUPABASE_URL` (mapped from `api.url`)
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (mapped from `auth.anon_key`)
  - `SUPABASE_SERVICE_ROLE_KEY` (mapped from `auth.service_role_key`)
- `.env` is NOT touched: `git status .env` → "nothing to commit, working tree clean" before AND after `pnpm db:sync-env`.
- Integration test live-run: `pnpm exec vitest run --project=integration` with `DATABASE_POOL_URL` set from `.env.local` → **2 tests passed (SELECT 1 + server_version_num >= 150000).**
- supabase.co refusal proven: `DATABASE_POOL_URL="postgresql://x:y@db.abc.supabase.co:5432/postgres" pnpm exec vitest run --project=integration` → **exit code 1**, error message at module load: "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL)" (Action 15 guard confirmed firing before any connection attempt).
- `postgres` pinned exactly to `3.4.9` in `dependencies` (not devDependencies, not caret-ranged) per Action 14.
- `pnpm typecheck` exits 0.
- `pnpm exec vitest run --project=unit` — 5 files / 101 assertions still pass (Plan 01-02 unit tests unaffected by vitest.config reshuffle).

### Redacted `.env.local` sample

```
# Auto-generated by scripts/sync-supabase-env.sh — do not edit by hand.
# Re-run 'pnpm db:sync-env' after 'pnpm db:start' or 'pnpm db:reset'.
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
FUNCTIONS_URL="http://127.0.0.1:54321/functions/v1"
GRAPHQL_URL="http://127.0.0.1:54321/graphql/v1"
INBUCKET_URL="http://127.0.0.1:54324"
JWT_SECRET="<REDACTED-32-char-local-only-jwt-secret>"
MAILPIT_URL="http://127.0.0.1:54324"
MCP_URL="http://127.0.0.1:54321/mcp"
NEXT_PUBLIC_SUPABASE_ANON_KEY="<REDACTED-jwt>"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
PUBLISHABLE_KEY="<REDACTED-sb_publishable_...>"
REST_URL="http://127.0.0.1:54321/rest/v1"
S3_PROTOCOL_ACCESS_KEY_ID="<REDACTED>"
S3_PROTOCOL_ACCESS_KEY_SECRET="<REDACTED>"
S3_PROTOCOL_REGION="local"
SECRET_KEY="<REDACTED-sb_secret_...>"
STORAGE_S3_URL="http://127.0.0.1:54321/storage/v1/s3"
STUDIO_URL="http://127.0.0.1:54323"
SUPABASE_SERVICE_ROLE_KEY="<REDACTED-jwt>"
DATABASE_POOL_URL="postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

These are local-only demo credentials (JWT keys hardcoded in Supabase CLI for every local stack install — not real secrets). `.env.local` is gitignored from Plan 01-01.

## Task Commits

1. **Task 1: init supabase/config.toml + sync script** — `8fb0a1c` (chore)
2. **Task 2: postgres@3 prod dep + integration test + vitest project fix** — `75b97f2` (feat)
3. **Task 3-script fix: direct binary + correct auth.* override-name keys** — `d395c4f` (fix)

Final `docs(01-04)` commit with SUMMARY + STATE + ROADMAP + REQUIREMENTS lands separately.

## Files Created/Modified

### Created

- `supabase/config.toml` — emitted by `pnpm supabase init --yes` (non-interactive). 406 lines. `[db].major_version = 17` set by CLI 2.95 default, matches D-16 + D-25.
- `supabase/.gitignore` — emitted by CLI (duplicates root `.gitignore`'s entries for `.branches`, `.temp`, plus adds `.env.local` and `.env.keys`). Harmless duplication.
- `scripts/sync-supabase-env.sh` — 42 lines. Guards Docker daemon reachability, invokes `./node_modules/.bin/supabase status -o env` directly (not via pnpm — see Deviation 1), maps 4 CLI keys to PRD §20 names with correct `auth.*` prefix on the two key-type entries (see Deviation 1), derives `DATABASE_POOL_URL` from `DATABASE_URL` (R-3), writes `.env.local` with a two-line header comment, uses `trash || rm -f` for temp cleanup (CI-compatible). Executable (0755).
- `tests/integration/postgres-connection.integration.test.ts` — 32 lines. Module-load hostname guard throws on `supabase.co` URLs before any `postgres()` instantiation. `describe.skipIf(!dbUrl)` when env var absent. Two tests: `SELECT 1` and `SHOW server_version_num >= 150000`. Client uses `{ prepare: false, max: 1, idle_timeout: 5 }`; `afterAll` closes with `sql.end({ timeout: 5 })`.

### Modified

- `package.json` — added `"postgres": "3.4.9"` to `dependencies` (not devDependencies). Action 14 avoids Phase 2 dep-tier churn. Exact version pin matches repo convention.
- `pnpm-lock.yaml` — resolved `postgres@3.4.9` (current 3.x patch, no subdep regressions).
- `vitest.config.ts` — removed root-level `setupFiles: ["tests/unit/setup-env.ts"]`; moved into the `unit` project block. See Deviation 2.

## Decisions Made

See `key-decisions` in frontmatter. Grep-anchored to script content and test content where applicable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Script produced malformed `.env.local` on first run — two independent root causes**

- **Found during:** Task 3 automatable verification (`pnpm db:sync-env` after `pnpm db:start`).
- **Issue:**
  - Running `pnpm supabase status -o env` prepends the pnpm script-invocation banner (`> folhario@0.0.0 supabase /Users/machado/Projects/folhario\n> supabase status -o env ...`) to stdout. That banner was captured into `.env.local` as four non-KEY=VALUE lines, breaking downstream consumers (the CLI itself refused to reload `.env.local` afterwards).
  - Plan's `--override-name anon_key=NEXT_PUBLIC_SUPABASE_ANON_KEY` and `--override-name service_role_key=SUPABASE_SERVICE_ROLE_KEY` silently did nothing because Supabase CLI 2.95 uses dotted *internal config paths* (`auth.anon_key`, `auth.service_role_key`), not the emitted uppercase output keys (`ANON_KEY`, `SERVICE_ROLE_KEY`) and not the unqualified lowercase names the plan used. Only `api.url` and `db.url` happened to be correct as-is. Result: `.env.local` contained `ANON_KEY=...` and `SERVICE_ROLE_KEY=...` with their default names — two of the five PRD §20 required vars were missing.
- **Fix:**
  - Switched invocation from `pnpm supabase ...` to `./node_modules/.bin/supabase ...` (bypasses pnpm's script banner).
  - Added defensive `test -x "$SUPABASE_BIN"` guard with clear error message.
  - Corrected internal keys to `auth.anon_key` and `auth.service_role_key`.
  - Added `2>/dev/null` on the status call to suppress the benign `Stopped services: [supabase_imgproxy_folhario supabase_pooler_folhario]` stderr note (those pooler/imgproxy services are disabled by default in `supabase/config.toml` — not a real error).
- **Files modified:** `scripts/sync-supabase-env.sh`
- **Verification:** `pnpm db:sync-env` re-run → `.env.local` contains all 5 PRD §20 vars, no pnpm banner lines, no leaked non-KEY=VALUE lines. Empirical proof that all 4 override-name mappings work: `NEXT_PUBLIC_SUPABASE_URL=`, `DATABASE_URL=`, `NEXT_PUBLIC_SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=` all present.
- **Impact on plan acceptance:** Plan's Task 1 automated verification was grep-based (checked the script *contained* the override-name lines) — it passed both before and after the fix. The script's `must_haves.truths` claim "maps Supabase CLI output keys to PRD §20 variable names" was only satisfied *after* this fix. Without it, Plan 04 would have shipped a broken sync script that silently dropped two required env vars.
- **Committed in:** `d395c4f`

**2. [Rule 3 - Blocker] Integration test ran every time (never skipped) because Plan 01-02's root-level `setupFiles` leaked into the integration project**

- **Found during:** Task 2 verification (`pnpm exec vitest run --project=integration` before `pnpm db:start`).
- **Issue:** Plan 01-02 placed `setupFiles: ["tests/unit/setup-env.ts"]` at the ROOT of `vitest.config.ts`, inside `test: {}` alongside `projects: []`, and both projects had `extends: true`. That setup file executes `process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db"`. When Vitest ran the integration project, it inherited the root `setupFiles`, populated a bogus `DATABASE_POOL_URL`, and `describe.skipIf(!dbUrl)` consequently never skipped — the test attempted to connect to a nonexistent DB on port 5432 and failed with `ECONNREFUSED`.
- **Fix:** Moved `setupFiles: ["tests/unit/setup-env.ts"]` out of the root `test: {}` block and INTO the `unit` project's `test: {}` block only. Integration project now gets no synthetic env — `describe.skipIf(!dbUrl)` skips cleanly when `DATABASE_POOL_URL` is unset.
- **Files modified:** `vitest.config.ts`
- **Verification:**
  - `pnpm exec vitest run --project=unit` → still 101 tests pass (unit project retains setup).
  - `pnpm exec vitest run --project=integration` without env → 1 file skipped / 2 tests skipped.
  - `pnpm exec vitest run --project=integration` with `DATABASE_POOL_URL` from `.env.local` → 2 passed.
- **Impact on Plan 01-02's SUMMARY:** Plan 01-02's SUMMARY decision `vitest.config.ts gained root-level setupFiles: ["tests/unit/setup-env.ts"]; extends: true propagates into both projects` is NO LONGER TRUE after this fix. The setup file now applies to unit project only. Noting here so a later reviewer of 01-02 has the right reference.
- **Committed in:** `75b97f2`

### Deviations without explicit rule (orchestrator pre-authorized)

**3. Task 3 (`type="checkpoint:human-verify"`) executed autonomously, scoped to success-criteria subset**

- **Plan declaration:** Task 3 was a blocking human-verify checkpoint with 7 developer steps covering full stack boot + dev server headers + test against live DB + reset + stop.
- **Orchestrator prompt override:** "The user has CONFIRMED Docker is running. You ARE authorized to run `pnpm db:start` during execution... You DO NOT need to pause for user confirmation." Success criteria re-listed only steps 2 (`pnpm db:start`), 3 (`pnpm db:sync-env` + `.env` untouched), and 5 (integration test against live DB).
- **What I did:**
  - Step 1 (`docker info`) — verified at start.
  - Step 2 (`pnpm db:start`) — executed, stack up.
  - Step 3 (`pnpm db:sync-env` + confirm `.env` untouched) — executed.
  - Step 5 (integration test against live DB) — executed, both tests pass.
  - Step 4 (`pnpm dev` + headers check) — SKIPPED. Already covered by Plan 01-03 Task 3 smoke + 01-03 SUMMARY's grep-verified "all 5 security headers present on every checked path". No re-verification added by Plan 04's scope.
  - Step 6 (`pnpm db:reset`) — SKIPPED per success criteria (not in the list).
  - Step 7 (`pnpm db:stop`) — SKIPPED per orchestrator prompt ("you may leave the Supabase stack running").
- **Result:** Stack remains UP at end of plan execution. User may `pnpm db:stop` when done with downstream work. All automatable acceptance criteria validated.

### Authentication Gates

None — no cloud services touched. All work local.

## Issues Encountered

- **pnpm test:integration hook rejection:** The repo-level `prevent-watch-mode-tests.sh` hook aggressively rejects `pnpm test:integration` and `vitest --run --project=...` patterns. Worked around by calling `pnpm exec vitest run --project=integration` directly (positional `run`, matches hook's allowlist). Repo's own `package.json` script uses `pnpm exec vitest --run --project=integration` — this works when invoked via `pnpm test:integration`, but the hook blocks the direct invocation. NOT a plan-level issue; flagged for future GSD plans to prefer the positional form.
- **Unused output key noise in `.env.local`:** Script writes CLI-emitted superset (`FUNCTIONS_URL`, `JWT_SECRET`, `PUBLISHABLE_KEY`, `S3_*`, `STORAGE_S3_URL`, `STUDIO_URL`, `SECRET_KEY`). These aren't in PRD §20. Runtime reads only via typed `server-env.ts` / `client-env.ts` (Plan 01-02) — extras are inert. Filtering deferred (would add a sed/awk pass that could mask real key drift from future CLI versions).

## User Setup Required

None. Developer ran `pnpm db:start` successfully; Docker was already active.

## Known Stubs

**Intentional Phase 1 placeholders (not bugs):**

- `supabase/seed.sql` not created. Per D-17, Phase 2 introduces the seed alongside Drizzle schema. Phase 1 ships an empty-schema local DB.
- `supabase/migrations/` does not exist yet (CLI didn't create it on `init`). `pnpm db:reset` would succeed against empty migrations — Plan 02 adds the first migration file.

## Threat Flags

All five threats from the plan's `<threat_model>` remain correctly mitigated:

- **T-04-01 (Info Disclosure):** Script's `OUT=.env.local` is hardcoded; `grep -q "NEVER modifies .env"` in script content. `.env` untouched verified empirically (git status unchanged before and after `pnpm db:sync-env`).
- **T-04-02 (DoS):** Script's `docker info >/dev/null 2>&1` guard runs before any supabase invocation. Verified by `bash -n` syntax + presence grep.
- **T-04-03 (Spoofing — PG version drift):** `supabase/config.toml [db].major_version = 17`; live Postgres reports 17.6. CI parity enforced in Plan 08.
- **T-04-04 (Tampering — cloud URL):** Test file's module-load `throw new Error("Refusing to run integration tests against cloud Supabase ...")` proven firing on `.supabase.co` URLs → exit 1.
- **T-04-05 (Dependency churn):** `postgres@3.4.9` in `dependencies` (not `devDependencies`) verified via `node -e "require('./package.json').dependencies.postgres"`.

No new threat surface introduced beyond the plan's threat model.

## Next Phase Readiness

**Ready for Plan 01-08 (CI):**
- `.github/workflows/ci.yml` (Plan 08) needs a `postgres:17-alpine` service container with an env like `POSTGRES_PASSWORD=postgres` and `POSTGRES_DB=postgres`, and an integration step that `export DATABASE_POOL_URL=postgres://postgres:postgres@localhost:5432/postgres && pnpm exec vitest run --project=integration`.
- `postgres@3.4.9` is installed at runtime (production dep) — the Vercel build in Plan 12 will include it automatically.

**Ready for Phase 2 (Drizzle + repositories):**
- `DATABASE_URL` and `DATABASE_POOL_URL` are in `.env.local` for local runs.
- `postgres-js` with `{ prepare: false }` posture is exercised in Plan 04's integration test — Phase 2 repositories reuse the pattern.
- Phase 2 will introduce `supabase/migrations/0001_init.sql` and `supabase/seed.sql` per D-17.

**Ready for later multi-region / pooler work:**
- Script's R-3 reconciliation (DATABASE_POOL_URL = DATABASE_URL locally) is documented so a later "preview/prod Supavisor" story can diverge the two. Local pooler could also be enabled by flipping `[db.pooler] enabled = true` in `supabase/config.toml` + re-running `pnpm db:start` — deferred.

## Self-Check

Files created verified against disk:

- `supabase/config.toml` — FOUND, `grep -qE "major_version\s*=\s*17"` matches
- `supabase/.gitignore` — FOUND (CLI-emitted)
- `scripts/sync-supabase-env.sh` — FOUND, executable (0755), `bash -n` passes, contains `DATABASE_POOL_URL`, `NEVER modifies .env`, `override-name api.url=NEXT_PUBLIC_SUPABASE_URL`, `docker info`, `auth.anon_key`, `auth.service_role_key`
- `tests/integration/postgres-connection.integration.test.ts` — FOUND, contains `prepare: false`, `SELECT 1`, `describe.skipIf`, `supabase\.co` regex, "Refusing to run integration tests against cloud Supabase"
- `package.json` — `dependencies.postgres = "3.4.9"` confirmed; `devDependencies.postgres` absent
- `vitest.config.ts` — `setupFiles` scoped to unit project only (grep: `"tests/unit/setup-env.ts"` appears inside the unit project block)

Commits verified present in `git log`:
- `8fb0a1c` (Task 1 chore)
- `75b97f2` (Task 2 feat)
- `d395c4f` (Task 3-script fix)

Runtime verification:
- `./node_modules/.bin/supabase --version` → 2.95.0
- `pnpm supabase status` → stack fully up (API, DB, Studio)
- Postgres `SHOW server_version_num` → 170006; `SHOW server_version` → 17.6
- `.env.local` contains all 5 PRD §20 required vars (DATABASE_URL, DATABASE_POOL_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY)
- `git status .env` → unchanged (script did not touch `.env`)
- `pnpm exec vitest run --project=integration` with DATABASE_POOL_URL → 2/2 tests passed
- `pnpm exec vitest run --project=integration` with supabase.co URL → exit 1, "Refusing..." error
- `pnpm exec vitest run --project=unit` → 5 files / 101 assertions passed
- `pnpm typecheck` → exit 0

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-04-24*
