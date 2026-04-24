import { z } from "zod";

const optional = (schema: z.ZodString) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

export const serverSchema = z.object({
  DATABASE_URL: z.string().url(),
  DATABASE_POOL_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_PROJECT_REF: optional(z.string().min(1)),
  SUPABASE_ACCESS_TOKEN: optional(z.string().min(1)),
  SENTRY_AUTH_TOKEN: optional(z.string().min(1)),
  SENTRY_ORG: optional(z.string().min(1)),
  SENTRY_PROJECT: optional(z.string().min(1)),
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
});

export const serverEnv = serverSchema.parse(process.env);
