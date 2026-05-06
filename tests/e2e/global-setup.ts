import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { FullConfig } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { exportPKCS8 } from "jose";

import { createTestJwks, getTestPrivateKey } from "./fixtures/test-jwks";

/**
 * Plan 02-09 Task 3 — Playwright global setup.
 *
 * Threat T-02-40 mitigation: any "JWKS empty or unreachable" path that
 * silently bypassed the run would turn the only positive-auth real-HTTP
 * signal in the phase into a no-op. This file therefore:
 *
 *   1. Generates a deterministic test JWKS via the shared fixture.
 *   2. Stands up a local HTTP server publishing it on a fixed port.
 *   3. Validates the endpoint by fetching its own URL once before
 *      letting Playwright spawn the Next webServer.
 *   4. THROWS on any failure so the entire E2E run aborts before a
 *      single spec executes — there is NO bypass branch for "JWKS
 *      missing" anywhere in the suite.
 *   5. Seeds a deterministic test users row and writes the private
 *      key + JWKS to `tests/e2e/.tmp-jwks.json` so the spec can
 *      reconstruct a matching JWT without sharing module state with
 *      this file.
 *
 * The Next server reads `AUTH_JWKS_OVERRIDE_URL` (Plan 02-09 Task 3
 * hook in src/contexts/iam/infrastructure/auth/auth-adapter.ts) and
 * uses our test JWKS in place of the Supabase URL. That env var is
 * set on `webServer.env` in `playwright.config.ts` — NOT here —
 * because Playwright forks the webServer process before global-setup
 * completes, so writing to `process.env` here is too late.
 */

// Deterministic port so playwright.config.ts can reference the same value
// in webServer.env without dynamic discovery.
export const TEST_JWKS_PORT = 4567;
export const TEST_JWKS_PATH = "/auth/v1/.well-known/jwks.json";
export const TEST_JWKS_URL = `http://127.0.0.1:${TEST_JWKS_PORT}${TEST_JWKS_PATH}`;

// Deterministic test user UUID. Specs sign JWTs with this `sub`.
export const TEST_USER_ID = "00000000-0000-4000-8000-0000000000a9";
export const TEST_USER_EMAIL = "e2e-consent@folhario.test";

export const TEST_KEY_DUMP_PATH = join(process.cwd(), "tests", "e2e", ".tmp-jwks.json");

let activeServer: Server | undefined;

function publishJwks(jwksJson: string): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (!req.url) {
        res.writeHead(400);
        res.end();
        return;
      }
      if (req.url === TEST_JWKS_PATH || req.url.startsWith(TEST_JWKS_PATH)) {
        res.writeHead(200, {
          "content-type": "application/json",
          "cache-control": "public, max-age=1",
        });
        res.end(jwksJson);
        return;
      }
      res.writeHead(404);
      res.end();
    });
    server.on("error", reject);
    server.listen(TEST_JWKS_PORT, "127.0.0.1", () => {
      const addr = server.address() as AddressInfo;
      if (addr.port !== TEST_JWKS_PORT) {
        reject(new Error(`globalSetup: bound to port ${addr.port} but expected ${TEST_JWKS_PORT}`));
        return;
      }
      resolve(server);
    });
  });
}

async function seedTestUser(databaseUrl: string): Promise<void> {
  // auth.users row required for getUserById INNER JOIN
  const { createClient } = await import("@supabase/supabase-js");
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  await supabaseAdmin.auth.admin.deleteUser(TEST_USER_ID).catch(() => {});
  const { error: authErr } = await supabaseAdmin.auth.admin.createUser({
    id: TEST_USER_ID,
    email: TEST_USER_EMAIL,
    email_confirm: true,
  });
  if (authErr) throw new Error(`globalSetup: createUser failed: ${authErr.message}`);

  const postgresMod = await import("postgres");
  const postgres = postgresMod.default;
  const sql = postgres(databaseUrl, { prepare: false, max: 1, idle_timeout: 5 });
  try {
    await sql`
      INSERT INTO public.users (id, email, name, timezone, trial_source)
      VALUES (
        ${TEST_USER_ID}::uuid,
        ${TEST_USER_EMAIL},
        ${"Folhário E2E Test User"},
        ${"America/Sao_Paulo"},
        ${"organic"}
      )
      ON CONFLICT (email) DO UPDATE SET id = EXCLUDED.id
    `;
    await sql`DELETE FROM public.auth_throttle WHERE ip = '127.0.0.1'`;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  const jwks = await createTestJwks();
  const jwksJson = JSON.stringify(jwks);

  // 1. Stand up the JWKS server. Throws on bind failure.
  const server = await publishJwks(jwksJson);
  activeServer = server;

  // 2. Self-probe: fetch the URL the Next webServer will use. If this
  //    fails, the Playwright run aborts BEFORE any spec runs.
  const probe = await fetch(TEST_JWKS_URL);
  if (!probe.ok) {
    throw new Error(`globalSetup: JWKS self-probe returned status ${probe.status}; expected 200`);
  }
  const probeBody = await probe.json();
  if (
    !probeBody ||
    !Array.isArray((probeBody as { keys?: unknown }).keys) ||
    (probeBody as { keys: unknown[] }).keys.length === 0
  ) {
    throw new Error(
      `globalSetup: JWKS self-probe returned an empty keys array — refusing to start`,
    );
  }

  // 3. Serialize the private key + JWKS so the spec can mint matching
  //    JWTs without statically importing the shared fixture (Playwright
  //    config-graph isolation).
  const privateKey = await getTestPrivateKey();
  const privatePkcs8 = await exportPKCS8(privateKey as unknown as CryptoKey);
  await mkdir(dirname(TEST_KEY_DUMP_PATH), { recursive: true });
  await writeFile(
    TEST_KEY_DUMP_PATH,
    JSON.stringify(
      {
        privateKeyPkcs8: privatePkcs8,
        jwks,
        userId: TEST_USER_ID,
        userEmail: TEST_USER_EMAIL,
        kid: jwks.keys[0]?.kid ?? null,
        alg: jwks.keys[0]?.alg ?? "RS256",
      },
      null,
      2,
    ),
    "utf8",
  );

  // 4. Seed a deterministic test users row. CI smoke runs against vanilla
  //    postgres without Supabase Auth; those specs do not exercise auth, so
  //    they opt out of auth seeding explicitly. Full E2E still seeds and
  //    fails loudly if the local Supabase Auth stack is unavailable.
  if (process.env.PLAYWRIGHT_SKIP_AUTH_SEED === "1") return;

  const dbUrl = process.env.DATABASE_POOL_URL ?? process.env.DATABASE_URL;
  if (dbUrl) {
    if (/supabase\.co/.test(dbUrl)) {
      throw new Error("globalSetup: refusing to seed E2E test user against cloud Supabase");
    }
    await seedTestUser(dbUrl);
  }

  // 5. Hold a reference so the JWKS server survives until Playwright
  //    tears the process down. Node will reap it on exit.
  process.on("exit", () => {
    if (activeServer) {
      activeServer.close();
    }
  });
}
