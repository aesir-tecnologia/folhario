"use client";

/**
 * Re-export of motion/react useReducedMotion for clean import path.
 *
 * Returns `boolean | null` — null on first SSR render, then resolves on hydration.
 * Treat null as false (motion runs); test mocks the hook directly per
 * tests/unit/breathing-loop.test.tsx.
 *
 * Pitfall (UI-20): for perpetual loops (capture button breathing), DROP the
 * animate prop ENTIRELY under reduced-motion — do NOT just stop the animation
 * (GPU layer stays composited; battery cost). See src/shared/ui/capture-button.tsx
 * for the canonical pattern.
 */
export { useReducedMotion } from "motion/react";
