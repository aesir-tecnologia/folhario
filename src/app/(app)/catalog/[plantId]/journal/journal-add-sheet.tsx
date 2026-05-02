"use client";

import { useState, useRef, useId } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

import { BottomSheet } from "@shared/ui/bottom-sheet";
import { compressPlantPhoto } from "@shared/images/client-compress";
import {
  plantsKeys,
  type PlantPhotoEntry,
  type PhotoEntriesResponse,
} from "@contexts/catalog/queries";

export interface JournalAddSheetLabels {
  cta: string;
  title: string;
  photoPlaceholder: string;
  photoRequired: string;
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

type PhotoEntry = PlantPhotoEntry;

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
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit() {
    if (!selectedFile) {
      setPhotoError(labels.photoRequired);
      return;
    }

    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    const currentKey = idempotencyKeyRef.current;
    setSubmitting(true);

    const queryKey = plantsKeys.photoEntries(plantId).queryKey;
    const previous = queryClient.getQueryData<PhotoEntriesResponse>(queryKey);

    const tempId = `temp-${crypto.randomUUID()}`;
    // Track blob URLs so they can be revoked after the temp entry is replaced or rolled back.
    const tempPhotoUrl = URL.createObjectURL(selectedFile);
    const tempThumbUrl = URL.createObjectURL(selectedFile);
    const tempEntry: PhotoEntry = {
      id: tempId,
      plant_id: plantId,
      photo_url: tempPhotoUrl,
      thumbnail_url: tempThumbUrl,
      note: noteValue.trim() || null,
      created_at: new Date().toISOString(),
    };

    queryClient.setQueryData<PhotoEntriesResponse>(queryKey, (old) => ({
      items: [tempEntry, ...(old?.items ?? [])],
    }));

    // Keep the sheet open during the network call so photo bytes are retained (D-15).
    // Only close on success; on failure stay open for retry.
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
        queryClient.setQueryData<PhotoEntriesResponse>(queryKey, (old) => ({
          items: (old?.items ?? []).map((e) => (e.id === tempId ? body.photo_entry : e)),
        }));
        URL.revokeObjectURL(tempPhotoUrl);
        URL.revokeObjectURL(tempThumbUrl);
        await queryClient.invalidateQueries({ queryKey });
        resetState();
        onOpenChange(false);
        return;
      }

      // Non-OK response: roll back optimistic update, keep key for retry.
      // 409 conflict (hash mismatch) means body changed on same key — generate new key.
      queryClient.setQueryData<PhotoEntriesResponse>(queryKey, previous);
      URL.revokeObjectURL(tempPhotoUrl);
      URL.revokeObjectURL(tempThumbUrl);
      toast.error(labels.failure);
      if (response.status === 409) {
        idempotencyKeyRef.current = crypto.randomUUID();
      }
      // else: keep currentKey so retry sends the same idempotency key (D-37).
    } catch {
      // Network / timeout error: roll back, keep key to allow idempotent retry (D-37).
      queryClient.setQueryData<PhotoEntriesResponse>(queryKey, previous);
      URL.revokeObjectURL(tempPhotoUrl);
      URL.revokeObjectURL(tempThumbUrl);
      toast.error(labels.failure);
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
