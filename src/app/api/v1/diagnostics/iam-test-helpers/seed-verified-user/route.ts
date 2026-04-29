// Phase 4 plan 08 Task 3 (Codex HIGH #6 + auto-fix Rule 3) — TEST-ONLY
// diagnostics endpoint for Playwright E2E specs. Seeds a verified user
// (auth.users + public.users + emailVerifiedAt=now()) given an email +
// password. The Plan 06 latest-token diagnostics endpoint mirrors this
// shape; this file is the missing companion the auth-login-logout spec
// already expected (deferred from Plan 06/07; Plan 08's E2E also needs
// it, so it ships here per Rule 3 blocker — sub-repo boundaries permit
// the iam-test-helpers folder for Phase 4 owners).
//
// Hardening:
//   - Gated by `IDENTIFICATION_PROVIDER_MODE === "stub"` (mirrors the
//     diagnostics ping pattern) AND `NODE_ENV !== "production"`. Both
//     conditions required.
//   - Returns 404 in production. Two-layer gate so a misconfigured
//     prod deploy doesn't accidentally expose a user-creation backdoor.
//   - URL pre-allowlisted in UNVERIFIED_ALLOWED_PATHS via the existing
//     `/^\/api\/v1\/diagnostics\//` regex (no allowlist edit needed).

import { NextResponse } from "next/server";
import { z } from "zod";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";
import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import { upsertVerifiedTestUser } from "@contexts/iam/infrastructure/db/test-helpers";

function isEnabled(): boolean {
  // Plan 04-10 Rule 3 amendment: production builds opt in via the same
  // NEXT_PUBLIC_ENABLE_TEST_ROUTES flag the (test)/modal-sheet route uses
  // (Phase 3 plan 05 codex review HIGH 2). The IDENTIFICATION_PROVIDER_MODE
  // gate plus the explicit opt-in keep production exposure narrow.
  const productionAllowed =
    process.env.NEXT_PUBLIC_ENABLE_TEST_ROUTES === "1";
  if (process.env.NODE_ENV === "production" && !productionAllowed) return false;
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") return false;
  return true;
}

const bodySchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(72),
    timezone: z.string().optional(),
  })
  .strict();

export async function POST(request: Request): Promise<Response> {
  if (!isEnabled()) {
    return errorResponse(ErrorCode.NotFound, "not found");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(ErrorCode.ValidationFailed, "invalid body");
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(ErrorCode.ValidationFailed, "validation failed");
  }
  const { email, password, timezone } = parsed.data;

  // Codex HIGH #3: route through authAdapter (sole module touching auth admin).
  const created = await authAdapter.createUser({ email, password });
  const userId = created.id;
  const tz = timezone ?? "America/Sao_Paulo";

  // Upsert public.users with emailVerifiedAt = now() so the verification
  // gate lets the test session through. D-17 boundary: route calls a
  // repository helper instead of raw Drizzle / @shared/db/client.
  await upsertVerifiedTestUser({ id: userId, email, timezone: tz });

  return NextResponse.json({ ok: true, userId });
}
