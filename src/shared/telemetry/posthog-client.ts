import posthog from "posthog-js";
import { clientEnv } from "@shared/config/client-env";

let initialized = false;

export function initPostHog(): void {
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
    request_batching: false,
  });

  initialized = true;
}
