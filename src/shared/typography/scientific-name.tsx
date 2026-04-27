import type { ReactNode } from "react";

/**
 * Latin scientific name wrapper — UI-23 + PRD §17 typography rules.
 *
 * Renders <i lang="la">{children}</i> with Plus Jakarta Sans 14 italic
 * Calm Slate / Lantern Slate styling. Tailwind utilities from globals.css
 * @theme tokens: text-slate (light) / text-slate dark counterpart auto-resolves.
 *
 * No "use client" directive — pure server component. First consumed by
 * Phase 5 plant cards and Phase 6 identification results.
 *
 * Children are TREATED AS DATA (a Latin binomial) and exempted from the
 * UI-23 no-hardcoded-strings rule per RESEARCH.md UI-23 pitfall.
 */
export function ScientificName({ children }: { children: ReactNode }) {
  return (
    <i lang="la" className="font-sans text-sm text-slate italic">
      {children}
    </i>
  );
}
