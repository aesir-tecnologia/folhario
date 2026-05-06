import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Task 2 RED — StubProvider unit tests.
 *
 * Tests:
 *  1  returns 3 hardcoded results: Monstera deliciosa @ 0.85,
 *     Epipremnum aureum @ 0.62, Sansevieria trifasciata @ 0.35
 *  2  name === "stub", model === "stub-v1"
 *  3  latencyMs >= 800 (simulated delay)
 *  4  honors AbortSignal — aborted before resolution throws DOMException AbortError
 */

describe("stubProvider", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("Test 1: returns 3 hardcoded results with correct confidences and species", async () => {
    vi.useFakeTimers();
    const { stubProvider } =
      await import("@contexts/identification/infrastructure/providers/stub-provider");

    const identifyPromise = stubProvider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    await vi.advanceTimersByTimeAsync(800);
    const result = await identifyPromise;

    expect(result.results).toHaveLength(3);
    expect(result.results[0]!.scientificName).toBe("Monstera deliciosa");
    expect(result.results[0]!.confidence).toBe(0.85);
    expect(result.results[1]!.scientificName).toBe("Epipremnum aureum");
    expect(result.results[1]!.confidence).toBe(0.62);
    expect(result.results[2]!.scientificName).toBe("Sansevieria trifasciata");
    expect(result.results[2]!.confidence).toBe(0.35);
  });

  it("Test 2: name === 'stub', model === 'stub-v1'", async () => {
    const { stubProvider } =
      await import("@contexts/identification/infrastructure/providers/stub-provider");
    expect(stubProvider.name).toBe("stub");
    expect(stubProvider.model).toBe("stub-v1");
  });

  it("Test 3: latencyMs >= 800 after simulated delay", async () => {
    vi.useFakeTimers();
    const { stubProvider } =
      await import("@contexts/identification/infrastructure/providers/stub-provider");

    const identifyPromise = stubProvider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: AbortSignal.timeout(5000),
    });

    await vi.advanceTimersByTimeAsync(800);
    const result = await identifyPromise;

    expect(result.latencyMs).toBeGreaterThanOrEqual(800);
  });

  it("Test 4: aborted signal before resolution → throws DOMException AbortError", async () => {
    vi.useFakeTimers();
    const { stubProvider } =
      await import("@contexts/identification/infrastructure/providers/stub-provider");

    const controller = new AbortController();
    const identifyPromise = stubProvider.identify({
      photos: [{ buffer: Buffer.from("img"), contentType: "image/jpeg" }],
      userId: "user-123",
      signal: controller.signal,
    });

    controller.abort();
    await vi.advanceTimersByTimeAsync(800);

    await expect(identifyPromise).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
