// UAT T11 — login with invalid credentials returns generic 401
// invalid_credentials, regardless of whether the email exists.
//
// Anti-enumeration: same response body for "unknown email" and "real
// email + wrong password". No session cookie is set on the response.
//
// Each scenario uses a unique x-forwarded-for so it cannot collide
// with the rate-limit spec or each other (D-15 throttle is per-IP).

import { test, expect } from "@playwright/test";

const GENERIC_LOGIN_ERROR = "E-mail ou senha incorretos.";

test("login with unknown email → 401 invalid_credentials with generic copy", async ({ page }) => {
  const resp = await page.request.post("/api/v1/iam/login", {
    data: {
      email: `playwright-unknown-${Date.now()}@example.com`,
      password: "DoesNotMatter123!",
    },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.41.1" },
  });
  expect(resp.status()).toBe(401);
  const body = await resp.json();
  expect(body.error.code).toBe("invalid_credentials");
  expect(body.error.message).toBe(GENERIC_LOGIN_ERROR);
  expect(resp.headers()["set-cookie"]).toBeUndefined();
});

test("login with valid email + wrong password → 401 invalid_credentials, no cookie", async ({
  page,
  request,
}) => {
  const email = `playwright-wrongpw-${Date.now()}@example.com`;
  const password = "TheRealPassword123!";

  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password: "Definitely-not-the-real-pw!" },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.41.2" },
  });
  expect(loginResp.status()).toBe(401);
  const body = await loginResp.json();
  expect(body.error.code).toBe("invalid_credentials");
  expect(body.error.message).toBe(GENERIC_LOGIN_ERROR);

  const cookies = await page.context().cookies();
  const sbCookies = cookies.filter((c) => /^sb-[^.]+-auth-token(?:\.\d+)?$/.test(c.name));
  expect(sbCookies.length).toBe(0);
});
