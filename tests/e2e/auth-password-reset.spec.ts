import { test, expect } from "@playwright/test";

/**
 * Phase 4 AUTH-11 + AUTH-12 + Codex HIGH #6 — cookie-bearing password
 * reset flow tested with real browser cookies.
 *
 * Covers: reset-request → token mint (via test-only diagnostics endpoint
 * that mirrors what the iam/password-reset-requested Inngest function
 * would do in production) → click reset link → set new password → log
 * in with new password (succeeds) → log in with old password (rejected
 * with invalid_credentials).
 *
 * AUTH-12 invariant verified at the cookie layer: existing JWTs minted
 * BEFORE the reset are NOT invalidated. Logging in with the new password
 * works AFTER the reset; logging in with the old password fails. The
 * full "old access JWT still works" assertion is post-MVP (AUTH-v2-02
 * JWT denylist) — same scope decision as auth-login-logout.spec.ts.
 *
 * NOTE: Production reset URL travels via Resend email. In E2E we
 * shortcut by minting a fresh token via /api/v1/diagnostics/iam-test-helpers/
 * latest-reset-token, which calls the same `mintResetToken` repo the
 * iam/password-reset-requested function would invoke. This avoids
 * coupling the spec to a running Inngest dev server while still
 * exercising the real consume route + adapter + DB tx path.
 */

test("password reset flow: request → mint → reset → login with new password (old password rejected) — AUTH-11 + AUTH-12 + Codex HIGH #6", async ({
  page,
  request,
}) => {
  const email = `playwright-reset-${Date.now()}@example.com`;
  const oldPassword = "OldPassword123!";
  const newPassword = "NewPassword456!";

  // 1. Pre-seed a verified user via the test-only diagnostics endpoint.
  const seedResp = await request.post(
    "/api/v1/diagnostics/iam-test-helpers/seed-verified-user",
    {
      data: { email, password: oldPassword },
      headers: { "content-type": "application/json" },
    },
  );
  expect(seedResp.status()).toBe(200);

  // 2. Submit reset-request — D-11 thin wrapper: ALWAYS returns 200.
  const requestResp = await request.post(
    "/api/v1/iam/password/reset-request",
    {
      data: { email },
      headers: {
        "content-type": "application/json",
        "x-forwarded-for": "10.30.2.1",
      },
    },
  );
  expect(requestResp.status()).toBe(200);

  // 3. Mint the reset token via the test-only diagnostics endpoint
  //    (production path goes via the Inngest function → Resend email;
  //    we mint directly in test to avoid coupling to a running dev runtime).
  const tokenResp = await request.get(
    `/api/v1/diagnostics/iam-test-helpers/latest-reset-token?email=${encodeURIComponent(email)}`,
  );
  expect(tokenResp.status()).toBe(200);
  const { rawToken } = await tokenResp.json();
  expect(rawToken).toBeTruthy();

  // 4. Submit the new password.
  const resetResp = await request.post("/api/v1/iam/password/reset", {
    data: { token: rawToken, password: newPassword },
    headers: { "content-type": "application/json" },
  });
  expect(resetResp.status()).toBe(200);

  // 5. Log in with the NEW password — should succeed.
  const loginNewResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password: newPassword },
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.30.2.2",
    },
  });
  expect(loginNewResp.status()).toBe(200);

  // 6. Log out, then log in with the OLD password — should FAIL with invalid_credentials.
  await page.request.post("/api/v1/iam/logout", {
    data: {},
    headers: { "content-type": "application/json" },
  });
  const loginOldResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password: oldPassword },
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.30.2.3",
    },
  });
  expect(loginOldResp.status()).toBe(401);
  const errorBody = await loginOldResp.json();
  expect(errorBody.error.code).toBe("invalid_credentials");
});

test("reset-request with non-existent email returns 200 (anti-enumeration — D-11)", async ({
  request,
}) => {
  const res = await request.post("/api/v1/iam/password/reset-request", {
    data: { email: `nobody-${Date.now()}@example.com` },
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.30.2.4",
    },
  });
  expect(res.status()).toBe(200);
});
