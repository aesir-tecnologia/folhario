import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "next/navigation";

import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { listPlants } from "@contexts/catalog/application/list-plants";
import { plantsKeys, type ListPlantsResponse } from "@contexts/catalog/queries";
import { toPlantWithSignedUrlSnakeCase } from "@contexts/catalog/api/snake-case";

import { CatalogEmpty } from "./_components/catalog-empty";
import { CatalogHeader } from "./_components/catalog-header";
import { CatalogGrid } from "./_components/catalog-grid";

export default async function CatalogPage() {
  const auth = await getCurrentUserFromSessionReadOnly();
  if (!auth.ok) {
    redirect("/auth/login");
  }

  const result = await listPlants({
    userId: auth.user.id,
    sort: "date_new",
    cursor: null,
    limit: 50,
    includeCount: true,
  });

  if (!result.ok) {
    redirect("/auth/login");
  }

  const responseData: ListPlantsResponse = {
    items: result.items.map(toPlantWithSignedUrlSnakeCase),
    next_cursor: result.nextCursor ?? null,
    total_count: result.totalCount,
  };

  const queryClient = new QueryClient();
  queryClient.setQueryData(
    plantsKeys.lists({ sort: "date_new", include_count: true }).queryKey,
    responseData,
  );

  const totalCount = result.totalCount ?? result.items.length;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      {totalCount === 0 ? (
        <CatalogEmpty />
      ) : (
        <>
          <CatalogHeader totalCount={totalCount} />
          <CatalogGrid />
        </>
      )}
    </HydrationBoundary>
  );
}
