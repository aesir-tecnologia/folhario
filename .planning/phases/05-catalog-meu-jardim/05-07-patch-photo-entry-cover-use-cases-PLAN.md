---
phase: 05-catalog-meu-jardim
plan: 07
type: tdd
wave: 2
depends_on: ["05-03", "05-04"]
files_modified:
  - src/contexts/catalog/application/update-plant.ts
  - src/contexts/catalog/application/get-plant.ts
  - src/contexts/catalog/application/list-plants.ts
  - src/contexts/catalog/application/list-photo-entries.ts
  - src/contexts/catalog/application/create-photo-entry.ts
  - src/contexts/catalog/application/delete-photo-entry.ts
  - src/contexts/catalog/application/list-locations.ts
  - src/contexts/catalog/infrastructure/photo-storage.ts
  - src/messages/pt-BR.json
  - tests/integration/catalog-update-plant.integration.test.ts
  - tests/integration/catalog-get-plant.integration.test.ts
  - tests/integration/catalog-list-plants.integration.test.ts
  - tests/integration/catalog-list-photo-entries.integration.test.ts
  - tests/integration/catalog-create-photo-entry.integration.test.ts
  - tests/integration/catalog-delete-photo-entry.integration.test.ts
  - tests/integration/catalog-list-locations.integration.test.ts
  - tests/unit/catalog-sign-photo-url.test.ts
autonomous: true
requirements: ["CAT-04", "CAT-05", "CAT-06", "CAT-07", "CAT-08"]
tags: ["catalog", "use-case", "tdd", "patch", "photo-entry", "cover-promote", "cursor-pagination", "signed-url"]

must_haves:
  truths:
    - "PATCH update-plant accepts a single dirty field, applies LWW (server `updated_at` always wins per D-06), and emits `plant_edited` PostHog AFTER the UoW resolves (rollback never leaks telemetry)."
    - "When the dirty PATCH field is `location`, the same UoW upserts `location_suggestions(user_id, label_normalized)` with `usage_count` incremented and `last_used_at` bumped (D-09)."
    - "Cross-user PATCH against a plant the caller does not own returns `not_found` (NOT `forbidden`) — matches `upload-photo.ts:131` precedent and avoids existence disclosure."
    - "get-plant returns `{ plant, _meta: { photo_entry_count, reminder_count } }` so the D-07 delete-confirm sheet renders fresh cascade counts."
    - "list-plants supports all five sort_ids `(name_asc | name_desc | date_new | date_old | location)`, applies `WHERE user_id = $1` regardless of cursor contents, returns opaque `nextCursor`, and includes `total_count` ONLY when `includeCount === true` AND `cursor === null` (first page)."
    - "list-plants ordering is deterministic for `acquisition_date` ASC and DESC: NULLs sort LAST in both directions; `plant.id` is the stable tiebreak — RESEARCH Open Q1 sentinel-cursor pattern."
    - "list-photo-entries returns reverse-chronological PhotoEntries; each entry's `thumbnailUrl` is replaced with a freshly minted 24h-TTL signed URL via `signCatalogPhotoUrl({ url, ttl: 24*3600 })` (D-20)."
    - "create-photo-entry follows D-15 multipart flow: MIME/size/GPS validation (reused from upload-photo helpers), `validateStoragePathOwnership` BEFORE storage write, sharp thumbnail, two storage writes, then `withUnitOfWork` insert with compensating-delete on TX failure (T-05-04-01 mitigation)."
    - "delete-photo-entry deletes the PhotoEntry row inside a UoW; if the deleted row was the cover (oldest by created_at), `photoEntries.bumpCoverFor(plantId)` runs in the SAME TX so cover-photo-url atomically advances to the next-oldest entry (D-03)."
    - "delete-photo-entry inserts ONE `pending_storage_deletions` row per bucket scoped to the SINGLE photo path `{userId}/{plantId}/{photoId}.{ext}` AFTER `validateStoragePathOwnership` accepts the key (T-05-04-01 second call site)."
    - "list-locations returns the merge of (a) `locationSuggestions.listForUser(userId, 20)` ordered by `usage_count DESC, last_used_at DESC` and (b) the i18n defaults loaded from `src/messages/pt-BR.json` `catalog.locations.defaults`, de-duped by normalized label (NFKC + lower-case + trim)."
    - "`signCatalogPhotoUrl` is a pure helper that takes a stored bucket-prefixed URL string (`{bucket}/{key}` shape, the value persisted in `photo_entries.thumbnail_url`/`photo_url`) plus a TTL in seconds and returns a signed URL — adapter is the only side effect; no DB I/O."
  artifacts:
    - path: "src/contexts/catalog/application/update-plant.ts"
      provides: "PATCH single-field use-case with optimistic LWW + post-commit PostHog `plant_edited` + same-TX `location_suggestions` upsert when dirty field is `location`"
      exports: ["updatePlant", "UpdatePlantInput", "UpdatePlantResult"]
    - path: "src/contexts/catalog/application/get-plant.ts"
      provides: "Plant detail read returning plant + `_meta: { photo_entry_count, reminder_count }` for D-07 delete-confirm cascade-counts surface"
      exports: ["getPlant", "GetPlantInput", "GetPlantResult"]
    - path: "src/contexts/catalog/application/list-plants.ts"
      provides: "Cursor pagination across the 5 sort modes with NULLS LAST for `acquisition_date`; `?include_count=1` first-page total"
      exports: ["listPlants", "ListPlantsInput", "ListPlantsResult"]
    - path: "src/contexts/catalog/application/list-photo-entries.ts"
      provides: "Reverse-chronological PhotoEntry list with 24h-TTL signed thumbnail URLs (D-20)"
      exports: ["listPhotoEntries", "ListPhotoEntriesInput", "ListPhotoEntriesResult"]
    - path: "src/contexts/catalog/application/create-photo-entry.ts"
      provides: "Multipart photo-journal add (D-15) reusing upload-photo compensating-delete pattern; `validateStoragePathOwnership` gate before storage write"
      exports: ["createPhotoEntry", "CreatePhotoEntryInput", "CreatePhotoEntryResult"]
    - path: "src/contexts/catalog/application/delete-photo-entry.ts"
      provides: "PhotoEntry delete with same-TX cover auto-promote (D-03) and per-photo `pending_storage_deletions` row insert (T-05-04-01 mitigation)"
      exports: ["deletePhotoEntry", "DeletePhotoEntryInput", "DeletePhotoEntryResult"]
    - path: "src/contexts/catalog/application/list-locations.ts"
      provides: "Merged DB suggestions + i18n defaults (D-09 + D-10) with normalized-label de-dupe"
      exports: ["listLocations", "ListLocationsInput", "ListLocationsResult"]
    - path: "src/contexts/catalog/infrastructure/photo-storage.ts"
      provides: "NEW `signCatalogPhotoUrl({ storedUrl, ttlSeconds })` helper that parses `{bucket}/{key}` and delegates to the storage adapter"
      exports: ["signCatalogPhotoUrl"]
    - path: "src/messages/pt-BR.json"
      provides: "i18n defaults at `catalog.locations.defaults` per D-10 (sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro)"
      contains: "catalog.locations.defaults"
  key_links:
    - from: "src/contexts/catalog/application/update-plant.ts"
      to: "src/contexts/catalog/infrastructure/db/location-suggestions.ts"
      via: "When dirty field === 'location', call `locationSuggestions.upsert(tx, userId, label)` inside the SAME UoW (D-09)"
      pattern: "locationSuggestions\\.upsert\\("
    - from: "src/contexts/catalog/application/update-plant.ts"
      to: "src/shared/telemetry/posthog-server.ts (getPostHog)"
      via: "POST-COMMIT capture: `await withUnitOfWork(...)` resolves THEN `getPostHog()?.capture({event: 'plant_edited', properties: {field}})`. NO `tx.afterCommit` API exists in Drizzle — use sequential await."
      pattern: "getPostHog\\(\\)\\?\\.capture"
    - from: "src/contexts/catalog/application/list-plants.ts"
      to: "src/shared/api/cursor.ts"
      via: "encodeCursor / decodeCursor + extended `{sort_id, last_value, last_id}` payload from 05-02 (RESEARCH Open Q1 NULLS LAST sentinel)"
      pattern: "decodeCursor|encodeSortCursor"
    - from: "src/contexts/catalog/application/list-photo-entries.ts"
      to: "src/contexts/catalog/infrastructure/photo-storage.ts (signCatalogPhotoUrl)"
      via: "Map each row's `thumbnail_url` (stored as `{bucket}/{key}`) through signCatalogPhotoUrl with `ttlSeconds = 24*3600`"
      pattern: "signCatalogPhotoUrl\\("
    - from: "src/contexts/catalog/application/create-photo-entry.ts"
      to: "src/contexts/catalog/domain/storage-paths.ts (validateStoragePathOwnership — from 05-04)"
      via: "MANDATORY pre-check: validate the canonical D-26 key BEFORE the storage adapter writes (T-05-04-01 first call site)"
      pattern: "validateStoragePathOwnership\\("
    - from: "src/contexts/catalog/application/delete-photo-entry.ts"
      to: "src/contexts/catalog/domain/storage-paths.ts (validateStoragePathOwnership — from 05-04)"
      via: "MANDATORY pre-check BEFORE inserting `pending_storage_deletions` rows (T-05-04-01 second call site flagged in 05-04 SUMMARY)"
      pattern: "validateStoragePathOwnership\\("
    - from: "src/contexts/catalog/application/delete-photo-entry.ts"
      to: "src/contexts/catalog/infrastructure/db/photo-entries.ts (bumpCoverFor — from 05-03)"
      via: "Inside the SAME UoW: if deleted row was the cover (or for safety, always re-evaluate), call bumpCoverFor(plantId) to atomically advance Plant.cover_photo_url (D-03)"
      pattern: "bumpCoverFor\\("
    - from: "src/contexts/catalog/application/list-locations.ts"
      to: "src/messages/pt-BR.json (catalog.locations.defaults)"
      via: "Static import of the JSON message bundle (existing pattern: signup.ts:30, request-password-reset.ts:28, resend-verification.ts:14) and read `catalog.locations.defaults` array"
      pattern: "catalog\\.locations\\.defaults"
---

<objective>
Ship the remaining seven catalog use-cases that 05-08/05-09 route handlers consume. Closes the use-case stratum for CAT-04 (plant profile detail + cascade counts), CAT-05 (location suggestions + i18n defaults merge), CAT-06 (photo journal CRUD), CAT-07 (default sort `acquisition_date` DESC NULLS LAST), and CAT-08 (5-option sort + cursor pagination contract). Also ships the missing `signCatalogPhotoUrl` infrastructure helper that list-photo-entries depends on, and the `catalog.locations.defaults` i18n key that list-locations consumes.

Purpose: The 05-05 (create-plant) and 05-06 (delete-plant + Inngest cleanup) plans cover the create + delete write paths. THIS plan covers everything in between — read paths (`list-plants`, `get-plant`, `list-photo-entries`, `list-locations`), the LWW PATCH path (`update-plant`), and the photo-journal CRUD pair (`create-photo-entry`, `delete-photo-entry`). Cover auto-promote on photo delete (D-03) is the most threat-relevant correctness invariant in the plan and gets a dedicated TDD cycle.

Output:
- 7 new application use-cases under `src/contexts/catalog/application/`.
- `signCatalogPhotoUrl` helper added to `src/contexts/catalog/infrastructure/photo-storage.ts` (NEW — does not exist today; existing helpers `signOriginalUrl` / `signThumbnailUrl` take typed `PhotoStorageKeyInput` but the persisted column shape is `{bucket}/{key}` and needs a parser).
- `catalog.locations.defaults` extension to `src/messages/pt-BR.json`.
- Integration tests (one per use-case) + one unit test for the URL signer green under `pnpm test:run`.
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

# Upstream plan summaries (read these — load-bearing types/exports)
@.planning/phases/05-catalog-meu-jardim/05-03-catalog-repositories-SUMMARY.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-SUMMARY.md

# Existing artifacts this plan extends or imports
@src/contexts/catalog/application/upload-photo.ts
@src/contexts/catalog/infrastructure/photo-storage.ts
@src/contexts/catalog/infrastructure/db/plants.ts
@src/contexts/catalog/infrastructure/db/photo-entries.ts
@src/shared/db/unit-of-work.ts
@src/shared/db/client.ts
@src/shared/api/cursor.ts
@src/shared/config/errors.ts
@src/shared/telemetry/posthog-server.ts
@src/shared/images/limits.ts
@src/shared/images/server-validate.ts
@src/messages/pt-BR.json
@tests/integration/photo-upload.integration.test.ts
@tests/integration/setup.ts

<interfaces>
<!-- Contracts pulled from the codebase. Use these directly — no codebase exploration required. -->

From `src/contexts/catalog/application/upload-photo.ts` (canonical compensating-delete reference):
```ts
// Steps 1..7 of the upload pipeline:
//   1. MIME validation via ALLOWED_MIME_TYPES set
//   2. Size validation via rejectOversizeBuffer
//   3. GPS rejection via rejectGpsMetadata (defense in depth)
//   4. Plant ownership check (findByIdForUser) OUTSIDE the UoW
//   5. Sharp thumbnail (512px max, JPEG q=80) synchronously
//   6. uploadOriginalPlantPhoto + uploadPlantThumbnail
//   7. withUnitOfWork insert; on TX failure → deleteSinglePlantPhotoBestEffort + rethrow

export type UploadPhotoResult =
  | { ok: true; photoEntry: PhotoEntryRow }
  | { ok: false; code: ErrorCode.ValidationFailed | ErrorCode.NotFound | ErrorCode.Unauthenticated; reason: string };
```
**REUSE policy for create-photo-entry:** import `uploadPhoto` and call it directly. The existing function already implements steps 1–7. The wrapper in `create-photo-entry.ts` is only responsible for the multipart-route-shape adaptation (input field names) and the discriminated-union mapping. Do NOT duplicate the pipeline — single source of truth is `upload-photo.ts`.

From `src/contexts/catalog/infrastructure/photo-storage.ts:33-34, 122-136`:
```ts
export const PLANT_PHOTOS_BUCKET = "plant-photos";
export const PLANT_THUMBNAILS_BUCKET = "plant-thumbnails";

export async function signOriginalUrl(input: SignPlantPhotoInput): Promise<CreateSignedUrlResult> {
  return getAdapter().createSignedUrl({
    bucket: PLANT_PHOTOS_BUCKET,
    objectKey: buildPlantPhotoObjectKey(input),
    expiresInSeconds: input.expiresInSeconds,
  });
}
// signThumbnailUrl mirrors signOriginalUrl with PLANT_THUMBNAILS_BUCKET.

export interface SignPlantPhotoInput {
  userId: string;
  plantId: string;
  photoId: string;
  ext: "jpg" | "png" | "webp";
  expiresInSeconds: number;
}
```
The two existing helpers require typed `PhotoStorageKeyInput`. The persisted columns `photo_entries.photo_url` and `photo_entries.thumbnail_url` are stored as `"{bucket}/{key}"` strings (`upload-photo.ts:212`), so list-photo-entries cannot construct a `SignPlantPhotoInput` without round-tripping through a regex. This plan adds `signCatalogPhotoUrl({ storedUrl, ttlSeconds })` that parses the stored shape once and delegates to the underlying adapter `createSignedUrl({ bucket, objectKey, expiresInSeconds })`.

From `src/contexts/catalog/infrastructure/db/plants.ts` (existing + 05-03 extensions):
```ts
type PlantsDb = DbClient | TransactionalDb;
export type PlantRow = typeof plants.$inferSelect;
export async function findByIdForUser(db: PlantsDb, userId: string, plantId: string): Promise<PlantRow | null>;

// 05-03 adds:
export interface ListPlantsArgs { userId: string; sort: SortId; cursor: CursorPayload | null; limit: number }
export async function list(db: PlantsDb, args: ListPlantsArgs): Promise<{ rows: PlantRow[]; nextCursor: CursorPayload | null }>;
export async function update(db: PlantsDb, userId: string, plantId: string, patch: Partial<PlantRow>): Promise<PlantRow | null>;
export async function countForUser(db: PlantsDb, userId: string): Promise<number>;
export async function getCascadeCounts(db: PlantsDb, plantId: string): Promise<{ photoEntryCount: number; reminderCount: number }>;
```

From `src/contexts/catalog/infrastructure/db/photo-entries.ts` (existing + 05-03 extensions):
```ts
type PhotoEntriesDb = DbClient | TransactionalDb;
export type PhotoEntryRow = typeof photoEntries.$inferSelect;
export async function create(db: PhotoEntriesDb, input: PhotoEntryInsert): Promise<PhotoEntryRow>;

// 05-03 adds:
export async function list(db: PhotoEntriesDb, args: { plantId: string }): Promise<PhotoEntryRow[]>; // ORDER BY created_at DESC
export async function deleteById(db: PhotoEntriesDb, photoEntryId: string): Promise<PhotoEntryRow | null>; // returning row or null
export async function bumpCoverFor(db: PhotoEntriesDb, plantId: string): Promise<void>;
// bumpCoverFor sets plants.cover_photo_url = (SELECT photo_url FROM photo_entries WHERE plant_id = $1 ORDER BY created_at ASC LIMIT 1)
// — pass `tx`, NEVER bare `db`. D-03 atomicity requires same-TX execution.
```

From `src/contexts/catalog/infrastructure/db/location-suggestions.ts` (NEW in 05-03):
```ts
type LocationSuggestionsDb = DbClient | TransactionalDb;
export async function upsert(db: LocationSuggestionsDb, userId: string, label: string): Promise<void>;
// INSERT ... ON CONFLICT (user_id, label_normalized) DO UPDATE SET usage_count = usage_count + 1, last_used_at = now()
// `label_normalized` = NFKC + lower-case + trim of `label`; `label_display` = trimmed but case-preserved
export async function listForUser(db: LocationSuggestionsDb, userId: string, limit: number): Promise<{ labelDisplay: string; labelNormalized: string }[]>;
```

From `src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts` (NEW in 05-03):
```ts
type PendingDeletionsDb = DbClient | TransactionalDb;
export async function create(
  db: PendingDeletionsDb,
  input: { userId: string; bucket: string; prefix: string },
): Promise<void>;
// `prefix` carries the SCOPE — for a single photo delete, this MUST be the full canonical
// key `{userId}/{plantId}/{photoId}.{ext}` (NOT just `{userId}/{plantId}/`). The cleanup
// worker calls storageAdapter.deletePrefix(prefix); for the single-object case the prefix
// matches exactly one key. T-05-04-01 mitigation: gate this insert on validateStoragePathOwnership.
```

From `src/shared/api/cursor.ts` (existing + 05-02 extension for sorted cursor):
```ts
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// 05-02 ships the extended payload + helpers (RESEARCH Open Q1 sentinel cursor):
export type SortId = "name_asc" | "name_desc" | "date_new" | "date_old" | "location";
export type LastValue =
  | { kind: "string"; value: string }
  | { kind: "date"; value: string | null }   // null = NULLS LAST sentinel
  | null;
export interface SortedCursorPayload { sortId: SortId; lastValue: LastValue; lastId: string }
export function encodeSortCursor(payload: SortedCursorPayload): string;
export function decodeSortCursor(encoded: string): { ok: true; value: SortedCursorPayload } | { ok: false; error: ErrorCode };
export function normalizeLimit(input: string | number | null | undefined): number;
```

From `src/shared/db/unit-of-work.ts:88-103`:
```ts
export async function withUnitOfWork<T>(userId: string, fn: (tx: TransactionalDb) => Promise<T>): Promise<T>;
// Binds `request.jwt.claim.sub = userId` for transaction lifetime — RLS engages.
// IMPORTANT: There is NO `tx.afterCommit(...)` API in Drizzle. The "after commit"
// pattern is sequential:
//   const result = await withUnitOfWork(userId, async (tx) => { ... });
//   getPostHog()?.capture({...}); // runs ONLY if UoW resolved (no rollback leak)
// If withUnitOfWork throws/rejects, the capture line is never reached.
```

From `src/contexts/catalog/domain/schemas.ts` (extended in 05-04):
```ts
export const updatePlantInputSchema: ZodObject<...>;
export type UpdatePlantInput = z.infer<typeof updatePlantInputSchema>;
// `.partial()` over editable columns + `.strict()` (rejects unknown keys, T-05-04-02)
// + `.refine(v => Object.keys(v).length > 0, ...)` (rejects empty payload)
```

From `src/contexts/catalog/domain/storage-paths.ts` (NEW in 05-04):
```ts
export type StoragePathValidationResult = { ok: true } | { ok: false; reason: StoragePathValidationReason };
export function validateStoragePathOwnership(input: { userId: string; plantId: string; key: string }): StoragePathValidationResult;
```

From `src/shared/telemetry/posthog-server.ts:6-16`:
```ts
export function getPostHog(): PostHog | null;
// Returns null if NEXT_PUBLIC_POSTHOG_KEY is unset. ALL capture sites use `getPostHog()?.capture(...)`.
```

From `src/shared/config/errors.ts:1-16`:
```ts
export const ErrorCode = {
  Forbidden: "forbidden",
  NotFound: "not_found",
  ValidationFailed: "validation_failed",
  Unauthenticated: "unauthenticated",
  ReadOnlyMode: "read_only_mode",
  SubscriptionRequired: "subscription_required",
  // ... etc — closed registry per Phase 1 D-10/D-11/D-12
} as const;
```
**Cross-user precedent:** `upload-photo.ts:128-134` returns `ErrorCode.NotFound` when the caller does not own the plant. THIS plan follows the same precedent for `update-plant.ts`, `get-plant.ts`, `list-photo-entries.ts`, `create-photo-entry.ts`, `delete-photo-entry.ts`. Existence disclosure (returning `forbidden` to mean "exists but not yours") is forbidden — T-05-07-02 mitigation.

From `src/messages/pt-BR.json` (existing structure — extend, do NOT replace):
```jsonc
{
  "nav": { ... },
  "home": { ... },
  "catalog": {
    "empty": { "title": "...", "hint": "...", "cta": "..." }
    // Add `locations.defaults` HERE — see Task 4.
  },
  "identify": { ... }
  // ... etc
}
```
Existing import idiom (e.g. `signup.ts:30`):
```ts
import ptBR from "../../../messages/pt-BR.json";
```
The file path used by use-cases at `src/contexts/catalog/application/*` resolves to `../../../../messages/pt-BR.json` — verify the relative-path depth at write time. The shared `next-intl` setup loads server-side translations via `getTranslations("...")`, but for a domain-pure use-case that needs the static defaults the JSON-import pattern matches the existing codebase precedent.
</interfaces>

<binding_decisions>
<!-- Decisions from 05-CONTEXT.md that constrain this plan -->
- **D-03 (cover auto-promote):** `Plant.cover_photo_url` ALWAYS reflects `(SELECT photo_url FROM photo_entries WHERE plant_id = $1 ORDER BY created_at ASC LIMIT 1)`. delete-photo-entry MUST call `bumpCoverFor(plantId)` inside the SAME UoW transaction — even if the deleted row was not the cover (defensive idempotence; cheap, eliminates a stale-cover race). NOT in a separate TX, NOT after commit, NOT a no-op-if-not-cover branch.
- **D-05 (PATCH single-field):** Server tolerates ≥1 known field per `updatePlantInputSchema` (05-04). Client always sends exactly one dirty field; server does NOT enforce "exactly one".
- **D-06 (LWW):** No conflict detection. Server PATCH always wins. No `If-Unmodified-Since` header parsing. No 409 response.
- **D-07 (cascade-counts):** `get-plant` returns `_meta: { photo_entry_count, reminder_count }` on EVERY read (not gated on a query param). The delete-confirm sheet refreshes `getPlant(plantId)` immediately before opening to ensure freshness.
- **D-09 (location_suggestions upsert):** Upsert on `(user_id, label_normalized)` runs on plant create AND on PATCH location. update-plant.ts performs the upsert; create-plant.ts (05-05) handles the create path.
- **D-10 (i18n defaults):** Default labels live in `src/messages/pt-BR.json` `catalog.locations.defaults` as a string array `[sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro]`. list-locations merges DB + i18n defaults, de-duped by NFKC+lower+trim normalization.
- **D-12 (cursor pagination):** Opaque base64 cursor `{ sort_id, last_value, last_id }`. NULLS LAST sentinel for `acquisition_date`. `?include_count=1` → first-page total ONLY (subsequent cursor pages do not re-fetch the count).
- **D-15 (multipart photo-entry create):** Single multipart POST `/api/v1/plants/:id/photo-entries` carries photo + note in one call. Use-case here delegates to existing `uploadPhoto` (the bytes pipeline is shared with manual plant-add).
- **D-19 (Drizzle isolation):** No Drizzle imports in use-cases. All DB access via `*Repo` modules from `src/contexts/catalog/infrastructure/db/`. Compile guard: `grep "from \"drizzle-orm\"" src/contexts/catalog/application/*.ts` returns 0.
- **D-20 (24h signed URLs):** `ttlSeconds = 24 * 3600` for catalog/journal photo reads. Round-trip serialization keeps the literal in `signCatalogPhotoUrl` callers, NOT in the helper itself (drift control).
- **D-29 (PostHog `plant_edited`):** Fires AFTER UoW resolves (sequential await; see unit-of-work.ts note above). Properties: `{ field: 'name' | 'nickname' | 'location' | 'acquisition_date' | 'notes' }` — uses the schema field name `acquisition_date`, NEVER `ack_date`.
</binding_decisions>

<source_audit>
| Source         | Item                                                                                  | Plan Coverage                                                | Status   |
|----------------|---------------------------------------------------------------------------------------|--------------------------------------------------------------|----------|
| GOAL           | Catalog "Meu Jardim" — plant profile inline-edit + delete, photo journal, sort + offline | All 7 use-cases ship; cover-promote + LWW + cursor + signed URL | COVERED  |
| REQ            | CAT-04 (plant profile detail + cascade counts + inline edit)                          | `update-plant.ts` + `get-plant.ts`                           | COVERED  |
| REQ            | CAT-05 (location picker: prior + defaults + reusable free text)                       | `list-locations.ts` + update-plant location_suggestions upsert | COVERED  |
| REQ            | CAT-06 (photo journal add + reverse-chrono)                                           | `create-photo-entry.ts` + `list-photo-entries.ts` + `delete-photo-entry.ts` | COVERED |
| REQ            | CAT-07 (default sort acquisition_date DESC NULLS LAST)                                | `list-plants.ts` cursor + sort_id mapping                    | COVERED  |
| REQ            | CAT-08 (5-option sort + persists session)                                             | `list-plants.ts` accepts all 5 sort_ids; sessionStorage in 05-15 | COVERED |
| RESEARCH       | Open Q1 sentinel cursor for NULLS LAST                                                | list-plants.ts test cases assert NULLS LAST in both ASC/DESC | COVERED  |
| RESEARCH       | "PostHog capture before TX commit" (line 603) — sequential await pattern              | binding_decisions + interfaces note + per-task action notes  | COVERED  |
| RESEARCH       | "Common Pitfall: signed URL drift" (Pitfall 2 / D-20)                                 | signCatalogPhotoUrl ttl in caller, not literal in helper     | COVERED  |
| CONTEXT (D-03) | Cover auto-promote in same TX                                                         | Task 3 dedicated TDD cycle on bumpCoverFor                   | COVERED  |
| CONTEXT (D-05) | PATCH single-field LWW                                                                | Task 1 update-plant — D-06 LWW server-wins                   | COVERED  |
| CONTEXT (D-06) | LWW server timestamps; no conflict detection                                          | Task 1 — no `If-Unmodified-Since` parsing                    | COVERED  |
| CONTEXT (D-07) | Cascade-counts in get-plant `_meta`                                                   | Task 1 get-plant returns `_meta`                             | COVERED  |
| CONTEXT (D-09) | location_suggestions upsert on PATCH location                                         | Task 1 update-plant location branch                          | COVERED  |
| CONTEXT (D-10) | i18n defaults at catalog.locations.defaults                                           | Task 4 messages extension + list-locations consumer          | COVERED  |
| CONTEXT (D-12) | Opaque cursor + first-page count gate                                                 | Task 2 list-plants                                           | COVERED  |
| CONTEXT (D-15) | Multipart photo-journal add                                                           | Task 3 create-photo-entry delegates to upload-photo          | COVERED  |
| CONTEXT (D-20) | 24h signed thumb URLs                                                                 | Task 3 list-photo-entries + signCatalogPhotoUrl in Task 4    | COVERED  |
| CONTEXT (D-29) | plant_edited PostHog event                                                            | Task 1 update-plant post-commit capture                      | COVERED  |
| THREAT         | T-05-07-01 signed URL TTL leakage                                                     | 24h ceiling, URL minted per-request, never persisted         | COVERED  |
| THREAT         | T-05-07-02 cross-user PATCH existence disclosure                                      | Returns `not_found` (precedent: upload-photo.ts:131)         | COVERED  |
| THREAT         | T-05-07-03 PostHog rollback leakage                                                   | Sequential-await post-commit pattern                         | COVERED  |
| THREAT         | T-05-07-04 cursor manipulation bypassing ownership                                    | `WHERE user_id = $1` filter in repo regardless of cursor     | COVERED  |
| THREAT         | T-05-04-01 prefix-mis-scope (create-photo-entry + delete-photo-entry call sites)      | validateStoragePathOwnership at both sites (per 05-04 SUMMARY) | COVERED |
</source_audit>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: update-plant + get-plant use-cases (TDD)</name>
  <files>
    src/contexts/catalog/application/update-plant.ts
    src/contexts/catalog/application/get-plant.ts
    tests/integration/catalog-update-plant.integration.test.ts
    tests/integration/catalog-get-plant.integration.test.ts
  </files>
  <behavior>
    Two RED→GREEN cycles, one per use-case. Both consume the upstream `findByIdForUser` ownership check, share the discriminated-union result shape, and gate post-commit telemetry behind UoW resolution.

    **Cycle 1A — `update-plant.ts`:**
    - Test 1: Calling `updatePlant({ userId, plantId, patch: { name: "Costela 2" } })` for a plant the user owns returns `{ ok: true, plant }` with the row's `name` updated and `updated_at > old.updated_at`.
    - Test 2: Calling for a plant owned by another user returns `{ ok: false, code: ErrorCode.NotFound, reason: "plant not found" }` (T-05-07-02 — no `forbidden`).
    - Test 3: Calling with patch `{}` returns `{ ok: false, code: ErrorCode.ValidationFailed }` (rejected by `updatePlantInputSchema`).
    - Test 4: Calling with patch `{ unknownKey: "x" }` returns `{ ok: false, code: ErrorCode.ValidationFailed }` (T-05-04-02 — `.strict()`).
    - Test 5: Concurrent PATCHes A then B (B carries newer `name`) — last-write-wins. Final row has B's value; no 409 conflict response surface (D-06).
    - Test 6 (LOCATION BRANCH — D-09): Calling with patch `{ location: "Sala" }` returns `{ ok: true, plant }` AND inserts/upserts a `location_suggestions` row with `label_display = "Sala"`, `label_normalized = "sala"`, `usage_count = 1` (or `usage_count++` if a prior row existed). Verified via direct SELECT inside the test.
    - Test 7 (POSTHOG POST-COMMIT — D-29): Mock `getPostHog()` to return a stub. Successful PATCH fires exactly ONE `capture({ event: "plant_edited", properties: { field: "name" } })` after the UoW commits. The `field` property uses the inferred dirty key.
    - Test 8 (POSTHOG ROLLBACK — T-05-07-03): Force the UoW to throw mid-transaction (e.g., the integration test seeds a plant whose update would violate a CHECK constraint, OR mocks `plantsRepo.update` to throw). Assert the PostHog stub's `capture` is NEVER called.
    - Test 9 (RLS DEFENSE-IN-DEPTH): Repository `WHERE user_id = $1` returns null for cross-user PATCH; no row is mutated.

    **Cycle 1B — `get-plant.ts`:**
    - Test 1: For an owned plant with N photo entries and M reminders, `getPlant({ userId, plantId })` returns `{ ok: true, plant, _meta: { photoEntryCount: N, reminderCount: M } }`.
    - Test 2: For a cross-user plant, returns `{ ok: false, code: ErrorCode.NotFound, reason: "plant not found" }` (T-05-07-02).
    - Test 3: For a plant with zero photo entries and zero reminders, `_meta.photoEntryCount === 0` and `_meta.reminderCount === 0` (D-07 collapse-line UI condition).
    - Test 4: `_meta` keys are camelCase in the use-case return type. The route handler in 05-09 maps to snake_case for the JSON response (PRD §5).
  </behavior>
  <action>
    1. Create both integration test files first (RED):
       - `tests/integration/catalog-update-plant.integration.test.ts`
       - `tests/integration/catalog-get-plant.integration.test.ts`
       Each uses the Phase 2 D-43 transaction-rollback fixture (`tests/integration/db-rollback.ts`) plus the in-memory storage adapter (`tests/integration/setup.ts` from 05-01). Seed users via `tests/integration/fixtures/seed-user.ts` and a helper to insert a Plant row directly via the repo.
       Mock `getPostHog()` via `vi.mock("@shared/telemetry/posthog-server", ...)`. Provide a controllable stub whose `.capture` is `vi.fn()`.

    2. Commit RED with subject `test(05-07): add failing tests for update-plant + get-plant`.

    3. Implement `src/contexts/catalog/application/get-plant.ts`:
       ```ts
       import { ErrorCode } from "@shared/config/errors";
       import { db as defaultDb } from "@shared/db/client";
       import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
       import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";

       export interface GetPlantInput { userId: string; plantId: string }
       export type GetPlantResult =
         | { ok: true; plant: PlantRow; _meta: { photoEntryCount: number; reminderCount: number } }
         | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed; reason: string };

       export async function getPlant(input: GetPlantInput): Promise<GetPlantResult> {
         const plant = await plantsRepo.findByIdForUser(defaultDb, input.userId, input.plantId);
         if (!plant) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
         const counts = await plantsRepo.getCascadeCounts(defaultDb, input.plantId);
         return {
           ok: true,
           plant,
           _meta: { photoEntryCount: counts.photoEntryCount, reminderCount: counts.reminderCount },
         };
       }
       ```

    4. Implement `src/contexts/catalog/application/update-plant.ts`:
       ```ts
       import { ErrorCode } from "@shared/config/errors";
       import { db as defaultDb } from "@shared/db/client";
       import { withUnitOfWork } from "@shared/db/unit-of-work";
       import { getPostHog } from "@shared/telemetry/posthog-server";
       import { updatePlantInputSchema, type UpdatePlantInput } from "@contexts/catalog/domain/schemas";
       import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
       import * as locationSuggestionsRepo from "@contexts/catalog/infrastructure/db/location-suggestions";
       import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";

       export interface UpdatePlantArgs { userId: string; plantId: string; patch: unknown }
       export type UpdatePlantResult =
         | { ok: true; plant: PlantRow }
         | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed; reason: string };

       const EDITED_FIELDS = ["name", "nickname", "location", "acquisitionDate", "notes"] as const;
       type EditedField = (typeof EDITED_FIELDS)[number];

       function inferDirtyField(parsed: UpdatePlantInput): EditedField | null {
         for (const f of EDITED_FIELDS) {
           if (Object.prototype.hasOwnProperty.call(parsed, f)) return f;
         }
         return null;
       }

       // PostHog uses the SCHEMA field name `acquisition_date`, NEVER `ack_date` (D-29 anti-drift).
       const FIELD_TO_POSTHOG: Record<EditedField, string> = {
         name: "name", nickname: "nickname", location: "location",
         acquisitionDate: "acquisition_date", notes: "notes",
       };

       export async function updatePlant(args: UpdatePlantArgs): Promise<UpdatePlantResult> {
         const parseResult = updatePlantInputSchema.safeParse(args.patch);
         if (!parseResult.success) {
           return { ok: false, code: ErrorCode.ValidationFailed, reason: parseResult.error.message };
         }
         const patch = parseResult.data;

         // Ownership check OUTSIDE the UoW — short-circuit cross-user PATCH.
         const owned = await plantsRepo.findByIdForUser(defaultDb, args.userId, args.plantId);
         if (!owned) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };

         // UoW: update plant + (if dirty field is location) upsert suggestion in same TX.
         const updated = await withUnitOfWork(args.userId, async (tx) => {
           const row = await plantsRepo.update(tx, args.userId, args.plantId, patch);
           if (!row) return null; // RLS denied — surface as not_found
           if (typeof patch.location === "string" && patch.location.trim().length > 0) {
             await locationSuggestionsRepo.upsert(tx, args.userId, patch.location);
           }
           return row;
         });

         if (!updated) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };

         // POST-COMMIT telemetry. NO `tx.afterCommit` API exists in Drizzle — sequential await.
         // If withUnitOfWork rejected, this line never runs (T-05-07-03).
         const dirty = inferDirtyField(patch);
         if (dirty !== null) {
           getPostHog()?.capture({
             distinctId: args.userId,
             event: "plant_edited",
             properties: { field: FIELD_TO_POSTHOG[dirty] },
           });
         }

         return { ok: true, plant: updated };
       }
       ```

    5. Run integration tests until GREEN (Cycle 1A then 1B).

    6. REFACTOR: extract `inferDirtyField` if both update-plant and the future Phase 6 identification path need it. Tests stay GREEN.

    7. Commit GREEN with subject `feat(05-07): update-plant + get-plant use-cases`.

    **Anti-pattern guard:** Run after implementation:
    ```
    grep -c "tx\.afterCommit\|afterCommit" src/contexts/catalog/application/update-plant.ts
    ```
    Result MUST be `0`. The "after commit" pattern is sequential await of `withUnitOfWork(...)`, NOT a non-existent Drizzle API.
  </action>
  <verify>
    <automated>pnpm test:run -- catalog-update-plant.integration</automated>
    <automated>pnpm test:run -- catalog-get-plant.integration</automated>
    <automated>node -e "const fs=require('fs'); const txt=fs.readFileSync('src/contexts/catalog/application/update-plant.ts','utf8'); if(/tx\.afterCommit|\bafterCommit\b/.test(txt)){console.error('Forbidden: tx.afterCommit reference');process.exit(1)} console.log('ok');"</automated>
    <automated>node -e "const fs=require('fs'); ['update-plant.ts','get-plant.ts'].forEach(f=>{const t=fs.readFileSync('src/contexts/catalog/application/'+f,'utf8'); if(/from \"drizzle-orm\"/.test(t)){console.error('D-19 violation in',f);process.exit(1)}}); console.log('ok');"</automated>
  </verify>
  <done>
    All 9+4 listed test cases pass under `pnpm test:run`. `update-plant.ts` and `get-plant.ts` export the named symbols. PostHog capture demonstrably skipped on UoW rollback. Cross-user PATCH returns `not_found` (existence-disclosure mitigation verified). location_suggestions upsert verified via direct SELECT in test 6. No Drizzle imports in either file (D-19). No `tx.afterCommit` reference anywhere.
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: list-plants + list-locations use-cases (TDD)</name>
  <files>
    src/contexts/catalog/application/list-plants.ts
    src/contexts/catalog/application/list-locations.ts
    src/messages/pt-BR.json
    tests/integration/catalog-list-plants.integration.test.ts
    tests/integration/catalog-list-locations.integration.test.ts
  </files>
  <behavior>
    Two RED→GREEN cycles. Cycle 2A is the load-bearing cursor pagination; Cycle 2B exercises the i18n + DB merge.

    **Cycle 2A — `list-plants.ts`:**
    - Test 1: Empty catalog (zero plants for the user) — `listPlants({ userId, sort: "date_new", cursor: null, limit: 50, includeCount: true })` returns `{ items: [], nextCursor: null, totalCount: 0 }`.
    - Test 2: 75 plants seeded — first page returns 50 items + `nextCursor` non-null + `totalCount: 75` (because `includeCount: true` AND `cursor === null`).
    - Test 3: Second-page call passing the `nextCursor` from Test 2 returns the remaining 25 plants + `nextCursor: null`. `totalCount` is OMITTED (not included on cursor pages even if `includeCount` is true).
    - Test 4: `limit: 0` → `normalizeLimit` clamps to `DEFAULT_LIMIT (50)`. `limit: 5000` → clamps to `MAX_LIMIT (200)`.
    - Test 5 (sort `date_new`): plants ordered by `acquisition_date DESC NULLS LAST, id DESC`. Plants with NULL `acquisition_date` appear AFTER all dated plants.
    - Test 6 (sort `date_old`): plants ordered by `acquisition_date ASC NULLS LAST, id ASC`. NULL plants STILL appear last (NULLS LAST in BOTH directions per D-12 + RESEARCH Open Q1).
    - Test 7 (sort `name_asc`): plants ordered by `LOWER(name) ASC, id ASC`. Cursor's `last_value` is the lower-cased name string.
    - Test 8 (sort `name_desc`): plants ordered by `LOWER(name) DESC, id DESC`.
    - Test 9 (sort `location`): plants ordered by `LOWER(location) ASC NULLS LAST, id ASC`.
    - Test 10 (CURSOR ROUND-TRIP): every cursor produced by `nextCursor` decodes back to the same `{sort_id, last_value, last_id}` shape.
    - Test 11 (T-05-07-04 — CURSOR MANIPULATION): seed two users U1 + U2, each with 10 plants. Decode U1's `nextCursor` and re-call `listPlants` for U2 with that cursor. The result MUST contain ONLY U2's plants (the WHERE `user_id = $1` filter is applied regardless of cursor contents). Cross-user data leak is impossible.
    - Test 12 (CURSOR TAMPER): pass an invalid base64 string as cursor — returns `{ ok: false, code: ErrorCode.ValidationFailed }`.
    - Test 13 (`includeCount: false`): first-page response omits `totalCount`. (`totalCount` only present when explicitly requested.)

    **Cycle 2B — `list-locations.ts`:**
    - Test 1: User with zero `location_suggestions` rows — returns the 8 i18n defaults `[Sala, Varanda, Quarto, Banheiro, Cozinha, Escritório, Jardim, Outro]` (case-preserved from JSON).
    - Test 2: User with 3 saved locations `[Sala, Varanda, Banheiro]` (all matching defaults case-insensitively) — returns 8 entries (the 3 saved float to the front, ordered by usage_count DESC; the unmatched defaults follow). De-dupe is by NFKC + lower + trim.
    - Test 3: User with a custom location "Estufa" (no default match) — returns 9 entries, "Estufa" first (highest usage_count), defaults follow.
    - Test 4: User with 25 saved locations — `locationSuggestions.listForUser` is called with `limit: 20`; result merges the 20 saved + the 8 defaults, de-duped.
    - Test 5: De-dupe is case-insensitive — saved label "SALA" and default "Sala" collapse to ONE entry (the saved one wins because it has a usage_count).
    - Test 6: De-dupe handles unicode normalization — saved label "Escritório" (NFC) and default "Escritório" (any other normalization) collapse to ONE entry.
    - Test 7: i18n key missing (defensive) — if `catalog.locations.defaults` is unset/empty, returns ONLY the user's saved labels.
  </behavior>
  <action>
    1. **Setup — extend `src/messages/pt-BR.json`** (this MUST happen before list-locations.ts can satisfy Cycle 2B):
       Add inside the existing `"catalog"` object:
       ```jsonc
       "locations": {
         "defaults": ["Sala", "Varanda", "Quarto", "Banheiro", "Cozinha", "Escritório", "Jardim", "Outro"]
       }
       ```
       Verify the JSON parses (`node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"`).

    2. Create both integration test files (RED). Use the existing transaction-rollback fixture and a helper to seed plants in bulk with controllable `acquisition_date` values (including NULL).

    3. Commit RED with subject `test(05-07): add failing tests for list-plants + list-locations`.

    4. Implement `src/contexts/catalog/application/list-plants.ts`:
       ```ts
       import { ErrorCode } from "@shared/config/errors";
       import { db as defaultDb } from "@shared/db/client";
       import {
         decodeSortCursor, encodeSortCursor, normalizeLimit, type SortId,
       } from "@shared/api/cursor";
       import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
       import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";

       export interface ListPlantsInput {
         userId: string; sort: SortId; cursor: string | null; limit: number; includeCount: boolean;
       }
       export type ListPlantsResult =
         | { ok: true; items: PlantRow[]; nextCursor: string | null; totalCount?: number }
         | { ok: false; code: typeof ErrorCode.ValidationFailed; reason: string };

       export async function listPlants(input: ListPlantsInput): Promise<ListPlantsResult> {
         const limit = normalizeLimit(input.limit);
         let cursorPayload: ReturnType<typeof decodeSortCursor> extends infer R ? (R extends { ok: true; value: infer V } ? V : never) : never | null = null;
         if (input.cursor !== null) {
           const decoded = decodeSortCursor(input.cursor);
           if (!decoded.ok) return { ok: false, code: ErrorCode.ValidationFailed, reason: "invalid cursor" };
           if (decoded.value.sortId !== input.sort) {
             return { ok: false, code: ErrorCode.ValidationFailed, reason: "cursor sort mismatch" };
           }
           cursorPayload = decoded.value;
         }

         // T-05-07-04: WHERE user_id = $1 is enforced inside the repo regardless of cursor contents.
         const { rows, nextCursor: nextRaw } = await plantsRepo.list(defaultDb, {
           userId: input.userId, sort: input.sort, cursor: cursorPayload, limit,
         });

         const nextCursor = nextRaw === null ? null : encodeSortCursor(nextRaw);

         // total_count gated on includeCount AND first page (cursor === null) per D-12.
         if (input.includeCount && input.cursor === null) {
           const totalCount = await plantsRepo.countForUser(defaultDb, input.userId);
           return { ok: true, items: rows, nextCursor, totalCount };
         }
         return { ok: true, items: rows, nextCursor };
       }
       ```

    5. Implement `src/contexts/catalog/application/list-locations.ts`:
       ```ts
       import { db as defaultDb } from "@shared/db/client";
       import * as locationSuggestionsRepo from "@contexts/catalog/infrastructure/db/location-suggestions";
       import ptBR from "../../../../messages/pt-BR.json"; // verify path depth at write time

       export interface ListLocationsInput { userId: string }
       export interface LocationItem { labelDisplay: string }
       export type ListLocationsResult = { ok: true; items: LocationItem[] };

       function normalizeLabel(label: string): string {
         return label.normalize("NFKC").toLowerCase().trim();
       }

       export async function listLocations(input: ListLocationsInput): Promise<ListLocationsResult> {
         const saved = await locationSuggestionsRepo.listForUser(defaultDb, input.userId, 20);
         // saved is already ordered by usage_count DESC, last_used_at DESC.
         const defaults: string[] = (ptBR as { catalog?: { locations?: { defaults?: string[] } } })
           .catalog?.locations?.defaults ?? [];

         const seen = new Set<string>();
         const merged: LocationItem[] = [];
         for (const row of saved) {
           const norm = normalizeLabel(row.labelDisplay);
           if (seen.has(norm)) continue;
           seen.add(norm);
           merged.push({ labelDisplay: row.labelDisplay });
         }
         for (const def of defaults) {
           const norm = normalizeLabel(def);
           if (seen.has(norm)) continue;
           seen.add(norm);
           merged.push({ labelDisplay: def });
         }
         return { ok: true, items: merged };
       }
       ```

    6. Run tests until GREEN.

    7. REFACTOR if needed (e.g., factor `normalizeLabel` if any other use-case adds dedup needs — Phase 5 has only one consumer; resist premature extraction). Tests stay GREEN.

    8. Commit GREEN with subject `feat(05-07): list-plants + list-locations + i18n locations.defaults`.
  </action>
  <verify>
    <automated>pnpm test:run -- catalog-list-plants.integration</automated>
    <automated>pnpm test:run -- catalog-list-locations.integration</automated>
    <automated>node -e "const fs=require('fs'); const j=JSON.parse(fs.readFileSync('src/messages/pt-BR.json','utf8')); const d=j.catalog?.locations?.defaults; if(!Array.isArray(d)||d.length!==8){console.error('catalog.locations.defaults missing or wrong length:',d);process.exit(1)} console.log('ok',d);"</automated>
    <automated>node -e "const fs=require('fs'); ['list-plants.ts','list-locations.ts'].forEach(f=>{const t=fs.readFileSync('src/contexts/catalog/application/'+f,'utf8'); if(/from \"drizzle-orm\"/.test(t)){console.error('D-19 violation in',f);process.exit(1)}}); console.log('ok');"</automated>
  </verify>
  <done>
    All 13+7 listed test cases pass. `list-plants.ts` enforces WHERE user_id regardless of cursor contents (T-05-07-04 verified via cross-user cursor manipulation test). `list-locations.ts` reads i18n defaults from `src/messages/pt-BR.json` and de-dupes by NFKC+lower+trim. Both files are Drizzle-import-free.
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 3: Photo-entry CRUD use-cases + cover auto-promote (TDD)</name>
  <files>
    src/contexts/catalog/application/list-photo-entries.ts
    src/contexts/catalog/application/create-photo-entry.ts
    src/contexts/catalog/application/delete-photo-entry.ts
    src/contexts/catalog/infrastructure/photo-storage.ts
    tests/integration/catalog-list-photo-entries.integration.test.ts
    tests/integration/catalog-create-photo-entry.integration.test.ts
    tests/integration/catalog-delete-photo-entry.integration.test.ts
    tests/unit/catalog-sign-photo-url.test.ts
  </files>
  <behavior>
    Three RED→GREEN cycles plus one supporting unit cycle for `signCatalogPhotoUrl`. The cover auto-promote cycle (3C) is the most threat-relevant invariant in the entire plan.

    **Cycle 3-PRE — `signCatalogPhotoUrl` unit (must run first; the consumers in 3A depend on this helper):**
    - Test 1: Given stored URL `"plant-thumbnails/u1/p1/photo.jpg"` and `ttlSeconds: 86400`, helper calls `adapter.createSignedUrl({ bucket: "plant-thumbnails", objectKey: "u1/p1/photo.jpg", expiresInSeconds: 86400 })` and returns the adapter's signed URL.
    - Test 2: Given `"plant-photos/u1/p1/photo.jpg"`, calls adapter with `bucket: "plant-photos"`.
    - Test 3: Given `"plant-thumbnails/u1/p1/sub/photo.jpg"` (multi-segment key after the bucket), preserves the full key path: `objectKey: "u1/p1/sub/photo.jpg"`.
    - Test 4: Given malformed input (no `/`), returns `{ ok: false, reason: "invalid_stored_url" }`.
    - Test 5: Given empty string, returns `{ ok: false, reason: "invalid_stored_url" }`.
    - Test 6: Given unrecognized bucket prefix, returns `{ ok: false, reason: "unknown_bucket" }`.

    **Cycle 3A — `list-photo-entries.ts`:**
    - Test 1: For an owned plant with 3 photo entries, returns `{ ok: true, items: [...] }` ordered by `created_at DESC` (reverse-chronological per CAT-06).
    - Test 2: Cross-user plant — `{ ok: false, code: ErrorCode.NotFound, reason: "plant not found" }` (T-05-07-02).
    - Test 3: Each returned item's `thumbnail_url` is replaced with a freshly minted signed URL via `signCatalogPhotoUrl({ storedUrl, ttlSeconds: 24*3600 })`. The signed URL contains the `?expires=` query parameter. The original DB-persisted `{bucket}/{key}` shape is NEVER returned to the caller.
    - Test 4: Empty plant — returns `{ ok: true, items: [] }`.

    **Cycle 3B — `create-photo-entry.ts`:**
    - Test 1: Owned plant + valid JPEG buffer + note "Cresceu!" — returns `{ ok: true, photoEntry }`. PhotoEntry row exists in DB with the note. Both buckets contain the byte / thumbnail (verified via in-memory adapter inspection).
    - Test 2: Cross-user plant — returns `{ ok: false, code: ErrorCode.NotFound }`. No bucket writes occur (in-memory adapter `Map` size unchanged).
    - Test 3: Note > 500 chars — returns `{ ok: false, code: ErrorCode.ValidationFailed }` (rejected by `createPhotoEntryInputSchema` from 05-04).
    - Test 4: Buffer with GPS EXIF — returns `{ ok: false, code: ErrorCode.ValidationFailed }`. No DB row, no bucket writes.
    - Test 5 (T-05-04-01): The use-case calls `validateStoragePathOwnership({ userId, plantId, key })` BEFORE `uploadOriginalPlantPhoto` runs. Verified via spy/mock asserting call order. If validateStoragePathOwnership returns `{ ok: false }` (impossible with internally-built keys, but defensive), no bucket write occurs.
    - Test 6 (compensating delete): Force `withUnitOfWork` to throw (e.g., mock `photoEntriesRepo.create` to reject with a constraint error). The bucket bytes uploaded in step 6 of upload-photo are deleted via `deleteSinglePlantPhotoBestEffort` (verified via in-memory adapter — both `plant-photos` and `plant-thumbnails` Maps lose the orphaned key). The original error rethrows.
    - Test 7 (REUSE): Verify that `create-photo-entry.ts` calls `uploadPhoto(...)` from `upload-photo.ts` rather than re-implementing steps 1–7. (Spy on the `uploadPhoto` export; assert it was called once.)

    **Cycle 3C — `delete-photo-entry.ts` + cover auto-promote:**
    - Test 1: Owned PhotoEntry deletion returns `{ ok: true }`. Row no longer in DB.
    - Test 2: Cross-user PhotoEntry deletion (one whose plant is owned by another user) — `{ ok: false, code: ErrorCode.NotFound }` (T-05-07-02).
    - Test 3 (D-03 — COVER AUTO-PROMOTE): Plant P with 3 photo entries A (oldest, current cover), B, C. Initial: `Plant.cover_photo_url === A.photo_url`. Delete A. After commit: `Plant.cover_photo_url === B.photo_url` (next-oldest by `created_at ASC`). Atomicity: `bumpCoverFor` ran inside the SAME UoW as the DELETE.
    - Test 4 (D-03 — DELETE NON-COVER): Delete C (the newest). After commit: `Plant.cover_photo_url === A.photo_url` (unchanged). `bumpCoverFor` is still called defensively but is a no-op.
    - Test 5 (D-03 — DELETE LAST PHOTO): Delete the final photo entry. After commit: `Plant.cover_photo_url IS NULL` (no photos remain).
    - Test 6 (T-05-04-01 — second call site): The use-case calls `validateStoragePathOwnership` BEFORE inserting `pending_storage_deletions`. Verified via spy. A bad key never produces a deletion row.
    - Test 7 (PENDING_STORAGE_DELETIONS scope): After deletion, `pending_storage_deletions` contains EXACTLY TWO new rows (one per bucket: `plant-photos` and `plant-thumbnails`). Each row's `prefix` is the FULL canonical photo key `{userId}/{plantId}/{photoId}.{ext}` — NOT a parent prefix that would over-match. Verified via direct SELECT.
    - Test 8 (TX ATOMICITY): Mock `pendingStorageDeletionsRepo.create` to throw on the second call. The PhotoEntry deletion AND the cover bump are rolled back together (DB is unchanged from the pre-delete state). No partial state.
    - Test 9 (NO INNGEST EVENT): Unlike delete-plant (05-06), delete-photo-entry does NOT emit `plant.deleted`. Cleanup happens via the `pending_storage_deletions` reconciler (D-22/D-24). Verify via Inngest spy / send mock.
  </behavior>
  <action>
    1. **Cycle 3-PRE first — `signCatalogPhotoUrl` unit:**

       Add to `src/contexts/catalog/infrastructure/photo-storage.ts` (append after existing exports; do NOT modify existing helpers — they keep their typed input contract for the upload paths):
       ```ts
       const KNOWN_BUCKETS = new Set([PLANT_PHOTOS_BUCKET, PLANT_THUMBNAILS_BUCKET] as const);

       export type SignCatalogPhotoUrlResult =
         | { ok: true; signedUrl: string }
         | { ok: false; reason: "invalid_stored_url" | "unknown_bucket" };

       /**
        * Sign a catalog photo URL for read access. Takes the stored
        * `{bucket}/{key}` shape persisted in `photo_entries.photo_url` and
        * `photo_entries.thumbnail_url` (see `upload-photo.ts:212`). Parses
        * once, delegates to the adapter. Pure function except for the
        * adapter call. D-20: callers pass `ttlSeconds = 24*3600`; the
        * literal stays in the caller, NEVER baked into this helper
        * (drift control).
        */
       export async function signCatalogPhotoUrl(input: {
         storedUrl: string; ttlSeconds: number;
       }): Promise<SignCatalogPhotoUrlResult> {
         const slash = input.storedUrl.indexOf("/");
         if (slash <= 0 || slash >= input.storedUrl.length - 1) {
           return { ok: false, reason: "invalid_stored_url" };
         }
         const bucket = input.storedUrl.slice(0, slash);
         const objectKey = input.storedUrl.slice(slash + 1);
         if (!(KNOWN_BUCKETS as Set<string>).has(bucket)) {
           return { ok: false, reason: "unknown_bucket" };
         }
         const result = await getAdapter().createSignedUrl({
           bucket, objectKey, expiresInSeconds: input.ttlSeconds,
         });
         return { ok: true, signedUrl: result.signedUrl };
       }
       ```

       Create `tests/unit/catalog-sign-photo-url.test.ts` covering Tests 1–6 from Cycle 3-PRE. Use a fake `StorageAdapter` via `__setStorageAdapterForTests`. Run RED → implement → GREEN → commit `feat(05-07): signCatalogPhotoUrl helper`.

    2. **Cycle 3A — list-photo-entries.ts:**

       Implement:
       ```ts
       import { ErrorCode } from "@shared/config/errors";
       import { db as defaultDb } from "@shared/db/client";
       import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
       import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
       import { signCatalogPhotoUrl } from "@contexts/catalog/infrastructure/photo-storage";
       import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";

       const SIGN_TTL_SECONDS = 24 * 3600; // D-20

       export interface ListPhotoEntriesInput { userId: string; plantId: string }
       export type ListPhotoEntriesResult =
         | { ok: true; items: (Omit<PhotoEntryRow, "thumbnailUrl"> & { thumbnailUrl: string })[] }
         | { ok: false; code: typeof ErrorCode.NotFound; reason: string };

       export async function listPhotoEntries(input: ListPhotoEntriesInput): Promise<ListPhotoEntriesResult> {
         const owned = await plantsRepo.findByIdForUser(defaultDb, input.userId, input.plantId);
         if (!owned) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };

         const rows = await photoEntriesRepo.list(defaultDb, { plantId: input.plantId });
         const items = await Promise.all(rows.map(async (row) => {
           const signed = await signCatalogPhotoUrl({ storedUrl: row.thumbnailUrl, ttlSeconds: SIGN_TTL_SECONDS });
           // Defensive fallback: if signing fails (unknown_bucket etc.), surface the row
           // without a usable URL — the route handler can decide to filter or label.
           // Phase 5 only ever stores well-formed URLs, so this branch is unreachable
           // in normal operation but keeps the contract total.
           return { ...row, thumbnailUrl: signed.ok ? signed.signedUrl : row.thumbnailUrl };
         }));
         return { ok: true, items };
       }
       ```

       Write integration test (RED → GREEN). Use the in-memory storage adapter — wire its `createSignedUrl` to return a deterministic stub URL like `"https://signed.example/{bucket}/{objectKey}?expires={ttl}"` so the assertions can grep for `?expires=`.

       Commit RED then GREEN: `feat(05-07): list-photo-entries with 24h signed URLs`.

    3. **Cycle 3B — create-photo-entry.ts:**

       Implement (DELEGATES to `uploadPhoto`):
       ```ts
       import { ErrorCode } from "@shared/config/errors";
       import { uploadPhoto, type UploadPhotoResult } from "@contexts/catalog/application/upload-photo";
       import { createPhotoEntryInputSchema } from "@contexts/catalog/domain/schemas";
       import { validateStoragePathOwnership } from "@contexts/catalog/domain/storage-paths";
       // NOTE: validateStoragePathOwnership defends against constructed path mis-scope.
       // upload-photo internally builds the canonical D-26 path; we re-validate here
       // as a belt-and-braces gate (T-05-04-01 first call site) so a future change
       // that allows callers to pass photoId cannot bypass ownership.
       import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";
       import { randomUUID } from "node:crypto";

       export interface CreatePhotoEntryInput {
         userId: string; plantId: string; buffer: Buffer; contentType: string; note: string | null;
       }
       export type CreatePhotoEntryResult =
         | { ok: true; photoEntry: PhotoEntryRow }
         | { ok: false; code: typeof ErrorCode.ValidationFailed | typeof ErrorCode.NotFound | typeof ErrorCode.Unauthenticated; reason: string };

       export async function createPhotoEntry(input: CreatePhotoEntryInput): Promise<CreatePhotoEntryResult> {
         // Validate the (note + content-type + byte-length) shape via 05-04 schema.
         const schemaResult = createPhotoEntryInputSchema.safeParse({
           contentType: input.contentType, byteLength: input.buffer.byteLength, note: input.note,
         });
         if (!schemaResult.success) {
           return { ok: false, code: ErrorCode.ValidationFailed, reason: schemaResult.error.message };
         }

         // T-05-04-01 first call site — defensive ownership check on the
         // canonical path BEFORE any storage write happens (upload-photo
         // builds the same path internally; this re-check is belt-and-braces).
         const photoId = randomUUID();
         const ext = input.contentType === "image/png" ? "png" : input.contentType === "image/webp" ? "webp" : "jpg";
         const key = `${input.userId}/${input.plantId}/${photoId}.${ext}`;
         const ownership = validateStoragePathOwnership({ userId: input.userId, plantId: input.plantId, key });
         if (!ownership.ok) {
           return { ok: false, code: ErrorCode.ValidationFailed, reason: `storage path ownership: ${ownership.reason}` };
         }

         // Delegate to upload-photo for the steps-1..7 pipeline (single source of truth).
         const result: UploadPhotoResult = await uploadPhoto({
           userId: input.userId, plantId: input.plantId, buffer: input.buffer,
           contentType: input.contentType, photoId, note: input.note,
         });
         return result;
       }
       ```

       Integration test setup must spy on `uploadPhoto` to assert delegation (Test 7) and on `validateStoragePathOwnership` to assert call order (Test 5). Write RED → GREEN. Commit `feat(05-07): create-photo-entry delegating to upload-photo`.

    4. **Cycle 3C — delete-photo-entry.ts (most threat-relevant invariant — D-03 atomicity):**

       Implement:
       ```ts
       import { ErrorCode } from "@shared/config/errors";
       import { db as defaultDb } from "@shared/db/client";
       import { withUnitOfWork } from "@shared/db/unit-of-work";
       import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
       import * as photoEntriesRepo from "@contexts/catalog/infrastructure/db/photo-entries";
       import * as pendingStorageDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
       import { validateStoragePathOwnership } from "@contexts/catalog/domain/storage-paths";
       import {
         PLANT_PHOTOS_BUCKET, PLANT_THUMBNAILS_BUCKET,
       } from "@contexts/catalog/infrastructure/photo-storage";

       export interface DeletePhotoEntryInput { userId: string; plantId: string; photoEntryId: string }
       export type DeletePhotoEntryResult =
         | { ok: true }
         | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed; reason: string };

       /**
        * Parse the stored `{bucket}/{key}` URL (D-26) and return the bucket-relative key.
        * Mirrors signCatalogPhotoUrl's parser but returns the raw key for ownership validation.
        */
       function extractObjectKey(storedUrl: string): string | null {
         const slash = storedUrl.indexOf("/");
         if (slash <= 0 || slash >= storedUrl.length - 1) return null;
         return storedUrl.slice(slash + 1);
       }

       export async function deletePhotoEntry(input: DeletePhotoEntryInput): Promise<DeletePhotoEntryResult> {
         // Ownership check OUTSIDE UoW.
         const owned = await plantsRepo.findByIdForUser(defaultDb, input.userId, input.plantId);
         if (!owned) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };

         await withUnitOfWork(input.userId, async (tx) => {
           const deleted = await photoEntriesRepo.deleteById(tx, input.photoEntryId);
           if (!deleted) {
             // Use Drizzle's tx.rollback to surface as not_found at the caller.
             // (PhotoEntry didn't belong to this plant — never matched the FK chain.)
             // Use a sentinel error wrapper if available; for simplicity throw.
             throw new Error("not_found");
           }
           // T-05-04-01 second call site: validate BOTH bucket-relative keys before scheduling deletion.
           const photoKey = extractObjectKey(deleted.photoUrl);
           const thumbKey = extractObjectKey(deleted.thumbnailUrl);
           if (!photoKey || !thumbKey) throw new Error("validation_failed: malformed stored url");
           const ownPhoto = validateStoragePathOwnership({
             userId: input.userId, plantId: input.plantId, key: photoKey,
           });
           const ownThumb = validateStoragePathOwnership({
             userId: input.userId, plantId: input.plantId, key: thumbKey,
           });
           if (!ownPhoto.ok || !ownThumb.ok) throw new Error("validation_failed: storage ownership");

           // Schedule storage deletion: ONE row per bucket. The `prefix` is the FULL canonical
           // key (NOT a parent prefix) — for a single object, deletePrefix(fullKey) matches
           // exactly that object. T-05-07-04 — never widen scope.
           await pendingStorageDeletionsRepo.create(tx, {
             userId: input.userId, bucket: PLANT_PHOTOS_BUCKET, prefix: photoKey,
           });
           await pendingStorageDeletionsRepo.create(tx, {
             userId: input.userId, bucket: PLANT_THUMBNAILS_BUCKET, prefix: thumbKey,
           });

           // D-03: ALWAYS bump cover after a delete (defensive idempotence; no-op if not cover).
           await photoEntriesRepo.bumpCoverFor(tx, input.plantId);
         }).catch((err: unknown) => {
           const msg = err instanceof Error ? err.message : "";
           if (msg === "not_found") return; // signal up
           throw err;
         });

         // Re-check the final state for the not_found case. Simpler: use a result-typed
         // wrapper instead of throw/catch; the integration test will guide the exact shape.
         // For now, return ok and let the integration test enforce semantics — adjust if Test 2 fails.
         return { ok: true };
       }
       ```

       NOTE: the throw/catch sentinel above is deliberately rough — the integration test for "cross-user delete returns not_found" (Test 2) will drive the final shape. Use a discriminated-union return from the UoW callback (e.g., `{ deleted: PhotoEntryRow | null }`) and surface `not_found` from the OUTER scope cleanly. Refactor under GREEN.

       Integration test must seed 3 photo entries with deterministic `created_at` (use direct SQL inserts to avoid `defaultNow()` collisions — Vitest fake timers OR explicit timestamps separated by ≥1ms) so the cover-promotion order is testable.

       Commit RED → GREEN: `feat(05-07): delete-photo-entry with same-TX cover auto-promote`.

    5. **Anti-pattern guard (post-implementation):**
       ```
       grep -c "validateStoragePathOwnership" src/contexts/catalog/application/create-photo-entry.ts
       grep -c "validateStoragePathOwnership" src/contexts/catalog/application/delete-photo-entry.ts
       ```
       Both MUST be `≥1` (the helper is called at least once in each file — T-05-04-01 mitigation).
  </action>
  <verify>
    <automated>pnpm test:run -- catalog-sign-photo-url</automated>
    <automated>pnpm test:run -- catalog-list-photo-entries.integration</automated>
    <automated>pnpm test:run -- catalog-create-photo-entry.integration</automated>
    <automated>pnpm test:run -- catalog-delete-photo-entry.integration</automated>
    <automated>node -e "const fs=require('fs'); const c=fs.readFileSync('src/contexts/catalog/application/create-photo-entry.ts','utf8'); const d=fs.readFileSync('src/contexts/catalog/application/delete-photo-entry.ts','utf8'); if(!/validateStoragePathOwnership/.test(c)){console.error('T-05-04-01: create-photo-entry missing validateStoragePathOwnership call');process.exit(1)} if(!/validateStoragePathOwnership/.test(d)){console.error('T-05-04-01: delete-photo-entry missing validateStoragePathOwnership call');process.exit(1)} console.log('ok');"</automated>
    <automated>node -e "const fs=require('fs'); ['list-photo-entries.ts','create-photo-entry.ts','delete-photo-entry.ts'].forEach(f=>{const t=fs.readFileSync('src/contexts/catalog/application/'+f,'utf8'); if(/from \"drizzle-orm\"/.test(t)){console.error('D-19 violation in',f);process.exit(1)}}); console.log('ok');"</automated>
  </verify>
  <done>
    All Cycle 3-PRE / 3A / 3B / 3C test cases pass. `signCatalogPhotoUrl` is exported and unit-tested. `validateStoragePathOwnership` called in BOTH create-photo-entry.ts and delete-photo-entry.ts (T-05-04-01 mitigation verified). D-03 cover auto-promote happens in the same UoW as delete. `pending_storage_deletions` rows are scoped to single canonical photo keys (no prefix widening). No Inngest event emitted on photo-entry delete (cleanup is reconciler-driven). All three application files are Drizzle-import-free.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary                       | Description                                                                                                  |
|--------------------------------|--------------------------------------------------------------------------------------------------------------|
| client → API (PATCH/POST/DELETE) | Untrusted JSON / multipart input; parsed via `updatePlantInputSchema` and `createPhotoEntryInputSchema` (05-04). |
| client → API (GET cursor)        | Untrusted opaque base64 cursor; decoded via `decodeSortCursor` (05-02); WHERE user_id filter applied regardless. |
| application → storage adapter    | `validateStoragePathOwnership` is the gate at create-photo-entry AND delete-photo-entry (T-05-04-01).         |
| application → telemetry          | PostHog capture sequenced AFTER `withUnitOfWork` resolves (T-05-07-03 prevents rollback leakage).             |
| application → external storage   | Signed URLs minted per request, 24h TTL ceiling, never persisted to DB row (T-05-07-01).                      |

## STRIDE Threat Register

| Threat ID    | Category | Component                                                       | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                |
|--------------|----------|-----------------------------------------------------------------|-------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-05-07-01   | I        | list-photo-entries signed thumb URLs                             | mitigate    | TTL bound at 24h via constant `SIGN_TTL_SECONDS = 24*3600` in `list-photo-entries.ts`. URL minted per-request via adapter; never written to DB. Serwist runtime cache (D-19, plan 05-18) bounds client-side cache to ≤7d, but signed URL itself dies at 24h regardless of cache layer.       |
| T-05-07-02   | I        | update-plant / get-plant / list-photo-entries / create-photo-entry / delete-photo-entry cross-user reads | mitigate    | All five use-cases return `ErrorCode.NotFound` (NOT `forbidden`) when the caller does not own the plant. Matches existing precedent at `upload-photo.ts:131`. Closed error registry (`src/shared/config/errors.ts`) confirms both codes exist; choosing NotFound prevents existence disclosure. Integration tests (Task 1 Test 2, Task 3 Test 2 / Cycle 3C Test 2) assert this explicitly. |
| T-05-07-03   | R, I     | update-plant `plant_edited` PostHog capture                       | mitigate    | Capture sequenced AFTER `await withUnitOfWork(...)`. Drizzle has no `tx.afterCommit` API — sequential await IS the post-commit pattern. UoW rejection short-circuits; capture line never runs. Test 8 explicitly mocks UoW failure and asserts `ph.capture` is never called. Anti-pattern grep guard rejects `tx.afterCommit` references in source.                                          |
| T-05-07-04   | E        | list-plants cursor manipulation bypassing ownership               | mitigate    | The repository `plants.list({ userId, ... })` applies `WHERE user_id = $1` regardless of cursor contents. Cursor only narrows the result set within the user's already-scoped data. Test 11 (Cycle 2A) seeds two users and replays U1's cursor against U2's call — confirms zero cross-user leakage.                                                                                              |
| T-05-04-01   | E, I     | create-photo-entry / delete-photo-entry storage scope             | mitigate    | `validateStoragePathOwnership` called at BOTH call sites BEFORE any storage write or `pending_storage_deletions` row insert. Per 05-04 SUMMARY, this plan is the wiring plan that closes the load-bearing call sites. Anti-pattern grep guard verifies presence in both files. delete-photo-entry uses the FULL canonical key as `prefix` (single-object scope; never widens to `{userId}/{plantId}/`). |
| T-05-07-05   | T        | update-plant `.strict()` schema bypass via prototype pollution    | mitigate    | `updatePlantInputSchema` (from 05-04) terminates with `.strict()`. Test 4 sends `{ unknownKey: "x" }` and asserts `ValidationFailed`. Combined with Phase 4 + Phase 1 input-handling posture, prototype pollution is denied at the schema layer.                                                                                                                                                  |

`block_on_high: true`. Every threat in the table has a `mitigate` disposition. T-05-07-01 / T-05-07-02 / T-05-07-03 / T-05-07-04 / T-05-04-01 (twin call sites) / T-05-07-05 — all closed within this plan via specific tested invariants.
</threat_model>

<verification>
- `pnpm test:run -- catalog-update-plant.integration` → green (9 cases incl. T-05-07-02 + T-05-07-03 + D-09 location upsert).
- `pnpm test:run -- catalog-get-plant.integration` → green (4 cases incl. _meta cascade counts).
- `pnpm test:run -- catalog-list-plants.integration` → green (13 cases incl. NULLS LAST in both directions + T-05-07-04 cross-user cursor manipulation).
- `pnpm test:run -- catalog-list-locations.integration` → green (7 cases incl. unicode normalization de-dupe).
- `pnpm test:run -- catalog-list-photo-entries.integration` → green (4 cases — signed URL minting, reverse-chrono).
- `pnpm test:run -- catalog-create-photo-entry.integration` → green (7 cases incl. compensating-delete on TX failure + uploadPhoto delegation).
- `pnpm test:run -- catalog-delete-photo-entry.integration` → green (9 cases — D-03 cover auto-promote in 3 scenarios + atomic rollback + T-05-04-01 second call site + scoped prefix).
- `pnpm test:run -- catalog-sign-photo-url` → green (6 unit cases).
- `pnpm test:run` (full unit + integration) → green (no collateral breakage).
- `pnpm tsc --noEmit` → green.
- Grep guards (Task 1, 2, 3 verify blocks): zero forbidden patterns (`tx.afterCommit`, `from "drizzle-orm"` in `application/*.ts`).
- `validateStoragePathOwnership` present in BOTH create-photo-entry.ts and delete-photo-entry.ts (T-05-04-01 wiring closed).
- `src/messages/pt-BR.json` `catalog.locations.defaults` is an 8-element string array.
</verification>

<success_criteria>
- All 7 use-cases exported from `src/contexts/catalog/application/`: updatePlant, getPlant, listPlants, listPhotoEntries, createPhotoEntry, deletePhotoEntry, listLocations.
- `signCatalogPhotoUrl` exported from `src/contexts/catalog/infrastructure/photo-storage.ts`; unit-tested; existing `signOriginalUrl` / `signThumbnailUrl` UNCHANGED.
- `src/messages/pt-BR.json` extended with `catalog.locations.defaults` 8-element array — no other top-level keys altered.
- D-19 invariant: zero `from "drizzle-orm"` imports in any of the 7 application files.
- D-03 invariant: `bumpCoverFor` called inside the SAME UoW as `photoEntries.deleteById`, in the same TX. Verified via Cycle 3C Tests 3 / 4 / 5 / 8.
- D-06 invariant: update-plant returns the server-merged row; no client-side conflict surface.
- D-09 invariant: PATCH location triggers `location_suggestions` upsert IN THE SAME UoW. Verified via Cycle 1A Test 6.
- D-12 invariant: `total_count` returned only when `includeCount && cursor === null`. Verified via Cycle 2A Tests 2 / 3 / 13.
- D-20 invariant: list-photo-entries thumbnails signed at exactly `24*3600` seconds. Verified via Cycle 3A Test 3 (URL grep `expires=86400`).
- D-29 invariant: `plant_edited` PostHog event uses `field: "acquisition_date"` (snake_case schema name), NEVER `ack_date`. Verified via Cycle 1A Test 7.
- T-05-04-01 closed: `validateStoragePathOwnership` is called in create-photo-entry AND delete-photo-entry. Verified via grep guard + spy tests.
- T-05-07-02 closed: cross-user reads return `not_found`. Verified across all 5 cross-user test cases.
- T-05-07-03 closed: PostHog capture skipped on UoW rollback. Verified via Cycle 1A Test 8 (force UoW failure, assert capture never called).
- T-05-07-04 closed: cursor manipulation cannot bypass `WHERE user_id = $1`. Verified via Cycle 2A Test 11 (cross-user cursor replay).
- VALIDATION.md Per-Task Verification Map populated for Task 1 / 2 / 3 (the planner updates this map after the SUMMARY ships — see <output>).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-07-patch-photo-entry-cover-use-cases-SUMMARY.md` covering:

- **New artifacts:** 7 application use-cases, signCatalogPhotoUrl helper, catalog.locations.defaults i18n key.
- **TDD cycles:** 8 RED commits, 8 GREEN commits (one per cycle: 1A, 1B, 2A, 2B, 3-PRE, 3A, 3B, 3C — author may group same-task RED commits if they fit within Conventional Commit discipline).
- **Unblocks:** 05-08 (route handlers — read+create endpoints consume listPlants/getPlant/listPhotoEntries/listLocations/createPhotoEntry), 05-09 (route handlers — mutate+delete endpoints consume updatePlant/deletePhotoEntry), 05-15/05-16/05-17 (UI plans).
- **D-03 invariant verified:** Cover auto-promote in same UoW. Document Cycle 3C Tests 3/4/5/8 outcomes.
- **T-05-04-01 wiring closed:** validateStoragePathOwnership at both call sites. The 05-04 SUMMARY's "Open follow-ups" reminder is now resolved.
- **VALIDATION.md update:** Add three rows to the Per-Task Verification Map (Task 1, Task 2, Task 3) with the test commands listed in `<verify>`. Note `nyquist_compliant: true` cannot flip until ALL Phase 5 plans complete this map; this SUMMARY only adds rows for 05-07.
- **Open follow-ups for downstream plans:**
  - 05-08 (`POST /api/v1/plants/:id/photo-entries`): the route handler must reject GPS-bearing uploads via `rejectGpsMetadata` BEFORE delegating to `createPhotoEntry` (defense in depth — `uploadPhoto` already does this internally; documented for handler-side audit logs).
  - 05-09 (`DELETE /api/v1/photo-entries/:id`): handler must call `deletePhotoEntry` and translate the discriminated-union result to errorResponse codes per PRD §5 closed registry.
  - 05-15 (`<CatalogGrid>`): consumes `listPlants` cursor pagination — useInfiniteQuery `getNextPageParam = (page) => page.nextCursor`. The `total_count` is rendered in `<CatalogHeader>` only on the first page query.
  - 05-17 (`<AddPhotoSheet>`): consumes `createPhotoEntry`; client-side EXIF strip per PROJECT constraints; multipart shape matches D-15.
- **Anti-pattern audit:** No `tx.afterCommit` references; no Drizzle imports in application/; no scope reduction (every D-XX invariant tested).
</output>
