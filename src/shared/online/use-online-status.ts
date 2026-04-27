"use client";

import { useEffect, useState } from "react";

/**
 * useOnlineStatus — UI-24 cross-cutting hook.
 *
 * Composition (D-30):
 * - navigator.onLine + window 'online'/'offline' events as the fast signal
 * - 30s heartbeat to /api/v1/health/connectivity as the source-of-truth signal
 *   (catches captive portals + browser onLine false positives)
 *
 * Backoff (T-03-04-02 DoS mitigation):
 * - 30s when online (initial)
 * - 60s after a successful ping (relaxes pressure on connectivity endpoint)
 * - 5s when window 'online' event fires after offline period (catches reconnect quickly)
 *
 * Uses setTimeout (NOT setInterval — interval drifts under tab throttling).
 *
 * URL is the literal "/api/v1/health/connectivity". The Vitest test asserts
 * the literal string match — drifting to /api/v1/diagnostics/ping fails the test
 * (that route is CI/stub-mode gated and 404s in production).
 */
const HEARTBEAT_URL = "/api/v1/health/connectivity" as const;
const POLL_INITIAL = 30_000;
const POLL_AFTER_SUCCESS = 60_000;
const POLL_AFTER_RECONNECT = 5_000;

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    async function ping(): Promise<boolean> {
      try {
        const res = await fetch(HEARTBEAT_URL, { method: "GET", cache: "no-store" });
        return res.ok;
      } catch {
        return false;
      }
    }

    function schedule(delay: number) {
      if (cancelled) return;
      timer = setTimeout(async () => {
        const ok = await ping();
        if (cancelled) return;
        setOnline(ok);
        schedule(ok ? POLL_AFTER_SUCCESS : POLL_AFTER_RECONNECT);
      }, delay);
    }

    function handleOnline() {
      setOnline(true);
      if (timer) clearTimeout(timer);
      schedule(POLL_AFTER_RECONNECT);
    }

    function handleOffline() {
      setOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    schedule(POLL_INITIAL);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return online;
}
