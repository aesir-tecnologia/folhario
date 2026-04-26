import { errorResponse, ErrorCode } from "@shared/config/errors";
import { requireApiUser } from "@shared/api/auth";
import { uploadPhoto } from "@contexts/catalog/application/upload-photo";

/**
 * POST /api/v1/photos/upload
 *
 * Phase 02 Plan 08 — D-23 (server proxy upload, never client-direct),
 * D-27 (server validates GPS, uploads with service role, inserts metadata),
 * INFRA-03 (thin route handler — no Drizzle import).
 *
 * The route is intentionally minimal: parse multipart form data, run
 * `requireApiUser`, delegate to the application use-case, map non-ok
 * results onto the closed error registry. The `nodejs` runtime is
 * mandatory because `sharp` requires Node-only native bindings (T-02-22
 * mitigation).
 *
 * Body parsing happens HERE at the route boundary — by this point the
 * Next 16 proxy has already proven `bodyUsed === false` (asserted by
 * tests/unit/proxy-body-passthrough.test.ts in plan 02-07), so the
 * stream is fresh. We use `request.formData()` because that's the
 * standard Web API multipart parser; no third-party multipart library.
 *
 * NOTE: this file MUST NOT import the ORM or any DB schema module
 * (D-17 / T-02-11). Verified by `tests/unit/no-drizzle-in-routes.test.ts`
 * and the ESLint flat-config block in eslint.config.mjs.
 */

export const runtime = "nodejs";

const MULTIPART_FILE_FIELD = "file";
const MULTIPART_PLANT_ID_FIELD = "plantId";
const MULTIPART_NOTE_FIELD = "note";

export async function POST(request: Request): Promise<Response> {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return errorResponse(auth.code, auth.reason);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "could not parse multipart body";
    return errorResponse(ErrorCode.ValidationFailed, `multipart parse failed: ${reason}`);
  }

  const file = formData.get(MULTIPART_FILE_FIELD);
  if (!(file instanceof File)) {
    return errorResponse(
      ErrorCode.ValidationFailed,
      `multipart field "${MULTIPART_FILE_FIELD}" missing or not a File`,
    );
  }

  const plantIdRaw = formData.get(MULTIPART_PLANT_ID_FIELD);
  if (typeof plantIdRaw !== "string" || plantIdRaw.trim() === "") {
    return errorResponse(
      ErrorCode.ValidationFailed,
      `multipart field "${MULTIPART_PLANT_ID_FIELD}" missing or empty`,
    );
  }

  const noteRaw = formData.get(MULTIPART_NOTE_FIELD);
  const note = typeof noteRaw === "string" ? noteRaw : null;

  const buffer = Buffer.from(await file.arrayBuffer());

  const result = await uploadPhoto({
    userId: auth.user.id,
    plantId: plantIdRaw,
    contentType: file.type,
    buffer,
    note,
  });

  if (!result.ok) {
    return errorResponse(result.code, result.reason);
  }

  return Response.json(
    {
      photoEntry: {
        id: result.photoEntry.id,
        plantId: result.photoEntry.plantId,
        photoUrl: result.photoEntry.photoUrl,
        thumbnailUrl: result.photoEntry.thumbnailUrl,
        note: result.photoEntry.note,
        createdAt: result.photoEntry.createdAt,
      },
    },
    { status: 201 },
  );
}
