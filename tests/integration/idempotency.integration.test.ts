import { randomUUID } from "node:crypto";

import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { ErrorCode } from "@shared/config/errors";
import * as schema from "@shared/db/schema-registry";
import { idempotencyKeys } from "@contexts/iam/infrastructure/db/schema";

/**
 * Phase-2 Plan 06 Task 3 — withIdempotency integration test.
 *
 * Three core paths plus TTL contract (D-37, D-38, T-02-15, T-02-16, T-02-36):
 *
 * 1. FIRST CALL stores response.
 * 2. SECOND CALL with same (userId, key, requestHash) replays.
 * 3. SECOND CALL with same (userId, key) but DIFFERENT hash returns
 *    ErrorCode.Conflict and does NOT mutate the stored row or invoke
 *    the handler.
 * 4. HANDLER THROWS THEN REPLAY: a fresh (userId, key2, hash2) call where
 *    the handler throws. The transaction rolls back so no row persists.
 *    A subsequent call with the same (userId, key2, hash2) executes the
 *    handler AGAIN (replayed=false on the second call too). Then a third
 *    call returns replayed=true.
 * 5. TTL: rows have expires_at = now() + 7 days (±5s tolerance).
 *
 * Real Postgres only — RLS / unique constraints / transaction rollback are
 * the actual contracts being asserted; mocking the DB would lose the
 * `ON CONFLICT (user_id, key) DO NOTHING RETURNING *` semantics that make
 * the helper race-safe (T-02-15).
 */

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL). " +
      "Integration tests target local Supabase (pnpm db:start) or CI postgres:17-alpine only.",
  );
}

describe.skipIf(!dbUrl)("Phase-02-06 withIdempotency integration", () => {
  // Isolated postgres-js + Drizzle instance for the test so we can tear down
  // without touching the production singleton in `src/shared/db/client.ts`.
  const driver = postgres(dbUrl!, { prepare: false, max: 1, idle_timeout: 5 });
  const db = drizzle({ client: driver, schema });

  let userId: string;
  let withIdempotency: typeof import("@shared/api/idempotency").withIdempotency;

  beforeAll(async () => {
    ({ withIdempotency } = await import("@shared/api/idempotency"));

    const userRow = await driver`
      INSERT INTO users (email, name, timezone, trial_source)
      VALUES (${"idem-" + randomUUID() + "@test.local"}, 'Idem Test User', 'America/Sao_Paulo', 'organic')
      RETURNING id
    `;
    userId = userRow[0]!.id as string;
  });

  afterAll(async () => {
    if (userId) {
      // CASCADE on users.id wipes any idempotency_keys rows we created.
      await driver`DELETE FROM users WHERE id = ${userId}`;
    }
    await driver.end({ timeout: 5 });
  });

  it("first call executes the handler, stores response, returns replayed=false", async () => {
    const key = `task-${randomUUID()}`;
    const requestHash = "hash-" + randomUUID();
    const handler = vi.fn().mockResolvedValue({ status: 201, body: { id: 1 } });

    const result = await withIdempotency(db, { userId, key, requestHash }, handler);

    expect(result).toEqual({ status: 201, body: { id: 1 }, replayed: false });
    expect(handler).toHaveBeenCalledTimes(1);

    // Row persisted with response_status, response_body, request_hash.
    const rows = await driver`
      SELECT user_id, key, request_hash, response_status, response_body, expires_at
      FROM idempotency_keys
      WHERE user_id = ${userId} AND key = ${key}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.request_hash).toBe(requestHash);
    expect(rows[0]!.response_status).toBe(201);
    expect(rows[0]!.response_body).toEqual({ id: 1 });
  });

  it("second call with same (userId, key, requestHash) replays without invoking handler", async () => {
    const key = `task-${randomUUID()}`;
    const requestHash = "hash-" + randomUUID();
    const handler = vi.fn().mockResolvedValue({ status: 200, body: { hello: "world" } });

    const first = await withIdempotency(db, { userId, key, requestHash }, handler);
    expect(first.replayed).toBe(false);
    expect(handler).toHaveBeenCalledTimes(1);

    const second = await withIdempotency(db, { userId, key, requestHash }, handler);
    expect(second).toEqual({ status: 200, body: { hello: "world" }, replayed: true });

    // Same-key+same-hash second call MUST NOT invoke the handler.
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("different hash returns Conflict, does not invoke handler, does not mutate row", async () => {
    const key = `task-${randomUUID()}`;
    const goodHash = "hash-" + randomUUID();
    const badHash = "hash-" + randomUUID();
    const handler = vi.fn().mockResolvedValue({ status: 200, body: { ok: true } });

    await withIdempotency(db, { userId, key, requestHash: goodHash }, handler);
    expect(handler).toHaveBeenCalledTimes(1);

    const conflict = await withIdempotency(
      db,
      { userId, key, requestHash: badHash },
      handler,
    );
    expect(conflict.status).toBe(409);
    // The body is the standard error envelope; assert against the closed code.
    expect(conflict.body).toMatchObject({ error: { code: ErrorCode.Conflict } });

    // Conflict path MUST NOT invoke the handler again.
    expect(handler).toHaveBeenCalledTimes(1);

    // Stored row is untouched: original hash + original response.
    const rows = await driver`
      SELECT request_hash, response_status, response_body
      FROM idempotency_keys
      WHERE user_id = ${userId} AND key = ${key}
    `;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.request_hash).toBe(goodHash);
    expect(rows[0]!.response_status).toBe(200);
    expect(rows[0]!.response_body).toEqual({ ok: true });
  });

  it("handler-throws-then-replay re-executes (rollback drops the partial row)", async () => {
    const key = `task-${randomUUID()}`;
    const requestHash = "hash-" + randomUUID();

    const boomError = new Error("boom");
    const handler = vi
      .fn()
      // First call throws.
      .mockRejectedValueOnce(boomError)
      // Second call (re-execute) succeeds.
      .mockResolvedValueOnce({ status: 200, body: { ok: true } })
      // Third call should NOT be invoked — it should replay.
      .mockResolvedValueOnce({ status: 999, body: { wrong: true } });

    // 1. Handler throws — error MUST propagate.
    await expect(
      withIdempotency(db, { userId, key, requestHash }, handler),
    ).rejects.toBe(boomError);

    // Transaction rolled back — no idempotency_keys row persists.
    let rows = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key));
    expect(rows).toHaveLength(0);

    // 2. Same (userId, key, requestHash) — handler executes AGAIN (count = 2).
    const replayAttempt = await withIdempotency(
      db,
      { userId, key, requestHash },
      handler,
    );
    expect(replayAttempt).toEqual({ status: 200, body: { ok: true }, replayed: false });
    expect(handler).toHaveBeenCalledTimes(2);

    // Row now persists.
    rows = await db
      .select()
      .from(idempotencyKeys)
      .where(eq(idempotencyKeys.key, key));
    expect(rows).toHaveLength(1);

    // 3. Third call replays without invoking the handler.
    const third = await withIdempotency(db, { userId, key, requestHash }, handler);
    expect(third).toEqual({ status: 200, body: { ok: true }, replayed: true });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("expires_at is now() + 7 days (±5s tolerance)", async () => {
    const key = `task-${randomUUID()}`;
    const requestHash = "hash-" + randomUUID();
    const handler = vi.fn().mockResolvedValue({ status: 200, body: { ok: true } });

    const before = Date.now();
    await withIdempotency(db, { userId, key, requestHash }, handler);
    const after = Date.now();

    const rows = await driver`
      SELECT expires_at
      FROM idempotency_keys
      WHERE user_id = ${userId} AND key = ${key}
    `;
    expect(rows).toHaveLength(1);

    const expiresAtMs = new Date(rows[0]!.expires_at as string).getTime();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const tolerance = 5_000;

    // The row was inserted at some moment in [before, after]. Its expires_at
    // therefore lies in [before + 7d, after + 7d], with a ±5s tolerance band
    // for clock skew between the test process and Postgres' now().
    expect(expiresAtMs).toBeGreaterThanOrEqual(before + sevenDaysMs - tolerance);
    expect(expiresAtMs).toBeLessThanOrEqual(after + sevenDaysMs + tolerance);
  });
});
