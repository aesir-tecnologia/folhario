"use client";

import { useId } from "react";

/**
 * Toggle — UI primitive (PRD §17).
 *
 * 52x32 track / 28x28 knob; Canopy on / Hairline off.
 * ON/OFF text label always visible (UI-22 redundant cue — color is not the
 * sole signal; the label text + track color + knob position combine).
 * Minimum 44px touch target via min-h-[44px] on the label wrapper.
 */
export interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  id?: string;
}

export function Toggle({ label, checked, onChange, id }: ToggleProps) {
  const reactId = useId();
  const toggleId = id ?? reactId;
  const trackClass = checked ? "bg-canopy" : "bg-hairline";
  const knobX = checked ? "translate-x-[20px]" : "translate-x-0";

  return (
    <label
      htmlFor={toggleId}
      className="inline-flex min-h-[44px] cursor-pointer items-center gap-3"
    >
      <input
        id={toggleId}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
        aria-label={label}
      />
      <span
        aria-hidden="true"
        className={`
          relative inline-block h-[32px] w-[52px] rounded-full
          ${trackClass}
          peer-focus-visible:ring-[3px] peer-focus-visible:ring-canopy/40
        `}
      >
        <span
          className={`
            absolute top-[2px] left-[2px] size-[28px] rounded-full bg-ivory
            transition-transform
            ${knobX}
          `}
        />
      </span>
      <span className="text-base text-forest">{label}</span>
    </label>
  );
}
