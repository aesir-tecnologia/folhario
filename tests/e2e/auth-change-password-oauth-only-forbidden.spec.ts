// UAT T18 — an OAuth-only account (no local credential) cannot change
// password via PATCH /api/v1/iam/me/password, and the change-password
// form is HIDDEN in /settings/account.
//
// Flow:
//   1. seed-oauth-incomplete-user — creates auth.users + public.users
//      with age_confirmed_at + email_verified_at NULL, returns a temp pw.
//   2. /api/v1/iam/login — mints the SSR cookie using that temp pw.
//   3. /api/v1/iam/oauth/complete — sets age + verified so the user can
//      reach gated routes.
//   4. nullify-password (NEW diagnostics helper) — NULLs auth.users.
//      encrypted_password, simulating an OAuth-only account.
//   5. PATCH /me/password — expect 403 forbidden.
//   6. GET /settings/account — expect ChangePasswordForm absent + the
//      pt-BR oauthOnlyNotice rendered.

import { test, expect } from "@playwright/test";

test("OAuth-only user: PATCH /me/password → 403 forbidden + change-pw form hidden in /settings/account", async ({
  page,
  request,
}) => {
  const email = `playwright-oauth-only-${Date.now()}@example.com`;

  // 1. Seed OAuth-incomplete user.
  const seedResp = await request.post(
    "/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user",
    { data: { email }, headers: { "content-type": "application/json" } },
  );
  expect(seedResp.status()).toBe(200);
  const { id: userId, password } = (await seedResp.json()) as {
    id: string;
    password: string;
  };

  // 2. Login mints SSR cookie.
  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.18.1" },
  });
  expect(loginResp.status()).toBe(200);

  // 3. Complete OAuth — sets age + verified.
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

  // 4. Nullify password (simulates OAuth-only state — no local credential).
  const nullifyResp = await page.request.post(
    "/api/v1/diagnostics/iam-test-helpers/nullify-password",
    {
      data: { userId },
      headers: { "content-type": "application/json" },
    },
  );
  expect(nullifyResp.status()).toBe(200);

  // 5. PATCH /me/password is forbidden — D-04 / AUTH-13 OAuth-only guard.
  const patchResp = await page.request.patch("/api/v1/iam/me/password", {
    data: { current_password: "anything-meet-min-length", new_password: "NewerPassword123!" },
    headers: { "content-type": "application/json" },
  });
  expect(patchResp.status()).toBe(403);
  const patchBody = await patchResp.json();
  expect(patchBody.error.code).toBe("forbidden");

  // 6. UI: /settings/account hides ChangePasswordForm and shows the
  //    oauthOnlyNotice copy ("Sua conta usa login com Google. ..." per
  //    messages/pt-BR.json settings.account.oauthOnlyNotice).
  await page.goto("/settings/account", { waitUntil: "load" });
  await expect(page.getByLabel(/Senha atual/i)).toHaveCount(0);
  await expect(page.getByText(/Sua conta usa login com Google/i)).toBeVisible();
});
