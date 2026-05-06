import { describe, it, expect } from "vitest";
import {
  toIdentificationSnakeCase,
  toIdentificationHistoryItemSnakeCase,
} from "@contexts/identification/api/snake-case";

const baseRow = {
  id: "id-001",
  userId: "user-001",
  plantId: "plant-001",
  photoUrls: ["https://example.com/photo1.jpg", "https://example.com/photo2.jpg"],
  provider: "plant_id",
  model: "plant-id-v3",
  results: [
    {
      speciesName: "Monstera deliciosa",
      scientificName: "Monstera deliciosa",
      confidence: 0.85,
      providerSpeciesId: "sp-001",
    },
    {
      speciesName: "Pothos",
      scientificName: "Epipremnum aureum",
      confidence: 0.62,
      providerSpeciesId: "sp-002",
    },
  ],
  selectedResult: {
    speciesName: "Monstera deliciosa",
    scientificName: "Monstera deliciosa",
    confidence: 0.85,
    providerSpeciesId: "sp-001",
  },
  manualCorrection: null,
  latencyMs: 1234,
  consentVersion: "2026-01-01",
  status: "success" as const,
  failureReason: null,
  createdAt: "2026-05-06T10:00:00.000Z",
};

describe("toIdentificationSnakeCase", () => {
  it("round-trips all camelCase fields to snake_case", () => {
    const result = toIdentificationSnakeCase(baseRow);

    expect(result.id).toBe(baseRow.id);
    expect(result.user_id).toBe(baseRow.userId);
    expect(result.plant_id).toBe(baseRow.plantId);
    expect(result.photo_urls).toEqual(baseRow.photoUrls);
    expect(result.provider).toBe(baseRow.provider);
    expect(result.model).toBe(baseRow.model);
    expect(result.results).toEqual(baseRow.results);
    expect(result.selected_result).toEqual(baseRow.selectedResult);
    expect(result.manual_correction).toBeNull();
    expect(result.latency_ms).toBe(baseRow.latencyMs);
    expect(result.consent_version).toBe(baseRow.consentVersion);
    expect(result.status).toBe(baseRow.status);
    expect(result.failure_reason).toBeNull();
    expect(result.created_at).toBe(baseRow.createdAt);
  });

  it("serializes nullable fields correctly when source is null/undefined", () => {
    const nullRow = {
      ...baseRow,
      plantId: null,
      selectedResult: null,
      manualCorrection: null,
      failureReason: null,
    };
    const result = toIdentificationSnakeCase(nullRow);

    expect(result.plant_id).toBeNull();
    expect(result.selected_result).toBeNull();
    expect(result.manual_correction).toBeNull();
    expect(result.failure_reason).toBeNull();
  });

  it("empty results array round-trips (zero-results case)", () => {
    const emptyResultsRow = {
      ...baseRow,
      results: [],
      selectedResult: null,
      status: "failed" as const,
      failureReason: "timeout" as const,
    };
    const result = toIdentificationSnakeCase(emptyResultsRow);

    expect(result.results).toEqual([]);
    expect(result.selected_result).toBeNull();
    expect(result.status).toBe("failed");
    expect(result.failure_reason).toBe("timeout");
  });
});

describe("toIdentificationHistoryItemSnakeCase", () => {
  it("preserves all base fields and adds thumbnail_signed_url and plant_name", () => {
    const signedUrl = "https://signed.example.com/thumb.jpg";
    const plantName = "Minha Monstera";
    const result = toIdentificationHistoryItemSnakeCase(baseRow, signedUrl, plantName);

    expect(result.id).toBe(baseRow.id);
    expect(result.user_id).toBe(baseRow.userId);
    expect(result.photo_urls).toEqual(baseRow.photoUrls);
    expect(result.thumbnail_signed_url).toBe(signedUrl);
    expect(result.plant_name).toBe(plantName);
  });

  it("accepts null for both thumbnail_signed_url and plant_name", () => {
    const result = toIdentificationHistoryItemSnakeCase(baseRow, null, null);

    expect(result.thumbnail_signed_url).toBeNull();
    expect(result.plant_name).toBeNull();
  });
});
