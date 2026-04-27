import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly, NetworkFirst } from "serwist";

declare global {
  interface ServiceWorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
    skipWaiting(): Promise<void> | void;
    addEventListener(
      type: "message",
      listener: (event: { data?: { type?: string } }) => void,
    ): void;
  }
}
declare const self: ServiceWorkerGlobalScope;

/**
 * Folhário service worker — Phase 3 user-controlled update flow.
 *
 * Behavior changes from Phase 1 skeleton (D-13 → D-14/D-15/D-16):
 * - skipWaiting: false (was true) — waiting worker stays pending until tap
 * - clientsClaim: true — claim clients on activation so the first install
 *   serves cached navigation requests immediately (offline-fallback + OfflineBanner
 *   reload tests rely on this). User-controlled update flow is unaffected:
 *   `skipWaiting: false` keeps the waiting worker pending until the user taps
 *   the toast; once SKIP_WAITING activates the new SW, clientsClaim makes it
 *   take over without requiring a manual reload of all open tabs.
 * - NetworkOnly for /api/* — never serve stale API responses
 * - StaleWhileRevalidate via defaultCache for /_next/static/* + image assets
 * - Navigation handler: serve /offline when uncached navigation while offline
 * - SKIP_WAITING message handler GUARDED by event.data?.type check
 *   (T-03-04-01 — without the guard, ANY postMessage triggers reload)
 */
// Append the (app) shell routes + `/offline` to whatever `@serwist/next`
// precaches (static JS chunks, fonts, manifest, icons). Two reasons:
//   1. Fallback plugin uses `matchPrecache("/offline")` — without precaching,
//      offline navigations to truly uncached routes produce ERR_FAILED instead
//      of serving the offline page.
//   2. The first navigation to a route happens BEFORE the SW is controlling,
//      so the runtime NetworkFirst never sees that response. Precaching the
//      (app) shell routes guarantees they are available offline on the very
//      first reload (W-3 OfflineBanner test relies on this — the original
//      route's AppShell + OfflineBanner must render, not the bare /offline).
// `revision: null` lets Serwist hash the response itself at install time.
const precacheEntries: (PrecacheEntry | string)[] = [
  ...(self.__SW_MANIFEST ?? []),
  { url: "/", revision: null },
  { url: "/catalog", revision: null },
  { url: "/identify", revision: null },
  { url: "/profile", revision: null },
  { url: "/offline", revision: null },
];

const serwist = new Serwist({
  precacheEntries,
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher: ({ request }) => request.destination === "document",
      },
    ],
  },
});

serwist.registerCapture(({ url }) => url.pathname.startsWith("/api/"), new NetworkOnly());

// Navigation handler — required for `fallbacks.entries` to fire on offline
// reload of HTML documents. `@serwist/next/worker` defaultCache does not
// include a navigation/document strategy; without this the request reaches
// the network unmediated, fails with ERR_FAILED, and the fallback never runs.
// NetworkFirst keeps page HTML fresh online; on network error it serves the
// cached copy if any, then falls through to the precached /offline route.
serwist.registerCapture(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages",
    networkTimeoutSeconds: 3,
  }),
);

self.addEventListener("message", (event) => {
  // T-03-04-01 — guard event.data.type. Without this, any postMessage
  // triggers skipWaiting + the reload on next 'controlling' event.
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
