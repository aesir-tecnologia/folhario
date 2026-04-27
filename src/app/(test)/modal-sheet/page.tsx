import { notFound } from "next/navigation";

import { ModalSheetTestHarness } from "./harness";

/**
 * Test-only route for ModalSheet focus-trap verification.
 *
 * Phase 3 has no application surface that opens ModalSheet by default; the
 * primitive is consumed first by Phase 4 LGPD consent. Plan 05 needs to verify
 * the focus-trap contract NOW (UI-22), so this route mounts ModalSheet open
 * with several focusable children. Playwright spec navigates here and asserts
 * Tab cycling stays inside the Dialog + return-focus on close.
 *
 * HIGH 2 (codex review) + Open Risk #8 — Route group `(test)` does NOT hide
 * the URL; `/modal-sheet` is publicly reachable in production unless gated.
 * The block below calls notFound() in production unless the explicit opt-in
 * env var NEXT_PUBLIC_ENABLE_TEST_ROUTES=1 is set (Vercel preview env may set
 * it; production never does).
 *
 * IMPORTANT: cannot use `__test__` segment per Phase 1 D-21 / 01-07-SUMMARY —
 * Next App Router silently excludes underscore-prefixed segments. Use `(test)`
 * route group instead (parentheses-prefixed = grouped, not URL segment).
 */
export default function ModalSheetTestPage() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.NEXT_PUBLIC_ENABLE_TEST_ROUTES !== "1"
  ) {
    notFound();
  }
  return <ModalSheetTestHarness />;
}
