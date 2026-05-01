---
phase: 05-catalog-meu-jardim
plan: 19
subsystem: database
tags:
  - catalog
  - storage-cleanup
  - inngest
  - lgpd
  - schema-migration
  - drizzle
  - gap-closure
  - cr-01

# Dependency graph
requires:
  - phase: 05
    provides: pending_storage_deletions table + reconciler cron (plan 06), deletePhotoEntry use-case (plan 07), validateStorageObjectKey + deleteObject adapter (plan 02)
provides:
  - "pending_deletion_kind pgEnum + non-nullable kind column on pending_storage_deletions (DEFAULT 'prefix')"
  - "reconciler handler branching on row.kind: object → deleteObject, prefix → deletePrefix"
  - "deletePhotoEntry writes kind='object' rows that the reconciler can actually clean up"
  - "Cycle 3E-1 integration test: end-to-end byte deletion via deleteObject for kind='object' rows"
affects:
  - "Phase 11 LGPD bulk deletion sweep (re-uses pending_storage_deletions; the kind column adds a discriminator the bulk handler will need to honor)"
  - "Future photo-entry features that delete bytes (must continue writing kind='object'; default 'prefix' is plant-deletion only)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Discriminated cleanup queue: single pending_storage_deletions table carries both prefix (plant-wide) and object (single-file) cleanup tasks via a kind enum; reconciler branches on the discriminator."
    - "Module-private helper duplication over cross-module import: extractPlantIdFromObjectKey lives in both delete-photo-entry.ts (already private) and inngest/functions.ts because cross-module import would expose internals — explicitly preferred per plan."

key-files:
  created:
    - drizzle/migrations/0006_secret_slayback.sql
    - drizzle/migrations/meta/0006_snapshot.json
  modified:
    - src/contexts/catalog/infrastructure/db/schema.ts
    - src/contexts/catalog/application/delete-photo-entry.ts
    - src/contexts/catalog/inngest/functions.ts
    - tests/integration/cleanup-storage-reconciler.integration.test.ts
    - tests/integration/catalog-delete-photo-entry.integration.test.ts
    - drizzle/migrations/meta/_journal.json

key-decisions:
  - "Used db:generate + hand-edited migration file instead of drizzle-kit push because drizzle-kit 0.31.10 push omits the CREATE TYPE statement for new pgEnums (known bug — push tries to ALTER TABLE referencing the enum before creating it). Generated migration also missed the CREATE TYPE so the file was hand-edited (Rule 3 auto-fix). The hand-edited migration matches the existing project pattern (0004 created the original pending_deletion_status enum the same way)."
  - "Combined Task 2 (schema + use-case) and Task 4 (reconciler branch) into a single GREEN feat commit because Task 2 alone produces an intermediate non-passing state — typecheck OK but integration tests still fail until the reconciler also branches. TDD shape preserved: one test commit (RED) followed by one feat commit (GREEN). Plan explicitly aligned with this — Task 2's name has no separate commit instruction."
  - "Default value 'prefix' on the new kind column preserves all existing plant-deletion rows (deletePlant) without data migration, satisfying T-05-19-02."

patterns-established:
  - "Drizzle pgEnum + new column migration template: when drizzle-kit generate omits CREATE TYPE for a new pgEnum, hand-edit the generated SQL to prepend `CREATE TYPE \"public\".\"<name>\" AS ENUM(...);--> statement-breakpoint` BEFORE the ALTER TABLE that uses it. The snapshot.json + _journal.json updates from generate are otherwise correct."
  - "Reconciler discriminator branching pattern: row.kind === 'object' → object validator + deleteObject; else → prefix validator + deletePrefix. Both branches share the same markCompleted/recordError downstream wiring."

requirements-completed:
  - CAT-06
  - CAT-09

# Metrics
duration: 5m 15s
completed: 2026-05-01
---

# Phase 05 Plan 19: Photo-Entry Storage Cleanup Fix Summary

**CR-01 closed: pending_storage_deletions gains a `kind` discriminator (prefix|object); reconciler branches on it so deletePhotoEntry's object-key rows are now cleaned up via deleteObject instead of failing prefix validation forever.**

## Performance

- **Duration:** 5m 15s
- **Started:** 2026-05-01T21:14:56Z
- **Completed:** 2026-05-01T21:20:11Z
- **Tasks:** 4 of 4
- **Files modified:** 6 (3 src, 2 tests, 1 migration journal) + 2 created (migration SQL + snapshot)

## Accomplishments

- New `pending_deletion_kind` pgEnum with values `prefix` and `object`; `pending_storage_deletions.kind` column added as `NOT NULL DEFAULT 'prefix'`. Default keeps deletePlant flow on the legacy path with no behavior change.
- Reconciler handler (`cleanupStorageReconcilerHandler`) now branches on `row.kind`: object rows go through `validateStorageObjectKey` + `getStorageAdapter().deleteObject({ bucket, objectKey })`; prefix rows keep the existing `validateStorageDeletionPrefix` + `deletePrefix` path. Mitigations T-05-19-01 / T-05-19-04 in place (each branch uses the validator family that matches its row shape).
- `deletePhotoEntry` writes `kind: "object"` for both photo + thumbnail pending_storage_deletions inserts. The full canonical key `{userId}/{plantId}/{photoId}.{ext}` is preserved (no trailing slash).
- Drizzle migration `0006_secret_slayback.sql` shipped: hand-edited to include the `CREATE TYPE` statement that drizzle-kit 0.31.10's `generate` step omitted. Applied successfully via `pnpm db:migrate`; live local DB verified.
- New integration test `Cycle 3E-1` proves end-to-end: a directly-seeded `kind='object'` row is picked up by the cron, `deleteObject` is called exactly once with the matching bucket+objectKey, `deletePrefix` is NOT called, and the row transitions to `status='completed'`.
- Test 7 in `catalog-delete-photo-entry.integration.test.ts` extended to assert each inserted pending_storage_deletions row carries `kind='object'`.
- Full regression suite green: 37/37 across cleanup-storage-reconciler, cleanup-storage event handler, delete-plant, and catalog-delete-photo-entry. Cycles 3A–3D (the legacy prefix path) remain untouched.

## Task Commits

1. **Task 1: RED — failing tests for kind='object' reconciler branch + delete-photo-entry insert shape** — `a089a5a` (test)
2. **Task 2: GREEN — pgEnum + column + use-case writes kind='object'** — folded into Task 4 commit (intermediate state would not pass tests)
3. **Task 3: BLOCKING — apply migration to local Supabase** — no commit (live DB only); migration SQL committed with Task 4
4. **Task 4: GREEN — reconciler branches on row.kind, integration tests green** — `181d313` (feat) — also includes Task 2's schema + use-case edits and the Drizzle migration file

_TDD shape: one `test(05-19)` commit followed by one `feat(05-19)` commit, exactly per plan acceptance criteria._

## Files Created/Modified

- `src/contexts/catalog/infrastructure/db/schema.ts:90-126` — added `pendingDeletionKind` pgEnum + `kind` column with NOT NULL DEFAULT 'prefix' and a doc comment explaining the discriminator semantics.
- `src/contexts/catalog/application/delete-photo-entry.ts:145-156` — both `pendingStorageDeletionsRepo.create` calls now pass `kind: "object"`.
- `src/contexts/catalog/inngest/functions.ts:13-19,108-127,151-178` — imported `validateStorageObjectKey`, added `extractPlantIdFromObjectKey` helper, and replaced the reconciler `try` block with a kind-branched version. `cleanupStorageHandler` (event handler for plant.deleted) is unchanged — that path only handles prefix rows.
- `drizzle/migrations/0006_secret_slayback.sql` — `CREATE TYPE pending_deletion_kind` + `ALTER TABLE pending_storage_deletions ADD COLUMN kind`. Hand-edited to add the missing CREATE TYPE.
- `drizzle/migrations/meta/_journal.json` — entry for migration 0006 (drizzle-kit generated).
- `drizzle/migrations/meta/0006_snapshot.json` — schema snapshot post-migration (drizzle-kit generated).
- `tests/integration/cleanup-storage-reconciler.integration.test.ts:404-432` — new Cycle 3E-1 covering the kind='object' end-to-end deleteObject path.
- `tests/integration/catalog-delete-photo-entry.integration.test.ts:237-258` — added `kind` to SELECT + assertion that both rows carry `kind='object'`.

## Decisions Made

- **Combined Task 2 + Task 4 into one GREEN commit (vs separate Task 2 commit).** Plan acceptance criteria explicitly call for exactly two commits (RED `test(05-19)` + GREEN `feat(05-19)`). Task 2 in isolation produces a state where `pnpm typecheck` is clean but the integration tests still fail (no reconciler branching), so a separate Task 2 commit would be a non-passing intermediate. The advisor pre-flight call confirmed this interpretation.
- **Hand-edited the migration file to prepend `CREATE TYPE pending_deletion_kind`.** Both `drizzle-kit push` and `drizzle-kit generate` (version 0.31.10) emitted only the `ALTER TABLE` statement, omitting the `CREATE TYPE` that defines the enum the column references. This is a known drizzle-kit ordering bug for new pgEnums on existing tables. Rule 3 auto-fix: blocking issue (migration cannot apply without the CREATE TYPE). The fix mirrors the project's existing pattern (the original `pending_deletion_status` enum was created the same way in migration 0004). Manually edited migrations are within the project's existing migration practice — `drizzle/migrations/0001` and `0004` both contain hand-authored RLS policy DO blocks that drizzle-kit doesn't emit.
- **Module-private duplication of `extractPlantIdFromObjectKey`.** Plan explicitly forbade importing the equivalent helper from `delete-photo-entry.ts` because that function is module-private. Duplicating the small helper in `inngest/functions.ts` keeps both modules independent and matches the plan's stated preference.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] drizzle-kit 0.31.10 omits `CREATE TYPE` for new pgEnums on existing tables**

- **Found during:** Task 3 (BLOCKING — schema push)
- **Issue:** `pnpm exec ... drizzle-kit push` printed the diff and then aborted with `PostgresError: type "pending_deletion_kind" does not exist` because the generated DDL only contained `ALTER TABLE pending_storage_deletions ADD COLUMN "kind" "pending_deletion_kind" ...` without the `CREATE TYPE pending_deletion_kind AS ENUM (...)` statement that the column references. Falling back to `pnpm db:generate` produced a migration file `0006_secret_slayback.sql` that had the same bug — only the `ALTER TABLE` line. The plan explicitly anticipated only an interactive-prompt failure mode, not a DDL-ordering bug.
- **Fix:** Hand-edited `drizzle/migrations/0006_secret_slayback.sql` to prepend `CREATE TYPE "public"."pending_deletion_kind" AS ENUM('prefix', 'object');--> statement-breakpoint`. Then ran `pnpm db:migrate` — applied cleanly.
- **Files modified:** `drizzle/migrations/0006_secret_slayback.sql` (hand-edited).
- **Verification:** Post-migration `information_schema.columns` query confirmed `column_name='kind'`, `is_nullable='NO'`, `column_default='prefix'::pending_deletion_kind`. `pg_type` query confirmed the enum exists. All 37 integration tests across the storage-cleanup suite pass (the 18 in target test files + 19 regression).
- **Committed in:** `181d313` (Task 4 GREEN commit, alongside the schema + use-case + reconciler edits).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** Migration tooling produced an incomplete migration file due to a drizzle-kit version bug. Hand-editing the SQL is consistent with the project's existing migration practice (RLS policy DO blocks in earlier migrations were also hand-authored). No scope creep — the SQL added is exactly the missing line.

## Issues Encountered

- **Drizzle-kit 0.31.10 push/generate ordering bug for new pgEnums.** Resolved by hand-editing the generated migration to add the missing CREATE TYPE statement. Documented in deviations above so future Phase 11 LGPD migration work knows to verify CREATE TYPE statements are present before applying any drizzle-kit migration involving new enums.
- **Test runner watch-mode hook.** First test invocation used `pnpm exec vitest --run` which the local hook flagged as watch-mode despite the `--run` flag. Switched to `pnpm exec vitest run ...` (subcommand form) — equivalent, hook-compatible.

## User Setup Required

None — schema migration is local Supabase only (Wave 1, no production deploy). The migration file `drizzle/migrations/0006_secret_slayback.sql` will run automatically in CI / preview / production via the standard `db:migrate` step in the GitHub Actions deploy pipeline.

## Next Phase Readiness

- **CR-01 closed.** SC-4 photo-journal CRUD now reaches "delete leaves no orphaned bytes" end-to-end. SC-5 LGPD storage-deletion guarantee holds for individual photo entries (the legacy plant-wide path was already correct).
- **Phase 11 (LGPD bulk deletion sweep) note:** the new `kind` column needs to be considered when the bulk-delete handler reads from `pending_storage_deletions`. The handler must either (a) only insert `kind='prefix'` rows during account sweep (current behavior, default keeps it that way), or (b) explicitly handle both kinds. No code change required now — flagging for Phase 11 plan-phase.
- **Two-commit TDD discipline preserved.** RED commit (`a089a5a`) shows failing tests; GREEN commit (`181d313`) shows the implementation that turns them green. Verifier can re-run both phases by `git checkout` of those SHAs.

## Self-Check: PASSED

**File existence (created/modified):**
- FOUND: `src/contexts/catalog/infrastructure/db/schema.ts`
- FOUND: `src/contexts/catalog/application/delete-photo-entry.ts`
- FOUND: `src/contexts/catalog/inngest/functions.ts`
- FOUND: `tests/integration/cleanup-storage-reconciler.integration.test.ts`
- FOUND: `tests/integration/catalog-delete-photo-entry.integration.test.ts`
- FOUND: `drizzle/migrations/0006_secret_slayback.sql`
- FOUND: `drizzle/migrations/meta/0006_snapshot.json`
- FOUND: `drizzle/migrations/meta/_journal.json`

**Commits:**
- FOUND: `a089a5a` (test(05-19): RED — failing tests for kind='object' reconciler branch + delete-photo-entry insert shape)
- FOUND: `181d313` (feat(05-19): GREEN — branch cleanup reconciler on kind discriminator + delete-photo-entry writes kind='object')

**Verification commands:**
- `pnpm typecheck` — exit 0.
- `pnpm exec vitest run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts tests/integration/cleanup-storage.integration.test.ts tests/integration/delete-plant.integration.test.ts` — 37/37 passed.
- Live DB column verified via `information_schema.columns` — column_name='kind', is_nullable='NO', column_default='prefix'::pending_deletion_kind.

---
*Phase: 05-catalog-meu-jardim*
*Plan: 19 (gap-closure for CR-01)*
*Completed: 2026-05-01*
