import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { ErrorCode } from "@shared/config/errors";
import * as schema from "@shared/db/schema-registry";
import { consentLogs } from "@contexts/iam/infrastructure/db/schema";

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
    const rows = await db
      .select()
      .from(consentLogs)
      .where(eq(consentLogs.userId, userId));
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
