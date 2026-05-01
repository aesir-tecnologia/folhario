---
phase: 05-catalog-meu-jardim
plan: "04"
subsystem: catalog-domain
tags: ["catalog", "zod", "drizzle-zod", "validation", "storage-paths", "tdd"]
dependency_graph:
  requires: ["05-02"]
  provides: ["createPlantInputSchema", "updatePlantInputSchema", "createPhotoEntryInputSchema", "validateStorageObjectKey", "validateStorageDeletionPrefix", "StoragePathValidationError"]
  affects: ["05-05", "05-06", "05-07", "05-08", "05-09"]
tech_stack:
  added: []
  patterns: ["drizzle-zod derived schemas", "strict() unknown-key rejection", "superRefine cross-field validation", "regex-anchored path ownership guard"]
key_files:
  created:
    - src/contexts/catalog/domain/storage-paths.ts
    - tests/unit/catalog-schemas.test.ts
    - tests/unit/catalog-storage-path-validator.test.ts
  modified:
    - src/contexts/catalog/domain/schemas.ts
    - src/shared/images/limits.ts
    - src/contexts/catalog/application/upload-photo.ts
decisions:
  - "drizzle-zod chain (plantInsertSchema.omit.extend.strict) enforced per D-19 — no hand-rolled z.object for createPlant/updatePlant"
  - "ALLOWED_MIME_TYPES and AllowedMime moved to @shared/images/limits as single source of truth — re-used by schemas and upload-photo"
  - "updatePlantInputSchema uses .refine(keys > 0) not superRefine — simpler, correct, avoids spurious type widening"
  - "storage-paths.ts has zero imports from infrastructure/application/db/adapters — domain layer stays pure"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-01T16:20:51Z"
  tasks_completed: 2
  files_changed: 6
---

# Phase 05 Plan 04: Domain Zod Schemas Summary

drizzle-zod-derived input schemas for catalog domain plus regex-anchored storage-path ownership validators, TDD RED/GREEN across 4 cycles, closes CAT-02/CAT-03 validation contracts and mitigates T-05-04-01/T-05-04-02.

## What Was Built

### New Artifacts

**`src/contexts/catalog/domain/schemas.ts`** — Extended with three refined schemas:

- `createPlantInputSchema`: `plantInsertSchema.omit(serverKeys).extend({ photo: photoInputSchema }).strict().superRefine(...)` — reports BOTH `name` and `photo` paths when both are missing (D-04 summary-block trigger). Unknown keys rejected via `.strict()` (T-05-04-02).
- `updatePlantInputSchema`: `plantInsertSchema.omit(serverKeys).partial().extend({editableFields}).strict().refine(keys > 0)` — tolerates multi-field PATCH (D-05), rejects empty payload, rejects server-managed and unknown keys.
- `createPhotoEntryInputSchema`: `z.object({ contentType, byteLength, note }).strict()` — MIME validated against `ALLOWED_MIME_TYPES`, byteLength bounded by `MAX_UPLOAD_BYTES` (both imported, no literals in the file).
- Exported types: `CreatePlantInput`, `UpdatePlantInput`, `CreatePhotoEntryInput`.

**`src/contexts/catalog/domain/storage-paths.ts`** — New file, pure functions only:

- `StoragePathValidationError`: custom error class for path ownership failures.
- `validateStorageObjectKey({ userId, plantId, key })`: dynamically constructs regex `^{userId}/{plantId}/[a-zA-Z0-9-]+\.(jpg|jpeg|png|webp)$`; throws on mis-scope, traversal, backslash, leading slash, wrong extension, wrong segment count.
- `validateStorageDeletionPrefix({ userId, plantId, prefix })`: asserts `prefix === \`${userId}/${plantId}/\`` exactly; throws on cross-user-prefix attack and any partial-match variant.

### Constants Migrated

`ALLOWED_MIME_TYPES` (Set) and `AllowedMime` (type) moved from `upload-photo.ts` (local) to `src/shared/images/limits.ts` (exported). `upload-photo.ts` now imports from `@shared/images/limits`. Behavior unchanged — image-pipeline tests (11/11) confirm no regression.

### Tests Created

- `tests/unit/catalog-schemas.test.ts`: 22 cases across 3 describe blocks covering Cycles 1A (7), 1B (8), 1C (7).
- `tests/unit/catalog-storage-path-validator.test.ts`: 25 cases across 2 describe blocks covering Cycles 2A (17 cases) and 2B (8 cases), including the T-05-04-01 cross-user-prefix attack case.

## TDD Cycles

| Cycle | Describe | RED Commit | GREEN Commit | Tests |
|-------|----------|-----------|--------------|-------|
| Setup | n/a (refactor) | n/a | fc57422 | image-pipeline 11/11 |
| 1A+1B+1C | createPlant / updatePlant / createPhotoEntry | 430bd14 | 7821271 | 22/22 |
| 2A+2B | validateStorageObjectKey / validateStorageDeletionPrefix | 8693ef4 | 4b3b7dc | 25/25 |

## Commits

| Hash | Type | Description |
|------|------|-------------|
| fc57422 | refactor | move ALLOWED_MIME_TYPES and AllowedMime to shared/images/limits |
| 430bd14 | test (RED) | add failing tests for all three schema refinements |
| 7821271 | feat (GREEN) | refined Zod schemas (createPlant/updatePlant/createPhotoEntry) |
| 8693ef4 | test (RED) | add failing tests for validateStorageObjectKey and validateStorageDeletionPrefix |
| 4b3b7dc | feat (GREEN) | validateStorageObjectKey and validateStorageDeletionPrefix domain helpers |

## Verification Results

- `pnpm exec vitest run --project=unit catalog-schemas`: 22/22 passed
- `pnpm exec vitest run --project=unit catalog-storage-path-validator`: 25/25 passed
- `pnpm exec vitest run --project=unit image-pipeline`: 11/11 passed
- `pnpm exec vitest run --project=unit` (full node suite): 619/619 passed across 35 test files
- `npx tsc --noEmit`: no errors
- Anti-pattern grep guard (no MIME literals or byte-size constants in schemas.ts): ok

Note: `unit-dom` project has a pre-existing worker crash unrelated to this plan's changes (confirmed by testing against base commit 13fdbcc — same crash).

## Deviations from Plan

None — plan executed exactly as written. The advisor noted that superRefine may produce duplicate issues on empty input (since basic object validation fires before superRefine), but the tests pass because both paths are present in the issues array regardless. This is expected Zod behavior.

## Threat Mitigations Delivered

| Threat | Status |
|--------|--------|
| T-05-04-01 prefix-mis-scope deletion race | Mitigated — both helpers ship with 25 unit tests including cross-user-prefix attack |
| T-05-04-02 unknown-key/prototype-pollution | Mitigated — `.strict()` on all three schemas, 3 test cases cover unknown keys, 1 covers prototype non-pollution |
| T-05-04-03 byte-length bound | Mitigated — byteLength capped via MAX_UPLOAD_BYTES import, boundary tests at 1_048_576 and 1_048_577 |

## Plans Unblocked

- **05-05** (create-plant use-case): can import `createPlantInputSchema` and `CreatePlantInput`
- **05-07** (update-plant + photo-entry use-cases): can import `updatePlantInputSchema`, `createPhotoEntryInputSchema`, `validateStorageObjectKey`
- **05-08** (read/create route handlers): can import all three schemas for request validation
- **05-09** (mutate/delete route handlers): can import schemas + `validateStorageObjectKey`

## Open Follow-ups (Key-Link Reminders for Downstream Plans)

**MANDATORY — reopens T-05-04-01 if not done:**

- **05-06 (delete-plant cleanup)**: MUST call `validateStorageDeletionPrefix({ userId, plantId, prefix })` before any `storageAdapter.deletePrefix(...)` call. The helper is now available at `@contexts/catalog/domain/storage-paths`.
- **05-07 (delete-photo-entry / create-photo-entry)**: MUST call `validateStorageObjectKey({ userId, plantId, key })` before any `storageAdapter.deleteObject(...)` call.
- **05-09 (DELETE route handlers)**: MUST call `validateStorageObjectKey({ userId, plantId, key })` before any storage mutation in route-handler delete flows.

Executors of those plans: import from `@contexts/catalog/domain/storage-paths` and add integration tests asserting cross-user keys raise `StoragePathValidationError`.

## Known Stubs

None — this plan ships pure domain functions with no UI or data-source wiring.

## Self-Check: PASSED
