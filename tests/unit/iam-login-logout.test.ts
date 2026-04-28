import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Phase 4 AUTH-05 + AUTH-14 + Codex HIGH #3 — login + logout application use-cases.
 *
 * The use-cases call the AuthAdapter exclusively (no `supabase.auth.*`,
 * no `@supabase/*` imports). These tests stub the AuthAdapter via vi.mock
 * (top-level + vi.hoisted to share fn references) and prove the contract:
 *
 *  - `loginUser` returns `{kind: "success"}` when adapter returns `{ok: true}`.
 *  - `loginUser` returns `{kind: "invalid_credentials"}` when adapter returns
 *    `{ok: false, reason: "invalid_credentials"}` (T-04-07-02 — never
 *    distinguishes "user not found" vs "wrong password").
 *  - `logoutUser` calls `authAdapter.signOutLocal()` exactly once and returns
 *    void (idempotent — already-logged-out user is a no-op).
 */

const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signOutLocal: vi.fn(),
}));

vi.mock("@contexts/iam/infrastructure/auth/auth-adapter", () => ({
  authAdapter: {
    signInWithPassword: mocks.signInWithPassword,
    signOutLocal: mocks.signOutLocal,
  },
}));

import { loginUser } from "@contexts/iam/application/login";
import { logoutUser } from "@contexts/iam/application/logout";

beforeEach(() => {
  mocks.signInWithPassword.mockReset();
  mocks.signOutLocal.mockReset();
});

describe("loginUser (AUTH-05 + Codex HIGH #3)", () => {
  it("returns success when authAdapter.signInWithPassword returns ok", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({ ok: true });
    const result = await loginUser({ email: "user@example.com", password: "Sup3rSecret!" });
    expect(result).toEqual({ kind: "success" });
    expect(mocks.signInWithPassword).toHaveBeenCalledTimes(1);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "Sup3rSecret!",
    });
  });

  it("returns invalid_credentials when authAdapter signals failure", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_credentials",
    });
    const result = await loginUser({ email: "user@example.com", password: "wrong" });
    expect(result).toEqual({ kind: "invalid_credentials" });
  });

  it("never distinguishes 'user not found' vs 'wrong password' (T-04-07-02)", async () => {
    // Adapter already collapses both cases to the same shape; the use-case
    // must NOT inspect any other field on the result.
    mocks.signInWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_credentials",
    });
    const a = await loginUser({ email: "absent@example.com", password: "any" });
    mocks.signInWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_credentials",
    });
    const b = await loginUser({ email: "user@example.com", password: "wrong" });
    expect(a).toEqual(b);
  });
});

describe("logoutUser (AUTH-14 + Resolved Q-AUTH-14 + Codex HIGH #3)", () => {
  it("calls authAdapter.signOutLocal exactly once", async () => {
    mocks.signOutLocal.mockResolvedValueOnce(undefined);
    const result = await logoutUser();
    expect(result).toBeUndefined();
    expect(mocks.signOutLocal).toHaveBeenCalledTimes(1);
  });

  it("is idempotent — adapter swallows errors so the caller never sees them", async () => {
    // The adapter's signOutLocal is documented as never throwing. The
    // use-case must propagate that contract: even successive calls return.
    mocks.signOutLocal.mockResolvedValue(undefined);
    await logoutUser();
    await logoutUser();
    expect(mocks.signOutLocal).toHaveBeenCalledTimes(2);
  });
});
