import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      // @ts-expect-error Plan 05b creates ./sentry.server.config; guard removed then.
      await import("./sentry.server.config");
    } catch {
      // sentry.server.config not yet present (pre-Plan-05b build)
    }
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    try {
      // @ts-expect-error Plan 05b creates ./sentry.edge.config; guard removed then.
      await import("./sentry.edge.config");
    } catch {
      // sentry.edge.config not yet present (pre-Plan-05b build)
    }
  }
}

export const onRequestError = Sentry.captureRequestError;
