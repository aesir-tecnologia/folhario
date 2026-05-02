// Phase 4 plan 09 — PATCH /api/v1/iam/me/password integration test.
//
// Asserts:
//   1. Correct current_password + valid new_password → 200 ok.
//   2. Wrong current_password → 401 invalid_credentials (T-04-09-01 mitigation).
//   3. OAuth-only user (hasPassword=false) → 403 forbidden (AUTH-13 + T-04-09-02).
//   4. AUTH-12: changePassword does NOT call signOut (existing JWTs survive).
//
// Codex HIGH #3 enforced via vi.mock of authAdapter — the route must reach
// authAdapter only through the use-case, never through @supabase/* directly.
// The cookie-bearing browser flow lives in tests/e2e/auth-change-password.spec.ts
// per Codex HIGH #6.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { supabaseAuthAvailable } from "./fixtures/supabase-availability";
import postgres from "postgres";

import { ErrorCode } from "@shared/config/errors";
import { __setCurrentUserAdapterForTests } from "@contexts/iam/application/current-user";
import type { AuthAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import type { UserRow } from "@contexts/iam/infrastructure/db/users";
import { seedUser } from "./fixtures/seed-user";

const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

// Mocks for the AuthAdapter methods that the use-case calls. The route handler
// does NOT touch authAdapter directly — it goes through requireApiUser and
// changePassword. We control changePassword's adapter by injecting a fake
// AuthAdapter into the current-user pipeline AND we rebind the imported
// authAdapter (used by changePassword) via vi.mock.
const adapterMocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  adminUpdatePassword: vi.fn(),
  signOutLocal: vi.fn(),
}));

vi.mock("@contexts/iam/infrastructure/auth/auth-adapter", async (orig) => {
  const original = await orig<typeof import("@contexts/iam/infrastructure/auth/auth-adapter")>();
  return {
    ...original,
    authAdapter: {
      signInWithPassword: adapterMocks.signInWithPassword,
      adminUpdatePassword: adapterMocks.adminUpdatePassword,
      signOutLocal: adapterMocks.signOutLocal,
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

describe.skipIf(!dbUrl || !supabaseAuthAvailable)(
  "Phase 4 plan 09 — PATCH /api/v1/iam/me/password (AUTH-13 + Codex HIGH #3 + #6)",
  () => {
    beforeAll(async () => {
      // Seed once per file; Plan 06's policy_versions are already current.
    });

    beforeEach(() => {
      adapterMocks.signInWithPassword.mockReset();
      adapterMocks.adminUpdatePassword.mockReset();
      adapterMocks.signOutLocal.mockReset();
      __setCurrentUserAdapterForTests(null);
    });

    afterAll(async () => {
      __setCurrentUserAdapterForTests(null);
      if (cleanupSql) await cleanupSql.end({ timeout: 5 });
    });

    async function loadUserRow(userId: string): Promise<UserRow> {
      const { findById } = await import("@contexts/iam/infrastructure/db/users");
      const { db } = await import("@shared/db/client");
      const row = await findById(db, userId);
      if (!row) throw new Error("loadUserRow: user not found");
      return row;
    }

    it("happy path: correct current → 200 ok; signOut NOT called (AUTH-12)", async () => {
      const email = `pwchg-ok-${randomUUID()}@test.local`;
      const { id } = await seedUser({
        email,
        password: "OldPw123!",
        emailVerifiedAt: new Date().toISOString(),
      });
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      adapterMocks.signInWithPassword.mockResolvedValueOnce({ ok: true });
      adapterMocks.adminUpdatePassword.mockResolvedValueOnce({ ok: true });

      const { PATCH } = await import("../../src/app/api/v1/iam/me/password/route");
      const res = await PATCH(
        new Request("http://localhost:3000/api/v1/iam/me/password", {
          method: "PATCH",
          body: JSON.stringify({
            current_password: "OldPw123!",
            new_password: "NewPw456!",
          }),
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);

      // AUTH-12: signOut NOT invoked.
      expect(adapterMocks.signOutLocal).not.toHaveBeenCalled();
      // Reverification happened BEFORE the password update (T-04-09-01).
      expect(adapterMocks.signInWithPassword).toHaveBeenCalledTimes(1);
      expect(adapterMocks.adminUpdatePassword).toHaveBeenCalledTimes(1);
    });

    it("wrong current_password → 401 invalid_credentials, no adminUpdate call", async () => {
      const email = `pwchg-wrong-${randomUUID()}@test.local`;
      const { id } = await seedUser({
        email,
        password: "OldPw123!",
        emailVerifiedAt: new Date().toISOString(),
      });
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      adapterMocks.signInWithPassword.mockResolvedValueOnce({
        ok: false,
        reason: "invalid_credentials",
      });

      const { PATCH } = await import("../../src/app/api/v1/iam/me/password/route");
      const res = await PATCH(
        new Request("http://localhost:3000/api/v1/iam/me/password", {
          method: "PATCH",
          body: JSON.stringify({
            current_password: "WRONG-CURRENT",
            new_password: "NewPw456!",
          }),
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.error.code).toBe("invalid_credentials");

      // adminUpdatePassword MUST NOT be called when reverification fails.
      expect(adapterMocks.adminUpdatePassword).not.toHaveBeenCalled();
      expect(adapterMocks.signOutLocal).not.toHaveBeenCalled();
    });

    it("OAuth-only user (no encrypted_password) → 403 forbidden (AUTH-13 + T-04-09-02)", async () => {
      const email = `pwchg-oauth-${randomUUID()}@test.local`;
      // Create an auth.users row with NO password (mirrors Google OAuth flow).
      const { createClient } = await import("@supabase/supabase-js");
      const admin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );
      const created = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        // password omitted → encrypted_password stays NULL → hasPassword=false
      });
      if (created.error || !created.data.user) {
        throw new Error(`createUser failed: ${created.error?.message}`);
      }
      const userId = created.data.user.id;

      // Insert public.users row (Phase 2 D-35 trigger may already have done this)
      // AND null out auth.users.encrypted_password — Supabase admin.createUser
      // generates a random password even when none is supplied, so we mutate the
      // row directly to simulate an OAuth-only account (encrypted_password IS NULL).
      const sql = postgres(process.env.DATABASE_POOL_URL!, {
        prepare: false,
        max: 1,
        idle_timeout: 5,
      });
      try {
        await sql`
        INSERT INTO public.users (id, email, age_confirmed_at, email_verified_at, timezone, name, trial_source)
        VALUES (${userId}, ${email}, now(), now(), 'America/Sao_Paulo', 'OAuth User', 'organic')
        ON CONFLICT (id) DO UPDATE SET
          email_verified_at = EXCLUDED.email_verified_at,
          age_confirmed_at = EXCLUDED.age_confirmed_at
      `;
        await sql`UPDATE auth.users SET encrypted_password = NULL WHERE id = ${userId}`;
      } finally {
        await sql.end({ timeout: 5 });
      }

      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(userId)));

      const { PATCH } = await import("../../src/app/api/v1/iam/me/password/route");
      const res = await PATCH(
        new Request("http://localhost:3000/api/v1/iam/me/password", {
          method: "PATCH",
          body: JSON.stringify({
            current_password: "anything",
            new_password: "NewPw456!",
          }),
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe("forbidden");

      // OAuth-only guard short-circuits BEFORE any adapter call.
      expect(adapterMocks.signInWithPassword).not.toHaveBeenCalled();
      expect(adapterMocks.adminUpdatePassword).not.toHaveBeenCalled();
    });

    it("malformed body → 400 validation_failed", async () => {
      const email = `pwchg-bad-${randomUUID()}@test.local`;
      const { id } = await seedUser({
        email,
        password: "OldPw123!",
        emailVerifiedAt: new Date().toISOString(),
      });
      __setCurrentUserAdapterForTests(buildSessionAdapter(await loadUserRow(id)));

      const { PATCH } = await import("../../src/app/api/v1/iam/me/password/route");
      const res = await PATCH(
        new Request("http://localhost:3000/api/v1/iam/me/password", {
          method: "PATCH",
          body: JSON.stringify({ current_password: "x" }), // missing new_password
          headers: { "content-type": "application/json" },
        }),
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("validation_failed");
    });
  },
);
