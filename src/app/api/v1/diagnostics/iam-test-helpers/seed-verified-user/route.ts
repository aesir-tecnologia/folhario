// Phase 4 plan 09 — TEST-ONLY diagnostics endpoint.
//
// Pre-seeds a verified email+password user for the Playwright E2E specs
// (auth-login-logout, auth-change-password). Mirrors `latest-token`'s gate
// pattern: NODE_ENV != production AND IDENTIFICATION_PROVIDER_MODE === 'stub'.
//
// Hardening:
//   - Two-layer gate so a misconfigured prod deploy never exposes seeding.
//   - URL pre-allowlisted in UNVERIFIED_ALLOWED_PATHS via the existing
//     `/^\/api\/v1\/diagnostics\//` regex (no allowlist edit needed).

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";

import { errorResponse, ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";

function isEnabled(): boolean {
  if (process.env.NODE_ENV === "production") return false;
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
  const { email, password } = (body ?? {}) as { email?: string; password?: string };
  if (!email || !password) {
    return errorResponse(ErrorCode.ValidationFailed, "email + password required");
  }

  const admin = createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    return errorResponse(
      ErrorCode.InternalError,
      `seed-verified-user: ${error?.message ?? "no user returned"}`,
    );
  }
  const userId = data.user.id;

  // Insert / upsert public.users with email_verified_at = now() so the
  // verification gate sees the user as fully signed-up.
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
        ${userId}, ${email}, now(), now(), 'America/Sao_Paulo',
        COALESCE(split_part(${email}::text, '@', 1), 'user'), 'organic'
      )
      ON CONFLICT (id) DO UPDATE SET
        age_confirmed_at = EXCLUDED.age_confirmed_at,
        email_verified_at = EXCLUDED.email_verified_at,
        updated_at = now()
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }

  return NextResponse.json({ id: userId, email });
}
