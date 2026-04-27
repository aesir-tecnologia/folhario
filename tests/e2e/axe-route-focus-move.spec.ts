import { test, expect } from "@playwright/test";

test("UI-03 — focus moves to <main> on route change", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Click Catalog tab in bottom-nav.
  await page.getByRole("link", { name: "Catálogo" }).click();
  await page.waitForLoadState("networkidle");

  // Allow useEffect focus call to fire.
  await page.waitForTimeout(100);

  const activeId = await page.evaluate(
    () => document.activeElement?.id ?? "",
  );
  expect(activeId).toBe("main");
});
