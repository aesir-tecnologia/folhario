"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { initPostHog } from "@shared/telemetry/posthog-client";

export default function DiagPage() {
  useEffect(() => {
    initPostHog(() => {
      posthog.capture("$diagnostics_client_ping", {
        source: "playwright-smoke",
        $process_person_profile: false,
      });
    });

    Sentry.captureException(new Error("Playwright diagnostics client error"), {
      extra: {
        email: "should-be-scrubbed@example.com",
        token: "should-be-scrubbed",
      },
    });
  }, []);

  return <main>ok</main>;
}
