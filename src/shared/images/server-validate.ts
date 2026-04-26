import * as exifr from "exifr";

import { ErrorCode } from "@shared/config/errors";
import { MAX_UPLOAD_BYTES } from "@shared/images/limits";

/**
 * Server-side image validation helpers for `/api/v1/photos/upload`.
 *
 * Phase 02 Plan 08 — D-30 (server GPS rejection via exifr), INFRA-19,
 * T-02-20 (defense in depth: even if the client preserved EXIF, the
 * server rejects before any storage write).
 *
 * Two helpers, both returning a discriminated-union `ValidationResult`
 * so route handlers can map non-ok results directly to `errorResponse(...)`
 * without try/catch — same pattern as `parseJsonBody`/`parseQuery` from
 * Plan 02-06.
 *
 * Size constants come from `@shared/images/limits`; this file MUST NOT
 * hardcode any byte literal. Drift between the route, helpers, and the
 * client target is the T-02-39 risk; pulling the constant from one place
 * is the mitigation.
 */

export type ValidationResult =
  | { ok: true }
  | { ok: false; code: typeof ErrorCode.ValidationFailed; reason: string };

interface GpsResult {
  latitude?: number;
  longitude?: number;
}

/**
 * Reject uploads that contain GPS coordinates in their EXIF metadata.
 *
 * Uses `exifr.gps()` which returns `{ latitude, longitude }` (or undefined)
 * when GPS tags are present. We treat any successfully-parsed coordinate
 * pair as a rejection trigger.
 *
 * If the parser throws (malformed metadata, truncated file, etc.), we treat
 * GPS as absent — the goal is to block KNOWN GPS leaks, not to second-guess
 * every parser failure. Other validators in the pipeline (sharp metadata
 * read, size check) will catch malformed images.
 */
export async function rejectGpsMetadata(buffer: Buffer): Promise<ValidationResult> {
  let coords: GpsResult | undefined;
  try {
    coords = (await exifr.gps(buffer)) as GpsResult | undefined;
  } catch {
    return { ok: true };
  }

  if (
    coords &&
    typeof coords.latitude === "number" &&
    typeof coords.longitude === "number"
  ) {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: "image contains GPS metadata; remove location data and retry",
    };
  }

  return { ok: true };
}

/**
 * Reject uploads larger than `MAX_UPLOAD_BYTES`. Pure synchronous check —
 * no IO, no parsing. Called BEFORE any storage write.
 *
 * The boundary is at-or-below: `byteLength === MAX_UPLOAD_BYTES` succeeds,
 * `byteLength === MAX_UPLOAD_BYTES + 1` fails. The unit test asserts both
 * sides of the boundary (T-02-39).
 */
export function rejectOversizeBuffer(buffer: Buffer): ValidationResult {
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      code: ErrorCode.ValidationFailed,
      reason: `image exceeds maximum size of ${MAX_UPLOAD_BYTES} bytes (got ${buffer.byteLength})`,
    };
  }
  return { ok: true };
}
