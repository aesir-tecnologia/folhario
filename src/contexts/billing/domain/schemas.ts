import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { billingEvents, subscriptions } from "@contexts/billing/infrastructure/db/schema";

/**
 * Billing domain Zod schemas (D-19, D-40).
 *
 * Routes/use-cases import from here, not from the table modules.
 */

export const subscriptionSelectSchema = createSelectSchema(subscriptions);
export const subscriptionInsertSchema = createInsertSchema(subscriptions);
export type Subscription = ReturnType<typeof subscriptionSelectSchema.parse>;
export type SubscriptionInsert = ReturnType<typeof subscriptionInsertSchema.parse>;

export const billingEventSelectSchema = createSelectSchema(billingEvents);
export const billingEventInsertSchema = createInsertSchema(billingEvents);
export type BillingEvent = ReturnType<typeof billingEventSelectSchema.parse>;
export type BillingEventInsert = ReturnType<typeof billingEventInsertSchema.parse>;
