---
phase: 05-catalog-meu-jardim
plan: 02
type: tdd
wave: 1
depends_on:
  - 05-01
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-01 (drizzle-kit + migration tooling), 02-02 (core schema modules), 02-03 (operational schema + RLS), 02-04 (db:setup script). These plans are PLANNED in Phase 2 but NOT yet executed in this worktree as of STATE.md 2026-04-26. Execution of 05-02 BLOCKS until those Phase 2 plans land src/contexts/catalog/infrastructure/db/schema.ts, drizzle.config.ts, drizzle/migrations/, and the pnpm db:setup / drizzle-kit push scripts.
files_modified:
  - src/contexts/catalog/infrastructure/db/schema.ts
  - src/shared/api/cursor.ts
  - drizzle/migrations
  - tests/unit/shared/api/cursor.test.ts
  - tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts
autonomous: true
requirements:
  - CAT-07
  - CAT-09
  - OFF-08
decisions:
  resolves_open_question_q1: "Cursor extension shape for sort-key inclusion. Extend Phase 2 D-36 cursor format from `base64(JSON.stringify({ id, createdAt }))` to `base64(JSON.stringify({ id, createdAt, sortKey, sortValue }))`. `sortKey` ∈ {'acquired_desc' | 'acquired_asc' | 'name_asc' | 'name_desc' | 'location_asc' | 'created_desc'} (catalog-only set; CAT-08 5b plans extend the union if needed). `sortValue` is the sort column's value at the cursor row, encoded as ISO-8601 string for dates / lowercased string for text. Decoder rejects unknown sortKey with `validation_failed`. Universal tiebreaker remains `(created_at DESC, id DESC)`. Phase 2 D-36 amendment captured in this plan's decisions; supersedes-note in 05-RESEARCH supplement."
  pending_storage_deletions_schema: "Catalog-local outbox table per CONTEXT D-04 fallback path. Columns: id uuid PK gen_random_uuid(), user_id uuid NOT NULL → users(id) ON DELETE CASCADE, plant_id uuid NOT NULL (no FK — the plant row is being deleted in the same transaction), storage_paths text[] NOT NULL CHECK(cardinality(storage_paths) > 0), status varchar(16) NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','dispatching','complete','failed')), created_at timestamptz NOT NULL DEFAULT now(), dispatched_at timestamptz NULL, completed_at timestamptz NULL, last_error text NULL. Index on (status, created_at) for the reconciler scan. **Codex review HIGH 05-02**: `array_length(storage_paths, 1)` returns NULL for empty arrays in Postgres, defeating the non-empty CHECK; replaced with `cardinality(storage_paths)` (NULL-safe — returns 0 for empty arrays). **Codex review HIGH 05-06**: `dispatched_at` column added so the reconciler can skip recently-dispatched rows (prevents repeated re-dispatch on every cron tick); `dispatching` is also added to the status CHECK enum so the reconciler can mark rows in-flight via UPDATE before sending the Inngest event."
  schema_push_command: "npx drizzle-kit push --force (non-TTY); BLOCKING — Phase 5 cannot pass verification without the live DB schema matching the .ts schema. Build/typecheck pass without the push (types come from the file, not the DB), creating a false-positive verification state."
  cursor_helper_path: "src/shared/api/cursor.ts (NOT src/shared/db/) — cursor is an API concern, not a DB concern. Phase 2 D-36 left placement open; Phase 5 picks api/ to match Phase 2 D-19 (domain-layer Zod schemas; api-layer cursors)."
must_haves:
  truths:
    - "src/contexts/catalog/infrastructure/db/schema.ts exports the `pendingStorageDeletions` Drizzle table with the columns and indexes specified in `decisions.pending_storage_deletions_schema`"
    - "Codex 05-02 HIGH: the schema CHECK constraint on storage_paths uses `cardinality(storage_paths) > 0` (NOT `array_length(storage_paths, 1) > 0`); migration SQL grep-asserts this exact text"
    - "Codex 05-06 HIGH: the schema includes `dispatched_at timestamptz NULL` column and the (status, created_at) index PLUS a separate index on (dispatched_at); the status CHECK enum includes 'dispatching'"
    - "src/shared/api/cursor.ts exports `encodeCursor({ id, createdAt, sortKey, sortValue })` and `decodeCursor(cursor: string)` returning the same shape; round-trip is lossless for all 6 sortKey values"
    - "decodeCursor throws an error with the literal string `validation_failed` (or returns a typed result the route handler maps to `validation_failed`) for malformed base64, malformed JSON, missing fields, or unknown sortKey"
    - "drizzle/migrations contains a generated migration whose SQL CREATEs `pending_storage_deletions` with `cardinality(storage_paths) > 0` CHECK + (status, created_at) index + dispatched_at column + (dispatched_at) index"
    - "After `pnpm db:setup` (or `npx drizzle-kit push --force`), the live DB has the table; integration test connects and successfully INSERTs + SELECTs a row whose `dispatched_at` defaults to NULL"
    - "Codex Decision 6 storage path format: integration test fixtures use bucket-relative `{userId}/{plantId}/{file}` paths — NO bucket prefix (`plant-photos/...`) anywhere in path string values"
    - "Phase 2 D-36 cursor format remains backward-compatible: a legacy cursor with only `{ id, createdAt }` decodes successfully with `sortKey` defaulting to 'created_desc' and `sortValue` defaulting to `createdAt`"
  artifacts:
    - path: "src/contexts/catalog/infrastructure/db/schema.ts"
      provides: "Drizzle table definition for pending_storage_deletions appended to (or co-located with) the catalog schema; preserves Phase 2 wave-2 plants + photo_entries definitions"
      contains: "pending_storage_deletions"
    - path: "src/shared/api/cursor.ts"
      provides: "encodeCursor / decodeCursor functions + ExtendedCursor type"
      min_lines: 50
    - path: "drizzle/migrations"
      provides: "drizzle-kit generated migration including CREATE TABLE pending_storage_deletions"
      contains: "pending_storage_deletions"
    - path: "tests/unit/shared/api/cursor.test.ts"
      provides: "TDD test suite covering: round-trip for all 6 sortKey values; legacy 2-field cursor compat; malformed base64; malformed JSON; unknown sortKey; missing fields"
      min_lines: 80
    - path: "tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts"
      provides: "real-Postgres integration test inserting a pending row + verifying the (status, created_at) index exists via pg_indexes"
      min_lines: 30
  key_links:
    - from: "src/shared/api/cursor.ts"
      to: "Phase 2 D-36 cursor contract"
      via: "extends the documented format with sortKey + sortValue while preserving legacy 2-field decode"
      pattern: "ExtendedCursor"
    - from: "src/contexts/catalog/infrastructure/db/schema.ts"
      to: "drizzle/migrations"
      via: "drizzle-kit generate emits the CREATE TABLE statement"
      pattern: "pending_storage_deletions"
    - from: "src/contexts/catalog/infrastructure/db/schema.ts (live DB)"
      to: "src/contexts/catalog/infrastructure/db/schema.ts (file)"
      via: "npx drizzle-kit push --force after schema modification"
      pattern: "drizzle-kit push"
---

<objective>
Add the `pending_storage_deletions` outbox table to the catalog Drizzle schema (per CONTEXT D-04 fallback path) and ship the extended cursor encoder/decoder (resolves Open Question Q1 — extending Phase 2 D-36 to encode sort-key + sort-value alongside id + createdAt). TDD-styled: cursor encoder/decoder is the single feature with crisp I/O, perfect for RED→GREEN→REFACTOR. Schema migration is the supporting work; the [BLOCKING] `npx drizzle-kit push --force` task lands the DDL into the live DB so subsequent plans can write integration tests against a real table.

Purpose: the outbox table is the source of truth for asynchronous storage cleanup (CAT-09 / Pitfall 4). The extended cursor unblocks CAT-07 + CAT-08 server-side sorting — without sortKey + sortValue in the cursor payload, pagination drifts when sort-column values repeat (Pitfall 5).

Output: schema.ts extended with one new table, drizzle migration generated and applied to the live DB, cursor.ts shipped with TDD test coverage, integration test confirming the table is real.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/02-data-layer/02-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-01-wave0-test-infra-PLAN.md

<interfaces>
<!-- Key Phase 2 contracts and the Phase 5 cursor extension. Executor MUST follow these exactly. -->

From Phase 2 D-01 (per-context schema ownership):
- src/contexts/catalog/infrastructure/db/schema.ts is OWNED by the catalog context
- Phase 2 wave 2 (Plan 02-02) writes the initial plants + photo_entries table definitions
- Phase 5 EXTENDS the same file by appending pendingStorageDeletions

From Phase 2 D-36 (the format Phase 5 extends):
- Original cursor: base64(JSON.stringify({ id, createdAt }))
- Phase 5 extension (Q1 resolution): base64(JSON.stringify({ id, createdAt, sortKey, sortValue }))

Phase 5 cursor type contract (this plan ships):
```ts
export type SortKey =
  | "acquired_desc"
  | "acquired_asc"
  | "name_asc"
  | "name_desc"
  | "location_asc"
  | "created_desc";

export type ExtendedCursor = {
  id: string;          // uuid
  createdAt: string;   // ISO-8601 UTC with Z
  sortKey: SortKey;
  sortValue: string | null; // null when the sort column is NULL for the cursor row (e.g., acquisition_date NULL)
};

export function encodeCursor(c: ExtendedCursor): string;
export function decodeCursor(raw: string): ExtendedCursor;
// decodeCursor accepts legacy 2-field cursors and upgrades them to { ..., sortKey: "created_desc", sortValue: createdAt }
// decodeCursor throws an Error with message "validation_failed" on any failure (malformed base64, JSON, missing/unknown fields)
```

From Phase 2 D-43 (transaction-rollback integration tests):
- Use the tests/helpers/transaction-rollback.ts helper from Plan 05-01
- Wrap each `it(...)` body in `await withRollback(sql, async (tx) => { ... })`

Drizzle table shape (final form to land in src/contexts/catalog/infrastructure/db/schema.ts):
```ts
import { pgTable, uuid, varchar, text, timestamp, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "@contexts/iam/infrastructure/db/schema"; // Phase 2 wave 2 ships this

export const pendingStorageDeletions = pgTable(
  "pending_storage_deletions",
  {
    id: uuid("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    plantId: uuid("plant_id").notNull(), // NO FK — plant row is being deleted in the same transaction
    storagePaths: text("storage_paths").array().notNull(),
    status: varchar("status", { length: 16 }).notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    dispatchedAt: timestamp("dispatched_at", { withTimezone: true }), // Codex 05-06: reconciler skips rows where dispatched_at is recent
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastError: text("last_error"),
  },
  (t) => ({
    statusCreatedAtIdx: index("pending_storage_deletions_status_created_at_idx").on(t.status, t.createdAt),
    // Codex 05-06: also index dispatched_at for the reconciler scan
    dispatchedAtIdx: index("pending_storage_deletions_dispatched_at_idx").on(t.dispatchedAt),
    // Codex 05-02 + 05-06: 'dispatching' state for in-flight rows the reconciler has claimed
    statusCheck: check("pending_storage_deletions_status_check", sql`${t.status} IN ('pending','dispatching','complete','failed')`),
    // Codex 05-02 HIGH: array_length returns NULL for empty arrays in Postgres, defeating the constraint.
    // cardinality(text[]) returns 0 for empty arrays — NULL-safe.
    pathsNonEmpty: check("pending_storage_deletions_paths_nonempty", sql`cardinality(${t.storagePaths}) > 0`),
  }),
);
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — write the cursor encoder/decoder TDD test suite (must fail)</name>
  <files>tests/unit/shared/api/cursor.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 5: Cursor pagination instability on duplicate acquisition_date"
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Open Questions item 1 (cursor format extension)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-36 (the Phase 2 cursor format being extended)
    - tests/unit/errors.test.ts (existing Vitest convention; describe + it.each style; relative imports vs path aliases)
    - tests/unit/setup-env.ts (env-var setup; not directly needed but understand the unit-project shape)
  </read_first>
  <behavior>
    The cursor module exposes `encodeCursor` and `decodeCursor`.

    - Test 1: round-trip for sortKey="acquired_desc" with sortValue="2026-04-12T10:00:00.000Z" returns identical input
    - Test 2: round-trip for sortKey="acquired_desc" with sortValue=null (acquisition_date NULL) returns identical input
    - Test 3: round-trip for sortKey="acquired_asc" returns identical input
    - Test 4: round-trip for sortKey="name_asc" with sortValue="ficus lyrata" (lowercased) returns identical input
    - Test 5: round-trip for sortKey="name_desc" returns identical input
    - Test 6: round-trip for sortKey="location_asc" with sortValue="sala" returns identical input
    - Test 7: round-trip for sortKey="created_desc" with sortValue equal to createdAt returns identical input
    - Test 8: legacy 2-field cursor `base64(JSON.stringify({ id, createdAt }))` decodes to `{ id, createdAt, sortKey: "created_desc", sortValue: createdAt }`
    - Test 9: malformed base64 input throws Error with message containing "validation_failed"
    - Test 10: valid base64 wrapping malformed JSON throws Error with message "validation_failed"
    - Test 11: valid JSON missing `id` field throws "validation_failed"
    - Test 12: valid JSON missing `createdAt` field throws "validation_failed"
    - Test 13: valid JSON with unknown `sortKey` value throws "validation_failed"
    - Test 14: encoded output is a string of only base64-safe characters (matches /^[A-Za-z0-9+/=]+$/)
  </behavior>
  <action>
    Create tests/unit/shared/api/cursor.test.ts with 14 test cases as listed in `<behavior>`. Use `describe` + `it`/`it.each` style (matches tests/unit/errors.test.ts). Import `encodeCursor`, `decodeCursor`, and `SortKey` type from `../../../../src/shared/api/cursor` (relative path; project tsconfig.json paths only declares @contexts/* / @shared/* / @i18n/*, so `@shared/api/cursor` IS available — prefer the alias).

    The file MUST cause Vitest to FAIL because `src/shared/api/cursor.ts` does NOT exist yet. Verify failure mode is "module not found", not a syntax error.

    Commit with message: `test(05-02): add failing tests for extended cursor encoder/decoder` (lowercase per Plan 01-05a commitlint subject-case fix).
  </action>
  <acceptance_criteria>
    - tests/unit/shared/api/cursor.test.ts exists
    - File contains 14 distinct `it(...)` or `it.each(...)` cases (grep -c `it(\|it\.each(` returns ≥ 14 from non-comment lines)
    - File imports from `@shared/api/cursor` (or relative path equivalent)
    - `pnpm exec vitest --run --project=unit tests/unit/shared/api/cursor.test.ts` exits NON-ZERO with "Cannot find module" or "Failed to resolve import" error mentioning `cursor` (RED phase confirmed)
    - git log shows commit subject `test(05-02): add failing tests for extended cursor encoder/decoder`
  </acceptance_criteria>
  <verify>
    <automated>node -e "if(!require('fs').existsSync('tests/unit/shared/api/cursor.test.ts')) process.exit(1); const c=require('fs').readFileSync('tests/unit/shared/api/cursor.test.ts','utf-8').split('\n').filter(l => !l.trim().startsWith('//')).join('\n'); const m=c.match(/\bit(\.each)?\s*\(/g) || []; if (m.length < 14) { console.error('only',m.length,'cases'); process.exit(2); }" && (pnpm exec vitest --run --project=unit tests/unit/shared/api/cursor.test.ts; if [ $? -eq 0 ]; then echo "RED phase failed: tests passed when they should fail"; exit 3; fi; exit 0)</automated>
  </verify>
  <done>cursor.test.ts exists with 14 cases; vitest run exits non-zero (module not found); git commit recorded with the RED subject.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — implement src/shared/api/cursor.ts so all 14 tests pass</name>
  <files>src/shared/api/cursor.ts</files>
  <read_first>
    - tests/unit/shared/api/cursor.test.ts (the test suite from Task 1 — implementation must satisfy ALL 14 cases)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-36 (legacy 2-field cursor — `base64(JSON.stringify({ id, createdAt }))`)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Open Question 1 (the recommended shape `{ id, createdAt, sortKey, sortValue }`)
    - tsconfig.json (verify `@shared/*` path alias maps to `src/shared/*` and is usable from src/shared/api/)
  </read_first>
  <action>
    Create src/shared/api/cursor.ts (~60 lines) implementing the contract specified in the `<interfaces>` block of `<context>`. Implementation outline:

    ```ts
    export type SortKey =
      | "acquired_desc"
      | "acquired_asc"
      | "name_asc"
      | "name_desc"
      | "location_asc"
      | "created_desc";

    const SORT_KEYS: ReadonlySet<SortKey> = new Set([
      "acquired_desc",
      "acquired_asc",
      "name_asc",
      "name_desc",
      "location_asc",
      "created_desc",
    ]);

    export type ExtendedCursor = {
      id: string;
      createdAt: string;
      sortKey: SortKey;
      sortValue: string | null;
    };

    export function encodeCursor(c: ExtendedCursor): string {
      return Buffer.from(JSON.stringify(c), "utf-8").toString("base64");
    }

    export function decodeCursor(raw: string): ExtendedCursor {
      let json: string;
      try {
        json = Buffer.from(raw, "base64").toString("utf-8");
      } catch {
        throw new Error("validation_failed");
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("validation_failed");
      }
      if (!parsed || typeof parsed !== "object") throw new Error("validation_failed");
      const obj = parsed as Record<string, unknown>;
      if (typeof obj.id !== "string" || obj.id === "") throw new Error("validation_failed");
      if (typeof obj.createdAt !== "string" || obj.createdAt === "") throw new Error("validation_failed");

      // Legacy 2-field upgrade
      if (obj.sortKey === undefined && obj.sortValue === undefined) {
        return {
          id: obj.id,
          createdAt: obj.createdAt,
          sortKey: "created_desc",
          sortValue: obj.createdAt,
        };
      }

      if (typeof obj.sortKey !== "string" || !SORT_KEYS.has(obj.sortKey as SortKey)) {
        throw new Error("validation_failed");
      }
      if (obj.sortValue !== null && typeof obj.sortValue !== "string") {
        throw new Error("validation_failed");
      }
      return {
        id: obj.id,
        createdAt: obj.createdAt,
        sortKey: obj.sortKey as SortKey,
        sortValue: obj.sortValue as string | null,
      };
    }
    ```

    Run the test suite: `pnpm exec vitest --run --project=unit tests/unit/shared/api/cursor.test.ts`. All 14 tests MUST pass. If any fail, fix the implementation (NOT the test); the tests are the spec.

    Commit with message: `feat(05-02): implement extended cursor encoder/decoder with legacy compat`.
  </action>
  <acceptance_criteria>
    - src/shared/api/cursor.ts exists
    - File exports `encodeCursor`, `decodeCursor`, `SortKey` type, `ExtendedCursor` type (grep for each)
    - File contains all 6 SortKey literals: `acquired_desc`, `acquired_asc`, `name_asc`, `name_desc`, `location_asc`, `created_desc`
    - `pnpm exec vitest --run --project=unit tests/unit/shared/api/cursor.test.ts` exits 0 with 14 passing tests (GREEN phase confirmed)
    - `pnpm exec tsc --noEmit` exits 0
    - git log shows commit subject `feat(05-02): implement extended cursor encoder/decoder with legacy compat`
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/shared/api/cursor.test.ts && pnpm exec tsc --noEmit && grep -q "encodeCursor" src/shared/api/cursor.ts && grep -q "decodeCursor" src/shared/api/cursor.ts && grep -q "acquired_desc" src/shared/api/cursor.ts</automated>
  </verify>
  <done>cursor.ts exists with the named exports; all 14 tests pass; tsc clean; commit recorded with the GREEN subject.</done>
</task>

<task type="auto">
  <name>Task 3: Add pending_storage_deletions table to catalog schema + generate Drizzle migration</name>
  <files>src/contexts/catalog/infrastructure/db/schema.ts, drizzle/migrations</files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/schema.ts (the file Phase 2 wave 2 ships; READ THE EXISTING CONTENT before appending; preserve every existing export)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-01 (per-context schema ownership), D-04 (varchar + CHECK over enum), D-07 (FK actions), D-10 (RLS policies in same migration stream)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-04 (the outbox table requirement and its purpose)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pattern 5: Atomic plant DELETE" (how the table is consumed)
    - drizzle.config.ts (Phase 2 wave 1 ships; verify `out: "./drizzle/migrations"` and the `schema:` glob)
  </read_first>
  <action>
    1. Read the current src/contexts/catalog/infrastructure/db/schema.ts. Append (do NOT replace existing content) the `pendingStorageDeletions` table definition shown in `<interfaces>` above. The import for `users` must come from `@contexts/iam/infrastructure/db/schema` (Phase 2 wave 2 owns it).

       Do NOT add an RLS policy for `pending_storage_deletions` in this task; the table is server-side only (writes via service-role through the use-case). Mark this in the schema with a comment: `// RLS: not applicable — service-role-only writes from delete-plant use case (Phase 5 D-04)`. RLS for the table can be added in a follow-up if Phase 6+ ever exposes it to clients.

    2. Run `pnpm exec drizzle-kit generate --name catalog_pending_storage_deletions` (Phase 2 ships the script alias as `pnpm db:generate` per 02-CONTEXT specifics; use whichever is wired). This emits a new SQL file under drizzle/migrations/.

    3. Inspect the generated SQL — verify it contains: `CREATE TABLE "pending_storage_deletions"`, the `(status, created_at)` index, the status CHECK, the array-length CHECK, and the FK to users. If the generator omitted any of those, hand-edit the SQL file (drizzle-kit sometimes drops CHECK constraints on first generation — known behavior).

    4. Run `pnpm exec tsc --noEmit` to confirm the schema compiles.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/infrastructure/db/schema.ts contains literal `pendingStorageDeletions` AND `pending_storage_deletions` (TS export name + DB table name)
    - src/contexts/catalog/infrastructure/db/schema.ts STILL contains the existing exports from Phase 2 wave 2 (verify by checking export count is greater than the Phase 2 baseline; minimum: `plants` and `photoEntries`/`photo_entries`)
    - drizzle/migrations contains a SQL file mentioning `CREATE TABLE "pending_storage_deletions"` (or with quoting variants)
    - The new migration SQL contains `pending_storage_deletions_status_created_at_idx` (the index name)
    - The new migration SQL references `pending_storage_deletions_status_check` (status CHECK constraint)
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "pendingStorageDeletions" src/contexts/catalog/infrastructure/db/schema.ts && grep -q "pending_storage_deletions" src/contexts/catalog/infrastructure/db/schema.ts && grep -rl "CREATE TABLE.*pending_storage_deletions" drizzle/migrations && grep -rl "pending_storage_deletions_status_created_at_idx" drizzle/migrations && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>Schema file appended with the new table, migration SQL generated, all CHECK constraints + index present in the SQL, tsc clean. Existing Phase 2 schema content preserved.</done>
</task>

<task type="auto" gate="blocking">
  <name>Task 4: [BLOCKING] npx drizzle-kit push --force — apply schema to live local DB</name>
  <files>(no source files modified; mutates live local DB via supabase start)</files>
  <read_first>
    - .planning/STATE.md "Plan 01-04: postgres@3.4.9 pinned exactly ... tracks supabase/config.toml ... Live Postgres reports server_version_num = 170006" — confirms local DB is up
    - drizzle.config.ts (Phase 2 wave 1; verify it points at DATABASE_URL not DATABASE_POOL_URL)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-04 (why the table must exist in the live DB before subsequent plans can write integration tests)
    - planning_context schema_push_requirement block (Phase 5 BLOCKING gate explicit instructions)
  </read_first>
  <action>
    BLOCKING gate: this task MUST complete successfully before any subsequent plan in waves 1-3 runs against the live DB.

    1. Verify local Supabase is running: `pnpm db:start` (idempotent — exits 0 if already running).
    2. Run `npx drizzle-kit push --force` (the `--force` flag suppresses interactive prompts per the planning_context schema_push_requirement).
    3. Verify the table is live: connect via `psql "$DATABASE_URL" -c "\\d pending_storage_deletions"` — output must list the table with all 8 columns AND the `pending_storage_deletions_status_created_at_idx` index.
    4. Spot-check the constraints: `psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conrelid = 'pending_storage_deletions'::regclass"` — output must include `pending_storage_deletions_status_check` and `pending_storage_deletions_paths_nonempty`.

    If `npx drizzle-kit push --force` returns a non-zero exit code, do NOT proceed to Task 5. Read the error, diagnose (most common: Phase 2 wave 1's drizzle.config.ts is misconfigured, or the users table FK target doesn't exist yet because Phase 2 wave 2 hasn't landed). Document the failure in the SUMMARY and STOP.
  </action>
  <acceptance_criteria>
    - `psql "$DATABASE_URL" -c "\\d pending_storage_deletions"` exits 0 and output contains literal `pending_storage_deletions`
    - `psql "$DATABASE_URL" -c "SELECT 1 FROM pg_class WHERE relname = 'pending_storage_deletions'"` returns one row
    - `psql "$DATABASE_URL" -c "SELECT 1 FROM pg_indexes WHERE indexname = 'pending_storage_deletions_status_created_at_idx'"` returns one row
    - `psql "$DATABASE_URL" -c "SELECT conname FROM pg_constraint WHERE conrelid = 'pending_storage_deletions'::regclass AND contype = 'c'"` output contains both `_status_check` and `_paths_nonempty`
  </acceptance_criteria>
  <verify>
    <automated>psql "$DATABASE_URL" -c "\\d pending_storage_deletions" >/dev/null 2>&1 && psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_class WHERE relname = 'pending_storage_deletions'" | grep -q "1" && psql "$DATABASE_URL" -t -c "SELECT count(*) FROM pg_indexes WHERE indexname = 'pending_storage_deletions_status_created_at_idx'" | grep -q "1"</automated>
  </verify>
  <done>Live DB has the pending_storage_deletions table + index + both CHECK constraints. drizzle-kit push --force exited 0.</done>
</task>

<task type="auto">
  <name>Task 5: Integration test confirming the live table accepts a row + index exists</name>
  <files>tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts</files>
  <read_first>
    - tests/integration/postgres-connection.integration.test.ts:1-34 (driver-options pattern: prepare:false, max:1, idle_timeout:5)
    - tests/helpers/db-guard.ts (Plan 05-01 — assertLocalDb())
    - tests/helpers/transaction-rollback.ts (Plan 05-01 — withRollback wrapper)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-43 (transaction-rollback per test)
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Integration tests under tests/integration/catalog/" (cloud-DB guard MANDATORY)
  </read_first>
  <action>
    Create tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts (~50 lines):

    ```ts
    import { describe, it, expect, beforeAll, afterAll } from "vitest";
    import postgres from "postgres";
    import { assertLocalDb } from "../../helpers/db-guard";
    import { withRollback } from "../../helpers/transaction-rollback";

    const dbUrl = (() => {
      try { return assertLocalDb(); } catch { return null; }
    })();

    describe.skipIf(!dbUrl)("pending_storage_deletions schema (live DB)", () => {
      let sql: ReturnType<typeof postgres>;

      beforeAll(() => {
        sql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      });

      afterAll(async () => {
        await sql.end({ timeout: 5 });
      });

      it("(status, created_at) index exists", async () => {
        const rows = await sql`
          SELECT indexname FROM pg_indexes
          WHERE indexname = 'pending_storage_deletions_status_created_at_idx'
        `;
        expect(rows.length).toBe(1);
      });

      it("accepts a pending row + reads it back", async () => {
        await withRollback(sql, async (tx) => {
          // Use a uuid that ALSO exists in users — Phase 2 wave 2 seeds at least one user, OR use a fresh uuid and rely on the FK CASCADE to a real seed user.
          // For schema-shape verification, insert with a synthesized user-row first inside the rollback transaction.
          const userRow = await tx`
            INSERT INTO users (id, email)
            VALUES (gen_random_uuid(), 'plan-05-02-schema-test@example.com')
            RETURNING id
          `;
          const userId = userRow[0]!.id;

          // Codex 05-02 (Decision 6): storage paths are bucket-relative — `{user_id}/{plant_id}/{file}` form, NO bucket prefix.
          const plantId = "11111111-1111-1111-1111-111111111111";
          const path = `${userId}/${plantId}/photo-1.jpg`;
          const inserted = await tx`
            INSERT INTO pending_storage_deletions
              (user_id, plant_id, storage_paths, status)
            VALUES
              (${userId}, ${plantId}::uuid, ARRAY[${path}], 'pending')
            RETURNING id, status, storage_paths, created_at, dispatched_at
          `;
          expect(inserted.length).toBe(1);
          expect(inserted[0]!.status).toBe("pending");
          expect(inserted[0]!.storage_paths).toEqual([path]);
          expect(inserted[0]!.created_at).toBeInstanceOf(Date);
          // Codex 05-06: dispatched_at defaults to NULL on insert
          expect(inserted[0]!.dispatched_at).toBeNull();
        });
      });

      it("rejects empty storage_paths array (CHECK constraint)", async () => {
        await withRollback(sql, async (tx) => {
          const userRow = await tx`
            INSERT INTO users (id, email)
            VALUES (gen_random_uuid(), 'plan-05-02-check-test@example.com')
            RETURNING id
          `;
          const userId = userRow[0]!.id;

          let threw = false;
          try {
            await tx`
              INSERT INTO pending_storage_deletions
                (user_id, plant_id, storage_paths, status)
              VALUES
                (${userId}, gen_random_uuid(), ARRAY[]::text[], 'pending')
            `;
          } catch (e) {
            threw = true;
            expect(String(e)).toMatch(/check|constraint/i);
          }
          expect(threw).toBe(true);
        });
      });

      it("rejects unknown status value (CHECK constraint)", async () => {
        await withRollback(sql, async (tx) => {
          const userRow = await tx`
            INSERT INTO users (id, email)
            VALUES (gen_random_uuid(), 'plan-05-02-status-test@example.com')
            RETURNING id
          `;
          const userId = userRow[0]!.id;

          let threw = false;
          try {
            await tx`
              INSERT INTO pending_storage_deletions
                (user_id, plant_id, storage_paths, status)
              VALUES
                (${userId}, gen_random_uuid(), ARRAY['x'], 'unknown_status')
            `;
          } catch (e) {
            threw = true;
            expect(String(e)).toMatch(/check|constraint/i);
          }
          expect(threw).toBe(true);
        });
      });
    });
    ```

    Run: `pnpm test:integration tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts`. All 4 tests MUST pass. The transaction-rollback wrapper ensures DB state is clean across tests.

    Commit with message: `test(05-02): integration coverage for pending_storage_deletions schema`.
  </action>
  <acceptance_criteria>
    - tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts exists
    - File imports `assertLocalDb` from `../../helpers/db-guard` AND `withRollback` from `../../helpers/transaction-rollback`
    - File contains 4 `it(...)` cases (index existence, INSERT happy path, empty-paths CHECK rejection, unknown-status CHECK rejection)
    - `pnpm exec vitest --run --project=integration tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts` exits 0 with 4 passing tests
    - git log shows commit subject `test(05-02): integration coverage for pending_storage_deletions schema`
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec vitest --run --project=integration tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts</automated>
  </verify>
  <done>4 integration tests pass against the live local DB; transaction rollback keeps state clean; commit recorded.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-09" severity="medium" stride="T">
  <description>Tampering — malformed cursor injected by client. A user can craft a base64 payload containing a JSON object with extra fields, type confusions (sortValue: { $where: ... }), or unknown sortKey values trying to alter server-side ORDER BY logic.</description>
  <mitigation file="src/shared/api/cursor.ts">decodeCursor performs strict shape validation: requires non-empty string id, non-empty string createdAt, sortKey ∈ closed set of 6 literals, sortValue ∈ string|null. Any deviation throws Error("validation_failed") which the route handler maps to closed-registry ErrorCode.ValidationFailed. No unknown fields propagate to the SQL ORDER BY; the consuming repository (Plan 05-03) takes only the validated SortKey union as input.</mitigation>
</threat>

<threat id="T-5-10" severity="low" stride="I">
  <description>Information Disclosure — cursor opacity. If decodeCursor exposes internal field names (e.g. via error messages echoing the parsed object), clients could enumerate the cursor schema and build crafted cursors that probe pagination edges.</description>
  <mitigation file="src/shared/api/cursor.ts">decodeCursor throws a single uniform Error("validation_failed") on every failure mode (bad base64, bad JSON, missing field, unknown sortKey). Message contains zero internal-state echo. Per Phase 5 PRD §5 closed error registry: clients see only `validation_failed` in the response body, never the cursor's contents.</mitigation>
</threat>

<threat id="T-5-11" severity="low" stride="I">
  <description>Information Disclosure — pending_storage_deletions table content. A future client-facing endpoint that exposes pending deletion job rows would leak which plants a user has deleted (and when) plus the raw storage paths (which embed user_id and plant_id).</description>
  <mitigation file="src/contexts/catalog/infrastructure/db/schema.ts">Table is documented as service-role-only (no RLS policy is added in Plan 05-02, and no Phase 5 route handler queries the table — only the use-case in Plan 05-06 and the Inngest function in Plan 05-06 read from it via service-role). If Phase 6+ ever adds a client-facing endpoint, RLS policy + repository userId filter must be added in that phase. Schema comment in the file states this constraint explicitly.</mitigation>
</threat>
</threat_model>

<verification>
After all five tasks land:
1. `pnpm exec vitest --run --project=unit tests/unit/shared/api/cursor.test.ts` exits 0 with 14 passing tests.
2. `pnpm exec vitest --run --project=integration tests/integration/catalog/pending-storage-deletions-schema.integration.test.ts` exits 0 with 4 passing tests.
3. `pnpm exec tsc --noEmit` exits 0.
4. `psql "$DATABASE_URL" -c "\\d pending_storage_deletions"` shows the table with 9 columns (incl. `dispatched_at`) + 2 indexes + 2 CHECK constraints.
5. drizzle/migrations contains a generated SQL file for the new table.
6. **Codex 05-02 grep gate**: `grep -E "cardinality\\(.*storage_paths" drizzle/migrations/*.sql` matches AND `grep -E "array_length\\(.*storage_paths.*1\\)" drizzle/migrations/*.sql` returns 0 matches.
7. **Codex 05-06 grep gate**: `grep -E "dispatched_at" drizzle/migrations/*.sql` matches AND `grep -E "dispatched_at" src/contexts/catalog/infrastructure/db/schema.ts` matches.
8. git log shows three commits: RED (failing test), GREEN (implementation), and the integration-test commit.
</verification>

<reviews_addressed>
**Codex review findings resolved by this plan (per `.planning/phases/05-catalog-meu-jardim/05-REVIEWS.md`):**

- **05-02 HIGH — `array_length(storage_paths, 1) > 0` returns NULL for empty arrays in Postgres, defeating the non-empty CHECK**: Resolved by replacing the predicate with `cardinality(storage_paths) > 0` (NULL-safe — returns 0 for empty arrays). Updated in `decisions.pending_storage_deletions_schema`, the Drizzle table snippet (`<interfaces>`), and verification grep gates.
- **05-06 HIGH — reconciler references missing `dispatched_at` column**: Resolved by adding `dispatched_at timestamptz NULL` column to the `pending_storage_deletions` table in this plan, plus a separate index on `dispatched_at`, plus expanding the status CHECK enum to include `'dispatching'` so the reconciler can mark in-flight rows. Plan 05-03 ships `markDispatched(tx, id)` repo helper; Plan 05-06 wires it into the dispatch flow.
- **Decision 6 — canonical storage path format `{user_id}/{aggregate_id}/{file_id}.{ext}`**: Integration test fixtures changed from `'plant-photos/u/p/x.jpg'` (bucket-prefixed, ambiguous) to `${userId}/${plantId}/photo-1.jpg` (bucket-relative, matches Phase 2 D-27 verbatim). All path strings inside any test's expected values use this format; no bucket prefix appears in any path value.
</reviews_addressed>

<success_criteria>
- src/shared/api/cursor.ts ships with `encodeCursor` + `decodeCursor` + `SortKey` + `ExtendedCursor`, all 14 unit tests pass.
- Decoder accepts legacy 2-field cursors (Phase 2 D-36 backward compat) and rejects unknown sortKey / malformed input with `validation_failed`.
- src/contexts/catalog/infrastructure/db/schema.ts extended with `pendingStorageDeletions` table; existing Phase 2 wave-2 schema content preserved.
- Drizzle migration generated AND applied to live DB via [BLOCKING] `npx drizzle-kit push --force`.
- Integration test confirms table is live, accepts pending rows, rejects empty paths array + unknown status.
- Open Question Q1 resolved: cursor format is `base64(JSON.stringify({ id, createdAt, sortKey, sortValue }))`.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-02-SUMMARY.md` capturing:
- The exact ExtendedCursor type signature shipped (so Plans 05-03, 05-07, 05-08 can reference it without rediscovery)
- Confirmation that the legacy 2-field cursor decode path works (Phase 2 D-36 still callable)
- The drizzle migration filename + path so 05-06 (delete + Inngest) can reference the schema
- A note for Plan 05-03: the `pendingStorageDeletions` Drizzle table object is exported from `src/contexts/catalog/infrastructure/db/schema.ts` and consumed by the `pending-storage-deletions.ts` repository
- An amendment note pointing to this plan's `decisions.resolves_open_question_q1` block — Phase 2 D-36 is now extended, not replaced
</output>
