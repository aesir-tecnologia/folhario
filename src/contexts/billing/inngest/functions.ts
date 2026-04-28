// Phase 4 D-16: stubs for Phase 10 (billing).
import { inngest } from "@shared/inngest/client";

/** STUB — Phase 10 (Stripe webhook handler). */
const billingProcessWebhook = inngest.createFunction(
  { id: "billing-process-webhook", triggers: [{ event: "billing.webhook.received" }] },
  async () => ({ status: "not_implemented" }),
);

/** STUB — Phase 10 (trial-ending notifier). Daily fire is acceptable; Phase 10 may adjust schedule. */
const billingTrialEndingNotifier = inngest.createFunction(
  { id: "billing-trial-ending-notifier", triggers: [{ cron: "0 9 * * *" }] },
  async () => ({ status: "not_implemented" }),
);

export const billingFunctions = [billingProcessWebhook, billingTrialEndingNotifier];
