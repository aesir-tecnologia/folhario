# Phase 03 — Deferred Items

Tracks pre-existing issues discovered during Plan 03-05 execution that are
out-of-scope per the SCOPE BOUNDARY rule (Plan 05 only ships E2E test specs +
visual baselines; pre-existing failures in Plan 02/03/04 files are NOT auto-fixed
by Plan 05).

## Pre-existing lint errors (4) — discovered Plan 03-05 Task 1

Source: `pnpm lint` against base commit `bbd0335` (Plan 03-04 merge).

### `tests/unit/heartbeat-route-contract.test.ts`

- **Lines 38–41:** `@typescript-eslint/no-explicit-any — Unexpected any. Specify a different type` (4 errors)
- **Origin:** Plan 02-02 commit `79bd4a3 test(03-02): add failing contract test for /api/v1/health/connectivity heartbeat`
- **Owner:** Plan 02 (heartbeat unit-DOM contract test)
- **Plan 03-05 impact:** Task 3's plan-prescribed `pnpm lint` verification gate will fail until these are addressed in a follow-up.

## Pre-existing lint warnings (57) — discovered Plan 03-05 Task 1

Source: `pnpm lint` against base commit `bbd0335` (Plan 03-04 merge).

Files affected (better-tailwindcss + import/no-anonymous-default-export):

- `src/app/(app)/app-shell.tsx`
- `src/app/(test)/modal-sheet/harness.tsx`
- `src/app/offline/offline-fallback.tsx`
- `src/shared/ui/bottom-nav.tsx`
- `src/shared/ui/capture-button.tsx`
- `src/shared/ui/empty-state.tsx`
- `src/shared/ui/inline-error.tsx`
- `src/shared/ui/modal-sheet.tsx`
- `src/shared/ui/read-only-banner.tsx`
- `src/shared/ui/select.tsx`
- `src/shared/ui/toggle.tsx`
- `stylelint.config.mjs` (import/no-anonymous-default-export)

Most are auto-fixable via `pnpm lint --fix` (better-tailwindcss canonical-class
+ line-wrapping rules). They originate in Plans 03-03 and 03-04 — fix in their
owning plan or in a Phase 3 cleanup pass.

## Action for orchestrator / Task 3 continuation agent

Plan 03-05 Task 3 is gated behind the human-action Docker baseline checkpoint
(Task 2). Before resuming Task 3, the continuation agent SHOULD address these
pre-existing items (e.g., `pnpm lint --fix` for the warnings + an explicit
type for the heartbeat-route-contract.test.ts assertions) so the Plan 05 Task 3
verification gate (`pnpm typecheck && pnpm lint && pnpm lint:styles && pnpm
test:unit && pnpm test:integration && pnpm test:e2e`) can pass.

These were NOT fixed by Plan 03-05 Task 1 because:

1. They are pre-existing — present at the worktree base commit (`bbd0335`)
2. They are in files unrelated to Plan 05's task (E2E spec authoring)
3. Plan 05 Task 1's verification is `pnpm typecheck && pnpm lint`, scoped per
   spec to "specs syntactically valid" — `pnpm typecheck` passes 0; the new
   E2E spec files emit ZERO new lint problems
