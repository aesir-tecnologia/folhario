import { getTranslations } from "next-intl/server";

import { getCurrentPolicyVersions } from "@contexts/iam/infrastructure/db/policy-versions";

/**
 * Phase 4 Codex MEDIUM consent UX fix — /legal/terms stub.
 *
 * Public, unauthenticated. Renders the active T&C policy_version so
 * users can verify what version they're consenting to before signup.
 * Real legal copy is a launch-blocker (PRD §24 launch blocker #4) and
 * lands separately.
 */
export default async function TermsPage() {
  const t = await getTranslations("legal");
  const policies = await getCurrentPolicyVersions();
  const version = policies?.tos.version ?? "1.0";

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[720px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-4 font-serif text-3xl font-medium text-forest">
        {t("termsPageTitle")}
      </h1>
      <p className="text-base/6 text-slate">
        {t("underConstruction", { version })}
      </p>
    </main>
  );
}
