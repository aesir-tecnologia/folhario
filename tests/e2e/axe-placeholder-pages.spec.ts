import { test as baseTest, expect } from "@playwright/test";
import { test as authedTest } from "./fixtures/authed-user";
import AxeBuilder from "@axe-core/playwright";

const ROUTES = ["/", "/catalog", "/identify", "/profile", "/offline"] as const;

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const route of ROUTES) {
  for (const combo of COMBOS) {
    baseTest(
      `axe ${route} [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical violations`,
      async ({ page }) => {
        await page.emulateMedia({
          colorScheme: combo.colorScheme,
          reducedMotion: combo.reducedMotion,
        });
        await page.goto(route);

        const results = await new AxeBuilder({ page }).analyze();
        const blocking = results.violations.filter(
          (v) => v.impact === "critical" || v.impact === "serious",
        );
        const moderate = results.violations.filter((v) => v.impact === "moderate");

        // Warn-log moderate violations to stdout (do not fail).
        if (moderate.length > 0) {
          console.warn(
            `axe moderate violations on ${route} [${combo.colorScheme} / ${combo.reducedMotion}]:`,
            moderate.map((v) => v.id).join(", "),
          );
        }

        expect(
          blocking,
          `serious + critical violations: ${blocking.map((v) => v.id).join(", ")}`,
        ).toEqual([]);
      },
    );
  }
}

// W-3 fix — verify OfflineBanner copy from pt-BR.json renders when offline.
// Direct linkage between the i18n message file (Plan 02) and rendered output
// (Plan 04 OfflineBanner). Fails if the offline.banner.label key is removed
// or the OfflineBanner component drops its useTranslations wiring.
//
// IMPORTANT — ordering matches offline-fallback.spec.ts: navigate ONLINE first
// to register the SW + cache the route, THEN setOffline(true) + reload to
// trigger the banner. Setting context offline BEFORE navigating would block
// the very-first network request entirely (no SW yet to serve) and the page
// would never load. (Advisor flag during revision review.)
for (const route of ROUTES.filter((r) => r !== "/offline")) {
  authedTest(
    `UI-24 + W-3 — OfflineBanner pt-BR copy renders on ${route} when context offline`,
    async ({ page, authedUser }) => {
      void authedUser;
      await page.goto(route);
      await page.waitForLoadState("networkidle");
      // Dispatch browser offline event — triggers useOnlineStatus without needing SW.
      await page.evaluate(() => window.dispatchEvent(new Event("offline")));
      await page.waitForTimeout(500);
      const banner = page.getByRole("status").filter({ hasText: /Você está offline/i });
      await expect(banner).toBeVisible();
      // Restore online state for teardown.
      await page.evaluate(() => window.dispatchEvent(new Event("online")));
    },
  );
}
