import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import proxy from "../../src/proxy";

/**
 * Plan 02-07 Task 3 — proxy body non-consumption (T-02-37 mitigation).
 *
 * The Next 16 proxy at `src/proxy.ts` MUST NOT read or stream the request
 * body. If it did, downstream route handlers would be unable to call
 * `request.json()` or `request.formData()` because the underlying stream
 * can only be consumed once.
 *
 * This UNIT test drives a NextRequest carrying a JSON body through the
 * proxy directly (no HTTP, no downstream route, no dependency on any plan
 * later than 02-07) and asserts the body stream is still readable after
 * the proxy returns. The end-to-end equivalent (real protected POST route
 * parsing the body) is asserted in Plan 09.
 *
 * Two complementary cases:
 *   1. With a valid Bearer header → proxy must call NextResponse.next()
 *      AND must not consume the body.
 *   2. With NO Authorization header on a protected path → proxy must
 *      return a 401 response, AND the body must remain untouched (route
 *      logging or error handlers may still want to read it).
 */

function makeJsonPostRequest(opts: { url: string; auth?: string }): NextRequest {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.auth) headers.authorization = opts.auth;
  return new NextRequest(opts.url, {
    method: "POST",
    headers,
    body: JSON.stringify({ foo: "bar" }),
  });
}

describe("src/proxy.ts — body passthrough discipline (T-02-37)", () => {
  it("does NOT consume the body when a valid Bearer is present", async () => {
    const request = makeJsonPostRequest({
      url: "https://example.test/api/v1/some-protected-path",
      auth: "Bearer opaque-token-not-cryptographically-checked-here",
    });
    const response = await proxy(request);
    // Proxy must pass through (NextResponse.next() shape) — assertion below
    // is structural: a response object exists and is not the 401 shape.
    expect(response).toBeDefined();
    // Primary assertion (advisor guidance): bodyUsed remains false.
    expect(request.bodyUsed).toBe(false);
    // Secondary assertion: the body is still readable end-to-end.
    const body = await request.json();
    expect(body).toEqual({ foo: "bar" });
  });

  it("does NOT consume the body when rejecting a missing-bearer protected request", async () => {
    const request = makeJsonPostRequest({
      url: "https://example.test/api/v1/some-protected-path",
      // No auth header at all.
    });
    const response = await proxy(request);
    expect(response).toBeDefined();
    expect(response?.status).toBe(401);
    // Even on 401 rejection, the body stream must remain untouched.
    expect(request.bodyUsed).toBe(false);
    const body = await request.json();
    expect(body).toEqual({ foo: "bar" });
  });

  it("does NOT consume the body when the request hits a public allowlisted path", async () => {
    const request = makeJsonPostRequest({
      url: "https://example.test/api/v1/diagnostics/ping",
      // No auth needed — public allowlist.
    });
    const response = await proxy(request);
    expect(response).toBeDefined();
    expect(request.bodyUsed).toBe(false);
  });
});
