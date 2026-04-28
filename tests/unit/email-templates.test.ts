// Phase 4 NOTIF-02 — React Email template snapshot/string tests.
//
// Each of the three templates (verification, password-reset, welcome-back)
// renders pt-BR HTML with the locked Paper Cream brand contract from
// UI-SPEC §7 + plain-text fallback per accessibility requirement.
import { render } from "@react-email/components";
import { describe, expect, it } from "vitest";

import { PasswordResetEmail } from "@contexts/notifications/infrastructure/email-templates/password-reset";
import { VerificationEmail } from "@contexts/notifications/infrastructure/email-templates/verification";
import { WelcomeBackEmail } from "@contexts/notifications/infrastructure/email-templates/welcome-back";

const VERIFICATION_URL = "https://test.app/auth/verify?token=abc";
const RESET_URL = "https://test.app/auth/reset?token=def";
const USER_EMAIL = "user@example.com";

async function renderVerification() {
  return render(VerificationEmail({ url: VERIFICATION_URL, userEmail: USER_EMAIL }));
}

async function renderPasswordReset() {
  return render(PasswordResetEmail({ url: RESET_URL, userEmail: USER_EMAIL }));
}

async function renderWelcomeBack() {
  return render(WelcomeBackEmail({ resetUrl: RESET_URL, userEmail: USER_EMAIL }));
}

describe("Phase 4 NOTIF-02 — verification email template", () => {
  it('renders <html lang="pt-BR">', async () => {
    const html = await renderVerification();
    expect(html).toMatch(/<html[^>]+lang="pt-BR"/);
  });

  it("contains the locked headline", async () => {
    const html = await renderVerification();
    expect(html).toContain("Confirme seu e-mail para começar");
  });

  it("contains the user's email", async () => {
    const html = await renderVerification();
    expect(html).toContain(USER_EMAIL);
  });

  it("contains the CTA URL", async () => {
    const html = await renderVerification();
    expect(html).toContain(VERIFICATION_URL);
  });

  it("includes color-scheme meta tags", async () => {
    const html = await renderVerification();
    expect(html).toMatch(/color-scheme[^>]*light dark/);
    expect(html).toMatch(/supported-color-schemes[^>]*light dark/);
  });

  it("includes a plain-text URL fallback", async () => {
    const html = await renderVerification();
    expect(html).toMatch(/copie e cole|copy and paste/i);
  });

  it("uses Paper Cream + Canopy hex values", async () => {
    const html = await renderVerification();
    expect(html).toContain("#FBF7EF");
    expect(html).toContain("#1F4D35");
  });
});

describe("Phase 4 NOTIF-02 — password-reset email template", () => {
  it('renders <html lang="pt-BR">', async () => {
    const html = await renderPasswordReset();
    expect(html).toMatch(/<html[^>]+lang="pt-BR"/);
  });

  it("contains the locked headline", async () => {
    const html = await renderPasswordReset();
    expect(html).toContain("Redefinir sua senha");
  });

  it("contains the user's email", async () => {
    const html = await renderPasswordReset();
    expect(html).toContain(USER_EMAIL);
  });

  it("contains the CTA URL", async () => {
    const html = await renderPasswordReset();
    expect(html).toContain(RESET_URL);
  });

  it("includes color-scheme meta tags", async () => {
    const html = await renderPasswordReset();
    expect(html).toMatch(/color-scheme[^>]*light dark/);
    expect(html).toMatch(/supported-color-schemes[^>]*light dark/);
  });

  it("includes a plain-text URL fallback", async () => {
    const html = await renderPasswordReset();
    expect(html).toMatch(/copie e cole|copy and paste/i);
  });

  it("uses Paper Cream + Canopy hex values", async () => {
    const html = await renderPasswordReset();
    expect(html).toContain("#FBF7EF");
    expect(html).toContain("#1F4D35");
  });
});

describe("Phase 4 NOTIF-02 — welcome-back email template (resolved Q1)", () => {
  it('renders <html lang="pt-BR">', async () => {
    const html = await renderWelcomeBack();
    expect(html).toMatch(/<html[^>]+lang="pt-BR"/);
  });

  it("contains the locked headline", async () => {
    const html = await renderWelcomeBack();
    expect(html).toContain("Você já tem uma conta no Folhário");
  });

  it("contains the user's email", async () => {
    const html = await renderWelcomeBack();
    expect(html).toContain(USER_EMAIL);
  });

  it("contains the CTA reset URL", async () => {
    const html = await renderWelcomeBack();
    expect(html).toContain(RESET_URL);
  });

  it("includes color-scheme meta tags", async () => {
    const html = await renderWelcomeBack();
    expect(html).toMatch(/color-scheme[^>]*light dark/);
    expect(html).toMatch(/supported-color-schemes[^>]*light dark/);
  });

  it("includes a plain-text URL fallback", async () => {
    const html = await renderWelcomeBack();
    expect(html).toMatch(/copie e cole|copy and paste/i);
  });

  it("uses Paper Cream + Canopy hex values", async () => {
    const html = await renderWelcomeBack();
    expect(html).toContain("#FBF7EF");
    expect(html).toContain("#1F4D35");
  });

  it("explicitly states the recipient already has an account", async () => {
    const html = await renderWelcomeBack();
    expect(html).toContain("você já tem uma conta");
  });
});
