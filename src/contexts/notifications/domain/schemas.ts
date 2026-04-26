import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { pushSubscriptions } from "@contexts/notifications/infrastructure/db/schema";

/**
 * Notifications domain Zod schemas (D-19, D-40).
 *
 * Routes/use-cases import from here, not from the table modules.
 */

export const pushSubscriptionSelectSchema = createSelectSchema(pushSubscriptions);
export const pushSubscriptionInsertSchema = createInsertSchema(pushSubscriptions);
export type PushSubscription = ReturnType<typeof pushSubscriptionSelectSchema.parse>;
export type PushSubscriptionInsert = ReturnType<typeof pushSubscriptionInsertSchema.parse>;
