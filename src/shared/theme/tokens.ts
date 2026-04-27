/**
 * JS-side design tokens — Phase 3 D-02.
 *
 * Two distinct usage classes; do NOT confuse them:
 *
 * 1. `tokens.colors.{light,dark}` — JS MIRROR of CSS custom properties
 *    declared in `src/app/globals.css` `@theme` block. The CSS file is the
 *    single source of truth at runtime — Tailwind v4 utilities derive from
 *    those `@theme` keys. This module re-exports the SAME hex values so
 *    motion-library config and JS consumers (e.g., conditional className
 *    logic, dynamic inline-style computations) can reference them without
 *    parsing CSS. The Vitest snapshot test in
 *    `tests/unit/banned-patterns-snapshot.test.ts` cross-checks color drift
 *    between this file and `globals.css` (W-5 fix).
 *
 * 2. `tokens.spacing` / `tokens.radii` / `tokens.focus` — JS-ONLY constants
 *    for inline-style consumers (motion library transitions, dynamic CSS
 *    computations, JS-driven px math). The Tailwind utility scale (e.g.,
 *    `p-4`, `gap-2`, `rounded-lg`) is independently owned by Tailwind v4 in
 *    `globals.css` `@theme` block — utilities and these JS values are NOT
 *    cross-checked. If you need them aligned, edit BOTH this module AND the
 *    `@theme` block. (W-5 fix — alternative to extracting spacing into
 *    `@theme` was rejected to keep `tokens.ts` decoupled from Tailwind v4
 *    plugin loading.)
 *
 * Source: PRD §17 + Phase 3 D-02.
 */

export const tokens = Object.freeze({
  colors: Object.freeze({
    light: Object.freeze({
      paper: "#FBF7EF",
      ivory: "#FFFDF7",
      hairline: "#E8E1D0",
      canopy: "#1F4D35",
      forest: "#143424",
      slate: "#5A6358",
      sage: "#8AA593",
      terracotta: "#C96F4A",
      honey: "#D4A340",
      poppy: "#C73E1D",
      rust: "#A14A2C",
      trust: "#2B6F7A",
    }),
    dark: Object.freeze({
      paper: "#1A1613",
      ivory: "#231E1A",
      hairline: "#3A332B",
      canopy: "#6FAE8A",
      forest: "#F2EADB",
      slate: "#B8B0A5",
      sage: "#A6BFAE",
      terracotta: "#E08B66",
      honey: "#E8BC5E",
      poppy: "#E8593A",
      rust: "#C96A44",
      trust: "#5BA5B0",
    }),
  }),
  spacing: Object.freeze({
    s05: "2px",
    s1: "4px",
    s2: "8px",
    s3: "12px",
    s4: "16px",
    s5: "20px",
    s6: "24px",
    s8: "32px",
    s12: "48px",
    s14: "56px",
    s18: "72px",
    s24: "96px",
  }),
  radii: Object.freeze({
    button: "8px",
    card: "16px",
    modalSheet: "24px",
    pill: "999px",
  }),
  focus: Object.freeze({
    ringWidth: "3px",
    ringOffset: "2px",
    ringOpacity: 0.4,
  }),
} as const);

export type Tokens = typeof tokens;
export type ColorScheme = "light" | "dark";
