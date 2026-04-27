---
phase: 05-catalog-meu-jardim
plan: 09
type: tdd
wave: 4
depends_on:
  - 05-01
  - 05-02
  - 05-03
  - 05-04
  - 05-05
  - 05-06
  - 05-07
  - 05-08
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-06 (idempotent + cursor + zod helpers at @shared/api/*), 02-07 (requireUser at @shared/auth/require-user — JWT verification + currentUser helper), 02-05 (UnitOfWork at @shared/db/unit-of-work).
  # PHASE-4-DEPENDENCY: requires @shared/events/inngest-client (Phase 4 ships; 05-06 stubs if absent). The DELETE-photo-entry path dispatches plant.deleted via the same inngest singleton used by 05-06.
  # WAVE OVERRIDE: Planning context proposed Wave 3, but src/app/api/v1/plants/[plantId]/route.ts and src/app/api/v1/plants/[plantId]/photos/route.ts overlap with 05-08's files_modified. Per planner wave rule (same-wave plans must have zero files_modified overlap), 05-09 is bumped to Wave 4. The two new endpoints in shared files MUST append exports (PATCH/DELETE/POST) to the existing GET handlers from 05-08, not overwrite them.
files_modified:
  - src/app/api/v1/plants/[plantId]/route.ts
  - src/app/api/v1/plants/[plantId]/photos/route.ts
  - src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts
  - src/app/api/v1/plants/[plantId]/cover-photo/route.ts
  - src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts
  - src/contexts/catalog/application/set-cover-photo-by-entry-id.ts
  - tests/integration/catalog/patch-plant-route.integration.test.ts
  - tests/integration/catalog/delete-plant-route.integration.test.ts
  - tests/integration/catalog/post-photo-entry-route.integration.test.ts
  - tests/integration/catalog/patch-photo-entry-route.integration.test.ts
  - tests/integration/catalog/delete-photo-entry-route.integration.test.ts
  - tests/integration/catalog/patch-cover-photo-route.integration.test.ts
  # Contingent edits — touched only if upstream plans (05-04 / 05-03) did not ship the required shapes:
  - src/contexts/catalog/domain/plant.ts                          # may amend PlantPatchSchema with .strict() if 05-04 shipped without it (mass-assignment defense — load-bearing)
  - src/contexts/catalog/infrastructure/db/photo-entries.ts       # may add findById and may extend deleteByIdAndPlant return shape if 05-03 shipped narrower contracts
autonomous: true
requirements:
  - CAT-09
  - CAT-04
  - CAT-06
decisions:
  override_05_07_delete_photo_entry_storage_cleanup: "OVERRIDES Plan 05-07 decisions.delete_photo_entry_storage_cleanup. Plan 05-07 deferred per-photo storage cleanup (orphaned objects accepted as trade-off). Planning context for 05-09 explicitly requires the atomic outbox path for DELETE /:id/photos/:photoEntryId per T-5-03. Resolution: Plan 05-09 ships a new use case `deletePhotoEntryWithStorageCleanup` in `src/contexts/catalog/application/` that wraps the same atomic-transaction + outbox + post-commit Inngest dispatch pattern as `deletePlant` from 05-06 — same pending_storage_deletions table reused, same plant.deleted event reused (the cleanup-storage Inngest function does not distinguish plant-vs-photo cleanup; it just deletes the storagePaths array on the loaded job row). The route handler in 05-09 invokes this new use case, not 05-07's `deletePhotoEntry`. 05-07's `deletePhotoEntry` use case remains in the codebase (other future callers may want the path-returning shape without auto-cleanup) but is not referenced by the Phase 5 route surface."
  set_cover_photo_by_entry_id_adapter: "Planning context specifies PATCH /api/v1/plants/:plantId/cover-photo body is `{ photo_entry_id: string }`. Plan 05-07's `setCoverPhoto` use case takes `photoUrl: string`. Route handlers cannot import infrastructure/db (D-17 ESLint guard) so cannot resolve photoEntryId → photoUrl directly. Resolution: Plan 05-09 ships a thin adapter use case `setCoverPhotoByEntryId` in `src/contexts/catalog/application/set-cover-photo-by-entry-id.ts` that opens a UoW transaction, calls `photoEntries.findById(tx, photoEntryId)`, verifies row.plantId === plantId AND row.userId === userId (cross-plant + cross-user defense; throws `not_found` when no row, `forbidden` when ownership mismatch), then calls 05-07's `setCoverPhoto` via the same transaction passing the resolved photoUrl. Returns the updated Plant."
  thin_handler_pattern: "Per Phase 2 D-17 + PRD §2: handler validates → use case → HTTP map. NO Drizzle imports in handlers (ESLint guard verified by `grep -rl 'drizzle-orm' src/app/api/v1/plants` returning 0). NO direct infrastructure/db imports. Reuses `idempotent` + `requireUser` + `httpMapDomainError` helpers from Plan 05-08."
  endpoint_paths_verbatim: "PATCH /api/v1/plants/:plantId, DELETE /api/v1/plants/:plantId, POST /api/v1/plants/:plantId/photos, PATCH /api/v1/plants/:plantId/photos/:photoEntryId, DELETE /api/v1/plants/:plantId/photos/:photoEntryId, PATCH /api/v1/plants/:plantId/cover-photo (CONTEXT D-23B verbatim — 6 of 8 mutating endpoints; the other 2 — POST /plants and POST /plants/from-identification — shipped in 05-08)."
  idempotency_on_all_mutations: "All 6 endpoints accept Idempotency-Key per CONTEXT D-23B + Phase 2 D-37/D-38. Wrapped via `idempotent(req, async () => ...)` — same helper as 05-08. The idempotency table is per-user (Phase 2 D-37). Replay returns the same HTTP status + body without re-executing the use case (Phase 2 D-37 contract; Pitfall 8 size cap inherited from Phase 2)."
  delete_returns_204: "Both DELETE handlers return 204 No Content per REST convention. The use cases return void (deletePlant) or { deletedPaths } (deletePhotoEntryWithStorageCleanup); the route handler discards the return value and emits 204 with no body. Idempotency replay also returns 204 (the response body cached as empty)."
  patch_plant_mass_assignment_defense: "PATCH /api/v1/plants/:plantId body validated via PlantPatchSchema from 05-04. The schema is .strict() (unknown keys → validation_failed; mass-assignment defense). Server-controlled fields (id, user_id, species_id, cover_photo_url, created_at) cannot be patched — schema picks only writable fields (name, nickname, location, acquisition_date, notes). Defense in depth: updatePlant use case from 05-07 takes a typed `patch: PlantPatch` parameter; TypeScript itself disallows arbitrary keys at compile time."
  photo_path_ownership_at_route: "POST /api/v1/plants/:plantId/photos calls `validateStoragePathOwnership({ paths: [photo_url, thumbnail_url], userId, plantId })` from 05-04 BEFORE invoking the use case (T-5-01 / Pitfall 1 — defense in depth above 05-07's addPhotoEntry which also validates). The route-layer check rejects spoofed paths early with validation_failed before the use case opens its transaction. The 05-07 addPhotoEntry use case STILL validates internally — never trust client paths even if a route handler 'should have' caught it."
must_haves:
  truths:
    - "PATCH /api/v1/plants/:plantId validates JWT + Idempotency-Key + zod (PlantPatchSchema .strict()) → calls updatePlant({ plantId, userId, patch, uow }) → returns 200 + Plant"
    - "PATCH /api/v1/plants/:plantId rejects mass-assignment: body { id, user_id, species_id, cover_photo_url, created_at } → validation_failed (PlantPatchSchema.strict() unknown-key rejection); body { name, nickname, location, acquisition_date, notes } → updates allowed fields"
    - "DELETE /api/v1/plants/:plantId validates JWT + Idempotency-Key → calls deletePlant({ plantId, userId, uow, inngest }) → returns 204 only after the atomic transaction (DELETE + outbox row insert) commits AND the inngest.send dispatch was attempted"
    - "DELETE /api/v1/plants/:plantId on cross-user plant returns 404 (use case throws not_found because plants.deleteByIdAndUser scopes by userId) — never 403 with information disclosure"
    - "POST /api/v1/plants/:plantId/photos validates JWT + Idempotency-Key + zod (PhotoEntryCreateSchema) + validateStoragePathOwnership({ paths: [photo_url, thumbnail_url], userId, plantId }) → calls addPhotoEntry → returns 201 + PhotoEntry"
    - "POST /api/v1/plants/:plantId/photos rejects spoofed paths server-side: photo_url not starting with `{userId}/{plantId}/` → validation_failed (T-5-01 defense in depth above 05-07's addPhotoEntry)"
    - "PATCH /api/v1/plants/:plantId/photos/:photoEntryId validates JWT + Idempotency-Key + zod (PhotoEntryNotePatchSchema with note? string ≤ 2000 chars) → calls updatePhotoEntryNote → returns 200 + PhotoEntry"
    - "DELETE /api/v1/plants/:plantId/photos/:photoEntryId validates JWT + Idempotency-Key → calls deletePhotoEntryWithStorageCleanup (NEW use case in this plan; OVERRIDES 05-07 deferred-cleanup decision) → atomic DELETE + outbox row + post-commit inngest.send → returns 204"
    - "PATCH /api/v1/plants/:plantId/cover-photo validates JWT + Idempotency-Key + zod ({ photo_entry_id: string.uuid() }) → calls setCoverPhotoByEntryId (NEW adapter in this plan) → returns 200 + Plant"
    - "PATCH /api/v1/plants/:plantId/cover-photo with cross-plant photo_entry_id (PhotoEntry exists but belongs to a different plant of same user) → returns 404 (not_found from setCoverPhotoByEntryId after photoEntries.findById confirms row.plantId !== plantId)"
    - "PATCH /api/v1/plants/:plantId/cover-photo with cross-user photo_entry_id → returns 404 (RLS hides; or `not_found` from setCoverPhotoByEntryId if RLS not active in test) — never 403 with disclosure"
    - "All 6 handlers map DomainError to closed-registry ErrorCodes via httpMapDomainError from 05-08"
    - "All 6 handlers wrap their work in `idempotent(req, async () => ...)` per Phase 2 D-37/D-38"
    - "Sentry.setUser({ id }) called with user.id ONLY — no email, no PII (Phase 1 LGPD-13)"
    - "No drizzle-orm imports in any route handler file (Phase 2 D-17 ESLint guard satisfied via `grep -rl 'drizzle-orm' src/app/api/v1/plants` returns 0)"
  artifacts:
    - path: "src/app/api/v1/plants/[plantId]/route.ts"
      provides: "PATCH (inline edit) + DELETE (atomic plant deletion); GET handler from 05-08 must remain present (append-only edits)"
      min_lines: 90
    - path: "src/app/api/v1/plants/[plantId]/photos/route.ts"
      provides: "POST (PhotoEntry add via two-step flow with route-layer storage path ownership check); GET handler from 05-08 must remain present"
      min_lines: 60
    - path: "src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts"
      provides: "PATCH (note edit) + DELETE (atomic per-photo deletion with outbox cleanup) — NEW FILE"
      min_lines: 70
    - path: "src/app/api/v1/plants/[plantId]/cover-photo/route.ts"
      provides: "PATCH (set-as-cover via photo_entry_id) — NEW FILE"
      min_lines: 50
    - path: "src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts"
      provides: "deletePhotoEntryWithStorageCleanup — atomic DELETE + outbox row + post-commit inngest dispatch (mirrors 05-06 deletePlant pattern). NEW use case OVERRIDING 05-07's deferred-cleanup decision."
      min_lines: 60
    - path: "src/contexts/catalog/application/set-cover-photo-by-entry-id.ts"
      provides: "setCoverPhotoByEntryId — adapter that resolves photo_entry_id → photoUrl with cross-plant + cross-user defense, then delegates to 05-07 setCoverPhoto. NEW use case."
      min_lines: 45
    - path: "tests/integration/catalog/patch-plant-route.integration.test.ts"
      provides: "PATCH /:plantId — happy path partial update, mass-assignment rejection (id/user_id/species_id/cover_photo_url/created_at fields rejected), cross-user → 404, idempotency replay returns same row, missing JWT → 401"
      min_lines: 90
    - path: "tests/integration/catalog/delete-plant-route.integration.test.ts"
      provides: "DELETE /:plantId — happy path returns 204 + cascades photo_entries (verified via SELECT), pending_storage_deletions row inserted in same tx, cross-user → 404, idempotency replay returns 204 + does NOT re-DELETE (idempotent at use case level via Phase 2 D-37 cached response)"
      min_lines: 90
    - path: "tests/integration/catalog/post-photo-entry-route.integration.test.ts"
      provides: "POST /:plantId/photos — happy path returns 201, spoofed photo_url path → validation_failed (route-layer check before use case), spoofed thumbnail_url → validation_failed, missing photo_url → validation_failed, idempotency replay returns same row, plant not found → 404"
      min_lines: 100
    - path: "tests/integration/catalog/patch-photo-entry-route.integration.test.ts"
      provides: "PATCH /:plantId/photos/:photoEntryId — happy path note update, set note to null, note > 2000 chars → validation_failed, cross-plant photoEntryId → 404, idempotency replay returns same row"
      min_lines: 70
    - path: "tests/integration/catalog/delete-photo-entry-route.integration.test.ts"
      provides: "DELETE /:plantId/photos/:photoEntryId — happy path 204 + photo_entries row gone + pending_storage_deletions row inserted with the photo + thumbnail paths, cross-plant photoEntryId → 404, idempotency replay 204"
      min_lines: 80
    - path: "tests/integration/catalog/patch-cover-photo-route.integration.test.ts"
      provides: "PATCH /:plantId/cover-photo — happy path returns 200 + Plant.cover_photo_url updated, cross-plant photo_entry_id → 404 (PhotoEntry belongs to different plant), cross-user photo_entry_id → 404, photo_entry_id not found → 404, idempotency replay returns same row"
      min_lines: 70
  key_links:
    - from: "src/app/api/v1/plants/[plantId]/route.ts"
      to: "src/contexts/catalog/application/update-plant.ts (Plan 05-07) + delete-plant.ts (Plan 05-06)"
      via: "PATCH imports updatePlant; DELETE imports deletePlant"
      pattern: "updatePlant\\|deletePlant"
    - from: "src/app/api/v1/plants/[plantId]/photos/route.ts"
      to: "src/contexts/catalog/application/add-photo-entry.ts (Plan 05-07) + src/contexts/catalog/domain/storage-path.ts (Plan 05-04)"
      via: "POST imports addPhotoEntry + validateStoragePathOwnership"
      pattern: "addPhotoEntry\\|validateStoragePathOwnership"
    - from: "src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts"
      to: "src/contexts/catalog/application/update-photo-entry-note.ts (Plan 05-07) + delete-photo-entry-with-storage-cleanup.ts (Task 1 of THIS plan)"
      via: "PATCH imports updatePhotoEntryNote; DELETE imports deletePhotoEntryWithStorageCleanup"
      pattern: "updatePhotoEntryNote\\|deletePhotoEntryWithStorageCleanup"
    - from: "src/app/api/v1/plants/[plantId]/cover-photo/route.ts"
      to: "src/contexts/catalog/application/set-cover-photo-by-entry-id.ts (Task 2 of THIS plan)"
      via: "PATCH imports setCoverPhotoByEntryId"
      pattern: "setCoverPhotoByEntryId"
    - from: "src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts"
      to: "src/contexts/catalog/infrastructure/db/{photo-entries,pending-storage-deletions}.ts (Plan 05-03) + @shared/events/inngest-client (Phase 4 / 05-06 stub)"
      via: "atomic transaction: list paths → insert outbox row → DELETE photo_entry → commit → inngest.send"
      pattern: "pendingStorageDeletions\\.insert\\|photoEntries\\.deleteByIdAndPlant\\|inngest.send"
    - from: "src/contexts/catalog/application/set-cover-photo-by-entry-id.ts"
      to: "src/contexts/catalog/infrastructure/db/photo-entries.ts (Plan 05-03) + src/contexts/catalog/application/set-cover-photo.ts (Plan 05-07)"
      via: "transaction: photoEntries.findById → ownership re-check → setCoverPhoto"
      pattern: "photoEntries\\.findById\\|setCoverPhoto"
    - from: "src/app/api/v1/plants/**/route.ts"
      to: "src/shared/api/idempotent (Phase 2 D-37) + src/shared/auth/require-user (Phase 2 D-32) + src/shared/api/http-error-map (Plan 05-08)"
      via: "every mutating handler wraps in idempotent + extracts user via requireUser + maps errors via httpMapDomainError"
      pattern: "idempotent\\|requireUser\\|httpMapDomainError"
---

<objective>
Ship the remaining 6 mutating route handlers under `/api/v1/plants/*` per CONTEXT D-23B. Each handler is THIN per PRD §2 + Phase 2 D-17: validate (JWT + zod + storage-path ownership where applicable) → call use case → HTTP-map. Reuses the shared `idempotent`, `requireUser`, and `httpMapDomainError` helpers from Plan 05-08.

Also ships TWO new application-layer use cases that the planning context's must_haves require but Plans 05-05/06/07 did not provide:

1. `deletePhotoEntryWithStorageCleanup` — atomic DELETE + outbox + post-commit Inngest dispatch (mirrors 05-06 deletePlant). OVERRIDES 05-07 decision to defer per-photo cleanup; the atomic-outbox path is mandated by T-5-03 in this plan's threat model and the SC-5 must_have ("DELETE /:id/photos/:photoEntryId removes the row + schedules its storage paths for deletion via the same outbox table").

2. `setCoverPhotoByEntryId` — thin adapter that resolves photo_entry_id → photoUrl with cross-plant + cross-user defense, then delegates to 05-07's `setCoverPhoto`. Required because the route body shape `{ photo_entry_id }` cannot be resolved by the route handler directly (D-17 forbids infrastructure/db imports).

Purpose: completes the catalog API mutation surface from CONTEXT D-23B (8 mutating endpoints total — 2 shipped in 05-08, 6 here). Plan 5b's TanStack Query mutation hooks consume these endpoints.

Output: 4 route handler files (~270 lines total — 2 NEW + 2 EXTENDED with append-only PATCH/DELETE/POST exports next to 05-08's GET handlers), 2 NEW use cases (~105 lines), 6 integration test files (~500 lines covering the per-route behaviors specified in this plan's must_haves and VALIDATION.md rows for CAT-09/04/06).
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
@.planning/phases/05-catalog-meu-jardim/05-SPLIT-PROPOSAL.md
@.planning/phases/02-data-layer/02-CONTEXT.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-05-plant-create-use-cases-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-06-plant-delete-inngest-cleanup-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-07-patch-photo-entry-cover-use-cases-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-08-route-handlers-read-create-PLAN.md

<interfaces>
src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts:
```ts
import type { UnitOfWork } from "@shared/db/unit-of-work";
import type { Inngest } from "inngest";
import * as photoEntries from "@contexts/catalog/infrastructure/db/photo-entries";
import * as pendingDeletions from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import { notFound } from "./errors";
import { PlantDeletedEventName, type PlantDeletedEvent } from "@contexts/catalog/domain/events";
import * as Sentry from "@sentry/nextjs";

/**
 * Atomic per-PhotoEntry deletion + transactional outbox + post-commit Inngest dispatch.
 *
 * OVERRIDES Plan 05-07's `decisions.delete_photo_entry_storage_cleanup` deferral.
 * T-5-03 in Plan 05-09 mandates atomic per-photo storage cleanup via the same
 * outbox table + plant.deleted event used by Plan 05-06 deletePlant.
 *
 * The cleanup-storage Inngest function (05-06) does not distinguish plant-vs-photo
 * cleanup — it just calls storageAdapter.deleteMany(job.storagePaths) on the loaded
 * pending row. This is intentional reuse, not duplication.
 */
export async function deletePhotoEntryWithStorageCleanup(args: {
  photoEntryId: string;
  plantId: string;
  userId: string;
  uow: UnitOfWork;
  inngest: Pick<Inngest, "send">;
}): Promise<void> {
  const job = await args.uow.transaction(async (tx) => {
    const result = await photoEntries.deleteByIdAndPlant(tx, {
      id: args.photoEntryId,
      plantId: args.plantId,
      userId: args.userId,
    });
    if (!result) notFound("photo_entry_not_found");

    if (result.deletedPaths.length === 0) return null;

    return await pendingDeletions.insert(tx, {
      userId: args.userId,
      plantId: args.plantId,
      storagePaths: result.deletedPaths,
    });
  });

  if (!job) return;

  // Post-commit dispatch — Pitfall 4 mitigation: reconciler picks up on failure (05-06)
  try {
    const event: PlantDeletedEvent = {
      name: PlantDeletedEventName,
      data: {
        user_id: args.userId,
        plant_id: args.plantId,
        storage_deletion_job_id: job.id,
        storage_paths: job.storagePaths,
      },
    };
    await args.inngest.send(event);
  } catch (err) {
    Sentry.captureException(err, {
      tags: { plan: "05-09", phase: "post-commit-dispatch-photo-entry" },
      extra: { storage_deletion_job_id: job.id, photo_entry_id: args.photoEntryId },
    });
    // Pending row is durable; reconciler will retry per 05-06 cron.
  }
}
```

NOTE: photoEntries.deleteByIdAndPlant in Plan 05-03 returns the deleted row's storage paths (per 05-07 plan's `deletePhotoEntry` use case which returns `{ deletedPaths: string[] }`). If 05-03's deleteByIdAndPlant signature does not return paths today, the executor MUST extend it (one extra `RETURNING photo_url, thumbnail_url` column) — document the extension in a code comment.

src/contexts/catalog/application/set-cover-photo-by-entry-id.ts:
```ts
import type { UnitOfWork } from "@shared/db/unit-of-work";
import type { Plant } from "@contexts/catalog/domain/plant";
import * as photoEntries from "@contexts/catalog/infrastructure/db/photo-entries";
import { setCoverPhoto } from "./set-cover-photo";
import { notFound } from "./errors";

/**
 * Adapter — resolves photo_entry_id → photoUrl with cross-plant + cross-user
 * defense, then delegates to 05-07 setCoverPhoto. Required because route handler
 * cannot import infrastructure/db (Phase 2 D-17 ESLint guard).
 *
 * Cross-plant tampering (T-5-cross-plant from 05-09 threat model): if photo_entry_id
 * exists but belongs to a different plant of the same user, return not_found rather
 * than forbidden — avoids confirming the row exists at all (information disclosure).
 */
export async function setCoverPhotoByEntryId(args: {
  plantId: string;
  photoEntryId: string;
  userId: string;
  uow: UnitOfWork;
}): Promise<Plant> {
  return args.uow.transaction(async (tx) => {
    const entry = await photoEntries.findById(tx, {
      id: args.photoEntryId,
      userId: args.userId,
    });
    if (!entry) notFound("photo_entry_not_found");
    if (entry.plantId !== args.plantId) notFound("photo_entry_not_found");
    // Both checks return not_found (not forbidden) — no information disclosure.

    return setCoverPhoto({
      plantId: args.plantId,
      userId: args.userId,
      photoUrl: entry.photoUrl,
      uow: { transaction: async (fn) => fn(tx) }, // pass current tx through
    });
  });
}
```

NOTE: 05-03's photoEntries module ships `findByPlant` and `deleteByIdAndPlant`. If `findById` is missing, the executor adds it: `(tx, { id, userId }) => SELECT * FROM photo_entries WHERE id = $id AND user_id = $userId LIMIT 1`. Document the extension in a code comment.

src/app/api/v1/plants/[plantId]/route.ts (APPENDED — GET from 05-08 must remain at the top):
```ts
// 05-08 GET handler stays here (do NOT delete or modify)
// ... existing GET export ...

import { idempotent } from "@shared/api/idempotent";
import { PlantPatchSchema } from "@contexts/catalog/domain/plant";
import { updatePlant } from "@contexts/catalog/application/update-plant";
import { deletePlant } from "@contexts/catalog/application/delete-plant";
import { inngest } from "@shared/events/inngest-client";
// requireUser, errorResponse, ErrorCode, httpMapDomainError, NextRequest, NextResponse, uow already imported by 05-08

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ plantId: string }> }) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const { plantId } = await params;
      const body = await req.json().catch(() => null);
      const parsed = PlantPatchSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(ErrorCode.ValidationFailed, "input_invalid", { issues: parsed.error.issues });
      }
      const plant = await updatePlant({ plantId, userId: user.id, patch: parsed.data, uow });
      return NextResponse.json(plant);
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ plantId: string }> }) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const { plantId } = await params;
      await deletePlant({ plantId, userId: user.id, uow, inngest });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}
```

src/app/api/v1/plants/[plantId]/photos/route.ts (APPENDED — GET from 05-08 must remain at the top):
```ts
// 05-08 GET handler stays here

import { idempotent } from "@shared/api/idempotent";
import { PhotoEntryCreateSchema } from "@contexts/catalog/domain/photo-entry";
import { addPhotoEntry } from "@contexts/catalog/application/add-photo-entry";
import { validateStoragePathOwnership } from "@contexts/catalog/domain/storage-path";

export async function POST(req: NextRequest, { params }: { params: Promise<{ plantId: string }> }) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const { plantId } = await params;
      const body = await req.json().catch(() => null);
      const parsed = PhotoEntryCreateSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(ErrorCode.ValidationFailed, "input_invalid", { issues: parsed.error.issues });
      }

      // T-5-01 defense in depth at route layer (use case 05-07 also validates).
      const ownership = validateStoragePathOwnership({
        paths: [parsed.data.photo_url, parsed.data.thumbnail_url],
        userId: user.id,
        plantId,
      });
      if (!ownership.ok) {
        return errorResponse(ErrorCode.ValidationFailed, "storage_path_ownership_failed", { badPaths: ownership.badPaths });
      }

      const photoEntry = await addPhotoEntry({ plantId, userId: user.id, input: parsed.data, uow });
      return NextResponse.json(photoEntry, { status: 201 });
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}
```

src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts (NEW FILE):
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@shared/auth/require-user";
import { idempotent } from "@shared/api/idempotent";
import { errorResponse, ErrorCode } from "@shared/config/errors";
import { httpMapDomainError } from "@shared/api/http-error-map";
import { uow } from "@shared/db/unit-of-work";
import { inngest } from "@shared/events/inngest-client";
import { updatePhotoEntryNote } from "@contexts/catalog/application/update-photo-entry-note";
import { deletePhotoEntryWithStorageCleanup } from "@contexts/catalog/application/delete-photo-entry-with-storage-cleanup";

const PhotoEntryNotePatchSchema = z.object({
  note: z.string().max(2000).nullable(),
}).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ plantId: string; photoEntryId: string }> }) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const { plantId, photoEntryId } = await params;
      const body = await req.json().catch(() => null);
      const parsed = PhotoEntryNotePatchSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(ErrorCode.ValidationFailed, "input_invalid", { issues: parsed.error.issues });
      }
      const updated = await updatePhotoEntryNote({
        id: photoEntryId,
        plantId,
        userId: user.id,
        note: parsed.data.note,
        uow,
      });
      return NextResponse.json(updated);
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ plantId: string; photoEntryId: string }> }) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const { plantId, photoEntryId } = await params;
      await deletePhotoEntryWithStorageCleanup({
        photoEntryId,
        plantId,
        userId: user.id,
        uow,
        inngest,
      });
      return new NextResponse(null, { status: 204 });
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}
```

src/app/api/v1/plants/[plantId]/cover-photo/route.ts (NEW FILE):
```ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@shared/auth/require-user";
import { idempotent } from "@shared/api/idempotent";
import { errorResponse, ErrorCode } from "@shared/config/errors";
import { httpMapDomainError } from "@shared/api/http-error-map";
import { uow } from "@shared/db/unit-of-work";
import { setCoverPhotoByEntryId } from "@contexts/catalog/application/set-cover-photo-by-entry-id";

const CoverPhotoPatchSchema = z.object({
  photo_entry_id: z.string().uuid(),
}).strict();

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ plantId: string }> }) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const { plantId } = await params;
      const body = await req.json().catch(() => null);
      const parsed = CoverPhotoPatchSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(ErrorCode.ValidationFailed, "input_invalid", { issues: parsed.error.issues });
      }
      const plant = await setCoverPhotoByEntryId({
        plantId,
        photoEntryId: parsed.data.photo_entry_id,
        userId: user.id,
        uow,
      });
      return NextResponse.json(plant);
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Ship deletePhotoEntryWithStorageCleanup + setCoverPhotoByEntryId use cases + their unit tests (override 05-07 cleanup deferral; provide cover-photo adapter)</name>
  <files>
    src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts,
    src/contexts/catalog/application/set-cover-photo-by-entry-id.ts,
    tests/unit/contexts/catalog/delete-photo-entry-with-storage-cleanup.test.ts,
    tests/unit/contexts/catalog/set-cover-photo-by-entry-id.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/application/delete-plant.ts (Plan 05-06 — the atomic outbox + post-commit dispatch pattern this use case mirrors EXACTLY)
    - src/contexts/catalog/application/set-cover-photo.ts (Plan 05-07 — the underlying use case set-cover-photo-by-entry-id delegates to)
    - src/contexts/catalog/application/errors.ts (Plan 05-05 — DomainError + notFound throw helpers)
    - src/contexts/catalog/infrastructure/db/photo-entries.ts (Plan 05-03 — verify `deleteByIdAndPlant` returns `{ deletedPaths: string[] } | null` AND `findById` exists with signature `(tx, { id, userId }) => Promise<PhotoEntry | null>`. If either is missing, extend the repo file in this task with a code-comment "Phase 5 Plan 05-09 extension". Same precedent as Plan 05-07 extending plants.ts with findByCursorWithIdentificationCount.)
    - src/contexts/catalog/infrastructure/db/pending-storage-deletions.ts (Plan 05-03 — `insert` signature is `(tx, { userId, plantId, storagePaths }) => Promise<PendingDeletion>`)
    - src/contexts/catalog/domain/events.ts (Plan 05-04 — PlantDeletedEvent type + PlantDeletedEventName constant; reused even for per-photo cleanup since the cleanup-storage Inngest function from 05-06 does not distinguish)
    - tests/helpers/inngest-stub.ts (Plan 05-01 — createInngestSendStub for capturing dispatched events)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 4: Post-commit event dispatch failure" (the try/catch + Sentry.captureException + reconciler-picks-up pattern)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-04 (the canonical 6-step deletion flow — applied verbatim to the per-photo case)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-18 (UnitOfWork at @shared/db/unit-of-work; transaction signature)
  </read_first>
  <behavior>
    deletePhotoEntryWithStorageCleanup unit tests (mocked):
    - Happy path: photoEntries.deleteByIdAndPlant returns `{ deletedPaths: ['user/plant/p1.jpg', 'user/plant/p1-thumb.jpg'] }` → pendingDeletions.insert called inside tx with those 2 paths → inngest.send called AFTER tx commit with PlantDeletedEvent shape (same name "plant.deleted", same data shape used by 05-06)
    - Empty paths edge case: deleteByIdAndPlant returns `{ deletedPaths: [] }` → pendingDeletions.insert NOT called → inngest.send NOT called → function returns void successfully (efficient no-op mirrors 05-06 empty-photo case)
    - Photo entry not found: deleteByIdAndPlant returns null → throws DomainError code "not_found" with message "photo_entry_not_found" → pendingDeletions.insert NOT called → inngest.send NOT called
    - Cross-plant isolation: deleteByIdAndPlant scopes by (id, plantId, userId) — repository handles this; the use case does not need additional check (the repo returning null on any mismatch is sufficient and triggers the not_found path above)
    - Dispatch failure swallowed: inngest.send rejects → function returns successfully (no throw) → Sentry.captureException called with extras containing `storage_deletion_job_id` AND `photo_entry_id`
    - Inngest payload exact shape: `{ name: "plant.deleted", data: { user_id, plant_id, storage_deletion_job_id, storage_paths } }` — match keys + types

    setCoverPhotoByEntryId unit tests (mocked):
    - Happy path: photoEntries.findById returns row with `plantId: 'P1'` and `userId: 'U1'` and `photoUrl: 'U1/P1/x.jpg'` → setCoverPhoto called with `{ plantId: 'P1', userId: 'U1', photoUrl: 'U1/P1/x.jpg' }` → returns the updated Plant
    - Photo entry not found: findById returns null → throws DomainError code "not_found" with message "photo_entry_not_found" → setCoverPhoto NOT called
    - Cross-plant rejection: findById returns row with `plantId: 'P_OTHER'` (different from args.plantId 'P1') → throws DomainError code "not_found" (NOT forbidden — avoids information disclosure) → setCoverPhoto NOT called
    - Cross-user: photoEntries.findById is itself scoped by userId — if a row exists with photoEntryId but for another user, findById returns null → not_found path
    - Transaction reuse: setCoverPhoto receives a UoW whose `.transaction(fn)` synchronously yields the SAME tx the adapter is already inside (no nested transaction). Verify by mocking setCoverPhoto and asserting the `uow` arg's transaction passes through the captured tx.
  </behavior>
  <action>
    1. Implement src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts per the `<interfaces>` block (~60 lines). Mirror Plan 05-06's deletePlant pattern EXACTLY for the try/catch + Sentry block and the inngest.send call shape. The only differences from deletePlant: (a) takes photoEntryId + plantId rather than plantId only; (b) calls photoEntries.deleteByIdAndPlant rather than plants.deleteByIdAndUser; (c) the empty-paths edge case is more likely (single PhotoEntry vs whole plant).

       Verify Plan 05-03's photoEntries.deleteByIdAndPlant returns `{ deletedPaths: string[] } | null`. Plan 05-07's must_haves say it returns `{ deletedPaths: string[] }` so this should already be the contract. If 05-03 ships it as `Promise<boolean>` only (no paths), extend the repo function to add a `RETURNING photo_url, thumbnail_url` clause and return the paths. Document the extension with a code comment "Phase 5 Plan 05-09 extension — was Promise<boolean> in 05-03, returns paths now per 05-09 atomic-cleanup requirement".

    2. Implement src/contexts/catalog/application/set-cover-photo-by-entry-id.ts per the `<interfaces>` block (~45 lines). Verify Plan 05-03 ships `photoEntries.findById(tx, { id, userId }) => Promise<PhotoEntry | null>`. If absent, add it (one-liner SQL: `SELECT * FROM photo_entries WHERE id = $id AND user_id = $userId LIMIT 1`). Document with the same Phase 5 Plan 05-09 extension comment.

       Critical: the adapter passes a SHIM UoW to the underlying setCoverPhoto so both calls land in the same physical transaction. The shim is `{ transaction: async (fn) => fn(tx) }` — call setCoverPhoto's body callback with the tx already opened by this adapter. Without this shim, setCoverPhoto would open a nested (savepoint) transaction OR a sibling transaction depending on UoW implementation; either is wrong.

    3. Write tests/unit/contexts/catalog/delete-photo-entry-with-storage-cleanup.test.ts. Mock photoEntries (deleteByIdAndPlant), pendingDeletions (insert), Sentry.captureException, and createInngestSendStub for the inngest argument. Mock UoW.transaction to call the callback synchronously with a stub tx. Cover the 5 unit behaviors above. ~85 lines.

    4. Write tests/unit/contexts/catalog/set-cover-photo-by-entry-id.test.ts. Mock photoEntries.findById and the underlying setCoverPhoto (via vi.mock on its module path). Cover the 5 unit behaviors above (including the transaction-reuse assertion). ~70 lines.

    5. Run both test files. `pnpm exec tsc --noEmit` clean.
  </action>
  <acceptance_criteria>
    - src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts contains literal `args.uow.transaction` AND `pendingDeletions.insert` AND `args.inngest.send` AND `Sentry.captureException` AND `notFound("photo_entry_not_found")` AND `PlantDeletedEventName`
    - src/contexts/catalog/application/set-cover-photo-by-entry-id.ts contains literal `photoEntries.findById` AND `setCoverPhoto` AND `notFound("photo_entry_not_found")` AND `entry.plantId !== args.plantId`
    - set-cover-photo-by-entry-id.ts does NOT contain literal `forbidden` (must use not_found for cross-plant defense to avoid information disclosure)
    - tests/unit/contexts/catalog/delete-photo-entry-with-storage-cleanup.test.ts has at least 5 `it(...)` cases including ones named with "empty" or "no paths" / "dispatch failure" or "captureException" / "not found"
    - tests/unit/contexts/catalog/set-cover-photo-by-entry-id.test.ts has at least 5 `it(...)` cases including ones named with "cross-plant" or "different plant" / "not found"
    - `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/delete-photo-entry-with-storage-cleanup.test.ts tests/unit/contexts/catalog/set-cover-photo-by-entry-id.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "args\.uow\.transaction" src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts && grep -q "pendingDeletions\.insert" src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts && grep -q "args.inngest.send" src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts && grep -q "Sentry\.captureException" src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts && grep -q "PlantDeletedEventName" src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts && grep -q "photoEntries\.findById" src/contexts/catalog/application/set-cover-photo-by-entry-id.ts && grep -q "entry\.plantId !== args\.plantId" src/contexts/catalog/application/set-cover-photo-by-entry-id.ts && (grep -c "forbidden" src/contexts/catalog/application/set-cover-photo-by-entry-id.ts | grep -q "^0$") && pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/delete-photo-entry-with-storage-cleanup.test.ts tests/unit/contexts/catalog/set-cover-photo-by-entry-id.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>Both new use cases shipped + unit-tested. The atomic-outbox path for per-photo deletion mirrors 05-06 deletePlant exactly. The cover-photo adapter resolves photo_entry_id with cross-plant + cross-user defense via not_found (not forbidden — no info disclosure).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Ship the 6 mutating route handlers + their integration tests (PATCH plant, DELETE plant, POST photo, PATCH photo note, DELETE photo, PATCH cover-photo)</name>
  <files>
    src/app/api/v1/plants/[plantId]/route.ts,
    src/app/api/v1/plants/[plantId]/photos/route.ts,
    src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts,
    src/app/api/v1/plants/[plantId]/cover-photo/route.ts,
    tests/integration/catalog/patch-plant-route.integration.test.ts,
    tests/integration/catalog/delete-plant-route.integration.test.ts,
    tests/integration/catalog/post-photo-entry-route.integration.test.ts,
    tests/integration/catalog/patch-photo-entry-route.integration.test.ts,
    tests/integration/catalog/delete-photo-entry-route.integration.test.ts,
    tests/integration/catalog/patch-cover-photo-route.integration.test.ts
  </files>
  <read_first>
    - src/app/api/v1/plants/route.ts (Plan 05-08 — the canonical thin-handler pattern; note exact import order, exact try/catch placement, exact `return idempotent(req, async () => { ... })` wrapping shape, exact `await params` Next 16 dynamic-route extraction)
    - src/app/api/v1/plants/[plantId]/route.ts (Plan 05-08 — the existing GET handler; this plan APPENDS PATCH + DELETE exports; the GET handler MUST remain intact)
    - src/app/api/v1/plants/[plantId]/photos/route.ts (Plan 05-08 — the existing GET handler; this plan APPENDS POST; the GET handler MUST remain intact)
    - src/app/api/v1/plants/from-identification/route.ts (Plan 05-08 — analog for inline Zod schema usage; CoverPhotoPatchSchema in 05-09 follows the same `.strict()` shape)
    - src/shared/api/http-error-map.ts (Plan 05-08 Task 1 — httpMapDomainError; consumed verbatim)
    - src/contexts/catalog/application/{update-plant,add-photo-entry,update-photo-entry-note}.ts (Plan 05-07 — use case signatures consumed by 3 of the 6 handlers)
    - src/contexts/catalog/application/delete-plant.ts (Plan 05-06 — DELETE plant invokes this; signature `({ plantId, userId, uow, inngest }) => Promise<void>`)
    - src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts (Task 1 of THIS plan)
    - src/contexts/catalog/application/set-cover-photo-by-entry-id.ts (Task 1 of THIS plan)
    - src/contexts/catalog/domain/plant.ts (Plan 05-04 — PlantPatchSchema; verify it is `.strict()` for mass-assignment defense; if 05-04 shipped it without .strict(), extend with a Phase 5 Plan 05-09 amendment comment + grep -q '\\.strict()')
    - src/contexts/catalog/domain/photo-entry.ts (Plan 05-04 — PhotoEntryCreateSchema)
    - src/contexts/catalog/domain/storage-path.ts (Plan 05-04 — validateStoragePathOwnership; T-5-01 defense in depth at route layer per 05-09 decisions.photo_path_ownership_at_route)
    - tests/integration/catalog/post-plants-route.integration.test.ts (Plan 05-08 — the canonical integration test pattern: in-process `await import("../../../src/app/api/v1/plants/route")`, vi.mock requireUser, withRollback DB seeding, idempotency replay assertion shape)
    - tests/helpers/inngest-stub.ts (Plan 05-01 — createInngestSendStub for capturing dispatched events in DELETE tests)
    - tests/helpers/db-guard.ts + transaction-rollback.ts (Plan 05-01 — withRollback fixture; cloud DB guard)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-37/D-38 (Idempotency-Key contract — verify `idempotent` helper accepts PATCH + DELETE, not just POST; per Pitfall 8, GETs do NOT accept Idempotency-Key)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Pitfall 1: Storage path ownership spoofing" — defense in depth at route layer is mandated by 05-09 must_haves
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § "Security Domain" rows: Photo URL spoofing, IDOR, Mass-assignment, Idempotency replay
  </read_first>
  <behavior>
    PATCH /api/v1/plants/:plantId integration:
    - Happy path: seed plant for U1, PATCH with `{ name: "Espadinha", nickname: null }` and Idempotency-Key → returns 200 + Plant with name "Espadinha" + nickname null; SELECT confirms persisted
    - Mass-assignment rejection: PATCH with `{ id: "FAKE-ID" }` → 400 validation_failed (PlantPatchSchema.strict() rejects unknown key); SELECT confirms id NOT changed
    - Mass-assignment rejection: PATCH with `{ user_id: "OTHER" }` → 400 validation_failed
    - Mass-assignment rejection: PATCH with `{ species_id: "S1" }` → 400 validation_failed (species_id not in writable allowlist)
    - Mass-assignment rejection: PATCH with `{ cover_photo_url: "EVIL/path/x.jpg" }` → 400 validation_failed (cover_photo_url MUST be set via the dedicated PATCH /cover-photo endpoint, not via PATCH /:plantId)
    - Cross-user: seed plant for U1, mock requireUser to return U2, PATCH → 404 not_found (use case throws because plants.updatePartial scopes by userId)
    - Idempotency replay: PATCH twice with same Idempotency-Key + same body → second call returns identical 200 response WITHOUT re-executing updatePlant (verify via spy on use case OR via SELECT updated_at unchanged)
    - Missing JWT: vi.mock requireUser to throw unauthenticated → 401

    DELETE /api/v1/plants/:plantId integration:
    - Happy path: seed plant for U1 with 2 photo_entries, mock inngest.send via createInngestSendStub, DELETE with Idempotency-Key → returns 204; SELECT plants WHERE id=$1 returns 0 rows; SELECT photo_entries WHERE plant_id=$1 returns 0 rows (FK CASCADE per 05-06); SELECT pending_storage_deletions WHERE plant_id=$1 returns 1 row with status='pending' AND storage_paths matching the 4 paths; createInngestSendStub captured exactly 1 plant.deleted event with the expected payload shape
    - Empty-photo plant: seed plant with 0 photo_entries → DELETE → returns 204; pending_storage_deletions has 0 rows for this plant; createInngestSendStub captured 0 events (mirrors 05-06 empty-photo skip)
    - Cross-user: seed plant for U1, mock requireUser to return U2, DELETE → 404 not_found (deletePlant throws)
    - Idempotency replay: DELETE same plant twice with same Idempotency-Key → second call returns 204 WITHOUT re-attempting the DELETE (verify via SELECT pending_storage_deletions WHERE plant_id=$1 returns still 1 row, NOT 2)
    - Identification preserved: seed plant + 1 identification linked to plant → DELETE plant → identifications row still exists with plant_id NULL (Phase 2 D-07 FK SET NULL — same assertion as 05-06 integration test, but exercised through the route)

    POST /api/v1/plants/:plantId/photos integration:
    - Happy path: seed plant for U1, POST with `{ photo_url: "U1/P1/x.jpg", thumbnail_url: "U1/P1/x-thumb.jpg" }` and Idempotency-Key → returns 201 + PhotoEntry; SELECT confirms row inserted
    - Spoofed photo_url: POST with `{ photo_url: "U2/P1/x.jpg", thumbnail_url: "U1/P1/x-thumb.jpg" }` → 400 validation_failed with code path "storage_path_ownership_failed" + details.badPaths includes "U2/P1/x.jpg" (T-5-01 — route-layer check fires before use case is invoked; verify via spy that addPhotoEntry was NOT called)
    - Spoofed thumbnail_url: POST with `{ photo_url: "U1/P1/x.jpg", thumbnail_url: "U1/P_OTHER/x-thumb.jpg" }` → 400 validation_failed (cross-plant prefix)
    - Missing photo_url: POST with `{ thumbnail_url: "U1/P1/x-thumb.jpg" }` → 400 validation_failed (zod input_invalid)
    - Note too long: POST with `{ photo_url, thumbnail_url, note: "x".repeat(2001) }` → 400 validation_failed (PhotoEntryCreateSchema caps note at 2000)
    - Plant not found: POST with valid body but plantId for non-existent plant → 404 not_found (addPhotoEntry use case throws when plants.findByIdAndUser returns null)
    - Idempotency replay: POST twice with same Idempotency-Key + same body → second call returns identical 201 response WITHOUT inserting a second photo_entry row

    PATCH /api/v1/plants/:plantId/photos/:photoEntryId integration:
    - Happy path: seed plant + photo_entry for U1, PATCH with `{ note: "Floresceu hoje!" }` and Idempotency-Key → returns 200 + PhotoEntry with note set; SELECT confirms
    - Set note to null: PATCH with `{ note: null }` → returns 200 + PhotoEntry with note null
    - Note too long: PATCH with `{ note: "x".repeat(2001) }` → 400 validation_failed
    - Cross-plant photoEntryId: seed photo_entry for plantA, PATCH targeting plantB/:photoEntryId → 404 not_found (updatePhotoEntryNote use case scopes by (id, plantId, userId) and returns null when (id, plantId) mismatch)
    - Cross-user: seed photo_entry for U1, mock requireUser to return U2 → 404 not_found
    - Idempotency replay: PATCH twice with same Idempotency-Key + same body → second call returns identical 200 response

    DELETE /api/v1/plants/:plantId/photos/:photoEntryId integration:
    - Happy path: seed plant + photo_entry (with photo_url and thumbnail_url) for U1, mock inngest.send, DELETE with Idempotency-Key → returns 204; SELECT photo_entries WHERE id=$1 returns 0 rows; SELECT pending_storage_deletions WHERE plant_id=$1 returns 1 row with status='pending' AND storage_paths matching [photo_url, thumbnail_url]; createInngestSendStub captured exactly 1 plant.deleted event with the expected payload shape (note: same event name as plant deletion — the cleanup-storage Inngest function from 05-06 doesn't distinguish plant-vs-photo cleanup)
    - Empty paths edge case: seed photo_entry with photo_url and thumbnail_url both empty strings (or NULL — depends on schema) → DELETE → still returns 204; pending_storage_deletions has 0 rows for this plant; createInngestSendStub captured 0 events (mirrors the empty-paths branch in deletePhotoEntryWithStorageCleanup)
    - Cross-plant photoEntryId: photo_entry belongs to plantA, DELETE via plantB/:photoEntryId → 404 not_found
    - Cross-user: photo_entry belongs to U1, mock requireUser to return U2 → 404 not_found
    - Idempotency replay: DELETE same photo_entry twice with same Idempotency-Key → second call returns 204 WITHOUT inserting a second pending_storage_deletions row

    PATCH /api/v1/plants/:plantId/cover-photo integration:
    - Happy path: seed plant + photo_entry for U1, PATCH with `{ photo_entry_id: "PE1" }` and Idempotency-Key → returns 200 + Plant with cover_photo_url set to PE1.photo_url; SELECT plants WHERE id=$1 confirms cover_photo_url updated
    - Cross-plant photo_entry_id: seed photo_entryA for plantA + plantB also for U1, PATCH plantB with photo_entryA.id → 404 not_found (setCoverPhotoByEntryId throws because entry.plantId !== args.plantId)
    - Cross-user photo_entry_id: photo_entry belongs to U1, PATCH for U1's plant with photo_entryX (where photo_entryX belongs to U2) → 404 not_found (photoEntries.findById scopes by userId, returns null)
    - photo_entry_id not found (truly): PATCH with random UUID → 404 not_found
    - Bad UUID: PATCH with `{ photo_entry_id: "not-a-uuid" }` → 400 validation_failed (CoverPhotoPatchSchema z.string().uuid())
    - Idempotency replay: PATCH twice with same Idempotency-Key + same body → second call returns identical 200 response
  </behavior>
  <action>
    1. EDIT src/app/api/v1/plants/[plantId]/route.ts to APPEND PATCH and DELETE exports. The GET handler from Plan 05-08 MUST remain intact at the top of the file. Add new imports (PlantPatchSchema, updatePlant, deletePlant, idempotent, inngest) below the existing 05-08 imports. Use the EXACT thin-handler pattern from 05-08: try-block opens with `await requireUser(req)`, catch-block returns `httpMapDomainError(err)`. Wrap in `idempotent(req, async () => { ... })`.

    2. EDIT src/app/api/v1/plants/[plantId]/photos/route.ts to APPEND POST. The GET handler from Plan 05-08 MUST remain intact. Add imports (PhotoEntryCreateSchema, addPhotoEntry, validateStoragePathOwnership, idempotent). The POST handler MUST call validateStoragePathOwnership BEFORE invoking addPhotoEntry, returning errorResponse(ErrorCode.ValidationFailed, "storage_path_ownership_failed", { badPaths }) on failure. This is the T-5-01 defense in depth at the route layer per 05-09 decisions.photo_path_ownership_at_route.

    3. CREATE src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts as NEW FILE per `<interfaces>` block. Inline Zod schema `PhotoEntryNotePatchSchema = z.object({ note: z.string().max(2000).nullable() }).strict()` for PATCH. Both PATCH + DELETE handlers wrap in idempotent.

    4. CREATE src/app/api/v1/plants/[plantId]/cover-photo/route.ts as NEW FILE per `<interfaces>` block. Inline Zod schema `CoverPhotoPatchSchema = z.object({ photo_entry_id: z.string().uuid() }).strict()`. Wrap in idempotent.

    5. Verify `PlantPatchSchema` from Plan 05-04 is `.strict()` (mass-assignment defense). Run `grep -q "\\.strict()" src/contexts/catalog/domain/plant.ts`. If absent, add `.strict()` modifier with a code comment "Phase 5 Plan 05-09 amendment — strict for mass-assignment defense per T-5-mass-assignment". This is a load-bearing security check.

    6. Write 6 integration test files. Mirror Plan 05-08 Task 2 EXACTLY for the in-process route handler import pattern:
       ```ts
       const mod = await import("../../../src/app/api/v1/plants/[plantId]/route");
       const res = await mod.PATCH(new Request("http://localhost:3000/api/v1/plants/PLANT-ID", {
         method: "PATCH",
         headers: { "Idempotency-Key": "TEST-KEY-1", "Content-Type": "application/json" },
         body: JSON.stringify({ name: "Espadinha" }),
       }), { params: Promise.resolve({ plantId: "PLANT-ID" }) });
       ```
       Use `vi.mock("@shared/auth/require-user", () => ({ requireUser: vi.fn(() => Promise.resolve({ id: "U1" })) }))` for JWT mocking. For DELETE tests, mock `@shared/events/inngest-client` to return createInngestSendStub. Seed DB rows via `withRollback(sql, async (tx) => { ... })` from Plan 05-01.

       Required test counts per file (from `must_haves.artifacts.min_lines` budgets):
       - patch-plant-route: 8+ cases (happy, 4 mass-assignment rejections, cross-user, idempotency, missing-JWT)
       - delete-plant-route: 5+ cases (happy with cascade + outbox + event, empty-photo, cross-user, idempotency, identification preserved)
       - post-photo-entry-route: 7+ cases (happy, 2 storage spoofs, missing photo_url, note too long, plant not found, idempotency)
       - patch-photo-entry-route: 6+ cases (happy, set null, note too long, cross-plant, cross-user, idempotency)
       - delete-photo-entry-route: 5+ cases (happy with outbox + event, empty paths, cross-plant, cross-user, idempotency)
       - patch-cover-photo-route: 6+ cases (happy, cross-plant, cross-user, not-found, bad UUID, idempotency)

    7. Run all 6 integration test files. `pnpm exec tsc --noEmit` clean. Verify no drizzle-orm imports anywhere in src/app/api/v1/plants (D-17).
  </action>
  <acceptance_criteria>
    - src/app/api/v1/plants/[plantId]/route.ts contains literal `export async function GET` (from 05-08, MUST be preserved) AND `export async function PATCH` AND `export async function DELETE`
    - src/app/api/v1/plants/[plantId]/route.ts contains literal `idempotent(req, async` AND `httpMapDomainError` AND `requireUser(req)` AND `PlantPatchSchema` AND `updatePlant` AND `deletePlant`
    - src/app/api/v1/plants/[plantId]/route.ts DELETE handler contains literal `inngest` (passed to deletePlant)
    - src/app/api/v1/plants/[plantId]/photos/route.ts contains literal `export async function GET` (from 05-08) AND `export async function POST`
    - src/app/api/v1/plants/[plantId]/photos/route.ts POST contains literal `validateStoragePathOwnership` AND `storage_path_ownership_failed` (T-5-01 defense in depth at route layer)
    - src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts contains literal `export async function PATCH` AND `export async function DELETE`
    - src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts contains literal `PhotoEntryNotePatchSchema` AND `.strict()` AND `z.string().max(2000).nullable()` AND `deletePhotoEntryWithStorageCleanup`
    - src/app/api/v1/plants/[plantId]/cover-photo/route.ts contains literal `export async function PATCH` AND `CoverPhotoPatchSchema` AND `z.string().uuid()` AND `setCoverPhotoByEntryId` AND `.strict()`
    - PlantPatchSchema in src/contexts/catalog/domain/plant.ts is `.strict()` (mass-assignment defense — load-bearing security check)
    - No route handler imports from drizzle-orm: `grep -rl "drizzle-orm" src/app/api/v1/plants 2>/dev/null | wc -l` returns 0
    - All 6 integration test files exist
    - `pnpm exec vitest --run --project=integration tests/integration/catalog/patch-plant-route.integration.test.ts tests/integration/catalog/delete-plant-route.integration.test.ts tests/integration/catalog/post-photo-entry-route.integration.test.ts tests/integration/catalog/patch-photo-entry-route.integration.test.ts tests/integration/catalog/delete-photo-entry-route.integration.test.ts tests/integration/catalog/patch-cover-photo-route.integration.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
    - 05-08's GET handlers in the shared files are still passing: re-run `pnpm exec vitest --run --project=integration tests/integration/catalog/get-plant-detail-route.integration.test.ts tests/integration/catalog/get-plant-photos-route.integration.test.ts` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "export async function GET" src/app/api/v1/plants/[plantId]/route.ts && grep -q "export async function PATCH" src/app/api/v1/plants/[plantId]/route.ts && grep -q "export async function DELETE" src/app/api/v1/plants/[plantId]/route.ts && grep -q "idempotent(req, async" src/app/api/v1/plants/[plantId]/route.ts && grep -q "PlantPatchSchema" src/app/api/v1/plants/[plantId]/route.ts && grep -q "updatePlant" src/app/api/v1/plants/[plantId]/route.ts && grep -q "deletePlant" src/app/api/v1/plants/[plantId]/route.ts && grep -q "export async function GET" src/app/api/v1/plants/[plantId]/photos/route.ts && grep -q "export async function POST" src/app/api/v1/plants/[plantId]/photos/route.ts && grep -q "validateStoragePathOwnership" src/app/api/v1/plants/[plantId]/photos/route.ts && grep -q "storage_path_ownership_failed" src/app/api/v1/plants/[plantId]/photos/route.ts && grep -q "export async function PATCH" src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts && grep -q "export async function DELETE" src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts && grep -q "deletePhotoEntryWithStorageCleanup" src/app/api/v1/plants/[plantId]/photos/[photoEntryId]/route.ts && grep -q "export async function PATCH" src/app/api/v1/plants/[plantId]/cover-photo/route.ts && grep -q "setCoverPhotoByEntryId" src/app/api/v1/plants/[plantId]/cover-photo/route.ts && grep -q "z\.string()\.uuid()" src/app/api/v1/plants/[plantId]/cover-photo/route.ts && grep -v '^[[:space:]]*//' src/contexts/catalog/domain/plant.ts | grep -q "\.strict()" && (find src/app/api/v1/plants -name '*.ts' -exec grep -l "drizzle-orm" {} + 2>/dev/null | wc -l | tr -d ' ' | grep -q "^0$") && pnpm exec vitest --run --project=integration tests/integration/catalog/patch-plant-route.integration.test.ts tests/integration/catalog/delete-plant-route.integration.test.ts tests/integration/catalog/post-photo-entry-route.integration.test.ts tests/integration/catalog/patch-photo-entry-route.integration.test.ts tests/integration/catalog/delete-photo-entry-route.integration.test.ts tests/integration/catalog/patch-cover-photo-route.integration.test.ts && pnpm exec tsc --noEmit && pnpm exec vitest --run --project=integration tests/integration/catalog/get-plant-detail-route.integration.test.ts tests/integration/catalog/get-plant-photos-route.integration.test.ts</automated>
  </verify>
  <done>6 mutating route handlers shipped (4 files; 2 EXTENDED with append-only edits next to 05-08 GETs, 2 NEW). Thin-handler pattern preserved (no drizzle imports). Idempotency wrapped on all 6. T-5-01 storage-path defense at route layer for POST /:plantId/photos. Mass-assignment defense at PATCH /:plantId via PlantPatchSchema.strict(). Cross-plant + cross-user defense returns not_found (no info disclosure) on cover-photo set + photo-entry mutations. 6 integration test files green covering 37+ behaviors. 05-08 GETs still pass.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-01" severity="high" stride="T">
  <description>Photo URL spoofing on POST /api/v1/plants/:plantId/photos — client uploads a photo via /api/v1/photos/upload to their own user/plant prefix, then submits a different user's path in the POST body hoping the server only validates URL shape. Mirrors Pitfall 1 from 05-RESEARCH.md.</description>
  <mitigation file="src/app/api/v1/plants/[plantId]/photos/route.ts">POST handler calls `validateStoragePathOwnership({ paths: [photo_url, thumbnail_url], userId: user.id, plantId })` from 05-04 BEFORE invoking the addPhotoEntry use case. On failure, returns `errorResponse(ErrorCode.ValidationFailed, "storage_path_ownership_failed", { badPaths })` — no DB write happens. This is defense in depth: the use case in 05-07 (addPhotoEntry) ALSO performs the same check. The route-layer check catches the spoof earlier (before transaction open) and the use-case check ensures the defense holds even if a future caller bypasses the route. Integration test `tests/integration/catalog/post-photo-entry-route.integration.test.ts` covers 2 spoofing variants (cross-user prefix + cross-plant prefix); both return validation_failed with the bad path in details.</mitigation>
</threat>

<threat id="T-5-02" severity="high" stride="I">
  <description>IDOR — JWT verification bypass on /api/v1/plants/:plantId/* mutating endpoints would let any unauthenticated request modify or delete every user's catalog. Same vector as 05-08's threat T-5-02.</description>
  <mitigation file="src/app/api/v1/plants/[plantId]/route.ts">Every handler calls `requireUser(req)` (Phase 2 D-32/D-33) as the FIRST line inside try block. requireUser throws unauthenticated (JWT missing) or token_expired (JWT expired) BEFORE any use case runs. Defense in depth: every use case (updatePlant, deletePlant, addPhotoEntry, etc.) also takes a `userId` parameter and the underlying repository functions filter by `user_id` in WHERE clauses. RLS on plants/photo_entries tables (Phase 2 D-22) is the third layer. Cross-user mutations return 404 not_found (NOT 403 forbidden) — never confirms the row exists for a different user, no information disclosure. Integration tests for all 6 routes mock requireUser to return U2 against U1's seeded rows and verify 404.</mitigation>
</threat>

<threat id="T-5-mass-assignment" severity="medium" stride="T">
  <description>Mass-assignment on PATCH /api/v1/plants/:plantId — client submits `{ id, user_id, species_id, cover_photo_url, created_at }` hoping the server blindly maps body keys to columns. cover_photo_url is the highest-value target (set arbitrary cover with no ownership check); user_id would let the client transfer the plant to another user; species_id would let them rewrite the identification result.</description>
  <mitigation file="src/contexts/catalog/domain/plant.ts">Defense layered three deep. (1) PlantPatchSchema in 05-04 is `.strict()` and picks only writable fields (name, nickname, location, acquisition_date, notes); unknown keys → validation_failed. Plan 05-09 verifies `.strict()` is present and adds it if 05-04 omitted (load-bearing security check; grep gate on the verify command). (2) updatePlant use case in 05-07 takes a typed `patch: PlantPatch` parameter; TypeScript itself rejects arbitrary keys at compile time. (3) plants.updatePartial repository function (05-03) only writes the listed PlantPatch columns — even if a future caller bypassed the schema, the repo wouldn't write to id/user_id/species_id/cover_photo_url. The PATCH /:plantId/cover-photo dedicated endpoint (with its own PhotoEntry ownership check via setCoverPhotoByEntryId) is the only path to update cover_photo_url. Integration test `patch-plant-route.integration.test.ts` covers 4 mass-assignment variants explicitly (id, user_id, species_id, cover_photo_url); all return 400 validation_failed.</mitigation>
</threat>

<threat id="T-5-18" severity="medium" stride="I">
  <description>Idempotency replay disclosure across users — if Phase 2 D-37's idempotency table is keyed only by Idempotency-Key (not user_id), two users could collide on the same key and one could replay the other's PATCH/DELETE response.</description>
  <mitigation file="src/app/api/v1/plants/[plantId]/route.ts">Phase 2 D-37 spec calls for (key, user_id) composite uniqueness in the idempotency_keys table. The `idempotent(req, fn)` helper from Phase 2 reads user_id from JWT (via requireUser called inside the wrapped fn) before scoping the lookup. This plan does NOT re-implement the helper — it relies on Phase 2's correct implementation. Integration tests for all 6 routes include happy-path replay (same user, same key → same response); cross-user collision is a Phase 2 regression test, not Phase 5's responsibility. Per Pitfall 8, response body size cap is also a Phase 2 concern; Phase 5 mutating responses (Plant + PhotoEntry) are well under the cap (single-resource JSONs).</mitigation>
</threat>

<threat id="T-5-03" severity="high" stride="R">
  <description>Storage object leak after photo deletion — DELETE /:plantId/photos/:photoEntryId removes the DB row but the underlying photo_url + thumbnail_url storage objects must also be cleaned up. Same vector as 05-06's T-5-03 (post-commit dispatch failure orphans storage), applied to per-photo deletion. Plan 05-07 deferred per-photo cleanup as an "acceptable trade-off" — Plan 05-09 OVERRIDES that decision per the planning context's must_have.</description>
  <mitigation file="src/contexts/catalog/application/delete-photo-entry-with-storage-cleanup.ts">Plan 05-09 ships a NEW use case `deletePhotoEntryWithStorageCleanup` that mirrors 05-06 deletePlant EXACTLY: atomic transaction inserts a pending_storage_deletions row with the photo_url + thumbnail_url paths AT THE SAME TIME as the photo_entry DELETE; transaction commits; post-commit `inngest.send` dispatches a plant.deleted event (intentional reuse — the cleanup-storage Inngest function from 05-06 doesn't distinguish plant-vs-photo cleanup; it just deletes job.storagePaths from the loaded row). On dispatch failure: try/catch swallows the error, logs to Sentry, and the durable pending row is picked up by the catalog/reconcile-deletions cron from 05-06 (5-minute poll, threshold 300s). Integration test asserts: (1) the pending row is inserted in the same transaction as the DELETE; (2) the plant.deleted event payload's storage_paths matches the deleted photo's paths; (3) idempotent replay does NOT insert a second pending row (Phase 2 D-37 cached response).</mitigation>
</threat>

<threat id="T-5-cross-plant" severity="medium" stride="T">
  <description>Cross-plant photoEntryId tampering on PATCH /api/v1/plants/:plantId/cover-photo — client knows photo_entry_id PE1 (theirs, but belongs to plant P1) and submits it as `photo_entry_id` for plant P2 (also theirs), hoping the server sets P2's cover to PE1's photo. Confirming PE1 exists for the user (e.g., returning forbidden vs not_found differently) leaks information about other plants.</description>
  <mitigation file="src/contexts/catalog/application/set-cover-photo-by-entry-id.ts">setCoverPhotoByEntryId opens a UoW transaction and calls `photoEntries.findById(tx, { id: photoEntryId, userId })` (scoped by userId — RLS + repo filter). If the entry doesn't exist, throws not_found. If the entry exists but `entry.plantId !== args.plantId`, ALSO throws not_found (NOT forbidden) — both cases return identical error response, no information disclosure. Only after both checks pass does the adapter delegate to 05-07 setCoverPhoto, passing the resolved photoUrl through the SAME transaction (UoW shim `{ transaction: async (fn) => fn(tx) }` to avoid nested transaction). Defense in depth: 05-07 setCoverPhoto's internal cross-plant check (`SELECT 1 FROM photo_entries WHERE photo_url = $photoUrl AND plant_id = $plantId AND user_id = $userId`) also fires, but should never reject because the adapter already resolved photoUrl from a row that matches plantId + userId. Integration test asserts cross-plant photo_entry_id returns 404 (not 403) and that cross-user photo_entry_id (different userId) ALSO returns 404 via the userId-scoped findById.</mitigation>
</threat>

<threat id="T-5-EXIF-GPS" severity="medium" stride="I">
  <description>EXIF GPS leak on POST /:plantId/photos — Plan 05-09's POST handler validates path ownership but does NOT re-strip EXIF/GPS from the uploaded photo (the upload happened earlier via /api/v1/photos/upload from Phase 2 D-27, which already strips client-side AND rejects server-side). Phase 5's POST /:plantId/photos receives only the storage path string, not the binary — so it cannot re-validate EXIF.</description>
  <mitigation file="src/app/api/v1/plants/[plantId]/photos/route.ts">Defense lives at the upload layer (Phase 2 D-27 + D-29 + D-30): client strips EXIF via browser-image-compression with preserveExif: false, server rejects GPS-bearing uploads via exifr (validation_failed). By the time the POST /:plantId/photos handler runs, the storage object has already been gated. Plan 05-09 inherits this defense; no Phase 5 additions needed at the catalog API layer. Surfaced here for awareness — if a future change allows direct client-side Storage uploads (bypassing /api/v1/photos/upload), this defense disappears and Plan 05-09 would need to add a server-side EXIF re-validation step (download object via service role, run exifr, reject with validation_failed if GPS present).</mitigation>
</threat>

<threat id="T-5-13" severity="low" stride="I">
  <description>Sentry breadcrumb leak on the route handler path — if an exception is thrown during PATCH/POST handling, the request body could be auto-attached to the Sentry event including user-supplied content (plant name, nickname, notes, photo journal note).</description>
  <mitigation file="src/app/api/v1/plants/[plantId]/route.ts">Sentry user scoping is `Sentry.setUser({ id })` only (Phase 1 LGPD-13). The route handlers call requireUser which sets the Sentry user scope to { id: user.id } — never email, never PII. Body content (plant name, nickname, notes) is low-PII (no auth/payment data) but still user-supplied. Phase 1 D-22 explicitly drops request bodies on identification routes; Plant routes are NOT on that list. If the user prefers to add Plant routes to the body-drop list, that's a Phase 1 LGPD-13 amendment outside Plan 05-09's scope. Surfaced here for awareness; no Phase 5 mitigation required by the closed registry.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/delete-photo-entry-with-storage-cleanup.test.ts tests/unit/contexts/catalog/set-cover-photo-by-entry-id.test.ts` exits 0.
2. `pnpm exec vitest --run --project=integration tests/integration/catalog/patch-plant-route.integration.test.ts tests/integration/catalog/delete-plant-route.integration.test.ts tests/integration/catalog/post-photo-entry-route.integration.test.ts tests/integration/catalog/patch-photo-entry-route.integration.test.ts tests/integration/catalog/delete-photo-entry-route.integration.test.ts tests/integration/catalog/patch-cover-photo-route.integration.test.ts` exits 0.
3. `pnpm exec tsc --noEmit` exits 0.
4. `find src/app/api/v1/plants -name '*.ts' -exec grep -l "drizzle-orm" {} +` returns no files (Phase 2 D-17 ESLint guard satisfied).
5. 05-08's GET handlers in shared files still pass: `pnpm exec vitest --run --project=integration tests/integration/catalog/get-plant-detail-route.integration.test.ts tests/integration/catalog/get-plant-photos-route.integration.test.ts` exits 0 (regression check after appending PATCH/DELETE/POST exports).
6. PlantPatchSchema is `.strict()` (verified by `grep -v '^[[:space:]]*//' src/contexts/catalog/domain/plant.ts | grep -q "\\.strict()"` — comment lines excluded so a self-invalidating grep gate doesn't pass on header prose).
7. All 6 mutating endpoints accept Idempotency-Key (verified by literal `idempotent(req, async` grep in each route file).
</verification>

<success_criteria>
- 6 endpoints shipped: PATCH /:plantId, DELETE /:plantId, POST /:plantId/photos, PATCH /:plantId/photos/:photoEntryId, DELETE /:plantId/photos/:photoEntryId, PATCH /:plantId/cover-photo.
- 2 NEW use cases shipped overriding/adapting 05-07: deletePhotoEntryWithStorageCleanup (atomic outbox per photo, mirrors 05-06 deletePlant) and setCoverPhotoByEntryId (resolves photo_entry_id → photoUrl with cross-plant + cross-user defense via not_found).
- All POSTs/PATCHes/DELETEs accept Idempotency-Key (CONTEXT D-23B + Phase 2 D-37/D-38). Replay returns identical 200/201/204 response without re-execution.
- T-5-01 photo path ownership defended at TWO layers: route handler calls validateStoragePathOwnership BEFORE use case (early reject, no transaction); 05-07 addPhotoEntry use case ALSO validates (defense in depth).
- T-5-mass-assignment defended via PlantPatchSchema.strict() at route layer + typed PlantPatch at use case layer + repo writes only allowlisted columns.
- T-5-03 storage object leak defended via atomic transaction + outbox + post-commit Inngest dispatch + reconciler safety net (mirrors 05-06 pattern; reuses pending_storage_deletions table + plant.deleted event + cleanup-storage function).
- T-5-cross-plant defended via not_found (not forbidden) on cover-photo and photo-entry mutations; no information disclosure about photo_entry existence in other plants or for other users.
- All 6 handlers thin: validate → use case → HTTP map. No drizzle-orm imports in src/app/api/v1/plants (Phase 2 D-17 ESLint guard satisfied).
- 6 integration test files cover 37+ behaviors total; all green.
- 05-08's GET handlers in the 2 shared route files remain functional (regression check passes).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-09-SUMMARY.md` capturing:

- The 6 endpoint paths shipped + their accepted body schemas + response shapes:
  - `PATCH /api/v1/plants/:plantId` — body: PlantPatchSchema.strict() (name?, nickname?, location?, acquisition_date?, notes?), response: 200 + Plant
  - `DELETE /api/v1/plants/:plantId` — body: none, response: 204 No Content
  - `POST /api/v1/plants/:plantId/photos` — body: PhotoEntryCreateSchema (photo_url, thumbnail_url, note?), response: 201 + PhotoEntry
  - `PATCH /api/v1/plants/:plantId/photos/:photoEntryId` — body: PhotoEntryNotePatchSchema (note: string|null max 2000), response: 200 + PhotoEntry
  - `DELETE /api/v1/plants/:plantId/photos/:photoEntryId` — body: none, response: 204 No Content
  - `PATCH /api/v1/plants/:plantId/cover-photo` — body: CoverPhotoPatchSchema (photo_entry_id: uuid), response: 200 + Plant
  - All errors: { error: { code, message, details? } } via httpMapDomainError (closed registry: validation_failed, not_found, conflict, forbidden, unauthenticated, token_expired)

- Note for Plan 5b's TanStack Query mutation hooks (Phase 5.2 wave 2):
  - PATCH plant inline edits (name/nickname/location/acquisition_date/notes per field, save-on-blur per D-12) → PATCH /api/v1/plants/:plantId with `Idempotency-Key: crypto.randomUUID()` header per save
  - DELETE plant from overflow menu (D-19 destructive modal) → DELETE /api/v1/plants/:plantId with Idempotency-Key, expect 204 (no body)
  - POST photo entry from BottomSheet (D-16 modal sheet) → first /api/v1/photos/upload, then POST /api/v1/plants/:plantId/photos with Idempotency-Key
  - PATCH photo entry note from lightbox (D-17 "Editar nota") → PATCH /api/v1/plants/:plantId/photos/:photoEntryId with Idempotency-Key
  - DELETE photo entry from lightbox (D-17 "Excluir") → DELETE /api/v1/plants/:plantId/photos/:photoEntryId with Idempotency-Key, expect 204
  - PATCH cover photo from lightbox (D-17 "Definir como capa") → PATCH /api/v1/plants/:plantId/cover-photo with body `{ photo_entry_id }` and Idempotency-Key
  - All hooks generate Idempotency-Key with `crypto.randomUUID()` (per Pattern 4 in 05-PATTERNS.md / RESEARCH "Don't Hand-Roll" table)
  - Per D-07 hybrid optimism: PATCH plant + PATCH note + PATCH cover-photo are OPTIMISTIC (onMutate with snapshot + onError rollback); DELETE plant + DELETE photo entry + POST photo entry are PESSIMISTIC (button-loading until server response)

- Note: photo path ownership defense lives at TWO layers — THIS layer (route handler validateStoragePathOwnership before use case) AND at the use case layer in 05-07 addPhotoEntry. Both defenses must remain in place; do not remove either as "redundant".

- Note: idempotency wrap is at the route layer; use cases from 05-05/06/07 are NOT idempotent themselves. The Phase 2 D-37 idempotency_keys table caches the response by (key, user_id) — replay returns the cached response without re-executing the use case. This is documented in Plan 05-05's `behavior` block ("the use case itself is NOT idempotent... idempotency lives at the route layer per Phase 2 D-37").

- Note for Plan 05-07 maintainers: this plan OVERRIDES 05-07's decisions.delete_photo_entry_storage_cleanup. The route handler invokes `deletePhotoEntryWithStorageCleanup` (NEW in 05-09), NOT `deletePhotoEntry` (05-07). 05-07's `deletePhotoEntry` use case remains in the codebase for any future caller that wants the path-returning shape without auto-cleanup, but is not referenced by the Phase 5 route surface.

- Note for Phase 11 LGPD deletion: the same pending_storage_deletions outbox + cleanup-storage Inngest function now handles per-photo deletion (Plan 05-09) in addition to per-plant deletion (Plan 05-06). When Phase 11 implements account-wide hard delete, the same outbox + Inngest function can be reused (just enqueue all of the user's storage paths as a single job, or many jobs). No new infrastructure required.

- Note for Phase 6 Identification: PATCH /:plantId/cover-photo only accepts photo_entry_id, NOT identification result photo_url. If Phase 6 wants to set an identification photo as the cover (e.g., from createPlantFromIdentification — already handled in 05-05, sets cover at create time), that's done at create time via createPlantFromIdentification, not via the cover-photo endpoint.

- Wave override note: this plan is Wave 4 (not Wave 3 as planning context proposed) due to files_modified overlap with 05-08 on `src/app/api/v1/plants/[plantId]/route.ts` and `src/app/api/v1/plants/[plantId]/photos/route.ts`. Same-wave plans cannot share files (parallel execution would corrupt them). Execute-phase respects the wave numbering.
</output>
</content>
</invoke>