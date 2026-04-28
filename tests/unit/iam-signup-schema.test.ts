import { describe, it, expect } from "vitest";
import {
  signupRequestSchema,
  loginRequestSchema,
  passwordResetRequestSchema,
  passwordResetConsumeSchema,
  changePasswordSchema,
  oauthCompleteSchema,
} from "@contexts/iam/domain/schemas";

/**
 * Phase 4 D-30: founder reviews initial Zod drafts. Tests pin behavior so a
 * subsequent schema edit cannot drop AUTH-06/07/08/09/10 enforcement.
 */

const VALID_SIGNUP = {
  email: "user@example.com",
  password: "correcthorse",
  age_confirmed: true as const,
  terms_accepted: true as const,
  privacy_accepted: true as const,
  timezone: "America/Sao_Paulo",
};

describe("signupRequestSchema", () => {
  it("parses a valid signup body", () => {
    const result = signupRequestSchema.safeParse(VALID_SIGNUP);
    expect(result.success).toBe(true);
  });

  it("accepts an optional partner_code", () => {
    const result = signupRequestSchema.safeParse({
      ...VALID_SIGNUP,
      partner_code: "STORE-123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a missing partner_code (key absent)", () => {
    const result = signupRequestSchema.safeParse(VALID_SIGNUP);
    expect(result.success).toBe(true);
  });

  it("accepts an empty partner_code string", () => {
    const result = signupRequestSchema.safeParse({
      ...VALID_SIGNUP,
      partner_code: "",
    });
    expect(result.success).toBe(true);
  });

  it.each([
    ["malformed email", { ...VALID_SIGNUP, email: "not-an-email" }, "email"],
    ["password < 8 chars", { ...VALID_SIGNUP, password: "abc" }, "password"],
    [
      "age_confirmed: false (AUTH-06)",
      { ...VALID_SIGNUP, age_confirmed: false },
      "age_confirmed",
    ],
    [
      "terms_accepted: false (AUTH-09)",
      { ...VALID_SIGNUP, terms_accepted: false },
      "terms_accepted",
    ],
    [
      "privacy_accepted: false (AUTH-09)",
      { ...VALID_SIGNUP, privacy_accepted: false },
      "privacy_accepted",
    ],
    [
      "unknown timezone (AUTH-08)",
      { ...VALID_SIGNUP, timezone: "Mars/Olympus_Mons" },
      "timezone",
    ],
    [
      "partner_code with spaces",
      { ...VALID_SIGNUP, partner_code: "with space" },
      "partner_code",
    ],
  ])("rejects %s", (_label, body, expectedField) => {
    const result = signupRequestSchema.safeParse(body);
    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.issues.map((i) => i.path[0]);
      expect(fields).toContain(expectedField);
    }
  });
});

describe("loginRequestSchema", () => {
  it("parses email + password", () => {
    const result = loginRequestSchema.safeParse({
      email: "user@example.com",
      password: "anything",
    });
    expect(result.success).toBe(true);
  });

  it("rejects non-email", () => {
    expect(
      loginRequestSchema.safeParse({ email: "x", password: "y" }).success,
    ).toBe(false);
  });
});

describe("passwordResetRequestSchema", () => {
  it("parses email only", () => {
    const result = passwordResetRequestSchema.safeParse({
      email: "user@example.com",
    });
    expect(result.success).toBe(true);
  });
});

describe("passwordResetConsumeSchema", () => {
  it("parses token + password", () => {
    const result = passwordResetConsumeSchema.safeParse({
      token: "a".repeat(64),
      password: "newpassword1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects password < 8 chars", () => {
    const result = passwordResetConsumeSchema.safeParse({
      token: "a".repeat(64),
      password: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects token != 64 chars", () => {
    const result = passwordResetConsumeSchema.safeParse({
      token: "short",
      password: "newpassword1",
    });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("parses current_password + new_password", () => {
    const result = changePasswordSchema.safeParse({
      current_password: "old",
      new_password: "newpassword1",
    });
    expect(result.success).toBe(true);
  });

  it("rejects new_password < 8 chars", () => {
    const result = changePasswordSchema.safeParse({
      current_password: "old",
      new_password: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("oauthCompleteSchema", () => {
  it("parses a valid OAuth completion body (no email/password)", () => {
    const result = oauthCompleteSchema.safeParse({
      age_confirmed: true,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects when age_confirmed is false", () => {
    const result = oauthCompleteSchema.safeParse({
      age_confirmed: false,
      terms_accepted: true,
      privacy_accepted: true,
      timezone: "America/Sao_Paulo",
    });
    expect(result.success).toBe(false);
  });
});
