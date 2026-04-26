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

import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  type JWK,
  type KeyObject,
} from "jose";

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
 */

let server: Server;
let jwksUrl: string;
let privateKey: KeyObject | CryptoKey;
let publicJwk: JWK;
const TEST_KID = "integration-kid-02-07";

type AuthAdapterModule = typeof import("@contexts/iam/infrastructure/auth/auth-adapter");
type ErrorsModule = typeof import("@shared/config/errors");
let authAdapterModule: AuthAdapterModule;
let errorsModule: ErrorsModule;

beforeAll(async () => {
  const { publicKey, privateKey: pk } = await generateKeyPair("RS256", {
    extractable: true,
  });
  privateKey = pk;
  publicJwk = await exportJWK(publicKey);
  publicJwk.kid = TEST_KID;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const jwks: JSONWebKeySet = { keys: [publicJwk] };

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

async function signTestJwt(sub: string): Promise<string> {
  return new SignJWT({ sub })
    .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setSubject(sub)
    .sign(privateKey);
}

describe("AuthAdapter — real JWKS over HTTP (D-44 hybrid path)", () => {
  it("verifies a JWT signed by the test key against the live JWKS endpoint", async () => {
    const adapter = authAdapterModule.createAuthAdapter({ jwksUrl });
    const token = await signTestJwt("00000000-0000-4000-8000-000000000020");
    const result = await adapter.verifyBearer(`Bearer ${token}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe("00000000-0000-4000-8000-000000000020");
    }
  });

  it("fails closed with Unauthenticated when the JWT was signed by a different key", async () => {
    const adapter = authAdapterModule.createAuthAdapter({ jwksUrl });
    // Sign with a *different* key pair — the live JWKS does NOT contain
    // its public key, so verification must fail.
    const { privateKey: otherPrivate } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const stranger = await new SignJWT({ sub: "user-x" })
      .setProtectedHeader({ alg: "RS256", kid: "wrong-kid" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setSubject("user-x")
      .sign(otherPrivate);
    const result = await adapter.verifyBearer(`Bearer ${stranger}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(errorsModule.ErrorCode.Unauthenticated);
      // T-02-19: targeted message so a misconfigured local Supabase fails loudly.
      // We assert the reason is non-empty so logs surface a jose-derived error name.
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it("fails closed with Unauthenticated when the bearer is missing", async () => {
    const adapter = authAdapterModule.createAuthAdapter({ jwksUrl });
    const result = await adapter.verifyBearer(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(errorsModule.ErrorCode.Unauthenticated);
    }
  });
});
