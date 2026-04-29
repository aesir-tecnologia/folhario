import { getTranslations } from "next-intl/server";

import { getCurrentPolicyVersions } from "@contexts/iam/infrastructure/db/policy-versions";

/**
 * Phase 4 Codex MEDIUM consent UX fix — /legal/privacy stub.
 *
 * Public, unauthenticated. Renders the active Privacy Policy version
 * so users can verify what version they're consenting to before
 * signup. Real LGPD copy + DPO contact lands as a launch blocker
 * (PRD §24 launch blocker #3).
 */
export default async function PrivacyPage() {
  const t = await getTranslations("legal");
  const policies = await getCurrentPolicyVersions();
  const version = policies?.privacy.version ?? "1.0";

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[720px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-4 font-serif text-3xl font-medium text-forest">
        {t("privacyPageTitle")}
      </h1>
      <p className="text-base/6 text-slate">
        {t("underConstruction", { version })}
      </p>
    </main>
  );
}
