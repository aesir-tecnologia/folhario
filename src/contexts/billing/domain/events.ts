// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 / §13 — Billing bounded-context events. `trial.ending` fires from
// the daily `billing/trial-ending-notifier` cron at T-3d and T-1d; consumers
// in Notifications send the email. Webhook idempotency (BillingEvent.event_id
// unique) is the source of truth for `subscription.status_changed` /
// `payment.failed`.

export const BillingEvents = {
  SubscriptionStatusChanged: "subscription.status_changed",
  PaymentFailed: "payment.failed",
  TrialEnding: "trial.ending",
} as const;

export type BillingEventName = (typeof BillingEvents)[keyof typeof BillingEvents];

export interface SubscriptionStatusChangedPayload {
  subscriptionId: string;
  userId: string;
  fromStatus: string | null;
  toStatus: "trialing" | "active" | "past_due" | "canceled" | "expired";
  changedAt: string;
}

export interface PaymentFailedPayload {
  subscriptionId: string;
  userId: string;
  provider: string;
  reason: string;
  failedAt: string;
}

export interface TrialEndingPayload {
  subscriptionId: string;
  userId: string;
  trialEndDate: string;
  daysRemaining: 1 | 3;
  notifiedAt: string;
}
