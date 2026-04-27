import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist, NetworkOnly } from "serwist";

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
 * - clientsClaim: false (was true) — only claims after skipWaiting messaged
 * - NetworkOnly for /api/* — never serve stale API responses
 * - StaleWhileRevalidate via defaultCache for /_next/static/* + image assets
 * - Navigation handler: serve /offline when uncached navigation while offline
 * - SKIP_WAITING message handler GUARDED by event.data?.type check
 *   (T-03-04-01 — without the guard, ANY postMessage triggers reload)
 */
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: false,
  clientsClaim: false,
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

serwist.registerCapture(
  ({ url }) => url.pathname.startsWith("/api/"),
  new NetworkOnly(),
);

self.addEventListener("message", (event) => {
  // T-03-04-01 — guard event.data.type. Without this, any postMessage
  // triggers skipWaiting + the reload on next 'controlling' event.
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

serwist.addEventListeners();
