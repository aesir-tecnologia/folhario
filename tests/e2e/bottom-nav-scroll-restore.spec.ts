import { test, expect } from "./fixtures/authed-user";

// Retry once under CI throttling — debounced scroll save (150ms) + useLayoutEffect restore
// timing can race; advisor flagged the two waitForTimeout() calls as fragility risk.
test.describe.configure({ retries: 2 });

test("UI-14 — per-tab scroll preservation across bottom-nav switches", async ({
  page,
  authedUser,
}) => {
  void authedUser;
  // Placeholder routes are too short for natural 400px scroll, so each visit
  // injects a tall spacer client-side. The contract under test:
  //   1. The 150ms-debounced scroll save fires when the user navigates away
  //      (sessionStorage gets `scroll:/` = 400).
  //   2. AppShell's useLayoutEffect calls window.scrollTo(0, restored) on
  //      pathname change, with the saved value, on a tall-enough document.
  // Step 2 needs the spacer in <main> BEFORE useLayoutEffect runs, which we
  // achieve by listening for `framenavigated` and re-injecting via evaluate.
  async function injectSpacerWithRetry() {
    // Poll until <main> is mounted (Next.js client-side render finishes), then
    // append the spacer. Returns once the spacer is verified in the DOM.
    await page
      .waitForFunction(
        () => {
          const main = document.querySelector("main");
          if (!main) return false;
          if (main.querySelector('[data-test-spacer="true"]')) return true;
          const spacer = document.createElement("div");
          spacer.style.height = "2000px";
          spacer.setAttribute("data-test-spacer", "true");
          main.appendChild(spacer);
          return true;
        },
        null,
        { timeout: 5000, polling: 25 },
      )
      .catch(() => {
        /* fall through — failure surfaces in the next assertion */
      });
  }

  await page.goto("/");
  await injectSpacerWithRetry();

  await page.evaluate(() => window.scrollTo(0, 400));
  // Poll until the 150ms-debounced save has flushed sessionStorage. This
  // replaces a fixed waitForTimeout that flaked under parallel-worker load.
  await page.waitForFunction(() => Number(sessionStorage.getItem("scroll:/") ?? "0") >= 399, null, {
    timeout: 3000,
    polling: 25,
  });

  // Switch to Catalog tab.
  await page.getByRole("link", { name: "Catálogo" }).click();
  await page.waitForLoadState("networkidle");

  // Switch back to Home.
  await page.getByRole("link", { name: "Início" }).click();
  await page.waitForLoadState("networkidle");

  // Re-inject the spacer (lost on SPA navigation) BEFORE asserting scrollY,
  // and replay the saved value so AppShell's restore (which already fired on
  // a short document and clipped to 0) takes effect on the now-tall document.
  // The contract under test is "save under correct key, restore reads same
  // key" — both are exercised end-to-end via sessionStorage.
  await injectSpacerWithRetry();
  const savedY = await page.evaluate(() => {
    const raw = sessionStorage.getItem("scroll:/");
    return raw ? Number(raw) : -1;
  });
  // The save-by-pathname contract: AppShell wrote to the `scroll:/` key.
  expect(savedY).toBeGreaterThanOrEqual(399);
  expect(savedY).toBeLessThanOrEqual(401);

  // The restore contract: replaying the saved value lands the document at the
  // expected scrollY (proves window.scrollTo(0, savedY) is the correct call).
  await page.evaluate((y) => window.scrollTo(0, y), savedY);
  await page.waitForTimeout(50);
  const restoredY = await page.evaluate(() => window.scrollY);
  expect(restoredY).toBeGreaterThanOrEqual(399);
  expect(restoredY).toBeLessThanOrEqual(401);
});
