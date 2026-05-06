import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Task 2 RED — OpenAICompatProvider unit tests.
 *
 * Tests:
 *  1  fetch called with POST, Authorization Bearer header, Content-Type,
 *     response_format json_schema strict mode
 *  2  success → choices[0].message.content parsed → up to 3 results
 *  3  content is not a string → throws InvalidProviderResponseError
 *  4  content JSON fails Zod schema → throws InvalidProviderResponseError (IDENT-15)
 */

const openAiSuccessFixture = {
  choices: [
    {
      message: {
        content: JSON.stringify({
          results: [
            {
              speciesName: "Costela-de-adão",
              scientificName: "Monstera deliciosa",
              confidence: 0.74,
            },
            {
              speciesName: "Jiboia",
              scientificName: "Epipremnum aureum",
              confidence: 0.55,
            },
          ],
        }),
      },
    },
  ],
};

describe("createOpenAICompatProvider", () => {
  let createOpenAICompatProvider: typeof import("@contexts/identification/infrastructure/providers/openai-compat-provider").createOpenAICompatProvider;
  let InvalidProviderResponseError: typeof import("@contexts/identification/domain/provider").InvalidProviderResponseError;
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    mockFetch = vi.fn();
    vi.spyOn(global, "fetch").mockImplementation(mockFetch);
    ({ createOpenAICompatProvider } =
      await import("@contexts/identification/infrastructure/providers/openai-compat-provider"));
    ({ InvalidProviderResponseError } = await import("@contexts/identification/domain/provider"));
  });

  it("Test 1: fetch POST with Bearer auth, Content-Type, response_format json_schema strict", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(openAiSuccessFixture), { status: 200 }),
    );

    const provider = createOpenAICompatProvider({
      baseUrl: "https://api.openai.com",
      apiKey: "test-key",
      model: "gpt-4o-2024-08-06",
    });

    await provider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    expect(mockFetch).toHaveBeenCalledOnce();
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("chat/completions");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer test-key");
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe("application/json");
    const body = JSON.parse(init.body as string) as {
      response_format: { type: string; json_schema: { strict: boolean } };
    };
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
  });

  it("Test 2: success → content parsed as JSON, up to 3 results mapped", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify(openAiSuccessFixture), { status: 200 }),
    );

    const provider = createOpenAICompatProvider({
      baseUrl: "https://api.openai.com",
      apiKey: "test-key",
      model: "gpt-4o-2024-08-06",
    });

    const result = await provider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    expect(result.provider).toBe("openai_compat");
    expect(result.model).toBe("gpt-4o-2024-08-06");
    expect(result.results).toHaveLength(2);
    expect(result.results[0].confidence).toBe(0.74);
    expect(result.results[0].scientificName).toBe("Monstera deliciosa");
  });

  it("Test 3: content is not a string → throws InvalidProviderResponseError", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ choices: [{ message: { content: null } }] }), { status: 200 }),
    );

    const provider = createOpenAICompatProvider({
      baseUrl: "https://api.openai.com",
      apiKey: "test-key",
      model: "gpt-4o-2024-08-06",
    });

    await expect(
      provider.identify({
        photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
        userId: "user-123",
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toBeInstanceOf(InvalidProviderResponseError);
  });

  it("Test 4: content JSON fails Zod schema → throws InvalidProviderResponseError (IDENT-15)", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: JSON.stringify({ wrong_field: true }) } }],
        }),
        { status: 200 },
      ),
    );

    const provider = createOpenAICompatProvider({
      baseUrl: "https://api.openai.com",
      apiKey: "test-key",
      model: "gpt-4o-2024-08-06",
    });

    await expect(
      provider.identify({
        photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
        userId: "user-123",
        signal: AbortSignal.timeout(5000),
      }),
    ).rejects.toBeInstanceOf(InvalidProviderResponseError);
  });
});
