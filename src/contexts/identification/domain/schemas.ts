import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  identificationLimits,
  identifications,
  providerBudgets,
  providerUsageCounters,
} from "@contexts/identification/infrastructure/db/schema";

/**
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).
 *
 * Identification domain Zod schemas (D-19, D-40). Routes/use-cases in later
 * phases import from here, not from the table modules. Refinements
 * (e.g. result-array shape, min_confidence range, failure_reason coupling
 * with status) belong here once a consumer lands; until then, refinements
 * added here have no effect because nothing imports them.
 */

export const identificationSelectSchema = createSelectSchema(identifications);
export const identificationInsertSchema = createInsertSchema(identifications);
export type Identification = ReturnType<typeof identificationSelectSchema.parse>;
export type IdentificationInsert = ReturnType<typeof identificationInsertSchema.parse>;

export const identificationLimitSelectSchema = createSelectSchema(identificationLimits);
export const identificationLimitInsertSchema = createInsertSchema(identificationLimits);
export type IdentificationLimit = ReturnType<typeof identificationLimitSelectSchema.parse>;
export type IdentificationLimitInsert = ReturnType<typeof identificationLimitInsertSchema.parse>;

export const providerBudgetSelectSchema = createSelectSchema(providerBudgets);
export const providerBudgetInsertSchema = createInsertSchema(providerBudgets);
export type ProviderBudget = ReturnType<typeof providerBudgetSelectSchema.parse>;
export type ProviderBudgetInsert = ReturnType<typeof providerBudgetInsertSchema.parse>;

export const providerUsageCounterSelectSchema = createSelectSchema(providerUsageCounters);
export const providerUsageCounterInsertSchema = createInsertSchema(providerUsageCounters);
export type ProviderUsageCounter = ReturnType<typeof providerUsageCounterSelectSchema.parse>;
export type ProviderUsageCounterInsert = ReturnType<typeof providerUsageCounterInsertSchema.parse>;

/**
 * Phase 6 request/response schemas — D-13..D-21.
 *
 * Route handlers validate inbound bodies against these schemas before calling
 * use-cases. All schemas use .strict() to reject extra fields (T-06-04-01).
 */

export const createIdentificationRequestSchema = z
  .object({
    userId: z.string().uuid(),
    photos: z
      .array(
        z.object({
          buffer: z.instanceof(Buffer),
          contentType: z.string().min(1),
        }),
      )
      .min(1)
      .max(5),
  })
  .strict();

export const confirmIdentificationRequestSchema = z
  .object({
    speciesId: z.string().uuid(),
    name: z.string().trim().min(1).max(120),
    nickname: z.string().trim().max(120).optional(),
    location: z.string().trim().max(120).optional(),
    acquisitionDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .strict();

export const correctIdentificationRequestSchema = z
  .object({
    manualCorrection: z.string().trim().min(1).max(120),
  })
  .strict();

export const listIdentificationsQuerySchema = z
  .object({
    plantId: z.string().uuid().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(20),
  })
  .strict();

export const recordConsentRequestSchema = z
  .object({
    purpose: z.literal("identification_third_party"),
  })
  .strict();
