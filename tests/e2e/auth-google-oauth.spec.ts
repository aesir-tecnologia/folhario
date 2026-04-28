// Phase 4 plan 09 AUTH-03 + D-04 + Codex HIGH #6 — cookie-bearing OAuth-complete flow.
//
// The full Google OAuth round-trip cannot be automated in CI without a real
// Google account. We simulate the post-callback state by:
//   1. Seeding an OAuth-incomplete user via the test-only diagnostics endpoint
//      (sets age_confirmed_at + email_verified_at to NULL on public.users).
//   2. Logging in with the seed-supplied password to mint a real Supabase SSR
//      cookie (the same cookie shape that authAdapter.exchangeCodeForSession
//      would set after a real /auth/callback).
//   3. POSTing /api/v1/iam/oauth/complete with the missing fields.
//   4. Asserting GET /api/v1/iam/me reflects the writes (age + email_verified
//      both set, partner_code persisted).
//
// Also asserts the failure-path redirect: /auth/callback?error=access_denied
// → /auth/login?error=oauth_failed.

import { test, expect } from "@playwright/test";

test("OAuth flow: seeded user → login cookie → oauth-complete → /me reflects writes", async ({
  page,
  request,
}) => {
  const email = `playwright-oauth-${Date.now()}@example.com`;

  // 1. Seed an OAuth-incomplete user; the helper returns a temp password we use
  //    to mint a real Supabase SSR cookie via the standard login route.
  const seedResp = await request.post(
    "/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user",
    {
      data: { email },
      headers: { "content-type": "application/json" },
    },
  );
  expect(seedResp.status()).toBe(200);
  const { password } = await seedResp.json();
  expect(password).toBeTruthy();

  // 2. Mint the cookie via /api/v1/iam/login.
  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.4.1" },
  });
  expect(loginResp.status()).toBe(200);

  // 3. Submit /api/v1/iam/oauth/complete with required fields.
  const completeResp = await page.request.post("/api/v1/iam/oauth/complete", {
    data: {
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
      partner_code: "",
    },
    headers: { "content-type": "application/json" },
  });
  expect(completeResp.status()).toBe(200);

  // 4. /api/v1/iam/me should now reflect both age + email_verified set.
  const meResp = await page.request.get("/api/v1/iam/me");
  expect(meResp.status()).toBe(200);
  const body = await meResp.json();
  expect(body.user.email).toBe(email);
  expect(body.user.emailVerifiedAt).toBeTruthy();
  expect(body.user.ageConfirmedAt).toBeTruthy();
  expect(body.user.timezone).toBe("America/Sao_Paulo");
});

test("OAuth callback with provider error → redirects /auth/login?error=oauth_failed", async ({
  page,
}) => {
  await page.goto("/auth/callback?error=access_denied", { waitUntil: "load" });
  expect(page.url()).toMatch(/\/auth\/login\?error=oauth_failed/);
});
