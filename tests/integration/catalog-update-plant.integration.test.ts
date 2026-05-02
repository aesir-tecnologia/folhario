import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 07 — update-plant use-case integration tests (Task 1A RED).
 *
 * Tests:
 *  1  Happy path: PATCH name field → returns { ok: true, plant } with updated name
 *  2  Cross-user PATCH → { ok: false, code: not_found } (T-05-07-02)
 *  3  Empty patch {} → { ok: false, code: validation_failed }
 *  4  Unknown key in patch → { ok: false, code: validation_failed } (.strict)
 *  5  Concurrent LWW: last-write-wins (D-06)
 *  6  PATCH location → upserts location_suggestions row (D-09)
 *  7  PostHog capture fires after UoW commits (D-29)
 *  8  PostHog NOT fired when UoW throws (T-05-07-03)
 *  9  RLS defense: cross-user PATCH returns null from repo → not_found
 * 10  Outer tx (deps.tx): postCommit returned; PostHog not called until awaited; rollback keeps spy unfired
 */

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://127.0.0.1:54321";

const dbUrl = process.env.DATABASE_POOL_URL;
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@shared/telemetry/posthog-server", () => ({
  getPostHog: vi.fn(() => ({ capture: mockCapture, shutdown: mockShutdown })),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

describe.skipIf(!dbUrl)("Phase-05-07 updatePlant use-case integration", () => {
  const adminSql = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });
  const adminClient = createClient(supabaseUrl!, serviceRoleKey ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string;
  let otherUserId: string;

  let updatePlant: typeof import("@contexts/catalog/application/update-plant").updatePlant;
  let db: typeof import("@shared/db/client").db;

  beforeAll(async () => {
    ({ updatePlant } = await import("@contexts/catalog/application/update-plant"));
    ({ db } = await import("@shared/db/client"));

    if (!serviceRoleKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY missing. Run 'pnpm db:sync-env'.");
    }

    const runId = randomUUID().slice(0, 8);

    const { data: userA, error: errA } = await adminClient.auth.admin.createUser({
      email: `update-plant-userA-${runId}@test.local`,
      password: `pw-${randomUUID()}`,
      email_confirm: true,
    });
    if (errA || !userA.user) throw new Error(`createUser A: ${errA?.message}`);
    userId = userA.user.id;

    const { data: userB, error: errB } = await adminClient.auth.admin.createUser({
      email: `update-plant-userB-${runId}@test.local`,
      password: `pw-${randomUUID()}`,
      email_confirm: true,
    });
    if (errB || !userB.user) throw new Error(`createUser B: ${errB?.message}`);
    otherUserId = userB.user.id;

    // Verify public.users rows exist (trigger-based sync)
    const [rowA] = await adminSql<
      { id: string }[]
    >`SELECT id FROM public.users WHERE id = ${userId}`;
    const [rowB] = await adminSql<
      { id: string }[]
    >`SELECT id FROM public.users WHERE id = ${otherUserId}`;
    if (!rowA || !rowB) {
      throw new Error("auth.users -> public.users sync trigger did not fire. Run pnpm db:migrate.");
    }
  }, 30_000);

  afterAll(async () => {
    try {
      if (userId) {
        await adminSql`DELETE FROM public.plants WHERE user_id = ${userId}`;
        await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${userId}`;
        await adminClient.auth.admin.deleteUser(userId);
      }
      if (otherUserId) {
        await adminSql`DELETE FROM public.plants WHERE user_id = ${otherUserId}`;
        await adminSql`DELETE FROM public.users WHERE id = ${otherUserId}`;
        await adminClient.auth.admin.deleteUser(otherUserId);
      }
    } finally {
      await adminSql.end({ timeout: 5 });
    }
  });

  async function seedPlant(ownerId: string, _overrides: Record<string, unknown> = {}) {
    const [row] = await adminSql<{ id: string }[]>`
      INSERT INTO public.plants (user_id, name)
      VALUES (${ownerId}, ${"Test Plant"})
      RETURNING id
    `;
    if (!row) throw new Error("seedPlant: no row returned");
    return row.id;
  }

  beforeEach(() => {
    mockCapture.mockClear();
  });

  it("Test 1: happy path — PATCH name returns ok:true with updated plant", async () => {
    const plantId = await seedPlant(userId);
    const result = await updatePlant({ userId, plantId, patch: { name: "Costela 2" } });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("expected ok");
    expect(result.plant.name).toBe("Costela 2");
    expect(result.plant.id).toBe(plantId);
  });

  it("Test 2: cross-user PATCH returns not_found (T-05-07-02)", async () => {
    const plantId = await seedPlant(otherUserId);
    const result = await updatePlant({ userId, plantId, patch: { name: "Hacker" } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.code).toBe("not_found");
  });

  it("Test 3: empty patch {} returns validation_failed", async () => {
    const plantId = await seedPlant(userId);
    const result = await updatePlant({ userId, plantId, patch: {} });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.code).toBe("validation_failed");
  });

  it("Test 4: unknown key in patch returns validation_failed (.strict T-05-04-02)", async () => {
    const plantId = await seedPlant(userId);
    const result = await updatePlant({ userId, plantId, patch: { unknownKey: "x" } });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected not ok");
    expect(result.code).toBe("validation_failed");
  });

  it("Test 5: LWW — last PATCH wins, no 409 (D-06)", async () => {
    const plantId = await seedPlant(userId);
    const resultA = await updatePlant({ userId, plantId, patch: { name: "Alpha" } });
    const resultB = await updatePlant({ userId, plantId, patch: { name: "Beta" } });
    expect(resultA.ok).toBe(true);
    expect(resultB.ok).toBe(true);
    if (!resultB.ok) throw new Error("expected ok");
    expect(resultB.plant.name).toBe("Beta");
  });

  it("Test 6: PATCH location upserts location_suggestions row (D-09)", async () => {
    const plantId = await seedPlant(userId);
    await adminSql`DELETE FROM public.location_suggestions WHERE user_id = ${userId}`;

    const result = await updatePlant({ userId, plantId, patch: { location: "Sala" } });
    expect(result.ok).toBe(true);

    const [suggestion] = await adminSql<
      { label_display: string; label_normalized: string; usage_count: number }[]
    >`
      SELECT label_display, label_normalized, usage_count
      FROM public.location_suggestions
      WHERE user_id = ${userId}
    `;
    expect(suggestion).toBeDefined();
    expect(suggestion!.label_display).toBe("Sala");
    expect(suggestion!.usage_count).toBeGreaterThanOrEqual(1);
  });

  it("Test 7: PostHog capture fires after UoW commits (D-29)", async () => {
    const plantId = await seedPlant(userId);
    mockCapture.mockClear();

    const result = await updatePlant({ userId, plantId, patch: { name: "PostHog Test" } });
    expect(result.ok).toBe(true);
    expect(mockCapture).toHaveBeenCalledOnce();
    expect(mockCapture).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "plant_edited",
        properties: expect.objectContaining({ field: "name" }),
      }),
    );
  });

  it("Test 8: PostHog NOT fired when UoW throws (T-05-07-03)", async () => {
    const plantId = await seedPlant(userId);
    mockCapture.mockClear();

    // Mock withUnitOfWork to throw AFTER the ownership check passes
    const uowModule = await import("@shared/db/unit-of-work");
    const _originalUoW = uowModule.withUnitOfWork;
    const spy = vi
      .spyOn(uowModule, "withUnitOfWork")
      .mockRejectedValueOnce(new Error("simulated UoW failure"));

    try {
      await expect(
        updatePlant({ userId, plantId, patch: { name: "Should not fire" } }),
      ).rejects.toThrow("simulated UoW failure");
    } finally {
      spy.mockRestore();
    }

    // PostHog must NOT have fired (UoW threw before commit)
    expect(mockCapture).not.toHaveBeenCalled();
  });

  it("Test 9: RLS defense — cross-user PATCH returns not_found without mutating row", async () => {
    const plantId = await seedPlant(otherUserId);

    const [original] = await adminSql<{ name: string }[]>`
      SELECT name FROM public.plants WHERE id = ${plantId}
    `;
    const originalName = original!.name;

    const result = await updatePlant({ userId, plantId, patch: { name: "Hacked" } });
    expect(result.ok).toBe(false);

    const [after] = await adminSql<{ name: string }[]>`
      SELECT name FROM public.plants WHERE id = ${plantId}
    `;
    expect(after!.name).toBe(originalName);
  });

  it("Test 10: outer tx — postCommit returned; PostHog deferred; rollback keeps spy unfired", async () => {
    const plantId = await seedPlant(userId);
    mockCapture.mockClear();

    // Call with external tx: we manually open a transaction and roll it back
    let postCommitFn: (() => Promise<void>) | undefined;
    let resultFromTx:
      | { ok: boolean; plant?: { name: string }; postCommit?: () => Promise<void> }
      | undefined;

    try {
      await db.transaction(async (tx) => {
        resultFromTx = await updatePlant(
          { userId, plantId, patch: { name: "Outer TX Name" } },
          { tx },
        );
        postCommitFn = (resultFromTx as { ok: true; postCommit?: () => Promise<void> }).postCommit;

        // PostHog MUST NOT have fired yet (postCommit not called)
        expect(mockCapture).not.toHaveBeenCalled();

        // Roll back the transaction deliberately
        tx.rollback();
      });
    } catch {
      // Drizzle throws on rollback() — expected
    }

    // PostHog spy still unfired (rollback happened, postCommit not called)
    expect(mockCapture).not.toHaveBeenCalled();
    expect(resultFromTx?.ok).toBe(true);
    expect(postCommitFn).toBeDefined();

    // DB row should NOT have changed (rollback)
    const [afterRollback] = await adminSql<{ name: string }[]>`
      SELECT name FROM public.plants WHERE id = ${plantId}
    `;
    expect(afterRollback!.name).not.toBe("Outer TX Name");

    // Awaiting postCommit NOW fires PostHog
    if (postCommitFn) {
      await postCommitFn();
      expect(mockCapture).toHaveBeenCalledOnce();
    }
  });
});
