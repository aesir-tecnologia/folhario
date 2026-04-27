---
phase: 05-catalog-meu-jardim
plan: 07
type: execute
wave: 2
depends_on:
  - 05-01
  - 05-02
  - 05-03
  - 05-04
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-05 (UoW), 02-08 (StorageAdapter — addPhotoEntry uses listStoragePathsForPlant only; deletePhotoEntry returns deleted paths but does NOT call storage delete; that work belongs to a follow-up consumer if needed). The route handler in Plan 05-09 may dispatch a per-photo cleanup event, but the use case itself only emits the deleted-paths array.
files_modified:
  - src/contexts/catalog/application/update-plant.ts
  - src/contexts/catalog/application/add-photo-entry.ts
  - src/contexts/catalog/application/update-photo-entry-note.ts
  - src/contexts/catalog/application/delete-photo-entry.ts
  - src/contexts/catalog/application/set-cover-photo.ts
  - src/contexts/catalog/application/list-plants.ts
  - src/contexts/catalog/application/list-photo-entries.ts
  - tests/unit/contexts/catalog/update-plant.test.ts
  - tests/unit/contexts/catalog/add-photo-entry.test.ts
  - tests/unit/contexts/catalog/update-photo-entry-note.test.ts
  - tests/unit/contexts/catalog/delete-photo-entry.test.ts
  - tests/unit/contexts/catalog/set-cover-photo.test.ts
  - tests/unit/contexts/catalog/list-plants.test.ts
  - tests/unit/contexts/catalog/list-photo-entries.test.ts
  - tests/integration/catalog/update-plant.integration.test.ts
  - tests/integration/catalog/add-photo-entry.integration.test.ts
  - tests/integration/catalog/list-plants-cursor.integration.test.ts
  - tests/integration/catalog/id-history-visibility.integration.test.ts
autonomous: true
requirements:
  - CAT-04
  - CAT-06
decisions:
  add_photo_entry_storage_path_check: "addPhotoEntry calls validateStoragePathOwnership BEFORE the INSERT (T-5-01 mitigation, mirrors createPlantManual). Uses canonical `{userId}/{plantId}/{file}` path format (Codex Decision 6)."
  set_cover_photo_validation: |
    **Codex review HIGH 05-07** — `setCoverPhoto` MUST NOT contain raw SQL or
    direct Drizzle access in the use-case layer. Phase 2 D-17 ESLint guard
    forbids Drizzle in route handlers AND application-layer code (use cases
    are application layer; they call repos, not SQL).

    Implementation pattern:
    1. Use case calls `photoEntries.findById(db, { photoEntryId, plantId, userId })`
       (new repo helper shipped by Plan 05-03) to verify the requested PhotoEntry
       belongs to THIS plant + THIS user. Returns null if not found → throws
       `not_found` (cross-plant + cross-user defense).
    2. Use case extracts the matching `photoUrl` from the returned PhotoEntryRow.
    3. Use case calls `plants.setCoverPhoto(tx, { plantId, userId, coverPhotoUrl })`
       (single repo UPDATE; shipped by Plan 05-03) inside the transaction.

    The use case never writes SQL or accesses Drizzle directly. The set-cover-photo.ts
    file imports ONLY `* as plants from "@contexts/catalog/infrastructure/db/plants"`
    and `* as photoEntries from "@contexts/catalog/infrastructure/db/photo-entries"` —
    no `import { sql } from "drizzle-orm"` or similar.
  list_plants_cursor_consumption: "list-plants accepts a wire cursor string, decodes via decodeCursor (Plan 05-02), maps to ExtendedCursor, calls plants.findByCursor; returns { rows, nextCursor: encoded string | null }. The nextCursor field is internal camelCase; the route handler in 05-08 maps it to snake_case `next_cursor` in the JSON envelope (Codex Decision 1)."
  list_plants_argument_signature: |
    **Codex review HIGH cross-cutting Decision 3** — single canonical signature:
    ```ts
    listPlants(args: {
      userId: string;
      sortKey: SortKey;
      cursor: ExtendedCursor | null;
      limit: number;
      plantIdFilter?: string;
      includeIdentificationCount?: boolean;
    }): Promise<{ rows: PlantRow[]; nextCursor: ExtendedCursor | null }>
    ```

    All consumers (route handlers, RSC prefetch, hooks) MUST use this signature.
    The HTTP query parameter is `?sort=...` (a wire-level convention), but the
    use-case argument is `sortKey` (single canonical name). Route handlers map
    `req.searchParams.get('sort')` → `args.sortKey`. There is NO positional
    overload; there is NO `sort` argument; there is NO route-only-detail-fetch
    side path (the detail fetch passes `plantIdFilter` to the same listPlants
    function).
  id_history_visibility_query: "list-plants accepts an optional `includeIdentificationCount` flag. When set, the query joins identifications and returns each plant's identification_count. Plant Profile (5b) consumes this to hide the ID-history link when count=0 (CAT-04 / CONTEXT D-26)."
  list_photo_entries_sort: "Always reverse-chronological (CAT-06). Cursor format is the SIMPLE Phase 2 D-36 shape `base64({ id, createdAt })` since there's no sort variation. Reuses encodeCursor with sortKey='created_desc'."
  delete_photo_entry_storage_cleanup: |
    **Codex review HIGH 05-09 — per-PhotoEntry deletion MUST clean up storage** via
    a dedicated outbox + event. Earlier draft deferred per-photo cleanup; that
    decision is REVERSED per Codex review. Per-photo deletion now follows the
    same outbox pattern as plant deletion:

    1. `deletePhotoEntry({ id, plantId, userId, uow })` opens a transaction.
    2. Reads the PhotoEntry's photo + thumbnail paths.
    3. Inserts a `pending_storage_deletions` row with the paths AND the userId/plantId.
    4. DELETEs the PhotoEntry.
    5. Commits.
    6. Dispatches the **`photo_entry.deleted`** Inngest event (NOT `plant.deleted` —
       Codex review HIGH 05-09; events.ts ships the new event type per Plan 05-04).
    7. Calls `pendingDeletions.markDispatched(tx, jobId)` (Codex 05-06 mitigation).

    Plan 05-06's `catalog/cleanup-storage` Inngest function processes both
    `plant.deleted` and `photo_entry.deleted` via the shared
    `storage_deletion_job_id`. Plan 05-09's PATCH/DELETE route handler invokes
    THIS use case (not a per-handler outbox). The decision to move the
    storage-cleanup integration into 05-07's `deletePhotoEntry` (instead of
    overriding inside 05-09's route handler) follows Codex's recommendation to
    keep the cleanup decision adjacent to the data deletion.
must_haves:
  truths:
    - "updatePlant({ plantId, userId, patch, uow }) updates only the patched fields scoped to userId; throws not_found when no row matches; ignores any keys not in PlantPatchSchema (defense in depth — schema already strips them)"
    - "addPhotoEntry({ plantId, userId, input, uow }) validates storage path ownership using canonical `{userId}/{plantId}/{file}` form (Codex Decision 6), then inserts a PhotoEntry row in transaction; throws not_found when plant doesn't exist or doesn't belong to user"
    - "updatePhotoEntryNote({ id, plantId, userId, note, uow }) updates the note (or sets NULL); throws not_found when no row matches the (id, plantId, userId) triple"
    - "**Codex review HIGH 05-09 — deletePhotoEntry follows the storage-cleanup outbox pattern**: opens transaction → reads photo+thumbnail paths → inserts `pending_storage_deletions` row → DELETEs the PhotoEntry → commits → dispatches `photo_entry.deleted` Inngest event → calls markDispatched. NOT plant.deleted; NOT a fire-and-forget cleanup."
    - "**Codex review HIGH 05-07 — setCoverPhoto contains NO raw SQL or Drizzle access**: imports only `plants` and `photoEntries` repository modules; calls `photoEntries.findById(db, { photoEntryId, plantId, userId })` for ownership verification, then `plants.setCoverPhoto(tx, { plantId, userId, coverPhotoUrl })` for the UPDATE. Phase 2 D-17 (no Drizzle in app layer) is satisfied."
    - "setCoverPhoto({ plantId, userId, photoEntryId, uow }) — argument is `photoEntryId` (NOT `photoUrl`); use case looks up the PhotoEntry by id and uses its `photoUrl` as the new cover. The HTTP request body is `{ photo_entry_id }` not `{ photo_url }` (the client never sends an arbitrary URL — it sends the PhotoEntry id, server resolves to URL)."
    - "**Codex review HIGH cross-cutting Decision 3 — listPlants single canonical signature**: `listPlants({ userId, sortKey, cursor, limit, plantIdFilter?, includeIdentificationCount? })`. NO `sort` argument; NO positional overload; NO route-only-detail side path. Detail fetch goes through the same listPlants with `plantIdFilter`."
    - "listPlants returns `{ rows: PlantRow[], nextCursor: ExtendedCursor | null }` (camelCase internal). Route handler in 05-08 serializes to `{ data: snake_case_rows, next_cursor: string | null }` (Codex Decision 1)."
    - "listPhotoEntries({ plantId, userId, cursor, limit }) returns reverse-chronological PhotoEntries scoped to plantId+userId"
  artifacts:
    - path: "src/contexts/catalog/application/update-plant.ts"
      provides: "updatePlant"
      min_lines: 35
    - path: "src/contexts/catalog/application/add-photo-entry.ts"
      provides: "addPhotoEntry"
      min_lines: 50
    - path: "src/contexts/catalog/application/update-photo-entry-note.ts"
      provides: "updatePhotoEntryNote"
      min_lines: 25
    - path: "src/contexts/catalog/application/delete-photo-entry.ts"
      provides: "deletePhotoEntry"
      min_lines: 30
    - path: "src/contexts/catalog/application/set-cover-photo.ts"
      provides: "setCoverPhoto"
      min_lines: 40
    - path: "src/contexts/catalog/application/list-plants.ts"
      provides: "listPlants — decodes wire cursor + calls plants.findByCursor + encodes nextCursor"
      min_lines: 50
    - path: "src/contexts/catalog/application/list-photo-entries.ts"
      provides: "listPhotoEntries — reverse-chronological cursor pagination"
      min_lines: 35
    - path: "tests/unit/contexts/catalog/update-plant.test.ts"
      provides: "happy path, not_found, mass-assignment defense (extra fields silently ignored at use-case)"
      min_lines: 35
    - path: "tests/unit/contexts/catalog/add-photo-entry.test.ts"
      provides: "happy path, storage path spoof rejection, plant not found"
      min_lines: 45
    - path: "tests/unit/contexts/catalog/update-photo-entry-note.test.ts"
      provides: "happy path with note, set null, not_found"
      min_lines: 25
    - path: "tests/unit/contexts/catalog/delete-photo-entry.test.ts"
      provides: "happy path returning paths, not_found"
      min_lines: 25
    - path: "tests/unit/contexts/catalog/set-cover-photo.test.ts"
      provides: "happy path, cross-plant rejection (photo belongs to different plant)"
      min_lines: 35
    - path: "tests/unit/contexts/catalog/list-plants.test.ts"
      provides: "decodes cursor, calls findByCursor with correct args, encodes nextCursor"
      min_lines: 40
    - path: "tests/unit/contexts/catalog/list-photo-entries.test.ts"
      provides: "happy path, cursor encode/decode for reverse-chrono"
      min_lines: 30
    - path: "tests/integration/catalog/update-plant.integration.test.ts"
      provides: "Real-DB PATCH including null nickname; row scoping by user"
      min_lines: 40
    - path: "tests/integration/catalog/add-photo-entry.integration.test.ts"
      provides: "Real-DB PhotoEntry insert; cover_photo_url unchanged unless set explicitly"
      min_lines: 40
    - path: "tests/integration/catalog/list-plants-cursor.integration.test.ts"
      provides: "Real-DB cursor pagination across all 6 sortKey values; NULL acquisition_date NULLS LAST"
      min_lines: 80
    - path: "tests/integration/catalog/id-history-visibility.integration.test.ts"
      provides: "Real-DB: identification_count = 0 vs > 0 for plants with/without identifications (CAT-04)"
      min_lines: 50
  key_links:
    - from: "src/contexts/catalog/application/list-plants.ts"
      to: "src/shared/api/cursor.ts (Plan 05-02)"
      via: "decodeCursor + encodeCursor"
      pattern: "decodeCursor"
    - from: "src/contexts/catalog/application/add-photo-entry.ts"
      to: "src/contexts/catalog/domain/storage-path.ts (Plan 05-04)"
      via: "validateStoragePathOwnership"
      pattern: "validateStoragePathOwnership"
    - from: "src/contexts/catalog/application/set-cover-photo.ts"
      to: "src/contexts/catalog/infrastructure/db/photo-entries.ts (Plan 05-03)"
      via: "looks up PhotoEntry to confirm photo_url belongs to this plant"
      pattern: "photoEntries"
---

<objective>
Ship the 7 remaining catalog use cases consumed by Plans 05-08 (read + create routes — list-plants, list-photo-entries) and 05-09 (mutate routes — updatePlant, addPhotoEntry, updatePhotoEntryNote, deletePhotoEntry, setCoverPhoto). All 7 follow the Plan 05-05 patterns: UnitOfWork transactions, DomainError throws, repository delegation.

Purpose: completes the application layer for batch 5a. Without these, Plans 05-08/09 cannot wire the remaining 6 routes (list, get-detail, list-photos, PATCH plant, photo CRUD, set-cover).

Output: 7 use-case modules (~265 lines), 11 test files (~470 lines: 7 unit + 4 integration covering the load-bearing behaviors).
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
@.planning/phases/05-catalog-meu-jardim/05-03-catalog-repositories-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-05-plant-create-use-cases-PLAN.md

<interfaces>
All 7 use-case signatures (concise — implementation details in tasks):

```ts
// src/contexts/catalog/application/update-plant.ts
export async function updatePlant(args: {
  plantId: string;
  userId: string;
  patch: PlantPatch; // already zod-validated by route handler
  uow: UnitOfWork;
}): Promise<Plant>;
// throws notFound when no row matches (plantId, userId)

// src/contexts/catalog/application/add-photo-entry.ts
export async function addPhotoEntry(args: {
  plantId: string;
  userId: string;
  input: PhotoEntryCreateInput; // { photo_url, thumbnail_url, note? }
  uow: UnitOfWork;
}): Promise<PhotoEntry>;
// 1. validateStoragePathOwnership({ paths: [photo_url, thumbnail_url], userId, plantId }) — T-5-01
// 2. transaction: verify plant exists & belongs to user (else notFound), then photoEntries.create

// src/contexts/catalog/application/update-photo-entry-note.ts
export async function updatePhotoEntryNote(args: {
  id: string;
  plantId: string;
  userId: string;
  note: string | null;
  uow: UnitOfWork;
}): Promise<PhotoEntry>;
// throws notFound when no row matches

// src/contexts/catalog/application/delete-photo-entry.ts
export async function deletePhotoEntry(args: {
  id: string;
  plantId: string;
  userId: string;
  uow: UnitOfWork;
}): Promise<{ deletedPaths: string[] }>;
// throws notFound when no row matches; returns the deleted storage paths for caller to optionally schedule cleanup

// src/contexts/catalog/application/set-cover-photo.ts
export async function setCoverPhoto(args: {
  plantId: string;
  userId: string;
  photoUrl: string;
  uow: UnitOfWork;
}): Promise<Plant>;
// 1. transaction: verify a PhotoEntry exists with photoUrl AND plantId AND userId (cross-plant defense — else validationFailed("photo_not_in_plant"))
// 2. plants.setCoverPhoto

// src/contexts/catalog/application/list-plants.ts
export async function listPlants(args: {
  userId: string;
  sortKey: SortKey;
  cursor: string | null; // wire cursor (base64)
  limit: number; // capped 1..200; default 50
  includeIdentificationCount?: boolean;
  plantIdFilter?: string;  // when set, returns 0 or 1 row (the matching plant); ignores cursor + sortKey for the single-row lookup but still enforces userId
}): Promise<{ rows: Array<Plant & { identificationCount?: number }>; nextCursor: string | null }>;
// 1. if cursor provided AND plantIdFilter NOT set, decodeCursor (throws "validation_failed" on bad cursor)
// 2. if plantIdFilter set: plants.findByIdAndUser(userId, plantIdFilter) returning 0|1 row, then optionally LEFT JOIN identifications for the count when includeIdentificationCount=true
// 3. else: plants.findByCursor (or extended variant when includeIdentificationCount=true)
// 4. if rows yielded a nextCursor object, encode it; else null
// NOTE (resolves plan-checker BLOCKER 2): the GET /api/v1/plants/:plantId route handler in Plan 05-08 calls listPlants({ userId, plantIdFilter, includeIdentificationCount: true }) — this is the chosen path. Plan 05-08 (Wave 3) appends src/contexts/catalog/application/list-plants.ts to its files_modified with an "append-only optional parameter" override note. The Wave 2 owner (this plan) ships the parameter as optional with default undefined; Wave 3 consumes it with no runtime impact when other call sites don't pass it.

// src/contexts/catalog/application/list-photo-entries.ts
export async function listPhotoEntries(args: {
  plantId: string;
  userId: string;
  cursor: string | null;
  limit: number; // capped 1..200; default 50
}): Promise<{ rows: PhotoEntry[]; nextCursor: string | null }>;
// reverse-chronological by created_at DESC + id DESC (CAT-06)
```

For listPlants `includeIdentificationCount=true`, extend the SQL query in plants.findByCursor (or add a sibling repo function in this plan) to LEFT JOIN identifications and select `count(identifications.id) as identification_count`. The Plan 05-03 repo already exists; add a new function `findByCursorWithIdentificationCount` instead of mutating the original to avoid breaking other call sites.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship the 5 mutation use cases (updatePlant, addPhotoEntry, updatePhotoEntryNote, deletePhotoEntry, setCoverPhoto) + their unit tests</name>
  <files>
    src/contexts/catalog/application/update-plant.ts,
    src/contexts/catalog/application/add-photo-entry.ts,
    src/contexts/catalog/application/update-photo-entry-note.ts,
    src/contexts/catalog/application/delete-photo-entry.ts,
    src/contexts/catalog/application/set-cover-photo.ts,
    tests/unit/contexts/catalog/update-plant.test.ts,
    tests/unit/contexts/catalog/add-photo-entry.test.ts,
    tests/unit/contexts/catalog/update-photo-entry-note.test.ts,
    tests/unit/contexts/catalog/delete-photo-entry.test.ts,
    tests/unit/contexts/catalog/set-cover-photo.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/application/create-plant-manual.ts (Plan 05-05 — same UoW + DomainError patterns)
    - src/contexts/catalog/application/errors.ts (Plan 05-05)
    - src/contexts/catalog/infrastructure/db/plants.ts + photo-entries.ts (Plan 05-03 — repo signatures)
    - src/contexts/catalog/domain/plant.ts (Plan 05-04 — PlantPatch type)
    - src/contexts/catalog/domain/photo-entry.ts (Plan 05-04 — PhotoEntryCreateInput type)
    - src/contexts/catalog/domain/storage-path.ts (Plan 05-04 — validateStoragePathOwnership)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-22 (Plant create two-step flow), D-23 (PhotoEntry add two-step), D-23B (mutation surface — note + cover-photo + delete endpoints)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Security Domain row "Mass-assignment on PATCH" (defense layered: zod schema + use case)
  </read_first>
  <behavior>
    updatePlant:
    - Happy path: plants.updatePartial returns updated row → use case returns it
    - Not found: plants.updatePartial returns null → throws notFound("plant_not_found")
    - patch is passed-through verbatim — schema already validated by route handler

    addPhotoEntry:
    - Happy path: validateStoragePathOwnership ok → transaction → plants.findByIdAndUser confirms exists → photoEntries.create called → returned
    - Plant not found: plants.findByIdAndUser returns null → throws notFound BEFORE photoEntries.create
    - Bad path (cross-user spoof): validateStoragePathOwnership returns badPaths → throws validationFailed BEFORE transaction

    updatePhotoEntryNote:
    - Happy path with string: photoEntries.updateNote returns row → returned
    - Happy path with null: passes through
    - Not found: returns null → throws notFound

    deletePhotoEntry:
    - Happy path: photoEntries.deleteByIdAndPlant returns { deletedPaths } → use case returns same shape
    - Not found: returns null → throws notFound

    setCoverPhoto:
    - Happy path: photoEntries.findByPlant lists entries; finds one with matching photoUrl → plants.setCoverPhoto called → returned
    - Cross-plant rejection: no PhotoEntry of THIS plant has the photoUrl → throws validationFailed("photo_not_in_plant")
    - Plant not found: plants.setCoverPhoto returns null → throws notFound
  </behavior>
  <action>
    1. Implement the 5 use-case modules per the `<interfaces>` block. Each is short (25-50 lines). Use the same `args.uow.transaction(async (tx) => ...)` wrapping for any multi-step write. Call `validateStoragePathOwnership` from `@contexts/catalog/domain/storage-path` in addPhotoEntry BEFORE opening the transaction.

       **Codex review HIGH 05-07** — setCoverPhoto MUST NOT contain raw SQL. The use case stitches two repo helpers:
       ```ts
       // src/contexts/catalog/application/set-cover-photo.ts
       import * as plants from "@contexts/catalog/infrastructure/db/plants";
       import * as photoEntries from "@contexts/catalog/infrastructure/db/photo-entries";
       import { notFound, validationFailed } from "./errors";
       import type { UnitOfWork } from "@shared/db/unit-of-work";

       export async function setCoverPhoto(args: {
         plantId: string;
         userId: string;
         photoEntryId: string;
         uow: UnitOfWork;
       }) {
         return await args.uow.transaction(async (tx) => {
           // 1. Verify the PhotoEntry belongs to THIS plant + user (cross-plant + cross-user defense).
           //    Plan 05-03 ships photoEntries.findById(db, args) — single repo call, NO raw SQL.
           const photoEntry = await photoEntries.findById(tx, {
             photoEntryId: args.photoEntryId,
             plantId: args.plantId,
             userId: args.userId,
           });
           if (!photoEntry) validationFailed("photo_not_in_plant");

           // 2. Update plants.cover_photo_url with the resolved photo's photoUrl.
           //    Plan 05-03 ships plants.setCoverPhoto(tx, args) — single repo UPDATE, NO raw SQL.
           const updated = await plants.setCoverPhoto(tx, {
             plantId: args.plantId,
             userId: args.userId,
             coverPhotoUrl: photoEntry.photoUrl,
           });
           if (!updated) notFound("plant_not_found");
           return updated;
         });
       }
       ```

       **Notes:**
       - The HTTP request body is `{ photo_entry_id }` (snake_case wire), parsed by `SetCoverPhotoSchema` in Plan 05-04. The route handler in 05-09 maps `photo_entry_id` → `photoEntryId` and calls this use case.
       - The use case file imports ONLY repo modules + error helpers + UoW type. It does NOT import `drizzle-orm`, `sql`, or any DB client primitive. Verification grep gate enforces this.

    2. Write the 5 unit test files. Use vi.mock for repositories. Each file covers the bullet behaviors above. ~25-45 lines each.

    3. Run `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/{update-plant,add-photo-entry,update-photo-entry-note,delete-photo-entry,set-cover-photo}.test.ts`. All pass.
  </action>
  <acceptance_criteria>
    - All 5 use-case files exist and export the named function (grep for `export async function updatePlant`, etc.)
    - add-photo-entry.ts contains literal `validateStoragePathOwnership` (T-5-01 wired)
    - set-cover-photo.ts contains literal `photo_not_in_plant` (cross-plant defense)
    - All 5 unit test files exist with at least 3 cases each
    - `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/update-plant.test.ts tests/unit/contexts/catalog/add-photo-entry.test.ts tests/unit/contexts/catalog/update-photo-entry-note.test.ts tests/unit/contexts/catalog/delete-photo-entry.test.ts tests/unit/contexts/catalog/set-cover-photo.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "export async function updatePlant" src/contexts/catalog/application/update-plant.ts && grep -q "export async function addPhotoEntry" src/contexts/catalog/application/add-photo-entry.ts && grep -q "validateStoragePathOwnership" src/contexts/catalog/application/add-photo-entry.ts && grep -q "photo_not_in_plant" src/contexts/catalog/application/set-cover-photo.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/update-plant.test.ts tests/unit/contexts/catalog/add-photo-entry.test.ts tests/unit/contexts/catalog/update-photo-entry-note.test.ts tests/unit/contexts/catalog/delete-photo-entry.test.ts tests/unit/contexts/catalog/set-cover-photo.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>5 mutation use cases shipped + unit-tested; T-5-01 + cross-plant defense wired; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship the 2 list use cases + their cursor unit tests + 4 integration tests covering CAT-04 + CAT-07 + CAT-06</name>
  <files>
    src/contexts/catalog/application/list-plants.ts,
    src/contexts/catalog/application/list-photo-entries.ts,
    tests/unit/contexts/catalog/list-plants.test.ts,
    tests/unit/contexts/catalog/list-photo-entries.test.ts,
    tests/integration/catalog/update-plant.integration.test.ts,
    tests/integration/catalog/add-photo-entry.integration.test.ts,
    tests/integration/catalog/list-plants-cursor.integration.test.ts,
    tests/integration/catalog/id-history-visibility.integration.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/plants.ts (Plan 05-03 — findByCursor signature)
    - src/contexts/catalog/infrastructure/db/photo-entries.ts (Plan 05-03 — findByPlant signature; uses simple cursor)
    - src/shared/api/cursor.ts (Plan 05-02 — encodeCursor/decodeCursor/SortKey)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-26 (ID-history hidden when no Identifications — drives the includeIdentificationCount flag)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pitfall 5 (cursor instability with NULL acquisition_date — list-plants integration test must verify NULLS-LAST + tiebreaker)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row CAT-04 ID-history visibility (the test command this plan satisfies)
  </read_first>
  <behavior>
    listPlants (unit, mocked):
    - cursor=null + sortKey="acquired_desc" → calls plants.findByCursor with cursor=null + sortKey
    - cursor=encoded + sortKey="name_asc" → calls decodeCursor first → calls plants.findByCursor with the decoded ExtendedCursor
    - bad cursor → throws validation_failed (decodeCursor throws — propagates)
    - findByCursor returns nextCursor object → encoded into wire string
    - findByCursor returns nextCursor=null → wire result has nextCursor=null
    - includeIdentificationCount=true → calls findByCursorWithIdentificationCount (or extended variant)
    - limit=200 passed through; limit > 200 → use case caps to 200 (defense — route handler also caps but defense in depth)

    listPhotoEntries (unit, mocked):
    - cursor=null → calls photoEntries.findByPlant with cursor=null
    - cursor=encoded → decodes to { id, createdAt } before passing
    - encodes nextCursor with sortKey="created_desc" sortValue=createdAt

    Integration:
    - update-plant.integration: real PATCH against seeded plant; verify nullified nickname; verify cross-user PATCH (different userId) returns null/throws not_found
    - add-photo-entry.integration: insert seeded plant + valid storage path → addPhotoEntry creates row; cover_photo_url unchanged; bad-path test rejects with validation_failed
    - list-plants-cursor.integration: seed 5 plants with mixed acquisition_date (3 with dates, 2 NULL); call listPlants(sortKey="acquired_desc", limit=2) page-by-page; verify NULL plants come last; verify cursor traversal returns all 5 in order
    - id-history-visibility.integration: seed 1 plant with 0 identifications + 1 plant with 2 identifications; call listPlants with includeIdentificationCount=true; verify counts 0 and 2; (this satisfies the VALIDATION.md row)
  </behavior>
  <action>
    1. Implement src/contexts/catalog/application/list-plants.ts. Cap limit to 200. Decode cursor; on decode failure (which throws Error("validation_failed")), re-throw as DomainError("validation_failed", "invalid_cursor"). After the repo call, encode nextCursor if present.

       For includeIdentificationCount=true: add a new repo function `findByCursorWithIdentificationCount` to src/contexts/catalog/infrastructure/db/plants.ts (Plan 05-03 file extension is permitted; document the addition with a comment "Phase 5 Plan 05-07 extension"). The function is identical to findByCursor but:
       ```sql
       SELECT plants.*, COUNT(identifications.id) AS identification_count
       FROM plants
       LEFT JOIN identifications ON identifications.plant_id = plants.id
       WHERE plants.user_id = $1
       ${cursor predicate}
       GROUP BY plants.id
       ORDER BY ...
       LIMIT $N
       ```

    2. Implement src/contexts/catalog/application/list-photo-entries.ts. Simpler — uses a small cursor format `{ id, createdAt }` (same as Phase 2 D-36 pre-extension). The wire cursor still goes through encodeCursor with sortKey="created_desc"; decode similarly extracts back the simple shape.

    3. Write the 2 unit test files covering the listed behaviors with mocked repos.

    4. Write the 4 integration test files. The list-plants-cursor and id-history-visibility tests are load-bearing for VALIDATION.md (CAT-07 cursor + CAT-04 ID-history visibility).

    5. Run all 6 test files; tsc clean.
  </action>
  <acceptance_criteria>
    - list-plants.ts contains literal `decodeCursor` AND `encodeCursor` (cursor codec wired)
    - list-plants.ts contains literal `findByCursorWithIdentificationCount` OR `identificationCount` (the count-aware path)
    - list-photo-entries.ts contains literal `created_desc` (sortKey)
    - tests/unit/contexts/catalog/list-plants.test.ts contains at least 6 `it(...)` cases
    - tests/integration/catalog/list-plants-cursor.integration.test.ts contains a NULLS-LAST assertion (grep for "NULL" or "null")
    - tests/integration/catalog/id-history-visibility.integration.test.ts contains an assertion comparing identification_count to 0 AND to >0
    - All test files green: `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/list-plants.test.ts tests/unit/contexts/catalog/list-photo-entries.test.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/update-plant.integration.test.ts tests/integration/catalog/add-photo-entry.integration.test.ts tests/integration/catalog/list-plants-cursor.integration.test.ts tests/integration/catalog/id-history-visibility.integration.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "decodeCursor" src/contexts/catalog/application/list-plants.ts && grep -q "encodeCursor" src/contexts/catalog/application/list-plants.ts && grep -q "identificationCount\|findByCursorWithIdentificationCount" src/contexts/catalog/application/list-plants.ts && grep -q "created_desc" src/contexts/catalog/application/list-photo-entries.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/list-plants.test.ts tests/unit/contexts/catalog/list-photo-entries.test.ts && pnpm exec vitest --run --project=integration tests/integration/catalog/update-plant.integration.test.ts tests/integration/catalog/add-photo-entry.integration.test.ts tests/integration/catalog/list-plants-cursor.integration.test.ts tests/integration/catalog/id-history-visibility.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>listPlants + listPhotoEntries shipped with cursor codec wired; CAT-07 NULLS-LAST and CAT-04 ID-history-visibility integration tests green.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-01" severity="high" stride="T">
  <description>Photo URL spoofing on POST /api/v1/plants/:id/photos — same Pitfall 1 vector as Plan 05-05's createPlantManual.</description>
  <mitigation file="src/contexts/catalog/application/add-photo-entry.ts">addPhotoEntry calls validateStoragePathOwnership({ paths: [photo_url, thumbnail_url], userId, plantId }) BEFORE opening the transaction. Failure throws validation_failed; no DB row is inserted.</mitigation>
</threat>

<threat id="T-5-mass-assignment" severity="high" stride="T">
  <description>Mass-assignment on PATCH /api/v1/plants/:id — defense in depth. PlantPatchSchema (Plan 05-04) strips unknown keys via .strict(); the use case is the second layer.</description>
  <mitigation file="src/contexts/catalog/application/update-plant.ts">updatePlant accepts a typed `patch: PlantPatch` parameter; TypeScript itself disallows arbitrary keys at compile time. plants.updatePartial repository (Plan 05-03) only writes the listed PlantPatch fields. No surface for mass-assignment to reach the DB.</mitigation>
</threat>

<threat id="T-5-16" severity="medium" stride="T">
  <description>Cross-plant cover-photo tampering on PATCH /api/v1/plants/:id/cover-photo — client submits a photo_url belonging to a different plant of theirs (or another user's plant), hoping the cover gets set without ownership re-check.</description>
  <mitigation file="src/contexts/catalog/application/set-cover-photo.ts">**Codex review HIGH 05-07 fix**: setCoverPhoto's first action inside the transaction is `photoEntries.findById(tx, { photoEntryId, plantId, userId })` (single repo call, NO raw SQL). The repository function (Plan 05-03) executes the SQL `WHERE id = $photoEntryId AND plant_id = $plantId AND user_id = $userId LIMIT 1`. If no row matches, the use case throws `validationFailed("photo_not_in_plant")`. The combined plant_id + user_id WHERE clause means the photo MUST belong to the targeted plant AND the authenticated user. Unit test covers the cross-plant rejection path. Use case file contains zero `drizzle-orm` imports (verification grep gate).</mitigation>
</threat>

<threat id="T-5-17" severity="low" stride="I">
  <description>Cursor enumeration / next-page probing — a client iterating cursors faster than the rate limiter could enumerate the full plant catalog of their own user. Not a cross-user IDOR (cursor decode + plants.findByCursor both filter by userId), but could be used for scraping.</description>
  <mitigation file="src/contexts/catalog/application/list-plants.ts">limit is capped to 200 (Phase 2 D-36 default). Phase 4 ships per-IP rate limiting only on auth endpoints; broader rate limiting is explicitly out of scope per CLAUDE.md "Only narrow per-IP throttle on public auth endpoints in MVP". Accepted risk for MVP; if scraping becomes an issue, broaden rate limiting in a follow-up phase.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/` exits 0 (all unit tests including 7 use-case test files green).
2. `pnpm exec vitest --run --project=integration tests/integration/catalog/` exits 0 (CAT-07 cursor + CAT-04 ID-history visibility tests green).
3. `pnpm exec tsc --noEmit` exits 0.
4. All 7 use-case files exist and export the named functions.
5. **Codex 05-07 grep gate (no raw SQL/Drizzle in setCoverPhoto)**: `grep -E "from \\\"drizzle-orm" src/contexts/catalog/application/set-cover-photo.ts` returns 0; `grep -E "import \\{ sql \\}" src/contexts/catalog/application/set-cover-photo.ts` returns 0. The file imports ONLY repo modules.
6. **Codex Decision 3 grep gate (listPlants signature)**: `grep -E "listPlants\\(\\{" src/contexts/catalog/application/list-plants.ts` matches; the function uses object-form arguments. `grep -nE "sortKey" src/contexts/catalog/application/list-plants.ts` returns ≥ 1 (parameter is `sortKey`, not `sort`).
7. **Codex 05-09 grep gate (deletePhotoEntry dispatches photo_entry.deleted)**: `grep -E "photo_entry\\.deleted|PhotoEntryDeletedEventName" src/contexts/catalog/application/delete-photo-entry.ts` matches; `grep -E "plant\\.deleted|PlantDeletedEventName" src/contexts/catalog/application/delete-photo-entry.ts` returns 0.
</verification>

<reviews_addressed>
**Codex review findings resolved by this plan (per `.planning/phases/05-catalog-meu-jardim/05-REVIEWS.md`):**

- **05-07 HIGH — `setCoverPhoto` may use raw SQL in the use-case layer**: Resolved by `decisions.set_cover_photo_validation`. Implementation pattern: use case calls `photoEntries.findById(db, args)` (new Plan 05-03 helper) for ownership verification, then `plants.setCoverPhoto(tx, args)` (new Plan 05-03 single-UPDATE helper). The use-case file imports only repo modules; verification adds a grep gate that catches `drizzle-orm` imports in `set-cover-photo.ts`.
- **Codex Decision 3 — `listPlants` argument-name drift (`sort` vs `sortKey`, plantIdFilter inconsistency)**: Resolved by `decisions.list_plants_argument_signature` — single canonical object-form signature. Wire HTTP query is `?sort=`, but the use-case argument is `sortKey`. Detail fetch uses `plantIdFilter` on the same listPlants function. No positional overload, no route-only side path.
- **05-09 HIGH — `plant.deleted` reused for single PhotoEntry deletion is semantically dangerous**: Resolved by `decisions.delete_photo_entry_storage_cleanup` — `deletePhotoEntry` now dispatches `photo_entry.deleted` (NOT `plant.deleted`). The cleanup decision moves into THIS plan's use case (where the data deletion happens), instead of being injected at the route handler in 05-09. Plan 05-06's `catalog/cleanup-storage` Inngest function handles both event types via the shared `storage_deletion_job_id`.
- **Codex Decision 1/2 — repository return shape & route serializer**: `list-plants` returns `{ rows, nextCursor }` (camelCase internal); the route handler in 05-08 serializes to `{ data, next_cursor }` snake_case (camelCase repo rows → snake_case wire keys via the route adapter).
- **Codex Decision 6 — canonical storage path format**: `addPhotoEntry` validates with `{userId}/{plantId}/{file}` form via `validateStoragePathOwnership`.
</reviews_addressed>

<success_criteria>
- 7 use-case modules: updatePlant, addPhotoEntry, updatePhotoEntryNote, deletePhotoEntry, setCoverPhoto, listPlants, listPhotoEntries.
- T-5-01 storage-path validation wired in addPhotoEntry (canonical path format per Codex Decision 6).
- Codex 05-07 — setCoverPhoto contains zero raw SQL/Drizzle access; uses photoEntries.findById + plants.setCoverPhoto repo helpers only.
- Codex 05-09 — deletePhotoEntry uses the same outbox + Inngest cleanup pattern as deletePlant, but dispatches `photo_entry.deleted`.
- Codex Decision 3 — listPlants single canonical signature (object-form, `sortKey`, optional `plantIdFilter` + `includeIdentificationCount`).
- Cursor codec correctly wraps Plan 05-02's encodeCursor/decodeCursor in listPlants/listPhotoEntries.
- includeIdentificationCount path supports CAT-04 conditional ID-history link visibility.
- 11 test files cover 35+ behaviors total; all green.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-07-SUMMARY.md` capturing:
- The 7 exported use-case function signatures Plans 05-08 and 05-09 will import
- Note for Plan 05-09: `deletePhotoEntry` returns `{ deletedPaths }`. The route handler MAY dispatch a per-photo cleanup event using the same `pending_storage_deletions` outbox + Inngest cleanup function (just enqueue with plantId of the parent plant) OR Phase 5 may defer per-photo storage cleanup as documented in this plan's `decisions.delete_photo_entry_storage_cleanup`. Plan 05-09 picks one approach
- Note: `findByCursorWithIdentificationCount` was added to Plan 05-03's plants.ts repo as a Phase 5 Plan 05-07 extension; document the addition so future work doesn't re-add it
- Note for Plan 05-08 (read routes): `listPlants` accepts an `includeIdentificationCount` flag for the GET /api/v1/plants/:id detail endpoint (or for the list endpoint when the client passes ?include=identification_count)
- Confirmation that all 7 use cases use UnitOfWork.transaction (Phase 2 D-18)
</output>
