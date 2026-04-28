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

// Phase 4 NOTIF-01/02: notifications/email.requested event payload contracts.
// D-02: Folhário-owned auth email pipeline (Resend transport; Supabase email
// hooks/SMTP/templates NOT used). Producers in Plan 06 (signup), Plan 08
// (password-reset), and the welcome-back path (resolved Q1) emit this event.

export type TemplateName = "verification" | "password-reset" | "welcome-back";

export type VerificationProps = {
  url: string;
  userEmail: string;
};

export type PasswordResetProps = {
  url: string;
  userEmail: string;
};

/** Resolved Q1: signup with already-registered email → 200 + this template. */
export type WelcomeBackProps = {
  resetUrl: string;
  userEmail: string;
};

export type NotificationsEmailRequestedPayload =
  | { template: "verification"; to: string; subject: string; props: VerificationProps }
  | { template: "password-reset"; to: string; subject: string; props: PasswordResetProps }
  | { template: "welcome-back"; to: string; subject: string; props: WelcomeBackProps };
