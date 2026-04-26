import { z } from "zod";

import { ErrorCode } from "@shared/config/errors";

/**
 * Phase-2 D-19 / INFRA-09 request validation helpers.
 *
 * Routes parse user input at the HTTP boundary through these helpers, then
 * hand the typed value to use-cases. Both helpers return a discriminated
 * union (`{ ok: true, value } | { ok: false, error: ValidationFailed }`) so
 * callers can map a non-ok result directly to a 400 response without
 * try/catch — matching the shape of `decodeCursor` in `@shared/api/cursor`.
 *
 * Neither helper throws on bad input. Bad JSON, schema mismatch, missing
 * body, and Zod refinement failures all collapse to the same
 * `validation_failed` outcome — the closed error registry rule (PRD §5
 * + project convention) requires a single public error code for "client
 * sent a body we couldn't parse," and the internal cause does not need to
 * leak.
 */

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: typeof ErrorCode.ValidationFailed };

/**
 * Read `await request.json()` and pipe through the supplied Zod schema.
 *
 * Returns ValidationFailed when:
 * - the body is missing or not parseable as JSON,
 * - the parsed body does not match the schema.
 *
 * Never throws.
 */
export async function parseJsonBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<ParseResult<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  return { ok: true, value: result.data };
}

/**
 * Read `url.searchParams` as a flat string-record and pipe through the
 * supplied Zod schema. Repeated query keys collapse to the LAST value (the
 * standard Web URLSearchParams behavior); routes that need array semantics
 * should pre-process via `searchParams.getAll(...)`.
 *
 * Never throws.
 */
export function parseQuery<T>(url: URL, schema: z.ZodType<T>): ParseResult<T> {
  const flat: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    flat[key] = value;
  });

  const result = schema.safeParse(flat);
  if (!result.success) {
    return { ok: false, error: ErrorCode.ValidationFailed };
  }

  return { ok: true, value: result.data };
}
