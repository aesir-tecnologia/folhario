import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

const fetchMock = vi.fn();
let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.useFakeTimers();
  // Spy must be installed AFTER fake timers replace globalThis.setTimeout, so
  // calls made through the fake-timer setTimeout are observable.
  setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
  fetchMock.mockReset();
  global.fetch = fetchMock as never;
  Object.defineProperty(navigator, "onLine", { writable: true, value: true });
});

afterEach(() => {
  setTimeoutSpy.mockRestore();
  vi.useRealTimers();
  cleanup();
});

describe("UI-24 useOnlineStatus — heartbeat URL contract + backoff", () => {
  it("hits /api/v1/health/connectivity literally (not /api/v1/diagnostics/ping)", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ ok: true, timestamp: "x" }), { status: 200 }),
    );
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    renderHook(() => useOnlineStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(fetchMock).toHaveBeenCalled();
    const url = fetchMock.mock.calls[0]?.[0];
    expect(url).toBe("/api/v1/health/connectivity");
    expect(url).not.toContain("/api/v1/diagnostics/ping");
  });

  it("returns true when navigator.onLine && heartbeat 200", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    const { result } = renderHook(() => useOnlineStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current).toBe(true);
  });

  it("returns false after a single heartbeat failure", async () => {
    fetchMock.mockResolvedValue(new Response("err", { status: 500 }));
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    const { result } = renderHook(() => useOnlineStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    expect(result.current).toBe(false);
  });

  it("first ping fires at POLL_INITIAL (30s) after mount — NOT immediately", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    renderHook(() => useOnlineStatus());

    const firstCall = setTimeoutSpy.mock.calls.at(0);
    expect(firstCall?.[1]).toBe(30_000);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backs off to 60s polling after a successful ping", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    renderHook(() => useOnlineStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });

    const lastCall = setTimeoutSpy.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(60_000);
  });

  it("resets to 5s polling when window 'online' fires after offline", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    renderHook(() => useOnlineStatus());

    await act(async () => {
      window.dispatchEvent(new Event("offline"));
      window.dispatchEvent(new Event("online"));
    });

    const lastCall = setTimeoutSpy.mock.calls.at(-1);
    expect(lastCall?.[1]).toBe(5_000);
  });

  it("uses setTimeout, NOT setInterval", async () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    renderHook(() => useOnlineStatus());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(setIntervalSpy).not.toHaveBeenCalled();
    setIntervalSpy.mockRestore();
  });

  it("cleans up timer + listeners on unmount", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { useOnlineStatus } = await import("../../src/shared/online/use-online-status");
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("online", expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith("offline", expect.any(Function));
    removeEventListenerSpy.mockRestore();
  });
});
