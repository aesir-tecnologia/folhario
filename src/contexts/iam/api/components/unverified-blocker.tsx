import { getTranslations } from "next-intl/server";

import { ResendVerificationButton } from "./resend-verification-button";
import { LogoutLink } from "./logout-link";

/**
 * Phase 4 AUTH-15 + UI-SPEC §5 — full-viewport unverified-email blocker.
 *
 * Server component: reads pt-BR copy + the user's email and renders the
 * calm "Verifique seu e-mail para começar." gate. Replaces the app shell
 * (no bottom-nav, no banners) until the user clicks the verification
 * link or signs out.
 *
 * Layout follows UI-SPEC §5 verbatim: Sage envelope-with-sprout
 * illustration (accessibility-hidden, static), Source Serif 4 headline
 * in Forest Ink, Calm Slate body with the user's email rendered in
 * <strong>, full-width Canopy "Reenviar e-mail" CTA, tertiary "Sair"
 * link below.
 *
 * Brand tokens consumed via Tailwind v4 `@theme` (Phase 3 globals.css):
 *   bg-paper, text-forest, text-slate, text-canopy, text-sage, font-serif.
 */
export async function UnverifiedBlocker({ email }: { email: string }) {
  const t = await getTranslations("auth.unverifiedBlocker");

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

      <p
        className={`mt-4 max-w-[320px] text-center text-base/6 text-slate`}
      >
        {t.rich("body", {
          email: () => <strong className="font-semibold text-forest">{email}</strong>,
        })}
      </p>

      <div className="mt-8 w-full max-w-[320px]">
        <ResendVerificationButton />
      </div>

      <div className="mt-4">
        <LogoutLink
          translationKey="logout"
          namespace="auth.unverifiedBlocker"
          className="text-base text-canopy underline"
        />
      </div>
    </main>
  );
}

/**
 * Decorative envelope-with-sprout illustration. Static (no motion
 * regardless of `prefers-reduced-motion`); `aria-hidden` per
 * UI-SPEC §5 + PRD §17 "decorative line-art ... accessibility hidden".
 */
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
