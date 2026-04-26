import { and, eq, sql } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { ErrorCode, type ErrorBody } from "@shared/config/errors";
import { idempotencyKeys } from "@contexts/iam/infrastructure/db/schema";

/**
 * Phase-2 D-37 / D-38 / INFRA-22 — DB-backed idempotency wrapper.
 *
 * Replay-safe execution of a mutating endpoint handler:
 *
 *   - FIRST CALL with `(userId, key, requestHash)` executes the handler
 *     inside a transaction, stores the (status, body, request_hash) on the
 *     `idempotency_keys` row, and returns `{ ..., replayed: false }`.
 *   - REPLAY with same `(userId, key, requestHash)` returns the stored
 *     `(status, body)` and `replayed: true`. The handler is NOT invoked.
 *   - HASH MISMATCH (`(userId, key)` matches an existing row but
 *     `requestHash` differs) returns `ErrorCode.Conflict` (HTTP 409).
 *     The handler is NOT invoked and the stored row is NOT mutated. This
 *     is the T-02-16 mitigation: same key + different body must not
 *     replay an unrelated response.
 *   - HANDLER THROWS: the surrounding transaction rolls back, so no
 *     partial idempotency row persists. A retry with the same
 *     `(userId, key, requestHash)` is therefore a fresh first call. This
 *     is the T-02-36 mitigation.
 *
 * Race-safety strategy (T-02-15): we use a single
 * `INSERT ... ON CONFLICT (user_id, key) DO NOTHING RETURNING *` to claim
 * the row atomically. If two concurrent processes race on the same key,
 * only one gets the RETURNING row; the other reads the stored response
 * via the SELECT-on-conflict branch.
 *
 * `request_hash` is REQUIRED on every call — `idempotency_keys.request_hash`
 * is NOT NULL (locked in Plan 02-03 by REVIEWS contract). Callers must
 * compute a stable hash of the request body (e.g., `sha256(canonicalJson(body))`)
 * before invoking this helper.
 */

const TTL_DAYS = 7;

export interface WithIdempotencyInput {
  userId: string;
  key: string;
  /**
   * REQUIRED. Stable hash of the request body so a hash mismatch on the
   * same `(userId, key)` returns Conflict instead of replaying an
   * unrelated response. The column is NOT NULL.
   */
  requestHash: string;
}

export interface IdempotencyResult {
  status: number;
  body: unknown;
  replayed: boolean;
}

export type IdempotencyHandler = () => Promise<{
  status: number;
  body: unknown;
}>;

function conflictBody(): ErrorBody {
  return {
    error: {
      code: ErrorCode.Conflict,
      message:
        "Idempotency-Key matches a previous request with a different body. " +
        "Use a new Idempotency-Key for a different payload.",
    },
  };
}

/**
 * Run `handler` with replay-safe semantics keyed by `(userId, key, requestHash)`.
 *
 * The transaction boundary IS the rollback contract: if `handler` throws,
 * the BEGIN/COMMIT envelope is rolled back so the freshly-claimed
 * `idempotency_keys` row vanishes and the next caller can re-execute.
 */
export async function withIdempotency(
  db: DbClient,
  input: WithIdempotencyInput,
  handler: IdempotencyHandler,
): Promise<IdempotencyResult> {
  const { userId, key, requestHash } = input;

  return db.transaction(async (tx) => {
    // Race-safe atomic claim: insert OR no-op-on-conflict, returning the
    // freshly-inserted row or an empty array. expires_at is set 7 days
    // out at insert time per D-38.
    const claimed = await tx
      .insert(idempotencyKeys)
      .values({
        userId,
        key,
        requestHash,
        expiresAt: sql`now() + interval '${sql.raw(String(TTL_DAYS))} days'`,
      })
      .onConflictDoNothing({ target: [idempotencyKeys.userId, idempotencyKeys.key] })
      .returning();

    if (claimed.length > 0) {
      // FIRST CALL: execute the handler, store its response on the row, commit.
      // If the handler throws, the surrounding transaction rolls back and
      // the freshly-inserted row vanishes — a retry will be a fresh first call.
      const response = await handler();

      await tx
        .update(idempotencyKeys)
        .set({
          responseStatus: response.status,
          responseBody: response.body as never,
          updatedAt: sql`now()`,
        })
        .where(
          and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)),
        );

      return { status: response.status, body: response.body, replayed: false };
    }

    // CONFLICT BRANCH: a row already exists for `(userId, key)`. Lock it
    // for the duration of this transaction so a concurrent first-call
    // update cannot race with our read.
    const existingRows = await tx
      .select()
      .from(idempotencyKeys)
      .where(and(eq(idempotencyKeys.userId, userId), eq(idempotencyKeys.key, key)))
      .for("update");

    const existing = existingRows[0];
    if (!existing) {
      // Should be unreachable: ON CONFLICT means the row exists and the
      // `for("update")` lock acquired it. If it disappeared, fail loudly
      // rather than silently replay.
      throw new Error(
        "withIdempotency: row vanished between INSERT-on-conflict and SELECT FOR UPDATE",
      );
    }

    if (existing.requestHash !== requestHash) {
      // HASH MISMATCH: closed-registry Conflict. Do NOT mutate the row;
      // do NOT invoke the handler.
      return {
        status: 409,
        body: conflictBody(),
        replayed: true,
      };
    }

    // SAME HASH: replay the stored response. response_status / response_body
    // are nullable in the column type but should be non-null whenever a
    // successful first call has committed. If they are null, surface a
    // clear failure rather than a silent 0-status replay.
    if (existing.responseStatus === null || existing.responseBody === null) {
      throw new Error(
        "withIdempotency: stored row has no response — first-call commit was incomplete",
      );
    }

    return {
      status: existing.responseStatus,
      body: existing.responseBody,
      replayed: true,
    };
  });
}
