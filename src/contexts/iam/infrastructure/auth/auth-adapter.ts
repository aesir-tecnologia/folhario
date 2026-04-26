import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

import { ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";
import { db, type DbClient } from "@shared/db/client";
import { findById, type UserRow } from "@contexts/iam/infrastructure/db/users";

/**
 * IAM AuthAdapter — Plan 02-07 D-32/D-33.
 *
 * Verifies Supabase-issued JWTs cryptographically with `jose` against the
 * Supabase JWKS endpoint and exposes a thin `getUserById` delegating to the
 * IAM `users` repository (used by the consent smoke route in Plan 09).
 *
 * Two factory shapes are supported so Plan 09's E2E setup can swap the
 * verifier for a deterministic local key set without mocking jose:
 *
 *   1. `createAuthAdapter()` — defaults to the Supabase JWKS URL derived from
 *      `NEXT_PUBLIC_SUPABASE_URL`.
 *   2. `createAuthAdapter({ jwksUrl })` — explicit URL injection.
 *   3. `createAuthAdapter({ jwks })` — direct local key set injection (used by
 *      unit tests so the suite never makes a network call).
 *
 * Threat coverage from Plan 02-07:
 *  - T-02-17 unsigned-token acceptance → `jwtVerify` is the only success
 *    path; there is no decode-only fall-through.
 *  - T-02-19 JWKS local mismatch → verification simply fails closed with
 *    `ErrorCode.Unauthenticated` and the integration test prints a targeted
 *    message so a misconfigured local Supabase fails loudly.
 */

export type VerifyResult =
  | { ok: true; userId: string }
  | { ok: false; code: typeof ErrorCode.Unauthenticated; reason: string };

export interface AuthAdapter {
  verifyBearer: (authorizationHeader: string | null | undefined) => Promise<VerifyResult>;
  getUserById: (id: string) => Promise<UserRow | null>;
}

export interface AuthAdapterFactoryOptions {
  /** Inject a complete `JWTVerifyGetKey` (e.g. `createLocalJWKSet(...)`). Wins over `jwksUrl`. */
  jwks?: JWTVerifyGetKey;
  /** Inject a JWKS URL (defaults to Supabase). Ignored when `jwks` is provided. */
  jwksUrl?: string;
  /**
   * Expected JWT `aud` claim. Defaults to `"authenticated"` (Supabase's
   * default for user-facing tokens). Override via `AUTH_AUDIENCE_OVERRIDE`
   * env var or this option for tests. WR-01: `jose` does not validate
   * audience unless this is supplied.
   */
  audience?: string;
  /**
   * Expected JWT `iss` claim. Defaults to `${NEXT_PUBLIC_SUPABASE_URL}/auth/v1`.
   * Override via `AUTH_ISSUER_OVERRIDE` env var or this option for tests.
   * WR-01: `jose` does not validate issuer unless this is supplied.
   */
  issuer?: string;
  /**
   * Allowed signing algorithms. Defaults to RS256/ES256 (the algorithm
   * families Supabase emits). WR-01 belt-and-braces: pinning `algorithms`
   * forecloses `alg=none` and HMAC-vs-RSA-key-confusion attacks even
   * though `jose` already rejects them.
   */
  algorithms?: string[];
  /** Inject a Drizzle client (defaults to the global pooled `db`). Used by tests. */
  db?: DbClient;
}

/**
 * Plan 02-09 Task 3 hook (T-02-40 mitigation): when running Playwright E2E
 * against `pnpm start`, the global setup spins up a deterministic test
 * JWKS endpoint and points the running Next server at it via this env var.
 *
 * In production this var is unset and the default Supabase JWKS URL wins.
 * The override is consulted ONLY when no `jwks` / `jwksUrl` option is
 * passed to `createAuthAdapter()` — explicit injection still trumps env.
 *
 * Read directly from `process.env` (not via `serverEnv`) so the override
 * is opt-in and additive without churning the strict-zod env schema.
 */
function defaultJwksUrl(): string {
  const override = process.env.AUTH_JWKS_OVERRIDE_URL;
  if (override && override.length > 0) {
    return override;
  }
  const baseUrl = serverEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${baseUrl}/auth/v1/.well-known/jwks.json`;
}

/**
 * Default `iss` claim. Supabase issues JWTs with `iss = <project URL>/auth/v1`.
 *
 * WR-01: combined with the JWKS override hook, this lets E2E setup point
 * at a deterministic test issuer. Production runs against the Supabase
 * URL exactly as configured.
 */
function defaultIssuer(): string {
  const override = process.env.AUTH_ISSUER_OVERRIDE;
  if (override && override.length > 0) {
    return override;
  }
  const baseUrl = serverEnv.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, "");
  return `${baseUrl}/auth/v1`;
}

/**
 * Default `aud` claim. Supabase tags user tokens with `aud = "authenticated"`.
 *
 * WR-01: configurable via `AUTH_AUDIENCE_OVERRIDE` for E2E.
 */
function defaultAudience(): string {
  const override = process.env.AUTH_AUDIENCE_OVERRIDE;
  if (override && override.length > 0) {
    return override;
  }
  return "authenticated";
}

const DEFAULT_ALGORITHMS: readonly string[] = ["RS256", "ES256"];

function extractBearer(header: string | null | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (trimmed.length === 0) return null;
  if (!trimmed.toLowerCase().startsWith("bearer ")) return null;
  const token = trimmed.slice(7).trim();
  if (token.length === 0) return null;
  return token;
}

export function createAuthAdapter(options: AuthAdapterFactoryOptions = {}): AuthAdapter {
  const jwks: JWTVerifyGetKey =
    options.jwks ?? createRemoteJWKSet(new URL(options.jwksUrl ?? defaultJwksUrl()));
  const dbClient: DbClient = options.db ?? db;
  const audience = options.audience ?? defaultAudience();
  const issuer = options.issuer ?? defaultIssuer();
  const algorithms = options.algorithms ?? [...DEFAULT_ALGORITHMS];

  return {
    async verifyBearer(authorizationHeader) {
      const token = extractBearer(authorizationHeader);
      if (!token) {
        return {
          ok: false,
          code: ErrorCode.Unauthenticated,
          reason: "missing_bearer",
        };
      }
      try {
        // WR-01: pin `audience`, `issuer`, and `algorithms` so jose
        // rejects tokens minted for a different aud/iss or signed with
        // an unexpected algorithm. Without these options jose accepts
        // any signature-valid token resolvable through the JWKS.
        const { payload } = await jwtVerify(token, jwks, {
          audience,
          issuer,
          algorithms,
        });
        const sub = typeof payload.sub === "string" ? payload.sub : null;
        if (!sub || sub.length === 0) {
          return {
            ok: false,
            code: ErrorCode.Unauthenticated,
            reason: "missing_sub",
          };
        }
        return { ok: true, userId: sub };
      } catch (err) {
        const reason = err instanceof Error ? err.name : "verify_failed";
        return {
          ok: false,
          code: ErrorCode.Unauthenticated,
          reason,
        };
      }
    },
    async getUserById(id) {
      return findById(dbClient, id);
    },
  };
}
