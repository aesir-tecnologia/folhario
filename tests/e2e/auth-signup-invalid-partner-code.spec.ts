// UAT T4 — sign up with an invalid partner_code is rejected.
//
// Two scenarios, one assertion each:
//   (a) Unknown code (never inserted)            → 400 invalid_partner_code
//   (b) Inactive code (is_active=false)          → 400 invalid_partner_code
//
// In both cases the use-case rejects BEFORE any user write — neither
// auth.users nor public.users carries a row for the attempted email.
// (signupUser at src/contexts/iam/application/signup.ts validates
// partner_code first and returns invalid_partner_code without entering
// the db.transaction.)

import { test, expect } from "@playwright/test";
import postgres from "postgres";

const INACTIVE_PARTNER_CODE = "TEST-E2E-PARTNER-INACTIVE";

async function seedInactivePartner(): Promise<void> {
  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_POOL_URL or DATABASE_URL required");
  const sql = postgres(url, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    await sql`
      INSERT INTO partner_stores (name, code, trial_days, is_active)
      VALUES ('E2E Inactive Partner', ${INACTIVE_PARTNER_CODE}, 30, false)
      ON CONFLICT (code)
        DO UPDATE SET is_active = false
    `;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function expectNoUserRow(email: string): Promise<void> {
  const url = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  const sql = postgres(url!, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    const publicRows = await sql<{ id: string }[]>`
      SELECT id FROM public.users WHERE email = ${email} LIMIT 1
    `;
    expect(publicRows.length).toBe(0);

    const authRows = await sql<{ id: string }[]>`
      SELECT id FROM auth.users WHERE email = ${email} LIMIT 1
    `;
    expect(authRows.length).toBe(0);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

test("sign up with unknown partner_code → 400 invalid_partner_code, no user rows", async ({
  page,
}) => {
  const email = `playwright-bad-partner-${Date.now()}@example.com`;
  const resp = await page.request.post("/api/v1/iam/signup", {
    data: {
      email,
      password: "TestPassword123!",
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
      partner_code: "UNKNOWN-CODE-DEF-NOT-SEEDED",
    },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.31.1" },
  });
  expect(resp.status()).toBe(400);
  const body = await resp.json();
  expect(body.error.code).toBe("invalid_partner_code");

  await expectNoUserRow(email);
});

test("sign up with inactive partner_code → 400 invalid_partner_code, no user rows", async ({
  page,
}) => {
  await seedInactivePartner();

  const email = `playwright-inactive-${Date.now()}@example.com`;
  const resp = await page.request.post("/api/v1/iam/signup", {
    data: {
      email,
      password: "TestPassword123!",
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
      partner_code: INACTIVE_PARTNER_CODE,
    },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.31.2" },
  });
  expect(resp.status()).toBe(400);
  const body = await resp.json();
  expect(body.error.code).toBe("invalid_partner_code");

  await expectNoUserRow(email);
});
