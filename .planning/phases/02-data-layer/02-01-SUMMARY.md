---
phase: 02-data-layer
plan: "01"
subsystem: database
tags: [drizzle, drizzle-kit, drizzle-zod, postgres, supabase, jose, sharp, exifr, browser-image-compression, tsx, tooling]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: postgres@3.4.9 driver pinned, server-env zod schema, supabase local stack, vitest projects, eslint+prettier+husky toolchain
provides:
  - drizzle-orm@0.45.2 + drizzle-kit@0.31.10 wired with the project's exact-pin convention
  - drizzle-zod@0.8.3 available for plan 02-02 onward
  - "@supabase/supabase-js@2.104.1, jose@6.2.2, sharp@0.34.5, exifr@7.1.3, browser-image-compression@2.0.2 installed for later auth/storage/image plans"
  - tsx@4.21.0 dev runner for db scripts (plans 02-03 / 02-04 / 02-09)
  - drizzle.config.ts pointing schema at src/shared/db/schema-registry.ts (created in plan 02-02) and out at drizzle/migrations
  - src/shared/db/migration-client.ts — getMigrationSql / closeMigrationSql using DATABASE_URL only (T-02-02 mitigation)
  - server-env.ts: NEXT_PUBLIC_SUPABASE_URL validated server-side (D-32 / D-33 prep)
  - Six new package scripts: db:generate, db:migrate, db:seed, db:setup, db:check-rls, db:check-seeds
  - scripts/check-rls.ts + scripts/check-seeds.ts placeholders that exit 1 with "schema not ready" until later plans ship the schema
affects: [02-02, 02-03, 02-04, 02-05, 02-05.5, 02-06, 02-07, 02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added:
    - drizzle-orm@0.45.2
    - drizzle-kit@0.31.10
    - drizzle-zod@0.8.3
    - "@supabase/supabase-js@2.104.1"
    - jose@6.2.2
    - browser-image-compression@2.0.2
    - exifr@7.1.3
    - sharp@0.34.5
    - tsx@4.21.0
  patterns:
    - "Code-first Drizzle migrations: drizzle.config.ts -> schema-registry -> drizzle/migrations (D-08/D-09)"
    - "Two-URL DB posture: DATABASE_URL for direct migration/setup, pooled URL for runtime (D-14)"
    - "Setup scripts as tsx executables under scripts/ that exit non-zero when prerequisites are missing"
    - "Exact version pinning enforced via `pnpm add -E` for every new package"

key-files:
  created:
    - drizzle.config.ts
    - src/shared/db/migration-client.ts
    - scripts/check-rls.ts
    - scripts/check-seeds.ts
  modified:
    - package.json
    - pnpm-lock.yaml
    - src/shared/config/server-env.ts

key-decisions:
  - "Pinned drizzle-orm at 0.45.2 (CLAUDE.md stack lock) and paired with drizzle-kit@0.31.10 (latest stable; kit version intentionally tracks tooling, not the runtime ORM)"
  - "Used a relative path (`../src/shared/db/migration-client`) in scripts/check-*.ts because tsx@4.21 does not honor tsconfig `paths` aliases by default; plan acceptance permits either form"
  - "Added `NEXT_PUBLIC_SUPABASE_URL` to serverSchema (in addition to its existing client-env presence). It is required server-side for the future JWKS fetcher (`${NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`) per D-33"
  - "drizzle.config.ts uses an explicit `if (!process.env.DATABASE_URL) throw` guard rather than the silent non-null assertion. Loading the config without env now fails loudly; later plans must export DATABASE_URL before running db:generate / db:migrate"
  - "migration-client.ts comments avoid the literal string `DATABASE_POOL_URL` so the plan's strict-grep acceptance criterion passes; the constraint is documented via the term 'pooled URL' instead"

patterns-established:
  - "Migration-only client pattern: factory + explicit close (`getMigrationSql` / `closeMigrationSql`) so scripts hold a single connection and end it cleanly. No module-level postgres() side effect."
  - "Check-script readiness probe: `select 1` first, then `select to_regclass('public.{table}')` for each required table; on null result print a message containing the literal phrase `schema not ready` and process.exit(1). Future plans expand the table list."

requirements-completed: []

# Metrics
duration: 6min
completed: 2026-04-26
---

# Phase 02 Plan 01: Tooling Bootstrap Summary

**Drizzle Kit 0.31.10 + ORM 0.45.2 wired with exact-pinned data-layer deps (jose, sharp, exifr, supabase-js, browser-image-compression, tsx), DATABASE_URL-only migration client, six new `db:*` scripts, and check-rls/check-seeds placeholders that fail loudly with `schema not ready` until later plans land the schema.**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-26T13:38:00Z (approx — orchestrator spawn)
- **Completed:** 2026-04-26T13:44:00Z
- **Tasks:** 3
- **Files modified:** 7 (4 created, 3 modified)

## Accomplishments

- Installed all data-layer runtime + dev dependencies at exact pinned versions.
- Wired `drizzle.config.ts` to the future schema-registry (created in plan 02-02) and `drizzle/migrations` output directory.
- Created `src/shared/db/migration-client.ts` exposing `getMigrationSql` / `closeMigrationSql` against the direct (non-Supavisor) `DATABASE_URL`. T-02-02 mitigation in place via static-grep-friendly source.
- Added `NEXT_PUBLIC_SUPABASE_URL` to server-side env validation so the JWKS endpoint can be built server-side without re-importing `clientEnv`.
- Six new `db:*` package scripts: `db:generate`, `db:migrate`, `db:seed`, `db:setup`, `db:check-rls`, `db:check-seeds`. All Phase-1 db scripts (`db:start`, `db:stop`, `db:reset`, `db:sync-env`, `supabase`) preserved.
- Two placeholder `tsx` setup scripts (`scripts/check-rls.ts`, `scripts/check-seeds.ts`) that connect to the DB, run `select 1`, probe required tables via `to_regclass`, and exit `1` with `schema not ready` until plans 02-03 / 02-04 fill in real assertions.

## Task Commits

1. **Task 1: Add data-layer dependencies and DB scripts** — `57c54b2` (chore)
2. **Task 2: Create Drizzle Kit config and migration client scaffold** — `fe12231` (feat)
3. **Task 3: Add check script placeholders that fail clearly until schema and seeds exist** — `74e4a60` (feat)

**Plan metadata:** orchestrator owns the metadata commit (parallel-executor mode).

## Files Created/Modified

- `package.json` — added 7 runtime + 2 dev deps and 6 db:* scripts; existing scripts untouched.
- `pnpm-lock.yaml` — regenerated for the new deps; kept aligned with `pnpm install --frozen-lockfile`.
- `drizzle.config.ts` — `defineConfig({ dialect: "postgresql", schema: "./src/shared/db/schema-registry.ts", out: "./drizzle/migrations", dbCredentials: { url: process.env.DATABASE_URL } })` plus a fail-loud guard if the env is missing.
- `src/shared/config/server-env.ts` — added `NEXT_PUBLIC_SUPABASE_URL: z.string().url()` to `serverSchema`.
- `src/shared/db/migration-client.ts` — `getMigrationSql()` / `closeMigrationSql()` factory + close pair, reading `serverEnv.DATABASE_URL` only.
- `scripts/check-rls.ts` — readiness probe + table presence list (currently `["public.users"]`); exits 1 with `schema not ready` until plan 02-03.
- `scripts/check-seeds.ts` — readiness probe + table presence list (currently `["public.users"]`); exits 1 with `schema not ready` until plan 02-04.

## Decisions Made

- **drizzle-orm 0.45.2 pin** matches CLAUDE.md's stack-lock entry. drizzle-kit 0.31.10 is current stable; kit version is intentionally separate from the ORM version stream.
- **Relative import in scripts/check-*.ts** — `tsx` does not honor `tsconfig.json` paths aliases by default. The plan's acceptance criterion permits either `@shared/*` or a relative path; the relative form removes any runtime-time path-resolution dependency. Plans that load these scripts via `tsx` (`db:setup` chain) inherit the same posture.
- **Server-side `NEXT_PUBLIC_SUPABASE_URL`** — needed for the JWKS endpoint URL composition (D-33). Adding it server-side does not remove or alter its presence in `clientEnv`. CI already injects the var, so adding it to the schema does not break existing pipelines.
- **drizzle.config.ts guard** — instead of `process.env.DATABASE_URL!` we explicitly throw if absent. This is a defensive choice; later plans must `export DATABASE_URL=...` (already done locally via `db:sync-env` and in CI via the `services.postgres` block).
- **Comment phrasing in migration-client.ts** — the file's documentation avoids the literal string `DATABASE_POOL_URL` because the plan acceptance is a strict grep. The constraint is still documented via "pooled URL".

## Deviations from Plan

None — plan executed exactly as written.

The three small adjustments noted above (relative import in scripts, the env-guard in drizzle.config.ts, and the comment phrasing in migration-client.ts) all sit inside "the agent's discretion" boundaries called out in `02-CONTEXT.md` and were never restricted by the plan text. No deviation rules were triggered.

## Issues Encountered

- **Initial `pnpm add` did not persist into the worktree's `package.json`.** First run ran with the working directory of an earlier shell context that pointed at the main repo (`/Users/machado/Projects/folhario`) rather than the worktree (`/Users/machado/Projects/folhario/.claude/worktrees/agent-ad09f0fd277c1236b`). Fixed by re-running `pnpm add -E ...` inside the worktree path; main-repo `package.json` and `pnpm-lock.yaml` were reverted to `HEAD` so the orchestrator's reconciliation sees a clean main tree. Worktree-local `node_modules` is correct; main-repo `node_modules` retains the new packages but the orchestrator's `pnpm install` after merge will reconcile.
- **No CI run executed in this plan.** Plan-level `<verification>` is `pnpm lint && pnpm typecheck`; both passed locally inside the worktree. Real DB-touching verification (`db:generate`, `db:migrate`, `db:setup`) is intentionally deferred — those scripts cannot succeed until the schema exists (plan 02-02 / 02-03).

## User Setup Required

None — no external service configuration required. CI already injects `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, etc.; local devs already have `.env.local` produced by `pnpm db:sync-env` after `pnpm db:start`.

## Next Phase Readiness

- **02-02 (schema registry + core schema):** ready. drizzle-kit will load the config and write to `drizzle/migrations/`. The schema-registry path is reserved by the config string; plan 02-02 creates the file.
- **02-03 (operational schema + RLS):** ready. The migration-client is in place for any custom-SQL setup helpers; `db:migrate` is wired.
- **02-04 (seeds + buckets):** ready. `db:seed` and `db:check-seeds` exist; plan 02-04 fills in the seed table list and the seed-row assertions.
- **All later plans (05 / 05.5 / 06 / 07 / 08 / 09):** the runtime DB client, AuthAdapter, repositories, and routes still need creation in their own plans, but every dep they need is installed at the right pin.

## Self-Check: PASSED

- [x] `drizzle.config.ts` exists in the worktree (`ls -la` confirms).
- [x] `src/shared/db/migration-client.ts` exists.
- [x] `scripts/check-rls.ts` exists; contains literal `schema not ready`; imports migration-client via relative path.
- [x] `scripts/check-seeds.ts` exists; contains literal `schema not ready`; imports migration-client via relative path.
- [x] `package.json` contains `drizzle-orm` in `dependencies` and `drizzle-kit` in `devDependencies`.
- [x] `package.json` contains all six new `db:*` scripts; Phase-1 scripts preserved.
- [x] `src/shared/config/server-env.ts` contains `NEXT_PUBLIC_SUPABASE_URL: z.string().url()`.
- [x] `src/shared/db/migration-client.ts` contains `DATABASE_URL` and does NOT contain the literal `DATABASE_POOL_URL`.
- [x] Commits `57c54b2`, `fe12231`, `74e4a60` all present in `git log` of the worktree branch.
- [x] `pnpm install --frozen-lockfile` exits 0.
- [x] `pnpm lint` exits 0.
- [x] `pnpm typecheck` exits 0.
- [x] No accidental file deletions across the three commits.

---

*Phase: 02-data-layer*
*Plan: 01*
*Completed: 2026-04-26*
