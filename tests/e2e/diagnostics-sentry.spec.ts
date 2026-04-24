import { test, expect } from "@playwright/test";

const FORBIDDEN_SENTINELS = ["scrub-me", "should-be-scrubbed", "should-be-scrubbed@example.com"];

test("Sentry fires from /diag and client scrubs PII from envelopes", async ({ page }) => {
  const sentryPayloads: string[] = [];

  await page.route(/\.ingest\.sentry\.io\/.*\/envelope/, async (route) => {
    const body = route.request().postData() ?? "";
    sentryPayloads.push(body);
    await route.fulfill({ status: 200, body: "ok" });
  });

  await page.goto("/diag");

  await page.waitForTimeout(3000);

  if (process.env.CI) {
    expect(sentryPayloads.length).toBeGreaterThan(0);
  }

  for (const payload of sentryPayloads) {
    const lower = payload.toLowerCase();
    for (const sentinel of FORBIDDEN_SENTINELS) {
      expect(lower, `payload must not contain "${sentinel}"`).not.toContain(sentinel);
    }
  }
});
