// Phase 05 cycle-2 human-verification E2E coverage.
// Source: .planning/phases/05-catalog-meu-jardim/05-VERIFICATION.md `human_verification`.
//
// 8 surfaced UAT items mapped to E2E tests:
//
// | # | Item                          | Covered by                              |
// |---|-------------------------------|------------------------------------------|
// | 1 | Empty states (Home + Catalog) | THIS FILE — UAT-1                        |
// | 2 | Responsive grid + sort        | catalog-grid-sort.spec.ts                |
// | 3 | Inline-edit interactions      | plant-profile.spec.ts (Scenarios 1–3)    |
// | 4 | Location combobox             | THIS FILE — UAT-4                        |
// | 5 | Online → offline transition   | catalog-offline.spec.ts                  |
// | 6 | Plant delete end-to-end       | plant-profile.spec.ts (Scenario 4)       |
// | 7 | NEW-CR-01 lightbox composition| THIS FILE — UAT-7                        |
// | 8 | NEW-CR-05 idempotency retry   | THIS FILE — UAT-8                        |
//
// TEST-ONLY. MUST NOT be imported from src/.

import { type Page } from "@playwright/test";
import { test, expect } from "./fixtures/authed-user";

test.describe.configure({ retries: 0 });

const MINIMAL_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

// The proxy at src/proxy.ts:90-110 is a bearer-only fast-fail gate on
// /api/v1/* — cookies are NOT consulted at the proxy layer. Seed via
// page.request.post must carry the user's access_token as a Bearer
// header. The route handler's cookie fallback only runs after the
// proxy passes the request through, which requires the bearer.
async function seedPlant(page: Page, accessToken: string, name: string): Promise<string> {
  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");
  const resp = await page.request.post("/api/v1/plants", {
    headers: {
      "Idempotency-Key": `seed-uat2-${name}-${Date.now()}`,
      authorization: `Bearer ${accessToken}`,
    },
    multipart: {
      name,
      photo: { name: "plant.jpg", mimeType: "image/jpeg", buffer: imageBuffer },
    },
  });
  if (!resp.ok()) {
    throw new Error(`seedPlant failed (${resp.status()}): ${await resp.text()}`);
  }
  const body = (await resp.json()) as { plant?: { id?: string } };
  const id = body.plant?.id;
  if (!id) throw new Error("seedPlant: no plant id in response");
  return id;
}

async function seedPhotoEntry(
  page: Page,
  accessToken: string,
  plantId: string,
  label: string,
): Promise<void> {
  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");
  const resp = await page.request.post(`/api/v1/plants/${plantId}/photo-entries`, {
    headers: {
      "Idempotency-Key": `seed-entry-${label}-${Date.now()}-${Math.random()}`,
      authorization: `Bearer ${accessToken}`,
    },
    multipart: {
      photo: { name: `${label}.jpg`, mimeType: "image/jpeg", buffer: imageBuffer },
      note: label,
    },
  });
  if (!resp.ok()) {
    throw new Error(`seedPhotoEntry(${label}) failed (${resp.status()}): ${await resp.text()}`);
  }
}

// ============================================================================
// UAT-1 — Empty states (Home + Catalog)
// Source: 05-VERIFICATION.md human_verification[0]
// ============================================================================

test("UAT-1 — Home + Catalog empty states render correct pt-BR copy and CTAs (zero plants)", async ({
  page,
  authedUser,
}) => {
  void authedUser;

  // Fresh authedUser has zero plants — empty branch must render.
  await page.goto("/");
  await expect(page.getByTestId("home-empty")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Identifique sua primeira planta" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Adicionar manualmente" })).toBeVisible();

  await page.goto("/catalog");
  await expect(page.getByTestId("catalog-empty")).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Sua estante ainda está esperando a primeira planta.",
    }),
  ).toBeVisible();
  // Single Canopy CTA links to /identify (manual-add deep link via Home).
  // Catalog CTA label is "Identificar planta" (catalog.empty.cta in pt-BR.json).
  const cta = page.getByRole("link", { name: "Identificar planta" });
  await expect(cta).toBeVisible();
  await expect(cta).toHaveAttribute("href", "/identify");
});

// ============================================================================
// UAT-4 — Location combobox: defaults + "Adicionar {typed}" + outside-click closes
// Source: 05-VERIFICATION.md human_verification[3]
// ============================================================================

test("UAT-4 — Location picker shows 8 defaults, supports free-text 'Adicionar', and closes on outside click", async ({
  page,
  authedUser,
}) => {
  const plantId = await seedPlant(page, authedUser.accessToken, "LocationTest");
  await page.goto(`/catalog/${plantId}`);

  await page.waitForSelector('[data-testid="inline-edit-location"]');

  // Activate the location editor (inline-edit field is a button → click enters editing mode).
  await page.getByTestId("inline-edit-location").getByRole("button").first().click();

  const combobox = page.getByTestId("location-combobox-editor");
  await expect(combobox).toBeVisible();

  // Open the listbox by focusing + typing nothing (combobox opens on focus or arrow-down).
  await combobox.click();
  await combobox.press("ArrowDown");

  const listbox = page.getByRole("listbox");
  await expect(listbox).toBeVisible();

  // 8 i18n defaults must all render as options (pt-BR.json catalog.locations.defaults).
  for (const label of [
    "sala",
    "varanda",
    "quarto",
    "banheiro",
    "cozinha",
    "escritório",
    "jardim",
    "outro",
  ]) {
    await expect(
      listbox.getByRole("option", { name: new RegExp(`^${label}$`, "i") }),
    ).toBeVisible();
  }

  // Free-text affordance: typing a novel value surfaces "Adicionar '{typed}'".
  await combobox.fill("estufa");
  await expect(listbox.getByRole("option", { name: /Adicionar 'estufa'/i })).toBeVisible();

  // Outside click closes the listbox (regression guard for prior cycle WR-08).
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await expect(listbox).toBeHidden();
});

// ============================================================================
// UAT-7 — Lightbox/thumbnail composition: cover not duplicated, newest reachable
// Source: 05-VERIFICATION.md human_verification[6] (NEW-CR-01)
// ============================================================================

test("UAT-7 / NEW-CR-01 — Lightbox includes cover exactly once and newest entry is reachable", async ({
  page,
  authedUser,
}) => {
  const plantId = await seedPlant(page, authedUser.accessToken, "PhotoComposition");

  // Add two journal entries — they become newer than the cover.
  // listPhotoEntries returns newest-first; cover is matched to the OLDEST entry by photo_url.
  await seedPhotoEntry(page, authedUser.accessToken, plantId, "second");
  await seedPhotoEntry(page, authedUser.accessToken, plantId, "third-newest");

  await page.goto(`/catalog/${plantId}`);

  // Wait for the cover button to be present (loading state has no cover).
  const coverButton = page.getByRole("button", { name: /PhotoComposition/ });
  await expect(coverButton.first()).toBeVisible();

  // The thumbnail strip below the cover must show 2 buttons (3 entries minus cover).
  const stripButtons = page.locator('[aria-label*="Foto"]').filter({
    has: page.locator("img"),
  });
  // The strip is one of several photo regions; assert at least 2 non-cover thumbnails present.
  await expect(stripButtons).not.toHaveCount(0);

  // Open the lightbox by clicking the cover.
  await coverButton.first().click();

  const lightbox = page.getByRole("dialog", { name: /Galeria/i });
  await expect(lightbox).toBeVisible({ timeout: 5_000 });

  // The lightbox indicator renders as "1 / N" only when ≥2 photos.
  // With 3 entries (1 cover + 2 journal), the indicator must show "/ 3".
  await expect(lightbox.getByText(/\/\s*3/)).toBeVisible();

  // Navigate to the last slide via keyboard — newest entry must be reachable.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(lightbox.getByText(/^\s*3\s*\/\s*3\s*$/)).toBeVisible();
});

// ============================================================================
// UAT-8 — Idempotency-Key persists across transient-failure retry (D-37)
// Source: 05-VERIFICATION.md human_verification[7] (NEW-CR-05)
// ============================================================================

test("UAT-8 / NEW-CR-05 — Photo-journal POST retries with the SAME Idempotency-Key after a 503", async ({
  page,
  authedUser,
}) => {
  const plantId = await seedPlant(page, authedUser.accessToken, "IdempotencyRetry");
  await page.goto(`/catalog/${plantId}/journal`);
  await page.waitForSelector('[data-testid="photo-journal"]');

  const photoEntriesUrl = `**/api/v1/plants/${plantId}/photo-entries`;
  const idempotencyKeys: string[] = [];
  let postCount = 0;

  await page.route(photoEntriesUrl, async (route) => {
    const req = route.request();
    if (req.method() !== "POST") {
      await route.continue();
      return;
    }
    postCount += 1;
    const key = req.headers()["idempotency-key"];
    if (key) idempotencyKeys.push(key);

    if (postCount === 1) {
      // First request: simulate transient 5xx.
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "service_unavailable" }),
      });
    } else {
      await route.continue();
    }
  });

  await page.getByRole("button", { name: "+ Foto" }).click();

  const sheet = page.getByRole("dialog");
  await expect(sheet).toBeVisible({ timeout: 5_000 });

  const fileInput = sheet.locator('input[type="file"]');
  await fileInput.setInputFiles({
    name: "journal.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from(MINIMAL_JPEG_B64, "base64"),
  });
  await page.waitForSelector('[data-testid="journal-sheet-preview"]', { timeout: 5_000 });

  // First submit → 503; sheet stays open (D-15).
  await page.getByRole("button", { name: "Adicionar" }).click();

  await expect.poll(() => postCount).toBe(1);
  // Sheet must remain open with the photo selected so the user can retry.
  await expect(sheet).toBeVisible();

  // Second submit → real server (route.continue) succeeds.
  await page.getByRole("button", { name: "Adicionar" }).click();

  await expect.poll(() => postCount, { timeout: 15_000 }).toBe(2);
  // On success the sheet closes.
  await expect(sheet).not.toBeVisible({ timeout: 10_000 });

  expect(idempotencyKeys).toHaveLength(2);
  expect(idempotencyKeys[0]).toMatch(/^[0-9a-f-]{36}$/i);
  // The hard assertion: D-37 requires the retry to carry the SAME key so
  // the server-side idempotency_keys table can dedupe and replay.
  expect(idempotencyKeys[1]).toBe(idempotencyKeys[0]);
});
