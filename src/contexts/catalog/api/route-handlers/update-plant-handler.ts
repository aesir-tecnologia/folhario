import { createHash } from "node:crypto";

import * as Sentry from "@sentry/nextjs";

import { ErrorCode, errorResponse } from "@shared/config/errors";
import { requireVerifiedUser } from "@shared/api/auth";
import { withIdempotency } from "@shared/api/idempotency";
import { parseJsonBody } from "@shared/api/request";
import { updatePlantInputSchema } from "@contexts/catalog/domain/schemas";
import { updatePlant } from "@contexts/catalog/application/update-plant";
import { toPlantSnakeCase } from "@contexts/catalog/api/snake-case";
import { errorStatusFor, resolveReadOnlyFromRequest } from "@contexts/catalog/api/route-handlers/_shared";

/**
 * PATCH /api/v1/plants/[plantId] handler (Phase 5 Plan 09).
 *
 * Check order (T-05-09-01 / D-21 / D-37):
 *  1. requireVerifiedUser — auth gate (WR-02: never surface auth.reason).
 *  2. resolveReadOnlyFromRequest — read-only gate (T-05-09-04, HTTP 402).
 *  3. Idempotency-Key header required (Phase 2 D-37).
 *  4. parseJsonBody via updatePlantInputSchema.strict() — Zod validation.
 *  5. withIdempotency wraps updatePlant use-case (CR-01: shared tx).
 *  6. postCommit: awaited AFTER withIdempotency commits (telemetry contract).
 *
 * D-17: zero Drizzle imports here. Handler delegates to use-case.
 */
export async function patchPlantHandler(
  request: Request,
  context: { params: Promise<{ plantId: string }> } | { params: { plantId: string } },
): Promise<Response> {
  const params = "then" in context.params ? await context.params : context.params;
  const { plantId } = params;

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

  // Step 4: Validate body via Zod (.strict() rejects unknown keys).
  const parsed = await parseJsonBody(request, updatePlantInputSchema);
  if (!parsed.ok) {
    return errorResponse(parsed.error, "invalid update body");
  }

  // Step 5: Stable hash of parsed value (whitespace-stable per consent-route.ts:74).
  const requestHash = createHash("sha256").update(JSON.stringify(parsed.value)).digest("hex");

  // Step 6: withIdempotency wraps use-case. Same UoW tx (CR-01).
  let postCommitFn: (() => Promise<void>) | undefined;

  const result = await withIdempotency(
    { userId, key: idempotencyKey, requestHash },
    async (tx) => {
      const inner = await updatePlant({ userId, plantId, patch: parsed.value }, { tx });
      if (!inner.ok) {
        return {
          status: errorStatusFor(inner.code),
          body: { error: { code: inner.code, message: inner.reason } },
        };
      }
      postCommitFn = inner.postCommit;
      return {
        status: 200,
        body: { plant: toPlantSnakeCase(inner.plant) },
      };
    },
  );

  // Step 6b: postCommit — awaited AFTER withIdempotency commits.
  // On replay, postCommitFn is undefined (no-op optional-chain).
  // On rollback, withIdempotency throws before reaching here.
  // A postCommit failure MUST NOT fail the HTTP response (work already committed).
  try {
    await postCommitFn?.();
  } catch (e) {
    Sentry.captureException(e);
  }

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "content-type": "application/json" },
  });
}
