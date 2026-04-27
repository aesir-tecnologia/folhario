import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { pushSubscriptions } from "@contexts/notifications/infrastructure/db/schema";

/**
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).
 *
 * Notifications domain Zod schemas (D-19, D-40). Routes/use-cases in later
 * phases import from here, not from the table modules. Until a consumer
 * lands, adding refinements here has no effect because nothing imports them.
 */

export const pushSubscriptionSelectSchema = createSelectSchema(pushSubscriptions);
export const pushSubscriptionInsertSchema = createInsertSchema(pushSubscriptions);
export type PushSubscription = ReturnType<typeof pushSubscriptionSelectSchema.parse>;
export type PushSubscriptionInsert = ReturnType<typeof pushSubscriptionInsertSchema.parse>;
