import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

/**
 * Phase 4 Codex HIGH #3 — AuthAdapter Phase 4 surface.
 *
 * The AuthAdapter is the SOLE module that calls `supabase.auth.*`. These
 * tests mock the Supabase server + admin clients and prove the contract for
 * each Phase 4 method (createUser, signInWithPassword, signOutLocal,
 * adminUpdatePassword, adminDeleteUser, signInWithOAuth,
 * exchangeCodeForSession, getUserBySession).
 *
 * Real Supabase end-to-end coverage lives in integration tests (D-28: real
 * local Supabase Auth). Unit tests use vi.mock so the suite remains free of
 * network calls.
 */

// vi.mock factories are hoisted above imports — use vi.hoisted to share
// fn references between the factory and the test bodies.
const mocks = vi.hoisted(() => ({
  fullClientAuth: {
    getUser: vi.fn(),
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    signInWithOAuth: vi.fn(),
    exchangeCodeForSession: vi.fn(),
  },
  readOnlyClientAuth: {
    getUser: vi.fn(),
  },
  adminAuth: {
    admin: {
      createUser: vi.fn(),
      updateUserById: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
  sentry: {
    captureException: vi.fn(),
  },
}));

const { fullClientAuth, readOnlyClientAuth, adminAuth, sentry } = mocks;

vi.mock("@contexts/iam/infrastructure/supabase-server", () => ({
  getSupabaseServerClient: async () => ({ auth: mocks.fullClientAuth }),
  getReadOnlySupabaseServerClient: async () => ({ auth: mocks.readOnlyClientAuth }),
}));

vi.mock("@contexts/iam/infrastructure/supabase-admin", () => ({
  supabaseAdmin: { auth: mocks.adminAuth },
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: mocks.sentry.captureException,
}));

// Mirror the auth-js implementation: an AuthSessionMissingError is any
// AuthError whose `name === 'AuthSessionMissingError'`. Tests pass plain
// objects shaped that way; the predicate identifies them by name only.
vi.mock("@supabase/supabase-js", () => ({
  isAuthSessionMissingError: (err: unknown): boolean =>
    !!err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "AuthSessionMissingError",
}));

import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";

beforeEach(() => {
  for (const fn of [
    fullClientAuth.getUser,
    fullClientAuth.signInWithPassword,
    fullClientAuth.signOut,
    fullClientAuth.signInWithOAuth,
    fullClientAuth.exchangeCodeForSession,
    readOnlyClientAuth.getUser,
    adminAuth.admin.createUser,
    adminAuth.admin.updateUserById,
    adminAuth.admin.deleteUser,
    sentry.captureException,
  ]) {
    fn.mockReset();
  }
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("authAdapter.getUserBySession", () => {
  it("returns null on the normal anonymous case (AuthSessionMissingError) WITHOUT tagging Sentry", async () => {
    // Realistic auth-js return shape for an anonymous request: error is
    // `AuthSessionMissingError`, not null. This is the most common path
    // (every public-page anonymous render). Tagging Sentry here would
    // burn quota on routine traffic.
    const sessionMissing = Object.assign(new Error("Auth session missing!"), {
      name: "AuthSessionMissingError",
      status: 400,
    });
    fullClientAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: sessionMissing,
    });
    expect(await authAdapter.getUserBySession()).toBeNull();
    expect(sentry.captureException).not.toHaveBeenCalled();
  });

  it("returns {id, email} when session exists", async () => {
    fullClientAuth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u1", email: "a@b.test" } },
      error: null,
    });
    expect(await authAdapter.getUserBySession()).toEqual({
      id: "u1",
      email: "a@b.test",
    });
  });

  it("uses the read-only client when readOnly: true (Pitfall 6 — Server Components)", async () => {
    readOnlyClientAuth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u2", email: "x@y.test" } },
      error: null,
    });
    const result = await authAdapter.getUserBySession({ readOnly: true });
    expect(result).toEqual({ id: "u2", email: "x@y.test" });
    expect(fullClientAuth.getUser).not.toHaveBeenCalled();
    expect(readOnlyClientAuth.getUser).toHaveBeenCalledTimes(1);
  });

  /**
   * Debug session `publiclayout-auth-refresh-token-throw` belt-and-braces:
   * when getUser() returns an OPERATIONALLY INTERESTING error (e.g.
   * AuthApiError "Invalid Refresh Token" — not the routine
   * AuthSessionMissingError), the adapter MUST treat the request as
   * unauthenticated AND tag Sentry so the on-call signal is preserved.
   * The library itself already `console.error`s the failed refresh inside
   * auth-js — we cannot suppress that — but we ARE responsible for
   * surfacing operationally relevant errors with our own observability
   * primitive.
   *
   * Sentry payload contract: never include user email (CLAUDE.md "Sentry:
   * setUser({ id }) only — never email").
   */
  it("captures Sentry exception and returns null on AuthApiError (stale refresh token)", async () => {
    const refreshError = Object.assign(
      new Error("Invalid Refresh Token: Refresh Token Not Found"),
      { name: "AuthApiError", status: 400 },
    );
    readOnlyClientAuth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: refreshError,
    });

    const result = await authAdapter.getUserBySession({ readOnly: true });

    expect(result).toBeNull();
    expect(sentry.captureException).toHaveBeenCalledTimes(1);
    const firstCall = sentry.captureException.mock.calls[0] ?? [];
    const errArg = firstCall[0];
    const ctxArg = firstCall[1];
    expect(errArg).toBe(refreshError);
    expect(ctxArg).toMatchObject({
      tags: { surface: "iam.getUserBySession" },
    });
    // CLAUDE.md hard rule: never include email in Sentry payloads.
    expect(JSON.stringify(ctxArg ?? {})).not.toContain("email");
  });
});

describe("authAdapter.createUser", () => {
  it("calls admin.createUser with email_confirm: true (D-03) and returns id", async () => {
    adminAuth.admin.createUser.mockResolvedValueOnce({
      data: { user: { id: "new-u" } },
      error: null,
    });
    const result = await authAdapter.createUser({
      email: "x@y.test",
      password: "supersecret",
    });
    expect(result).toEqual({ id: "new-u" });
    expect(adminAuth.admin.createUser).toHaveBeenCalledWith({
      email: "x@y.test",
      password: "supersecret",
      email_confirm: true,
    });
  });

  it("throws on Supabase error", async () => {
    adminAuth.admin.createUser.mockResolvedValueOnce({
      data: { user: null },
      error: { message: "duplicate email" },
    });
    await expect(
      authAdapter.createUser({ email: "x@y.test", password: "supersecret" }),
    ).rejects.toThrow(/duplicate email/);
  });
});

describe("authAdapter.signInWithPassword", () => {
  it("returns ok on success", async () => {
    fullClientAuth.signInWithPassword.mockResolvedValueOnce({ error: null });
    const result = await authAdapter.signInWithPassword({
      email: "x@y.test",
      password: "p",
    });
    expect(result).toEqual({ ok: true });
  });

  it("maps any Supabase error to invalid_credentials (T-04-07-02)", async () => {
    fullClientAuth.signInWithPassword.mockResolvedValueOnce({
      error: { message: "user not found" },
    });
    const result = await authAdapter.signInWithPassword({
      email: "x@y.test",
      password: "p",
    });
    expect(result).toEqual({ ok: false, reason: "invalid_credentials" });
  });
});

describe("authAdapter.signOutLocal", () => {
  it("calls signOut with scope: 'local'", async () => {
    fullClientAuth.signOut.mockResolvedValueOnce({});
    await authAdapter.signOutLocal();
    expect(fullClientAuth.signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("is idempotent — swallows errors (AUTH-14)", async () => {
    fullClientAuth.signOut.mockRejectedValueOnce(new Error("already logged out"));
    await expect(authAdapter.signOutLocal()).resolves.toBeUndefined();
  });
});

describe("authAdapter.adminUpdatePassword", () => {
  it("calls admin.updateUserById with password and does NOT call signOut (D-10 + AUTH-12)", async () => {
    adminAuth.admin.updateUserById.mockResolvedValueOnce({ error: null });
    const result = await authAdapter.adminUpdatePassword({
      userId: "u1",
      newPassword: "newsecret",
    });
    expect(result).toEqual({ ok: true });
    expect(adminAuth.admin.updateUserById).toHaveBeenCalledWith("u1", {
      password: "newsecret",
    });
    expect(fullClientAuth.signOut).not.toHaveBeenCalled();
  });

  it("returns reason on error", async () => {
    adminAuth.admin.updateUserById.mockResolvedValueOnce({
      error: { message: "weak password" },
    });
    const result = await authAdapter.adminUpdatePassword({
      userId: "u1",
      newPassword: "x",
    });
    expect(result).toEqual({ ok: false, reason: "weak password" });
  });
});

describe("authAdapter.adminDeleteUser", () => {
  it("calls admin.deleteUser (D-25 compensating delete)", async () => {
    adminAuth.admin.deleteUser.mockResolvedValueOnce({ error: null });
    await authAdapter.adminDeleteUser("u-to-delete");
    expect(adminAuth.admin.deleteUser).toHaveBeenCalledWith("u-to-delete");
  });

  it("swallows errors (best-effort cleanup)", async () => {
    adminAuth.admin.deleteUser.mockRejectedValueOnce(new Error("not found"));
    await expect(authAdapter.adminDeleteUser("u")).resolves.toBeUndefined();
  });
});

describe("authAdapter.signInWithOAuth", () => {
  it("returns the provider URL (D-04)", async () => {
    fullClientAuth.signInWithOAuth.mockResolvedValueOnce({
      data: { url: "https://accounts.google.com/oauth/v2/auth?..." },
      error: null,
    });
    const result = await authAdapter.signInWithOAuth({
      provider: "google",
      redirectTo: "http://localhost/auth/callback",
    });
    expect(result.url).toContain("accounts.google.com");
  });
});

describe("authAdapter.exchangeCodeForSession", () => {
  it("returns ok with userId and email on success (D-04)", async () => {
    fullClientAuth.exchangeCodeForSession.mockResolvedValueOnce({ error: null });
    fullClientAuth.getUser.mockResolvedValueOnce({
      data: { user: { id: "u-oauth", email: "oauth@user.test" } },
    });
    const result = await authAdapter.exchangeCodeForSession("auth-code");
    expect(result).toEqual({
      ok: true,
      userId: "u-oauth",
      email: "oauth@user.test",
    });
  });

  it("returns ok: false on exchange error", async () => {
    fullClientAuth.exchangeCodeForSession.mockResolvedValueOnce({
      error: { message: "invalid_grant" },
    });
    const result = await authAdapter.exchangeCodeForSession("bad");
    expect(result).toEqual({ ok: false, reason: "invalid_grant" });
  });
});
