import { createHash } from "node:crypto";

import { ErrorCode } from "@shared/config/errors";

/**
 * Phase-5 D-37 / D-02 — multipart request hash for idempotency.
 *
 * Formula: sha256(headerKey || ":" || sha256(rawBodyBytes))
 *
 * The headerKey prefix prevents collisions between multipart and JSON
 * requests on the same (userId, key) row. The multipart boundary varies
 * per-client, so a re-encoded retry from a different client produces a
 * different hash and surfaces as 409 conflict (Phase 2 T-02-16).
 *
 * rawBodyBytes MUST be read via `request.clone().arrayBuffer()` BEFORE
 * `request.formData()` consumes the stream. If the body is already consumed,
 * this returns `{ ok: false }`.
 */
export async function computeMultipartRequestHash(
  request: Request,
): Promise<{ ok: true; hash: string } | { ok: false; code: typeof ErrorCode.ValidationFailed; reason: string }> {
  const idempotencyKey = request.headers.get("idempotency-key") ?? "";
  let rawBytes: ArrayBuffer;
  try {
    rawBytes = await request.clone().arrayBuffer();
  } catch (err) {
    const reason = err instanceof Error ? err.message : "could not read request body";
    return { ok: false, code: ErrorCode.ValidationFailed, reason };
  }

  const bodyHash = createHash("sha256").update(Buffer.from(rawBytes)).digest("hex");
  const hash = createHash("sha256").update(`${idempotencyKey}:${bodyHash}`).digest("hex");
  return { ok: true, hash };
}
