import type { ReactNode } from "react";

/**
 * InlineError — UI-19 calm inline error.
 *
 * REQUIRED slots (TypeScript Required<>):
 * - cause: what went wrong, plain language
 * - recovery: what the user can do next
 * - retry: { label, onClick } — visible retry path
 *
 * Color is Overdue Rust. NEVER Urgent Poppy — Poppy is reserved for TOXICITY
 * + DESTRUCTIVE only (PRD §17 + UI-19). Lint-enforced at file level via
 * banned-patterns snapshot.
 *
 * role="alert" on container (UI-22 redundant cue: AT announces immediately).
 */
export interface InlineErrorProps {
  cause: string;
  recovery: string;
  retry: { label: string; onClick: () => void };
}

export function InlineError({ cause, recovery, retry }: InlineErrorProps): ReactNode {
  return (
    <div
      role="alert"
      className="
        flex flex-col gap-2 rounded-lg border border-rust bg-ivory px-4 py-3
        text-sm text-rust
      "
    >
      <p className="font-semibold">{cause}</p>
      <p className="text-slate">{recovery}</p>
      <button
        type="button"
        onClick={retry.onClick}
        className="
          min-h-[44px] self-start rounded-lg bg-canopy px-4 py-2 text-sm
          font-semibold text-ivory
        "
      >
        {retry.label}
      </button>
    </div>
  );
}
