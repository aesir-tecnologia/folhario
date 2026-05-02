"use client";

import Image from "next/image";
import * as Dialog from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { useRef, type KeyboardEvent, type TouchEvent } from "react";

export interface LightboxPhoto {
  id: string;
  src: string;
  caption?: string;
}

export interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (next: number) => void;
  plantName: string;
  closeLabel: string;
  onCloseAutoFocus?: (event: Event) => void;
}

export function Lightbox({
  open,
  onOpenChange,
  photos,
  index,
  onIndexChange,
  plantName,
  closeLabel,
  onCloseAutoFocus,
}: LightboxProps) {
  const reduced = useReducedMotion();
  const touchStartRef = useRef<{ x: number; t: number } | null>(null);

  // Animation class selection per UI-SPEC §9 lines 446-449.
  // Under reduced-motion: opacity-only ~80ms instant fade. NO transform/scale animation.
  // Normal: transform + opacity ~240ms with Radix data-state classes.
  const animationClass = reduced
    ? "transition-opacity duration-[80ms]"
    : "transition-all duration-[240ms] data-[state=open]:scale-100 data-[state=closed]:scale-95 data-[state=open]:opacity-100 data-[state=closed]:opacity-0";

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (e.touches.length > 1) {
      // Multi-touch (pinch-zoom) — do NOT preventDefault, do NOT track.
      // Decision C: pinch-zoom is native browser default.
      touchStartRef.current = null;
      return;
    }
    const touch = e.changedTouches[0];
    if (!touch) return;
    touchStartRef.current = {
      x: touch.clientX,
      t: performance.now(),
    };
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current;
    if (!start) return;
    touchStartRef.current = null;

    const endTouch = e.changedTouches[0];
    if (!endTouch) return;
    const endX = endTouch.clientX;
    const endT = performance.now();
    const dx = endX - start.x;
    const dt = Math.max(endT - start.t, 1);
    const velocity = Math.abs(dx) / dt;

    // UI-SPEC §9 line 439: distance ≥ 80px AND velocity ≥ 0.3 px/ms — both must hold.
    if (Math.abs(dx) >= 80 && velocity >= 0.3) {
      if (dx < 0) {
        // Swipe left → advance next (clamp at last — Decision D: no wrap)
        onIndexChange(Math.min(index + 1, photos.length - 1));
      } else {
        // Swipe right → advance prev (clamp at 0 — Decision D: no wrap)
        onIndexChange(Math.max(index - 1, 0));
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // ArrowLeft/ArrowRight navigate prev/next. Clamp at boundaries — do NOT wrap.
    // Decision D: wrapping in keyboard navigation creates surprise with hundreds of photos.
    // Esc dismiss is Radix default — do NOT add a custom Esc handler.
    if (e.key === "ArrowLeft") {
      onIndexChange(Math.max(index - 1, 0));
    } else if (e.key === "ArrowRight") {
      onIndexChange(Math.min(index + 1, photos.length - 1));
    }
  }

  const currentPhoto = photos[index];
  const altText = currentPhoto?.caption ?? `Foto ${index + 1} de ${photos.length}`;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-forest/90" />
        <Dialog.Content
          aria-label={`Galeria — ${plantName}`}
          onCloseAutoFocus={onCloseAutoFocus}
          onKeyDown={handleKeyDown}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`
            fixed inset-0 z-50 flex flex-col items-center justify-center
            bg-transparent outline-none
            ${animationClass}
          `}
        >
          <Dialog.Title className="sr-only">{`Galeria — ${plantName}`}</Dialog.Title>
          <Dialog.Description className="sr-only">
            {`Galeria de fotos. Foto ${index + 1} de ${photos.length}.`}
          </Dialog.Description>

          {/* Fechar button — top-right, 44×44 tap target, always visible when open */}
          <Dialog.Close asChild>
            <button
              type="button"
              aria-label={closeLabel}
              className="
                absolute top-4 right-4 z-10 inline-flex min-h-[44px]
                min-w-[44px] items-center justify-center rounded-full
                bg-forest/60 text-ivory
                hover:bg-forest/80
              "
            >
              <XIcon strokeWidth={1.5} size={24} />
            </button>
          </Dialog.Close>

          {/* Photo */}
          {currentPhoto && (
            <Image
              unoptimized
              width={1920}
              height={1080}
              src={currentPhoto.src}
              alt={altText}
              className="size-auto max-h-[90vh] max-w-[90vw] object-contain"
            />
          )}

          {currentPhoto?.caption && (
            <p
              className="
                absolute inset-x-6 bottom-16 line-clamp-2 text-center text-sm
                text-ivory
              "
            >
              {currentPhoto.caption}
            </p>
          )}

          {/* Index indicator — only when ≥2 photos; aria-live=polite announces changes */}
          {photos.length >= 2 && (
            <span
              aria-live="polite"
              className="
                absolute bottom-6 left-1/2 -translate-x-1/2 text-sm
                font-semibold text-ivory
              "
            >
              {`${index + 1} / ${photos.length}`}
            </span>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
