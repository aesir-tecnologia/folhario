"use client";

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Toaster } from "sonner";

import {
  BottomNav,
  saveScroll,
  restoreScroll,
  setupScrollSaveListeners,
} from "@shared/ui/bottom-nav";
import { OfflineBanner } from "@shared/ui/offline-banner";
import { ReadOnlyBanner } from "@shared/ui/read-only-banner";
import { AppUpdateToast } from "@shared/ui/app-update-toast";

/**
 * AppShell — client orchestrator for (app) route group.
 *
 * Composition:
 * - <main tabIndex={-1} aria-label="Conteúdo principal"> wrapping {children} (D-24)
 * - <BottomNav /> at bottom
 * - <OfflineBanner /> + <ReadOnlyBanner active={false} /> at top of (app)
 * - <AppUpdateToast /> mounted as null component subscribing to SW waiting
 * - <Toaster position="bottom-center" toastOptions={{ style: { zIndex: 60 } }} />
 *
 * Lifecycle:
 * - usePathname listener calls mainRef.current?.focus() on segment change
 *   (UI-03; ignores hash-only changes via prev-pathname guard)
 * - useLayoutEffect on tab change restores scrollY from sessionStorage (D-23)
 * - Debounced (~150ms) scroll listener saves scrollY back to sessionStorage
 *   (cleanup flushes pending save under OLD pathname before clearing timer —
 *   MEDIUM 5 (codex review) fix for navigation-mid-debounce race)
 * - Additional pagehide + visibilitychange listeners save scrollY immediately
 *   for tab-hide / hard-nav / bfcache cases — MEDIUM 5 (codex review).
 *
 * Container: max-w-[480px] centered, min-h-[100dvh] (D-20 + UI-21).
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const mainRef = useRef<HTMLElement>(null);
  const prevPathnameRef = useRef<string>(pathname);
  const skipLinkText = useTranslations("focus")("skipToMain");

  // Focus management on route change (UI-03 + D-24).
  // Only refocus on actual segment change — not hash changes.
  useEffect(() => {
    if (prevPathnameRef.current !== pathname) {
      mainRef.current?.focus({ preventScroll: false });
      prevPathnameRef.current = pathname;
    }
  }, [pathname]);

  // Scroll restoration on tab change (D-23 — useLayoutEffect to avoid jump).
  useLayoutEffect(() => {
    const y = restoreScroll(pathname);
    window.scrollTo(0, y);
  }, [pathname]);

  // Debounced scroll save (~150ms per UI-14 pitfall).
  // MEDIUM 5 (codex review) — debounced listener tracks ongoing scroll, but if
  // the user navigates mid-debounce the cleanup used to clearTimeout the pending
  // save, dropping the last scrollY. Fix: flush pending save in cleanup AND
  // additionally wire pagehide + visibilitychange listeners (below) which save
  // immediately for tab-hide / hard-nav / bfcache cases.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    function onScroll() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        saveScroll(pathname, window.scrollY);
      }, 150);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (timer) {
        clearTimeout(timer);
        saveScroll(pathname, window.scrollY);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [pathname]);

  // MEDIUM 5 (codex review) — pagehide + visibilitychange listener save (NOT
  // useEffect cleanup — cleanup can fire after the navigation event has already
  // moved the layout, dropping the last save).
  useEffect(() => {
    return setupScrollSaveListeners(pathname);
  }, [pathname]);

  return (
    <div className="mx-auto max-w-[480px] min-h-[100dvh] bg-paper">
      {/* Skip-to-main link — UI-22 first focusable element */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] bg-canopy text-ivory px-4 py-2 rounded-lg"
      >
        {skipLinkText}
      </a>

      <OfflineBanner />
      <ReadOnlyBanner active={false} />

      <main
        id="main"
        ref={mainRef}
        tabIndex={-1}
        aria-label="Conteúdo principal"
        className="pb-[80px]"
      >
        {children}
      </main>

      <BottomNav />
      <AppUpdateToast />
      <Toaster
        position="bottom-center"
        toastOptions={{ style: { zIndex: 60 } }}
      />
    </div>
  );
}
