// Phase 4 D-16 + Codex MEDIUM topology fix.
// notifications-send-push lives here (NOT reminders).
// Plan 05 will add the REAL notifications-send-email function alongside this stub.
import { inngest } from "@shared/inngest/client";

/** STUB — Phase 8 (push notifications via web-push). */
const notificationsSendPush = inngest.createFunction(
  { id: "notifications-send-push", triggers: [{ event: "notifications/push.requested" }] },
  async () => ({ status: "not_implemented" }),
);

export const notificationsFunctions = [notificationsSendPush];
