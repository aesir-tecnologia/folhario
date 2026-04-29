"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@shared/ui/button";
import { TextInput } from "@shared/ui/text-input";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 AUTH-13 — change-password form (CLIENT per D-31).
 *
 * Submits PATCH /api/v1/iam/me/password with current+new password.
 * Server-side defense:
 *   - 401 invalid_credentials when current is wrong
 *   - 403 forbidden for OAuth-only users (UI hides this form for them
 *     via the parent AccountSection conditional, but defense-in-depth).
 */
export function ChangePasswordForm() {
  const t = useTranslations("settings.account.changePassword");
  const tErrors = useTranslations("auth.errors");
  const { isSubmitting, error, submit } = useAuthForm();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [clientError, setClientError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    setSuccess(false);
    if (form.next.length < 8) {
      setClientError(t("errors.passwordTooShort"));
      return;
    }
    if (form.next !== form.confirm) {
      setClientError(t("errors.passwordsDontMatch"));
      return;
    }
    // Phase 04 review IN-01: useAuthForm's onSuccess only fires on a 2xx
    // response, so success-side effects (setSuccess + form reset) are
    // already gated correctly. No trailing post-submit branch is needed.
    await submit({
      endpoint: "/api/v1/iam/me/password",
      method: "PATCH",
      body: { current_password: form.current, new_password: form.next },
      onSuccess: () => {
        setSuccess(true);
        setForm({ current: "", next: "", confirm: "" });
      },
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3"
      noValidate
      aria-busy={isSubmitting}
    >
      {success ? (
        <div role="status" aria-live="polite" className="text-sm text-canopy">
          OK.
        </div>
      ) : null}
      {clientError ? (
        <div
          role="alert"
          className="
            rounded-lg border-l-[1.5px] border-rust bg-ivory px-3 py-2 text-sm
            text-rust
          "
        >
          {clientError}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="
            rounded-lg border-l-[1.5px] border-rust bg-ivory px-3 py-2 text-sm
            text-rust
          "
        >
          {error.code === "invalid_credentials"
            ? t("errors.currentIncorrect")
            : error.code === "rate_limited"
              ? tErrors("rateLimited")
              : error.message}
        </div>
      ) : null}

      <TextInput
        label={t("currentLabel")}
        type="password"
        name="current_password"
        autoComplete="current-password"
        required
        value={form.current}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setForm({ ...form, current: e.target.value })
        }
      />
      <TextInput
        label={t("newLabel")}
        type="password"
        name="new_password"
        autoComplete="new-password"
        required
        minLength={8}
        value={form.next}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, next: e.target.value })}
      />
      <TextInput
        label={t("confirmLabel")}
        type="password"
        name="confirm_password"
        autoComplete="new-password"
        required
        minLength={8}
        value={form.confirm}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setForm({ ...form, confirm: e.target.value })
        }
      />
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("submit")}
      </Button>
    </form>
  );
}
