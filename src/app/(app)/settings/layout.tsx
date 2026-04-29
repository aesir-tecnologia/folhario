import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

/**
 * Phase 4 D-26 + UI-SPEC §8 — Settings shell.
 *
 * Inherits the (app) AppShell (bottom-nav, banners, scroll restoration)
 * and adds the page header "Configurações" + section group label
 * "PREFERÊNCIAS DA CONTA".
 */
export default async function SettingsLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("settings");

  return (
    <section className="mx-auto w-full max-w-[480px] px-4 pt-6">
      <h1 className="mb-1 font-serif text-2xl font-medium text-forest">
        {t("pageTitle")}
      </h1>
      <p className="
        mb-6 text-xs font-semibold tracking-widest text-slate uppercase
      ">
        {t("groupLabel")}
      </p>
      {children}
    </section>
  );
}
