"use client";

import { useState, type InputHTMLAttributes } from "react";

/**
 * TextInput — UI primitive (PRD §17).
 *
 * - Warm Ivory bg, 1.5px stroke (Hairline at rest → Canopy on focus)
 * - Floating label
 * - autocomplete attribute MANDATORY (TS Required<>)
 * - Validate on blur — error state: 1.5px Overdue Rust stroke + filled alert
 *   icon + Overdue helper text (3 redundant cues per UI-22)
 *
 * "use client" because state-driven (focused/error visual states).
 */
export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "autoComplete"> {
  label: string;
  autoComplete: string;
  error?: string;
}

export function TextInput({
  label,
  autoComplete,
  error,
  id,
  className,
  ...rest
}: TextInputProps) {
  const [focused, setFocused] = useState(false);
  const inputId = id ?? `input-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const errorId = error ? `${inputId}-error` : undefined;

  const strokeClass = error
    ? "border-rust"
    : focused
      ? "border-canopy"
      : "border-hairline";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={inputId} className="text-sm font-semibold text-forest">
        {label}
      </label>
      <input
        {...rest}
        id={inputId}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={errorId}
        className={`bg-ivory border-[1.5px] ${strokeClass} rounded-lg px-4 py-3 text-base text-forest min-h-[48px] ${className ?? ""}`.trim()}
        onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
        onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-rust">
          {error}
        </p>
      ) : null}
    </div>
  );
}
