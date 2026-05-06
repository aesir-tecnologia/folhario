import type { IdentificationProvider } from "@contexts/identification/domain/provider";
import { serverEnv } from "@shared/config/server-env";

import { createOpenAICompatProvider } from "./openai-compat-provider";
import { createPlantIdProvider } from "./plant-id-provider";
import { stubProvider } from "./stub-provider";

let cachedProviders: ReadonlyArray<IdentificationProvider> | null = null;

export function getIdentificationProviders(): ReadonlyArray<IdentificationProvider> {
  if (cachedProviders) return cachedProviders;

  if (serverEnv.IDENTIFICATION_PROVIDER_MODE === "stub") {
    cachedProviders = [stubProvider];
    return cachedProviders;
  }

  // mode === "real" — both keys MUST exist (T-06-03-06: fail-loud, not fail-silent)
  if (!serverEnv.PLANT_ID_API_KEY) {
    throw new Error("PLANT_ID_API_KEY is required when IDENTIFICATION_PROVIDER_MODE=real");
  }
  if (!serverEnv.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required when IDENTIFICATION_PROVIDER_MODE=real");
  }

  cachedProviders = [
    createPlantIdProvider(serverEnv.PLANT_ID_API_KEY),
    createOpenAICompatProvider({
      baseUrl: serverEnv.OPENAI_BASE_URL,
      apiKey: serverEnv.OPENAI_API_KEY,
      model: serverEnv.OPENAI_MODEL,
    }),
  ];
  return cachedProviders;
}

/**
 * Test-only — reset the cached singleton between tests.
 * NEVER call from production code.
 */
export function __resetProviderCacheForTests(): void {
  cachedProviders = null;
}
