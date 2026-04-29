"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@shared/ui/button";
import { TextInput } from "@shared/ui/text-input";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 AUTH-11 + D-10 — reset-password form.
 *
 * Receives the raw token via the page's `?token=` searchParam (the page
 * passes it as a prop). Submits new + confirm password; the route
 * handler validates both server-side (closed registry).
 */
export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.reset");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const { isSubmitting, error, submit } = useAuthForm();

  const [form, setForm] = useState({ password: "", confirm: "" });
  const [clientError, setClientError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    if (form.password.length < 8) {
      setClientError(t("errors.passwordTooShort"));
      return;
    }
    if (form.password !== form.confirm) {
      setClientError(t("errors.passwordsDontMatch"));
      return;
    }
    await submit({
      endpoint: "/api/v1/iam/password/reset",
      body: { token, password: form.password },
      onSuccess: () => {
        router.push("/auth/login");
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
          {error.code === "rate_limited" ? tErrors("rateLimited") : error.message}
        </div>
      ) : null}

      <TextInput
        label={t("fields.password")}
        type="password"
        name="password"
        autoComplete="new-password"
        required
        minLength={8}
        value={form.password}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setForm({ ...form, password: e.target.value })
        }
      />

      <TextInput
        label={t("fields.confirmPassword")}
        type="password"
        name="confirm"
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
