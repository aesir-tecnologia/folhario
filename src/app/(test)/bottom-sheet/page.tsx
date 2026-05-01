import { notFound } from "next/navigation";

import { BottomSheetTestHarness } from "./harness";

/**
 * Test-only route for BottomSheet focus-trap + a11y verification.
 *
 * Plan 05-13 ships <BottomSheet> as the primitive for Phase 5's two new sheet
 * surfaces (D-07 delete-confirm, D-15 photo-journal add). This route mounts
 * BottomSheet with role="alertdialog" and three focusable children so the
 * Playwright spec can assert Tab cycling, Esc + return-focus, drag-handle
 * Enter dismiss, and axe scans across 4 colorScheme×reducedMotion combos.
 *
 * HIGH 2 (codex review) + Open Risk #8 — Route group `(test)` does NOT hide
 * the URL; `/bottom-sheet` is publicly reachable in production unless gated.
 * The block below calls notFound() in production unless the explicit opt-in
 * env var ENABLE_TEST_ROUTES=1 is set (Vercel preview env may set it;
 * production never does). This var is server-only (no NEXT_PUBLIC_ prefix)
 * so its value never enters the client bundle. Mirrors the pattern established
 * in src/app/(test)/modal-sheet/page.tsx (Plan 03 D-25 / Phase 1 D-21).
 *
 * IMPORTANT: cannot use `__test__` segment per Phase 1 D-21 / 01-07-SUMMARY —
 * Next App Router silently excludes underscore-prefixed segments. Use `(test)`
 * route group instead (parentheses-prefixed = grouped, not URL segment).
 */
export default function BottomSheetTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <BottomSheetTestHarness />;
}
