import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Phase 4 D-06 / D-09 (RESEARCH.md Pattern 7).
 *
 * Single source of policy: raw tokens exist only in URLs (verification +
 * password-reset emails); only the sha256 hex digest goes to the DB. The
 * {@link verifyToken} comparator uses `crypto.timingSafeEqual` against equal-
 * length hex buffers (T-04-03-01 — no timing side channel).
 */

export function mintToken(): { raw: string; hash: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function verifyToken(raw: string, hash: string): boolean {
  const candidateHash = createHash("sha256").update(raw).digest("hex");
  const a = Buffer.from(candidateHash, "hex");
  const b = Buffer.from(hash, "hex");
  if (a.length !== b.length || a.length === 0) return false;
  return timingSafeEqual(a, b);
}
