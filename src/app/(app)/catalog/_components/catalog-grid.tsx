"use client";

import { useQuery } from "@tanstack/react-query";
import { plantsKeys } from "@contexts/catalog/queries";
import { useSortPreference } from "./use-sort-preference";
import { PlantCard } from "./plant-card";
import { SkeletonGroup } from "@shared/ui/skeleton";

const GRID_CLASS =
  "grid grid-cols-2 [@media(min-width:600px)]:grid-cols-3 [@media(min-width:900px)]:grid-cols-4 gap-4 px-5 [@media(min-width:900px)]:px-8";

function SkeletonCard() {
  return (
    <div
      className="aspect-4/5 animate-shimmer rounded-2xl bg-hairline"
      aria-hidden="true"
    />
  );
}

export function CatalogGrid() {
  const [sort] = useSortPreference();
  const { data, isLoading } = useQuery(plantsKeys.lists({ sort, include_count: true }));

  if (isLoading || !data) {
    return (
      <SkeletonGroup delay={300}>
        <ul className={GRID_CLASS}>
          {Array.from({ length: 6 }).map((_, i) => (
            <li key={i}>
              <SkeletonCard />
            </li>
          ))}
        </ul>
      </SkeletonGroup>
    );
  }

  return (
    <ul className={GRID_CLASS} data-testid="catalog-grid">
      {data.items.map((p) => (
        <li key={p.id}>
          <PlantCard plant={p} />
        </li>
      ))}
    </ul>
  );
}
