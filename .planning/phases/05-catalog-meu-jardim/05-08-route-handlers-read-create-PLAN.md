---
phase: 05-catalog-meu-jardim
plan: 08
type: execute
wave: 3
depends_on: ["05-05", "05-07"]
files_modified:
  - src/app/api/v1/plants/route.ts
  - src/app/api/v1/plants/[plantId]/route.ts
  - src/app/api/v1/plants/[plantId]/photo-entries/route.ts
  - src/app/api/v1/locations/route.ts
  - tests/integration/catalog-routes-read-create.integration.test.ts
autonomous: true
requirements:
  - CAT-02
  - CAT-03
  - CAT-04
  - CAT-05
  - CAT-06
  - CAT-07
  - CAT-08
tags: [catalog, route-handlers, multipart, idempotency, cursor-pagination, signed-urls]

must_haves:
  truths:
    - "POST /api/v1/plants accepts a multipart body (name + photo + optional fields), routes through requireVerifiedUser → withIdempotency → createPlant use-case, and returns 201 with snake_case plant JSON. The Idempotency-Key header is REQUIRED on this route (closed-registry validation_failed otherwise) per D-02 + Phase 2 D-37 (first route consumer)."
    - "POST /api/v1/plants/[plantId]/photo-entries accepts a multipart body (photo + optional note), routes through requireVerifiedUser → withIdempotency → createPhotoEntry use-case, and returns 201 with snake_case photo_entry JSON (D-15)."
    - "GET /api/v1/plants returns a JSON page envelope `{ items, next_cursor, total_count? }` — `total_count` only present when ?include_count=1 is passed AND no cursor is present (first page only, per D-12); `sort` query param accepts the 5 D-11 sort_id values; `cursor` and `limit` flow through encodeSortCursor / decodeSortCursor + normalizeLimit."
    - "GET /api/v1/plants/[plantId] returns the plant + `_meta: { photo_entry_count, reminder_count }` for the D-07 delete-confirm cascade preview."
    - "GET /api/v1/plants/[plantId]/photo-entries returns the journal items with 24h-TTL signed thumbnail + photo URLs minted per request (D-20)."
    - "GET /api/v1/locations returns merged user suggestions + i18n defaults from `messages/pt-BR.json` `catalog.locations.defaults` (D-09 + D-10), de-duped by normalized label."
    - "Every route is gated by `requireVerifiedUser` (Phase 4 D-21) — first route-handler consumer of that helper. Unverified or unauthenticated requests return the closed-registry `email_unverified` 403 or `unauthenticated` 401 respectively."
    - "Zero Drizzle imports in any of the four route files (Phase 2 D-17 / T-02-11). Verified by the existing tests/unit/no-drizzle-in-routes.test.ts allowlist scan AND by an explicit grep gate in the integration suite."
    - "Every error response goes through `errorResponse(code, message)` with codes drawn ONLY from the closed registry (`unauthenticated`, `email_unverified`, `validation_failed`, `not_found`, `forbidden`, `read_only_mode`, `subscription_required`, `conflict` for Idempotency-Key hash mismatch). NO ad-hoc codes."
  artifacts:
    - path: "src/app/api/v1/plants/route.ts"
      provides: "GET (list) + POST (multipart create with withIdempotency) handlers"
      exports: ["GET", "POST", "runtime"]
      contains: "export const runtime = \"nodejs\""
    - path: "src/app/api/v1/plants/[plantId]/route.ts"
      provides: "GET (plant detail + cascade counts) handler — PATCH/DELETE land in 05-09"
      exports: ["GET"]
      contains: "requireVerifiedUser"
    - path: "src/app/api/v1/plants/[plantId]/photo-entries/route.ts"
      provides: "GET (list with signed URLs) + POST (multipart create with withIdempotency) handlers"
      exports: ["GET", "POST", "runtime"]
      contains: "export const runtime = \"nodejs\""
    - path: "src/app/api/v1/locations/route.ts"
      provides: "GET (merged user suggestions + i18n defaults) handler"
      exports: ["GET"]
      contains: "requireVerifiedUser"
    - path: "tests/integration/catalog-routes-read-create.integration.test.ts"
      provides: "Integration test suite covering multipart create, snake_case JSON shape, closed-registry error mapping, cursor round-trip, ?include_count=1 first-page total, idempotent replay, and hash-mismatch 409"
      contains: "describe(\"POST /api/v1/plants\""
  key_links:
    - from: "src/app/api/v1/plants/route.ts POST"
      to: "src/contexts/catalog/application/create-plant.ts (from 05-05)"
      via: "withIdempotency wraps the createPlant call so the (userId, key) idempotency row is committed in the same TX as the Plant + first PhotoEntry rows"
      pattern: "withIdempotency\\("
    - from: "src/app/api/v1/plants/route.ts GET"
      to: "src/contexts/catalog/application/list-plants.ts (from 05-07) + src/shared/api/cursor.ts encodeSortCursor"
      via: "Query-string `?sort=&cursor=&limit=&include_count=` parsed at handler boundary, opaque cursor decoded via decodeSortCursor; result encoded back via encodeSortCursor"
      pattern: "list-plants\\.ts"
    - from: "src/app/api/v1/plants/[plantId]/photo-entries/route.ts POST"
      to: "src/contexts/catalog/application/create-photo-entry.ts (from 05-07) + src/shared/api/idempotency.ts withIdempotency"
      via: "withIdempotency-wrapped multipart upload reuses the upload-photo compensating-delete pattern from 05-05"
      pattern: "withIdempotency\\("
    - from: "src/app/api/v1/plants/[plantId]/photo-entries/route.ts GET"
      to: "src/contexts/catalog/application/list-photo-entries.ts (from 05-07) + src/contexts/catalog/infrastructure/photo-storage.ts signOriginalUrl/signThumbnailUrl"
      via: "Use-case mints 24h-TTL signed URLs per item before returning to handler"
      pattern: "signThumbnailUrl|signOriginalUrl"
    - from: "src/app/api/v1/locations/route.ts GET"
      to: "src/contexts/catalog/application/list-locations.ts (from 05-07)"
      via: "Use-case merges location_suggestions repo output with messages/pt-BR.json `catalog.locations.defaults` and de-dupes by normalized label"
      pattern: "list-locations\\.ts"
---

<objective>
Ship six route handlers across four files (`/api/v1/plants` GET/POST, `/api/v1/plants/[plantId]` GET, `/api/v1/plants/[plantId]/photo-entries` GET/POST, `/api/v1/locations` GET) plus one integration test file. Every handler is thin (no Drizzle imports per Phase 2 D-17), gated by `requireVerifiedUser` (Phase 4 D-21 — this plan is the first route-level consumer), and emits closed-registry errors via `errorResponse`. Two POST endpoints wrap their use-cases in `withIdempotency` (Phase 2 D-37 — first route-level consumer of that helper). Snake_case response keys per PRD §5.

Purpose: Phase 5 use-cases (created in 05-05 and 05-07) need an HTTP edge so the catalog SSR page (05-15) and client surfaces (05-16, 05-17) can consume them. This plan covers the read + create endpoints; the mutate (PATCH) and delete (DELETE) endpoints land in 05-09. PATTERNS.md Key Findings #1 + #2 flag that `requireVerifiedUser` and `withIdempotency` have NO existing route consumers — this plan ships both first wire-ups.

Output:
- 4 route handler files exporting GET/POST/runtime as appropriate.
- 1 integration test file proving multipart create round-trip, snake_case shape, cursor pagination, ?include_count=1 first-page total, idempotent replay, hash-mismatch conflict, and 24h-TTL signed URLs in journal listings.
- Threat-model coverage for the four ASVS L1 surfaces in this plan's scope (multipart EXIF leakage, idempotency-key collisions, signed URL TTL leakage, RLS bypass via cursor).
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
@.planning/phases/05-catalog-meu-jardim/05-02-pending-deletions-schema-cursor-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-PLAN.md
@CLAUDE.md
@src/shared/api/auth.ts
@src/shared/api/idempotency.ts
@src/shared/api/cursor.ts
@src/shared/config/errors.ts
@src/app/api/v1/photos/upload/route.ts
@src/app/api/v1/iam/me/route.ts

<interfaces>
<!-- Contracts the executor uses directly. No codebase exploration needed. -->

From `src/shared/api/auth.ts` (Phase 4 D-21 — this plan is the first route-level consumer):
```typescript
export type VerifiedUserResult =
  | { ok: true; user: UserRow }
  | {
      ok: false;
      code: typeof ErrorCode.Unauthenticated | typeof ErrorCode.EmailUnverified;
      reason: string;
    };
export async function requireVerifiedUser(request: Request): Promise<VerifiedUserResult>;
```
Caller pattern: `const r = await requireVerifiedUser(request); if (!r.ok) return errorResponse(r.code, "..."); /* use r.user.id */`. NEVER surface `r.reason` to clients (Plan 02-08 WR-02 — jose error names aid attacker fingerprinting).

From `src/shared/api/idempotency.ts` (Phase 2 D-37 — this plan is the first route-level consumer):
```typescript
export interface WithIdempotencyInput {
  userId: string;
  key: string;
  requestHash: string; // REQUIRED. Stable hash of request body.
}
export interface IdempotencyResult { status: number; body: unknown; replayed: boolean; }
export type IdempotencyHandler = (tx: TransactionalDb) => Promise<{ status: number; body: unknown }>;
export async function withIdempotency(
  input: WithIdempotencyInput,
  handler: IdempotencyHandler,
): Promise<IdempotencyResult>;
```
Behavior contract:
- First call with `(userId, key, requestHash)` → executes `handler(tx)`, stores response, returns `{ status, body, replayed: false }`.
- Replay same `(userId, key, requestHash)` → returns stored response, `replayed: true`. Handler NOT invoked.
- Hash mismatch on existing `(userId, key)` → returns `{ status: 409, body: <conflict registry body>, replayed: true }`. Handler NOT invoked.
- Handler throws → tx rolls back, idempotency row vanishes, retry is a fresh first call.

From `src/shared/api/cursor.ts` (extended in 05-02 with sort-aware codec):
```typescript
export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;
export function encodeSortCursor(payload: SortCursorPayload): string; // {sort_id, last_value, last_id}
export function decodeSortCursor(encoded: string): { ok: true; value: SortCursorPayload } | { ok: false; error: typeof ErrorCode.ValidationFailed };
export function normalizeLimit(input: string | number | null | undefined): number;
```

From `src/shared/config/errors.ts`:
```typescript
export const ErrorCode = { Unauthenticated, EmailUnverified, Forbidden, ValidationFailed, NotFound, Conflict, ReadOnlyMode, SubscriptionRequired, /* ... */ } as const;
export function errorResponse(code: ErrorCode, message: string, details?: Record<string, unknown>): Response;
```

From `src/contexts/catalog/application/create-plant.ts` (from 05-05):
```typescript
export type CreatePlantInput =
  | {
      source: "manual";
      userId: string;
      name: string;
      photoBuffer: Buffer;
      photoContentType: string;
      nickname?: string | null;
      location?: string | null;
      acquisitionDate?: string | null; // ISO yyyy-MM-dd
      notes?: string | null;
    }
  | { source: "identification"; /* Phase 6 only — NOT exercised here */ };
export type CreatePlantResult =
  | { ok: true; plant: PlantRow; photoEntry: PhotoEntryRow }
  | { ok: false; code: ErrorCode; reason: string };
export function createPlant(input: CreatePlantInput, tx?: TransactionalDb): Promise<CreatePlantResult>;
```
NOTE: 05-05 is responsible for the exact signature; if the executor finds a slightly different shape on disk after 05-05 ships, follow the on-disk types and adapt the handler. The discriminator is `source: 'manual'` for Phase 5.

From `src/contexts/catalog/application/list-plants.ts` (from 05-07):
```typescript
export type ListPlantsInput = {
  userId: string;
  sort: "name_asc" | "name_desc" | "date_new" | "date_old" | "location";
  cursor: SortCursorPayload | null;
  limit: number;
  includeCount: boolean; // only honored when cursor === null (first page)
};
export type ListPlantsResult = {
  items: PlantRow[];
  nextCursor: SortCursorPayload | null;
  totalCount: number | null; // null unless includeCount && cursor === null
};
export function listPlants(input: ListPlantsInput): Promise<ListPlantsResult>;
```

From `src/contexts/catalog/application/get-plant.ts` (from 05-07):
```typescript
export type GetPlantResult =
  | { ok: true; plant: PlantRow; meta: { photoEntryCount: number; reminderCount: number } }
  | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.Forbidden; reason: string };
export function getPlant(input: { userId: string; plantId: string }): Promise<GetPlantResult>;
```

From `src/contexts/catalog/application/list-photo-entries.ts` (from 05-07):
```typescript
export type PhotoEntryWithUrls = { id: string; plantId: string; photoUrl: string; thumbnailUrl: string; note: string | null; createdAt: string };
export type ListPhotoEntriesResult =
  | { ok: true; items: PhotoEntryWithUrls[] }
  | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.Forbidden; reason: string };
export function listPhotoEntries(input: { userId: string; plantId: string }): Promise<ListPhotoEntriesResult>;
```

From `src/contexts/catalog/application/create-photo-entry.ts` (from 05-07):
```typescript
export type CreatePhotoEntryInput = {
  userId: string;
  plantId: string;
  photoBuffer: Buffer;
  photoContentType: string;
  note: string | null;
};
export type CreatePhotoEntryResult =
  | { ok: true; photoEntry: PhotoEntryRow }
  | { ok: false; code: ErrorCode; reason: string };
export function createPhotoEntry(input: CreatePhotoEntryInput, tx?: TransactionalDb): Promise<CreatePhotoEntryResult>;
```

From `src/contexts/catalog/application/list-locations.ts` (from 05-07):
```typescript
export type LocationOption = { label_display: string };
export function listLocations(input: { userId: string; locale: string }): Promise<{ items: LocationOption[] }>;
```

From `src/contexts/catalog/domain/schemas.ts` (from 05-04):
```typescript
export const createPlantInputSchema: ZodType<CreatePlantInput>; // .superRefine: name + photo required
export const createPhotoEntryInputSchema: ZodType<CreatePhotoEntryInput>; // file + optional note ≤500 chars
```

Reference patterns to copy verbatim (do NOT diverge):
- Multipart parsing + `runtime = "nodejs"` + closed-registry error mapping: `src/app/api/v1/photos/upload/route.ts:1-104`.
- JSON-only PATCH + Zod safeParse + Sessão inválida copy: `src/app/api/v1/iam/me/route.ts:28-84`.
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Multipart create endpoints with withIdempotency (POST /plants + POST /plants/[plantId]/photo-entries)</name>
  <files>
    src/app/api/v1/plants/route.ts,
    src/app/api/v1/plants/[plantId]/photo-entries/route.ts,
    tests/integration/catalog-routes-read-create.integration.test.ts
  </files>
  <behavior>
    Tests written FIRST in `tests/integration/catalog-routes-read-create.integration.test.ts` under `describe("POST /api/v1/plants", ...)` and `describe("POST /api/v1/plants/[plantId]/photo-entries", ...)`. Each describe block asserts:

    POST /api/v1/plants:
    - **Test 1.1 (auth gate):** Request without session cookies → 401 `unauthenticated`.
    - **Test 1.2 (verified gate):** Request with cookies for an unverified user → 403 `email_unverified` (drives D-21 first route consumer).
    - **Test 1.3 (idempotency-key required):** Verified user, valid multipart, NO `Idempotency-Key` header → 400 `validation_failed` with message mentioning the header (per D-02 + Phase 2 D-37 contract for mutating endpoints).
    - **Test 1.4 (multipart parse failure):** Verified user, body is `application/json` → 400 `validation_failed` with `multipart parse failed:` prefix (mirror photos/upload route).
    - **Test 1.5 (missing required fields):** Verified user, multipart missing `name` → 400 `validation_failed` with field path `name`. Multipart missing `photo` → 400 `validation_failed` with field path `photo`. Multipart missing both → 400 with both field paths in `details.issues` (drives CAT-03 + D-04 ≥2-error summary).
    - **Test 1.6 (happy path 201 + snake_case):** Verified user, valid multipart with name + photo + nickname + location + acquisition_date + notes + `Idempotency-Key: <uuid>` → 201 with body `{ plant: { id, user_id, species_id, name, nickname, location, acquisition_date, notes, cover_photo_url, created_at, updated_at }, photo_entry: { id, plant_id, photo_url, thumbnail_url, note, created_at } }`. Every key snake_case. Plant row exists in DB; photo_entry row exists with plant_id linking back.
    - **Test 1.7 (idempotent replay):** Repeat Test 1.6 with the SAME `Idempotency-Key` and SAME multipart bytes → 201 with the EXACT same response body. Only ONE plant row exists in the DB after both calls (count == 1, not 2).
    - **Test 1.8 (hash-mismatch conflict):** Repeat Test 1.6 with the SAME `Idempotency-Key` but a DIFFERENT name → 409 `conflict` with the registry conflict message. Only ONE plant row exists in the DB (the original from Test 1.6).
    - **Test 1.9 (no-Drizzle-in-route gate):** `grep -E "from .drizzle-orm|from .@contexts/.*infrastructure/db" src/app/api/v1/plants/route.ts` returns zero lines (PRD/D-17 invariant; covered by tests/unit/no-drizzle-in-routes.test.ts but assert here too with `grep -v '^//' | grep -c ...` to dodge comment false-positives per planner critical rule).

    POST /api/v1/plants/[plantId]/photo-entries (mirrors POST /plants but for journal entries):
    - **Test 2.1 (auth gate / verified gate / idempotency-key required / multipart parse failure):** Same shape as Tests 1.1–1.4.
    - **Test 2.2 (plant ownership 404):** Verified user calls POST for a plant_id owned by another user → 404 `not_found` (use-case returns NotFound; route maps verbatim). NO journal row created.
    - **Test 2.3 (happy path 201 + snake_case):** Verified user, valid multipart with photo + note + `Idempotency-Key` for an OWNED plant → 201 with `{ photo_entry: { id, plant_id, photo_url, thumbnail_url, note, created_at } }`. Row exists in DB.
    - **Test 2.4 (idempotent replay):** Same key + same bytes → identical response, ONE row in DB.
    - **Test 2.5 (no-Drizzle-in-route gate):** Same grep as Test 1.9 against `[plantId]/photo-entries/route.ts`.

    Idempotency-Key requestHash strategy (LOCKED — executor must implement exactly this):
    - For multipart bodies, compute `requestHash = sha256(headerKey || ":" || sha256(rawBodyBytes))` where `rawBodyBytes` comes from `await request.clone().arrayBuffer()` BEFORE `request.formData()` consumes the stream. The `headerKey` prefix prevents collisions between multipart and JSON requests on the same `(userId, key)` row. Use `crypto.createHash("sha256")` (Node built-in). The multipart boundary varies per request, so a re-encoded retry from a different client will compute a different hash and surface as 409 `conflict` — that is the intended semantic per Phase 2 T-02-16.
    - Helper: introduce `computeMultipartRequestHash(request: Request): Promise<{ ok: true; hash: string } | { ok: false; code: ErrorCode.ValidationFailed; reason: string }>` co-located in the route file (or as a small shared helper in `src/shared/api/idempotency-hash.ts` if both routes need it — executor's discretion; one helper file is preferred to avoid drift).
  </behavior>
  <action>
    Implement BOTH POST endpoints test-first. Workflow:

    1. **RED — write the integration test file FIRST** at `tests/integration/catalog-routes-read-create.integration.test.ts`. Include the full `describe("POST /api/v1/plants", ...)` and `describe("POST /api/v1/plants/[plantId]/photo-entries", ...)` blocks per the `<behavior>` Tests 1.1–1.9 + 2.1–2.5. Reuse `tests/integration/photo-upload.integration.test.ts:73-147` for the in-memory storage adapter wiring (Phase 5 D-27 — already plumbed in 05-01). Reuse Phase 2's transaction-rollback fixture for DB cleanup (D-43). Use `tests/integration/fixtures/seed-user.ts` for user creation and the existing cookie-injection helper for verified-session requests. RED commit: `pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts` MUST fail (route files do not exist yet). Commit subject: `test(05-08): add failing route tests for plants + photo-entries POST`.

    2. **GREEN — implement POST /api/v1/plants** at `src/app/api/v1/plants/route.ts`:
       - `export const runtime = "nodejs"` (multipart + sharp downstream).
       - `export async function POST(request: Request): Promise<Response>`:
         a. `const auth = await requireVerifiedUser(request); if (!auth.ok) return errorResponse(auth.code, auth.code === ErrorCode.EmailUnverified ? "Verifique seu email para continuar." : "Sessão inválida.");` — NEVER pass `auth.reason` to the client (Plan 02-08 WR-02).
         b. `const idempotencyKey = request.headers.get("idempotency-key")?.trim(); if (!idempotencyKey) return errorResponse(ErrorCode.ValidationFailed, "Cabeçalho Idempotency-Key obrigatório.");` per D-02 enforcement.
         c. Compute `requestHash` via `computeMultipartRequestHash(request)` BEFORE `request.formData()`. On failure → return `errorResponse(ValidationFailed, ...)`.
         d. `let formData: FormData; try { formData = await request.formData(); } catch (error) { ... return errorResponse(ValidationFailed, "multipart parse failed: ...") }` — mirror `photos/upload/route.ts:46-51`.
         e. Extract fields: `name` (string), `photo` (File), `nickname` (string|null), `location` (string|null), `acquisition_date` (string|null), `notes` (string|null). Convert `photo` to `Buffer` via `Buffer.from(await photo.arrayBuffer())`.
         f. Build `CreatePlantInput` with `source: "manual"` discriminator (per D-02 + 05-05 contract; the `source: "identification"` branch is Phase 6's call).
         g. Run `createPlantInputSchema.safeParse(input)` (from 05-04). On failure → `errorResponse(ValidationFailed, "Validação falhou.", { issues: parsed.error.issues })` — D-04 surfaces all error paths so the client can render the ≥2-error summary block.
         h. Wrap in `withIdempotency`:
            ```typescript
            const result = await withIdempotency({ userId: auth.user.id, key: idempotencyKey, requestHash }, async (tx) => {
              const usecase = await createPlant(parsed.data, tx);
              if (!usecase.ok) return { status: HTTP_STATUS[usecase.code], body: { error: { code: usecase.code, message: usecase.reason } } };
              return {
                status: 201,
                body: {
                  plant: toPlantSnakeCase(usecase.plant),
                  photo_entry: toPhotoEntrySnakeCase(usecase.photoEntry),
                },
              };
            });
            return new Response(JSON.stringify(result.body), { status: result.status, headers: { "content-type": "application/json" } });
            ```
            — `toPlantSnakeCase` / `toPhotoEntrySnakeCase` are local helpers (or extract to `src/contexts/catalog/api/snake-case.ts` if both POST + GET need them; executor's discretion). Mirror `photos/upload/route.ts:91-103` snake_case shape.
       - NO Drizzle imports. NO `@contexts/*/infrastructure/db/*` imports. Verified by tests/unit/no-drizzle-in-routes.test.ts plus the explicit grep gate in Test 1.9.
       - Run `pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts -t "POST /api/v1/plants"`. MUST pass Tests 1.1–1.9.
       - Commit: `feat(05-08): POST /api/v1/plants multipart + idempotency`.

    3. **GREEN — implement POST /api/v1/plants/[plantId]/photo-entries** at `src/app/api/v1/plants/[plantId]/photo-entries/route.ts`:
       - Same skeleton as POST /plants, but:
         - The route's second arg is `{ params }: { params: Promise<{ plantId: string }> }`; await `params` to extract `plantId` (Next 16 App Router convention — verify against Plan 04 route patterns; if `params` is sync there, follow that).
         - Delegate to `createPhotoEntry({ userId, plantId, photoBuffer, photoContentType, note }, tx)` from 05-07.
         - Validate input via `createPhotoEntryInputSchema` from 05-04.
         - Snake_case response: `{ photo_entry: { id, plant_id, photo_url, thumbnail_url, note, created_at } }`.
       - Run `pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts -t "POST /api/v1/plants/\\[plantId\\]/photo-entries"`. MUST pass Tests 2.1–2.5.
       - Commit: `feat(05-08): POST /api/v1/plants/[plantId]/photo-entries multipart + idempotency`.

    4. **REFACTOR (only if duplication is real):** If `toPlantSnakeCase` / `toPhotoEntrySnakeCase` / `computeMultipartRequestHash` are duplicated across both files, extract to `src/contexts/catalog/api/snake-case.ts` and `src/shared/api/idempotency-hash.ts`. Keep handlers thin. Re-run tests. Commit: `refactor(05-08): extract shared snake_case + multipart-hash helpers`.

    Decisions to honor (LOCKED):
    - D-02: Single multipart POST atomically creates Plant + first PhotoEntry. The use-case from 05-05 owns the TX; the route just wires multipart → use-case.
    - D-15: Photo-entry POST uses the same compensating-delete pattern from upload-photo.ts:217 (use-case from 05-07 owns it).
    - D-37 (Phase 2): Idempotency-Key required on both POSTs. First route consumers; helper enforces hash-mismatch-409 semantics.
    - PRD §5: snake_case JSON keys; closed error registry only.
    - D-17 (Phase 2): NO Drizzle in route handlers; tests/unit/no-drizzle-in-routes.test.ts is the standing gate.
  </action>
  <verify>
    <automated>pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts tests/unit/no-drizzle-in-routes.test.ts</automated>
  </verify>
  <done>
    `src/app/api/v1/plants/route.ts` exports `POST` + `runtime = "nodejs"`. `src/app/api/v1/plants/[plantId]/photo-entries/route.ts` exports `POST` + `runtime = "nodejs"`. Tests 1.1–1.9 + 2.1–2.5 pass. tests/unit/no-drizzle-in-routes.test.ts passes (no Drizzle imports added to route files). Three commits land (RED, GREEN-plants, GREEN-photo-entries; optional REFACTOR commit if extraction needed).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Read endpoints (GET /plants list + cursor + ?include_count, GET /plants/[plantId], GET /plants/[plantId]/photo-entries with signed URLs, GET /locations)</name>
  <files>
    src/app/api/v1/plants/route.ts,
    src/app/api/v1/plants/[plantId]/route.ts,
    src/app/api/v1/plants/[plantId]/photo-entries/route.ts,
    src/app/api/v1/locations/route.ts,
    tests/integration/catalog-routes-read-create.integration.test.ts
  </files>
  <behavior>
    Add new `describe(...)` blocks to the SAME integration test file from Task 1. Each block asserts:

    GET /api/v1/plants:
    - **Test 3.1 (auth/verified gates):** Same as Tests 1.1–1.2.
    - **Test 3.2 (default sort + first page):** Verified user with 3 plants seeded. `GET /api/v1/plants` → 200 with `{ items: [...], next_cursor: null, total_count: <undefined> }`. `items.length === 3`. `total_count` MUST be absent (or null) when `?include_count` not provided. `items` ordered by `acquisition_date DESC NULLS LAST` (CAT-07 default) — the seed should include one plant with `acquisition_date = null` to verify NULLS LAST sentinel.
    - **Test 3.3 (?include_count=1 first page):** Same seed. `GET /api/v1/plants?include_count=1` → 200 with `total_count === 3`. With cursor present (e.g., `?cursor=abc&include_count=1`) → 200 with `total_count` absent (D-12 first-page-only contract).
    - **Test 3.4 (sort variants):** `?sort=name_asc`, `?sort=name_desc`, `?sort=date_old`, `?sort=location` each return correctly ordered items. Invalid `?sort=foo` → 400 `validation_failed`.
    - **Test 3.5 (cursor pagination):** Seed 5 plants. `GET /api/v1/plants?limit=2` → 200 with `items.length === 2`, `next_cursor !== null`. `GET /api/v1/plants?limit=2&cursor=<next_cursor>` → 200 with the next 2 items, `next_cursor !== null`. Final page: `items.length === 1`, `next_cursor === null`.
    - **Test 3.6 (cursor tampering):** `GET /api/v1/plants?cursor=<malformed-base64>` → 400 `validation_failed`. (Mitigation T-05-08-04: opaque cursor is server-validated; the route never trusts arbitrary client SQL fragments.)
    - **Test 3.7 (limit clamping):** `?limit=99999` clamps to 200 (MAX_LIMIT). `?limit=0` clamps to 1. `?limit=abc` defaults to 50 (DEFAULT_LIMIT).

    GET /api/v1/plants/[plantId]:
    - **Test 4.1 (auth/verified gates):** Same as Tests 1.1–1.2.
    - **Test 4.2 (not found / cross-user):** `GET /plants/<random-uuid>` → 404 `not_found`. `GET /plants/<other-user-plant-id>` → 404 `not_found` (NOT 403 — closed-registry posture per Phase 2 to avoid existence leakage; verify against 05-07's get-plant.ts use-case behavior, follow what it returns).
    - **Test 4.3 (happy path + cascade meta):** Seed plant with 3 photo entries + 2 reminders. `GET /plants/<id>` → 200 with `{ plant: { ...snake_case... }, _meta: { photo_entry_count: 3, reminder_count: 2 } }`. `_meta` is the snake_case key per PRD §5 (NOT `meta` — match the must-have spec).

    GET /api/v1/plants/[plantId]/photo-entries:
    - **Test 5.1 (auth/verified gates):** Same as Tests 1.1–1.2.
    - **Test 5.2 (cross-user):** `GET /plants/<other-user-plant-id>/photo-entries` → 404 `not_found`.
    - **Test 5.3 (happy path + signed URLs):** Seed plant with 2 photo entries. `GET /plants/<id>/photo-entries` → 200 with `{ items: [{ id, plant_id, photo_url, thumbnail_url, note, created_at }, ...] }`. `photo_url` and `thumbnail_url` are signed URLs (contain `token=` or `expires_at=` query param — exact shape comes from the in-memory storage adapter mock). 24h TTL is the use-case's contract; the route just returns what the use-case provides.

    GET /api/v1/locations:
    - **Test 6.1 (auth/verified gates):** Same as Tests 1.1–1.2.
    - **Test 6.2 (defaults + suggestions merged):** Verified user with no location_suggestions rows. `GET /api/v1/locations` → 200 with `{ items: [{ label_display: "sala" }, ..., { label_display: "outro" }] }` — exactly the 8 D-10 defaults (`messages/pt-BR.json` `catalog.locations.defaults`).
    - **Test 6.3 (user suggestions take priority):** Seed `location_suggestions` row `(userId, "sacada", "Sacada", usage_count=5, last_used_at=now())`. `GET /api/v1/locations` → 200 with `items[0].label_display === "Sacada"` (top of list per D-09 ranking). The defaults still appear after, de-duped by normalized label.

    No-Drizzle-in-routes gate (covered by Task 1's grep + tests/unit/no-drizzle-in-routes.test.ts) extends to all four route files.
  </behavior>
  <action>
    Implement all four READ endpoints test-first.

    1. **RED — extend the integration test file** with the GET describe blocks per `<behavior>` Tests 3.1–3.7, 4.1–4.3, 5.1–5.3, 6.1–6.3. Use the same seed-user + cookie-injection fixtures from Task 1. Run `pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts`. MUST fail on every new test (route files don't have GET handlers yet, locations/route.ts doesn't exist, [plantId]/route.ts doesn't exist). Commit: `test(05-08): add failing tests for plants + photo-entries + locations GET handlers`.

    2. **GREEN — implement GET /api/v1/plants** in `src/app/api/v1/plants/route.ts` (file already exists from Task 1; add the GET handler):
       - `export async function GET(request: Request): Promise<Response>`:
         a. `requireVerifiedUser` — same pattern as POST. Map errors verbatim.
         b. Parse query params:
            ```typescript
            const url = new URL(request.url);
            const sortRaw = url.searchParams.get("sort") ?? "date_new";
            const VALID_SORTS = new Set(["name_asc", "name_desc", "date_new", "date_old", "location"] as const);
            if (!VALID_SORTS.has(sortRaw as never)) return errorResponse(ValidationFailed, "Sort inválido.");
            const cursorRaw = url.searchParams.get("cursor");
            let cursor: SortCursorPayload | null = null;
            if (cursorRaw) {
              const decoded = decodeSortCursor(cursorRaw);
              if (!decoded.ok) return errorResponse(ValidationFailed, "Cursor inválido.");
              cursor = decoded.value;
            }
            const limit = normalizeLimit(url.searchParams.get("limit"));
            const includeCount = url.searchParams.get("include_count") === "1" && cursor === null;
            ```
         c. Call `listPlants({ userId: auth.user.id, sort: sortRaw, cursor, limit, includeCount })`.
         d. Encode `next_cursor` via `encodeSortCursor(result.nextCursor)` if non-null; else `null`.
         e. Return:
            ```typescript
            const body: { items: unknown[]; next_cursor: string | null; total_count?: number } = {
              items: result.items.map(toPlantSnakeCase),
              next_cursor: result.nextCursor ? encodeSortCursor(result.nextCursor) : null,
            };
            if (result.totalCount !== null) body.total_count = result.totalCount;
            return Response.json(body, { status: 200 });
            ```
       - Re-run integration tests for GET /plants. Tests 3.1–3.7 MUST pass.
       - Commit: `feat(05-08): GET /api/v1/plants cursor + ?include_count`.

    3. **GREEN — implement GET /api/v1/plants/[plantId]** at `src/app/api/v1/plants/[plantId]/route.ts` (NEW file):
       - `export async function GET(request: Request, { params }: { params: Promise<{ plantId: string }> }): Promise<Response>`:
         a. `requireVerifiedUser`.
         b. `const { plantId } = await params;` (Next 16 async params).
         c. Validate `plantId` is a UUID (use `z.string().uuid().safeParse(plantId)` or simple regex; on fail → 400 `validation_failed`).
         d. Call `getPlant({ userId: auth.user.id, plantId })`.
         e. On `!ok` → `errorResponse(result.code, result.reason)`.
         f. On `ok` → return `Response.json({ plant: toPlantSnakeCase(result.plant), _meta: { photo_entry_count: result.meta.photoEntryCount, reminder_count: result.meta.reminderCount } }, { status: 200 })`.
       - **NOTE — wave-3 file-overlap with 05-09:** This file ALSO needs PATCH + DELETE handlers from plan 05-09. Plan 05-09 will add those exports to the SAME file. Coordinator-level resolution required (see PLAN COMPLETE return). For this plan's scope: ship ONLY the GET export. If the executor sees a pre-existing skeleton from 05-09 (because the orchestrator resequenced), merge GET into it without removing PATCH/DELETE.
       - Re-run integration tests for GET /plants/[plantId]. Tests 4.1–4.3 MUST pass.
       - Commit: `feat(05-08): GET /api/v1/plants/[plantId] + cascade meta`.

    4. **GREEN — implement GET /api/v1/plants/[plantId]/photo-entries** in the existing file from Task 1:
       - `export async function GET(request: Request, { params }: { params: Promise<{ plantId: string }> }): Promise<Response>`:
         a. `requireVerifiedUser`.
         b. Await params, validate plantId UUID.
         c. Call `listPhotoEntries({ userId: auth.user.id, plantId })`. The use-case (from 05-07) is responsible for minting 24h-TTL signed URLs.
         d. On `!ok` → `errorResponse(result.code, result.reason)`.
         e. On `ok` → return `Response.json({ items: result.items.map(toPhotoEntryWithUrlsSnakeCase) }, { status: 200 })`.
       - Re-run integration tests. Tests 5.1–5.3 MUST pass.
       - Commit: `feat(05-08): GET /api/v1/plants/[plantId]/photo-entries with signed URLs`.

    5. **GREEN — implement GET /api/v1/locations** at `src/app/api/v1/locations/route.ts` (NEW file):
       - `export async function GET(request: Request): Promise<Response>`:
         a. `requireVerifiedUser`.
         b. Locale from next-intl is `pt-BR` for now (single-locale per CLAUDE.md). The use-case from 05-07 owns the locale → defaults mapping; the route passes `locale: "pt-BR"` (or reads from `getLocale()` if Phase 5 already wires that pattern).
         c. Call `listLocations({ userId: auth.user.id, locale: "pt-BR" })`.
         d. Return `Response.json({ items: result.items }, { status: 200 })` — the use-case already returns `{ label_display: string }` shape; no further mapping needed.
       - Re-run integration tests. Tests 6.1–6.3 MUST pass.
       - Commit: `feat(05-08): GET /api/v1/locations merged defaults + suggestions`.

    6. **REFACTOR (only if duplication real):** Extract `toPlantSnakeCase` / `toPhotoEntrySnakeCase` / `toPhotoEntryWithUrlsSnakeCase` to `src/contexts/catalog/api/snake-case.ts` if both POST + GET handlers use them (likely). Re-run tests. Commit: `refactor(05-08): consolidate snake_case mappers`.

    Decisions to honor (LOCKED):
    - D-12: Cursor + `?include_count=1` first-page total. Cursor opaque, NULLS LAST sentinel for nullable acquisition_date. Page size 50, max 200.
    - D-11: Sort sort_id ∈ {name_asc, name_desc, date_new, date_old, location}; default date_new. (Persistence is sessionStorage-side at 05-15 — route just accepts the param.)
    - D-09 + D-10: Locations response merges DB suggestions + i18n defaults; use-case owns the merge.
    - D-20: 24h-TTL signed URLs for photo + thumbnail; use-case owns minting.
    - D-21: This plan does NOT branch on read-only mode at the route level (read endpoints always succeed when authorized; mutating affordances are hidden client-side per D-21 → Phase 5 client uses `useSubscription()` stub from 05-11).

    Decision references in code: each handler's leading comment block cites D-XX numbers it implements. Example: `// D-02 (multipart create), D-37 (idempotency), PRD §5 (snake_case + closed registry).`
  </action>
  <verify>
    <automated>pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts tests/unit/no-drizzle-in-routes.test.ts</automated>
  </verify>
  <done>
    All four route files exist with the GET exports listed in must-haves. Tests 3.1–3.7 + 4.1–4.3 + 5.1–5.3 + 6.1–6.3 all pass. tests/unit/no-drizzle-in-routes.test.ts passes. Snake_case JSON keys verified by integration tests asserting exact key strings. ?include_count=1 only adds total_count on first page (cursor === null). Cursor round-trips losslessly across at least 3 pages. Five+ commits land (RED extension, four GREEN per endpoint, optional REFACTOR).
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Untrusted client → Next.js route handler | Multipart bodies, query params, headers (Idempotency-Key, cookies) cross here. Source of all malicious input vectors enumerated below. |
| Route handler → Application use-case | Validated typed inputs only. The route is the LAST place to enforce input shape; use-cases trust their inputs. |
| Application use-case → Storage adapter | Path-ownership validation (from 05-04 `validateStoragePathOwnership`) gates every storage write/delete. Out-of-scope for this plan but listed for traceability. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-08-01 | I / D | Multipart upload size + EXIF/GPS leakage on POST `/plants` and POST `/plants/[plantId]/photo-entries` | mitigate | Client compresses ≤1 MB + strips EXIF (CLAUDE.md). Server defense in depth: `createPlantInputSchema` / `createPhotoEntryInputSchema` (from 05-04) reject content-types outside `image/{jpeg,png,webp}` and byte lengths >`MAX_UPLOAD_BYTES` (1 MB). The use-case (from 05-05/05-07) calls `rejectGpsMetadata` from Phase 2 D-30 BEFORE any storage write. Route handler scope here: surface 400 `validation_failed` with the offending field path; never write to storage when validation fails. |
| T-05-08-02 | T / R | Idempotency-Key collisions on POST `/plants` and POST `/plants/[plantId]/photo-entries` | mitigate | First route consumers of `withIdempotency` (Phase 2 D-37). Helper enforces (userId, key, requestHash) uniqueness via Postgres `INSERT ... ON CONFLICT DO NOTHING RETURNING`. Hash-mismatch on existing (userId, key) → 409 `conflict` (Test 1.8 / 2.4 prove it). Helper invokes the use-case inside the same transaction so a thrown handler rolls back BOTH the idempotency row and the use-case writes (Phase 2 T-02-36 mitigation). The route's `requestHash` strategy is locked: `sha256(headerKey || ":" || sha256(rawBodyBytes))` against `request.clone().arrayBuffer()` BEFORE `formData()` consumes the stream — guarantees the same key + same body always replays. |
| T-05-08-03 | I | Signed URL TTL leakage in journal list response | mitigate | Use-case mints 24h-TTL signed URLs per request (D-20). URLs are NOT stored long-term in the response cache layer; SW cache (05-18) is keyed by full signed URL, so each new mint produces a new cache key. The 7-day Serwist max-age (D-19) applies to the JSON response envelope, not the underlying photo bytes — so when JSON falls out of cache, no further bytes are served. Route handler scope here: do NOT cache signed URLs server-side; mint per request. |
| T-05-08-04 | E | RLS bypass via cursor manipulation on GET `/plants` | mitigate | (Mitigation lives in 05-07 list-plants.ts use-case — listed here for surface traceability.) Cursor is opaque base64url JSON `{sort_id, last_value, last_id}`; `decodeSortCursor` (from 05-02) parses into a typed schema (NOT freeform). The use-case then composes a parameterized Drizzle query against the user's RLS-bound TX — the cursor cannot inject WHERE values or change the `auth.uid()` boundary. Route handler scope: validate cursor decode succeeded; reject malformed → 400 `validation_failed` (Test 3.6 proves it). |
| T-05-08-05 | I | Plant existence leakage on GET `/plants/[plantId]` and POST `/plants/[plantId]/photo-entries` for cross-user plantId | mitigate | The use-case (05-07 get-plant.ts) returns `NotFound` (NOT `Forbidden`) when a plantId is owned by another user — closed-registry posture per Phase 2 mirrors the auth error surface and avoids confirming the plant exists. Route handler scope: pass `result.code` verbatim through `errorResponse`. Tests 4.2 + 2.2 prove the 404 response. |

`block_on_high: true` per ASVS L1 — every threat above has `mitigate` disposition and a concrete mitigation pointer. No `accept` dispositions.
</threat_model>

<verification>
- All integration tests pass: `pnpm vitest run tests/integration/catalog-routes-read-create.integration.test.ts`
- No Drizzle imports in any route file: `pnpm vitest run tests/unit/no-drizzle-in-routes.test.ts`
- Manual grep gate (defense in depth):
  ```bash
  grep -E "from .drizzle-orm|from .@contexts/.*infrastructure/db" src/app/api/v1/plants/route.ts src/app/api/v1/plants/\[plantId\]/route.ts src/app/api/v1/plants/\[plantId\]/photo-entries/route.ts src/app/api/v1/locations/route.ts | grep -v '^//' | wc -l
  ```
  MUST output `0` (per planner critical rules — `grep -v '^//'` strips comment false-positives).
- Snake_case shape verified by integration tests asserting exact key strings (`plant.user_id`, `photo_entry.plant_id`, `_meta.photo_entry_count`, `next_cursor`, `total_count`).
- Type-check green: `pnpm tsc --noEmit`.
- Lint green: `pnpm lint`.
</verification>

<success_criteria>
- `src/app/api/v1/plants/route.ts` exports `GET`, `POST`, `runtime = "nodejs"` and contains zero Drizzle imports.
- `src/app/api/v1/plants/[plantId]/route.ts` exports `GET` (PATCH + DELETE land in 05-09; coexistence required — see PLAN COMPLETE return).
- `src/app/api/v1/plants/[plantId]/photo-entries/route.ts` exports `GET`, `POST`, `runtime = "nodejs"`.
- `src/app/api/v1/locations/route.ts` exports `GET`.
- POST /plants accepts multipart, requires `Idempotency-Key`, returns 201 with snake_case `{ plant, photo_entry }`, replays on same key+body, 409s on key+different body.
- POST /plants/[plantId]/photo-entries mirrors above for journal entries.
- GET /plants returns `{ items, next_cursor, total_count? }`; total_count only on first page when `?include_count=1`. Cursor pagination round-trips across pages. Limit clamps to [1, 200].
- GET /plants/[plantId] returns plant + `_meta: { photo_entry_count, reminder_count }`. Cross-user → 404.
- GET /plants/[plantId]/photo-entries returns items with 24h-TTL signed URLs.
- GET /locations returns merged user suggestions + i18n defaults.
- Every error response uses closed-registry codes only.
- Every handler calls `requireVerifiedUser` (first route-level consumers of Phase 4 D-21).
- All integration tests + no-drizzle gate green.
- Threat register: 5/5 mitigated (no `accept` dispositions).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-08-SUMMARY.md` per the standard summary template, including:
- Final decision pointer table (every D-XX referenced and where it shipped).
- Closed-registry error code coverage table (which routes emit which codes).
- Idempotency-Key requestHash strategy notes (the exact `sha256(headerKey || ":" || sha256(rawBytes))` pattern for future maintainers).
- Cross-plan coordination note for 05-09: confirm PATCH + DELETE were added to `[plantId]/route.ts` without disturbing the GET handler from this plan.
- Pointer to the integration test file (`tests/integration/catalog-routes-read-create.integration.test.ts`) for future regression debugging.
</output>
