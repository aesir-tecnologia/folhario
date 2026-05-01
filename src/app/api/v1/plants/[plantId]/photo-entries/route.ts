// D-15 (multipart photo-journal add), D-20 (24h-TTL signed URLs in journal list),
// D-37 (idempotency), D-21 (requireVerifiedUser), PRD §5 (snake_case + closed registry),
// D-17 (no Drizzle imports in route handlers).

import { z } from "zod";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { computeMultipartRequestHash } from "@shared/api/idempotency-hash";
import { createPhotoEntry } from "@contexts/catalog/application/create-photo-entry";
import { listPhotoEntries } from "@contexts/catalog/application/list-photo-entries";
import { toPhotoEntrySnakeCase } from "@contexts/catalog/api/snake-case";

/**
 * nodejs runtime required because createPhotoEntry uses sharp (Node native bindings).
 */
export const runtime = "nodejs";

const uuidSchema = z.string().uuid();

// ============================================================================
// POST /api/v1/plants/[plantId]/photo-entries
// ============================================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ plantId: string }> },
): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return errorResponse(
      auth.code,
      auth.code === ErrorCode.EmailUnverified
        ? "Verifique seu email para continuar."
        : "Sessão inválida.",
    );
  }

  const { plantId } = await params;
  const plantIdParsed = uuidSchema.safeParse(plantId);
  if (!plantIdParsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "plantId inválido.");
  }

  // D-37: Idempotency-Key required.
  const idempotencyKey = request.headers.get("idempotency-key")?.trim();
  if (!idempotencyKey) {
    return errorResponse(ErrorCode.ValidationFailed, "Cabeçalho Idempotency-Key obrigatório.");
  }

  // Compute requestHash BEFORE formData() consumes the stream.
  const hashResult = await computeMultipartRequestHash(request);
  if (!hashResult.ok) {
    return errorResponse(hashResult.code, hashResult.reason);
  }
  const requestHash = hashResult.hash;

  // Parse multipart body.
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (error) {
    const reason = error instanceof Error ? error.message : "could not parse multipart body";
    return errorResponse(ErrorCode.ValidationFailed, `multipart parse failed: ${reason}`);
  }

  const photoFile = formData.get("photo");
  if (!(photoFile instanceof File)) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.", {
      issues: [{ path: ["photo"], message: "photo required" }],
    });
  }

  const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
  const photoContentType = photoFile.type || "application/octet-stream";

  const noteRaw = formData.get("note");
  const note = typeof noteRaw === "string" ? noteRaw : null;

  const idempotencyResult = await withIdempotency(
    { userId: auth.user.id, key: idempotencyKey, requestHash },
    async (_tx) => {
      // NOTE: createPhotoEntry does NOT accept deps.tx (it delegates to uploadPhoto
      // which opens its own withUnitOfWork). Idempotency still works at the row
      // level: first call inserts the idempotency row + creates the photo entry;
      // replays return the stored response without re-invoking createPhotoEntry.
      const usecase = await createPhotoEntry({
        userId: auth.user.id,
        plantId: plantIdParsed.data,
        buffer: photoBuffer,
        contentType: photoContentType,
        note,
      });

      if (!usecase.ok) {
        const status = usecase.code === ErrorCode.NotFound ? 404 : 400;
        return {
          status,
          body: {
            error: {
              code: usecase.code,
              message: usecase.reason,
            },
          },
        };
      }

      return {
        status: 201,
        body: {
          photo_entry: toPhotoEntrySnakeCase(usecase.photoEntry),
        },
      };
    },
  );

  return new Response(JSON.stringify(idempotencyResult.body), {
    status: idempotencyResult.status,
    headers: { "content-type": "application/json" },
  });
}

// ============================================================================
// GET /api/v1/plants/[plantId]/photo-entries
// ============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ plantId: string }> },
): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return errorResponse(
      auth.code,
      auth.code === ErrorCode.EmailUnverified
        ? "Verifique seu email para continuar."
        : "Sessão inválida.",
    );
  }

  const { plantId } = await params;
  const plantIdParsed = uuidSchema.safeParse(plantId);
  if (!plantIdParsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "plantId inválido.");
  }

  const result = await listPhotoEntries({
    userId: auth.user.id,
    plantId: plantIdParsed.data,
  });

  if (!result.ok) {
    return errorResponse(result.code, result.reason);
  }

  return Response.json(
    {
      items: result.items.map((item) => toPhotoEntrySnakeCase(item)),
    },
    { status: 200 },
  );
}
