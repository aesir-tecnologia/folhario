"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { HomeIcon, BookmarkIcon, CameraIcon, UserIcon } from "lucide-react";
import type { ReactNode } from "react";

/**
 * BottomNav — UI-14 + D-21 + D-23 + D-24.
 *
 * 4 tabs, 28px Lucide + label always (UI-22 — color never sole signal).
 * 56px content height + safe-area inset bottom.
 * Active indicator: 3px Canopy bar at top edge sliding via CSS transform.
 *
 * Per-tab scroll preservation helpers (saveScroll/restoreScroll) extracted as
 * named exports so they're testable in Vitest unit project (without DOM).
 * The composition that calls them lives in src/app/(app)/app-shell.tsx.
 *
 * Hash-only navigation does NOT trigger scroll save (UI-03 pitfall) — the
 * scrollKey function strips the hash before keying sessionStorage.
 */

// ---- Scroll restoration helpers (testable; consumed by app-shell.tsx) ----

export function scrollKey(pathnameOrUrl: string): string {
  // Strip hash, query — keep pathname only. Prevents hash-only changes from
  // colliding into separate sessionStorage entries.
  const path = pathnameOrUrl.split("#")[0]?.split("?")[0] ?? "/";
  return `scroll:${path}`;
}

export function saveScroll(pathname: string, scrollY: number): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(scrollKey(pathname), String(scrollY));
}

export function restoreScroll(pathname: string): number {
  if (typeof sessionStorage === "undefined") return 0;
  const raw = sessionStorage.getItem(scrollKey(pathname));
  return raw ? Number.parseInt(raw, 10) || 0 : 0;
}

/**
 * setupScrollSaveListeners — MEDIUM 5 (codex review).
 *
 * Registers `pagehide` + `visibilitychange` (hidden) handlers that save the
 * current scrollY immediately. These catch the "navigation while debounce is
 * pending" race that the cleanup-only path silently dropped.
 *
 * Returns a teardown that removes both listeners.
 */
export function setupScrollSaveListeners(pathname: string): () => void {
  if (typeof window === "undefined") return () => undefined;
  const saveCurrent = (): void => {
    saveScroll(pathname, window.scrollY);
  };
  const handleVisibility = (): void => {
    if (document.visibilityState === "hidden") saveCurrent();
  };
  window.addEventListener("pagehide", saveCurrent);
  document.addEventListener("visibilitychange", handleVisibility);
  return () => {
    window.removeEventListener("pagehide", saveCurrent);
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}

// ---- Component ----

interface NavItem {
  href: string;
  labelKey: "home" | "catalog" | "identify" | "profile";
  icon: typeof HomeIcon;
}

const ITEMS: ReadonlyArray<NavItem> = [
  { href: "/", labelKey: "home", icon: HomeIcon },
  { href: "/catalog", labelKey: "catalog", icon: BookmarkIcon },
  { href: "/identify", labelKey: "identify", icon: CameraIcon },
  { href: "/profile", labelKey: "profile", icon: UserIcon },
];

export function BottomNav(): ReactNode {
  const pathname = usePathname() ?? "/";
  const t = useTranslations("nav.tabs");

  // Active item index (drives the indicator bar position).
  // Match by exact pathname for /, prefix for nested routes.
  const activeIndex = ITEMS.findIndex((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href),
  );
  const safeIndex = activeIndex < 0 ? 0 : activeIndex;

  return (
    <nav
      aria-label="Navegação principal"
      className="
        fixed inset-x-0 bottom-0 mx-auto max-w-[480px] border-t border-hairline
        bg-ivory
      "
      style={{ paddingBottom: "var(--spacing-safe-bottom)" }}
    >
      {/* Active indicator bar — 3px Canopy, slides on tab change */}
      <span
        aria-hidden="true"
        className="
          absolute top-0 h-[3px] w-1/4 bg-canopy transition-transform
          duration-240 ease-[cubic-bezier(.2,.8,.2,1)]
          motion-reduce:transition-none
        "
        style={{ transform: `translateX(${safeIndex * 100}%)` }}
      />
      <ul className="grid min-h-[56px] grid-cols-4">
        {ITEMS.map((item, idx) => {
          const Icon = item.icon;
          const isActive = idx === safeIndex;
          return (
            <li key={item.href} className="contents">
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={`
                  flex flex-col items-center justify-center gap-1 text-xs
                  ${isActive ? "font-semibold text-canopy" : "text-slate"}
                `}
              >
                <Icon strokeWidth={1.5} size={28} aria-hidden="true" />
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
