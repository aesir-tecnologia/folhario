import { getTranslations } from "next-intl/server";

import { ForgotPasswordForm } from "@contexts/iam/api/components/forgot-password-form";

/**
 * Phase 4 AUTH-11 — /auth/forgot-password page.
 *
 * Always-200 enqueue path (D-11 anti-enumeration).
 */
export default async function ForgotPasswordPage() {
  const t = await getTranslations("auth.forgotPassword");

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-6 font-serif text-2xl font-medium text-forest">
        {t("title")}
      </h1>
      <ForgotPasswordForm />
    </main>
  );
}
