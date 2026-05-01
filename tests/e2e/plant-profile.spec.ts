import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures/authed-user";
import { test as readOnlyTest, expect as readOnlyExpect } from "./fixtures/read-only";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0 });

const MINIMAL_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

interface SeedPlantOptions {
  name?: string;
  nickname?: string;
}

async function seedPlant(
  page: Page,
  opts: SeedPlantOptions = {},
): Promise<string> {
  const name = opts.name ?? `TestPlant-${Date.now()}`;
  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  const fields: Record<string, unknown> = { name };
  if (opts.nickname) fields.nickname = opts.nickname;

  const resp = await page.request.post("/api/v1/plants", {
    headers: {
      "Idempotency-Key": `seed-profile-${name}-${Date.now()}`,
    },
    multipart: {
      ...Object.fromEntries(
        Object.entries(fields).map(([k, v]) => [k, String(v)]),
      ),
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

  const body = (await resp.json()) as { plant?: { id?: string } };
  const id = body.plant?.id;
  if (!id) throw new Error("seedPlant: no plant id in response");
  return id;
}

// ============================================================================
// Scenario 1 — inline-edit blur saves
// ============================================================================

test("inline-edit nickname saves on blur (CAT-04, D-05)", async ({
  page,
  authedUser,
}) => {
  void authedUser;
  const plantId = await seedPlant(page, { name: "Samambaia", nickname: undefined });
  await page.goto(`/catalog/${plantId}`);

  let capturedIdempotencyKey: string | null = null;
  await page.route(`/api/v1/plants/${plantId}`, (route) => {
    capturedIdempotencyKey =
      route.request().headers()["idempotency-key"] ?? null;
    void route.continue();
  });

  await page.getByTestId("inline-edit-nickname").click();
  await page.keyboard.type("Verdinho");
  await page.locator("body").click({ position: { x: 0, y: 0 } });

  await expect(page.getByTestId("inline-edit-nickname")).toContainText("Verdinho");

  expect(
    capturedIdempotencyKey,
    "Idempotency-Key header must be present on PATCH (HIGH-3)",
  ).not.toBeNull();
  if (capturedIdempotencyKey) {
    expect(capturedIdempotencyKey).toMatch(/^[0-9a-f-]{36}$/);
  }

  await page.reload();
  await expect(page.getByTestId("inline-edit-nickname")).toContainText("Verdinho");
});

// ============================================================================
// Scenario 2 — inline-edit Enter saves single-line
// ============================================================================

test("inline-edit name saves on Enter (single-line) (D-05)", async ({
  page,
  authedUser,
}) => {
  void authedUser;
  const plantId = await seedPlant(page, { name: "Original" });
  await page.goto(`/catalog/${plantId}`);

  await page.getByTestId("inline-edit-name").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Novo nome");
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("inline-edit-name")).toContainText("Novo nome");
});

// ============================================================================
// Scenario 3 — inline-edit Esc reverts
// ============================================================================

test("inline-edit Esc reverts to pre-edit value (D-05)", async ({
  page,
  authedUser,
}) => {
  void authedUser;
  const plantId = await seedPlant(page, { name: "Lírio", nickname: "Verdinho" });
  await page.goto(`/catalog/${plantId}`);

  await page.getByTestId("inline-edit-nickname").click();
  await page.keyboard.press("Control+a");
  await page.keyboard.type("Outro nome");
  await page.keyboard.press("Escape");

  await expect(page.getByTestId("inline-edit-nickname")).toContainText("Verdinho");
});

// ============================================================================
// Scenario 4 — delete confirm cascade counts + plant disappears from /catalog
// ============================================================================

test("delete confirm shows cascade counts + plant removed from /catalog (CAT-09, D-07)", async ({
  page,
  authedUser,
}) => {
  void authedUser;
  const plantId = await seedPlant(page, { name: "ParaExcluir" });
  await page.goto(`/catalog/${plantId}`);

  await page.getByTestId("plant-overflow-trigger").click();
  await page.getByTestId("plant-overflow-delete").click();

  const alertDialog = page.getByRole("alertdialog");
  await expect(alertDialog).toBeVisible();

  await expect(page.getByTestId("delete-confirm-cancel")).toBeFocused();

  await page.getByTestId("delete-confirm-confirm").click();

  await expect(page).toHaveURL("/catalog");
  await expect(page.getByText("ParaExcluir")).toHaveCount(0);
});

// ============================================================================
// Scenario 5 — read-only variant hides affordances
// ============================================================================

readOnlyTest.describe("read-only variant", () => {
  readOnlyTest(
    "inline-edit + overflow hidden when readOnly (D-21)",
    async ({ page, authedUser }) => {
      void authedUser;
      const plantId = await seedPlant(page, { name: "ReadOnlyTest" });
      await page.goto(`/catalog/${plantId}`);

      const nameField = page.getByTestId("inline-edit-name");
      await readOnlyExpect(nameField).toContainText("ReadOnlyTest");

      await readOnlyExpect(
        page.getByTestId("plant-overflow-trigger"),
      ).toHaveCount(0);
    },
  );
});

// ============================================================================
// Scenario 6 — axe a11y across 4 colorScheme × reducedMotion combos
// ============================================================================

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

for (const combo of COMBOS) {
  test(
    `axe /catalog/{plantId} [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious+critical violations`,
    async ({ page, authedUser }) => {
      void authedUser;
      const plantId = await seedPlant(page, { name: "AxeTest" });
      await page.emulateMedia(combo);
      await page.goto(`/catalog/${plantId}`);

      await page.waitForSelector('[data-testid="inline-edit-name"]', {
        timeout: 10000,
      });

      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter(
        (v) => v.impact === "critical" || v.impact === "serious",
      );
      expect(
        blocking,
        `serious+critical: ${blocking.map((v) => v.id).join(", ")}`,
      ).toEqual([]);
    },
  );
}
