import { createHash } from "node:crypto";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import { requireApiUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { parseJsonBody } from "@shared/api/request";
import { decodeCursor, encodeCursor, normalizeLimit } from "@shared/api/cursor";
import { consentLogInsertSchema } from "@contexts/iam/domain/consent-schemas";
import { recordConsent } from "@contexts/iam/application/record-consent";
import { listByUser } from "@contexts/iam/infrastructure/db/consent-logs";

/**
 * Route-boundary schema for the diagnostics consent POST. WR-04: this is
 * a `.pick()` of the drizzle-zod insert schema (D-19), NOT a hand-rolled
 * `z.object({...})`. Picking from the drizzle-zod root means the enum
 * options propagate from the table definition automatically — extending
 * `consentLogs.purpose.enum` in the schema flows here without any code
 * change at the route boundary. The hand-rolled previous form (with a
 * dead `_ensureSchemaRoot` import to keep grep results honest) actively
 * risked drift; this form makes the drizzle-zod rooting load-bearing.
 *
 * Only the four user-supplied fields appear: userId comes from the JWT,
 * policyVersionId is resolved server-side from the seeded current
 * privacy_policy row, and createdAt/grantedAt default at the DB layer.
 */
const consentRoutePostBodySchema = consentLogInsertSchema.pick({
  purpose: true,
  legalBasis: true,
  source: true,
});

/**
 * Phase-2 Plan 09 IAM API module — diagnostics consent route handlers.
 *
 * This file IS allowed to import Drizzle / repositories / withIdempotency /
 * withUnitOfWork — it is the IAM context's API surface. The Next route file
 * at `src/app/api/v1/diagnostics/consent/route.ts` is a thin re-export that
 * does not import Drizzle (D-17 / T-02-11).
 *
 * Composition:
 *   - `requireApiUser` (Plan 02-07) is the authoritative auth gate.
 *   - `parseJsonBody(...)` + `consentRoutePostBodySchema` (a `.pick()` of
 *     the drizzle-zod-rooted `consentLogInsertSchema`) validate the POST
 *     body, mapping non-ok to errorResponse(ValidationFailed, ...).
 *   - `withIdempotency` (Plan 02-06) wraps the POST handler with replay-
 *     safe semantics keyed by `(userId, idempotency-key, request-hash)`.
 *   - `recordConsent` (Plan 02-09 Task 1) does the actual write inside a
 *     UoW transaction so RLS sees the right subject.
 *   - `decodeCursor` + `normalizeLimit` decode the GET query parameters.
 *
 * Snake_case field names on response payloads match PRD §5 conventions.
 */

// ---------- POST ----------

export async function postHandler(request: Request): Promise<Response> {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return errorResponse(auth.code, "missing or invalid bearer token");
  }
  const userId = auth.user.id;

  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.trim() === "") {
    return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
  }

  const parsed = await parseJsonBody(request, consentRoutePostBodySchema);
  if (!parsed.ok) {
    return errorResponse(parsed.error, "invalid consent body");
  }

  const requestHash = createHash("sha256").update(JSON.stringify(parsed.value)).digest("hex");

  const result = await withIdempotency({ userId, key: idempotencyKey, requestHash }, async (tx) => {
    const inner = await recordConsent(
      {
        userId,
        input: {
          purpose: parsed.value.purpose,
          legalBasis: parsed.value.legalBasis,
          source: parsed.value.source,
        },
      },
      tx,
    );
    if (!inner.ok) {
      // recordConsent's only non-ok path is validation_failed
      // (no current policy version). Surface the registry code.
      return {
        status: 400,
        body: {
          error: {
            code: inner.error,
            message: "no current policy version",
          },
        },
      };
    }
    const row = inner.row;
    return {
      status: 201,
      body: {
        id: row.id,
        user_id: row.userId,
        purpose: row.purpose,
        legal_basis: row.legalBasis,
        policy_version_id: row.policyVersionId,
        source: row.source,
        granted_at: row.grantedAt,
        revoked_at: row.revokedAt,
        created_at: row.createdAt,
      },
    };
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
}

// ---------- GET ----------

const RAW_QUERY_LIMIT = "limit";
const RAW_QUERY_CURSOR = "cursor";

export async function getHandler(request: Request): Promise<Response> {
  const auth = await requireApiUser(request);
  if (!auth.ok) {
    return errorResponse(auth.code, "missing or invalid bearer token");
  }
  const userId = auth.user.id;

  const url = new URL(request.url);
  const limitParam = url.searchParams.get(RAW_QUERY_LIMIT);
  const cursorParam = url.searchParams.get(RAW_QUERY_CURSOR);

  // IN-01: normalizeLimit's contract guarantees a positive integer in
  // [1, MAX_LIMIT] for every input — empty/null/non-numeric collapses to
  // DEFAULT_LIMIT, negatives clamp to 1, over-MAX clamps to MAX_LIMIT.
  // No `|| DEFAULT_LIMIT` fallback is needed; that operator was unreachable.
  const limit = normalizeLimit(limitParam);
  let cursor: { id: string; createdAt: string } | undefined;

  if (cursorParam !== null && cursorParam !== "") {
    const decoded = decodeCursor(cursorParam);
    if (!decoded.ok) {
      return errorResponse(decoded.error, "invalid cursor");
    }
    cursor = decoded.value;
  }

  // Fetch limit+1 so we know whether there's a next page.
  const rows = await withUnitOfWork(userId, async (tx) => {
    return listByUser(tx, userId, {
      limit: limit + 1,
      cursor,
    });
  });

  const hasMore = rows.length > limit;
  const items = (hasMore ? rows.slice(0, limit) : rows).map((row) => ({
    id: row.id,
    user_id: row.userId,
    purpose: row.purpose,
    legal_basis: row.legalBasis,
    policy_version_id: row.policyVersionId,
    source: row.source,
    granted_at: row.grantedAt,
    revoked_at: row.revokedAt,
    created_at: row.createdAt,
  }));

  let nextCursor: string | null = null;
  if (hasMore && items.length > 0) {
    const last = items[items.length - 1]!;
    nextCursor = encodeCursor({ id: last.id, createdAt: last.created_at });
  }

  return Response.json({
    items,
    next_cursor: nextCursor,
  });
}
