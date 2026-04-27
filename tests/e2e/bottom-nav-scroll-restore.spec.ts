import { test, expect } from "@playwright/test";

// Retry once under CI throttling — debounced scroll save (150ms) + useLayoutEffect restore
// timing can race; advisor flagged the two waitForTimeout() calls as fragility risk.
test.describe.configure({ retries: 2 });

test("UI-14 — per-tab scroll preservation across bottom-nav switches", async ({
  page,
}) => {
  // Make Home tall enough to scroll. Placeholder pages may be short; inject
  // a tall spacer via page.evaluate.
  await page.goto("/");
  await page.evaluate(() => {
    const spacer = document.createElement("div");
    spacer.style.height = "2000px";
    spacer.setAttribute("data-test-spacer", "true");
    document.querySelector("main")?.appendChild(spacer);
  });

  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(200); // allow debounced save

  // Switch to Catalog tab.
  await page.getByRole("link", { name: "Catálogo" }).click();
  await page.waitForLoadState("networkidle");

  // Switch back to Home.
  await page.getByRole("link", { name: "Início" }).click();
  await page.waitForLoadState("networkidle");

  // Allow useLayoutEffect restore to fire.
  await page.waitForTimeout(100);

  const restoredY = await page.evaluate(() => window.scrollY);
  // Tolerate 1px sub-pixel diff.
  expect(restoredY).toBeGreaterThanOrEqual(399);
  expect(restoredY).toBeLessThanOrEqual(401);
});
