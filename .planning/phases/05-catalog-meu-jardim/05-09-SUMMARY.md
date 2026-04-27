---
phase: 05-catalog-meu-jardim
plan: 09
status: planned
wave: 4
created: 2026-04-26
---

# Plan 05-09 — Route Handlers (Mutate + Delete) — Summary

> Pre-execution summary captured at planning time. Mirrors Plan 05-08's SUMMARY.md
> convention. Will be confirmed / amended by the executor after the plan completes.

## Endpoints shipped (6 total — completes CONTEXT D-23B mutation surface)

| Method | Path                                                  | Body schema (Zod, all `.strict()`)                                              | Response       |
| ------ | ----------------------------------------------------- | ------------------------------------------------------------------------------- | -------------- |
| PATCH  | `/api/v1/plants/:plantId`                             | `PlantPatchSchema` from 05-04 (`name?`, `nickname?`, `location?`, `acquisition_date?`, `notes?`) | 200 + Plant    |
| DELETE | `/api/v1/plants/:plantId`                             | none                                                                            | 204 No Content |
| POST   | `/api/v1/plants/:plantId/photos`                      | `PhotoEntryCreateSchema` from 05-04 (`photo_url`, `thumbnail_url`, `note?`)     | 201 + PhotoEntry |
| PATCH  | `/api/v1/plants/:plantId/photos/:photoEntryId`        | `PhotoEntryNotePatchSchema` (inline; `note: string \| null`, max 2000)          | 200 + PhotoEntry |
| DELETE | `/api/v1/plants/:plantId/photos/:photoEntryId`        | none                                                                            | 204 No Content |
| PATCH  | `/api/v1/plants/:plantId/cover-photo`                 | `CoverPhotoPatchSchema` (inline; `photo_entry_id: z.string().uuid()`)           | 200 + Plant    |

All responses on error: `{ error: { code, message, details? } }` via the
`httpMapDomainError` helper from Plan 05-08, mapping DomainError codes to the
closed registry codes:
`validation_failed | not_found | conflict | forbidden | unauthenticated | token_expired`.

All 6 endpoints accept `Idempotency-Key` (per CONTEXT D-23B + Phase 2 D-37/D-38).
Replay returns the cached response without re-executing the use case side
effects. The idempotency table is per-user (Phase 2 D-37 composite key).

## Phase 5.2 (5b) TanStack Query mutation hooks — endpoint contract

Plan 5b's catalog UI consumes these endpoints from React. Per CONTEXT D-07 (hybrid
optimistic UI), each hook chooses optimism vs pessimism per the table below. Every
hook generates `Idempotency-Key: crypto.randomUUID()` per call (per Pattern 4 in
05-PATTERNS.md / RESEARCH "Don't Hand-Roll" table).

| UI surface (CONTEXT decision)                                  | Endpoint                                                       | Optimism (D-07)                                       |
| -------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| PATCH plant inline edits (D-11/D-12 click-to-edit per field, save-on-blur per field) | `PATCH /api/v1/plants/:plantId`                              | OPTIMISTIC (`onMutate` snapshot + `onError` rollback) |
| DELETE plant from overflow menu (D-19 destructive modal)       | `DELETE /api/v1/plants/:plantId` → expect 204                  | PESSIMISTIC (button-loading until server response)    |
| POST photo entry from BottomSheet (D-16 modal sheet — first /api/v1/photos/upload, then this) | `POST /api/v1/plants/:plantId/photos`                       | PESSIMISTIC (skeleton + button-loading)               |
| PATCH photo entry note from lightbox (D-17 "Editar nota")      | `PATCH /api/v1/plants/:plantId/photos/:photoEntryId`           | OPTIMISTIC                                            |
| DELETE photo entry from lightbox (D-17 "Excluir")              | `DELETE /api/v1/plants/:plantId/photos/:photoEntryId` → expect 204 | PESSIMISTIC                                       |
| PATCH cover photo from lightbox (D-17 "Definir como capa")     | `PATCH /api/v1/plants/:plantId/cover-photo` body `{ photo_entry_id }` | OPTIMISTIC                                  |

`Idempotency-Key` header convention (5b hooks):

```ts
const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
// ...inside mutationFn...
fetch(url, { method, headers: { "Idempotency-Key": idempotencyKey, "Content-Type": "application/json" }, body: JSON.stringify(payload) });
```

Generate the key once per logical user action (e.g., per Save click), not per
React render. The key is the deduplication boundary at the server.

## Defense in depth — photo path ownership lives at TWO layers

T-5-01 (photo URL spoofing on POST `/:plantId/photos` — Pitfall 1 in 05-RESEARCH.md)
is defended at BOTH layers. Both must remain in place; do not remove either as
"redundant":

1. **Route handler layer (this plan, 05-09):** `src/app/api/v1/plants/[plantId]/photos/route.ts`
   POST handler calls `validateStoragePathOwnership({ paths: [photo_url, thumbnail_url], userId, plantId })`
   from 05-04 BEFORE invoking the use case. On failure: `errorResponse(ErrorCode.ValidationFailed, "storage_path_ownership_failed", { badPaths })`. Early reject, no transaction opened.

2. **Use case layer (05-07 addPhotoEntry):** `src/contexts/catalog/application/add-photo-entry.ts`
   ALSO calls `validateStoragePathOwnership(...)` before opening its transaction. Defense ensures the check holds even if a future caller bypasses the route (e.g., another use case invokes addPhotoEntry directly).

The 05-09 route-layer check is the primary defense (cheapest reject, before
transaction); the 05-07 use-case-layer check is the safety net.

## Idempotency wrap is at the route layer, not the use case

Use cases from Plans 05-05, 05-06, 05-07, and the two NEW use cases in this plan
(`deletePhotoEntryWithStorageCleanup`, `setCoverPhotoByEntryId`) are NOT
idempotent themselves. Idempotency lives at the route layer via the `idempotent`
helper from Phase 2 D-37 (per Plan 05-05's `behavior` block: "the use case
itself is NOT idempotent... idempotency lives at the route layer per Phase 2 D-37").

Replay flow (Phase 2 D-37 contract):
1. Client sends PATCH/POST/DELETE with `Idempotency-Key: K`.
2. `idempotent(req, fn)` reads `(K, user_id)` from the idempotency table.
3. If hit: return the cached `(status, body)` WITHOUT calling `fn`.
4. If miss: call `fn`, capture `(status, body)`, INSERT into idempotency table with 7-day TTL, return.

Per Pitfall 8 (05-RESEARCH.md), the response body size cap is a Phase 2 concern;
Plan 05-09's mutating responses (single Plant or single PhotoEntry JSON) are well
under any reasonable cap.

## Override: 05-07 deferred-cleanup decision

Plan 05-07 `decisions.delete_photo_entry_storage_cleanup` deferred per-photo
storage cleanup ("orphaned per-photo objects are an acceptable trade-off vs.
building a second outbox table"). Plan 05-09 OVERRIDES this decision per the
planning context's must_have ("DELETE /:id/photos/:photoEntryId removes the row
+ schedules its storage paths for deletion via the same outbox table") and per
T-5-03 in this plan's threat model.

Resolution: Plan 05-09 ships a NEW use case
`src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts`
that mirrors 05-06 deletePlant EXACTLY:

- Atomic transaction inserts a `pending_storage_deletions` row (with the photo +
  thumbnail paths) IN THE SAME tx as the `photo_entries` DELETE.
- Post-commit `inngest.send` dispatches a `plant.deleted` event (intentional
  reuse — the cleanup-storage Inngest function from 05-06 doesn't distinguish
  plant-vs-photo cleanup; it just calls `storageAdapter.deleteMany(job.storagePaths)`).
- On dispatch failure: try/catch swallows error, logs to Sentry, durable
  pending row is picked up by `catalog/reconcile-deletions` cron (5-min poll,
  300s threshold) — same safety net as 05-06.

The route handler `DELETE /api/v1/plants/:plantId/photos/:photoEntryId` invokes
`deletePhotoEntryWithStorageCleanup`, NOT 05-07's `deletePhotoEntry`. 05-07's
`deletePhotoEntry` use case remains in the codebase for any future caller that
wants the path-returning shape without auto-cleanup, but is not referenced by
the Phase 5 route surface.

## Cover-photo adapter — `setCoverPhotoByEntryId`

Planning context body shape is `{ photo_entry_id: string }`; 05-07 `setCoverPhoto`
takes `photoUrl: string`. Route handlers cannot import `infrastructure/db`
(Phase 2 D-17 ESLint guard) so cannot resolve the lookup directly.

Resolution: Plan 05-09 ships a thin adapter
`src/contexts/catalog/application/set-cover-photo-by-entry-id.ts`:

- Opens UoW transaction.
- Calls `photoEntries.findById(tx, { id: photoEntryId, userId })` (scoped by
  userId — RLS + repo filter).
- Verifies `entry.plantId === args.plantId`. Cross-plant returns `not_found`
  (NOT forbidden — no information disclosure about photo_entry existence in
  other plants).
- Cross-user (different `userId`) returns `not_found` via the userId-scoped
  findById (returns null).
- Delegates to 05-07's `setCoverPhoto`, passing the resolved `photoUrl` through
  the SAME transaction (UoW shim `{ transaction: async (fn) => fn(tx) }` to
  avoid nested transaction).

If 05-03 didn't ship `photoEntries.findById`, Task 1 of 05-09 adds it (one-line
SQL with userId scope) — documented with a "Phase 5 Plan 05-09 extension" code
comment.

## Mass-assignment defense layered three deep

T-5-mass-assignment on PATCH `/api/v1/plants/:plantId` is defended at THREE
layers (per the threat model in this plan):

1. **Schema (05-04 PlantPatchSchema):** `.strict()` rejects unknown keys with
   `validation_failed`. Picks only writable fields (name, nickname, location,
   acquisition_date, notes). Plan 05-09 verifies `.strict()` is present and
   amends 05-04 if absent (load-bearing security check via grep gate).
2. **Use case (05-07 updatePlant):** typed `patch: PlantPatch` parameter —
   TypeScript itself disallows arbitrary keys at compile time.
3. **Repository (05-03 plants.updatePartial):** writes only the listed
   PlantPatch columns — even if a future caller bypassed the schema, the repo
   wouldn't write to id/user_id/species_id/cover_photo_url/created_at.

The PATCH `/:plantId/cover-photo` dedicated endpoint (with its own PhotoEntry
ownership check via `setCoverPhotoByEntryId`) is the only path to update
`cover_photo_url`. PATCH `/:plantId` rejects any attempt to set `cover_photo_url`
via the bag of fields.

Integration test `patch-plant-route.integration.test.ts` covers 4
mass-assignment variants (id, user_id, species_id, cover_photo_url); all return
400 validation_failed and the SELECT confirms the underlying value did not
change.

## Phase 11 LGPD note

The same `pending_storage_deletions` outbox + `cleanup-storage` Inngest function
now handles per-photo deletion (Plan 05-09) in addition to per-plant deletion
(Plan 05-06). When Phase 11 implements account-wide hard delete, the same
outbox + Inngest function can be reused (just enqueue all of the user's storage
paths as one or many jobs). No new infrastructure required.

## Phase 6 Identification note

`PATCH /:plantId/cover-photo` only accepts `photo_entry_id`, NOT identification
result `photo_url`. If Phase 6 wants to set an identification photo as the
cover, that's done at create time via `createPlantFromIdentification` from
05-05 (already sets `cover_photo_url` from the identification upload), not via
this endpoint.

## Wave override note

This plan is Wave 4 (not Wave 3 as the planning context proposed) due to
`files_modified` overlap with 05-08 on
`src/app/api/v1/plants/[plantId]/route.ts` and
`src/app/api/v1/plants/[plantId]/photos/route.ts`. Same-wave plans cannot share
files (parallel execution would corrupt them). Execute-phase respects the wave
numbering. The two new endpoints in shared files MUST APPEND exports
(PATCH/DELETE/POST) to the existing GET handlers from 05-08, not overwrite them.

## Files modified (full list)

Route handlers:
- `src/app/api/v1/plants/[plantId]/route.ts` — APPEND PATCH + DELETE next to 05-08 GET
- `src/app/api/v1/plants/[plantId]/photos/route.ts` — APPEND POST next to 05-08 GET
- `src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts` — NEW (PATCH + DELETE)
- `src/app/api/v1/plants/[plantId]/cover-photo/route.ts` — NEW (PATCH)

New use cases:
- `src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts`
- `src/contexts/catalog/application/set-cover-photo-by-entry-id.ts`

Integration tests (6 files):
- `tests/integration/catalog/patch-plant-route.integration.test.ts`
- `tests/integration/catalog/delete-plant-route.integration.test.ts`
- `tests/integration/catalog/post-photo-entry-route.integration.test.ts`
- `tests/integration/catalog/patch-photo-entry-route.integration.test.ts`
- `tests/integration/catalog/delete-photo-entry-route.integration.test.ts`
- `tests/integration/catalog/patch-cover-photo-route.integration.test.ts`

Contingent edits (only if upstream plans did not ship the required shapes):
- `src/contexts/catalog/domain/plant.ts` — amend PlantPatchSchema with `.strict()` if 05-04 omitted
- `src/contexts/catalog/infrastructure/db/photo-entries.ts` — add `findById`; extend `deleteByIdAndPlant` return shape if narrower in 05-03
