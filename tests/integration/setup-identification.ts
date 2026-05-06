// TEST-ONLY. This file MUST NOT be imported from `src/`.
// Integration test helpers for Phase 6 identification-flow tests.
//
// Usage contract:
// Call `installProviderFetchMock()` in `beforeEach` and `restore()` in
// `afterEach`. The mock matches by URL substring `/v3/identification`
// (Plant.id) and `/chat/completions` (OpenAI-compat); any other fetch URL
// falls through to the real `fetch` so Supabase and other HTTP calls are
// not intercepted.

import type { Sql } from "postgres";
import { vi } from "vitest";

export interface PlantIdSuggestion {
  name: string;
  common: string;
  probability: number;
}

export interface OpenAIResult {
  speciesName: string;
  scientificName: string;
  confidence: number;
}

export interface ProviderFetchMockHandle {
  restore: () => void;
  plantIdCalls: RequestInit[];
  openaiCalls: RequestInit[];
}

function buildPlantIdSuccessBody(suggestions: PlantIdSuggestion[]): object {
  return {
    result: {
      classification: {
        suggestions: suggestions.map((s) => ({
          name: s.name,
          probability: s.probability,
          details: { common_names: [s.common] },
        })),
      },
    },
  };
}

function buildOpenAISuccessBody(results: OpenAIResult[]): object {
  return {
    choices: [
      {
        message: {
          content: JSON.stringify({ results }),
        },
      },
    ],
  };
}

export function mockPlantIdSuccess(suggestions: PlantIdSuggestion[]): void {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/v3/identification")) {
      return Response.json(buildPlantIdSuccessBody(suggestions), { status: 200 });
    }
    return originalFetch(input, init);
  });
}

export function mockPlantIdFailure(opts: { status: number; body?: string }): void {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/v3/identification")) {
      return new Response(opts.body ?? "", { status: opts.status });
    }
    return originalFetch(input, init);
  });
}

export function mockOpenAISuccess(results: OpenAIResult[]): void {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/chat/completions")) {
      return Response.json(buildOpenAISuccessBody(results), { status: 200 });
    }
    return originalFetch(input, init);
  });
}

export function mockOpenAIFailure(opts: { status: number }): void {
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (url.includes("/chat/completions")) {
      return new Response("", { status: opts.status });
    }
    return originalFetch(input, init);
  });
}

export function mockProviderTimeout(provider: "plant_id" | "openai_compat", delayMs: number): void {
  const urlFragment = provider === "plant_id" ? "/v3/identification" : "/chat/completions";
  vi.spyOn(global, "fetch").mockImplementation(
    (input, init) =>
      new Promise<Response>((resolve, reject) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        if (!url.includes(urlFragment)) {
          resolve(originalFetch(input, init));
          return;
        }
        const signal = init?.signal;
        const timer = setTimeout(() => {
          resolve(Response.json({ error: "timeout" }, { status: 504 }));
        }, delayMs);
        if (signal) {
          const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          };
          if (signal.aborted) {
            clearTimeout(timer);
            reject(new DOMException("aborted", "AbortError"));
          } else {
            signal.addEventListener("abort", onAbort, { once: true });
          }
        }
      }),
  );
}

export async function resetCircuitBreakers(db: Sql): Promise<void> {
  await db`
    UPDATE provider_circuit_breakers
    SET state = 'closed',
        consecutive_failures = 0,
        opened_at = NULL,
        last_failure_at = NULL,
        in_flight_at = NULL
  `;
}

export async function resetLastAlertedAt(db: Sql): Promise<void> {
  await db`UPDATE provider_budgets SET last_alerted_at = NULL`;
}

export async function resetProviderUsageCounters(db: Sql): Promise<void> {
  await db`DELETE FROM provider_usage_counters`;
}

export function installProviderFetchMock(): ProviderFetchMockHandle {
  const plantIdCalls: RequestInit[] = [];
  const openaiCalls: RequestInit[] = [];

  const spy = vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;

    if (url.includes("/v3/identification")) {
      plantIdCalls.push(init ?? {});
      return Response.json(
        buildPlantIdSuccessBody([{ name: "Rosa canina", common: "Dog rose", probability: 0.9 }]),
        { status: 200 },
      );
    }

    if (url.includes("/chat/completions")) {
      openaiCalls.push(init ?? {});
      return Response.json(
        buildOpenAISuccessBody([
          { speciesName: "Dog rose", scientificName: "Rosa canina", confidence: 0.85 },
        ]),
        { status: 200 },
      );
    }

    return originalFetch(input, init);
  });

  return {
    restore: () => spy.mockRestore(),
    plantIdCalls,
    openaiCalls,
  };
}

const originalFetch = global.fetch;
