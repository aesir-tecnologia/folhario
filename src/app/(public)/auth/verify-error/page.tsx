import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

/**
 * Phase 4 — /auth/verify-error page.
 *
 * Distinct from the route handler at /auth/verify (which validates and
 * redirects). This page renders when the token-expired path resolves
 * the user to a calm "Solicite um novo link" affordance per UI-SPEC
 * "Error states" — full-page calm pattern, NOT inline.
 *
 * If a caller hits this path without an `?error=token_expired` query,
 * just send them to /auth/login.
 */
export default async function VerifyErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("auth.verify");

  if (params.error !== "token_expired") {
    redirect("/auth/login");
  }

  return (
    <main className="
      mx-auto flex min-h-dvh w-full max-w-[480px] flex-col items-center bg-paper
      px-6 pt-16 pb-safe-bottom text-center
    ">
      <h1 className="mb-2 font-serif text-2xl font-medium text-forest">
        {t("tokenExpiredTitle")}
      </h1>
      <p className="mb-8 text-base/6 text-slate">{t("tokenExpiredBody")}</p>
      <Link
        href="/auth/forgot-password"
        className="
          inline-flex min-h-[48px] items-center justify-center rounded-lg
          bg-canopy px-6 text-base font-semibold text-ivory
        "
      >
        {t("tokenExpiredCta")}
      </Link>
    </main>
  );
}
