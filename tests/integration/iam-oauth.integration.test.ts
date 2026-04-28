// Phase 4 plan 09 — OAuth callback + complete integration tests.
//
// Covers:
//   - GET /auth/callback?error=... → redirects /auth/login?error=oauth_failed.
//   - GET /auth/callback?code=... + invalid exchange → redirects /auth/login?error=oauth_failed.
//   - GET /auth/callback?code=... + valid exchange + age_confirmed_at IS NULL
//     → redirects /auth/oauth-complete (Resolved Q4 (b)).
//   - GET /auth/callback?code=... + valid exchange + age_confirmed_at SET
//     → redirects / (Resolved Q4 (c)).
//   - POST /api/v1/iam/oauth/complete with active partner_code → 200; user has
//     age_confirmed_at + email_verified_at set; 2 consent_logs rows created;
//     subscription with trial_source='partner' + ~30 days.
//   - POST /api/v1/iam/oauth/complete with empty partner_code → 200; trial_source='organic' + ~14 days.
//   - POST /api/v1/iam/oauth/complete with inactive partner_code → 400 invalid_partner_code (D-32).
//   - POST /api/v1/iam/oauth/complete idempotent: second call returns 200 (already_completed).
//   - Codex HIGH #2 tx rollback: if insertSignupConsents throws, age_confirmed_at NOT set.
//
// Codex HIGH #6: cookie-bearing browser flow lives in tests/e2e/auth-google-oauth.spec.ts.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import { ErrorCode } from "@shared/config/errors";
import { __setCurrentUserAdapterForTests } from "@contexts/iam/application/current-user";
import type { AuthAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import type { UserRow } from "@contexts/iam/infrastructure/db/users";
import { seedCurrentPolicyVersions } from "./fixtures/seed-policy-version";
import {
  seedActivePartnerCode,
  seedInactivePartnerCode,
} from "./fixtures/seed-partner-code";

const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

// Each test owns a unique IP so the throttle wrapper does not cross-contaminate.
const TEST_IPS = ["7.1.1.1", "7.2.2.2", "7.3.3.3", "7.4.4.4", "7.5.5.5"] as const;

async function clearOauthThrottle(): Promise<void> {
  if (!cleanupSql) return;
  await cleanupSql`
    DELETE FROM public.auth_throttle
    WHERE ip IN ${cleanupSql(TEST_IPS as readonly string[])}
      AND endpoint = 'oauth-callback'
  `;
}

const adapterMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
}));

vi.mock("@contexts/iam/infrastructure/auth/auth-adapter", async (orig) => {
  const original = await orig<typeof import("@contexts/iam/infrastructure/auth/auth-adapter")>();
  return {
    ...original,
    authAdapter: {
      exchangeCodeForSession: adapterMocks.exchangeCodeForSession,
    },
  };
});

function buildSessionAdapter(user: UserRow): AuthAdapter {
  return {
    verifyBearer: async () => ({
      ok: false,
      code: ErrorCode.Unauthenticated,
      reason: "no_bearer",
    }),
    getUserById: async (id) => (user.id === id ? user : null),
    getUserBySession: async () => ({ id: user.id, email: user.email }),
    createUser: async () => ({ id: "noop" }),
    signInWithPassword: async () => ({ ok: true }),
    signOutLocal: async () => undefined,
    adminUpdatePassword: async () => ({ ok: true }),
    adminDeleteUser: async () => undefined,
    signInWithOAuth: async () => ({ url: "" }),
    exchangeCodeForSession: async () => ({ ok: false, reason: "noop" }),
  };
}

async function seedOauthIncompleteUser(email: string): Promise<{ id: string }> {
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    // No password — simulates Google OAuth account.
  });
  if (created.error || !created.data.user) {
    throw new Error(`createUser failed: ${created.error?.message}`);
  }
  const userId = created.data.user.id;

  // Phase 2 D-35 trigger pre-creates a public.users row with default values.
  // Force age_confirmed_at + email_verified_at to NULL so the row is "incomplete".
  const sql = postgres(process.env.DATABASE_POOL_URL!, {
    prepare: false,
    max: 1,
    idle_timeout: 5,
  });
  try {
    await sql`
      INSERT INTO public.users (id, email, age_confirmed_at, email_verified_at, timezone, name, trial_source)
      VALUES (${userId}, ${email}, NULL, NULL, 'America/Sao_Paulo', 'OAuth User', 'organic')
      ON CONFLICT (id) DO UPDATE SET
        age_confirmed_at = NULL,
        email_verified_at = NULL,
        partner_code = NULL
    `;
    return { id: userId };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

async function loadUserRow(userId: string): Promise<UserRow> {
  const { findById } = await import("@contexts/iam/infrastructure/db/users");
  const { db } = await import("@shared/db/client");
  const row = await findById(db, userId);
  if (!row) throw new Error("loadUserRow: user not found");
  return row;
}

describe.skipIf(!dbUrl)("Phase 4 plan 09 — OAuth callback + complete (AUTH-03 + D-04 + D-32 + Codex HIGH #2/#3)", () => {
  beforeAll(async () => {
    await seedCurrentPolicyVersions();
  });

  beforeEach(async () => {
    adapterMocks.exchangeCodeForSession.mockReset();
    __setCurrentUserAdapterForTests(null);
    await clearOauthThrottle();
  });

  afterAll(async () => {
    __setCurrentUserAdapterForTests(null);
    if (cleanupSql) await cleanupSql.end({ timeout: 5 });
  });

  describe("GET /auth/callback (Codex HIGH #3 + Resolved Q4)", () => {
    it("error= param → redirects /auth/login?error=oauth_failed", async () => {
      const { GET } = await import("../../src/app/auth/callback/route");
      const res = await GET(
        new Request("http://localhost:3000/auth/callback?error=access_denied", {
          headers: { "x-forwarded-for": "7.1.1.1" },
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain(
        "/auth/login?error=oauth_failed",
      );
      // Exchange must NOT be attempted when the OAuth provider already errored.
      expect(adapterMocks.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it("invalid code (exchange fails) → redirects /auth/login?error=oauth_failed", async () => {
      adapterMocks.exchangeCodeForSession.mockResolvedValueOnce({
        ok: false,
        reason: "bad_code",
      });
      const { GET } = await import("../../src/app/auth/callback/route");
      const res = await GET(
        new Request("http://localhost:3000/auth/callback?code=invalid", {
          headers: { "x-forwarded-for": "7.2.2.2" },
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain(
        "/auth/login?error=oauth_failed",
      );
      expect(adapterMocks.exchangeCodeForSession).toHaveBeenCalledTimes(1);
    });

    it("valid code + age_confirmed_at NULL → redirects /auth/oauth-complete (Resolved Q4 (b))", async () => {
      const email = `oauth-cb-incomplete-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      adapterMocks.exchangeCodeForSession.mockResolvedValueOnce({
        ok: true,
        userId: id,
        email,
      });
      const { GET } = await import("../../src/app/auth/callback/route");
      const res = await GET(
        new Request("http://localhost:3000/auth/callback?code=valid", {
          headers: { "x-forwarded-for": "7.3.3.3" },
        }),
      );
      expect(res.status).toBe(302);
      expect(res.headers.get("location")).toContain("/auth/oauth-complete");
    });

    it("valid code + age_confirmed_at SET → redirects / (Resolved Q4 (c))", async () => {
      const email = `oauth-cb-complete-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      // Mark already complete.
      await cleanupSql!`UPDATE public.users SET age_confirmed_at = now(), email_verified_at = now() WHERE id = ${id}`;
      adapterMocks.exchangeCodeForSession.mockResolvedValueOnce({
        ok: true,
        userId: id,
        email,
      });
      const { GET } = await import("../../src/app/auth/callback/route");
      const res = await GET(
        new Request("http://localhost:3000/auth/callback?code=valid", {
          headers: { "x-forwarded-for": "7.4.4.4" },
        }),
      );
      expect(res.status).toBe(302);
      const loc = res.headers.get("location") ?? "";
      // Expect "/" (and NOT /auth/oauth-complete or login).
      expect(loc).toMatch(/^http:\/\/localhost:3000\/$/);
    });
  });

  describe("POST /api/v1/iam/oauth/complete (D-04 + D-32 + Codex HIGH #2)", () => {
    it("active partner_code → 200; sets age + email_verified + 2 consents + trial=partner+30d", async () => {
      const email = `oauth-pc-active-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      const code = `OC-PARTNER-${randomUUID().slice(0, 8).toUpperCase()}`;
      await seedActivePartnerCode(code);

      const { POST } = await import("../../src/app/api/v1/iam/oauth/complete/route");
      const res = await POST(
        new Request("http://localhost:3000/api/v1/iam/oauth/complete", {
          method: "POST",
          body: JSON.stringify({
            age_confirmed: true,
            terms_accepted: true,
            privacy_accepted: true,
            timezone: "America/Sao_Paulo",
            partner_code: code,
          }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(res.status).toBe(200);

      const userRows = await cleanupSql!<{
        age_confirmed_at: string | null;
        email_verified_at: string | null;
        timezone: string;
        partner_code: string | null;
      }[]>`SELECT age_confirmed_at, email_verified_at, timezone, partner_code FROM public.users WHERE id = ${id}`;
      expect(userRows[0]!.age_confirmed_at).not.toBeNull();
      expect(userRows[0]!.email_verified_at).not.toBeNull();
      expect(userRows[0]!.timezone).toBe("America/Sao_Paulo");
      expect(userRows[0]!.partner_code).toBe(code);

      const consentRows = await cleanupSql!<{ purpose: string; source: string }[]>`
        SELECT purpose, source FROM public.consent_logs WHERE user_id = ${id} ORDER BY created_at`;
      expect(consentRows).toHaveLength(2);
      expect(consentRows.every((r) => r.purpose === "signup_acceptance")).toBe(true);
      expect(consentRows.every((r) => r.source === "signup")).toBe(true);

      const subRows = await cleanupSql!<{ status: string; trial_start_date: string; trial_end_date: string }[]>`
        SELECT status, trial_start_date, trial_end_date FROM public.subscriptions WHERE user_id = ${id}`;
      expect(subRows).toHaveLength(1);
      expect(subRows[0]!.status).toBe("trialing");
      const trialMs =
        new Date(subRows[0]!.trial_end_date).getTime() -
        new Date(subRows[0]!.trial_start_date).getTime();
      expect(trialMs).toBeGreaterThan(29.5 * 24 * 60 * 60 * 1000);
      expect(trialMs).toBeLessThan(30.5 * 24 * 60 * 60 * 1000);
    });

    it("empty partner_code → 200; trial=organic+14d", async () => {
      const email = `oauth-pc-empty-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      const { POST } = await import("../../src/app/api/v1/iam/oauth/complete/route");
      const res = await POST(
        new Request("http://localhost:3000/api/v1/iam/oauth/complete", {
          method: "POST",
          body: JSON.stringify({
            age_confirmed: true,
            terms_accepted: true,
            privacy_accepted: true,
            timezone: "America/Sao_Paulo",
            partner_code: "",
          }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(res.status).toBe(200);

      const subRows = await cleanupSql!<{ trial_start_date: string; trial_end_date: string }[]>`
        SELECT trial_start_date, trial_end_date FROM public.subscriptions WHERE user_id = ${id}`;
      const trialMs =
        new Date(subRows[0]!.trial_end_date).getTime() -
        new Date(subRows[0]!.trial_start_date).getTime();
      expect(trialMs).toBeGreaterThan(13.5 * 24 * 60 * 60 * 1000);
      expect(trialMs).toBeLessThan(14.5 * 24 * 60 * 60 * 1000);
    });

    it("inactive partner_code → 400 invalid_partner_code (D-32); user fields NOT mutated", async () => {
      const email = `oauth-pc-inactive-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      const code = `OC-INACTIVE-${randomUUID().slice(0, 8).toUpperCase()}`;
      await seedInactivePartnerCode(code);

      const { POST } = await import("../../src/app/api/v1/iam/oauth/complete/route");
      const res = await POST(
        new Request("http://localhost:3000/api/v1/iam/oauth/complete", {
          method: "POST",
          body: JSON.stringify({
            age_confirmed: true,
            terms_accepted: true,
            privacy_accepted: true,
            timezone: "America/Sao_Paulo",
            partner_code: code,
          }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("invalid_partner_code");

      const userRows = await cleanupSql!<{
        age_confirmed_at: string | null;
        email_verified_at: string | null;
      }[]>`SELECT age_confirmed_at, email_verified_at FROM public.users WHERE id = ${id}`;
      expect(userRows[0]!.age_confirmed_at).toBeNull();
      expect(userRows[0]!.email_verified_at).toBeNull();
    });

    it("idempotent: second call after success returns 200 (already_completed)", async () => {
      const email = `oauth-pc-idem-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      const { POST } = await import("../../src/app/api/v1/iam/oauth/complete/route");
      const body = {
        age_confirmed: true,
        terms_accepted: true,
        privacy_accepted: true,
        timezone: "America/Sao_Paulo",
        partner_code: "",
      };

      const first = await POST(
        new Request("http://localhost:3000/api/v1/iam/oauth/complete", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(first.status).toBe(200);

      // Re-fetch the row so the buildSessionAdapter sees ageConfirmedAt set.
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      const second = await POST(
        new Request("http://localhost:3000/api/v1/iam/oauth/complete", {
          method: "POST",
          body: JSON.stringify(body),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(second.status).toBe(200);
      // Subscription row count is still 1 — second call short-circuited via already_completed.
      const subRows = await cleanupSql!<{ id: string }[]>`SELECT id FROM public.subscriptions WHERE user_id = ${id}`;
      expect(subRows).toHaveLength(1);
    });

    it("Codex HIGH #2 tx rollback: insertSignupConsents throws → age_confirmed_at NOT set", async () => {
      const email = `oauth-pc-rollback-${randomUUID()}@test.local`;
      const { id } = await seedOauthIncompleteUser(email);
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      // Spy on the imported module so insertSignupConsents throws inside the tx.
      const consentMod = await import(
        "@contexts/iam/infrastructure/db/consent-logs"
      );
      const spy = vi
        .spyOn(consentMod, "insertSignupConsents")
        .mockImplementationOnce(async () => {
          throw new Error("forced rollback");
        });

      const { POST } = await import("../../src/app/api/v1/iam/oauth/complete/route");
      const res = await POST(
        new Request("http://localhost:3000/api/v1/iam/oauth/complete", {
          method: "POST",
          body: JSON.stringify({
            age_confirmed: true,
            terms_accepted: true,
            privacy_accepted: true,
            timezone: "America/Sao_Paulo",
            partner_code: "",
          }),
          headers: { "content-type": "application/json" },
        }),
      );
      // Route catches the thrown error and surfaces internal_error 500.
      expect(res.status).toBe(500);

      // tx rolled back — age + email + consents + subscription all unchanged.
      const userRows = await cleanupSql!<{
        age_confirmed_at: string | null;
        email_verified_at: string | null;
      }[]>`SELECT age_confirmed_at, email_verified_at FROM public.users WHERE id = ${id}`;
      expect(userRows[0]!.age_confirmed_at).toBeNull();
      expect(userRows[0]!.email_verified_at).toBeNull();
      const consentRows = await cleanupSql!`SELECT id FROM public.consent_logs WHERE user_id = ${id}`;
      expect(consentRows).toHaveLength(0);
      const subRows = await cleanupSql!`SELECT id FROM public.subscriptions WHERE user_id = ${id}`;
      expect(subRows).toHaveLength(0);

      spy.mockRestore();
    });
  });
});
