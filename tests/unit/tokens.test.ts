import { describe, it, expect } from "vitest";
import { mintToken, verifyToken } from "@shared/crypto/tokens";

/**
 * Phase 4 D-06 / D-09: token crypto helpers (RESEARCH.md Pattern 7).
 * Raw tokens exist only in URLs; only sha256 hashes go to the DB.
 */

describe("mintToken", () => {
  it("returns a 64-char hex raw token (256 bits)", () => {
    const { raw } = mintToken();
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
  });

  it("returns a 64-char hex hash (sha256 hex digest)", () => {
    const { hash } = mintToken();
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces unique raw strings across 10 consecutive calls", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      seen.add(mintToken().raw);
    }
    expect(seen.size).toBe(10);
  });
});

describe("verifyToken", () => {
  it("returns true when raw hashes to the supplied hash", () => {
    const { raw, hash } = mintToken();
    expect(verifyToken(raw, hash)).toBe(true);
  });

  it("returns false when raw does not match the hash", () => {
    const { raw } = mintToken();
    const { hash: otherHash } = mintToken();
    expect(verifyToken(raw, otherHash)).toBe(false);
  });

  it("returns false for empty inputs (length-0 buffer fails strict precondition)", () => {
    expect(verifyToken("", "")).toBe(false);
  });

  it("returns false when hash differs by a single character", () => {
    const { raw, hash } = mintToken();
    const tampered = hash.slice(0, -1) + (hash.endsWith("0") ? "1" : "0");
    expect(verifyToken(raw, tampered)).toBe(false);
  });
});
