---
phase: 05-catalog-meu-jardim
plan: 19
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/contexts/catalog/infrastructure/db/schema.ts
  - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
  - src/contexts/catalog/application/delete-photo-entry.ts
  - src/contexts/catalog/inngest/functions.ts
  - tests/integration/cleanup-storage-reconciler.integration.test.ts
  - tests/integration/catalog-delete-photo-entry.integration.test.ts
autonomous: true
gap_closure: true
requirements:
  - CAT-06
  - CAT-09
tags:
  - catalog
  - storage-cleanup
  - inngest
  - lgpd
  - schema-migration
  - gap-closure
must_haves:
  truths:
    - "After deletePhotoEntry runs, the cleanupStorageReconciler hourly cron picks up the resulting `pending_storage_deletions` row and removes the actual storage object — no orphaned bytes remain in `plant-photos` or `plant-thumbnails` (CR-01 fix; SC-4 photo-journal CRUD; SC-5 LGPD storage-deletion guarantee)."
    - "`pending_storage_deletions` table carries a non-nullable `kind` column (pgEnum `pending_deletion_kind`) with values `prefix` (legacy plant-wide cleanup) or `object` (single photo-entry file); existing rows default to `prefix` so plant-deletion behavior is unchanged."
    - "deletePhotoEntry writes rows with `kind='object'`; deletePlant continues to write rows with `kind='prefix'` (default)."
    - "cleanupStorageReconcilerHandler branches on `row.kind`: `object` rows are validated with `validateStorageObjectKey` and deleted with `getStorageAdapter().deleteObject({ bucket, objectKey })`; `prefix` rows keep the existing `validateStorageDeletionPrefix` + `deletePrefix` path."
    - "An integration test in `tests/integration/cleanup-storage-reconciler.integration.test.ts` seeds a row with `kind='object'` and a canonical `{userId}/{plantId}/{photoId}.jpg` key, runs the reconciler handler with a fake adapter, and asserts (a) `deleteObject` was called exactly once with the matching bucket+objectKey, (b) `deletePrefix` was NOT called, (c) the row transitions to `status='completed'`."
    - "An integration test in `tests/integration/catalog-delete-photo-entry.integration.test.ts` (or sibling) asserts deletePhotoEntry inserts both `pending_storage_deletions` rows with `kind='object'` and the full `{userId}/{plantId}/{photoId}.{ext}` key (no trailing slash)."
  artifacts:
    - path: "src/contexts/catalog/infrastructure/db/schema.ts"
      provides: "New `pendingDeletionKind` pgEnum and `kind` column on `pendingStorageDeletions` (NOT NULL DEFAULT 'prefix'). Schema source for the discriminator."
      contains: "pending_deletion_kind"
    - path: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts"
      provides: "Repo `create(...)` accepts the new `kind` field via `PendingStorageDeletionInsert` (Drizzle infers from schema). `fetchPendingBatch` row shape now includes `kind`. No new exported function — the discriminator surfaces through the existing typed insert/select."
      exports: ["create", "findById", "markInProgress", "markCompleted", "recordError", "markFailed", "fetchPendingBatch"]
    - path: "src/contexts/catalog/application/delete-photo-entry.ts"
      provides: "Updated `pendingStorageDeletionsRepo.create` calls write `kind: 'object'` for both photo + thumbnail rows (existing object-key shape preserved)."
      contains: "kind: \"object\""
    - path: "src/contexts/catalog/inngest/functions.ts"
      provides: "cleanupStorageReconcilerHandler branches on `row.kind`: object → validateStorageObjectKey + deleteObject; prefix → existing path. Imports `validateStorageObjectKey` from storage-paths."
      contains: "row.kind"
    - path: "tests/integration/cleanup-storage-reconciler.integration.test.ts"
      provides: "New cycle (e.g. 3E) seeding a `kind='object'` row + asserting end-to-end byte deletion via fake adapter. Existing 3A–3D cycles remain green (default `kind='prefix'` keeps legacy behavior)."
      contains: "kind = 'object'"
    - path: "tests/integration/catalog-delete-photo-entry.integration.test.ts"
      provides: "Updated assertion that the two `pending_storage_deletions` rows written by deletePhotoEntry carry `kind='object'` and full object keys."
      contains: "kind"
  key_links:
    - from: "src/contexts/catalog/application/delete-photo-entry.ts"
      to: "src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts"
      via: "pendingStorageDeletionsRepo.create(tx, { userId, bucket, prefix: photoKey, kind: 'object' })"
      pattern: "kind: \"object\""
    - from: "src/contexts/catalog/inngest/functions.ts"
      to: "src/contexts/catalog/domain/storage-paths.ts"
      via: "validateStorageObjectKey({ userId, plantId, key }) when row.kind === 'object'"
      pattern: "validateStorageObjectKey"
    - from: "src/contexts/catalog/inngest/functions.ts"
      to: "src/contexts/catalog/infrastructure/photo-storage.ts"
      via: "getStorageAdapter().deleteObject({ bucket, objectKey }) when row.kind === 'object'"
      pattern: "deleteObject"
---

<objective>
Close gap **CR-01** — photo-entry deletion currently strands storage bytes because `deletePhotoEntry` writes a full object key (`{userId}/{plantId}/{photoId}.{ext}`) into `pending_storage_deletions.prefix`, and the reconciler cron only knows how to validate trailing-slash plant prefixes and call `deletePrefix`. The validator throws on every photo-entry row, the row goes to `failed` after 5 retries, and the underlying file is never removed. This breaks SC-4 (photo journal CRUD) and creates an LGPD storage-deletion gap that compounds in Phase 11.

**Solution (REVIEW CR-01 path 1):** add a `kind` discriminator (pgEnum) to `pending_storage_deletions`, branch the reconciler on `kind`, and make `deletePhotoEntry` write `kind='object'` rows that the reconciler routes to `validateStorageObjectKey` + `deleteObject`. Existing plant-deletion rows keep the default `kind='prefix'` and the legacy `deletePrefix` path, so no regression.

**TDD framing:** the integration test exists (`tests/integration/cleanup-storage-reconciler.integration.test.ts`) but only covers the prefix path. The bug surfaces only when an object-key row is exercised end-to-end. RED phase = extend the integration test to seed a `kind='object'` row and assert `deleteObject` is called and the row completes. The test fails before any production change because (a) the column does not exist yet and (b) the reconciler does not branch on kind. GREEN phase = schema column + repo type flow + reconciler branch + use-case write. Schema-push between RED and GREEN is BLOCKING — without it the integration test cannot even insert the row.

**Purpose:** restore SC-4 photo-journal CRUD and SC-5 LGPD storage-deletion guarantee for individual photo entries.

**Output:** schema migration + reconciler branch + use-case write + 2 integration tests green under `pnpm test:integration`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-VERIFICATION.md
@.planning/phases/05-catalog-meu-jardim/05-REVIEW.md

# The bug surface
@src/contexts/catalog/application/delete-photo-entry.ts
@src/contexts/catalog/inngest/functions.ts
@src/contexts/catalog/infrastructure/db/schema.ts
@src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts
@src/contexts/catalog/domain/storage-paths.ts

# Existing tests we extend
@tests/integration/cleanup-storage-reconciler.integration.test.ts
@tests/integration/catalog-delete-photo-entry.integration.test.ts

<interfaces>
### `validateStorageObjectKey` (already exists in `src/contexts/catalog/domain/storage-paths.ts:27`)

```ts
export function validateStorageObjectKey({
  userId,
  plantId,
  key,
}: { userId: string; plantId: string; key: string }): void;
// Throws StoragePathValidationError on mismatch.
// Pattern: ^{userId}/{plantId}/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$
```

### `getStorageAdapter().deleteObject` (already exists in `src/shared/adapters/storage.ts`)

```ts
adapter.deleteObject({ bucket: string, objectKey: string }): Promise<void>
```

The storage adapter contract is already complete — both `deletePrefix` and `deleteObject` ship in Phase 2. CR-01 is purely a wiring fix at the use-case + reconciler layer.

### `extractPlantIdFromKey` helper (already exists in `delete-photo-entry.ts:51`)

```ts
function extractPlantIdFromKey(key: string, userId: string): string | null;
// Returns the plantId segment for a `{userId}/{plantId}/{photoId}.ext` key.
```

The reconciler will need an equivalent — extract from the row.prefix when row.kind === 'object'. Inline the same shape (do NOT import from delete-photo-entry.ts; that function is module-private). Lift to `storage-paths.ts` as a sibling helper if it makes the diff cleaner.

### Existing pgEnum convention

```ts
// schema.ts:90-95 — convention to follow
export const pendingDeletionStatus = pgEnum("pending_deletion_status", [
  "pending", "in_progress", "completed", "failed",
]);
```

Add the new enum the same way: `pendingDeletionKind = pgEnum("pending_deletion_kind", ["prefix","object"])`.
</interfaces>

<schema_migration_strategy>
- Add the pgEnum FIRST in `schema.ts`. Drizzle infers the column type from the schema; no manual SQL.
- Column definition: `kind: pendingDeletionKind("kind").notNull().default("prefix")`.
- The `[BLOCKING]` task runs `pnpm exec node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs push` (Drizzle 0.31.10 push command — `package.json` does not expose a `db:push` script; use the inline form). Drizzle-kit push is interactive on first run for ENUM creation; if it prompts, abort and flag the plan `autonomous: false`. In practice the prompt only appears when a column rename is detected; pure additions are non-interactive.
- After push, existing rows have `kind='prefix'` from the default. No data migration needed.

This is BLOCKING because:
- Without push, the column does not exist in the local Supabase DB.
- The integration test in RED phase tries to insert `kind='object'` and gets a `column "kind" does not exist` error before any business-logic assertion runs.
- Build + typecheck pass without push (Drizzle types come from `schema.ts`, not the live DB) — false-positive verification.
</schema_migration_strategy>

<threat_model>

## Trust Boundaries

| Boundary                                | Description                                                                                                                  |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| reconciler cron → object storage        | The hourly cron runs as the BYPASSRLS service role with no per-user JWT; it must not delete bytes outside the row's owner.   |
| use-case → pending_storage_deletions    | A malformed insert (wrong kind/prefix combination) could trick the reconciler into running the wrong code path on the bytes. |
| Drizzle-kit push → live DB              | A migration with the wrong default could mass-flip existing rows, repointing legacy plant-deletion rows to the object path.  |

## STRIDE Threat Register

| Threat ID    | Category | Component                                              | Disposition | Mitigation Plan                                                                                                                                                                                                       |
| ------------ | -------- | ------------------------------------------------------ | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-19-01   | Tampering | reconciler `kind='object'` branch                     | mitigate    | Reconciler MUST call `validateStorageObjectKey({ userId: row.userId, plantId: extracted, key: row.prefix })` BEFORE `deleteObject`. The validator's regex anchors the userId+plantId path segments — cross-user/cross-plant deletes throw `StoragePathValidationError`. (Mirrors T-05-04-01.) |
| T-05-19-02   | DoS / data loss | column default value                            | mitigate    | New `kind` column is `NOT NULL DEFAULT 'prefix'` so existing rows from `delete-plant.ts` retain their behavior. Integration test 3A (existing) continues to pass — proves no regression in plant-deletion path.                                                                |
| T-05-19-03   | Repudiation | partial migration in production                      | accept      | Phase 5 ships only to local + preview-branch DBs in Wave 1. Production migration is a Phase 11 LGPD launch-blocker concern; CR-01 is fixed before any prod tenant exists.                                            |
| T-05-19-04   | Information disclosure | row kind validates wrong family of keys     | mitigate    | Two distinct validators: `validateStorageObjectKey` (object regex) and `validateStorageDeletionPrefix` (`{userId}/{plantId}/` exact). The reconciler chooses based on `row.kind`, so a `kind='object'` row never hits the prefix validator and vice-versa. |

</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — extend integration tests to seed a kind='object' row and assert end-to-end byte deletion</name>
  <files>
    - tests/integration/cleanup-storage-reconciler.integration.test.ts (MODIFY — add new cycle)
    - tests/integration/catalog-delete-photo-entry.integration.test.ts (MODIFY — assert kind='object' on inserted rows)
  </files>
  <read_first>
    - tests/integration/cleanup-storage-reconciler.integration.test.ts (lines 1–403 already loaded; understand `insertPsdRow` helper at line 131 + cycle-3 structure)
    - tests/integration/catalog-delete-photo-entry.integration.test.ts (read lines around the existing assertions on `pending_storage_deletions`)
    - src/contexts/catalog/inngest/functions.ts (lines 108–174; extractPlantIdFromPrefix + reconciler handler)
    - src/contexts/catalog/application/delete-photo-entry.ts (lines 145–154 — current insert call sites)
  </read_first>
  <behavior>
    Two new failing tests:

    **Test A (cleanup-storage-reconciler.integration.test.ts — new cycle 3E):** "kind='object' row is deleted via deleteObject and transitions to completed."
    - Seed a row directly via SQL: `INSERT INTO pending_storage_deletions (user_id, bucket, prefix, kind) VALUES (${userId}, 'plant-photos', '${userId}/${plantId}/photo-id.jpg', 'object')` — relies on the schema migration shipped in Task 2.
    - Run `cleanupStorageReconcilerHandler({ step: makeFakeStep() })` with the fake adapter from `makeFakeAdapter()`.
    - Assert: `fake.asAdapter.deleteObject` was called exactly once with `{ bucket: 'plant-photos', objectKey: '${userId}/${plantId}/photo-id.jpg' }`.
    - Assert: `fake.deletePrefix` was NOT called.
    - Assert: row.status === 'completed' after the run.

    **Test B (catalog-delete-photo-entry.integration.test.ts — extend existing assertion):** at the existing line(s) where the test asserts `pending_storage_deletions` row presence after `deletePhotoEntry`, also assert `r.kind === 'object'` for both rows (photo + thumbnail).

    The fake adapter at cleanup-storage-reconciler.integration.test.ts:46 already includes a `deleteObject: vi.fn().mockResolvedValue(undefined)` — no fixture changes needed.
  </behavior>
  <action>
    1. Open `tests/integration/cleanup-storage-reconciler.integration.test.ts`. Add a new cycle after Cycle 3D (registry wiring) — call it "Cycle 3E — kind discriminator (CR-01)". Inside, add `it("3E-1: reconciler with kind='object' row calls deleteObject and completes the row", ...)`.

    Implementation skeleton:
    ```ts
    it("3E-1: reconciler with kind='object' row calls deleteObject + transitions to completed (CR-01)", async () => {
      const fake = makeFakeAdapter();
      setStorageAdapterForTests(fake.asAdapter);

      const ago = new Date(Date.now() - 10000);
      const photoId = randomUUID();
      const objectKey = `${userId}/${plantId}/${photoId}.jpg`;

      // Seed directly via SQL — schema migration adds the `kind` column with default 'prefix';
      // we override to 'object' for this cycle.
      const [row] = await driver`
        INSERT INTO pending_storage_deletions (user_id, bucket, prefix, kind, scheduled_at)
        VALUES (${userId}, 'plant-photos', ${objectKey}, 'object', ${ago.toISOString()})
        RETURNING id
      `;
      const rowId = row!.id as string;

      await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

      expect(fake.asAdapter.deleteObject).toHaveBeenCalledTimes(1);
      expect(fake.asAdapter.deleteObject).toHaveBeenCalledWith({
        bucket: "plant-photos",
        objectKey,
      });
      expect(fake.deletePrefix).not.toHaveBeenCalled();

      const updated = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
      expect(updated[0]!.status).toBe("completed");
    });
    ```

    2. Open `tests/integration/catalog-delete-photo-entry.integration.test.ts`. Find the existing test that asserts the inserted `pending_storage_deletions` rows after `deletePhotoEntry` (per VERIFICATION.md line 247-253 reference). Add `expect(r.kind).toBe('object')` to the row-shape assertion (one assert per row).

    3. Run `pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts`. The new tests MUST fail. Expected failure modes:
       - Test A: `column "kind" of relation "pending_storage_deletions" does not exist` (column missing) OR `expect(deleteObject).toHaveBeenCalledTimes(1) — Received: 0` (reconciler doesn't branch).
       - Test B: column missing OR `r.kind === 'object'` undefined.

    4. Commit RED: `test(05-19): add failing tests for kind='object' reconciler branch + delete-photo-entry insert shape (CR-01)`.
  </action>
  <acceptance_criteria>
    - `tests/integration/cleanup-storage-reconciler.integration.test.ts` contains the literal string `kind = 'object'` (case-insensitive in SQL — match `kind, scheduled_at` near the new INSERT).
    - `tests/integration/cleanup-storage-reconciler.integration.test.ts` contains `expect(fake.asAdapter.deleteObject).toHaveBeenCalledWith` at least once.
    - `tests/integration/catalog-delete-photo-entry.integration.test.ts` contains the literal string `r.kind` (or equivalent — `kind: 'object'`).
    - Running `pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts` exits NON-ZERO with at least one failing test.
    - Git log shows `test(05-19): ...` commit.
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts || echo "RED ok (expected failure)"</automated>
  </verify>
  <done>
    - Two new failing assertions exist (one in each test file).
    - The failure mode in CI logs proves the bug (column missing or branch missing).
    - RED commit created.
  </done>
</task>

<task type="auto">
  <name>Task 2: GREEN — add `kind` pgEnum + column to schema; update use-case to write `kind='object'`</name>
  <files>
    - src/contexts/catalog/infrastructure/db/schema.ts
    - src/contexts/catalog/application/delete-photo-entry.ts
  </files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/schema.ts (full file — line 90 pgEnum convention; line 97-122 pendingStorageDeletions table)
    - src/contexts/catalog/application/delete-photo-entry.ts (lines 145-154 — the two `pendingStorageDeletionsRepo.create` call sites that must add `kind: 'object'`)
  </read_first>
  <action>
    1. Open `src/contexts/catalog/infrastructure/db/schema.ts`. Immediately AFTER the existing `pendingDeletionStatus = pgEnum(...)` declaration (line 90-95), add:

    ```ts
    export const pendingDeletionKind = pgEnum("pending_deletion_kind", [
      "prefix",
      "object",
    ]);
    ```

    Add the column inside the `pendingStorageDeletions` pgTable definition. Place it immediately AFTER `status` (line 106) so the column order in the live DB matches the schema source:

    ```ts
    status: pendingDeletionStatus("status").notNull().default("pending"),
    kind: pendingDeletionKind("kind").notNull().default("prefix"),
    attempts: integer("attempts").notNull().default(0),
    ```

    Add a doc comment above `kind`:

    ```ts
    /**
     * Discriminator for the storage operation the reconciler must perform.
     * - 'prefix' (legacy / default): full plant cleanup via deletePrefix on
     *   `${userId}/${plantId}/`. Used by deletePlant.
     * - 'object': single photo-entry cleanup via deleteObject on the full
     *   canonical key `${userId}/${plantId}/${photoId}.${ext}`. Used by
     *   deletePhotoEntry. (CR-01)
     */
    ```

    2. Open `src/contexts/catalog/application/delete-photo-entry.ts`. At the two `pendingStorageDeletionsRepo.create(tx, { ... })` call sites (lines 145 and 150), add `kind: "object"`:

    ```ts
    await pendingStorageDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_PHOTOS_BUCKET,
      prefix: photoKey,
      kind: "object",
    });
    await pendingStorageDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_THUMBNAILS_BUCKET,
      prefix: thumbKey,
      kind: "object",
    });
    ```

    3. Run `pnpm typecheck`. Drizzle-kit infers `PendingStorageDeletionInsert` from the schema, so the type now requires `kind` to be `"prefix" | "object" | undefined` (undefined = use default). Compile must be clean.

    4. Do NOT run integration tests yet — schema-push (Task 3) must run first.
  </action>
  <acceptance_criteria>
    - `grep -c "pendingDeletionKind" src/contexts/catalog/infrastructure/db/schema.ts` returns `>=2` (one declaration, one usage on the column).
    - `grep -c "kind: \"object\"" src/contexts/catalog/application/delete-photo-entry.ts` returns `>=2` (both photo + thumbnail).
    - `pnpm typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/contexts/catalog/infrastructure/db/schema.ts | grep -c "pendingDeletionKind" | grep -E "^[2-9]|^[1-9][0-9]+$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/contexts/catalog/application/delete-photo-entry.ts | grep -c 'kind: "object"' | grep -E "^[2-9]"</gate>
  </verify>
  <done>
    - pgEnum declared, column added with NOT NULL DEFAULT 'prefix'.
    - delete-photo-entry writes `kind: 'object'` at both call sites.
    - Typecheck clean.
  </done>
</task>

<task type="auto">
  <name>Task 3: [BLOCKING] Schema push — apply pending_deletion_kind enum + kind column to local Supabase</name>
  <files>
    - (no source files modified; live DB schema only)
  </files>
  <read_first>
    - package.json (lines 25-27 confirm drizzle-kit 0.31.10 path is `node_modules/drizzle-kit/bin.cjs`)
  </read_first>
  <action>
    Run `drizzle-kit push` to synchronize the new pgEnum + column to the local Supabase DB. This is BLOCKING — Task 4 cannot execute the integration tests until the column exists in the live DB. Build + typecheck would falsely green without this step because Drizzle types come from `schema.ts`, not the database.

    Command:
    ```
    pnpm exec node --env-file-if-exists=.env.local node_modules/drizzle-kit/bin.cjs push
    ```

    Drizzle-kit push behavior for additions:
    - Pure additions (new pgEnum + new column with DEFAULT) are non-interactive — push prints the diff and applies.
    - If the CLI surfaces a prompt (e.g. detected rename), abort and re-flag this plan `autonomous: false`. In practice for a brand-new enum + brand-new column with a literal default, no prompt appears.

    After push, verify against the live DB:
    ```
    pnpm exec node --env-file-if-exists=.env.local -e 'import("postgres").then(async ({default: postgres}) => { const db = postgres(process.env.DATABASE_POOL_URL, { prepare: false }); const r = await db`SELECT column_name, is_nullable, column_default FROM information_schema.columns WHERE table_name = '\''pending_storage_deletions'\'' AND column_name = '\''kind'\''`; console.log(r); await db.end({ timeout: 5 }); })'
    ```

    Expected output: a single row with `column_name='kind'`, `is_nullable='NO'`, `column_default='\\'prefix\\'::pending_deletion_kind'`.
  </action>
  <acceptance_criteria>
    - The live Supabase DB has a `kind` column on `pending_storage_deletions` (verified by `information_schema.columns` query above).
    - The pgEnum `pending_deletion_kind` exists (verified by `SELECT typname FROM pg_type WHERE typname = 'pending_deletion_kind'`).
    - Existing rows in `pending_storage_deletions` (if any) have `kind='prefix'`.
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec node --env-file-if-exists=.env.local -e 'import("postgres").then(async ({default: postgres}) => { const db = postgres(process.env.DATABASE_POOL_URL, { prepare: false }); const r = await db`SELECT column_name FROM information_schema.columns WHERE table_name = '"'"'pending_storage_deletions'"'"' AND column_name = '"'"'kind'"'"'`; if (r.length !== 1) { console.error("kind column missing"); process.exit(1); } console.log("ok"); await db.end({ timeout: 5 }); })'</automated>
  </verify>
  <done>
    - drizzle-kit push completed without errors.
    - `kind` column verified in live DB.
    - pgEnum `pending_deletion_kind` exists.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: GREEN — branch reconciler on row.kind; run integration tests until green</name>
  <files>
    - src/contexts/catalog/inngest/functions.ts
  </files>
  <read_first>
    - src/contexts/catalog/inngest/functions.ts (lines 108–174 — full reconciler handler; the `extractPlantIdFromPrefix` helper at line 108 will need a sibling for object keys)
    - src/contexts/catalog/domain/storage-paths.ts (lines 27–48 — `validateStorageObjectKey` signature)
    - src/contexts/catalog/application/delete-photo-entry.ts (lines 51–58 — `extractPlantIdFromKey` reference implementation)
  </read_first>
  <behavior>
    The reconciler handler MUST branch on `row.kind`:
    - `prefix` (default / legacy): existing path — `extractPlantIdFromPrefix(row.prefix)`, `validateStorageDeletionPrefix({ userId, plantId, prefix })`, `getStorageAdapter().deletePrefix({ bucket, prefix })`.
    - `object` (new): extract plantId from the canonical object-key shape `${userId}/${plantId}/${photoId}.${ext}`, `validateStorageObjectKey({ userId: row.userId, plantId, key: row.prefix })`, `getStorageAdapter().deleteObject({ bucket: row.bucket, objectKey: row.prefix })`.

    Both branches share the same downstream wiring: `markCompleted` on success, `recordError` on throw (already in place around line 162-165). No change to the cleanupStorage event handler (line 38-83) — that path only runs for plant.deleted events with prefix rows.

    Add a private helper to `src/contexts/catalog/inngest/functions.ts`:

    ```ts
    function extractPlantIdFromObjectKey(key: string, userId: string): string {
      const prefix = `${userId}/`;
      if (!key.startsWith(prefix)) {
        throw new Error(`malformed object key (no userId prefix): ${key}`);
      }
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash <= 0) {
        throw new Error(`malformed object key (no plantId segment): ${key}`);
      }
      return rest.slice(0, slash);
    }
    ```

    Use it in the new `kind === 'object'` branch.
  </behavior>
  <action>
    1. Open `src/contexts/catalog/inngest/functions.ts`. Add the import:
    ```ts
    import {
      validateStorageDeletionPrefix,
      validateStorageObjectKey,
    } from "@contexts/catalog/domain/storage-paths";
    ```

    2. Add the helper near the top (after `extractPlantIdFromPrefix`):
    ```ts
    function extractPlantIdFromObjectKey(key: string, userId: string): string {
      const prefix = `${userId}/`;
      if (!key.startsWith(prefix)) {
        throw new Error(`malformed object key (no userId prefix): ${key}`);
      }
      const rest = key.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash <= 0) {
        throw new Error(`malformed object key (no plantId segment): ${key}`);
      }
      return rest.slice(0, slash);
    }
    ```

    3. Replace the `try` block inside the row-loop (lines 151-162) with the kind-branched version:
    ```ts
    try {
      if (row.kind === "object") {
        const plantId = extractPlantIdFromObjectKey(row.prefix, row.userId);
        validateStorageObjectKey({
          userId: row.userId,
          plantId,
          key: row.prefix,
        });
        await getStorageAdapter().deleteObject({
          bucket: row.bucket,
          objectKey: row.prefix,
        });
      } else {
        // kind === 'prefix' (default / legacy)
        const plantId = extractPlantIdFromPrefix(row.prefix);
        validateStorageDeletionPrefix({
          userId: row.userId,
          plantId,
          prefix: row.prefix,
        });
        await getStorageAdapter().deletePrefix({
          bucket: row.bucket,
          prefix: row.prefix,
        });
      }
      await pendingDeletionsRepo.markCompleted(db, row.id);
    } catch (err) {
      await pendingDeletionsRepo.recordError(db, row.id, String(err));
    }
    ```

    Do NOT modify the `cleanupStorageHandler` (event handler) — that path only fires on `plant.deleted` and writes `kind='prefix'` rows.

    4. Run `pnpm typecheck` → must be clean.

    5. Run the previously-failing tests:
    ```
    pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts
    ```
    All cycles (3A, 3B, 3C, 3D, 3E) must pass.

    6. Run the full integration suite to ensure no regression:
    ```
    pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/cleanup-storage.integration.test.ts tests/integration/delete-plant.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts
    ```

    7. Commit GREEN: `feat(05-19): branch cleanup reconciler on kind discriminator + delete-photo-entry writes kind='object' (CR-01)`.
  </action>
  <acceptance_criteria>
    - `grep -c "row.kind" src/contexts/catalog/inngest/functions.ts` returns `>=1`.
    - `grep -c "validateStorageObjectKey" src/contexts/catalog/inngest/functions.ts` returns `>=1`.
    - `grep -c "deleteObject" src/contexts/catalog/inngest/functions.ts` returns `>=1`.
    - `pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts` exits 0.
    - `pnpm exec vitest --run --project=integration tests/integration/cleanup-storage.integration.test.ts tests/integration/delete-plant.integration.test.ts` exits 0 (no regression on the prefix path).
    - Git log shows `feat(05-19): ...` commit.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck && pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts tests/integration/cleanup-storage.integration.test.ts tests/integration/delete-plant.integration.test.ts</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/contexts/catalog/inngest/functions.ts | grep -c "row.kind" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/contexts/catalog/inngest/functions.ts | grep -c "validateStorageObjectKey" | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - Reconciler branches on `row.kind`.
    - All target integration tests pass.
    - Prefix-path regression suite (cleanup-storage, delete-plant) still green.
    - GREEN commit created.
  </done>
</task>

</tasks>

<verification>
  <automated>
    pnpm typecheck && \
    pnpm exec vitest --run --project=integration tests/integration/cleanup-storage-reconciler.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts tests/integration/cleanup-storage.integration.test.ts tests/integration/delete-plant.integration.test.ts
  </automated>
</verification>

<success_criteria>
- `pending_storage_deletions` schema carries `kind` enum column with default `'prefix'`.
- Live DB synchronized via `drizzle-kit push`.
- `delete-photo-entry.ts` writes `kind: 'object'` at both pending-deletion call sites.
- Reconciler handler branches on `row.kind`; object rows route to `deleteObject` after `validateStorageObjectKey`; prefix rows preserve legacy path.
- New integration cycle (3E-1) proves end-to-end `deleteObject` is called and the row completes.
- Existing 3A–3D cycles + cleanup-storage event-handler suite + delete-plant suite remain green (no regression).
- Two commits in git log: `test(05-19): ...` and `feat(05-19): ...`.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-19-photo-entry-storage-cleanup-fix-SUMMARY.md` covering RED, GREEN, schema-push outcome, integration-test results, and CR-01 closure status.
</output>
