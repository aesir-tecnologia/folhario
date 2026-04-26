import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { consentLogs } from "@contexts/iam/infrastructure/db/schema";

/**
 * Phase-2 D-19 / D-40 — ConsentLog domain schemas.
 *
 * `consentLogInsertSchema` is the column-faithful shape generated from the
 * Drizzle table by drizzle-zod. It is wider than the route's input contract:
 * it allows `userId`, `grantedAt`, `revokedAt`, `id`, `createdAt`, etc. The
 * diagnostics route (Plan 02-09) accepts only the four user-supplied fields
 * — the rest come from the JWT, the request timestamp, or DB defaults.
 *
 * `consentLogCreateInputSchema` is the refined boundary shape for that
 * route's POST body: `purpose`, `legalBasis`, `policyVersionId`, `source`.
 * `policyVersionId` is narrowed to a UUID (the column-level type is just
 * `uuid`, but at the route boundary we want the strong validation message
 * for anything malformed).
 *
 * Routes import the refined schema from this module — never the raw
 * `consentLogs` table — per D-19. Use-cases that need the full insert shape
 * keep importing from `iam/domain/schemas.ts`.
 */

export const consentLogInsertSchema = createInsertSchema(consentLogs);

export const consentLogCreateInputSchema = z.object({
  purpose: z.enum([
    "identification_third_party",
    "push_notifications",
    "marketing",
    "analytics",
  ] as const),
  legalBasis: z.enum(["consent", "contract", "legitimate_interest"] as const),
  policyVersionId: z.string().uuid(),
  source: z.enum(["signup", "settings", "first_use_prompt"] as const),
});

export type ConsentLogCreateInput = z.infer<typeof consentLogCreateInputSchema>;
