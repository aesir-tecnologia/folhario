// UAT T12 — login throttle trips after 6 wrong-password attempts from
// the same IP, and a subsequent attempt with the CORRECT password is
// also rejected with 429 rate_limited.
//
// Throttle spec (Phase 4 D-14 + Codex HIGH #5 in
// src/contexts/iam/infrastructure/db/auth-throttle.ts):
//   - count > 5 within (ip, endpoint) trips a 5-minute lockout
//   - lockout persisted via auth_throttle.locked_until column
//   - withThrottle.checks lockout BEFORE bumping (survives 1-min bucket)
//
// We do NOT wait out the 5-min unlock window — that's flagged in the
// coverage gap report as "long-real-time-wait, manual-only" per the
// add-tests scope.

import { test, expect } from "@playwright/test";
import postgres from "postgres";

const UNIQUE_IP = `10.0.42.${(Date.now() % 200) + 30}`;

test("6 wrong-password POSTs trip rate_limited; correct password still 429 inside lockout", async ({
  page,
  request,
}) => {
  const email = `playwright-throttle-${Date.now()}@example.com`;
  const password = "TheRealPassword123!";

  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  // 5 wrong-password attempts — D-14 trip threshold is `count > 5`, so
  // these all return 401 (NOT yet 429).
  for (let i = 0; i < 5; i++) {
    const r = await page.request.post("/api/v1/iam/login", {
      data: { email, password: `wrong-pw-${i}` },
      headers: { "content-type": "application/json", "x-forwarded-for": UNIQUE_IP },
    });
    expect(r.status()).toBe(401);
    const body = await r.json();
    expect(body.error.code).toBe("invalid_credentials");
  }

  // 6th wrong-password attempt — count crosses > 5, lockout arms.
  const sixth = await page.request.post("/api/v1/iam/login", {
    data: { email, password: "wrong-pw-6" },
    headers: { "content-type": "application/json", "x-forwarded-for": UNIQUE_IP },
  });
  expect(sixth.status()).toBe(429);
  const sixthBody = await sixth.json();
  expect(sixthBody.error.code).toBe("rate_limited");

  // 7th attempt with the CORRECT password — must STILL be rejected
  // because the lockout is held by the locked_until column, not by
  // credential failure (Codex HIGH #5).
  const seventh = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": UNIQUE_IP },
  });
  expect(seventh.status()).toBe(429);
  const seventhBody = await seventh.json();
  expect(seventhBody.error.code).toBe("rate_limited");

  // Independent confirmation: auth_throttle.locked_until is in the future.
  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  const sql = postgres(url!, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const rows = await sql<{ locked_until: string | null }[]>`
      SELECT locked_until FROM public.auth_throttle
       WHERE ip = ${UNIQUE_IP} AND endpoint = 'login' AND locked_until IS NOT NULL
       ORDER BY locked_until DESC
       LIMIT 1
    `;
    expect(rows[0]?.locked_until).toBeTruthy();
    const lockedUntilMs = new Date(rows[0]!.locked_until!).getTime();
    expect(lockedUntilMs).toBeGreaterThan(Date.now());
  } finally {
    await sql.end({ timeout: 5 });
  }
});
