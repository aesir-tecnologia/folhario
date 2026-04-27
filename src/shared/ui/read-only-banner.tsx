"use client";

import { useTranslations } from "next-intl";
import { LockIcon } from "lucide-react";

/**
 * ReadOnlyBanner — UI-24 + D-31.
 *
 * Client component (uses `next-intl` `useTranslations` hook). Prop-driven
 * `active` flag. Phase 3 ships with `active=false` everywhere; Phase 10 wires
 * real subscription state into the prop.
 *
 * HIGH 1c (codex review) — `"use client"` MUST be the first statement in the
 * file (line 1). React treats the directive as data-only when it appears after
 * imports, so the component would silently render as a server component and
 * `useTranslations()` would throw at build time.
 */
export interface ReadOnlyBannerProps {
  active: boolean;
}

export function ReadOnlyBanner({ active }: ReadOnlyBannerProps) {
  const t = useTranslations("readonly.banner");

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 bg-honey/10 px-4 py-2 text-sm text-rust"
    >
      <LockIcon strokeWidth={1.5} size={20} aria-hidden="true" />
      <span>{t("label")}</span>
    </div>
  );
}
