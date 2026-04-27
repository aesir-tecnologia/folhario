import { test, expect } from "@playwright/test";

test("UI-22 — ModalSheet focus trap cycles inside Dialog and returns focus to invoker on close", async ({
  page,
}) => {
  // Plan 03 Task 6 ships a test-only route at /modal-sheet (under the (test)
  // route group, so it does not appear in the user-facing nav). The harness
  // autofocuses the invoker on mount and starts with the dialog CLOSED — we
  // click the invoker to open it so Radix can snapshot the invoker as the
  // "previously focused element" and return focus to it on close.
  await page.goto("/modal-sheet");
  await page.getByTestId("modal-invoker").click();

  // Wait for Dialog to mount + Radix focus-trap initial focus.
  await page.waitForSelector('[role="dialog"]');

  // Capture the initially focused element inside the Dialog.
  const initiallyFocused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return {
      testid: el?.getAttribute("data-testid") ?? null,
      tag: el?.tagName.toLowerCase() ?? null,
      insideDialog: el ? !!el.closest('[role="dialog"]') : false,
    };
  });
  expect(initiallyFocused.insideDialog).toBe(true);

  // Tab through the focusable children — Radix Dialog default focus trap
  // ensures focus stays inside the Dialog (does not escape to <body>).
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const stillInside = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el ? !!el.closest('[role="dialog"]') : false;
    });
    expect(stillInside, `Focus escaped Dialog after Tab #${i + 1}`).toBe(true);
  }

  // Close the Dialog via Escape (Radix default).
  await page.keyboard.press("Escape");
  await page.waitForSelector('[role="dialog"]', { state: "detached" });

  // Allow Radix return-focus to fire.
  await page.waitForTimeout(100);

  // Focus must return to the invoker button — data-testid="modal-invoker".
  const returnedToInvoker = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return el?.getAttribute("data-testid") === "modal-invoker";
  });
  expect(returnedToInvoker).toBe(true);
});
