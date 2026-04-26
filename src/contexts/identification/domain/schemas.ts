import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import {
  identificationLimits,
  identifications,
  providerBudgets,
  providerUsageCounters,
} from "@contexts/identification/infrastructure/db/schema";

/**
 * Identification domain Zod schemas (D-19, D-40).
 *
 * Routes/use-cases import from here, not from the table modules. Refinements
 * (e.g. result-array shape, min_confidence range, failure_reason coupling
 * with status) belong here, one layer above the column-faithful generated shape.
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
