---
phase: 05-catalog-meu-jardim
plan: 05
type: tdd
wave: 2
depends_on: [05-03, 05-04]
files_modified:
  - src/contexts/catalog/application/create-plant.ts
  - tests/integration/create-plant.integration.test.ts
  - tests/unit/create-plant.unit.test.ts
autonomous: true
requirements: [CAT-01, CAT-02, CAT-03]
must_haves:
  truths:
    - "Manual create: name + photo + userId atomically produces one Plant row + one PhotoEntry row in a single DB transaction."
    - "Cover photo URL on the Plant row at create-time equals the bucket-prefixed key of the first PhotoEntry (ordering rule below)."
    - "PostHog `plant_added` is captured ONLY after the UoW transaction commits, with privacy-clean properties per D-28: `{source, has_nickname, has_location, has_acquisition_date, has_notes, photo_count}`."
    - "Inngest `plant.created` event is emitted ONLY after the UoW transaction commits."
    - "On UoW rollback (DB insert failure after storage upload succeeded), the original photo bytes AND thumbnail bytes are best-effort deleted via `deleteSinglePlantPhotoBestEffort`, mirroring `upload-photo.ts:217-225`."
    - "On UoW rollback, NEITHER PostHog NOR Inngest fires (the post-commit block is skipped because the `await withUnitOfWork(...)` rejects before the block runs)."
    - "Validation failures (missing name, missing photo, oversized buffer, GPS-bearing buffer, unsupported MIME) return discriminated-union `{ok: false, code: ErrorCode.ValidationFailed, reason}` BEFORE any storage write."
    - "`source: 'identification'` branch type-checks and accepts `species_id` + optional name pre-fill; this branch is shipped here but Phase 5 only exercises `source: 'manual'` (CAT-01 contributor; Phase 6 closes)."
    - "`userId` only ever flows from the caller (route handler will use `requireVerifiedUser` in 05-08); the use-case never reads userId from request input shapes."
  artifacts:
    - path: "src/contexts/catalog/application/create-plant.ts"
      provides: "createPlant use-case with discriminated input + compensating-delete on UoW failure + post-commit telemetry"
      exports: ["createPlant", "CreatePlantInput", "CreatePlantResult"]
      min_lines: 150
    - path: "tests/integration/create-plant.integration.test.ts"
      provides: "Integration suite proving Plant create (Integration stratum from VALIDATION.md)"
      contains: "describe.skipIf(!dbUrl)"
    - path: "tests/unit/create-plant.unit.test.ts"
      provides: "Unit-level discrimination + validation + telemetry-prop shape tests"
      contains: "describe"
  key_links:
    - from: "src/contexts/catalog/application/create-plant.ts"
      to: "@shared/db/unit-of-work#withUnitOfWork"
      via: "UoW TX wrapping plants.create + photoEntries.create"
      pattern: "withUnitOfWork\\(input\\.userId"
    - from: "src/contexts/catalog/application/create-plant.ts"
      to: "@contexts/catalog/infrastructure/photo-storage#uploadOriginalPlantPhoto"
      via: "Pre-UoW storage upload"
      pattern: "uploadOriginalPlantPhoto"
    - from: "src/contexts/catalog/application/create-plant.ts"
      to: "@contexts/catalog/infrastructure/photo-storage#deleteSinglePlantPhotoBestEffort"
      via: "Compensating-delete in catch on UoW rollback"
      pattern: "deleteSinglePlantPhotoBestEffort"
    - from: "src/contexts/catalog/application/create-plant.ts"
      to: "@shared/telemetry/posthog-server#getPostHog"
      via: "Post-commit `plant_added` capture"
      pattern: "getPostHog"
    - from: "src/contexts/catalog/application/create-plant.ts"
      to: "@shared/inngest/client#inngest"
      via: "Post-commit `plant.created` event emit"
      pattern: "inngest\\.send"
    - from: "src/contexts/catalog/application/create-plant.ts"
      to: "@contexts/catalog/domain/schemas#createPlantInputSchema"
      via: "Zod parse before any side effect"
      pattern: "createPlantInputSchema"
---

<objective>
Ship the catalog `createPlant` use-case (D-02 + D-28 + CAT-01 contributor) at `src/contexts/catalog/application/create-plant.ts`. This is the application-layer entry point that the Phase 5 manual-add multipart route (05-08) and the Phase 6 from-identification flow will both invoke.

Purpose: Establish the TX-atomic Plant + first-PhotoEntry create with compensating-delete on storage-vs-DB split-brain (per `upload-photo.ts:200-225`), and the post-commit telemetry contract (PostHog `plant_added` + Inngest `plant.created`) — strictly post-commit so a rolled-back insert NEVER leaks an analytics event (T-05-05-01).

Output: Working `createPlant` use-case with full unit + integration test coverage, validating both `source: 'manual'` (Phase 5 invocation) and `source: 'identification'` discrimination (Phase 6 invocation; type-checked and unit-covered here, end-to-end exercised in Phase 6).

**NOT in scope for this plan (deferred to other plans):**
- HTTP multipart parsing → `POST /api/v1/plants` route handler in **05-08**
- `withIdempotency` wiring → **05-08**
- `requireVerifiedUser` auth gate → **05-08**
- The `source: 'identification'` end-to-end path with a real `Identification` row → **Phase 6** (this plan ships the input-shape branch only)
- Care card / reminders / ID history surfaces → Phases 7/8/6 respectively
- DELETE/PATCH use-cases → 05-06 (delete) / 05-07 (update + others)
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
@CLAUDE.md

@src/contexts/catalog/application/upload-photo.ts
@src/shared/db/unit-of-work.ts
@src/shared/config/errors.ts
@src/shared/telemetry/posthog-server.ts
@src/shared/inngest/client.ts
@src/contexts/iam/application/signup.ts

<interfaces>
<!-- Contracts the executor needs. Extracted from the codebase so no exploration is required. -->

From `src/contexts/catalog/application/upload-photo.ts` (the analog for compensating-delete + UoW pattern at lines 200-225):
```typescript
// Discriminated-union result shape — copy this for createPlant
export type UploadPhotoResult =
  | { ok: true; photoEntry: PhotoEntryRow }
  | {
      ok: false;
      code:
        | typeof ErrorCode.ValidationFailed
        | typeof ErrorCode.NotFound
        | typeof ErrorCode.Unauthenticated;
      reason: string;
    };

// MIME validation pattern — reuse identical helpers
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"] as const);
type AllowedMime = "image/jpeg" | "image/png" | "image/webp";

// Pre-UoW pattern (storage uploads BEFORE the TX so we can compensate):
// 1. validate MIME, 2. rejectOversizeBuffer, 3. rejectGpsMetadata,
// 4. (skip ownership check — Plant doesn't exist yet),
// 5. sharp thumbnail, 6. uploadOriginalPlantPhoto + uploadPlantThumbnail,
// 7. withUnitOfWork(...) inserting rows.
//
// On UoW catch:
//   await deleteSinglePlantPhotoBestEffort({ userId, plantId, photoId, originalExt });
//   throw err;  // rethrow so caller sees the failure
```

From `src/shared/db/unit-of-work.ts:88-103`:
```typescript
export async function withUnitOfWork<T>(
  userId: string,
  fn: (tx: TransactionalDb) => Promise<T>,
): Promise<T>
// Sets `set local role authenticated` + `request.jwt.claim.sub = userId` GUC.
// userId MUST be a UUID — UnitOfWorkError(code='validation_failed') otherwise.
// COMMIT happens when the returned promise RESOLVES; ROLLBACK on rejection.
// There is NO `tx.afterCommit` hook — post-commit work runs AFTER `await withUnitOfWork(...)` resolves.
```

From `src/shared/config/errors.ts`:
```typescript
export const ErrorCode = {
  Unauthenticated: "unauthenticated",
  ValidationFailed: "validation_failed",
  NotFound: "not_found",
  Forbidden: "forbidden",
  // ...other codes; createPlant returns only ValidationFailed / Unauthenticated
} as const;
```

From `src/shared/telemetry/posthog-server.ts`:
```typescript
export function getPostHog(): PostHog | null;       // null when key absent (CI/dev)
export async function shutdownPostHog(): Promise<void>;
```

From `src/contexts/iam/infrastructure/posthog-bridge.ts` — established capture pattern:
```typescript
async function capture(userId: string, event: string, properties: Record<string, unknown> = {}) {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
  await ph.shutdown();
}
```

From `src/shared/inngest/client.ts`:
```typescript
export const inngest = new Inngest({ id: "folhario", eventKey: ..., signingKey: ... });
// Established usage from src/contexts/iam/application/signup.ts:150-165:
//   try {
//     await inngest.send({
//       id: `email-verification/${tokenId}`,        // optional dedup id
//       name: "notifications/email.requested",
//       data: { /* payload */ },
//     });
//   } catch (err) { Sentry.captureException(err, { tags: { surface: "..." }, extra: {...} }); }
```

From `src/contexts/catalog/infrastructure/photo-storage.ts` (key exports):
```typescript
export const PLANT_PHOTOS_BUCKET: string;
export const PLANT_THUMBNAILS_BUCKET: string;
export function buildPlantPhotoObjectKey(args: { userId, plantId, photoId, ext }): string;
export function buildPlantThumbnailObjectKey(args: { userId, plantId, photoId, ext }): string;
export function uploadOriginalPlantPhoto(args: { userId, plantId, photoId, ext, buffer, contentType }): Promise<void>;
export function uploadPlantThumbnail(args: { userId, plantId, photoId, ext, buffer, contentType }): Promise<void>;
export function deleteSinglePlantPhotoBestEffort(args: { userId, plantId, photoId, originalExt }): Promise<void>;
export function __setStorageAdapterForTests(adapter: StorageAdapter | null): void;
```

From plan 05-04 (must be merged before this plan starts) — `src/contexts/catalog/domain/schemas.ts`:
```typescript
// 05-04 ships this schema. createPlant calls `.safeParse(input)` for validation_failed mapping.
export const createPlantInputSchema: z.ZodType<{
  source: 'manual' | 'identification';
  userId: string;            // UUID
  name: string;              // required, trimmed, 1..120
  photo: { buffer: Buffer; contentType: string };  // required (D-04 — name AND photo required)
  nickname?: string | null;
  location?: string | null;
  acquisitionDate?: string | null;  // ISO date or null
  notes?: string | null;
  speciesId?: string | null;        // 'identification' branch only — null for 'manual'
}>;
```

From `src/contexts/catalog/infrastructure/db/plants.ts` + `photo-entries.ts` (after 05-03 ships):
```typescript
// Plants repo (extended in 05-03):
export async function create(db: PlantsDb, input: typeof plants.$inferInsert): Promise<PlantRow>;
// PhotoEntries repo (already exists; 05-03 extends with list/delete/bumpCoverFor):
export async function create(db: PhotoEntriesDb, input: PhotoEntryInsert): Promise<PhotoEntryRow>;
```
</interfaces>

<post_commit_pattern>
**CRITICAL — there is NO `tx.afterCommit` hook in this codebase.** The pattern, copied from `signup.ts:128-165`, is:

```typescript
// 1) Pre-UoW: validate, upload bytes (compensating delete on UoW catch).
// 2) UoW commits when the await resolves:
const { plant, photoEntry } = await withUnitOfWork(input.userId, async (tx) => {
  const createdPlant = await plantsRepo.create(tx, {...});
  const createdPhoto = await photoEntriesRepo.create(tx, {...});
  return { plant: createdPlant, photoEntry: createdPhoto };
});
// ↑ If this rejects (constraint violation, RLS, etc.) the catch block ABOVE runs the
//   compensating delete and rethrows — the lines below are SKIPPED.

// 3) Post-commit telemetry. UoW already committed; failures here go to Sentry, never user.
try {
  await inngest.send({
    name: "plant.created",
    data: { userId: input.userId, plantId: plant.id, source: input.source },
  });
} catch (err) {
  Sentry.captureException(err, { tags: { surface: "catalog.create-plant.notify" } });
}

const ph = getPostHog();
if (ph) {
  ph.capture({
    distinctId: input.userId,
    event: "plant_added",
    properties: {
      source: input.source,
      has_nickname: Boolean(input.nickname),
      has_location: Boolean(input.location),
      has_acquisition_date: Boolean(input.acquisitionDate),
      has_notes: Boolean(input.notes),
      photo_count: 1,
    },
  });
  await ph.shutdown();
}

return { ok: true, plant, photoEntry };
```

**Why this satisfies T-05-05-01 (PostHog leak on rollback):** if `withUnitOfWork(...)` rejects, the `try`/`catch` already issues compensating-delete and rethrows. The post-commit block never executes. There is no other code path between INSERT and event emit; the "after the await resolves" ordering is the ENTIRE guarantee.
</post_commit_pattern>

<id_ordering>
**Cover photo URL ordering — pick option (a) per advisor guidance and `upload-photo.ts:165-184` precedent:**

Pre-generate `plantId = randomUUID()` and `photoId = randomUUID()` BEFORE the UoW. Construct the storage object keys via `buildPlantPhotoObjectKey({...})`. Insert the Plant with `cover_photo_url = '{PLANT_PHOTOS_BUCKET}/{originalKey}'` AND insert the PhotoEntry with `photo_url = '{PLANT_PHOTOS_BUCKET}/{originalKey}'`, `thumbnail_url = '{PLANT_THUMBNAILS_BUCKET}/{thumbnailKey}'` IN THE SAME TX. This avoids an UPDATE Plant SET cover_photo_url after PhotoEntry insert, and matches the established upload-photo pattern.

Sequence inside `withUnitOfWork`:
1. `plantsRepo.create(tx, { id: plantId, userId, name, nickname, location, acquisition_date, notes, species_id, cover_photo_url: '{bucket}/{originalKey}' })`
2. `photoEntriesRepo.create(tx, { id: photoId, plantId, photoUrl: '{bucket}/{originalKey}', thumbnailUrl: '{thumb-bucket}/{thumbKey}', note: null })`
3. Return `{ plant, photoEntry }`.

PhotoEntry FK to plants requires Plant insert FIRST (correct ordering above). PhotoEntry.plant_id NOT NULL invariant preserved at every observable instant per D-02.
</id_ordering>

</context>

<feature>
  <name>createPlant use-case (manual + identification branches)</name>
  <files>src/contexts/catalog/application/create-plant.ts, tests/integration/create-plant.integration.test.ts, tests/unit/create-plant.unit.test.ts</files>
  <behavior>
**Input shape** (discriminated):
```typescript
type CreatePlantInput = {
  source: 'manual';
  userId: string;            // UUID — caller-provided (route uses requireVerifiedUser)
  name: string;
  photo: { buffer: Buffer; contentType: string };
  nickname?: string | null;
  location?: string | null;
  acquisitionDate?: string | null;
  notes?: string | null;
} | {
  source: 'identification';
  userId: string;
  name: string;              // pre-filled by Phase 6 from selected ID result
  photo: { buffer: Buffer; contentType: string };
  speciesId: string;         // required on this branch
  nickname?: string | null;
  location?: string | null;
  acquisitionDate?: string | null;
  notes?: string | null;
};
```

**Result shape** (matches `UploadPhotoResult` discriminated-union convention):
```typescript
type CreatePlantResult =
  | { ok: true; plant: PlantRow; photoEntry: PhotoEntryRow }
  | { ok: false; code: typeof ErrorCode.ValidationFailed | typeof ErrorCode.Unauthenticated; reason: string };
```

**Test cases — Unit (`tests/unit/create-plant.unit.test.ts`):**
- Test U1: `createPlantInputSchema` rejects empty `name` → `{ok:false, code:'validation_failed'}`.
- Test U2: `createPlantInputSchema` rejects missing `photo` → `{ok:false, code:'validation_failed'}`.
- Test U3: Unsupported MIME type (`image/gif`) → `{ok:false, code:'validation_failed', reason: matches /unsupported content type/}` BEFORE any storage call. Spy on `__setStorageAdapterForTests` adapter and assert `uploadObject` was never invoked.
- Test U4: GPS-bearing buffer (mock `exifr.gps` to return coords) → `{ok:false, code:'validation_failed', reason: matches /gps/i}` BEFORE storage. Adapter `uploadObject` not called.
- Test U5: Oversize buffer (`Buffer.alloc(MAX_UPLOAD_BYTES + 1)`) → `{ok:false, code:'validation_failed'}` BEFORE storage.
- Test U6: `source: 'identification'` requires `speciesId` (TypeScript-level discrimination + Zod parse — feed an `identification` input WITHOUT `speciesId` and assert validation_failed).
- Test U7: `source: 'manual'` rejects a `speciesId` field if present (Zod `.strict()` on the manual branch — defensive against route-handler bugs sending the wrong source).
- Test U8: PostHog props shape — when capture is invoked (mock `getPostHog` to return a `vi.fn()` adapter), assert `properties` contains EXACTLY `{source, has_nickname, has_location, has_acquisition_date, has_notes, photo_count}` and NO other keys (no plant_id, no name, no location text, no notes text). D-28 privacy contract.

**Test cases — Integration (`tests/integration/create-plant.integration.test.ts`, `describe.skipIf(!dbUrl)`):**
Setup mirrors `tests/integration/photo-upload.integration.test.ts:149-160`:
- Local Supabase guard (`/supabase\.co/.test(dbUrl)` → throw — same guard).
- `__setStorageAdapterForTests(makeFakeAdapter().asAdapter)` in `beforeAll`; `__setStorageAdapterForTests(null)` in `afterAll`.
- `vi.mock("posthog-node", ...)` and `vi.mock("@shared/inngest/client", ...)` to expose call assertions.
- Seeded user + cleanup via Phase 2 D-43 transaction-rollback fixture (`tests/integration/db-rollback.ts`).

- Test I1 (happy path, `source: 'manual'`):
  Given a verified user and a valid JPEG buffer, when `createPlant({source:'manual', userId, name:'Suculenta', photo:{buffer, contentType:'image/jpeg'}, nickname:'Susu', location:'sala'})` is called, then:
  - Result is `{ok: true, plant, photoEntry}`.
  - Exactly one row exists in `plants` with `cover_photo_url = '{PLANT_PHOTOS_BUCKET}/{originalKey}'` matching the photoEntry.photo_url.
  - Exactly one row exists in `photo_entries` with `plant_id = plant.id`.
  - Storage adapter `uploadObject` was called twice in order: first with `bucket: 'plant-photos'`, then with `bucket: 'plant-thumbnails'`.
  - Inngest mock `inngest.send` was called once with `name: "plant.created"`, `data.userId === userId`, `data.plantId === plant.id`, `data.source === 'manual'`.
  - PostHog mock `capture` was called once with `event: "plant_added"`, `distinctId: userId`, and `properties` containing `{source:'manual', has_nickname:true, has_location:true, has_acquisition_date:false, has_notes:false, photo_count:1}` and NO other property keys.
  - PostHog `shutdown` was called.

- Test I2 (compensating-delete on UoW rollback):
  Given a valid input, when `photoEntriesRepo.create` is forced to throw inside the UoW (mock the repo or simulate via FK violation by deleting the plant row inside the TX — choose the simpler approach: `vi.spyOn(photoEntriesRepo, 'create').mockRejectedValueOnce(new Error('boom'))`), then:
  - Promise rejects (the use-case rethrows per `upload-photo.ts:224`).
  - Storage adapter `uploadObject` was called twice (original + thumbnail) BEFORE the rollback.
  - Storage adapter `deleteObject` was called for both the original key and the thumbnail key (via `deleteSinglePlantPhotoBestEffort` which uses `deleteObject` per CR-01 spec, NOT `deletePrefix`).
  - Stored set in the fake adapter is empty after the call (round-trip cleanup verified, not just call-shape).
  - Zero rows exist in `plants` for this `userId` + name.
  - Zero rows exist in `photo_entries` for the constructed `plantId`.

- Test I3 (PostHog + Inngest leak guard on rollback — T-05-05-01):
  Given the same rollback scenario as I2, then:
  - Inngest `inngest.send` was NOT called (zero invocations).
  - PostHog `capture` was NOT called (zero invocations).
  - PostHog `shutdown` was NOT called.
  These three assertions form the explicit T-05-05-01 mitigation evidence.

- Test I4 (GPS rejection BEFORE storage write):
  Given a buffer for which `exifr.gps` returns `{latitude, longitude}`, when `createPlant({source:'manual', ...})` is called, then:
  - Result is `{ok:false, code:'validation_failed', reason: matches /gps/i}`.
  - Storage adapter `uploadObject` was never called.
  - Zero rows in `plants` / `photo_entries`.
  - Inngest + PostHog never called.

- Test I5 (`source: 'identification'` branch type-check + happy path with `species_id`):
  Given a valid identification input with `speciesId` set to a seeded species row id, when `createPlant({source:'identification', userId, name:'Monstera deliciosa', speciesId, photo:{...}})` is called, then:
  - Result is `{ok: true, plant, photoEntry}` with `plant.species_id === speciesId`.
  - PostHog property `source` is `'identification'`.
  - Inngest event `data.source` is `'identification'`.
  Note: this test exercises the input branch, NOT the Phase 6 end-to-end "Identification.plant_id FK update" — that is closed in Phase 6. The species row is seeded directly via SQL in this test fixture.

- Test I6 (cross-user RLS defense in depth):
  Given two seeded users U1 and U2, when `createPlant({userId: U1, ...})` runs, the plant + photo entry are created under U1 only. Querying `plants WHERE user_id = U2` returns zero. (RLS GUC bound to U1 inside UoW per `withUnitOfWork`; ownership filter at SQL layer per Phase 2 D-20.)
  </behavior>
  <implementation>
After RED tests are committed, implement `src/contexts/catalog/application/create-plant.ts`:

1. **Imports** (mirror upload-photo.ts):
   ```typescript
   import { randomUUID } from "node:crypto";
   import sharp from "sharp";
   import * as Sentry from "@sentry/nextjs";
   import { ErrorCode } from "@shared/config/errors";
   import { withUnitOfWork } from "@shared/db/unit-of-work";
   import { rejectGpsMetadata, rejectOversizeBuffer } from "@shared/images/server-validate";
   import { getPostHog } from "@shared/telemetry/posthog-server";
   import { inngest } from "@shared/inngest/client";
   import { createPlantInputSchema } from "@contexts/catalog/domain/schemas";
   import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
   import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
   import {
     buildPlantPhotoObjectKey,
     buildPlantThumbnailObjectKey,
     deleteSinglePlantPhotoBestEffort,
     PLANT_PHOTOS_BUCKET,
     PLANT_THUMBNAILS_BUCKET,
     uploadOriginalPlantPhoto,
     uploadPlantThumbnail,
   } from "@contexts/catalog/infrastructure/photo-storage";
   ```

2. **Constants + helpers** copied verbatim from upload-photo.ts: `ALLOWED_MIME_TYPES`, `isAllowedMime`, `extFromMime`, `THUMBNAIL_MAX_DIMENSION = 512`, `THUMBNAIL_QUALITY = 80`. (Do not duplicate by extracting yet — that refactor is a separate concern; mirror the existing convention.)

3. **Public types**: `CreatePlantInput` discriminated union (`source: 'manual' | 'identification'`) and `CreatePlantResult` discriminated union (matches `UploadPhotoResult` shape).

4. **`createPlant` function body** in this exact order:
   - **(0) Schema parse**: `const parsed = createPlantInputSchema.safeParse(input);` — on failure return `{ok:false, code: ErrorCode.ValidationFailed, reason: parsed.error.issues[0]?.message ?? 'invalid input'}`.
   - **(1) MIME validation** on `input.photo.contentType` → `validation_failed` if not allowed.
   - **(2) Size validation** via `rejectOversizeBuffer(input.photo.buffer)`.
   - **(3) GPS rejection** via `await rejectGpsMetadata(input.photo.buffer)`.
   - **(4) Skip ownership check** (the Plant doesn't exist yet — this is what makes createPlant different from upload-photo).
   - **(5) Sharp thumbnail** generation → on throw return `validation_failed`.
   - **(6) Pre-generate IDs**: `const plantId = randomUUID(); const photoId = randomUUID();`
     Compute `originalKey = buildPlantPhotoObjectKey({userId, plantId, photoId, ext})` and `thumbnailKey = buildPlantThumbnailObjectKey({userId, plantId, photoId, ext: "jpg"})`.
     Upload original then thumbnail (sequential, original first — matches upload-photo.ts:165-192).
   - **(7) UoW**: wrap a try/catch around `await withUnitOfWork(input.userId, async (tx) => { ... })`.
     Inside:
     ```typescript
     const plant = await plantsRepo.create(tx, {
       id: plantId,
       userId: input.userId,
       name: input.name,
       nickname: input.nickname ?? null,
       location: input.location ?? null,
       acquisitionDate: input.acquisitionDate ?? null,
       notes: input.notes ?? null,
       speciesId: input.source === 'identification' ? input.speciesId : null,
       coverPhotoUrl: `${PLANT_PHOTOS_BUCKET}/${originalKey}`,
     });
     const photoEntry = await photoEntriesRepo.create(tx, {
       id: photoId,
       plantId,
       photoUrl: `${PLANT_PHOTOS_BUCKET}/${originalKey}`,
       thumbnailUrl: `${PLANT_THUMBNAILS_BUCKET}/${thumbnailKey}`,
       note: null,
     });
     return { plant, photoEntry };
     ```
     On catch:
     ```typescript
     await deleteSinglePlantPhotoBestEffort({
       userId: input.userId, plantId, photoId, originalExt: ext,
     });
     throw err;
     ```
     (rethrow — caller decides; route handler in 05-08 maps to `internal_error`).

   - **(8) Post-commit telemetry** (only reached if UoW resolved):
     - Inngest emit (try/catch + Sentry on failure, never user-trap):
       ```typescript
       try {
         await inngest.send({
           name: "plant.created",
           data: { userId: input.userId, plantId: plant.id, source: input.source },
         });
       } catch (err) {
         Sentry.captureException(err, { tags: { surface: "catalog.create-plant.notify" }, extra: { plantId: plant.id } });
       }
       ```
     - PostHog capture (D-28 privacy-clean props):
       ```typescript
       const ph = getPostHog();
       if (ph) {
         ph.capture({
           distinctId: input.userId,
           event: "plant_added",
           properties: {
             source: input.source,
             has_nickname: Boolean(input.nickname),
             has_location: Boolean(input.location),
             has_acquisition_date: Boolean(input.acquisitionDate),
             has_notes: Boolean(input.notes),
             photo_count: 1,
           },
         });
         await ph.shutdown();
       }
       ```

   - **(9) Return** `{ ok: true, plant, photoEntry }`.

5. Run integration suite + unit suite; ensure RED→GREEN per behavior.
  </implementation>
</feature>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (RED): Write failing unit tests for createPlant validation + telemetry-prop shape</name>
  <files>tests/unit/create-plant.unit.test.ts</files>
  <behavior>
- Tests U1–U7 from `<feature><behavior>` (validation rejections + discriminated-union shape).
- Test U8 (PostHog property-key allowlist — D-28 privacy contract: assert `Object.keys(properties)` equals exactly `['source','has_nickname','has_location','has_acquisition_date','has_notes','photo_count']`).
- Mock `posthog-node` via `vi.mock("@shared/telemetry/posthog-server", ...)` and `inngest` via `vi.mock("@shared/inngest/client", ...)` to capture call args without real network.
- Mock storage adapter via `__setStorageAdapterForTests` with a fake that records `uploadObject` calls so U3/U4/U5 assert "no storage call".
  </behavior>
  <action>
Create `tests/unit/create-plant.unit.test.ts`. Import the (not-yet-existing) `createPlant` from `@contexts/catalog/application/create-plant`. Set up mocks per the behavior block. Each test asserts the discriminated-union result shape and (where applicable) that mocks were/were not called. Run `pnpm test:unit -- create-plant.unit` and confirm ALL tests fail with import-resolution or `createPlant is not a function`. Commit: `test(05-05): add failing unit tests for createPlant`.
  </action>
  <verify>
    <automated>pnpm test:unit -- create-plant.unit 2>&1 | grep -E "(FAIL|✗|×)" | head -20</automated>
  </verify>
  <done>All 8 unit tests authored, all currently FAIL (RED), commit pushed with `test(05-05):` prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (RED): Write failing integration tests for createPlant TX + compensating-delete + post-commit telemetry</name>
  <files>tests/integration/create-plant.integration.test.ts</files>
  <behavior>
- Tests I1–I6 from `<feature><behavior>`.
- Setup mirrors `tests/integration/photo-upload.integration.test.ts:149-160` (cloud-Supabase guard, `describe.skipIf(!dbUrl)`, fake StorageAdapter with `_stored` set + `_storedKey` helper).
- Use Phase 2 D-43 transaction-rollback fixture (`tests/integration/db-rollback.ts`) for DB cleanup between tests.
- Mock `@shared/inngest/client` with `{ inngest: { send: vi.fn() } }` and `@shared/telemetry/posthog-server` with `{ getPostHog: vi.fn(() => ({ capture: vi.fn(), shutdown: vi.fn() })), shutdownPostHog: vi.fn() }`.
- I3 (leak guard) explicitly references threat ID `T-05-05-01` in the test description string for traceability.
- I5 seeds a `species` row directly via SQL before invoking createPlant with `source: 'identification'`.
- I6 seeds two users; assert RLS+ownership filter prevents cross-user write.
  </behavior>
  <action>
Create `tests/integration/create-plant.integration.test.ts` mirroring the `photo-upload.integration.test.ts` setup. Use `valid-jpeg.png` fixture buffer or generate via sharp. Run `pnpm test:run -- create-plant.integration` and confirm ALL tests fail (createPlant not yet exported). Commit: `test(05-05): add failing integration tests for createPlant TX + telemetry`.
  </action>
  <verify>
    <automated>pnpm test:run -- create-plant.integration 2>&1 | grep -E "(FAIL|✗|×)" | head -20</automated>
  </verify>
  <done>All 6 integration tests authored, all currently FAIL or skip-with-no-implementation, commit pushed with `test(05-05):` prefix.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3 (GREEN): Implement createPlant use-case to pass all tests</name>
  <files>src/contexts/catalog/application/create-plant.ts</files>
  <behavior>
- All 8 unit tests pass.
- All 6 integration tests pass.
- The implementation follows the exact step ordering in `<feature><implementation>` (validation pre-UoW, IDs pre-generated, UoW with TX, compensating-delete on catch, post-commit Inngest then PostHog).
- T-05-05-01 mitigation: post-commit block sits AFTER `await withUnitOfWork(...)` resolves; UoW rejection skips the entire block (proven by I3).
- T-05-05-02 mitigation: `rejectOversizeBuffer` + `rejectGpsMetadata` run BEFORE any storage write (proven by U4/U5/I4).
- T-05-05-03 mitigation: `userId` flows from caller only; type signature does NOT accept request-body shapes; documented in JSDoc that callers MUST derive `userId` from `requireVerifiedUser` (route handler concern, enforced in 05-08).
  </behavior>
  <action>
Implement `src/contexts/catalog/application/create-plant.ts` per the implementation block. Follow `upload-photo.ts` style for constants, helpers, and the compensating-delete `try/catch`. Use the post-commit pattern from `signup.ts:128-165` (Inngest `try/catch` + Sentry; PostHog null-guarded). Run `pnpm test:run -- create-plant` and confirm ALL 14 tests pass. Commit: `feat(05-05): implement createPlant use-case with compensating-delete + post-commit telemetry`.
  </action>
  <verify>
    <automated>pnpm test:run -- create-plant 2>&1 | tail -20</automated>
  </verify>
  <done>All 14 tests (8 unit + 6 integration) GREEN. File exports `createPlant`, `CreatePlantInput`, `CreatePlantResult`. JSDoc references T-05-05-01/02/03 mitigations. Commit pushed with `feat(05-05):` prefix.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Route handler → use-case | Route (05-08) calls `requireVerifiedUser` then passes `userId` here; use-case never reads userId from request body. |
| Use-case → Storage | Storage uploads happen pre-UoW; failures rejected via discriminated union (no exception leak to caller for known-bad input); compensating delete on UoW catch handles the storage-vs-DB split-brain. |
| Use-case → DB (RLS) | `withUnitOfWork` binds `auth.uid()` GUC to `userId`; repositories also apply explicit `WHERE user_id = $1` filters at SQL layer (defense in depth per Phase 2 D-20). |
| Use-case → PostHog/Inngest | Post-commit only; failures Sentry-captured but never user-traps; never block the user-facing success response. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-05-01 | I (Information Disclosure) | post-commit `posthog.capture` | mitigate | PostHog capture + Inngest emit ONLY after `await withUnitOfWork(...)` resolves. UoW rejection skips entire post-commit block (no `tx.afterCommit` hook exists; ordering by `await` IS the guarantee). Integration test I3 asserts zero `inngest.send` calls AND zero `posthog.capture` calls when `photoEntriesRepo.create` is forced to reject inside the TX. |
| T-05-05-02 | I, D (Information Disclosure / DoS) | multipart upload buffer | mitigate | `rejectOversizeBuffer(input.photo.buffer)` and `await rejectGpsMetadata(input.photo.buffer)` run BEFORE any storage write (steps 2 + 3 of the use-case, per upload-photo.ts:104-123). Client-side compression to ≤1MB + EXIF strip per CLAUDE.md is the primary control; server rejection per Phase 2 D-30 is defense in depth. Tests U4/U5/I4 assert no storage call on GPS or oversize rejection. |
| T-05-05-03 | E (Elevation of Privilege) | `userId` parameter | mitigate | The `userId` parameter type in `CreatePlantInput` is documented (JSDoc) as caller-derived from `requireVerifiedUser(request)` only — never from request body. Route handler 05-08 enforces. UoW `withUnitOfWork` validates `userId` is a UUID via `assertValidUserId` (T-02-32 mitigation), so a malformed userId rejects with `UnitOfWorkError(code='validation_failed')` before any DB role switch. |
| T-05-05-04 | T (Tampering) | post-commit Inngest event | accept | Inngest event delivery failure post-commit cannot un-create the plant. Failure surfaces via `Sentry.captureException(... { surface: "catalog.create-plant.notify" })`, identical to the established `signup.ts:160-165` pattern. The `plant.created` event is informational for Phase 6 (no Phase 5 consumer); a missing event does not user-trap or compromise data integrity. |
| T-05-05-05 | R (Repudiation) | duplicate plant create on retry | accept (in this plan) | Idempotency-Key support is planned in 05-08 (route layer) per Phase 2 D-37; the use-case itself is invoke-once-per-call. A double-call from the route would create two plants, but the route in 05-08 wraps with `withIdempotency`. This plan's tests do not exercise idempotency — that is verified in 05-08's integration suite. |
</threat_model>

<verification>
Phase-level checks (run after Task 3 GREEN):

```bash
pnpm test:unit -- create-plant.unit                  # 8 unit tests pass
pnpm test:run -- create-plant.integration            # 6 integration tests pass
pnpm typecheck                                        # CreatePlantInput discriminated-union types compile
grep -n "afterCommit" src/contexts/catalog/application/create-plant.ts   # MUST return zero matches
grep -n "tx\\.afterCommit" src/contexts/catalog/application/create-plant.ts  # MUST return zero matches
grep -cE "^[^#]*deleteSinglePlantPhotoBestEffort" src/contexts/catalog/application/create-plant.ts  # MUST be ≥1 (compensating delete present)
grep -cE "^[^#]*withUnitOfWork" src/contexts/catalog/application/create-plant.ts  # MUST be ≥1
grep -cE "^[^#]*plant_added" src/contexts/catalog/application/create-plant.ts  # MUST be ≥1 (D-28 event name)
grep -cE "^[^#]*plant\\.created" src/contexts/catalog/application/create-plant.ts  # MUST be ≥1 (Inngest event)
```

Per VALIDATION.md "Plant create (Integration)" stratum: this plan ships the integration test that proves "Multipart POST atomically creates Plant + PhotoEntry; rollback triggers compensating delete; PostHog NOT fired on rollback." (The "Multipart POST" half is exercised by 05-08's route-layer integration test.)
</verification>

<success_criteria>
- `src/contexts/catalog/application/create-plant.ts` exists, exports `createPlant`, `CreatePlantInput`, `CreatePlantResult`.
- 14 tests (8 unit + 6 integration) all GREEN under `pnpm test:run`.
- T-05-05-01: integration test I3 explicitly asserts zero PostHog + zero Inngest invocations on UoW rollback. The leak-on-rollback threat is closed by the post-commit ordering guarantee, with empirical evidence in the test suite.
- T-05-05-02: tests U4/U5/I4 prove GPS + oversize rejection BEFORE any storage write.
- T-05-05-03: JSDoc on `CreatePlantInput.userId` documents caller-only origin; UoW UUID validation prevents string-spoof attacks.
- D-28 PostHog `plant_added` event fires post-commit with EXACTLY the privacy-clean property keys: `{source, has_nickname, has_location, has_acquisition_date, has_notes, photo_count}` (asserted by U8 + I1).
- `plant.created` Inngest event emitted post-commit with `{userId, plantId, source}` payload.
- CAT-01 contributor: the `source: 'identification'` branch type-checks and integration-test I5 confirms it functions; final close happens in Phase 6 when the route + Identification.plant_id wiring lands.
- CAT-02, CAT-03: manual create with name + photo required (D-04) is fully closed by this plan + 05-08 route + 05-17 UI; the use-case half is done here.
- Three commits pushed: `test(05-05): add failing unit tests`, `test(05-05): add failing integration tests`, `feat(05-05): implement createPlant use-case`.
- No `afterCommit` references in the implementation (advisor caught: this hook does not exist in this codebase).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-05-SUMMARY.md` capturing:
- File paths created/modified
- Test counts (8 unit + 6 integration GREEN)
- Threat dispositions confirmed (T-05-05-01/02/03 mitigated; T-05-05-04/05 accepted with rationale)
- D-28 property-key contract verified
- CAT-01 contributor status (Phase 6 closes)
- Any deviations from plan with reasoning
</output>
