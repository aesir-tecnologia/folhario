import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Debug session `publiclayout-auth-refresh-token-throw` — proxy must do
 * the standard `@supabase/ssr` middleware cookie-refresh dance for non-API
 * page routes.
 *
 * Root cause recap (see .planning/debug/publiclayout-auth-refresh-token-throw.md):
 *   - On cold start with a stale `sb-*` cookie, Server Components call
 *     getReadOnlySupabaseServerClient().auth.getUser() which triggers a
 *     refresh attempt inside auth-js. That fails with AuthApiError, which
 *     the library logs via `console.error` (GoTrueClient.js:3838). Next
 *     16's dev overlay surfaces the log and attributes it to the awaiting
 *     React component (PublicLayout / AppLayout).
 *   - The read-only client's no-op `setAll` (Pitfall 6) blocks
 *     `_removeSession()` from clearing the bad cookie, so the error
 *     recurs every render.
 *
 * Fix: a real `createServerClient` with cookie-write capability runs in
 * middleware (`src/proxy.ts`) BEFORE Server Components render, calls
 * `supabase.auth.getUser()` once, and merges the resulting cookies into
 * the response. By the time Server Components run, the cookie state is
 * coherent (stale cookie cleared, valid cookie refreshed) and no further
 * refresh is attempted.
 *
 * These tests prove:
 *   1. For non-API page routes, the proxy creates a server client and
 *      calls `auth.getUser()` exactly once.
 *   2. The cookies set by `createServerClient`'s `setAll` callback are
 *      merged into the returned `NextResponse`.
 *   3. For `/api/v1/*` routes, the supabase dance is SKIPPED (T-02-37
 *      body discipline + per-route auth — the proxy stays fast-fail-only
 *      on protected APIs).
 *   4. The matcher fires on `/` and `/auth/login` (the routes that
 *      surface the original symptom).
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  // Captured on each createServerClient call so the test can drive
  // `setAll(cookiesToSet)` and assert the proxy merges those cookies into
  // the NextResponse it returns.
  capturedCookieAdapter: null as null | {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (cookiesToSet: Array<{ name: string; value: string; options?: unknown }>) => void;
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(
    (
      _url: string,
      _key: string,
      opts: {
        cookies: {
          getAll: () => Array<{ name: string; value: string }>;
          setAll: (cookiesToSet: Array<{ name: string; value: string; options?: unknown }>) => void;
        };
      },
    ) => {
      mocks.capturedCookieAdapter = opts.cookies;
      return { auth: { getUser: mocks.getUser } };
    },
  ),
}));

class MockAuthApiError extends Error {
  __isAuthError = true;
  status = 400;
  code = "refresh_token_not_found";
  constructor() {
    super("Invalid Refresh Token: Refresh Token Not Found");
    this.name = "AuthApiError";
  }
}
class MockAuthSessionMissingError extends Error {
  __isAuthError = true;
  status = 400;
  code = "session_missing";
  constructor() {
    super("Auth session missing");
    this.name = "AuthSessionMissingError";
  }
}

vi.mock("@supabase/supabase-js", () => ({
  isAuthSessionMissingError: (e: unknown): e is MockAuthSessionMissingError =>
    e instanceof MockAuthSessionMissingError,
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: vi.fn(),
}));

// Avoid loading the live env — supabase-server reads clientEnv but the
// proxy's read-write client should obtain URL + anon key the same way the
// existing read-only client does.
vi.mock("@shared/config/client-env", () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
}));

import proxy from "../../src/proxy";

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.capturedCookieAdapter = null;
});

describe("src/proxy.ts — @supabase/ssr middleware refresh (debug session publiclayout-auth-refresh-token-throw)", () => {
  it("calls supabase.auth.getUser() exactly once for `/` (page route)", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new NextRequest("https://example.test/");
    await proxy(request);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("calls supabase.auth.getUser() exactly once for `/auth/login` (the actual repro path)", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new NextRequest("https://example.test/auth/login");
    await proxy(request);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
  });

  it("merges cookies emitted by setAll (e.g. cleared stale sb-*) into the NextResponse", async () => {
    // Simulate auth-js's _recoverAndRefresh path that — on a non-retryable
    // refresh error — calls _removeSession(), which routes through setAll
    // with cleared cookies. The middleware MUST forward those cookies on
    // the response so the browser actually drops the bad cookie.
    mocks.getUser.mockImplementationOnce(async () => {
      mocks.capturedCookieAdapter?.setAll([
        {
          name: "sb-access-token",
          value: "",
          options: { maxAge: 0, path: "/" },
        },
        {
          name: "sb-refresh-token",
          value: "",
          options: { maxAge: 0, path: "/" },
        },
      ]);
      return { data: { user: null }, error: null };
    });

    const request = new NextRequest("https://example.test/", {
      headers: { cookie: "sb-access-token=stale; sb-refresh-token=stale" },
    });
    const response = await proxy(request);
    expect(response).toBeDefined();
    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain("sb-access-token=");
    expect(setCookieHeader).toContain("sb-refresh-token=");
  });

  it("does NOT call supabase.auth.getUser() for `/api/v1/*` (preserves T-02-37 body discipline)", async () => {
    const request = new NextRequest("https://example.test/api/v1/diagnostics/ping");
    await proxy(request);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("does NOT call supabase.auth.getUser() for protected `/api/v1/*` either (route handler authoritative)", async () => {
    const request = new NextRequest("https://example.test/api/v1/some-protected-path", {
      headers: { authorization: "Bearer some-opaque-token" },
    });
    await proxy(request);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("preserves the existing 401 fast-reject for bearerless protected `/api/v1/*`", async () => {
    // `/api/v1/some-protected-path` is NOT on the allowlist (mirrors the
    // existing proxy-body-passthrough test). Bearerless → 401, no supabase.
    const request = new NextRequest("https://example.test/api/v1/some-protected-path");
    const response = await proxy(request);
    expect(response.status).toBe(401);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });

  it("explicitly clears every sb-*-auth-token cookie when getUser returns a non-session-missing error (regression spec auth-cold-start-stale-cookie)", async () => {
    // Empirically @supabase/ssr's onAuthStateChange flush does NOT emit
    // a Set-Cookie clear in the auth-js@2.104.1 + ssr@0.10.2 pair when
    // _recoverAndRefresh fails. The proxy must clear cookies itself.
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: new MockAuthApiError() });
    const request = new NextRequest("https://example.test/", {
      headers: {
        cookie:
          "sb-127-auth-token=stale-blob; sb-127-auth-token.0=chunk0; sb-127-auth-token.1=chunk1; unrelated=keep",
      },
    });
    const response = await proxy(request);
    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toMatch(/sb-127-auth-token=;[^,]*Max-Age=0/);
    expect(setCookieHeader).toMatch(/sb-127-auth-token\.0=;[^,]*Max-Age=0/);
    expect(setCookieHeader).toMatch(/sb-127-auth-token\.1=;[^,]*Max-Age=0/);
    expect(setCookieHeader).not.toMatch(/unrelated=;[^,]*Max-Age=0/);
  });

  it("does NOT clear cookies when getUser returns AuthSessionMissingError (anonymous traffic)", async () => {
    // Pure anonymous traffic with no cookie: getUser resolves with this
    // specific error. Clearing would generate noisy Set-Cookie headers
    // for every page navigation. Predicate must narrow correctly.
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new MockAuthSessionMissingError(),
    });
    const request = new NextRequest("https://example.test/auth/login");
    const response = await proxy(request);
    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).not.toMatch(/sb-[^=]+=;[^,]*Max-Age=0/);
  });
});
