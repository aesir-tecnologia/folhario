"use client";

import { useTranslations } from "next-intl";
import { WifiOffIcon } from "lucide-react";

import { useOnlineStatus } from "@shared/online/use-online-status";

export function IdentifyPlaceholder() {
  const online = useOnlineStatus();
  const t = useTranslations("identify.placeholder");

  return (
    <div
      className="
        flex min-h-[calc(100dvh-64px-80px)] flex-col items-center justify-center
        gap-4 px-5 py-8 text-center
      "
    >
      <h1
        className="
          font-serif text-[32px] leading-[38px] font-medium text-forest
        "
      >
        {t("title")}
      </h1>
      {online ? (
        <p className="text-base text-slate">{t("hint")}</p>
      ) : (
        <div
          role="status"
          aria-live="polite"
          className="
            flex items-center gap-2 rounded-md bg-rust/10 px-4 py-2 text-sm
            text-rust
          "
        >
          <WifiOffIcon strokeWidth={1.5} size={20} aria-hidden="true" />
          <span>{t("offlineBlocked")}</span>
        </div>
      )}
    </div>
  );
}
