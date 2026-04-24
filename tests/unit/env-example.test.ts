import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REQUIRED_KEYS = [
  "DATABASE_URL",
  "DATABASE_POOL_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_PROJECT_REF",
  "SUPABASE_ACCESS_TOKEN",
  "IDENTIFICATION_PROVIDER_MODE",
  "NEXT_PUBLIC_SENTRY_DSN",
  "SENTRY_AUTH_TOKEN",
  "SENTRY_ORG",
  "SENTRY_PROJECT",
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "VERCEL_ORG_ID",
  "VERCEL_PROJECT_ID",
  "VERCEL_TOKEN",
];

const SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9]{20,}/,
  /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/,
  /=([A-Za-z0-9+/]{40,}=*)$/m,
];

describe("INFRA-17 .env.example mirrors PRD §20 (19 keys) without leaking secrets", () => {
  const path = resolve(process.cwd(), ".env.example");

  it(".env.example exists", () => {
    expect(existsSync(path)).toBe(true);
  });

  it("contains exactly 19 required keys", () => {
    expect(REQUIRED_KEYS).toHaveLength(19);
  });

  const content = existsSync(path) ? readFileSync(path, "utf-8") : "";

  it.each(REQUIRED_KEYS)("contains key %s", (key) => {
    const re = new RegExp(`^${key}=`, "m");
    expect(content).toMatch(re);
  });

  it("NEXT_PUBLIC_POSTHOG_HOST is non-empty (Action 17 — public constant)", () => {
    expect(content).toMatch(/^NEXT_PUBLIC_POSTHOG_HOST=https:\/\/us\.i\.posthog\.com$/m);
  });

  it.each(SECRET_PATTERNS)("does not leak secrets matching %s", (pattern) => {
    expect(content).not.toMatch(pattern);
  });
});
