import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@shared/config/server-env";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { errorResponse, ErrorCode } from "@shared/config/errors";

export async function POST(request: Request) {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
    return errorResponse(ErrorCode.NotFound, "not found");
  }

  const ph = getPostHog();
  if (ph) {
    ph.capture({
      distinctId: "ci-playwright",
      event: "$diagnostics_server_ping",
      properties: { runtime: process.env.NEXT_RUNTIME ?? "nodejs" },
    });
    await ph.shutdown();
  }

  const bodyText = await request.text().catch(() => "");
  Sentry.withScope((scope) => {
    scope.addEventProcessor((event) => {
      event.request = {
        ...event.request,
        url: "http://localhost:3000/api/v1/identifications/_diag-synth",
        data: bodyText ? bodyText : { email: "scrub-me@example.com", token: "scrub-me" },
        method: "POST",
      };
      return event;
    });
    Sentry.captureException(new Error("Playwright diagnostics server error"));
  });

  return NextResponse.json({ ok: true });
}

export async function GET() {
  if (serverEnv.IDENTIFICATION_PROVIDER_MODE !== "stub") {
    return errorResponse(ErrorCode.NotFound, "not found");
  }
  return NextResponse.json({
    ok: true,
    env: process.env.NODE_ENV === "production" ? "production" : "development",
    timestamp: new Date().toISOString(),
  });
}
