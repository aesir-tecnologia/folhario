"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";

import { Lightbox } from "@shared/ui/lightbox";
import { EmptyState } from "@shared/ui/empty-state";
import { plantsKeys } from "@contexts/catalog/queries";
import { useSubscription } from "@contexts/billing/application/use-subscription";

import { JournalAddSheet, type JournalAddSheetLabels } from "./journal-add-sheet";

export type PhotoEntry = {
  id: string;
  plant_id: string;
  photo_url: string;
  thumbnail_url: string;
  photo_signed_url?: string | null;
  thumbnail_signed_url?: string | null;
  note: string | null;
  created_at: string;
};

type PhotoEntriesCache = { items: PhotoEntry[] };

export interface PhotoJournalLabels {
  titleFormat: string;
  add: JournalAddSheetLabels;
  empty: {
    title: string;
    hint: string;
    cta: string;
  };
  lightboxClose: string;
}

export interface PhotoJournalProps {
  plant: { id: string; name: string; nickname?: string | null };
  entries: PhotoEntry[];
  readOnly: boolean;
  labels: PhotoJournalLabels;
}

export function PhotoJournal({ plant, entries: initialEntries, readOnly: readOnlyProp, labels }: PhotoJournalProps) {
  const ta11y = useTranslations("catalog.journal.a11y");
  const { readOnly: subscriptionReadOnly } = useSubscription();
  const readOnly = readOnlyProp || subscriptionReadOnly;

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [addSheetOpen, setAddSheetOpen] = useState(false);

  const queryDef = plantsKeys.photoEntries(plant.id);
  const query = useQuery({
    ...queryDef,
    initialData: { items: initialEntries } as unknown,
  });

  const cachedData = query.data as PhotoEntriesCache | undefined;
  const rawEntries: PhotoEntry[] = cachedData?.items ?? initialEntries;

  const entries = [...rawEntries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const lightboxPhotos = entries.map((e) => ({
    id: e.id,
    src: e.photo_signed_url ?? e.photo_url,
    caption: e.note ?? undefined,
  }));

  const displayName = plant.nickname ?? plant.name;

  return (
    <div data-testid="photo-journal" className="flex flex-col pb-24">
      <div className="flex items-center justify-between px-4 py-3">
        <h1 className="font-serif text-xl font-medium text-forest">
          {labels.titleFormat.replace("{name}", displayName)}
        </h1>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setAddSheetOpen(true)}
            className="flex min-h-[44px] items-center rounded-lg bg-canopy px-4 text-sm font-semibold text-ivory"
          >
            {labels.add.cta}
          </button>
        )}
      </div>

      {entries.length === 0 ? (
        <EmptyState
          headline={labels.empty.title}
          hint={labels.empty.hint}
          ctaLabel={labels.empty.cta}
          ctaOnClick={readOnly ? undefined : () => setAddSheetOpen(true)}
        />
      ) : (
        <ul className="flex flex-col gap-4 px-4">
          {entries.map((entry, idx) => (
            <li key={entry.id} className="flex flex-col gap-1">
              <button
                type="button"
                className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl"
                onClick={() => {
                  setLightboxIndex(idx);
                  setLightboxOpen(true);
                }}
                aria-label={ta11y("photoIndex", { index: idx + 1, total: entries.length })}
              >
                <img
                  src={entry.thumbnail_url || entry.photo_url}
                  alt={entry.note ?? ta11y("photoFallbackAlt")}
                  className="h-full w-full object-cover"
                />
              </button>
              <p className="text-sm text-slate">
                {new Intl.DateTimeFormat("pt-BR").format(new Date(entry.created_at))}
              </p>
              {entry.note && (
                <p className="text-base text-forest">{entry.note}</p>
              )}
            </li>
          ))}
        </ul>
      )}

      <Lightbox
        open={lightboxOpen}
        onOpenChange={setLightboxOpen}
        photos={lightboxPhotos}
        index={lightboxIndex}
        onIndexChange={setLightboxIndex}
        plantName={displayName}
        closeLabel={labels.lightboxClose}
      />

      <JournalAddSheet
        open={addSheetOpen}
        onOpenChange={setAddSheetOpen}
        plantId={plant.id}
        labels={labels.add}
      />
    </div>
  );
}
