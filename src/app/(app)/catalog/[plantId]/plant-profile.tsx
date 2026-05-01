"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronLeft, MoreVertical } from "lucide-react";

import { InlineEditField } from "@shared/ui/inline-edit-field";
import { LocationCombobox } from "@shared/ui/location-combobox";
import { Lightbox } from "@shared/ui/lightbox";
import { useSubscription } from "@contexts/billing/application/use-subscription";
import { plantsKeys, locationsKeys } from "@contexts/catalog/queries";

import { usePatchPlantField, useDeletePlant, type PatchableField } from "./use-plant-profile-mutations";
import { DeleteConfirmSheet } from "./delete-confirm-sheet";

type PlantSnakeCase = {
  id: string;
  name: string;
  nickname: string | null;
  location: string | null;
  acquisition_date: string | null;
  notes: string | null;
  cover_signed_url: string | null;
  cover_photo_url: string | null;
};

type PhotoEntrySnakeCase = {
  id: string;
  plant_id: string;
  photo_url: string;
  thumbnail_url: string;
  photo_signed_url?: string | null;
  thumbnail_signed_url?: string | null;
  note: string | null;
  created_at: string;
};

type PlantDetailCache = {
  plant: PlantSnakeCase;
  _meta: { photo_entry_count: number; reminder_count: number };
};

type PhotoEntriesCache = {
  items: PhotoEntrySnakeCase[];
};

type LocationsCache = {
  locations: string[];
};

interface PlantProfileProps {
  plantId: string;
}

export function PlantProfile({ plantId }: PlantProfileProps) {
  const t = useTranslations("catalog.profile");
  const router = useRouter();
  const { readOnly } = useSubscription();
  const queryClient = useQueryClient();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const plantQuery = useQuery(plantsKeys.detail(plantId) as ReturnType<typeof plantsKeys.detail> & { select?: (d: unknown) => PlantDetailCache });
  const photoEntriesQuery = useQuery(plantsKeys.photoEntries(plantId) as ReturnType<typeof plantsKeys.photoEntries> & { select?: (d: unknown) => PhotoEntriesCache });
  const locationsQuery = useQuery(locationsKeys.all() as ReturnType<typeof locationsKeys.all> & { select?: (d: unknown) => LocationsCache });

  const detailData = plantQuery.data as PlantDetailCache | undefined;
  const plant = detailData?.plant;
  const meta = detailData?._meta;

  const photoEntriesData = photoEntriesQuery.data as PhotoEntriesCache | undefined;
  const photoEntries: PhotoEntrySnakeCase[] = photoEntriesData?.items ?? [];

  const locationsData = locationsQuery.data as LocationsCache | undefined;
  const locationSuggestions: string[] = locationsData?.locations ?? [];

  const patchMutation = usePatchPlantField(plantId, { queryClient });
  const deleteMutation = useDeletePlant(plantId, {
    queryClient,
    onSuccess: () => router.push("/catalog"),
  });

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .toLowerCase()
      .trim();

  const tLoc = useTranslations("catalog.locations");
  const locationDefaults = tLoc.raw("defaults") as string[];
  const mergedLocationOptions: string[] = [];
  const seen = new Set<string>();
  for (const label of [...locationSuggestions, ...locationDefaults]) {
    const key = norm(label);
    if (key && !seen.has(key)) {
      seen.add(key);
      mergedLocationOptions.push(label);
    }
  }

  const handleSave = (field: PatchableField) => async (value: string) => {
    await patchMutation.mutateAsync({ field, value });
  };

  const allPhotos = plant?.cover_signed_url
    ? [
        {
          id: "cover",
          src: plant.cover_signed_url,
          caption: plant.nickname ?? plant.name ?? undefined,
        },
        ...photoEntries.slice(1).map((pe) => ({
          id: pe.id,
          src: pe.photo_signed_url ?? pe.photo_url,
          caption: pe.note ?? undefined,
        })),
      ]
    : photoEntries.map((pe) => ({
        id: pe.id,
        src: pe.photo_signed_url ?? pe.photo_url,
        caption: pe.note ?? undefined,
      }));

  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  if (!plant) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div className="h-8 w-full animate-pulse rounded bg-hairline" />
        <div className="aspect-[4/5] w-full animate-pulse rounded-2xl bg-hairline" />
      </div>
    );
  }

  const displayName = plant.nickname ?? plant.name;
  const hasMultiplePhotos = photoEntries.length > 1;

  return (
    <div className="flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          aria-label="Voltar"
          onClick={() => router.back()}
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-hairline"
        >
          <ChevronLeft strokeWidth={1.5} size={24} />
        </button>

        {!readOnly && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={t("overflow.delete")}
                data-testid="plant-overflow-trigger"
                className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full hover:bg-hairline"
              >
                <MoreVertical strokeWidth={1.5} size={24} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="z-40 min-w-[180px] rounded-xl bg-ivory p-1 shadow-lg"
              >
                <DropdownMenu.Item
                  data-testid="plant-overflow-delete"
                  onSelect={() => setDeleteOpen(true)}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-rust hover:bg-rust/10"
                >
                  {t("overflow.delete")}
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        )}
      </div>

      {/* Section 1 — Cover photo */}
      {plant.cover_signed_url && (
        <button
          type="button"
          aria-label={`Foto de ${displayName}`}
          onClick={() => openLightbox(0)}
          className="w-full"
        >
          <div className="relative aspect-[4/5] w-full overflow-hidden">
            <Image
              src={plant.cover_signed_url}
              alt={`Foto de ${displayName}`}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          </div>
        </button>
      )}

      {/* Thumbnail strip */}
      {hasMultiplePhotos && (
        <div className="flex gap-2 overflow-x-auto px-4 py-3">
          {photoEntries.slice(1, 4).map((pe, idx) => (
            <button
              key={pe.id}
              type="button"
              aria-label={`Foto ${idx + 2} de ${displayName}`}
              onClick={() => openLightbox(idx + 1)}
              className="relative h-20 w-16 flex-shrink-0 overflow-hidden rounded-lg"
            >
              <Image
                src={pe.thumbnail_url}
                alt={pe.note ?? `Foto ${idx + 2}`}
                fill
                className="object-cover"
                sizes="64px"
              />
            </button>
          ))}
        </div>
      )}

      {/* Section 2 — Inline edit fields */}
      <div className="flex flex-col gap-4 px-4 py-4">
        <div data-testid="inline-edit-name">
          <InlineEditField
            label={t("fields.name.label")}
            value={plant.name}
            placeholder={t("fields.name.placeholder")}
            variant="text"
            required
            requiredErrorCopy={t("fields.name.requiredError")}
            onSave={handleSave("name")}
            readOnly={readOnly}
          />
        </div>

        <div data-testid="inline-edit-nickname">
          <InlineEditField
            label={t("fields.nickname.label")}
            value={plant.nickname}
            placeholder={t("fields.nickname.placeholder")}
            variant="text"
            onSave={handleSave("nickname")}
            readOnly={readOnly}
          />
        </div>

        <div data-testid="inline-edit-location">
          <InlineEditField
            label={t("fields.location.label")}
            value={plant.location}
            placeholder={t("fields.location.placeholder")}
            variant="text"
            onSave={handleSave("location")}
            readOnly={readOnly}
            renderEditor={(slot) => (
              <LocationCombobox
                label={t("fields.location.label")}
                value={slot.value}
                onChange={(next) => {
                  slot.setValue(next);
                  slot.commit();
                }}
                suggestions={mergedLocationOptions}
                aria-describedby={slot.ariaDescribedBy}
                data-testid="location-combobox-editor"
              />
            )}
          />
        </div>

        <div data-testid="inline-edit-acquisition-date">
          <InlineEditField
            label={t("fields.acquisitionDate.label")}
            value={plant.acquisition_date}
            placeholder={t("fields.acquisitionDate.placeholder")}
            variant="date"
            onSave={handleSave("acquisitionDate")}
            readOnly={readOnly}
          />
        </div>

        <div data-testid="inline-edit-notes">
          <InlineEditField
            label={t("fields.notes.label")}
            value={plant.notes}
            placeholder={t("fields.notes.placeholder")}
            variant="textarea"
            minRows={4}
            maxRows={10}
            onSave={handleSave("notes")}
            readOnly={readOnly}
          />
        </div>
      </div>

      {/* Section 3 — Active reminders placeholder (Phase 8) */}
      <section className="px-4 py-4">
        <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate">
          {t("sections.reminders")}
        </h2>
        <p className="text-sm text-slate">{t("reminders.empty")}</p>
        <Link
          href="/settings/notifications"
          className="mt-1 inline-block text-sm font-semibold text-canopy"
        >
          {t("reminders.cta")}
        </Link>
      </section>

      {/* Section 4 — Photo journal preview strip */}
      <section className="px-4 py-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold tracking-widest text-slate">
            {t("sections.journal")}
          </h2>
          <Link
            href={`/catalog/${plantId}/journal`}
            className="text-sm font-semibold text-canopy"
          >
            {t("journal.viewAll")}
          </Link>
        </div>

        {hasMultiplePhotos ? (
          <div className="flex gap-2 overflow-x-auto">
            {photoEntries.slice(0, 4).map((pe, idx) => (
              <button
                key={pe.id}
                type="button"
                aria-label={pe.note ?? `Foto ${idx + 1}`}
                onClick={() => openLightbox(idx)}
                className="relative h-24 w-20 flex-shrink-0 overflow-hidden rounded-lg"
              >
                <Image
                  src={pe.thumbnail_url}
                  alt={pe.note ?? `Foto ${idx + 1}`}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-slate">{t("journal.empty")}</p>
            {!readOnly && (
              <Link
                href={`/catalog/${plantId}/journal`}
                className="text-sm font-semibold text-canopy"
              >
                {t("journal.addCta")}
              </Link>
            )}
          </div>
        )}
      </section>

      {/* Section 5 — ID history placeholder (Phase 6 wires real link; UI-08) */}
      <section className="px-4 py-4">
        <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate">
          {t("sections.history")}
        </h2>
        <p className="text-sm text-slate">{t("history.empty")}</p>
      </section>

      {/* Lightbox */}
      {allPhotos.length > 0 && (
        <Lightbox
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          photos={allPhotos}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          plantName={displayName ?? ""}
          closeLabel="Fechar"
        />
      )}

      {/* Delete confirm sheet */}
      {!readOnly && (
        <DeleteConfirmSheet
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          plantNameOrNickname={displayName ?? plant.name}
          photoEntryCount={meta?.photo_entry_count ?? 0}
          reminderCount={meta?.reminder_count ?? 0}
          isDeleting={deleteMutation.isPending}
          onConfirm={async () => {
            await deleteMutation.mutateAsync();
            setDeleteOpen(false);
          }}
        />
      )}
    </div>
  );
}
