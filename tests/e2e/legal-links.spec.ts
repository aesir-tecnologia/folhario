// Phase 4 plan 04-10 Task 3 — Codex MEDIUM consent UX fix.
//
// Asserts that:
//   1. GET /auth/signup renders BOTH T&C and Privacy hyperlinks bound to
//      /legal/terms and /legal/privacy with the active policy_version
//      visible in the link label (e.g., "Termos de uso (v1.0)").
//   2. Clicking the /legal/terms link lands on a page containing the
//      "Em construção" copy and the version label.

import { test, expect } from "@playwright/test";

test("signup form renders T&C + Privacy hyperlinks with active policy_version", async ({
  page,
}) => {
  await page.goto("/auth/signup");

  // The signup form ships in (public)/auth/signup/page.tsx and renders
  // SignupForm with policyVersion={getCurrentPolicyVersions().tos.version}.
  // The seeded policy version in dev is "1.0" (per the policy-versions
  // fixture from Plan 02 / 04-06).
  const termsLink = page.locator('a[href="/legal/terms"]');
  const privacyLink = page.locator('a[href="/legal/privacy"]');

  await expect(termsLink).toBeVisible();
  await expect(privacyLink).toBeVisible();

  // The link text contains the version label per UI-SPEC §"Copywriting
  // Contract" + Codex MEDIUM consent UX fix. The version string is opaque
  // (CalVer like "2026-04-25.1" or SemVer like "1.0") — the assertion
  // only verifies the "(v...)" wrapper is present.
  await expect(termsLink).toContainText(/Termos de uso \(v[\w.-]+\)/);
  await expect(privacyLink).toContainText(/Política de Privacidade \(v[\w.-]+\)/);
});

test("legal/terms renders Em construção copy + version label", async ({ page }) => {
  await page.goto("/legal/terms");
  await expect(
    page.getByRole("heading", { name: "Termos de uso" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Em construção\.\s*Versão atual: v[\w.-]+/),
  ).toBeVisible();
});

test("legal/privacy renders Em construção copy + version label", async ({ page }) => {
  await page.goto("/legal/privacy");
  await expect(
    page.getByRole("heading", { name: "Política de Privacidade" }),
  ).toBeVisible();
  await expect(
    page.getByText(/Em construção\.\s*Versão atual: v[\w.-]+/),
  ).toBeVisible();
});
