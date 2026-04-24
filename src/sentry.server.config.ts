// src/sentry.server.config.ts
// Sentry 10.48 server-side init. Consumes scrub helpers from @shared/telemetry/sentry-scrub (Plan 05a).
// D-19: empty DSN disables transport; D-22: sendDefaultPii:false + beforeSend defense-in-depth; L-2: sendDefaultPii is the current public API.
import * as Sentry from "@sentry/nextjs";
import { makeBeforeSend, makeBeforeBreadcrumb } from "@shared/telemetry/sentry-scrub";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || undefined,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  release: process.env.SENTRY_RELEASE,
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  denyUrls: [/\/_next\/static\//],
  beforeSend: makeBeforeSend() as unknown as Sentry.NodeOptions["beforeSend"],
  beforeBreadcrumb: makeBeforeBreadcrumb() as unknown as Sentry.NodeOptions["beforeBreadcrumb"],
});
