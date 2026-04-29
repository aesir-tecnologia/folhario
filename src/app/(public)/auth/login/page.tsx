import { getTranslations } from "next-intl/server";

import { LoginForm } from "@contexts/iam/api/components/login-form";

/**
 * Phase 4 AUTH-05 — /auth/login page.
 */
export default async function LoginPage() {
  const t = await getTranslations("auth.login");

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[480px] flex-col bg-paper px-6 pt-12
      pb-safe-bottom
    ">
      <h1 className="mb-6 font-serif text-2xl font-medium text-forest">
        {t("title")}
      </h1>
      <LoginForm />
    </main>
  );
}
