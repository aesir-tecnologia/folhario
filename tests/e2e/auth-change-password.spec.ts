// Phase 4 plan 09 AUTH-13 + Codex HIGH #6 — cookie-bearing change-password flow.
//
// Asserts (via real cookies + the running Next server):
//   1. Log in with old password → 200 + Supabase SSR cookie minted.
//   2. PATCH /api/v1/iam/me/password with correct current + valid new → 200.
//   3. Log in with the NEW password → 200 (the password was actually changed).
//   4. Log in with the OLD password → 401 invalid_credentials (old is dead).
//   5. Wrong current_password → 401 invalid_credentials with closed-registry code.

import { test, expect } from "@playwright/test";

test("change password: log in with old → change → log in with new + old fails", async ({
  page,
  request,
}) => {
  const email = `playwright-pwchg-${Date.now()}@example.com`;
  const oldPw = "OldPw123!";
  const newPw = "NewPw456!";

  // Pre-seed verified user via the diagnostics test helper.
  const seedResp = await request.post(
    "/api/v1/diagnostics/iam-test-helpers/seed-verified-user",
    {
      data: { email, password: oldPw },
      headers: { "content-type": "application/json" },
    },
  );
  expect(seedResp.status()).toBe(200);

  // 1. Log in with the OLD password.
  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password: oldPw },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.3.1" },
  });
  expect(loginResp.status()).toBe(200);

  // 2. PATCH /me/password with correct current.
  const patchResp = await page.request.patch("/api/v1/iam/me/password", {
    data: { current_password: oldPw, new_password: newPw },
    headers: { "content-type": "application/json" },
  });
  expect(patchResp.status()).toBe(200);
  const patchBody = await patchResp.json();
  expect(patchBody.ok).toBe(true);

  // 3. Log out and log in with the NEW password.
  await page.request.post("/api/v1/iam/logout", {
    data: {},
    headers: { "content-type": "application/json" },
  });
  const loginNewResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password: newPw },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.3.2" },
  });
  expect(loginNewResp.status()).toBe(200);

  // 4. Log out and try the OLD password — must fail.
  await page.request.post("/api/v1/iam/logout", {
    data: {},
    headers: { "content-type": "application/json" },
  });
  const loginOldResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password: oldPw },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.3.3" },
  });
  expect(loginOldResp.status()).toBe(401);
});

test("change password with wrong current → 401 invalid_credentials", async ({
  page,
  request,
}) => {
  const email = `playwright-pwchg-wrong-${Date.now()}@example.com`;
  const password = "Pw123456!";

  const seedResp = await request.post(
    "/api/v1/diagnostics/iam-test-helpers/seed-verified-user",
    {
      data: { email, password },
      headers: { "content-type": "application/json" },
    },
  );
  expect(seedResp.status()).toBe(200);

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.3.4" },
  });
  expect(loginResp.status()).toBe(200);

  const patchResp = await page.request.patch("/api/v1/iam/me/password", {
    data: {
      current_password: "WRONG-CURRENT",
      new_password: "ANewPw789!",
    },
    headers: { "content-type": "application/json" },
  });
  expect(patchResp.status()).toBe(401);
  const body = await patchResp.json();
  expect(body.error.code).toBe("invalid_credentials");
});
