import { describe, it, expect } from "vitest";
import { serverSchema } from "@shared/config/server-env";

describe("INFRA-16 + INFRA-17 server env validation (D-29 revised, Action 4)", () => {
  const valid = {
    DATABASE_URL: "postgres://u:p@localhost:5432/db",
    DATABASE_POOL_URL: "postgres://u:p@localhost:5432/db",
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "k",
    IDENTIFICATION_PROVIDER_MODE: "stub",
  };

  it("accepts a minimally valid server env", () => {
    expect(() => serverSchema.parse(valid)).not.toThrow();
  });

  it("rejects IDENTIFICATION_PROVIDER_MODE other than stub/real", () => {
    expect(() => serverSchema.parse({ ...valid, IDENTIFICATION_PROVIDER_MODE: "bogus" })).toThrow();
  });

  it("defaults IDENTIFICATION_PROVIDER_MODE to 'stub' when absent", () => {
    const { IDENTIFICATION_PROVIDER_MODE: _ignored, ...rest } = valid;
    const parsed = serverSchema.parse(rest);
    expect(parsed.IDENTIFICATION_PROVIDER_MODE).toBe("stub");
  });

  it("rejects missing DATABASE_URL", () => {
    const { DATABASE_URL: _ignored, ...rest } = valid;
    expect(() => serverSchema.parse(rest)).toThrow();
  });

  it("coerces empty-string SENTRY_AUTH_TOKEN to undefined", () => {
    const parsed = serverSchema.parse({ ...valid, SENTRY_AUTH_TOKEN: "" });
    expect(parsed.SENTRY_AUTH_TOKEN).toBeUndefined();
  });
});
