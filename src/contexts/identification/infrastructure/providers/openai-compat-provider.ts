import { z } from "zod";

import {
  InvalidProviderResponseError,
  type IdentificationProvider,
} from "@contexts/identification/domain/provider";

// Source: Context7 /openai/openai-node "Structured Outputs with Zod" [CITED]
const SYSTEM_PROMPT =
  "Você é um botânico identificando plantas. Retorne até 3 espécies candidatas " +
  "em ordem decrescente de confiança. NUNCA invente nomes — se não souber, " +
  "retorne array vazio. Confiança é sua estimativa subjetiva 0..1; calibre " +
  "conservadoramente — vision LLMs tendem a superconfiar.";

const VisionResponseSchema = z.object({
  results: z
    .array(
      z.object({
        speciesName: z.string(),
        scientificName: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .max(3),
});

// Inline JSON Schema (no zod-to-json-schema dep — RESEARCH §Standard Stack: no new deps)
const VISION_RESPONSE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["speciesName", "scientificName", "confidence"],
        properties: {
          speciesName: { type: "string" },
          scientificName: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
      },
    },
  },
};

export function createOpenAICompatProvider(opts: {
  baseUrl: string;
  apiKey: string;
  model: string;
}): IdentificationProvider {
  return {
    name: "openai_compat",
    model: opts.model,
    async identify({ photos, signal }) {
      const start = Date.now();

      const imageContent = photos.map((p) => ({
        type: "image_url" as const,
        image_url: {
          url: `data:${p.contentType};base64,${p.buffer.toString("base64")}`,
        },
      }));

      const response = await fetch(`${opts.baseUrl}/v1/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${opts.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: opts.model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            {
              role: "user",
              content: [{ type: "text", text: "Identifique:" }, ...imageContent],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "vision_identification",
              strict: true,
              schema: VISION_RESPONSE_JSON_SCHEMA,
            },
          },
        }),
        signal,
      });

      if (!response.ok) {
        throw new InvalidProviderResponseError(`openai_compat_http_${response.status}`);
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: unknown } }>;
      };
      const content = json.choices?.[0]?.message?.content;

      if (typeof content !== "string") {
        throw new InvalidProviderResponseError("openai_compat_empty_content");
      }

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(content) as unknown;
      } catch {
        throw new InvalidProviderResponseError("openai_compat_json_parse_failed");
      }

      const parsed = VisionResponseSchema.safeParse(parsedJson);
      if (!parsed.success) {
        throw new InvalidProviderResponseError("openai_compat_schema_mismatch");
      }

      type VisionResult = z.infer<typeof VisionResponseSchema>["results"][number];
      return {
        results: parsed.data.results.map((r: VisionResult) => ({
          speciesName: r.speciesName,
          scientificName: r.scientificName,
          confidence: r.confidence,
          providerSpeciesId: r.scientificName,
        })),
        provider: "openai_compat",
        model: opts.model,
        latencyMs: Date.now() - start,
      };
    },
  };
}
