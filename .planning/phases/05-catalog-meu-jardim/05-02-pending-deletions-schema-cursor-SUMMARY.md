---
phase: 05-catalog-meu-jardim
plan: 02
subsystem: database
tags: [drizzle, postgres, rls, migrations, cursor, pagination, enum]

requires:
  - phase: 04-iam-auth-verification-consent
    provides: idempotent DO block RLS pattern (Plan 04-02 Codex HIGH #1) and migration discipline (drizzle-kit migrate not push)
  - phase: 02-data-layer
    provides: existing catalog schema (plants + photo_entries), Phase-2 cursor codec (cursorPayloadSchema / encodeCursor / decodeCursor) extended here

provides:
  - pendingDeletionStatus pgEnum (pending|in_progress|completed|failed) in catalog schema
  - pendingStorageDeletions Drizzle table (D-23) with status+scheduledAt composite index for reconciler
  - locationSuggestions Drizzle table (D-09) with composite PK (user_id, label_normalized)
  - Migration 0004_add_pending_storage_deletions.sql with owner-only RLS
  - Migration 0005_add_location_suggestions.sql with owner-only RLS
  - encodeSortCursor / decodeSortCursor additive sort-aware cursor codec (D-12)
  - catalog-phase5-rls.integration.test.ts: owner-only RLS proof for both new tables

affects:
  - 05-03 (pending-storage-deletions repo + location-suggestions repo consume these tables)
  - 05-06 (reconciler queries pending_storage_deletions via psd_status_scheduled_at_idx)
  - 05-07 (list-plants use-case uses decodeSortCursor)
  - 05-08 (route handler encodes/decodes sort cursor in ?cursor= query param)
  - 05-10 (TanStack Query cache key uses encodeSortCursor for stable pagination key)

tech-stack:
  added: []
  patterns:
    - "schema-registry.ts must be updated when new tables are added to per-context schemas"
    - "Two-pass drizzle-kit generate (one table per invocation) for separate named migration files"
    - "Hand-append RLS blocks after drizzle-kit generate output, before pnpm db:migrate"
    - "Idempotent DO block IF NOT EXISTS pattern for RLS policies (owner-only authenticated role)"
    - "Additive cursor codec: Phase-5 encodeSortCursor exports alongside unchanged Phase-2 encodeCursor"
    - "vitest unit project extended to include src/**/*.test.ts for co-located test files"

key-files:
  created:
    - drizzle/migrations/0004_add_pending_storage_deletions.sql
    - drizzle/migrations/0005_add_location_suggestions.sql
    - drizzle/migrations/meta/0004_snapshot.json
    - drizzle/migrations/meta/0005_snapshot.json
    - src/shared/api/cursor.test.ts
    - tests/integration/catalog-phase5-rls.integration.test.ts
  modified:
    - src/contexts/catalog/infrastructure/db/schema.ts (pendingDeletionStatus + pendingStorageDeletions + locationSuggestions added)
    - src/shared/db/schema-registry.ts (three new catalog exports)
    - src/shared/api/cursor.ts (SORT_IDS + SortCursorPayload + encodeSortCursor + decodeSortCursor added)
    - drizzle/migrations/meta/_journal.json (two new entries)
    - vitest.config.ts (unit project extended to src/**/*.test.ts)

key-decisions:
  - "schema-registry.ts must export new tables for drizzle-kit to detect schema changes — the config uses the registry as the schema entry point, not per-context files directly"
  - "Two separate drizzle-kit generate invocations (one per table) produce two distinct named migration files per the plan requirement"
  - "sortCursorPayloadSchema is module-private (no export); SORT_IDS, SortCursorPayload, SortCursorDecodeResult, encodeSortCursor, decodeSortCursor are exported"
  - "vitest unit project extended to include src/**/*.test.ts to support co-located test files (cursor.test.ts sits alongside cursor.ts per plan spec)"
  - "REFACTOR skipped — decodeCursor / decodeSortCursor duplication is ~6 lines, plan explicitly permits omission when light"

patterns-established:
  - "schema-registry.ts update required alongside per-context schema.ts additions"
  - "TDD RED phase: test file in src/ next to source file, extend vitest include pattern"
  - "Integration RLS test reuses describe.skipIf(!dbUrl) + SET LOCAL ROLE authenticated pattern"

requirements-completed:
  - "CAT-09 (partial — storage scheduling row only; cleanup behavior closes in 05-06)"
  - "OFF-08 (cursor used by SWR cache key + offline pagination key stability)"

duration: 7min
completed: "2026-05-01"
---

# Phase 5 Plan 02: Pending-Deletions Schema + Sort Cursor Summary

**Two Drizzle migrations with owner-only RLS (pending_storage_deletions + location_suggestions), additive sort-aware cursor codec with NULLS LAST sentinel, and cross-user RLS denial integration tests**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-05-01T01:28:02Z
- **Completed:** 2026-05-01T01:35:00Z
- **Tasks:** 3 (Task 2 has 2 atomic commits: RED + GREEN; REFACTOR skipped)
- **Files modified:** 11 (6 created, 5 edited)

## Accomplishments

- Extended `src/contexts/catalog/infrastructure/db/schema.ts` with `pendingDeletionStatus` pgEnum, `pendingStorageDeletions` table (D-23), and `locationSuggestions` table (D-09)
- Generated two separate migration files (`0004_add_pending_storage_deletions.sql`, `0005_add_location_suggestions.sql`) via two `drizzle-kit generate` invocations; hand-appended idempotent owner-only RLS blocks to each
- Applied migrations via `pnpm db:migrate` (NOT push — Codex HIGH #1); both tables present in live Postgres with `relrowsecurity=t` confirmed
- Added additive sort-aware cursor codec (`encodeSortCursor` / `decodeSortCursor`) to `src/shared/api/cursor.ts`; Phase-2 exports unchanged; 12-test suite (8 RED cases + 1 Phase-2 regression guard)
- Authored `tests/integration/catalog-phase5-rls.integration.test.ts` proving cross-user SELECT and INSERT denial for both new tables via `SET LOCAL ROLE authenticated` + JWT-claim binding

## Task Commits

1. **Task 1: schema + migrations** - `24dced5` (feat)
2. **Task 2: cursor codec RED** - `cdebb52` (test)
3. **Task 2: cursor codec GREEN** - `dae7d8b` (feat)
4. **Task 3: migrate + RLS integration test** - `b5b7b5c` (feat)

## Live DB Audit (Task 3 psql output)

```
-- Enum type
select 'pending_deletion_status'::regtype → pending_deletion_status

-- Table count
select count(*) from pg_tables where tablename in ('pending_storage_deletions','location_suggestions') → 2

-- RLS enabled (Codex HIGH #1 smoking gun)
SELECT relname, relrowsecurity FROM pg_class WHERE relname IN (...):
  pending_storage_deletions | t
  location_suggestions      | t

-- Index for reconciler
psd_status_scheduled_at_idx confirmed in pg_indexes

-- pending_storage_deletions columns: bucket, prefix, status (pending_deletion_status), attempts, scheduled_at, started_at
-- location_suggestions columns: label_normalized, label_display, usage_count, last_used_at, composite PK
```

## Files Created/Modified

- `src/contexts/catalog/infrastructure/db/schema.ts` — 97 lines added (enum + 2 tables)
- `src/shared/db/schema-registry.ts` — 3 new exports added
- `drizzle/migrations/0004_add_pending_storage_deletions.sql` — 32 lines (generated + hand-appended RLS)
- `drizzle/migrations/0005_add_location_suggestions.sql` — 27 lines (generated + hand-appended RLS)
- `drizzle/migrations/meta/_journal.json` — 2 new entries (idx 4 + 5)
- `src/shared/api/cursor.ts` — 63 lines added (additive sort cursor codec)
- `src/shared/api/cursor.test.ts` — 142 lines created (12 tests: 8 RED + 1 Phase-2 guard)
- `vitest.config.ts` — unit project include extended to `src/**/*.test.ts`
- `tests/integration/catalog-phase5-rls.integration.test.ts` — 286 lines (6 it blocks)
- `drizzle/migrations/meta/0004_snapshot.json` + `0005_snapshot.json` — drizzle-kit snapshots

## Migration Naming (actual auto-prefixes)

- `0004_add_pending_storage_deletions.sql` (prefix 0004)
- `0005_add_location_suggestions.sql` (prefix 0005)
- Both entries in journal as expected

## Composite PK column order (drizzle-kit drift note)

drizzle-kit emitted `CONSTRAINT "location_suggestions_user_id_label_normalized_pk" PRIMARY KEY("user_id","label_normalized")` — `user_id` first, then `label_normalized`. This matches the schema.ts `primaryKey({ columns: [table.userId, table.labelNormalized] })` declaration order. No drift.

## Phase-2 Cursor Contract Unchanged

All 5 Phase-2 exports confirmed unchanged:
- `encodeCursor`, `decodeCursor`, `cursorPayloadSchema`, `normalizeLimit`, `DEFAULT_LIMIT`, `MAX_LIMIT`
- Phase-2 regression guard test in `cursor.test.ts` passes

## Decisions Made

- **schema-registry.ts requires explicit export of new tables.** drizzle-kit reads the registry (configured as schema entry in `drizzle.config.ts`), not per-context schema files directly. Adding tables to per-context `schema.ts` without updating the registry causes `drizzle-kit generate` to report "No schema changes". Rule 3 deviation — added exports to registry.

- **vitest unit project extended to `src/**/*.test.ts`.** The plan prescribed `src/shared/api/cursor.test.ts` as the test file location (co-located with source). The existing vitest config only included `tests/unit/**/*.test.ts`. Extended the include pattern to support co-located test files per plan spec.

- **REFACTOR skipped.** `decodeCursor` and `decodeSortCursor` share a ~6-line try/catch base64url-JSON decode ladder. The plan explicitly permits skipping refactor when duplication is light; no `refactor(05-02)` commit was made.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] schema-registry.ts not updated alongside schema.ts**

- **Found during:** Task 1 step 1.2 (drizzle-kit generate)
- **Issue:** First `drizzle-kit generate` run after adding `pendingStorageDeletions` to schema.ts reported "No schema changes" — because `drizzle.config.ts` points to `src/shared/db/schema-registry.ts` as the schema entry, not per-context schema files. The new tables were in schema.ts but not exported from the registry.
- **Fix:** Added `pendingDeletionStatus`, `pendingStorageDeletions`, `locationSuggestions` exports to schema-registry.ts (staggered: first two before generate pass 1, third before generate pass 2).
- **Files modified:** `src/shared/db/schema-registry.ts`
- **Verification:** Second `drizzle-kit generate` run produced `0004_add_pending_storage_deletions.sql` successfully.
- **Committed in:** `24dced5` (Task 1 commit)

**2. [Rule 3 - Blocking] vitest unit project did not include co-located test files**

- **Found during:** Task 2 step 2.1 (RED phase test run)
- **Issue:** `pnpm exec vitest run src/shared/api/cursor.test.ts` returned "No test files found" — the vitest config `unit` project only included `tests/unit/**/*.test.ts`, not `src/**/*.test.ts`.
- **Fix:** Extended the `unit` project's `include` array to add `"src/**/*.test.ts"` so co-located tests in `src/` are discovered.
- **Files modified:** `vitest.config.ts`
- **Verification:** `pnpm exec vitest run src/shared/api/cursor.test.ts` immediately ran 12 tests (11 failing as expected for RED).
- **Committed in:** `cdebb52` (Task 2 RED commit)

---

**Total deviations:** 2 auto-fixed (both Rule 3 — blocking issues)
**Impact on plan:** Both fixes required for plan execution. No scope changes.

## Known Stubs

None — this plan ships schema + codec + tests only; no UI rendering or placeholder data.

## Threat Flags

None — no new network endpoints, auth paths, or file access patterns introduced. Trust boundary mitigations T-05-02-01 through T-05-02-05 (cursor codec Zod validation, RLS owner-only on both tables, migration URL isolation) implemented as specified in the plan threat model.

## Next Phase Readiness

- 05-03: pending-storage-deletions and location-suggestions repositories can now be created against the live schema
- 05-06: reconciler can query `pending_storage_deletions` via `psd_status_scheduled_at_idx`
- 05-07/08: sort-aware cursor codec (`encodeSortCursor` / `decodeSortCursor`) is callable for list-plants route
- 05-10: TanStack Query cache key uses `encodeSortCursor` for stable offline pagination key

---

## Self-Check: PASSED

All 7 created/key files confirmed present on disk. All 4 task commits confirmed in git log.

---

*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
