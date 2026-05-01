"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Select } from "@shared/ui/select";
import { useSubscription } from "@contexts/billing/application/use-subscription";
import { useSortPreference, SORT_IDS, type SortId } from "./use-sort-preference";

export interface CatalogHeaderProps {
  totalCount: number;
}

function sortIdToKey(id: SortId): string {
  switch (id) {
    case "date_new": return "dateNew";
    case "date_old": return "dateOld";
    case "name_asc": return "nameAsc";
    case "name_desc": return "nameDesc";
    case "location": return "location";
  }
}

export function CatalogHeader({ totalCount }: CatalogHeaderProps) {
  const t = useTranslations("catalog");
  const { readOnly } = useSubscription();
  const [sort, setSort] = useSortPreference();

  const sortOptions = SORT_IDS.map((id) => ({
    value: id,
    label: t(`sort.options.${sortIdToKey(id)}`),
  }));

  const announceLabel = sortOptions.find((o) => o.value === sort)?.label ?? "";

  return (
    <header
      className="
        mb-4 flex flex-col gap-3 px-5
        [@media(min-width:600px)]:flex-row [@media(min-width:600px)]:items-end
        [@media(min-width:900px)]:px-8
      "
    >
      <div className="flex flex-1 items-baseline gap-2">
        <h1
          className="
            font-sans text-sm font-semibold tracking-[0.04em] text-forest
            uppercase
          "
        >
          {t("header.label")}
        </h1>
        <span className="font-sans text-sm font-normal text-slate">
          {t("header.countPlural", { n: totalCount })}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <Select
          label={t("sort.label")}
          value={sort}
          onChange={(e) => setSort(e.target.value as SortId)}
          options={sortOptions}
        />
        {!readOnly ? (
          <Link
            href="/catalog/add"
            className="
              inline-flex min-h-[48px] shrink-0 items-center justify-center
              rounded-lg bg-canopy px-4 py-3 text-sm font-semibold text-ivory
            "
          >
            {t("header.addPlant")}
          </Link>
        ) : null}
      </div>
      <div
        role="status"
        aria-live="polite"
        className="sr-only"
        data-testid="catalog-sort-announce"
      >
        {t("sort.announce", { label: announceLabel })}
      </div>
    </header>
  );
}
