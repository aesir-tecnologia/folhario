"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import { Button } from "@shared/ui/button";
import { TextInput } from "@shared/ui/text-input";

import { useAuthForm } from "./use-auth-form";

/**
 * Phase 4 AUTH-05 — login form (CLIENT per D-31 + Codex HIGH #4).
 */
export function LoginForm() {
  const t = useTranslations("auth.login");
  const tErrors = useTranslations("auth.errors");
  const router = useRouter();
  const { isSubmitting, error, submit } = useAuthForm();

  const [form, setForm] = useState({ email: "", password: "" });

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    await submit({
      endpoint: "/api/v1/iam/login",
      body: form,
      onSuccess: () => {
        // Phase 4: login mints session; the (app) layout drops the user into
        // the blocker if their email is unverified.
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
      {error ? (
        <div
          role="alert"
          className="
            rounded-lg border-l-[1.5px] border-rust bg-ivory px-3 py-2 text-sm
            text-rust
          "
        >
          {error.code === "invalid_credentials"
            ? t("errors.invalidCredentials")
            : error.code === "rate_limited"
              ? tErrors("rateLimited")
              : error.message}
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
        onChange={(e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, email: e.target.value })}
      />

      <TextInput
        label={t("fields.password")}
        type="password"
        name="password"
        autoComplete="current-password"
        required
        value={form.password}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setForm({ ...form, password: e.target.value })
        }
      />

      <Button type="submit" disabled={isSubmitting} className="w-full">
        {t("submit")}
      </Button>

      <div className="flex flex-col gap-2 text-center text-sm">
        <Link href="/auth/forgot-password" className="text-canopy underline">
          {t("forgotPassword")}
        </Link>
        <Link href="/auth/signup" className="text-canopy underline">
          {t("noAccount")}
        </Link>
      </div>
    </form>
  );
}
