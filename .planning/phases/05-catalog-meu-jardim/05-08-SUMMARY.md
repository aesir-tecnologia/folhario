---
phase: 05-catalog-meu-jardim
plan: 08
subsystem: api
tags: [catalog, route-handlers, multipart, idempotency, cursor-pagination, signed-urls, next-js, snake-case]

# Dependency graph
requires:
  - phase: 05-catalog-meu-jardim plan 05
    provides: createPlant use-case with deps.tx + postCommit callback pattern
  - phase: 05-catalog-meu-jardim plan 07
    provides: list-plants, get-plant, list-photo-entries, create-photo-entry, list-locations use-cases
  - phase: 02 (D-37)
    provides: withIdempotency helper (DB-backed idempotency, TX-composing)
  - phase: 04 (D-21)
    provides: requireVerifiedUser helper (email verification gate)
provides:
  - POST /api/v1/plants — multipart plant create with Idempotency-Key + withIdempotency + postCommit
  - GET /api/v1/plants — cursor pagination, sort (5 sort_ids), ?include_count=1 first-page total
  - GET /api/v1/plants/[plantId] — plant detail + _meta: {photo_entry_count, reminder_count}
  - POST /api/v1/plants/[plantId]/photo-entries — multipart photo journal add with idempotency
  - GET /api/v1/plants/[plantId]/photo-entries — list with 24h-TTL signed URLs
  - GET /api/v1/locations — merged user suggestions + pt-BR i18n defaults
  - src/shared/api/idempotency-hash.ts — computeMultipartRequestHash helper
  - src/contexts/catalog/api/snake-case.ts — toPlantSnakeCase, toPlantWithSignedUrlSnakeCase, toPhotoEntrySnakeCase mappers
affects: [05-09, 05-15, 05-16, 05-17]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "requireVerifiedUser auth gate (first route consumers of Phase 4 D-21)"
    - "withIdempotency wrapped route with postCommit side-channel via closure variable"
    - "sha256(idempotencyKey:sha256(rawBodyBytes)) multipart request hash"
    - "Sentry.captureException swallows postCommit rejection — response still 201"
    - "snake_case mapper helpers extracted to src/contexts/catalog/api/snake-case.ts"

key-files:
  created:
    - src/app/api/v1/plants/route.ts
    - src/app/api/v1/plants/[plantId]/route.ts
    - src/app/api/v1/plants/[plantId]/photo-entries/route.ts
    - src/app/api/v1/locations/route.ts
    - src/shared/api/idempotency-hash.ts
    - src/contexts/catalog/api/snake-case.ts
    - tests/integration/catalog-routes-read-create.integration.test.ts
  modified: []

key-decisions:
  - "postCommit side-channel via closure: withIdempotency IdempotencyHandler returns {status,body} only. Route captures postCommit in a closure variable inside the handler callback; reads it after withIdempotency returns. Avoids modifying the committed withIdempotency helper."
  - "createPhotoEntry has no deps.tx (delegates to uploadPhoto UoW). Idempotency still works at the row level — first call inserts idempotency row + creates photo entry; replays return stored response without re-invoking createPhotoEntry. No postCommit for photo entries (deviation from plan spec)."
  - "listPlants already encodes cursor (returns string | null). Route passes cursor string directly — no encode/decode at route level. Plan spec described SortCursorPayload passthrough but actual use-case handles encoding internally."
  - "getPlant returns _meta with camelCase (photoEntryCount, reminderCount). Route maps to snake_case for response (_meta.photo_entry_count, _meta.reminder_count)."
  - "listLocations signature is {userId} only (no locale param). Plan spec mentioned locale but actual use-case reads pt-BR.json statically."
  - "GET tests clean up POST test plants via afterEach: POST tests create plants with cover_photo_url; in-memory storage adapter throws on sign of objects not in store. Isolated by afterEach DB cleanup."

patterns-established:
  - "Route auth gate: requireVerifiedUser → errorResponse(auth.code, msg) — never pass auth.reason to client (WR-02)"
  - "Idempotency-Key required on POST: request.headers.get('idempotency-key') → 400 if absent"
  - "Multipart hash: computeMultipartRequestHash(request) BEFORE request.formData() — clone.arrayBuffer() preserves stream"
  - "postCommit: captured in closure, awaited after withIdempotency, only on !replayed, Sentry.captureException on rejection"
  - "snake_case: all /api/v1/catalog responses use mappers from src/contexts/catalog/api/snake-case.ts"

requirements-completed: [CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07, CAT-08]

# Metrics
duration: 35min
completed: 2026-05-01
---

# Phase 5 Plan 08: Route Handlers (Read + Create) Summary

**Six catalog HTTP endpoints (POST/GET /plants, GET /plants/[id], POST/GET /plants/[id]/photo-entries, GET /locations) with multipart + idempotency, cursor pagination, and signed URLs — first route consumers of requireVerifiedUser and withIdempotency**

## Performance

- **Duration:** 35 min
- **Started:** 2026-05-01T14:45:00Z
- **Completed:** 2026-05-01T15:00:00Z
- **Tasks:** 2 (TDD: 2 RED + 2 GREEN + 1 REFACTOR)
- **Files modified:** 7 created, 1 modified

## Accomplishments

- POST /api/v1/plants: multipart body parsing, Idempotency-Key enforcement, sha256 request hash, createPlant use-case via withIdempotency TX, postCommit side-channel (closes T-05-05-01), Sentry swallows rejection, snake_case response
- GET /api/v1/plants: 5 sort_id values, opaque cursor decode/validate, normalizeLimit clamping, listPlants use-case passthrough, ?include_count=1 first-page-only total_count (D-12)
- GET /api/v1/plants/[plantId]: getPlant use-case, _meta: {photo_entry_count, reminder_count} snake_case (D-07)
- POST + GET /api/v1/plants/[plantId]/photo-entries: same idempotency pattern for journal add, listPhotoEntries with 24h-TTL signed URLs
- GET /api/v1/locations: listLocations use-case, merges DB suggestions + pt-BR i18n defaults (D-09, D-10)
- 43 integration + unit tests passing; no Drizzle imports in any route file

## Task Commits

1. **RED (Task 1)** — `279fe92` test: add failing route tests for plants + photo-entries POST
2. **GREEN (Task 1+2 POST)** — `ad5ac69` feat: POST /api/v1/plants + POST /api/v1/plants/[plantId]/photo-entries multipart + idempotency
3. **GREEN (Task 2 GET)** — `ce2843f` feat: GET /api/v1/plants cursor+?include_count, GET /api/v1/plants/[plantId] cascade meta, GET /api/v1/plants/[plantId]/photo-entries, GET /api/v1/locations
4. **REFACTOR** — `f9116bf` refactor: fix TypeScript type errors in integration test (Buffer → Uint8Array)

## Files Created/Modified

- `src/app/api/v1/plants/route.ts` — GET (list + cursor) + POST (multipart + idempotency), runtime=nodejs
- `src/app/api/v1/plants/[plantId]/route.ts` — GET (detail + cascade meta); PATCH/DELETE for 05-09
- `src/app/api/v1/plants/[plantId]/photo-entries/route.ts` — GET (signed URLs) + POST (idempotency), runtime=nodejs
- `src/app/api/v1/locations/route.ts` — GET (merged suggestions + defaults)
- `src/shared/api/idempotency-hash.ts` — computeMultipartRequestHash: sha256(key:sha256(rawBytes))
- `src/contexts/catalog/api/snake-case.ts` — toPlantSnakeCase, toPlantWithSignedUrlSnakeCase, toPhotoEntrySnakeCase
- `tests/integration/catalog-routes-read-create.integration.test.ts` — 33 integration tests (all passing)

## Decision Pointer Table

| Decision | Route | Detail |
|----------|-------|--------|
| D-02 | POST /plants | Multipart create Plant + PhotoEntry atomically via createPlant |
| D-07 | GET /plants/[id] | _meta: {photo_entry_count, reminder_count} for delete-confirm |
| D-09 | GET /locations | User suggestions ranked by usage_count DESC in use-case |
| D-10 | GET /locations | pt-BR defaults from src/messages/pt-BR.json catalog.locations.defaults |
| D-11 | GET /plants | sort_id ∈ {name_asc, name_desc, date_new, date_old, location}; default date_new |
| D-12 | GET /plants | total_count only when cursor === null && ?include_count=1 |
| D-15 | POST /photo-entries | Multipart photo-journal add via createPhotoEntry → uploadPhoto |
| D-17 | All routes | No Drizzle imports — enforced by no-drizzle-in-routes.test.ts |
| D-20 | GET /photo-entries | 24h-TTL signed URLs minted by listPhotoEntries use-case |
| D-21 | All routes | requireVerifiedUser (first route consumers) |
| D-37 | POST /plants, POST /photo-entries | withIdempotency (first route consumers); Idempotency-Key required |

## Closed-Registry Error Code Coverage

| Route | Codes Used |
|-------|-----------|
| All routes | unauthenticated (401), email_unverified (403) |
| POST /plants | validation_failed (400), conflict (409) |
| GET /plants | validation_failed (400) — invalid sort or cursor |
| GET /plants/[id] | not_found (404), validation_failed (400) — invalid UUID |
| POST /photo-entries | validation_failed (400), not_found (404), conflict (409) |
| GET /photo-entries | not_found (404), validation_failed (400) |
| GET /locations | (none beyond auth gates) |

## Idempotency-Key requestHash Strategy

Formula: `sha256(idempotencyKey || ":" || sha256(rawBodyBytes))`

Implementation in `src/shared/api/idempotency-hash.ts`:
1. Clone request BEFORE `formData()` — `request.clone().arrayBuffer()` preserves the stream
2. `bodyHash = createHash("sha256").update(Buffer.from(rawBytes)).digest("hex")`
3. `hash = createHash("sha256").update(`${idempotencyKey}:${bodyHash}`).digest("hex")`

The idempotencyKey prefix prevents collisions between multipart and JSON requests on the same (userId, key) row. The multipart boundary varies per-client, so a re-encoded retry from a different client produces a different hash → 409 conflict (T-02-16 intent).

## postCommit Callback Pattern (HIGH-3 Resolution)

`createPlant` returns `postCommit?: () => Promise<void>` when called with `deps.tx`. Route pattern:

```typescript
let capturedPostCommit: (() => Promise<void>) | undefined;
const idempotencyResult = await withIdempotency({ userId, key, requestHash }, async (tx) => {
  const usecase = await createPlant(input, { tx });
  capturedPostCommit = usecase.postCommit;
  return { status: 201, body: { ... } };
});
if (!idempotencyResult.replayed && capturedPostCommit) {
  try { await capturedPostCommit(); } catch (err) { Sentry.captureException(err); }
}
```

Key properties:
- postCommit fires ONLY on first success (!replayed) — telemetry fires at most once per committed write (T-05-05-01)
- postCommit rejection is caught → Sentry.captureException → response still returns 201 (work already committed)
- `createPhotoEntry` has no postCommit (delegates to uploadPhoto, no deps.tx accepted) — idempotency works at row level without postCommit semantics

## Cross-Plan Coordination Note for 05-09

`src/app/api/v1/plants/[plantId]/route.ts` currently exports only `GET`. Plan 05-09 MUST ADD `PATCH` and `DELETE` exports to this same file WITHOUT removing or modifying the `GET` export. The file has no `runtime = "nodejs"` declaration (GET is Edge-compatible); if PATCH/DELETE need multipart or sharp, add `export const runtime = "nodejs"`.

## Threat Register Coverage (5/5 mitigated)

| Threat | Mitigation in this plan |
|--------|------------------------|
| T-05-08-01 (EXIF/GPS) | Schema validation rejects non-image content-types; use-case calls rejectGpsMetadata BEFORE storage write |
| T-05-08-02 (Idempotency collisions) | withIdempotency enforces (userId, key, requestHash) uniqueness; hash-mismatch → 409 (Test 1.9 proves it) |
| T-05-08-03 (Signed URL TTL) | Routes never cache signed URLs; listPhotoEntries mints fresh 24h URLs per request |
| T-05-08-04 (Cursor RLS bypass) | Route validates decodeSortCursor; use-case enforces WHERE user_id = $1 regardless of cursor |
| T-05-08-05 (Plant existence leakage) | getPlant/listPhotoEntries return NotFound (not Forbidden) for cross-user access |

## Deviations from Plan

### Adapted Implementations (Following On-Disk Signatures)

**1. [Rule 1 - Adapt] createPhotoEntry has no deps.tx or postCommit**
- **Found during:** Task 1 (implementation)
- **Issue:** Plan spec documented `createPhotoEntry` as accepting `deps.tx` and returning `postCommit`. On-disk implementation delegates to `uploadPhoto` which opens its own `withUnitOfWork` — accepting an outer `tx` would require refactoring the compensating-delete contract.
- **Fix:** Route wraps `createPhotoEntry` in `withIdempotency` without passing `tx`. Idempotency still works (stored row prevents replay). No postCommit for photo entries.
- **Impact:** Test 2.4 proves idempotent replay (same response, one DB row). No telemetry from createPhotoEntry (uploadPhoto doesn't emit PostHog/Inngest).
- **Committed in:** ad5ac69

**2. [Rule 1 - Adapt] listPlants already encodes cursor**
- **Found during:** Task 2 (GET /plants implementation)
- **Issue:** Plan spec described route calling `encodeSortCursor(result.nextCursor)` where nextCursor was `SortCursorPayload | null`. Actual use-case returns `nextCursor: string | null` (already encoded).
- **Fix:** Route passes `cursor: cursorRaw` (raw string) to listPlants; uses `result.nextCursor` directly as `next_cursor` in response. Validation of cursor format at route level via `decodeSortCursor` before passing to use-case.
- **Committed in:** ce2843f

**3. [Rule 1 - Adapt] listLocations has no locale parameter**
- **Found during:** Task 2 (GET /locations implementation)
- **Issue:** Plan spec documented `listLocations({ userId, locale: "pt-BR" })`. Actual use-case accepts only `{ userId }` and reads pt-BR.json statically.
- **Fix:** Route calls `listLocations({ userId: auth.user.id })` (no locale param).
- **Committed in:** ce2843f

---

**Total deviations:** 3 adaptations (all Rule 1 — following on-disk signatures per plan instruction "if the executor finds a slightly different shape on disk after 05-05 ships, follow the on-disk types and adapt")
**Impact:** No functional regression; integration tests assert behavior, not internal call signatures.

## Integration Test Regression Pointer

`tests/integration/catalog-routes-read-create.integration.test.ts` — 33 tests covering:
- Tests 1.1–1.10: POST /plants (auth gates, idempotency, multipart, snake_case, replay, conflict, no-drizzle)
- Tests 2.1–2.5: POST /photo-entries (same pattern)
- Tests 3.1–3.7: GET /plants (auth, sort, ?include_count, cursor, tampering, limit)
- Tests 4.1–4.3: GET /plants/[id] (auth, not_found, _meta counts)
- Tests 5.1–5.3: GET /photo-entries (auth, cross-user, signed URLs)
- Tests 6.1–6.3: GET /locations (auth, pt-BR defaults, user suggestions)

## Self-Check: PASSED

Files verified to exist:
- src/app/api/v1/plants/route.ts ✓ (exports GET, POST, runtime="nodejs")
- src/app/api/v1/plants/[plantId]/route.ts ✓ (exports GET)
- src/app/api/v1/plants/[plantId]/photo-entries/route.ts ✓ (exports GET, POST, runtime="nodejs")
- src/app/api/v1/locations/route.ts ✓ (exports GET)
- src/shared/api/idempotency-hash.ts ✓
- src/contexts/catalog/api/snake-case.ts ✓
- tests/integration/catalog-routes-read-create.integration.test.ts ✓

Commits verified:
- 279fe92 (RED test file)
- ad5ac69 (GREEN POST routes)
- ce2843f (GREEN GET routes)
- f9116bf (REFACTOR type fixes)

Tests: 43 passed (33 integration + 10 no-drizzle unit)
TypeScript: 0 errors
Lint: 0 warnings
Drizzle grep gate: 0 lines

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
