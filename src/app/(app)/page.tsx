import { getTranslations } from "next-intl/server";
import { EmptyState } from "@shared/ui/empty-state";

export default async function HomePage() {
  const t = await getTranslations("home.empty");
  return (
    <EmptyState
      headline={t("title")}
      hint={t("hint")}
      ctaLabel={t("cta")}
      ctaHref="/identify"
    />
  );
}
