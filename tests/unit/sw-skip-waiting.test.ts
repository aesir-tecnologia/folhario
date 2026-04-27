import { describe, it, expect, vi, beforeEach } from "vitest";

describe("OFF-10 + T-03-04-01 SW SKIP_WAITING handler — guards event.data.type", () => {
  let skipWaitingMock: ReturnType<typeof vi.fn>;
  let messageHandler: ((e: MessageEvent) => void) | null = null;

  beforeEach(() => {
    skipWaitingMock = vi.fn();
    messageHandler = null;

    // Stub the SW global self with addEventListener that captures the message handler.
    (global as unknown as { self: unknown }).self = {
      skipWaiting: skipWaitingMock,
      addEventListener: (type: string, handler: (e: MessageEvent) => void) => {
        if (type === "message") {
          messageHandler = handler;
        }
      },
      __SW_MANIFEST: [],
    };

    // Stub Serwist module so importing sw.ts doesn't run real serwist init.
    // Use a real constructor function so `new Serwist(...)` works under Vitest.
    vi.doMock("serwist", () => {
      function FakeSerwist() {
        return {
          addEventListeners: vi.fn(),
          registerCapture: vi.fn(),
        };
      }
      function FakeNetworkOnly() {
        return {};
      }
      function FakeNetworkFirst() {
        return {};
      }
      function FakeStaleWhileRevalidate() {
        return {};
      }
      return {
        Serwist: FakeSerwist,
        StaleWhileRevalidate: FakeStaleWhileRevalidate,
        NetworkOnly: FakeNetworkOnly,
        NetworkFirst: FakeNetworkFirst,
      };
    });
    vi.doMock("@serwist/next/worker", () => ({ defaultCache: [] }));

    vi.resetModules();
  });

  it("invokes self.skipWaiting() on { type: 'SKIP_WAITING' }", async () => {
    await import("../../src/app/sw");
    expect(messageHandler).not.toBeNull();
    messageHandler!({ data: { type: "SKIP_WAITING" } } as MessageEvent);
    expect(skipWaitingMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT invoke skipWaiting on { type: 'OTHER' } (T-03-04-01 guard)", async () => {
    await import("../../src/app/sw");
    messageHandler!({ data: { type: "OTHER" } } as MessageEvent);
    expect(skipWaitingMock).not.toHaveBeenCalled();
  });

  it("does NOT throw on { data: undefined }", async () => {
    await import("../../src/app/sw");
    expect(() => messageHandler!({ data: undefined } as unknown as MessageEvent)).not.toThrow();
    expect(skipWaitingMock).not.toHaveBeenCalled();
  });
});
