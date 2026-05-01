"use client";

import { useTranslations } from "next-intl";
import { EmptyState } from "@shared/ui/empty-state";

export function CatalogEmpty() {
  const t = useTranslations("catalog.empty");
  return (
    <div data-testid="catalog-empty">
      <EmptyState
        headline={t("title")}
        hint={t("hint")}
        ctaLabel={t("cta")}
        ctaHref="/identify"
      />
    </div>
  );
}
