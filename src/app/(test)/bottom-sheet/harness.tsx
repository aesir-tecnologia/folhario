"use client";

import { useEffect, useRef, useState } from "react";

import { BottomSheet } from "@shared/ui/bottom-sheet";

/**
 * Test harness for BottomSheet a11y verification (Plan 05-13).
 *
 * Uses role="alertdialog" — the higher-coverage path exercising the
 * destructive delete-confirm variant (D-07). The default dialog variant is
 * covered by unit-dom Test 6.
 *
 * Three focusable children inside the sheet:
 *   - input (first focusable, NOT autofocused)
 *   - Cancelar button (autoFocus — UI-SPEC §7 Cancel-first contract)
 *   - Excluir planta button (dangerous action, intentionally NOT autofocused)
 *
 * The invoker is autofocused on mount via useEffect so Radix can snapshot it
 * as the "previously focused element" before the dialog opens — Radix Dialog
 * returns focus to whatever the document had focus on when it opened.
 */
export function BottomSheetTestHarness() {
  const [open, setOpen] = useState(false);
  const invokerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    invokerRef.current?.focus();
  }, []);
  return (
    <main className="min-h-dvh bg-paper p-6">
      <button
        ref={invokerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="
          min-h-[48px] rounded-lg bg-canopy px-6 font-semibold text-ivory
        "
        data-testid="bottomsheet-invoker"
      >
        Open BottomSheet
      </button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        role="alertdialog"
        title="BottomSheet test harness"
        closeLabel="Fechar"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          invokerRef.current?.focus();
        }}
      >
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="First focusable (not autofocused)"
            className="rounded-lg border border-hairline p-3"
            data-testid="bottomsheet-input"
          />
          <button
            type="button"
            autoFocus
            className="
              min-h-[48px] rounded-lg bg-canopy px-6 font-semibold text-ivory
            "
            data-testid="bottomsheet-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="
              min-h-[48px] rounded-lg bg-forest px-6 font-semibold text-ivory
            "
            data-testid="bottomsheet-confirm"
          >
            Excluir planta
          </button>
        </div>
      </BottomSheet>
    </main>
  );
}
