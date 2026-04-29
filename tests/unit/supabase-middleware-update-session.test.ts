import { describe, expect, it, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Plan 04-12 Task 1 — `updateSessionInMiddleware` helper contract.
 *
 * The helper lives inside `src/contexts/iam/infrastructure/supabase-server.ts`
 * (the IAM infrastructure boundary that owns `@supabase/ssr` per Codex HIGH
 * #3) and is consumed by `src/proxy.ts` for every non-API page request. It
 * implements the canonical `@supabase/ssr` Next.js middleware cookie-refresh
 * pattern, plus the second-pass explicit-cookie-clear from the
 * `publiclayout-auth-refresh-token-throw` debug session (which proved that
 * `@supabase/ssr@0.10.2` + `@supabase/auth-js@2.104.1` does NOT propagate a
 * clearing Set-Cookie when `_recoverAndRefresh` fails).
 *
 * The four assertions below mirror the behaviors from the plan:
 *   1. createServerClient is invoked exactly once with the request's cookie
 *      adapter, and `supabase.auth.getUser()` is called exactly once.
 *   2. cookies returned via `setAll(cookiesToSet)` are merged into BOTH
 *      `request.cookies` and the returned `NextResponse.cookies`.
 *   3. T-02-37 body discipline preserved — the helper does not consume the
 *      request body.
 *   4. Boundary preserved — the helper consumes only `request.cookies`,
 *      never `next/headers` (the middleware runtime has no cookies()/headers()
 *      async store).
 */

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerClient: vi.fn(),
  capturedCookieAdapter: null as null | {
    getAll: () => Array<{ name: string; value: string }>;
    setAll: (cookiesToSet: Array<{ name: string; value: string; options?: unknown }>) => void;
  },
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient.mockImplementation(
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

vi.mock("@shared/config/client-env", () => ({
  clientEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.test.supabase.co",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-anon-key",
  },
}));

import { updateSessionInMiddleware } from "@contexts/iam/infrastructure/supabase-server";

beforeEach(() => {
  mocks.getUser.mockReset();
  mocks.createServerClient.mockClear();
  mocks.capturedCookieAdapter = null;
});

describe("updateSessionInMiddleware (plan 04-12)", () => {
  it("calls createServerClient once and supabase.auth.getUser() once", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new NextRequest("https://example.test/auth/login");
    const response = await updateSessionInMiddleware(request);

    expect(response).toBeDefined();
    expect(mocks.createServerClient).toHaveBeenCalledTimes(1);
    expect(mocks.getUser).toHaveBeenCalledTimes(1);
    expect(mocks.capturedCookieAdapter).not.toBeNull();
  });

  it("merges cookies returned via setAll into BOTH request.cookies and response.cookies", async () => {
    // Drive setAll directly to simulate auth-js's refresh path that wants to
    // write refreshed/cleared cookies. The helper must propagate them onto
    // both surfaces: request.cookies (so downstream code in the same request
    // sees the new state) and response.cookies (so the browser receives
    // Set-Cookie).
    mocks.getUser.mockImplementationOnce(async () => {
      mocks.capturedCookieAdapter?.setAll([
        {
          name: "sb-access-token",
          value: "fresh-access",
          options: { path: "/", httpOnly: true },
        },
        {
          name: "sb-refresh-token",
          value: "fresh-refresh",
          options: { path: "/", httpOnly: true },
        },
      ]);
      return { data: { user: null }, error: null };
    });

    const request = new NextRequest("https://example.test/", {
      headers: { cookie: "sb-access-token=stale; sb-refresh-token=stale" },
    });
    const response = await updateSessionInMiddleware(request);

    // Response carries the new Set-Cookie header.
    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toContain("sb-access-token=fresh-access");
    expect(setCookieHeader).toContain("sb-refresh-token=fresh-refresh");

    // Request cookies are also updated (so any downstream handler in the
    // same Edge request reads the refreshed state).
    expect(request.cookies.get("sb-access-token")?.value).toBe("fresh-access");
    expect(request.cookies.get("sb-refresh-token")?.value).toBe("fresh-refresh");
  });

  it("does NOT consume the request body (T-02-37 body discipline)", async () => {
    mocks.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const request = new NextRequest("https://example.test/some-page", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ foo: "bar" }),
    });

    await updateSessionInMiddleware(request);

    expect(request.bodyUsed).toBe(false);
    const body = await request.json();
    expect(body).toEqual({ foo: "bar" });
  });

  it("explicitly clears every sb-*-auth-token chunk on a non-AuthSessionMissingError refresh failure (debug session second-pass fix)", async () => {
    // @supabase/ssr@0.10.2 + @supabase/auth-js@2.104.1 do NOT emit a
    // clearing Set-Cookie via setAll when _recoverAndRefresh fails — the
    // helper itself must clear cookies. Regression coverage for commit
    // fc820f7.
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new MockAuthApiError(),
    });
    const request = new NextRequest("https://example.test/", {
      headers: {
        cookie:
          "sb-127-auth-token=stale-blob; sb-127-auth-token.0=chunk0; sb-127-auth-token.1=chunk1; unrelated=keep",
      },
    });

    const response = await updateSessionInMiddleware(request);
    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).toMatch(/sb-127-auth-token=;[^,]*Max-Age=0/);
    expect(setCookieHeader).toMatch(/sb-127-auth-token\.0=;[^,]*Max-Age=0/);
    expect(setCookieHeader).toMatch(/sb-127-auth-token\.1=;[^,]*Max-Age=0/);
    expect(setCookieHeader).not.toMatch(/unrelated=;[^,]*Max-Age=0/);
  });

  it("does NOT clear cookies when getUser returns AuthSessionMissingError (anonymous traffic)", async () => {
    // Anonymous-visitor return shape — every public-page anonymous render
    // produces this. The narrow predicate must skip clearing here so we
    // don't emit pointless Set-Cookie noise.
    mocks.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: new MockAuthSessionMissingError(),
    });
    const request = new NextRequest("https://example.test/auth/login");

    const response = await updateSessionInMiddleware(request);
    const setCookieHeader = response.headers.get("set-cookie") ?? "";
    expect(setCookieHeader).not.toMatch(/sb-[^=]+=;[^,]*Max-Age=0/);
  });
});
