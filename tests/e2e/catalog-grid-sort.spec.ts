import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures/authed-user";
import { test as readOnlyTest } from "./fixtures/read-only";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0 });

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

// Minimal 1x1 JPEG to satisfy the server's photo requirement.
// Real image bytes compressed to <<1MB, EXIF-free (server strips anyway).
const MINIMAL_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

async function seedPlant(page: Page, { name }: { name: string }): Promise<string> {
  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  const resp = await page.request.post("/api/v1/plants", {
    headers: {
      "Idempotency-Key": `seed-${name}-${Date.now()}`,
    },
    multipart: {
      name,
      photo: {
        name: "plant.jpg",
        mimeType: "image/jpeg",
        buffer: imageBuffer,
      },
    },
  });

  if (!resp.ok()) {
    const text = await resp.text();
    throw new Error(`seedPlant failed (${resp.status()}): ${text}`);
  }

  const body = await resp.json() as { plant?: { id?: string } };
  const id = body.plant?.id;
  if (!id) throw new Error("seedPlant: no plant id in response");
  return id;
}

// ============================================================================
// PART A — Responsive viewport column counts
// ============================================================================

for (const { width, expectedCols } of [
  { width: 375, expectedCols: 2 },
  { width: 600, expectedCols: 3 },
  { width: 900, expectedCols: 4 },
]) {
  test(`grid renders ${expectedCols} columns at ${width}px`, async ({ page, authedUser }) => {
    void authedUser;
    await seedPlant(page, { name: `Hera-${width}` });
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/catalog");
    await page.waitForSelector('[data-testid="catalog-grid"]');

    const cols = await page.locator('[data-testid="catalog-grid"]').evaluate(
      (el) =>
        getComputedStyle(el)
          .gridTemplateColumns.split(" ")
          .filter(Boolean).length,
    );
    expect(cols).toBe(expectedCols);
  });
}

// ============================================================================
// PART B — Sort persists across navigation within the same tab
// ============================================================================

test("sort persists across navigation within session", async ({ page, authedUser }) => {
  void authedUser;
  await seedPlant(page, { name: "Babosa" });
  await page.goto("/catalog");
  await page.waitForSelector('[data-testid="catalog-grid"]');

  const select = page.getByLabel(/Ordenar por/i);
  await expect(select).toHaveValue("date_new");

  await select.selectOption("name_asc");

  const stored1 = await page.evaluate(() =>
    sessionStorage.getItem("folhario.catalog.sort"),
  );
  expect(stored1).toBe("name_asc");

  await page.goto("/profile");
  await page.goto("/catalog");
  await page.waitForSelector('[data-testid="catalog-grid"]');

  await expect(select).toHaveValue("name_asc");
  await expect(page.getByTestId("catalog-sort-announce")).toContainText(
    /Catálogo reordenado por/,
  );
});

// ============================================================================
// PART C — readOnly mode hides Adicionar planta button
// ============================================================================

readOnlyTest("readOnly hides Adicionar planta button", async ({ page }) => {
  await page.goto("/catalog");
  await page.waitForSelector(
    '[data-testid="catalog-grid"], [data-testid="catalog-empty"]',
  );
  await expect(page.getByRole("link", { name: /Adicionar planta/i })).toHaveCount(0);
});

// ============================================================================
// PART D — Axe a11y scans: filled state × 4 combos
// ============================================================================

for (const combo of COMBOS) {
  test(
    `axe /catalog [filled, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`,
    async ({ page, authedUser }) => {
      void authedUser;
      await seedPlant(page, { name: "Costela-de-adão" });
      await page.emulateMedia(combo);
      await page.goto("/catalog");
      await page.waitForSelector('[data-testid="catalog-grid"]');
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        blocking,
        `serious + critical: ${blocking.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    },
  );
}

// ============================================================================
// PART D — Axe a11y scans: empty state × 4 combos
// ============================================================================

for (const combo of COMBOS) {
  test(
    `axe /catalog [empty, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`,
    async ({ page, authedUser }) => {
      void authedUser;
      await page.emulateMedia(combo);
      await page.goto("/catalog");
      await page.waitForSelector(
        '[data-testid="catalog-empty"], [aria-label*="planta"]',
      );
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        blocking,
        `serious + critical: ${blocking.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    },
  );
}
