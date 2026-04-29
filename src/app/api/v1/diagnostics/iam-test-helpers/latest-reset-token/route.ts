// Phase 4 plan 08 Task 3 — TEST-ONLY diagnostics endpoint.
//
// Given an email, this endpoint mints a fresh PASSWORD-RESET token via
// the real `mintResetToken` repo (which revokes prior unused tokens then
// inserts a new row) and returns the RAW token. The Playwright E2E spec
// calls this endpoint after submitting a reset-request so it can drive
// the /auth/reset?token=... flow in a real browser context.
//
// Mirrors the Plan 06 latest-token endpoint exactly — same hardening
// (NODE_ENV!=production AND IDENTIFICATION_PROVIDER_MODE=stub), same
// shape, same allowlist coverage via `/^\/api\/v1\/diagnostics\//`.
//
// We mint a fresh token (rather than reading the latest hash from DB)
// because raw tokens never enter the DB — only sha256 digests do. This
// is a TEST-ONLY shortcut equivalent to "what the Inngest function
// would have minted if you let it run."

import { NextResponse } from "next/server";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";
import { getUserByEmail } from "@contexts/iam/infrastructure/db/users";
import { mintResetToken } from "@contexts/iam/infrastructure/db/reset-tokens";

function isEnabled(): boolean {
  // Plan 04-10 Rule 3 amendment: production builds opt in via the same
  // NEXT_PUBLIC_ENABLE_TEST_ROUTES flag the (test)/modal-sheet route uses.
  const productionAllowed =
    process.env.NEXT_PUBLIC_ENABLE_TEST_ROUTES === "1";
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

  const { rawToken, tokenId } = await mintResetToken({
    userId: user.id,
    sentToEmail: email,
  });
  return NextResponse.json({ rawToken, tokenId });
}
