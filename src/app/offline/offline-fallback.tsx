"use client";

import { EmptyState } from "@shared/ui/empty-state";

/**
 * OfflineFallback — D-15. Client wrapper for /offline page so the EmptyState
 * CTA can call location.reload() (the SW navigation fallback only fires when
 * the network is down, so the CTA is a "try again" reload).
 */
export function OfflineFallback({
  title,
  hint,
  cta,
}: {
  title: string;
  hint: string;
  cta: string;
}) {
  return (
    <main className="min-h-[100dvh] flex items-center justify-center bg-paper">
      <EmptyState
        headline={title}
        hint={hint}
        ctaLabel={cta}
        ctaOnClick={() => location.reload()}
      />
    </main>
  );
}
