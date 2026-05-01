import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 06 — cleanupStorageReconciler hourly cron integration tests (Task 3 RED).
 *
 * Tests invoke cleanupStorageReconcilerHandler directly (same pattern as Task 2).
 *
 * Cycles:
 *  3A — happy path: batch processing, batch limit (50), stale in_progress recovery
 *  3B — backoff schedule: D-24 BACKOFF_MINUTES[attempts-1] respected
 *  3C — service-role / BYPASSRLS proof: multi-user rows processed in one invocation
 *  3D — registry wiring: catalogFunctions in registry, length === 11
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase. " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

vi.mock("@shared/inngest/client", () => ({
  inngest: {
    send: vi.fn().mockResolvedValue({ ids: ["test-event-id"] }),
    createFunction: (config: Record<string, unknown>, handler: unknown) => ({
      ...config,
      _handler: handler,
      id: () => config.id,
      opts: config,
    }),
  },
}));

type StorageAdapterShape = import("@shared/adapters/storage").StorageAdapter;

interface FakeAdapter {
  deletePrefix: ReturnType<typeof vi.fn>;
  asAdapter: StorageAdapterShape;
}

function makeFakeAdapter(): FakeAdapter {
  const deletePrefix = vi.fn().mockResolvedValue(undefined);

  const asAdapter: StorageAdapterShape = {
    uploadObject: vi.fn().mockResolvedValue({}),
    createSignedUrl: vi.fn().mockResolvedValue({ signedUrl: "https://example.test/url" }),
    deletePrefix: deletePrefix as unknown as StorageAdapterShape["deletePrefix"],
    deleteObject: vi.fn().mockResolvedValue(undefined),
    listBuckets: vi.fn().mockResolvedValue([]),
    listObjectsUnderPrefix: vi.fn().mockResolvedValue([]),
  };

  return { deletePrefix, asAdapter };
}

function makeFakeStep() {
  return {
    run: async (_name: string, fn: () => Promise<unknown>) => fn(),
  };
}

describe.skipIf(!dbUrl)("Phase-05-06 cleanupStorageReconciler hourly cron", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });

  let userId: string;
  let userId2: string;
  let plantId: string;
  let plantId2: string;

  let cleanupStorageReconcilerHandler: (args: {
    step: ReturnType<typeof makeFakeStep>;
  }) => Promise<{ processedCount: number }>;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;

  beforeAll(async () => {
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));

    const { cleanupStorageReconcilerHandler: handler } = await import(
      "@contexts/catalog/inngest/functions"
    );
    cleanupStorageReconcilerHandler = handler;

    const userRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"reconciler-" + randomUUID() + "@test.local"}, 'Reconciler Test', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userRow[0]!.id as string;

    const userRow2 = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"reconciler2-" + randomUUID() + "@test.local"}, 'Reconciler Test 2', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId2 = userRow2[0]!.id as string;

    plantId = randomUUID();
    await driver`INSERT INTO plants (id, user_id, name) VALUES (${plantId}, ${userId}, 'Test Plant')`;

    plantId2 = randomUUID();
    await driver`INSERT INTO plants (id, user_id, name) VALUES (${plantId2}, ${userId2}, 'Test Plant 2')`;
  });

  afterAll(async () => {
    if (userId) {
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    if (userId2) {
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId2}`;
      await driver`DELETE FROM plants WHERE id = ${plantId2}`;
      await driver`DELETE FROM users WHERE id = ${userId2}`;
    }
    await driver.end({ timeout: 5 });
  });

  afterEach(async () => {
    setStorageAdapterForTests(null);
    vi.clearAllMocks();
    await driver`DELETE FROM pending_storage_deletions WHERE user_id IN (${userId}, ${userId2})`;
  });

  async function insertPsdRow(opts: {
    uid: string;
    pid: string;
    bucket?: string;
    status?: string;
    attempts?: number;
    scheduledAt?: Date;
    startedAt?: Date | null;
  }) {
    const bucket = opts.bucket ?? "plant-photos";
    const prefix = `${opts.uid}/${opts.pid}/`;

    if (opts.status && opts.status !== "pending") {
      const [row] = await driver`
        INSERT INTO pending_storage_deletions (user_id, bucket, prefix)
        VALUES (${opts.uid}, ${bucket}, ${prefix})
        RETURNING id
      `;
      const id = row!.id as string;
      const scheduledAt = opts.scheduledAt ?? new Date();
      const startedAt = opts.startedAt ?? null;
      await driver`
        UPDATE pending_storage_deletions
        SET
          status = ${opts.status}::pending_deletion_status,
          attempts = ${opts.attempts ?? 0},
          scheduled_at = ${scheduledAt.toISOString()},
          started_at = ${startedAt ? startedAt.toISOString() : null}
        WHERE id = ${id}
      `;
      return id;
    }

    const [row] = await driver`
      INSERT INTO pending_storage_deletions (user_id, bucket, prefix)
      VALUES (${opts.uid}, ${bucket}, ${prefix})
      RETURNING id
    `;
    const id = row!.id as string;
    const scheduledAt = opts.scheduledAt ?? new Date();
    await driver`
      UPDATE pending_storage_deletions
      SET
        attempts = ${opts.attempts ?? 0},
        scheduled_at = ${scheduledAt.toISOString()}
      WHERE id = ${id}
    `;
    return id;
  }

  // =====================================================================
  // Cycle 3A — happy path under cron
  // =====================================================================

  it("3A-1: reconciler processes 3 pending rows — all become 'completed', deletePrefix called 3 times", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const ago = new Date(Date.now() - 10000);

    await insertPsdRow({ uid: userId, pid: plantId, scheduledAt: ago });
    await insertPsdRow({ uid: userId, pid: plantId, bucket: "plant-thumbnails", scheduledAt: ago });
    await insertPsdRow({ uid: userId, pid: randomUUID(), scheduledAt: ago });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    expect(fake.deletePrefix).toHaveBeenCalledTimes(3);

    const rows = await driver`
      SELECT status FROM pending_storage_deletions WHERE user_id = ${userId}
    `;
    expect(rows.every((r: Record<string, unknown>) => r.status === "completed")).toBe(true);
  });

  it("3A-2: batch limit — 60 rows seeded, reconciler processes exactly 50", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const ago = new Date(Date.now() - 10000);

    for (let i = 0; i < 60; i++) {
      await insertPsdRow({ uid: userId, pid: randomUUID(), scheduledAt: ago });
    }

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    expect(fake.deletePrefix).toHaveBeenCalledTimes(50);

    const completed = await driver`
      SELECT count(*) as cnt FROM pending_storage_deletions
      WHERE user_id = ${userId} AND status = 'completed'
    `;
    expect(Number(completed[0]!.cnt)).toBe(50);

    const pending = await driver`
      SELECT count(*) as cnt FROM pending_storage_deletions
      WHERE user_id = ${userId} AND status = 'pending'
    `;
    expect(Number(pending[0]!.cnt)).toBe(10);
  });

  it("3A-3: stale in_progress recovery — row with started_at 45min ago is recovered (HIGH-4)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const ago = new Date(Date.now() - 10000);
    const staleStartedAt = new Date(Date.now() - 45 * 60 * 1000);

    const rowId = await insertPsdRow({
      uid: userId,
      pid: plantId,
      status: "in_progress",
      attempts: 1,
      scheduledAt: ago,
      startedAt: staleStartedAt,
    });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const updated = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(updated[0]!.status).toBe("completed");
    expect(fake.deletePrefix).toHaveBeenCalledTimes(1);
  });

  // =====================================================================
  // Cycle 3B — backoff schedule
  // =====================================================================

  it("3B-1 (attempts=1 → 5min backoff): row not processed before 5min, processed after 5min from scheduled_at", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const fourMinAgo = new Date(Date.now() - 4 * 60 * 1000);
    const rowId = await insertPsdRow({
      uid: userId,
      pid: plantId,
      attempts: 1,
      scheduledAt: fourMinAgo,
    });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const notProcessed = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(notProcessed[0]!.status).toBe("pending");
    expect(fake.deletePrefix).not.toHaveBeenCalled();

    const sixMinAgo = new Date(Date.now() - 6 * 60 * 1000);
    await driver`UPDATE pending_storage_deletions SET scheduled_at = ${sixMinAgo.toISOString()} WHERE id = ${rowId}`;

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const processed = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(processed[0]!.status).toBe("completed");
    expect(fake.deletePrefix).toHaveBeenCalledTimes(1);
  });

  it("3B-2 (attempts=2 → 30min backoff): row not processed before 30min, processed after 30min", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const twentyNineMinAgo = new Date(Date.now() - 29 * 60 * 1000);
    const rowId = await insertPsdRow({
      uid: userId,
      pid: plantId,
      attempts: 2,
      scheduledAt: twentyNineMinAgo,
    });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const notProcessed = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(notProcessed[0]!.status).toBe("pending");
    expect(fake.deletePrefix).not.toHaveBeenCalled();

    const thirtyOneMinAgo = new Date(Date.now() - 31 * 60 * 1000);
    await driver`UPDATE pending_storage_deletions SET scheduled_at = ${thirtyOneMinAgo.toISOString()} WHERE id = ${rowId}`;

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const processed = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(processed[0]!.status).toBe("completed");
    expect(fake.deletePrefix).toHaveBeenCalledTimes(1);
  });

  it("3B-3 (attempts=3 → 4h backoff): row not processed before 4h, processed after 4h", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const threeH59MinAgo = new Date(Date.now() - (4 * 60 - 1) * 60 * 1000);
    const rowId = await insertPsdRow({
      uid: userId,
      pid: plantId,
      attempts: 3,
      scheduledAt: threeH59MinAgo,
    });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const notProcessed = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(notProcessed[0]!.status).toBe("pending");
    expect(fake.deletePrefix).not.toHaveBeenCalled();

    const fourH1MinAgo = new Date(Date.now() - (4 * 60 + 1) * 60 * 1000);
    await driver`UPDATE pending_storage_deletions SET scheduled_at = ${fourH1MinAgo.toISOString()} WHERE id = ${rowId}`;

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const processed = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(processed[0]!.status).toBe("completed");
    expect(fake.deletePrefix).toHaveBeenCalledTimes(1);
  });

  it("3B-5 (attempts=5 → terminal): row transitions to 'failed', deletePrefix NOT called (T-05-06-03)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const ago = new Date(Date.now() - 10000);
    const rowId = await insertPsdRow({
      uid: userId,
      pid: plantId,
      attempts: 5,
      scheduledAt: ago,
    });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    const updated = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${rowId}`;
    expect(updated[0]!.status).toBe("failed");
    expect(fake.deletePrefix).not.toHaveBeenCalled();
  });

  // =====================================================================
  // Cycle 3C — service-role / BYPASSRLS proof (Pitfall 4)
  // =====================================================================

  it("3C-1: reconciler processes rows from 2 different users in one invocation (BYPASSRLS proof)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const ago = new Date(Date.now() - 10000);

    await insertPsdRow({ uid: userId, pid: plantId, scheduledAt: ago });
    await insertPsdRow({ uid: userId2, pid: plantId2, scheduledAt: ago });

    await cleanupStorageReconcilerHandler({ step: makeFakeStep() });

    expect(fake.deletePrefix).toHaveBeenCalledTimes(2);

    const u1Rows = await driver`SELECT status FROM pending_storage_deletions WHERE user_id = ${userId}`;
    const u2Rows = await driver`SELECT status FROM pending_storage_deletions WHERE user_id = ${userId2}`;
    expect(u1Rows[0]!.status).toBe("completed");
    expect(u2Rows[0]!.status).toBe("completed");
  });

  // =====================================================================
  // Cycle 3D — registry wiring
  // =====================================================================

  it("3D-1: registry contains exactly 11 functions, catalogFunctions are all present", async () => {
    const { registry } = await import("@shared/inngest/registry");
    const { catalogFunctions } = await import("@contexts/catalog/inngest/functions");

    expect(registry).toHaveLength(11);

    const registryIds = registry.map((f: { id?: () => string }) => f.id?.());
    for (const fn of catalogFunctions) {
      const fnId = (fn as { id?: () => string }).id?.();
      expect(registryIds).toContain(fnId);
    }
  });
});
