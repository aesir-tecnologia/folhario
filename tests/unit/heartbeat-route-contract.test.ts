import { describe, it, expect } from "vitest";

describe("UI-24 /api/v1/health/connectivity contract — public, side-effect-free GET", () => {
  it("GET responds 200", async () => {
    const mod = await import("../../src/app/api/v1/health/connectivity/route");
    const res = await mod.GET();
    expect(res.status).toBe(200);
  });

  it("body shape is { ok: true, timestamp: <ISO string> }", async () => {
    const mod = await import("../../src/app/api/v1/health/connectivity/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(typeof body.timestamp).toBe("string");
    expect(() => new Date(body.timestamp)).not.toThrow();
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false);
  });

  it("body has NO `env` field (T-03-02-02 info-disclosure guard)", async () => {
    const mod = await import("../../src/app/api/v1/health/connectivity/route");
    const res = await mod.GET();
    const body = await res.json();
    expect(body.env).toBeUndefined();
    // Body shape is exactly { ok, timestamp } — no extra keys.
    expect(Object.keys(body).sort()).toEqual(["ok", "timestamp"]);
  });

  it("Cache-Control: no-store header set", async () => {
    const mod = await import("../../src/app/api/v1/health/connectivity/route");
    const res = await mod.GET();
    expect(res.headers.get("cache-control")).toBe("no-store");
  });

  it("module exports ONLY GET — no POST/PUT/DELETE/PATCH", async () => {
    const mod: Record<string, unknown> = await import(
      "../../src/app/api/v1/health/connectivity/route"
    );
    expect(typeof mod.GET).toBe("function");
    expect(mod.POST).toBeUndefined();
    expect(mod.PUT).toBeUndefined();
    expect(mod.DELETE).toBeUndefined();
    expect(mod.PATCH).toBeUndefined();
  });
});
