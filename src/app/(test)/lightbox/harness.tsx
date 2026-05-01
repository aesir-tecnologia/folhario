"use client";

import { useEffect, useRef, useState } from "react";

import { Lightbox, type LightboxPhoto } from "@shared/ui/lightbox";

const FIXTURE_PHOTOS: LightboxPhoto[] = [
  {
    id: "photo-1",
    src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMxNDM0MjQiLz48L3N2Zz4=",
  },
  {
    id: "photo-2",
    src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiM0YTdhNWIiLz48L3N2Zz4=",
    caption: "Segunda foto",
  },
  {
    id: "photo-3",
    src: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciPjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiNiMzVhMzIiLz48L3N2Zz4=",
  },
];

export function LightboxTestHarness() {
  const [state, setState] = useState<{ open: boolean; index: number }>({
    open: false,
    index: 0,
  });
  const invokerRef = useRef<HTMLButtonElement>(null);

  // Autofocus the invoker on mount so Radix can snapshot it as the "previously
  // focused element" before the dialog opens — Radix Dialog returns focus to
  // whatever element the document had focus on when the dialog opened.
  useEffect(() => {
    invokerRef.current?.focus();
  }, []);

  return (
    <main className="min-h-[100dvh] bg-paper p-6">
      <h1 className="mb-6 font-serif text-2xl text-forest">Lightbox test harness</h1>
      <button
        ref={invokerRef}
        type="button"
        data-testid="lightbox-invoker"
        onClick={() => setState({ open: true, index: 0 })}
        className="rounded-lg bg-canopy px-6 font-semibold text-ivory min-h-[48px]"
      >
        Abrir Lightbox
      </button>
      <Lightbox
        open={state.open}
        onOpenChange={(open) => setState((s) => ({ ...s, open }))}
        photos={FIXTURE_PHOTOS}
        index={state.index}
        onIndexChange={(next) => setState((s) => ({ ...s, index: next }))}
        plantName="Manjericão"
        closeLabel="Fechar"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          invokerRef.current?.focus();
        }}
      />
    </main>
  );
}
