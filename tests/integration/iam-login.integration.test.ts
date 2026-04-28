// Phase 4 AUTH-05 + D-15 + Codex HIGH #5: live-Postgres integration test for
// the /api/v1/iam/login route. Asserts:
//
// - Invalid credentials → 401 invalid_credentials (closed registry).
// - Successful login does NOT write a row to auth_throttle (D-15: failures only).
// - 6 consecutive failures trip rate_limited 429 with locked_until persisted
//   (D-14 + Codex HIGH #5).
// - A pre-existing locked_until row from a past minute bucket still blocks a
//   would-be successful login (Codex HIGH #5: lockout survives bucket
//   boundaries).
//
// Cookie-bearing flow + refresh-token revocation are covered by the Playwright
// spec at tests/e2e/auth-login-logout.spec.ts (Codex HIGH #6 — vitest cannot
// faithfully exercise the SSR cookie path).

import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import postgres from "postgres";

const dbUrl = process.env.DATABASE_POOL_URL;

if (dbUrl && /supabase\.co/.test(dbUrl)) {
  throw new Error(
    "Refusing to run integration tests against cloud Supabase (supabase.co in DATABASE_POOL_URL).",
  );
}

// vi.hoisted shares the mock fn between the hoisted vi.mock factory and the
// per-test mockResolvedValueOnce calls (Plan 03 pattern, mirrors
// tests/unit/auth-adapter-phase4.test.ts).
const mocks = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
}));

vi.mock("@contexts/iam/infrastructure/auth/auth-adapter", () => ({
  authAdapter: {
    signInWithPassword: mocks.signInWithPassword,
  },
}));

const cleanupSql = dbUrl
  ? postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 })
  : null;

async function clearLoginThrottle(): Promise<void> {
  if (!cleanupSql) return;
  // Narrow truncation: only the throttle table. The full
  // truncateAuthAndIamTables helper cascades to auth.users which requires
  // privileges this test connection doesn't carry (refresh_tokens_id_seq is
  // owned by supabase_auth_admin). The route logic under test mocks the
  // AuthAdapter so no real auth.users state is touched.
  await cleanupSql`TRUNCATE TABLE public.auth_throttle`;
}

describe.skipIf(!dbUrl)("Phase 4 AUTH-05 — login route (throttle + invalid_credentials)", () => {
  beforeEach(async () => {
    mocks.signInWithPassword.mockReset();
    await clearLoginThrottle();
  });

  afterAll(async () => {
    if (cleanupSql) await cleanupSql.end({ timeout: 5 });
  });

  it("invalid credentials return invalid_credentials 401", async () => {
    mocks.signInWithPassword.mockResolvedValueOnce({
      ok: false,
      reason: "invalid_credentials",
    });
    const { POST } = await import("../../src/app/api/v1/iam/login/route");
    const res = await POST(
      new Request("http://localhost:3000/api/v1/iam/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "wrong-password" }),
        headers: { "content-type": "application/json", "x-forwarded-for": "2.2.2.2" },
      }),
    );
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_credentials");
  });

  it("malformed JSON body returns validation_failed 400", async () => {
    const { POST } = await import("../../src/app/api/v1/iam/login/route");
    const res = await POST(
      new Request("http://localhost:3000/api/v1/iam/login", {
        method: "POST",
        body: "not-json",
        headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9" },
      }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("validation_failed");
  });

  it("successful login does NOT consume the failure budget (D-15)", async () => {
    if (!cleanupSql) return;
    mocks.signInWithPassword.mockResolvedValueOnce({ ok: true });
    const { POST } = await import("../../src/app/api/v1/iam/login/route");
    const res = await POST(
      new Request("http://localhost:3000/api/v1/iam/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "Sup3rSecret!" }),
        headers: { "content-type": "application/json", "x-forwarded-for": "4.4.4.4" },
      }),
    );
    expect(res.status).toBe(200);
    const rows = await cleanupSql<{ count: number }[]>`
      SELECT count FROM public.auth_throttle WHERE ip = '4.4.4.4'
    `;
    // D-15: on-failure mode does not write a throttle row when the handler
    // returns 200. No row created on success.
    expect(rows.length).toBe(0);
  });

  it("6 consecutive failures trip rate_limited 429 with locked_until set (D-14 + Codex HIGH #5)", async () => {
    if (!cleanupSql) return;
    mocks.signInWithPassword.mockResolvedValue({
      ok: false,
      reason: "invalid_credentials",
    });
    const { POST } = await import("../../src/app/api/v1/iam/login/route");
    let last: Response = new Response();
    for (let i = 0; i < 6; i++) {
      last = await POST(
        new Request("http://localhost:3000/api/v1/iam/login", {
          method: "POST",
          body: JSON.stringify({ email: "nobody@example.com", password: "any-password" }),
          headers: { "content-type": "application/json", "x-forwarded-for": "5.5.5.5" },
        }),
      );
    }
    expect(last.status).toBe(429);
    const body = await last.json();
    expect(body.error.code).toBe("rate_limited");

    // Codex HIGH #5: lockout is persisted via locked_until.
    const lockoutRows = await cleanupSql<{ locked_until: Date | null }[]>`
      SELECT locked_until FROM public.auth_throttle
      WHERE ip = '5.5.5.5' AND endpoint = 'login' AND locked_until IS NOT NULL
    `;
    expect(lockoutRows.length).toBeGreaterThan(0);
    expect(lockoutRows[0]!.locked_until).toBeInstanceOf(Date);
  });

  it("lockout persists across the 1-min window boundary (Codex HIGH #5)", async () => {
    if (!cleanupSql) return;
    // Seed a lockout in a PAST minute bucket so the (ip, endpoint, window_start)
    // PK doesn't collide with the request's current bucket. The withThrottle
    // wrapper must still see the lockout via getCurrentLockoutEnd which scans
    // by (ip, endpoint) regardless of window_start.
    const pastWindowStart = Math.floor(Date.now() / 60_000) - 5;
    const futureLockout = new Date(Date.now() + 5 * 60 * 1000);
    await cleanupSql`
      INSERT INTO public.auth_throttle (ip, endpoint, window_start, count, locked_until)
      VALUES ('6.6.6.6', 'login', ${pastWindowStart}, 6, ${futureLockout.toISOString()})
    `;

    // Even with a successful credential check, the prior-bucket lockout wins.
    mocks.signInWithPassword.mockResolvedValueOnce({ ok: true });
    const { POST } = await import("../../src/app/api/v1/iam/login/route");
    const res = await POST(
      new Request("http://localhost:3000/api/v1/iam/login", {
        method: "POST",
        body: JSON.stringify({ email: "user@example.com", password: "Sup3rSecret!" }),
        headers: { "content-type": "application/json", "x-forwarded-for": "6.6.6.6" },
      }),
    );
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("rate_limited");
    // The credential check must have been short-circuited (lockout checked first).
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
});
