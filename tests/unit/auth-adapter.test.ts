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
import { __setCurrentUserAdapterForTests } from "@contexts/iam/application/current-user";
import { requireApiUser } from "@shared/api/auth";
import type { UserRow } from "@contexts/iam/infrastructure/db/users";

// WR-01: pinned audience/issuer the unit adapter is configured with. Tests
// that want to exercise wrong-aud or wrong-iss paths sign with different
// values and assert the adapter rejects them. These constants stay local
// to the unit test (the e2e fixture has its own pair) so the unit suite
// remains free of cross-suite coupling.
const TEST_AUDIENCE = "authenticated";
const TEST_ISSUER = "https://folhario-unit-test.invalid/auth/v1";

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
  // WR-01: every JWT signed for this suite carries `aud` and `iss` that
  // match what `buildAdapterWithLocalJwks` configures. Negative tests
  // override one or both via direct `SignJWT` to prove the adapter rejects
  // mismatches.
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
    .setIssuedAt()
    .setExpirationTime("5m")
    .setSubject(typeof payload.sub === "string" ? payload.sub : "user-1")
    .setAudience(TEST_AUDIENCE)
    .setIssuer(TEST_ISSUER)
    .sign(keys.privateKey);
}

function buildAdapterWithLocalJwks(): AuthAdapter {
  const localKeySet = createLocalJWKSet(keys.jwks);
  // WR-01: pin audience/issuer to match `signTestJwt`. Without these
  // options the adapter would silently accept any JWT it can verify
  // signature-wise.
  return createAuthAdapter({
    jwks: localKeySet,
    audience: TEST_AUDIENCE,
    issuer: TEST_ISSUER,
  });
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
      .setAudience(TEST_AUDIENCE)
      .setIssuer(TEST_ISSUER)
      .sign(keys.privateKey);
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${expired}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("WR-01: returns Unauthenticated when JWT audience does not match", async () => {
    const wrongAud = await new SignJWT({ sub: "user-aud" })
      .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setSubject("user-aud")
      .setAudience("not-our-audience")
      .setIssuer(TEST_ISSUER)
      .sign(keys.privateKey);
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${wrongAud}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("WR-01: returns Unauthenticated when JWT issuer does not match", async () => {
    const wrongIss = await new SignJWT({ sub: "user-iss" })
      .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setSubject("user-iss")
      .setAudience(TEST_AUDIENCE)
      .setIssuer("https://attacker.invalid/auth/v1")
      .sign(keys.privateKey);
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${wrongIss}`);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("WR-01: returns Unauthenticated when JWT has no audience claim at all", async () => {
    const noAud = await new SignJWT({ sub: "user-no-aud" })
      .setProtectedHeader({ alg: "RS256", kid: TEST_KID })
      .setIssuedAt()
      .setExpirationTime("5m")
      .setSubject("user-no-aud")
      .setIssuer(TEST_ISSUER)
      .sign(keys.privateKey);
    const adapter = buildAdapterWithLocalJwks();
    const result = await adapter.verifyBearer(`Bearer ${noAud}`);
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

/**
 * Plan 02-07 Task 2 RED → GREEN.
 *
 * `requireApiUser(request)` — the API helper used by route handlers — must:
 *  - Return Unauthenticated when no Authorization header is present.
 *  - Return Unauthenticated when the JWT is invalid.
 *  - Return Unauthenticated when the JWT is valid but no users row exists
 *    (defense in depth: deleted-user JWTs in flight).
 *  - Return { id } when the JWT is valid AND the users row exists.
 *
 * The shared adapter is overridable via `__setCurrentUserAdapterForTests`
 * so this test never imports Drizzle and never makes a network call.
 */

function buildFakeUserRow(id: string): UserRow {
  // Minimal partial — only the fields we read are required at runtime; the
  // rest are typed but unused by the helper. Build with a structural cast.
  const now = new Date();
  return {
    id,
    email: `user+${id}@example.test`,
    name: "Test User",
    timezone: "America/Sao_Paulo",
    notificationTimeLocal: "09:00",
    plan: "trial",
    trialEndsAt: null,
    partnerCode: null,
    consentVersionId: null,
    notificationOptIn: false,
    pendingDeletionAt: null,
    locale: "pt-BR",
    createdAt: now,
    updatedAt: now,
  } as unknown as UserRow;
}

describe("requireApiUser — protected API helper", () => {
  afterAll(() => {
    __setCurrentUserAdapterForTests(null);
  });

  it("returns ErrorCode.Unauthenticated when no Authorization header is present", async () => {
    __setCurrentUserAdapterForTests({
      verifyBearer: async () => ({
        ok: false,
        code: ErrorCode.Unauthenticated,
        reason: "missing_bearer",
      }),
      getUserById: async () => null,
    });
    const request = new Request("http://localhost/api/v1/foo");
    const result = await requireApiUser(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns ErrorCode.Unauthenticated when the JWT is invalid", async () => {
    __setCurrentUserAdapterForTests({
      verifyBearer: async () => ({
        ok: false,
        code: ErrorCode.Unauthenticated,
        reason: "verify_failed",
      }),
      getUserById: async () => null,
    });
    const request = new Request("http://localhost/api/v1/foo", {
      headers: { authorization: "Bearer not-a-real-jwt" },
    });
    const result = await requireApiUser(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns ErrorCode.Unauthenticated when JWT is valid but no users row exists", async () => {
    __setCurrentUserAdapterForTests({
      verifyBearer: async () => ({ ok: true, userId: "ghost-user-id" }),
      getUserById: async () => null,
    });
    const request = new Request("http://localhost/api/v1/foo", {
      headers: { authorization: "Bearer ok-but-deleted" },
    });
    const result = await requireApiUser(request);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(ErrorCode.Unauthenticated);
    }
  });

  it("returns { id } when the JWT is valid AND the users row exists", async () => {
    const userId = "00000000-0000-4000-8000-000000000010";
    __setCurrentUserAdapterForTests({
      verifyBearer: async () => ({ ok: true, userId }),
      getUserById: async (id) => (id === userId ? buildFakeUserRow(id) : null),
    });
    const request = new Request("http://localhost/api/v1/foo", {
      headers: { authorization: "Bearer good-token" },
    });
    const result = await requireApiUser(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.id).toBe(userId);
    }
  });
});
