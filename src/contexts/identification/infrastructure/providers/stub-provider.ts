import type { IdentificationProvider } from "@contexts/identification/domain/provider";

// CONTEXT D-02 / specifics line 226 — deterministic 3-result fixture for CI/preview e2e tests.
// Common names in pt-BR; scientific names used as providerSpeciesId.
const STUB_RESULTS = [
  {
    speciesName: "Costela-de-adão",
    scientificName: "Monstera deliciosa",
    confidence: 0.85,
    providerSpeciesId: "Monstera deliciosa",
  },
  {
    speciesName: "Jiboia",
    scientificName: "Epipremnum aureum",
    confidence: 0.62,
    providerSpeciesId: "Epipremnum aureum",
  },
  {
    speciesName: "Espada-de-são-jorge",
    scientificName: "Sansevieria trifasciata",
    confidence: 0.35,
    providerSpeciesId: "Sansevieria trifasciata",
  },
] as const;

export const stubProvider: IdentificationProvider = {
  name: "stub",
  model: "stub-v1",
  async identify({ signal }) {
    const start = Date.now();
    if (signal.aborted) {
      throw new DOMException("aborted", "AbortError");
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, 800);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          reject(new DOMException("aborted", "AbortError"));
        },
        { once: true },
      );
    });
    return {
      results: STUB_RESULTS.map((r) => ({ ...r })),
      provider: "stub",
      model: "stub-v1",
      latencyMs: Date.now() - start,
    };
  },
};
