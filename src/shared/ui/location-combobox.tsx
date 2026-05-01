"use client";

import { useTranslations } from "next-intl";
import { Combobox, type ComboboxOption } from "./combobox";

export interface LocationComboboxProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];
  id?: string;
  name?: string;
  "aria-describedby"?: string;
  "data-testid"?: string;
  disabled?: boolean;
}

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

export function LocationCombobox({
  label,
  placeholder,
  value,
  onChange,
  suggestions,
  id,
  name,
  "aria-describedby": ariaDescribedby,
  "data-testid": dataTestId,
  disabled,
}: LocationComboboxProps) {
  const t = useTranslations("catalog.locations");
  const defaults = t.raw("defaults") as string[];

  const merged: ComboboxOption[] = [];
  const seen = new Set<string>();
  for (const label_ of [...suggestions, ...defaults]) {
    const key = norm(label_);
    if (key && !seen.has(key)) {
      seen.add(key);
      merged.push({ value: label_, label: label_ });
    }
  }

  return (
    <Combobox
      label={label}
      placeholder={placeholder ?? t("placeholder")}
      value={value}
      onChange={onChange}
      options={merged}
      ghostRowTemplate={t.raw("addRow") as string}
      id={id}
      name={name}
      aria-describedby={ariaDescribedby}
      data-testid={dataTestId}
      disabled={disabled}
    />
  );
}
