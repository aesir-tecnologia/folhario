/**
 * CONTEXT D-01 / PRD §6 — IdentificationProvider interface contract.
 *
 * Provider implementations are stateless; budget, breaker, and cap state
 * lives in the DB. All three concrete providers (PlantIdProvider,
 * OpenAICompatProvider, StubProvider) conform to this exact shape.
 */

export interface IdentificationResult {
  speciesName: string;
  scientificName: string;
  confidence: number;
  providerSpeciesId: string;
}

export interface IdentificationProviderResult {
  results: IdentificationResult[];
  provider: string;
  model: string;
  latencyMs: number;
}

export interface IdentificationProvider {
  readonly name: string;
  readonly model: string;
  identify(input: {
    photos: ReadonlyArray<{ buffer: Buffer; contentType: string }>;
    userId: string;
    signal: AbortSignal;
  }): Promise<IdentificationProviderResult>;
}

export class InvalidProviderResponseError extends Error {
  constructor(public readonly reason: string) {
    super(`InvalidProviderResponse: ${reason}`);
    this.name = "InvalidProviderResponseError";
  }
}
