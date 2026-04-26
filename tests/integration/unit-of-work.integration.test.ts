import { randomUUID } from "node:crypto";

import { sql } from "drizzle-orm";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import * as schema from "@shared/db/schema-registry";

/**
 * Phase-2 Plan 05 Task 2: UnitOfWork + repositories integration test.
 *
 * Proves three contracts behaviorally against real Postgres:
 *
 *  1. `withUnitOfWork(userId, fn)` runs `fn` inside a transaction with
 *     `request.jwt.claim.sub` GUC set to `userId`. Reads of
 *     `current_setting('request.jwt.claim.sub')` inside the callback see
 *     the same value; outside the callback the GUC is missing/null.
 *
 *  2. `users.findById`, `consentLogs.create/listByUser`, and
 *     `plants.findByIdForUser` filter by user-id at the SQL layer
 *     (D-20 / T-02-12), so swapping the `userId` argument changes the
 *     observable result regardless of RLS.
 *
 *  3. The cross-context query service `iam/application/user-query-service`
 *     returns a pruned `UserSummary` (no `email`) for a real row.
 *
 * Test fixtures are inserted/cleaned up by the test itself — the test does
 * NOT depend on plan 02-04's seed rows. The only seed touchpoint is the
 * `legal_basis` PG enum, which lands in the migration (plan 02-03), not in
 * 02-04 seeds.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("Phase-02-05 UnitOfWork + repositories integration", () => {
  // Use an isolated postgres-js client/Drizzle instance for the test so we
  // can tear down without touching the production singleton in
  // `src/shared/db/client.ts`.
  const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
  const db = drizzle({ client: driver, schema });

  let userId: string;
  let otherUserId: string;
  let policyVersionId: string;
  let plantId: string;
  let withUnitOfWork: typeof import("@shared/db/unit-of-work").withUnitOfWork;
  let usersRepo: typeof import("@contexts/iam/infrastructure/db/users");
  let consentLogsRepo: typeof import("@contexts/iam/infrastructure/db/consent-logs");
  let plantsRepo: typeof import("@contexts/catalog/infrastructure/db/plants");
  let userQueryService: typeof import("@contexts/iam/application/user-query-service");

  beforeAll(async () => {
    // Lazy-import so DATABASE_POOL_URL is in scope before
    // `@shared/db/client` evaluates serverEnv.
    ({ withUnitOfWork } = await import("@shared/db/unit-of-work"));
    usersRepo = await import("@contexts/iam/infrastructure/db/users");
    consentLogsRepo = await import("@contexts/iam/infrastructure/db/consent-logs");
    plantsRepo = await import("@contexts/catalog/infrastructure/db/plants");
    userQueryService = await import("@contexts/iam/application/user-query-service");

    // Insert two users + a policy version + a plant so consent_log inserts
    // satisfy FK constraints. We commit (rather than rollback) because
    // `withUnitOfWork` runs its own nested transactions; cleanup happens in
    // `afterAll`.
    const userARow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"uow-a-" + randomUUID() + "@test.local"}, 'UoW Test A', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    const userBRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"uow-b-" + randomUUID() + "@test.local"}, 'UoW Test B', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userARow[0]!.id as string;
    otherUserId = userBRow[0]!.id as string;

    // version is varchar(32); compose a short test version string.
    const testVersion = `uow-${randomUUID().slice(0, 8)}`;
    const policyRow = await driver`
      INSERT INTO policy_versions (version, document_type, effective_at, is_current)
      VALUES (${testVersion}, 'privacy_policy', NOW(), false)
      RETURNING id
    `;
    policyVersionId = policyRow[0]!.id as string;

    const plantRow = await driver`
      INSERT INTO plants (user_id, name)
      VALUES (${userId}, 'UoW Test Plant')
      RETURNING id
    `;
    plantId = plantRow[0]!.id as string;
  });

  afterAll(async () => {
    if (userId) await driver`DELETE FROM users WHERE id IN (${userId}, ${otherUserId})`;
    if (policyVersionId) await driver`DELETE FROM policy_versions WHERE id = ${policyVersionId}`;
    await driver.end({ timeout: 5 });
  });

  it("withUnitOfWork sets request.jwt.claim.sub inside the callback", async () => {
    const observed = await withUnitOfWork(userId, async (tx) => {
      const rows = await tx.execute<{ sub: string | null }>(
        sql`select current_setting('request.jwt.claim.sub', true) as sub`,
      );
      return rows[0]?.sub ?? null;
    });
    expect(observed).toBe(userId);
  });

  it("withUnitOfWork switches to authenticated role so RLS engages (CR-02)", async () => {
    const observed = await withUnitOfWork(userId, async (tx) => {
      const rows = await tx.execute<{ role: string }>(sql`select current_user as role`);
      return rows[0]?.role ?? null;
    });
    expect(observed).toBe("authenticated");
  });

  it("withUnitOfWork rejects empty/non-string userId before opening a transaction", async () => {
    await expect(withUnitOfWork("", async () => "ok")).rejects.toThrow(/non-empty string/);
    await expect(
      // @ts-expect-error – intentional runtime check
      withUnitOfWork(null, async () => "ok"),
    ).rejects.toThrow(/must be a string/);
    await expect(
      // @ts-expect-error – intentional runtime check
      withUnitOfWork(123, async () => "ok"),
    ).rejects.toThrow(/must be a string/);
  });

  it("users.findById returns null for an unknown id and the row otherwise", async () => {
    expect(await usersRepo.findById(db, randomUUID())).toBeNull();
    const found = await usersRepo.findById(db, userId);
    expect(found?.id).toBe(userId);
    expect(found?.trialSource).toBe("organic");
  });

  it("consentLogs.listByUser scopes by userId regardless of RLS", async () => {
    // Insert a consent log for userA via the repository inside a UoW.
    const created = await withUnitOfWork(userId, (tx) =>
      consentLogsRepo.create(tx, {
        userId,
        purpose: "analytics",
        legalBasis: "consent",
        policyVersionId,
        source: "settings",
        grantedAt: new Date().toISOString(),
      }),
    );
    expect(created.userId).toBe(userId);

    // userA sees the row.
    const ownRows = await consentLogsRepo.listByUser(db, userId, { limit: 50 });
    expect(ownRows.some((r) => r.id === created.id)).toBe(true);

    // userB does NOT see userA's row even though we go through the same
    // service-role connection — the explicit `where user_id = $1` filter
    // is the load-bearing safety here (D-20).
    const otherRows = await consentLogsRepo.listByUser(db, otherUserId, { limit: 50 });
    expect(otherRows.some((r) => r.id === created.id)).toBe(false);
  });

  it("plants.findByIdForUser enforces ownership in the SQL filter", async () => {
    const owner = await plantsRepo.findByIdForUser(db, userId, plantId);
    expect(owner?.id).toBe(plantId);

    const stranger = await plantsRepo.findByIdForUser(db, otherUserId, plantId);
    expect(stranger).toBeNull();
  });

  it("user-query-service returns a pruned summary for a real user", async () => {
    const summary = await userQueryService.getUserSummary(db, userId);
    expect(summary?.id).toBe(userId);
    expect(summary?.timezone).toBe("America/Sao_Paulo");
    expect(summary?.trialSource).toBe("organic");
    // Email must NOT leak to other contexts via the query service.
    expect(summary).not.toHaveProperty("email");
    expect(summary).not.toHaveProperty("name");
  });
});
