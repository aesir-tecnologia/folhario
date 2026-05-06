import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Task 3 RED — Provider factory unit tests (IDENT-19).
 *
 * Tests:
 *  1  IDENTIFICATION_PROVIDER_MODE=stub → returns [stubProvider] (length 1)
 *  2  IDENTIFICATION_PROVIDER_MODE=real + both keys → returns [plantId, openAICompat] in order
 *  3  mode=real + missing PLANT_ID_API_KEY → throws with message naming missing key
 *  4  mode=real + missing OPENAI_API_KEY → throws with message naming missing key
 *  5  calling getIdentificationProviders() twice → same array reference (cached singleton)
 */

const baseServerEnv = {
  DATABASE_URL: "postgres://u:p@localhost:5432/db",
  DATABASE_POOL_URL: "postgres://u:p@localhost:5432/db",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  RESEND_FROM_ADDRESS: "onboarding@resend.dev",
  OPENAI_BASE_URL: "https://api.openai.com",
  OPENAI_MODEL: "gpt-4o-2024-08-06",
};

describe("getIdentificationProviders factory", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test 1: stub mode → returns array of length 1 containing stubProvider", async () => {
    vi.doMock("@shared/config/server-env", () => ({
      serverEnv: { ...baseServerEnv, IDENTIFICATION_PROVIDER_MODE: "stub" },
    }));

    const { getIdentificationProviders } =
      await import("@contexts/identification/infrastructure/providers");
    const providers = getIdentificationProviders();
    expect(providers).toHaveLength(1);
    expect(providers[0]!.name).toBe("stub");
  });

  it("Test 2: real mode + both keys → [plant_id, openai_compat] in that order", async () => {
    vi.doMock("@shared/config/server-env", () => ({
      serverEnv: {
        ...baseServerEnv,
        IDENTIFICATION_PROVIDER_MODE: "real",
        PLANT_ID_API_KEY: "plant-key",
        OPENAI_API_KEY: "openai-key",
      },
    }));

    const { getIdentificationProviders } =
      await import("@contexts/identification/infrastructure/providers");
    const providers = getIdentificationProviders();
    expect(providers).toHaveLength(2);
    expect(providers[0]!.name).toBe("plant_id");
    expect(providers[1]!.name).toBe("openai_compat");
  });

  it("Test 3: real mode + missing PLANT_ID_API_KEY → throws naming the missing key", async () => {
    vi.doMock("@shared/config/server-env", () => ({
      serverEnv: {
        ...baseServerEnv,
        IDENTIFICATION_PROVIDER_MODE: "real",
        PLANT_ID_API_KEY: undefined,
        OPENAI_API_KEY: "openai-key",
      },
    }));

    const { getIdentificationProviders } =
      await import("@contexts/identification/infrastructure/providers");
    expect(() => getIdentificationProviders()).toThrow("PLANT_ID_API_KEY is required");
  });

  it("Test 4: real mode + missing OPENAI_API_KEY → throws naming the missing key", async () => {
    vi.doMock("@shared/config/server-env", () => ({
      serverEnv: {
        ...baseServerEnv,
        IDENTIFICATION_PROVIDER_MODE: "real",
        PLANT_ID_API_KEY: "plant-key",
        OPENAI_API_KEY: undefined,
      },
    }));

    const { getIdentificationProviders } =
      await import("@contexts/identification/infrastructure/providers");
    expect(() => getIdentificationProviders()).toThrow("OPENAI_API_KEY is required");
  });

  it("Test 5: calling getIdentificationProviders() twice returns same array reference", async () => {
    vi.doMock("@shared/config/server-env", () => ({
      serverEnv: { ...baseServerEnv, IDENTIFICATION_PROVIDER_MODE: "stub" },
    }));

    const { getIdentificationProviders, __resetProviderCacheForTests } =
      await import("@contexts/identification/infrastructure/providers");

    __resetProviderCacheForTests();
    const first = getIdentificationProviders();
    const second = getIdentificationProviders();
    expect(first).toBe(second);
  });
});
