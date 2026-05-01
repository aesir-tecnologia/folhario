import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0 });

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

test("UI-08 — focus trap survives Tab × 6 inside BottomSheet alertdialog", async ({ page }) => {
  await page.goto("/bottom-sheet");
  await page.getByTestId("bottomsheet-invoker").click();
  await page.waitForSelector('[role="alertdialog"]');

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? !!el.closest('[role="alertdialog"]') : false;
    });
    expect(stillInside, `Focus escaped alertdialog after Tab #${i + 1}`).toBe(true);
  }
});

test("UI-08 — focus trap survives Shift+Tab × 6 inside BottomSheet alertdialog", async ({
  page,
}) => {
  await page.goto("/bottom-sheet");
  await page.getByTestId("bottomsheet-invoker").click();
  await page.waitForSelector('[role="alertdialog"]');

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Shift+Tab");
    const stillInside = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? !!el.closest('[role="alertdialog"]') : false;
    });
    expect(stillInside, `Focus escaped alertdialog after Shift+Tab #${i + 1}`).toBe(true);
  }
});

test("UI-08 — Esc closes BottomSheet and returns focus to invoker", async ({ page }) => {
  await page.goto("/bottom-sheet");
  await page.getByTestId("bottomsheet-invoker").click();
  await page.waitForSelector('[role="alertdialog"]');

  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="alertdialog"]', { state: "detached" });

  await page.waitForTimeout(100);

  const returnedToInvoker = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("data-testid") === "bottomsheet-invoker";
  });
  expect(returnedToInvoker).toBe(true);
});

test("UI-08 — drag handle Enter dismisses BottomSheet and returns focus to invoker", async ({
  page,
}) => {
  await page.goto("/bottom-sheet");
  await page.getByTestId("bottomsheet-invoker").click();
  await page.waitForSelector('[role="alertdialog"]');

  await page.locator('[data-testid="bottomsheet-drag-handle"]').focus();
  await page.keyboard.press("Enter");
  await page.waitForSelector('[role="alertdialog"]', { state: "detached" });

  await page.waitForTimeout(100);

  const returnedToInvoker = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("data-testid") === "bottomsheet-invoker";
  });
  expect(returnedToInvoker).toBe(true);
});

for (const combo of COMBOS) {
  test(`axe BottomSheet open [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical violations`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: combo.colorScheme,
      reducedMotion: combo.reducedMotion,
    });
    await page.goto("/bottom-sheet");
    await page.getByTestId("bottomsheet-invoker").click();
    await page.waitForSelector('[role="alertdialog"]');

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    const moderate = results.violations.filter((v) => v.impact === "moderate");

    if (moderate.length > 0) {
      console.warn(
        `axe moderate violations on /bottom-sheet [${combo.colorScheme} / ${combo.reducedMotion}]:`,
        moderate.map((v) => v.id).join(", "),
      );
    }

    expect(
      blocking,
      `serious + critical violations: ${blocking.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
}
