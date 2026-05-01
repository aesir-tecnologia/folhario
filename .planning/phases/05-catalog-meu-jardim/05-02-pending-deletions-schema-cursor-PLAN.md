---
phase: 05-catalog-meu-jardim
plan: 02
type: execute
wave: 1
depends_on: ["05-01"]
files_modified:
  - src/contexts/catalog/infrastructure/db/schema.ts
  - drizzle/migrations/XXXX_add_pending_storage_deletions.sql
  - drizzle/migrations/XXXX_add_location_suggestions.sql
  - drizzle/migrations/meta/_journal.json
  - src/shared/api/cursor.ts
  - src/shared/api/cursor.test.ts
  - tests/integration/catalog-phase5-rls.integration.test.ts
autonomous: true
requirements:
  - "CAT-09 (partial — storage scheduling row only; cleanup behavior closes in 05-06)"
  - "OFF-08 (cursor used by SWR cache key + offline pagination key stability)"
tags: [catalog, schema, drizzle, rls, cursor, pagination]
must_haves:
  truths:
    - "The Drizzle catalog schema declares pending_storage_deletions, location_suggestions, and the pending_deletion_status pgEnum (D-23, D-09)"
    - "pending_storage_deletions has a started_at: timestamptz NULL column; it is set during markInProgress calls (by 05-03/05-06) and used by the reconciler in 05-06 to detect stale in_progress rows (rows where started_at < NOW() - INTERVAL 30 minutes)"
    - "Two new SQL migration files exist with idempotent owner-only RLS policy blocks following the Plan 02 pattern"
    - "Live Postgres has the pending_deletion_status enum type, the pending_storage_deletions table, and the location_suggestions table after pnpm db:migrate"
    - "RLS on both new tables rejects cross-user reads/writes under the authenticated role (defense in depth alongside repo-level user_id filters)"
    - "encodeSortCursor / decodeSortCursor round-trip {sort_id, last_value, last_id} losslessly, including last_value=null (NULLS LAST sentinel) and base64url URL-safe output"
  artifacts:
    - path: "src/contexts/catalog/infrastructure/db/schema.ts"
      provides: "pendingDeletionStatus pgEnum + pendingStorageDeletions + locationSuggestions tables"
      contains: 'pgEnum("pending_deletion_status"'
    - path: "drizzle/migrations/XXXX_add_pending_storage_deletions.sql"
      provides: "Phase 5 migration: pending_deletion_status enum + pending_storage_deletions table + index + RLS"
      contains: 'CREATE TABLE "pending_storage_deletions"'
    - path: "drizzle/migrations/XXXX_add_location_suggestions.sql"
      provides: "Phase 5 migration: location_suggestions table + composite PK + RLS"
      contains: 'CREATE TABLE "location_suggestions"'
    - path: "src/shared/api/cursor.ts"
      provides: "encodeSortCursor / decodeSortCursor + sortCursorPayloadSchema (additive — does NOT replace Phase 2 cursorPayloadSchema)"
      exports: ["encodeSortCursor", "decodeSortCursor", "SortCursorPayload"]
    - path: "src/shared/api/cursor.test.ts"
      provides: "Vitest unit suite covering round-trip + NULLS LAST sentinel + base64url URL-safety + malformed input rejection"
    - path: "tests/integration/catalog-phase5-rls.integration.test.ts"
      provides: "Owner-only RLS proof for both new tables using the rls-real-jwt SET LOCAL ROLE authenticated pattern"
  key_links:
    - from: "src/contexts/catalog/infrastructure/db/schema.ts"
      to: "drizzle/migrations/XXXX_add_pending_storage_deletions.sql + XXXX_add_location_suggestions.sql"
      via: "drizzle-kit generate (two passes, one per migration name) — schema.ts is the source of truth, generate emits SQL"
      pattern: 'pgEnum\\("pending_deletion_status"'
    - from: "drizzle/migrations/XXXX_add_*.sql"
      to: "live Postgres (pending_deletion_status enum + two new tables + RLS)"
      via: "pnpm db:migrate (drizzle-kit migrate, NOT push — Codex HIGH #1 from Plan 04-02)"
      pattern: 'pending_deletion_status::regtype'
    - from: "src/shared/api/cursor.ts encodeSortCursor"
      to: "future plan 05-07 list-plants use-case + plan 05-10 TanStack Query cache key"
      via: "opaque base64url string passed via ?cursor= query param"
      pattern: "encodeSortCursor\\("
---

<objective>
Extend the catalog Drizzle schema with two new tables and one pgEnum (D-23 + D-09), generate two separate Drizzle migrations with hand-appended idempotent owner-only RLS policy blocks, apply them to live Postgres via `drizzle-kit migrate` (NOT `push` — Codex HIGH #1), and add an additive sort-aware cursor codec to `src/shared/api/cursor.ts` (D-12) without disturbing Phase 2's existing `{id, createdAt}` cursor contract.

Purpose: This is the only DB-touching plan in Phase 5. Every later plan in the phase (repos in 05-03, route handlers in 05-08/09, cursor pagination in 05-07/08, TanStack Query cache keys in 05-10) depends on these tables existing in live Postgres and on the sort-aware cursor codec being callable. Without `drizzle-kit migrate` running here, every downstream task would build and typecheck cleanly (Drizzle types come from `schema.ts`, not the live DB) yet fail against the actual database — a false-positive verification trap.

Output: schema.ts extended; two new migration SQL files committed; live Postgres carries the enum, the two tables, the index on `(status, scheduled_at)`, and owner-only RLS; cursor.ts exports `encodeSortCursor` / `decodeSortCursor` alongside the existing helpers; one integration test proves cross-user RLS rejection; one Vitest suite proves cursor round-trip + sentinel + base64url safety.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-PLAN-OUTLINE.md
@.planning/phases/04-iam-auth-verification-consent/04-02-PLAN.md
@CLAUDE.md
@src/contexts/catalog/infrastructure/db/schema.ts
@src/shared/api/cursor.ts
@drizzle/migrations/0001_phase_02_rls_policies.sql
@drizzle/migrations/0003_phase04_iam_extensions.sql
@tests/integration/rls-real-jwt.integration.test.ts

<interfaces>
<!-- Key contracts the executor needs. Use these directly — no codebase exploration. -->

From `src/contexts/catalog/infrastructure/db/schema.ts` (existing — read before editing):
```typescript
import { date, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { users } from "@contexts/iam/infrastructure/db/schema";
import { species } from "@contexts/species-care/infrastructure/db/schema";

export const plants = pgTable("plants", { /* ... existing definition ... */ });
export const photoEntries = pgTable("photo_entries", { /* ... existing definition ... */ });
```
Phase 5 adds (in this same file): `pgEnum`, `integer`, `primaryKey` imports; `pendingDeletionStatus` enum; `pendingStorageDeletions` table; `locationSuggestions` table. NO modification to `plants` or `photoEntries` definitions in this plan.

From `src/shared/api/cursor.ts` (existing — read before editing):
```typescript
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
const cursorPayloadSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime({ offset: false }),
});
export type CursorPayload = z.infer<typeof cursorPayloadSchema>;
export type DecodeResult = { ok: true; value: CursorPayload } | { ok: false; error: typeof ErrorCode.ValidationFailed };
export function encodeCursor(payload: CursorPayload): string;
export function decodeCursor(encoded: string): DecodeResult;
export function normalizeLimit(input: string | number | null | undefined): number;
```
Phase 5 adds NEW additive exports: `sortCursorPayloadSchema`, `SortCursorPayload`, `SortCursorDecodeResult`, `encodeSortCursor`, `decodeSortCursor`. The existing `cursorPayloadSchema` / `CursorPayload` / `encodeCursor` / `decodeCursor` MUST remain unchanged — Phase 2 has consumers that still rely on the `{id, createdAt}` shape.

From `drizzle/migrations/0001_phase_02_rls_policies.sql:120-160` (RLS template — read before authoring new migrations):
```sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'consent_logs_owner_all') THEN
    CREATE POLICY "consent_logs_owner_all" ON public.consent_logs
      FOR ALL TO authenticated
      USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
      WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
  END IF;
END $$;
```
Use this exact `DO $$ BEGIN IF NOT EXISTS ... END IF; END $$` idempotent block for both new tables. Policy names: `pending_storage_deletions_owner_all` and `location_suggestions_owner_all`.

From `tests/integration/rls-real-jwt.integration.test.ts` (RLS test pattern — read before authoring new RLS test):
```typescript
// Two-step pattern (lines ~324-358):
//   await tx.unsafe(`SET LOCAL ROLE authenticated`);
//   await tx.unsafe(`SET LOCAL "request.jwt.claim.sub" = '${userId}'`);
//   // ... run SELECT/INSERT/UPDATE under that role+claim binding
//   // assert the cross-user row is invisible / rejected
```
Reuse this harness for the new tables. The new test must INSERT a row owned by user A under service-role, then attempt to SELECT it under user B's authenticated-role+JWT-claim — must return 0 rows.

From `package.json` (already verified):
```json
"db:migrate": "node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs migrate"
```
The blocking task runs `pnpm db:migrate` — do NOT use `pnpm db:push`. Codex HIGH #1 from Plan 04-02 is binding: hand-appended RLS SQL gets silently skipped by `push` and applied verbatim by `migrate`.
</interfaces>
</context>

<tasks>

<task type="execute">
  <name>Task 1: Extend catalog schema.ts and generate two separate Drizzle migrations with hand-appended owner-only RLS</name>
  <files>
    - src/contexts/catalog/infrastructure/db/schema.ts
    - drizzle/migrations/XXXX_add_pending_storage_deletions.sql (auto-numbered by drizzle-kit; the `XXXX` placeholder becomes the next sequential 4-digit prefix, e.g. `0004`)
    - drizzle/migrations/XXXX_add_location_suggestions.sql (auto-numbered by drizzle-kit; one prefix higher than the file above)
    - drizzle/migrations/meta/_journal.json (drizzle-kit owns this — do NOT hand-edit; verify it grows by two entries)
  </files>
  <read_first>
    - `src/contexts/catalog/infrastructure/db/schema.ts` (entire file — 65 lines; you extend, do not rewrite)
    - `drizzle/migrations/0001_phase_02_rls_policies.sql` lines 120-170 (idempotent `DO $$ BEGIN IF NOT EXISTS` policy block pattern)
    - `drizzle/migrations/0003_phase04_iam_extensions.sql` (full file — 62 lines; pattern of generated SQL + hand-appended `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`)
    - `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` D-09, D-23 (table column contracts — verbatim)
    - `.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md` Pattern 6 lines 502-535 (Drizzle pgEnum + RLS reference shape; note that we use the hand-append-RLS pattern from migrations, NOT `pgPolicy()` in TS, to stay consistent with the existing repo pattern that Plan 04-02's Codex HIGH #1 fix established)
    - `.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md` row 13 (schema.ts extension pattern) and rows 51-52 (migration SQL templates)
  </read_first>
  <action>
    Extend the existing schema.ts and generate two separate migration files. The two-step generate is mandatory because the brief requires two distinct migration filenames (`XXXX_add_pending_storage_deletions.sql` and `XXXX_add_location_suggestions.sql`) — drizzle-kit emits one SQL file per `generate` invocation that captures the diff since the last applied state.

    **Step 1.1 — Extend `src/contexts/catalog/infrastructure/db/schema.ts` (D-23 — pending_storage_deletions):**

    Add to the imports at the top of the file:
    ```typescript
    import {
      date,
      index,
      integer,
      pgEnum,
      pgTable,
      primaryKey,
      text,
      timestamp,
      uuid,
      varchar,
    } from "drizzle-orm/pg-core";
    ```

    Add the enum and the first new table (after the existing `photoEntries` export):
    ```typescript
    /**
     * Pending-deletion state machine for asynchronous storage cleanup.
     *
     * Per phase-5 D-22/D-23: when a Plant is deleted, the same TX inserts
     * one row per affected bucket (plant-photos + plant-thumbnails) with
     * status='pending'. The Inngest event handler `catalog/cleanup-storage`
     * (D-22) and the hourly reconciler cron `catalog/cleanup-storage-reconciler`
     * (D-24) drive rows through pending → in_progress → completed | failed.
     *
     * Phase 11 LGPD bulk deletes reuse this same table for full-account
     * sweeps (the prefix carries the scope, not a plant_id FK — by design,
     * because the plant row is already gone by the time cleanup runs).
     */
    export const pendingDeletionStatus = pgEnum("pending_deletion_status", [
      "pending",
      "in_progress",
      "completed",
      "failed",
    ]);

    export const pendingStorageDeletions = pgTable(
      "pending_storage_deletions",
      {
        id: uuid("id").primaryKey().defaultRandom(),
        userId: uuid("user_id")
          .notNull()
          .references(() => users.id, { onDelete: "cascade" }),
        bucket: text("bucket").notNull(),
        prefix: text("prefix").notNull(),
        status: pendingDeletionStatus("status").notNull().default("pending"),
        attempts: integer("attempts").notNull().default(0),
        lastError: text("last_error"),
        scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "string" })
          .notNull()
          .defaultNow(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
          .notNull()
          .defaultNow(),
        completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
        startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
      },
      (table) => [
        index("psd_status_scheduled_at_idx").on(table.status, table.scheduledAt),
        index("psd_user_id_idx").on(table.userId),
      ],
    );
    ```

    Note: do NOT add `pgPolicy(...)` calls inside the table definition. RLS for this repo lives in hand-appended SQL inside the migration file (Plan 04-02 Codex HIGH #1 made this discipline binding — `drizzle-kit migrate` executes the SQL file verbatim including hand-appended blocks). RESEARCH.md Pattern 6 shows `pgPolicy()` as a Drizzle option but we deliberately use the migration-SQL path for consistency with Phase 2 and Phase 4.

    **Step 1.2 — Generate the first migration:**

    Run: `pnpm exec drizzle-kit generate --name=add_pending_storage_deletions`

    drizzle-kit will produce a file named like `drizzle/migrations/0004_add_pending_storage_deletions.sql` (the actual prefix is whatever the next sequential number is — accept whatever drizzle-kit assigns; the brief's `XXXX` placeholder is shorthand for that auto-prefix). The journal `drizzle/migrations/meta/_journal.json` will gain one entry. Do not hand-edit the journal.

    **Step 1.3 — Hand-append RLS SQL to the first migration file:**

    Open `drizzle/migrations/<prefix>_add_pending_storage_deletions.sql` and append (after whatever drizzle-kit emitted, separated by a `--> statement-breakpoint`) the idempotent RLS block, modeled exactly on `0001_phase_02_rls_policies.sql:128-150`:
    ```sql
    --> statement-breakpoint
    -- Phase 5 D-23 RLS posture: owner-only access on pending_storage_deletions.
    -- Reconciler cron uses service_role (BYPASSRLS) per Plan 05-06 / RESEARCH Pitfall 4.

    ALTER TABLE "pending_storage_deletions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pending_storage_deletions_owner_all') THEN
        CREATE POLICY "pending_storage_deletions_owner_all" ON public.pending_storage_deletions
          FOR ALL TO authenticated
          USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
          WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
      END IF;
    END $$;
    --> statement-breakpoint
    ```

    Verify the generated SQL contains: `CREATE TYPE "public"."pending_deletion_status" AS ENUM` (or equivalent drizzle-kit syntax for the pgEnum), `CREATE TABLE "pending_storage_deletions"`, and `CREATE INDEX "psd_status_scheduled_at_idx"`. If any are missing, the schema.ts edit is wrong — fix and regenerate (delete the just-emitted SQL file + revert the journal entry, then `generate` again).

    **Step 1.4 — Extend schema.ts with the second table (D-09 — location_suggestions):**

    Add (after `pendingStorageDeletions`):
    ```typescript
    /**
     * Per-user location autocomplete corpus.
     *
     * Per phase-5 D-09: every plant create + every plant edit that touches
     * the location field upserts here (ON CONFLICT increment usage_count +
     * touch last_used_at). Plant DELETE does NOT decrement — user-entered
     * locations stick across plant lifecycle (D-09 verbatim).
     *
     * Composite PK on (user_id, label_normalized) makes per-user de-dup the
     * default. label_normalized is the lower-cased + trimmed + diacritic-
     * folded form used for de-dup; label_display is what the user typed
     * (preserved casing/accents for display).
     *
     * Combined with the i18n defaults from src/messages/pt-BR.json
     * `catalog.locations.defaults` (D-10), the location combobox merges
     * these two sources at the application layer.
     */
    export const locationSuggestions = pgTable(
      "location_suggestions",
      {
        userId: uuid("user_id")
          .notNull()
          .references(() => users.id, { onDelete: "cascade" }),
        labelNormalized: varchar("label_normalized", { length: 200 }).notNull(),
        labelDisplay: varchar("label_display", { length: 200 }).notNull(),
        usageCount: integer("usage_count").notNull().default(1),
        lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" })
          .notNull()
          .defaultNow(),
        createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
          .notNull()
          .defaultNow(),
      },
      (table) => [
        primaryKey({ columns: [table.userId, table.labelNormalized] }),
        index("loc_suggestions_user_rank_idx").on(
          table.userId,
          table.usageCount,
          table.lastUsedAt,
        ),
      ],
    );
    ```

    **Step 1.5 — Generate the second migration:**

    Run: `pnpm exec drizzle-kit generate --name=add_location_suggestions`

    Expect a new file `drizzle/migrations/<next-prefix>_add_location_suggestions.sql` with one new journal entry. The SQL must contain `CREATE TABLE "location_suggestions"` and the composite primary key constraint (drizzle-kit may emit `CONSTRAINT "location_suggestions_user_id_label_normalized_pk" PRIMARY KEY("user_id","label_normalized")` or equivalent — accept any column-order permutation).

    **Step 1.6 — Hand-append RLS SQL to the second migration file:**

    Append the analogous block:
    ```sql
    --> statement-breakpoint
    -- Phase 5 D-09 RLS posture: owner-only access on location_suggestions.

    ALTER TABLE "location_suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'location_suggestions_owner_all') THEN
        CREATE POLICY "location_suggestions_owner_all" ON public.location_suggestions
          FOR ALL TO authenticated
          USING ((select auth.uid()) is not null and (select auth.uid()) = user_id)
          WITH CHECK ((select auth.uid()) is not null and (select auth.uid()) = user_id);
      END IF;
    END $$;
    --> statement-breakpoint
    ```

    **Why two `generate` invocations and not one:** the brief mandates two distinct migration filenames. drizzle-kit emits exactly one SQL file per `generate` run capturing the diff since the previous applied state. Adding both tables to schema.ts and running `generate` once would produce a single combined file — wrong. Generate after the first table → append RLS → generate after the second table → append RLS keeps the two migrations cleanly separable for review and partial rollback (LGPD audit lineage benefits from this).

    Do NOT run `pnpm db:migrate` in this task — that's Task 3.
  </action>
  <verify>
    <automated>test -f src/contexts/catalog/infrastructure/db/schema.ts && grep -c 'pgEnum("pending_deletion_status"' src/contexts/catalog/infrastructure/db/schema.ts | grep -E "^1$" && grep -c 'export const pendingStorageDeletions' src/contexts/catalog/infrastructure/db/schema.ts | grep -E "^1$" && grep -c 'export const locationSuggestions' src/contexts/catalog/infrastructure/db/schema.ts | grep -E "^1$" && PSD_FILE=$(ls drizzle/migrations/*_add_pending_storage_deletions.sql | head -1) && LOC_FILE=$(ls drizzle/migrations/*_add_location_suggestions.sql | head -1) && test -n "$PSD_FILE" && test -n "$LOC_FILE" && grep -c 'CREATE TABLE "pending_storage_deletions"' "$PSD_FILE" | grep -E "^1$" && grep -c 'CREATE TABLE "location_suggestions"' "$LOC_FILE" | grep -E "^1$" && grep -v '^--' "$PSD_FILE" | grep -c 'pending_storage_deletions_owner_all' | grep -E "^[1-9]" && grep -v '^--' "$LOC_FILE" | grep -c 'location_suggestions_owner_all' | grep -E "^[1-9]" && grep -v '^--' "$PSD_FILE" | grep -c 'ENABLE ROW LEVEL SECURITY' | grep -E "^[1-9]" && grep -v '^--' "$LOC_FILE" | grep -c 'ENABLE ROW LEVEL SECURITY' | grep -E "^[1-9]" && grep -c 'add_pending_storage_deletions\|add_location_suggestions' drizzle/migrations/meta/_journal.json | grep -E "^[2-9]"</automated>
  </verify>
  <acceptance_criteria>
    - VALIDATION row binding: "Drizzle schema" Unit stratum (covers pgEnum values + table columns + FK rules).
    - schema.ts exports `pendingDeletionStatus`, `pendingStorageDeletions`, `locationSuggestions` (3 grep hits, one per export).
    - schema.ts imports include `pgEnum`, `integer`, `primaryKey` (additive imports — pre-existing imports preserved): `grep -cE "(pgEnum|integer|primaryKey)" src/contexts/catalog/infrastructure/db/schema.ts` returns at least 3.
    - Migration file `XXXX_add_pending_storage_deletions.sql` exists with a 4-digit auto-prefix: `ls drizzle/migrations/ | grep -cE '^[0-9]{4}_add_pending_storage_deletions\.sql$'` returns 1.
    - Migration file `XXXX_add_location_suggestions.sql` exists with a 4-digit auto-prefix one higher than the file above: `ls drizzle/migrations/ | grep -cE '^[0-9]{4}_add_location_suggestions\.sql$'` returns 1.
    - First migration contains `CREATE TABLE "pending_storage_deletions"` exactly once (drizzle-generated).
    - First migration contains the pgEnum DDL: `grep -cE '"pending_deletion_status"' drizzle/migrations/*_add_pending_storage_deletions.sql` returns at least 2 (CREATE TYPE + column reference).
    - First migration contains the index DDL: `grep -c 'psd_status_scheduled_at_idx' drizzle/migrations/*_add_pending_storage_deletions.sql` returns at least 1.
    - First migration contains hand-appended RLS (filtering out comments to avoid the self-invalidating grep gate): `grep -v '^--' drizzle/migrations/*_add_pending_storage_deletions.sql | grep -c 'pending_storage_deletions_owner_all'` returns at least 1, AND `grep -v '^--' drizzle/migrations/*_add_pending_storage_deletions.sql | grep -c 'ENABLE ROW LEVEL SECURITY'` returns at least 1.
    - Second migration contains `CREATE TABLE "location_suggestions"` exactly once.
    - Second migration contains the composite PK: `grep -cE 'PRIMARY KEY\\("(user_id"\\s*,\\s*"label_normalized|label_normalized"\\s*,\\s*"user_id)"' drizzle/migrations/*_add_location_suggestions.sql` returns 1 (any column order accepted; drizzle-kit may emit either).
    - Second migration contains hand-appended RLS: `grep -v '^--' drizzle/migrations/*_add_location_suggestions.sql | grep -c 'location_suggestions_owner_all'` returns at least 1, AND `grep -v '^--' drizzle/migrations/*_add_location_suggestions.sql | grep -c 'ENABLE ROW LEVEL SECURITY'` returns at least 1.
    - Journal updated with two new entries: `grep -cE '"add_pending_storage_deletions"|"add_location_suggestions"' drizzle/migrations/meta/_journal.json` returns 2.
    - `pnpm tsc --noEmit` (or the project's typecheck script) passes — `schema.ts` is well-typed.
  </acceptance_criteria>
  <done>schema.ts declares the enum and both tables; both migration SQL files exist with hand-appended idempotent RLS blocks; the journal carries two new applied entries; typecheck is green.</done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: Add sort-aware cursor codec to src/shared/api/cursor.ts (TDD: RED → GREEN → REFACTOR) covering NULLS LAST sentinel and base64url URL-safety</name>
  <files>
    - src/shared/api/cursor.ts
    - src/shared/api/cursor.test.ts
  </files>
  <read_first>
    - `src/shared/api/cursor.ts` (entire file — 109 lines; you append, do not modify existing exports)
    - `.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md` D-12 (cursor shape verbatim: `{sort_id, last_value, last_id}`; NULLS LAST sentinel via `last_value: null`)
    - `.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md` lines 700-720 (Code Examples → Cursor Pagination with NULLS LAST — authoritative)
    - `.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md` rows 22 + Key Findings 5 (additive — do NOT replace `cursorPayloadSchema`)
    - `src/shared/config/errors.ts` line ~64-81 (ErrorCode.ValidationFailed shape — reuse existing import in cursor.ts)
  </read_first>
  <behavior>
    Test file `src/shared/api/cursor.test.ts` MUST exist and MUST cover, at minimum, these cases (one `it(...)` per case):

    - **RED 1 — round-trip**: `decodeSortCursor(encodeSortCursor({sort_id: "date_new", last_value: "2026-04-29T12:34:56Z", last_id: "00000000-0000-4000-8000-000000000001"}))` returns `{ ok: true, value: <input> }` (deep-equal). All 5 sort_id values per D-11 are accepted: `name_asc`, `name_desc`, `date_new`, `date_old`, `location`.
    - **RED 2 — NULLS LAST sentinel round-trip**: `decodeSortCursor(encodeSortCursor({sort_id: "date_new", last_value: null, last_id: "<uuid>"}))` returns `{ ok: true, value: { sort_id: "date_new", last_value: null, last_id: "<uuid>" } }`. The null sentinel is preserved losslessly through encode → decode.
    - **RED 3 — base64url URL-safety**: For 50 randomly generated payloads (use a small loop with `crypto.randomUUID()` and varying `last_value` strings including ones that produce `+` or `/` in standard base64), the encoded output contains ONLY characters from the alphabet `[A-Za-z0-9_-]` and contains NO `+`, `/`, `=` characters. Assert via regex: `expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/)`.
    - **RED 4 — invalid sort_id rejection**: `decodeSortCursor(encodeSortCursor({sort_id: "evil_sort", last_value: null, last_id: "<uuid>"} as any))` returns `{ ok: false, error: ErrorCode.ValidationFailed }`. Use a Zod enum on the sort_id field accepting only the 5 D-11 values.
    - **RED 5 — malformed input rejection (no throw)**: `decodeSortCursor("not-base64-!!!")` returns `{ ok: false, error: ErrorCode.ValidationFailed }` (does not throw); `decodeSortCursor(Buffer.from("not json", "utf8").toString("base64url"))` returns `{ ok: false, error: ErrorCode.ValidationFailed }`; `decodeSortCursor(Buffer.from(JSON.stringify({ wrong: "shape" }), "utf8").toString("base64url"))` returns `{ ok: false, error: ErrorCode.ValidationFailed }`.
    - **RED 6 — non-UUID last_id rejection**: `decodeSortCursor(Buffer.from(JSON.stringify({sort_id: "date_new", last_value: null, last_id: "not-a-uuid"}), "utf8").toString("base64url"))` returns `{ ok: false, error: ErrorCode.ValidationFailed }`.
    - **RED 7 — last_value type contract**: `last_value` accepts `string` or `null` only — pass `last_value: 123` (number) → decode rejects with `ValidationFailed`. The cursor shape per D-12 is `{sort_id, last_value: string|null, last_id}` — keep the type narrow at the validation boundary even if the SQL layer ultimately compares `last_value` against either a `varchar` or a `date` column.
    - **RED 8 — sympathetic to existing exports**: importing both `encodeCursor` (Phase 2 `{id, createdAt}`) and `encodeSortCursor` (Phase 5) from the same module in the same test file does not produce a name clash and both round-trip independently. (Bisects against accidental rewrite of the existing schema during the additive change.)

    All assertions use Vitest `expect`. No `npm test` watch-mode commands.
  </behavior>
  <action>
    Standard RED → GREEN → REFACTOR.

    **RED — Step 2.1:** Create `src/shared/api/cursor.test.ts` with all 8 cases above (initially failing because `encodeSortCursor` / `decodeSortCursor` don't exist yet). Add an `import { ErrorCode } from "@shared/config/errors";` at the top. Run `pnpm exec vitest run src/shared/api/cursor.test.ts` and confirm all new tests fail with import or `is not a function` errors. Commit: `test(05-02): add failing cursor sort codec spec`.

    **GREEN — Step 2.2:** Append (do NOT modify the existing `cursorPayloadSchema` block) to `src/shared/api/cursor.ts`:

    ```typescript
    /**
     * Phase-5 D-12 sort-aware cursor.
     *
     * Cursor format: `base64url(JSON.stringify({sort_id, last_value, last_id}))`.
     *
     * - `sort_id` is one of the 5 catalog sort modes (D-11): name_asc / name_desc /
     *   date_new / date_old / location.
     * - `last_value` carries the sort-key of the last row in the previous page.
     *   For `acquisition_date` modes, NULL dates sort last (NULLS LAST). The
     *   cursor encodes `last_value: null` as the sentinel meaning "we are now
     *   in the NULL-tail of the result set" — the SQL layer translates that
     *   into `WHERE acquisition_date IS NULL AND id < :last_id`.
     * - `last_id` is the stable tiebreak — always the plant UUID.
     *
     * This codec is ADDITIVE: the Phase-2 `{id, createdAt}` cursor (cursorPayloadSchema /
     * encodeCursor / decodeCursor) is unchanged and still serves the existing
     * non-sort-aware list endpoints. Phase 5 sort-aware list-plants uses the
     * helpers below.
     */

    export const SORT_IDS = [
      "name_asc",
      "name_desc",
      "date_new",
      "date_old",
      "location",
    ] as const;

    export type SortId = (typeof SORT_IDS)[number];

    const sortCursorPayloadSchema = z.object({
      sort_id: z.enum(SORT_IDS),
      last_value: z.union([z.string(), z.null()]),
      last_id: z.string().uuid(),
    });

    export type SortCursorPayload = z.infer<typeof sortCursorPayloadSchema>;

    export type SortCursorDecodeResult =
      | { ok: true; value: SortCursorPayload }
      | { ok: false; error: typeof ErrorCode.ValidationFailed };

    export function encodeSortCursor(payload: SortCursorPayload): string {
      return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    }

    export function decodeSortCursor(encoded: string): SortCursorDecodeResult {
      let json: string;
      try {
        json = Buffer.from(encoded, "base64url").toString("utf8");
      } catch {
        return { ok: false, error: ErrorCode.ValidationFailed };
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        return { ok: false, error: ErrorCode.ValidationFailed };
      }

      const result = sortCursorPayloadSchema.safeParse(parsed);
      if (!result.success) {
        return { ok: false, error: ErrorCode.ValidationFailed };
      }

      return { ok: true, value: result.data };
    }
    ```

    Run `pnpm exec vitest run src/shared/api/cursor.test.ts` — all tests must pass. Commit: `feat(05-02): add sort-aware cursor codec with NULLS LAST sentinel`.

    **REFACTOR — Step 2.3 (only if needed):** If duplication across `decodeCursor` and `decodeSortCursor` is excessive (both wrap the same try/catch ladder), extract a private `decodeBase64Json<T>(encoded, schema)` helper. If the duplication is light (~6 lines), leave both functions alone and skip refactor — premature DRY is worse than 6 duplicated lines. If you do refactor, run vitest again and commit: `refactor(05-02): extract base64url-json decode helper`.
  </action>
  <verify>
    <automated>pnpm exec vitest run src/shared/api/cursor.test.ts && grep -c 'export function encodeSortCursor' src/shared/api/cursor.ts | grep -E "^1$" && grep -c 'export function decodeSortCursor' src/shared/api/cursor.ts | grep -E "^1$" && grep -c 'export function encodeCursor' src/shared/api/cursor.ts | grep -E "^1$" && grep -c 'export function decodeCursor' src/shared/api/cursor.ts | grep -E "^1$"</automated>
  </verify>
  <acceptance_criteria>
    - VALIDATION row binding: "Cursor encoding" Unit stratum (round-trip + NULLS LAST sentinel + base64url safety).
    - All 8 RED cases pass under `pnpm exec vitest run src/shared/api/cursor.test.ts` with no `npm test` watch-mode invocations.
    - The Phase-2 exports (`encodeCursor`, `decodeCursor`, `cursorPayloadSchema`, `CursorPayload`, `DecodeResult`, `normalizeLimit`, `DEFAULT_LIMIT`, `MAX_LIMIT`) are still exported and unchanged: `grep -cE 'export (function (encodeCursor|decodeCursor|normalizeLimit)|const (DEFAULT_LIMIT|MAX_LIMIT))' src/shared/api/cursor.ts` returns at least 5.
    - `SORT_IDS` is a frozen `as const` tuple of exactly the 5 D-11 values: `grep -cE '"name_asc".*"name_desc".*"date_new".*"date_old".*"location"' src/shared/api/cursor.ts` returns at least 1 (verifies the canonical 5 values are present in declaration order).
    - The base64url alphabet test passes for ≥50 random payloads (executor reads the test loop).
    - `decodeSortCursor` does not throw on malformed input — verified by Vitest `expect(() => decodeSortCursor(...)).not.toThrow()` in the malformed-input case.
    - At least 2 atomic commits exist for this task: one `test(05-02): ...` (RED) and one `feat(05-02): ...` (GREEN); a third REFACTOR commit is optional. Verify via `git log --oneline -5 src/shared/api/cursor.test.ts src/shared/api/cursor.ts`.
  </acceptance_criteria>
  <done>cursor.ts exports the additive sort cursor codec; test suite has 8+ passing cases covering round-trip + NULLS LAST sentinel + base64url URL-safety + malformed-input rejection; Phase-2 exports unchanged; commits show RED → GREEN cycle.</done>
</task>

<task type="execute">
  <name>Task 3: [BLOCKING] Apply both migrations via pnpm db:migrate (NOT push — Codex HIGH #1) and write owner-only RLS integration test using rls-real-jwt pattern</name>
  <files>
    - tests/integration/catalog-phase5-rls.integration.test.ts
    - (no source-file mutations — this task changes live database state via migrate, then asserts on it)
  </files>
  <read_first>
    - `.planning/phases/04-iam-auth-verification-consent/04-02-PLAN.md` Task 3 lines 318-380 (the canonical [BLOCKING] migrate task — copy the verification-by-psql discipline)
    - `tests/integration/rls-real-jwt.integration.test.ts` (entire file, ~400 lines — authoritative pattern for `SET LOCAL ROLE authenticated` + `SET LOCAL "request.jwt.claim.sub" = '<uuid>'` + cross-user assertion)
    - `tests/integration/global-setup.ts` (test bootstrap; how DATABASE_URL is read)
    - `package.json` line 26 (`db:migrate` script: `node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs migrate`)
    - `drizzle.config.ts` (project root) — confirm `dbCredentials.url` resolves to `DATABASE_URL`
    - `.env.local` (must contain `DATABASE_URL` pointing at local Supabase Postgres)
    - `.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md` Pitfall 4 lines 659-667 (service-role vs authenticated-role for the reconciler — relevant context for why owner-only RLS is the right posture here)
    - `<schema_push_requirement>` block in the orchestrator's planning context (this task is mandatory; without it executors pass typecheck and build but live DB is empty — false-positive verification)
  </read_first>
  <action>
    **Step 3.1 — Confirm preconditions:**

    Confirm `pnpm db:start` is running (Supabase Docker). If not:
    ```bash
    pnpm db:start
    ```

    Confirm `DATABASE_URL` is set in `.env.local` (Phase 1 plan 01-04 populates it from `supabase status`). If not, run `pnpm db:sync-env` (or whatever the project script is — check package.json).

    **Step 3.2 — Run the migration (the [BLOCKING] step):**

    Run: `pnpm db:migrate`

    This command (per `package.json:26`) executes `node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs migrate` which:
    1. Reads `drizzle.config.ts` and connects to `DATABASE_URL`.
    2. Reads `drizzle/migrations/meta/_journal.json` to determine which migrations are unapplied.
    3. Executes each unapplied SQL file VERBATIM in journal order — including the hand-appended RLS policy blocks at the bottom of both new files (this is what Codex HIGH #1 from Plan 04-02 fixed; `pnpm db:push` would silently skip the appended SQL and ship tables without RLS).
    4. Updates the journal to mark both migrations as applied.

    **Why migrate not push (Codex HIGH #1, binding from Plan 04-02):** `drizzle-kit push` introspects the live DB, diffs against `schema.ts`, and applies the diff. It does NOT read SQL files in `drizzle/migrations/` — so the hand-appended `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` blocks would be silently skipped. New tables would ship without RLS, and the integration test in Step 3.4 would fail (or worse, false-pass if the default-deny posture is misconfigured). `drizzle-kit migrate` reads each unapplied SQL file and executes it verbatim — hand-appended RLS is applied reliably.

    **If `pnpm db:migrate` exits non-zero**, capture the error and surface it. Common causes:
    - `DATABASE_URL` not set → run `pnpm db:start && pnpm db:sync-env`.
    - Live DB still has Phase 4 migration pending → run that first.
    - Migration SQL has a syntax error → fix the SQL file and re-run migrate.

    **Step 3.3 — Verify live state via psql (the brief's literal commands):**

    Run the brief's mandated verification queries:

    ```bash
    psql "$DATABASE_URL" -c "select pending_deletion_status::regtype"
    ```
    Expected: one row showing `pending_deletion_status` (the enum type exists).

    ```bash
    psql "$DATABASE_URL" -c "select count(*) from pg_tables where tablename in ('pending_storage_deletions','location_suggestions')"
    ```
    Expected: one row with `count = 2`.

    Additional sanity checks (mirror Plan 04-02's smoking-gun discipline):
    ```bash
    psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('pending_storage_deletions','location_suggestions');"
    ```
    Expected: both rows show `relrowsecurity = t` (true) — proves hand-appended RLS was applied.

    ```bash
    psql "$DATABASE_URL" -c "\d pending_storage_deletions" | grep -E "(status|scheduled_at|attempts|prefix|bucket)"
    psql "$DATABASE_URL" -c "\d location_suggestions" | grep -E "(label_normalized|label_display|usage_count|last_used_at)"
    psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'pending_storage_deletions';" | grep psd_status_scheduled_at_idx
    ```

    Capture the output of each check for the SUMMARY (the executor's wave-end summary should include these as a "live DB audit" block, mirroring Plan 04-02 Task 4).

    **Step 3.4 — Author the RLS owner-only integration test:**

    Create `tests/integration/catalog-phase5-rls.integration.test.ts`. Model the harness on `tests/integration/rls-real-jwt.integration.test.ts` — same `SET LOCAL ROLE authenticated` + `SET LOCAL "request.jwt.claim.sub" = '<uuid>'` two-step inside a transaction.

    Test cases (use `describe` + nested `it` per table):

    ```typescript
    describe("pending_storage_deletions RLS", () => {
      it("user A authenticated cannot SELECT user B's row", async () => {
        // 1. Use service-role connection to seed userA + userB rows in `users` (or reuse fixtures/seed-user.ts)
        // 2. Use service-role connection to INSERT one pending_storage_deletions row owned by userA
        //    (with bucket='plant-photos', prefix=`${userAId}/test-plant/`, status='pending')
        // 3. Open the authenticated-role connection. Inside a TX:
        //      SET LOCAL ROLE authenticated;
        //      SET LOCAL "request.jwt.claim.sub" = '<userBId>';
        //      SELECT * FROM pending_storage_deletions; -- expect 0 rows
        // 4. Same harness but bind sub to userAId — expect 1 row (positive control).
      });

      it("user A authenticated cannot INSERT a row claiming user B's user_id", async () => {
        // SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<userAId>';
        // INSERT INTO pending_storage_deletions (user_id, bucket, prefix) VALUES (<userBId>, ...);
        // expect: postgres-js throws or returns 0 rows affected (RLS WITH CHECK rejects).
        // Use try/catch; assert error.code === '42501' (insufficient_privilege) or rowCount === 0.
      });
    });

    describe("location_suggestions RLS", () => {
      it("user A authenticated cannot SELECT user B's suggestions", async () => {
        // Service-role INSERT for userA: (userAId, 'sala', 'Sala', 1, now())
        // SET LOCAL ROLE authenticated; SET LOCAL "request.jwt.claim.sub" = '<userBId>';
        // SELECT * FROM location_suggestions; -- expect 0 rows
        // Bind userAId — expect 1 row.
      });

      it("user A authenticated cannot INSERT claiming user B's user_id", async () => {
        // Same shape as above; assert RLS WITH CHECK rejects.
      });
    });

    describe("Cross-test sanity", () => {
      it("the new tables exist and are non-zero in pg_tables", async () => {
        // SELECT count(*) FROM pg_tables WHERE tablename IN ('pending_storage_deletions','location_suggestions')
        // expect 2 — guards against migration regression
      });

      it("the pending_deletion_status enum is registered", async () => {
        // SELECT 'pending_deletion_status'::regtype  -- must not throw
      });
    });
    ```

    Use the existing `tests/integration/fixtures/seed-user.ts` shape for user creation (or `await sql\`INSERT INTO users (...) VALUES (...)\`` directly with a service-role connection — match the rls-real-jwt.integration.test.ts pattern verbatim; do NOT introduce a new seeding pattern).

    Run: `pnpm test:run` (the project rule: never `pnpm test` watch mode; `pnpm test:run` runs unit + integration once).

    All test cases must pass.

    **Step 3.5 — Commit:**

    Single commit: `feat(05-02): apply Phase 5 catalog migrations + RLS owner-only integration coverage`.
  </action>
  <verify>
    <automated>pnpm db:migrate && psql "$DATABASE_URL" -tA -c "select pending_deletion_status::regtype" | grep -E "^pending_deletion_status$" && psql "$DATABASE_URL" -tA -c "select count(*) from pg_tables where tablename in ('pending_storage_deletions','location_suggestions')" | grep -E "^2$" && psql "$DATABASE_URL" -tA -c "SELECT count(*) FROM pg_class WHERE relname IN ('pending_storage_deletions','location_suggestions') AND relrowsecurity = true" | grep -E "^2$" && pnpm exec vitest run tests/integration/catalog-phase5-rls.integration.test.ts</automated>
  </verify>
  <acceptance_criteria>
    - VALIDATION row binding: "RLS owner-only" Integration stratum + "Drizzle schema" Unit stratum (both verify the same artifacts post-migrate).
    - `pnpm db:migrate` exits 0 (this is the [BLOCKING] gate — all later plans depend on the live DB matching schema.ts).
    - `psql "$DATABASE_URL" -c "select pending_deletion_status::regtype"` returns the enum type name (the brief's literal verify command).
    - `psql "$DATABASE_URL" -c "select count(*) from pg_tables where tablename in ('pending_storage_deletions','location_suggestions')"` returns `2` (the brief's literal verify command).
    - `psql "$DATABASE_URL" -c "SELECT relname, relrowsecurity FROM pg_class WHERE relname IN ('pending_storage_deletions','location_suggestions');"` shows `relrowsecurity = t` on both rows (Codex HIGH #1 smoking gun — hand-appended RLS was applied).
    - `psql "$DATABASE_URL" -c "\d pending_storage_deletions"` lists all columns from D-23 (`id`, `user_id`, `bucket`, `prefix`, `status`, `attempts`, `last_error`, `scheduled_at`, `created_at`, `completed_at`, `started_at`).
    - `psql "$DATABASE_URL" -c "\d location_suggestions"` lists all columns from D-09 + composite PK on `(user_id, label_normalized)`.
    - `psql "$DATABASE_URL" -c "SELECT indexname FROM pg_indexes WHERE tablename = 'pending_storage_deletions';"` includes `psd_status_scheduled_at_idx` (reconciler depends on this in 05-06).
    - Journal carries both new entries: `cat drizzle/migrations/meta/_journal.json | grep -cE '"add_pending_storage_deletions"|"add_location_suggestions"'` returns 2.
    - Integration test file `tests/integration/catalog-phase5-rls.integration.test.ts` exists and has at least 4 `it(` blocks (2 per table for SELECT + INSERT denial) plus 2 sanity tests.
    - `pnpm exec vitest run tests/integration/catalog-phase5-rls.integration.test.ts` passes — proves cross-user denial under authenticated-role + JWT-claim binding for both tables.
    - Test reuses `SET LOCAL ROLE authenticated` + `SET LOCAL "request.jwt.claim.sub"` pattern: `grep -c 'SET LOCAL ROLE authenticated' tests/integration/catalog-phase5-rls.integration.test.ts` returns at least 4 (one per RLS test block).
    - No new top-level test fixture files; reuses existing `tests/integration/fixtures/seed-user.ts` or inline service-role INSERT pattern from rls-real-jwt.integration.test.ts.
  </acceptance_criteria>
  <done>Live Postgres carries the enum + both tables + index + RLS-enabled state; the brief's literal `select pending_deletion_status::regtype` and `select count(*) from pg_tables` verifications return the expected values; cross-user RLS denial is automatically asserted by an integration test reusing the rls-real-jwt harness.</done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client → API → Postgres | A user-supplied `?cursor=...` query param crosses from an HTTP client into route handlers (future plans 05-07/08); the cursor is decoded and partially used to build SQL — the cursor codec lives in this plan. |
| Inngest reconciler → Postgres | The hourly cron runs without a request context (no JWT, no `auth.uid()`); it must query `pending_storage_deletions` across all users using a service-role connection (BYPASSRLS) — see Pitfall 4. The schema and RLS posture introduced here permit this in 05-06. |
| GitHub Actions deploy → Vercel preview branch DB | `pnpm db:migrate` runs in CI against the preview branch DB (Supabase branch DB per CLAUDE.md). The migration SQL is content-addressed by journal hash — same hand-appended RLS executes uniformly across local, preview, and prod. |

## STRIDE Threat Register

| Threat ID    | Category | Component                                                                                    | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                                                                                                                                                |
|--------------|----------|----------------------------------------------------------------------------------------------|-------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-05-02-01   | I, E     | Sort cursor (`encodeSortCursor` / `decodeSortCursor` consumers in 05-07/08)                   | mitigate    | Cursor is opaque base64url. Server re-validates `auth.uid() = user_id` regardless of cursor contents (RLS owner-only on `plants` from Phase 2 + repo-level user_id filter — both still in force). Cursor cannot inject WHERE-clause values: decoded fields go through Zod (`SortId` enum, `last_id` UUID, `last_value` string\|null). Even if a client tampers with the encoded string, the decoder returns `ValidationFailed` rather than executing arbitrary SQL. |
| T-05-02-02   | E        | `pending_storage_deletions` cross-user prefix mis-scope                                       | mitigate    | RLS owner-only (`auth.uid() = user_id`) on the table introduced here. The reconciler in 05-06 uses a service-role connection but always derives `user_id` and `prefix` from the row itself — never from a request body. The row schema enforces `user_id NOT NULL` with FK to `users.id ON DELETE CASCADE`, so an orphan prefix scoped to a non-existent user cannot exist. The integration test in Task 3 asserts cross-user SELECT and INSERT both deny.       |
| T-05-02-03   | T        | Migration applied to wrong DB on preview branches (`pnpm db:migrate` against the wrong URL)   | mitigate    | `db:migrate` reads `DATABASE_URL` from the GitHub Actions environment; CI gates on `DATABASE_URL` matching the expected Supabase preview-branch shape (per CLAUDE.md "preview env per PR with Supabase branch DB"). Local development uses `.env.local` populated from `supabase status`. Both new migration files are content-addressed via the Drizzle journal — replay across environments is deterministic.                                                  |
| T-05-02-04   | I        | `location_suggestions` cross-user enumeration disclosing user habits                          | mitigate    | RLS owner-only on `location_suggestions`. The integration test in Task 3 asserts cross-user SELECT denies. `label_display` is plant-scoped textual data the user themselves entered — leaking it to another user would disclose user habit data. Belt-and-braces: future repo functions in 05-03 also filter `WHERE user_id = $1`.                                                                                                                              |
| T-05-02-05   | T        | Hand-appended RLS SQL silently skipped by `drizzle-kit push` (Codex HIGH #1 from Plan 04-02)  | mitigate    | This plan uses `pnpm db:migrate` (NOT `pnpm db:push`). `drizzle-kit migrate` executes the SQL file VERBATIM, including hand-appended `ENABLE ROW LEVEL SECURITY` + `CREATE POLICY` blocks. Task 3's verify includes `SELECT relrowsecurity FROM pg_class WHERE relname IN (...)` returning `t` for both new tables — the smoking-gun assertion proving the appended SQL was actually applied.                                                                  |
| T-05-02-06   | D, R     | Migration partial-failure leaving the DB in an inconsistent state (one table created, the other not) | accept     | Each Drizzle migration is wrapped in an implicit transaction by drizzle-kit; if either file fails mid-execution, it rolls back. The two-file split is a feature, not a risk: the first file can be applied independently if the second fails, and re-running `migrate` is idempotent (journal tracks applied state, RLS blocks use `IF NOT EXISTS`). Acceptance rationale: same posture as Plan 04-02 Task 3; no incremental risk introduced here.                |

`block_on_high: true` per ASVS L1 — every threat has a `mitigate` disposition except T-05-02-06 which is `accept` with documented rationale.

</threat_model>

<verification>
Phase-wide verification (run after all three tasks complete):

1. **Live DB schema state** — `psql "$DATABASE_URL"`:
   - `\dt` lists `pending_storage_deletions` and `location_suggestions` (Phase 5 first DB-touching plan; both are visible).
   - `select pending_deletion_status::regtype` returns the enum type name (the brief's literal verify command).
   - `select count(*) from pg_tables where tablename in ('pending_storage_deletions','location_suggestions')` returns `2` (the brief's literal verify command).
   - `SELECT relrowsecurity FROM pg_class WHERE relname IN ('pending_storage_deletions','location_suggestions')` returns `t` for both rows (Codex HIGH #1 smoking gun).

2. **Cursor codec contract** — `pnpm exec vitest run src/shared/api/cursor.test.ts`:
   - 8 cases pass.
   - Phase-2 exports unchanged (`encodeCursor`, `decodeCursor`, `cursorPayloadSchema`, `normalizeLimit`, `DEFAULT_LIMIT`, `MAX_LIMIT`).
   - Round-trip + NULLS LAST sentinel + base64url URL-safety + malformed-input rejection covered.

3. **RLS owner-only integration** — `pnpm exec vitest run tests/integration/catalog-phase5-rls.integration.test.ts`:
   - Cross-user SELECT denied for both tables under `SET LOCAL ROLE authenticated` + JWT-claim binding.
   - Cross-user INSERT denied (RLS WITH CHECK) for both tables.
   - Sanity assertions: enum exists, table count is 2.

4. **Typecheck + full test suite** — `pnpm tsc --noEmit && pnpm test:run`:
   - Schema typechecks (additive imports + new exports compile).
   - Unit suite passes.
   - Integration suite passes (including the new RLS test).
</verification>

<success_criteria>
- All three tasks completed with their automated verify commands green.
- Live Postgres carries the new enum, both tables, the `psd_status_scheduled_at_idx` index, and owner-only RLS — verified by the brief's literal `select pending_deletion_status::regtype` and `select count(*) from pg_tables` commands AND the relrowsecurity smoking-gun query.
- Sort-aware cursor codec is additive: Phase-2 cursor exports remain unchanged; Phase-5 codec lives alongside.
- Cross-user denial proven by integration test reusing the rls-real-jwt.integration.test.ts pattern.
- All commits pass project hooks (no `--no-verify`).
- The plan unblocks 05-03 (repos), 05-07/08 (cursor consumers), and 05-06 (reconciler reads `pending_storage_deletions`).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-02-SUMMARY.md` with:
- One-liner of what shipped.
- Live DB audit block (the psql output captured during Task 3 — proves migrate applied verbatim).
- File inventory (schema.ts diff size, two migration filenames with their actual auto-prefix numbers, cursor.ts additive lines added, test file LOC).
- Note any drift between expected and actual drizzle-kit output (e.g., column ordering in the composite PK constraint).
- Confirmation that Phase-2 cursor exports are unchanged.
- Forward link: 05-03 will consume the new tables; 05-07/08 will consume the new cursor codec; 05-06 will consume the `psd_status_scheduled_at_idx` index.
</output>
