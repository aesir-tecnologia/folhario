"use client";

import { useState, useRef, useId } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertCircle } from "lucide-react";

import { TextInput } from "@shared/ui/text-input";
import { LocationCombobox } from "@shared/ui/location-combobox";
import { ReadOnlyBanner } from "@shared/ui/read-only-banner";
import { compressPlantPhoto } from "@shared/images/client-compress";
import { useSubscription } from "@contexts/billing/application/use-subscription";

export interface AddPlantFormLabels {
  title: string;
  photoLabel: string;
  photoPlaceholder: string;
  photoReplace: string;
  name: string;
  namePlaceholder: string;
  nickname: string;
  nicknamePlaceholder: string;
  location: string;
  acquisitionDate: string;
  notes: string;
  notesPlaceholder: string;
  submit: string;
  submitLoading: string;
  submitFailure: string;
  errors: {
    nameRequired: string;
    photoRequired: string;
    acquisitionDateInvalid: string;
    summaryHeader: string;
  };
  fieldNames: {
    name: string;
    photo: string;
    acquisitionDate: string;
  };
}

export interface AddPlantFormProps {
  readOnly: boolean;
  labels: AddPlantFormLabels;
  initialLocationSuggestions: string[];
}

type FormErrors = Partial<Record<"name" | "photo" | "acquisitionDate", string>>;

export function AddPlantForm({ readOnly: readOnlyProp, labels, initialLocationSuggestions }: AddPlantFormProps) {
  const router = useRouter();
  const { readOnly: subscriptionReadOnly } = useSubscription();
  const readOnly = readOnlyProp || subscriptionReadOnly;

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [nameValue, setNameValue] = useState("");
  const [nicknameValue, setNicknameValue] = useState("");
  const [locationValue, setLocationValue] = useState("");
  const [acquisitionDateValue, setAcquisitionDateValue] = useState("");
  const [notesValue, setNotesValue] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const idempotencyKeyRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const formId = useId();
  const nameId = `${formId}-name`;
  const photoId = `${formId}-photo`;
  const acquisitionDateId = `${formId}-acquisitionDate`;
  const summaryId = `${formId}-summary`;
  const photoErrorId = `${formId}-photo-error`;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setErrors((prev) => ({ ...prev, photo: undefined }));
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function focusFirstInvalid(errs: FormErrors) {
    requestAnimationFrame(() => {
      if (errs.photo) {
        const el = document.getElementById(photoId);
        el?.focus();
        return;
      }
      if (errs.name) {
        const el = document.getElementById(nameId);
        el?.focus();
        return;
      }
      if (errs.acquisitionDate) {
        const el = document.getElementById(acquisitionDateId);
        el?.focus();
      }
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const newErrors: FormErrors = {};
    if (!selectedFile) newErrors.photo = labels.errors.photoRequired;
    if (!nameValue.trim()) newErrors.name = labels.errors.nameRequired;

    if (acquisitionDateValue) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(acquisitionDateValue)) {
        newErrors.acquisitionDate = labels.errors.acquisitionDateInvalid;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      focusFirstInvalid(newErrors);
      return;
    }

    setErrors({});
    setSubmitting(true);

    if (idempotencyKeyRef.current === null) {
      idempotencyKeyRef.current = crypto.randomUUID();
    }

    try {
      const compressedFile = await compressPlantPhoto(selectedFile!);

      const formData = new FormData();
      formData.append("name", nameValue.trim());
      formData.append("photo", compressedFile);
      if (nicknameValue.trim()) formData.append("nickname", nicknameValue.trim());
      if (locationValue.trim()) formData.append("location", locationValue.trim());
      if (acquisitionDateValue.trim()) formData.append("acquisition_date", acquisitionDateValue.trim());
      if (notesValue.trim()) formData.append("notes", notesValue.trim());

      const response = await fetch("/api/v1/plants", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
        headers: {
          "Idempotency-Key": idempotencyKeyRef.current,
        },
      });

      if (response.ok) {
        const body = (await response.json()) as { plant: { id: string } };
        idempotencyKeyRef.current = null;
        router.push(`/catalog/${body.plant.id}`);
        return;
      }

      const errBody = await response.json().catch(() => null) as {
        error?: { code?: string; details?: { issues?: Array<{ path: string[]; message: string }> } };
      } | null;

      const fieldErrors: FormErrors = {};
      if (errBody?.error?.code === "validation_failed" && errBody.error.details?.issues) {
        for (const issue of errBody.error.details.issues) {
          const path = issue.path[0];
          if (path === "name") fieldErrors.name = issue.message;
          if (path === "photo") fieldErrors.photo = issue.message;
          if (path === "acquisition_date") fieldErrors.acquisitionDate = issue.message;
        }
      }

      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors);
        focusFirstInvalid(fieldErrors);
        idempotencyKeyRef.current = null;
      } else {
        toast.error(labels.submitFailure, {
          onAutoClose: () => {},
          onDismiss: () => {},
        });
        idempotencyKeyRef.current = null;
      }
    } catch {
      toast.error(labels.submitFailure, {
        onAutoClose: () => {},
        onDismiss: () => {},
      });
      idempotencyKeyRef.current = null;
    } finally {
      setSubmitting(false);
    }
  }

  const errorCount = Object.values(errors).filter(Boolean).length;
  const showSummary = errorCount >= 2;

  const invalidFields: string[] = [];
  if (errors.photo) invalidFields.push(labels.fieldNames.photo);
  if (errors.name) invalidFields.push(labels.fieldNames.name);
  if (errors.acquisitionDate) invalidFields.push(labels.fieldNames.acquisitionDate);

  return (
    <div>
      <ReadOnlyBanner active={readOnly} />

      <form
        data-testid="add-plant-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 px-4 pt-6 pb-24"
        aria-describedby={showSummary ? summaryId : undefined}
      >
        <h1 className="font-serif text-2xl font-medium text-forest">{labels.title}</h1>

        {showSummary && (
          <div
            id={summaryId}
            role="alert"
            className="rounded-lg border-l-4 border-rust bg-ivory p-4"
          >
            <p className="text-sm font-semibold text-forest">
              {labels.errors.summaryHeader.replace("{fields}", invalidFields.join(", "))}
            </p>
            <ul className="mt-1 flex flex-wrap gap-1 text-sm">
              {errors.photo && (
                <li>
                  <a href={`#${photoId}`} className="text-rust underline">
                    {labels.fieldNames.photo}
                  </a>
                </li>
              )}
              {errors.name && (
                <li>
                  <a href={`#${nameId}`} className="text-rust underline">
                    {labels.fieldNames.name}
                  </a>
                </li>
              )}
              {errors.acquisitionDate && (
                <li>
                  <a href={`#${acquisitionDateId}`} className="text-rust underline">
                    {labels.fieldNames.acquisitionDate}
                  </a>
                </li>
              )}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold text-forest">{labels.photoLabel}</span>
          <div
            className={`relative aspect-[4/5] w-full cursor-pointer overflow-hidden rounded-2xl border-[1.5px] border-dashed ${errors.photo ? "border-rust" : "border-hairline"} bg-ivory`}
            onClick={readOnly ? undefined : openFilePicker}
          >
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={labels.photoPlaceholder}
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                id={photoId}
                tabIndex={readOnly ? -1 : 0}
                role="button"
                aria-label={labels.photoLabel}
                aria-invalid={Boolean(errors.photo)}
                aria-describedby={errors.photo ? photoErrorId : undefined}
                onKeyDown={(e) => {
                  if (!readOnly && (e.key === "Enter" || e.key === " ")) openFilePicker();
                }}
                className="flex h-full w-full flex-col items-center justify-center gap-2 text-slate"
              >
                <AlertCircle strokeWidth={1.5} size={32} aria-hidden="true" />
                <span className="text-sm">{labels.photoPlaceholder}</span>
              </div>
            )}
          </div>

          {errors.photo && (
            <p id={photoErrorId} role="alert" className="flex items-center gap-1 text-sm text-rust">
              <AlertCircle strokeWidth={1.5} size={16} aria-hidden="true" />
              {errors.photo}
            </p>
          )}

          {previewUrl && !readOnly && (
            <button
              type="button"
              onClick={openFilePicker}
              className="self-start text-sm text-canopy underline"
            >
              {labels.photoReplace}
            </button>
          )}

          <input
            ref={fileInputRef}
            id={`${photoId}-input`}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={handleFileChange}
            disabled={readOnly}
            aria-hidden="true"
          />
        </div>

        <TextInput
          id={nameId}
          label={labels.name}
          autoComplete="off"
          placeholder={labels.namePlaceholder}
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          error={errors.name}
          disabled={readOnly}
        />

        <TextInput
          label={labels.nickname}
          autoComplete="off"
          placeholder={labels.nicknamePlaceholder}
          value={nicknameValue}
          onChange={(e) => setNicknameValue(e.target.value)}
          disabled={readOnly}
        />

        <LocationCombobox
          label={labels.location}
          suggestions={initialLocationSuggestions}
          value={locationValue}
          onChange={setLocationValue}
          disabled={readOnly}
        />

        <TextInput
          id={acquisitionDateId}
          label={labels.acquisitionDate}
          type="date"
          autoComplete="off"
          value={acquisitionDateValue}
          onChange={(e) => setAcquisitionDateValue(e.target.value)}
          error={errors.acquisitionDate}
          disabled={readOnly}
        />

        <div className="flex flex-col gap-1">
          <label htmlFor={`${formId}-notes`} className="text-sm font-semibold text-forest">
            {labels.notes}
          </label>
          <textarea
            id={`${formId}-notes`}
            placeholder={labels.notesPlaceholder}
            value={notesValue}
            onChange={(e) => setNotesValue(e.target.value)}
            disabled={readOnly}
            className="min-h-[96px] max-h-[240px] resize-y rounded-lg border-[1.5px] border-hairline bg-ivory px-4 py-3 text-base text-forest focus:border-canopy focus:outline-none"
          />
        </div>

        {!readOnly && (
          <div className="fixed bottom-0 left-0 right-0 mx-auto max-w-tablet px-4 pb-safe-area-inset-bottom bg-ivory/95 pt-3">
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-canopy px-4 py-3 text-base font-semibold text-ivory min-h-[48px] disabled:opacity-70"
            >
              {submitting ? labels.submitLoading : labels.submit}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
