import { randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 06 — deletePlant use-case integration tests (Task 1 RED).
 *
 * Cycles:
 *  1A — happy path: cascade + psd rows + inngest + posthog
 *  1B — ownership / not-found: short-circuit before UoW
 *  1C — rollback determinism: TX rolls back on second psd.create failure
 *
 * Tests run against the local Supabase (or CI postgres:17-alpine) and
 * guard against cloud Supabase by checking DATABASE_POOL_URL.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["test-event-id"] });

vi.mock("@shared/inngest/client", () => ({
  inngest: {
    send: inngestSendMock,
  },
}));

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);

vi.mock("@shared/telemetry/posthog-server", () => ({
  getPostHog: vi.fn(() => ({ capture: mockCapture, shutdown: mockShutdown })),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
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

describe.skipIf(!dbUrl)("Phase-05-06 deletePlant use-case integration", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });

  let userId: string;
  let otherUserId: string;

  let deletePlant: typeof import("@contexts/catalog/application/delete-plant").deletePlant;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;
  let pendingDeletionsRepo: typeof import("@contexts/catalog/infrastructure/db/pending-storage-deletions");

  beforeAll(async () => {
    ({ deletePlant } = await import("@contexts/catalog/application/delete-plant"));
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));
    pendingDeletionsRepo = await import(
      "@contexts/catalog/infrastructure/db/pending-storage-deletions"
    );

    const userRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"delete-plant-" + randomUUID() + "@test.local"}, 'Delete Plant Test', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userRow[0]!.id as string;

    const otherUserRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"delete-plant-other-" + randomUUID() + "@test.local"}, 'Other User', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    otherUserId = otherUserRow[0]!.id as string;
  });

  afterAll(async () => {
    if (userId) {
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${userId})`;
      await driver`DELETE FROM plants WHERE user_id = ${userId}`;
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    if (otherUserId) {
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${otherUserId}`;
      await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${otherUserId})`;
      await driver`DELETE FROM plants WHERE user_id = ${otherUserId}`;
      await driver`DELETE FROM users WHERE id = ${otherUserId}`;
    }
    await driver.end({ timeout: 5 });
  });

  afterEach(() => {
    setStorageAdapterForTests(null);
    vi.clearAllMocks();
  });

  // =====================================================================
  // Cycle 1A — happy path
  // =====================================================================

  it("1A-1: deletePlant returns { ok: true } when plant exists and user owns it", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Happy Path Plant 1A-1')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    try {
      const result = await deletePlant({ userId, plantId });
      expect(result.ok).toBe(true);
    } finally {
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
    }
  });

  it("1A-2: after deletePlant, plants WHERE id=plantId returns 0 rows", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Happy Path Plant 1A-2')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    await deletePlant({ userId, plantId });

    const remaining = await driver`SELECT id FROM plants WHERE id = ${plantId}`;
    expect(remaining).toHaveLength(0);

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  it("1A-3: after deletePlant, photo_entries WHERE plant_id=plantId returns 0 rows (FK cascade)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Cascade Plant 1A-3')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    await driver`
      INSERT INTO photo_entries (plant_id, photo_url, thumbnail_url)
      VALUES (${plantId}, ${"plant-photos/" + userId + "/" + plantId + "/p1.jpg"}, ${"plant-thumbnails/" + userId + "/" + plantId + "/p1.jpg"})
    `;
    await driver`
      INSERT INTO photo_entries (plant_id, photo_url, thumbnail_url)
      VALUES (${plantId}, ${"plant-photos/" + userId + "/" + plantId + "/p2.jpg"}, ${"plant-thumbnails/" + userId + "/" + plantId + "/p2.jpg"})
    `;

    await deletePlant({ userId, plantId });

    const remaining = await driver`SELECT id FROM photo_entries WHERE plant_id = ${plantId}`;
    expect(remaining).toHaveLength(0);

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  it("1A-4: after deletePlant, reminders WHERE plant_id=plantId returns 0 rows (FK cascade)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Reminder Cascade Plant 1A-4')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    await driver`
      INSERT INTO reminders (plant_id, type, frequency_days, next_due_at)
      VALUES (${plantId}, 'watering', 7, NOW() + INTERVAL '1 day')
    `;
    await driver`
      INSERT INTO reminders (plant_id, type, frequency_days, next_due_at)
      VALUES (${plantId}, 'fertilization', 30, NOW() + INTERVAL '7 days')
    `;

    await deletePlant({ userId, plantId });

    const remaining = await driver`SELECT id FROM reminders WHERE plant_id = ${plantId}`;
    expect(remaining).toHaveLength(0);

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  it("1A-5: after deletePlant, identifications WHERE id=identId has plant_id IS NULL (history preserved, ON DELETE SET NULL)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Identification Plant 1A-5')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    const identRow = await driver`
      INSERT INTO identifications (
        user_id, plant_id, photo_urls, provider, model, results, latency_ms, consent_version, status
      )
      VALUES (
        ${userId}, ${plantId}, ARRAY[]::text[], 'plant_id_api', 'v1',
        '[]'::jsonb, 0, '1.0', 'success'
      )
      RETURNING id
    `;
    const identId = identRow[0]!.id as string;

    await deletePlant({ userId, plantId });

    const identRows = await driver`SELECT id, plant_id FROM identifications WHERE id = ${identId}`;
    expect(identRows).toHaveLength(1);
    expect(identRows[0]!.plant_id).toBeNull();

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
    await driver`DELETE FROM identifications WHERE id = ${identId}`;
  });

  it("1A-6: after deletePlant, pending_storage_deletions has EXACTLY 2 rows with correct buckets, prefix, status='pending', attempts=0", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'PSD Plant 1A-6')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    await deletePlant({ userId, plantId });

    const psdRows = await driver`
      SELECT bucket, prefix, status, attempts
      FROM pending_storage_deletions
      WHERE user_id = ${userId}
      ORDER BY bucket ASC
    `;

    expect(psdRows).toHaveLength(2);

    const buckets = psdRows.map((r: Record<string, unknown>) => r.bucket as string).sort();
    expect(buckets).toEqual(["plant-photos", "plant-thumbnails"]);

    for (const row of psdRows) {
      expect(row.prefix).toBe(`${userId}/${plantId}/`);
      expect(row.status).toBe("pending");
      expect(row.attempts).toBe(0);
    }

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  it("1A-7: after deletePlant, inngest.send called once with correct plant.deleted payload including deletionRowIds tuple", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Inngest Plant 1A-7')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    await deletePlant({ userId, plantId });

    expect(inngestSendMock).toHaveBeenCalledTimes(1);
    const call = inngestSendMock.mock.calls[0]?.[0] as {
      id: string;
      name: string;
      data: {
        plantId: string;
        userId: string;
        deletedAt: string;
        deletionRowIds: [string, string];
      };
    };
    expect(call.id).toBe(`plant-deleted/${plantId}`);
    expect(call.name).toBe("plant.deleted");
    expect(call.data.plantId).toBe(plantId);
    expect(call.data.userId).toBe(userId);
    expect(typeof call.data.deletedAt).toBe("string");
    expect(Array.isArray(call.data.deletionRowIds)).toBe(true);
    expect(call.data.deletionRowIds).toHaveLength(2);
    expect(typeof call.data.deletionRowIds[0]).toBe("string");
    expect(typeof call.data.deletionRowIds[1]).toBe("string");

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  it("1A-8: after deletePlant, PostHog.capture called once with privacy-clean plant_deleted props (D-29)", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'PostHog Plant 1A-8')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    await driver`
      INSERT INTO photo_entries (plant_id, photo_url, thumbnail_url)
      VALUES (${plantId}, ${"plant-photos/" + userId + "/" + plantId + "/p1.jpg"}, ${"plant-thumbnails/" + userId + "/" + plantId + "/p1.jpg"})
    `;
    await driver`
      INSERT INTO photo_entries (plant_id, photo_url, thumbnail_url)
      VALUES (${plantId}, ${"plant-photos/" + userId + "/" + plantId + "/p2.jpg"}, ${"plant-thumbnails/" + userId + "/" + plantId + "/p2.jpg"})
    `;
    await driver`
      INSERT INTO photo_entries (plant_id, photo_url, thumbnail_url)
      VALUES (${plantId}, ${"plant-photos/" + userId + "/" + plantId + "/p3.jpg"}, ${"plant-thumbnails/" + userId + "/" + plantId + "/p3.jpg"})
    `;
    await driver`
      INSERT INTO reminders (plant_id, type, frequency_days, next_due_at)
      VALUES (${plantId}, 'watering', 7, NOW() + INTERVAL '1 day')
    `;
    await driver`
      INSERT INTO reminders (plant_id, type, frequency_days, next_due_at)
      VALUES (${plantId}, 'fertilization', 30, NOW() + INTERVAL '7 days')
    `;

    await deletePlant({ userId, plantId });

    expect(mockCapture).toHaveBeenCalledTimes(1);
    const captureCall = mockCapture.mock.calls[0]?.[0] as {
      distinctId: string;
      event: string;
      properties: Record<string, unknown>;
    };
    expect(captureCall.distinctId).toBe(userId);
    expect(captureCall.event).toBe("plant_deleted");
    expect(captureCall.properties.photo_count).toBe(3);
    expect(captureCall.properties.journal_entry_count).toBe(0);
    expect(captureCall.properties.reminder_count).toBe(2);

    expect("plantId" in captureCall.properties).toBe(false);
    expect("name" in captureCall.properties).toBe(false);
    expect("location" in captureCall.properties).toBe(false);
    expect("notes" in captureCall.properties).toBe(false);

    await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
  });

  // =====================================================================
  // Cycle 1B — ownership / not-found
  // =====================================================================

  it("1B-1: deletePlant with other user's plant returns { ok: false, code: 'not_found' } with no side effects", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${otherUserId}, 'Other User Plant 1B-1')
      RETURNING id
    `;
    const otherPlantId = plantRow[0]!.id as string;

    try {
      const result = await deletePlant({ userId, plantId: otherPlantId });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.code).toBe("not_found");
      }

      const remaining = await driver`SELECT id FROM plants WHERE id = ${otherPlantId}`;
      expect(remaining).toHaveLength(1);

      const psdRows = await driver`SELECT id FROM pending_storage_deletions WHERE user_id = ${userId}`;
      expect(psdRows).toHaveLength(0);

      expect(inngestSendMock).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    } finally {
      await driver`DELETE FROM plants WHERE id = ${otherPlantId}`;
    }
  });

  it("1B-2: deletePlant with nonexistent plantId returns { ok: false, code: 'not_found' } with no side effects", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const nonexistentId = randomUUID();
    const result = await deletePlant({ userId, plantId: nonexistentId });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("not_found");
    }

    const psdRows = await driver`SELECT id FROM pending_storage_deletions WHERE user_id = ${userId}`;
    expect(psdRows).toHaveLength(0);

    expect(inngestSendMock).not.toHaveBeenCalled();
    expect(mockCapture).not.toHaveBeenCalled();
  });

  // =====================================================================
  // Cycle 1C — rollback determinism
  // =====================================================================

  it("1C-1: when second pendingDeletionsRepo.create throws, TX rolls back — plant not deleted, psd rows = 0, no side effects", async () => {
    const fake = makeFakeAdapter();
    setStorageAdapterForTests(fake.asAdapter);

    const plantRow = await driver`
      INSERT INTO plants (user_id, name) VALUES (${userId}, 'Rollback Plant 1C-1')
      RETURNING id
    `;
    const plantId = plantRow[0]!.id as string;

    const psdModule = await import(
      "@contexts/catalog/infrastructure/db/pending-storage-deletions"
    );
    let callCount = 0;
    const createSpy = vi.spyOn(psdModule, "create").mockImplementation(async (db, input) => {
      callCount++;
      if (callCount === 2) {
        throw new Error("simulated second psd.create failure");
      }
      return psdModule.create(db, input);
    });

    try {
      await expect(deletePlant({ userId, plantId })).rejects.toThrow(
        "simulated second psd.create failure",
      );

      const remaining = await driver`SELECT id FROM plants WHERE id = ${plantId}`;
      expect(remaining).toHaveLength(1);

      const psdRows = await driver`
        SELECT id FROM pending_storage_deletions WHERE prefix LIKE ${"%" + plantId + "/%"}
      `;
      expect(psdRows).toHaveLength(0);

      expect(inngestSendMock).not.toHaveBeenCalled();
      expect(mockCapture).not.toHaveBeenCalled();
    } finally {
      createSpy.mockRestore();
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
    }
  });
});
