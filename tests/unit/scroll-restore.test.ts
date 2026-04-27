import { describe, it, expect, beforeEach, vi } from "vitest";

describe("UI-14 per-tab scroll restoration helpers", () => {
  beforeEach(() => {
    // Stub sessionStorage for node env (test runs under unit project, not unit-dom).
    const store: Record<string, string> = {};
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it("saveScroll writes pathname → scrollY into sessionStorage", async () => {
    const { saveScroll } = await import("../../src/shared/ui/bottom-nav");
    saveScroll("/catalog", 423);
    expect(sessionStorage.getItem("scroll:/catalog")).toBe("423");
  });

  it("restoreScroll reads pathname → scrollY", async () => {
    const { saveScroll, restoreScroll } = await import("../../src/shared/ui/bottom-nav");
    saveScroll("/identify", 100);
    expect(restoreScroll("/identify")).toBe(100);
  });

  it("restoreScroll returns 0 for unknown pathname", async () => {
    const { restoreScroll } = await import("../../src/shared/ui/bottom-nav");
    expect(restoreScroll("/never-visited")).toBe(0);
  });

  it("scroll keys are pathname-only (hash-only changes do not collide)", async () => {
    const { saveScroll, restoreScroll, scrollKey } = await import(
      "../../src/shared/ui/bottom-nav"
    );
    saveScroll("/catalog", 200);
    expect(scrollKey("/catalog")).toBe("scroll:/catalog");
    expect(scrollKey("/catalog#section")).toBe("scroll:/catalog");
    expect(restoreScroll("/catalog#section")).toBe(200);
  });

  it("setupScrollSaveListeners writes sessionStorage on pagehide (MEDIUM 5 codex review)", async () => {
    const listeners: Record<string, Array<() => void>> = {};
    const fakeWindow = {
      addEventListener: (type: string, fn: () => void) => {
        (listeners[type] ||= []).push(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners[type] = (listeners[type] || []).filter((h) => h !== fn);
      },
      scrollY: 777,
    };
    const fakeDocument = {
      addEventListener: (type: string, fn: () => void) => {
        (listeners[`doc:${type}`] ||= []).push(fn);
      },
      removeEventListener: (type: string, fn: () => void) => {
        listeners[`doc:${type}`] = (listeners[`doc:${type}`] || []).filter(
          (h) => h !== fn,
        );
      },
      visibilityState: "hidden" as const,
    };
    vi.stubGlobal("window", fakeWindow);
    vi.stubGlobal("document", fakeDocument);

    const { setupScrollSaveListeners } = await import(
      "../../src/shared/ui/bottom-nav"
    );
    const teardown = setupScrollSaveListeners("/catalog");

    expect(listeners["pagehide"]?.length).toBe(1);
    listeners["pagehide"]![0]!();
    expect(sessionStorage.getItem("scroll:/catalog")).toBe("777");

    sessionStorage.removeItem("scroll:/catalog");
    expect(listeners["doc:visibilitychange"]?.length).toBe(1);
    listeners["doc:visibilitychange"]![0]!();
    expect(sessionStorage.getItem("scroll:/catalog")).toBe("777");

    teardown();
    expect(listeners["pagehide"]?.length).toBe(0);
    expect(listeners["doc:visibilitychange"]?.length).toBe(0);

    vi.unstubAllGlobals();
  });
});
