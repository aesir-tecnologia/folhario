import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { plants } from "@contexts/catalog/infrastructure/db/schema";

/**
 * Reminders bounded-context schema (PRD §4 + §10).
 *
 * Per phase-2 D-01: this module is the schema source for the Reminders
 * context. The shared registry re-exports these tables for drizzle-kit only.
 *
 * D-07 / PRD §4 delete rules:
 * - reminders.plant_id → plants.id ON DELETE CASCADE (plant deletion cascades reminders).
 * - reminder_logs.reminder_id → reminders.id ON DELETE CASCADE.
 *
 * `next_due_at` is computed at create/advance from `User.notification_time_local +
 * User.timezone` per PRD §10; this schema only stores the precomputed UTC value.
 */

export const reminders = pgTable(
  "reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plantId: uuid("plant_id")
      .notNull()
      .references(() => plants.id, { onDelete: "cascade" }),
    type: varchar("type", {
      length: 16,
      enum: ["watering", "fertilization"] as const,
    }).notNull(),
    frequencyDays: integer("frequency_days").notNull(),
    advanceRule: varchar("advance_rule", {
      length: 16,
      enum: ["from_scheduled", "from_acted"] as const,
    })
      .notNull()
      .default("from_scheduled"),
    nextDueAt: timestamp("next_due_at", { withTimezone: true, mode: "string" }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("reminders_plant_id_idx").on(table.plantId),
    index("reminders_next_due_at_idx").on(table.nextDueAt),
  ],
);

export const reminderLogs = pgTable(
  "reminder_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reminderId: uuid("reminder_id")
      .notNull()
      .references(() => reminders.id, { onDelete: "cascade" }),
    action: varchar("action", {
      length: 16,
      enum: ["done", "snoozed"] as const,
    }).notNull(),
    scheduledDate: date("scheduled_date").notNull(),
    actedAt: timestamp("acted_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    snoozeUntil: timestamp("snooze_until", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("reminder_logs_reminder_id_idx").on(table.reminderId)],
);
