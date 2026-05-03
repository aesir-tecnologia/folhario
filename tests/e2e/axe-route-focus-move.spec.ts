import { test, expect } from "./fixtures/authed-user";

test("UI-03 — focus moves to <main> on route change", async ({ page, authedUser }) => {
  void authedUser;
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Click Catalog tab in bottom-nav.
  await page.getByRole("link", { name: "Catálogo" }).click();
  await page.waitForLoadState("networkidle");

  await page.waitForFunction(() => document.activeElement?.id === "main", null, { timeout: 3000 });
  const activeId = await page.evaluate(() => document.activeElement?.id ?? "");
  expect(activeId).toBe("main");
});
