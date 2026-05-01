"use client";

import type { ReactNode } from "react";

import { ModalSheet, type ModalSheetProps } from "@shared/ui/modal-sheet";

export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  /**
   * "alertdialog" for destructive surfaces (D-07 delete-confirm, UI-SPEC §7 line 367).
   * Screen readers announce the sheet content as a higher-priority alert.
   * Defaults to "dialog" for non-destructive surfaces (D-15 photo-journal add).
   */
  role?: "dialog" | "alertdialog";
  /**
   * Forwarded to ModalSheet. Controlled callers can use this hook to
   * preventDefault and focus a stored invoker ref themselves.
   * UI-SPEC §7 Cancel-first autofocus: consumer marks the Cancel button
   * with the standard `autoFocus` attribute — no extra prop needed here.
   */
  onCloseAutoFocus?: ModalSheetProps["onCloseAutoFocus"];
}

/**
 * BottomSheet — Phase 5 D-07 / D-15 primitive composing Phase 3 ModalSheet.
 *
 * Adds vs. ModalSheet:
 *  - Drag handle promoted to keyboard-reachable close affordance
 *    (Enter/Space dismisses) — PRD §17 visible close redundancy.
 *  - Optional role="alertdialog" for destructive surfaces (UI-SPEC §7).
 *  - prefers-reduced-motion: honoured via Tailwind motion-reduce: variants
 *    on Dialog.Content (no slide animation under reduced-motion OS preference).
 *
 * Inherited from ModalSheet: 24px top radius, 36×4 Hairline drag bar,
 * focus trap + return focus (Radix Dialog), 50% scrim, visible Fechar
 * button (top-right), tap-scrim dismissal, sonner z-index coexistence.
 *
 * Cancel-first autofocus (UI-SPEC §7): consumer marks the Cancel button
 * with the standard `autoFocus` attribute. Radix initial-focus lands on
 * the autofocused descendant — no extra prop on this primitive.
 *
 * Phase 4 LGPD consent modal: unaffected — BottomSheet is a NEW component;
 * ModalSheet's additive props have safe defaults that keep existing consumers
 * byte-identical.
 */
export function BottomSheet(props: BottomSheetProps) {
  return <ModalSheet {...props} role={props.role ?? "dialog"} interactiveDragHandle />;
}
