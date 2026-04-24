export const ErrorCode = {
  Unauthenticated: "unauthenticated",
  TokenExpired: "token_expired",
  InvalidCredentials: "invalid_credentials",
  Forbidden: "forbidden",
  EmailUnverified: "email_unverified",
  ValidationFailed: "validation_failed",
  InvalidPartnerCode: "invalid_partner_code",
  NotFound: "not_found",
  Conflict: "conflict",
  ConsentRequired: "consent_required",
  DeletionInProgress: "deletion_in_progress",
  SubscriptionRequired: "subscription_required",
  ReadOnlyMode: "read_only_mode",
  CapHit: "cap_hit",
  ProviderUnavailable: "provider_unavailable",
  CostCeilingReached: "cost_ceiling_reached",
  BreakerOpen: "breaker_open",
  Timeout: "timeout",
  WebhookSignatureInvalid: "webhook_signature_invalid",
  RateLimited: "rate_limited",
  InternalError: "internal_error",
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const INTERNAL_ONLY: ReadonlySet<ErrorCode> = new Set([
  ErrorCode.CostCeilingReached,
  ErrorCode.BreakerOpen,
]);

const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  token_expired: 401,
  invalid_credentials: 401,
  forbidden: 403,
  email_unverified: 403,
  validation_failed: 400,
  invalid_partner_code: 400,
  not_found: 404,
  conflict: 409,
  consent_required: 403,
  deletion_in_progress: 403,
  subscription_required: 402,
  read_only_mode: 402,
  cap_hit: 429,
  provider_unavailable: 503,
  cost_ceiling_reached: 503,
  breaker_open: 503,
  timeout: 504,
  webhook_signature_invalid: 401,
  rate_limited: 429,
  internal_error: 500,
};

export type ErrorBody = {
  error: {
    code: ErrorCode;
    message: string;
    details?: Record<string, unknown>;
  };
};

export function errorResponse(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
): Response {
  const publicCode: ErrorCode = INTERNAL_ONLY.has(code) ? ErrorCode.ProviderUnavailable : code;
  const body: ErrorBody = {
    error: {
      code: publicCode,
      message,
      ...(details ? { details } : {}),
    },
  };
  return new Response(JSON.stringify(body), {
    status: HTTP_STATUS[publicCode],
    headers: { "content-type": "application/json" },
  });
}
