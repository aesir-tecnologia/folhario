import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { billingEvents, subscriptions } from "@contexts/billing/infrastructure/db/schema";

/**
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).
 *
 * Billing domain Zod schemas (D-19, D-40). Routes/use-cases in later phases
 * import from here, not from the table modules. Until a consumer lands,
 * adding refinements here has no effect because nothing imports them.
 */

export const subscriptionSelectSchema = createSelectSchema(subscriptions);
export const subscriptionInsertSchema = createInsertSchema(subscriptions);
export type Subscription = ReturnType<typeof subscriptionSelectSchema.parse>;
export type SubscriptionInsert = ReturnType<typeof subscriptionInsertSchema.parse>;

export const billingEventSelectSchema = createSelectSchema(billingEvents);
export const billingEventInsertSchema = createInsertSchema(billingEvents);
export type BillingEvent = ReturnType<typeof billingEventSelectSchema.parse>;
export type BillingEventInsert = ReturnType<typeof billingEventInsertSchema.parse>;
