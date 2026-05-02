"use client";

import { type SelectHTMLAttributes } from "react";
import { ChevronDownIcon } from "lucide-react";

/**
 * Select — UI primitive (PRD §17).
 *
 * Same geometry as TextInput: Ivory bg, 1.5px Hairline stroke, 48px min-height.
 * Chevron icon from lucide-react (per-icon import per D-05).
 * Error state: 1.5px Overdue Rust stroke + role=alert helper text (UI-22).
 */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
}

export function Select({ label, options, error, id, className, ...rest }: SelectProps) {
  const selectId = id ?? `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = error ? `${selectId}-error` : undefined;
  const strokeClass = error ? "border-rust" : "border-hairline";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-semibold text-forest">
        {label}
      </label>
      <div className="relative">
        <select
          {...rest}
          id={selectId}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={`appearance-none w-full bg-ivory border-[1.5px] ${strokeClass} rounded-lg px-4 py-3 pr-10 text-base text-forest min-h-[48px] ${className ?? ""}`.trim()}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          strokeWidth={1.5}
          size={20}
          className="
            pointer-events-none absolute top-1/2 right-3 -translate-y-1/2
            text-slate
          "
        />
      </div>
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-rust">
          {error}
        </p>
      ) : null}
    </div>
  );
}
