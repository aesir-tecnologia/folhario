import { createInsertSchema } from "drizzle-zod";

import { consentLogs } from "@contexts/iam/infrastructure/db/schema";

/**
 * Phase-2 D-19 / D-40 — ConsentLog domain schemas.
 *
 * `consentLogInsertSchema` is the column-faithful shape generated from the
 * Drizzle table by drizzle-zod. It is the SOURCE OF TRUTH for any route or
 * use-case schema operating on consent_logs: drizzle-zod 0.8.x emits
 * `z.enum(column.enumValues)` for `varchar({ enum: [...] as const })`
 * columns, so picking from this insert schema preserves the column-level
 * enum constraints on `purpose` and `source`, and the pgEnum on
 * `legal_basis`. Extending an enum at the table level flows here without
 * any code change at the consumers.
 *
 * The diagnostics route (Plan 02-09) accepts only the four user-supplied
 * fields — `userId` comes from the JWT, `policyVersionId` is resolved
 * server-side from the seeded current privacy_policy row, and
 * `createdAt`/`grantedAt` default at the DB layer. The route therefore
 * narrows this insert schema with `.pick({ purpose, legalBasis, source })`
 * locally — see `src/contexts/iam/api/consent-route.ts` for the picked
 * boundary schema.
 *
 * Routes and use-cases import this drizzle-zod root from this module —
 * never the raw `consentLogs` table — per D-19.
 */

export const consentLogInsertSchema = createInsertSchema(consentLogs);
