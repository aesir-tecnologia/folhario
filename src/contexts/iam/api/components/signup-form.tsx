"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@shared/ui/button";
import { TextInput } from "@shared/ui/text-input";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 AUTH-01 + Codex MEDIUM consent UX — signup form.
 *
 * CLIENT component per D-31 + Codex HIGH #4 (fetch + Content-Type:
 * application/json). T&C and Privacy checkboxes render the policy
 * label as a clickable hyperlink to /legal/terms and /legal/privacy
 * with the active policy_version visible (Codex MEDIUM consent UX).
 */
export interface SignupFormProps {
  policyVersion: string;
  defaultTimezone: string;
}

export function SignupForm({ policyVersion, defaultTimezone }: SignupFormProps) {
  const t = useTranslations("auth.signup");
  const tLinks = useTranslations("auth.signup.legalLinks");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const { isSubmitting, error, submit } = useAuthForm();

  const [form, setForm] = useState({
    email: "",
    password: "",
    age_confirmed: false,
    terms_accepted: false,
    privacy_accepted: false,
    timezone: defaultTimezone,
    partner_code: "",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const body: Record<string, unknown> = {
      email: form.email,
      password: form.password,
      age_confirmed: form.age_confirmed,
      terms_accepted: form.terms_accepted,
      privacy_accepted: form.privacy_accepted,
      timezone: form.timezone,
    };
    if (form.partner_code.trim().length > 0) {
      body.partner_code = form.partner_code.trim();
    }
    // Phase 04 review WR-06 (post-fix 2026-04-29): the server returns the
    // same generic 200 for both "created" and "already_registered"
    // (anti-enumeration). The previous convergence destination was
    // /auth/forgot-password, which rendered "Recuperar senha" — a
    // password reset screen — to a brand-new user who had just
    // successfully created an account. They saw "recover password"
    // instead of "check your email" and reasonably read it as "signup
    // failed." Route both branches to /auth/check-email instead, a
    // dedicated public page whose copy matches the server response
    // message ("Conta criada — verifique seu email."). Anti-enumeration
    // is preserved because the route is identical for both branches and
    // takes no parameters — the page renders the same DOM regardless of
    // which path the server took.
    await submit({
      endpoint: "/api/v1/iam/signup",
      body,
      onSuccess: () => router.push("/auth/check-email"),
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4"
      noValidate
      aria-busy={isSubmitting}
    >
      {error ? (
        <div
          role="alert"
          className="
            rounded-lg border-l-[1.5px] border-rust bg-ivory px-3 py-2 text-sm
            text-rust
          "
        >
          {error.code === "rate_limited" ? tErrors("rateLimited") : error.message}
        </div>
      ) : null}

      <TextInput
        label={t("fields.email")}
        type="email"
        name="email"
        autoComplete="email"
        inputMode="email"
        required
        value={form.email}
        onChange={(e: ChangeEvent<HTMLInputElement>) => update("email", e.target.value)}
      />

      <TextInput
        label={t("fields.password")}
        type="password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={form.password}
        onChange={(e: ChangeEvent<HTMLInputElement>) => update("password", e.target.value)}
      />

      <label className="flex items-start gap-2 text-sm text-forest">
        <input
          type="checkbox"
          required
          checked={form.age_confirmed}
          onChange={(e) => update("age_confirmed", e.target.checked)}
          className="mt-1"
        />
        <span>{t("fields.ageCheckbox")}</span>
      </label>

      <label className="flex items-start gap-2 text-sm text-forest">
        <input
          type="checkbox"
          required
          checked={form.terms_accepted}
          onChange={(e) => update("terms_accepted", e.target.checked)}
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
          onChange={(e) => update("privacy_accepted", e.target.checked)}
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
          {t("fields.partnerCode")}
        </summary>
        <input
          type="text"
          name="partner_code"
          autoComplete="off"
          inputMode="text"
          pattern="[A-Za-z0-9-]*"
          value={form.partner_code}
          onChange={(e) => update("partner_code", e.target.value)}
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
