"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type InlineEditFieldVariant = "text" | "textarea" | "date";

export interface InlineEditFieldRenderEditorArgs {
  value: string;
  setValue: (next: string) => void;
  commit: () => void;
  cancel: () => void;
  ariaLabel: string;
  ariaInvalid: boolean;
  ariaDescribedBy?: string;
}

export interface InlineEditFieldProps {
  label: string;
  value: string | null;
  placeholder: string;
  variant: InlineEditFieldVariant;
  onSave: (next: string) => Promise<void>;
  readOnly?: boolean;
  required?: boolean;
  requiredErrorCopy?: string;
  revertAnnouncementCopy?: string;
  minRows?: number;
  maxRows?: number;
  renderEditor?: (args: InlineEditFieldRenderEditorArgs) => ReactNode;
}

type Mode = "read" | "editing" | "saving" | "error-revert";

export function InlineEditField({
  label,
  value,
  placeholder,
  variant,
  onSave,
  readOnly = false,
  required = false,
  requiredErrorCopy,
  revertAnnouncementCopy,
  minRows = 3,
  maxRows = 8,
  renderEditor,
}: InlineEditFieldProps) {
  const reactId = useId();
  const helperId = `${reactId}-helper`;

  const [mode, setMode] = useState<Mode>("read");
  const [draft, setDraft] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [revertCopy, setRevertCopy] = useState<string | null>(null);

  // Pre-edit snapshot: saves the persisted value before editing begins so Esc reverts correctly.
  const preEditValueRef = useRef<string>("");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  // Auto-select input text when entering editing state (built-in variants only).
  useEffect(() => {
    if (mode === "editing" && !renderEditor && inputRef.current) {
      inputRef.current.select();
    }
  }, [mode, renderEditor]);

  const currentDisplayValue = value ?? "";

  function enterEditing() {
    if (readOnly) return;
    preEditValueRef.current = currentDisplayValue;
    setDraft(currentDisplayValue);
    setValidationError(null);
    setRevertCopy(null);
    setMode("editing");
  }

  async function commit() {
    const trimmed = draft.trim();

    if (required && trimmed === "") {
      setValidationError(requiredErrorCopy ?? "Este campo é obrigatório.");
      return;
    }

    setMode("saving");
    setValidationError(null);

    try {
      await onSave(draft);
      setMode("read");
      setRevertCopy(null);
    } catch {
      // Revert to pre-edit value — display is controlled by caller via `value` prop,
      // but we show the pre-edit snapshot until the parent state updates.
      setDraft(preEditValueRef.current);
      setMode("error-revert");
      if (revertAnnouncementCopy) {
        setRevertCopy(revertAnnouncementCopy);
      }
    }
  }

  function cancel() {
    setDraft(preEditValueRef.current);
    setValidationError(null);
    setRevertCopy(null);
    setMode("read");
  }

  function handleReadKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      enterEditing();
    }
  }

  function handleTextKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      cancel();
    }
  }

  function handleTextareaKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      void commit();
    } else if (e.key === "Escape") {
      cancel();
    }
    // Plain Enter in textarea → browser default (inserts newline).
  }

  const isSaving = mode === "saving";
  const isEditing = mode === "editing" || mode === "saving";

  const displayValue = mode === "error-revert" ? preEditValueRef.current : currentDisplayValue;

  // Read-only: plain div, no role/tabIndex, cursor default — D-21 read-only.
  if (readOnly) {
    return (
      <div className="flex flex-col gap-1" data-testid="inline-edit-read">
        <span className="text-sm font-semibold text-slate">{label}</span>
        {displayValue ? (
          <span className="text-forest">{displayValue}</span>
        ) : (
          <span className="italic text-slate">{placeholder}</span>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-1"
      aria-busy={isSaving ? "true" : "false"}
      data-testid="inline-edit-field"
    >
      <span className="text-sm font-semibold text-slate">{label}</span>

      {/* Read state — role=button, tap to enter editing */}
      {!isEditing && mode !== "error-revert" && (
        <button
          type="button"
          role="button"
          tabIndex={0}
          aria-label={`${label}: ${displayValue || placeholder}`}
          onClick={enterEditing}
          onKeyDown={handleReadKeyDown}
          className="
            cursor-text text-left text-forest
            hover:outline hover:outline-2 hover:outline-offset-4 hover:outline-hairline
          "
        >
          {displayValue ? (
            <span>{displayValue}</span>
          ) : (
            <span className="italic text-slate">{placeholder}</span>
          )}
        </button>
      )}

      {/* Error-revert state — show reverted value + role=alert announcement */}
      {mode === "error-revert" && (
        <>
          <button
            type="button"
            role="button"
            tabIndex={0}
            aria-label={`${label}: ${displayValue || placeholder}`}
            onClick={enterEditing}
            onKeyDown={handleReadKeyDown}
            className="
              cursor-text text-left text-forest
              hover:outline hover:outline-2 hover:outline-offset-4 hover:outline-hairline
            "
          >
            {displayValue ? (
              <span>{displayValue}</span>
            ) : (
              <span className="italic text-slate">{placeholder}</span>
            )}
          </button>
          {revertCopy && (
            <p role="alert" className="mt-1 text-sm text-rust">
              {revertCopy}
            </p>
          )}
        </>
      )}

      {/* Editing / Saving state */}
      {isEditing && (
        <div className="flex flex-col gap-1">
          {renderEditor ? (
            renderEditor({
              value: draft,
              setValue: setDraft,
              commit: () => void commit(),
              cancel,
              ariaLabel: label,
              ariaInvalid: validationError !== null,
              ariaDescribedBy: validationError ? helperId : undefined,
            })
          ) : variant === "textarea" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={handleTextareaKeyDown}
              aria-label={label}
              aria-invalid={validationError !== null}
              aria-describedby={validationError ? helperId : undefined}
              rows={minRows}
              disabled={isSaving}
              className={`
                w-full rounded-md border-[1.5px] bg-ivory px-3 py-2 text-forest
                focus:outline-none focus:ring-2 focus:ring-canopy/40
                ${validationError ? "border-rust" : "border-canopy"}
              `}
              style={{ minHeight: `${minRows * 1.5}rem`, maxHeight: `${maxRows * 1.5}rem` }}
            />
          ) : variant === "date" ? (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="date"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
              }}
              aria-label={label}
              aria-invalid={validationError !== null}
              aria-describedby={validationError ? helperId : undefined}
              disabled={isSaving}
              className={`
                w-full rounded-md border-[1.5px] bg-ivory px-3 py-2 text-forest
                focus:outline-none focus:ring-2 focus:ring-canopy/40
                ${validationError ? "border-rust" : "border-canopy"}
              `}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => void commit()}
              onKeyDown={handleTextKeyDown}
              aria-label={label}
              aria-invalid={validationError !== null}
              aria-describedby={validationError ? helperId : undefined}
              disabled={isSaving}
              autoFocus
              className={`
                w-full rounded-md border-[1.5px] bg-ivory px-3 py-2 text-forest
                focus:outline-none focus:ring-2 focus:ring-canopy/40
                ${validationError ? "border-rust" : "border-canopy"}
              `}
            />
          )}

          {/* Saving label — "Salvando…" text, NOT a spinner. UI-SPEC §12 line 575. */}
          {isSaving && (
            <span className="text-sm text-slate">Salvando…</span>
          )}

          {/* Required-empty validation error */}
          {validationError && (
            <p
              role="alert"
              id={helperId}
              className="text-sm text-rust"
            >
              {validationError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
