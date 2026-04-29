---
created: 2026-04-29T16:30:00.000Z
title: Add dev-mode service-worker unregister to prevent stale-cache papercut
area: tooling
files:
  - src/app/posthog-provider.tsx
  - next.config.ts:8-15
---

## Problem

`next.config.ts:14` already passes `disable: process.env.NODE_ENV === "development"` to `withSerwistInit`, so `pnpm dev` never *registers* a new service worker. But that flag does NOT *unregister* an SW that was installed in a previous environment (an earlier preview build, a CI artifact loaded into the browser, a production deploy hit by the same browser profile, etc.). Once installed, the SW persists across sessions until something explicitly unregisters it.

This bit during the `/auth/check-email` fix on 2026-04-29 (Plan 04-13 follow-up). The bug — signup form redirecting to `/auth/forgot-password` instead of `/auth/check-email` — was fixed in source, the new chunk was confirmed served by `pnpm dev`, but the Playwright browser kept executing the old chunks. Reason: a previously installed Serwist SW (likely from a Phase 3 PWA-test build) was still registered for `localhost:3000` and was serving cached HTML + JS chunks for `/auth/signup`. Symptom: edit-recompile-reload showed *no behavior change*. Resolution required `caches.delete(...)` (8 caches) plus `navigator.serviceWorker.getRegistrations().forEach(r => r.unregister())` from devtools before the new code took effect. Roughly an hour lost on the wrong hypothesis.

The footgun is silent — there's no warning surface, no dev-server log, no DX cue that an SW is intercepting fetches. Any developer who ever ran `pnpm build && pnpm start` or hit a preview URL with the same browser profile is now susceptible to this papercut on every subsequent dev session.

## Solution

Add a dev-mode-only client-side guard that unregisters any leftover Serwist SW on app boot. Two reasonable shapes:

1. **Inline guard in the existing client provider** (`src/app/posthog-provider.tsx` is already a `"use client"` boot-time component — same lifecycle is fine):

   ```tsx
   useEffect(() => {
     if (process.env.NODE_ENV !== "development") return;
     if (!("serviceWorker" in navigator)) return;
     navigator.serviceWorker.getRegistrations().then((regs) => {
       regs.forEach((r) => r.unregister());
     });
   }, []);
   ```

   Pros: zero new files, runs on every dev page load, idempotent.
   Cons: couples a dev-tooling concern into a product component (PostHog provider should stay focused).

2. **Dedicated dev-only component** mounted only when `process.env.NODE_ENV === "development"` from `src/app/layout.tsx`:

   ```tsx
   // src/app/dev-sw-unregister.tsx
   "use client";
   import { useEffect } from "react";
   export function DevSwUnregister() {
     useEffect(() => {
       if (!("serviceWorker" in navigator)) return;
       navigator.serviceWorker.getRegistrations().then((regs) => {
         regs.forEach((r) => r.unregister());
       });
     }, []);
     return null;
   }
   ```

   Layout conditionally renders `<DevSwUnregister />` only in dev. Tree-shaken from production bundles.
   Pros: clean separation, opt-in, future-extensible (could add cache.delete too).
   Cons: one new file.

Option 2 is preferred — dev-tooling shouldn't smuggle into a product provider, and the file is trivial.

Optional belt-and-braces: also clear `caches` API entries with a `Folhário-` prefix (Serwist's default prefix scheme) so old precache and runtime-cache entries don't linger after the SW is gone.

## Verification

After landing the change:

1. From a fresh dev profile, register the SW once: `pnpm build && pnpm start`, load `/`, confirm SW shows up in DevTools → Application → Service Workers.
2. Stop and run `pnpm dev`. Load `/` again.
3. DevTools → Application → Service Workers should show **no registered SW** within ~1s of page load.
4. Edit any client component (e.g. change a `text-forest` string), reload, confirm the change appears immediately without manual cache clearing.

## Notes

- This is dev-only. Production behavior is unchanged — the SW continues to register normally because `NODE_ENV === "production"` skips the unregister branch.
- Does NOT replace the existing `disable: process.env.NODE_ENV === "development"` in `next.config.ts`. That flag prevents *registering* a new SW; this guard handles *cleaning up* an already-registered one. They are complementary.
- A more aggressive variant could also send `?_t=${Date.now()}` cache-busters on dev navigations, but that's overkill given the SW unregister already solves the symptom.
