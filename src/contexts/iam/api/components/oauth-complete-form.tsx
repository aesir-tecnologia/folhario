"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@shared/ui/button";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 D-04 + AUTH-03 — Google OAuth completion form.
 *
 * Renders after the OAuth callback when `user.age_confirmed_at IS NULL`.
 * Collects age confirmation, T&C/Privacy acceptance (with version-bound
 * hyperlinks per Codex MEDIUM consent UX), timezone, and optional
 * partner code. Submitting writes consent rows + sets
 * email_verified_at + creates the trialing subscription in one
 * `db.transaction` (Plan 04-09 oauth-complete use-case).
 */
export interface OauthCompleteFormProps {
  policyVersion: string;
  defaultTimezone: string;
}

export function OauthCompleteForm({
  policyVersion,
  defaultTimezone,
}: OauthCompleteFormProps) {
  const t = useTranslations("auth.oauthComplete");
  const tSignup = useTranslations("auth.signup");
  const tLinks = useTranslations("auth.oauthComplete.legalLinks");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const { isSubmitting, error, submit } = useAuthForm();

  const [form, setForm] = useState({
    age_confirmed: false,
    terms_accepted: false,
    privacy_accepted: false,
    timezone: defaultTimezone,
    partner_code: "",
  });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      age_confirmed: form.age_confirmed,
      terms_accepted: form.terms_accepted,
      privacy_accepted: form.privacy_accepted,
      timezone: form.timezone,
    };
    if (form.partner_code.trim().length > 0) {
      body.partner_code = form.partner_code.trim();
    }
    await submit({
      endpoint: "/api/v1/iam/oauth/complete",
      body,
      onSuccess: () => {
        router.push("/");
        router.refresh();
      },
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
      aria-busy={isSubmitting}
    >
      <p className="text-base/6 text-slate">{t("greeting")}</p>

      {error ? (
        <div
          role="alert"
          className="
            rounded-lg border-l-[1.5px] border-rust bg-ivory px-3 py-2 text-sm
            text-rust
          "
        >
          {error.code === "invalid_partner_code"
            ? tSignup("errors.partnerCodeInvalid")
            : error.code === "rate_limited"
              ? tErrors("rateLimited")
              : error.message}
        </div>
      ) : null}

      <label className="flex items-start gap-2 text-sm text-forest">
        <input
          type="checkbox"
          required
          checked={form.age_confirmed}
          onChange={(e) => setForm({ ...form, age_confirmed: e.target.checked })}
          className="mt-1"
        />
        <span>{tSignup("fields.ageCheckbox")}</span>
      </label>

      <label className="flex items-start gap-2 text-sm text-forest">
        <input
          type="checkbox"
          required
          checked={form.terms_accepted}
          onChange={(e) => setForm({ ...form, terms_accepted: e.target.checked })}
          className="mt-1"
        />
        <span>
          Aceito os{" "}
          <a
            href="/legal/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="text-canopy underline"
          >
            {tLinks("termsLabel", { version: policyVersion })}
          </a>
        </span>
      </label>

      <label className="flex items-start gap-2 text-sm text-forest">
        <input
          type="checkbox"
          required
          checked={form.privacy_accepted}
          onChange={(e) => setForm({ ...form, privacy_accepted: e.target.checked })}
          className="mt-1"
        />
        <span>
          Aceito a{" "}
          <a
            href="/legal/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-canopy underline"
          >
            {tLinks("privacyLabel", { version: policyVersion })}
          </a>
        </span>
      </label>

      <details className="rounded-lg border border-hairline bg-ivory p-3">
        <summary className="cursor-pointer text-sm font-semibold text-forest">
          {tSignup("fields.partnerCode")}
        </summary>
        <input
          type="text"
          name="partner_code"
          autoComplete="off"
          inputMode="text"
          pattern="[A-Za-z0-9-]*"
          value={form.partner_code}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            setForm({ ...form, partner_code: e.target.value })
          }
          className="
            mt-2 w-full rounded-lg border-[1.5px] border-hairline bg-ivory px-4
            py-3 text-base text-forest
          "
        />
      </details>

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
