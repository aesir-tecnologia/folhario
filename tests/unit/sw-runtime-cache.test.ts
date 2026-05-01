import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

const CATALOG_API_CACHE_VALUE = "folhario-catalog-api-v1";

type CaptureArgs = { url: URL; request: Request };
type RegisterCaptureCall = [
  matcher: (args: CaptureArgs) => boolean,
  strategy: object,
];

const registerCaptureMock = vi.fn();

const expirationPluginInstances: Array<{
  maxAgeSeconds?: number;
  maxEntries?: number;
  purgeOnQuotaError?: boolean;
}> = [];
const staleWhileRevalidateInstances: Array<{
  cacheName?: string;
  plugins?: unknown[];
}> = [];

class MockExpirationPlugin {
  maxAgeSeconds?: number;
  maxEntries?: number;
  purgeOnQuotaError?: boolean;
  constructor(opts: {
    maxAgeSeconds?: number;
    maxEntries?: number;
    purgeOnQuotaError?: boolean;
  }) {
    this.maxAgeSeconds = opts?.maxAgeSeconds;
    this.maxEntries = opts?.maxEntries;
    this.purgeOnQuotaError = opts?.purgeOnQuotaError;
    expirationPluginInstances.push(this);
  }
}

class MockStaleWhileRevalidate {
  cacheName?: string;
  plugins?: unknown[];
  constructor(opts: { cacheName?: string; plugins?: unknown[] }) {
    this.cacheName = opts?.cacheName;
    this.plugins = opts?.plugins;
    staleWhileRevalidateInstances.push(this);
  }
}

class MockNetworkOnly {}
class MockNetworkFirst {}

class MockSerwist {
  registerCapture: Mock;
  addEventListeners: Mock;
  constructor() {
    this.registerCapture = registerCaptureMock;
    this.addEventListeners = vi.fn();
  }
}

vi.mock("serwist", () => ({
  Serwist: MockSerwist,
  StaleWhileRevalidate: MockStaleWhileRevalidate,
  ExpirationPlugin: MockExpirationPlugin,
  NetworkOnly: MockNetworkOnly,
  NetworkFirst: MockNetworkFirst,
}));

vi.mock("@serwist/next/worker", () => ({
  defaultCache: [],
}));

Object.defineProperty(globalThis, "self", {
  value: {
    __SW_MANIFEST: [],
    skipWaiting: vi.fn(),
    addEventListener: vi.fn(),
  },
  writable: true,
  configurable: true,
});

let CATALOG_API_CACHE: string;

beforeEach(async () => {
  registerCaptureMock.mockReset();
  expirationPluginInstances.length = 0;
  staleWhileRevalidateInstances.length = 0;

  vi.resetModules();

  const mod = await import("../../src/app/sw");
  CATALOG_API_CACHE = (mod as { CATALOG_API_CACHE?: string }).CATALOG_API_CACHE ?? "";
});

describe("sw.ts — StaleWhileRevalidate catalog runtime cache (D-19/D-20)", () => {
  it("CATALOG_API_CACHE is exported with value 'folhario-catalog-api-v1'", () => {
    expect(CATALOG_API_CACHE).toBe(CATALOG_API_CACHE_VALUE);
  });

  it("registerCapture is called at least 3 times (SWR, NetworkOnly, NetworkFirst)", () => {
    expect(registerCaptureMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("SWR capture is registered BEFORE the NetworkOnly /api/* catch-all (first-match-wins)", () => {
    const calls = registerCaptureMock.mock.calls as RegisterCaptureCall[];

    const swrIndex = calls.findIndex(([, strategy]) => strategy instanceof MockStaleWhileRevalidate);
    const networkOnlyApiIndex = calls.findIndex(([matcher, strategy]) => {
      if (!(strategy instanceof MockNetworkOnly)) return false;
      if (typeof matcher !== "function") return false;
      const testUrl = new URL("https://localhost/api/something");
      const testRequest = new Request(testUrl);
      return (matcher as (arg: CaptureArgs) => boolean)({ url: testUrl, request: testRequest });
    });

    expect(swrIndex).toBeGreaterThanOrEqual(0);
    expect(networkOnlyApiIndex).toBeGreaterThanOrEqual(0);
    expect(swrIndex).toBeLessThan(networkOnlyApiIndex);
  });

  describe("SWR matcher — URL allowlist", () => {
    function getSWRMatcher(): (args: CaptureArgs) => boolean {
      const calls = registerCaptureMock.mock.calls as RegisterCaptureCall[];
      const swrCall = calls.find(([, strategy]) => strategy instanceof MockStaleWhileRevalidate);
      if (!swrCall) throw new Error("SWR capture call not found");
      return swrCall[0];
    }

    function makeArgs(pathname: string, method = "GET"): CaptureArgs {
      const url = new URL(`https://localhost${pathname}`);
      const request = new Request(url, { method });
      return { url, request };
    }

    it.each([
      ["/api/v1/plants", true],
      ["/api/v1/plants/123", true],
      ["/api/v1/plants?cursor=foo", true],
      ["/api/v1/photo-entries", true],
      ["/api/v1/photo-entries/abc", true],
      ["/api/v1/locations", true],
    ])("returns true for GET %s", (pathname, expected) => {
      const matcher = getSWRMatcher();
      expect(matcher(makeArgs(pathname))).toBe(expected);
    });

    it.each([
      ["/api/v1/health/connectivity", false],
      ["/api/v1/identifications", false],
      ["/api/v1/iam/me", false],
      ["/api/v1/auth/login", false],
    ])("returns false for GET %s", (pathname, expected) => {
      const matcher = getSWRMatcher();
      expect(matcher(makeArgs(pathname))).toBe(expected);
    });

    it.each([
      ["/api/v1/plants", "POST"],
      ["/api/v1/plants/123", "PATCH"],
      ["/api/v1/plants/123", "DELETE"],
      ["/api/v1/photo-entries", "POST"],
    ])("returns false for non-GET %s %s", (pathname, method) => {
      const matcher = getSWRMatcher();
      expect(matcher(makeArgs(pathname, method))).toBe(false);
    });
  });

  it("StaleWhileRevalidate is constructed with cacheName = CATALOG_API_CACHE", () => {
    expect(staleWhileRevalidateInstances.length).toBeGreaterThan(0);
    const swr = staleWhileRevalidateInstances[0];
    if (!swr) throw new Error("No StaleWhileRevalidate instance found");
    expect(swr.cacheName).toBe(CATALOG_API_CACHE_VALUE);
  });

  it("ExpirationPlugin is constructed with maxAgeSeconds=604800, maxEntries=200, purgeOnQuotaError=true", () => {
    expect(expirationPluginInstances.length).toBeGreaterThan(0);
    const exp = expirationPluginInstances[0];
    if (!exp) throw new Error("No ExpirationPlugin instance found");
    expect(exp.maxAgeSeconds).toBe(7 * 24 * 60 * 60);
    expect(exp.maxEntries).toBe(200);
    expect(exp.purgeOnQuotaError).toBe(true);
  });
});
