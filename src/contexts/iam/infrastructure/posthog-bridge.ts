// Phase 4 D-07/D-21 + Pitfall 8 + LGPD-13 — server-side PostHog capture.
//
// Never include PII (email, raw token) in event properties. The
// `signup_completed` event fires AT VERIFY time (D-07), not at form submit.
// PostHog node SDK is initialized via `getPostHog()` from the shared helper;
// when no key is configured, calls are no-ops (safe in dev/CI).

import { getPostHog } from "@shared/telemetry/posthog-server";

async function capture(
  userId: string,
  event: string,
  properties: Record<string, unknown> = {},
): Promise<void> {
  const ph = getPostHog();
  if (!ph) return;
  ph.capture({ distinctId: userId, event, properties });
  await ph.shutdown();
}

/** Phase 4 D-07 + Pitfall 8: fires at /auth/verify (or OAuth-complete), NOT at signup form submit. */
export async function captureSignupCompleted(userId: string): Promise<void> {
  await capture(userId, "signup_completed");
}

/**
 * Phase 4 D-24 + Wave-1 reconciliation: one analytics event per ConsentLog row.
 * The on-disk consent_logs row carries purpose='signup_acceptance' + policy_version_id;
 * the `documentType` parameter here is the human-readable label that the analytics
 * event reports as the `document_type` property.
 */
export async function captureConsentGranted(
  userId: string,
  documentType: "terms_of_service" | "privacy_policy",
): Promise<void> {
  await capture(userId, "consent_granted", { document_type: documentType });
}
