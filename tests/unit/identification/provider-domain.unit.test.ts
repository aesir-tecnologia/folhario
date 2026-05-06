import { describe, expect, it } from "vitest";

/**
 * Task 1 RED — Domain types + lock constant + extended server-env tests.
 *
 * Test 1: IdentificationProvider interface compiles with locked shape (compile-time only)
 * Test 2: InvalidProviderResponseError extends Error, name="InvalidProviderResponseError", exposes reason
 * Test 3: IDENT_LOCK_NAMESPACE equals literal 6_000_000_06
 * Test 4: server-env Zod schema accepts IDENTIFICATION_PROVIDER_MODE in {"stub","real"}
 * Test 5: server-env Zod schema accepts missing PLANT_ID_API_KEY / OPENAI_API_KEY (MODE=stub)
 */

describe("InvalidProviderResponseError", () => {
  it("Test 2: extends Error, name='InvalidProviderResponseError', exposes reason", async () => {
    const { InvalidProviderResponseError } =
      await import("@contexts/identification/domain/provider");
    const err = new InvalidProviderResponseError("test_reason");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("InvalidProviderResponseError");
    expect(err.reason).toBe("test_reason");
    expect(err.message).toContain("test_reason");
  });
});

describe("IDENT_LOCK_NAMESPACE", () => {
  it("Test 3: equals literal 6_000_000_06", async () => {
    const { IDENT_LOCK_NAMESPACE } = await import("@contexts/identification/domain/locks");
    expect(IDENT_LOCK_NAMESPACE).toBe(6_000_000_06);
  });
});

describe("server-env Zod schema — identification keys", () => {
  it("Test 4: accepts IDENTIFICATION_PROVIDER_MODE 'stub' and 'real', rejects unknown", async () => {
    const { serverSchema } = await import("@shared/config/server-env");

    const baseEnv = {
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      DATABASE_POOL_URL: "postgres://u:p@localhost:5432/db",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
    };

    const stubResult = serverSchema.safeParse({
      ...baseEnv,
      IDENTIFICATION_PROVIDER_MODE: "stub",
    });
    expect(stubResult.success).toBe(true);

    const realResult = serverSchema.safeParse({
      ...baseEnv,
      IDENTIFICATION_PROVIDER_MODE: "real",
    });
    expect(realResult.success).toBe(true);

    const badResult = serverSchema.safeParse({
      ...baseEnv,
      IDENTIFICATION_PROVIDER_MODE: "live",
    });
    expect(badResult.success).toBe(false);
  });

  it("Test 5: missing PLANT_ID_API_KEY / OPENAI_API_KEY does NOT throw when MODE=stub", async () => {
    const { serverSchema } = await import("@shared/config/server-env");

    const result = serverSchema.safeParse({
      DATABASE_URL: "postgres://u:p@localhost:5432/db",
      DATABASE_POOL_URL: "postgres://u:p@localhost:5432/db",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      IDENTIFICATION_PROVIDER_MODE: "stub",
      // PLANT_ID_API_KEY and OPENAI_API_KEY deliberately absent
    });
    expect(result.success).toBe(true);
  });
});
