import { describe, expect, it } from "vitest";

process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";
process.env.IDENTIFICATION_PROVIDER_MODE ??= "stub";

import { NextRequest } from "next/server";

import proxy from "../../src/proxy";

/**
 * Plan 02-07 Task 3 — Wave-5 contract test for the proxy auth boundary.
 *
 * At wave 5 the only `/api/v1/*` route file present in this repo is
 * `src/app/api/v1/diagnostics/ping/route.ts` (Plan 01-07). The proxy must:
 *
 *   a) Allow public allowlisted paths through without a bearer (200/next).
 *      The allowlist is anchored regex (T-02-38 mitigation), e.g.
 *      `/^\/api\/v1\/diagnostics\/ping$/`, so accidental drift like
 *      `/api/v1/diagnostics/ping/extra` is NOT public.
 *
 *   b) Reject any other `/api/v1/*` path WITHOUT a bearer with HTTP 401
 *      and the closed `unauthenticated` error shape, BEFORE Next's
 *      router decides whether the route exists. This is what the proxy
 *      tier owns — the real cryptographic JWT check happens in route
 *      helpers (D-34/D-47).
 *
 * Because Plan 09 owns the consent POST route (where end-to-end body
 * passthrough through a real protected route is asserted), this file
 * stays at the proxy boundary only and uses any not-yet-wired
 * `/api/v1/*` path to assert the 401 contract.
 */

describe("src/proxy.ts — wave-5 auth boundary contract", () => {
  it("allows public allowlisted /api/v1/diagnostics/ping through without a bearer", async () => {
    const request = new NextRequest("https://example.test/api/v1/diagnostics/ping", {
      method: "GET",
    });
    const response = await proxy(request);
    expect(response).toBeDefined();
    // NextResponse.next() yields a response with no body and no 401 status.
    // Allow either undefined status (depending on NextResponse.next() shape)
    // or 200; the load-bearing assertion is "not 401".
    expect(response?.status).not.toBe(401);
  });

  it("rejects an anchored-allowlist drift path with 401 (e.g. /api/v1/diagnostics/ping/extra)", async () => {
    // Anchored regex MUST NOT match /api/v1/diagnostics/ping/extra. Without
    // the anchor, a startsWith-style match would let this drift through.
    const request = new NextRequest(
      "https://example.test/api/v1/diagnostics/ping/extra",
      { method: "GET" },
    );
    const response = await proxy(request);
    expect(response?.status).toBe(401);
  });

  it("rejects any not-yet-wired /api/v1/* path WITHOUT a bearer with 401 from the proxy", async () => {
    // Wave-5 contract: the proxy 401 must fire BEFORE Next's router decides
    // whether the route file exists. This path intentionally has no route
    // file — the 401 below is from the proxy, not a Next 404.
    const request = new NextRequest(
      "https://example.test/api/v1/some/non-existent-path",
      { method: "GET" },
    );
    const response = await proxy(request);
    expect(response?.status).toBe(401);
    // Closed error registry shape: { error: { code: "unauthenticated", ... } }
    const body = await response?.json();
    expect(body?.error?.code).toBe("unauthenticated");
  });

  it("passes /api/v1/* requests carrying any Bearer header through (route helper does crypto)", async () => {
    // Proxy intentionally does NOT verify the JWT cryptographically — that
    // is the route helper's job (T-02-18 mitigation). A garbage Bearer must
    // still pass the proxy tier; it gets rejected at the route layer.
    const request = new NextRequest(
      "https://example.test/api/v1/some/protected-path",
      {
        method: "GET",
        headers: { authorization: "Bearer not-cryptographically-valid" },
      },
    );
    const response = await proxy(request);
    expect(response?.status).not.toBe(401);
  });

  it("does NOT inspect non-/api/v1 paths (page routes, _next, static)", async () => {
    // Sanity: the proxy must not gate page routes or framework assets.
    // The plan adds /api/v1/:path* to the matcher; non-API routes still
    // pass through (or are excluded from the matcher entirely).
    const request = new NextRequest("https://example.test/diag", { method: "GET" });
    const response = await proxy(request);
    expect(response?.status).not.toBe(401);
  });
});
