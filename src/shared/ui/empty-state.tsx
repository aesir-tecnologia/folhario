import type { ReactNode } from "react";

/**
 * EmptyState — UI-18 single-CTA empty composition.
 *
 * 4 mandatory parts in this order (PRD §17 / D-25):
 * 1. Sage line-art illustration — currentColor stroke, 1.5px, no fills
 * 2. Source Serif 4 headline — never apologetic
 * 3. Calm Slate hint — supportive context (Plus Jakarta Sans)
 * 4. EXACTLY ONE Canopy primary CTA — never secondary, never "Saiba mais"
 *
 * The API enforces single-CTA: NO `secondaryCta` prop exists. The Vitest test
 * `tests/unit/empty-state.test.tsx` asserts the rendered tree contains
 * exactly 1 button or link descendant.
 *
 * Open Risk #3 fallback: when illustrationSrc is omitted, renders an inline
 * 64x64 placeholder SVG (generic leaf-or-pot outline) so the structure ships
 * even before founder assets land.
 */
export interface EmptyStateProps {
  headline: string;
  hint: string;
  ctaLabel: string;
  illustrationSrc?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
}

function PlaceholderLeafSvg() {
  return (
    <svg
      viewBox="0 0 64 64"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      width="64"
      height="64"
      aria-hidden="true"
      className="text-sage"
    >
      <path d="M32 8 C 16 16, 12 36, 32 56 C 52 36, 48 16, 32 8 Z" />
      <path d="M32 8 L 32 56" />
    </svg>
  );
}

export function EmptyState({
  headline,
  hint,
  ctaLabel,
  illustrationSrc,
  ctaHref,
  ctaOnClick,
}: EmptyStateProps): ReactNode {
  const cta = ctaHref ? (
    <a
      href={ctaHref}
      className="inline-flex items-center justify-center rounded-lg bg-canopy px-6 py-3 text-base font-semibold text-ivory min-h-[48px]"
    >
      {ctaLabel}
    </a>
  ) : (
    <button
      type="button"
      onClick={ctaOnClick}
      className="inline-flex items-center justify-center rounded-lg bg-canopy px-6 py-3 text-base font-semibold text-ivory min-h-[48px]"
    >
      {ctaLabel}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-4 px-5 py-8 text-center">
      {illustrationSrc ? (
        // HIGH 1b (codex review) — intentional <img> over next/image: empty-state
        // illustrations are inline SVG fallbacks (Open Risk #3 — generic leaf
        // outline) or founder-supplied SVGs delivered via single-file diff later.
        // SVGs are NOT rasterizable assets next/image optimizes, so the image
        // optimizer would be a no-op pipeline. Disable the rule for this line.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={illustrationSrc} alt="" aria-hidden="true" width={64} height={64} />
      ) : (
        <PlaceholderLeafSvg />
      )}
      <h2 className="font-serif text-2xl font-medium text-forest">{headline}</h2>
      <p className="text-sm text-slate">{hint}</p>
      {cta}
    </div>
  );
}
