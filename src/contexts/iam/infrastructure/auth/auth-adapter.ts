import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import * as Sentry from "@sentry/nextjs";
import { isAuthSessionMissingError } from "@supabase/supabase-js";

import { ErrorCode } from "@shared/config/errors";
import { serverEnv } from "@shared/config/server-env";
import { db, type DbClient } from "@shared/db/client";
import { timeServer } from "@shared/telemetry/server-timing";
import { findById, type UserRow } from "@contexts/iam/infrastructure/db/users";
import {
  getReadOnlySupabaseServerClient,
  getSupabaseServerClient,
} from "@contexts/iam/infrastructure/supabase-server";
import { supabaseAdmin } from "@contexts/iam/infrastructure/supabase-admin";

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
  // ──── Phase 4 additions (Codex HIGH #3 — sole module touching supabase.auth.*) ────
  /** Returns the Supabase user id for the current request session, or null if unauthenticated. */
  getUserBySession: (opts?: {
    readOnly?: boolean;
  }) => Promise<{ id: string; email: string } | null>;
  /** D-03: admin.createUser({email_confirm: true}) — Folhário sends its own verification email. */
  createUser: (opts: { email: string; password: string }) => Promise<{ id: string }>;
  /** D-05: per-device JWT cookie via signInWithPassword. T-04-07-02: never distinguish reasons. */
  signInWithPassword: (opts: {
    email: string;
    password: string;
  }) => Promise<{ ok: true } | { ok: false; reason: "invalid_credentials" }>;
  /** D-05 + AUTH-14: signOut({scope: 'local'}). Idempotent. */
  signOutLocal: () => Promise<void>;
  /** D-10 + AUTH-12: admin.updateUserById({password}) WITHOUT invalidating existing JWTs. */
  adminUpdatePassword: (opts: {
    userId: string;
    newPassword: string;
  }) => Promise<{ ok: true } | { ok: false; reason: string }>;
  /** D-25 compensating delete on signup tx failure. Best-effort. */
  adminDeleteUser: (userId: string) => Promise<void>;
  /** D-04: returns the OAuth provider sign-in URL. */
  signInWithOAuth: (opts: { provider: "google"; redirectTo: string }) => Promise<{ url: string }>;
  /** D-04: code-for-session exchange in /auth/callback. Sets the cookie via @supabase/ssr setAll. */
  exchangeCodeForSession: (
    code: string,
  ) => Promise<{ ok: true; userId: string; email: string } | { ok: false; reason: string }>;
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

    // ──── Phase 4 additions ────
    async getUserBySession({ readOnly = false } = {}) {
      const supabase = readOnly
        ? await getReadOnlySupabaseServerClient()
        : await getSupabaseServerClient();
      // Debug session publiclayout-auth-refresh-token-throw belt-and-
      // braces: the Supabase auth client returns `{ data, error }` on
      // failed refreshes (e.g. AuthApiError "Invalid Refresh Token"),
      // not a thrown error.
      //
      // Predicate is NARROW: tag operationally interesting errors only.
      // `AuthSessionMissingError` is the normal "no cookie / not signed
      // in" return shape — every anonymous page render produces it, so
      // tagging it would burn Sentry quota on routine traffic. Filter
      // it out via the library's `isAuthSessionMissingError` type guard.
      //
      // CLAUDE.md hard rule: never include email in Sentry payloads —
      // tags-only, no `extra.email`, no `setUser({ email })`.
      const { data, error } = await timeServer(
        "supabase.auth.getUser",
        () => supabase.auth.getUser(),
        { readOnly },
      );
      if (error) {
        if (!isAuthSessionMissingError(error)) {
          Sentry.captureException(error, {
            tags: { context: "iam.getUserBySession" },
            extra: { errorName: error.name, readOnly },
          });
        }
        return null;
      }
      const user = data?.user;
      if (!user || !user.email) return null;
      return { id: user.id, email: user.email };
    },

    async createUser({ email, password }) {
      // D-03: email_confirm: true so Supabase doesn't send its own email; Folhário ships verification.
      const { data, error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (error || !data.user) {
        throw new Error(`authAdapter.createUser failed: ${error?.message ?? "no user returned"}`);
      }
      return { id: data.user.id };
    },

    async signInWithPassword({ email, password }) {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      // T-04-07-02: never distinguish "user not found" vs "wrong password".
      if (error) return { ok: false, reason: "invalid_credentials" };
      return { ok: true };
    },

    async signOutLocal() {
      const supabase = await getSupabaseServerClient();
      // Idempotent — already-logged-out user is a no-op. Never throws.
      await supabase.auth.signOut({ scope: "local" }).catch(() => {
        /* swallow per AUTH-14 idempotence */
      });
    },

    async adminUpdatePassword({ userId, newPassword }) {
      // D-10 + AUTH-12: does NOT call signOut. Existing JWTs remain valid.
      const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: newPassword,
      });
      if (error) return { ok: false, reason: error.message };
      return { ok: true };
    },

    async adminDeleteUser(userId) {
      // D-25 compensating delete on signup tx failure. Best-effort BUT
      // not silent — Phase 04 review WR-02: a failed compensating delete
      // leaves an orphan auth.users row that can permanently lock the
      // user out of self-service signup AND welcome-back. Capture so
      // on-call sees the operator-action signal.
      try {
        await supabaseAdmin.auth.admin.deleteUser(userId);
      } catch (err) {
        Sentry.captureException(err, {
          tags: { context: "iam.compensating_delete" },
          extra: { userId },
        });

        console.error("[iam] adminDeleteUser compensating failed", {
          userId,
          err,
        });
      }
    },

    async signInWithOAuth({ provider, redirectTo }) {
      const supabase = await getSupabaseServerClient();
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo },
      });
      if (error || !data.url) {
        throw new Error(`authAdapter.signInWithOAuth failed: ${error?.message ?? "no url"}`);
      }
      return { url: data.url };
    },

    async exchangeCodeForSession(code) {
      const supabase = await getSupabaseServerClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) return { ok: false, reason: error.message };
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || !user.email) {
        return { ok: false, reason: "no_user_after_exchange" };
      }
      return { ok: true, userId: user.id, email: user.email };
    },
  };
}

/**
 * Phase 4 Codex HIGH #3 fix — process-wide AuthAdapter singleton wired to the
 * default Supabase JWKS + service-role admin client. The SOLE module that
 * calls `supabase.auth.*`. Application use-cases call `authAdapter.X()`.
 *
 * Lazy initialization: factory is invoked on first access so unit tests can
 * still swap the implementation via `__setCurrentUserAdapterForTests` without
 * touching the live Supabase clients.
 */
let _singleton: AuthAdapter | null = null;
export const authAdapter: AuthAdapter = new Proxy({} as AuthAdapter, {
  get(_target, prop, receiver) {
    if (!_singleton) _singleton = createAuthAdapter();
    return Reflect.get(_singleton as object, prop, receiver);
  },
});
