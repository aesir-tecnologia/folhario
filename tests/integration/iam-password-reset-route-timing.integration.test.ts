// Phase 4 D-11 + AUTH-11 — POST /api/v1/iam/password/reset-request is constant-time.
//
// Anti-enumeration timing-attack defense verification: the route handler is a
// thin inngest.send wrapper — sub-millisecond, constant-time response. All
// conditional logic (lookup, mint, dispatch) lives async inside the
// iam/password-reset-requested Inngest function and is invisible from the
// response timing.
//
// Mock inngest.send to a no-op so we measure only the route handler itself
// (throttle bump + JSON parse + zod parse + send).

import { describe, it, expect, vi } from "vitest";
import { randomUUID } from "node:crypto";

import { seedUser } from "./fixtures/seed-user";

const dbUrl = process.env.DATABASE_POOL_URL;

vi.mock("@shared/inngest/client", () => ({
  inngest: {
    send: vi.fn(async () => ({ ids: ["test"] })),
  },
}));

describe.skipIf(!dbUrl)(
  "Phase 4 D-11 + AUTH-11 — POST /api/v1/iam/password/reset-request is constant-time (anti-enumeration)",
  () => {
    // No beforeEach truncate — concurrent integration suites share the same
    // auth.users + public.users tables; truncating would race-wipe their
    // seeded users. Per-test isolation: unique IPs (so the throttle bucket
    // is fresh) + unique random uuid emails.
    it("response time spread across 10 invocations (5 existing email, 5 non-existing) is bounded — and route NEVER imports getUserByEmail/mintResetToken", async () => {
      // Seed one verified user — its email is the "existing" probe.
      const existingEmail = `pr-timing-existing-${randomUUID()}@test.local`;
      await seedUser({
        email: existingEmail,
        password: "Sup3rSecret!",
        emailVerifiedAt: new Date().toISOString(),
      });

      const mod = await import(
        "../../src/app/api/v1/iam/password/reset-request/route"
      );
      const times: number[] = [];

      // Warm-up — first invocation pays JIT/import cost.
      await mod.POST(
        new Request("http://localhost:3000/api/v1/iam/password/reset-request", {
          method: "POST",
          body: JSON.stringify({ email: "warmup@example.com" }),
          headers: {
            "content-type": "application/json",
            "x-forwarded-for": "127.0.0.10",
          },
        }),
      );

      for (let i = 0; i < 10; i++) {
        const email = i % 2 === 0 ? existingEmail : `nobody-${i}@example.com`;
        const start = performance.now();
        await mod.POST(
          new Request(
            "http://localhost:3000/api/v1/iam/password/reset-request",
            {
              method: "POST",
              body: JSON.stringify({ email }),
              // Distinct IPs so the throttle bucket doesn't lock us out across the loop.
              headers: {
                "content-type": "application/json",
                "x-forwarded-for": `10.20.${i}.${i}`,
              },
            },
          ),
        );
        times.push(performance.now() - start);
      }

      const spread = Math.max(...times) - Math.min(...times);

      // 5ms is the plan target. The route only does throttle bump (one DB
      // INSERT, constant per IP/endpoint) + JSON parse + zod parse +
      // inngest.send (mocked, sub-µs). DB roundtrip variance can exceed 5ms
      // under CI GC pressure — if this becomes flaky, the durable check
      // immediately below (route module never imports DB lookup symbols)
      // already covers the D-11 invariant deterministically.
      expect(spread).toBeLessThan(5);
    });

    it("durable check — route module's source NEVER imports getUserByEmail or mintResetToken (D-11 invariant by static inspection)", async () => {
      const fs = await import("node:fs/promises");
      const path = await import("node:path");
      const routePath = path.resolve(
        process.cwd(),
        "src/app/api/v1/iam/password/reset-request/route.ts",
      );
      const source = await fs.readFile(routePath, "utf-8");
      // The route is a thin inngest.send wrapper. It MUST NOT import or call:
      expect(source).not.toMatch(/getUserByEmail/);
      expect(source).not.toMatch(/mintResetToken/);
      expect(source).not.toMatch(/consumeResetToken/);
      expect(source).not.toMatch(/requestPasswordReset/);
      // It MUST emit the iam/password-reset-requested event.
      expect(source).toMatch(/iam\/password-reset-requested/);
      // Codex HIGH #8: outer event id includes a minute bucket.
      expect(source).toMatch(/Math\.floor\(Date\.now\(\) \/ 60000\)/);
    });
  },
);
