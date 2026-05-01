---
phase: 05-catalog-meu-jardim
plan: 04
type: tdd
wave: 2
depends_on: ["05-02"]
files_modified:
  - src/contexts/catalog/domain/schemas.ts
  - src/contexts/catalog/domain/storage-paths.ts
  - tests/unit/catalog-schemas.test.ts
  - tests/unit/catalog-storage-path-validator.test.ts
autonomous: true
requirements: ["CAT-02", "CAT-03"]
tags: ["catalog", "zod", "drizzle-zod", "validation", "storage-paths"]

must_haves:
  truths:
    - "Submitting create-plant payload missing both name AND photo fails validation and surfaces both field paths (`name`, `photo`) in issues — drives the D-04 ≥2-error summary block."
    - "Submitting create-plant payload with empty name OR missing photo fails validation with the offending field path."
    - "Submitting update-plant PATCH body with no known fields fails validation (rejects empty payload, drives `validation_failed`)."
    - "Submitting update-plant PATCH body with unknown fields fails validation via `.strict()` (rejects prototype-pollution / unknown-key payloads — T-05-04-02)."
    - "create-photo-entry input rejects content-types outside `image/jpeg | image/png | image/webp` and byte-lengths over `MAX_UPLOAD_BYTES` (1 MB / 1_048_576) without duplicating the constants — domain schema imports the existing `ALLOWED_MIME_TYPES` set and `MAX_UPLOAD_BYTES`."
    - "create-photo-entry input rejects notes longer than 500 chars."
    - "`validateStorageObjectKey({ userId, plantId, key })` accepts canonical D-26 paths `{userId}/{plantId}/{photoId}.{ext}` (ext: jpg|jpeg|png|webp) and throws `StoragePathValidationError` on mismatched userId, mismatched plantId, traversal sequences (`..`), absolute paths (leading `/`), empty plantId, and unsupported extension — defends T-05-04-01 prefix-mis-scope race for single-object operations."
    - "`validateStorageDeletionPrefix({ userId, plantId, prefix })` accepts only the exact prefix `` `${userId}/${plantId}/` `` and throws `StoragePathValidationError` on any mismatch — including a cross-user-prefix attack where prefix begins with a different userId (e.g. `u2/p1/` when userId is `u1`)."
  artifacts:
    - path: "src/contexts/catalog/domain/schemas.ts"
      provides: "Refined Zod schemas: `createPlantInputSchema`, `updatePlantInputSchema`, `createPhotoEntryInputSchema` (drizzle-zod-derived per Phase 2 D-19)"
      exports: ["createPlantInputSchema", "updatePlantInputSchema", "createPhotoEntryInputSchema", "CreatePlantInput", "UpdatePlantInput", "CreatePhotoEntryInput"]
    - path: "src/contexts/catalog/domain/storage-paths.ts"
      provides: "`validateStorageObjectKey` (single-key ownership/traversal guard) and `validateStorageDeletionPrefix` (prefix-scope guard) for storage adapter mutations"
      exports: ["validateStorageObjectKey", "validateStorageDeletionPrefix", "StoragePathValidationError"]
    - path: "tests/unit/catalog-schemas.test.ts"
      provides: "RED→GREEN tests covering all three refined schemas and their failure paths"
      contains: "describe(\"createPlantInputSchema\""
    - path: "tests/unit/catalog-storage-path-validator.test.ts"
      provides: "RED→GREEN tests covering validateStorageObjectKey and validateStorageDeletionPrefix accept + reject cases including cross-user-prefix attack"
      contains: "describe(\"validateStorageObjectKey\""
  key_links:
    - from: "src/contexts/catalog/domain/schemas.ts"
      to: "src/contexts/catalog/infrastructure/db/schema.ts"
      via: "drizzle-zod `createInsertSchema(plants).omit({...}).extend({...}).strict().superRefine(...)`"
      pattern: "createInsertSchema\\(plants\\)"
    - from: "src/contexts/catalog/domain/schemas.ts"
      to: "src/shared/images/limits.ts + src/contexts/catalog/application/upload-photo.ts"
      via: "import `MAX_UPLOAD_BYTES` and reuse `ALLOWED_MIME_TYPES` set (no constant duplication — drift forbidden)"
      pattern: "MAX_UPLOAD_BYTES"
    - from: "downstream plan 05-06"
      to: "validateStorageDeletionPrefix"
      via: "MANDATORY pre-check before any `storageAdapter.deletePrefix` call (CAT-09 plant-delete cleanup path)"
      pattern: "validateStorageDeletionPrefix\\("
    - from: "downstream plans 05-07, 05-09"
      to: "validateStorageObjectKey"
      via: "MANDATORY pre-check before any `storageAdapter.deleteObject` call (single-object deletion in use-cases and route handlers)"
      pattern: "validateStorageObjectKey\\("
---

<objective>
Ship refined Zod schemas (drizzle-zod-derived) and two storage-path ownership validators for the catalog domain. Closes the validation-stratum requirement for CAT-02 (manual create input shape) and CAT-03 (validation_failed when name OR photo missing). Hardens the deletion path against prefix-mis-scope leaks (T-05-04-01).

Purpose: Phase 4 use-cases (05-05 create-plant, 05-07 update/photo-entry use-cases, 05-08/05-09 route handlers) need a single source of truth for input validation. drizzle-zod derivation keeps schemas in lockstep with the table definitions shipped in 05-02. `validateStorageObjectKey` and `validateStorageDeletionPrefix` ship HERE so that downstream wiring plans (05-06, 05-07, 05-09) can call them without inventing their own path checks.

Output:
- `src/contexts/catalog/domain/schemas.ts` extended with three refined schemas (no consumers added in this plan — wired by 05-05/05-07/05-08/05-09).
- `src/contexts/catalog/domain/storage-paths.ts` exporting `validateStorageObjectKey(...)` and `validateStorageDeletionPrefix(...)`.
- Two new Vitest unit tests (`catalog-schemas.test.ts`, `catalog-storage-path-validator.test.ts`) green under `pnpm test:unit`.
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
@CLAUDE.md

# Existing artifacts this plan extends or imports
@src/contexts/catalog/domain/schemas.ts
@src/contexts/catalog/infrastructure/db/schema.ts
@src/contexts/catalog/infrastructure/photo-storage.ts
@src/shared/images/limits.ts
@src/shared/images/server-validate.ts
@src/contexts/catalog/application/upload-photo.ts
@src/shared/config/errors.ts

<interfaces>
<!-- Contracts pulled from the codebase. Use these directly — no exploration. -->

From `src/contexts/catalog/infrastructure/db/schema.ts` (existing, Phase 2):
```ts
export const plants = pgTable("plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  speciesId: uuid("species_id").references(() => species.id, { onDelete: "set null" }),
  name: varchar("name", { length: 200 }).notNull(),
  nickname: varchar("nickname", { length: 200 }),
  location: varchar("location", { length: 200 }),
  acquisitionDate: date("acquisition_date"),
  notes: text("notes"),
  coverPhotoUrl: varchar("cover_photo_url", { length: 2048 }),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, /* indices */);

export const photoEntries = pgTable("photo_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  plantId: uuid("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  photoUrl: varchar("photo_url", { length: 2048 }).notNull(),
  thumbnailUrl: varchar("thumbnail_url", { length: 2048 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
}, /* indices */);
```

From `src/contexts/catalog/domain/schemas.ts` (existing skeleton — extend, do NOT replace):
```ts
import { createSelectSchema, createInsertSchema } from "drizzle-zod";
import { photoEntries, plants } from "@contexts/catalog/infrastructure/db/schema";

export const plantSelectSchema = createSelectSchema(plants);
export const plantInsertSchema = createInsertSchema(plants);
export type Plant = ReturnType<typeof plantSelectSchema.parse>;
export type PlantInsert = ReturnType<typeof plantInsertSchema.parse>;

export const photoEntrySelectSchema = createSelectSchema(photoEntries);
export const photoEntryInsertSchema = createInsertSchema(photoEntries);
export type PhotoEntry = ReturnType<typeof photoEntrySelectSchema.parse>;
export type PhotoEntryInsert = ReturnType<typeof photoEntryInsertSchema.parse>;
```

From `src/shared/images/limits.ts:28`:
```ts
export const MAX_UPLOAD_BYTES = 1_048_576; // 1 MiB — server enforcement matches client compression target
```

From `src/contexts/catalog/application/upload-photo.ts:46-51` (re-export the set, do NOT duplicate values):
```ts
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);
type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
```
This plan must EXPORT `ALLOWED_MIME_TYPES` and `AllowedMime` from a shared location (or expose via `src/shared/images/limits.ts`) so the schema imports a single source of truth. Recommended: move them to `src/shared/images/limits.ts` and re-export from `upload-photo.ts` to keep upload-photo.ts behavior identical.

From `src/contexts/catalog/infrastructure/photo-storage.ts:48-58` (canonical D-26 path):
```ts
// Path shape: `${userId}/${plantId}/${photoId}.${ext}`
export interface PhotoStorageKeyInput {
  userId: string;
  plantId: string;
  photoId: string;
  ext: "jpg" | "png" | "webp";
}
```

From `src/shared/config/errors.ts`:
```ts
export const ErrorCode = { /* ... */ ValidationFailed: "validation_failed" /* ... */ } as const;
```
Domain schemas DO NOT throw `ErrorCode.ValidationFailed` — they return Zod issues. Use-cases (05-05, 05-07) map `safeParse` failure to `errorResponse(ErrorCode.ValidationFailed, ...)`.
</interfaces>

<binding_decisions>
<!-- Decisions from 05-CONTEXT.md that constrain this plan -->
- **D-04 (validation behavior):** Inline per-field error + summary block at ≥2 errors. The schema must report BOTH `name` and `photo` paths when both are missing — this drives the summary-block rendering in 05-17. A schema that only reports the first failure is INSUFFICIENT.
- **D-05 (PATCH single-field):** Client always sends one dirty field. Server tolerance is `≥1 known field, reject empty, reject unknown via .strict()` — NOT "exactly one". This avoids over-constraining future use-cases (e.g. cover auto-promote may write a side-effect column).
- **D-19 (Phase 2):** All catalog domain Zod schemas are drizzle-zod-derived. Refinements are added via `.omit({...server-managed columns}).extend({...non-DB inputs like `photo`}).strict().superRefine(...)` — never hand-rolled `z.object({...})`.
- **D-26 (Phase 2):** Canonical storage path is `{userId}/{plantId}/{photoId}.{ext}`. The validator enforces userId match, plantId non-empty, no traversal (`..`), no leading `/`, no `\`, ext in `{jpg,jpeg,png,webp}`.
</binding_decisions>

<source_audit>
| Source        | Item                                                              | Plan Coverage                              | Status   |
|---------------|-------------------------------------------------------------------|--------------------------------------------|----------|
| GOAL          | Catalog "Meu Jardim" — manual create + inline edit + journal      | Domain schemas underpin all three flows    | COVERED  |
| REQ           | CAT-02 (manual create: name + ≥1 photo)                           | `createPlantInputSchema` + photo-entry sch | COVERED  |
| REQ           | CAT-03 (missing name OR photo → `validation_failed`)              | `createPlantInputSchema.superRefine` cross | COVERED  |
| RESEARCH      | "Multipart parsing — Zod `.superRefine()` for cross-field"         | Task 1 implementation                      | COVERED  |
| RESEARCH      | "Common Pitfall: ad-hoc error codes" (line 602)                    | No new error codes; schemas yield issues   | COVERED  |
| RESEARCH      | "Architectural Responsibility Map: Manual plant add → API/Backend" | Schemas ship in domain layer (correct tier)| COVERED  |
| CONTEXT (D-04)| Per-field error + summary at ≥2 errors                             | superRefine reports BOTH fields when both missing | COVERED |
| CONTEXT (D-05)| PATCH single-field semantics                                       | `updatePlantInputSchema` partial + .strict | COVERED  |
| CONTEXT (D-19)| drizzle-zod-derived schemas                                        | All three schemas chain off `createInsertSchema(plants/photoEntries)` | COVERED |
| CONTEXT (D-26)| Storage path conventions                                           | `validateStorageObjectKey` + `validateStorageDeletionPrefix` enforce | COVERED  |
| THREAT        | T-05-04-01 prefix-mis-scope deletion race                          | Both helpers in Task 2                     | COVERED  |
| THREAT        | T-05-04-02 validation bypass (unknown keys, prototype pollution)   | `.strict()` on all schemas + tests         | COVERED  |
</source_audit>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: Refined Zod schemas — createPlantInputSchema + updatePlantInputSchema + createPhotoEntryInputSchema (TDD)</name>
  <files>
    src/contexts/catalog/domain/schemas.ts
    src/shared/images/limits.ts
    src/contexts/catalog/application/upload-photo.ts
    tests/unit/catalog-schemas.test.ts
  </files>
  <behavior>
    RED→GREEN cycles, ONE per refinement (3 cycles in this task — same file, similar pattern, fits TDD budget):

    Cycle 1A — `createPlantInputSchema` cross-field (name AND photo required):
    - Test 1: `safeParse({})` fails with issues containing BOTH `name` and `photo` paths (D-04 summary trigger).
    - Test 2: `safeParse({ name: "" })` fails with `name` path (empty-string rejected).
    - Test 3: `safeParse({ name: "Costela", photo: undefined })` fails with `photo` path.
    - Test 4: `safeParse({ name: "Costela", photo: validPhoto })` succeeds with optional fields absent.
    - Test 5: `safeParse({ name: "Costela", photo: validPhoto, nickname: "x", location: "sala", acquisitionDate: "2026-04-01", notes: "n" })` succeeds.
    - Test 6: `safeParse({ name: "x", photo: validPhoto, id: "uuid" })` fails (`.strict()` rejects unknown server-managed key — T-05-04-02 prototype-pollution defense).
    - Test 7: `safeParse({ name: "x", photo: validPhoto, __proto__: { admin: true } })` succeeds at parse but does NOT pollute — `.strict()` covers this; the test asserts `Object.prototype.admin` is undefined after parse.

    Cycle 1B — `updatePlantInputSchema` partial single-field:
    - Test 1: `safeParse({})` fails (must contain ≥1 known field — empty payload rejected).
    - Test 2: `safeParse({ name: "Costela" })` succeeds.
    - Test 3: `safeParse({ nickname: "Cris" })` succeeds.
    - Test 4: `safeParse({ name: "x", nickname: "y" })` succeeds (multi-field tolerated — D-05 locks client behavior, not server tolerance).
    - Test 5: `safeParse({ unknownKey: "x" })` fails via `.strict()`.
    - Test 6: `safeParse({ id: "uuid" })` fails (server-managed columns not editable — `id`, `userId`, `coverPhotoUrl`, `createdAt`, `updatedAt`, `speciesId` rejected).
    - Test 7: `safeParse({ name: "" })` fails (empty string rejected; min length 1).
    - Test 8: `safeParse({ acquisitionDate: "not-a-date" })` fails.

    Cycle 1C — `createPhotoEntryInputSchema` (file metadata + optional note):
    - Test 1: `safeParse({ contentType: "image/jpeg", byteLength: 500_000, note: null })` succeeds.
    - Test 2: `safeParse({ contentType: "image/jpeg", byteLength: 500_000 })` succeeds (note optional).
    - Test 3: `safeParse({ contentType: "image/heic", byteLength: 100 })` fails (MIME outside `ALLOWED_MIME_TYPES`).
    - Test 4: `safeParse({ contentType: "image/jpeg", byteLength: 1_048_577 })` fails (over MAX_UPLOAD_BYTES — uses imported constant, NOT a duplicated literal).
    - Test 5: `safeParse({ contentType: "image/jpeg", byteLength: 1_048_576 })` succeeds (boundary at-or-below).
    - Test 6: `safeParse({ contentType: "image/jpeg", byteLength: 100, note: "x".repeat(501) })` fails (note > 500 chars).
    - Test 7: `safeParse({ contentType: "image/jpeg", byteLength: 100, unknownKey: "x" })` fails via `.strict()`.

    Cross-cycle invariant: a grep of `schemas.ts` MUST find ZERO occurrences of the byte literal `1_048_576` or `1048576` or the strings `"image/jpeg"`, `"image/png"`, `"image/webp"` — those values are imported from `@shared/images/limits`. This prevents drift with the existing `MAX_UPLOAD_BYTES` constant and `ALLOWED_MIME_TYPES` set.
  </behavior>
  <action>
    **Setup step (NOT part of TDD cycle — pure mechanical move):**

    1. In `src/shared/images/limits.ts`, add and export `ALLOWED_MIME_TYPES` (Set) and the `AllowedMime` type:
       ```ts
       export const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);
       export type AllowedMime = "image/jpeg" | "image/png" | "image/webp";
       ```
       (NEVER remove or alter the existing `MAX_UPLOAD_BYTES` export or its comment — it ships from Phase 2.)

    2. In `src/contexts/catalog/application/upload-photo.ts:46-51`, replace the local `ALLOWED_MIME_TYPES`/`AllowedMime` declarations with `import { ALLOWED_MIME_TYPES, type AllowedMime } from "@shared/images/limits";`. Verify behavior unchanged: run `pnpm test:unit -- image-pipeline` (existing tests should remain green).

    **TDD work begins here. Drive each cycle 1A → 1B → 1C in order:**

    For each cycle:
    1. Create or extend `tests/unit/catalog-schemas.test.ts` with one `describe(...)` block per schema. Write the listed test cases — they MUST initially fail (RED).
    2. Commit RED with subject `test(05-04): add failing tests for {schemaName} refinement`.
    3. Extend `src/contexts/catalog/domain/schemas.ts` to satisfy the tests:

       ```ts
       import { z } from "zod";
       import { createInsertSchema, createSelectSchema } from "drizzle-zod";
       import { photoEntries, plants } from "@contexts/catalog/infrastructure/db/schema";
       import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type AllowedMime } from "@shared/images/limits";

       // ... existing exports preserved (plantSelectSchema, plantInsertSchema, ...) ...

       const SERVER_MANAGED_PLANT_KEYS = {
         id: true,
         userId: true,
         coverPhotoUrl: true,
         createdAt: true,
         updatedAt: true,
         speciesId: true,
       } as const;

       // Photo input — represents the client-side File metadata that arrives
       // alongside multipart bytes. Bytes are validated by the application
       // layer (rejectOversizeBuffer / rejectGpsMetadata) — domain schema
       // validates the shape and bounds.
       const photoInputSchema = z.object({
         contentType: z.string().refine(
           (v): v is AllowedMime => (ALLOWED_MIME_TYPES as Set<string>).has(v),
           { message: "unsupported content type" },
         ),
         byteLength: z.number().int().positive().max(MAX_UPLOAD_BYTES),
       });

       export const createPlantInputSchema = plantInsertSchema
         .omit(SERVER_MANAGED_PLANT_KEYS)
         .extend({
           name: z.string().min(1).max(200),
           nickname: z.string().min(1).max(200).optional(),
           location: z.string().min(1).max(200).optional(),
           acquisitionDate: z.string().date().optional(),
           notes: z.string().optional(),
           photo: photoInputSchema,
         })
         .strict()
         .superRefine((value, ctx) => {
           if (!value.name || value.name.trim().length === 0) {
             ctx.addIssue({ code: "custom", path: ["name"], message: "name required" });
           }
           if (!value.photo) {
             ctx.addIssue({ code: "custom", path: ["photo"], message: "photo required" });
           }
         });

       export type CreatePlantInput = z.infer<typeof createPlantInputSchema>;

       // PATCH input — partial of editable fields, ≥1 known field required.
       export const updatePlantInputSchema = plantInsertSchema
         .omit(SERVER_MANAGED_PLANT_KEYS)
         .partial()
         .extend({
           name: z.string().min(1).max(200).optional(),
           nickname: z.string().min(1).max(200).nullable().optional(),
           location: z.string().min(1).max(200).nullable().optional(),
           acquisitionDate: z.string().date().nullable().optional(),
           notes: z.string().nullable().optional(),
         })
         .strict()
         .refine(
           (v) => Object.keys(v).length > 0,
           { message: "at least one editable field required" },
         );

       export type UpdatePlantInput = z.infer<typeof updatePlantInputSchema>;

       export const createPhotoEntryInputSchema = z
         .object({
           contentType: z.string().refine(
             (v): v is AllowedMime => (ALLOWED_MIME_TYPES as Set<string>).has(v),
             { message: "unsupported content type" },
           ),
           byteLength: z.number().int().positive().max(MAX_UPLOAD_BYTES),
           note: z.string().max(500).nullable().optional(),
         })
         .strict();

       export type CreatePhotoEntryInput = z.infer<typeof createPhotoEntryInputSchema>;
       ```

       Notes:
       - The exact `.partial()` chain may differ in TS-typing edge cases — adjust to keep tests green. The contract is what the test enforces; the syntax is your discretion within drizzle-zod + Zod 4 idioms.
       - DO NOT introduce `z.object({...})` from scratch for `createPlantInputSchema` or `updatePlantInputSchema` — D-19 mandates drizzle-zod chain.
       - `.strict()` is REQUIRED on all three schemas (T-05-04-02 unknown-key rejection).

    4. Run tests until GREEN.
    5. REFACTOR if needed (extract `photoInputSchema` if reused; collapse duplicate refinements). Tests must stay GREEN.
    6. Commit GREEN with subject `feat(05-04): refined Zod schemas (createPlant/updatePlant/createPhotoEntry)`.

    **Anti-pattern guard (post-implementation):** Run grep on the final file:
    ```
    grep -v '^\s*\*\|^\s*//' src/contexts/catalog/domain/schemas.ts | grep -c '1_048_576\|1048576\|"image/jpeg"\|"image/png"\|"image/webp"'
    ```
    Result MUST be `0`. If non-zero, you've duplicated a constant — refactor to import.
  </action>
  <verify>
    <automated>pnpm test:unit -- catalog-schemas</automated>
    <automated>pnpm test:unit -- image-pipeline</automated>
    <automated>node -e "const s=require('fs').readFileSync('src/contexts/catalog/domain/schemas.ts','utf8').split('\n').filter(l=>!/^\s*(\*|\/\/)/.test(l)).join('\n'); const m=s.match(/1_048_576|1048576|\"image\\/(jpeg|png|webp)\"/g); if(m){console.error('Forbidden duplication:',m); process.exit(1);} console.log('ok');"</automated>
  </verify>
  <done>
    All Cycle 1A/1B/1C test cases listed in `<behavior>` pass under `pnpm test:unit -- catalog-schemas`. Existing `image-pipeline` tests remain green. Grep guard returns zero forbidden literal duplications. Schemas are exported from `src/contexts/catalog/domain/schemas.ts` with the names listed in `must_haves.artifacts.exports`.
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: validateStorageObjectKey + validateStorageDeletionPrefix helpers (TDD)</name>
  <files>
    src/contexts/catalog/domain/storage-paths.ts
    tests/unit/catalog-storage-path-validator.test.ts
  </files>
  <behavior>
    Two helpers, each with its own RED→GREEN cycle.

    --- Cycle 2A: `validateStorageObjectKey` ---

    Function signature:
    ```ts
    function validateStorageObjectKey(input: { userId: string; plantId: string; key: string }): void
    // throws StoragePathValidationError on any mismatch
    ```

    Regex enforced: `^${userId}/${plantId}/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$`

    Accept cases (must NOT throw):
    - Test 1: `validateStorageObjectKey({ userId: "u1", plantId: "p1", key: "u1/p1/photo-id.jpg" })` — returns void.
    - Test 2: same shape with ext `png` — returns void.
    - Test 3: same shape with ext `webp` — returns void.
    - Test 4: same shape with ext `jpeg` — returns void.
    - Test 5: photoId is a UUID with hyphens — `key: "u1/p1/2f3a-9b4c.jpg"` — returns void.

    Reject cases (must throw `StoragePathValidationError`):
    - Test 6: mismatched userId — `key: "u2/p1/photo.jpg"` with `userId: "u1"` — throws.
    - Test 7: mismatched plantId — `key: "u1/p2/photo.jpg"` with `plantId: "p1"` — throws.
    - Test 8: empty userId — `userId: ""` — throws.
    - Test 9: empty plantId — `plantId: ""` — throws.
    - Test 10: traversal `..` segment — `key: "u1/../p1/x.jpg"` — throws.
    - Test 11: trailing traversal — `key: "u1/p1/../x.jpg"` — throws.
    - Test 12: leading slash — `key: "/u1/p1/x.jpg"` — throws.
    - Test 13: backslash — `key: "u1\\p1\\x.jpg"` — throws.
    - Test 14: extension outside allow-list — `key: "u1/p1/x.heic"` — throws.
    - Test 15: missing extension — `key: "u1/p1/x"` — throws.
    - Test 16: extra path segments — `key: "u1/p1/sub/x.jpg"` — throws (regex has no `sub/` component).
    - Test 17: too few segments — `key: "u1/x.jpg"` — throws.

    --- Cycle 2B: `validateStorageDeletionPrefix` ---

    Function signature:
    ```ts
    function validateStorageDeletionPrefix(input: { userId: string; plantId: string; prefix: string }): void
    // throws StoragePathValidationError on any mismatch
    ```

    Rule enforced: `prefix === \`${userId}/${plantId}/\``

    Accept cases (must NOT throw):
    - Test 1: `validateStorageDeletionPrefix({ userId: "u1", plantId: "p1", prefix: "u1/p1/" })` — returns void.
    - Test 2: different valid userId/plantId pair — `{ userId: "abc", plantId: "def", prefix: "abc/def/" }` — returns void.

    Reject cases (must throw `StoragePathValidationError`):
    - Test 3: cross-user-prefix attack — `{ userId: "u1", plantId: "p1", prefix: "u2/p1/" }` — throws (prefix begins with a different userId).
    - Test 4: missing trailing slash — `{ userId: "u1", plantId: "p1", prefix: "u1/p1" }` — throws.
    - Test 5: extra path after prefix — `{ userId: "u1", plantId: "p1", prefix: "u1/p1/photo.jpg" }` — throws (not a bare prefix).
    - Test 6: empty userId — `{ userId: "", plantId: "p1", prefix: "u1/p1/" }` — throws.
    - Test 7: empty plantId — `{ userId: "u1", plantId: "", prefix: "u1//"}` — throws.
    - Test 8: mismatched plantId — `{ userId: "u1", plantId: "p1", prefix: "u1/p2/" }` — throws.
  </behavior>
  <action>
    1. Create `tests/unit/catalog-storage-path-validator.test.ts` with:
       - `describe("validateStorageObjectKey", ...)` containing Tests 1–17 (Cycle 2A).
       - `describe("validateStorageDeletionPrefix", ...)` containing Tests 1–8 (Cycle 2B).
       All test cases MUST initially fail (RED).

    2. Commit RED with subject `test(05-04): add failing tests for validateStorageObjectKey and validateStorageDeletionPrefix`.

    3. Create `src/contexts/catalog/domain/storage-paths.ts`:

       ```ts
       /**
        * Storage-path ownership validators (D-26 canonical path:
        * `{userId}/{plantId}/{photoId}.{ext}`). Defends against
        * prefix-mis-scope deletion races (T-05-04-01).
        * Pure functions, no I/O.
        *
        * - validateStorageObjectKey: use before deleteObject (single file).
        * - validateStorageDeletionPrefix: use before deletePrefix (plant cleanup).
        *
        * Downstream consumers (05-06 delete-plant, 05-07 delete-photo-entry,
        * 05-09 route handlers) MUST call the appropriate helper BEFORE any
        * `storageAdapter.deleteObject(...)` or `deletePrefix(...)`.
        */

       export class StoragePathValidationError extends Error {
         constructor(message: string) {
           super(`storage path validation failed: ${message}`);
           this.name = "StoragePathValidationError";
         }
       }

       /**
        * Validates a full storage object key for single-file operations.
        * Asserts key matches `^{userId}/{plantId}/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$`.
        * Throws `StoragePathValidationError` on any mismatch.
        */
       export function validateStorageObjectKey({
         userId,
         plantId,
         key,
       }: {
         userId: string;
         plantId: string;
         key: string;
       }): void {
         if (!userId) throw new StoragePathValidationError("userId empty");
         if (!plantId) throw new StoragePathValidationError("plantId empty");
         // Build pattern dynamically so mismatched userId/plantId prefix is caught
         // before checking the filename segment. Escape special regex chars in ids.
         const escapedUserId = userId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
         const escapedPlantId = plantId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
         const pattern = new RegExp(
           `^${escapedUserId}/${escapedPlantId}/[a-zA-Z0-9-]+\\.(jpg|jpeg|png|webp)$`,
         );
         if (!pattern.test(key)) {
           throw new StoragePathValidationError(
             `key "${key}" does not match expected pattern for userId="${userId}" plantId="${plantId}"`,
           );
         }
       }

       /**
        * Validates a prefix path used for bulk storage deletion (e.g. plant cleanup).
        * Asserts prefix === `${userId}/${plantId}/` exactly.
        * Throws `StoragePathValidationError` on any mismatch, including cross-user-prefix attacks.
        */
       export function validateStorageDeletionPrefix({
         userId,
         plantId,
         prefix,
       }: {
         userId: string;
         plantId: string;
         prefix: string;
       }): void {
         if (!userId) throw new StoragePathValidationError("userId empty");
         if (!plantId) throw new StoragePathValidationError("plantId empty");
         const expected = `${userId}/${plantId}/`;
         if (prefix !== expected) {
           throw new StoragePathValidationError(
             `prefix "${prefix}" does not match expected "${expected}"`,
           );
         }
       }
       ```

       Adjust only as needed to keep ALL test cases in both describe blocks green. Keep implementation auditable — security code should be straightforward. Do NOT add side effects, I/O, or imports from `infrastructure/`, `application/`, `db/`, or `adapters/`.

    4. Run `pnpm test:unit -- catalog-storage-path-validator` until ALL tests green.

    5. REFACTOR only if there is genuine duplication to remove; keep tests GREEN.

    6. Commit GREEN with subject `feat(05-04): validateStorageObjectKey and validateStorageDeletionPrefix domain helpers`.

    **Note for downstream plans (key_links):** Both helpers ship unused in this plan.
    - 05-06 (delete-plant cleanup) MUST call `validateStorageDeletionPrefix` before `deletePrefix`.
    - 05-07 (delete-photo-entry, create-photo-entry) MUST call `validateStorageObjectKey` before `deleteObject`.
    - 05-09 (DELETE route handlers) MUST call `validateStorageObjectKey` before any storage mutation.
    Failure to add call sites reopens T-05-04-01.
  </action>
  <verify>
    <automated>pnpm test:unit -- catalog-storage-path-validator</automated>
  </verify>
  <done>
    All Cycle 2A (17 cases) and Cycle 2B (8 cases) tests pass. `src/contexts/catalog/domain/storage-paths.ts` exports `validateStorageObjectKey`, `validateStorageDeletionPrefix`, and `StoragePathValidationError`. Both helpers have zero side effects (no imports from `infrastructure/`, `application/`, `db/`, `adapters/`). The cross-user-prefix attack test (Cycle 2B Test 3) is green.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary                 | Description                                                                                       |
|--------------------------|---------------------------------------------------------------------------------------------------|
| client → API             | Untrusted multipart input (name, photo, optional fields) parsed by `createPlantInputSchema` in 05-08. |
| application → storage    | `validateStorageObjectKey` and `validateStorageDeletionPrefix` are the gates before any `deleteObject`/`deletePrefix` against the bucket. |
| API JSON body → application | PATCH single-field body parsed by `updatePlantInputSchema`; rejects unknown keys via `.strict()`. |

## STRIDE Threat Register

| Threat ID    | Category | Component                                                          | Disposition | Mitigation Plan                                                                                                                                                                  |
|--------------|----------|--------------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-05-04-01   | E, I     | `delete-plant.ts` (05-06) / `delete-photo-entry.ts` (05-07) / DELETE route handlers (05-09) | mitigate    | Ship `validateStorageObjectKey` (single-object guard) and `validateStorageDeletionPrefix` (prefix guard) here (Task 2), each with dedicated unit tests. **Block-on-high:** downstream wiring plans (05-06, 05-07, 05-09) MUST call the appropriate helper before any storage mutation; integration tests in those plans assert cross-user keys raise `StoragePathValidationError`. This plan ships the unit-tested helpers; the cross-user integration test belongs to the wiring plans because no use-case wiring exists yet here. |
| T-05-04-02   | T        | `createPlantInputSchema`, `updatePlantInputSchema`, `createPhotoEntryInputSchema` parse paths | mitigate    | All three schemas terminate the chain with `.strict()` (Zod rejects unknown keys). Test cases in Task 1 (Cycle 1A test 6, Cycle 1B test 5, Cycle 1C test 7) cover prototype-pollution attempt patterns. `Object.prototype.admin` assertion ensures parsed object does not pollute prototype.                                                                                                                  |
| T-05-04-03   | I        | `createPhotoEntryInputSchema` byte-length bound                    | mitigate    | `byteLength` capped at `MAX_UPLOAD_BYTES` (1 MiB) imported from `@shared/images/limits` — single source of truth, no drift risk. Server-side `rejectOversizeBuffer` (Phase 2) provides defense in depth against header lying about byteLength; that check stays in 05-07's create-photo-entry use-case (out of scope here).                                                                                  |
| T-05-04-04   | S        | drizzle-zod chain — server-managed columns leaking into write path  | accept      | `SERVER_MANAGED_PLANT_KEYS` omits `id, userId, coverPhotoUrl, createdAt, updatedAt, speciesId`. Even if a future column is added, drizzle-zod will surface it via type errors when use-cases compile. Accept residual: a developer adding a new server-managed column without updating the omit set is caught at TS compile (e.g. `userId` in `CreatePlantInput` would be a type-level red flag).                                       |

`block_on_high: true`. T-05-04-01 and T-05-04-02 are mitigated within this plan; downstream wiring of T-05-04-01 is tracked as a key_link reminder for 05-06/05-07/05-09.
</threat_model>

<verification>
- `pnpm test:unit -- catalog-schemas` → green (all Cycle 1A/1B/1C cases).
- `pnpm test:unit -- catalog-storage-path-validator` → green (all Cycle 2A + 2B cases, including cross-user-prefix attack test).
- `pnpm test:unit -- image-pipeline` → green (regression check after moving `ALLOWED_MIME_TYPES` to limits.ts).
- `pnpm test:unit` (full unit suite) → green (no collateral breakage in adjacent suites).
- Grep guard: schemas.ts contains zero literal duplications of MIME strings or the byte-size constant.
- TypeScript: `pnpm tsc --noEmit` → green.
</verification>

<success_criteria>
- `src/contexts/catalog/domain/schemas.ts` exports `createPlantInputSchema`, `updatePlantInputSchema`, `createPhotoEntryInputSchema` and their inferred types, all drizzle-zod-derived.
- `src/contexts/catalog/domain/storage-paths.ts` exports `validateStorageObjectKey`, `validateStorageDeletionPrefix`, and `StoragePathValidationError`.
- All listed test cases in Task 1 and Task 2 are green under `pnpm test:unit`.
- No new constants for MIME or upload size — both imported from `@shared/images/limits`.
- All schemas use `.strict()` (T-05-04-02 unknown-key rejection).
- No infrastructure / application / Drizzle imports in domain files (`schemas.ts`, `storage-paths.ts`) — domain stays pure (D-19 + clean architecture).
- `requireVerifiedUser`, route handlers, use-cases — all UNTOUCHED in this plan (those are 05-05/05-07/05-08/05-09 scope).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-SUMMARY.md` covering:
- New artifacts: schemas.ts extended (3 schemas + types), storage-paths.ts created.
- Constants moved: `ALLOWED_MIME_TYPES` and `AllowedMime` migrated from upload-photo.ts to `@shared/images/limits` (re-exported in upload-photo.ts).
- TDD cycles: 4 RED commits, 4 GREEN commits (or grouped per task — author's call within Conventional Commit discipline).
- Unblocks: 05-05 (create-plant), 05-07 (update-plant + create/delete-photo-entry), 05-08 / 05-09 (route handler validation).
- key_link reminder: 05-06 MUST call `validateStorageDeletionPrefix` before any `storageAdapter.deletePrefix` mutation. 05-07 and 05-09 MUST call `validateStorageObjectKey` before any `storageAdapter.deleteObject` mutation. Document this in the SUMMARY's "Open follow-ups" section so the executor of those plans cannot miss it.
- VALIDATION.md Per-Task Verification Map row for Task 1 and Task 2 should be filled (or the SUMMARY should note that the planner needs to update it after this plan ships).
</output>
