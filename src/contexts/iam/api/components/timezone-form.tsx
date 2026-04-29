"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@shared/ui/button";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 — Settings → Account "Fuso horário" inline form.
 *
 * UI-SPEC §"Discretion Decisions" — simple text input with auto-detect.
 * Server validates via `Intl.supportedValuesOf('timeZone')` (AUTH-08).
 */
export function TimezoneForm({ initialTimezone }: { initialTimezone: string }) {
  const t = useTranslations("settings.account");
  const router = useRouter();
  const { isSubmitting, error, submit } = useAuthForm();
  const [editing, setEditing] = useState(false);
  const [tz, setTz] = useState(initialTimezone);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submit({
      endpoint: "/api/v1/iam/me",
      method: "PATCH",
      body: { timezone: tz },
      onSuccess: () => {
        setEditing(false);
        router.refresh();
      },
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-forest">{t("timezoneRowLabel")}</p>
          <p className="text-sm text-slate">{tz}</p>
          <p className="text-xs text-slate">{t("timezoneRowHint")}</p>
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-sm text-canopy underline"
        >
          {t("timezoneEditCta")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-semibold text-forest">
          {t("timezoneRowLabel")}
        </span>
        <input
          type="text"
          name="timezone"
          autoComplete="off"
          inputMode="text"
          required
          value={tz}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setTz(e.target.value)}
          className={`
            rounded-lg border-[1.5px] border-hairline bg-ivory px-4 py-3
            text-base text-forest
          `}
        />
        <span className="text-xs text-slate">{t("timezoneRowHint")}</span>
      </label>

      {error ? (
        <p role="alert" className="text-sm text-rust">
          {t("timezoneInvalid")}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("timezoneSaveCta")}
      </Button>
    </form>
  );
}
