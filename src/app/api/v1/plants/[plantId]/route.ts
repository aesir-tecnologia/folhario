// D-07 (cascade counts for delete-confirm), D-21 (requireVerifiedUser),
// PRD §5 (snake_case + closed registry), D-17 (no Drizzle imports in route handlers).
// NOTE: PATCH + DELETE land in 05-09 (same file, additive exports).

import { z } from "zod";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { getPlant } from "@contexts/catalog/application/get-plant";
import { toPlantSnakeCase } from "@contexts/catalog/api/snake-case";

const uuidSchema = z.string().uuid();

// ============================================================================
// GET /api/v1/plants/[plantId]
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

  const result = await getPlant({
    userId: auth.user.id,
    plantId: plantIdParsed.data,
  });

  if (!result.ok) {
    return errorResponse(result.code, result.reason);
  }

  return Response.json(
    {
      plant: toPlantSnakeCase(result.plant),
      _meta: {
        photo_entry_count: result._meta.photoEntryCount,
        reminder_count: result._meta.reminderCount,
      },
    },
    { status: 200 },
  );
}
