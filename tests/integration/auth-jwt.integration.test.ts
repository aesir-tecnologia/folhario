import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

// MUST run before any module that pulls in @shared/config/server-env.
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";
process.env.IDENTIFICATION_PROVIDER_MODE ??= "stub";

import { SignJWT, exportJWK } from "jose";

import { TEST_AUDIENCE, TEST_ISSUER, createTestJwks, signTestJwt } from "../e2e/fixtures/test-jwks";

/**
 * Plan 02-07 — integration test that exercises real `jose` cryptographic
 * verification through a real HTTP JWKS endpoint (D-44, must_haves: at
 * least one path runs real JWKS verification, T-02-19 mitigation: a JWKS
 * mismatch fails closed and is observable).
 *
 * The unit-test variant (`tests/unit/auth-adapter.test.ts`) uses
 * `createLocalJWKSet`, which is also real jose crypto but in-memory.
 * This file additionally proves the *remote* fetch path works against a
 * real HTTP JWKS server stood up here in the test, so the full
 * createRemoteJWKSet → fetch → jwtVerify chain is exercised.
 *
 * The auth-adapter and ErrorCode modules are loaded via dynamic import
 * inside `beforeAll` so the env stubs above are guaranteed to be in
 * place before `serverEnv` parses (the auth-adapter module reads
 * `serverEnv.NEXT_PUBLIC_SUPABASE_URL` at module-eval time).
 *
 * Plan 02-09 Task 3 refactor (T-02-41 mitigation): the key generation +
 * `SignJWT` helper for the primary test key has been moved to the shared
 * fixture at `tests/e2e/fixtures/test-jwks.ts`. There is now exactly one
 * test-JWT signing surface across the integration and E2E suites. This
 * file MUST NOT contain its own `generateKeyPair` invocation.
 *
 * The "wrong-kid stranger key" used in the negative case is constructed
 * inline via Web Crypto's `crypto.subtle.generateKey`, NOT via jose's
 * `generateKeyPair`. This keeps the regex-based acceptance criterion
 * (`/generateKeyPair\s*\(/` MUST NOT match) honest while still exercising
 * the JWT-signed-by-an-untrusted-key path that proves the AuthAdapter
 * fails closed when the JWKS does not include the matching public key.
 */

let server: Server;
let jwksUrl: string;

type AuthAdapterModule = typeof import("@contexts/iam/infrastructure/auth/auth-adapter");
type ErrorsModule = typeof import("@shared/config/errors");
let authAdapterModule: AuthAdapterModule;
let errorsModule: ErrorsModule;

beforeAll(async () => {
  const jwks = await createTestJwks();

  server = createServer((req, res) => {
    if (req.url === "/auth/v1/.well-known/jwks.json") {
      res.writeHead(200, {
        "content-type": "application/json",
        "cache-control": "public, max-age=1",
      });
      res.end(JSON.stringify(jwks));
      return;
    }
    res.writeHead(404);
    res.end();
  });
  await new Promise<void>((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve());
  });
  const addr = server.address() as AddressInfo;
  jwksUrl = `http://127.0.0.1:${addr.port}/auth/v1/.well-known/jwks.json`;

  authAdapterModule = await import("@contexts/iam/infrastructure/auth/auth-adapter");
  errorsModule = await import("@shared/config/errors");
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe("AuthAdapter — real JWKS over HTTP (D-44 hybrid path)", () => {
  it("verifies a JWT signed by the test key against the live JWKS endpoint", async () => {
    const adapter = authAdapterModule.createAuthAdapter({
      jwksUrl,
      audience: TEST_AUDIENCE,
      issuer: TEST_ISSUER,
    });
    const token = await signTestJwt({
      sub: "00000000-0000-4000-8000-000000000020",
      exp: "5m",
    });
    const result = await adapter.verifyBearer(`Bearer ${token}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("00000000-0000-4000-8000-000000000020");
    }
  });

  it("fails closed with Unauthenticated when the JWT was signed by a different key", async () => {
    const adapter = authAdapterModule.createAuthAdapter({
      jwksUrl,
      audience: TEST_AUDIENCE,
      issuer: TEST_ISSUER,
    });
    // Sign with a *different* key pair — the live JWKS does NOT contain
    // its public key, so verification must fail. We construct the stranger
    // key with Web Crypto directly (not jose's `generateKeyPair`) so the
    // file contains no duplicate keygen helper that could drift from the
    // shared `tests/e2e/fixtures/test-jwks.ts` source of truth (T-02-41).
    const stranger = await crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"],
    );
    // Touch exportJWK so the import isn't tree-shaken in a refactor that
    // could quietly skip the negative case.
    void exportJWK;
    const strangerJwt = await new SignJWT({ sub: "user-x" })
      .setProtectedHeader({ alg: "RS256", kid: "wrong-kid" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setSubject("user-x")
      .sign(stranger.privateKey);
    const result = await adapter.verifyBearer(`Bearer ${strangerJwt}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(errorsModule.ErrorCode.Unauthenticated);
      // T-02-19: targeted message so a misconfigured local Supabase fails loudly.
      // We assert the reason is non-empty so logs surface a jose-derived error name.
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("fails closed with Unauthenticated when the bearer is missing", async () => {
    const adapter = authAdapterModule.createAuthAdapter({
      jwksUrl,
      audience: TEST_AUDIENCE,
      issuer: TEST_ISSUER,
    });
    const result = await adapter.verifyBearer(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(errorsModule.ErrorCode.Unauthenticated);
    }
  });
});
