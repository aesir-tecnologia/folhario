"use client";

import { useEffect, type ReactNode } from "react";
import { initPostHog } from "@shared/telemetry/posthog-client";

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    initPostHog();
  }, []);

  return <>{children}</>;
}
