// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 / §10 — Reminders bounded-context events. The cron-fired summary
// event (`daily_reminder_summary.due`) is dispatched once per user per day at
// the user's `notification_time_local` when ≥1 reminder is due/overdue;
// Notifications context consumes it to send push.

export const RemindersEvents = {
  DailyReminderSummaryDue: "daily_reminder_summary.due",
  ReminderCompleted: "reminder.completed",
} as const;

export type RemindersEventName =
  (typeof RemindersEvents)[keyof typeof RemindersEvents];

export interface DailyReminderSummaryDuePayload {
  userId: string;
  dueOrOverdueCount: number;
  notificationTimeLocal: string; // HH:MM
  timezone: string;
  dueAt: string;
}

export interface ReminderCompletedPayload {
  reminderId: string;
  plantId: string;
  userId: string;
  action: "done" | "snoozed";
  scheduledDate: string;
  actedAt: string;
  snoozeUntil: string | null;
}
