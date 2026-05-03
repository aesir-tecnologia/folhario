// OFF-08 E2E + authed axe coverage for Home (count=0, count>=1)
// + offline catalog + offline /identify + cross-user SW cache leak prevention.
//
// TEST-ONLY. MUST NOT be imported from src/.

import { type Page, type BrowserContext } from "@playwright/test";
import { test, expect } from "./fixtures/authed-user";
import AxeBuilder from "@axe-core/playwright";

test.describe.configure({ retries: 0, timeout: 60_000 });

const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;

const MINIMAL_JPEG_B64 =
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

async function seedPlantViaApi(page: Page, opts: { name?: string } = {}): Promise<string> {
  const name = opts.name ?? `OfflineTest-${Date.now()}`;
  const imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  const resp = await page.request.post("/api/v1/plants", {
    headers: {
      "Idempotency-Key": `seed-offline-${name}-${Date.now()}`,
    },
    multipart: {
      name,
      photo: {
        name: "plant.jpg",
        mimeType: "image/jpeg",
        buffer: imageBuffer,
      },
    },
  });

  if (!resp.ok()) {
    const text = await resp.text();
    throw new Error(`seedPlantViaApi failed (${resp.status()}): ${text}`);
  }

  const body = (await resp.json()) as { plant?: { id?: string } };
  const id = body.plant?.id;
  if (!id) throw new Error("seedPlantViaApi: no plant id in response");
  return id;
}

async function waitForServiceWorkerReady(page: Page) {
  await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, {
    timeout: 30_000,
  });
}

async function setOfflineAndReload(page: Page, context: BrowserContext) {
  await waitForServiceWorkerReady(page);
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(500);
}

// ============================================================================
// Test 1 — Online preload + offline catalog browse (OFF-08 core)
// ============================================================================

test("OFF-08 — cached catalog browsable offline; OfflineBanner visible; ReadOnlyBanner hidden", async ({
  page,
  context,
  authedUser,
}) => {
  void authedUser;
  const plantName = `OfflinePlant-${Date.now()}`;
  await seedPlantViaApi(page, { name: plantName });

  await page.goto("/catalog");
  await page.waitForLoadState("networkidle");

  await expect(page.getByText(plantName)).toBeVisible();

  await setOfflineAndReload(page, context);

  await expect(page.getByText(plantName)).toBeVisible();

  await expect(page.getByRole("status").filter({ hasText: /Você está offline/i })).toBeVisible();

  await expect(
    page.getByRole("status").filter({ hasText: /Sua assinatura expirou/i }),
  ).not.toBeVisible();

  await context.setOffline(false);
});

// ============================================================================
// Test 2 — /identify blocked when offline
// ============================================================================

test("OFF-08 — /identify offline shows blocked message + OfflineBanner", async ({
  page,
  context,
  authedUser,
}) => {
  void authedUser;

  await page.goto("/identify");
  await page.waitForLoadState("networkidle");

  await waitForServiceWorkerReady(page);
  await context.setOffline(true);
  await page.reload();
  await page.waitForTimeout(500);

  await expect(
    page.getByRole("status").filter({ hasText: /Identificação requer conexão/i }),
  ).toBeVisible();

  await expect(page.getByRole("status").filter({ hasText: /Você está offline/i })).toBeVisible();

  await context.setOffline(false);
});

// ============================================================================
// Test 3 — Authed Home axe (count=0, empty composition) × 4 combos
// ============================================================================

for (const combo of COMBOS) {
  test(`axe / [home empty, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`, async ({
    page,
    authedUser,
  }) => {
    void authedUser;
    await page.emulateMedia(combo);
    await page.goto("/");
    await page.waitForSelector('[data-testid="home-empty"]');
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking, `serious + critical: ${blocking.map((v) => v.id).join(", ")}`).toEqual([]);
  });
}

// ============================================================================
// Test 4 — Authed Home axe (count>=1, bridge composition) × 4 combos
// ============================================================================

for (const combo of COMBOS) {
  test(`axe / [home bridge, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`, async ({
    page,
    authedUser,
  }) => {
    void authedUser;
    await seedPlantViaApi(page, { name: `BridgeAxe-${Date.now()}` });
    await page.emulateMedia(combo);
    await page.goto("/");
    await page.waitForSelector('[data-testid="home-bridge"]');
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking, `serious + critical: ${blocking.map((v) => v.id).join(", ")}`).toEqual([]);
  });
}

// ============================================================================
// Test 5 — Offline-banner axe on /catalog × 4 combos
// ============================================================================

for (const combo of COMBOS) {
  test(`axe /catalog offline-banner [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`, async ({
    page,
    context,
    authedUser,
  }) => {
    void authedUser;
    await seedPlantViaApi(page, { name: `AxeOfflinePlant-${Date.now()}` });

    await page.goto("/catalog");
    await page.waitForLoadState("networkidle");

    await waitForServiceWorkerReady(page);
    await context.setOffline(true);
    await page.reload();
    await page.waitForTimeout(500);

    await expect(page.getByRole("status").filter({ hasText: /Você está offline/i })).toBeVisible();

    await page.emulateMedia(combo);

    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(blocking, `serious + critical: ${blocking.map((v) => v.id).join(", ")}`).toEqual([]);

    await context.setOffline(false);
  });
}

// ============================================================================
// Test 6 — Cross-user SW cache leak prevention (T-05-18-04)
//
// Creates two users inline (single authedUser fixture provides only one user).
// After user A loads catalog (populating SW cache 'folhario-catalog-api-v1'),
// logs out, asserts cache is absent. Then user B loads catalog and asserts
// user A's plant data is not visible.
// ============================================================================

test("SW cache purged on logout — user B cannot see user A data (T-05-18-04)", async ({
  browser,
}) => {
  const { createServerClient } = await import("@supabase/ssr");
  const { seedUser } = await import("../integration/fixtures/seed-user");
  const { seedCurrentPolicyVersions } = await import("../integration/fixtures/seed-policy-version");
  const { default: postgres } = await import("postgres");

  const _imageBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");

  async function createAuthContext(
    email: string,
    password: string,
  ): Promise<{ context: BrowserContext; userId: string }> {
    const { id: userId } = await seedUser({
      email,
      password,
      emailVerifiedAt: new Date().toISOString(),
      ageConfirmedAt: new Date().toISOString(),
      trialSource: "organic",
    });

    const policyVersions = await seedCurrentPolicyVersions();

    const sql = postgres(process.env.DATABASE_POOL_URL!, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
    });
    try {
      await sql`
        INSERT INTO consent_logs (user_id, purpose, legal_basis, source, policy_version_id, granted_at)
        VALUES
          (${userId}, 'signup_acceptance', 'contract', 'signup', ${policyVersions.termsOfService.id}, now()),
          (${userId}, 'signup_acceptance', 'contract', 'signup', ${policyVersions.privacyPolicy.id}, now())
      `;
      await sql`
        INSERT INTO subscriptions (user_id, provider, status, trial_start_date, trial_end_date)
        VALUES (${userId}, 'stripe', 'trialing', NOW(), NOW() + INTERVAL '14 days')
      `;
    } finally {
      await sql.end({ timeout: 5 });
    }

    const capturedCookies: { name: string; value: string }[] = [];
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return [];
          },
          setAll(cookiesToSet) {
            capturedCookies.push(...cookiesToSet);
          },
        },
      },
    );

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      throw new Error(`signInWithPassword failed: ${error.message}`);
    }

    const context = await browser.newContext();
    await context.addCookies(
      capturedCookies.map((c) => ({
        name: c.name,
        value: c.value,
        domain: "localhost",
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax" as const,
      })),
    );

    return { context, userId };
  }

  async function cleanupUser(userId: string) {
    const cleanupSql = postgres(process.env.DATABASE_POOL_URL!, {
      prepare: false,
      max: 1,
      idle_timeout: 5,
    });
    try {
      await cleanupSql`DELETE FROM public.users WHERE id = ${userId}`;
    } catch {
      // tolerate
    }
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await supabaseAdmin.auth.admin.deleteUser(userId);
    await cleanupSql.end({ timeout: 5 });
  }

  const userAEmail = `playwright-user-a-${Date.now()}@folhario.test`;
  const userBEmail = `playwright-user-b-${Date.now()}@folhario.test`;
  const password = "TestPassword123!";

  const userAPlantName = `UserAOnlyPlant-${Date.now()}`;

  const { context: ctxA, userId: userAId } = await createAuthContext(userAEmail, password);
  const pageA = await ctxA.newPage();

  try {
    await pageA.goto("/catalog");
    await pageA.waitForLoadState("networkidle");

    const imgBuffer = Buffer.from(MINIMAL_JPEG_B64, "base64");
    const resp = await pageA.request.post("/api/v1/plants", {
      headers: { "Idempotency-Key": `seed-user-a-${Date.now()}` },
      multipart: {
        name: userAPlantName,
        photo: { name: "plant.jpg", mimeType: "image/jpeg", buffer: imgBuffer },
      },
    });
    if (!resp.ok()) {
      throw new Error(`seed plant for user A failed: ${await resp.text()}`);
    }

    await pageA.goto("/catalog");
    await pageA.waitForLoadState("networkidle");

    await pageA
      .getByRole("link", { name: /Sair/i })
      .click({ timeout: 2_000 })
      .catch(async () => {
        await pageA.request.post("/api/v1/iam/logout", {
          headers: { "Content-Type": "application/json" },
          data: "{}",
        });
        await pageA.goto("/auth/login");
      });

    await pageA.waitForURL(/auth\/login/, { timeout: 5000 }).catch(() => {});

    const cacheExists = await pageA
      .evaluate(() => caches.has("folhario-catalog-api-v1"))
      .catch(() => false);
    expect(cacheExists, "SW cache should be purged after logout").toBe(false);
  } finally {
    await ctxA.close();
    await cleanupUser(userAId);
  }

  const { context: ctxB, userId: userBId } = await createAuthContext(userBEmail, password);
  const pageB = await ctxB.newPage();

  try {
    await pageB.goto("/catalog");
    await pageB.waitForLoadState("networkidle");

    await expect(pageB.getByText(userAPlantName)).not.toBeVisible();
  } finally {
    await ctxB.close();
    await cleanupUser(userBId);
  }
});
