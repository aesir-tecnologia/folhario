import { and, desc, eq, gt, sql } from "drizzle-orm";

import { db } from "@shared/db/client";
import { authThrottle } from "@contexts/iam/infrastructure/db/schema";

/**
 * Phase 4 D-12-D-15 (RESEARCH.md Pattern 8) + Codex HIGH #5 (5-min lockout).
 *
 * Per-IP atomic counter via `INSERT ... ON CONFLICT (ip, endpoint, window_start)
 * DO UPDATE SET count = count + 1 RETURNING count`. Trip threshold is `> 5`
 * within the 1-minute window per D-14.
 *
 * Codex HIGH #5: when the threshold trips, persist `locked_until = now() +
 * 5 minutes` so the lockout survives the 1-minute window boundary. Subsequent
 * requests — even from a fresh window_start bucket — fail closed via
 * {@link getCurrentLockoutEnd}, which scans by `(ip, endpoint)` regardless
 * of window_start.
 */

const LOCKOUT_TRIP_COUNT = 5; // D-14: count > 5 trips
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // D-14: 5-minute lockout

export function computeWindowStart(nowMs: number): number {
  return Math.floor(nowMs / 60_000);
}

export function isLocked(count: number): boolean {
  return count > LOCKOUT_TRIP_COUNT;
}

export function extractClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (!xff) return "127.0.0.1";
  const first = xff.split(",")[0]?.trim();
  return first && first.length > 0 ? first : "127.0.0.1";
}

/**
 * Returns the latest `locked_until` for `(ip, endpoint)` whose value is in
 * the future, or null when not currently locked. Scans across all
 * window_start buckets (Codex HIGH #5: lockout survives bucket boundaries).
 */
export async function getCurrentLockoutEnd(
  ip: string,
  endpoint: string,
): Promise<Date | null> {
  const rows = await db
    .select({ lockedUntil: authThrottle.lockedUntil })
    .from(authThrottle)
    .where(
      and(
        eq(authThrottle.ip, ip),
        eq(authThrottle.endpoint, endpoint),
        gt(authThrottle.lockedUntil, sql`now()`),
      ),
    )
    .orderBy(desc(authThrottle.lockedUntil))
    .limit(1);
  const value = rows[0]?.lockedUntil;
  return value ? new Date(value) : null;
}

/**
 * UPSERT-RETURNING the per-(ip, endpoint, window_start) bucket. When the
 * resulting count crosses the D-14 trip threshold, also writes
 * `locked_until = now() + 5 minutes` on the same row.
 */
export async function bumpThrottleRow(
  ip: string,
  endpoint: string,
): Promise<{ count: number; lockedUntil: Date | null }> {
  const windowStart = computeWindowStart(Date.now());
  const inserted = await db
    .insert(authThrottle)
    .values({ ip, endpoint, windowStart, count: 1 })
    .onConflictDoUpdate({
      target: [authThrottle.ip, authThrottle.endpoint, authThrottle.windowStart],
      set: { count: sql`${authThrottle.count} + 1` },
    })
    .returning({ count: authThrottle.count, lockedUntil: authThrottle.lockedUntil });
  const row = inserted[0];
  if (!row) {
    throw new Error("bumpThrottleRow: insert returned no row");
  }

  const existingLockout = row.lockedUntil ? new Date(row.lockedUntil) : null;

  if (isLocked(row.count) && !existingLockout) {
    const lockoutEnd = new Date(Date.now() + LOCKOUT_DURATION_MS);
    await db
      .update(authThrottle)
      .set({ lockedUntil: lockoutEnd.toISOString() })
      .where(
        and(
          eq(authThrottle.ip, ip),
          eq(authThrottle.endpoint, endpoint),
          eq(authThrottle.windowStart, windowStart),
        ),
      );
    return { count: row.count, lockedUntil: lockoutEnd };
  }

  return { count: row.count, lockedUntil: existingLockout };
}
