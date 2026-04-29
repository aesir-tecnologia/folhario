import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";

/**
 * (public) route group layout — Phase 4 Codex HIGH #7 fix.
 *
 * Houses the auth pages (signup, login, forgot-password, reset,
 * verify-error, oauth-complete). Runs no gate, but redirects
 * already-authenticated AND verified visitors to /. OAuth-incomplete
 * users (`age_confirmed_at IS NULL`) ARE allowed through to
 * /auth/oauth-complete which lives under this group.
 *
 * Pitfall 6 safety: read-only session read (no cookie mutation in
 * Server Components per Next 16).
 */
export default async function PublicLayout({ children }: { children: ReactNode }) {
  const result = await getCurrentUserFromSessionReadOnly();
  if (result.ok && result.user.emailVerifiedAt && result.user.ageConfirmedAt) {
    redirect("/");
  }
  return <>{children}</>;
}
