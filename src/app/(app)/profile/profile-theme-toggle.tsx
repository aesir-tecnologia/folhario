"use client";

import { useTransition, useState } from "react";
import { useTranslations } from "next-intl";
import { Select } from "@shared/ui/select";
import { setTheme, type ThemeValue } from "@shared/theme/use-theme";

/**
 * ProfileThemeSelect — D-13 + MEDIUM 7 (codex review).
 *
 * Three-state segmented control (auto / light / dark) — NOT a binary Toggle.
 * Filename retained for files_modified continuity per the plan, but the
 * exported component name + JSX use Select wording.
 */
export function ProfileThemeSelect({ initial }: { initial: ThemeValue }) {
  const [value, setValue] = useState<ThemeValue>(initial);
  const [, startTransition] = useTransition();
  const t = useTranslations("theme.toggle");

  return (
    <Select
      label={t("label")}
      value={value}
      onChange={(e) => {
        const next = e.target.value as ThemeValue;
        setValue(next);
        startTransition(() => {
          void setTheme(next);
        });
      }}
      options={[
        { value: "auto", label: t("options.auto") },
        { value: "light", label: t("options.light") },
        { value: "dark", label: t("options.dark") },
      ]}
    />
  );
}
