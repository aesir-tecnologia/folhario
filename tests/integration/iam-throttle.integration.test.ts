// Phase 4 D-12-D-15 + Codex HIGH #5: live-Postgres throttle test asserting
// UPSERT-RETURNING atomicity AND that the 5-minute lockout (locked_until)
// survives across the 1-minute window boundary.

import { describe, it, expect, beforeEach, afterAll } from "vitest";
import postgres from "postgres";

import {
  bumpThrottleRow,
  getCurrentLockoutEnd,
} from "@contexts/iam/infrastructure/db/auth-throttle";
import {
  isCurrentlyLocked,
  withThrottle,
} from "@shared/api/throttle";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

const cleanupSql = dbUrl
  ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 })
  : null;

async function clearAuthThrottle(): Promise<void> {
  if (!cleanupSql) return;
  await cleanupSql`TRUNCATE TABLE public.auth_throttle`;
}

describe.skipIf(!dbUrl)("Phase 4 throttle (D-12..D-15 + Codex HIGH #5)", () => {
  beforeEach(async () => {
    await clearAuthThrottle();
  });

  afterAll(async () => {
    if (cleanupSql) {
      await cleanupSql.end({ timeout: 5 });
    }
  });

  it("first call returns count 1 with no lockout", async () => {
    const result = await bumpThrottleRow("1.2.3.4", "signup");
    expect(result.count).toBe(1);
    expect(result.lockedUntil).toBeNull();
  });

  it("5th call returns count 5 still without lockout (D-14: trip threshold is > 5)", async () => {
    for (let i = 0; i < 4; i++) await bumpThrottleRow("1.2.3.5", "signup");
    const fifth = await bumpThrottleRow("1.2.3.5", "signup");
    expect(fifth.count).toBe(5);
    expect(fifth.lockedUntil).toBeNull();
  });

  it("6th call sets locked_until ~5min from now (Codex HIGH #5 lockout persistence)", async () => {
    for (let i = 0; i < 5; i++) await bumpThrottleRow("1.2.3.6", "signup");
    const sixth = await bumpThrottleRow("1.2.3.6", "signup");
    expect(sixth.count).toBe(6);
    expect(sixth.lockedUntil).toBeInstanceOf(Date);
    const ms = sixth.lockedUntil!.getTime() - Date.now();
    // Allow some skew between Postgres now() and JS Date.now()
    expect(ms).toBeGreaterThan(4 * 60 * 1000);
    expect(ms).toBeLessThan(6 * 60 * 1000);
  });

  it("lockout persists across minute-window boundary (Codex HIGH #5 second clause)", async () => {
    // Trip the lockout
    for (let i = 0; i < 6; i++) await bumpThrottleRow("1.2.3.7", "signup");
    expect(await isCurrentlyLocked("1.2.3.7", "signup")).toBe(true);

    // getCurrentLockoutEnd must return the existing lockout regardless of
    // window_start — this is the Codex HIGH #5 invariant.
    const end = await getCurrentLockoutEnd("1.2.3.7", "signup");
    expect(end).not.toBeNull();
    expect(end!.getTime()).toBeGreaterThan(Date.now());
  });

  it("after lockout expires, isCurrentlyLocked returns false", async () => {
    if (!cleanupSql) return;
    for (let i = 0; i < 6; i++) await bumpThrottleRow("1.2.3.8", "signup");
    // Mock expiry: rewind locked_until into the past
    await cleanupSql`UPDATE public.auth_throttle SET locked_until = now() - interval '1 minute' WHERE ip = '1.2.3.8'`;
    expect(await isCurrentlyLocked("1.2.3.8", "signup")).toBe(false);
  });

  it("two concurrent bumps both increment (UPSERT-RETURNING atomicity)", async () => {
    const [a, b] = await Promise.all([
      bumpThrottleRow("1.2.3.9", "signup"),
      bumpThrottleRow("1.2.3.9", "signup"),
    ]);
    // The two results may report counts in either order, but their max must
    // be 2 — no lost write.
    const counts = [a.count, b.count].sort();
    expect(counts).toEqual([1, 2]);
  });

  it("different (ip, endpoint) pairs are independent", async () => {
    const a = await bumpThrottleRow("1.2.3.10", "signup");
    const b = await bumpThrottleRow("1.2.3.10", "login");
    const c = await bumpThrottleRow("1.2.3.11", "signup");
    expect(a.count).toBe(1);
    expect(b.count).toBe(1);
    expect(c.count).toBe(1);
  });

  it("withThrottle returns 429 when already locked (no inner fn invocation)", async () => {
    for (let i = 0; i < 6; i++) await bumpThrottleRow("1.2.3.12", "signup");
    let invocations = 0;
    const inner = async () => {
      invocations++;
      return new Response("ok", { status: 200 });
    };
    const req = new Request("http://test.local/api/v1/iam/signup", {
      headers: { "x-forwarded-for": "1.2.3.12" },
    });
    const res = await withThrottle(req, "signup", "always", inner);
    expect(res.status).toBe(429);
    expect(invocations).toBe(0);
  });

  it("withThrottle 'always' mode increments BEFORE invoking the handler (D-15 signup)", async () => {
    let invocations = 0;
    const inner = async () => {
      invocations++;
      return new Response("ok", { status: 200 });
    };
    const req = new Request("http://test.local/api/v1/iam/signup", {
      headers: { "x-forwarded-for": "1.2.3.13" },
    });
    const res = await withThrottle(req, "signup", "always", inner);
    expect(res.status).toBe(200);
    expect(invocations).toBe(1);
    if (cleanupSql) {
      const rows = await cleanupSql<{ count: number }[]>`SELECT count FROM public.auth_throttle WHERE ip = '1.2.3.13'`;
      expect(rows[0]?.count).toBe(1);
    }
  });

  it("withThrottle 'on-failure' mode skips counter on 200, increments on 401", async () => {
    const req200 = new Request("http://test.local/api/v1/iam/login", {
      headers: { "x-forwarded-for": "1.2.3.14" },
    });
    await withThrottle(req200, "login", "on-failure", async () => new Response("ok", { status: 200 }));
    if (cleanupSql) {
      const rows1 = await cleanupSql<{ count: number }[]>`SELECT count FROM public.auth_throttle WHERE ip = '1.2.3.14'`;
      expect(rows1.length).toBe(0);
    }

    const req401 = new Request("http://test.local/api/v1/iam/login", {
      headers: { "x-forwarded-for": "1.2.3.14" },
    });
    await withThrottle(req401, "login", "on-failure", async () => new Response("nope", { status: 401 }));
    if (cleanupSql) {
      const rows2 = await cleanupSql<{ count: number }[]>`SELECT count FROM public.auth_throttle WHERE ip = '1.2.3.14'`;
      expect(rows2[0]?.count).toBe(1);
    }
  });

  it("withThrottle 'on-failure' mode counts oauth-callback 302 redirects with error=oauth_failed (Codex HIGH #5 second clause)", async () => {
    const req = new Request("http://test.local/auth/callback", {
      headers: { "x-forwarded-for": "1.2.3.15" },
    });
    const failingRedirect = async () =>
      new Response(null, {
        status: 302,
        headers: { location: "/auth/login?error=oauth_failed" },
      });
    await withThrottle(req, "oauth-callback", "on-failure", failingRedirect);
    if (cleanupSql) {
      const rows = await cleanupSql<{ count: number }[]>`SELECT count FROM public.auth_throttle WHERE ip = '1.2.3.15'`;
      expect(rows[0]?.count).toBe(1);
    }
  });
});
