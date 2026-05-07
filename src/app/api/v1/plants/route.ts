// D-02 (multipart Plant create with first PhotoEntry), D-12 (cursor list + ?include_count),
// D-37 (idempotency — first route consumer), D-21 (requireVerifiedUser — first route consumer),
// PRD §5 (snake_case + closed error registry), D-17 (no Drizzle imports in route handlers).

import * as Sentry from "@sentry/nextjs";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { computeMultipartRequestHash } from "@shared/api/idempotency-hash";
import { decodeSortCursor, normalizeLimit, SORT_IDS } from "@shared/api/cursor";
import { createPlant } from "@contexts/catalog/application/create-plant";
import { listPlants } from "@contexts/catalog/application/list-plants";
import { toPlantSnakeCase, toPlantWithSignedUrlSnakeCase } from "@contexts/catalog/api/snake-case";
import type { SortId } from "@shared/api/cursor";

/**
 * nodejs runtime required because:
 * - multipart body parsing needs Buffer APIs.
 * - createPlant uses sharp for thumbnail generation (Node native bindings).
 */
export const runtime = "nodejs";

// ============================================================================
// POST /api/v1/plants
// ============================================================================

async function postImpl(request: Request): Promise<Response> {
  // D-21 gate — requireVerifiedUser (first route consumer).
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    // WR-02: never surface auth.reason to clients.
    return errorResponse(
      auth.code,
      auth.code === ErrorCode.EmailUnverified
        ? "Verifique seu email para continuar."
        : "Sessão inválida.",
    );
  }

  // D-37 / D-02: Idempotency-Key required on mutating endpoints.
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

  // Extract and validate required fields.
  const nameRaw = formData.get("name");
  const photoFile = formData.get("photo");

  if (typeof nameRaw !== "string" || nameRaw.trim().length === 0) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.", {
      issues: [{ path: ["name"], message: "name required" }],
    });
  }

  if (!(photoFile instanceof File)) {
    return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.", {
      issues: [{ path: ["photo"], message: "photo required" }],
    });
  }

  const photoBuffer = Buffer.from(await photoFile.arrayBuffer());
  const photoContentType = photoFile.type || "application/octet-stream";

  // Optional fields.
  const nicknameRaw = formData.get("nickname");
  const locationRaw = formData.get("location");
  const acquisitionDateRaw = formData.get("acquisition_date");
  const notesRaw = formData.get("notes");

  const nickname = typeof nicknameRaw === "string" ? nicknameRaw : null;
  const location = typeof locationRaw === "string" ? locationRaw : null;
  const acquisitionDate = typeof acquisitionDateRaw === "string" ? acquisitionDateRaw : null;
  const notes = typeof notesRaw === "string" ? notesRaw : null;

  // Side-channel to capture postCommit from the handler (since IdempotencyHandler
  // returns { status, body } only — no passthrough for extra fields).
  let capturedPostCommit: (() => Promise<void>) | undefined;

  const idempotencyResult = await withIdempotency(
    { userId: auth.user.id, key: idempotencyKey, requestHash },
    async (tx) => {
      const usecase = await createPlant(
        {
          source: "manual",
          userId: auth.user.id,
          name: nameRaw.trim(),
          photo: { buffer: photoBuffer, contentType: photoContentType },
          nickname: nickname || null,
          location: location || null,
          acquisitionDate: acquisitionDate || null,
          notes: notes || null,
        },
        { tx },
      );

      if (!usecase.ok) {
        return {
          status: usecase.code === ErrorCode.ValidationFailed ? 400 : 500,
          body: {
            error: {
              code: usecase.code,
              message: usecase.reason,
            },
          },
        };
      }

      capturedPostCommit = usecase.postCommit;

      return {
        status: 201,
        body: {
          plant: toPlantSnakeCase(usecase.plant),
          photo_entry: {
            id: usecase.photoEntry.id,
            plant_id: usecase.photoEntry.plantId,
            photo_url: usecase.photoEntry.photoUrl,
            thumbnail_url: usecase.photoEntry.thumbnailUrl,
            note: usecase.photoEntry.note ?? null,
            created_at: usecase.photoEntry.createdAt,
          },
        },
      };
    },
  );

  // postCommit fires ONLY on first success (!replayed) — T-05-05-01.
  if (!idempotencyResult.replayed && capturedPostCommit) {
    try {
      await capturedPostCommit();
    } catch (err) {
      // Swallow postCommit failures to Sentry — the TX already committed.
      Sentry.captureException(err);
    }
  }

  return new Response(JSON.stringify(idempotencyResult.body), {
    status: idempotencyResult.status,
    headers: { "content-type": "application/json" },
  });
}

export async function POST(request: Request): Promise<Response> {
  try {
    return await postImpl(request);
  } catch (err) {
    const url = new URL(request.url);
    const eventId = Sentry.captureException(err, {
      tags: { route: "api.v1.plants", method: "POST" },
      extra: {
        pathname: url.pathname,
        contentType: request.headers.get("content-type"),
        contentLength: request.headers.get("content-length"),
        hasIdempotencyKey: Boolean(request.headers.get("idempotency-key")),
      },
    });

    console.error("[api/v1/plants] POST failed", {
      eventId,
      pathname: url.pathname,
      contentType: request.headers.get("content-type"),
      contentLength: request.headers.get("content-length"),
      hasIdempotencyKey: Boolean(request.headers.get("idempotency-key")),
      err,
    });

    return errorResponse(ErrorCode.InternalError, "Erro interno ao salvar a planta.", {
      event_id: eventId,
    });
  }
}

// ============================================================================
// GET /api/v1/plants
// ============================================================================

const VALID_SORTS = new Set<string>(SORT_IDS);

export async function GET(request: Request): Promise<Response> {
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return errorResponse(
      auth.code,
      auth.code === ErrorCode.EmailUnverified
        ? "Verifique seu email para continuar."
        : "Sessão inválida.",
    );
  }

  const url = new URL(request.url);
  const sortRaw = url.searchParams.get("sort") ?? "date_new";
  if (!VALID_SORTS.has(sortRaw)) {
    return errorResponse(ErrorCode.ValidationFailed, "Sort inválido.");
  }
  const sort = sortRaw as SortId;

  const cursorRaw = url.searchParams.get("cursor");
  if (cursorRaw) {
    // Validate cursor shape; decode is owned by listPlants use-case internally.
    const decoded = decodeSortCursor(cursorRaw);
    if (!decoded.ok) {
      return errorResponse(ErrorCode.ValidationFailed, "Cursor inválido.");
    }
  }

  const limit = normalizeLimit(url.searchParams.get("limit"));
  // D-12: total_count only when cursor === null (first page).
  const includeCount = url.searchParams.get("include_count") === "1" && cursorRaw === null;

  const result = await listPlants({
    userId: auth.user.id,
    sort,
    cursor: cursorRaw,
    limit,
    includeCount,
  });

  if (!result.ok) {
    return errorResponse(result.code, result.reason);
  }

  const body: {
    items: ReturnType<typeof toPlantWithSignedUrlSnakeCase>[];
    next_cursor: string | null;
    total_count?: number;
  } = {
    items: result.items.map(toPlantWithSignedUrlSnakeCase),
    next_cursor: result.nextCursor ?? null,
  };

  if (result.totalCount !== undefined && result.totalCount !== null) {
    body.total_count = result.totalCount;
  }

  return Response.json(body, { status: 200 });
}
