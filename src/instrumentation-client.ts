// src/instrumentation-client.ts
// Sentry 10.48 browser init. File naming per https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/
// (Next 16 auto-loads this file into the client bundle.)
// D-21 posture: replay + profiling disabled by default (Phase 1 is diagnostics-only).
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: makeBeforeSend() as unknown as Sentry.BrowserOptions["beforeSend"],
  beforeBreadcrumb: makeBeforeBreadcrumb() as unknown as Sentry.BrowserOptions["beforeBreadcrumb"],
});

// Next 16 App Router navigation instrumentation — safe to export even with Sentry disabled.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
