import { getTranslations } from "next-intl/server";

import { SignupForm } from "@contexts/iam/api/components/signup-form";
import { getCurrentPolicyVersions } from "@contexts/iam/infrastructure/db/policy-versions";

/**
 * Phase 4 AUTH-01 — /auth/signup page.
 *
 * Server component fetches the active policy_version pair (Codex
 * MEDIUM consent UX — version label rendered next to the T&C/Privacy
 * hyperlinks) and renders the CLIENT SignupForm. D-31 + Codex HIGH #4:
 * the form posts JSON via fetch, never via a server-action <form
 * action={}>.
 */
export default async function SignupPage() {
  const t = await getTranslations("auth.signup");
  const policies = await getCurrentPolicyVersions();
  // The signup form binds BOTH labels to the same version; if the seed
  // is misconfigured the policy-version repo returns null.
  const version = policies?.tos.version ?? "1.0";

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-6 font-serif text-2xl font-medium text-forest">
        {t("title")}
      </h1>
      <SignupForm
        policyVersion={version}
        defaultTimezone="America/Sao_Paulo"
      />
    </main>
  );
}
