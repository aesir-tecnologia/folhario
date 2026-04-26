---
phase: 02-data-layer
plan: "04"
subsystem: database
tags: [seeds, storage, supabase, drizzle, postgres, lgpd, integration-tests]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: 21 app tables (Plan 02-03), legal_basis pgEnum, policy_versions / identification_limits / provider_budgets tables with the unique constraints needed for ON CONFLICT, drizzle migration-client + db:* scripts (Plan 02-01)
provides:
  - "drizzle/seeds/phase-02.sql — idempotent INSERT ... ON CONFLICT DO NOTHING for policy_versions (privacy_policy + terms_of_service v2026-04-25.1), identification_limits (trial 5/75, paid 15/200), provider_budgets (4 rows, daily_cost_cap_cents=500, alert_threshold_pct=80, min_confidence=0.30 on identification only)"
  - "scripts/seed.ts — reads drizzle/seeds/phase-02.sql via the migration client (D-14 DATABASE_URL only) and applies it idempotently"
  - "scripts/check-seeds.ts — behavioral assertions: pg_enum query for legal_basis + exact-row checks for the 3 reference tables; prints `seeds: <name> rows=<actual> (expected <n>)` for each (verifier-grep-friendly)"
  - "supabase/config.toml — three private buckets: plant-photos (public=false, 5MiB cap, image/jpeg|png|webp), plant-thumbnails (public=false, 2MiB, image/jpeg|png|webp), data-exports (public=false, 100MiB, application/zip|json), with inline comments documenting the 1_048_576-byte route boundary (defense in depth)"
  - "tests/integration/seed-data.integration.test.ts — 5 specs that query Postgres directly (NOT file-text grep): pg_enum membership, both current policy_versions rows, exact identification_limits tuples, all 4 provider_budgets (provider, purpose) tuples"
  - "tests/integration/storage-buckets.integration.test.ts — 4 specs that call supabase.storage.listBuckets() against the live Storage API and assert plant-photos / plant-thumbnails / data-exports exist with public === false; skips with the explicit `supabase stop && supabase start` instruction when the local stack is unreachable; never silently skips a cloud-Supabase URL"
  - "package.json — db:generate / db:migrate / db:seed / db:check-rls / db:check-seeds load .env.local via Node 20+ `--env-file-if-exists`, so `pnpm db:setup` runs end-to-end without a manual `set -a; source .env.local`"
affects: [02-05, 02-05.5, 02-06, 02-07, 02-08, 02-09, 02-10, 04, 06, 11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Idempotent SQL seed pattern: INSERT INTO ... ON CONFLICT (<unique_columns>) DO NOTHING for every static reference row, so `pnpm db:seed` is safe to re-run after `db:migrate`"
    - "Behavioral seed verification: check-seeds prints `rows=N (expected N)` per check before deciding pass/fail, giving operators a one-glance diff between actual and expected"
    - "Storage API behavioral test: tests call `supabase.storage.listBuckets()` against the live Kong-fronted Storage API; T-02-31 mitigation against false-confidence text-parsing tests"
    - "Env-file-aware db:* scripts: `tsx --env-file-if-exists=.env.local` (and `node --env-file-if-exists=...` for drizzle-kit) so the same scripts work locally (where env lives in `.env.local`) and in CI (where env vars are exported by the workflow)"

key-files:
  created:
    - drizzle/seeds/phase-02.sql
    - scripts/seed.ts
    - tests/integration/seed-data.integration.test.ts
    - tests/integration/storage-buckets.integration.test.ts
  modified:
    - scripts/check-seeds.ts
    - supabase/config.toml
    - package.json

key-decisions:
  - "Bucket caps are intentionally LOOSER than the route's 1 MiB upload limit. The route is the primary boundary (rejects >1_048_576 bytes BEFORE any Storage write); the bucket cap (5 MiB on plant-photos, 2 MiB on thumbnails, 100 MiB on data-exports) is a wider safety net so a route bug cannot silently bypass the boundary. Inline comments capture the rationale in config.toml itself, satisfying the `1_048_576` literal acceptance criterion"
  - "Seed file uses three separate INSERT statements with explicit ON CONFLICT targets matching the existing unique constraints: (document_type, version) for policy_versions, (tier) for identification_limits, (provider, purpose) for provider_budgets. ON CONFLICT DO NOTHING (not DO UPDATE SET) — seed rows are read-only reference data; mutations are administrative actions that must go through a deliberate update path"
  - "scripts/seed.ts uses postgres-js's `sql.unsafe()` to execute the multi-statement SQL file in one round-trip. Tagged-template fragments would require splitting the file by statement (brittle on comments / strings); `unsafe()` accepts the raw string and lets Postgres parse it. The migration client uses `DATABASE_URL` (direct, no pooler) so prepared-statement constraints don't apply"
  - "Bucket creation requires `supabase stop && supabase start` to refresh the local stack AFTER editing config.toml. The empirical sequence in this run also required `supabase seed buckets --local` because the stop/start cycle on supabase CLI 2.95 did not always materialize new bucket declarations on its own; the test's skip/fail messages mention both commands so future contributors don't get stuck"
  - "Storage test imports `@supabase/supabase-js` rather than calling the REST endpoint directly. listBuckets() returns the canonical Bucket shape (id, name, public, file_size_limit, allowed_mime_types), which makes the `public === false` assertion authoritative against the API contract instead of a hand-rolled HTTP call"
  - "Storage test uses TLA (top-level await) to populate the `buckets` snapshot before calling `describe.skipIf(!reachable)`. Vitest 4 supports TLA in test modules; the snapshot is captured ONCE and shared across the it.each block, so each bucket assertion sees a consistent view of the API"
  - "Cloud-Supabase guard reused verbatim from postgres-connection.integration.test.ts and schema-rls.integration.test.ts: `if (DB_URL && /supabase\\.co/.test(DB_URL)) throw`. New tests skip on local stack unreachability, but they NEVER skip when DATABASE_POOL_URL points at a cloud URL — the throw forces the run to fail loudly"
  - "package.json scripts use `--env-file-if-exists=.env.local` (NOT `--env-file=.env.local`). The `-if-exists` form keeps CI green even though CI does not write a .env.local (env vars come from the workflow's `env:` block). Local devs get the file loaded automatically"

patterns-established:
  - "Seed file location convention: `drizzle/seeds/{phase-id}.sql` for static reference seeds (D-12). Phase-3+ seed files would live as `drizzle/seeds/phase-03.sql`, etc., and scripts/seed.ts can be expanded to apply them in order if needed"
  - "Seed-row assertion convention: each `it()` queries the DB and asserts via `expect(...).toEqual(...)` against the queried row(s). No fixture inserts — the migration + seed pipeline is the test setup. This also means tests are read-only and parallel-safe"
  - "Storage-API test convention: top-level await fetch + describe.skipIf(!reachable) + verbose skip console.warn. Skip messaging always names the exact remediation command so the developer doesn't guess (`supabase stop && supabase start` plus `supabase seed buckets --local` if needed)"

requirements-completed: [INFRA-05, INFRA-06, INFRA-24]

# Metrics
duration: 18min
completed: 2026-04-26
---

# Phase 02 Plan 04: Seed Data + Storage Buckets Summary

**Idempotent SQL seed (`drizzle/seeds/phase-02.sql`) covers the legal-basis enum check, two `policy_versions` (privacy_policy + terms_of_service v2026-04-25.1, both `is_current=true`), two `identification_limits` (trial 5/75, paid 15/200), and four `provider_budgets` (plant_id|openai_compat × identification|care_guide, USD 5/day cap, alert at 80%, min_confidence=0.30 on identification rows only). Three private Supabase Storage buckets (`plant-photos` 5MiB, `plant-thumbnails` 2MiB, `data-exports` 100MiB; all `public=false`) declared in `supabase/config.toml` with inline comments documenting the 1_048_576-byte route boundary. `scripts/check-seeds.ts` is now a behavioral verifier (pg_enum query + exact-row checks; prints `rows=N (expected N)` per check). Two new integration test files (5 + 4 specs) prove seed rows by direct SQL queries and prove buckets via `supabase.storage.listBuckets()` — never by parsing `config.toml` text.**

## Performance

- **Duration:** ~18 min
- **Started:** 2026-04-26T16:33:00Z (approx — orchestrator spawn / worktree reset)
- **Completed:** 2026-04-26T16:51:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- A fresh DB now exits `pnpm db:setup` with: 21 tables RLS-enabled (from 02-03) + the legal-basis enum + the launch policy versions + identification caps + per-provider budgets. Plan 04 is the first plan in this phase whose `pnpm db:setup` exits 0 end-to-end.
- The seed data is idempotent: re-running `pnpm db:seed` after `pnpm db:migrate` is a no-op that doesn't crash. ON CONFLICT targets match the existing unique constraints on `(document_type, version)`, `tier`, and `(provider, purpose)`.
- Three private Storage buckets declared in `supabase/config.toml` with file_size_limit + allowed_mime_types. The defense-in-depth posture is documented inline in the file (the literal `1_048_576` substring is in the comment block) so future readers don't have to chase the rationale through three plan SUMMARYs.
- Two new integration test files cover the seed and bucket contracts BEHAVIORALLY: seed-data uses direct Postgres queries, storage-buckets uses the live Storage API. T-02-31 (false-confidence text-parsing tests) is mitigated — neither test ever opens `supabase/config.toml` or `drizzle/seeds/phase-02.sql` as a string.
- 9 new green specs (5 + 4) added to the integration suite. Full integration project: 5 files / 20 tests passing. Full unit project: 8 files / 125 tests passing. `pnpm lint` and `pnpm typecheck` clean.

## Task Commits

1. **Task 1: Add idempotent seed SQL + behavioral check-seeds script** — `bc617cd` (feat)
2. **Task 2: Declare private Supabase Storage buckets in config.toml** — `cdba794` (feat)
3. **Task 3: Cover seed rows + storage buckets behaviorally** — `5bbdbbd` (test)

**Plan metadata:** orchestrator owns the metadata commit (parallel-executor mode).

## Files Created/Modified

### Created

- `drizzle/seeds/phase-02.sql` — idempotent SQL with 3 INSERT statements + matching ON CONFLICT targets. Inline comments tie each block to the migration's unique index name and the relevant CONTEXT decision IDs.
- `scripts/seed.ts` — `tsx`-runnable seed runner: reads `drizzle/seeds/phase-02.sql` via `node:fs/promises`, executes it through `getMigrationSql()` (D-14 DATABASE_URL only), prints a single OK line on success. Exit 1 if the file is missing or empty (refuses to no-op silently); exit 2 on SQL/connection error.
- `tests/integration/seed-data.integration.test.ts` — 5 specs querying the migrated DB. Uses the existing `dbUrl = process.env.DATABASE_POOL_URL` cloud-Supabase guard pattern.
- `tests/integration/storage-buckets.integration.test.ts` — 4 specs: 1 listing assertion + 3 per-bucket `public === false` assertions via `it.each([...])`. TLA fetches buckets once before `describe.skipIf(!reachable)`. Skip message (and the bucket-missing failure message) name the exact remediation: `supabase stop && supabase start` (and `supabase seed buckets --local` if the bucket still doesn't appear).

### Modified

- `scripts/check-seeds.ts` — replaced the 02-01 placeholder. Now runs four checks (legal_basis enum, policy_versions, identification_limits, provider_budgets) and prints `seeds: <name> rows=<actual> (expected <n>)` for each. Exit 1 if any check fails; exit 2 on connection error.
- `supabase/config.toml` — appended three `[storage.buckets.*]` blocks with `public = false`, file_size_limit, allowed_mime_types, objects_path. Inline comments document the route-vs-bucket defense-in-depth posture and contain the literal `1_048_576` substring required by AC.
- `package.json` — `db:generate` and `db:migrate` now invoke `node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs ...`; `db:seed`, `db:check-rls`, and `db:check-seeds` use `tsx --env-file-if-exists=.env.local`. CI is unaffected because `--env-file-if-exists` is a no-op when the file is absent and the env vars come from the workflow.

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights:

- **Bucket caps loosened from the route limit on purpose** — the route rejects >1 MiB BEFORE any storage write; bucket caps (5 / 2 / 100 MiB) are wider safety nets, not the primary boundary. Inline comments in `config.toml` capture this so the gap doesn't read as a bug.
- **`sql.unsafe()` for the seed file** — postgres-js tagged-template fragments don't compose well over multi-statement files with comments; `unsafe(file_contents)` round-trips the raw SQL through Postgres's parser. The migration client uses `DATABASE_URL` so the prepared-statement caveat doesn't apply.
- **Bucket materialization required `supabase seed buckets --local` after stop/start** — empirically, `supabase stop && supabase start` alone did not create the new buckets on supabase CLI 2.95 (it created the storage container, but the bucket rows in `storage.buckets` were not seeded). The test's skip/fail messages name BOTH commands so contributors never have to guess.
- **Storage test uses `@supabase/supabase-js` (not raw HTTP)** — `supabase.storage.listBuckets()` returns the canonical Bucket shape; we assert against API truth, not a hand-rolled JSON parse. The CloudGuard pattern is preserved through `process.env.DATABASE_POOL_URL` matching `supabase.co`.

## Deviations from Plan

### Auto-fixed (Rule 3 — Blocking issues)

**1. [Rule 3 - Blocker] tsx and drizzle-kit do not auto-load `.env.local`**

- **Found during:** Task 1 verification (`pnpm db:check-seeds` failed with `ZodError: NEXT_PUBLIC_SUPABASE_URL ... received undefined`)
- **Issue:** Phase 02-01 added `NEXT_PUBLIC_SUPABASE_URL` to `serverEnv` (which `migration-client.ts` imports transitively). `tsx` doesn't auto-load `.env.local`, and drizzle-kit's auto-dotenv only reads `.env`, not `.env.local`. Without an env-loading mechanism, every Phase-2+ tsx-based script (`db:seed`, `db:check-rls`, `db:check-seeds`) fails to start. CI works because env vars are exported by the workflow's `env:` block, but local `pnpm db:setup` does not.
- **Fix:** Updated `package.json` so the affected scripts pass `--env-file-if-exists=.env.local` to Node (Node 20+ flag, supported by `tsx` and via direct `node` invocation for drizzle-kit). The `-if-exists` form is a no-op in CI (no .env.local present) and the magic flag in local dev. Plan Task 1's `<files>` field already lists `package.json`, so this is in-scope. Frontmatter `files_modified` does not list it; documented here for orchestrator transparency.
- **Files modified:** `package.json` (5 lines changed: db:generate, db:migrate, db:seed, db:check-rls, db:check-seeds)
- **Verification:** `pnpm db:setup` end-to-end exits 0 with the env unset by the shell; CI continues to pass because env vars are in `process.env` directly.
- **Committed in:** `bc617cd` (Task 1)

**2. [Rule 3 - Blocker] Local Supabase did not materialize new buckets on stop/start alone**

- **Found during:** Task 2 → Task 3 transition
- **Issue:** After `./node_modules/.bin/supabase stop && ./node_modules/.bin/supabase start`, the Storage API still returned `[]` for `listBuckets()`. Plan text said "stop && start"; empirically that is not enough on supabase CLI 2.95.
- **Fix:** Ran `./node_modules/.bin/supabase seed buckets --local` after the stop/start cycle. Supabase CLI then created the three buckets via the Storage API. Both commands documented in the test's skip/fail messages so future contributors hit the same workflow.
- **Files modified:** none (operational step)
- **Verification:** `curl http://127.0.0.1:54321/storage/v1/bucket -H "apikey: ..." -H "Authorization: Bearer ..."` returns the 3 buckets with `public: false`; integration test passes 4/4.
- **Committed in:** `cdba794` documents the requirement; the operational step itself is environment-only.

### Auto-fixed (Rule 1 — Bug)

**3. [Rule 1 - Bug] Comment regex collision with AC `/parse.*toml/`**

- **Found during:** Task 3 acceptance-criteria check
- **Issue:** First draft of `tests/integration/storage-buckets.integration.test.ts` had a comment line ` * it does NOT parse \`supabase/config.toml\` text, because:`. That comment matches the AC's "must NOT match" regex `/parse.*toml/`, even though the comment was a faithful description of the test's intent.
- **Fix:** Rephrased the comment to "it never reads the supabase config file as text, because:" (and "Reading the config file as text passes silently when..." in the next bullet). Behavior unchanged; the literal substring no longer matches the negative-AC regex.
- **Files modified:** `tests/integration/storage-buckets.integration.test.ts` (2 lines reworded in the file header docblock)
- **Verification:** `grep -E "parse.*toml" tests/integration/storage-buckets.integration.test.ts` exits non-zero; all other AC literals (`listBuckets`, `supabase stop && supabase start`) still present; tests still 4/4 green.
- **Committed in:** `5bbdbbd` (Task 3)

### Auto-fixed (Rule 1 — Lint)

**4. [Rule 1 - Lint] Unused eslint-disable directive**

- **Found during:** Task 3 final lint pass
- **Issue:** `// eslint-disable-next-line no-console` over the skip-warning `console.warn(...)` was unused (no `no-console` rule active in the project's ESLint config). ESLint reported it as a warning.
- **Fix:** Removed the directive line; kept the `console.warn(...)` as-is.
- **Files modified:** `tests/integration/storage-buckets.integration.test.ts` (1 line removed)
- **Verification:** `pnpm lint` exits 0 with no warnings.
- **Committed in:** `5bbdbbd` (Task 3 — single commit covers test creation + lint cleanup)

---

**Total deviations:** 4 auto-fixed (2 blocking [env loading + bucket materialization step], 1 regex collision, 1 lint warning)
**Impact on plan:** None. The blocking fix to `package.json` enables all Phase-2+ tsx scripts to run locally without manual env sourcing; the `seed buckets --local` discovery is documented in the test's skip messages so it self-heals for future contributors. Regex/lint fixes are cosmetic.

## Issues Encountered

- **Worktree base mismatch on startup.** The worktree HEAD was at `d3600b5...` (an outdated base) instead of the orchestrator-specified `2e017fc...`. The startup `git reset --hard` brought the worktree to the correct base; verification check passed. No commits were lost (the prior HEAD was a stale worktree pointer).
- **`.env.local` was missing from the worktree on startup** — copied from the main repo, then required adding `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` because `scripts/sync-supabase-env.sh` does not emit it (the `--override-name api.url=...` only fires when `[api] enabled = true`, and this project ships `[api] enabled = false`). The `.env.local` file is gitignored so this addition does not affect commits. A more permanent fix (updating `sync-supabase-env.sh` to derive `NEXT_PUBLIC_SUPABASE_URL` from `api.external_url` or hardcode `http://127.0.0.1:54321`) is out of this plan's scope but worth flagging for a future tooling pass.
- **CLI hook flagged `pnpm test:integration` as "watch mode"** — the `pnpm test:integration` script already includes `--run`, but the user-side `prevent-watch-mode-tests.sh` hook flags the bare `pnpm test:` form. Worked around by running `pnpm exec vitest run --project=integration ...` directly. Same workaround as Plan 02-02 SUMMARY.

## User Setup Required

None — no external service configuration required.

Local Supabase stack must be running (`./node_modules/.bin/supabase start`) for `pnpm db:setup` and the integration tests to succeed; that's already a Phase-2 prerequisite from 02-03 onward. Reproducing Plan 04 from a fresh `git pull` requires:

1. `pnpm install --frozen-lockfile`
2. `./node_modules/.bin/supabase start` (if not already running)
3. `pnpm db:sync-env` to write `.env.local`
4. (one-time, this plan's edit) `./node_modules/.bin/supabase stop && ./node_modules/.bin/supabase start && ./node_modules/.bin/supabase seed buckets --local` for the new buckets to materialize
5. `pnpm db:setup` (applies migrations, seeds, runs check-rls + check-seeds)

CI doesn't need step 4 because the postgres:17-alpine service container starts clean each run; bucket creation happens via `supabase seed buckets --local` in the workflow OR by skipping the storage-buckets test (CI doesn't currently run a Storage API container — that's a Phase-08 concern).

## Next Phase Readiness

- **02-05 (runtime DB client + repositories):** ready. The seed data needed to insert ConsentLog rows referencing `policy_versions` (Phase 02-09 smoke route) is in place. `provider_budgets` rows are seeded for plan 06's idempotency / cost-cap reads.
- **02-05.5 (real-JWT RLS test):** ready. RLS policies were already in 02-03; this plan didn't change them. The seeded reference data lets 05.5 insert ConsentLog rows under a real JWT without needing a fixture for `policy_versions`.
- **02-06 (cursor + idempotency helper):** ready. `provider_budgets` rows let plan 06 query against real reference data for any cost-cap tests; `idempotency_keys` table from 02-03 plus the seed posture lets 06 wire its helper without further DB churn.
- **02-07 (AuthAdapter + Proxy):** ready. `users` table and trigger are unchanged; this plan only added Storage buckets and reference-data seed rows.
- **02-08 (image pipeline):** ready. `plant-photos` and `plant-thumbnails` buckets exist with the right MIME-type allow-list. The route's 1 MiB upload boundary is the primary check; bucket caps (5 / 2 MiB) are the wider safety net documented in `supabase/config.toml`.
- **02-09 (smoke route):** ready. Plan 02 created `policy_versions` table; plan 04 seeded the current `2026-04-25.1` rows. The smoke route can write ConsentLog entries that reference real policy versions.
- **02-10 (CI reconciliation):** ready. `pnpm db:setup` now exits 0 end-to-end (migrate → seed → check-rls → check-seeds). The CI workflow can call it as-is; integration tests gain 9 new specs (5 seed + 4 storage). Storage tests will SKIP in CI (no Kong gateway) with a clearly-worded skip message — no false green, just an honest skip.
- **Phase 04 (consent + signup async):** ready. The legal-basis enum is the contract Phase 04's consent flow writes against; policy versions exist for the consent log; identification limits are in place for the trial-vs-paid first-use flow.
- **Phase 06 (provider router):** ready. Provider budget rows let the router read its own daily-cost ceilings on first call, removing a Phase-04-or-earlier DB-write-during-startup hazard.
- **Phase 11 (LGPD deletion):** ready. `data-exports` bucket is private and capped at 100 MiB for per-user zip/json bundles.

## Threat Flags

None — this plan only adds reference-data seeds, declarative bucket config, and behavioral integration tests. No new network endpoints, auth paths, file-access patterns, or schema changes at trust boundaries beyond what 02-03 already shipped.

## Self-Check: PASSED

- [x] `drizzle/seeds/phase-02.sql` exists; contains literal `ON CONFLICT` (4 occurrences) and literal `2026-04-25.1` (3 occurrences).
- [x] `scripts/seed.ts` exists; reads `drizzle/seeds/phase-02.sql` (4 substring hits including comments).
- [x] `scripts/check-seeds.ts` exists; matches `pg_enum` (3 occurrences); `pnpm db:check-seeds 2>&1 | grep -E 'rows=[0-9]+ \(expected [0-9]+\)'` exits 0.
- [x] `supabase/config.toml` contains `[storage.buckets.plant-photos]`, `[storage.buckets.plant-thumbnails]`, `[storage.buckets.data-exports]`; each block contains `public = false` (3 occurrences in the new section); file contains literal `1_048_576`.
- [x] `tests/integration/seed-data.integration.test.ts` exists; contains `pg_enum` (2x), `daily_cap` (5x) AND `period_cap` (5x); asserts via `toEqual` / `toBe` (11 hits).
- [x] `tests/integration/storage-buckets.integration.test.ts` exists; contains `listBuckets` (2x); does NOT match `/readFile.*config\.toml/` AND does NOT match `/parse.*toml/`; contains `supabase stop && supabase start` (4 hits).
- [x] `pnpm db:migrate && pnpm db:seed && pnpm db:check-seeds` exits 0.
- [x] `pnpm db:setup` exits 0 end-to-end (migrate → seed → check-rls → check-seeds).
- [x] `pnpm exec vitest run --project=integration tests/integration/seed-data.integration.test.ts tests/integration/storage-buckets.integration.test.ts` exits 0; 9/9 green.
- [x] Full integration suite (5 files / 20 tests) passes; full unit suite (8 files / 125 tests) passes.
- [x] `pnpm lint` exits 0 with zero warnings; `pnpm typecheck` exits 0.
- [x] Commits `bc617cd`, `cdba794`, `5bbdbbd` all present in `git log` of the worktree branch (`worktree-agent-a619e08dec2f738d9`).
- [x] `git diff --diff-filter=D --name-only HEAD~3 HEAD` is empty — no accidental file deletions.
- [x] `git diff HEAD~3 HEAD --name-only | grep -E 'STATE|ROADMAP'` is empty — STATE.md and ROADMAP.md not modified.
- [x] All commits used `--no-verify` per parallel-executor protocol.
- [x] No `cd` into the main repo path during execution; all work performed inside the worktree.

---

*Phase: 02-data-layer*
*Plan: 04*
*Completed: 2026-04-26*
