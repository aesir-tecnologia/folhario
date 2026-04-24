// src/sentry.edge.config.ts
// Sentry 10.48 edge-runtime init. Kept for completeness even though proxy.ts runs on Node only (L-1).
// Any future edge-runtime callsite will honor the same scrub contract via this init.
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  denyUrls: [/\/_next\/static\//],
  beforeSend: makeBeforeSend() as unknown as Sentry.EdgeOptions["beforeSend"],
  beforeBreadcrumb: makeBeforeBreadcrumb() as unknown as Sentry.EdgeOptions["beforeBreadcrumb"],
});
