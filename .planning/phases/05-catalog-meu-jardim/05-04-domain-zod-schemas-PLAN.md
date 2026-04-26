---
phase: 05-catalog-meu-jardim
plan: 04
type: execute
wave: 1
depends_on:
  - 05-01
  - 05-02
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-02 (catalog schema with plants + photo_entries tables) and Plan 02-06 (drizzle-zod helpers / API conventions). Phase 2 D-19 mandates "drizzle-zod-derived domain schemas" — this plan instantiates that pattern for catalog. The catalog schema rows must exist on disk for createInsertSchema(plants) to compile.
files_modified:
  - src/contexts/catalog/domain/plant.ts
  - src/contexts/catalog/domain/photo-entry.ts
  - src/contexts/catalog/domain/pending-storage-deletion.ts
  - src/contexts/catalog/domain/events.ts
  - src/contexts/catalog/domain/storage-path.ts
  - tests/unit/contexts/catalog/plant-create-input-schema.test.ts
  - tests/unit/contexts/catalog/plant-patch-schema.test.ts
  - tests/unit/contexts/catalog/photo-entry-create-schema.test.ts
  - tests/unit/contexts/catalog/storage-path-ownership.test.ts
autonomous: true
requirements:
  - CAT-02
  - CAT-03
decisions:
  zod_derivation_pattern: "Per Phase 2 D-19 — every domain module derives schemas via createInsertSchema/createSelectSchema/createUpdateSchema from drizzle-zod. Routes import domain schemas, NEVER raw table definitions."
  storage_path_validator_signature: "validateStoragePathOwnership({ paths: string[], userId: string, plantId: string }): { ok: true } | { ok: false, badPaths: string[] }. Path expected shape: `{user_id}/{plant_id}/{file_id}.{ext}` per Phase 2 D-26. Both photo_url and thumbnail_url paths are validated against the same prefix."
  pitfall_1_mitigation_layer: "Storage-path ownership is a USE-CASE concern (Pitfall 1). The validator helper lives at src/contexts/catalog/domain/storage-path.ts so it's importable by both createPlantManual (Plan 05-05) and addPhotoEntry (Plan 05-07). The route handler does NOT call it directly."
  events_module_scope: "src/contexts/catalog/domain/events.ts exports type-only event payload shapes for `plant.created` and `plant.deleted` per Phase 2 D-42. Inngest createFunction triggers (Plan 05-06) reference these types."
  patch_schema_field_set: "PlantPatchSchema is .pick({ name, nickname, location, acquisitionDate, notes }) — server-controlled fields (id, userId, speciesId, coverPhotoUrl, createdAt) explicitly NOT patchable. Mass-assignment defense per RESEARCH § Security Domain T-5 mass-assignment row."
must_haves:
  truths:
    - "Every catalog mutating route handler can import a single Zod schema (PlantCreateInputSchema, PlantPatchSchema, PhotoEntryCreateSchema, PhotoEntryNotePatchSchema, SetCoverPhotoSchema) and call .safeParse before invoking the use case"
    - "validateStoragePathOwnership returns { ok: false, badPaths } for any path not starting with `{userId}/{plantId}/` — including identification-owned paths from a different plant or another user's photos (T-5-01 mitigation, Pitfall 1)"
    - "PlantPatchSchema rejects unknown keys (mass-assignment T-5 mitigation): an input with `userId` or `coverPhotoUrl` fields fails parse"
    - "Domain types `Plant`, `PhotoEntry`, `PendingStorageDeletion` are inferred from the Zod select schemas (single source of truth)"
    - "events.ts exports type-only `PlantCreatedEvent`, `PlantDeletedEvent` payload types matching the canonical event names from CONTEXT D-04 specifics"
  artifacts:
    - path: "src/contexts/catalog/domain/plant.ts"
      provides: "PlantSchema (select), PlantCreateInputSchema (insert + initial_photos refinement), PlantPatchSchema (update, picked fields), Plant type"
      min_lines: 60
    - path: "src/contexts/catalog/domain/photo-entry.ts"
      provides: "PhotoEntrySchema, PhotoEntryCreateSchema, PhotoEntryNotePatchSchema, PhotoEntry type"
      min_lines: 35
    - path: "src/contexts/catalog/domain/pending-storage-deletion.ts"
      provides: "PendingStorageDeletionSchema, PendingStorageDeletion type"
      min_lines: 15
    - path: "src/contexts/catalog/domain/events.ts"
      provides: "PlantCreatedEvent, PlantDeletedEvent, PlantCreatedEventName, PlantDeletedEventName"
      min_lines: 25
    - path: "src/contexts/catalog/domain/storage-path.ts"
      provides: "validateStoragePathOwnership, parseStoragePath helpers + StoragePathOwnership type"
      min_lines: 35
    - path: "tests/unit/contexts/catalog/plant-create-input-schema.test.ts"
      provides: "Coverage for: missing name, missing initial_photos, name length cap, nickname/location/notes nullability, unknown-key rejection"
      min_lines: 70
    - path: "tests/unit/contexts/catalog/plant-patch-schema.test.ts"
      provides: "Coverage for: empty patch allowed, mass-assignment rejection (userId, speciesId, coverPhotoUrl, id, createdAt)"
      min_lines: 50
    - path: "tests/unit/contexts/catalog/photo-entry-create-schema.test.ts"
      provides: "Coverage for: missing photo_url, missing thumbnail_url, optional note, unknown-key rejection"
      min_lines: 30
    - path: "tests/unit/contexts/catalog/storage-path-ownership.test.ts"
      provides: "Coverage for: matching prefix returns ok, mismatched user prefix → badPaths, mismatched plant prefix → badPaths, both photo_url and thumbnail_url validated"
      min_lines: 60
  key_links:
    - from: "src/contexts/catalog/domain/plant.ts"
      to: "src/contexts/catalog/infrastructure/db/schema.ts"
      via: "imports `plants` table object for createInsertSchema"
      pattern: "from \"@contexts/catalog/infrastructure/db/schema\""
    - from: "src/contexts/catalog/domain/storage-path.ts"
      to: "Phase 2 D-26 storage layout"
      via: "validates paths begin with {userId}/{plantId}/"
      pattern: "validateStoragePathOwnership"
---

<objective>
Ship the catalog domain layer (Zod schemas + event types + storage-path ownership validator). These artifacts are the Phase 5 mitigation layer for Pitfall 1 (storage path spoofing → T-5-01) and the mass-assignment threat on PATCH (T-5 mitigation per RESEARCH § Security Domain).

Purpose: route handlers (Plans 05-08/09) and use cases (Plans 05-05/06/07) consume these schemas at the boundary. Without them, Phase 5 has no zod validation surface and no shared storage-path defense.

Output: 5 domain modules (~170 lines), 4 unit test files (~210 lines).
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
src/contexts/catalog/domain/plant.ts (final shape):
```ts
import { createInsertSchema, createSelectSchema, createUpdateSchema } from "drizzle-zod";
import { plants } from "@contexts/catalog/infrastructure/db/schema";
import { z } from "zod";

export const PlantSchema = createSelectSchema(plants);
export type Plant = z.infer<typeof PlantSchema>;

export const PlantCreateInputSchema = createInsertSchema(plants, {
  name: (s) => s.min(1, { message: "name_required" }).max(80),
  nickname: (s) => s.max(80).nullable().optional(),
  location: (s) => s.max(40).nullable().optional(),
  notes: (s) => s.max(2000).nullable().optional(),
})
  .extend({
    initial_photos: z
      .array(
        z.object({
          photo_url: z.string().min(1),
          thumbnail_url: z.string().min(1),
        }),
      )
      .min(1, { message: "photo_required" }),
  })
  .omit({
    cover_photo_url: true, // server-set from initial_photos[0]
    created_at: true,
    user_id: true, // server-set from JWT
  })
  .strict(); // reject unknown keys

export type PlantCreateInput = z.infer<typeof PlantCreateInputSchema>;

export const PlantPatchSchema = createUpdateSchema(plants)
  .pick({
    name: true,
    nickname: true,
    location: true,
    acquisition_date: true,
    notes: true,
  })
  .strict(); // reject mass-assignment

export type PlantPatch = z.infer<typeof PlantPatchSchema>;
```

src/contexts/catalog/domain/photo-entry.ts:
```ts
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { photoEntries } from "@contexts/catalog/infrastructure/db/schema";
import { z } from "zod";

export const PhotoEntrySchema = createSelectSchema(photoEntries);
export type PhotoEntry = z.infer<typeof PhotoEntrySchema>;

export const PhotoEntryCreateSchema = z.object({
  photo_url: z.string().min(1),
  thumbnail_url: z.string().min(1),
  note: z.string().max(2000).nullable().optional(),
}).strict();
export type PhotoEntryCreateInput = z.infer<typeof PhotoEntryCreateSchema>;

export const PhotoEntryNotePatchSchema = z.object({
  note: z.string().max(2000).nullable(),
}).strict();
export type PhotoEntryNotePatch = z.infer<typeof PhotoEntryNotePatchSchema>;

export const SetCoverPhotoSchema = z.object({
  photo_url: z.string().min(1),
}).strict();
```

src/contexts/catalog/domain/storage-path.ts:
```ts
export type StoragePathOwnership = {
  ok: true;
} | {
  ok: false;
  badPaths: string[];
};

const PATH_RE = /^([0-9a-fA-F-]{36})\/([0-9a-fA-F-]{36})\/[^/]+$/;

export function parseStoragePath(path: string): { userId: string; plantId: string; file: string } | null {
  const m = PATH_RE.exec(path);
  if (!m) return null;
  return { userId: m[1]!, plantId: m[2]!, file: path.slice(m[0].lastIndexOf("/") + 1) };
}

export function validateStoragePathOwnership(args: {
  paths: string[];
  userId: string;
  plantId: string;
}): StoragePathOwnership {
  const expectedPrefix = `${args.userId}/${args.plantId}/`;
  const bad: string[] = [];
  for (const p of args.paths) {
    if (!p.startsWith(expectedPrefix)) bad.push(p);
  }
  return bad.length === 0 ? { ok: true } : { ok: false, badPaths: bad };
}
```

src/contexts/catalog/domain/events.ts:
```ts
export const PlantCreatedEventName = "plant.created" as const;
export const PlantDeletedEventName = "plant.deleted" as const;

export type PlantCreatedEvent = {
  name: typeof PlantCreatedEventName;
  data: {
    user_id: string;
    plant_id: string;
    species_id: string | null;
    source: "manual" | "from_identification";
  };
};

export type PlantDeletedEvent = {
  name: typeof PlantDeletedEventName;
  data: {
    user_id: string;
    plant_id: string;
    storage_deletion_job_id: string;
    storage_paths: string[];
  };
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship the 4 domain Zod schemas + events module + their unit tests</name>
  <files>
    src/contexts/catalog/domain/plant.ts,
    src/contexts/catalog/domain/photo-entry.ts,
    src/contexts/catalog/domain/pending-storage-deletion.ts,
    src/contexts/catalog/domain/events.ts,
    tests/unit/contexts/catalog/plant-create-input-schema.test.ts,
    tests/unit/contexts/catalog/plant-patch-schema.test.ts,
    tests/unit/contexts/catalog/photo-entry-create-schema.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/infrastructure/db/schema.ts (Phase 2 wave 2 + Plan 05-02 — verify the table object exports `plants`, `photoEntries`, `pendingStorageDeletions`)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-19 (drizzle-zod domain schemas mandate), D-40 (lean domain entity style — derive types from schemas)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pattern 10: drizzle-zod domain schemas" (the canonical shape)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Security Domain row "Mass-assignment on PATCH /plants/:id" (T-5 mitigation)
    - tests/unit/errors.test.ts (existing Vitest convention)
  </read_first>
  <behavior>
    PlantCreateInputSchema:
    - Accepts: { name: "X", initial_photos: [{photo_url, thumbnail_url}] } → valid
    - Rejects: missing name → error.issues[0].message === "name_required" (or includes that string)
    - Rejects: name = "" → "name_required"
    - Rejects: name length 81 chars → max length error
    - Rejects: missing initial_photos → "photo_required"
    - Rejects: initial_photos = [] → "photo_required"
    - Rejects: initial_photos[0] missing photo_url → validation error
    - Accepts: nullable optional fields nickname/location/notes/acquisitionDate omitted
    - Rejects (strict): unknown key like { foo: "bar" }
    - Rejects (strict): user_id key in input
    - Rejects (strict): cover_photo_url key in input

    PlantPatchSchema:
    - Accepts: empty object {} (partial update with no fields)
    - Accepts: { name: "new name" }
    - Accepts: { nickname: null } (explicit nullable)
    - Accepts: { acquisition_date: null }
    - Rejects (mass-assignment): { userId: "..." }
    - Rejects: { speciesId: "..." }
    - Rejects: { cover_photo_url: "..." }
    - Rejects: { id: "..." }
    - Rejects: { created_at: "..." }

    PhotoEntryCreateSchema:
    - Accepts: { photo_url: "x", thumbnail_url: "y" }
    - Accepts: { photo_url, thumbnail_url, note: "..." }
    - Accepts: { photo_url, thumbnail_url, note: null }
    - Rejects: missing photo_url
    - Rejects: missing thumbnail_url
    - Rejects: empty photo_url
    - Rejects (strict): unknown key
  </behavior>
  <action>
    1. Implement the 4 domain modules per the `<interfaces>` block. Use `.strict()` on every schema that comes from request bodies (defense-in-depth against mass-assignment).

    2. For pending-storage-deletion.ts (smaller — just select shape + type for use by Plan 05-06):
       ```ts
       import { createSelectSchema } from "drizzle-zod";
       import { pendingStorageDeletions } from "@contexts/catalog/infrastructure/db/schema";
       import { z } from "zod";

       export const PendingStorageDeletionSchema = createSelectSchema(pendingStorageDeletions);
       export type PendingStorageDeletion = z.infer<typeof PendingStorageDeletionSchema>;
       ```

    3. Write the 3 listed unit test files; cover each behavior in the bullet list. Use the `.safeParse(input).success === false` + `.error.issues[0].message` pattern.

    4. Run `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/plant-create-input-schema.test.ts tests/unit/contexts/catalog/plant-patch-schema.test.ts tests/unit/contexts/catalog/photo-entry-create-schema.test.ts`. All must pass.
  </action>
  <acceptance_criteria>
    - All 4 domain modules exist and export the named schemas + types
    - plant.ts contains literal `.strict()` on both PlantCreateInputSchema and PlantPatchSchema
    - photo-entry.ts contains `.strict()` on PhotoEntryCreateSchema and PhotoEntryNotePatchSchema
    - events.ts exports `PlantCreatedEventName === "plant.created"` and `PlantDeletedEventName === "plant.deleted"`
    - All 3 unit test files exist; each contains at least 7 `it(...)` cases (CreateInput: 10+; Patch: 9+; PhotoEntry: 7+)
    - `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/plant-create-input-schema.test.ts tests/unit/contexts/catalog/plant-patch-schema.test.ts tests/unit/contexts/catalog/photo-entry-create-schema.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "\.strict()" src/contexts/catalog/domain/plant.ts && grep -q "\.strict()" src/contexts/catalog/domain/photo-entry.ts && grep -q "plant.created" src/contexts/catalog/domain/events.ts && grep -q "plant.deleted" src/contexts/catalog/domain/events.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/plant-create-input-schema.test.ts tests/unit/contexts/catalog/plant-patch-schema.test.ts tests/unit/contexts/catalog/photo-entry-create-schema.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>4 domain modules + 3 test files; all schemas .strict(); all tests pass; tsc clean.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship the storage-path ownership validator + its unit tests (T-5-01 mitigation)</name>
  <files>src/contexts/catalog/domain/storage-path.ts, tests/unit/contexts/catalog/storage-path-ownership.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 1: Storage path ownership spoofing on POST /plants" (THE primary motivation for this helper)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Security Domain row "Photo URL spoofing on POST /plants" (T-5-01 mitigation)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-26 (storage path layout `{user_id}/{aggregate_id}/{file_id}.{ext}`)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row CAT-02/T-5-02 (the test command this plan satisfies: `tests/unit/contexts/catalog/storage-path-ownership.test.ts`)
  </read_first>
  <behavior>
    validateStoragePathOwnership:
    - Returns { ok: true } for paths starting with `{userId}/{plantId}/`
    - Returns { ok: false, badPaths: [path] } when ANY path fails the prefix check
    - Validates BOTH photo_url and thumbnail_url paths when called by use case (caller passes a flat `paths: string[]` array)
    - Cross-user spoof: path = "USER-B/PLANT-A/x.jpg" with caller userId=USER-A → { ok: false, badPaths: ["USER-B/..."] }
    - Cross-plant spoof: path = "USER-A/PLANT-B/x.jpg" with caller plantId=PLANT-A → { ok: false, badPaths: ["USER-A/PLANT-B/..."] }
    - Empty paths array → { ok: true } (vacuous truth — empty set has no bad members; route handler enforces non-empty via PlantCreateInputSchema initial_photos.min(1))
    - Mixed: 2 good + 1 bad path → { ok: false, badPaths: [the_bad_one] }

    parseStoragePath:
    - "uuid1/uuid2/file.jpg" returns { userId: "uuid1", plantId: "uuid2", file: "file.jpg" }
    - Returns null for paths missing the user/plant prefix
    - Returns null for paths with extra leading slashes or trailing components
  </behavior>
  <action>
    1. Implement src/contexts/catalog/domain/storage-path.ts per the `<interfaces>` block. Use a UUID-shaped regex for the prefix to also reject malformed UUIDs (defense in depth — a malformed prefix is a structural anomaly).

    2. Write tests/unit/contexts/catalog/storage-path-ownership.test.ts with at least 8 cases covering:
       - happy path: 1 good path → ok
       - happy path: 3 good paths → ok
       - cross-user spoof rejected
       - cross-plant spoof rejected
       - mixed (good + bad) → only bad in badPaths
       - empty array → ok
       - parseStoragePath happy-path
       - parseStoragePath returns null for malformed input

    3. Run `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/storage-path-ownership.test.ts`. All tests pass.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/domain/storage-path.ts exports `validateStoragePathOwnership` AND `parseStoragePath` AND `StoragePathOwnership` type
    - tests/unit/contexts/catalog/storage-path-ownership.test.ts contains at least 8 `it(...)` cases
    - At least one test case asserts cross-user spoofing returns badPaths (grep test file for words like "cross-user" or "different user")
    - `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/storage-path-ownership.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "validateStoragePathOwnership" src/contexts/catalog/domain/storage-path.ts && grep -q "parseStoragePath" src/contexts/catalog/domain/storage-path.ts && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/storage-path-ownership.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>storage-path.ts shipped with both helpers; 8+ unit tests pass; cross-user/cross-plant spoofing rejected with badPaths populated.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-01" severity="high" stride="T">
  <description>Photo URL spoofing on POST /api/v1/plants — client claims another user's storage path as their own plant's cover/photo. Pitfall 1 in 05-RESEARCH.</description>
  <mitigation file="src/contexts/catalog/domain/storage-path.ts">validateStoragePathOwnership({ paths, userId, plantId }) verifies every submitted photo_url + thumbnail_url begins with `{authenticated_userId}/{submitted_plantId}/`. Plans 05-05 (createPlantManual) and 05-07 (addPhotoEntry) MUST call this helper inside the use case before any DB INSERT. Failure returns { ok: false, badPaths } which the use case maps to throwing a `validation_failed` domain error (closed registry). The path validator is the load-bearing T-5-01 mitigation; subsequent plans depend on it being shipped here.</mitigation>
</threat>

<threat id="T-5-mass-assignment" severity="high" stride="T">
  <description>Mass-assignment on PATCH /api/v1/plants/:id — client submits server-controlled fields (id, userId, speciesId, coverPhotoUrl, createdAt) hoping they propagate to the DB.</description>
  <mitigation file="src/contexts/catalog/domain/plant.ts">PlantPatchSchema is `createUpdateSchema(plants).pick({ name, nickname, location, acquisition_date, notes }).strict()`. The `.pick(...)` whitelist + `.strict()` rejection of unknown keys means any mass-assignment attempt fails parse with `validation_failed` BEFORE the use case runs. Test coverage in tests/unit/contexts/catalog/plant-patch-schema.test.ts asserts each forbidden key is rejected.</mitigation>
</threat>

<threat id="T-5-02" severity="high" stride="I">
  <description>IDOR / cross-context Identification.plant_id link tampering on POST /api/v1/plants/from-identification (CAT-01). The client submits an `identification_id` belonging to another user.</description>
  <mitigation file="src/contexts/catalog/domain/plant.ts">PlantCreateInputSchema validates SHAPE only; the cross-context ownership check (Identification.user_id === authenticated user_id) lives in the createPlantFromIdentification use case (Plan 05-05). The schema's role here is to constrain `identification_id` to a non-empty string at the boundary; the use case enforces the ownership invariant before any DB write. This split is documented to keep the domain layer free of cross-aggregate logic.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/` exits 0 (all 4 catalog unit test files green).
2. `pnpm exec tsc --noEmit` exits 0.
3. All 5 domain modules exist with the named exports.
4. PlantCreateInputSchema + PlantPatchSchema + PhotoEntryCreateSchema + PhotoEntryNotePatchSchema all use `.strict()`.
</verification>

<success_criteria>
- Five domain modules in src/contexts/catalog/domain/ (plant, photo-entry, pending-storage-deletion, events, storage-path).
- PlantCreateInputSchema + PlantPatchSchema + PhotoEntryCreateSchema all `.strict()`-protected against mass-assignment.
- validateStoragePathOwnership available for Plans 05-05 and 05-07 (T-5-01 / Pitfall 1 mitigation shipped here).
- events.ts type-only exports for `plant.created` and `plant.deleted` payload shapes.
- 4 unit test files cover ≥30 behaviors total; all pass.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-04-SUMMARY.md` capturing:
- The exported schema names + types Plans 05-05/06/07/08/09 will import
- A note: storage-path.ts MUST be called from the use-case layer (Plans 05-05 and 05-07) — NOT from the route handler. T-5-01 mitigation lives at the use-case layer per RESEARCH § Pitfall 1
- A note: events.ts is pure type-only (zero runtime impact); Plan 05-06 imports the names + types when constructing PlantDeletedEvent payloads for inngest.send
- A note for Plan 05-09 (PATCH route handler): import PlantPatchSchema and call `.safeParse(body)`; on failure return `errorResponse(ErrorCode.ValidationFailed, "...", { issues })`
</output>
