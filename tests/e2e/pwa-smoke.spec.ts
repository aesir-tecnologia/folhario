import { test, expect } from "@playwright/test";

test("GET /manifest.webmanifest returns valid JSON with display:standalone + theme_color", async ({
  request,
}) => {
  const res = await request.get("/manifest.webmanifest");
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.display).toBe("standalone");
  expect(body.theme_color).toBeTruthy();
  expect(body.name).toBeTruthy();
  expect(body.short_name).toBeTruthy();
});

test("GET /sw.js returns a JavaScript response (Serwist skeleton)", async ({ request }) => {
  const res = await request.get("/sw.js");
  expect(res.status()).toBe(200);
  const contentType = res.headers()["content-type"] ?? "";
  expect(contentType.toLowerCase()).toContain("javascript");
});
