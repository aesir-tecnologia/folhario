"use client";

import { motion, useReducedMotion } from "motion/react";
import { CameraIcon } from "lucide-react";
import type { ReactNode } from "react";
import { springs } from "@shared/motion/springs";

/**
 * CaptureButton — UI-20 + PRD §17.
 *
 * Circular 72px Canopy fill. The single tactile bounce in the system
 * (1.00 → 1.03 on press via springs.captureBounce — Phase 6 wires the bounce
 * onTap; Phase 3 ships the breathing-loop variant via `breathing` prop).
 *
 * **Critical UI-20 pitfall (perpetual loop):** when `breathing={true}` AND
 * useReducedMotion() returns true, the `animate` prop is DROPPED ENTIRELY
 * (not set to `{ scale: 1 }`). Otherwise the GPU layer remains composited
 * and burns battery for users who explicitly opted out of motion.
 *
 * The breathing-loop visual contract belongs to the Home empty CTA (SC-3).
 * Phase 5 wires this on Home; Phase 3 ships the primitive ready.
 */
export interface CaptureButtonProps {
  "aria-label": string;
  breathing?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}

export function CaptureButton({
  "aria-label": ariaLabel,
  breathing = false,
  onClick,
  children,
}: CaptureButtonProps) {
  const reduced = useReducedMotion();

  // CRITICAL: under reduced-motion, OMIT animate prop. NOT { scale: 1 }.
  // Conditional spread is the canonical pattern — undefined = no prop.
  const animateProps =
    breathing && !reduced
      ? { animate: { scale: [1, 1.02, 1] }, transition: springs.breathing }
      : {};

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onClick={onClick}
      className="
        flex size-[72px] min-h-[72px] items-center justify-center rounded-full
        bg-canopy text-ivory
      "
      {...animateProps}
    >
      {children ?? <CameraIcon strokeWidth={1.5} size={28} />}
    </motion.button>
  );
}
