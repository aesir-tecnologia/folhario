import { test, expect } from "./fixtures/authed-user";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0 });

const MINIMAL_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

test("manual add happy path — form submit routes to /catalog/{plantId}", async ({
  page,
  authedUser,
}) => {
  void authedUser;

  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  let idempotencyKeyOnPost: string | undefined;
  await page.on("request", (request) => {
    if (
      request.method() === "POST" &&
      request.url().includes("/api/v1/plants") &&
      !request.url().includes("/photo-entries")
    ) {
      idempotencyKeyOnPost = request.headers()["idempotency-key"];
    }
  });

  await page.goto("/catalog/add");
  await page.waitForSelector('[data-testid="add-plant-form"]');

  await page.getByLabel("Nome").fill("Hera");

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "plant.jpg",
    mimeType: "image/jpeg",
    buffer: imageBuffer,
  });

  await page.waitForSelector('img[src^="blob:"]');

  await page.getByRole("button", { name: "Adicionar à minha estante" }).click();

  await page.waitForURL(/\/catalog\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  const url = page.url();
  expect(url).toMatch(/\/catalog\/[0-9a-f-]{36}$/);

  expect(idempotencyKeyOnPost).toBeTruthy();
  expect(idempotencyKeyOnPost).toMatch(/^[0-9a-f-]{36}$/i);
});

test("manual add validation — empty form shows summary + per-field errors + first-invalid focused", async ({
  page,
  authedUser,
}) => {
  void authedUser;

  await page.goto("/catalog/add");
  await page.waitForSelector('[data-testid="add-plant-form"]');

  await page.getByRole("button", { name: "Adicionar à minha estante" }).click();

  await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 5_000 });

  const summaryEl = page.locator('[role="alert"]').filter({ hasText: /falta preencher/i });
  await expect(summaryEl).toBeVisible();

  const invalidInputs = page.locator('[aria-invalid="true"]');
  await expect(invalidInputs.first()).toBeVisible();

  const count = await invalidInputs.count();
  expect(count).toBeGreaterThanOrEqual(2);

  const focusedEl = page.locator(":focus");
  await expect(focusedEl).toHaveAttribute("aria-invalid", "true");
});

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const combo of COMBOS) {
  test(`axe /catalog/add [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`, async ({
    page,
    authedUser,
  }) => {
    void authedUser;

    await page.emulateMedia({
      colorScheme: combo.colorScheme,
      reducedMotion: combo.reducedMotion,
    });
    await page.goto("/catalog/add");
    await page.waitForSelector('[data-testid="add-plant-form"]');

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(
      blocking,
      `serious + critical: ${blocking.map((v) => v.id).join(", ")}`,
    ).toEqual([]);
  });
}
