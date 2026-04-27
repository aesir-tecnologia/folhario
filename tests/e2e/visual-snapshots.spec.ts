import { test, expect } from "@playwright/test";

const ROUTES = ["/", "/catalog", "/identify", "/profile", "/offline"] as const;

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const route of ROUTES) {
  for (const combo of COMBOS) {
    test(`visual snapshot ${route} [${combo.colorScheme} / ${combo.reducedMotion}]`, async ({
      page,
    }) => {
      await page.emulateMedia({
        colorScheme: combo.colorScheme,
        reducedMotion: combo.reducedMotion,
      });
      await page.goto(route);
      // Mask any element marked data-snapshot-mask="true" (date/time/random IDs)
      // so the rendered baseline never drifts on those volatile regions.
      const mask = await page.locator('[data-snapshot-mask="true"]').all();
      await expect(page).toHaveScreenshot({
        animations: "disabled",
        mask,
      });
    });
  }
}
