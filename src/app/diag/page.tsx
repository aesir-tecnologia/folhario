"use client";

import { useEffect } from "react";
import posthog from "posthog-js";
import * as Sentry from "@sentry/nextjs";
import { initPostHog } from "@shared/telemetry/posthog-client";

export default function DiagPage() {
  useEffect(() => {
    console.log("[diag] useEffect firing");
    initPostHog();
    console.log(
      "[diag] after init, has_opted_in_capturing=",
      typeof posthog.has_opted_in_capturing === "function"
        ? posthog.has_opted_in_capturing()
        : "n/a",
      "has_opted_out=",
      typeof posthog.has_opted_out_capturing === "function"
        ? posthog.has_opted_out_capturing()
        : "n/a",
      "get_distinct_id=",
      typeof posthog.get_distinct_id === "function" ? posthog.get_distinct_id() : "n/a",
    );

    console.log("[diag] about to call posthog.capture");
    posthog.capture("$diagnostics_client_ping", {
      source: "playwright-smoke",
      $process_person_profile: false,
    });
    console.log("[diag] posthog.capture returned");

    Sentry.captureException(new Error("Playwright diagnostics client error"), {
      extra: {
        email: "should-be-scrubbed@example.com",
        token: "should-be-scrubbed",
      },
    });
  }, []);

  return <main>ok</main>;
}
