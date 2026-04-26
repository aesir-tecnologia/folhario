// NOTE: this fixture is consumed by BOTH the Playwright E2E project AND the
// Vitest integration project (`tests/integration/auth-jwt.integration.test.ts`).
// Do NOT move it under `tests/e2e/_only/` or behind a Playwright-only barrel —
// it is a shared cross-suite helper by design (Plan 02-09 Task 3, threat
// T-02-41 mitigation: there must be exactly ONE test-JWT signing surface).

import {
  SignJWT,
  exportJWK,
  generateKeyPair,
  type JSONWebKeySet,
  type JWK,
  type KeyObject,
} from "jose";

/**
 * Shared test JWKS helper for Phase-2 Plans 07 and 09.
 *
 * Threat T-02-41 mitigation: a single JWKS/signing surface used by every
 * suite that needs a deterministic test JWT. If Plan 07's wave-5
 * integration test and Plan 09's wave-6 Playwright spec each rolled their
 * own `generateKeyPair` + `SignJWT` helper, the two would drift on `kid`,
 * `alg`, claim shape, and exp window — a real bug in one suite could
 * hide behind a green test in the other. This file is the canonical
 * source of truth.
 *
 * Module-load behavior: the key pair is generated lazily on first call to
 * any of the exported functions and cached in module scope. Callers can
 * therefore import the helpers without paying the keygen cost up front,
 * but the key material is stable for the lifetime of the process — every
 * JWT signed via `signTestJwt` verifies against every JWKS published via
 * `createTestJwks` in the same run.
 *
 * Production guard: this module imports `jose` only and does NOT import
 * `serverEnv`, `db`, or any application module. It is safe to load
 * statically (no env-stub dance required) from any test runner.
 */

const TEST_KID = "folhario-test-kid-02-09";
const TEST_ALG = "RS256";

/**
 * WR-01 fixture constants. The auth adapter validates `aud` and `iss`,
 * so every test JWT signed via `signTestJwt` must carry these claims and
 * the adapter under test must be configured with the same values.
 *
 *   - `TEST_AUDIENCE` mirrors Supabase's `"authenticated"` default.
 *   - `TEST_ISSUER` is a deterministic value distinct from any real
 *     Supabase URL so a misconfigured production env (where the override
 *     env vars are unset) cannot silently accept these test JWTs.
 */
export const TEST_AUDIENCE = "authenticated";
export const TEST_ISSUER = "https://folhario-test.invalid/auth/v1";

type TestKeyMaterial = {
  publicJwk: JWK;
  publicKey: KeyObject | CryptoKey;
  privateKey: KeyObject | CryptoKey;
  jwks: JSONWebKeySet;
};

let cached: TestKeyMaterial | null = null;
let cachedPromise: Promise<TestKeyMaterial> | null = null;

async function ensureKeys(): Promise<TestKeyMaterial> {
  if (cached) return cached;
  if (cachedPromise) return cachedPromise;

  cachedPromise = (async () => {
    const { publicKey, privateKey } = await generateKeyPair(TEST_ALG, {
      extractable: true,
    });
    const publicJwk = await exportJWK(publicKey);
    publicJwk.kid = TEST_KID;
    publicJwk.alg = TEST_ALG;
    publicJwk.use = "sig";
    const jwks: JSONWebKeySet = { keys: [publicJwk] };
    const value: TestKeyMaterial = {
      publicJwk,
      publicKey,
      privateKey,
      jwks,
    };
    cached = value;
    return value;
  })();

  return cachedPromise;
}

export const TEST_JWKS_KID = TEST_KID;
export const TEST_JWKS_ALG = TEST_ALG;

export async function getTestPrivateKey(): Promise<KeyObject | CryptoKey> {
  return (await ensureKeys()).privateKey;
}

export async function getTestPublicKey(): Promise<KeyObject | CryptoKey> {
  return (await ensureKeys()).publicKey;
}

export async function getTestPublicJwk(): Promise<JWK> {
  return (await ensureKeys()).publicJwk;
}

/**
 * Returns the JSONWebKeySet that wraps the public key. Feed this to
 * `jose.createLocalJWKSet(...)` for in-memory verification, or publish
 * it via an HTTP server so production-shaped `createRemoteJWKSet` runs.
 */
export async function createTestJwks(): Promise<JSONWebKeySet> {
  return (await ensureKeys()).jwks;
}

export interface SignTestJwtInput {
  /** Subject claim — usually a UUID matching a real users.id row. */
  sub: string;
  /** Optional email claim — informational only, not consumed by AuthAdapter. */
  email?: string;
  /** Override expiration (default '1h'). Pass a date or a `2h`-style string. */
  exp?: string | number | Date;
  /** Override audience (default `TEST_AUDIENCE`). Pass `null` to omit. */
  audience?: string | null;
  /** Override issuer (default `TEST_ISSUER`). Pass `null` to omit. */
  issuer?: string | null;
  /** Additional claims to merge into the payload. */
  extraClaims?: Record<string, unknown>;
}

/**
 * Sign a test JWT with the shared private key. The returned token verifies
 * against any local or remote key set published from `createTestJwks()`.
 *
 * WR-01: by default sets `aud = TEST_AUDIENCE` and `iss = TEST_ISSUER` so
 * the token clears the adapter's audience/issuer pinning. Tests that want
 * to exercise wrong-audience / wrong-issuer paths can override either to a
 * different string, or pass `null` to omit the claim entirely.
 */
export async function signTestJwt(input: SignTestJwtInput): Promise<string> {
  const { privateKey } = await ensureKeys();
  const payload: Record<string, unknown> = {
    sub: input.sub,
    ...(input.email ? { email: input.email } : {}),
    ...(input.extraClaims ?? {}),
  };
  const builder = new SignJWT(payload)
    .setProtectedHeader({ alg: TEST_ALG, kid: TEST_KID })
    .setIssuedAt()
    .setSubject(input.sub)
    .setExpirationTime(input.exp ?? "1h");
  const audience = input.audience === undefined ? TEST_AUDIENCE : input.audience;
  if (audience !== null) builder.setAudience(audience);
  const issuer = input.issuer === undefined ? TEST_ISSUER : input.issuer;
  if (issuer !== null) builder.setIssuer(issuer);
  return builder.sign(privateKey);
}
