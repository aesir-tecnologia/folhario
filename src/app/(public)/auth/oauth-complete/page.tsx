import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { OauthCompleteForm } from "@contexts/iam/api/components/oauth-complete-form";
import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { getCurrentPolicyVersions } from "@contexts/iam/infrastructure/db/policy-versions";

/**
 * Phase 4 D-04 + AUTH-03 — /auth/oauth-complete page.
 *
 * Lives under (public) so the (app) gate's redirect for users with
 * `age_confirmed_at IS NULL` can reach it without looping back through
 * the gate. If the user is fully completed (age + email verified),
 * redirect them to /. If unauthenticated, /auth/callback hasn't run
 * yet — kick to /auth/login.
 */
export default async function OauthCompletePage() {
  const t = await getTranslations("auth.oauthComplete");

  const result = await getCurrentUserFromSessionReadOnly();
  if (!result.ok) {
    redirect("/auth/login");
  }
  if (result.user.ageConfirmedAt) {
    redirect("/");
  }

  const policies = await getCurrentPolicyVersions();
  const version = policies?.tos.version ?? "1.0";

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-6 font-serif text-2xl font-medium text-forest">
        {t("title")}
      </h1>
      <OauthCompleteForm
        policyVersion={version}
        defaultTimezone={result.user.timezone}
      />
    </main>
  );
}
