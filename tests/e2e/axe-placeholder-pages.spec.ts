import { test, expect } from "@playwright/test";
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
    test(`axe ${route} [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical violations`, async ({
      page,
    }) => {
      await page.emulateMedia({
        colorScheme: combo.colorScheme,
        reducedMotion: combo.reducedMotion,
      });
      await page.goto(route);

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      const moderate = results.violations.filter(
        (v) => v.impact === "moderate",
      );

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
    });
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
  test(`UI-24 + W-3 — OfflineBanner pt-BR copy renders on ${route} when context offline`, async ({
    page,
    context,
  }) => {
    // 1. Navigate online so the SW registers and the route is cached.
    await page.goto(route);
    await page.waitForLoadState("networkidle");
    // 2. Force browser onLine=false so useOnlineStatus surfaces the banner.
    await context.setOffline(true);
    // 3. Reload to re-mount the (app) layout under the offline state.
    await page.reload();
    // 4. Allow the heartbeat ping to fail + banner to mount.
    await page.waitForTimeout(500);
    // OfflineBanner wraps the label in role="status" with the WifiOff icon.
    const banner = page
      .getByRole("status")
      .filter({ hasText: /Você está offline/i });
    await expect(banner).toBeVisible();
    await context.setOffline(false);
  });
}
