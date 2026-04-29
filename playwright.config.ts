import { readFileSync } from "node:fs";

import { defineConfig, devices } from "@playwright/test";

// Phase 04 UAT add-tests batch — load .env.local into process.env so spec
// workers (which inherit env from this config process) can hit the local
// Supabase Postgres directly for DB assertions in specs like
// auth-signup-active-partner-code and auth-login-rate-limit-trip. We use
// an inline parser instead of a `dotenv` import because `dotenv` is not a
// declared dependency. Existing env wins over the file (CI sets vars
// directly, so this no-ops in CI).
function loadEnvLocalQuiet(): void {
  let raw: string;
  try {
    raw = readFileSync(".env.local", "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/i.exec(line);
    if (!m) continue;
    const key = m[1]!;
    if (process.env[key] !== undefined) continue;
    let value = m[2]!;
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadEnvLocalQuiet();

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
 *
 * WR-01 hooks: `AUTH_AUDIENCE_OVERRIDE` / `AUTH_ISSUER_OVERRIDE` mirror
 * the constants in `tests/e2e/fixtures/test-jwks.ts` so the running
 * Next server pins the same audience and issuer the spec's signed JWTs
 * carry. Without these the Next adapter would default to the Supabase
 * URL-derived issuer and reject every test JWT.
 */

const TEST_JWKS_URL = "http://127.0.0.1:4567/auth/v1/.well-known/jwks.json";
const TEST_AUDIENCE = "authenticated";
const TEST_ISSUER = "https://folhario-test.invalid/auth/v1";

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

  // Phase 3 Plan 05 — visual-snapshot defaults per Open Risk #5.
  // Local macOS Apple-system fonts render differently from CI Ubuntu DejaVu;
  // baselines are generated via Docker (`pnpm visual:baseline:docker`) and
  // committed once. `maxDiffPixels: 100` absorbs sub-pixel anti-aliasing drift.
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      maxDiffPixels: 100,
    },
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
      AUTH_AUDIENCE_OVERRIDE: TEST_AUDIENCE,
      AUTH_ISSUER_OVERRIDE: TEST_ISSUER,
      // HIGH 2 + Open Risk #8 (codex review) — opt the playwright job into
      // the gated /modal-sheet test route + the iam-test-helpers diagnostics
      // routes. Production builds without this env var call notFound()
      // on /modal-sheet (route group `(test)` does NOT hide URLs).
      // Phase 04 review WR-08: var is server-only (no NEXT_PUBLIC_ prefix)
      // so its value never enters the client bundle.
      ENABLE_TEST_ROUTES: "1",
      // Phase 4 plan 04-10 — Rule 3 fix: with no INNGEST_EVENT_KEY set, the
      // Inngest SDK under NODE_ENV=production tries to deliver to the Inngest
      // cloud and any route that calls `inngest.send` (signup, forgot-password,
      // oauth-complete, etc.) 500s when delivery fails. Forcing INNGEST_DEV=1
      // routes events to the local dev server (npx inngest-cli dev) when one
      // is running and no-ops otherwise. Mirrors `pnpm dev` behavior.
      INNGEST_DEV: "1",
    },
  },
});
