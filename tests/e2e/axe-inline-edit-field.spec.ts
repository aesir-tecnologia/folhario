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
  test(`axe /inline-edit-field [${combo.colorScheme} / ${combo.reducedMotion}] with role=alert visible — 0 serious + critical violations`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: combo.colorScheme,
      reducedMotion: combo.reducedMotion,
    });
    await page.goto("/inline-edit-field");

    // Trigger the "always-fails" field so role=alert announcement is in scope during axe scan.
    const failureField = page.getByTestId("inline-text-failure");
    await failureField.getByRole("button").click();
    await page.keyboard.type("x");
    await page.keyboard.press("Tab");
    // Use locator within the failure section to avoid strict-mode violation with
    // Next.js route announcer (also aria-live="assertive"/role="alert").
    await page.getByTestId("inline-text-failure").getByRole("alert").waitFor({ state: "visible" });

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    const moderate = results.violations.filter((v) => v.impact === "moderate");

    if (moderate.length > 0) {
      console.warn(
        `axe moderate violations on /inline-edit-field [${combo.colorScheme} / ${combo.reducedMotion}]:`,
        moderate.map((v) => v.id).join(", "),
      );
    }

    expect(
      blocking,
      `serious + critical violations: ${blocking.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
}

// E2E case 21 — revert announcement is reachable as role=alert with revert copy.
test("E2E case 21 — InlineEditField role=alert revert announcement is visible after save failure", async ({
  page,
}) => {
  await page.goto("/inline-edit-field");

  const failureField = page.getByTestId("inline-text-failure");
  await failureField.getByRole("button").click();
  await page.keyboard.type("x");
  await page.keyboard.press("Tab");

  // Scope to the failure field section to avoid strict-mode conflict with Next.js route announcer.
  await expect(page.getByTestId("inline-text-failure").getByRole("alert")).toContainText("Não conseguimos salvar agora");
});
