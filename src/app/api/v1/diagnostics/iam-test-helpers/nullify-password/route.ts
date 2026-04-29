// TEST-ONLY diagnostics endpoint — NULLs `auth.users.encrypted_password` for
// a given user id, simulating an OAuth-only account (no local credential).
//
// Consumed by:
//   - tests/e2e/auth-change-password-oauth-only-forbidden.spec.ts (UAT T18)
//   - tests/e2e/iam-me-shape.spec.ts (UAT T21 — hasPassword=false branch)
//
// Flow: spec seeds a user via `seed-oauth-incomplete-user` (returns a temp
// password), mints a Supabase SSR cookie via `/api/v1/iam/login`, completes
// OAuth via `/api/v1/iam/oauth/complete` (sets age + verified), THEN calls
// this endpoint to drop the password. The cookie has already been minted, so
// the session survives. From this point on `getUserById(userId).hasPassword`
// is `false` and the change-password guard at AUTH-13 / D-04 fires.
//
// Hardening:
//   - NODE_ENV != production AND IDENTIFICATION_PROVIDER_MODE === 'stub'
//     gates (mirrors latest-token + seed-verified-user + seed-oauth-incomplete-user).
//   - URL pre-allowlisted via the existing diagnostics regex.

import { NextResponse } from "next/server";
import postgres from "postgres";
import { z } from "zod";

import { errorResponse, ErrorCode } from "@shared/config/errors";

function isEnabled(): boolean {
  // Mirrors the `isEnabled` shape used by the sibling iam-test-helpers
  // routes — read `IDENTIFICATION_PROVIDER_MODE` and `ENABLE_TEST_ROUTES`
  // straight from `process.env` so this handler can be statically
  // collected during `pnpm build` even when `serverEnv`'s production
  // schema (which requires `RESEND_API_KEY`) cannot resolve in a dev
  // env where that key is intentionally unset.
  const productionAllowed = process.env.ENABLE_TEST_ROUTES === "1";
  if (process.env.NODE_ENV === "production" && !productionAllowed) return false;
  if (process.env.IDENTIFICATION_PROVIDER_MODE !== "stub") return false;
  return true;
}

const bodySchema = z.object({ userId: z.string().uuid() }).strict();

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

  const dbUrl = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!dbUrl) {
    return errorResponse(ErrorCode.InternalError, "DATABASE_POOL_URL not set");
  }
  const sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    await sql`
      UPDATE auth.users
         SET encrypted_password = NULL
       WHERE id = ${parsed.data.userId}::uuid
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }

  return NextResponse.json({ ok: true });
}
