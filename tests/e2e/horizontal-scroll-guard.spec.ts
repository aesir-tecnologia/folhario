import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/catalog", "/identify", "/profile", "/offline"] as const;

for (const path of ROUTES) {
  test(`UI-21 — no horizontal scroll on ${path}`, async ({ page }) => {
    await page.goto(path);
    const result = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // Allow 1px subpixel tolerance.
    expect(result.scrollWidth).toBeLessThanOrEqual(result.clientWidth + 1);
  });
}
