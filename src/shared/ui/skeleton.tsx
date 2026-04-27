"use client";

import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { useReducedMotion } from "motion/react";

/**
 * Skeleton — single shimmer block with fixed dimensions.
 *
 * Width MUST be explicit (px or ch) per UI-17 pitfall — otherwise content
 * "jumps in" when the real value loads. Height defaults to 1.4 line-heights
 * (12px); pass via `style` prop to override.
 *
 * Under prefers-reduced-motion: drops the shimmer keyframes and renders a
 * static Hairline-Beige block with 80ms opacity fade-in (PRD §17 spec).
 */
export interface SkeletonProps {
  width: number | string;
  height?: number | string;
  className?: string;
  "data-testid"?: string;
}

export function Skeleton({ width, height, className, ...rest }: SkeletonProps) {
  const reduced = useReducedMotion();
  const widthCss = typeof width === "number" ? `${width}px` : width;
  const heightCss =
    typeof height === "number" ? `${height}px` : height ?? "1em";

  const baseClass = "rounded-lg bg-hairline";
  const motionClass = reduced
    ? "transition-opacity duration-[80ms]"
    : "animate-shimmer";

  return (
    <span
      className={`inline-block ${baseClass} ${motionClass} ${className ?? ""}`.trim()}
      style={{ width: widthCss, height: heightCss } as CSSProperties}
      aria-hidden="true"
      {...rest}
    />
  );
}

/**
 * SkeletonGroup — JS-timer 300ms gate.
 *
 * Returns null for the first 300ms after mount; renders children after the
 * gate passes. Faster operations skip the shimmer entirely. Cleans the timer
 * on unmount to avoid stale renders on fast navigation (UI-17 pitfall).
 *
 * **CONTRACT (Open Risk #6):** This is a CLIENT loading-indicator contract
 * — for `<form>` submit, useTransition, or any client state transition.
 * NOT for Suspense fallbacks (server streams the resolved content before
 * the client timer fires; gate becomes moot).
 */
export interface SkeletonGroupProps {
  children: ReactNode;
  delay?: number;
}

export function SkeletonGroup({ children, delay = 300 }: SkeletonGroupProps) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  if (!show) return null;
  return <>{children}</>;
}
