import { describe, it, expect } from "vitest";

import { ErrorCode } from "@shared/config/errors";
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  decodeCursor,
  encodeCursor,
  normalizeLimit,
} from "@shared/api/cursor";

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
    expect(cursor.includes("\"")).toBe(false);
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
