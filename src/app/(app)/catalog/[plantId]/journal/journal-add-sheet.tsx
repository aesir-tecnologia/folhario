"use client";

import { useState, useRef, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

import { BottomSheet } from "@shared/ui/bottom-sheet";
import { compressPlantPhoto } from "@shared/images/client-compress";
import { plantsKeys } from "@contexts/catalog/queries";

export interface JournalAddSheetLabels {
  cta: string;
  title: string;
  photoPlaceholder: string;
  noteLabel: string;
  notePlaceholder: string;
  submit: string;
  submitting: string;
  failure: string;
  cancel: string;
}

export interface JournalAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plantId: string;
  labels: JournalAddSheetLabels;
}

type PhotoEntry = {
  id: string;
  plant_id: string;
  photo_url: string;
  thumbnail_url: string;
  note: string | null;
  created_at: string;
};

type PhotoEntriesCache = { items: PhotoEntry[] };

export function JournalAddSheet({ open, onOpenChange, plantId, labels }: JournalAddSheetProps) {
  const formId = useId();
  const photoErrorId = `${formId}-photo-error`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const idempotencyKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [noteValue, setNoteValue] = useState("");
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPhotoError(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function resetState() {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setNoteValue("");
    setPhotoError(null);
    idempotencyKeyRef.current = null;
  }

  async function handleSubmit() {
    if (!selectedFile) {
      setPhotoError("Adicione uma foto");
      return;
    }

    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    setSubmitting(true);

    const queryKey = plantsKeys.photoEntries(plantId).queryKey;
    const previous = queryClient.getQueryData<PhotoEntriesCache>(queryKey);

    const tempId = `temp-${crypto.randomUUID()}`;
    const tempEntry: PhotoEntry = {
      id: tempId,
      plant_id: plantId,
      photo_url: URL.createObjectURL(selectedFile),
      thumbnail_url: URL.createObjectURL(selectedFile),
      note: noteValue.trim() || null,
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
      items: [tempEntry, ...(old?.items ?? [])],
    }));

    const currentKey = idempotencyKeyRef.current;
    idempotencyKeyRef.current = null;
    onOpenChange(false);

    try {
      const compressedFile = await compressPlantPhoto(selectedFile);

      const formData = new FormData();
      formData.append("photo", compressedFile);
      if (noteValue.trim()) formData.append("note", noteValue.trim());

      const response = await fetch(`/api/v1/plants/${plantId}/photo-entries`, {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          "Idempotency-Key": currentKey,
        },
      });

      if (response.ok) {
        const body = (await response.json()) as { photo_entry: PhotoEntry };
        queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
          items: (old?.items ?? []).map((e) => (e.id === tempId ? body.photo_entry : e)),
        }));
        await queryClient.invalidateQueries({ queryKey });
        resetState();
        return;
      }

      queryClient.setQueryData<PhotoEntriesCache>(queryKey, previous);
      toast.error(labels.failure);
      idempotencyKeyRef.current = crypto.randomUUID();
      onOpenChange(true);
    } catch {
      queryClient.setQueryData<PhotoEntriesCache>(queryKey, previous);
      toast.error(labels.failure);
      idempotencyKeyRef.current = crypto.randomUUID();
      onOpenChange(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <BottomSheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetState();
        onOpenChange(nextOpen);
      }}
      title={labels.title}
      closeLabel={labels.cancel}
      role="dialog"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <div
            className={`relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl border-[1.5px] border-dashed ${photoError ? "border-rust" : "border-hairline"} bg-ivory`}
            onClick={openFilePicker}
          >
            {previewUrl ? (
              <img
                data-testid="journal-sheet-preview"
                src={previewUrl}
                alt={labels.photoPlaceholder}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                tabIndex={0}
                role="button"
                aria-label={labels.photoPlaceholder}
                aria-invalid={Boolean(photoError)}
                aria-describedby={photoError ? photoErrorId : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") openFilePicker();
                }}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate"
              >
                <AlertCircle strokeWidth={1.5} size={32} aria-hidden="true" />
                <span className="text-sm">{labels.photoPlaceholder}</span>
              </div>
            )}
          </div>

          {photoError && (
            <p id={photoErrorId} role="alert" className="flex items-center gap-1 text-sm text-rust">
              <AlertCircle strokeWidth={1.5} size={16} aria-hidden="true" />
              {photoError}
            </p>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            aria-hidden="true"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={`${formId}-note`} className="text-sm font-semibold text-forest">
            {labels.noteLabel}
          </label>
          <textarea
            id={`${formId}-note`}
            placeholder={labels.notePlaceholder}
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value)}
            className="min-h-[96px] max-h-[240px] resize-y rounded-lg border-[1.5px] border-hairline bg-ivory px-4 py-3 text-base text-forest focus:border-canopy focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="w-full rounded-lg bg-canopy px-4 py-3 text-base font-semibold text-ivory min-h-[48px] disabled:opacity-70"
        >
          {submitting ? labels.submitting : labels.submit}
        </button>

        <button
          type="button"
          autoFocus
          onClick={() => {
            resetState();
            onOpenChange(false);
          }}
          className="w-full rounded-lg border border-canopy px-4 py-3 text-base font-semibold text-canopy min-h-[48px]"
        >
          {labels.cancel}
        </button>
      </div>
    </BottomSheet>
  );
}
