"use client";

import { useTranslations } from "next-intl";

/**
 * Phase 4 — single-device logout per AUTH-14 + D-05. POSTs JSON to the
 * logout route (D-31) and redirects to /auth/login regardless of the
 * server response (logout is idempotent per Plan 04-07).
 */
export function LogoutLink({
  translationKey,
  namespace = "auth.unverifiedBlocker",
  className,
}: {
  translationKey: string;
  namespace?: string;
  className?: string;
}) {
  const t = useTranslations(namespace);
  async function handleClick(e: React.MouseEvent<HTMLAnchorElement>) {
    e.preventDefault();
    try {
      await fetch("/api/v1/iam/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
    } finally {
      try {
        const { del } = await import("idb-keyval");
        await del("folhario.query-cache");
      } catch {
        // swallow — best-effort IDB clear; per-user buster already
        // mitigates cross-user IDB poisoning at the persister level
      }
      try {
        if ("caches" in window) {
          await Promise.all([caches.delete("folhario-catalog-api-v1")]);
        }
      } catch {
        // swallow — best-effort SW cache purge (T-05-10-06 belt-and-braces)
      }
      window.location.href = "/auth/login";
    }
  }
  return (
    <a
      href="/auth/login"
      onClick={handleClick}
      className={className ?? "text-base text-canopy underline"}
    >
      {t(translationKey)}
    </a>
  );
}
