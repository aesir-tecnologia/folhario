// Phase 4 AUTH-02 + D-23 — verification gate logic (allowlist + 403 path).
//
// This is the vitest layer of the gate test. The full cookie-bearing
// browser flow is exercised by the Playwright E2E spec (Codex HIGH #6).
//
// Asserts:
//   1. UNVERIFIED_ALLOWED_PATHS contains the expected entries; default-deny
//      otherwise (D-23).
//   2. requireVerifiedUser returns 403 email_unverified when the resolved
//      user has emailVerifiedAt = null.
//   3. requireVerifiedUser returns ok:true when the resolved user has
//      emailVerifiedAt set.
//
// Approach: swap the AuthAdapter via __setCurrentUserAdapterForTests so
// the test directly controls what user the auth pipeline sees, without
// needing real Supabase cookies.

import { randomUUID } from "node:crypto";

import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import postgres from "postgres";

import { ErrorCode } from "@shared/config/errors";
import { isUnverifiedAllowed, requireVerifiedUser } from "@shared/api/auth";
import { __setCurrentUserAdapterForTests } from "@contexts/iam/application/current-user";
import type { AuthAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import type { UserRow } from "@contexts/iam/infrastructure/db/users";
import { seedCurrentPolicyVersions } from "./fixtures/seed-policy-version";
import { seedUser } from "./fixtures/seed-user";

const dbUrl = process.env.DATABASE_POOL_URL;
if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}
const cleanupSql = dbUrl ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 }) : null;

function buildFakeAdapter(user: UserRow | null): AuthAdapter {
  return {
    verifyBearer: async () => ({ ok: false, code: ErrorCode.Unauthenticated, reason: "no_bearer" }),
    getUserById: async (id) => (user && user.id === id ? user : null),
    getUserBySession: async () => (user ? { id: user.id, email: user.email } : null),
    createUser: async () => ({ id: "noop" }),
    signInWithPassword: async () => ({ ok: true }),
    signOutLocal: async () => undefined,
    adminUpdatePassword: async () => ({ ok: true }),
    adminDeleteUser: async () => undefined,
    signInWithOAuth: async () => ({ url: "" }),
    exchangeCodeForSession: async () => ({ ok: false, reason: "noop" }),
  };
}

describe.skipIf(!dbUrl)("Phase 4 AUTH-02 — verification gate (allowlist + 403)", () => {
  beforeAll(async () => {
    await seedCurrentPolicyVersions();
  });

  beforeEach(() => {
    __setCurrentUserAdapterForTests(null);
  });

  afterAll(async () => {
    __setCurrentUserAdapterForTests(null);
    if (cleanupSql) await cleanupSql.end({ timeout: 5 });
  });

  it("UNVERIFIED_ALLOWED_PATHS allows resend-verification + me; default-denies app endpoints", () => {
    expect(isUnverifiedAllowed("/api/v1/iam/resend-verification")).toBe(true);
    expect(isUnverifiedAllowed("/api/v1/iam/me")).toBe(true);
    expect(isUnverifiedAllowed("/auth/verify")).toBe(true);
    expect(isUnverifiedAllowed("/legal/terms")).toBe(true);
    expect(isUnverifiedAllowed("/legal/privacy")).toBe(true);
    // Default-deny on a hypothetical gated endpoint
    expect(isUnverifiedAllowed("/api/v1/identifications")).toBe(false);
    expect(isUnverifiedAllowed("/api/v1/plants")).toBe(false);
  });

  it("requireVerifiedUser returns email_unverified 403 for an unverified user", async () => {
    const email = `gate-unverified-${randomUUID()}@test.local`;
    const { id } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: null,
    });

    // Resolve the seeded UserRow from the DB so the fake adapter returns the same shape.
    const { findById } = await import("@contexts/iam/infrastructure/db/users");
    const { db } = await import("@shared/db/client");
    const userRow = await findById(db, id);
    expect(userRow).not.toBeNull();
    if (!userRow) return;
    expect(userRow.emailVerifiedAt).toBeNull();

    __setCurrentUserAdapterForTests(buildFakeAdapter(userRow));

    const result = await requireVerifiedUser(
      new Request("http://localhost:3000/api/v1/iam/me"),
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe(ErrorCode.EmailUnverified);
    expect(result.reason).toBe("email_unverified");
  });

  it("requireVerifiedUser returns ok:true for a verified user", async () => {
    const email = `gate-verified-${randomUUID()}@test.local`;
    const { id } = await seedUser({
      email,
      password: "SuperSecret123!",
      emailVerifiedAt: new Date().toISOString(),
    });

    const { findById } = await import("@contexts/iam/infrastructure/db/users");
    const { db } = await import("@shared/db/client");
    const userRow = await findById(db, id);
    expect(userRow).not.toBeNull();
    if (!userRow) return;
    expect(userRow.emailVerifiedAt).not.toBeNull();

    __setCurrentUserAdapterForTests(buildFakeAdapter(userRow));

    const result = await requireVerifiedUser(
      new Request("http://localhost:3000/api/v1/iam/me"),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.user.id).toBe(id);
  });
});
