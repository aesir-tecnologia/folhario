// Phase 4 plan 06 — verify-email use-case integration test (AUTH-04 + Codex HIGH #2).
//
// Asserts:
//   1. Mint a verification token → call verifyEmail → public.users.email_verified_at
//      AND email_verification_tokens.consumed_at are BOTH set after one tx commit.
//   2. Reused token returns invalid_or_expired (consumed_at IS NOT NULL filter).
//   3. Expired token returns invalid_or_expired (expires_at < now() filter).
//   4. Tx rollback: when setEmailVerifiedAt throws inside the tx, consumed_at
//      is NOT set (i.e., both writes roll back together).

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import postgres from "postgres";

import { seedCurrentPolicyVersions } from "./fixtures/seed-policy-version";
import { seedUser } from "./fixtures/seed-user";
import { installInngestMock, resetInngestMock } from "./fixtures/mock-inngest";

installInngestMock();

const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

describe.skipIf(!dbUrl)("Phase 4 plan 06 — verifyEmail (AUTH-04 + Codex HIGH #2 ordering)", () => {
  beforeAll(async () => {
    await seedCurrentPolicyVersions();
  });

  beforeEach(() => {
    resetInngestMock();
    vi.resetModules();
  });

  afterAll(async () => {
    if (cleanupSql) await cleanupSql.end({ timeout: 5 });
  });

  async function mintTokenForUser(userId: string, email: string): Promise<string> {
    const { mintVerificationToken } = await import(
      "@contexts/iam/infrastructure/db/verification-tokens"
    );
    const { rawToken } = await mintVerificationToken({ userId, sentToEmail: email });
    return rawToken;
  }

  it("happy path: consume + setEmailVerifiedAt commit together inside one tx", async () => {
    const email = `verify-${randomUUID()}@test.local`;
    const { id: userId } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });
    const rawToken = await mintTokenForUser(userId, email);

    const verifyMod = await import("@contexts/iam/application/verify-email");
    const result = await verifyMod.verifyEmail(rawToken);
    expect(result.kind).toBe("verified");
    if (result.kind !== "verified") return;
    expect(result.userId).toBe(userId);

    // public.users.email_verified_at IS NOT NULL
    const userRows = await cleanupSql!<{ email_verified_at: string | null }[]>`
      SELECT email_verified_at FROM public.users WHERE id = ${userId}`;
    expect(userRows[0]!.email_verified_at).not.toBeNull();

    // email_verification_tokens.consumed_at IS NOT NULL
    const tokenRows = await cleanupSql!<{ consumed_at: string | null }[]>`
      SELECT consumed_at FROM public.email_verification_tokens WHERE user_id = ${userId}`;
    expect(tokenRows[0]!.consumed_at).not.toBeNull();
  });

  it("reused token returns invalid_or_expired (consumed_at filter)", async () => {
    const email = `reuse-${randomUUID()}@test.local`;
    const { id: userId } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });
    const rawToken = await mintTokenForUser(userId, email);

    const verifyMod = await import("@contexts/iam/application/verify-email");
    const first = await verifyMod.verifyEmail(rawToken);
    expect(first.kind).toBe("verified");
    const second = await verifyMod.verifyEmail(rawToken);
    expect(second.kind).toBe("invalid_or_expired");
  });

  it("expired token returns invalid_or_expired (expires_at filter)", async () => {
    const email = `expired-${randomUUID()}@test.local`;
    const { id: userId } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });
    const rawToken = await mintTokenForUser(userId, email);
    // Force expiry to a past time
    await cleanupSql!`UPDATE public.email_verification_tokens
      SET expires_at = now() - interval '1 hour' WHERE user_id = ${userId}`;

    const verifyMod = await import("@contexts/iam/application/verify-email");
    const result = await verifyMod.verifyEmail(rawToken);
    expect(result.kind).toBe("invalid_or_expired");

    // Token NOT consumed (because the WHERE filter excluded it)
    const tokenRows = await cleanupSql!<{ consumed_at: string | null }[]>`
      SELECT consumed_at FROM public.email_verification_tokens WHERE user_id = ${userId}`;
    expect(tokenRows[0]!.consumed_at).toBeNull();
  });

  it("tx rollback: if setEmailVerifiedAt throws, consumed_at is NOT set", async () => {
    const email = `rollback-${randomUUID()}@test.local`;
    const { id: userId } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });
    const rawToken = await mintTokenForUser(userId, email);

    // Spy on the users module so setEmailVerifiedAt throws.
    vi.resetModules();
    const usersMod = await import("@contexts/iam/infrastructure/db/users");
    const spy = vi
      .spyOn(usersMod, "setEmailVerifiedAt")
      .mockImplementationOnce(async () => {
        throw new Error("forced rollback");
      });

    const verifyMod = await import("@contexts/iam/application/verify-email");
    await expect(verifyMod.verifyEmail(rawToken)).rejects.toThrow(/forced rollback/);

    // consumed_at should be NULL — the tx rolled back the consume UPDATE.
    const tokenRows = await cleanupSql!<{ consumed_at: string | null }[]>`
      SELECT consumed_at FROM public.email_verification_tokens WHERE user_id = ${userId}`;
    expect(tokenRows[0]!.consumed_at).toBeNull();

    spy.mockRestore();
  });
});
