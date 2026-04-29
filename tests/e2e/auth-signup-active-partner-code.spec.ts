// UAT T3 — sign up with an active partner_code grants a 30-day trial.
//
// What this proves end-to-end:
//   1. POST /api/v1/iam/signup with a seeded active partner_stores row
//      returns 200 and lands the user on /auth/check-email.
//   2. public.users row carries trial_source='partner' + the seeded
//      partner_code verbatim.
//   3. public.subscriptions row for that user has trial_end_date
//      ~30 days out (vs 14 for organic — D-25 + signup use-case).
//
// Diagnostics deps: seed-active-partner-code is performed inline here
// (matches the integration fixture pattern) instead of a route helper —
// keeps the surface narrow and mirrors tests/integration/fixtures/seed-partner-code.ts.

import { test, expect } from "@playwright/test";
import postgres from "postgres";

const ACTIVE_PARTNER_CODE = "TEST-E2E-PARTNER-30";

async function seedActivePartner(): Promise<void> {
  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_POOL_URL or DATABASE_URL required");
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    await sql`
      INSERT INTO partner_stores (name, code, trial_days, is_active)
      VALUES ('E2E Active Partner', ${ACTIVE_PARTNER_CODE}, 30, true)
      ON CONFLICT (code)
        DO UPDATE SET is_active = true, trial_days = 30
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

test("sign up with active partner_code → users.trial_source=partner + ~30d trial_end_date", async ({
  page,
}) => {
  await seedActivePartner();

  const email = `playwright-partner-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  const signupResp = await page.request.post("/api/v1/iam/signup", {
    data: {
      email,
      password,
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
      partner_code: ACTIVE_PARTNER_CODE,
    },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.30.1" },
  });
  expect(signupResp.status()).toBe(200);

  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  const sql = postgres(url!, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const userRows = await sql<{ trial_source: string; partner_code: string | null }[]>`
      SELECT trial_source, partner_code FROM public.users WHERE email = ${email} LIMIT 1
    `;
    expect(userRows[0]?.trial_source).toBe("partner");
    expect(userRows[0]?.partner_code).toBe(ACTIVE_PARTNER_CODE);

    const subRows = await sql<{ trial_end_date: string; status: string }[]>`
      SELECT s.trial_end_date, s.status
        FROM public.subscriptions s
        JOIN public.users u ON u.id = s.user_id
       WHERE u.email = ${email}
       LIMIT 1
    `;
    expect(subRows[0]?.status).toBe("trialing");
    const trialEndMs = new Date(subRows[0]!.trial_end_date).getTime();
    const days = (trialEndMs - Date.now()) / (1000 * 60 * 60 * 24);
    expect(days).toBeGreaterThan(28);
    expect(days).toBeLessThan(31);
  } finally {
    await sql.end({ timeout: 5 });
  }
});
