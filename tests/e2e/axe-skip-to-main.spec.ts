import { test, expect } from "@playwright/test";

test("UI-22 — skip-to-main link is the FIRST focusable element", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");

  // Press Tab; the first focusable should be the skip-link.
  await page.keyboard.press("Tab");

  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return {
      tag: el?.tagName.toLowerCase() ?? "",
      text: el?.textContent ?? "",
      href: el?.getAttribute("href") ?? "",
    };
  });

  expect(focused.tag).toBe("a");
  expect(focused.text).toContain("Ir para o conteúdo principal");
  expect(focused.href).toBe("#main");
});
