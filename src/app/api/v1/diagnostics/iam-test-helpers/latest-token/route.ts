// Phase 4 plan 06 Task 4 — TEST-ONLY diagnostics endpoint.
//
// Given an email, this endpoint mints a fresh verification token via the
// real `mintVerificationToken` repo (which revokes prior unused tokens
// then inserts a new row) and returns the RAW token. The Playwright E2E
// spec calls this endpoint after submitting a signup so it can drive the
// /auth/verify?token=... flow in a real browser context.
//
// Hardening:
//   - Gated by `IDENTIFICATION_PROVIDER_MODE === "stub"` (mirrors the
//     diagnostics ping pattern) AND `NODE_ENV !== "production"`. Both
//     conditions are required.
//   - Returns 404 in production. Two-layer gate so a misconfigured prod
//     deploy doesn't accidentally expose tokens.
//   - URL pre-allowlisted in UNVERIFIED_ALLOWED_PATHS via the existing
//     `/^\/api\/v1\/diagnostics\//` regex (no allowlist edit needed).

import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";
import { getUserByEmail } from "@contexts/iam/infrastructure/db/users";
import { mintVerificationToken } from "@contexts/iam/infrastructure/db/verification-tokens";

function isEnabled(): boolean {
  // Plan 04-10 Rule 3 amendment: production builds opt in via the
  // ENABLE_TEST_ROUTES flag the (test)/modal-sheet route uses.
  // Phase 04 review WR-08: server-only flag (no NEXT_PUBLIC_ prefix).
  const productionAllowed = process.env.ENABLE_TEST_ROUTES === "1";
  if (process.env.NODE_ENV === "production" && !productionAllowed) return false;
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") return false;
  return true;
}

export async function GET(request: Request): Promise<Response> {
  if (!isEnabled()) {
    return errorResponse(ErrorCode.NotFound, "not found");
  }

  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  if (!email) {
    return errorResponse(ErrorCode.ValidationFailed, "email param required.");
  }

  const user = await getUserByEmail(email);
  if (!user) {
    return errorResponse(ErrorCode.NotFound, "user not found.");
  }

  const { rawToken, tokenId } = await mintVerificationToken({
    userId: user.id,
    sentToEmail: email,
  });
  return NextResponse.json({ rawToken, tokenId });
}
