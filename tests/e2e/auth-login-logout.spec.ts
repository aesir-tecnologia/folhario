import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// @supabase/ssr@0.10+ stores the full session blob (access_token,
// refresh_token, user, expires_at, ...) inside one or more `sb-{ref}-auth-
// token` cookies. Small sessions fit in one cookie; larger sessions chunk
// into `sb-{ref}-auth-token.0`, `.1`, etc. The chunked values, in order,
// concatenate to a single string optionally prefixed with `base64-`; that
// payload is base64url-encoded JSON. There is NO separately-named cookie
// containing the word "refresh" — Q-AUTH-14's refresh-token-revoked
// assertion has to extract `refresh_token` from this blob.
function extractRefreshToken(cookies: { name: string; value: string }[]): string | null {
  const chunks = cookies
    .filter((c) => /^sb-[^.]+-auth-token(?:\.\d+)?$/.test(c.name))
    .sort((a, b) => {
      const aIdx = Number(a.name.match(/\.(\d+)$/)?.[1] ?? 0);
      const bIdx = Number(b.name.match(/\.(\d+)$/)?.[1] ?? 0);
      return aIdx - bIdx;
    });
  if (chunks.length === 0) return null;
  let combined = chunks.map((c) => c.value).join("");
  if (combined.startsWith("base64-")) {
    combined = Buffer.from(combined.slice("base64-".length), "base64url").toString("utf-8");
  }
  try {
    const parsed = JSON.parse(combined) as { refresh_token?: string };
    return parsed.refresh_token ?? null;
  } catch {
    return null;
  }
}

/**
 * Phase 4 AUTH-05 + AUTH-14 + Codex HIGH #6 — cookie-bearing login → logout
 * → refresh-token-revoked end-to-end.
 *
 * Resolved Q-AUTH-14: logout clears this device's cookie and revokes its
 * refresh token. The existing access JWT continues to be valid until its
 * `exp` (≤1h on Supabase default). This spec asserts:
 *
 *   (a) login mints the SSR session cookie,
 *   (b) the protected GET /api/v1/iam/me returns the user's email,
 *   (c) logout clears the cookie (Set-Cookie expires it),
 *   (d) the protected /me returns 401 unauthenticated,
 *   (e) re-using the captured refresh token via Supabase JS client fails.
 *
 * It does NOT assert that the access JWT is rejected immediately — that
 * requires AUTH-v2-02 (JWT denylist), out of scope for MVP.
 *
 * Cross-plan dependencies (deferred):
 *   • POST /api/v1/diagnostics/iam-test-helpers/seed-verified-user — a
 *     test-only fixture endpoint that calls supabaseAdmin.admin.createUser
 *     ({email_confirm: true}) and inserts public.users with
 *     emailVerifiedAt = now(). Returns 404 in production. NOT shipped by
 *     04-07 (parallel-wave file boundaries) and NOT by 04-06 either; the
 *     plan that adds /me (04-09) or a later infra plan must add the
 *     fixture before this spec is runnable. Until then the spec ships as
 *     a structural artifact: file present, acceptance greps pass,
 *     `npx playwright test` would fail at the seed step.
 *   • GET /api/v1/iam/me — owned by Plan 04-09 (later wave).
 */

test("login mints session cookie + access gated endpoint + logout clears cookie + subsequent gated returns 401", async ({
  page,
  request,
}) => {
  const email = `playwright-login-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  // Pre-seed a verified user via a test-only diagnostics endpoint. The
  // endpoint is gated to non-production environments and rejects unknown
  // callers via an env-controlled token header.
  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  // 1. Log in.
  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.1.1" },
  });
  expect(loginResp.status()).toBe(200);

  // 2. Assert the Supabase auth cookie is set (sb-* cookies; exact names
  //    depend on the @supabase/ssr version).
  const cookiesAfterLogin = await page.context().cookies();
  const supabaseCookies = cookiesAfterLogin.filter((c) => c.name.startsWith("sb-"));
  expect(supabaseCookies.length).toBeGreaterThan(0);

  // 3. Hit the protected /me endpoint — should return 200 with the user email.
  const meResp = await page.request.get("/api/v1/iam/me");
  expect(meResp.status()).toBe(200);
  const meBody = await meResp.json();
  expect(meBody.user.email).toBe(email);

  // Capture the refresh token for the post-logout assertion (resolved Q-AUTH-14).
  // @supabase/ssr@0.10+ embeds refresh_token inside the chunked auth-token
  // cookie blob; see extractRefreshToken at top of file.
  const refreshTokenValue = extractRefreshToken(supabaseCookies);
  expect(refreshTokenValue).toBeTruthy();

  // 4. Log out.
  const logoutResp = await page.request.post("/api/v1/iam/logout", {
    data: {},
    headers: { "content-type": "application/json" },
  });
  expect(logoutResp.status()).toBe(200);

  // 5. Assert the cookie is cleared (Set-Cookie with expired/empty value).
  const cookiesAfterLogout = await page.context().cookies();
  const remainingSupabaseCookies = cookiesAfterLogout.filter(
    (c) => c.name.startsWith("sb-") && c.value !== "",
  );
  expect(remainingSupabaseCookies.length).toBe(0);

  // 6. Hit /me without the cookie — should return 401 unauthenticated.
  const meAfterLogoutResp = await page.request.get("/api/v1/iam/me");
  expect(meAfterLogoutResp.status()).toBe(401);
  const errorBody = await meAfterLogoutResp.json();
  expect(errorBody.error.code).toBe("unauthenticated");

  // 7. Resolved Q-AUTH-14: assert the OLD refresh token can no longer be
  //    used to mint a new session. We use the captured refresh token via
  //    a fresh Supabase JS client (NOT the page cookie store).
  const supabaseDirect = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabaseDirect.auth.refreshSession({
    refresh_token: refreshTokenValue!,
  });
  expect(error !== null || data.session === null).toBe(true);

  // 8. Per resolved Q-AUTH-14: the OLD access_token is intentionally NOT
  //    asserted to be rejected. AUTH-v2-02 (JWT denylist) is post-MVP.
});

test("unauthenticated logout returns 200 (idempotent)", async ({ request }) => {
  const res = await request.post("/api/v1/iam/logout", {
    data: {},
    headers: { "content-type": "application/json" },
  });
  expect(res.status()).toBe(200);
});
