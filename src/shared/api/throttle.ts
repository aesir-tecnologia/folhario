import { ErrorCode, errorResponse } from "@shared/config/errors";
import {
  bumpThrottleRow,
  extractClientIp,
  getCurrentLockoutEnd,
  isLocked,
} from "@contexts/iam/infrastructure/db/auth-throttle";

/**
 * Phase 4 D-15 (attempt-vs-failure semantics) + Codex HIGH #5 (5-min lockout
 * via `locked_until` survives the 1-minute window boundary).
 *
 * `withThrottle` is the HTTP-tier wrapper for IAM endpoints. The closed-
 * registry `rate_limited` (429) is the only code emitted from this module —
 * Phase 1 D-12 forbids ad-hoc additions.
 *
 * Modes:
 * - `"always"` — increment BEFORE invoking the handler. Used for signup,
 *   password-reset-request, resend-verification (D-15) so a client cannot
 *   flood verification emails with successful submissions.
 * - `"on-failure"` — increment ONLY when the handler signals failure. Used
 *   for login (401), oauth-callback (302 redirect with `error=oauth_failed`).
 *   AUTH-10: successful logins do not consume the failure budget.
 */

export type ThrottleEndpoint =
  | "signup"
  | "login"
  | "logout"
  | "oauth-callback"
  | "password-reset-request"
  | "resend-verification";

export type ThrottleMode = "always" | "on-failure";

export type ThrottleResult = {
  count: number;
  locked: boolean;
  lockedUntil: Date | null;
};

const RATE_LIMITED_MESSAGE = "Muitas tentativas. Tente novamente em alguns minutos.";

export async function isCurrentlyLocked(ip: string, endpoint: string): Promise<boolean> {
  return (await getCurrentLockoutEnd(ip, endpoint)) !== null;
}

/**
 * Repository pass-through for callers that need the structured result rather
 * than the HTTP-shaped `withThrottle` wrapper. Returns `{count, locked,
 * lockedUntil}` so callers can decide their own response shape.
 */
export async function bumpThrottle(ip: string, endpoint: string): Promise<ThrottleResult> {
  const { count, lockedUntil } = await bumpThrottleRow(ip, endpoint);
  return { count, locked: isLocked(count) || lockedUntil !== null, lockedUntil };
}

function isOauthCallbackFailure(endpoint: ThrottleEndpoint, response: Response): boolean {
  if (endpoint !== "oauth-callback") return false;
  if (response.status !== 302 && response.status !== 303) return false;
  const location = response.headers.get("location") ?? "";
  return location.includes("error=oauth_failed");
}

function isAuthFailure(endpoint: ThrottleEndpoint, response: Response): boolean {
  if (response.status === 401 || response.status === 403) return true;
  return isOauthCallbackFailure(endpoint, response);
}

export async function withThrottle(
  request: Request,
  endpoint: ThrottleEndpoint,
  mode: ThrottleMode,
  fn: () => Promise<Response>,
): Promise<Response> {
  const ip = extractClientIp(request);

  // Codex HIGH #5: ALWAYS check the 5-min lockout first, regardless of mode.
  // Reading `locked_until` across all window_start buckets ensures the lockout
  // survives the 1-minute bucket boundary.
  if (await isCurrentlyLocked(ip, endpoint)) {
    return errorResponse(ErrorCode.RateLimited, RATE_LIMITED_MESSAGE);
  }

  if (mode === "always") {
    const { count, lockedUntil } = await bumpThrottleRow(ip, endpoint);
    if (isLocked(count) || lockedUntil) {
      return errorResponse(ErrorCode.RateLimited, RATE_LIMITED_MESSAGE);
    }
  }

  const response = await fn();

  if (mode === "on-failure" && isAuthFailure(endpoint, response)) {
    const { count, lockedUntil } = await bumpThrottleRow(ip, endpoint);
    if (isLocked(count) || lockedUntil) {
      return errorResponse(ErrorCode.RateLimited, RATE_LIMITED_MESSAGE);
    }
  }

  return response;
}
