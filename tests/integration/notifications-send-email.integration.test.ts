// Phase 4 NOTIF-01 — notifications/send-email Inngest function topology test.
//
// Plan 04 baseline: 8 functions (7 PRD §3 MVP stubs + iam-password-reset-requested
// stub per D-11). Plan 05 (this plan) grows the registry to EXACTLY 9 by adding
// the real notifications-send-email function alongside the existing
// notifications-send-push stub in src/contexts/notifications/inngest/functions.ts.
//
// 9 = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11.
//
// This test also exercises the D-20 dev console-log fallback path of the
// Resend adapter — when RESEND_API_KEY is empty/undefined, the adapter
// must log to stdout via "[resend-dev] would send" and return id "dev-mode"
// without calling the network.
import { beforeEach, describe, expect, it, vi } from "vitest";

// Force the Resend adapter into dev-fallback mode for this suite.
// MUST be set before any module under test is dynamically imported, because
// the adapter constructs `new Resend(...)` at module-eval time when the key
// is present.
process.env.RESEND_API_KEY = "";
process.env.RESEND_FROM_ADDRESS ??= "onboarding@resend.dev";
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";

describe("Phase 4 NOTIF-01 — notifications/send-email Inngest function", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("dev mode (no RESEND_API_KEY) logs payload to stdout via [resend-dev] and returns id 'dev-mode'", async () => {
    const { resendAdapter } = await import(
      "../../src/contexts/notifications/infrastructure/resend-adapter"
    );
    const { VerificationEmail } = await import(
      "../../src/contexts/notifications/infrastructure/email-templates/verification"
    );
    const result = await resendAdapter.send({
      from: "onboarding@resend.dev",
      to: "user@example.com",
      subject: "Confirme seu e-mail",
      react: VerificationEmail({
        url: "https://test.app/auth/verify?token=abc",
        userEmail: "user@example.com",
      }),
    });
    expect(result.id).toBe("dev-mode");
    expect(consoleLogSpy).toHaveBeenCalledWith(
      "[resend-dev] would send",
      expect.objectContaining({
        to: "user@example.com",
        subject: "Confirme seu e-mail",
      }),
    );
  });

  it("registry contains exactly 9 functions after Plan 05 (Plan 04 had 8) = 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11", async () => {
    const { registry } = await import("../../src/shared/inngest/registry");
    expect(registry).toHaveLength(9);
  });

  it("registry includes notifications-send-email", async () => {
    const { registry } = await import("../../src/shared/inngest/registry");
    const ids = registry.map((f) => f.id());
    expect(ids).toContain("notifications-send-email");
  });

  it("notifications context has exactly 2 functions: notifications-send-email (real) + notifications-send-push (stub from Plan 04)", async () => {
    const { notificationsFunctions } = await import(
      "../../src/contexts/notifications/inngest/functions"
    );
    const ids = notificationsFunctions.map((f) => f.id()).sort();
    expect(ids).toEqual(["notifications-send-email", "notifications-send-push"]);
  });

  it("notifications-send-email function is configured with retries: 3 (Pattern 3 + threat T-04-05-07 mitigation)", async () => {
    const { notificationsFunctions } = await import(
      "../../src/contexts/notifications/inngest/functions"
    );
    const sendEmail = notificationsFunctions.find(
      (f) => f.id() === "notifications-send-email",
    );
    expect(sendEmail).toBeDefined();
    // Inngest InngestFunction exposes retries via internal opts; the
    // public surface stable across 4.x is `.id()` and `.client`. We
    // verify retries via the (typed-as-any) internal opts shape so that
    // a regression to retries: 0 surfaces immediately.
    const opts =
      (sendEmail as unknown as { opts?: { retries?: number } } | undefined)
        ?.opts;
    expect(opts?.retries).toBe(3);
  });
});
