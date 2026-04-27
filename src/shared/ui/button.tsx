import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Button — UI primitive. 4 variants (PRD §17 / D-25):
 * - primary: Canopy fill + Ivory label (48px tall, 8px radius)
 * - secondary: transparent fill + 1.5px Canopy stroke + Canopy label
 * - tertiary: Canopy label only (text link)
 * - destructive: Urgent Poppy fill + Ivory label (modal-only — toxicity / cascade-delete confirmations)
 *
 * Pure prop-driven. No "use client" — works in server + client components.
 * onClick handlers must be passed from parent client components.
 */
export type ButtonVariant = "primary" | "secondary" | "tertiary" | "destructive";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  children: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-canopy text-ivory rounded-lg px-6 min-h-[48px] font-semibold text-base",
  secondary:
    "bg-transparent border-[1.5px] border-canopy text-canopy rounded-lg px-6 min-h-[48px] font-semibold text-base",
  tertiary:
    "bg-transparent text-canopy underline underline-offset-2 px-2 min-h-[44px] font-semibold text-base",
  destructive:
    "bg-poppy text-ivory rounded-lg px-6 min-h-[48px] font-semibold text-base",
};

export function Button({
  variant = "primary",
  children,
  className,
  type = "button",
  ...rest
}: ButtonProps) {
  const variantClass = VARIANT_CLASSES[variant];
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center ${variantClass} ${className ?? ""}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
