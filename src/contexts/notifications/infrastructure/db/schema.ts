import { index, jsonb, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

import { users } from "@contexts/iam/infrastructure/db/schema";

/**
 * Notifications bounded-context schema (PRD §4).
 *
 * Per phase-2 D-01: schema source for Notifications aggregates. The shared
 * registry re-exports these tables for drizzle-kit only.
 *
 * `push_subscriptions` is per-device (D-46 / PRD §4: client-stable device id +
 * push service endpoint + VAPID auth keys). PRD: dispatch deletes rows on
 * 410/404 from push provider.
 *
 * D-07: push_subscriptions.user_id → users.id ON DELETE CASCADE so deletion
 * sweeps subscriptions with the user.
 *
 * `keys` is `jsonb` because we look up VAPID `auth` and `p256dh` fields when
 * dispatching from Inngest functions (Phase 4+).
 */

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deviceId: varchar("device_id", { length: 128 }).notNull(),
    endpoint: varchar("endpoint", { length: 2048 }).notNull(),
    keys: jsonb("keys").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("push_subscriptions_user_device_idx").on(table.userId, table.deviceId),
    index("push_subscriptions_user_id_idx").on(table.userId),
  ],
);
