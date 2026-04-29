import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { ResetPasswordForm } from "@contexts/iam/api/components/reset-password-form";

/**
 * Phase 4 AUTH-11 + D-10 — /auth/reset page.
 *
 * Reads the raw token from `?token=` and renders the new-password
 * form. Server-side validation of token shape happens at the API
 * route; this page only shows an "expired link" affordance when the
 * token is absent.
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.reset");
  const tVerify = await getTranslations("auth.verify");

  if (!params.token) {
    redirect("/auth/forgot-password");
  }

  // Absurdly long tokens shouldn't be rendered into the DOM at all;
  // the API will reject anything that doesn't match the 64-hex shape.
  if (params.token!.length !== 64) {
    return (
      <main className="
        mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper px-6 pt-12
        pb-safe-bottom
      ">
        <h1 className="mb-2 font-serif text-2xl font-medium text-forest">
          {tVerify("tokenExpiredTitle")}
        </h1>
        <p className="text-base/6 text-slate">{tVerify("tokenExpiredBody")}</p>
      </main>
    );
  }

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-6 font-serif text-2xl font-medium text-forest">
        {t("title")}
      </h1>
      <ResetPasswordForm token={params.token!} />
    </main>
  );
}
