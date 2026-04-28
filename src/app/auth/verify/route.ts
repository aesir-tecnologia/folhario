// Phase 4 AUTH-04 + D-07 — server route for email verification link.
//
// GET /auth/verify?token=... validates the SHA-256 hashed token, sets
// public.users.email_verified_at FIRST then marks consumed_at within one
// db.transaction (Codex HIGH #2 ordering — handled inside verifyEmail
// use-case), redirects /, fires PostHog signup_completed server-side via
// the posthog-bridge.

import { NextResponse } from "next/server";

import { verifyEmail } from "@contexts/iam/application/verify-email";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login?error=missing_token", url));
  }

  const result = await verifyEmail(token);
  if (result.kind === "invalid_or_expired") {
    return NextResponse.redirect(
      new URL("/auth/verify-error?error=token_expired", url),
    );
  }

  return NextResponse.redirect(new URL("/", url));
}
