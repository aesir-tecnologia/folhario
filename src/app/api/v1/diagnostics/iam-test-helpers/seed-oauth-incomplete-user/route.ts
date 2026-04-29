// Phase 4 plan 09 — TEST-ONLY diagnostics endpoint for the Playwright E2E.
//
// Simulates an OAuth user who completed the Supabase OAuth callback but has
// not yet submitted /auth/oauth-complete: auth.users + public.users rows
// exist but `age_confirmed_at` and `email_verified_at` are both NULL.
//
// Returns the seeded user id + a temporary password so the spec can mint a
// real Supabase SSR cookie via /api/v1/iam/login. The spec injects that
// cookie into the page context and then exercises POST /api/v1/iam/oauth/complete.
//
// Hardening:
//   - NODE_ENV != production AND IDENTIFICATION_PROVIDER_MODE === 'stub'
//     gates (mirrors latest-token + seed-verified-user).
//   - URL pre-allowlisted via the existing diagnostics regex.

import { NextResponse } from "next/server";
import postgres from "postgres";
import { randomBytes } from "node:crypto";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";
import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";

function isEnabled(): boolean {
  // Plan 04-10 Rule 3 amendment: production builds opt in via the
  // ENABLE_TEST_ROUTES flag the (test)/modal-sheet route uses.
  // Phase 04 review WR-08: server-only flag (no NEXT_PUBLIC_ prefix).
  const productionAllowed = process.env.ENABLE_TEST_ROUTES === "1";
  if (process.env.NODE_ENV === "production" && !productionAllowed) return false;
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") return false;
  return true;
}

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
  const { email } = (body ?? {}) as { email?: string };
  if (!email) {
    return errorResponse(ErrorCode.ValidationFailed, "email required");
  }

  // We assign a random password so the spec can use the standard login route
  // to mint a real cookie. The simulated OAuth-incomplete state is enforced by
  // setting `age_confirmed_at` and `email_verified_at` to NULL on public.users.
  const password = `OAuthSeed-${randomBytes(8).toString("hex")}!`;

  // Phase 04 review IN-06: route through authAdapter (Codex HIGH #3
  // boundary). The peer diagnostics route seed-verified-user already
  // does this; mirror it. authAdapter.createUser already calls
  // admin.createUser({ email_confirm: true }) under the hood, so the
  // shape matches exactly.
  let userId: string;
  try {
    const created = await authAdapter.createUser({ email, password });
    userId = created.id;
  } catch (err) {
    return errorResponse(
      ErrorCode.InternalError,
      `seed-oauth-incomplete-user: ${err instanceof Error ? err.message : "createUser failed"}`,
    );
  }

  // Force the public.users row to incomplete-OAuth state (age + verified NULL).
  const sql = postgres(serverEnv.DATABASE_POOL_URL, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    await sql`
      INSERT INTO public.users (
        id, email, age_confirmed_at, email_verified_at, timezone, name, trial_source
      ) VALUES (
        ${userId}, ${email}, NULL, NULL, 'America/Sao_Paulo',
        COALESCE(split_part(${email}::text, '@', 1), 'user'), 'organic'
      )
      ON CONFLICT (id) DO UPDATE SET
        age_confirmed_at = NULL,
        email_verified_at = NULL,
        partner_code = NULL,
        updated_at = now()
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }

  return NextResponse.json({ id: userId, email, password });
}
