import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { deletePlant } from "@contexts/catalog/application/delete-plant";
import {
  errorStatusFor,
  resolveReadOnlyFromRequest,
} from "@contexts/catalog/api/route-handlers/_shared";

/**
 * DELETE /api/v1/plants/[plantId] handler (Phase 5 Plan 09 / CAT-09 / D-22).
 *
 * Check order (T-05-09-01 / D-21 / D-37):
 *  1. requireVerifiedUser — auth gate (WR-02: never surface auth.reason).
 *  2. resolveReadOnlyFromRequest — read-only gate (T-05-09-04, HTTP 402).
 *  3. Idempotency-Key header required (Phase 2 D-37).
 *  4. withIdempotency wraps deletePlant use-case (CR-01: shared tx, D-37).
 *  5. postCommit: Inngest event + PostHog capture AFTER withIdempotency commits.
 *     On replay, postCommitFn is undefined (no-op). On rollback, we never reach here.
 *
 * requestHash for DELETE: derived from URL path + method (no request body).
 *
 * D-17: zero Drizzle imports here. Handler delegates to use-case.
 * D-22: deletePlant use-case handles cascade + pending_storage_deletions + Inngest + PostHog.
 */
export async function deletePlantHandler(
  request: Request,
  context: { params: Promise<{ plantId: string }> },
): Promise<Response> {
  const { plantId } = await context.params;

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

  const result = await withIdempotency({ userId, key: idempotencyKey, requestHash }, async (tx) => {
    const inner = await deletePlant({ userId, plantId }, { tx });
    if (!inner.ok) {
      return {
        status: errorStatusFor(inner.code),
        body: { error: { code: inner.code, message: inner.reason } },
      };
    }
    postCommitFn = inner.postCommit;
    return { status: 204, body: null };
  });

  // Step 5: postCommit — Inngest event + PostHog AFTER withIdempotency commits.
  // On replay, postCommitFn is undefined (no-op). On rollback, never reached.
  // A postCommit failure MUST NOT fail the HTTP response (work already committed).
  try {
    await postCommitFn?.();
  } catch (e) {
    Sentry.captureException(e);
  }

  return new Response(result.body !== null ? JSON.stringify(result.body) : null, {
    status: result.status,
    headers: result.body !== null ? { "content-type": "application/json" } : {},
  });
}
