// Phase 4 plan 04-10 Task 3 — UnverifiedBlocker end-to-end.
//
// Asserts that:
//   1. After signup, the (app)/layout server-side gate renders the
//      UnverifiedBlocker headline + body for the authenticated-but-
//      unverified user (UI-SPEC §5; AUTH-15).
//   2. Tapping "Reenviar e-mail" hits POST /api/v1/iam/resend-verification
//      (200 OR 429 depending on cooldown — both are acceptable proof
//      the CLIENT button wired the fetch correctly per D-31).
//   3. After visiting the verification URL (test-only diagnostics latest-
//      token endpoint per Plan 06's pattern), the blocker is gone and the
//      app shell renders.

import { test, expect } from "@playwright/test";

test("unverified user sees UnverifiedBlocker; click verify URL → blocker gone", async ({
  page,
  request,
}) => {
  const email = `playwright-blocker-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  // 1. Submit signup via page.request so the session cookie lands in the
  //    BROWSER context's cookie jar (the top-level `request` fixture has its
  //    own jar that the page won't see when we navigate via `page.goto`).
  const signupResp = await page.request.post("/api/v1/iam/signup", {
    data: {
      email,
      password,
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
    },
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.0.10.1",
    },
  });
  expect(signupResp.status()).toBe(200);

  // 2. Cookies set by signup carry the SSR session into the page context.
  //    Navigate to / — the (app) layout should render the UnverifiedBlocker
  //    full-viewport (no AppShell, no bottom-nav).
  await page.goto("/");

  // 3. Assert the blocker headline copy renders (AUTH-15 + UI-SPEC §5).
  await expect(
    page.getByRole("heading", { name: "Verifique seu e-mail para começar." }),
  ).toBeVisible();

  // The body copy embeds the user's email in <strong>.
  await expect(page.getByText(email)).toBeVisible();

  // 4. Click "Reenviar e-mail" — should fire POST /api/v1/iam/resend-verification.
  const resendPromise = page.waitForResponse(
    (resp) =>
      resp.url().includes("/api/v1/iam/resend-verification") &&
      [200, 429].includes(resp.status()),
    { timeout: 5_000 },
  );
  await page.getByRole("button", { name: /Reenviar e-mail|Aguarde|Enviando/ }).click();
  const resendResp = await resendPromise;
  expect([200, 429]).toContain(resendResp.status());

  // 5. Fetch the latest verification token via the test-only diagnostics
  //    endpoint (gated by NODE_ENV != production AND
  //    IDENTIFICATION_PROVIDER_MODE=stub).
  const tokenResp = await request.get(
    `/api/v1/diagnostics/iam-test-helpers/latest-token?email=${encodeURIComponent(email)}`,
  );
  expect(tokenResp.status()).toBe(200);
  const { rawToken } = await tokenResp.json();
  expect(rawToken).toMatch(/^[a-f0-9]{64}$/);

  // 6. Visit the verification URL — sets email_verified_at, redirects '/'.
  await page.goto(`/auth/verify?token=${rawToken}`);
  await page.waitForURL(/.*\/$/);

  // 7. Blocker headline must be gone now.
  await expect(
    page.getByRole("heading", { name: "Verifique seu e-mail para começar." }),
  ).toHaveCount(0);
});
