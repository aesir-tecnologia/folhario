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
  http_boundary_note: |
    Codex Decision 1/2 — repositories return camelCase TypeScript types (`PlantRow.coverPhotoUrl`, `PhotoEntryRow.photoUrl`, `PendingDeletionRow.dispatchedAt`, etc.). The HTTP boundary lives at the route handlers in Plans 05-08/09 — those convert camelCase repo rows to snake_case JSON responses (`cover_photo_url`, `photo_url`, etc.) and return the unified envelope `{ data, next_cursor }`. Never serialize a repo row directly to JSON; always pass it through the route handler's serializer.
  null_acquisition_date_handling: "ORDER BY uses CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, acquisition_date DESC, created_at DESC, id DESC for the 'acquired_desc' sort (NULLS LAST). For 'acquired_asc': CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, acquisition_date ASC, created_at DESC, id DESC."
  cursor_tiebreak_per_sort_key: |
    Codex review 05-03 — cursor pagination for nullable / acquired / name / location sorts is under-specified.
    Each `sortKey` MUST have a deterministic tiebreaker chain. The universal final tiebreaker is `(created_at DESC, id DESC)` so the cursor's `id` is always sufficient to identify a unique row.

    | sortKey          | Primary ORDER BY                                                       | Secondary tiebreak | Final tiebreak | sortValue type | NULLS placement |
    |------------------|------------------------------------------------------------------------|--------------------|----------------|----------------|-----------------|
    | acquired_desc    | CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, acquisition_date DESC | created_at DESC | id DESC | ISO-8601 date or null | NULLS LAST |
    | acquired_asc     | CASE WHEN acquisition_date IS NULL THEN 1 ELSE 0 END, acquisition_date ASC  | created_at DESC | id DESC | ISO-8601 date or null | NULLS LAST |
    | name_asc         | lower(name) ASC                                                        | created_at DESC | id DESC | lowercased name | (no NULL — name is NOT NULL) |
    | name_desc        | lower(name) DESC                                                       | created_at DESC | id DESC | lowercased name | (no NULL — name is NOT NULL) |
    | location_asc     | CASE WHEN location IS NULL THEN 1 ELSE 0 END, lower(location) ASC      | created_at DESC | id DESC | lowercased location or null | NULLS LAST |
    | created_desc     | created_at DESC                                                        | id DESC          | (n/a)          | ISO-8601 timestamp | (no NULL) |

    Cursor predicate WHERE clause for "give me rows AFTER this cursor row":
    - For each sortKey, generate a strict-greater compound predicate matching the ORDER BY using `(col, created_at, id) > (sortValue, cursorCreatedAt, cursorId)` (Postgres row-value comparison) — handles ties cleanly. NULL sortValue is encoded as a sentinel placed last in the order direction; the predicate uses `(IS NULL, col, created_at, id)` row comparison.
    - Example acquired_desc: `(acquisition_date IS NULL, acquisition_date, created_at, id) < (cursor.acquisitionDateIsNull, cursor.acquisitionDate, cursor.createdAt, cursor.id)` (strict-less because acquired_desc is descending).

    Date serialization: dates round-trip via ISO-8601 `YYYY-MM-DD` (no time component) to match Phase 2 D-03 column type `date`. Timestamps use ISO-8601 UTC `Z`. The encoder/decoder in Plan 05-02 already enforces this; the repo never reformats sortValue.
  location_dedupe_strategy: "distinctByUser performs case-insensitive dedupe via SELECT DISTINCT ON (lower(location)) location FROM plants WHERE user_id = $1 AND location IS NOT NULL ORDER BY lower(location), created_at DESC. Returns user's display-case (latest version preserved per CONTEXT D-01)."
  pending_deletions_repo_scope: |
    Codex review 05-06 HIGH expansion: SIX functions, not four.
    - insert(tx, job)
    - findById(db, id)
    - findOlderThan(db, thresholdSeconds, status?) — selects rows with `status='pending' AND (dispatched_at IS NULL OR dispatched_at < now() - thresholdSeconds * INTERVAL '1 second')` so recently-dispatched rows are skipped (Codex 05-06 fix).
    - markDispatched(tx, id) — updates `status='dispatching'`, `dispatched_at=now()` and returns the updated row. Called by the reconciler in Plan 05-06 BEFORE sending the Inngest event.
    - markComplete(tx, id) — updates `status='complete'`, `completed_at=now()`. Called by the cleanup-storage Inngest function on success.
    - markFailed(tx, id, errorMessage) — updates `status='failed'`, `last_error=errorMessage`. Called by the cleanup-storage function on terminal failure.
  photo_entries_repo_scope: |
    Codex review 05-07 HIGH expansion — `setCoverPhoto` use case must NOT use raw SQL. To enforce that, this plan ships:
    - `photoEntries.findById(db, args: { photoEntryId, plantId, userId })` — returns the PhotoEntry row scoped to the user's plant. Used by the 05-07 use case to verify ownership before plants.setCoverPhoto runs (replaces the previous "raw SELECT 1" inside the use case).
    - `plants.setCoverPhoto(tx, args: { plantId, userId, coverPhotoUrl })` — single UPDATE that changes cover_photo_url on the user's plant row. Returns the updated PlantRow or null if not found.
    These two repo functions together let the 05-07 use case stay free of raw SQL/Drizzle.
must_haves:
  truths:
    - "Each catalog repository file exports the named functions specified in `decisions` and the per-file action blocks below"
    - "Every repo function takes a Drizzle client or transaction as the FIRST argument; no global db import inside the repo body"
    - "plants.findByCursor accepts an ExtendedCursor + SortKey + userId and returns up to N rows ordered correctly per sortKey, including the NULLS-LAST behavior for acquisition_date and per-sortKey tiebreakers per `decisions.cursor_tiebreak_per_sort_key` (Codex review 05-03)"
    - "plants.setCoverPhoto(tx, { plantId, userId, coverPhotoUrl }) is a SINGLE UPDATE repo function — Plan 05-07's use case calls this; no raw SQL in 05-07 use case (Codex review HIGH 05-07)"
    - "photoEntries.findById(db, { photoEntryId, plantId, userId }) returns a PhotoEntryRow scoped to the user's plant — Plan 05-07's setCoverPhoto use case calls this for ownership verification (replaces previous raw `SELECT 1` inside the use case)"
    - "location-suggestions.distinctByUser returns at most one entry per case-insensitive location, preserving the user's display case from the most recent row"
    - "pending-storage-deletions.findOlderThan returns rows where status='pending' AND (dispatched_at IS NULL OR dispatched_at < now() - thresholdSeconds * INTERVAL '1 second'), ordered by created_at ASC (Codex review HIGH 05-06 — recently-dispatched rows are skipped)"
    - "pending-storage-deletions.markDispatched(tx, id) updates status='dispatching' AND dispatched_at=now() AND returns the updated row; called by the reconciler BEFORE sending the Inngest event (Codex review HIGH 05-06)"
    - "PendingDeletionRow type includes `dispatchedAt: string | null` field (Codex review HIGH 05-06)"
    - "Codex Decision 6 — every test fixture path string uses bucket-relative `{userId}/{plantId}/{file}` form; no bucket prefix (`plant-photos/...`) appears in any path value"
    - "Repository return shapes are camelCase TypeScript objects (`{ rows, nextCursor }` for cursor reads; `PlantRow` / `PhotoEntryRow` / `PendingDeletionRow` for single-row reads). Route handlers in 05-08/09 convert to snake_case JSON envelopes (`{ data, next_cursor }`) — repos never serialize directly to wire format (Codex Decision 1/2)"
    - "All repos pass an integration test against the live DB using the transaction-rollback fixture"
  artifacts:
    - path: "src/contexts/catalog/infrastructure/db/plants.ts"
      provides: "findByIdAndUser, findByCursor, create, updatePartial, deleteByIdAndUser, setCoverPhoto (single UPDATE — Codex 05-07 mitigation)"
      min_lines: 90
    - path: "src/contexts/catalog/infrastructure/db/photo-entries.ts"
      provides: "findById (Codex 05-07 mitigation), findByPlant (cursor), listStoragePathsForPlant, create, updateNote, deleteByIdAndPlant"
      min_lines: 70
    - path: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts"
      provides: "insert, findById, findOlderThan (skip recently-dispatched — Codex 05-06), markDispatched (Codex 05-06), markComplete, markFailed; PendingDeletionRow includes dispatchedAt"
      min_lines: 70
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
- Cursor pagination orders rows correctly per all 6 SortKey values per `decisions.cursor_tiebreak_per_sort_key` (Codex 05-03), with NULL acquisition_date treated as last in acquired_desc/asc and per-sortKey tiebreak chains documented.
- Case-insensitive location dedupe with display-case preservation working.
- pending-storage-deletions.findOlderThan respects the threshold + skips recently-dispatched rows (Codex 05-06).
- pending-storage-deletions.markDispatched + photoEntries.findById + plants.setCoverPhoto repo functions shipped (Codex 05-06 + 05-07 mitigations).
- All four repos covered by integration tests using the transaction-rollback fixture from Plan 05-01; all path fixtures use canonical `{userId}/{plantId}/{file}` form (Codex Decision 6).
</success_criteria>

<reviews_addressed>
**Codex review findings resolved by this plan (per `.planning/phases/05-catalog-meu-jardim/05-REVIEWS.md`):**

- **05-03 finding — Cursor pagination for nullable / acquired_date / name / location sorts is under-specified**: Resolved by `decisions.cursor_tiebreak_per_sort_key` — explicit ORDER BY + tiebreaker chain table for all 6 sortKey values, plus a row-value comparison predicate for the cursor "after" filter that handles NULLS deterministically.
- **05-06 HIGH — reconciler references missing `dispatched_at`**: Resolved by adding `dispatchedAt: string | null` to `PendingDeletionRow` and shipping a new `markDispatched(tx, id)` repo function. `findOlderThan` is updated to skip rows where `dispatched_at` is recent. `pending_deletions_repo_scope` documents the six-function repo surface.
- **05-07 HIGH — `setCoverPhoto` uses raw SQL in the use-case layer (violates Phase 2 D-17)**: Resolved by shipping `plants.setCoverPhoto(tx, args)` (single UPDATE) AND `photoEntries.findById(db, args)` (ownership verification). The 05-07 use case stitches these two repo calls together — no Drizzle/SQL in the application layer.
- **Codex Decision 1/2 — HTTP envelope/field-naming**: `decisions.http_boundary_note` documents that repos return camelCase and route handlers (05-08/09) serialize to snake_case JSON `{ data, next_cursor }`. Repository signatures (`findByCursor` returns `{ rows, nextCursor }`) reflect this — the route handler is the only adapter.
- **Codex Decision 6 — storage path canonical format `{user_id}/{aggregate_id}/{file_id}.{ext}`**: All test fixture paths in `tests/integration/catalog/*-repo.integration.test.ts` use the bucket-relative form. Documented in must_haves truths.
</reviews_addressed>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-03-SUMMARY.md` capturing:
- The exact PlantRow / PhotoEntryRow / PendingDeletionRow type signatures shipped (so Plans 05-05/06/07 can import without rediscovery)
- Note for Plan 05-04: domain Zod schemas should be derived via `drizzle-zod` from the `plants` and `photoEntries` table objects in src/contexts/catalog/infrastructure/db/schema.ts; Plan 05-04 SHOULD NOT redefine the row shapes (use `createSelectSchema(plants)` etc.)
- Note for Plan 05-06 (delete-plant + Inngest): the `listStoragePathsForPlant` function returns combined photo + thumbnail paths; `pendingStorageDeletions.insert` is the outbox write; `findOlderThan` + `markComplete` + `markFailed` are the reconciler hooks
- Note for Plan 05-07 (PATCH/PhotoEntry/cover use cases): `updatePartial`, `setCoverPhoto`, `updateNote`, `deleteByIdAndPlant` are the mutation primitives
</output>
