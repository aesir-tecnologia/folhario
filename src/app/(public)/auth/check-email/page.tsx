import { getTranslations } from "next-intl/server";
import Link from "next/link";

export default async function CheckEmailPage() {
  const t = await getTranslations("auth.checkEmail");

  return (
    <main
      className={`
        flex min-h-dvh w-full flex-col items-center bg-paper px-6
        pt-[calc(64px+env(safe-area-inset-top))] pb-safe-bottom
      `}
      role="main"
      aria-label="Verificação de e-mail"
    >
      <EnvelopeWithSproutIllustration />

      <h1
        className={`
          mt-6 text-center font-serif text-2xl leading-[30px] font-medium
          text-forest
        `}
      >
        {t("headline")}
      </h1>

      <p className={`mt-4 max-w-[320px] text-center text-base/6 text-slate`}>{t("body")}</p>

      <Link
        href="/auth/login"
        className={`
          mt-8 inline-flex min-h-[48px] w-full max-w-[320px] items-center
          justify-center rounded-lg bg-canopy px-6 text-base font-semibold
          text-ivory
        `}
      >
        {t("loginCta")}
      </Link>
    </main>
  );
}

function EnvelopeWithSproutIllustration() {
  return (
    <svg
      width="96"
      height="96"
      viewBox="0 0 96 96"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-sage opacity-80"
    >
      <rect x="12" y="36" width="72" height="44" rx="4" />
      <path d="M12 36 L48 60 L84 36" />
      <path d="M48 28 V14" />
      <path d="M44 18 Q48 14 52 18" />
      <path d="M44 24 Q48 20 52 24" />
    </svg>
  );
}
