// Phase 4 Codex HIGH #2 — separate suite so the module-level vi.mock of the
// auth-adapter is isolated to this file. The rest of the password-reset
// integration suite (iam-password-reset.integration.test.ts) does NOT mock
// the adapter; mixing them would cross-contaminate via vi.mock hoisting.

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

import { truncateAuthAndIamTables } from "./setup-supabase-truncate";
import { seedUser } from "./fixtures/seed-user";
import { seedCurrentPolicyVersions } from "./fixtures/seed-policy-version";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

const cleanupSql = dbUrl
  ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 })
  : null;

// vi.hoisted: shared mock fn between vi.mock factory and per-test calls.
const adapterMocks = vi.hoisted(() => ({
  adminUpdatePassword: vi.fn(),
}));

vi.mock("@contexts/iam/infrastructure/auth/auth-adapter", () => ({
  authAdapter: {
    adminUpdatePassword: adapterMocks.adminUpdatePassword,
  },
}));

describe.skipIf(!dbUrl)(
  "Phase 4 Codex HIGH #2 — consumePasswordReset tx rolls back when adminUpdatePassword fails",
  () => {
    beforeEach(async () => {
      adapterMocks.adminUpdatePassword.mockReset();
      await truncateAuthAndIamTables();
      await seedCurrentPolicyVersions();
    });

    afterAll(async () => {
      if (cleanupSql) await cleanupSql.end({ timeout: 5 });
    });

    it("rolls back consumed_at when authAdapter.adminUpdatePassword returns ok:false (route returns 500)", async () => {
      const email = `pr-rollback-${randomUUID()}@test.local`;
      const seeded = await seedUser({
        email,
        password: "Sup3rSecret!",
        emailVerifiedAt: new Date().toISOString(),
      });

      const { mintResetToken } = await import(
        "../../src/contexts/iam/infrastructure/db/reset-tokens"
      );
      const { rawToken } = await mintResetToken({
        userId: seeded.id,
        sentToEmail: email,
      });

      adapterMocks.adminUpdatePassword.mockResolvedValueOnce({
        ok: false,
        reason: "test-injected-failure",
      });

      const mod = await import(
        "../../src/app/api/v1/iam/password/reset/route"
      );
      const res = await mod.POST(
        new Request("http://localhost:3000/api/v1/iam/password/reset", {
          method: "POST",
          body: JSON.stringify({ token: rawToken, password: "NewPassword123!" }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(res.status).toBe(500);

      // Tx rolled back → consumed_at must remain null so the user can retry.
      const sql = postgres(dbUrl!, {
        prepare: false,
        max: 1,
        idle_timeout: 5,
      });
      try {
        const rows = await sql<
          { consumed_at: string | null }[]
        >`SELECT consumed_at FROM password_reset_tokens WHERE user_id = ${seeded.id}`;
        expect(rows.length).toBe(1);
        expect(rows[0]!.consumed_at).toBeNull();
      } finally {
        await sql.end({ timeout: 5 });
      }
    });
  },
);
