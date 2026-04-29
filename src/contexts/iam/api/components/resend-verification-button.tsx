"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@shared/ui/button";

/**
 * Phase 4 UI-SPEC §3 — resend-verification cooldown UX.
 *
 * Optimistic disable + label transitions:
 *   resend → resending → cooldown(N) → resend
 *
 * Server-side 429 trips a 60-second local cooldown to keep the UI in
 * sync with the per-user resend rate-limit (CONTEXT D-08, 1/min).
 */
export function ResendVerificationButton() {
  const t = useTranslations("auth.unverifiedBlocker");
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [announceReady, setAnnounceReady] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  function startCooldown(seconds: number) {
    setCooldown(seconds);
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setCooldown((c) => {
        if (c <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          intervalRef.current = null;
          setAnnounceReady(true);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  async function handleClick() {
    if (cooldown > 0 || isSending) return;
    setIsSending(true);
    setAnnounceReady(false);
    try {
      const resp = await fetch("/api/v1/iam/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (resp.status === 429) {
        startCooldown(60);
      } else if (resp.ok) {
        startCooldown(60);
      }
    } finally {
      setIsSending(false);
    }
  }

  const label = isSending
    ? t("resending")
    : cooldown > 0
      ? t("cooldown", { seconds: cooldown })
      : t("resend");

  const disabled = cooldown > 0 || isSending;

  return (
    <div className="flex w-full max-w-[320px] flex-col items-center">
      <Button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        aria-live="polite"
        className={`w-full ${disabled ? "cursor-not-allowed opacity-70" : ""}`.trim()}
      >
        {label}
      </Button>
      {announceReady ? (
        <span aria-live="polite" className="sr-only">
          {t("cooldownDoneAnnouncement")}
        </span>
      ) : null}
    </div>
  );
}
