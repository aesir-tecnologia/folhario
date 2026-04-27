import { NextResponse } from "next/server";

/**
 * Public connectivity heartbeat for src/shared/online/use-online-status.ts.
 *
 * Contract (UI-24 + Cross-Cutting Truth #12):
 * - Public: NO IDENTIFICATION_PROVIDER_MODE gate (unlike /api/v1/diagnostics/ping
 *   which is CI/stub-mode only and 404s in production).
 * - Side-effect-free: NO Sentry, NO PostHog, NO logging of request IPs.
 * - Body shape: exactly { ok: true, timestamp: <ISO> } — never expose `env`
 *   or anything per-user (T-03-02-02 info-disclosure guard).
 * - Cache-Control: no-store — heartbeat must hit the network every call.
 * - GET-only — no other HTTP verbs.
 */
export async function GET() {
  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
