import { z } from "zod";

const optional = (schema: z.ZodString) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

export const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PROJECT_REF: optional(z.string().min(1)),
  SUPABASE_ACCESS_TOKEN: optional(z.string().min(1)),
  SENTRY_AUTH_TOKEN: optional(z.string().min(1)),
  SENTRY_ORG: optional(z.string().min(1)),
  SENTRY_PROJECT: optional(z.string().min(1)),
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
  // Phase 4 — Inngest (D-16: notifications/send-email is the first async consumer)
  INNGEST_EVENT_KEY: optional(z.string().min(1)),
  INNGEST_SIGNING_KEY: optional(z.string().min(1)),
  // Phase 4 — Resend transactional email (D-19/D-20).
  // Phase 04 review CR-01: required in production so a forgotten key cannot
  // silently fall through to the dev console.log path that would leak
  // verification/reset token URLs into Vercel logs.
  RESEND_API_KEY:
    process.env.NODE_ENV === "production"
      ? z.string().min(1, "RESEND_API_KEY required in production")
      : optional(z.string().min(1)),
  RESEND_FROM_ADDRESS: z.string().email().default("onboarding@resend.dev"),
  // Phase 4 — Supabase Google OAuth (D-04)
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID: optional(z.string().min(1)),
  SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_SECRET: optional(z.string().min(1)),
  // Phase 04 review WR-08 — server-only flag (no NEXT_PUBLIC_ prefix so
  // Next.js does NOT inline it into the client bundle). Gates the
  // /api/v1/diagnostics/iam-test-helpers/* routes and the (test)/modal-sheet
  // page. Replaces the prior NEXT_PUBLIC_ENABLE_TEST_ROUTES which leaked
  // its value into every client JS bundle. Read directly via
  // process.env.ENABLE_TEST_ROUTES at the gate sites; we only declare it
  // here so the env-example coverage test sees the expected key.
  ENABLE_TEST_ROUTES: optional(z.string().min(1)),
});

export const serverEnv = serverSchema.parse(process.env);
