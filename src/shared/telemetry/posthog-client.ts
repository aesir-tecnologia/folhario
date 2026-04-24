import posthog from "posthog-js";
import { clientEnv } from "@shared/config/client-env";

let initialized = false;
let loaded = false;
const loadedCallbacks: Array<() => void> = [];

export function initPostHog(onLoaded?: () => void): void {
  if (onLoaded) {
    if (loaded) onLoaded();
    else loadedCallbacks.push(onLoaded);
  }

  if (initialized) return;
  if (!clientEnv.NEXT_PUBLIC_POSTHOG_KEY) return;

  posthog.init(clientEnv.NEXT_PUBLIC_POSTHOG_KEY, {
    api_host: clientEnv.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com",
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: false,
    disable_session_recording: true,
    persistence: "localStorage+cookie",
    person_profiles: "identified_only",
    loaded: () => {
      console.log(
        "[posthog-client] loaded callback fired, draining",
        loadedCallbacks.length,
        "callbacks",
      );
      loaded = true;
      while (loadedCallbacks.length > 0) loadedCallbacks.shift()?.();
    },
  });

  initialized = true;
}
