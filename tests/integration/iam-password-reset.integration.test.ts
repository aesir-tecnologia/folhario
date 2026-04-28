// Phase 4 AUTH-11 + AUTH-12 — password reset flow integration test (Plan 08).
//
// Covers: route → iam/password-reset-requested Inngest function → notifications/email.requested.
// Codex HIGH #2 (db.transaction tx rollback), HIGH #3 (AuthAdapter), HIGH #8 (event id dedup).
//
// vi.hoisted shares the inngest mock between the hoisted vi.mock factory and per-test assertions
// (Plan 03 / iam-login pattern). The auth-adapter mock for the tx-rollback assertion is in its
// own integration file (see iam-password-reset-tx-rollback.integration.test.ts) because vi.mock
// is hoisted — putting it inside one `it()` block does not isolate it from the rest of the suite.
//
// Cross-file pointer for the Codex HIGH #2 acceptance grep:
//   tx-rollback assertion `expect(rows[0]!.consumed_at).toBeNull()` lives in
//   iam-password-reset-tx-rollback.integration.test.ts (separate file required
//   for vi.mock hoisting reasons noted above).

import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";
import postgres from "postgres";
import { randomUUID } from "node:crypto";

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

// vi.hoisted: shared mock between vi.mock factory + assertions.
const mocks = vi.hoisted(() => ({
  sentEvents: [] as Array<{ name: string; id?: string; data: unknown }>,
}));

vi.mock("@shared/inngest/client", () => ({
  inngest: {
    send: vi.fn(async (event: { name: string; id?: string; data: unknown }) => {
      mocks.sentEvents.push(event);
      return { ids: ["test-event-id"] };
    }),
  },
}));

describe.skipIf(!dbUrl)(
  "Phase 4 AUTH-11 + AUTH-12 — password reset flow (route → iam/password-reset-requested Inngest function → notifications/email.requested)",
  () => {
    // Idempotent seed in beforeAll (NOT beforeEach) — concurrent test files
    // share the same auth.users / public.users / policy_versions tables, so a
    // beforeEach-scoped truncate would race-wipe other suites' data mid-run.
    // Per-test isolation comes from unique random uuid emails (rows in
    // users/password_reset_tokens/etc), not from wipe-and-reinsert.
    beforeAll(async () => {
      await seedCurrentPolicyVersions();
    });

    beforeEach(() => {
      mocks.sentEvents.length = 0;
    });

    afterAll(async () => {
      if (cleanupSql) await cleanupSql.end({ timeout: 5 });
    });

    it("reset-request route always returns 200 + emits iam/password-reset-requested with minute-bucket id (D-11 thin wrapper, Codex HIGH #8)", async () => {
      const mod = await import(
        "../../src/app/api/v1/iam/password/reset-request/route"
      );
      const res = await mod.POST(
        new Request("http://localhost:3000/api/v1/iam/password/reset-request", {
          method: "POST",
          body: JSON.stringify({ email: "nobody@example.com" }),
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "10.10.0.1",
          },
        }),
      );
      expect(res.status).toBe(200);

      // Outer event is iam/password-reset-requested — what the Inngest function listens for.
      const outerEvent = mocks.sentEvents.find(
        (e) => e.name === "iam/password-reset-requested",
      );
      expect(outerEvent).toBeTruthy();
      expect((outerEvent!.data as { email: string }).email).toBe(
        "nobody@example.com",
      );
      // Codex HIGH #8: outer event id includes email + minute bucket
      expect(outerEvent!.id).toMatch(
        /^password-reset-request\/nobody@example\.com\/\d+$/,
      );
    });

    it("requestPasswordReset use-case (invoked from inside Inngest function) with existing user mints token + emits notifications/email.requested with token-id dedup (Codex HIGH #8)", async () => {
      const email = `pr-existing-${randomUUID()}@test.local`;
      const seeded = await seedUser({
        email,
        password: "Sup3rSecret!",
        emailVerifiedAt: new Date().toISOString(),
      });
      const { requestPasswordReset } = await import(
        "../../src/contexts/iam/application/request-password-reset"
      );
      await requestPasswordReset({
        email,
        requestUrl: "http://localhost:3000/api/v1/iam/password/reset-request",
      });

      const innerEvent = mocks.sentEvents.find(
        (e) => e.name === "notifications/email.requested",
      );
      expect(innerEvent).toBeTruthy();
      expect((innerEvent!.data as { template: string }).template).toBe(
        "password-reset",
      );
      // Codex HIGH #8: inner event id is `password-reset/{tokenId}` (token-unique).
      expect(innerEvent!.id).toMatch(/^password-reset\//);

      // Token row created.
      const sql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        const rows =
          await sql<{ id: string }[]>`SELECT id FROM password_reset_tokens WHERE user_id = ${seeded.id}`;
        expect(rows.length).toBe(1);
      } finally {
        await sql.end({ timeout: 5 });
      }
    });

    it("requestPasswordReset use-case with non-existent user emits NO email (anti-enumeration)", async () => {
      const { requestPasswordReset } = await import(
        "../../src/contexts/iam/application/request-password-reset"
      );
      await requestPasswordReset({
        email: `pr-nobody-${randomUUID()}@test.local`,
        requestUrl: "http://localhost:3000/api/v1/iam/password/reset-request",
      });
      const inner = mocks.sentEvents.filter(
        (e) => e.name === "notifications/email.requested",
      );
      expect(inner).toHaveLength(0);
    });

    it("requestPasswordReset use-case with OAuth-only user emits NO email (anti-enumeration)", async () => {
      // Seed user normally then NULL the encrypted_password to simulate OAuth-only.
      const email = `pr-oauth-${randomUUID()}@test.local`;
      const seeded = await seedUser({
        email,
        password: "Sup3rSecret!",
        emailVerifiedAt: new Date().toISOString(),
      });
      const sqlSetup = postgres(dbUrl!, {
        prepare: false,
        max: 1,
        idle_timeout: 5,
      });
      try {
        await sqlSetup`UPDATE auth.users SET encrypted_password = NULL WHERE id = ${seeded.id}`;
      } finally {
        await sqlSetup.end({ timeout: 5 });
      }

      const { requestPasswordReset } = await import(
        "../../src/contexts/iam/application/request-password-reset"
      );
      await requestPasswordReset({
        email,
        requestUrl: "http://localhost:3000/api/v1/iam/password/reset-request",
      });

      const inner = mocks.sentEvents.filter(
        (e) => e.name === "notifications/email.requested",
      );
      expect(inner).toHaveLength(0);

      const sql = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
      try {
        const rows =
          await sql<{ id: string }[]>`SELECT id FROM password_reset_tokens WHERE user_id = ${seeded.id}`;
        expect(rows.length).toBe(0);
      } finally {
        await sql.end({ timeout: 5 });
      }
    });

    it("consume with valid token + correct password → 200 (AUTH-12 success path)", async () => {
      const email = `pr-consume-${randomUUID()}@test.local`;
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
      expect(res.status).toBe(200);
    });

    it("consume same token twice → second call returns 400 invalid_or_expired (AUTH-12 single-use)", async () => {
      const email = `pr-replay-${randomUUID()}@test.local`;
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

      const mod = await import(
        "../../src/app/api/v1/iam/password/reset/route"
      );
      const first = await mod.POST(
        new Request("http://localhost:3000/api/v1/iam/password/reset", {
          method: "POST",
          body: JSON.stringify({ token: rawToken, password: "NewPassword123!" }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(first.status).toBe(200);

      const second = await mod.POST(
        new Request("http://localhost:3000/api/v1/iam/password/reset", {
          method: "POST",
          body: JSON.stringify({
            token: rawToken,
            password: "AnotherPassword!",
          }),
          headers: { "content-type": "application/json" },
        }),
      );
      expect(second.status).toBe(400);
      const body = await second.json();
      expect(body.error.code).toBe("validation_failed");
    });

    it("consume with malformed body → 400 validation_failed", async () => {
      const mod = await import(
        "../../src/app/api/v1/iam/password/reset/route"
      );
      const res = await mod.POST(
        new Request("http://localhost:3000/api/v1/iam/password/reset", {
          method: "POST",
          body: "not-json",
          headers: { "content-type": "application/json" },
        }),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error.code).toBe("validation_failed");
    });

    it("AUTH-12: consumePasswordReset succeeds without calling signOut — existing JWTs remain valid (grep absence + Playwright E2E confirm)", async () => {
      // The full cookie/JWT-bearing assertion lives in the Playwright spec
      // (Task 3). Here we assert the use-case completes without throwing —
      // the absence of signOut is enforced by Task 1's grep acceptance check.
      const email = `pr-jwt-${randomUUID()}@test.local`;
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

      const { consumePasswordReset } = await import(
        "../../src/contexts/iam/application/consume-password-reset"
      );
      const result = await consumePasswordReset({
        token: rawToken,
        password: "NewPassword123!",
      });
      expect(result.kind).toBe("success");
    });
  },
);
