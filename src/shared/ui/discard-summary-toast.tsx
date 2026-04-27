"use client";

import { toast } from "sonner";

/**
 * showDiscardSummaryToast — UI-24 + D-31a.
 *
 * Function-driven toast helper. Phase 9 invokes after offline queue sync
 * with the actual queue outcomes (e.g., dropped-actions count). Phase 3
 * ships the helper with i18n-aware default copy; queue wiring lands later.
 *
 * Usage (Phase 9):
 *   showDiscardSummaryToast({ label: t("sync.discardSummary.label"), onClick: openModal })
 */
export interface DiscardSummaryToastProps {
  label: string;
  ctaLabel?: string;
  onClick?: () => void;
}

export function showDiscardSummaryToast({
  label,
  ctaLabel,
  onClick,
}: DiscardSummaryToastProps): void {
  toast(label, {
    duration: 8_000,
    ...(ctaLabel && onClick
      ? { action: { label: ctaLabel, onClick } }
      : {}),
  });
}
