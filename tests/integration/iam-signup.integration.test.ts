// Phase 4 plan 06 — signup orchestration integration test.
//
// Covers:
//   - happy path: 5 rows present (auth.users + public.users + 2 ConsentLog
//     + Subscription + 1 verification token)
//   - already-registered branch: returns {kind:"already_registered"}
//   - D-32 partner_code: active code → trial_source='partner' + 30 days;
//     inactive/absent → invalid_partner_code; empty → organic + 14 days
//   - atomic transaction with compensating delete: removing the seeded
//     policy versions before the call forces tx-throw which triggers
//     authAdapter.adminDeleteUser → no orphan auth.users row remains
//
// Codex HIGH #2 verified: db.transaction is the call site (signup.ts).
// Codex HIGH #3 verified: only authAdapter touches supabase.auth.* (signup.ts
// has zero direct supabase.auth.* calls — checked by grep in plan acceptance).

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import { seedCurrentPolicyVersions } from "./fixtures/seed-policy-version";
import {
  seedActivePartnerCode,
  seedInactivePartnerCode,
} from "./fixtures/seed-partner-code";
import { inngestSendMock, installInngestMock, resetInngestMock } from "./fixtures/mock-inngest";

installInngestMock();

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

describe.skipIf(!dbUrl)("Phase 4 plan 06 — signupUser (D-25 + Codex HIGH #2/#3 + D-32)", () => {
  let signupModule: typeof import("@contexts/iam/application/signup");

  beforeAll(async () => {
    // Idempotent: upsert is_current=true on the seeded T&C + Privacy rows.
    // Uses a beforeAll instead of beforeEach so concurrent test files don't
    // wipe each other's data mid-test. Each test below uses a unique random
    // uuid email to stay row-isolated from concurrent tests.
    await seedCurrentPolicyVersions();
    // Lazy import so installInngestMock() above wins before signup imports inngest.
    signupModule = await import("@contexts/iam/application/signup");
  });

  beforeEach(() => {
    resetInngestMock();
  });

  afterAll(async () => {
    if (cleanupSql) await cleanupSql.end({ timeout: 5 });
  });

  function fixedSignupInput(overrides: Partial<{ email: string; partner_code: string }> = {}) {
    const email = overrides.email ?? `signup-${randomUUID()}@test.local`;
    const base = {
      email,
      password: "SuperSecret123!",
      age_confirmed: true as const,
      terms_accepted: true as const,
      privacy_accepted: true as const,
      timezone: "America/Sao_Paulo",
    };
    if (overrides.partner_code !== undefined) {
      return { ...base, partner_code: overrides.partner_code };
    }
    return base;
  }

  const requestUrl = new URL("http://localhost:3000/api/v1/iam/signup");

  it("happy path: writes 5 row groups + emits verification Inngest event (organic, 14-day trial)", async () => {
    const input = fixedSignupInput();
    const result = await signupModule.signupUser(input, requestUrl);

    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;

    // 1. auth.users
    const authRows = await cleanupSql!<{ id: string }[]>`
      SELECT id FROM auth.users WHERE email = ${input.email}`;
    expect(authRows).toHaveLength(1);

    // 2. public.users
    const userRows = await cleanupSql!<{ id: string; trial_source: string; partner_code: string | null; email_verified_at: string | null }[]>`
      SELECT id, trial_source, partner_code, email_verified_at FROM public.users WHERE email = ${input.email}`;
    expect(userRows).toHaveLength(1);
    expect(userRows[0]!.trial_source).toBe("organic");
    expect(userRows[0]!.partner_code).toBeNull();
    expect(userRows[0]!.email_verified_at).toBeNull();

    // 3. 2 consent_logs rows with purpose='signup_acceptance', source='signup'
    const consentRows = await cleanupSql!<{ purpose: string; source: string; legal_basis: string }[]>`
      SELECT purpose, source, legal_basis
        FROM public.consent_logs WHERE user_id = ${result.userId}
        ORDER BY created_at`;
    expect(consentRows).toHaveLength(2);
    expect(consentRows.every((r) => r.purpose === "signup_acceptance")).toBe(true);
    expect(consentRows.every((r) => r.source === "signup")).toBe(true);
    expect(consentRows.every((r) => r.legal_basis === "contract")).toBe(true);

    // 4. subscription with status='trialing' and ~14-day trial window
    const subRows = await cleanupSql!<{ status: string; trial_start_date: string; trial_end_date: string }[]>`
      SELECT status, trial_start_date, trial_end_date
        FROM public.subscriptions WHERE user_id = ${result.userId}`;
    expect(subRows).toHaveLength(1);
    expect(subRows[0]!.status).toBe("trialing");
    const trialMs =
      new Date(subRows[0]!.trial_end_date).getTime() -
      new Date(subRows[0]!.trial_start_date).getTime();
    expect(trialMs).toBeGreaterThan(13.5 * 24 * 60 * 60 * 1000);
    expect(trialMs).toBeLessThan(14.5 * 24 * 60 * 60 * 1000);

    // 5. verification token (unconsumed)
    const tokenRows = await cleanupSql!<{ id: string; consumed_at: string | null }[]>`
      SELECT id, consumed_at FROM public.email_verification_tokens
       WHERE user_id = ${result.userId} AND consumed_at IS NULL`;
    expect(tokenRows).toHaveLength(1);

    // Inngest event emitted with id pattern email-verification/{tokenId}
    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    const call = inngestSendMock.mock.calls[0]![0] as { id: string; name: string; data: { template: string } };
    expect(call.id).toBe(`email-verification/${tokenRows[0]!.id}`);
    expect(call.name).toBe("notifications/email.requested");
    expect(call.data.template).toBe("verification");

    // verificationUrl points at /auth/verify
    expect(result.verificationUrl).toMatch(/\/auth\/verify\?token=[a-f0-9]{64}$/);
  });

  it("already-registered email returns {kind:'already_registered'} without creating new auth user", async () => {
    const email = `dup-${randomUUID()}@test.local`;

    // First signup
    const firstResult = await signupModule.signupUser(fixedSignupInput({ email }), requestUrl);
    expect(firstResult.kind).toBe("created");

    resetInngestMock();

    // Second signup with the same email
    const secondResult = await signupModule.signupUser(
      { ...fixedSignupInput({ email }), email },
      requestUrl,
    );
    expect(secondResult.kind).toBe("already_registered");
    if (secondResult.kind !== "already_registered") return;
    expect(secondResult.resetUrl).toMatch(/\/auth\/forgot-password$/);

    // No second auth.users row.
    const authRows = await cleanupSql!`SELECT id FROM auth.users WHERE email = ${email}`;
    expect(authRows).toHaveLength(1);
    // No new Inngest event emitted by the use-case (route handler emits welcome-back).
    expect(inngestSendMock).not.toHaveBeenCalled();
  });

  it("D-32 active partner_code → trial_source='partner' + ~30-day trial", async () => {
    const code = `PARTNER-${randomUUID().slice(0, 8).toUpperCase()}`;
    await seedActivePartnerCode(code);
    const input = fixedSignupInput({ partner_code: code });
    const result = await signupModule.signupUser(input, requestUrl);
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;

    const userRows = await cleanupSql!<{ trial_source: string; partner_code: string | null }[]>`
      SELECT trial_source, partner_code FROM public.users WHERE id = ${result.userId}`;
    expect(userRows[0]!.trial_source).toBe("partner");
    expect(userRows[0]!.partner_code).toBe(code);

    const subRows = await cleanupSql!<{ trial_start_date: string; trial_end_date: string }[]>`
      SELECT trial_start_date, trial_end_date FROM public.subscriptions WHERE user_id = ${result.userId}`;
    const trialMs =
      new Date(subRows[0]!.trial_end_date).getTime() -
      new Date(subRows[0]!.trial_start_date).getTime();
    expect(trialMs).toBeGreaterThan(29.5 * 24 * 60 * 60 * 1000);
    expect(trialMs).toBeLessThan(30.5 * 24 * 60 * 60 * 1000);
  });

  it("D-32 inactive partner_code → invalid_partner_code (no auth.users created)", async () => {
    const code = `INACTIVE-${randomUUID().slice(0, 8).toUpperCase()}`;
    await seedInactivePartnerCode(code);
    const input = fixedSignupInput({ partner_code: code });
    const result = await signupModule.signupUser(input, requestUrl);
    expect(result.kind).toBe("invalid_partner_code");

    // No auth.users row created.
    const authRows = await cleanupSql!`SELECT id FROM auth.users WHERE email = ${input.email}`;
    expect(authRows).toHaveLength(0);
  });

  it("D-32 absent partner_code → invalid_partner_code (no auth.users created)", async () => {
    const input = fixedSignupInput({ partner_code: "DOES-NOT-EXIST" });
    const result = await signupModule.signupUser(input, requestUrl);
    expect(result.kind).toBe("invalid_partner_code");
  });

  it("D-32 empty partner_code → organic + 14-day trial (treated as no code)", async () => {
    const input = fixedSignupInput({ partner_code: "" });
    const result = await signupModule.signupUser(input, requestUrl);
    expect(result.kind).toBe("created");
    if (result.kind !== "created") return;
    const userRows = await cleanupSql!<{ trial_source: string }[]>`
      SELECT trial_source FROM public.users WHERE id = ${result.userId}`;
    expect(userRows[0]!.trial_source).toBe("organic");
  });

  it("atomic transaction: missing policy version mid-tx triggers compensating delete", async () => {
    // Force getCurrentPolicyVersions(tx) → null so the tx throws inside the
    // d.transaction(...) → catch block invokes authAdapter.adminDeleteUser.
    // Using vi.spyOn instead of wiping the shared policy_versions table so
    // this test plays nicely with concurrent test files.
    const policyVersionsMod = await import(
      "@contexts/iam/infrastructure/db/policy-versions"
    );
    const spy = vi
      .spyOn(policyVersionsMod, "getCurrentPolicyVersions")
      .mockResolvedValueOnce(null);

    const input = fixedSignupInput();
    await expect(signupModule.signupUser(input, requestUrl)).rejects.toThrow(
      /missing is_current=true policy_versions/,
    );

    // No auth.users row remains (compensating delete worked).
    const authRows = await cleanupSql!`SELECT id FROM auth.users WHERE email = ${input.email}`;
    expect(authRows).toHaveLength(0);
    // Phase 2 D-35 trigger pre-inserts a public.users row when authAdapter.createUser
    // runs; there is no FK from public.users → auth.users, so the
    // compensating adminDeleteUser leaves the public.users row in place. This is
    // the documented Pitfall 3 safety-net behavior. What matters here is the
    // ABSENCE of the side-effect rows from inside the tx (consent_logs,
    // subscription, verification token).
    const consentRows = await cleanupSql!`SELECT cl.id FROM public.consent_logs cl
       JOIN public.users u ON u.id = cl.user_id WHERE u.email = ${input.email}`;
    expect(consentRows).toHaveLength(0);
    const subRows = await cleanupSql!`SELECT s.id FROM public.subscriptions s
       JOIN public.users u ON u.id = s.user_id WHERE u.email = ${input.email}`;
    expect(subRows).toHaveLength(0);
    const tokenRows = await cleanupSql!`SELECT t.id FROM public.email_verification_tokens t
       JOIN public.users u ON u.id = t.user_id WHERE u.email = ${input.email}`;
    expect(tokenRows).toHaveLength(0);

    spy.mockRestore();
  });
});
