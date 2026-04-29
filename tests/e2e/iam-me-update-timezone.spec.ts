// UAT T22 — PATCH /api/v1/iam/me updates the user's timezone with a
// valid IANA zone, persists across requests, and rejects invalid zones
// with 400 validation_failed.
//
// The handler validates against Intl.supportedValuesOf("timeZone") (see
// src/app/api/v1/iam/me/route.ts), so any string the runtime doesn't
// recognise is rejected without ever entering the use-case.

import { test, expect } from "@playwright/test";

test("PATCH /me with valid IANA timezone persists; invalid zone → 400 validation_failed", async ({
  page,
  request,
}) => {
  const email = `playwright-tz-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.22.1" },
  });
  expect(loginResp.status()).toBe(200);

  // Valid IANA zone — Europe/Lisbon is on every modern ICU build.
  const patchResp = await page.request.patch("/api/v1/iam/me", {
    data: { timezone: "Europe/Lisbon" },
    headers: { "content-type": "application/json" },
  });
  expect(patchResp.status()).toBe(200);
  const patchBody = await patchResp.json();
  expect(patchBody.user.timezone).toBe("Europe/Lisbon");

  // Re-read via GET — confirm persistence.
  const meResp = await page.request.get("/api/v1/iam/me");
  expect(meResp.status()).toBe(200);
  const meBody = await meResp.json();
  expect(meBody.user.timezone).toBe("Europe/Lisbon");

  // Invalid zone → validation_failed.
  const badResp = await page.request.patch("/api/v1/iam/me", {
    data: { timezone: "Mars/Olympus_Mons" },
    headers: { "content-type": "application/json" },
  });
  expect(badResp.status()).toBe(400);
  const badBody = await badResp.json();
  expect(badBody.error.code).toBe("validation_failed");

  // Confirm timezone wasn't mutated by the rejected request.
  const meAgain = await page.request.get("/api/v1/iam/me");
  const meAgainBody = await meAgain.json();
  expect(meAgainBody.user.timezone).toBe("Europe/Lisbon");
});
