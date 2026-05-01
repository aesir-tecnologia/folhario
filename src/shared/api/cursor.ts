import { z } from "zod";

import { ErrorCode } from "@shared/config/errors";

/**
 * Phase-2 D-36 cursor helper.
 *
 * Cursor format: `base64(JSON.stringify({ id, createdAt }))`. The encoded
 * payload is opaque to clients; tampering or off-spec datetimes return
 * `ErrorCode.ValidationFailed` instead of throwing a 500.
 *
 * Datetime contract (PRD §5 + REVIEWS LOW): cursor `createdAt` MUST be an
 * ISO-8601 UTC string ending in `Z`. We use `z.string().datetime({ offset: false })`
 * which is the explicit form — Zod 4.3.6's regex rejects offset suffixes
 * (e.g. `-03:00`) and naive strings (no timezone) under this option.
 *
 * Limit contract (INFRA-21/INFRA-22): default page size is 50, max is 200.
 * `normalizeLimit` is intentionally lenient — it accepts undefined / null /
 * empty / non-numeric / out-of-range inputs and clamps them to the contract.
 * Route handlers therefore never need to branch on bad query strings; they
 * just feed `searchParams.get("limit")` straight in.
 */

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

const cursorPayloadSchema = z.object({
  id: z.string().uuid(),
  createdAt: z.string().datetime({ offset: false }),
});

export type CursorPayload = z.infer<typeof cursorPayloadSchema>;

export type DecodeResult =
  | { ok: true; value: CursorPayload }
  | { ok: false; error: typeof ErrorCode.ValidationFailed };

/**
 * Encode a `{ id, createdAt }` tuple as an opaque URL-safe base64url cursor.
 * Caller is responsible for supplying a UTC `Z` datetime; this function
 * does not re-validate the input.
 *
 * Uses base64url (IN-03) so the resulting cursor is URL-safe by definition
 * (no `+` or `/` characters that would need percent-encoding when placed in
 * a `?cursor=...` query string). `decodeCursor` accepts both standard and
 * URL-safe forms for backwards compatibility.
 */
export function encodeCursor(payload: CursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

/**
 * Decode a base64url cursor produced by `encodeCursor`. Returns a discriminated
 * union: `{ ok: true, value }` on success, `{ ok: false, error: ValidationFailed }`
 * on any malformed input (bad base64, bad JSON, wrong shape, off-spec datetime).
 *
 * The function never throws; route handlers can map a non-ok result directly
 * to a `validation_failed` 400 response without try/catch.
 *
 * `Buffer.from(input, "base64url")` accepts both URL-safe and standard
 * base64 strings, so legacy clients that may have stored standard-base64
 * cursors continue to decode correctly.
 */
export function decodeCursor(encoded: string): DecodeResult {
  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  const result = cursorPayloadSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  return { ok: true, value: result.data };
}

/**
 * Clamp a raw limit query value into the [1, MAX_LIMIT] range, defaulting
 * to DEFAULT_LIMIT when the input is missing, empty, or non-numeric.
 *
 * Accepts `string | number | null | undefined` so route handlers can pass
 * `URLSearchParams.get("limit")` (which returns `string | null`) directly.
 */
export function normalizeLimit(input: string | number | null | undefined): number {
  if (input === undefined || input === null || input === "") {
    return DEFAULT_LIMIT;
  }

  const parsed = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_LIMIT;
  }

  const floored = Math.floor(parsed);
  if (floored < 1) return 1;
  if (floored > MAX_LIMIT) return MAX_LIMIT;
  return floored;
}

/**
 * Phase-5 D-12 sort-aware cursor.
 *
 * Cursor format: `base64url(JSON.stringify({sort_id, last_value, last_id}))`.
 *
 * - `sort_id` is one of the 5 catalog sort modes (D-11): name_asc / name_desc /
 *   date_new / date_old / location.
 * - `last_value` carries the sort-key of the last row in the previous page.
 *   For `acquisition_date` modes, NULL dates sort last (NULLS LAST). The
 *   cursor encodes `last_value: null` as the sentinel meaning "we are now
 *   in the NULL-tail of the result set" — the SQL layer translates that
 *   into `WHERE acquisition_date IS NULL AND id < :last_id`.
 * - `last_id` is the stable tiebreak — always the plant UUID.
 *
 * This codec is ADDITIVE: the Phase-2 `{id, createdAt}` cursor (cursorPayloadSchema /
 * encodeCursor / decodeCursor) is unchanged and still serves the existing
 * non-sort-aware list endpoints. Phase 5 sort-aware list-plants uses the
 * helpers below.
 */

export const SORT_IDS = ["name_asc", "name_desc", "date_new", "date_old", "location"] as const;

export type SortId = (typeof SORT_IDS)[number];

const sortCursorPayloadSchema = z.object({
  sort_id: z.enum(SORT_IDS),
  last_value: z.union([z.string(), z.null()]),
  last_id: z.string().uuid(),
});

export type SortCursorPayload = z.infer<typeof sortCursorPayloadSchema>;

export type SortCursorDecodeResult =
  | { ok: true; value: SortCursorPayload }
  | { ok: false; error: typeof ErrorCode.ValidationFailed };

export function encodeSortCursor(payload: SortCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

export function decodeSortCursor(encoded: string): SortCursorDecodeResult {
  let json: string;
  try {
    json = Buffer.from(encoded, "base64url").toString("utf8");
  } catch {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  const result = sortCursorPayloadSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  return { ok: true, value: result.data };
}
