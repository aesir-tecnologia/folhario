// D-09 (user suggestions ranked by usage_count) + D-10 (pt-BR defaults from i18n bundle),
// D-21 (requireVerifiedUser), PRD §5 (snake_case + closed registry),
// D-17 (no Drizzle imports in route handlers).

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { listLocations } from "@contexts/catalog/application/list-locations";

// ============================================================================
// GET /api/v1/locations
// ============================================================================

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

  const result = await listLocations({ userId: auth.user.id });

  return Response.json(
    {
      items: result.items.map((item) => ({
        label_display: item.labelDisplay,
      })),
    },
    { status: 200 },
  );
}
