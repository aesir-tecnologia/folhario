// Phase 4 INFRA-10: Inngest serve handler topology test (Plan 04 baseline = 8;
// Plan 05 grows to 9 = 8 PRD §3 MVP + 1 Phase-4 anti-enumeration add per D-11).
//
// Test surface (per plan 04-04 Task 3):
//   1. /api/inngest exports GET/POST/PUT (Next.js App Router serve handler).
//   2. registry contains exactly 8 functions at Plan 04 commit time.
//   3. every registered function has a unique id.
//   4. expected 8 ids are exactly present (Codex MEDIUM topology fix +
//      D-11 anti-enumeration add).
//   5. notifications-send-push lives under notifications context (NOT reminders).
//   6. iam-password-reset-requested lives under iam context per D-11.
import { describe, it, expect } from "vitest";

process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";
process.env.RESEND_FROM_ADDRESS ??= "onboarding@resend.dev";

describe("Phase 4 INFRA-10 — Inngest serve handler topology (Plan 04 baseline = 8; Plan 05 grows to 9 = 8 PRD §3 MVP + 1 Phase-4 anti-enumeration add per D-11)", () => {
  it("/api/inngest exports GET, POST, PUT handlers", async () => {
    const mod = await import("../../src/app/api/inngest/route");
    expect(typeof mod.GET).toBe("function");
    expect(typeof mod.POST).toBe("function");
    expect(typeof mod.PUT).toBe("function");
  });

  it("registry contains 8 functions in Plan 04 (Plan 05 will grow to exactly 9 = 8 PRD §3 MVP + 1 Phase-4 anti-enumeration add per D-11)", async () => {
    const { registry } = await import("../../src/shared/inngest/registry");
    expect(registry).toHaveLength(8);
  });

  it("every registered function has a unique id", async () => {
    const { registry } = await import("../../src/shared/inngest/registry");
    const ids = registry.map((f) => f.id());
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("registry contains expected 8 function ids in Plan 04 (Codex MEDIUM topology fix + D-11 anti-enumeration add)", async () => {
    const { registry } = await import("../../src/shared/inngest/registry");
    const ids = registry.map((f) => f.id()).sort();
    expect(ids).toEqual([
      "billing-process-webhook",
      "billing-trial-ending-notifier",
      "care-guide-augment",
      "iam-generate-export",
      "iam-password-reset-requested",
      "iam-process-deletion",
      "notifications-send-push",
      "reminders-dispatch",
    ]);
  });

  it("notifications-send-push lives under the notifications context (Codex MEDIUM fix — NOT reminders)", async () => {
    const { notificationsFunctions } = await import(
      "../../src/contexts/notifications/inngest/functions"
    );
    const ids = notificationsFunctions.map((f) => f.id());
    expect(ids).toContain("notifications-send-push");

    const { remindersFunctions } = await import(
      "../../src/contexts/reminders/inngest/functions"
    );
    const reminderIds = remindersFunctions.map((f) => f.id());
    expect(reminderIds).not.toContain("notifications-send-push");
    expect(reminderIds).toEqual(["reminders-dispatch"]);
  });

  it("iam-password-reset-requested lives under the iam context per D-11 anti-enumeration mandate", async () => {
    const { iamFunctions } = await import(
      "../../src/contexts/iam/inngest/functions"
    );
    const ids = iamFunctions.map((f) => f.id());
    expect(ids).toContain("iam-password-reset-requested");
  });
});
