# Phase 02 Deferred Items

## Pre-existing failures (out of scope per executor scope-boundary rule)

### `tests/integration/unit-of-work.integration.test.ts` fails when env lacks `NEXT_PUBLIC_SUPABASE_URL`

- **Discovered during:** Plan 02-05.5 execution
- **Symptom:** `ZodError: NEXT_PUBLIC_SUPABASE_URL: Invalid input: expected string, received undefined` — thrown at `src/shared/config/server-env.ts:19` when `@shared/db/client` is imported.
- **Root cause:** `scripts/sync-supabase-env.sh` does not produce `NEXT_PUBLIC_SUPABASE_URL` when `[api] enabled = false` in `supabase/config.toml` (Plan 02-04 disabled the API but the env-sync script's `--override-name api.url=NEXT_PUBLIC_SUPABASE_URL` flag silently produces nothing). The unit-of-work integration test loads the schema via `@shared/db/client` which evaluates `serverEnv` at module scope.
- **Why pre-existing:** Reproducible at HEAD = `63449e2` (the merge-base of this worktree, BEFORE Plan 02-05.5 changes). NOT caused by Plan 05.5.
- **Why out of scope for 05.5:** Plan 05.5's single-file ownership is `tests/integration/rls-real-jwt.integration.test.ts`. Modifying `scripts/sync-supabase-env.sh` or `tests/integration/setup-*.ts` would violate parallel-execution isolation.
- **Suggested fix paths (any of):**
  1. Add `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` synthesis to `scripts/sync-supabase-env.sh` when `[api] enabled = false`.
  2. Add `tests/integration/setup-env.ts` (mirroring `tests/unit/setup-env.ts`) that sets the default and wire it into `vitest.config.ts` integration project.
  3. Apply the inline `process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321"` pattern directly in `tests/integration/unit-of-work.integration.test.ts` (matches `diagnostics-server-probe.integration.test.ts` and Plan 05.5's own `rls-real-jwt.integration.test.ts`).
- **Dispostion:** Pick up in Plan 02-06 / 02-07 / 02-10 (whichever next plan owns integration-test infra) OR a dedicated micro-plan if 02-10's CI reconciliation surfaces this as a blocker.
