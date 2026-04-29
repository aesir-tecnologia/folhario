"use client";

import { useState } from "react";

/**
 * Phase 4 D-31 + Codex HIGH #4 — shared client-side hook for auth form
 * submission.
 *
 * - POSTs JSON via fetch with `Content-Type: application/json`
 * - Captures structured error bodies from the closed registry (PRD §5)
 * - Exposes a `clearError()` so consumers can reset between attempts
 *
 * Designed to be paired with the route handlers shipped by plans 04-06,
 * 04-07, 04-08, 04-09.
 */

export type AuthFormErrorCode =
  | "validation_failed"
  | "invalid_credentials"
  | "invalid_partner_code"
  | "rate_limited"
  | "forbidden"
  | "email_unverified"
  | "token_expired"
  | "internal_error"
  | "unauthenticated";

export interface AuthFormError {
  code: AuthFormErrorCode;
  message: string;
  field?: string;
  details?: unknown;
}

export interface SubmitOptions<TBody extends Record<string, unknown>, TResponse> {
  endpoint: string;
  method?: "POST" | "PATCH";
  body: TBody;
  onSuccess?: (data: TResponse) => void | Promise<void>;
}

export function useAuthForm<TResponse = unknown>() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<AuthFormError | null>(null);

  async function submit<TBody extends Record<string, unknown>>(
    opts: SubmitOptions<TBody, TResponse>,
  ): Promise<{ ok: boolean; data?: TResponse }> {
    setIsSubmitting(true);
    setError(null);
    try {
      const resp = await fetch(opts.endpoint, {
        method: opts.method ?? "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(opts.body),
      });
      if (!resp.ok) {
        const errorBody = await resp.json().catch(() => null);
        const parsed: AuthFormError = errorBody?.error
          ? {
              code: (errorBody.error.code as AuthFormErrorCode) ?? "internal_error",
              message: errorBody.error.message ?? "Erro desconhecido.",
              field: errorBody.error.details?.field,
              details: errorBody.error.details,
            }
          : { code: "internal_error", message: "Erro desconhecido." };
        setError(parsed);
        return { ok: false };
      }
      const data = (await resp.json().catch(() => null)) as TResponse;
      await opts.onSuccess?.(data);
      return { ok: true, data };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro de rede.";
      setError({ code: "internal_error", message });
      return { ok: false };
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    isSubmitting,
    error,
    errorCode: error?.code,
    submit,
    clearError: () => setError(null),
  };
}
