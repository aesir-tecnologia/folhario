import { test, expect } from "@playwright/test";

const URLS = ["/", "/api/v1/diagnostics/ping", "/manifest.webmanifest"] as const;

for (const path of URLS) {
  test(`GET ${path} returns all 5 security headers (D-24 revised, user decision 3)`, async ({
    request,
  }) => {
    const res = await request.get(path);
    expect(res.status()).toBeLessThan(400);

    const headers = res.headers();
    expect(headers["strict-transport-security"]).toBe(
      "max-age=63072000; includeSubDomains; preload",
    );
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["permissions-policy"]).toBeTruthy();
  });
}
