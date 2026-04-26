import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { reminderLogs, reminders } from "@contexts/reminders/infrastructure/db/schema";

/**
 * Reminders domain Zod schemas (D-19, D-40).
 *
 * Routes/use-cases import from here, not from the table modules.
 */

export const reminderSelectSchema = createSelectSchema(reminders);
export const reminderInsertSchema = createInsertSchema(reminders);
export type Reminder = ReturnType<typeof reminderSelectSchema.parse>;
export type ReminderInsert = ReturnType<typeof reminderInsertSchema.parse>;

export const reminderLogSelectSchema = createSelectSchema(reminderLogs);
export const reminderLogInsertSchema = createInsertSchema(reminderLogs);
export type ReminderLog = ReturnType<typeof reminderLogSelectSchema.parse>;
export type ReminderLogInsert = ReturnType<typeof reminderLogInsertSchema.parse>;
