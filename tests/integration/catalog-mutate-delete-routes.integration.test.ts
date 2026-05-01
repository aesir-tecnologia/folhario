import { createHash, randomUUID } from "node:crypto";

import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Phase 05 Plan 09 — catalog mutate/delete route handlers integration tests.
 *
 * Tests the three catalog mutation route handler files:
 *  - PATCH /api/v1/plants/[plantId]   (update-plant-handler)
 *  - DELETE /api/v1/plants/[plantId]  (delete-plant-handler)
 *  - DELETE /api/v1/photo-entries/[photoEntryId] (delete-photo-entry-handler)
 *
 * Auth strategy: __setCurrentUserAdapterForTests bypasses Supabase SSR cookies.
 * Read-only gate: vi.stubEnv("ENABLE_TEST_ROUTES", "1") + cookie header.
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

// --- Mocks (hoisted) ---

const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["test-event-id"] });
vi.mock("@shared/inngest/client", () => ({
  inngest: { send: inngestSendMock },
}));

const mockCapture = vi.fn();
const mockShutdown = vi.fn().mockResolvedValue(undefined);
vi.mock("@shared/telemetry/posthog-server", () => ({
  getPostHog: vi.fn(() => ({ capture: mockCapture, shutdown: mockShutdown })),
  shutdownPostHog: vi.fn().mockResolvedValue(undefined),
}));

const sentryCaptureExceptionSpy = vi.fn();
vi.mock("@sentry/nextjs", async () => {
  const actual = await vi.importActual<typeof import("@sentry/nextjs")>("@sentry/nextjs");
  return {
    ...actual,
    captureException: sentryCaptureExceptionSpy,
  };
});

// --- Types ---

type AuthAdapter = import("@contexts/iam/infrastructure/auth/auth-adapter").AuthAdapter;
type UserRow = import("@contexts/iam/infrastructure/db/users").UserRow;

// --- Helpers ---

function buildFakeAdapter(user: UserRow | null): AuthAdapter {
  return {
    verifyBearer: async () => ({
      ok: false as const,
      code: "unauthenticated" as const,
      reason: "no_bearer",
    }),
    getUserById: async (id: string) => (user && user.id === id ? user : null),
    getUserBySession: async () => (user ? { id: user.id, email: user.email } : null),
    createUser: async () => ({ id: "noop" }),
    signInWithPassword: async () => ({ ok: true as const }),
    signOutLocal: async () => undefined,
    adminUpdatePassword: async () => ({ ok: true as const }),
    adminDeleteUser: async () => undefined,
    signInWithOAuth: async () => ({ url: "" }),
    exchangeCodeForSession: async () => ({ ok: false as const, reason: "noop" }),
  };
}

// ============================================================================
// Main test suite
// ============================================================================

describe.skipIf(!dbUrl)("Phase-05-09 catalog mutate/delete route handlers", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });

  let userId: string;
  let userId2: string;
  let verifiedUserRow: UserRow;
  let verifiedUserRow2: UserRow;
  let unverifiedUserRow: UserRow;

  let setCurrentUserAdapterForTests: typeof import("@contexts/iam/application/current-user").__setCurrentUserAdapterForTests;

  beforeAll(async () => {
    ({ __setCurrentUserAdapterForTests: setCurrentUserAdapterForTests } = await import(
      "@contexts/iam/application/current-user"
    ));

    const runId = randomUUID().slice(0, 8);

    // Seed verified user 1
    const [row1] = await driver<{ id: string }[]>`
      INSERT INTO users (email, name, timezone, trial_source, email_verified_at, age_confirmed_at)
      VALUES (
        ${"cat-mut-u1-" + runId + "@test.local"},
        'Cat Mut User1',
        'America/Sao_Paulo',
        'organic',
        ${new Date().toISOString()},
        ${new Date().toISOString()}
      )
      RETURNING id
    `;
    if (!row1) throw new Error("seedUser1: no row");
    userId = row1.id;

    // Seed verified user 2
    const [row2] = await driver<{ id: string }[]>`
      INSERT INTO users (email, name, timezone, trial_source, email_verified_at, age_confirmed_at)
      VALUES (
        ${"cat-mut-u2-" + runId + "@test.local"},
        'Cat Mut User2',
        'America/Sao_Paulo',
        'organic',
        ${new Date().toISOString()},
        ${new Date().toISOString()}
      )
      RETURNING id
    `;
    if (!row2) throw new Error("seedUser2: no row");
    userId2 = row2.id;

    // Seed unverified user
    const [row3] = await driver<{ id: string }[]>`
      INSERT INTO users (email, name, timezone, trial_source, email_verified_at, age_confirmed_at)
      VALUES (
        ${"cat-mut-unv-" + runId + "@test.local"},
        'Cat Mut Unverified',
        'America/Sao_Paulo',
        'organic',
        NULL,
        ${new Date().toISOString()}
      )
      RETURNING id
    `;
    if (!row3) throw new Error("seedUnverified: no row");

    // Fetch UserRow shapes
    const { findById } = await import("@contexts/iam/infrastructure/db/users");
    const { db } = await import("@shared/db/client");
    const vRow1 = await findById(db, userId);
    const vRow2 = await findById(db, userId2);
    const uvRow = await findById(db, row3.id);
    if (!vRow1 || !vRow2 || !uvRow) throw new Error("findById failed");
    verifiedUserRow = vRow1;
    verifiedUserRow2 = vRow2;
    unverifiedUserRow = uvRow;
  }, 30_000);

  afterAll(async () => {
    try {
      for (const uid of [userId, userId2, unverifiedUserRow?.id].filter(Boolean)) {
        await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${uid}`;
        await driver`DELETE FROM idempotency_keys WHERE user_id = ${uid}`;
        await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${uid})`;
        await driver`DELETE FROM plants WHERE user_id = ${uid}`;
        await driver`DELETE FROM users WHERE id = ${uid}`;
      }
    } finally {
      await driver.end({ timeout: 5 });
    }
  });

  afterEach(() => {
    setCurrentUserAdapterForTests(null);
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  // --- DB helpers ---

  async function seedPlant(uid: string, opts: { name?: string; coverPhotoUrl?: string } = {}): Promise<string> {
    const [row] = await driver<{ id: string }[]>`
      INSERT INTO plants (user_id, name, cover_photo_url)
      VALUES (${uid}, ${opts.name ?? "Test Plant"}, ${opts.coverPhotoUrl ?? null})
      RETURNING id
    `;
    if (!row) throw new Error("seedPlant: no row");
    return row.id;
  }

  async function seedPhotoEntry(
    plantId: string,
    uid: string,
    opts: { note?: string; createdAt?: string } = {},
  ): Promise<{ id: string; photoUrl: string; thumbnailUrl: string }> {
    const photoId = randomUUID();
    const photoUrl = `plant-photos/${uid}/${plantId}/${photoId}.jpg`;
    const thumbnailUrl = `plant-thumbnails/${uid}/${plantId}/${photoId}.jpg`;
    const ts = opts.createdAt ?? new Date().toISOString();
    const [row] = await driver<{ id: string }[]>`
      INSERT INTO photo_entries (id, plant_id, photo_url, thumbnail_url, created_at)
      VALUES (${photoId}, ${plantId}, ${photoUrl}, ${thumbnailUrl}, ${ts}::timestamptz)
      RETURNING id
    `;
    if (!row) throw new Error("seedPhotoEntry: no row");
    return { id: row.id, photoUrl, thumbnailUrl };
  }

  // --- Request builder helpers ---

  function makePatchRequest(opts: {
    plantId: string;
    body: Record<string, unknown>;
    idempotencyKey?: string;
    user?: UserRow | null;
    readOnly?: boolean;
  }): Request {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (opts.idempotencyKey !== undefined) {
      headers["idempotency-key"] = opts.idempotencyKey;
    }
    if (opts.readOnly) {
      headers["cookie"] = "__test_subscription_read_only=1";
    }
    const user = opts.user === undefined ? verifiedUserRow : opts.user;
    setCurrentUserAdapterForTests(buildFakeAdapter(user));
    return new Request(`http://localhost:3000/api/v1/plants/${opts.plantId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(opts.body),
    });
  }

  function makeDeletePlantRequest(opts: {
    plantId: string;
    idempotencyKey?: string;
    user?: UserRow | null;
    readOnly?: boolean;
  }): Request {
    const headers: Record<string, string> = {};
    if (opts.idempotencyKey !== undefined) {
      headers["idempotency-key"] = opts.idempotencyKey;
    }
    if (opts.readOnly) {
      headers["cookie"] = "__test_subscription_read_only=1";
    }
    const user = opts.user === undefined ? verifiedUserRow : opts.user;
    setCurrentUserAdapterForTests(buildFakeAdapter(user));
    return new Request(`http://localhost:3000/api/v1/plants/${opts.plantId}`, {
      method: "DELETE",
      headers,
    });
  }

  function makeDeletePhotoEntryRequest(opts: {
    photoEntryId: string;
    idempotencyKey?: string;
    user?: UserRow | null;
    readOnly?: boolean;
  }): Request {
    const headers: Record<string, string> = {};
    if (opts.idempotencyKey !== undefined) {
      headers["idempotency-key"] = opts.idempotencyKey;
    }
    if (opts.readOnly) {
      headers["cookie"] = "__test_subscription_read_only=1";
    }
    const user = opts.user === undefined ? verifiedUserRow : opts.user;
    setCurrentUserAdapterForTests(buildFakeAdapter(user));
    return new Request(`http://localhost:3000/api/v1/photo-entries/${opts.photoEntryId}`, {
      method: "DELETE",
      headers,
    });
  }

  // ============================================================================
  // PATCH /api/v1/plants/[plantId]
  // ============================================================================

  describe("PATCH /api/v1/plants/[plantId]", () => {
    afterEach(async () => {
      await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId}`;
    });

    it("Test 1 — happy path (single dirty field, first call): 200 + updated plant", async () => {
      const plantId = await seedPlant(userId, { name: "Costela" });
      const req = makePatchRequest({
        plantId,
        body: { name: "Costela Adam" },
        idempotencyKey: "patch-key-1-" + randomUUID(),
      });

      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(200);
      const json = await res.json() as { plant: { id: string; name: string } };
      expect(json.plant.id).toBe(plantId);
      expect(json.plant.name).toBe("Costela Adam");

      const [dbRow] = await driver<{ name: string }[]>`
        SELECT name FROM plants WHERE id = ${plantId}
      `;
      expect(dbRow?.name).toBe("Costela Adam");

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 2 — idempotency replay (same key + body): use-case called ONCE across both requests", async () => {
      const plantId = await seedPlant(userId, { name: "Costela" });
      const key = "patch-replay-" + randomUUID();
      const body = { name: "Costela Adam" };

      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");

      const req1 = makePatchRequest({ plantId, body, idempotencyKey: key });
      const res1 = await PATCH(req1, { params: Promise.resolve({ plantId }) });
      expect(res1.status).toBe(200);

      const req2 = makePatchRequest({ plantId, body, idempotencyKey: key });
      const res2 = await PATCH(req2, { params: Promise.resolve({ plantId }) });
      expect(res2.status).toBe(200);

      const body1 = await res1.json();
      const body2 = await res2.json();
      expect(JSON.stringify(body1)).toBe(JSON.stringify(body2));

      // use-case called exactly once (replay skips it)
      expect(spy.mock.calls.length).toBe(1);

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 3 — idempotency hash mismatch (same key, different body): 409 conflict", async () => {
      const plantId = await seedPlant(userId, { name: "Costela" });
      const key = "patch-mismatch-" + randomUUID();

      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");

      const req1 = makePatchRequest({ plantId, body: { name: "Costela Adam" }, idempotencyKey: key });
      await PATCH(req1, { params: Promise.resolve({ plantId }) });

      // Same key, different body → conflict
      const req2 = makePatchRequest({ plantId, body: { nickname: "Cris" }, idempotencyKey: key });
      const res2 = await PATCH(req2, { params: Promise.resolve({ plantId }) });
      expect(res2.status).toBe(409);
      const json2 = await res2.json() as { error: { code: string } };
      expect(json2.error.code).toBe("conflict");

      // spy called only once (for req1)
      expect(spy.mock.calls.length).toBe(1);

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 4 — missing Idempotency-Key header: 400 validation_failed", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "New" }),
      });

      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("validation_failed");
      expect(spy).not.toHaveBeenCalled();

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 5 — empty body (no known field): 400 validation_failed", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      const req = makePatchRequest({ plantId, body: {}, idempotencyKey: randomUUID() });
      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("validation_failed");
      expect(spy).not.toHaveBeenCalled();

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 6 — unknown body field (.strict() rejection): 400 validation_failed", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const req = makePatchRequest({ plantId, body: { id: "different-uuid" }, idempotencyKey: randomUUID() });
      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("validation_failed");

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 7 — cross-user mutation attempt (T-05-09-01): 404 not_found", async () => {
      const plantId2 = await seedPlant(userId2, { name: "Plant B" });

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId2}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "idempotency-key": randomUUID(),
        },
        body: JSON.stringify({ name: "stolen" }),
      });

      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId: plantId2 }) });
      expect(res.status).toBe(404);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("not_found");

      const [dbRow] = await driver<{ name: string }[]>`
        SELECT name FROM plants WHERE id = ${plantId2}
      `;
      expect(dbRow?.name).toBe("Plant B");

      await driver`DELETE FROM plants WHERE id = ${plantId2}`;
    });

    it("Test 8 — unauthenticated: 401 unauthenticated", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({ name: "New" }),
      });
      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(401);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("unauthenticated");
      expect(spy).not.toHaveBeenCalled();

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 9 — email unverified: 403 email_unverified", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json", "idempotency-key": randomUUID() },
        body: JSON.stringify({ name: "New" }),
      });
      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("email_unverified");
      expect(spy).not.toHaveBeenCalled();

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 10 — read-only mode bypass (T-05-09-04): 402 read_only_mode, use-case NOT called", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const updatePlantModule = await import("@contexts/catalog/application/update-plant");
      const spy = vi.spyOn(updatePlantModule, "updatePlant");

      vi.stubEnv("ENABLE_TEST_ROUTES", "1");

      const req = makePatchRequest({
        plantId,
        body: { name: "New" },
        idempotencyKey: randomUUID(),
        readOnly: true,
      });
      const { PATCH } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await PATCH(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(402);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("read_only_mode");
      expect(spy).not.toHaveBeenCalled();

      const [dbRow] = await driver<{ name: string }[]>`SELECT name FROM plants WHERE id = ${plantId}`;
      expect(dbRow?.name).toBe("Test");

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 11 — no Drizzle import in route file", async () => {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const routePath = join(process.cwd(), "src/app/api/v1/plants/[plantId]/route.ts");
      const src = readFileSync(routePath, "utf8");
      expect(src).not.toMatch(/from ["']drizzle-orm/);
      expect(src).not.toMatch(/from ["']@contexts\/catalog\/infrastructure\/db/);
    });
  });

  // ============================================================================
  // DELETE /api/v1/plants/[plantId]
  // ============================================================================

  describe("DELETE /api/v1/plants/[plantId]", () => {
    afterEach(async () => {
      await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId}`;
      await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId2}`;
    });

    it("Test 1 — happy path (cascade): 204 + cascade verified", async () => {
      const plantId = await seedPlant(userId, { name: "Cascade Plant" });
      const now = new Date();
      const e1 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now.getTime()).toISOString() });
      const e2 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now.getTime() + 1000).toISOString() });
      const e3 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now.getTime() + 2000).toISOString() });

      // seed a reminder
      await driver`
        INSERT INTO reminders (plant_id, user_id, task_type, frequency_days, next_due_at)
        VALUES (${plantId}, ${userId}, 'water', 7, ${new Date(Date.now() + 86400000).toISOString()})
      `;

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      const key = "del-plant-" + randomUUID();
      const req = makeDeletePlantRequest({ plantId, idempotencyKey: key });
      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(204);

      // plant gone
      const [plantRow] = await driver`SELECT id FROM plants WHERE id = ${plantId}`;
      expect(plantRow).toBeUndefined();

      // photo_entries gone
      const photoRows = await driver`SELECT id FROM photo_entries WHERE id IN (${e1.id}, ${e2.id}, ${e3.id})`;
      expect(photoRows.length).toBe(0);

      // reminders gone
      const reminderRows = await driver`SELECT id FROM reminders WHERE plant_id = ${plantId}`;
      expect(reminderRows.length).toBe(0);

      // pending_storage_deletions: 2 rows inserted
      const psdRows = await driver<{ bucket: string }[]>`SELECT bucket, prefix FROM pending_storage_deletions WHERE user_id = ${userId}`;
      expect(psdRows.length).toBe(2);
      const buckets = psdRows.map((r) => r.bucket).sort();
      expect(buckets).toContain("plant-photos");
      expect(buckets).toContain("plant-thumbnails");

      // Inngest event emitted
      expect(inngestSendMock).toHaveBeenCalled();
      const sentEvent = inngestSendMock.mock.calls[0]?.[0] as { name: string };
      expect(sentEvent.name).toBe("plant.deleted");

      // PostHog captured
      expect(mockCapture).toHaveBeenCalled();

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
    });

    it("Test 2 — idempotency replay (same key): use-case called ONCE", async () => {
      const plantId = await seedPlant(userId, { name: "Replay Plant" });
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      const key = "del-replay-" + randomUUID();

      const deletePlantModule = await import("@contexts/catalog/application/delete-plant");
      const spy = vi.spyOn(deletePlantModule, "deletePlant");

      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");

      const req1 = makeDeletePlantRequest({ plantId, idempotencyKey: key });
      const res1 = await DELETE(req1, { params: Promise.resolve({ plantId }) });
      expect(res1.status).toBe(204);

      const req2 = makeDeletePlantRequest({ plantId, idempotencyKey: key });
      const res2 = await DELETE(req2, { params: Promise.resolve({ plantId }) });
      expect(res2.status).toBe(204);

      // use-case called only once
      expect(spy.mock.calls.length).toBe(1);

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
    });

    it("Test 3 — cross-user delete attempt (T-05-09-01 + T-05-09-02): 404 not_found, no storage mutations", async () => {
      const plantId2 = await seedPlant(userId2, { name: "U2 Plant" });
      await seedPhotoEntry(plantId2, userId2);

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId2}`, {
        method: "DELETE",
        headers: { "idempotency-key": randomUUID() },
      });

      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ plantId: plantId2 }) });
      expect(res.status).toBe(404);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("not_found");

      // plant still exists
      const [plantRow] = await driver<{ id: string }[]>`SELECT id FROM plants WHERE id = ${plantId2}`;
      expect(plantRow).toBeDefined();

      // no pending_storage_deletions inserted
      const psdRows = await driver`SELECT id FROM pending_storage_deletions WHERE user_id = ${userId}`;
      expect(psdRows.length).toBe(0);

      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId2}`;
      await driver`DELETE FROM plants WHERE id = ${plantId2}`;
    });

    it("Test 4 — read-only mode bypass (T-05-09-04): 402 read_only_mode, use-case NOT called", async () => {
      const plantId = await seedPlant(userId, { name: "RO Plant" });

      const deletePlantModule = await import("@contexts/catalog/application/delete-plant");
      const spy = vi.spyOn(deletePlantModule, "deletePlant");

      vi.stubEnv("ENABLE_TEST_ROUTES", "1");

      const req = makeDeletePlantRequest({ plantId, idempotencyKey: randomUUID(), readOnly: true });
      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(402);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("read_only_mode");
      expect(spy).not.toHaveBeenCalled();

      // plant still exists
      const [plantRow] = await driver<{ id: string }[]>`SELECT id FROM plants WHERE id = ${plantId}`;
      expect(plantRow).toBeDefined();

      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 5 — unauthenticated: 401 unauthenticated", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId}`, {
        method: "DELETE",
        headers: { "idempotency-key": randomUUID() },
      });
      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(401);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("unauthenticated");
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 6 — email unverified: 403 email_unverified", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId}`, {
        method: "DELETE",
        headers: { "idempotency-key": randomUUID() },
      });
      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("email_unverified");
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 7 — missing Idempotency-Key header: 400 validation_failed", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const deletePlantModule = await import("@contexts/catalog/application/delete-plant");
      const spy = vi.spyOn(deletePlantModule, "deletePlant");

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/plants/${plantId}`, {
        method: "DELETE",
      });
      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ plantId }) });
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("validation_failed");
      expect(spy).not.toHaveBeenCalled();
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 8 — postCommit fires on first call, NOT on replay", async () => {
      const plantId = await seedPlant(userId, { name: "PostCommit Plant" });
      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      vi.clearAllMocks();

      const key = "del-postcommit-" + randomUUID();
      const { DELETE } = await import("../../src/app/api/v1/plants/[plantId]/route");

      const req1 = makeDeletePlantRequest({ plantId, idempotencyKey: key });
      const res1 = await DELETE(req1, { params: Promise.resolve({ plantId }) });
      expect(res1.status).toBe(204);
      // PostHog + Inngest fired on first call
      expect(mockCapture).toHaveBeenCalled();
      expect(inngestSendMock).toHaveBeenCalled();

      const captureCount = mockCapture.mock.calls.length;
      const inngestCount = inngestSendMock.mock.calls.length;

      const req2 = makeDeletePlantRequest({ plantId, idempotencyKey: key });
      const res2 = await DELETE(req2, { params: Promise.resolve({ plantId }) });
      expect(res2.status).toBe(204);
      // NOT called again on replay
      expect(mockCapture.mock.calls.length).toBe(captureCount);
      expect(inngestSendMock.mock.calls.length).toBe(inngestCount);

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
    });
  });

  // ============================================================================
  // DELETE /api/v1/photo-entries/[photoEntryId]
  // ============================================================================

  describe("DELETE /api/v1/photo-entries/[photoEntryId]", () => {
    afterEach(async () => {
      await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId}`;
      await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId2}`;
    });

    it("Test 1 — happy path, deleting non-cover entry: 204, row gone, cover unchanged", async () => {
      const now = Date.now();
      const plantId = await seedPlant(userId, { name: "Photo Plant" });
      const e1 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now).toISOString() });
      const e2 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now + 1000).toISOString() });
      const e3 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now + 2000).toISOString() });
      // Set cover to e1
      await driver`UPDATE plants SET cover_photo_url = ${e1.photoUrl} WHERE id = ${plantId}`;

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      const key = "del-pe-nc-" + randomUUID();
      const req = makeDeletePhotoEntryRequest({ photoEntryId: e2.id, idempotencyKey: key });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e2.id }) });
      expect(res.status).toBe(204);

      // e2 gone
      const [e2Row] = await driver`SELECT id FROM photo_entries WHERE id = ${e2.id}`;
      expect(e2Row).toBeUndefined();

      // cover still e1
      const [plantRow] = await driver<{ cover_photo_url: string }[]>`SELECT cover_photo_url FROM plants WHERE id = ${plantId}`;
      expect(plantRow?.cover_photo_url).toBe(e1.photoUrl);

      // pending_storage_deletions has a row for e2's photo
      const psdRows = await driver`SELECT id FROM pending_storage_deletions WHERE user_id = ${userId}`;
      expect(psdRows.length).toBeGreaterThan(0);

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 2 — happy path, deleting cover (D-03 auto-promote): 204, cover advances to next", async () => {
      const now = Date.now();
      const plantId = await seedPlant(userId, { name: "Cover Plant" });
      const e1 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now).toISOString() });
      const e2 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now + 1000).toISOString() });
      const e3 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now + 2000).toISOString() });
      await driver`UPDATE plants SET cover_photo_url = ${e1.photoUrl} WHERE id = ${plantId}`;

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      const key = "del-pe-cover-" + randomUUID();
      const req = makeDeletePhotoEntryRequest({ photoEntryId: e1.id, idempotencyKey: key });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res.status).toBe(204);

      // e1 gone
      const [e1Row] = await driver`SELECT id FROM photo_entries WHERE id = ${e1.id}`;
      expect(e1Row).toBeUndefined();

      // cover auto-promoted to e2 (next-oldest)
      const [plantRow] = await driver<{ cover_photo_url: string }[]>`SELECT cover_photo_url FROM plants WHERE id = ${plantId}`;
      expect(plantRow?.cover_photo_url).toBe(e2.photoUrl);

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 3 — deleting the last photo entry: 204, cover becomes null", async () => {
      const plantId = await seedPlant(userId, { name: "Last Entry Plant" });
      const e1 = await seedPhotoEntry(plantId, userId);
      await driver`UPDATE plants SET cover_photo_url = ${e1.photoUrl} WHERE id = ${plantId}`;

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      const key = "del-pe-last-" + randomUUID();
      const req = makeDeletePhotoEntryRequest({ photoEntryId: e1.id, idempotencyKey: key });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res.status).toBe(204);

      const [plantRow] = await driver<{ cover_photo_url: string | null }[]>`SELECT cover_photo_url FROM plants WHERE id = ${plantId}`;
      expect(plantRow?.cover_photo_url).toBeNull();

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 4 — cross-user attempt (T-05-09-01): 404 not_found", async () => {
      const plantId2 = await seedPlant(userId2, { name: "U2 Plant" });
      const e_p2 = await seedPhotoEntry(plantId2, userId2);
      await driver`UPDATE plants SET cover_photo_url = ${e_p2.photoUrl} WHERE id = ${plantId2}`;

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/photo-entries/${e_p2.id}`, {
        method: "DELETE",
        headers: { "idempotency-key": randomUUID() },
      });

      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e_p2.id }) });
      expect(res.status).toBe(404);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("not_found");

      // e_p2 still exists
      const [entryRow] = await driver<{ id: string }[]>`SELECT id FROM photo_entries WHERE id = ${e_p2.id}`;
      expect(entryRow).toBeDefined();

      // cover unchanged
      const [plantRow] = await driver<{ cover_photo_url: string }[]>`SELECT cover_photo_url FROM plants WHERE id = ${plantId2}`;
      expect(plantRow?.cover_photo_url).toBe(e_p2.photoUrl);

      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId2}`;
      await driver`DELETE FROM plants WHERE id = ${plantId2}`;
    });

    it("Test 5 — read-only mode bypass (T-05-09-04): 402 read_only_mode, use-case NOT called", async () => {
      const plantId = await seedPlant(userId, { name: "RO PE Plant" });
      const e1 = await seedPhotoEntry(plantId, userId);

      const deletePhotoEntryModule = await import("@contexts/catalog/application/delete-photo-entry");
      const spy = vi.spyOn(deletePhotoEntryModule, "deletePhotoEntry");

      vi.stubEnv("ENABLE_TEST_ROUTES", "1");

      const req = makeDeletePhotoEntryRequest({ photoEntryId: e1.id, idempotencyKey: randomUUID(), readOnly: true });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res.status).toBe(402);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("read_only_mode");
      expect(spy).not.toHaveBeenCalled();

      const [entryRow] = await driver<{ id: string }[]>`SELECT id FROM photo_entries WHERE id = ${e1.id}`;
      expect(entryRow).toBeDefined();

      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 6 — unauthenticated: 401 unauthenticated", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const e1 = await seedPhotoEntry(plantId, userId);
      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const req = new Request(`http://localhost:3000/api/v1/photo-entries/${e1.id}`, {
        method: "DELETE",
        headers: { "idempotency-key": randomUUID() },
      });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res.status).toBe(401);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("unauthenticated");
      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 7 — email unverified: 403 email_unverified", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const e1 = await seedPhotoEntry(plantId, userId);
      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/photo-entries/${e1.id}`, {
        method: "DELETE",
        headers: { "idempotency-key": randomUUID() },
      });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res.status).toBe(403);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("email_unverified");
      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 8 — idempotency replay (same key): use-case called ONCE across both requests", async () => {
      const now = Date.now();
      const plantId = await seedPlant(userId, { name: "Replay PE Plant" });
      const e1 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now).toISOString() });
      const e2 = await seedPhotoEntry(plantId, userId, { createdAt: new Date(now + 1000).toISOString() });

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;

      const deletePhotoEntryModule = await import("@contexts/catalog/application/delete-photo-entry");
      const spy = vi.spyOn(deletePhotoEntryModule, "deletePhotoEntry");

      const key = "del-pe-replay-" + randomUUID();
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");

      const req1 = makeDeletePhotoEntryRequest({ photoEntryId: e1.id, idempotencyKey: key });
      const res1 = await DELETE(req1, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res1.status).toBe(204);

      const req2 = makeDeletePhotoEntryRequest({ photoEntryId: e1.id, idempotencyKey: key });
      const res2 = await DELETE(req2, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res2.status).toBe(204);

      // use-case called only once
      expect(spy.mock.calls.length).toBe(1);

      await driver`DELETE FROM pending_storage_deletions WHERE user_id = ${userId}`;
      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });

    it("Test 9 — missing Idempotency-Key header: 400 validation_failed", async () => {
      const plantId = await seedPlant(userId, { name: "Test" });
      const e1 = await seedPhotoEntry(plantId, userId);
      const deletePhotoEntryModule = await import("@contexts/catalog/application/delete-photo-entry");
      const spy = vi.spyOn(deletePhotoEntryModule, "deletePhotoEntry");

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const req = new Request(`http://localhost:3000/api/v1/photo-entries/${e1.id}`, {
        method: "DELETE",
      });
      const { DELETE } = await import("../../src/app/api/v1/photo-entries/[photoEntryId]/route");
      const res = await DELETE(req, { params: Promise.resolve({ photoEntryId: e1.id }) });
      expect(res.status).toBe(400);
      const json = await res.json() as { error: { code: string } };
      expect(json.error.code).toBe("validation_failed");
      expect(spy).not.toHaveBeenCalled();

      await driver`DELETE FROM photo_entries WHERE plant_id = ${plantId}`;
      await driver`DELETE FROM plants WHERE id = ${plantId}`;
    });
  });
});
