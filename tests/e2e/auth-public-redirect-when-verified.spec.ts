// UAT T29 — when a user is logged in AND verified, navigating to
// /auth/login or /auth/signup redirects them to / (the (public) layout
// at src/app/(public)/layout.tsx redirects when both
// emailVerifiedAt + ageConfirmedAt are set).

import { test, expect } from "@playwright/test";

async function seedAndLogin(
  page: import("@playwright/test").Page,
  request: import("@playwright/test").APIRequestContext,
  email: string,
  password: string,
  ip: string,
): Promise<void> {
  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
  });
  expect(loginResp.status()).toBe(200);
}

test("verified user navigating to /auth/login is redirected to /", async ({ page, request }) => {
  await seedAndLogin(
    page,
    request,
    `playwright-redir-login-${Date.now()}@example.com`,
    "TestPassword123!",
    "10.0.29.1",
  );

  await page.goto("/auth/login", { waitUntil: "load" });
  expect(new URL(page.url()).pathname).toBe("/");
});

test("verified user navigating to /auth/signup is redirected to /", async ({ page, request }) => {
  await seedAndLogin(
    page,
    request,
    `playwright-redir-signup-${Date.now()}@example.com`,
    "TestPassword123!",
    "10.0.29.2",
  );

  await page.goto("/auth/signup", { waitUntil: "load" });
  expect(new URL(page.url()).pathname).toBe("/");
});
