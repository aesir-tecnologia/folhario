import { authAdapter } from "@contexts/iam/infrastructure/auth/auth-adapter";
import type { LoginRequest } from "@contexts/iam/domain/schemas";

/**
 * Phase 4 AUTH-05 + D-05 + Codex HIGH #3 (AuthAdapter boundary).
 *
 * Email + password login. Delegates entirely to authAdapter.signInWithPassword
 * which is the SOLE module that touches the Supabase auth surface. The adapter
 * sets the SSR session cookie (per-device JWT semantics per D-05) and collapses
 * any backend error to `{ok: false, reason: "invalid_credentials"}` so this
 * layer cannot leak whether the email exists (T-04-07-02).
 */

export type LoginResult =
  | { kind: "success" }
  | { kind: "invalid_credentials" };

export async function loginUser(input: LoginRequest): Promise<LoginResult> {
  const result = await authAdapter.signInWithPassword({
    email: input.email,
    password: input.password,
  });
  // T-04-07-02: never distinguish "user not found" vs "wrong password".
  if (!result.ok) return { kind: "invalid_credentials" };
  return { kind: "success" };
}
