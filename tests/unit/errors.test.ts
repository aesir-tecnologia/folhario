import { describe, it, expect } from "vitest";
import { ErrorCode, errorResponse, type ErrorBody } from "@shared/config/errors";

const EXPECTED_HTTP: Record<string, number> = {
  unauthenticated: 401,
  token_expired: 401,
  invalid_credentials: 401,
  webhook_signature_invalid: 401,
  forbidden: 403,
  email_unverified: 403,
  consent_required: 403,
  deletion_in_progress: 403,
  validation_failed: 400,
  invalid_partner_code: 400,
  not_found: 404,
  conflict: 409,
  subscription_required: 402,
  read_only_mode: 402,
  cap_hit: 429,
  rate_limited: 429,
  provider_unavailable: 503,
  cost_ceiling_reached: 503,
  breaker_open: 503,
  timeout: 504,
  internal_error: 500,
};

describe("INFRA-20 error registry (PRD §5)", () => {
  it("ErrorCode exports all 21 expected codes", () => {
    expect(Object.entries(ErrorCode)).toHaveLength(21);
  });

  it.each(Object.entries(EXPECTED_HTTP))(
    "errorResponse(%s) returns HTTP %i",
    async (code, expectedStatus) => {
      const res = errorResponse(code as never, "test msg");
      expect(res.status).toBe(expectedStatus);
    },
  );

  it("cost_ceiling_reached redacts to provider_unavailable in body", async () => {
    const res = errorResponse(ErrorCode.CostCeilingReached, "internal");
    const body: ErrorBody = await res.json();
    expect(body.error.code).toBe("provider_unavailable");
    expect(res.status).toBe(503);
  });

  it("breaker_open redacts to provider_unavailable in body", async () => {
    const res = errorResponse(ErrorCode.BreakerOpen, "internal");
    const body: ErrorBody = await res.json();
    expect(body.error.code).toBe("provider_unavailable");
    expect(res.status).toBe(503);
  });

  it("non-internal codes keep their literal code in the body", async () => {
    const res = errorResponse(ErrorCode.Unauthenticated, "nope");
    const body: ErrorBody = await res.json();
    expect(body.error.code).toBe("unauthenticated");
    expect(body.error.message).toBe("nope");
  });

  it("body shape is { error: { code, message, details? } } per D-11", async () => {
    const res = errorResponse(ErrorCode.ValidationFailed, "bad", { field: "email" });
    const body = await res.json();
    expect(Object.keys(body)).toEqual(["error"]);
    expect(body.error).toMatchObject({
      code: "validation_failed",
      message: "bad",
      details: { field: "email" },
    });
  });

  it("omits details key entirely when argument is undefined", async () => {
    const res = errorResponse(ErrorCode.NotFound, "gone");
    const body = await res.json();
    expect(body.error).not.toHaveProperty("details");
  });

  it("content-type is application/json", () => {
    const res = errorResponse(ErrorCode.InternalError, "x");
    expect(res.headers.get("content-type")).toBe("application/json");
  });
});
