---
phase: 05-catalog-meu-jardim
plan: 03
type: tdd
wave: 2
depends_on: ["05-02"]
files_modified:
  - src/contexts/catalog/infrastructure/db/plants.ts
  - src/contexts/catalog/infrastructure/db/photo-entries.ts
  - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
  - src/contexts/catalog/infrastructure/db/location-suggestions.ts
  - src/contexts/catalog/domain/locations.ts
  - tests/unit/catalog-locations-normalize.test.ts
  - tests/integration/catalog-plants-repo.integration.test.ts
  - tests/integration/catalog-photo-entries-repo.integration.test.ts
  - tests/integration/catalog-pending-storage-deletions-repo.integration.test.ts
  - tests/integration/catalog-location-suggestions-repo.integration.test.ts
autonomous: true
requirements:
  - "CAT-05 (location_suggestions repository — combobox suggestions corpus)"
  - "CAT-07 (catalog default sort acquisition_date DESC NULLS LAST — repository ORDER BY enforces it)"
  - "CAT-08 (sort control 5 options — repository accepts all 5 sort_id values from D-11)"
  - "CAT-09 (delete cascade + storage scheduling — pending_storage_deletions repo + getCascadeCounts feed delete-confirm sheet + reconciler)"
tags: [catalog, repositories, drizzle, rls, cursor, locations, pending-deletions, tdd]

must_haves:
  truths:
    - "plants.list({sort, cursor, limit}) returns rows in the correct order for ALL 5 D-11 sort modes (name_asc, name_desc, date_new, date_old, location), with NULLS LAST applied to acquisition_date in date_new + date_old, and id as the deterministic tiebreak."
    - "plants.list cursor round-trips: passing the cursor returned by page N returns the next batch starting strictly after the boundary row, with no duplicates and no skipped rows, including across the NULL → non-NULL boundary on date sorts."
    - "plants.countForUser returns the exact count of plants owned by userId — used by D-13 first-page total_count and matches list() row counts."
    - "plants.getCascadeCounts(db, plantId) returns { photo_entry_count, reminder_count } from photo_entries and reminders joined to that plantId — feeds D-07 delete-confirm sheet copy template."
    - "plants.create / update / delete only operate on rows owned by userId. Repo-level WHERE user_id = $1 is in the SQL even though RLS is also active (defense in depth, T-02-12)."
    - "photo_entries.bumpCoverFor(tx, plantId, userId) reads the oldest non-deleted PhotoEntry for that plant and writes plants.cover_photo_url in the SAME transaction (D-03 cover auto-promote). Filters plants UPDATE by user_id (defense in depth)."
    - "pending_storage_deletions.fetchPendingBatch(db, limit) returns up to `limit` rows with status='pending' AND scheduled_at <= NOW(), ordered by scheduled_at ASC, locked via FOR UPDATE SKIP LOCKED — concurrent reconciler invocations do NOT process the same row twice. When called with `opts.staleInProgressMinutes` (default 30 for reconciler use), also returns 'in_progress' rows whose `started_at` is older than the threshold (stale-recovery path for the reconciler cron). When opts is omitted (Inngest happy-path call), only 'pending' rows are returned."
    - "pending_storage_deletions state-machine transitions: create → markInProgress (sets started_at, increments attempts) → markCompleted (terminal success) | recordError (sets last_error; returns row to 'pending' when attempts < 5, transitions to 'failed' when attempts = 5) → markFailed (terminal, direct call only). Each transition updates exactly the target row's fields (status, attempts, started_at, last_error, completed_at), never another row."
    - "fetchPendingBatch is service-role-only. Calling it under SET LOCAL ROLE authenticated returns zero rows even when matching pending rows exist (proves the discipline that protects T-05-03-02 — reconciler must NEVER run inside withUnitOfWork)."
    - "location_suggestions.upsert(db, userId, label) inserts a new row on first use and increments usage_count + touches last_used_at on subsequent calls for the same (userId, label_normalized) — drives D-09 reusable suggestions."
    - "location_suggestions.listForUser(db, userId, limit=20) returns rows for that userId ordered by usage_count DESC, last_used_at DESC, limited to `limit`. Cross-user rows never appear."
    - "RLS owner-only on pending_storage_deletions and location_suggestions: under SET LOCAL ROLE authenticated bound to userA's JWT sub, SELECTs against userB's rows return 0 (cross-user denial proven for both new tables)."
    - "Cursor manipulation cannot bypass ownership: a cursor minted from userA's last row, passed by an authenticated userB session, returns ONLY userB's rows (the cursor is opaque pagination state, not an ACL bypass — T-05-03-01)."
  artifacts:
    - path: "src/contexts/catalog/infrastructure/db/plants.ts"
      provides: "Extended functional repository: list({sort, cursor, limit}), create, update, delete, countForUser, getCascadeCounts (alongside the existing findByIdForUser shipped in Phase 2)."
      exports: ["findByIdForUser", "list", "create", "update", "delete", "countForUser", "getCascadeCounts", "PlantRow", "PlantListParams", "PlantListResult"]
    - path: "src/contexts/catalog/infrastructure/db/photo-entries.ts"
      provides: "Extended functional repository: list({plantId}), delete, bumpCoverFor(tx, plantId, userId), alongside the existing create shipped in Phase 2 / Plan 02-08."
      exports: ["create", "list", "delete", "bumpCoverFor", "PhotoEntryRow", "PhotoEntryInsert"]
    - path: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts"
      provides: "NEW functional repository for the storage-cleanup state machine. fetchPendingBatch(db, limit, opts?) is service-role-only (DbClient parameter type, NOT TransactionalDb); opts.staleInProgressMinutes enables stale in_progress row recovery for the reconciler cron. markInProgress sets started_at = NOW(). recordError returns row to pending (attempts < 5) or failed (attempts >= 5). Other helpers accept either DbClient or TransactionalDb."
      exports: ["create", "markInProgress", "markCompleted", "recordError", "markFailed", "fetchPendingBatch", "PendingStorageDeletionRow", "PendingStorageDeletionInsert"]
    - path: "src/contexts/catalog/infrastructure/db/location-suggestions.ts"
      provides: "NEW functional repository: upsert (ON CONFLICT increment usage_count + touch last_used_at) and listForUser (top-N by usage_count DESC, last_used_at DESC)."
      exports: ["upsert", "listForUser", "LocationSuggestionRow"]
    - path: "src/contexts/catalog/domain/locations.ts"
      provides: "Pure helper normalizeLocationLabel(input: string): string — trim + toLocaleLowerCase('pt-BR') + diacritic-fold via NFD + Unicode property regex. Used by location-suggestions.ts to derive label_normalized."
      exports: ["normalizeLocationLabel"]
    - path: "tests/unit/catalog-locations-normalize.test.ts"
      provides: "RED→GREEN unit tests for normalizeLocationLabel — diacritic fold, lowercasing, trim, idempotency."
      contains: "describe(\"normalizeLocationLabel\""
    - path: "tests/integration/catalog-plants-repo.integration.test.ts"
      provides: "Integration suite for plants.ts repository: list (5 sort modes + NULLS LAST + cursor round-trip + cross-user cursor denial), create/update/delete (ownership-scoped), countForUser, getCascadeCounts."
      contains: "describe(\"plants repository\""
    - path: "tests/integration/catalog-photo-entries-repo.integration.test.ts"
      provides: "Integration suite for photo-entries.ts: list({plantId}), delete (ownership-via-plant), bumpCoverFor(tx) cover auto-promote in same TX (D-03)."
      contains: "describe(\"photo_entries repository\""
    - path: "tests/integration/catalog-pending-storage-deletions-repo.integration.test.ts"
      provides: "Integration suite for pending-storage-deletions.ts: state-machine transitions + FOR UPDATE SKIP LOCKED ordering + service-role-only discipline (deny-all under authenticated role) + RLS owner-only proof."
      contains: "describe(\"pending_storage_deletions repository\""
    - path: "tests/integration/catalog-location-suggestions-repo.integration.test.ts"
      provides: "Integration suite for location-suggestions.ts: upsert ON CONFLICT increment + listForUser ordering + RLS owner-only proof."
      contains: "describe(\"location_suggestions repository\""
  key_links:
    - from: "src/contexts/catalog/infrastructure/db/plants.ts list()"
      to: "src/shared/api/cursor.ts decodeSortCursor / encodeSortCursor (shipped in 05-02)"
      via: "decode incoming cursor, translate to ORDER BY + WHERE; encode outgoing nextCursor from the last row of the page"
      pattern: "decodeSortCursor\\("
    - from: "src/contexts/catalog/infrastructure/db/plants.ts getCascadeCounts()"
      to: "src/contexts/reminders/infrastructure/db/schema.ts reminders + src/contexts/catalog/infrastructure/db/schema.ts photoEntries"
      via: "two SELECT count(*) queries (or one CTE) by plant_id, returned as a single object {photo_entry_count, reminder_count}"
      pattern: "reminders\\.plantId|photoEntries\\.plantId"
    - from: "src/contexts/catalog/infrastructure/db/photo-entries.ts bumpCoverFor()"
      to: "src/contexts/catalog/infrastructure/db/plants.ts (cover_photo_url column)"
      via: "Same-TX UPDATE plants SET cover_photo_url = (SELECT photo_url FROM photo_entries WHERE plant_id = $1 ORDER BY created_at ASC LIMIT 1) WHERE id = $1 AND user_id = $2"
      pattern: "set\\(\\{ coverPhotoUrl"
    - from: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts fetchPendingBatch()"
      to: "live Postgres with FOR UPDATE SKIP LOCKED"
      via: "drizzle .for('update', {skipLocked: true}) on a SELECT filtered by (status='pending') OR (status='in_progress' AND started_at < NOW() - interval when opts provided) AND scheduled_at <= NOW() ORDER BY scheduled_at ASC LIMIT $1"
      pattern: "for\\(.update., \\{ skipLocked: true \\}\\)"
    - from: "src/contexts/catalog/infrastructure/db/location-suggestions.ts upsert()"
      to: "src/contexts/catalog/domain/locations.ts normalizeLocationLabel"
      via: "import + call to derive label_normalized from the user-supplied display label before INSERT"
      pattern: "normalizeLocationLabel\\("
    - from: "downstream plans 05-05, 05-06, 05-07"
      to: "this plan's repository functions"
      via: "use-cases call repos through withUnitOfWork(tx) for mutations and `db` for service-role reads (reconciler only)"
      pattern: "from \"@contexts/catalog/infrastructure/db/(plants|photo-entries|pending-storage-deletions|location-suggestions)\""
---

<objective>
Ship the four catalog functional repositories that every Phase 5 use-case depends on: extend `plants.ts` and `photo-entries.ts` with the read + mutate functions Phase 5 needs (list/create/update/delete/countForUser/getCascadeCounts on plants; list/delete/bumpCoverFor on photo_entries) and add two new repositories `pending-storage-deletions.ts` (D-22/D-23/D-24 cleanup state machine) and `location-suggestions.ts` (D-09 combobox corpus). Drives RED→GREEN→(REFACTOR) cycles per repo function. Closes the validation-stratum requirements `Repository logic`, `Cursor encoding consumer`, `Location upsert`, and `RLS owner-only` from `05-VALIDATION.md`.

Purpose: All Phase 5 use-cases (05-05 create-plant, 05-06 delete-plant + Inngest cleanup, 05-07 update/get/list/photo-entry/cover use-cases) call these functions. Without them shipping with deterministic SQL contracts AND integration-level proof that ownership + RLS hold, every later plan would either re-invent the SQL ad-hoc or stub the repo and end up with false-positive verification (Drizzle types compile but live RLS denies). The reconciler in 05-06 also depends on `fetchPendingBatch` here returning rows under the service-role connection — getting that wrong silently strands cleanup forever.

Output:
- `plants.ts` extended with 6 new functions (alongside existing `findByIdForUser`).
- `photo-entries.ts` extended with 3 new functions (alongside existing `create`).
- `pending-storage-deletions.ts` — NEW, 6 functions, state machine + service-role discipline.
- `location-suggestions.ts` — NEW, 2 functions, ON CONFLICT upsert + ranked list.
- `domain/locations.ts` — NEW, pure `normalizeLocationLabel` helper.
- 1 unit test + 4 integration tests, all green under `pnpm test:unit` + `pnpm test:integration`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-PLAN-OUTLINE.md
@CLAUDE.md

# Existing artifacts this plan extends or imports
@src/contexts/catalog/infrastructure/db/plants.ts
@src/contexts/catalog/infrastructure/db/photo-entries.ts
@src/contexts/catalog/infrastructure/db/schema.ts
@src/contexts/reminders/infrastructure/db/schema.ts
@src/shared/db/client.ts
@src/shared/db/unit-of-work.ts
@src/shared/api/cursor.ts
@src/contexts/catalog/application/upload-photo.ts

# Sibling plans that constrain this plan's contracts
@.planning/phases/05-catalog-meu-jardim/05-02-pending-deletions-schema-cursor-PLAN.md

# Test infra fixture conventions (Wave 0)
@tests/integration/rls-real-jwt.integration.test.ts
@tests/integration/setup-supabase-truncate.ts

<interfaces>
<!-- Contracts pulled from the codebase + sibling plans. Use these directly — do NOT explore. -->

From `src/contexts/catalog/infrastructure/db/plants.ts` (existing — Phase 2):
```ts
import { and, eq } from "drizzle-orm";
import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { plants } from "@contexts/catalog/infrastructure/db/schema";

type PlantsDb = DbClient | TransactionalDb;
export type PlantRow = typeof plants.$inferSelect;

export async function findByIdForUser(
  db: PlantsDb,
  userId: string,
  plantId: string,
): Promise<PlantRow | null> {
  const rows = await db
    .select()
    .from(plants)
    .where(and(eq(plants.userId, userId), eq(plants.id, plantId)))
    .limit(1);
  return rows[0] ?? null;
}
```

From `src/contexts/catalog/infrastructure/db/photo-entries.ts` (existing — Plan 02-08):
```ts
type PhotoEntriesDb = DbClient | TransactionalDb;
export type PhotoEntryRow = typeof photoEntries.$inferSelect;
export type PhotoEntryInsert = typeof photoEntries.$inferInsert;

export async function create(
  db: PhotoEntriesDb,
  input: PhotoEntryInsert,
): Promise<PhotoEntryRow> {
  const [row] = await db.insert(photoEntries).values(input).returning();
  if (!row) throw new Error("photoEntries.create: insert returned no row");
  return row;
}
```

From `src/contexts/catalog/infrastructure/db/schema.ts` (Phase 2 + Plan 05-02 extensions):
```ts
// Phase 2 — already shipped:
export const plants = pgTable("plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  speciesId: uuid("species_id").references(() => species.id, { onDelete: "set null" }),
  name: varchar("name", { length: 200 }).notNull(),
  nickname: varchar("nickname", { length: 200 }),
  location: varchar("location", { length: 200 }),
  acquisitionDate: date("acquisition_date"),                    // nullable — drives NULLS LAST
  notes: text("notes"),
  coverPhotoUrl: varchar("cover_photo_url", { length: 2048 }),
  createdAt: timestamp("created_at", ...).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", ...).notNull().defaultNow(),
}, /* indices */);

export const photoEntries = pgTable("photo_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  plantId: uuid("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  photoUrl: varchar("photo_url", { length: 2048 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 2048 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", ...).notNull().defaultNow(),
}, /* indices */);

// Plan 05-02 — shipped in Wave 1 (live in DB by the time this plan runs):
export const pendingDeletionStatus = pgEnum("pending_deletion_status", [
  "pending", "in_progress", "completed", "failed",
]);

export const pendingStorageDeletions = pgTable("pending_storage_deletions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bucket: text("bucket").notNull(),
  prefix: text("prefix").notNull(),
  status: pendingDeletionStatus("status").notNull().default("pending"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error"),
  scheduledAt: timestamp("scheduled_at", ...).notNull().defaultNow(),
  createdAt: timestamp("created_at", ...).notNull().defaultNow(),
  startedAt: timestamp("started_at", ...),                 // added by Plan 05-02 migration — set during markInProgress
  completedAt: timestamp("completed_at", ...),
}, /* psd_status_scheduled_at_idx, psd_user_id_idx */);

export const locationSuggestions = pgTable("location_suggestions", {
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  labelNormalized: varchar("label_normalized", { length: 200 }).notNull(),
  labelDisplay: varchar("label_display", { length: 200 }).notNull(),
  usageCount: integer("usage_count").notNull().default(1),
  lastUsedAt: timestamp("last_used_at", ...).notNull().defaultNow(),
  createdAt: timestamp("created_at", ...).notNull().defaultNow(),
}, /* primaryKey on (user_id, label_normalized), loc_suggestions_user_rank_idx */);
```

From `src/contexts/reminders/infrastructure/db/schema.ts` (Phase 2 — already shipped):
```ts
export const reminders = pgTable("reminders", {
  id: uuid("id").primaryKey().defaultRandom(),
  plantId: uuid("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 16, enum: ["watering", "fertilization"] as const }).notNull(),
  // ... other fields ...
});
```
Reminders ships in Phase 2 already (table exists). Phase 5 only counts rows; row creation is Phase 8 scope.

From `src/shared/api/cursor.ts` (Plan 05-02 additive exports — DO NOT redefine):
```ts
export const SORT_IDS = ["name_asc", "name_desc", "date_new", "date_old", "location"] as const;
export type SortId = (typeof SORT_IDS)[number];

export type SortCursorPayload = {
  sort_id: SortId;
  last_value: string | null;          // null = NULLS-LAST sentinel for date sorts
  last_id: string;                    // UUID of the last row of the previous page
};

export type SortCursorDecodeResult =
  | { ok: true; value: SortCursorPayload }
  | { ok: false; error: ErrorCode };  // ErrorCode.ValidationFailed

export function encodeSortCursor(payload: SortCursorPayload): string;
export function decodeSortCursor(encoded: string): SortCursorDecodeResult;

// Phase 2 (existing — keep using DEFAULT_LIMIT, MAX_LIMIT, normalizeLimit):
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export function normalizeLimit(input: string | number | null | undefined): number;
```

From `src/shared/db/client.ts`:
```ts
// `db` is the singleton Drizzle client connected as the `postgres` role,
// which has `rolbypassrls=true`. THAT is the "service-role client"
// referenced in RESEARCH Pitfall 4. There is no separate admin/service
// client to import — `db` itself bypasses RLS. Reconcilers and any
// non-request-context code path use `db` directly. Use-cases use
// `withUnitOfWork(userId, async (tx) => ...)` which switches to the
// `authenticated` role and binds `request.jwt.claim.sub` for RLS.
export const db = drizzle({ client: getSql(), schema });
export type DbClient = typeof db;
```

From `src/shared/db/unit-of-work.ts`:
```ts
export type TransactionalDb = Parameters<Parameters<DbClient["transaction"]>[0]>[0];
export async function withUnitOfWork<T>(userId: string, fn: (tx: TransactionalDb) => Promise<T>): Promise<T>;
// Inside `fn`, the connection is `SET LOCAL ROLE authenticated` and
// `request.jwt.claim.sub = userId` (transaction-scoped). RLS engages.
```

From `src/shared/config/errors.ts`:
```ts
export enum ErrorCode {
  ValidationFailed = "validation_failed",
  NotFound = "not_found",
  Forbidden = "forbidden",
  // ... others (closed registry — no ad-hoc codes).
}
```
</interfaces>

</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: plants.ts read repositories — list (5 sort modes + cursor) + countForUser + getCascadeCounts</name>
  <files>
    src/contexts/catalog/infrastructure/db/plants.ts
    tests/integration/catalog-plants-repo.integration.test.ts
  </files>

  <behavior>
    File `tests/integration/catalog-plants-repo.integration.test.ts` will assert (via Vitest `it(...)` test names — these names MUST appear in the file because `acceptance_criteria` cite them in `<verify>`):

    Each test seeds plants for two users (userA, userB) using the existing transaction-rollback pattern (Phase 2 D-43) and the `rls-real-jwt.integration.test.ts` style for cross-user proofs. Use `withUnitOfWork(userA.id, ...)` to insert seed rows so RLS is engaged, OR insert via the bare `db` superuser path (BYPASSRLS) when seeding cross-user fixtures — both are acceptable since the proof-of-denial test uses a SEPARATE postgres connection bound to `SET LOCAL ROLE authenticated`.

    `describe("plants repository — list")`:
    - `it("returns rows for date_new sort: acquisition_date DESC NULLS LAST, then id DESC tiebreak", ...)` — seed 5 plants for userA: 3 with distinct acquisition_dates, 2 with NULL acquisition_date. Call `list(db, { userId: userA.id, sort: "date_new", cursor: null, limit: 50 })`. Assert: non-null-date rows come first ordered by acquisition_date DESC; NULL-date rows last, ordered by id DESC.
    - `it("returns rows for date_old sort: acquisition_date ASC NULLS LAST, then id ASC tiebreak", ...)` — same seed; call with `sort: "date_old"`. Assert ASC ordering, NULLs still last (D-12 + CAT-07 verbatim "null dates last").
    - `it("returns rows for name_asc sort: name ASC, id ASC tiebreak", ...)` — seed 4 plants, two sharing the same name. Assert exact order.
    - `it("returns rows for name_desc sort: name DESC, id DESC tiebreak", ...)` — same seed, opposite direction.
    - `it("returns rows for location sort: location ASC NULLS LAST, id ASC tiebreak", ...)` — seed plants with mixed locations including NULL.
    - `it("cursor round-trip — date_new — second page starts strictly after the first page's last row", ...)` — seed 30 plants. Call `list({ limit: 10, sort: "date_new", cursor: null })` → 10 rows + nextCursor; call `list({ limit: 10, cursor: nextCursor })` → next 10 rows. Assert: zero overlap, contiguous ordering, total observed = 20 with no gaps.
    - `it("cursor round-trip — date_new — pagination crosses the NULL boundary correctly", ...)` — seed 5 non-null-date plants + 5 null-date plants. Page size 7 → first page = 5 non-null + 2 null. nextCursor encodes `{sort_id: "date_new", last_value: null, last_id: <2nd-null-row-id>}`. Second page returns the remaining 3 null rows; nextCursor for third page is null/undefined.
    - `it("cursor round-trip — name_asc — works the same way (no NULLS-LAST sentinel involved because name is NOT NULL)", ...)` — seed 20 plants; paginate with limit 7.
    - `it("cross-user cursor manipulation does NOT leak rows (T-05-03-01)", ...)` — seed 10 plants for userA, 10 for userB. Mint a cursor by paginating userA. Open a SECOND postgres connection, `SET LOCAL ROLE authenticated`, bind `request.jwt.claim.sub` to userB.id, and run the equivalent SELECT (the repo's own SQL is fine — RLS is the gate). Assert: the result set contains ONLY userB rows; userA rows are absent regardless of cursor contents.
    - `it("rejects invalid sort_id with an Error (defense in depth — Zod in cursor.ts already rejects, but list() also asserts the SortId enum)", ...)` — passing `sort: "evil_sort" as any` throws. The repository should narrow via the `SortId` type and rely on the upstream cursor decoder + use-case validation, but a runtime `if (!SORT_IDS.includes(sort))` guard inside `list` is acceptable belt-and-braces.

    `describe("plants repository — countForUser")`:
    - `it("returns 0 for a user with no plants", ...)`.
    - `it("returns the exact number of plants for a user, ignoring other users' rows", ...)` — seed 7 for userA + 4 for userB; assert countForUser(userA) === 7.

    `describe("plants repository — getCascadeCounts")`:
    - `it("returns {photo_entry_count: 0, reminder_count: 0} for a freshly-created plant", ...)`.
    - `it("returns the right counts when the plant has photo_entries and reminders", ...)` — seed 1 plant for userA, 3 PhotoEntries on it, 2 reminders on it (use the bare `db` superuser path for the reminders insert since reminders is Phase 8 scope and has no use-case yet — direct SQL/Drizzle is acceptable in test setup).
    - `it("counts only the entries belonging to the target plant (no leak across plants of the same user)", ...)` — seed 2 plants for userA with 2 photo_entries each + 1 reminder on plant A only; assert getCascadeCounts(plantA) === {photo_entry_count: 2, reminder_count: 1}.

    Each `it` is the only acceptance criterion: green = task done.
  </behavior>

  <action>
    **RED — Step 1.1:** Create `tests/integration/catalog-plants-repo.integration.test.ts` with all `it` cases above (initially failing because `list` / `countForUser` / `getCascadeCounts` don't exist yet on `plants.ts`). Use:
    - `import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";`
    - `import { db } from "@shared/db/client";`
    - `import { withUnitOfWork } from "@shared/db/unit-of-work";`
    - `import { plants, photoEntries } from "@contexts/catalog/infrastructure/db/schema";`
    - `import { reminders } from "@contexts/reminders/infrastructure/db/schema";`
    - `import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";`
    - `import { encodeSortCursor, decodeSortCursor, type SortId } from "@shared/api/cursor";`
    - For seeding two real users: reuse the helper pattern from `tests/integration/rls-real-jwt.integration.test.ts` (Supabase admin createUser → public.users sync). Wrap that helper or copy it locally with the same cleanup pattern (`auth.admin.deleteUser` + `DELETE FROM public.users` in `afterAll`). For the cross-user-RLS proof, open a SEPARATE postgres-js connection in the test, `SET LOCAL ROLE authenticated`, and bind `request.jwt.claim.sub` exactly as `rls-real-jwt.integration.test.ts:80-110` does.

    Run `pnpm test:integration -- catalog-plants-repo` and confirm all new tests fail with `is not a function` / `Cannot read properties of undefined`. Commit: `test(05-03): add failing plants repo read suite`.

    **GREEN — Step 1.2:** Extend `src/contexts/catalog/infrastructure/db/plants.ts` (do NOT replace `findByIdForUser`):

    Add new exports:
    ```ts
    import { and, asc, count, desc, eq, gt, inArray, isNull, lt, or, sql } from "drizzle-orm";
    import { plants } from "@contexts/catalog/infrastructure/db/schema";
    import { photoEntries } from "@contexts/catalog/infrastructure/db/schema";
    import { reminders } from "@contexts/reminders/infrastructure/db/schema";
    import { type SortId, type SortCursorPayload, SORT_IDS } from "@shared/api/cursor";

    export type PlantListParams = {
      userId: string;
      sort: SortId;
      cursor: SortCursorPayload | null;
      limit: number;
    };

    export type PlantListResult = {
      rows: PlantRow[];
      nextCursor: SortCursorPayload | null;     // null when no more rows
    };

    export async function list(db: PlantsDb, params: PlantListParams): Promise<PlantListResult> {
      // 1. Build ORDER BY for the requested sort_id (NULLS LAST + tiebreak by id).
      // 2. Build WHERE clause: always include `plants.userId = params.userId`.
      //    If params.cursor is non-null, add the strict-after predicate based on
      //    sort_id (see "Sort/cursor predicate matrix" in <action> below).
      // 3. .limit(params.limit + 1)  — over-fetch by 1 to detect "has next page".
      // 4. If results.length > params.limit, slice to params.limit and mint
      //    nextCursor from the last row of the page; else nextCursor = null.
      // 5. Return { rows, nextCursor }.
    }

    export async function countForUser(db: PlantsDb, userId: string): Promise<number> {
      const [row] = await db
        .select({ count: count() })
        .from(plants)
        .where(eq(plants.userId, userId));
      return Number(row?.count ?? 0);
    }

    export async function getCascadeCounts(
      db: PlantsDb,
      params: { userId: string; plantId: string },
    ): Promise<{ photo_entry_count: number; reminder_count: number }> {
      // Two SELECT count(*) queries (or a single CTE). Filter photo_entries by plant_id.
      // Reminders are joined to plants via plant_id (no user_id column on reminders);
      // because callers always pass {userId, plantId} that have already passed
      // findByIdForUser ownership, the reminders count is correctly scoped.
      // Defense in depth: assert the plant exists and belongs to userId BEFORE
      // running the count queries — return {0, 0} if findByIdForUser returns null.
    }
    ```

    **Sort/cursor predicate matrix (literal SQL behavior — match exactly):**

    Translate `params.sort` into ORDER BY plus a strict-after WHERE clause when `params.cursor` is non-null. `last_value` and `last_id` come from the cursor.

    | sort_id    | ORDER BY                                                | WHERE strict-after (when cursor present)                                                                                                                                                                       |
    |------------|---------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
    | date_new   | `acquisition_date DESC NULLS LAST, id DESC`             | `(last_value IS NOT NULL AND (acquisition_date < last_value OR (acquisition_date = last_value AND id < last_id) OR acquisition_date IS NULL))` OR `(last_value IS NULL AND acquisition_date IS NULL AND id < last_id)` |
    | date_old   | `acquisition_date ASC NULLS LAST, id ASC`               | `(last_value IS NOT NULL AND (acquisition_date > last_value OR (acquisition_date = last_value AND id > last_id) OR acquisition_date IS NULL))` OR `(last_value IS NULL AND acquisition_date IS NULL AND id > last_id)` |
    | name_asc   | `name ASC, id ASC`                                      | `name > last_value OR (name = last_value AND id > last_id)` (last_value is always non-null because name is NOT NULL — the codec still allows null, but a real name_asc cursor will never carry null)            |
    | name_desc  | `name DESC, id DESC`                                    | `name < last_value OR (name = last_value AND id < last_id)`                                                                                                                                                    |
    | location   | `location ASC NULLS LAST, id ASC`                       | Same shape as date_old but on `location` instead of `acquisition_date`                                                                                                                                         |

    To express NULLS LAST in Drizzle: use `sql\`${plants.acquisitionDate} desc nulls last\`` inside `.orderBy(...)`. (Drizzle does not have a first-class NULLS LAST helper as of 0.45.x — raw SQL fragment is the supported pattern.)

    Build the `nextCursor` for the page's last row:
    - For `date_new` / `date_old`: `last_value = lastRow.acquisitionDate ?? null` (string ISO date or null), `last_id = lastRow.id`, `sort_id = params.sort`.
    - For `name_asc` / `name_desc`: `last_value = lastRow.name`, `last_id = lastRow.id`.
    - For `location`: `last_value = lastRow.location ?? null`, `last_id = lastRow.id`.

    Run `pnpm test:integration -- catalog-plants-repo` and confirm green. Commit: `feat(05-03): plants.list + countForUser + getCascadeCounts`.

    **REFACTOR — Step 1.3 (only if needed):** If the predicate-matrix logic is awkwardly nested, extract a `buildSortClauses(sort, cursor)` helper inside the same file that returns `{ orderBy, where }` arrays. Re-run tests. If the helper feels artificial (less than ~30 lines saved), skip the refactor — premature DRY hides the predicate matrix that future readers will want to see directly. Commit: `refactor(05-03): extract sort+cursor predicate builder` (only if a refactor was applied).
  </action>

  <verify>
    <automated>pnpm test:integration -- catalog-plants-repo</automated>
  </verify>

  <done>
    - `src/contexts/catalog/infrastructure/db/plants.ts` exports `list`, `countForUser`, `getCascadeCounts` alongside `findByIdForUser`.
    - All `it(...)` tests in `tests/integration/catalog-plants-repo.integration.test.ts` are green under `pnpm test:integration -- catalog-plants-repo`.
    - The cross-user cursor test (T-05-03-01 mitigation) passes: a cursor minted by userA returns ZERO rows when the SQL runs under `SET LOCAL ROLE authenticated` bound to userB's JWT sub.
    - `git grep "from \"@contexts/catalog/infrastructure/db/plants\"" src/` shows no use-case-layer consumers added in this plan (consumers are 05-05/05-07's job).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: plants.ts mutations + photo-entries.ts extensions (create/update/delete + bumpCoverFor + list/delete)</name>
  <files>
    src/contexts/catalog/infrastructure/db/plants.ts
    src/contexts/catalog/infrastructure/db/photo-entries.ts
    tests/integration/catalog-plants-repo.integration.test.ts
    tests/integration/catalog-photo-entries-repo.integration.test.ts
  </files>

  <behavior>
    Extend `tests/integration/catalog-plants-repo.integration.test.ts` (from Task 1) with mutation suites, AND create new file `tests/integration/catalog-photo-entries-repo.integration.test.ts`.

    `describe("plants repository — create")`:
    - `it("inserts a row scoped to the supplied userId and returns it", ...)` — call `plantsRepo.create(db, { userId: userA.id, name: "Costela", ... })` and assert returned row's user_id === userA.id and id is a UUID.
    - `it("respects required NOT NULL fields (throws on missing name)", ...)` — passing `name: ""` or omitting it: the schema enforces NOT NULL + length ≥ 1 (Zod is upstream — repo just respects DB constraint and lets it throw).

    `describe("plants repository — update")`:
    - `it("updates only fields supplied and only for the row owned by userId", ...)` — seed plant for userA. Call `update(tx, { userId: userA.id, plantId, fields: { name: "Novo nome", location: "Sala" } })` inside `withUnitOfWork(userA.id, ...)`. Assert only those two fields changed; `updated_at` advances.
    - `it("returns null and does NOT mutate when plant belongs to another user", ...)` — seed plant for userB. Call `update(tx, { userId: userA.id, plantId: userB_plant.id, fields: { name: "hijack" } })` inside `withUnitOfWork(userA.id, ...)`. Expect: returned row is `null` (or function returns 0 affected rows — pick one convention and document it). The userB plant's name MUST be unchanged when re-read.
    - `it("update touches updated_at automatically", ...)` — assert `updatedAt` strictly greater after update.

    `describe("plants repository — delete")`:
    - `it("deletes a row owned by userId and returns the deleted row (or boolean)", ...)`.
    - `it("returns null and does NOT delete when plant belongs to another user", ...)` — same shape as update cross-user denial.
    - `it("cascades delete to photo_entries (FK ON DELETE CASCADE) — verified by post-delete count=0", ...)` — seed plant + 3 photo_entries. Call delete. Re-query `photo_entries WHERE plant_id = $deleted` — expect 0 rows (the FK cascade is from the table definition, but this test proves it engages even when the delete goes through the repo path).
    - `it("cascades delete to reminders (FK ON DELETE CASCADE) — verified by post-delete count=0", ...)` — same shape.

    `describe("photo_entries repository — list")`:
    - `it("returns rows for the requested plantId ordered by created_at ASC (oldest first — drives D-03 cover ordering and journal reverse-chrono is callers' job)", ...)` — seed 4 PhotoEntries on plant A and 2 on plant B; assert list({plantId: planA.id}).length === 4.

    `describe("photo_entries repository — delete")`:
    - `it("deletes the row by id", ...)`.

    `describe("photo_entries repository — bumpCoverFor (D-03 cover auto-promote)")`:
    - `it("sets cover_photo_url to the oldest non-deleted photo_entry's photo_url, in the SAME transaction", ...)` — seed plant for userA with 3 PhotoEntries inserted at distinct `created_at` (T0, T1, T2). Set `plants.cover_photo_url` to T2's photo_url (simulating "current cover was just deleted"). Inside `withUnitOfWork(userA.id, async (tx) => { await photoEntriesRepo.bumpCoverFor(tx, { userId: userA.id, plantId: planA.id }); })`. Re-read plants row. Assert `cover_photo_url === T0.photo_url` (oldest).
    - `it("sets cover_photo_url to NULL when no photo_entries remain", ...)` — seed plant + delete all entries. Call bumpCoverFor. Assert cover_photo_url === null.
    - `it("filters the plants UPDATE by user_id (defense in depth — does NOT touch plants belonging to another user even if plantId collides — synthetic test using two plants with the same id is impossible due to PK, so this assertion is shape-level: grep that the implementation includes user_id in the UPDATE WHERE)", ...)` — implement as a unit-style assertion: `await tx.execute(sql\`...\`)` is harder to introspect, so instead: seed plant for userB. Inside `withUnitOfWork(userA.id, async (tx) => bumpCoverFor(tx, { userId: userA.id, plantId: userB_plant.id }))`. Assert: userB_plant.cover_photo_url unchanged AND no error (UPDATE with `WHERE id = $1 AND user_id = $2` simply matches 0 rows).
  </behavior>

  <action>
    **RED — Step 2.1:** Extend `tests/integration/catalog-plants-repo.integration.test.ts` with the `create` / `update` / `delete` describe blocks. Create new file `tests/integration/catalog-photo-entries-repo.integration.test.ts` with the photo-entries describe blocks. Run `pnpm test:integration -- "catalog-(plants|photo-entries)-repo"` and confirm new tests fail. Commit: `test(05-03): add failing plants mutations + photo-entries repo suites`.

    **GREEN — Step 2.2:** Extend `src/contexts/catalog/infrastructure/db/plants.ts`:

    ```ts
    export type PlantInsert = typeof plants.$inferInsert;

    export async function create(
      db: PlantsDb,
      input: PlantInsert,                          // input.userId is required
    ): Promise<PlantRow> {
      const [row] = await db.insert(plants).values(input).returning();
      if (!row) throw new Error("plants.create: insert returned no row");
      return row;
    }

    export type PlantUpdate = Partial<
      Pick<PlantInsert, "name" | "nickname" | "location" | "acquisitionDate" | "notes" | "coverPhotoUrl" | "speciesId">
    >;

    export async function update(
      db: PlantsDb,
      params: { userId: string; plantId: string; fields: PlantUpdate },
    ): Promise<PlantRow | null> {
      // Always include WHERE user_id = $userId AND id = $plantId — RLS is defense in depth.
      // Manually advance updated_at: { ...params.fields, updatedAt: sql`now()` }.
      const [row] = await db
        .update(plants)
        .set({ ...params.fields, updatedAt: sql`now()` })
        .where(and(eq(plants.userId, params.userId), eq(plants.id, params.plantId)))
        .returning();
      return row ?? null;
    }

    export async function delete_(
      db: PlantsDb,
      params: { userId: string; plantId: string },
    ): Promise<PlantRow | null> {
      const [row] = await db
        .delete(plants)
        .where(and(eq(plants.userId, params.userId), eq(plants.id, params.plantId)))
        .returning();
      return row ?? null;
    }
    // Re-export under the public name "delete" — `delete` is a reserved word
    // in JS/TS, so functional repos use a trailing underscore convention.
    // Either: `export { delete_ as delete };` OR rename the function to
    // `deletePlant`. Pick `deletePlant` for clarity (matches reminders repo
    // conventions in Phase 8 spec) — adjust test imports accordingly.
    ```

    Decide once and stick with it: rename to `deletePlant` (function) and call it that throughout. Update `<interfaces>` consumers in 05-06 / 05-09 to expect `deletePlant`.

    Extend `src/contexts/catalog/infrastructure/db/photo-entries.ts`:

    ```ts
    import { and, asc, eq, sql } from "drizzle-orm";
    import { plants } from "@contexts/catalog/infrastructure/db/schema";

    export async function list(
      db: PhotoEntriesDb,
      params: { plantId: string },
    ): Promise<PhotoEntryRow[]> {
      return db
        .select()
        .from(photoEntries)
        .where(eq(photoEntries.plantId, params.plantId))
        .orderBy(asc(photoEntries.createdAt), asc(photoEntries.id));
    }

    export async function deletePhotoEntry(
      db: PhotoEntriesDb,
      params: { photoEntryId: string },
    ): Promise<PhotoEntryRow | null> {
      const [row] = await db
        .delete(photoEntries)
        .where(eq(photoEntries.id, params.photoEntryId))
        .returning();
      return row ?? null;
    }

    /**
     * D-03 cover auto-promote. MUST run inside a transaction so the SELECT
     * + UPDATE see a consistent snapshot. The plants UPDATE is filtered by
     * BOTH `id` and `user_id` even though the caller already verified
     * ownership via findByIdForUser — defense in depth (T-02-12 mitigation).
     *
     * Returns the new cover_photo_url (or null when no entries remain).
     */
    export async function bumpCoverFor(
      tx: TransactionalDb,                          // strict — bare `db` not accepted
      params: { userId: string; plantId: string },
    ): Promise<string | null> {
      const [oldest] = await tx
        .select({ photoUrl: photoEntries.photoUrl })
        .from(photoEntries)
        .where(eq(photoEntries.plantId, params.plantId))
        .orderBy(asc(photoEntries.createdAt), asc(photoEntries.id))
        .limit(1);

      const nextCover = oldest?.photoUrl ?? null;

      await tx
        .update(plants)
        .set({ coverPhotoUrl: nextCover, updatedAt: sql`now()` })
        .where(and(eq(plants.id, params.plantId), eq(plants.userId, params.userId)));

      return nextCover;
    }
    ```

    **Type-narrowing note:** `bumpCoverFor` accepts ONLY `TransactionalDb` (not the union). This is intentional — the function is meaningless outside a transaction (the SELECT + UPDATE need atomicity). Use `import { type TransactionalDb } from "@shared/db/unit-of-work";` and DO NOT widen the parameter type.

    Run `pnpm test:integration -- "catalog-(plants|photo-entries)-repo"` and confirm all tests green. Commit: `feat(05-03): plants mutations + photo-entries list/delete/bumpCoverFor`.

    **REFACTOR — Step 2.3 (only if needed):** If `update` and the soon-to-come `pending-storage-deletions.markX` family duplicate the "set ... where (id+ownership) ... returning" shape excessively, leave it for now — these are different tables with different ownership keys (plants has user_id; pending_storage_deletions has user_id but reconciler bypasses RLS). Skip the refactor; commit only if a real duplication was eliminated.
  </action>

  <verify>
    <automated>pnpm test:integration -- "catalog-(plants|photo-entries)-repo"</automated>
  </verify>

  <done>
    - `plants.ts` exports `create`, `update`, `deletePlant` alongside the read functions from Task 1.
    - `photo-entries.ts` exports `list`, `deletePhotoEntry`, `bumpCoverFor` alongside the existing `create`.
    - Cross-user mutation tests pass (T-02-12 defense in depth holds at the repo layer).
    - `bumpCoverFor` test confirms the SELECT + UPDATE happen in the same TX and the UPDATE WHERE includes user_id.
    - `git grep "bumpCoverFor" src/contexts/catalog/infrastructure/db/photo-entries.ts | grep -v "^#" | grep -c "TransactionalDb"` is `>= 1` (the parameter type is `TransactionalDb`, not the wider union).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: pending-storage-deletions.ts (state machine + service-role discipline) + location-suggestions.ts (upsert + listForUser) + normalizeLocationLabel helper + RLS proofs</name>
  <files>
    src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
    src/contexts/catalog/infrastructure/db/location-suggestions.ts
    src/contexts/catalog/domain/locations.ts
    tests/unit/catalog-locations-normalize.test.ts
    tests/integration/catalog-pending-storage-deletions-repo.integration.test.ts
    tests/integration/catalog-location-suggestions-repo.integration.test.ts
  </files>

  <behavior>
    `describe("normalizeLocationLabel")` (unit, runs under `pnpm test:unit`):
    - `it("trims surrounding whitespace", ...)` — `normalizeLocationLabel("  Sala  ")` === `"sala"`.
    - `it("lowercases using pt-BR locale rules", ...)` — `normalizeLocationLabel("Sala")` === `"sala"`.
    - `it("folds Portuguese diacritics (NFD + remove diacritic property)", ...)` — `normalizeLocationLabel("Varanda dos Fundos")` and `normalizeLocationLabel("varanda dos fúndos")` produce the SAME normalized form (the cedilla / acute / tilde / circumflex / grave / diaeresis combos used in pt-BR collapse). Specifically: `normalizeLocationLabel("Cozinha")` === `normalizeLocationLabel("cozinhã")` (this exact pair: assert equality after normalization).
    - `it("collapses internal whitespace runs to a single space", ...)` — `normalizeLocationLabel("Quarto   dos  fundos")` === `"quarto dos fundos"`.
    - `it("is idempotent — normalize(normalize(x)) === normalize(x)", ...)` — for 6 sample inputs.
    - `it("returns empty string for whitespace-only input", ...)` — `normalizeLocationLabel("   ")` === `""`. Callers (location-suggestions.upsert) guard against empty.

    `describe("pending_storage_deletions repository")` (integration, runs under `pnpm test:integration`):
    - `it("create() inserts a row with status='pending', attempts=0, scheduled_at defaulting to now()", ...)`.
    - `it("markInProgress(id) transitions status to 'in_progress', increments attempts by 1, and sets started_at = now()", ...)` — assert returned row has `status === 'in_progress'`, `attempts === 1` (assuming first call), and `startedAt` is a non-null Date value close to now.
    - `it("markCompleted(id) transitions status to 'completed' and sets completed_at", ...)`.
    - `it("recordError(id, message) sets last_error and transitions status to 'pending' when attempts < 5 (attempts 1–4)", ...)` — call `markInProgress` (attempts becomes 1), then `recordError(id, "network timeout")`. Assert: returned row has `status === 'pending'`, `lastError === 'network timeout'`.
    - `it("recordError(id, message) transitions status to 'failed' when attempts = 5 (final attempt)", ...)` — call `markInProgress` four more times to bring attempts to 5 (or directly update attempts=5 in DB setup), then call `recordError`. Assert: returned row has `status === 'failed'`.
    - `it("markFailed(id) transitions status to 'failed' (terminal)", ...)`.
    - `it("fetchPendingBatch(db, limit=50) — no opts — returns up to limit rows with status='pending' AND scheduled_at <= now(), does NOT include in_progress rows", ...)` — seed 60 pending rows + 10 in_progress + 5 completed; assert returned length === 50, all have `status === 'pending'`, none are `'in_progress'`, all scheduled_at <= now().
    - `it("fetchPendingBatch(db, limit=50, { staleInProgressMinutes: 30 }) returns pending rows AND in_progress rows whose started_at is older than 30 minutes", ...)` — seed 5 fresh pending rows + 2 in_progress rows with `started_at = NOW() - INTERVAL '45 minutes'` + 3 in_progress rows with `started_at = NOW() - INTERVAL '10 minutes'` (not yet stale). Assert: returned rows include the 5 pending AND the 2 stale in_progress rows (total 7); the 3 fresh in_progress rows are excluded.
    - `it("fetchPendingBatch skips rows with future scheduled_at", ...)` — seed 5 pending rows scheduled 1h in the future; assert excluded.
    - `it("fetchPendingBatch — concurrent invocations do NOT process the same row twice (FOR UPDATE SKIP LOCKED)", ...)` — open two postgres-js connections, BEGIN on both, run fetchPendingBatch(50) on connection 1 (don't COMMIT yet), run fetchPendingBatch(50) on connection 2. Assert: returned ID sets are disjoint. COMMIT both. (This is the only behavioral test that PROVES the SKIP LOCKED clause is in the SQL.)
    - `it("fetchPendingBatch under SET LOCAL ROLE authenticated returns ZERO rows even when pending rows exist (T-05-03-02 — service-role discipline)", ...)` — seed 5 pending rows owned by userA via `db` (BYPASSRLS). Open SECOND postgres-js connection, BEGIN, `SET LOCAL ROLE authenticated`, bind `request.jwt.claim.sub` to userA.id. Run the equivalent SELECT (or call the repo function with that connection's tx — easier: replicate the SQL with the `for('update', {skipLocked: true})` shape). Assert returned rows.length === 0. The RLS owner-only policy denies all rows because the policy compiles at parse time but `auth.uid()` resolves to userA, while the row's user_id is userA — wait, that should MATCH. Re-read CONTEXT D-23: RLS is owner-only `auth.uid() = user_id`. Under userA's authenticated session, the rows DO match. Re-read RESEARCH Pitfall 4: "running as authenticated WITHOUT a JWT would deny access" — the discipline is that the reconciler runs WITH NO JWT context (no `SET request.jwt.claim.sub`), so `auth.uid()` is NULL and the `auth.uid() = user_id` predicate fails for every row. Adjust the test: open a SECOND postgres-js connection, BEGIN, `SET LOCAL ROLE authenticated` BUT do NOT bind `request.jwt.claim.sub`. Assert returned rows.length === 0. THIS proves the discipline: a misuse that ran the reconciler under `withUnitOfWork(userId, ...)` would actually return rows (because the binding IS present); but a misuse that strips the userId and just switches role denies all. The behavioral assertion that codifies the rule: "without an explicit `request.jwt.claim.sub` binding, the authenticated role sees zero pending rows." Add a comment in the test explaining why.
    - `it("RLS owner-only — userB cannot SELECT userA's pending_storage_deletions rows", ...)` — bind userB's JWT sub to a separate connection; assert SELECT returns 0 rows that belong to userA.
    - `it("RLS owner-only — userB cannot INSERT a row claiming userA's user_id", ...)` — under userB's authenticated session, attempt INSERT with userId=userA. Assert error or 0 rows inserted (RLS WITH CHECK denies).

    `describe("location_suggestions repository")` (integration):
    - `it("upsert() inserts a new row on first call with usage_count=1 and last_used_at=now()", ...)`.
    - `it("upsert() ON CONFLICT increments usage_count by 1 and touches last_used_at", ...)` — call upsert(userA, "Sala") twice; assert second row has usage_count=2 AND last_used_at strictly greater than the first call.
    - `it("upsert() folds diacritics — 'Varanda' and 'varánda' resolve to the SAME row (label_normalized PK collision)", ...)` — call upsert(userA, "Varanda") then upsert(userA, "varánda"); assert exactly ONE row exists for userA, usage_count=2, label_display = whichever was inserted first ("Varanda" — ON CONFLICT does NOT update label_display).
    - `it("upsert() — different users with the same label coexist as two rows (composite PK on user_id + label_normalized)", ...)`.
    - `it("upsert() rejects empty/whitespace-only labels (returns null or throws ValidationError — pick one)", ...)` — guard at the top of upsert via `if (!normalized) return null`.
    - `it("listForUser(userId, 20) returns rows ordered by usage_count DESC, last_used_at DESC, limited to 20", ...)` — seed 25 rows with varied usage_counts; assert top 20 with correct ordering.
    - `it("listForUser excludes rows from other users", ...)` — seed 3 rows for userA, 5 for userB; assert listForUser(userA).length === 3.
    - `it("RLS owner-only on location_suggestions — userB authenticated cannot SELECT userA's rows (T-05-03-03)", ...)`.
  </behavior>

  <action>
    **RED — Step 3.1:** Create three new test files:
    - `tests/unit/catalog-locations-normalize.test.ts` (unit project, runs under `pnpm test:unit`)
    - `tests/integration/catalog-pending-storage-deletions-repo.integration.test.ts`
    - `tests/integration/catalog-location-suggestions-repo.integration.test.ts`

    Populate with the `it(...)` cases above. Run `pnpm test:unit -- catalog-locations-normalize` and `pnpm test:integration -- "catalog-(pending-storage-deletions|location-suggestions)-repo"`. Confirm all fail. Commit: `test(05-03): add failing pending-deletions + location-suggestions + normalize suites`.

    **GREEN — Step 3.2:** Create `src/contexts/catalog/domain/locations.ts`:

    ```ts
    /**
     * Per-user location suggestion normalization (D-09 + D-10).
     *
     * Used by the location_suggestions repo to derive the composite-PK
     * `label_normalized` column from the user-typed `label_display`. Two
     * variants of the same place ("Varanda" / "varanda" / "varánda") MUST
     * collapse to one row in the suggestions table — otherwise the user
     * sees their own duplicate suggestions in the combobox.
     *
     * Implementation: trim, lowercase using pt-BR locale rules, NFD-decompose
     * to separate base char from combining marks, then strip combining marks
     * via the Unicode "Diacritic" property regex. Internal whitespace runs
     * collapse to a single space.
     */
    export function normalizeLocationLabel(input: string): string {
      return input
        .trim()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .replace(/\s+/g, " ");
    }
    ```

    Create `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts`:

    ```ts
    import { and, asc, eq, lte, sql } from "drizzle-orm";

    import { type DbClient } from "@shared/db/client";
    import { type TransactionalDb } from "@shared/db/unit-of-work";
    import { pendingStorageDeletions } from "@contexts/catalog/infrastructure/db/schema";

    type PsdDb = DbClient | TransactionalDb;

    export type PendingStorageDeletionRow = typeof pendingStorageDeletions.$inferSelect;
    export type PendingStorageDeletionInsert = typeof pendingStorageDeletions.$inferInsert;

    export async function create(
      db: PsdDb,
      input: PendingStorageDeletionInsert,
    ): Promise<PendingStorageDeletionRow> {
      const [row] = await db.insert(pendingStorageDeletions).values(input).returning();
      if (!row) throw new Error("pendingStorageDeletions.create: insert returned no row");
      return row;
    }

    export async function markInProgress(
      db: PsdDb,
      id: string,
    ): Promise<PendingStorageDeletionRow | null> {
      const [row] = await db
        .update(pendingStorageDeletions)
        .set({
          status: "in_progress",
          attempts: sql`${pendingStorageDeletions.attempts} + 1`,
          startedAt: sql`now()`,
        })
        .where(eq(pendingStorageDeletions.id, id))
        .returning();
      return row ?? null;
    }

    export async function markCompleted(
      db: PsdDb,
      id: string,
    ): Promise<PendingStorageDeletionRow | null> {
      const [row] = await db
        .update(pendingStorageDeletions)
        .set({ status: "completed", completedAt: sql`now()` })
        .where(eq(pendingStorageDeletions.id, id))
        .returning();
      return row ?? null;
    }

    export async function recordError(
      db: PsdDb,
      id: string,
      message: string,
    ): Promise<PendingStorageDeletionRow | null> {
      // Transition: return to 'pending' if attempts < 5 (retry-able), else 'failed' (terminal).
      // `markInProgress` already incremented attempts, so we compare the current value.
      const [row] = await db
        .update(pendingStorageDeletions)
        .set({
          status: sql`CASE WHEN ${pendingStorageDeletions.attempts} >= 5 THEN 'failed'::pending_deletion_status ELSE 'pending'::pending_deletion_status END`,
          lastError: message,
        })
        .where(eq(pendingStorageDeletions.id, id))
        .returning();
      return row ?? null;
    }

    export async function markFailed(
      db: PsdDb,
      id: string,
    ): Promise<PendingStorageDeletionRow | null> {
      const [row] = await db
        .update(pendingStorageDeletions)
        .set({ status: "failed" })
        .where(eq(pendingStorageDeletions.id, id))
        .returning();
      return row ?? null;
    }

    /**
     * **Service-role only.** This function MUST be called with the bare
     * `db` singleton from `@shared/db/client` (which connects as the
     * `postgres` BYPASSRLS role). Calling it inside `withUnitOfWork(...)`
     * would `SET LOCAL ROLE authenticated` and `auth.uid()` would resolve
     * to the request's userId — which is the wrong scope (the reconciler
     * processes rows across all users). RESEARCH Pitfall 4.
     *
     * The integration test in `catalog-pending-storage-deletions-repo.integration.test.ts`
     * proves the discipline by running this query under the authenticated
     * role with NO `request.jwt.claim.sub` binding and asserting zero
     * rows returned. Future code-review must reject any caller that
     * imports this function and wraps it in withUnitOfWork.
     *
     * SQL contract (no opts — Inngest happy-path):
     *   SELECT * FROM pending_storage_deletions
     *   WHERE status = 'pending' AND scheduled_at <= now()
     *   ORDER BY scheduled_at ASC
     *   LIMIT $1
     *   FOR UPDATE SKIP LOCKED
     *
     * SQL contract (with opts.staleInProgressMinutes — reconciler cron):
     *   SELECT * FROM pending_storage_deletions
     *   WHERE (status = 'pending' OR (status = 'in_progress' AND started_at < NOW() - INTERVAL '30 minutes'))
     *     AND scheduled_at <= now()
     *   ORDER BY scheduled_at ASC
     *   LIMIT $1
     *   FOR UPDATE SKIP LOCKED
     *
     * The FOR UPDATE SKIP LOCKED clause is what allows multiple reconciler
     * invocations to run safely against the same table (D-24).
     */
    export async function fetchPendingBatch(
      db: DbClient,                                  // strict — TransactionalDb NOT accepted
      limit: number,
      opts?: { staleInProgressMinutes?: number },
    ): Promise<PendingStorageDeletionRow[]> {
      const staleMinutes = opts?.staleInProgressMinutes;

      const statusCondition = staleMinutes !== undefined
        ? sql`(${pendingStorageDeletions.status} = 'pending' OR (${pendingStorageDeletions.status} = 'in_progress' AND ${pendingStorageDeletions.startedAt} < now() - make_interval(mins => ${staleMinutes})))`
        : eq(pendingStorageDeletions.status, "pending");

      return db
        .select()
        .from(pendingStorageDeletions)
        .where(
          and(
            statusCondition,
            lte(pendingStorageDeletions.scheduledAt, sql`now()`),
          ),
        )
        .orderBy(asc(pendingStorageDeletions.scheduledAt))
        .limit(limit)
        .for("update", { skipLocked: true });
    }
    ```

    **Verify the Drizzle `for('update', { skipLocked: true })` API exists in 0.45.x:** if `pnpm exec tsc --noEmit` complains, check Drizzle docs for the correct method name (it may be `.for("update").skipLocked()` chained, or `.for({ strength: "update", skipLocked: true })`). Adjust the call site to whatever 0.45.x supports while preserving the SQL semantics. The CONCURRENT-fetch test from RED is the empirical truth — if it passes, the SQL is right regardless of how Drizzle expresses it. **Verify the `make_interval(mins => ${staleMinutes})` Postgres function is available in the target Supabase Postgres version:** if not, use `(${staleMinutes} || ' minutes')::interval` instead — both produce equivalent SQL and are safe against injection because `staleMinutes` is a TypeScript `number`.

    Create `src/contexts/catalog/infrastructure/db/location-suggestions.ts`:

    ```ts
    import { and, desc, eq, sql } from "drizzle-orm";

    import { type DbClient } from "@shared/db/client";
    import { type TransactionalDb } from "@shared/db/unit-of-work";
    import { locationSuggestions } from "@contexts/catalog/infrastructure/db/schema";
    import { normalizeLocationLabel } from "@contexts/catalog/domain/locations";

    type LocSuggestionsDb = DbClient | TransactionalDb;

    export type LocationSuggestionRow = typeof locationSuggestions.$inferSelect;

    /**
     * Per phase-5 D-09: every plant create + every plant edit that touches
     * the location field upserts here (ON CONFLICT increment usage_count +
     * touch last_used_at). Plant DELETE does NOT decrement.
     *
     * `label_normalized` is derived from `label` via `normalizeLocationLabel`
     * (NFD diacritic fold + lowercase + trim + whitespace collapse) so that
     * "Varanda", "varanda", and "varánda" all resolve to the same row.
     *
     * On CONFLICT, `label_display` is NOT updated — first writer wins on
     * casing/accents (so "Varanda" stays "Varanda" even when "varanda" is
     * later upserted).
     */
    export async function upsert(
      db: LocSuggestionsDb,
      params: { userId: string; label: string },
    ): Promise<LocationSuggestionRow | null> {
      const labelNormalized = normalizeLocationLabel(params.label);
      if (labelNormalized.length === 0) return null;          // no-op on empty

      const [row] = await db
        .insert(locationSuggestions)
        .values({
          userId: params.userId,
          labelNormalized,
          labelDisplay: params.label.trim(),
          usageCount: 1,
        })
        .onConflictDoUpdate({
          target: [locationSuggestions.userId, locationSuggestions.labelNormalized],
          set: {
            usageCount: sql`${locationSuggestions.usageCount} + 1`,
            lastUsedAt: sql`now()`,
          },
        })
        .returning();

      return row ?? null;
    }

    export async function listForUser(
      db: LocSuggestionsDb,
      params: { userId: string; limit: number },
    ): Promise<LocationSuggestionRow[]> {
      return db
        .select()
        .from(locationSuggestions)
        .where(eq(locationSuggestions.userId, params.userId))
        .orderBy(
          desc(locationSuggestions.usageCount),
          desc(locationSuggestions.lastUsedAt),
        )
        .limit(params.limit);
    }
    ```

    Run `pnpm test:unit -- catalog-locations-normalize` and `pnpm test:integration -- "catalog-(pending-storage-deletions|location-suggestions)-repo"`. Confirm all green. Commit: `feat(05-03): pending-storage-deletions + location-suggestions repos + normalize helper`.

    **REFACTOR — Step 3.3 (only if needed):** If the pending_storage_deletions state-mutation helpers (markInProgress / markCompleted / recordError / markFailed) have nearly identical bodies, optionally extract a private `setStatus(db, id, partial)` helper. Re-run integration tests. If the abstraction obscures the state-machine reading order, leave the helpers unfactored (each one explicitly names its transition — readability wins over DRY here). Commit only if a real reduction happened.

    **Final verification — Step 3.4:** Run the full Phase 5 repo suite together to confirm nothing regressed:
    ```
    pnpm test:unit -- catalog-locations-normalize
    pnpm test:integration -- "catalog-(plants|photo-entries|pending-storage-deletions|location-suggestions)-repo"
    ```
    All green. Commit (or no-op if already committed).
  </action>

  <verify>
    <automated>pnpm test:unit -- catalog-locations-normalize &amp;&amp; pnpm test:integration -- "catalog-(pending-storage-deletions|location-suggestions)-repo"</automated>
  </verify>

  <done>
    - `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` exists with the 6 exports (`create`, `markInProgress`, `markCompleted`, `recordError`, `markFailed`, `fetchPendingBatch`).
    - `fetchPendingBatch`'s first parameter type is exactly `DbClient` (no union), enforced by TypeScript and documented in the JSDoc. Third parameter `opts?: { staleInProgressMinutes?: number }` is optional.
    - `fetchPendingBatch` with no opts only returns `pending` rows (Inngest happy-path). With `{ staleInProgressMinutes: 30 }` also returns `in_progress` rows whose `started_at` is older than 30 minutes (reconciler stale-recovery path).
    - `markInProgress` sets `started_at = NOW()` in the same UPDATE as the status and attempts increment.
    - `recordError` returns the row to `status = 'pending'` when `attempts < 5`; transitions to `'failed'` only when `attempts >= 5`.
    - The CONCURRENT-fetch test passes — two simultaneous fetchPendingBatch invocations on different connections return disjoint row ID sets.
    - The "authenticated role with no JWT sub binding" test passes — fetchPendingBatch returns 0 rows under that posture, codifying the service-role discipline.
    - `src/contexts/catalog/infrastructure/db/location-suggestions.ts` exists with `upsert` and `listForUser` exports. Upsert ON CONFLICT increments usage_count and touches last_used_at; first-writer-wins on label_display.
    - `src/contexts/catalog/domain/locations.ts` exports `normalizeLocationLabel`.
    - Cross-user RLS proofs pass for both new tables (T-05-03-02 + T-05-03-03 mitigated).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary                                                    | Description                                                                                                                                                                                                          |
|-------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Client → API → use-case → repo                              | Untrusted `cursor` (opaque base64), `userId`, `plantId`, `label` all enter the repo via use-case parameters. The repo trusts that the use-case has already authenticated the user (`requireVerifiedUser`) and resolved `userId` from the JWT — but it MUST NOT trust that the use-case scoped its WHERE clauses correctly. Repo-level WHERE user_id = $1 + RLS owner-only is the defense in depth. |
| Inngest worker → reconciler cron → service-role db          | The cron runs without a request context. There is no JWT. `fetchPendingBatch` operates across all users' pending rows. Service-role discipline (BYPASSRLS via the `postgres` connection role) is the only layer between this code path and accidental cross-user data exposure if the prefix were ever attacker-controlled — which it is not (the prefix is derived from the row itself). |
| Use-case → withUnitOfWork → authenticated role + GUC binding | Mutations run inside `withUnitOfWork(userId, async (tx) => ...)` which switches role and binds `request.jwt.claim.sub`. Repo functions accept either `DbClient` or `TransactionalDb` so they work in both postures. The exception is `fetchPendingBatch`, which is `DbClient`-only by type. |

## STRIDE Threat Register

| Threat ID    | Category | Component                                                                                              | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                                                                          |
|--------------|----------|--------------------------------------------------------------------------------------------------------|-------------|------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-05-03-01   | E        | `plants.list({sort, cursor, limit})` — cursor manipulation as ACL bypass                                | mitigate    | Cursor is opaque pagination state, NOT an authorization token. The repo always includes `WHERE plants.userId = params.userId` regardless of cursor contents. RLS owner-only on `plants` (Phase 2) is also active when called from inside `withUnitOfWork`. The cursor decoder in `src/shared/api/cursor.ts` (Plan 05-02) Zod-validates `sort_id` enum + `last_id` UUID — even a tampered cursor cannot inject WHERE-clause SQL. The integration test `cross-user cursor manipulation does NOT leak rows` codifies the rule under `SET LOCAL ROLE authenticated` bound to a different user's JWT sub. |
| T-05-03-02   | E, I     | `pending-storage-deletions.fetchPendingBatch` — reconciler cross-user prefix leak via service-role overscope | mitigate    | `fetchPendingBatch` accepts `DbClient` only (TypeScript enforces — `TransactionalDb` is rejected at compile time). The function ALWAYS derives `user_id`, `bucket`, `prefix` from each row — never from a request body, query string, or environment variable. `pendingStorageDeletions.userId` has FK `ON DELETE CASCADE` to `users.id`, so an orphan prefix scoped to a deleted user cannot exist. Integration test "fetchPendingBatch under SET LOCAL ROLE authenticated returns ZERO rows even when pending rows exist" codifies the discipline that misuse (running the reconciler inside `withUnitOfWork`) is detectable. JSDoc on the function explicitly forbids `withUnitOfWork` wrapping, with a code-review sentinel pattern. |
| T-05-03-03   | I        | `location-suggestions` cross-user enumeration disclosing user habits                                    | mitigate    | RLS owner-only on `location_suggestions` (shipped by Plan 05-02 migration). `listForUser` always uses `WHERE user_id = $1` at the repo layer (defense in depth — a future RLS-disabled migration would still be safe). Integration test `RLS owner-only on location_suggestions — userB authenticated cannot SELECT userA's rows` proves cross-user denial under a real Supabase-issued JWT bound via `request.jwt.claim.sub`.                                                                                                  |
| T-05-03-04   | T        | `bumpCoverFor` cross-plant cover hijack                                                                 | mitigate    | The plants UPDATE inside `bumpCoverFor` includes `WHERE id = $plantId AND user_id = $userId`. Even if a malicious caller passed a `plantId` belonging to another user (already prevented by the use-case's prior `findByIdForUser` ownership check), the UPDATE would match 0 rows. The function takes only `TransactionalDb` (not the union) so it is always inside a UoW — RLS is also active. Integration test "filters the plants UPDATE by user_id (defense in depth)" proves the WHERE clause includes user_id.            |
| T-05-03-05   | I        | `getCascadeCounts` reading reminders for a plant the caller does not own                                | mitigate    | The function asserts `findByIdForUser(db, userId, plantId)` returns non-null BEFORE running the count queries; otherwise returns `{0, 0}`. The reminders count uses `WHERE plant_id = $plantId` only (reminders has no user_id column), but ownership is established via the prior plant lookup. Integration test "counts only the entries belonging to the target plant (no leak across plants of the same user)" exercises the within-user case; cross-user guard tested via `findByIdForUser` returning null. |

`block_on_high: true` per ASVS L1 — every threat above has `mitigate` disposition and a corresponding behavioral integration test. No `accept`/`transfer`. The plan does not finalize until all RED tests covering these threats turn GREEN.
</threat_model>

<verification>
After all three tasks complete, run the full Phase 5 repo suite from a clean shell:

```bash
pnpm test:unit -- catalog-locations-normalize
pnpm test:integration -- "catalog-(plants|photo-entries|pending-storage-deletions|location-suggestions)-repo"
```

All test files from this plan must be green. Additionally:

```bash
# Repo file existence + key exports present
test -f src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
test -f src/contexts/catalog/infrastructure/db/location-suggestions.ts
test -f src/contexts/catalog/domain/locations.ts

# Service-role discipline guard: fetchPendingBatch's signature uses DbClient as first param, NOT the union
grep -v '^#' src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts \
  | grep -E "function fetchPendingBatch\(\s*db: DbClient" | grep -c "DbClient" \
  # Expect: 1
# Stale-recovery opts signature present
grep -v '^#' src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts \
  | grep -c "staleInProgressMinutes" \
  # Expect: >= 1
# markInProgress sets startedAt
grep -v '^#' src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts \
  | grep -A 6 "markInProgress" | grep -c "startedAt" \
  # Expect: >= 1

# T-05-03-04 sentinel: bumpCoverFor's plants UPDATE WHERE includes user_id
grep -v '^#' src/contexts/catalog/infrastructure/db/photo-entries.ts \
  | grep -A 4 "bumpCoverFor" | grep -c "userId" \
  # Expect: >= 1 (the WHERE clause references the userId param)
```

Cross-cutting: `pnpm exec tsc --noEmit` passes (no new TypeScript errors introduced).
</verification>

<success_criteria>
- All three tasks committed individually with the messages indicated in their `<action>` blocks.
- The four test files in `tests/integration/catalog-*-repo.integration.test.ts` exist and are green under `pnpm test:integration`.
- `tests/unit/catalog-locations-normalize.test.ts` exists and is green under `pnpm test:unit`.
- `pnpm exec tsc --noEmit` passes.
- Frontmatter requirements `[CAT-05, CAT-07, CAT-08, CAT-09]` correspond to behaviors implemented and proven in green tests:
  - CAT-05: `location-suggestions` repo + `normalizeLocationLabel` ship the suggestion corpus the combobox in 05-12 will consume.
  - CAT-07: `plants.list` produces `acquisition_date DESC NULLS LAST` ordering for sort_id `date_new` (the default).
  - CAT-08: `plants.list` accepts all 5 sort_id values from D-11.
  - CAT-09: `pending_storage_deletions` repo state machine + `getCascadeCounts` for the D-07 confirm sheet ship the row-side primitives the 05-06 delete-plant use-case needs.
- Every threat in the STRIDE register has a green integration test referenced in its mitigation column.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-catalog-meu-jardim-03-SUMMARY.md` per the project's summary template (`@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md`). The SUMMARY must record:

- Final exports of each repo file (so 05-05 / 05-06 / 05-07 plan executors can grep for the contracts).
- Whether the Drizzle `for("update", { skipLocked: true })` call site is the literal API used or a chained alternative (forward-compatibility note for any future Drizzle bump).
- The final convention chosen for the delete function name (`deletePlant` per the action — confirm or note any deviation).
- Total test count added (unit + integration) and approximate runtime under `pnpm test:integration` (so VALIDATION.md sampling-rate budgets stay honest).
</output>
