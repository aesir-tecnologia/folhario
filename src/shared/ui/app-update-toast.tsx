"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Serwist } from "@serwist/window";
import { toast } from "sonner";

/**
 * AppUpdateToast — OFF-10. Subscribes to Serwist `waiting` event, surfaces a
 * sonner toast with `app.update.label` + `app.update.cta`, calls
 * `messageSkipWaiting()` on tap, and `location.reload()` on `controlling`.
 *
 * Lifecycle:
 * 1. Component mounts in (app)/app-shell.tsx.
 * 2. Constructs the Serwist source via the injectable factory (defaults to
 *    `new Serwist("/sw.js", ...)`) AFTER attaching the `waiting` listener
 *    (the very-first install fires waiting before UI mounts on second visit;
 *    closure pattern is required per Serwist docs).
 * 3. On `waiting`: attach `controlling` listener (inside the closure per
 *    RESEARCH.md subscription order), then show sonner toast.
 * 4. On action click: `messageSkipWaiting()` — triggers the SW SKIP_WAITING
 *    handler (Task 2) -> `self.skipWaiting()`.
 * 5. Once SW is controlling, `controlling` fires -> `location.reload()` via
 *    the injectable reload callback (defaults to `() => location.reload()`).
 *
 * The `createSource` and `reload` props are dependency-injection seams for
 * the unit test in `tests/unit/app-update-toast.test.tsx`. Production callers
 * (mounted in `(app)/app-shell.tsx`) pass NO props and inherit the defaults.
 *
 * Reduced-motion respected via sonner default animations + the
 * `motion-reduce:` variant on the Toaster mounted in app-shell.
 */

export interface AppUpdateSource {
  addEventListener(type: "waiting" | "controlling", handler: () => void): void;
  messageSkipWaiting(): void;
  register(): Promise<unknown> | unknown;
}

export interface AppUpdateToastProps {
  /** Source factory — defaults to `new Serwist("/sw.js", { scope: "/", type: "classic" })`. */
  createSource?: () => AppUpdateSource;
  /** Reload callback — defaults to `() => location.reload()`. */
  reload?: () => void;
}

const defaultCreateSource = (): AppUpdateSource =>
  new Serwist("/sw.js", { scope: "/", type: "classic" }) as unknown as AppUpdateSource;

const defaultReload = (): void => {
  location.reload();
};

export function AppUpdateToast({
  createSource = defaultCreateSource,
  reload = defaultReload,
}: AppUpdateToastProps = {}) {
  const t = useTranslations("app.update");

  useEffect(() => {
    if (typeof navigator !== "undefined" && !("serviceWorker" in navigator)) return;

    const source = createSource();

    source.addEventListener("waiting", () => {
      source.addEventListener("controlling", () => {
        reload();
      });
      toast(t("label"), {
        action: {
          label: t("cta"),
          onClick: () => {
            source.messageSkipWaiting();
          },
        },
        duration: Infinity,
      });
    });

    void source.register();
  }, [t, createSource, reload]);

  return null;
}
