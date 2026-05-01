import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { UnverifiedBlocker } from "@contexts/iam/api/components/unverified-blocker";
import { SubscriptionProvider } from "@contexts/billing/application/subscription-provider";

import { AppShell } from "./app-shell";

/**
 * (app) route group layout — server component. Phase 4 Codex HIGH #7
 * fix: route-group layout owns the gate (replaces the unreliable
 * x-pathname workaround the original plan templated against; route
 * groups are App Router's idiomatic mechanism for path-based gating in
 * Server Components).
 *
 * Gate ordering — resolved Q4:
 *   (a) Authenticated → otherwise redirect to /auth/login
 *   (b) age_confirmed_at IS NULL → redirect to /auth/oauth-complete
 *       (lives under (public) so the user can reach it without the
 *       gate looping)
 *   (c) email_verified_at IS NULL → render <UnverifiedBlocker /> (full
 *       viewport — bypasses AppShell so there is no bottom-nav escape
 *       hatch; UI-SPEC §5)
 *   (d) Authorized → wrap children in AppShell (bottom-nav, banners,
 *       toasts, scroll restoration; preserved from prior wave).
 *
 * Pitfall 6 safety: uses `getCurrentUserFromSessionReadOnly()` which
 * never mutates cookies (Server Components in Next 16 throw on cookie
 * writes; Plan 03 D-21 already documents this).
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const result = await getCurrentUserFromSessionReadOnly();

  // (a) Unauthenticated → login.
  if (!result.ok) {
    redirect("/auth/login");
  }

  const { user } = result;

  // (b) OAuth-incomplete → completion screen (lives under (public)).
  if (!user.ageConfirmedAt) {
    redirect("/auth/oauth-complete");
  }

  // (c) Authenticated but unverified → full-viewport blocker (no AppShell).
  if (!user.emailVerifiedAt) {
    return <UnverifiedBlocker email={user.email} />;
  }

  // (d) Verified → app shell (wrapped in subscription context for Wave 4 plans).
  return (
    <SubscriptionProvider>
      <AppShell>{children}</AppShell>
    </SubscriptionProvider>
  );
}
