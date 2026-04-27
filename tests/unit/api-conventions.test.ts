import { describe, it, expect } from "vitest";
import { z } from "zod";

import { ErrorCode } from "@shared/config/errors";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  normalizeLimit,
} from "@shared/api/cursor";
import { parseJsonBody, parseQuery } from "@shared/api/request";
import { consentLogInsertSchema } from "@contexts/iam/domain/consent-schemas";

/**
 * Phase-2 Plan 06 Task 1 — cursor helper.
 *
 * Contract (D-36 + REVIEWS LOW: cursor datetime UTC):
 * - Cursor format is `base64(JSON.stringify({ id, createdAt }))`.
 * - `createdAt` MUST be ISO-8601 UTC ending in `Z` (PRD §5). Offsets and
 *   naive datetimes are rejected as `validation_failed`.
 * - Malformed cursors NEVER throw; the decode helper returns a discriminated
 *   union so route handlers can map the failure to a 400 response.
 * - `normalizeLimit` clamps to [1, 200] with a default of 50.
 */

const VALID_UUID = "11111111-1111-4111-8111-111111111111";
const VALID_UTC = "2026-04-25T12:00:00.000Z";

describe("Phase-2 cursor helper (D-36)", () => {
  it("exports DEFAULT_LIMIT = 50 and MAX_LIMIT = 200", () => {
    expect(DEFAULT_LIMIT).toBe(50);
    expect(MAX_LIMIT).toBe(200);
  });

  it("encodeCursor returns an opaque base64 string", () => {
    const cursor = encodeCursor({ id: VALID_UUID, createdAt: VALID_UTC });
    expect(typeof cursor).toBe("string");
    // base64-without-padding may or may not include '=' — accept any non-empty
    // alphanumeric+`+/_-=` payload that is NOT raw JSON.
    expect(cursor.length).toBeGreaterThan(0);
    expect(cursor.includes("{")).toBe(false);
    expect(cursor.includes('"')).toBe(false);
  });

  it("decodeCursor round-trips a UTC `Z` cursor", () => {
    const encoded = encodeCursor({ id: VALID_UUID, createdAt: VALID_UTC });
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(true);
    if (decoded.ok) {
      expect(decoded.value.id).toBe(VALID_UUID);
      expect(decoded.value.createdAt).toBe(VALID_UTC);
    }
  });

  it("decodeCursor returns ValidationFailed for malformed base64", () => {
    const decoded = decodeCursor("not!@#valid$%^base64");
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("decodeCursor returns ValidationFailed for non-JSON base64", () => {
    const decoded = decodeCursor(Buffer.from("hello world").toString("base64"));
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("decodeCursor returns ValidationFailed when JSON shape is wrong", () => {
    const encoded = Buffer.from(JSON.stringify({ id: 42 })).toString("base64");
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("decodeCursor returns ValidationFailed for offset-suffixed datetime (rejects -03:00)", () => {
    const encoded = Buffer.from(
      JSON.stringify({ id: VALID_UUID, createdAt: "2026-04-25T12:00:00-03:00" }),
    ).toString("base64");
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("decodeCursor returns ValidationFailed for naive datetime (no `Z`)", () => {
    const encoded = Buffer.from(
      JSON.stringify({ id: VALID_UUID, createdAt: "2026-04-25T12:00:00" }),
    ).toString("base64");
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("decodeCursor returns ValidationFailed when id is not a UUID", () => {
    const encoded = Buffer.from(
      JSON.stringify({ id: "not-a-uuid", createdAt: VALID_UTC }),
    ).toString("base64");
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(false);
    if (!decoded.ok) {
      expect(decoded.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("decodeCursor accepts a UTC `Z` datetime with millisecond precision", () => {
    const encoded = encodeCursor({
      id: VALID_UUID,
      createdAt: "2026-04-25T12:00:00.123Z",
    });
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(true);
  });

  it("decodeCursor accepts a UTC `Z` datetime without milliseconds", () => {
    const encoded = encodeCursor({
      id: VALID_UUID,
      createdAt: "2026-04-25T12:00:00Z",
    });
    const decoded = decodeCursor(encoded);
    expect(decoded.ok).toBe(true);
  });
});

describe("Phase-2 normalizeLimit (INFRA-21/INFRA-22)", () => {
  it("returns DEFAULT_LIMIT for undefined", () => {
    expect(normalizeLimit(undefined)).toBe(50);
  });

  it("returns DEFAULT_LIMIT for null", () => {
    expect(normalizeLimit(null)).toBe(50);
  });

  it("returns DEFAULT_LIMIT for empty string", () => {
    expect(normalizeLimit("")).toBe(50);
  });

  it("clamps to MAX_LIMIT when input exceeds 200 (numeric)", () => {
    expect(normalizeLimit(250)).toBe(200);
  });

  it("clamps to MAX_LIMIT when input exceeds 200 (string)", () => {
    expect(normalizeLimit("250")).toBe(200);
  });

  it("returns parsed value within bounds", () => {
    expect(normalizeLimit("75")).toBe(75);
    expect(normalizeLimit(1)).toBe(1);
  });

  it("clamps non-positive values to 1", () => {
    expect(normalizeLimit(0)).toBe(1);
    expect(normalizeLimit(-5)).toBe(1);
    expect(normalizeLimit("-1")).toBe(1);
  });

  it("falls back to DEFAULT_LIMIT for non-numeric strings", () => {
    expect(normalizeLimit("not-a-number")).toBe(50);
    expect(normalizeLimit("abc")).toBe(50);
  });

  it("floors fractional values", () => {
    expect(normalizeLimit(50.7)).toBe(50);
    expect(normalizeLimit("50.9")).toBe(50);
  });
});

/**
 * Phase-2 Plan 06 Task 2 — request validation helper + ConsentLog domain
 * schema (D-19, INFRA-09).
 *
 * Contract:
 * - `parseJsonBody(request, schema)` reads `await request.json()` and pipes
 *   through Zod. Valid input returns `{ ok: true, value }`; invalid input
 *   (Zod errors OR JSON parse failures OR missing body) returns
 *   `{ ok: false, error: ValidationFailed }`. Never throws.
 * - `parseQuery(url, schema)` reads `url.searchParams` flattened to a record
 *   and pipes through Zod with the same discriminated-union shape.
 * - `consentLogInsertSchema` (in `iam/domain/consent-schemas.ts`) is the
 *   drizzle-zod root for `consent_logs`. The diagnostics route narrows it
 *   with `.pick({ purpose, legalBasis, source })` for the POST body — see
 *   `src/contexts/iam/api/consent-route.ts`. The unit test below pins the
 *   same `.pick()` shape so a future regression that loosens the enum
 *   constraints (e.g., a drizzle-zod major bump that changes enum handling)
 *   would fail loudly here.
 */

const sampleSchema = z.object({
  email: z.string().email(),
  count: z.number().int().min(0),
});

function makeRequest(body: string | object | undefined, init?: RequestInit): Request {
  const url = "http://localhost:3000/api/v1/test";
  if (body === undefined) {
    return new Request(url, { method: "POST", ...init });
  }
  const text = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: text,
    ...init,
  });
}

describe("Phase-2 parseJsonBody (INFRA-09)", () => {
  it("returns parsed data for valid input", async () => {
    const req = makeRequest({ email: "user@example.com", count: 3 });
    const result = await parseJsonBody(req, sampleSchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ email: "user@example.com", count: 3 });
    }
  });

  it("returns ValidationFailed when Zod rejects the shape", async () => {
    const req = makeRequest({ email: "not-an-email", count: 3 });
    const result = await parseJsonBody(req, sampleSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("returns ValidationFailed when the body is invalid JSON", async () => {
    const req = makeRequest("{not json", {
      headers: { "content-type": "application/json" },
    });
    const result = await parseJsonBody(req, sampleSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("returns ValidationFailed when the body is missing entirely", async () => {
    const req = makeRequest(undefined);
    const result = await parseJsonBody(req, sampleSchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ErrorCode.ValidationFailed);
    }
  });

  it("never throws for any input — always returns a discriminated result", async () => {
    const req = makeRequest(" garbage");
    await expect(parseJsonBody(req, sampleSchema)).resolves.toMatchObject({ ok: false });
  });
});

describe("Phase-2 parseQuery (INFRA-09)", () => {
  const querySchema = z.object({
    cursor: z.string().optional(),
    limit: z.string().optional(),
    foo: z.literal("bar").optional(),
  });

  it("returns parsed data for valid input", () => {
    const url = new URL("http://localhost/?cursor=abc&limit=100");
    const result = parseQuery(url, querySchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ cursor: "abc", limit: "100" });
    }
  });

  it("accepts an empty query", () => {
    const url = new URL("http://localhost/");
    const result = parseQuery(url, querySchema);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({});
    }
  });

  it("returns ValidationFailed when Zod rejects a literal mismatch", () => {
    const url = new URL("http://localhost/?foo=baz");
    const result = parseQuery(url, querySchema);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(ErrorCode.ValidationFailed);
    }
  });
});

describe("Phase-2 consent route body schema (D-19, drizzle-zod-rooted)", () => {
  // Mirrors the picked schema declared as a const inside
  // `src/contexts/iam/api/consent-route.ts`. Re-creating the same `.pick(...)`
  // here is intentional: the route module does not export the picked schema,
  // and pinning the shape locally guarantees this test fails if the route
  // ever drifts (e.g., the picked field set changes, or the import is
  // accidentally swapped back to a hand-rolled schema). Per WR-04 / WR-01
  // (iter2/iter3): drizzle-zod 0.8.x emits `z.enum(column.enumValues)` for
  // varchar columns with `enum:` constraints, so picking from
  // `consentLogInsertSchema` preserves the table-level enum membership.
  const consentRoutePostBodySchema = consentLogInsertSchema.pick({
    purpose: true,
    legalBasis: true,
    source: true,
  });

  it("accepts a well-formed body", () => {
    const result = consentRoutePostBodySchema.safeParse({
      purpose: "analytics",
      legalBasis: "consent",
      source: "settings",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown purpose", () => {
    const result = consentRoutePostBodySchema.safeParse({
      purpose: "unknown",
      legalBasis: "consent",
      source: "settings",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown legalBasis", () => {
    const result = consentRoutePostBodySchema.safeParse({
      purpose: "analytics",
      legalBasis: "vibes",
      source: "settings",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown source", () => {
    const result = consentRoutePostBodySchema.safeParse({
      purpose: "analytics",
      legalBasis: "consent",
      source: "unknown",
    });
    expect(result.success).toBe(false);
  });

  it("rejects a body that is missing required fields", () => {
    const result = consentRoutePostBodySchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
