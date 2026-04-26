// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 — Notifications bounded-context events. Notifications also consumes
// many cross-context events (daily_reminder_summary.due, care_guide.augmented,
// subscription.status_changed, deletion events, payment.failed, trial.ending);
// those names are owned by their producing contexts and imported there. The
// names below are what Notifications itself emits when a send completes or fails.

export const NotificationsEvents = {
  NotificationSent: "notification.sent",
  NotificationFailed: "notification.failed",
} as const;

export type NotificationsEventName =
  (typeof NotificationsEvents)[keyof typeof NotificationsEvents];

export type NotificationChannel = "email" | "push";

export interface NotificationSentPayload {
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  templateId: string;
  sentAt: string;
}

export interface NotificationFailedPayload {
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  templateId: string;
  reason: string;
  attempt: number;
  failedAt: string;
}
