"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * ModalSheet — UI primitive (PRD §17).
 *
 * Radix Dialog wrapper with:
 * - 24px top-corner radius
 * - 36x4 Hairline drag handle (visual only — Radix doesn't ship drag-to-dismiss)
 * - Focus trap + return-focus to invoker (Radix default)
 * - 50% scrim
 * - "Fechar" button + drag handle BOTH visible (PRD §17 modal-sheet rule:
 *   tap-scrim allowed only IN ADDITION to dismiss affordance)
 *
 * Z-index ordering (sonner coexistence — Plan 04):
 * - Dialog overlay/content: z-50
 * - sonner Toaster (mounted in (app)/layout.tsx): z-60
 * Document this so toasts always render above modal scrim.
 *
 * onOpenChange forwarded to Radix; controlled OR uncontrolled both supported.
 */
export interface ModalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  /**
   * Forwarded to Radix `Dialog.Content`. Radix only restores focus to the
   * trigger when `Dialog.Trigger` was used to open the dialog. Controlled
   * callers (LGPD consent modal in Phase 4, test harness) can use this hook
   * to `event.preventDefault()` and focus a stored invoker ref themselves.
   */
  onCloseAutoFocus?: (event: Event) => void;
  /**
   * Forwarded to Radix `Dialog.Content`. Default behavior: if a descendant
   * with the `autofocus` attribute is present, focus it (UI-SPEC §7
   * Cancel-first autofocus). Otherwise Radix's default first-focusable
   * heuristic applies.
   */
  onOpenAutoFocus?: (event: Event) => void;
  /**
   * Override Radix's default role on Dialog.Content. UI-SPEC §7 line 367
   * requires "alertdialog" for the destructive delete-confirm sheet so screen
   * readers announce headline+body as a higher-priority alert.
   * Defaults to undefined → Radix renders "dialog" (Phase 4 LGPD consumer unchanged).
   */
  role?: "dialog" | "alertdialog";
  /**
   * Promote the 36×4 drag handle to a real keyboard-reachable close button:
   * role="button", aria-label={closeLabel}, Enter/Space → onOpenChange(false).
   * Defaults to false (Phase 4 LGPD consumer unchanged: handle stays aria-hidden=true).
   * BottomSheet (Plan 05-13) sets this to true.
   */
  interactiveDragHandle?: boolean;
}

export function ModalSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
  onCloseAutoFocus,
  onOpenAutoFocus,
  role,
  interactiveDragHandle = false,
}: ModalSheetProps) {
  const handleOpenAutoFocus = (event: Event) => {
    if (onOpenAutoFocus) {
      onOpenAutoFocus(event);
      return;
    }
    const root =
      (event.currentTarget as HTMLElement | null) ??
      (event.target as HTMLElement | null) ??
      document;
    const autofocusEl =
      root.querySelector<HTMLElement>('[data-autofocus="true"]') ??
      document.querySelector<HTMLElement>(
        '[role="dialog"] [data-autofocus="true"], [role="alertdialog"] [data-autofocus="true"]',
      );
    if (autofocusEl) {
      event.preventDefault();
      autofocusEl.focus();
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-forest/50" />
        <Dialog.Content
          onCloseAutoFocus={onCloseAutoFocus}
          onOpenAutoFocus={handleOpenAutoFocus}
          {...(role !== undefined && { role })}
          className="
            fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto
            rounded-t-[24px] bg-ivory p-6
          "
        >
          {interactiveDragHandle ? (
            <button
              type="button"
              data-testid="bottomsheet-drag-handle"
              role="button"
              aria-label={closeLabel}
              tabIndex={0}
              onClick={() => onOpenChange(false)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenChange(false);
                }
              }}
              className="
                mx-auto mb-4 block h-[4px] w-[36px] rounded-full bg-hairline
                focus-visible:outline-[3px] focus-visible:outline-offset-2
                focus-visible:outline-canopy/40
              "
            />
          ) : (
            <div
              className="mx-auto mb-4 h-[4px] w-[36px] rounded-full bg-hairline"
              aria-hidden="true"
            />
          )}
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title
              className="font-serif text-2xl font-medium text-forest"
            >
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={closeLabel}
                className="
                  inline-flex min-h-[44px] min-w-[44px] items-center
                  justify-center rounded-lg text-forest
                "
              >
                <XIcon strokeWidth={1.5} size={24} />
              </button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
