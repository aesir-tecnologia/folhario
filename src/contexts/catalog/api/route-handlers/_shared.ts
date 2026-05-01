import { ErrorCode } from "@shared/config/errors";
import { resolveSubscriptionState } from "@contexts/billing/application/subscription-provider";

/**
 * Shared utilities for catalog route handlers (05-09).
 *
 * errorStatusFor: maps a closed-registry ErrorCode to its HTTP status number.
 * Used ONLY inside withIdempotency handler closures where the status must be
 * returned alongside the body. Route handlers NEVER hard-code HTTP statuses
 * directly — all top-level error paths go through errorResponse(ErrorCode.X, ...).
 *
 * resolveReadOnlyFromRequest: reads the subscription gate from server env +
 * request cookie (T-05-09-04 mitigation). The check uses strict equality
 * consistent with resolveSubscriptionState's own contract (T-05-11-01).
 */

const HTTP_STATUS_FOR: Partial<Record<ErrorCode, number>> = {
  [ErrorCode.NotFound]: 404,
  [ErrorCode.ValidationFailed]: 400,
  [ErrorCode.Conflict]: 409,
  [ErrorCode.Forbidden]: 403,
  [ErrorCode.Unauthenticated]: 401,
  [ErrorCode.EmailUnverified]: 403,
  [ErrorCode.ReadOnlyMode]: 402,
  [ErrorCode.SubscriptionRequired]: 402,
};

export function errorStatusFor(code: ErrorCode): number {
  return HTTP_STATUS_FOR[code] ?? 500;
}

/**
 * Parse the `__test_subscription_read_only` cookie value from a raw Cookie header.
 * Returns undefined when absent or unparseable.
 */
function parseCookieValue(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  const pairs = cookieHeader.split(";");
  for (const pair of pairs) {
    const [k, ...rest] = pair.trim().split("=");
    if (k?.trim() === name) {
      return rest.join("=").trim();
    }
  }
  return undefined;
}

/**
 * Resolve the server-side read-only gate from process.env + request cookie.
 *
 * Mirrors SubscriptionProvider's logic for route handlers (API routes have no
 * Next.js cookies() async API available in the same way Server Components do).
 *
 * Returns true when subscription.readOnly is true (read_only_mode gate active).
 */
export function resolveReadOnlyFromRequest(request: Request): boolean {
  const cookieValue = parseCookieValue(
    request.headers.get("cookie"),
    "__test_subscription_read_only",
  );
  const state = resolveSubscriptionState({
    enableTestRoutes: process.env.ENABLE_TEST_ROUTES,
    cookieValue,
  });
  return state.readOnly;
}
