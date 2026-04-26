import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  type JWK,
  type KeyObject,
} from "jose";

import { ErrorCode } from "@shared/config/errors";
import {
  createAuthAdapter,
  type AuthAdapter,
} from "@contexts/iam/infrastructure/auth/auth-adapter";

/**
 * Plan 02-07 Task 1 RED → GREEN.
 *
 * Tests prove the AuthAdapter:
 *  1. Returns ErrorCode.Unauthenticated for missing bearer header.
 *  2. Returns ErrorCode.Unauthenticated for malformed bearer header.
 *  3. Returns { userId } for a JWT signed by a test key and verified through a
 *     local JWKS (no network) — exercising real `jose` crypto end to end (D-44,
 *     must_haves: at least one path runs real JWKS verification).
 *
 * The adapter factory MUST accept either an injected JWKS URL or an injected
 * local key set so Plan 09's E2E setup can stand up a deterministic JWKS
 * without mocking jose.
 */

type TestKeys = {
  publicJwk: JWK;
  jwks: JSONWebKeySet;
  privateKey: KeyObject | CryptoKey;
};

let keys: TestKeys;
const TEST_KID = "test-kid-02-07";

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair("RS256", {
    extractable: true,
  });
  const publicJwk = await exportJWK(publicKey);
  publicJwk.kid = TEST_KID;
  publicJwk.alg = "RS256";
  publicJwk.use = "sig";
  const jwks: JSONWebKeySet = { keys: [publicJwk] };
  keys = { publicJwk, jwks, privateKey };
});

afterAll(() => {
  // No teardown — generated keys are in-memory only.
});

async function signTestJwt(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setSubject(typeof payload.sub === "string" ? payload.sub : "user-1")
    .sign(keys.privateKey);
}

function buildAdapterWithLocalJwks(): AuthAdapter {
  const localKeySet = createLocalJWKSet(keys.jwks);
  return createAuthAdapter({ jwks: localKeySet });
}

describe("AuthAdapter — verifyBearer", () => {
  it("returns Unauthenticated for missing Authorization header", async () => {
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(undefined);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns Unauthenticated for empty Authorization header", async () => {
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer("");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns Unauthenticated for header missing the 'Bearer ' prefix", async () => {
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer("not-a-bearer-token");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns Unauthenticated for malformed JWT after Bearer prefix", async () => {
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer("Bearer this-is-not-a-jwt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns Unauthenticated when JWT signature does not verify against JWKS", async () => {
    // Sign with a *different* key pair; verification against our published JWKS must fail.
    const { privateKey: otherPrivate } = await generateKeyPair("RS256", {
      extractable: true,
    });
    const stranger = await new SignJWT({ sub: "user-x" })
      .setProtectedHeader({ alg: "RS256", kid: "wrong-kid" })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setSubject("user-x")
      .sign(otherPrivate);
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${stranger}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns Unauthenticated for an expired JWT", async () => {
    const expired = await new SignJWT({ sub: "user-expired" })
      .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 3600)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .setSubject("user-expired")
      .sign(keys.privateKey);
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${expired}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns { userId } for a JWT signed by a test key and verified through a local JWKS", async () => {
    const userId = "00000000-0000-4000-8000-000000000001";
    const token = await signTestJwt({ sub: userId });
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${token}`);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(userId);
    }
  });

  it("factory accepts an injected JWKS URL (default) and an injected local JWKS (E2E test seam)", () => {
    // URL form: explicit, used by production/Plan 09 to point at a test JWKS HTTP endpoint.
    const urlAdapter = createAuthAdapter({
      jwksUrl: "http://localhost:9999/.well-known/jwks.json",
    });
    expect(typeof urlAdapter.verifyBearer).toBe("function");
    // Local JWKS form: used by these unit tests so we never hit the network.
    const localAdapter = createAuthAdapter({
      jwks: createLocalJWKSet(keys.jwks),
    });
    expect(typeof localAdapter.verifyBearer).toBe("function");
  });
});
