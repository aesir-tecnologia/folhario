"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@shared/ui/button";
import { TextInput } from "@shared/ui/text-input";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 AUTH-11 + D-11 — forgot-password "always 200" form.
 *
 * The endpoint always returns 200 to avoid leaking account existence;
 * the form swaps to the success-state copy regardless of outcome
 * (UI-SPEC §"Empty / pending / cooldown states").
 */
export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const tErrors = useTranslations("auth.errors");
  const { isSubmitting, error, submit } = useAuthForm();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState("");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submit({
      endpoint: "/api/v1/iam/password/reset-request",
      body: { email },
      onSuccess: () => setSubmitted(true),
    });
  }

  if (submitted) {
    return (
      <section role="status" aria-live="polite" className="flex flex-col gap-4">
        <h2 className="font-serif text-2xl font-medium text-forest">
          {t("successTitle")}
        </h2>
        <p className="text-base/6 text-slate">{t("successBody")}</p>
      </section>
    );
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
        value={email}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
      />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
