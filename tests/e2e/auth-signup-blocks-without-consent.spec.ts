// UAT T28 — POST /api/v1/iam/signup rejects when any of the three
// consent flags (age_confirmed, terms_accepted, privacy_accepted) is
// missing or false. The Zod schema in
// src/contexts/iam/domain/schemas.ts uses z.literal(true) for each, so
// the server rejects with 400 validation_failed before any DB write.
//
// HTML5 client-side `required` is the first line of defense; this spec
// confirms the SERVER does not depend on the client (defense-in-depth).

import { test, expect } from "@playwright/test";
import postgres from "postgres";

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

const SCENARIOS: { name: string; payload: Record<string, unknown> }[] = [
  {
    name: "age_confirmed=false",
    payload: {
      age_confirmed: false,
      terms_accepted: true,
      privacy_accepted: true,
    },
  },
  {
    name: "terms_accepted=false",
    payload: {
      age_confirmed: true,
      terms_accepted: false,
      privacy_accepted: true,
    },
  },
  {
    name: "privacy_accepted=false",
    payload: {
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: false,
    },
  },
];

for (const { name, payload } of SCENARIOS) {
  test(`signup with ${name} → 400 validation_failed, no user row`, async ({ page }) => {
    const email = `playwright-no-consent-${Date.now()}-${name}@example.com`;

    const resp = await page.request.post("/api/v1/iam/signup", {
      data: {
        email,
        password: "TestPassword123!",
        timezone: "America/Sao_Paulo",
        ...payload,
      },
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.28.1" },
    });
    expect(resp.status()).toBe(400);
    const body = await resp.json();
    expect(body.error.code).toBe("validation_failed");

    await expectNoUserRow(email);
  });
}
