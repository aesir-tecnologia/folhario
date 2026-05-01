import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { deletePhotoEntry } from "@contexts/catalog/application/delete-photo-entry";
import { errorStatusFor, resolveReadOnlyFromRequest } from "@contexts/catalog/api/route-handlers/_shared";

/**
 * DELETE /api/v1/photo-entries/[photoEntryId] handler (Phase 5 Plan 09 / CAT-06 / D-03).
 *
 * Check order (T-05-09-01 / D-21 / D-37):
 *  1. requireVerifiedUser — auth gate (WR-02: never surface auth.reason).
 *  2. resolveReadOnlyFromRequest — read-only gate (T-05-09-04, HTTP 402).
 *  3. Idempotency-Key header required (Phase 2 D-37).
 *  4. withIdempotency wraps deletePhotoEntry use-case (CR-01: shared tx, D-37).
 *  5. postCommit: awaited AFTER withIdempotency commits (no telemetry for photo-entry delete,
 *     so postCommitFn is always undefined — optional-chain is a no-op).
 *
 * requestHash for DELETE: derived from URL path + method (no request body).
 *
 * D-17: zero Drizzle imports here. Handler delegates to use-case.
 * D-03: deletePhotoEntry use-case auto-promotes cover in the same UoW tx.
 * T-05-09-01: cross-user attempt returns not_found (use-case findByIdForUser ownership check).
 */
export async function deletePhotoEntryHandler(
  request: Request,
  context: { params: Promise<{ photoEntryId: string }> } | { params: { photoEntryId: string } },
): Promise<Response> {
  const params = "then" in context.params ? await context.params : context.params;
  const { photoEntryId } = params;

  // Step 1: Auth gate.
  const auth = await requireVerifiedUser(request);
  if (!auth.ok) {
    return errorResponse(auth.code, "missing or invalid bearer token");
  }
  const userId = auth.user.id;

  // Step 2: Read-only gate (D-21 / T-05-09-04). HTTP 402 via registry.
  if (resolveReadOnlyFromRequest(request)) {
    return errorResponse(ErrorCode.ReadOnlyMode, "subscription is in read-only mode");
  }

  // Step 3: Idempotency-Key required (Phase 2 D-37).
  const idempotencyKey = request.headers.get("idempotency-key");
  if (!idempotencyKey || idempotencyKey.trim() === "") {
    return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
  }

  // requestHash for DELETE: derived from URL path + method (no body).
  const url = new URL(request.url);
  const requestHash = createHash("sha256").update(`DELETE:${url.pathname}`).digest("hex");

  // Step 4: withIdempotency wraps use-case. Same UoW tx (CR-01).
  let postCommitFn: (() => Promise<void>) | undefined;

  const result = await withIdempotency(
    { userId, key: idempotencyKey, requestHash },
    async (tx) => {
      const inner = await deletePhotoEntry({ userId, photoEntryId }, { tx });
      if (!inner.ok) {
        return {
          status: errorStatusFor(inner.code),
          body: { error: { code: inner.code, message: inner.reason } },
        };
      }
      postCommitFn = inner.postCommit;
      return { status: 204, body: null };
    },
  );

  // Step 5: postCommit — no telemetry for photo-entry delete; postCommitFn is always
  // undefined here. Optional-chain is a no-op. Kept for forward-compatibility
  // and to satisfy the postCommit closure-capture contract.
  try {
    await postCommitFn?.();
  } catch (e) {
    Sentry.captureException(e);
  }

  return new Response(
    result.body !== null ? JSON.stringify(result.body) : null,
    {
      status: result.status,
      headers: result.body !== null ? { "content-type": "application/json" } : {},
    },
  );
}
