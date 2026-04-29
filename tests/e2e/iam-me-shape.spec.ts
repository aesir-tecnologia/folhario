// UAT T21 — GET /api/v1/iam/me returns the enriched user with the
// expected fields, NEVER exposes a password hash, and surfaces
// hasPassword reflecting the auth method.
//
// Two flows:
//   (a) seed-verified-user — user has a local password → hasPassword=true
//   (b) seed-oauth-incomplete-user → login → oauth-complete →
//       nullify-password (NEW diagnostics helper) → hasPassword=false
//
// The route handler at src/app/api/v1/iam/me/route.ts re-fetches via
// getUserById which JOINs auth.users(encrypted_password IS NOT NULL)
// to derive hasPassword without ever reading the hash itself
// (T-04-07-02 information-leak mitigation).

import { test, expect } from "@playwright/test";

const FORBIDDEN_KEYS_REGEX = /(password|encrypted_password|password_hash)/i;

function assertNoPasswordKeys(obj: unknown): void {
  const json = JSON.stringify(obj);
  // hasPassword IS allowed (camelCase boolean derived from the JOIN); raw
  // password fields are not. Strip the allowlisted token before regexing.
  const stripped = json.replace(/"hasPassword"\s*:\s*(true|false)/g, "");
  expect(stripped).not.toMatch(FORBIDDEN_KEYS_REGEX);
}

test("/api/v1/iam/me returns enriched user with hasPassword=true for email/password account", async ({
  page,
  request,
}) => {
  const email = `playwright-me-pw-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.21.1" },
  });
  expect(loginResp.status()).toBe(200);

  const meResp = await page.request.get("/api/v1/iam/me");
  expect(meResp.status()).toBe(200);
  const body = await meResp.json();

  expect(body.user.email).toBe(email);
  expect(body.user.id).toBeTruthy();
  expect(body.user.emailVerifiedAt).toBeTruthy();
  expect(body.user.ageConfirmedAt).toBeTruthy();
  expect(body.user.timezone).toBe("America/Sao_Paulo");
  expect(body.user.hasPassword).toBe(true);
  expect(body.user.trialSource).toBe("organic");
  expect(typeof body.user.notificationTimeLocal).toBe("string");

  assertNoPasswordKeys(body);
});

test("/api/v1/iam/me returns hasPassword=false for OAuth-only account", async ({
  page,
  request,
}) => {
  const email = `playwright-me-oauth-${Date.now()}@example.com`;

  const seedResp = await request.post(
    "/api/v1/diagnostics/iam-test-helpers/seed-oauth-incomplete-user",
    { data: { email }, headers: { "content-type": "application/json" } },
  );
  expect(seedResp.status()).toBe(200);
  const { id: userId, password } = (await seedResp.json()) as {
    id: string;
    password: string;
  };

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.21.2" },
  });
  expect(loginResp.status()).toBe(200);

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

  const nullifyResp = await page.request.post(
    "/api/v1/diagnostics/iam-test-helpers/nullify-password",
    { data: { userId }, headers: { "content-type": "application/json" } },
  );
  expect(nullifyResp.status()).toBe(200);

  const meResp = await page.request.get("/api/v1/iam/me");
  expect(meResp.status()).toBe(200);
  const body = await meResp.json();

  expect(body.user.email).toBe(email);
  expect(body.user.hasPassword).toBe(false);
  expect(body.user.emailVerifiedAt).toBeTruthy();
  expect(body.user.ageConfirmedAt).toBeTruthy();

  assertNoPasswordKeys(body);
});
