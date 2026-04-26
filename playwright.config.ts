import { defineConfig, devices } from "@playwright/test";

/**
 * Plan 02-09 Task 3 — wire `globalSetup` so the E2E suite has a
 * deterministic test JWKS server up before the Next webServer starts
 * (T-02-40 mitigation: the positive-token Playwright path cannot
 * silently skip on missing JWKS).
 *
 * `webServer.env.AUTH_JWKS_OVERRIDE_URL` mirrors the URL the global
 * setup binds to. The AuthAdapter factory (Plan 02-07, hooked in 02-09
 * Task 3) reads this env var at construction time and prefers it over
 * the default Supabase URL.
 */

const TEST_JWKS_URL = "http://127.0.0.1:4567/auth/v1/.well-known/jwks.json";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "list",

  globalSetup: "./tests/e2e/global-setup.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "pnpm start",
    url: "http://localhost:3000/",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      IDENTIFICATION_PROVIDER_MODE: "stub",
      AUTH_JWKS_OVERRIDE_URL: TEST_JWKS_URL,
    },
  },
});
