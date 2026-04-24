import { describe, it, expect } from "vitest";
import { clientSchema } from "@shared/config/client-env";

describe("INFRA-16 + INFRA-17 client env validation (D-29 revised, Action 4)", () => {
  const valid = {
    NEXT_PUBLIC_SUPABASE_URL: "http://localhost:54321",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
  };

  it("accepts a minimally valid client env", () => {
    expect(() => clientSchema.parse(valid)).not.toThrow();
  });

  it("coerces empty-string NEXT_PUBLIC_SENTRY_DSN to undefined (D-19)", () => {
    const parsed = clientSchema.parse({ ...valid, NEXT_PUBLIC_SENTRY_DSN: "" });
    expect(parsed.NEXT_PUBLIC_SENTRY_DSN).toBeUndefined();
  });

  it("coerces empty-string NEXT_PUBLIC_POSTHOG_KEY to undefined (D-20)", () => {
    const parsed = clientSchema.parse({ ...valid, NEXT_PUBLIC_POSTHOG_KEY: "" });
    expect(parsed.NEXT_PUBLIC_POSTHOG_KEY).toBeUndefined();
  });

  it("rejects invalid NEXT_PUBLIC_SUPABASE_URL", () => {
    expect(() => clientSchema.parse({ ...valid, NEXT_PUBLIC_SUPABASE_URL: "not-a-url" })).toThrow();
  });
});
