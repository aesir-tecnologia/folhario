"use client";

import { useState } from "react";
import { ModalSheet } from "@shared/ui/modal-sheet";

export function ModalSheetTestHarness() {
  const [open, setOpen] = useState(true);
  return (
    <main className="min-h-[100dvh] bg-paper p-6">
      <button
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
