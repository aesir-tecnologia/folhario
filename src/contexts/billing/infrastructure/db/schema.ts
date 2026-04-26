import {
  boolean,
  index,
  json,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "@contexts/iam/infrastructure/db/schema";

/**
 * Billing bounded-context schema (PRD §4 + §13).
 *
 * Per phase-2 D-01: schema source for Billing aggregates. The shared registry
 * re-exports these tables for drizzle-kit only.
 *
 * D-06: `BillingEvent.payload` is `json` (audit-faithful opaque storage —
 * keep raw provider envelope verbatim, no jsonb normalization). `Identification.results`
 * by contrast uses `jsonb` because we query into the top-N payload.
 *
 * D-07 delete rules:
 * - subscriptions.user_id → users.id ON DELETE CASCADE.
 * - billing_events.subscription_id → subscriptions.id ON DELETE SET NULL
 *   so audit rows survive a subscription cleanup. PRD §4: subscription_id
 *   is nullable because some events arrive before the subscription is linked.
 */

export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerCustomerId: varchar("provider_customer_id", { length: 128 }),
    providerSubscriptionId: varchar("provider_subscription_id", { length: 128 }),
    status: varchar("status", {
      length: 16,
      enum: ["trialing", "active", "past_due", "canceled", "expired"] as const,
    }).notNull(),
    trialStartDate: timestamp("trial_start_date", { withTimezone: true, mode: "string" }).notNull(),
    trialEndDate: timestamp("trial_end_date", { withTimezone: true, mode: "string" }).notNull(),
    currentPeriodStart: timestamp("current_period_start", {
      withTimezone: true,
      mode: "string",
    }),
    currentPeriodEnd: timestamp("current_period_end", { withTimezone: true, mode: "string" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("subscriptions_user_id_idx").on(table.userId)],
);

export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subscriptionId: uuid("subscription_id").references(() => subscriptions.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 32 }).notNull(),
    eventId: varchar("event_id", { length: 128 }).notNull(),
    eventType: varchar("event_type", { length: 64 }).notNull(),
    payload: json("payload").notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("billing_events_provider_event_id_idx").on(table.provider, table.eventId),
    index("billing_events_subscription_id_idx").on(table.subscriptionId),
  ],
);
