import { describe, it, expect } from "vitest";
import {
  computeWindowStart,
  isLocked,
  extractClientIp,
} from "@contexts/iam/infrastructure/db/auth-throttle";

/**
 * Phase 4 D-12-D-15 + Codex HIGH #5: pure decision-helper coverage.
 * Live-DB UPSERT-RETURNING + locked_until persistence ships in
 * `tests/integration/iam-throttle.integration.test.ts`.
 */

describe("computeWindowStart", () => {
  it("buckets per minute (floor of nowMs / 60000)", () => {
    expect(computeWindowStart(0)).toBe(0);
    expect(computeWindowStart(59_999)).toBe(0);
    expect(computeWindowStart(60_000)).toBe(1);
    expect(computeWindowStart(120_001)).toBe(2);
  });
});

describe("isLocked", () => {
  it("returns false for count ≤ 5 (D-14: 5 attempts/minute is the trip threshold, not the limit)", () => {
    expect(isLocked(0)).toBe(false);
    expect(isLocked(1)).toBe(false);
    expect(isLocked(5)).toBe(false);
  });

  it("returns true for count > 5", () => {
    expect(isLocked(6)).toBe(true);
    expect(isLocked(100)).toBe(true);
  });
});

describe("extractClientIp", () => {
  it("returns the first hop of x-forwarded-for", () => {
    const req = new Request("http://test.local", {
      headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1, 127.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("203.0.113.7");
  });

  it("trims whitespace from the first hop", () => {
    const req = new Request("http://test.local", {
      headers: { "x-forwarded-for": "  198.51.100.42  , 10.0.0.1" },
    });
    expect(extractClientIp(req)).toBe("198.51.100.42");
  });

  it("defaults to 127.0.0.1 when the header is missing", () => {
    const req = new Request("http://test.local");
    expect(extractClientIp(req)).toBe("127.0.0.1");
  });

  it("defaults to 127.0.0.1 when the header is empty", () => {
    const req = new Request("http://test.local", {
      headers: { "x-forwarded-for": "" },
    });
    expect(extractClientIp(req)).toBe("127.0.0.1");
  });
});
