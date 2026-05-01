import { notFound } from "next/navigation";

import { ComboboxTestHarness } from "./harness";

/**
 * Test-only route for Combobox + LocationCombobox a11y verification.
 *
 * Mounts both primitives with seeded data so axe-core can scan all
 * ARIA states. Production-guarded via the same ENABLE_TEST_ROUTES
 * pattern as (test)/modal-sheet (Phase 3 / 05-12 precedent).
 */
export default function ComboboxTestPage() {
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_TEST_ROUTES !== "1") {
    notFound();
  }
  return <ComboboxTestHarness />;
}
