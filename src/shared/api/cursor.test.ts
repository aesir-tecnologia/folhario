import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { ErrorCode } from "@shared/config/errors";
import { decodeCursor, decodeSortCursor, encodeCursor, encodeSortCursor } from "@shared/api/cursor";

describe("Phase-2 cursor codec (unchanged — regression guard)", () => {
  it("round-trips a valid {id, createdAt} payload", () => {
    const payload = {
      id: "00000000-0000-4000-8000-000000000001",
      createdAt: "2026-04-29T12:34:56Z",
    };
    const result = decodeCursor(encodeCursor(payload));
    expect(result).toEqual({ ok: true, value: payload });
  });
});

describe("Phase-5 sort cursor codec", () => {
  it("RED 1 — round-trip: encodes and decodes {sort_id, last_value, last_id}", () => {
    const payload = {
      sort_id: "date_new" as const,
      last_value: "2026-04-29T12:34:56Z",
      last_id: "00000000-0000-4000-8000-000000000001",
    };
    const result = decodeSortCursor(encodeSortCursor(payload));
    expect(result).toEqual({ ok: true, value: payload });
  });

  it("RED 1a — accepts all 5 sort_id values (name_asc, name_desc, date_new, date_old, location)", () => {
    const sortIds = ["name_asc", "name_desc", "date_new", "date_old", "location"] as const;
    for (const sort_id of sortIds) {
      const payload = {
        sort_id,
        last_value: "test-value",
        last_id: "00000000-0000-4000-8000-000000000001",
      };
      const result = decodeSortCursor(encodeSortCursor(payload));
      expect(result).toEqual({ ok: true, value: payload });
    }
  });

  it("RED 2 — NULLS LAST sentinel round-trip: last_value=null preserved through encode/decode", () => {
    const payload = {
      sort_id: "date_new" as const,
      last_value: null,
      last_id: "00000000-0000-4000-8000-000000000002",
    };
    const result = decodeSortCursor(encodeSortCursor(payload));
    expect(result).toEqual({
      ok: true,
      value: {
        sort_id: "date_new",
        last_value: null,
        last_id: "00000000-0000-4000-8000-000000000002",
      },
    });
  });

  it("RED 3 — base64url URL-safety: encoded output contains only [A-Za-z0-9_-] chars", () => {
    for (let i = 0; i < 50; i++) {
      const payload = {
        sort_id: "date_new" as const,
        last_value: i % 3 === 0 ? null : `value-${randomUUID()}-${"+/=".repeat(i % 5)}`,
        last_id: randomUUID() as string,
      };
      const encoded = encodeSortCursor(payload);
      expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("RED 4 — invalid sort_id rejected: returns ValidationFailed", () => {
    const payload = {
      sort_id: "evil_sort",
      last_value: null,
      last_id: "00000000-0000-4000-8000-000000000001",
    };
    const encoded = encodeSortCursor(payload as Parameters<typeof encodeSortCursor>[0]);
    const result = decodeSortCursor(encoded);
    expect(result).toEqual({ ok: false, error: ErrorCode.ValidationFailed });
  });

  it("RED 5 — malformed input rejection (no throw): not-base64 input", () => {
    expect(() => decodeSortCursor("not-base64-!!!")).not.toThrow();
    const result = decodeSortCursor("not-base64-!!!");
    expect(result).toEqual({ ok: false, error: ErrorCode.ValidationFailed });
  });

  it("RED 5a — malformed input: valid base64url but not JSON", () => {
    const notJson = Buffer.from("not json", "utf8").toString("base64url");
    expect(() => decodeSortCursor(notJson)).not.toThrow();
    const result = decodeSortCursor(notJson);
    expect(result).toEqual({ ok: false, error: ErrorCode.ValidationFailed });
  });

  it("RED 5b — malformed input: valid JSON but wrong shape", () => {
    const wrongShape = Buffer.from(JSON.stringify({ wrong: "shape" }), "utf8").toString(
      "base64url",
    );
    expect(() => decodeSortCursor(wrongShape)).not.toThrow();
    const result = decodeSortCursor(wrongShape);
    expect(result).toEqual({ ok: false, error: ErrorCode.ValidationFailed });
  });

  it("RED 6 — non-UUID last_id rejected: returns ValidationFailed", () => {
    const encoded = Buffer.from(
      JSON.stringify({ sort_id: "date_new", last_value: null, last_id: "not-a-uuid" }),
      "utf8",
    ).toString("base64url");
    const result = decodeSortCursor(encoded);
    expect(result).toEqual({ ok: false, error: ErrorCode.ValidationFailed });
  });

  it("RED 7 — last_value type contract: number is rejected", () => {
    const encoded = Buffer.from(
      JSON.stringify({
        sort_id: "date_new",
        last_value: 123,
        last_id: "00000000-0000-4000-8000-000000000001",
      }),
      "utf8",
    ).toString("base64url");
    const result = decodeSortCursor(encoded);
    expect(result).toEqual({ ok: false, error: ErrorCode.ValidationFailed });
  });

  it("RED 8 — Phase-2 and Phase-5 exports coexist without name clash", () => {
    const phase2Payload = {
      id: "00000000-0000-4000-8000-000000000001",
      createdAt: "2026-04-29T12:34:56Z",
    };
    const phase5Payload = {
      sort_id: "name_asc" as const,
      last_value: "planta test",
      last_id: "00000000-0000-4000-8000-000000000002",
    };
    const phase2Result = decodeCursor(encodeCursor(phase2Payload));
    const phase5Result = decodeSortCursor(encodeSortCursor(phase5Payload));
    expect(phase2Result).toEqual({ ok: true, value: phase2Payload });
    expect(phase5Result).toEqual({ ok: true, value: phase5Payload });
  });
});
