import type { ReactNode } from "react";

import { cookies } from "next/headers";

import { SubscriptionContextClient } from "./subscription-provider.client";
import type { SubscriptionState } from "./use-subscription";

/**
 * resolveSubscriptionState — pure helper (no React, no I/O).
 *
 * Resolves subscription state from the server-env gate and per-request cookie.
 * Both checks use strict equality with "1" to avoid accidental enablement via
 * truthy string coercion (T-05-11-01 mitigation).
 *
 * Gate contract:
 *   - In production: ENABLE_TEST_ROUTES is never set → returns { active: true, readOnly: false }
 *   - In E2E tests: ENABLE_TEST_ROUTES=1 (set once in playwright.config.ts webServer.env)
 *     AND cookie __test_subscription_read_only=1 → returns { active: true, readOnly: true }
 *
 * Phase 10: replace this resolver body with real Stripe state. The hook
 * signature (useSubscription) and default value stay unchanged.
 */
export function resolveSubscriptionState(input: {
  enableTestRoutes: string | undefined;
  cookieValue: string | undefined;
}): SubscriptionState {
  if (input.enableTestRoutes === "1" && input.cookieValue === "1") {
    return { active: true, readOnly: true };
  }
  return { active: true, readOnly: false };
}

/**
 * SubscriptionProvider — server entry for the subscription context.
 *
 * Reads ENABLE_TEST_ROUTES (server-only env, no NEXT_PUBLIC_ prefix — Phase 1
 * D-29 / Phase 4 WR-08) at request time and, when set to "1", reads the
 * __test_subscription_read_only cookie to allow per-test state toggling by
 * the Playwright fixture in tests/e2e/fixtures/read-only.ts.
 *
 * IMPORTANT: cookies() is called only inside the ENABLE_TEST_ROUTES=1 branch.
 * In production (env absent) this branch is never entered, so production routes
 * stay statically optimizable and are NOT opted into dynamic rendering.
 *
 * T-05-11-01: Both ENABLE_TEST_ROUTES and the cookie must strictly equal "1".
 *             Client-side context tampering has no effect on server evaluation.
 * T-05-11-02: Neither the env var, the cookie value, nor the raw boolean leaves
 *             the server — only the resolved SubscriptionState crosses as props.
 */
export async function SubscriptionProvider({ children }: { children: ReactNode }) {
  let cookieValue: string | undefined;
  if (process.env.ENABLE_TEST_ROUTES === "1") {
    const cookieStore = await cookies();
    cookieValue = cookieStore.get("__test_subscription_read_only")?.value;
  }

  const state = resolveSubscriptionState({
    enableTestRoutes: process.env.ENABLE_TEST_ROUTES,
    cookieValue,
  });

  return <SubscriptionContextClient initialState={state}>{children}</SubscriptionContextClient>;
}
