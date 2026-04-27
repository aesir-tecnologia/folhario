"use client";

import { useEffect, useRef, useState } from "react";
import { ModalSheet } from "@shared/ui/modal-sheet";

export function ModalSheetTestHarness() {
  const [open, setOpen] = useState(false);
  const invokerRef = useRef<HTMLButtonElement>(null);
  // Autofocus the invoker on mount so Radix can snapshot it as the "previously
  // focused element" before the dialog opens — Radix Dialog returns focus to
  // whatever the document had focus on when it opened.
  useEffect(() => {
    invokerRef.current?.focus();
  }, []);
  return (
    <main className="min-h-[100dvh] bg-paper p-6">
      <button
        ref={invokerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="bg-canopy text-ivory rounded-lg px-6 min-h-[48px] font-semibold"
        data-testid="modal-invoker"
      >
        Open ModalSheet
      </button>
      <ModalSheet
        open={open}
        onOpenChange={setOpen}
        title="ModalSheet test harness"
        closeLabel="Fechar"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          invokerRef.current?.focus();
        }}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="First focusable"
            className="border border-hairline rounded-lg p-3"
            data-testid="modal-input"
          />
          <input
            type="checkbox"
            data-testid="modal-checkbox"
          />
          <button
            type="button"
            className="bg-canopy text-ivory rounded-lg px-6 min-h-[48px]"
            data-testid="modal-button"
          >
            Inner action
          </button>
        </div>
      </ModalSheet>
    </main>
  );
}
