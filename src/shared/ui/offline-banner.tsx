"use client";

import { useTranslations } from "next-intl";
import { WifiOffIcon } from "lucide-react";
import { useOnlineStatus } from "@shared/online/use-online-status";

/**
 * OfflineBanner — UI-24. Top of (app) shell.
 * Renders icon + text (UI-22 redundant cue: WifiOff icon next to label).
 * Hidden when online.
 */
export function OfflineBanner() {
  const online = useOnlineStatus();
  const t = useTranslations("offline.banner");

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-rust/10 px-4 py-2 text-sm text-rust"
    >
      <WifiOffIcon strokeWidth={1.5} size={20} aria-hidden="true" />
      <span>{t("label")}</span>
    </div>
  );
}
