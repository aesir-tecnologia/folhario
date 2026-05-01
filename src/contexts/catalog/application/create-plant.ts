import { randomUUID } from "node:crypto";

import sharp from "sharp";
import * as Sentry from "@sentry/nextjs";
import { z } from "zod";

import { ErrorCode } from "@shared/config/errors";
import { withUnitOfWork, type TransactionalDb } from "@shared/db/unit-of-work";
import { ALLOWED_MIME_TYPES, type AllowedMime } from "@shared/images/limits";
import { rejectGpsMetadata, rejectOversizeBuffer } from "@shared/images/server-validate";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { inngest } from "@shared/inngest/client";
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
import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";
import type { PhotoEntryRow } from "@contexts/catalog/infrastructure/db/photo-entries";

/**
 * Catalog application use-case: create a plant with its first cover photo.
 *
 * Phase 05 Plan 05 — D-02 (Plant create), D-28 (PostHog `plant_added`
 * privacy-clean properties), CAT-01 contributor, T-05-05-01/02/03 mitigations.
 *
 * Steps in order:
 *
 *   0. Input schema parse — returns validation_failed before any side effect.
 *   1. MIME validation (`image/jpeg`, `image/png`, `image/webp` only).
 *   2. Size validation via `rejectOversizeBuffer` — T-05-05-02.
 *   3. GPS rejection via `rejectGpsMetadata` — T-05-05-02 (defense in depth).
 *   4. (No ownership check — the Plant does not exist yet.)
 *   5. Sharp thumbnail generation.
 *   6. Pre-generate `plantId` + `photoId` then upload original + thumbnail
 *      (original first; storage BEFORE TX so we can compensate on failure).
 *   7a. When `deps.tx` is absent: open own `withUnitOfWork`, insert Plant +
 *       PhotoEntry, commit, then run telemetry inline.
 *   7b. When `deps.tx` is provided: insert Plant + PhotoEntry using the outer
 *       tx (no commit), return telemetry as a `postCommit` callback.
 *
 * T-05-05-01 mitigation: telemetry (PostHog + Inngest) fires ONLY after the
 * DB transaction commits. In the own-UoW path: if `withUnitOfWork` rejects,
 * execution never reaches the telemetry block. In the outer-tx path: the
 * use-case returns a `postCommit` callback the caller MUST await ONLY after
 * the outer commit succeeds; on outer tx rollback, the caller MUST NOT call
 * `postCommit`.
 *
 * T-05-05-02 mitigation: `rejectOversizeBuffer` and `rejectGpsMetadata` run
 * at steps 2+3, BEFORE any storage upload.
 *
 * T-05-05-03 mitigation: `userId` is NEVER read from the request body —
 * callers MUST derive it from `requireVerifiedUser(request)` in the route
 * handler (05-08). The UoW validates `userId` is a UUID before opening the tx.
 */

function isAllowedMime(value: string): value is AllowedMime {
  return (ALLOWED_MIME_TYPES as Set<string>).has(value);
}

function extFromMime(mime: AllowedMime): "jpg" | "png" | "webp" {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default: {
      const _exhaustive: never = mime;
      throw new Error(`extFromMime: unhandled MIME ${String(_exhaustive)}`);
    }
  }
}

const THUMBNAIL_MAX_DIMENSION = 512;
const THUMBNAIL_QUALITY = 80;

const manualBranchSchema = z
  .object({
    source: z.literal("manual"),
    userId: z.string().uuid(),
    name: z.string().min(1, "name required").max(200),
    photo: z.object({
      buffer: z.instanceof(Buffer),
      contentType: z.string(),
    }),
    nickname: z.string().min(1).max(200).nullable().optional(),
    location: z.string().min(1).max(200).nullable().optional(),
    acquisitionDate: z.string().date().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const identificationBranchSchema = z
  .object({
    source: z.literal("identification"),
    userId: z.string().uuid(),
    name: z.string().min(1, "name required").max(200),
    speciesId: z.string().uuid(),
    photo: z.object({
      buffer: z.instanceof(Buffer),
      contentType: z.string(),
    }),
    nickname: z.string().min(1).max(200).nullable().optional(),
    location: z.string().min(1).max(200).nullable().optional(),
    acquisitionDate: z.string().date().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

const createPlantInputSchema = z.discriminatedUnion("source", [
  manualBranchSchema,
  identificationBranchSchema,
]);

export type CreatePlantInput = z.infer<typeof createPlantInputSchema>;

export type CreatePlantDeps = {
  tx?: TransactionalDb;
};

export type PostCommitCallback = () => Promise<void>;

export type CreatePlantResult =
  | { ok: true; plant: PlantRow; photoEntry: PhotoEntryRow; postCommit?: PostCommitCallback }
  | {
      ok: false;
      code: typeof ErrorCode.ValidationFailed | typeof ErrorCode.Unauthenticated;
      reason: string;
    };

function buildTelemetryCallback(input: CreatePlantInput, plant: PlantRow): PostCommitCallback {
  return async () => {
    try {
      await inngest.send({
        name: "plant.created",
        data: { userId: input.userId, plantId: plant.id, source: input.source },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { surface: "catalog.create-plant.notify" },
        extra: { plantId: plant.id },
      });
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
  };
}

export async function createPlant(
  input: CreatePlantInput,
  deps: CreatePlantDeps = {},
): Promise<CreatePlantResult> {
  // (0) Schema parse — returns validation_failed before any side effect.
  const parsed = createPlantInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: parsed.error.issues[0]?.message ?? "invalid input",
    };
  }
  const validInput = parsed.data;

  // (1) MIME validation.
  if (!isAllowedMime(validInput.photo.contentType)) {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: `unsupported content type: ${validInput.photo.contentType}`,
    };
  }
  const mime: AllowedMime = validInput.photo.contentType as AllowedMime;

  // (2) Size validation — T-05-05-02.
  const sizeCheck = rejectOversizeBuffer(validInput.photo.buffer);
  if (!sizeCheck.ok) {
    return {
      ok: false,
      code: sizeCheck.code,
      reason: sizeCheck.reason,
    };
  }

  // (3) GPS rejection — T-05-05-02 defense in depth.
  const gpsCheck = await rejectGpsMetadata(validInput.photo.buffer);
  if (!gpsCheck.ok) {
    return {
      ok: false,
      code: gpsCheck.code,
      reason: gpsCheck.reason,
    };
  }

  // (4) No ownership check — the Plant does not exist yet.

  // (5) Sharp thumbnail generation (synchronous in-request, D-31).
  let thumbnailBuffer: Buffer;
  try {
    thumbnailBuffer = await sharp(validInput.photo.buffer)
      .resize(THUMBNAIL_MAX_DIMENSION, THUMBNAIL_MAX_DIMENSION, {
        fit: "inside",
        withoutEnlargement: true,
      })
      .jpeg({ quality: THUMBNAIL_QUALITY })
      .toBuffer();
  } catch (error) {
    const reason =
      error instanceof Error
        ? `thumbnail generation failed: ${error.message}`
        : "thumbnail generation failed";
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason,
    };
  }

  // (6) Pre-generate IDs, build keys, upload original then thumbnail.
  const plantId = randomUUID();
  const photoId = randomUUID();
  const ext = extFromMime(mime);

  const originalKey = buildPlantPhotoObjectKey({
    userId: validInput.userId,
    plantId,
    photoId,
    ext,
  });
  await uploadOriginalPlantPhoto({
    userId: validInput.userId,
    plantId,
    photoId,
    ext,
    buffer: validInput.photo.buffer,
    contentType: mime,
  });

  const thumbnailKey = buildPlantThumbnailObjectKey({
    userId: validInput.userId,
    plantId,
    photoId,
    ext: "jpg",
  });
  await uploadPlantThumbnail({
    userId: validInput.userId,
    plantId,
    photoId,
    ext: "jpg",
    buffer: thumbnailBuffer,
    contentType: "image/jpeg",
  });

  const plantInsert = {
    id: plantId,
    userId: validInput.userId,
    name: validInput.name,
    nickname: validInput.nickname ?? null,
    location: validInput.location ?? null,
    acquisitionDate: validInput.acquisitionDate ?? null,
    notes: validInput.notes ?? null,
    speciesId: validInput.source === "identification" ? validInput.speciesId : null,
    coverPhotoUrl: `${PLANT_PHOTOS_BUCKET}/${originalKey}`,
  };

  const photoEntryInsert = {
    id: photoId,
    plantId,
    photoUrl: `${PLANT_PHOTOS_BUCKET}/${originalKey}`,
    thumbnailUrl: `${PLANT_THUMBNAILS_BUCKET}/${thumbnailKey}`,
    note: null,
  };

  // (7) TX execution — branch on deps.tx.
  if (deps.tx) {
    // (7b) Caller owns the transaction — insert using outer tx, do NOT commit.
    let plant: PlantRow;
    let photoEntry: PhotoEntryRow;
    try {
      plant = await plantsRepo.create(deps.tx, plantInsert);
      photoEntry = await photoEntriesRepo.create(deps.tx, photoEntryInsert);
    } catch (err) {
      await deleteSinglePlantPhotoBestEffort({
        userId: validInput.userId,
        plantId,
        photoId,
        originalExt: ext,
      });
      throw err;
    }
    // Package telemetry as postCommit callback — caller MUST await after outer commit.
    const postCommit: PostCommitCallback = buildTelemetryCallback(validInput, plant);
    return { ok: true, plant, photoEntry, postCommit };
  }

  // (7a) Use-case owns its own UoW — insert, commit, then run telemetry inline.
  let plant: PlantRow;
  let photoEntry: PhotoEntryRow;
  try {
    ({ plant, photoEntry } = await withUnitOfWork(validInput.userId, async (tx) => {
      const createdPlant = await plantsRepo.create(tx, plantInsert);
      const createdPhoto = await photoEntriesRepo.create(tx, photoEntryInsert);
      return { plant: createdPlant, photoEntry: createdPhoto };
    }));
  } catch (err) {
    await deleteSinglePlantPhotoBestEffort({
      userId: validInput.userId,
      plantId,
      photoId,
      originalExt: ext,
    });
    throw err;
  }

  // UoW committed. Run telemetry inline — sequential, strictly after commit.
  // T-05-05-01: if withUnitOfWork rejected above, execution never reaches here.
  await buildTelemetryCallback(validInput, plant)();

  return { ok: true, plant, photoEntry };
}
