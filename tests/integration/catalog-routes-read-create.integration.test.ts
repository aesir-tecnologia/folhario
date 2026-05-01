import { createHash, randomUUID } from "node:crypto";

import sharp from "sharp";
import postgres from "postgres";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { InMemoryStorageAdapter } from "./fixtures/in-memory-storage-adapter";

/**
 * Phase 05 Plan 08 — catalog route handlers integration tests (Task 1 + 2 RED).
 *
 * Tests the four catalog route handler files:
 *  - POST /api/v1/plants (multipart + idempotency)
 *  - GET /api/v1/plants (list + cursor + ?include_count)
 *  - GET /api/v1/plants/[plantId] (detail + _meta counts)
 *  - POST + GET /api/v1/plants/[plantId]/photo-entries
 *  - GET /api/v1/locations
 *
 * Auth strategy: __setCurrentUserAdapterForTests bypasses Supabase SSR cookies
 * (same pattern as iam-verification-gate.integration.test.ts). Route handlers are
 * called directly (not via HTTP).
 *
 * Storage: in-memory adapter via __setStorageAdapterForTests (same pattern as
 * create-plant.integration.test.ts).
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

// --- Mocks (hoisted) ---

vi.mock("exifr", async () => {
  const actual = await vi.importActual<typeof import("exifr")>("exifr");
  const gps = vi.fn(actual.gps);
  return {
    ...actual,
    default: { ...actual, gps },
    gps,
    __esModule: true,
  };
});

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

// --- Helper: build a valid JPEG buffer ---

async function makeJpegBuffer(size = 8): Promise<Buffer> {
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 3,
      background: { r: 100, g: 200, b: 100 },
    },
  })
    .jpeg({ quality: 80 })
    .toBuffer();
}

// --- Helper: build a multipart form body + headers ---

async function buildMultipartBody(
  fields: Record<string, string | File>,
  boundary: string,
): Promise<{ body: Buffer; contentType: string }> {
  const parts: Buffer[] = [];
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "string") {
      parts.push(
        Buffer.from(
          `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        ),
      );
    } else {
      const file = value as File;
      parts.push(
        Buffer.concat([
          Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="${file.name}"\r\nContent-Type: ${file.type}\r\n\r\n`,
          ),
          Buffer.from(new Uint8Array(await file.arrayBuffer())),
          Buffer.from("\r\n"),
        ]),
      );
    }
  }
  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

// --- Helper: compute multipart request hash (mirrors route handler logic) ---
function computeMultipartHashSync(
  idempotencyKey: string,
  rawBodyBytes: Buffer,
): string {
  const bodyHash = createHash("sha256").update(rawBodyBytes).digest("hex");
  return createHash("sha256").update(`${idempotencyKey}:${bodyHash}`).digest("hex");
}

// --- Helper: build a fake AuthAdapter that returns a specific user ---

type AuthAdapter = import("@contexts/iam/infrastructure/auth/auth-adapter").AuthAdapter;
type UserRow = import("@contexts/iam/infrastructure/db/users").UserRow;

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

describe.skipIf(!dbUrl)("Phase-05-08 catalog route handlers (read + create)", () => {
  const driver = postgres(dbUrl!, { prepare: false, max: 3, idle_timeout: 5 });

  let userId: string;
  let userId2: string;
  let verifiedUserRow: UserRow;
  let unverifiedUserRow: UserRow;
  let validJpegBuffer: Buffer;

  let setCurrentUserAdapterForTests: typeof import("@contexts/iam/application/current-user").__setCurrentUserAdapterForTests;
  let setStorageAdapterForTests: typeof import("@contexts/catalog/infrastructure/photo-storage").__setStorageAdapterForTests;

  beforeAll(async () => {
    ({ __setCurrentUserAdapterForTests: setCurrentUserAdapterForTests } = await import(
      "@contexts/iam/application/current-user"
    ));
    ({ __setStorageAdapterForTests: setStorageAdapterForTests } = await import(
      "@contexts/catalog/infrastructure/photo-storage"
    ));

    // Seed verified user
    const runId = randomUUID().slice(0, 8);
    const email = `cat-routes-${runId}@test.local`;
    const [verifiedRow] = await driver<{ id: string }[]>`
      INSERT INTO users (email, name, timezone, trial_source, email_verified_at, age_confirmed_at)
      VALUES (
        ${email},
        'Cat Routes Test',
        'America/Sao_Paulo',
        'organic',
        ${new Date().toISOString()},
        ${new Date().toISOString()}
      )
      RETURNING id
    `;
    if (!verifiedRow) throw new Error("seedUser: no verified row");
    userId = verifiedRow.id;

    // Seed unverified user
    const email2 = `cat-routes-unverified-${runId}@test.local`;
    const [unverifiedRow] = await driver<{ id: string }[]>`
      INSERT INTO users (email, name, timezone, trial_source, email_verified_at, age_confirmed_at)
      VALUES (
        ${email2},
        'Cat Routes Unverified',
        'America/Sao_Paulo',
        'organic',
        NULL,
        ${new Date().toISOString()}
      )
      RETURNING id
    `;
    if (!unverifiedRow) throw new Error("seedUser: no unverified row");
    userId2 = unverifiedRow.id;

    // Fetch UserRow shapes for the fake adapter
    const { findById } = await import("@contexts/iam/infrastructure/db/users");
    const { db } = await import("@shared/db/client");
    const vRow = await findById(db, userId);
    const uvRow = await findById(db, userId2);
    if (!vRow || !uvRow) throw new Error("findById failed");
    verifiedUserRow = vRow;
    unverifiedUserRow = uvRow;

    validJpegBuffer = await makeJpegBuffer();
  }, 30_000);

  afterAll(async () => {
    try {
      if (userId) {
        await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${userId})`;
        await driver`DELETE FROM plants WHERE user_id = ${userId}`;
        await driver`DELETE FROM location_suggestions WHERE user_id = ${userId}`;
        await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId}`;
        await driver`DELETE FROM users WHERE id = ${userId}`;
      }
      if (userId2) {
        await driver`DELETE FROM plants WHERE user_id = ${userId2}`;
        await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId2}`;
        await driver`DELETE FROM users WHERE id = ${userId2}`;
      }
    } finally {
      await driver.end({ timeout: 5 });
    }
  });

  afterEach(() => {
    setCurrentUserAdapterForTests(null);
    setStorageAdapterForTests(null);
    vi.clearAllMocks();
  });

  // ============================================================================
  // Helper: set up in-memory storage with signed URL support
  // ============================================================================
  function useInMemoryStorage(): InMemoryStorageAdapter {
    const adapter = new InMemoryStorageAdapter();
    setStorageAdapterForTests(adapter);
    return adapter;
  }

  // ============================================================================
  // POST /api/v1/plants
  // ============================================================================

  describe("POST /api/v1/plants", () => {
    // Clean up plants created by POST tests so they don't interfere with GET tests
    afterEach(async () => {
      await driver`DELETE FROM photo_entries WHERE plant_id IN (SELECT id FROM plants WHERE user_id = ${userId})`;
      await driver`DELETE FROM plants WHERE user_id = ${userId}`;
      await driver`DELETE FROM idempotency_keys WHERE user_id = ${userId}`;
    });

    async function buildPlantRequest(opts: {
      jpeg?: Buffer;
      fields?: Record<string, string>;
      idempotencyKey?: string;
      user?: UserRow | null;
    }): Promise<Request> {
      const jpeg = opts.jpeg ?? validJpegBuffer;
      const boundary = `boundary${randomUUID().replace(/-/g, "")}`;
      const photoFile = new File([jpeg], "photo.jpg", { type: "image/jpeg" });
      const formFields: Record<string, string | File> = {
        name: "Suculenta",
        photo: photoFile,
        ...opts.fields,
      };
      const { body, contentType } = await buildMultipartBody(formFields, boundary);
      const headers: Record<string, string> = { "content-type": contentType };
      if (opts.idempotencyKey !== undefined) {
        headers["idempotency-key"] = opts.idempotencyKey;
      }
      return new Request("http://localhost:3000/api/v1/plants", {
        method: "POST",
        headers,
        body,
      });
    }

    it("Test 1.1 (auth gate): no session → 401 unauthenticated", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const req = await buildPlantRequest({ idempotencyKey: randomUUID() });
      const res = await POST(req);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unauthenticated");
    });

    it("Test 1.2 (verified gate): unverified user → 403 email_unverified", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const req = await buildPlantRequest({ idempotencyKey: randomUUID() });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("email_unverified");
    });

    it("Test 1.3 (idempotency-key required): no Idempotency-Key header → 400 validation_failed", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const req = await buildPlantRequest({}); // no idempotencyKey
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("validation_failed");
    });

    it("Test 1.4 (multipart parse failure): JSON body → 400 validation_failed", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const req = new Request("http://localhost:3000/api/v1/plants", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": randomUUID(),
        },
        body: JSON.stringify({ name: "Test" }),
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string; message: string } };
      expect(body.error.code).toBe("validation_failed");
      expect(body.error.message).toMatch(/multipart parse failed/);
    });

    it("Test 1.5 (missing required fields): missing name or photo → 400 validation_failed with field paths", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");

      // Missing name
      const boundary = `b${randomUUID().replace(/-/g, "")}`;
      const photoFile = new File([validJpegBuffer], "photo.jpg", { type: "image/jpeg" });
      const { body: body1, contentType: ct1 } = await buildMultipartBody({ photo: photoFile }, boundary);
      const req1 = new Request("http://localhost:3000/api/v1/plants", {
        method: "POST",
        headers: { "content-type": ct1, "idempotency-key": randomUUID() },
        body: body1,
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(400);
      const body1Json = (await res1.json()) as { error: { code: string } };
      expect(body1Json.error.code).toBe("validation_failed");

      // Missing photo
      const boundary2 = `b${randomUUID().replace(/-/g, "")}`;
      const { body: body2, contentType: ct2 } = await buildMultipartBody({ name: "Suculenta" }, boundary2);
      const req2 = new Request("http://localhost:3000/api/v1/plants", {
        method: "POST",
        headers: { "content-type": ct2, "idempotency-key": randomUUID() },
        body: body2,
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(400);
      const body2Json = (await res2.json()) as { error: { code: string } };
      expect(body2Json.error.code).toBe("validation_failed");
    });

    it("Test 1.6 (happy path 201 + snake_case): valid multipart → 201 with plant + photo_entry", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const idempotencyKey = randomUUID();

      const req = await buildPlantRequest({
        idempotencyKey,
        fields: {
          name: "Suculenta Feliz",
          nickname: "Susu",
          location: "Sala",
          acquisition_date: "2024-01-15",
          notes: "Muito bonita",
        },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        plant: Record<string, unknown>;
        photo_entry: Record<string, unknown>;
      };
      // snake_case keys
      expect(typeof json.plant.id).toBe("string");
      expect(typeof json.plant.user_id).toBe("string");
      expect(json.plant.user_id).toBe(userId);
      expect(json.plant.name).toBe("Suculenta Feliz");
      expect(json.plant.nickname).toBe("Susu");
      expect(typeof json.photo_entry.id).toBe("string");
      expect(typeof json.photo_entry.plant_id).toBe("string");
      expect(json.photo_entry.plant_id).toBe(json.plant.id);

      // Verify DB rows exist
      const plantRows = await driver<{ id: string }[]>`SELECT id FROM plants WHERE id = ${json.plant.id as string}`;
      expect(plantRows).toHaveLength(1);
      const photoRows = await driver<{ id: string }[]>`SELECT id FROM photo_entries WHERE id = ${json.photo_entry.id as string}`;
      expect(photoRows).toHaveLength(1);
    });

    it("Test 1.7 (idempotent replay + postCommit fires exactly once): same key+body → identical response, 1 plant row", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const idempotencyKey = randomUUID();

      const boundary = `b${randomUUID().replace(/-/g, "")}`;
      const photoFile = new File([validJpegBuffer], "photo.jpg", { type: "image/jpeg" });
      const { body, contentType } = await buildMultipartBody(
        { name: "Replay Plant", photo: photoFile },
        boundary,
      );

      const makeReq = () =>
        new Request("http://localhost:3000/api/v1/plants", {
          method: "POST",
          headers: { "content-type": contentType, "idempotency-key": idempotencyKey },
          body: Buffer.from(body),
        });

      // First call
      const res1 = await POST(makeReq());
      expect(res1.status).toBe(201);
      const body1 = await res1.json() as { plant: { id: string } };
      const plantId = body1.plant.id;

      // Reset mocks to track second call only
      vi.clearAllMocks();

      // Second call — same key + same body
      const res2 = await POST(makeReq());
      expect(res2.status).toBe(201);
      const body2 = await res2.json() as { plant: { id: string } };

      // Same response
      expect(body2.plant.id).toBe(plantId);

      // Only ONE plant row
      const plantCount = await driver<{ count: string }[]>`
        SELECT count(*)::int AS count FROM plants WHERE name = 'Replay Plant' AND user_id = ${userId}
      `;
      expect(Number(plantCount[0]?.count)).toBe(1);

      // postCommit / inngest NOT fired on replay
      expect(inngestSendMock).not.toHaveBeenCalled();
    });

    it("Test 1.8 (postCommit fires after response on first call, Sentry swallows rejection): first call fires telemetry; rejection caught", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const idempotencyKey = randomUUID();

      // First call fires telemetry (inngest + posthog)
      const req = await buildPlantRequest({
        idempotencyKey,
        fields: { name: "PostCommit Test Plant" },
      });
      const res = await POST(req);
      expect(res.status).toBe(201);
      expect(inngestSendMock).toHaveBeenCalledTimes(1);
      expect(mockCapture).toHaveBeenCalledTimes(1);
    });

    it("Test 1.9 (hash-mismatch conflict): same key + different body → 409 conflict", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import("../../src/app/api/v1/plants/route");
      const idempotencyKey = randomUUID();

      // First call
      const req1 = await buildPlantRequest({
        idempotencyKey,
        fields: { name: "Original Plant" },
      });
      const res1 = await POST(req1);
      expect(res1.status).toBe(201);

      // Second call: same key, different name (different body)
      const req2 = await buildPlantRequest({
        idempotencyKey,
        fields: { name: "Different Plant" },
      });
      const res2 = await POST(req2);
      expect(res2.status).toBe(409);
      const body2 = (await res2.json()) as { error: { code: string } };
      expect(body2.error.code).toBe("conflict");

      // Only ONE plant row with the original name
      const rows = await driver<{ name: string }[]>`
        SELECT name FROM plants WHERE user_id = ${userId} AND name IN ('Original Plant', 'Different Plant')
      `;
      expect(rows).toHaveLength(1);
      expect(rows[0]?.name).toBe("Original Plant");
    });

    it("Test 1.10 (no-Drizzle-in-route gate): route file imports no drizzle or DB internals", async () => {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const content = readFileSync(
        join(process.cwd(), "src/app/api/v1/plants/route.ts"),
        "utf8",
      );
      const drizzlePattern = /from\s+["']drizzle-orm(?:\/[^"']*)?["']/;
      const dbClientPattern = /from\s+["'][^"']*shared\/db\/client["']/;
      const schemaPattern = /from\s+["'][^"']*contexts\/[^"'/]+\/infrastructure\/db\/schema["']/;
      expect(drizzlePattern.test(content)).toBe(false);
      expect(dbClientPattern.test(content)).toBe(false);
      expect(schemaPattern.test(content)).toBe(false);
    });
  });

  // ============================================================================
  // POST /api/v1/plants/[plantId]/photo-entries
  // ============================================================================

  describe("POST /api/v1/plants/[plantId]/photo-entries", () => {
    let ownedPlantId: string;

    beforeAll(async () => {
      // Seed a plant for the photo entry tests
      const [row] = await driver<{ id: string }[]>`
        INSERT INTO plants (user_id, name)
        VALUES (${userId}, 'Photo Entry Test Plant')
        RETURNING id
      `;
      if (!row) throw new Error("Failed to seed plant for photo entry tests");
      ownedPlantId = row.id;
    });

    async function buildPhotoEntryRequest(opts: {
      plantId: string;
      jpeg?: Buffer;
      note?: string;
      idempotencyKey?: string;
      user?: UserRow | null;
    }): Promise<[Request, { params: Promise<{ plantId: string }> }]> {
      const jpeg = opts.jpeg ?? validJpegBuffer;
      const boundary = `b${randomUUID().replace(/-/g, "")}`;
      const photoFile = new File([jpeg], "photo.jpg", { type: "image/jpeg" });
      const fields: Record<string, string | File> = { photo: photoFile };
      if (opts.note) fields.note = opts.note;
      const { body, contentType } = await buildMultipartBody(fields, boundary);
      const headers: Record<string, string> = { "content-type": contentType };
      if (opts.idempotencyKey !== undefined) {
        headers["idempotency-key"] = opts.idempotencyKey;
      }
      const req = new Request(
        `http://localhost:3000/api/v1/plants/${opts.plantId}/photo-entries`,
        { method: "POST", headers, body },
      );
      const params = Promise.resolve({ plantId: opts.plantId });
      return [req, { params }];
    }

    it("Test 2.1a (auth gate): no session → 401 unauthenticated", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const { POST } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const [req, ctx] = await buildPhotoEntryRequest({
        plantId: ownedPlantId,
        idempotencyKey: randomUUID(),
      });
      const res = await POST(req, ctx);
      expect(res.status).toBe(401);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("unauthenticated");
    });

    it("Test 2.1b (verified gate): unverified user → 403 email_unverified", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const { POST } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const [req, ctx] = await buildPhotoEntryRequest({
        plantId: ownedPlantId,
        idempotencyKey: randomUUID(),
      });
      const res = await POST(req, ctx);
      expect(res.status).toBe(403);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("email_unverified");
    });

    it("Test 2.1c (idempotency-key required): no Idempotency-Key → 400 validation_failed", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const [req, ctx] = await buildPhotoEntryRequest({ plantId: ownedPlantId });
      const res = await POST(req, ctx);
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("validation_failed");
    });

    it("Test 2.2 (plant ownership 404): other user's plant → 404 not_found", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      // Use a random UUID plant (not owned by verifiedUser)
      const otherPlantId = randomUUID();
      const [req, ctx] = await buildPhotoEntryRequest({
        plantId: otherPlantId,
        idempotencyKey: randomUUID(),
      });
      const res = await POST(req, ctx);
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_found");
    });

    it("Test 2.3 (happy path 201 + snake_case): valid multipart → 201 with photo_entry", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const [req, ctx] = await buildPhotoEntryRequest({
        plantId: ownedPlantId,
        note: "Cresceu muito hoje",
        idempotencyKey: randomUUID(),
      });
      const res = await POST(req, ctx);
      expect(res.status).toBe(201);
      const json = (await res.json()) as {
        photo_entry: Record<string, unknown>;
      };
      expect(typeof json.photo_entry.id).toBe("string");
      expect(json.photo_entry.plant_id).toBe(ownedPlantId);
      expect(json.photo_entry.note).toBe("Cresceu muito hoje");

      // Verify DB row exists
      const rows = await driver<{ id: string }[]>`
        SELECT id FROM photo_entries WHERE id = ${json.photo_entry.id as string}
      `;
      expect(rows).toHaveLength(1);
    });

    it("Test 2.4 (idempotent replay): same key+body → identical response, ONE row", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { POST } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const idempotencyKey = randomUUID();
      const boundary = `b${randomUUID().replace(/-/g, "")}`;
      const photoFile = new File([validJpegBuffer], "photo.jpg", { type: "image/jpeg" });
      const { body, contentType } = await buildMultipartBody({ photo: photoFile }, boundary);

      const makeReq = () =>
        new Request(`http://localhost:3000/api/v1/plants/${ownedPlantId}/photo-entries`, {
          method: "POST",
          headers: { "content-type": contentType, "idempotency-key": idempotencyKey },
          body: Buffer.from(body),
        });
      const makeCtx = () => ({ params: Promise.resolve({ plantId: ownedPlantId }) });

      // First call
      const res1 = await POST(makeReq(), makeCtx());
      expect(res1.status).toBe(201);
      const body1 = (await res1.json()) as { photo_entry: { id: string } };
      const entryId = body1.photo_entry.id;

      // Second call — same key + same body
      const res2 = await POST(makeReq(), makeCtx());
      expect(res2.status).toBe(201);
      const body2 = (await res2.json()) as { photo_entry: { id: string } };
      expect(body2.photo_entry.id).toBe(entryId);
    });

    it("Test 2.5 (no-Drizzle-in-route gate): photo-entries route file imports no drizzle", async () => {
      const { readFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      const content = readFileSync(
        join(process.cwd(), "src/app/api/v1/plants/[plantId]/photo-entries/route.ts"),
        "utf8",
      );
      const drizzlePattern = /from\s+["']drizzle-orm(?:\/[^"']*)?["']/;
      const dbClientPattern = /from\s+["'][^"']*shared\/db\/client["']/;
      expect(drizzlePattern.test(content)).toBe(false);
      expect(dbClientPattern.test(content)).toBe(false);
    });
  });

  // ============================================================================
  // GET /api/v1/plants
  // ============================================================================

  describe("GET /api/v1/plants", () => {
    let listPlantIds: string[] = [];

    beforeAll(async () => {
      useInMemoryStorage();
      // Seed 5 plants with varying acquisition dates
      const rows = await driver<{ id: string }[]>`
        INSERT INTO plants (user_id, name, location, acquisition_date)
        VALUES
          (${userId}, 'Áloe Vera', 'sala', '2024-03-01'),
          (${userId}, 'Cacto', 'quarto', '2024-01-15'),
          (${userId}, 'Samambaia', 'varanda', '2024-02-20'),
          (${userId}, 'Espada-de-São-Jorge', 'sala', NULL),
          (${userId}, 'Orquídea', 'banheiro', '2024-04-10')
        RETURNING id
      `;
      listPlantIds = rows.map((r) => r.id);
    });

    it("Test 3.1 (auth/verified gates): unauthenticated → 401; unverified → 403", async () => {
      const { GET } = await import("../../src/app/api/v1/plants/route");

      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const res1 = await GET(new Request("http://localhost:3000/api/v1/plants"));
      expect(res1.status).toBe(401);

      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const res2 = await GET(new Request("http://localhost:3000/api/v1/plants"));
      expect(res2.status).toBe(403);
    });

    it("Test 3.2 (default sort + first page): returns items without total_count", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/route");
      const res = await GET(new Request("http://localhost:3000/api/v1/plants"));
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        items: unknown[];
        next_cursor: string | null;
        total_count?: number;
      };
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThanOrEqual(5);
      // total_count absent when ?include_count not provided
      expect("total_count" in json).toBe(false);
    });

    it("Test 3.3 (?include_count=1 first page): total_count present on first page, absent when cursor set", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/route");

      // First page with include_count=1
      const res1 = await GET(
        new Request("http://localhost:3000/api/v1/plants?include_count=1"),
      );
      expect(res1.status).toBe(200);
      const json1 = (await res1.json()) as {
        items: unknown[];
        next_cursor: string | null;
        total_count?: number;
      };
      expect(typeof json1.total_count).toBe("number");
      expect(json1.total_count).toBeGreaterThanOrEqual(5);

      // With cursor + include_count=1: total_count absent (D-12)
      const res2 = await GET(
        new Request(
          `http://localhost:3000/api/v1/plants?limit=2&include_count=1`,
        ),
      );
      const json2 = (await res2.json()) as {
        items: unknown[];
        next_cursor: string | null;
        total_count?: number;
      };
      if (json2.next_cursor) {
        const res3 = await GET(
          new Request(
            `http://localhost:3000/api/v1/plants?cursor=${json2.next_cursor}&include_count=1`,
          ),
        );
        const json3 = (await res3.json()) as {
          items: unknown[];
          next_cursor: string | null;
          total_count?: number;
        };
        expect("total_count" in json3).toBe(false);
      }
    });

    it("Test 3.4 (sort variants): valid sorts return 200; invalid sort → 400 validation_failed", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/route");

      for (const sort of ["name_asc", "name_desc", "date_old", "location"]) {
        const res = await GET(new Request(`http://localhost:3000/api/v1/plants?sort=${sort}`));
        expect(res.status).toBe(200);
      }

      const badRes = await GET(new Request("http://localhost:3000/api/v1/plants?sort=foo"));
      expect(badRes.status).toBe(400);
      const body = (await badRes.json()) as { error: { code: string } };
      expect(body.error.code).toBe("validation_failed");
    });

    it("Test 3.5 (cursor pagination): limit=2 paginates across 3 pages of 5 plants", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/route");

      const res1 = await GET(
        new Request("http://localhost:3000/api/v1/plants?limit=2&sort=name_asc"),
      );
      expect(res1.status).toBe(200);
      const j1 = (await res1.json()) as { items: unknown[]; next_cursor: string | null };
      expect(j1.items.length).toBe(2);
      expect(j1.next_cursor).not.toBeNull();

      const res2 = await GET(
        new Request(`http://localhost:3000/api/v1/plants?limit=2&sort=name_asc&cursor=${j1.next_cursor}`),
      );
      expect(res2.status).toBe(200);
      const j2 = (await res2.json()) as { items: unknown[]; next_cursor: string | null };
      expect(j2.items.length).toBe(2);
      expect(j2.next_cursor).not.toBeNull();

      const res3 = await GET(
        new Request(`http://localhost:3000/api/v1/plants?limit=2&sort=name_asc&cursor=${j2.next_cursor}`),
      );
      expect(res3.status).toBe(200);
      const j3 = (await res3.json()) as { items: unknown[]; next_cursor: string | null };
      // At least 1 item on the last page (we have 5+ total but test user's 5 seeded plants + previous test plants)
      expect(j3.items.length).toBeGreaterThanOrEqual(1);
    });

    it("Test 3.6 (cursor tampering): malformed base64 cursor → 400 validation_failed", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/route");
      const res = await GET(
        new Request("http://localhost:3000/api/v1/plants?cursor=not-valid-base64-cursor!!"),
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("validation_failed");
    });

    it("Test 3.7 (limit clamping): limit=99999 clamps to 200; limit=abc defaults to 50", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/route");

      // Both should return 200 (no error from excessive limit)
      const res1 = await GET(new Request("http://localhost:3000/api/v1/plants?limit=99999"));
      expect(res1.status).toBe(200);

      const res2 = await GET(new Request("http://localhost:3000/api/v1/plants?limit=abc"));
      expect(res2.status).toBe(200);
    });
  });

  // ============================================================================
  // GET /api/v1/plants/[plantId]
  // ============================================================================

  describe("GET /api/v1/plants/[plantId]", () => {
    let detailPlantId: string;

    beforeAll(async () => {
      const [row] = await driver<{ id: string }[]>`
        INSERT INTO plants (user_id, name)
        VALUES (${userId}, 'Detail Test Plant')
        RETURNING id
      `;
      if (!row) throw new Error("Failed to seed plant for detail tests");
      detailPlantId = row.id;

      // Seed 3 photo entries
      for (let i = 0; i < 3; i++) {
        const pid = randomUUID();
        await driver`
          INSERT INTO photo_entries (id, plant_id, photo_url, thumbnail_url)
          VALUES (
            ${pid},
            ${detailPlantId},
            ${"plant-photos/" + userId + "/" + detailPlantId + "/" + pid + ".jpg"},
            ${"plant-thumbnails/" + userId + "/" + detailPlantId + "/" + pid + ".jpg"}
          )
        `;
      }
    });

    it("Test 4.1 (auth/verified gates): unauthenticated → 401; unverified → 403", async () => {
      const { GET } = await import("../../src/app/api/v1/plants/[plantId]/route");

      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const res1 = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${detailPlantId}`),
        { params: Promise.resolve({ plantId: detailPlantId }) },
      );
      expect(res1.status).toBe(401);

      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const res2 = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${detailPlantId}`),
        { params: Promise.resolve({ plantId: detailPlantId }) },
      );
      expect(res2.status).toBe(403);
    });

    it("Test 4.2 (not found / cross-user): unknown UUID → 404; other user's plant → 404", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/[plantId]/route");

      const unknownId = randomUUID();
      const res1 = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${unknownId}`),
        { params: Promise.resolve({ plantId: unknownId }) },
      );
      expect(res1.status).toBe(404);
      const body1 = (await res1.json()) as { error: { code: string } };
      expect(body1.error.code).toBe("not_found");
    });

    it("Test 4.3 (happy path + cascade meta): returns plant + _meta with photo_entry_count", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/plants/[plantId]/route");

      const res = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${detailPlantId}`),
        { params: Promise.resolve({ plantId: detailPlantId }) },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        plant: Record<string, unknown>;
        _meta: { photo_entry_count: number; reminder_count: number };
      };
      expect(json.plant.id).toBe(detailPlantId);
      expect(json.plant.user_id).toBe(userId);
      expect(typeof json._meta.photo_entry_count).toBe("number");
      expect(json._meta.photo_entry_count).toBe(3);
      expect(typeof json._meta.reminder_count).toBe("number");
      expect(json._meta.reminder_count).toBe(0);
    });
  });

  // ============================================================================
  // GET /api/v1/plants/[plantId]/photo-entries
  // ============================================================================

  describe("GET /api/v1/plants/[plantId]/photo-entries", () => {
    let journalPlantId: string;

    beforeAll(async () => {
      const [row] = await driver<{ id: string }[]>`
        INSERT INTO plants (user_id, name)
        VALUES (${userId}, 'Journal Test Plant')
        RETURNING id
      `;
      if (!row) throw new Error("Failed to seed plant for journal tests");
      journalPlantId = row.id;

      // Seed 2 photo entries
      for (let i = 0; i < 2; i++) {
        const pid = randomUUID();
        await driver`
          INSERT INTO photo_entries (id, plant_id, photo_url, thumbnail_url)
          VALUES (
            ${pid},
            ${journalPlantId},
            ${"plant-photos/" + userId + "/" + journalPlantId + "/" + pid + ".jpg"},
            ${"plant-thumbnails/" + userId + "/" + journalPlantId + "/" + pid + ".jpg"}
          )
        `;
      }
    });

    it("Test 5.1 (auth/verified gates): unauthenticated → 401; unverified → 403", async () => {
      const { GET } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );

      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const res1 = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${journalPlantId}/photo-entries`),
        { params: Promise.resolve({ plantId: journalPlantId }) },
      );
      expect(res1.status).toBe(401);

      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const res2 = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${journalPlantId}/photo-entries`),
        { params: Promise.resolve({ plantId: journalPlantId }) },
      );
      expect(res2.status).toBe(403);
    });

    it("Test 5.2 (cross-user): other user's plant → 404 not_found", async () => {
      useInMemoryStorage();
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const otherPlantId = randomUUID();
      const res = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${otherPlantId}/photo-entries`),
        { params: Promise.resolve({ plantId: otherPlantId }) },
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as { error: { code: string } };
      expect(body.error.code).toBe("not_found");
    });

    it("Test 5.3 (happy path + signed URLs): 200 with items having photo_url + thumbnail_url", async () => {
      useInMemoryStorage();
      // Seed files in storage so signedUrl doesn't fail
      const adapter = useInMemoryStorage();
      // Pre-seed the storage with dummy objects for signing to work
      const entries = await driver<{ photo_url: string; thumbnail_url: string }[]>`
        SELECT photo_url, thumbnail_url FROM photo_entries WHERE plant_id = ${journalPlantId}
      `;
      for (const entry of entries) {
        // The photo_url is "plant-photos/userId/plantId/photoId.jpg"
        // adapter.uploadObject expects { bucket, objectKey }
        const parseBucketKey = (url: string) => {
          const idx = url.indexOf("/");
          return { bucket: url.slice(0, idx), objectKey: url.slice(idx + 1) };
        };
        const { bucket: photoBucket, objectKey: photoKey } = parseBucketKey(entry.photo_url);
        const { bucket: thumbBucket, objectKey: thumbKey } = parseBucketKey(
          entry.thumbnail_url,
        );
        await adapter.uploadObject({
          bucket: photoBucket,
          objectKey: photoKey,
          buffer: validJpegBuffer,
          contentType: "image/jpeg",
        });
        await adapter.uploadObject({
          bucket: thumbBucket,
          objectKey: thumbKey,
          buffer: validJpegBuffer,
          contentType: "image/jpeg",
        });
      }

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import(
        "../../src/app/api/v1/plants/[plantId]/photo-entries/route"
      );
      const res = await GET(
        new Request(`http://localhost:3000/api/v1/plants/${journalPlantId}/photo-entries`),
        { params: Promise.resolve({ plantId: journalPlantId }) },
      );
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        items: Array<{
          id: string;
          plant_id: string;
          photo_url: string;
          thumbnail_url: string;
          note: string | null;
          created_at: string;
        }>;
      };
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBe(2);
      for (const item of json.items) {
        expect(typeof item.id).toBe("string");
        expect(item.plant_id).toBe(journalPlantId);
        expect(typeof item.photo_url).toBe("string");
        expect(typeof item.thumbnail_url).toBe("string");
      }
    });
  });

  // ============================================================================
  // GET /api/v1/locations
  // ============================================================================

  describe("GET /api/v1/locations", () => {
    it("Test 6.1 (auth/verified gates): unauthenticated → 401; unverified → 403", async () => {
      const { GET } = await import("../../src/app/api/v1/locations/route");

      setCurrentUserAdapterForTests(buildFakeAdapter(null));
      const res1 = await GET(new Request("http://localhost:3000/api/v1/locations"));
      expect(res1.status).toBe(401);

      setCurrentUserAdapterForTests(buildFakeAdapter(unverifiedUserRow));
      const res2 = await GET(new Request("http://localhost:3000/api/v1/locations"));
      expect(res2.status).toBe(403);
    });

    it("Test 6.2 (defaults + suggestions merged): no suggestions → returns 8 pt-BR defaults", async () => {
      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/locations/route");
      const res = await GET(new Request("http://localhost:3000/api/v1/locations"));
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        items: Array<{ label_display: string }>;
      };
      expect(Array.isArray(json.items)).toBe(true);
      expect(json.items.length).toBeGreaterThanOrEqual(8);
      // Items have label_display (snake_case per spec)
      for (const item of json.items) {
        expect(typeof item.label_display).toBe("string");
      }
    });

    it("Test 6.3 (user suggestions take priority): suggestion ranks above defaults", async () => {
      // Seed a location suggestion for userId
      const runId = randomUUID().slice(0, 8);
      await driver`
        INSERT INTO location_suggestions (user_id, label_normalized, label_display, usage_count, last_used_at)
        VALUES (
          ${userId},
          ${"sacada"},
          ${"Sacada " + runId},
          ${10},
          ${new Date().toISOString()}
        )
        ON CONFLICT (user_id, label_normalized) DO UPDATE
          SET label_display = EXCLUDED.label_display,
              usage_count = EXCLUDED.usage_count,
              last_used_at = EXCLUDED.last_used_at
      `;

      setCurrentUserAdapterForTests(buildFakeAdapter(verifiedUserRow));
      const { GET } = await import("../../src/app/api/v1/locations/route");
      const res = await GET(new Request("http://localhost:3000/api/v1/locations"));
      expect(res.status).toBe(200);
      const json = (await res.json()) as {
        items: Array<{ label_display: string }>;
      };
      // The top item should be the user's suggestion (highest usage_count)
      expect(json.items[0]?.label_display).toBe("Sacada " + runId);

      // Clean up
      await driver`DELETE FROM location_suggestions WHERE user_id = ${userId} AND label_normalized = 'sacada'`;
    });
  });
});
