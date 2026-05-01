import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { notFound } from "next/navigation";

import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { getPlant } from "@contexts/catalog/application/get-plant";
import { listPhotoEntries } from "@contexts/catalog/application/list-photo-entries";
import { toPlantWithSignedUrlSnakeCase, toPhotoEntrySnakeCase } from "@contexts/catalog/api/snake-case";
import { ErrorCode } from "@shared/config/errors";

import { PlantProfile } from "./plant-profile";

export default async function PlantProfilePage({
  params,
}: {
  params: Promise<{ plantId: string }>;
}) {
  const { plantId } = await params;

  const auth = await getCurrentUserFromSessionReadOnly();
  if (!auth.ok) {
    notFound();
  }

  const plantResult = await getPlant({ userId: auth.user.id, plantId });
  if (!plantResult.ok) {
    if (plantResult.code === ErrorCode.NotFound) notFound();
    throw new Error(`getPlant failed: ${plantResult.code}`);
  }

  const photoEntriesResult = await listPhotoEntries({
    userId: auth.user.id,
    plantId,
  });
  const photoEntryItems = photoEntriesResult.ok ? photoEntriesResult.items.slice(0, 4) : [];

  const plantSnake = toPlantWithSignedUrlSnakeCase({
    ...plantResult.plant,
    coverSignedUrl: plantResult.coverSignedUrl,
  });

  const queryClient = new QueryClient();

  queryClient.setQueryData(["catalog", "plant", plantId], {
    plant: plantSnake,
    _meta: {
      photo_entry_count: plantResult._meta.photoEntryCount,
      reminder_count: plantResult._meta.reminderCount,
    },
  });

  queryClient.setQueryData(["catalog", "photo-entries", plantId], {
    items: photoEntryItems.map(toPhotoEntrySnakeCase),
  });

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlantProfile plantId={plantId} />
    </HydrationBoundary>
  );
}
