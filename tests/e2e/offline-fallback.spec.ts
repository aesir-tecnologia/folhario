import { test, expect } from "@playwright/test";

// HIGH 3 (codex review) — this spec MUST run against `next build && next start`,
// NOT `next dev`. Service workers are disabled in Next dev mode by default —
// under dev the test would NEVER exercise the SW navigation-fallback path.
// playwright.config.ts wires webServer.command = "pnpm start" — keep it.
test("OFF-09 — SW navigation-fallback serves /offline when context offline + uncached route requested", async ({
  page,
  context,
}) => {
  // 1. Navigate ONLINE to a route that triggers SW install + pre-cache.
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // 2. Wait for the SW to be ACTIVE (not just registered). serviceWorker.ready
  //    resolves once the service worker has reached the activated state and
  //    is controlling the page. HIGH 3 (codex review) — without this wait,
  //    the next setOffline+navigate races the SW install and the test would
  //    fall through to a real network failure instead of the SW fallback.
  await page.waitForFunction(
    () => navigator.serviceWorker.ready.then(() => true),
    null,
    { timeout: 10_000 },
  );
  await page.evaluate(() => navigator.serviceWorker.ready);

  // 3. Force the BrowserContext offline AFTER the SW is ready + caching the
  //    precache manifest. From here on, every navigation request is served by
  //    the SW (or fails network).
  await context.setOffline(true);

  // 4. Navigate to an UNCACHED route. HIGH 3 (codex review) — navigating
  //    directly to the /offline route defeats the test (it just renders the
  //    /offline route via the SW happy path, NOT the navigation fallback).
  //    `/profile/never-precached-edge` is NOT in the precache manifest (Plan 04
  //    `src/app/sw.ts` precaches the route tree, not arbitrary subpaths) — the
  //    SW navigation handler will intercept and fall through to /offline.
  await page.goto("/profile/never-precached-edge");

  // 5. Assert /offline content rendered (proves SW navigation fallback fired).
  //    EmptyState structure: illustration + headline + hint + CTA.
  //    Open Risk #3 — placeholder leaf SVG renders inline if no founder asset.
  const svg = page.locator("svg").first();
  await expect(svg).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /você está offline/i }),
  ).toBeVisible();
  await expect(page.getByText(/Verifique sua conexão/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Tentar novamente" }),
  ).toBeVisible();

  await context.setOffline(false);
});
