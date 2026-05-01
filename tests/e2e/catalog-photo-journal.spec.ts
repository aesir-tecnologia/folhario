import { test, expect } from "./fixtures/authed-user";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0 });

const MINIMAL_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

async function seedPlantViaForm(
  page: import("@playwright/test").Page,
  options: { name?: string } = {},
) {
  const plantName = options.name ?? "PlantaJornal";
  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  await page.goto("/catalog/add");
  await page.waitForSelector('[data-testid="add-plant-form"]');

  await page.getByLabel("Nome").fill(plantName);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "plant.jpg",
    mimeType: "image/jpeg",
    buffer: imageBuffer,
  });

  await page.waitForSelector('img[src^="blob:"]');
  await page.getByRole("button", { name: "Adicionar à minha estante" }).click();
  await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  const urlMatch = page.url().match(/\/catalog\/([0-9a-f-]{36})$/);
  if (!urlMatch?.[1]) throw new Error("Could not extract plant ID from URL");
  return urlMatch[1];
}

test("Photo journal E2E — add photo, open lightbox, Idempotency-Key present", async ({
  page,
  authedUser,
}) => {
  void authedUser;

  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  const plantId = await seedPlantViaForm(page);

  await page.goto(`/catalog/${plantId}/journal`);
  await page.waitForSelector('[data-testid="photo-journal"]');

  let idempotencyKeyOnPost: string | undefined;
  page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/photo-entries")
    ) {
      idempotencyKeyOnPost = request.headers()["idempotency-key"];
    }
  });

  await page.getByRole("button", { name: "+ Foto" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 5_000 });

  const fileInput = sheet.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "journal.jpg",
    mimeType: "image/jpeg",
    buffer: imageBuffer,
  });

  await page.waitForSelector('[data-testid="journal-sheet-preview"]', { timeout: 5_000 });

  await page.getByRole("button", { name: "Adicionar" }).click();

  await expect(sheet).not.toBeVisible({ timeout: 10_000 });

  const entryImages = page.locator('[data-testid="photo-journal"] img');
  const count = await entryImages.count();
  expect(count).toBeGreaterThanOrEqual(2);

  expect(idempotencyKeyOnPost).toBeTruthy();
  expect(idempotencyKeyOnPost).toMatch(/^[0-9a-f-]{36}$/i);

  await entryImages.first().click();
  await expect(page.getByRole("dialog", { name: /galeria/i })).toBeVisible({
    timeout: 5_000,
  });
});

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const combo of COMBOS) {
  test(
    `axe /catalog/{plantId}/journal [sheet open, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`,
    async ({ page, authedUser }) => {
      void authedUser;

      const plantId = await seedPlantViaForm(page, { name: "AxeJornal" });

      await page.emulateMedia({
        colorScheme: combo.colorScheme,
        reducedMotion: combo.reducedMotion,
      });

      await page.goto(`/catalog/${plantId}/journal`);
      await page.waitForSelector('[data-testid="photo-journal"]');

      await page.getByRole("button", { name: "+ Foto" }).click();
      await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });

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
