"use client";

import { createContext, useContext } from "react";

/**
 * useSubscription — D-21 Phase 5 stub.
 *
 * Returns the current subscription state for the authenticated user. In Phase 5
 * this is a constant stub: `{ active: true, readOnly: false }`. Phase 10 replaces
 * `<SubscriptionProvider>`'s value source with real Stripe state; this hook's
 * signature and default value stay unchanged.
 *
 * readOnly:
 *   - Phase 5: always false in production. Flips to true per-test when
 *     ENABLE_TEST_ROUTES=1 (server env) AND cookie __test_subscription_read_only=1
 *     is present (see subscription-provider.tsx for the server-side gate).
 *   - Phase 10: true when Stripe subscription is in a read-only tier or
 *     grace-period state.
 *
 * T-05-11-03: This hook is a UI-affordance gate, NOT a security boundary.
 * Every mutating server action enforces server-side checks independently.
 * Client-side context tampering produces only hidden buttons that 4xx on submit.
 */
export type SubscriptionState = {
  active: boolean;
  readOnly: boolean;
};

const DEFAULT_STATE: SubscriptionState = { active: true, readOnly: false };

export const SubscriptionContext = createContext<SubscriptionState>(DEFAULT_STATE);

export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext);
}
