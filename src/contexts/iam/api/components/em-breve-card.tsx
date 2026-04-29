import Link from "next/link";
import { getTranslations } from "next-intl/server";

/**
 * Phase 4 D-27 + UI-SPEC §6 — "Em breve" placeholder card.
 *
 * Locked composition shared by all 5 deferred Settings sections
 * (notifications, subscription, privacyLgpd, needsAttention, appInfo).
 * Phases 8/9/10/11 each replace one as their feature lands.
 *
 * Server component: reads section-specific copy from
 * `settings.placeholder.<section>.{title,body}`.
 */
type PlaceholderSection =
  | "notifications"
  | "subscription"
  | "privacyLgpd"
  | "needsAttention"
  | "appInfo";

export async function EmBreveCard({ section }: { section: PlaceholderSection }) {
  const t = await getTranslations(`settings.placeholder.${section}`);
  const tBack = await getTranslations("settings");

  return (
    <article
      className={`rounded-2xl border border-hairline bg-ivory p-4`}
    >
      <h2
        className={`
          mb-2 font-serif text-2xl leading-[30px] font-medium text-forest
        `}
      >
        {t("title")}
      </h2>
      <p className="mb-6 text-base/6 text-slate">{t("body")}</p>
      <Link href="/settings/account" className="text-base text-canopy underline">
        {tBack("back")}
      </Link>
    </article>
  );
}
