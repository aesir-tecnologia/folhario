import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 06 — cleanupStorage Inngest handler integration tests (Task 2 RED).
 *
 * Tests invoke the handler function directly (not via the Inngest runtime):
 *   const { cleanupStorageHandler } = await import("@contexts/catalog/inngest/functions");
 *   await cleanupStorageHandler({ event, step: makeFakeStep() });
 *
 * Cycles:
 *  2A — happy path: deletePrefix called, status → completed
 *  2B — idempotency: re-run on completed row is a no-op
 *  2C — failure paths: RetryAfterError, prefix mis-scope, concurrency guard
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
    }),
  },
}));

type StorageAdapterShape = import("@shared/adapters/storage").StorageAdapter;

interface FakeAdapter {
  deletePrefix: ReturnType<typeof vi.fn>;
  asAdapter: StorageAdapterShape;
}

function makeFakeAdapter(opts?: { throwOnDelete?: boolean }): FakeAdapter {
  const deletePrefix = vi.fn(
    async ({ bucket: _bucket, prefix: _prefix }: { bucket: string; prefix: string }) => {
      if (opts?.throwOnDelete) {
        throw new Error("simulated storage failure");
      }
    },
  );

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

describe.skipIf(!dbUrl)("Phase-05-06 cleanupStorage Inngest handler", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });

  let userId: string;
  let plantId: string;

  let cleanupStorageHandler: (args: {
    event: { data: unknown };
    step: ReturnType<typeof makeFakeStep>;
  }) => Promise<unknown>;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
  let pendingDeletionsRepo: typeof import("@contexts/catalog/infrastructure/db/pending-storage-deletions");

  beforeAll(async () => {
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));
    pendingDeletionsRepo = await import(
      "@contexts/catalog/infrastructure/db/pending-storage-deletions"
    );

    const { cleanupStorageHandler: handler } = await import(
      "@contexts/catalog/inngest/functions"
    );
    cleanupStorageHandler = handler;

    const userRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"cleanup-storage-" + randomUUID() + "@test.local"}, 'Cleanup Test', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userRow[0]!.id as string;

    plantId = randomUUID();
    await driver`
      INSERT INTO plants (id, user_id, name) VALUES (${plantId}, ${userId}, 'Test Plant')
    `;
  });

  afterAll(async () => {
    if (userId) {
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    await driver.end({ timeout: 5 });
  });

  afterEach(async () => {
    setStorageAdapterForTests(null);
    vi.clearAllMocks();
    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  async function insertPsdRow(bucket: string, prefix: string) {
    const [row] = await driver`
      INSERT INTO pending_storage_deletions (user_id, bucket, prefix)
      VALUES (${userId}, ${bucket}, ${prefix})
      RETURNING id, user_id, bucket, prefix, status, attempts
    `;
    return row as { id: string; user_id: string; bucket: string; prefix: string; status: string; attempts: number };
  }

  // =====================================================================
  // Cycle 2A — happy path
  // =====================================================================

  it("2A-1: handler processes one row — deletePrefix called, status transitions to 'completed'", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const prefix = `${userId}/${plantId}/`;
    const row = await insertPsdRow("plant-photos", prefix);

    const fakeRow2Id = randomUUID();
    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [row.id, fakeRow2Id] as [string, string],
      },
    };

    await cleanupStorageHandler({ event, step: makeFakeStep() });

    expect(fake.deletePrefix).toHaveBeenCalledWith({ bucket: "plant-photos", prefix });

    const updated = await driver`
      SELECT status, completed_at FROM pending_storage_deletions WHERE id = ${row.id}
    `;
    expect(updated[0]!.status).toBe("completed");
    expect(updated[0]!.completed_at).not.toBeNull();
  });

  it("2A-2: handler processes BOTH rows from deletionRowIds — deletePrefix called twice with different buckets", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const prefix = `${userId}/${plantId}/`;
    const photoRow = await insertPsdRow("plant-photos", prefix);
    const thumbRow = await insertPsdRow("plant-thumbnails", prefix);

    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [photoRow.id, thumbRow.id] as [string, string],
      },
    };

    await cleanupStorageHandler({ event, step: makeFakeStep() });

    expect(fake.deletePrefix).toHaveBeenCalledTimes(2);
    const buckets = fake.deletePrefix.mock.calls.map(
      (c) => (c[0] as { bucket: string; prefix: string }).bucket,
    );
    expect(buckets.sort()).toEqual(["plant-photos", "plant-thumbnails"].sort());

    const photoUpdated = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${photoRow.id}`;
    const thumbUpdated = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${thumbRow.id}`;
    expect(photoUpdated[0]!.status).toBe("completed");
    expect(thumbUpdated[0]!.status).toBe("completed");
  });

  // =====================================================================
  // Cycle 2B — idempotency (Pitfall 6)
  // =====================================================================

  it("2B-1: handler succeeds when prefix has already been emptied (adapter no-ops on missing keys)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const prefix = `${userId}/${plantId}/`;
    const row = await insertPsdRow("plant-photos", prefix);

    const fakeRow2Id = randomUUID();
    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [row.id, fakeRow2Id] as [string, string],
      },
    };

    await cleanupStorageHandler({ event, step: makeFakeStep() });

    const updated = await driver`SELECT status FROM pending_storage_deletions WHERE id = ${row.id}`;
    expect(updated[0]!.status).toBe("completed");
  });

  it("2B-2: re-running handler on a 'completed' row is a no-op — deletePrefix NOT called again, status stays 'completed'", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const prefix = `${userId}/${plantId}/`;
    const row = await insertPsdRow("plant-photos", prefix);

    const fakeRow2Id = randomUUID();
    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [row.id, fakeRow2Id] as [string, string],
      },
    };

    await cleanupStorageHandler({ event, step: makeFakeStep() });
    expect(fake.deletePrefix).toHaveBeenCalledTimes(1);
    const completedAtFirst = (
      await driver`SELECT completed_at FROM pending_storage_deletions WHERE id = ${row.id}`
    )[0]!.completed_at as string;

    fake.deletePrefix.mockClear();

    await cleanupStorageHandler({ event, step: makeFakeStep() });

    expect(fake.deletePrefix).not.toHaveBeenCalled();

    const updated = await driver`SELECT status, completed_at FROM pending_storage_deletions WHERE id = ${row.id}`;
    expect(updated[0]!.status).toBe("completed");
    expect(String(updated[0]!.completed_at)).toBe(String(completedAtFirst));
  });

  // =====================================================================
  // Cycle 2C — failure paths
  // =====================================================================

  it("2C-1: adapter throws → records error, bumps attempts, throws RetryAfterError", async () => {
    const fake = makeFakeAdapter({ throwOnDelete: true });
    setStorageAdapterForTests(fake.asAdapter);

    const prefix = `${userId}/${plantId}/`;
    const row = await insertPsdRow("plant-photos", prefix);

    const fakeRow2Id = randomUUID();
    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [row.id, fakeRow2Id] as [string, string],
      },
    };

    const { RetryAfterError } = await import("inngest");

    await expect(cleanupStorageHandler({ event, step: makeFakeStep() })).rejects.toBeInstanceOf(
      RetryAfterError,
    );

    const updated = await driver`
      SELECT status, attempts, last_error FROM pending_storage_deletions WHERE id = ${row.id}
    `;
    expect(updated[0]!.attempts).toBe(1);
    expect(updated[0]!.last_error).toContain("simulated storage failure");
  });

  it("2C-2 (T-05-06-01): malformed prefix in row throws validation_failed BEFORE adapter call", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const malformedPrefix = `OTHERUSER/${plantId}/`;
    const row = await insertPsdRow("plant-photos", malformedPrefix);

    const fakeRow2Id = randomUUID();
    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [row.id, fakeRow2Id] as [string, string],
      },
    };

    await expect(cleanupStorageHandler({ event, step: makeFakeStep() })).rejects.toThrow();

    expect(fake.deletePrefix).not.toHaveBeenCalled();
  });

  it("2C-3 (T-05-06-02): concurrent handlers for same row — only one processes it (markInProgress conditional guard)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const prefix = `${userId}/${plantId}/`;
    const row = await insertPsdRow("plant-photos", prefix);

    const fakeRow2Id = randomUUID();
    const event = {
      data: {
        plantId,
        userId,
        deletedAt: new Date().toISOString(),
        deletionRowIds: [row.id, fakeRow2Id] as [string, string],
      },
    };

    await Promise.all([
      cleanupStorageHandler({ event, step: makeFakeStep() }),
      cleanupStorageHandler({ event, step: makeFakeStep() }),
    ]);

    expect(fake.deletePrefix).toHaveBeenCalledTimes(1);

    const updated = await driver`SELECT status, attempts FROM pending_storage_deletions WHERE id = ${row.id}`;
    expect(updated[0]!.status).toBe("completed");
    expect(updated[0]!.attempts).toBe(1);
  });

  // =====================================================================
  // Config invariant check
  // =====================================================================

  it("config invariant: cleanupStorage has id='catalog/cleanup-storage', retries=4, trigger=plant.deleted", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const functionsPath = path.resolve(
      process.cwd(),
      "src/contexts/catalog/inngest/functions.ts",
    );
    const src = fs.readFileSync(functionsPath, "utf-8");
    expect(src).toContain('id: "catalog/cleanup-storage"');
    expect(src).toContain("retries: 4");
    expect(src).toContain('event: "plant.deleted"');
    expect(src).toContain("validateStorageDeletionPrefix");
    expect(src).toContain("RetryAfterError");
    const srcNoComments = src.replace(/^\s*\/\/.*/gm, "");
    expect(srcNoComments).not.toContain("withUnitOfWork");
  });
});
