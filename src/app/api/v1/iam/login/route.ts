import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { withThrottle } from "@shared/api/throttle";
import { loginRequestSchema } from "@contexts/iam/domain/schemas";
import { loginUser } from "@contexts/iam/application/login";

/**
 * Phase 4 AUTH-05 — POST /api/v1/iam/login.
 *
 * D-31: JSON-only request bodies; multipart not accepted.
 * D-15: withThrottle("login", "on-failure") — successful logins do NOT
 *       consume the failure budget.
 * Codex HIGH #5: withThrottle checks locked_until BEFORE counting; the
 *       5-min lockout survives the 1-minute bucket boundary.
 * Codex HIGH #3: AUTH calls go through loginUser → authAdapter; this route
 *       never imports `@supabase/*` and never references the auth surface
 *       directly.
 * Closed registry (Phase 1 D-10/D-12): only ValidationFailed,
 *       InvalidCredentials, RateLimited surface from this handler.
 */
export async function POST(request: Request) {
  return withThrottle(request, "login", "on-failure", async () => {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse(ErrorCode.ValidationFailed, "Corpo inválido.");
    }

    const parsed = loginRequestSchema.safeParse(body);
    if (!parsed.success) {
      return errorResponse(ErrorCode.ValidationFailed, "Validação falhou.");
    }

    const result = await loginUser(parsed.data);
    if (result.kind === "invalid_credentials") {
      return errorResponse(ErrorCode.InvalidCredentials, "E-mail ou senha incorretos.");
    }
    return NextResponse.json({ ok: true });
  });
}
