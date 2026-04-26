import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { SignJWT, importPKCS8 } from "jose";

/**
 * Plan 02-09 Task 3 — Playwright HTTP smoke for the Phase-2 diagnostic
 * consent route. Threat T-02-40 mitigation: the positive-token path
 * runs against a deterministic JWKS that global-setup published
 * BEFORE this spec executed. There is NO bypass branch anywhere in
 * this file — if key import fails, `readKeyDump()` throws and
 * Playwright reports a hard failure, not a no-op.
 *
 * Module-graph isolation: this spec does NOT statically import
 * `tests/e2e/fixtures/test-jwks.ts`. The shared fixture is the
 * canonical keygen surface (T-02-41 mitigation — exactly one
 * `generateKeyPair` invocation across all suites). Global-setup
 * writes the private key (PKCS8 PEM) and JWKS to
 * `tests/e2e/.tmp-jwks.json`; the spec reads from that file rather
 * than importing `test-jwks.ts` directly.
 *
 * Coverage:
 *   - GET without bearer → 401 from the proxy.
 *   - Valid POST → 201 with non-null `id` (positive subject; proves the
 *     route handler executed). Replay of identical POST with same
 *     Idempotency-Key returns the same body and status.
 *   - GET with `limit=1` returns at most one item; `next_cursor` is
 *     either present as a string or null and the test does not parse
 *     it (the cursor is opaque to clients).
 *   - Source-structural counter test asserts the literal 201 status
 *     check is still present in this file (T-02-40 hardening: under
 *     `fullyParallel: true` a runtime counter cannot reliably order
 *     after the positive test, so the structural source-grep is the
 *     equivalent fail-loud signal).
 */

const ROUTE_PATH = "/api/v1/diagnostics/consent";

const KEY_DUMP_PATH = join(process.cwd(), "tests", "e2e", ".tmp-jwks.json");

const SPEC_PATH = join(process.cwd(), "tests", "e2e", "diagnostics-consent.spec.ts");

interface KeyDump {
  privateKeyPkcs8: string;
  jwks: { keys: Array<{ kid?: string; alg?: string }> };
  userId: string;
  userEmail: string;
  kid: string | null;
  alg: string;
}

function readKeyDump(): KeyDump {
  try {
    const raw = readFileSync(KEY_DUMP_PATH, "utf8");
    return JSON.parse(raw) as KeyDump;
  } catch (err) {
    // T-02-40: if the dump is missing, fail loudly. globalSetup is
    // supposed to write it before the first spec runs; an empty file
    // means the JWKS server failed to start and all tests below would
    // be no-ops without this throw.
    throw new Error(
      `diagnostics-consent.spec: cannot read ${KEY_DUMP_PATH}: ${(err as Error).message}. ` +
        `globalSetup must have failed to publish the test JWKS — refusing to run.`,
    );
  }
}

// WR-01: must match `playwright.config.ts` env vars and the constants in
// `tests/e2e/fixtures/test-jwks.ts`. The Next webServer pins these on the
// AuthAdapter so a JWT with mismatched aud/iss is rejected.
const TEST_AUDIENCE = "authenticated";
const TEST_ISSUER = "https://folhario-test.invalid/auth/v1";

async function signTestJwtFromDump(sub: string): Promise<string> {
  const dump = readKeyDump();
  const privateKey = await importPKCS8(dump.privateKeyPkcs8, dump.alg);
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: dump.alg, kid: dump.kid ?? "folhario-test" })
    .setIssuedAt()
    .setSubject(sub)
    .setExpirationTime("1h")
    .setAudience(TEST_AUDIENCE)
    .setIssuer(TEST_ISSUER)
    .sign(privateKey);
}

test("GET /api/v1/diagnostics/consent without bearer returns 401", async ({ request }) => {
  const response = await request.get(ROUTE_PATH);
  expect(response.status()).toBe(401);
  const body = await response.json();
  expect(body?.error?.code).toBe("unauthenticated");
});

test("POST /api/v1/diagnostics/consent with valid JWT returns 201; replay returns identical body", async ({
  request,
}) => {
  const dump = readKeyDump();
  const token = await signTestJwtFromDump(dump.userId);

  const idempotencyKey = `e2e-pos-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const payload = {
    purpose: "identification_third_party",
    legalBasis: "consent",
    source: "first_use_prompt",
  };

  const response = await request.post(ROUTE_PATH, {
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": idempotencyKey,
      "content-type": "application/json",
    },
    data: payload,
  });

  // Positive-path proof: status 201, non-null id, route handler
  // ACTUALLY executed (not just a generic "ok or skipped").
  expect(response.status()).toBe(201);
  const body = await response.json();
  expect(body.id).not.toBeNull();
  expect(typeof body.id).toBe("string");
  expect(body.user_id).toBe(dump.userId);

  // Replay — same Idempotency-Key, same payload — must return the
  // identical body and status (withIdempotency replay path).
  const replay = await request.post(ROUTE_PATH, {
    headers: {
      authorization: `Bearer ${token}`,
      "idempotency-key": idempotencyKey,
      "content-type": "application/json",
    },
    data: payload,
  });
  expect(replay.status()).toBe(response.status());
  const replayBody = await replay.json();
  expect(replayBody).toEqual(body);
});

test("GET /api/v1/diagnostics/consent?limit=1 returns one item with cursor field", async ({
  request,
}) => {
  const dump = readKeyDump();
  const token = await signTestJwtFromDump(dump.userId);
  const response = await request.get(`${ROUTE_PATH}?limit=1`, {
    headers: { authorization: `Bearer ${token}` },
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(Array.isArray(body.items)).toBe(true);
  expect(body.items.length).toBeLessThanOrEqual(1);
  // next_cursor is opaque: string when there are more rows, null when
  // not. The test does NOT parse it — that is a client contract
  // violation.
  expect("next_cursor" in body).toBe(true);
  const cursor = body.next_cursor;
  expect(cursor === null || typeof cursor === "string").toBe(true);
});

test("source-structural counter: positive 201 assertion is present in this spec file", async () => {
  // T-02-40 hardening. Under `fullyParallel: true` a module-level
  // runtime counter cannot reliably order after the positive subtest
  // (parallel siblings have no completion order). Instead, we assert
  // the FILE'S OWN SOURCE still contains the literal 201 status
  // assertion that the positive subtest depends on. A regression that
  // silently deletes the positive test would also delete the literal,
  // and this test would fail.
  const sourceBuf = readFileSync(SPEC_PATH, "utf8");
  const matches = sourceBuf.match(/expect\(response\.status\(\)\)\.toBe\(201\)/g);
  expect(matches).toBeTruthy();
  expect(matches!.length).toBeGreaterThanOrEqual(1);
});
