import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const combo of COMBOS) {
  test(`axe /combobox [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical violations`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: combo.colorScheme,
      reducedMotion: combo.reducedMotion,
    });
    await page.goto("/combobox");

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    const moderate = results.violations.filter((v) => v.impact === "moderate");

    if (moderate.length > 0) {
      console.warn(
        `axe moderate violations on /combobox [${combo.colorScheme} / ${combo.reducedMotion}]:`,
        moderate.map((v) => v.id).join(", "),
      );
    }

    expect(
      blocking,
      `serious + critical violations: ${blocking.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
}

test("APG keyboard contract — ArrowDown opens listbox, aria-expanded=true, aria-activedescendant set", async ({
  page,
}) => {
  await page.goto("/combobox");

  const comboboxInput = page.getByTestId("combobox-generic-input");
  await comboboxInput.focus();
  await page.keyboard.press("ArrowDown");

  const expanded = await comboboxInput.getAttribute("aria-expanded");
  expect(expanded).toBe("true");

  const activedescendant = await comboboxInput.getAttribute("aria-activedescendant");
  expect(activedescendant).toMatch(/^.+-a$/);
});
