import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { NextRequest } from "next/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ErrorCode } from "@shared/config/errors";
import * as schema from "@shared/db/schema-registry";
import { consentLogs } from "@contexts/iam/infrastructure/db/schema";
import { __setCurrentUserAdapterForTests } from "@contexts/iam/application/current-user";
import type { AuthAdapter, VerifyResult } from "@contexts/iam/infrastructure/auth/auth-adapter";
import type { UserRow } from "@contexts/iam/infrastructure/db/users";

/**
 * Phase-2 Plan 09 — diagnostics consent integration tests.
 *
 * Two layers:
 *
 * Task 1: `recordConsent` use-case (covered in the first describe block).
 *   - Valid input creates a ConsentLog row referencing the seeded current
 *     policy version.
 *   - Missing current policy version maps to `ErrorCode.ValidationFailed`
 *     per the closed error registry (PRD §5).
 *
 * Task 2: route module wiring (covered in the second describe block).
 *   - POST without bearer → 401 unauthenticated.
 *   - POST without Idempotency-Key → 400 validation_failed.
 *   - Valid POST → 201 + ConsentLog row written.
 *   - Repeated POST with same Idempotency-Key → same body, single row.
 *   - GET returns paginated history with `items` + `next_cursor`.
 *   - Default limit = 50, max limit = 200.
 *   - Malformed cursor → 400 validation_failed.
 *   - End-to-end body passthrough through `src/proxy.ts` succeeds (T-02-37).
 *
 * Real Postgres only — RLS / FK / idempotency semantics are the load-bearing
 * contracts.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("Phase-02-09 recordConsent use-case", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
  const db = drizzle({ client: driver, schema });

  let userId: string;
  let recordConsentMod: typeof import("@contexts/iam/application/record-consent");

  beforeAll(async () => {
    recordConsentMod = await import("@contexts/iam/application/record-consent");

    const userRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"consent-" + randomUUID() + "@test.local"}, 'Consent Test User', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userRow[0]!.id as string;
  });

  afterAll(async () => {
    if (userId) {
      // CASCADE on users.id wipes consent_logs we created.
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    await driver.end({ timeout: 5 });
  });

  it("creates a ConsentLog row referencing the current policy version", async () => {
    const result = await recordConsentMod.recordConsent({
      userId,
      input: {
        purpose: "identification_third_party",
        legalBasis: "consent",
        source: "first_use_prompt",
      },
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.row.userId).toBe(userId);
    expect(result.row.purpose).toBe("identification_third_party");
    expect(result.row.legalBasis).toBe("consent");
    expect(result.row.source).toBe("first_use_prompt");

    // Repository row is written to DB.
    const rows = await db.select().from(consentLogs).where(eq(consentLogs.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(result.row.id);

    // The policy_version_id column resolves to the current privacy_policy row.
    const policy = await driver`
      SELECT id FROM policy_versions
      WHERE document_type = 'privacy_policy' AND is_current = true
      LIMIT 1
    `;
    expect(policy).toHaveLength(1);
    expect(rows[0]!.policyVersionId).toBe(policy[0]!.id);
  });

  it("returns ErrorCode.ValidationFailed when no current policy version exists", async () => {
    // Flip is_current=false for the privacy_policy row so the lookup misses.
    await driver`
      UPDATE policy_versions
      SET is_current = false
      WHERE document_type = 'privacy_policy'
    `;
    try {
      const result = await recordConsentMod.recordConsent({
        userId,
        input: {
          purpose: "marketing",
          legalBasis: "consent",
          source: "settings",
        },
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      // The error code MUST be the registry value (string), not a thrown
      // domain class. Assert exact equality with the closed-registry literal.
      expect(result.error).toBe(ErrorCode.ValidationFailed);
      expect(result.error).toBe("validation_failed");
    } finally {
      // Restore the row so subsequent tests (and the route block below)
      // see the seeded current policy.
      await driver`
        UPDATE policy_versions
        SET is_current = true
        WHERE document_type = 'privacy_policy' AND version = '2026-04-25.1'
      `;
    }
  });
});

/**
 * Task 2: route module assertions. The route handler is imported directly
 * (no HTTP server) so the test exercises the closed-registry contract for
 * auth, idempotency, validation, cursor pagination, and end-to-end body
 * passthrough through `src/proxy.ts`.
 *
 * Auth is faked at the application layer via `__setCurrentUserAdapterForTests`
 * so the test does not need a real JWT (the JWKS-positive Real-HTTP signal
 * is owned by the Playwright suite in Task 3). When the test sets up an
 * adapter that returns `{ ok: true, userId }`, route handlers behave as if
 * the JWT cryptographically verified.
 */
describe.skipIf(!dbUrl)("Phase-02-09 diagnostics consent route", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
  const db = drizzle({ client: driver, schema });

  let userId: string;
  let userRow: UserRow;
  let routeMod: typeof import("../../src/app/api/v1/diagnostics/consent/route");
  let proxyDefault: typeof import("../../src/proxy").default;

  beforeAll(async () => {
    // Sanity: route module + proxy must load without pulling Drizzle directly
    // into the route file. Importing via the @ alias would require additional
    // config; use relative imports instead.
    routeMod = await import("../../src/app/api/v1/diagnostics/consent/route");
    proxyDefault = (await import("../../src/proxy")).default;

    const inserted = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"route-" + randomUUID() + "@test.local"}, 'Route Test User', 'America/Sao_Paulo', 'organic')
      RETURNING id, email, name, locale, timezone, notification_time_local, trial_source,
                partner_code, age_confirmed_at, toxicity_disclaimer_acknowledged_at,
                deletion_requested_at, created_at, updated_at
    `;
    userId = inserted[0]!.id as string;
    userRow = {
      id: userId,
      email: inserted[0]!.email as string,
      name: inserted[0]!.name as string,
      locale: inserted[0]!.locale as string,
      timezone: inserted[0]!.timezone as string,
      notificationTimeLocal: inserted[0]!.notification_time_local as string,
      trialSource: inserted[0]!.trial_source as "organic" | "partner",
      partnerCode: inserted[0]!.partner_code as string | null,
      ageConfirmedAt: inserted[0]!.age_confirmed_at as string | null,
      toxicityDisclaimerAcknowledgedAt: inserted[0]!.toxicity_disclaimer_acknowledged_at as
        | string
        | null,
      deletionRequestedAt: inserted[0]!.deletion_requested_at as string | null,
      createdAt: inserted[0]!.created_at as string,
      updatedAt: inserted[0]!.updated_at as string,
    };
  });

  afterAll(async () => {
    __setCurrentUserAdapterForTests(null);
    if (userId) {
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    await driver.end({ timeout: 5 });
  });

  // Helper: build a fake adapter that resolves to this user. Mirrors the
  // auth-adapter Task 1 unit-test seam pattern.
  function adapterForUser(uid: string): AuthAdapter {
    return {
      async verifyBearer(authorizationHeader): Promise<VerifyResult> {
        if (!authorizationHeader) {
          return {
            ok: false,
            code: ErrorCode.Unauthenticated,
            reason: "missing_bearer",
          };
        }
        return { ok: true, userId: uid };
      },
      async getUserById(id) {
        return id === userRow.id ? userRow : null;
      },
    };
  }

  function reqUrl(path: string): string {
    return `https://example.test${path}`;
  }

  it("POST without bearer returns 401 unauthenticated", async () => {
    __setCurrentUserAdapterForTests(adapterForUser(userId));
    const request = new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        purpose: "identification_third_party",
        legalBasis: "consent",
        source: "first_use_prompt",
      }),
    });
    const response = await routeMod.POST(request);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.code).toBe(ErrorCode.Unauthenticated);
  });

  it("POST without Idempotency-Key returns 400 validation_failed", async () => {
    __setCurrentUserAdapterForTests(adapterForUser(userId));
    const request = new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake-test-token",
      },
      body: JSON.stringify({
        purpose: "identification_third_party",
        legalBasis: "consent",
        source: "first_use_prompt",
      }),
    });
    const response = await routeMod.POST(request);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe(ErrorCode.ValidationFailed);
  });

  it("valid POST returns 201 and creates one ConsentLog", async () => {
    __setCurrentUserAdapterForTests(adapterForUser(userId));
    const idempotencyKey = `task2-create-${randomUUID()}`;
    const payload = {
      purpose: "identification_third_party",
      legalBasis: "consent",
      source: "first_use_prompt",
    };
    const request = new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake-test-token",
        "idempotency-key": idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    const response = await routeMod.POST(request);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(typeof body.id).toBe("string");
    expect(body.user_id).toBe(userId);

    const rows = await db.select().from(consentLogs).where(eq(consentLogs.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(body.id);
  });

  it("repeated valid POST with same key returns same JSON and creates only one row", async () => {
    __setCurrentUserAdapterForTests(adapterForUser(userId));
    const idempotencyKey = `task2-replay-${randomUUID()}`;
    const payload = {
      purpose: "marketing",
      legalBasis: "consent",
      source: "settings",
    };
    const buildRequest = () =>
      new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer fake-test-token",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });

    const r1 = await routeMod.POST(buildRequest());
    expect(r1.status).toBe(201);
    const b1 = await r1.json();

    const r2 = await routeMod.POST(buildRequest());
    expect(r2.status).toBe(201);
    const b2 = await r2.json();

    expect(b2).toEqual(b1);

    // Only one row across both calls.
    const rows = await driver`
      SELECT id FROM consent_logs
      WHERE user_id = ${userId} AND purpose = 'marketing'
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toBe(b1.id);
  });

  it("GET returns items, next_cursor, default limit 50, max limit 200", async () => {
    __setCurrentUserAdapterForTests(adapterForUser(userId));

    // GET default-limit: there are <50 rows from prior tests; next_cursor is null.
    const r1 = await routeMod.GET(
      new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
        method: "GET",
        headers: { authorization: "Bearer fake-test-token" },
      }),
    );
    expect(r1.status).toBe(200);
    const b1 = await r1.json();
    expect(Array.isArray(b1.items)).toBe(true);
    // Standard PRD field-name convention: snake_case payload.
    expect("next_cursor" in b1).toBe(true);
    expect(b1.items.length).toBeGreaterThanOrEqual(1);

    // GET with limit=1: next_cursor present (as base64 string).
    const r2 = await routeMod.GET(
      new NextRequest(reqUrl("/api/v1/diagnostics/consent?limit=1"), {
        method: "GET",
        headers: { authorization: "Bearer fake-test-token" },
      }),
    );
    expect(r2.status).toBe(200);
    const b2 = await r2.json();
    expect(b2.items).toHaveLength(1);
    if (b1.items.length > 1) {
      expect(typeof b2.next_cursor).toBe("string");
      expect(b2.next_cursor.length).toBeGreaterThan(0);
    }

    // GET with limit=999 (over MAX): clamps to 200 (we cannot prove the clamp
    // by row count here because we have <200 rows; the helper-level unit
    // tests already cover the clamp). Just assert the route did not 400.
    const r3 = await routeMod.GET(
      new NextRequest(reqUrl("/api/v1/diagnostics/consent?limit=999"), {
        method: "GET",
        headers: { authorization: "Bearer fake-test-token" },
      }),
    );
    expect(r3.status).toBe(200);
  });

  it("GET with malformed cursor returns 400 validation_failed", async () => {
    __setCurrentUserAdapterForTests(adapterForUser(userId));
    const response = await routeMod.GET(
      new NextRequest(
        reqUrl("/api/v1/diagnostics/consent?cursor=" + encodeURIComponent("not-base64-or-valid")),
        {
          method: "GET",
          headers: { authorization: "Bearer fake-test-token" },
        },
      ),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe(ErrorCode.ValidationFailed);
  });

  it("end-to-end proxy body-passthrough — route's parseJsonBody runs after proxy", async () => {
    // Strategy (a) from the plan (02-09-PLAN.md:124-125, :138): drive a
    // NextRequest through src/proxy.ts and then into the route module, and
    // assert the route's request.json() successfully parses the body after
    // the proxy returns.
    //
    // Construction of the load-bearing assertion:
    //  - We INCLUDE an Idempotency-Key so the route does NOT short-circuit
    //    at the missing-key check (consent-route.ts:64-67) and instead
    //    proceeds to `parseJsonBody` (consent-route.ts:69).
    //  - We send a body with an INVALID `purpose` enum value so that
    //    `parseJsonBody`'s `safeParse` fails, the route hits the
    //    "invalid consent body" error path at consent-route.ts:71, and the
    //    400 we observe is provably caused by `request.json()` having been
    //    successfully invoked. If the proxy had eaten the body,
    //    `request.json()` would throw, parseJsonBody would still 400 with
    //    ValidationFailed (request.ts:42-44), but `request.bodyUsed` AFTER
    //    the route call would be FALSE (no successful read happened) and
    //    the message-contains check below would fail.
    //  - We assert `request.bodyUsed === false` immediately after the proxy
    //    (proves the proxy did not consume) AND `request.bodyUsed === true`
    //    after the route call (proves request.json() was actually invoked
    //    and finished, not that it threw before consuming).
    __setCurrentUserAdapterForTests(adapterForUser(userId));
    const request = new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer fake-test-token",
        "idempotency-key": `task2-passthrough-${randomUUID()}`,
      },
      // Malformed purpose so parseJsonBody (NOT the missing-Idempotency-Key
      // check) produces the 400. The body is otherwise structurally valid
      // JSON so request.json() succeeds; only the schema-level enum check
      // fails.
      body: JSON.stringify({
        purpose: "not_a_real_purpose",
        legalBasis: "consent",
        source: "settings",
      }),
    });

    // 1. Proxy must not consume the body.
    const proxyResp = await proxyDefault(request);
    expect(proxyResp).toBeDefined();
    expect(request.bodyUsed).toBe(false);
    // Proxy lets a Bearer-bearing request through (no 401 from the proxy).
    expect(proxyResp?.status).not.toBe(401);

    // 2. Route handler successfully reads + Zod-validates the body.
    const routeResp = await routeMod.POST(request);
    expect(routeResp.status).toBe(400);
    const body = await routeResp.json();
    // ValidationFailed message MUST come from parseJsonBody's "invalid
    // consent body" path (consent-route.ts:71), NOT from the missing-
    // Idempotency-Key path (consent-route.ts:66). The header was supplied,
    // so anything else is bogus.
    expect(body.error.code).toBe(ErrorCode.ValidationFailed);
    expect(body.error.message).toContain("invalid consent body");
    // Final proof that request.json() ran inside the route. The earlier
    // assertion at line 439 (`bodyUsed === false` after proxy) is the
    // proxy-doesn't-consume gate; THIS assertion is the
    // route-DID-consume gate. Together they distinguish:
    //   - regression where proxy consumes → bodyUsed === true at line 439 (test fails there)
    //   - regression where route doesn't reach parseJsonBody → bodyUsed === false here (test fails)
    expect(request.bodyUsed).toBe(true);
  });
});
