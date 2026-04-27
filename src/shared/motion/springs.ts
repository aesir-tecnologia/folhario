/**
 * Spring physics presets — PRD §17 motion contract.
 * Deep-frozen via Object.freeze to prevent consumer mutation (UI-20 pitfall).
 *
 * Used by:
 * - springs.primary: button press, modal-sheet reveal, tab switch, toast in/out
 * - springs.captureBounce: capture button 1.00 → 1.03 → 1.00 single tactile bounce
 * - springs.breathing: empty Home capture-button 1.00 → 1.02 over 3.2s, infinite
 *
 * Consumers wrap motion components with `transition={springs.primary}` and gate
 * perpetual loops (springs.breathing) on useReducedMotion() — DROP animate prop
 * entirely under reduced-motion (NOT just stop the animation; GPU layer stays
 * composited otherwise per UI-20 pitfall).
 */
export const springs = Object.freeze({
  primary: Object.freeze({
    type: "spring",
    stiffness: 120,
    damping: 18,
    mass: 1,
  } as const),
  captureBounce: Object.freeze({
    type: "spring",
    stiffness: 400,
    damping: 24,
    mass: 0.8,
  } as const),
  breathing: Object.freeze({
    duration: 3.2,
    repeat: Infinity,
    ease: "easeInOut",
  } as const),
} as const);

export type Springs = typeof springs;
