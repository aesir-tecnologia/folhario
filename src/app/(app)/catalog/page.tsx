import { getTranslations } from "next-intl/server";
import { EmptyState } from "@shared/ui/empty-state";

export default async function CatalogPage() {
  const t = await getTranslations("catalog.empty");
  return (
    <EmptyState
      headline={t("title")}
      hint={t("hint")}
      ctaLabel={t("cta")}
      ctaHref="/catalog/add"
    />
  );
}
