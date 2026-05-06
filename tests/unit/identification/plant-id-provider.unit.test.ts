import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Task 2 RED — PlantIdProvider unit tests.
 *
 * Tests:
 *  1  fetch called with POST, Api-Key header, Content-Type, base64 body
 *  2  success response → IdentificationProviderResult with up to 3 results
 *  3  non-2xx HTTP → throws InvalidProviderResponseError
 *  4  response JSON fails Zod schema → throws InvalidProviderResponseError (IDENT-15)
 *  5  AbortSignal.aborted → fetch rejects with DOMException AbortError
 *  6  latencyMs >= 0 (computed as Date.now() - start)
 */

const plantIdSuccessFixture = {
  result: {
    classification: {
      suggestions: [
        {
          name: "Monstera deliciosa",
          probability: 0.91,
          details: { common_names: ["Costela-de-adão"] },
        },
        {
          name: "Epipremnum aureum",
          probability: 0.62,
          details: { common_names: ["Jiboia"] },
        },
        {
          name: "Sansevieria trifasciata",
          probability: 0.35,
          details: { common_names: [] },
        },
        {
          name: "Ficus lyrata",
          probability: 0.12,
          details: { common_names: ["Figueira-de-folha-de-violino"] },
        },
      ],
    },
  },
};

describe("createPlantIdProvider", () => {
  let createPlantIdProvider: typeof import("@contexts/identification/infrastructure/providers/plant-id-provider").createPlantIdProvider;
  let InvalidProviderResponseError: typeof import("@contexts/identification/domain/provider").InvalidProviderResponseError;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockFetch = vi.fn();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);
    ({ createPlantIdProvider } =
      await import("@contexts/identification/infrastructure/providers/plant-id-provider"));
    ({ InvalidProviderResponseError } = await import("@contexts/identification/domain/provider"));
  });

  it("Test 1: calls fetch with POST, Api-Key header, Content-Type, base64 body", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(plantIdSuccessFixture), { status: 200 }),
    );

    const provider = createPlantIdProvider("test-key");
    const photoBuffer = Buffer.from("fake-image-data");
    await provider.identify({
      photos: [{ buffer: photoBuffer, contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("api.plant.id/v3/identification");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Api-Key"]).toBe("test-key");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string) as { images: string[] };
    expect(body.images).toHaveLength(1);
    expect(body.images[0]).toBe(photoBuffer.toString("base64"));
  });

  it("Test 2: success response → up to 3 results; speciesName falls back to name when common_names empty", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(plantIdSuccessFixture), { status: 200 }),
    );

    const provider = createPlantIdProvider("test-key");
    const result = await provider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    expect(result.provider).toBe("plant_id");
    expect(result.results).toHaveLength(3);
    expect(result.results[0].confidence).toBe(0.91);
    expect(result.results[0].speciesName).toBe("Costela-de-adão");
    expect(result.results[0].scientificName).toBe("Monstera deliciosa");
    expect(result.results[2].speciesName).toBe("Sansevieria trifasciata");
  });

  it("Test 3: non-2xx HTTP → throws InvalidProviderResponseError", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Internal error", { status: 500 }));

    const provider = createPlantIdProvider("test-key");
    await expect(
      provider.identify({
        photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
        userId: "user-123",
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toBeInstanceOf(InvalidProviderResponseError);
  });

  it("Test 4: response JSON missing classification → throws InvalidProviderResponseError (IDENT-15)", async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ result: {} }), { status: 200 }));

    const provider = createPlantIdProvider("test-key");
    await expect(
      provider.identify({
        photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
        userId: "user-123",
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toBeInstanceOf(InvalidProviderResponseError);
  });

  it("Test 5: aborted signal → provider does not swallow DOMException AbortError", async () => {
    const abortError = new DOMException("aborted", "AbortError");
    mockFetch.mockRejectedValueOnce(abortError);

    const controller = new AbortController();
    controller.abort();

    const provider = createPlantIdProvider("test-key");
    await expect(
      provider.identify({
        photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
        userId: "user-123",
        signal: controller.signal,
      }),
    ).rejects.toThrow(abortError);
  });

  it("Test 6: latencyMs >= 0", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(plantIdSuccessFixture), { status: 200 }),
    );

    const provider = createPlantIdProvider("test-key");
    const result = await provider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
