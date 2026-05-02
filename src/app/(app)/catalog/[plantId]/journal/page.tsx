import { notFound } from "next/navigation";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { getTranslations } from "next-intl/server";

import { getCurrentUserFromSessionReadOnly } from "@contexts/iam/application/current-user";
import { getPlant } from "@contexts/catalog/application/get-plant";
import { listPhotoEntries } from "@contexts/catalog/application/list-photo-entries";
import { toPhotoEntrySnakeCase } from "@contexts/catalog/api/snake-case";
import { ErrorCode } from "@shared/config/errors";

import { PhotoJournal } from "./photo-journal";

export default async function JournalPage({ params }: { params: Promise<{ plantId: string }> }) {
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
  const photoEntryItems = photoEntriesResult.ok ? photoEntriesResult.items : [];

  const t = await getTranslations("catalog.journal");
  const tAdd = await getTranslations("catalog.journal.add");
  const tEmpty = await getTranslations("catalog.journal.empty");

  const labels = {
    titleFormat: t("titleFormat"),
    add: {
      cta: tAdd("cta"),
      title: tAdd("title"),
      photoPlaceholder: tAdd("photoPlaceholder"),
      photoRequired: tAdd("errors.photoRequired"),
      noteLabel: tAdd("noteLabel"),
      notePlaceholder: tAdd("notePlaceholder"),
      submit: tAdd("submit"),
      submitting: tAdd("submitting"),
      failure: tAdd("failure"),
      cancel: tAdd("cancel"),
    },
    empty: {
      title: tEmpty("title"),
      hint: tEmpty("hint"),
      cta: tEmpty("cta"),
    },
    lightboxClose: t("lightboxClose"),
  };

  const readOnly = process.env.SUBSCRIPTION_READ_ONLY === "1";

  const { plant } = plantResult;
  const plantForClient = {
    id: plant.id,
    name: plant.name,
    nickname: plant.nickname ?? null,
  };

  const queryClient = new QueryClient();

  queryClient.setQueryData(["catalog", "photo-entries", plantId], {
    items: photoEntryItems.map(toPhotoEntrySnakeCase),
  });

  return (
    <div className="mx-auto max-w-[480px]">
      <HydrationBoundary state={dehydrate(queryClient)}>
        <PhotoJournal
          plant={plantForClient}
          entries={photoEntryItems.map(toPhotoEntrySnakeCase)}
          readOnly={readOnly}
          labels={labels}
        />
      </HydrationBoundary>
    </div>
  );
}
