import type { ReactNode } from "react";
import { AppShell } from "./app-shell";

/**
 * (app) route group layout — server component.
 *
 * Mounts the client AppShell which owns bottom nav, banners, toasts, scroll
 * restoration, and focus management on route change. This layout itself does
 * NOTHING beyond the mount — it stays a server component so the children tree
 * can include both server and client components.
 *
 * Open Risk #4 — DOES NOT read folhario_theme cookie. Root layout
 * (src/app/layout.tsx) is the sole owner of the theme cookie + <html data-theme>
 * attribute. Adding a competing cookie read here would not be visible to the
 * root layout on cookie-write re-render.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
