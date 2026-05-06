import { z } from "zod";

import {
  InvalidProviderResponseError,
  type IdentificationProvider,
} from "@contexts/identification/domain/provider";

// Source: github.com/flowerchecker/Plant-id-API README [CITED]
const PLANT_ID_ENDPOINT = "https://api.plant.id/v3/identification";

const plantIdSuggestionSchema = z.object({
  name: z.string(),
  probability: z.number().min(0).max(1),
  details: z.object({ common_names: z.array(z.string()).optional() }).optional(),
});

const plantIdResponseSchema = z.object({
  result: z.object({
    classification: z.object({ suggestions: z.array(plantIdSuggestionSchema) }),
  }),
});

export function createPlantIdProvider(apiKey: string): IdentificationProvider {
  return {
    name: "plant_id",
    model: "plantnet-v3",
    async identify({ photos, signal }) {
      const start = Date.now();
      const images = photos.map((p) => p.buffer.toString("base64"));

      const response = await fetch(`${PLANT_ID_ENDPOINT}?details=common_names`, {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ images }),
        signal,
      });

      if (!response.ok) {
        throw new InvalidProviderResponseError(`plant_id_http_${response.status}`);
      }

      const json: unknown = await response.json();
      const parsed = plantIdResponseSchema.safeParse(json);
      if (!parsed.success) {
        throw new InvalidProviderResponseError("plant_id_schema_mismatch");
      }

      const suggestions = parsed.data.result.classification.suggestions
        .slice()
        .sort((a, b) => b.probability - a.probability)
        .slice(0, 3);

      return {
        results: suggestions.map((s) => ({
          speciesName: s.details?.common_names?.[0] ?? s.name,
          scientificName: s.name,
          confidence: s.probability,
          providerSpeciesId: s.name,
        })),
        provider: "plant_id",
        model: "plantnet-v3",
        latencyMs: Date.now() - start,
      };
    },
  };
}
