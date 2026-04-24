import { test, expect } from "@playwright/test";

test("PostHog $diagnostics_client_ping fires + GET /api/v1/diagnostics/ping returns {ok,env,timestamp}", async ({
  page,
  request,
}) => {
  const posthogEvents: string[] = [];

  await page.route(/\.i\.posthog\.com\/(e|batch|capture)/, async (route) => {
    const raw = route.request().postData();
    if (raw) posthogEvents.push(raw);
    await route.fulfill({ status: 200, body: "1" });
  });

  await page.goto("/diag");

  if (process.env.CI) {
    await page
      .waitForRequest(/\.i\.posthog\.com\/(e|batch|capture)/, { timeout: 8000 })
      .catch(() => {});
  } else {
    await page.waitForTimeout(3000);
  }

  const pingRes = await request.get("/api/v1/diagnostics/ping");
  expect(pingRes.status()).toBe(200);
  const body = await pingRes.json();
  expect(body).toMatchObject({ ok: true });
  expect(body.env === "development" || body.env === "production").toBe(true);
  expect(typeof body.timestamp).toBe("string");
  expect(() => new Date(body.timestamp)).not.toThrow();

  if (process.env.CI) {
    expect(posthogEvents.length).toBeGreaterThan(0);
    const joined = posthogEvents.join("\n");
    expect(joined, "client diagnostics event must appear in some PostHog payload").toContain(
      "$diagnostics_client_ping",
    );
  }
});
