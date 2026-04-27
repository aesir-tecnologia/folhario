import { getTranslations } from "next-intl/server";
import { EmptyState } from "@shared/ui/empty-state";

export default async function IdentifyPage() {
  const t = await getTranslations("identify.empty");
  return (
    <EmptyState
      headline={t("title")}
      hint={t("hint")}
      ctaLabel={t("cta")}
      ctaHref="/identify/start"
    />
  );
}
