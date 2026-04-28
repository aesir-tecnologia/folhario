// Phase 4 D-29: mock the Inngest client so tests can assert that an event
// was emitted without spinning up the real Inngest dev runtime.
//
// Usage:
//   import { installInngestMock, inngestSendMock, resetInngestMock } from "@tests/integration/fixtures/mock-inngest";
//   installInngestMock();
//   beforeEach(() => resetInngestMock());

import { vi } from "vitest";

export const inngestSendMock = vi.fn().mockResolvedValue({ ids: ["test-event-id"] });

export function installInngestMock() {
  vi.mock("@shared/inngest/client", () => ({
    inngest: {
      send: inngestSendMock,
    },
  }));
}

export function resetInngestMock() {
  inngestSendMock.mockClear();
}
