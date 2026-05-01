"use client";

import type { ReactNode } from "react";

import { SubscriptionContext, type SubscriptionState } from "./use-subscription";

/**
 * SubscriptionContextClient — client-side React context provider.
 *
 * Receives the resolved SubscriptionState as a prop from the server entry
 * (SubscriptionProvider in subscription-provider.tsx) and feeds it into the
 * React context so every client component under (app)/ can call
 * useSubscription() without a network round-trip.
 *
 * This file is a Server/Client split idiom required by Next.js App Router:
 * Server Components cannot render <Context.Provider> directly, so the
 * context wiring lives here in a "use client" module.
 *
 * Phase 10: replace initialState source in subscription-provider.tsx from
 * env+cookie to real Stripe state. This file stays unchanged.
 */
export function SubscriptionContextClient({
  initialState,
  children,
}: {
  initialState: SubscriptionState;
  children: ReactNode;
}) {
  return (
    <SubscriptionContext.Provider value={initialState}>{children}</SubscriptionContext.Provider>
  );
}
