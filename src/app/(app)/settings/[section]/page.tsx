import { notFound } from "next/navigation";

import { AccountSection } from "@contexts/iam/api/components/account-section";
import { EmBreveCard } from "@contexts/iam/api/components/em-breve-card";
import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { getUserById } from "@contexts/iam/infrastructure/db/users";

/**
 * Phase 4 D-26 — /settings/[section] dispatcher.
 *
 * Account is the only fully-implemented section in Phase 4; the other
 * five render an "Em breve" placeholder card per D-27. The (app)
 * layout already gated this page (auth + age_confirmed +
 * email_verified), so the user is guaranteed authorized here. Re-fetch
 * via `getUserById` to materialize `hasPassword` (the credential-flag
 * boolean is needed by the AccountSection conditional).
 */

const VALID_SECTIONS = [
  "account",
  "notifications",
  "subscription",
  "privacy-lgpd",
  "needs-attention",
  "app-info",
] as const;

type ValidSection = (typeof VALID_SECTIONS)[number];
type PlaceholderKey =
  | "notifications"
  | "subscription"
  | "privacyLgpd"
  | "needsAttention"
  | "appInfo";

const PLACEHOLDER_MAP: Partial<Record<ValidSection, PlaceholderKey>> = {
  notifications: "notifications",
  subscription: "subscription",
  "privacy-lgpd": "privacyLgpd",
  "needs-attention": "needsAttention",
  "app-info": "appInfo",
};

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!VALID_SECTIONS.includes(section as ValidSection)) {
    notFound();
  }

  if (section === "account") {
    const result = await getCurrentUserFromSessionReadOnly();
    // The (app) layout already redirected if !result.ok, but re-narrow
    // for TypeScript and for the Codex HIGH #3-style enrichment.
    if (!result.ok) {
      notFound();
    }
    const enriched = await getUserById(result.user.id);
    if (!enriched) {
      notFound();
    }
    return <AccountSection user={enriched} />;
  }

  const placeholderKey = PLACEHOLDER_MAP[section as ValidSection];
  if (!placeholderKey) {
    notFound();
  }
  return <EmBreveCard section={placeholderKey} />;
}
