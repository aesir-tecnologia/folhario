import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0 });

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const combo of COMBOS) {
  test(`axe /lightbox open [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical violations`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: combo.colorScheme,
      reducedMotion: combo.reducedMotion,
    });
    await page.goto("/lightbox");
    await page.getByTestId("lightbox-invoker").click();
    await page.waitForSelector('[role="dialog"]');

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    const moderate = results.violations.filter((v) => v.impact === "moderate");

    if (moderate.length > 0) {
      console.warn(
        `axe moderate violations on /lightbox [${combo.colorScheme} / ${combo.reducedMotion}]:`,
        moderate.map((v) => v.id).join(", "),
      );
    }

    expect(
      blocking,
      `serious + critical violations: ${blocking.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
}

// T-05-14-02 — Lightbox focus trap: Tab cycle stays inside [role="dialog"];
// Esc returns focus to invoker. Mirrors axe-modal-focus-trap.spec.ts verbatim.
test("T-05-14-02 — Lightbox focus trap cycles inside Dialog and returns focus to invoker on close", async ({
  page,
}) => {
  await page.goto("/lightbox");
  await page.getByTestId("lightbox-invoker").click();

  await page.waitForSelector('[role="dialog"]');

  const initiallyFocused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      testid: el?.getAttribute("data-testid") ?? null,
      tag: el?.tagName.toLowerCase() ?? null,
      insideDialog: el ? !!el.closest('[role="dialog"]') : false,
    };
  });
  expect(initiallyFocused.insideDialog).toBe(true);

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? !!el.closest('[role="dialog"]') : false;
    });
    expect(stillInside, `Focus escaped Dialog after Tab #${i + 1}`).toBe(true);
  }

  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  await page.waitForTimeout(100);

  const returnedToInvoker = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("data-testid") === "lightbox-invoker";
  });
  expect(returnedToInvoker).toBe(true);
});
