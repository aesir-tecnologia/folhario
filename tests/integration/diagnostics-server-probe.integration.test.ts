import { describe, it, expect, vi, beforeEach } from "vitest";

process.env.IDENTIFICATION_PROVIDER_MODE = "stub";
process.env.DATABASE_URL ??= "postgres://u:p@localhost:5432/db";
process.env.DATABASE_POOL_URL ??= "postgres://u:p@localhost:5432/db";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "test-anon";
process.env.NEXT_PUBLIC_POSTHOG_KEY ??= "ph_test_key";

const captureMock = vi.fn();
const shutdownMock = vi.fn().mockResolvedValue(undefined);
const captureExceptionMock = vi.fn();

vi.mock("posthog-node", () => ({
  PostHog: function MockPostHog() {
    return { capture: captureMock, shutdown: shutdownMock };
  },
}));

vi.mock("@sentry/nextjs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@sentry/nextjs")>().catch(
    () => ({}) as Record<string, unknown>,
  );
  return {
    ...actual,
    withScope: (cb: (scope: { addEventProcessor: (p: unknown) => void }) => void) => {
      cb({ addEventProcessor: () => {} });
    },
    captureException: captureExceptionMock,
  };
});

describe("D-27-a SC-4 server-side automatic proof", () => {
  beforeEach(() => {
    captureMock.mockClear();
    captureExceptionMock.mockClear();
  });

  it("POST /api/v1/diagnostics/ping invokes posthog-node.capture and Sentry.captureException", async () => {
    const mod = await import("../../src/app/api/v1/diagnostics/ping/route");
    const res = await mod.POST(
      new Request("http://localhost:3000/api/v1/diagnostics/ping", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
      }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);

    expect(captureMock).toHaveBeenCalledTimes(1);
    const capArg = captureMock.mock.calls[0]?.[0];
    expect(capArg.event).toBe("$diagnostics_server_ping");
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
  });

  it("POST refuses with NotFound when IDENTIFICATION_PROVIDER_MODE !== stub", async () => {
    const prior = process.env.IDENTIFICATION_PROVIDER_MODE;
    process.env.IDENTIFICATION_PROVIDER_MODE = "real";
    vi.resetModules();
    try {
      const mod = await import("../../src/app/api/v1/diagnostics/ping/route");
      const res = await mod.POST(
        new Request("http://localhost:3000/api/v1/diagnostics/ping", { method: "POST" }),
      );
      expect(res.status).toBe(404);
    } finally {
      process.env.IDENTIFICATION_PROVIDER_MODE = prior;
    }
  });
});
