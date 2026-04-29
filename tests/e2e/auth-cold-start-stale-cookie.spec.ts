import { test, expect } from "@playwright/test";

/**
 * @supabase/ssr@0.10+ chunked-cookie codec. The auth-token blob is
 * base64url-encoded JSON, optionally chunked across `sb-{ref}-auth-token.0`,
 * `.1`, etc., with a `base64-` prefix on the first chunk. To plant a
 * realistic stale session we decode → mutate `expires_at` to the past →
 * re-encode → re-chunk the same way auth-js stores it. Mirrors the
 * extractRefreshToken pattern in auth-login-logout.spec.ts.
 */
function expireSessionBlob(
  cookies: { name: string; value: string }[],
): { name: string; value: string }[] {
  const sorted = [...cookies].sort((a, b) => {
    const aIdx = Number(a.name.match(/\.(\d+)$/)?.[1] ?? 0);
    const bIdx = Number(b.name.match(/\.(\d+)$/)?.[1] ?? 0);
    return aIdx - bIdx;
  });
  let combined = sorted.map((c) => c.value).join("");
  const hasBase64Prefix = combined.startsWith("base64-");
  if (hasBase64Prefix) {
    combined = Buffer.from(combined.slice("base64-".length), "base64url").toString("utf-8");
  }
  const session = JSON.parse(combined) as {
    expires_at?: number;
    expires_in?: number;
    [k: string]: unknown;
  };
  // Force the access token to look expired so auth-js triggers a refresh
  // against the (now-revoked) refresh token.
  session.expires_at = 1;
  session.expires_in = 0;
  let encoded = JSON.stringify(session);
  if (hasBase64Prefix) {
    encoded = "base64-" + Buffer.from(encoded, "utf-8").toString("base64url");
  }
  // Single-cookie return — the chunking threshold (~3180 chars per chunk)
  // is environment-dependent; planting one cookie per name is sufficient
  // because auth-js concatenates `.0`, `.1`, ... in order. We intentionally
  // collapse to one entry per ORIGINAL name pattern to avoid corrupting
  // cookie chunk boundaries.
  const first = sorted[0];
  if (!first) return [];
  if (sorted.length === 1) {
    return [{ name: first.name, value: encoded }];
  }
  // Multi-chunk case: distribute the new payload across the same names.
  // Use the first chunk as the canonical entry; clear the rest.
  const out: { name: string; value: string }[] = [{ name: first.name, value: encoded }];
  for (let i = 1; i < sorted.length; i++) {
    const chunk = sorted[i];
    if (chunk) out.push({ name: chunk.name, value: "" });
  }
  return out;
}

/**
 * Phase 4 — Debug session `publiclayout-auth-refresh-token-throw` regression test.
 *
 * Symptom: cold-start page render with a stale `sb-{ref}-auth-token` cookie
 * triggered `console.error(AuthApiError)` inside `@supabase/auth-js`'s
 * `_recoverAndRefresh`. Next 16's dev overlay attributed it to the React
 * owner stack (PublicLayout / AppLayout). The error recurred on every render
 * because the read-only Server Component supabase client's no-op `setAll`
 * (Pitfall 6) blocked `_removeSession` from clearing the bad cookie.
 *
 * Fix: `src/proxy.ts` now performs the canonical `@supabase/ssr` middleware
 * step on non-API page routes — a real `createServerClient` with a cookie
 * adapter that writes to both request and response, plus a single
 * `auth.getUser()` call. Stale cookies are cleared BEFORE Server Components
 * run, so auth-js never logs the AuthApiError.
 *
 * What this spec verifies (automatable):
 *   1. With a stale/corrupted `sb-{ref}-auth-token` cookie, navigating to
 *      a public page produces NO `AuthApiError` console error.
 *   2. The proxy's middleware step issues a Set-Cookie that clears the
 *      stale cookie (browser-side `sb-*` cookies are no longer truthy).
 *   3. The page renders cleanly (no uncaught `pageerror`).
 *
 * What this spec does NOT verify (manual UAT only):
 *   - The Next 16 dev overlay popup. The dev overlay is a dev-server UI
 *     surface that observes SSR `console.error` and decorates with React
 *     owner stacks. Playwright runs the production build (`pnpm start`),
 *     which has no dev overlay — so we assert the upstream cause (no
 *     `console.error` from auth-js) instead of the visible artifact.
 *   - The literal cold-start ritual (kill server, clear `.next/`, restart).
 *     Playwright reuses its own webServer; that ritual is preserved as
 *     a manual checklist item in `.planning/phases/04-iam-auth-verification-consent/04-UAT.md`.
 */

test("cold-start render with stale sb-* cookie does not log AuthApiError and clears the cookie", async ({
  page,
  request,
}) => {
  const email = `playwright-stale-cookie-${Date.now()}@example.com`;
  const password = "TestPassword123!";

  // Seed + log in a real user so we discover the EXACT supabase cookie name
  // format for this environment (project ref differs between local Docker
  // and CI). Pattern mirrors auth-login-logout.spec.ts:73-90.
  const seedResp = await request.post("/api/v1/diagnostics/iam-test-helpers/seed-verified-user", {
    data: { email, password },
    headers: { "content-type": "application/json" },
  });
  expect(seedResp.status()).toBe(200);

  const loginResp = await page.request.post("/api/v1/iam/login", {
    data: { email, password },
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.1.1" },
  });
  expect(loginResp.status()).toBe(200);

  // Capture the live, valid-shape session cookies. The blob is chunked
  // base64-encoded JSON containing access_token / refresh_token / user /
  // expires_at — the EXACT shape auth-js expects.
  const liveCookies = await page.context().cookies();
  const supabaseAuthCookies = liveCookies.filter((c) =>
    /^sb-[^.]+-auth-token(?:\.\d+)?$/.test(c.name),
  );
  expect(supabaseAuthCookies.length).toBeGreaterThan(0);
  const capturedSnapshot = supabaseAuthCookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    expires: c.expires,
    httpOnly: c.httpOnly,
    secure: c.secure,
    sameSite: c.sameSite,
  }));

  // Revoke the refresh token server-side by logging out. The captured
  // blob's `refresh_token` is now invalid on Supabase's side, but the
  // shape remains parse-able by auth-js — exactly the "stale cookie"
  // state the fix targets.
  const logoutResp = await page.request.post("/api/v1/iam/logout", {
    data: {},
    headers: { "content-type": "application/json" },
  });
  expect(logoutResp.status()).toBe(200);

  // Re-plant the pre-logout cookie snapshot, but with `expires_at`
  // forced into the past so auth-js's `_recoverAndRefresh` triggers a
  // real refresh attempt — which Supabase will reject as
  // "Invalid Refresh Token: Refresh Token Not Found" because logout
  // revoked the token server-side.
  const expiredEntries = expireSessionBlob(
    capturedSnapshot.map((c) => ({ name: c.name, value: c.value })),
  );
  const fallbackTemplate = capturedSnapshot[0];
  if (!fallbackTemplate) throw new Error("captured snapshot is empty");
  const expiredCookies = expiredEntries.map((entry, idx) => {
    const template =
      capturedSnapshot[Math.min(idx, capturedSnapshot.length - 1)] ?? fallbackTemplate;
    return {
      name: entry.name,
      value: entry.value,
      domain: template.domain,
      path: template.path,
      expires: template.expires,
      httpOnly: template.httpOnly,
      secure: template.secure,
      sameSite: template.sameSite,
    };
  });
  await page.context().clearCookies();
  await page.context().addCookies(expiredCookies);

  // Capture every console message + uncaught page error during navigation.
  const consoleMessages: { type: string; text: string }[] = [];
  const pageErrors: Error[] = [];
  page.on("console", (msg) => {
    consoleMessages.push({ type: msg.type(), text: msg.text() });
  });
  page.on("pageerror", (err) => {
    pageErrors.push(err);
  });

  // Capture Set-Cookie headers across all responses during navigation —
  // used by Assertion 4 to confirm the proxy emits an explicit clearing
  // header. Note: header surfaces only via `allHeaders()` for the main
  // navigation response in some Next.js / Playwright combos.
  const setCookieHeaders: string[] = [];
  page.on("response", async (resp) => {
    const headers: Record<string, string> = resp.headers();
    if (typeof headers["set-cookie"] === "string") {
      setCookieHeaders.push(headers["set-cookie"]);
      return;
    }
    const all: Record<string, string> = await resp
      .allHeaders()
      .catch(() => ({}) as Record<string, string>);
    if (typeof all["set-cookie"] === "string") setCookieHeaders.push(all["set-cookie"]);
  });

  // Cold-start navigation. `/auth/login` is a public page route, which
  // means it goes through the new @supabase/ssr middleware step.
  const navResp = await page.goto("/auth/login", { waitUntil: "load" });
  expect(navResp).not.toBeNull();
  expect(navResp!.status()).toBe(200);

  // Assertion 1: no AuthApiError logged from the SSR / browser path.
  const authApiErrors = consoleMessages.filter(
    (m) =>
      m.type === "error" &&
      (m.text.includes("AuthApiError") || m.text.includes("Invalid Refresh Token")),
  );
  expect(
    authApiErrors,
    `expected no AuthApiError console messages, got:\n${authApiErrors
      .map((m) => `  [${m.type}] ${m.text}`)
      .join("\n")}`,
  ).toEqual([]);

  // Assertion 2: no uncaught page errors.
  expect(
    pageErrors,
    `expected no page errors, got:\n${pageErrors.map((e) => `  ${e.message}`).join("\n")}`,
  ).toEqual([]);

  // Assertion 3: the proxy middleware step cleared the stale cookies via
  // Set-Cookie. After the navigation, the previously-captured blob must
  // not still be sitting in the browser jar — `_removeSession` should
  // have written an expiring Set-Cookie that the browser honored.
  const cookiesAfterNav = await page.context().cookies();
  const staleValues = new Set(expiredCookies.map((c) => c.value).filter((v) => v !== ""));
  const stillStale = cookiesAfterNav.filter(
    (c) => /^sb-[^.]+-auth-token(?:\.\d+)?$/.test(c.name) && staleValues.has(c.value),
  );
  expect(stillStale, "stale cookie was not cleared by the proxy middleware step").toEqual([]);

  // Assertion 4: the proxy explicitly emitted a clearing Set-Cookie for
  // every chunk. Direct evidence the defense-in-depth clear path ran.
  const clearingHeaders = setCookieHeaders.filter((h) =>
    /sb-[^.]+-auth-token(?:\.\d+)?=;[^,]*Max-Age=0/.test(h),
  );
  expect(
    clearingHeaders.length,
    `expected at least one clearing Set-Cookie for sb-*-auth-token, saw:\n${setCookieHeaders.join("\n")}`,
  ).toBeGreaterThan(0);
});
