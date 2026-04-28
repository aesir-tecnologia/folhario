// Phase 4 plan 09 — GET /auth/callback (Supabase OAuth code exchange).
//
// D-04 + AUTH-03 + Resolved Q4 routing:
//   (a) JWT/session check → withThrottle "on-failure" wrapper
//   (b) authAdapter.exchangeCodeForSession (Codex HIGH #3 — sole boundary)
//   (c) age_confirmed_at IS NULL → /auth/oauth-complete
//   (d) age_confirmed_at set     → /
//
// Codex HIGH #5 second clause: throttle wrapper counts oauth-callback 302
// redirects whose Location includes `error=oauth_failed` so a hostile client
// can't burn unlimited retry budget on bad codes.
//
// Codex HIGH #3: NO `supabase.auth.*` calls — all OAuth interactions go
// through authAdapter.exchangeCodeForSession (sole adapter method that
// touches supabase.auth.exchangeCodeForSession + getUser).

import { NextResponse } from "next/server";

import { withThrottle } from "@shared/api/throttle";
import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import { getUserById } from "@contexts/iam/infrastructure/db/users";

export async function GET(request: Request) {
  return withThrottle(request, "oauth-callback", "on-failure", async () => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const oauthError = url.searchParams.get("error");

    // Missing/error code → redirect to login with the throttle-trigger marker.
    if (oauthError || !code) {
      return NextResponse.redirect(
        new URL("/auth/login?error=oauth_failed", url),
        { status: 302 },
      );
    }

    // Codex HIGH #3: AuthAdapter is the sole module touching supabase.auth.*.
    // Internally calls supabase.auth.exchangeCodeForSession + setAll cookies
    // via @supabase/ssr.
    const exchange = await authAdapter.exchangeCodeForSession(code);
    if (!exchange.ok) {
      return NextResponse.redirect(
        new URL("/auth/login?error=oauth_failed", url),
        { status: 302 },
      );
    }

    // Resolved Q4: route by age_confirmed_at FIRST. OAuth users on first
    // callback have age_confirmed_at = NULL → mandatory completion screen.
    // After completion (D-04 / oauth-complete use-case), age + email_verified
    // are both set so subsequent callbacks fall through to /.
    const dbUser = await getUserById(exchange.userId);
    if (!dbUser || !dbUser.ageConfirmedAt) {
      return NextResponse.redirect(new URL("/auth/oauth-complete", url), {
        status: 302,
      });
    }

    return NextResponse.redirect(new URL("/", url), { status: 302 });
  });
}
