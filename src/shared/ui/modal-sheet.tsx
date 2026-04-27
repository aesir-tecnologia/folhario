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
}

export function ModalSheet({
  open,
  onOpenChange,
  title,
  closeLabel,
  children,
}: ModalSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-forest/50 z-50" />
        <Dialog.Content className="fixed bottom-0 left-0 right-0 z-50 bg-ivory rounded-t-[24px] p-6 max-h-[80dvh] overflow-y-auto">
          {/* Drag handle (visual only) */}
          <div
            className="mx-auto mb-4 h-[4px] w-[36px] rounded-full bg-hairline"
            aria-hidden="true"
          />
          <div className="flex items-start justify-between gap-4">
            <Dialog.Title className="font-serif text-2xl font-medium text-forest">
              {title}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label={closeLabel}
                className="inline-flex items-center justify-center rounded-lg min-h-[44px] min-w-[44px] text-forest"
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
