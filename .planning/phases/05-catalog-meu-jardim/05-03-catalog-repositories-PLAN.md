---
phase: 05-catalog-meu-jardim
plan: 03
type: execute
wave: 1
depends_on:
  - 05-01
  - 05-02
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-02 (plants + photo_entries schema), 02-05 (db client, UoW, repositories pattern, no-Drizzle guard). Repository functions in this plan follow the Phase 2 D-16 functional-module pattern; the actual catalog schema rows (plants, photo_entries) are Phase 2 wave 2's deliverable. Block 05-03 execution until those rows exist on disk.
files_modified:
  - src/contexts/catalog/infrastructure/db/plants.ts
  - src/contexts/catalog/infrastructure/db/photo-entries.ts
  - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
  - src/contexts/catalog/infrastructure/db/location-suggestions.ts
  - tests/integration/catalog/plants-repo.integration.test.ts
  - tests/integration/catalog/photo-entries-repo.integration.test.ts
  - tests/integration/catalog/pending-storage-deletions-repo.integration.test.ts
  - tests/integration/catalog/location-suggestions-repo.integration.test.ts
autonomous: true
requirements:
  - CAT-04
  - CAT-05
  - CAT-07
decisions:
  repository_pattern: "Functional modules per Phase 2 D-16. Each function takes a Drizzle client (or transaction) as first argument. NO classes."
  cursor_consumption: "Repositories import SortKey + ExtendedCursor + decodeCursor from @shared/api/cursor (Plan 05-02). findByCursor accepts a parsed ExtendedCursor + SortKey + userId; route handler decodes the wire cursor before calling the repo."
  null_acquisition_date_handling: "ORDER BY uses CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, acquisition_date DESC, created_at DESC, id DESC for the 'acquired_desc' sort (NULLS LAST). For 'acquired_asc': CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, acquisition_date ASC, created_at DESC, id DESC."
  location_dedupe_strategy: "distinctByUser performs case-insensitive dedupe via SELECT DISTINCT ON (lower(location)) location FROM plants WHERE user_id = $1 AND location IS NOT NULL ORDER BY lower(location), created_at DESC. Returns user's display-case (latest version preserved per CONTEXT D-01)."
  pending_deletions_repo_scope: "Three functions: insert(tx, job), findById(db, id), findOlderThan(db, thresholdSeconds, status?), markComplete(tx, id), markFailed(tx, id, errorMessage). The reconciler in Plan 05-06 calls findOlderThan; the cleanup function calls findById + markComplete; the delete-plant use case calls insert."
must_haves:
  truths:
    - "Each catalog repository file exports the named functions specified in `decisions` and the per-file action blocks below"
    - "Every repo function takes a Drizzle client or transaction as the FIRST argument; no global db import inside the repo body"
    - "plants.findByCursor accepts an ExtendedCursor + SortKey + userId and returns up to N rows ordered correctly per sortKey, including the NULLS-LAST behavior for acquisition_date"
    - "location-suggestions.distinctByUser returns at most one entry per case-insensitive location, preserving the user's display case from the most recent row"
    - "pending-storage-deletions.findOlderThan returns rows where status='pending' AND created_at < now() - thresholdSeconds, ordered by created_at ASC"
    - "All repos pass an integration test against the live DB using the transaction-rollback fixture"
  artifacts:
    - path: "src/contexts/catalog/infrastructure/db/plants.ts"
      provides: "findByIdAndUser, findByCursor, create, updatePartial, deleteByIdAndUser, setCoverPhoto"
      min_lines: 80
    - path: "src/contexts/catalog/infrastructure/db/photo-entries.ts"
      provides: "findByPlant (cursor), listStoragePathsForPlant, create, updateNote, deleteByIdAndPlant"
      min_lines: 60
    - path: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts"
      provides: "insert, findById, findOlderThan, markComplete, markFailed"
      min_lines: 50
    - path: "src/contexts/catalog/infrastructure/db/location-suggestions.ts"
      provides: "distinctByUser"
      min_lines: 20
    - path: "tests/integration/catalog/plants-repo.integration.test.ts"
      provides: "Round-trip + cursor tests including NULL acquisition_date tiebreaker"
      min_lines: 100
    - path: "tests/integration/catalog/photo-entries-repo.integration.test.ts"
      provides: "create + listStoragePathsForPlant + updateNote + delete coverage"
      min_lines: 60
    - path: "tests/integration/catalog/pending-storage-deletions-repo.integration.test.ts"
      provides: "insert + findOlderThan threshold semantics + markComplete/markFailed"
      min_lines: 60
    - path: "tests/integration/catalog/location-suggestions-repo.integration.test.ts"
      provides: "case-insensitive dedupe + display-case preservation"
      min_lines: 40
  key_links:
    - from: "src/contexts/catalog/infrastructure/db/plants.ts"
      to: "src/shared/api/cursor.ts (Plan 05-02)"
      via: "imports SortKey + ExtendedCursor types"
      pattern: "from \"@shared/api/cursor\""
    - from: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts"
      to: "src/contexts/catalog/infrastructure/db/schema.ts (Plan 05-02)"
      via: "imports pendingStorageDeletions table object"
      pattern: "pendingStorageDeletions"
    - from: "tests/integration/catalog/*-repo.integration.test.ts"
      to: "tests/helpers/db-guard.ts + tests/helpers/transaction-rollback.ts (Plan 05-01)"
      via: "every test file imports both helpers"
      pattern: "withRollback"
---

<objective>
Ship the four catalog repositories (functional modules per Phase 2 D-16) consumed by the use cases in Plans 05-05/06/07: `plants`, `photo-entries`, `pending-storage-deletions`, and `location-suggestions`. Each repo includes integration test coverage against the live local DB using the transaction-rollback fixture from Plan 05-01.

Purpose: Phase 2 D-17 ESLint guard forbids Drizzle in route handlers; data access is repository-only. Plans 05-05/06/07 cannot ship without these four files. Plan 05-08/09's route handlers cannot integrate without the use cases. The dependency chain pivots on this plan.

Output: 4 repository files (~210 lines TypeScript), 4 integration test files (~260 lines), all green against the live DB.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/02-data-layer/02-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-02-pending-deletions-schema-cursor-PLAN.md

<interfaces>
<!-- Repository function signatures shipped by this plan. Use cases (Plans 05-05/06/07) consume these directly. -->

src/contexts/catalog/infrastructure/db/plants.ts:
```ts
import type { Sql } from "postgres"; // or Drizzle client type per Phase 2 wave 5
import type { SortKey, ExtendedCursor } from "@shared/api/cursor";

export type PlantRow = {
  id: string;
  userId: string;
  speciesId: string | null;
  name: string;
  nickname: string | null;
  location: string | null;
  acquisitionDate: string | null; // ISO date or null
  notes: string | null;
  coverPhotoUrl: string | null;
  createdAt: string;
};

export async function findByIdAndUser(db: Sql, args: { plantId: string; userId: string }): Promise<PlantRow | null>;

export async function findByCursor(db: Sql, args: {
  userId: string;
  sortKey: SortKey;
  cursor: ExtendedCursor | null;
  limit: number; // capped at 200 by route handler; default 50
}): Promise<{ rows: PlantRow[]; nextCursor: ExtendedCursor | null }>;

export async function create(tx: Sql, args: {
  id?: string; // optional pre-generated UUID; defaults to gen_random_uuid()
  userId: string;
  speciesId?: string | null;
  name: string;
  nickname?: string | null;
  location?: string | null;
  acquisitionDate?: string | null;
  notes?: string | null;
  coverPhotoUrl?: string | null;
}): Promise<PlantRow>;

export async function updatePartial(tx: Sql, args: {
  plantId: string;
  userId: string;
  patch: Partial<Pick<PlantRow, "name" | "nickname" | "location" | "acquisitionDate" | "notes">>;
}): Promise<PlantRow | null>;

export async function deleteByIdAndUser(tx: Sql, args: { plantId: string; userId: string }): Promise<boolean>;

export async function setCoverPhoto(tx: Sql, args: {
  plantId: string;
  userId: string;
  photoUrl: string;
}): Promise<PlantRow | null>;
```

src/contexts/catalog/infrastructure/db/photo-entries.ts:
```ts
export type PhotoEntryRow = {
  id: string;
  plantId: string;
  userId: string;
  photoUrl: string;
  thumbnailUrl: string;
  note: string | null;
  createdAt: string;
};

export async function findByPlant(db: Sql, args: {
  plantId: string;
  userId: string;
  cursor: { id: string; createdAt: string } | null; // simple createdAt-based cursor; reverse-chrono fixed per CAT-06
  limit: number;
}): Promise<{ rows: PhotoEntryRow[]; nextCursor: { id: string; createdAt: string } | null }>;

export async function listStoragePathsForPlant(tx: Sql, args: {
  plantId: string;
  userId: string;
}): Promise<string[]>; // returns photo_url and thumbnail_url paths combined; consumed by delete-plant use case

export async function create(tx: Sql, args: {
  plantId: string;
  userId: string;
  photoUrl: string;
  thumbnailUrl: string;
  note?: string | null;
}): Promise<PhotoEntryRow>;

export async function updateNote(tx: Sql, args: {
  id: string;
  plantId: string;
  userId: string;
  note: string | null;
}): Promise<PhotoEntryRow | null>;

export async function deleteByIdAndPlant(tx: Sql, args: {
  id: string;
  plantId: string;
  userId: string;
}): Promise<{ deletedPaths: string[] } | null>; // returns the storage paths so the use case can schedule cleanup
```

src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts:
```ts
export type PendingDeletionRow = {
  id: string;
  userId: string;
  plantId: string;
  storagePaths: string[];
  status: "pending" | "complete" | "failed";
  createdAt: string;
  completedAt: string | null;
  lastError: string | null;
};

export async function insert(tx: Sql, args: {
  userId: string;
  plantId: string;
  storagePaths: string[];
}): Promise<PendingDeletionRow>;

export async function findById(db: Sql, id: string): Promise<PendingDeletionRow | null>;

export async function findOlderThan(db: Sql, args: {
  thresholdSeconds: number;
  status?: "pending" | "failed"; // defaults to "pending"
  limit?: number; // safety cap; defaults to 100
}): Promise<PendingDeletionRow[]>;

export async function markComplete(tx: Sql, id: string): Promise<PendingDeletionRow | null>;

export async function markFailed(tx: Sql, args: { id: string; errorMessage: string }): Promise<PendingDeletionRow | null>;
```

src/contexts/catalog/infrastructure/db/location-suggestions.ts:
```ts
export async function distinctByUser(db: Sql, userId: string): Promise<string[]>;
// Returns case-insensitive distinct locations for the user, preserving most-recent display case.
// SQL: SELECT DISTINCT ON (lower(location)) location FROM plants WHERE user_id = $1 AND location IS NOT NULL ORDER BY lower(location), created_at DESC
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship plants.ts repository + integration tests (cursor + NULL handling are load-bearing)</name>
  <files>src/contexts/catalog/infrastructure/db/plants.ts, tests/integration/catalog/plants-repo.integration.test.ts</files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/schema.ts (Phase 2 wave 2 + Plan 05-02 — verify the `plants` and `pendingStorageDeletions` table exports + column names)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-16 (functional repos, no classes), D-22 (RLS ownership policy + repository userId filter), D-43 (transaction-rollback)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 5: Cursor pagination instability on duplicate acquisition_date" (the NULLS-LAST + tiebreaker contract)
    - .planning/phases/05-catalog-meu-jardim/05-02-pending-deletions-schema-cursor-PLAN.md (the ExtendedCursor type)
    - tests/helpers/db-guard.ts + tests/helpers/transaction-rollback.ts (Plan 05-01)
  </read_first>
  <behavior>
    - findByIdAndUser returns null when no row matches
    - findByIdAndUser returns the row scoped to user_id (cross-user lookup returns null even if id matches)
    - findByCursor with sortKey=acquired_desc + null cursor returns rows ordered: non-null acquisition_date DESC first, then NULL rows, tiebreak by created_at DESC, id DESC
    - findByCursor with sortKey=name_asc orders by lower(name) ASC, tiebreak by created_at DESC, id DESC
    - findByCursor with limit=2 + 5 rows + null cursor returns 2 rows + nextCursor; subsequent call with that cursor returns next 2 rows
    - findByCursor returns nextCursor=null when fewer rows than limit are returned
    - create inserts a row with all fields and returns it; cover_photo_url defaults to null when omitted
    - updatePartial mutates only the supplied fields; updates row scoped to userId; returns null when no row matches
    - deleteByIdAndUser returns true when a row was deleted, false otherwise
    - setCoverPhoto updates cover_photo_url scoped to userId
  </behavior>
  <action>
    1. Implement src/contexts/catalog/infrastructure/db/plants.ts following the `<interfaces>` contract. Use raw `postgres` (Sql) tagged-template SQL — Phase 2 wave 5 may use Drizzle's query builder; use whichever is shipped. NULLS-LAST sort SQL is critical:

       For sortKey="acquired_desc":
       ```sql
       SELECT * FROM plants
       WHERE user_id = $1
       ${cursor ? "AND (CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, COALESCE(acquisition_date, '0001-01-01'::date), created_at, id) < (...)" : ""}
       ORDER BY (acquisition_date IS NULL), acquisition_date DESC, created_at DESC, id DESC
       LIMIT $N
       ```
       For "acquired_asc": `ORDER BY (acquisition_date IS NULL), acquisition_date ASC, created_at DESC, id DESC` (still NULLS LAST).
       For "name_asc": `ORDER BY lower(name) ASC, created_at DESC, id DESC`.
       For "name_desc": `ORDER BY lower(name) DESC, created_at DESC, id DESC`.
       For "location_asc": `ORDER BY lower(location) ASC NULLS LAST, created_at DESC, id DESC`.
       For "created_desc": `ORDER BY created_at DESC, id DESC`.

       Cursor predicate construction: encode the sortKey's effective value into the WHERE clause via row-tuple comparison. For NULL-bearing sorts, split into two branches (one for NULL cursor.sortValue, one for non-NULL).

       After fetching `limit + 1` rows, if more than `limit` were returned, the (limit+1)th row's values seed `nextCursor`; truncate the returned `rows` to `limit`. Otherwise `nextCursor = null`.

    2. Write tests/integration/catalog/plants-repo.integration.test.ts with the cases listed in `<behavior>`. Each test uses `withRollback(sql, async (tx) => { ... })`. Seed plants with explicit acquisition_date values to assert the NULLS-LAST + tiebreaker behavior. Insert at least one user row inside the rollback for FK satisfaction.

    3. Run `pnpm exec vitest --run --project=integration tests/integration/catalog/plants-repo.integration.test.ts`. All tests must pass.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/infrastructure/db/plants.ts exists and exports `findByIdAndUser`, `findByCursor`, `create`, `updatePartial`, `deleteByIdAndUser`, `setCoverPhoto` (grep for each)
    - File does NOT import a global db client (grep -v '^//' for `from "@shared/db/client"` returns 0)
    - tests/integration/catalog/plants-repo.integration.test.ts contains at least 10 `it(...)` cases covering the behaviors
    - `pnpm exec vitest --run --project=integration tests/integration/catalog/plants-repo.integration.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -v '^//' src/contexts/catalog/infrastructure/db/plants.ts | grep -c "from \"@shared/db/client\"" | grep -q "^0$" && grep -q "findByCursor" src/contexts/catalog/infrastructure/db/plants.ts && grep -q "setCoverPhoto" src/contexts/catalog/infrastructure/db/plants.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/plants-repo.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>plants.ts exports the 6 functions; all integration tests pass; cursor pagination produces deterministic ordering across pages; NULL acquisition_date appears LAST in acquired_desc/asc.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship photo-entries.ts + pending-storage-deletions.ts + location-suggestions.ts repositories + tests</name>
  <files>
    src/contexts/catalog/infrastructure/db/photo-entries.ts,
    src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts,
    src/contexts/catalog/infrastructure/db/location-suggestions.ts,
    tests/integration/catalog/photo-entries-repo.integration.test.ts,
    tests/integration/catalog/pending-storage-deletions-repo.integration.test.ts,
    tests/integration/catalog/location-suggestions-repo.integration.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/schema.ts (Phase 2 wave 2 + Plan 05-02 — verify `photoEntries` and `pendingStorageDeletions` table objects)
    - src/contexts/catalog/infrastructure/db/plants.ts (Task 1 — same coding pattern: raw SQL or Drizzle, repo function signature contract)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-01 (location case-insensitive compare with display-case preservation), D-04 (pending deletion outbox semantics)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pattern 5: Atomic plant DELETE" (how pendingStorageDeletions is consumed)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-26 (storage path layout `{user_id}/{aggregate_id}/{file_id}.{ext}` — listStoragePathsForPlant returns these prefixed paths)
  </read_first>
  <behavior>
    photo-entries:
    - findByPlant returns rows for plantId scoped to userId, ordered created_at DESC, id DESC; cursor pagination works
    - listStoragePathsForPlant returns flattened photo_url + thumbnail_url paths for ALL PhotoEntries belonging to plantId+userId; returns [] when plant has no entries
    - create inserts a row with all fields; userId stored
    - updateNote sets note (or NULL); returns null when row not found or not owned by user
    - deleteByIdAndPlant returns the deleted row's photo + thumbnail paths; returns null when not found

    pending-storage-deletions:
    - insert creates a row with status='pending', returns it
    - findById returns the row or null
    - findOlderThan with thresholdSeconds=300 returns only rows where created_at < now() - 5 minutes AND status='pending' (or whichever status passed); ordered by created_at ASC; capped at limit
    - markComplete updates status='complete' and completed_at=now(); returns updated row or null
    - markFailed updates status='failed' and last_error=errorMessage and completed_at=now(); returns updated row or null

    location-suggestions:
    - distinctByUser returns one entry per case-insensitive location (e.g., "Sala", "sala", "SALA" → returns "Sala" if it was the most recently created)
    - Returns [] when user has no plants with non-null location
    - Result preserves the user's display case
  </behavior>
  <action>
    1. Implement the three repos following the `<interfaces>` contract. For location-suggestions, use exactly:
       ```sql
       SELECT DISTINCT ON (lower(location)) location
       FROM plants
       WHERE user_id = $1 AND location IS NOT NULL
       ORDER BY lower(location), created_at DESC
       ```

    2. For pending-storage-deletions.findOlderThan use:
       ```sql
       SELECT * FROM pending_storage_deletions
       WHERE status = $2 AND created_at < (now() - ($1 || ' seconds')::interval)
       ORDER BY created_at ASC
       LIMIT $3
       ```

    3. For photo-entries.deleteByIdAndPlant: SELECT the row's photo_url + thumbnail_url before DELETE, return them in the result. Use a CTE or two queries inside the transaction; either is fine.

    4. Write three integration test files using `withRollback`. For pending-storage-deletions, the threshold test inserts a row with explicit `created_at` set to `now() - interval '10 minutes'` to assert findOlderThan returns it.

    5. Run all three integration test files; all must pass.
  </action>
  <acceptance_criteria>
    - All three repository files exist with the named exports listed in `<interfaces>`
    - location-suggestions.ts contains literal `DISTINCT ON (lower(location))` (the case-insensitive dedupe SQL)
    - pending-storage-deletions.ts contains `findOlderThan` with `interval` syntax (grep for `interval`)
    - photo-entries.ts contains `listStoragePathsForPlant` returning combined photo + thumbnail paths
    - All three integration test files exist and each contains at least 4 `it(...)` cases
    - `pnpm exec vitest --run --project=integration tests/integration/catalog/photo-entries-repo.integration.test.ts tests/integration/catalog/pending-storage-deletions-repo.integration.test.ts tests/integration/catalog/location-suggestions-repo.integration.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "DISTINCT ON (lower(location))" src/contexts/catalog/infrastructure/db/location-suggestions.ts && grep -q "interval" src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts && grep -q "listStoragePathsForPlant" src/contexts/catalog/infrastructure/db/photo-entries.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/photo-entries-repo.integration.test.ts tests/integration/catalog/pending-storage-deletions-repo.integration.test.ts tests/integration/catalog/location-suggestions-repo.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>All three repos shipped and tested; case-insensitive location dedupe works; findOlderThan respects threshold; deleteByIdAndPlant returns the deleted row's storage paths.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-02" severity="high" stride="I">
  <description>IDOR — repository functions exposing rows belonging to other users when the userId filter is omitted. A use case bug or test fixture mistake could call `findById(plantId)` instead of `findByIdAndUser(plantId, userId)`, exposing another user's plant.</description>
  <mitigation file="src/contexts/catalog/infrastructure/db/plants.ts">Repository contract names + signatures REQUIRE userId on every function except those clearly scoped by primary id (findById is intentionally absent — only findByIdAndUser exists). Every WHERE clause includes `user_id = $userId`. Phase 2 D-22 RLS policies are defense-in-depth; the repo's explicit userId filter is the primary control. Integration tests in this plan assert that cross-user lookups return null.</mitigation>
</threat>

<threat id="T-5-12" severity="medium" stride="T">
  <description>Tampering — a SQL injection vector via the cursor's sortValue field if any repository function interpolates raw cursor.sortValue into SQL instead of using parameterization.</description>
  <mitigation file="src/contexts/catalog/infrastructure/db/plants.ts">findByCursor uses postgres-js tagged-template literals exclusively (e.g. `sql`...${cursor.sortValue}...``); never string concatenation. The sortKey field is validated against a closed enum in cursor.ts (Plan 05-02) before reaching the repo, so the SQL fragment selection (which ORDER BY clause) cannot be tampered with.</mitigation>
</threat>

<threat id="T-5-11" severity="low" stride="I">
  <description>Information Disclosure — pending-storage-deletions repo exposing other users' deletion jobs via findOlderThan (which is unscoped by user).</description>
  <mitigation file="src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts">findOlderThan is intentionally unscoped because it's called only by the reconciler cron (Plan 05-06) and the cleanup Inngest function (Plan 05-06), both of which run with service-role credentials and are not user-facing. No client-facing route exposes pending_storage_deletions. The schema comment in Plan 05-02 documents the service-role-only constraint. If any future Phase exposes this table to clients, a userId filter must be added; this is captured in the repo file's header comment.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=integration tests/integration/catalog/` exits 0 (all 4 catalog repo integration files green).
2. `pnpm exec tsc --noEmit` exits 0.
3. Phase 2 D-17 ESLint guard ("no Drizzle in route handlers") still passes — these are repo files, not handlers.
4. All four repo files export the named functions in `<interfaces>` (verified by grep).
</verification>

<success_criteria>
- Four catalog repository files (plants, photo-entries, pending-storage-deletions, location-suggestions) shipped per the Phase 2 D-16 functional-module contract.
- Cursor pagination orders rows correctly per all 6 SortKey values, with NULL acquisition_date treated as last in acquired_desc/asc.
- Case-insensitive location dedupe with display-case preservation working.
- pending-storage-deletions.findOlderThan respects the threshold + status filter.
- All four repos covered by integration tests using the transaction-rollback fixture from Plan 05-01.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-03-SUMMARY.md` capturing:
- The exact PlantRow / PhotoEntryRow / PendingDeletionRow type signatures shipped (so Plans 05-05/06/07 can import without rediscovery)
- Note for Plan 05-04: domain Zod schemas should be derived via `drizzle-zod` from the `plants` and `photoEntries` table objects in src/contexts/catalog/infrastructure/db/schema.ts; Plan 05-04 SHOULD NOT redefine the row shapes (use `createSelectSchema(plants)` etc.)
- Note for Plan 05-06 (delete-plant + Inngest): the `listStoragePathsForPlant` function returns combined photo + thumbnail paths; `pendingStorageDeletions.insert` is the outbox write; `findOlderThan` + `markComplete` + `markFailed` are the reconciler hooks
- Note for Plan 05-07 (PATCH/PhotoEntry/cover use cases): `updatePartial`, `setCoverPhoto`, `updateNote`, `deleteByIdAndPlant` are the mutation primitives
</output>
