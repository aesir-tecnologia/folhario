import { test, expect } from "@playwright/test";

test.skip(!!process.env.CI, "CI runs with populated DSN — local-mode guard runs only locally");

test("Empty NEXT_PUBLIC_SENTRY_DSN produces zero Sentry envelope requests", async ({ page }) => {
  let envelopeCount = 0;

  await page.route("**/*.ingest.sentry.io/**", async (route) => {
    envelopeCount += 1;
    await route.fulfill({ status: 200, body: "ok" });
  });

  await page.goto("/diag");
  await page.waitForTimeout(3000);

  expect(envelopeCount, "local mode must not emit Sentry envelopes").toBe(0);
});
