// Phase 4 D-16 + Codex MEDIUM topology fix.
// Plan 04 shipped notifications-send-push (stub). Plan 05 ADDS the REAL
// notifications-send-email beside it. After Plan 05 the notifications
// context owns 2 functions; the Inngest registry totals exactly 9 =
// 8 PRD §3 MVP per D-16 + 1 Phase-4 anti-enumeration add per D-11.
import type { ReactElement } from "react";

import { renderEmail } from "@contexts/notifications/application/send-email";
import type { NotificationsEmailRequestedPayload } from "@contexts/notifications/domain/events";
import { resendAdapter } from "@contexts/notifications/infrastructure/resend-adapter";
import { serverEnv } from "@shared/config/server-env";
import { inngest } from "@shared/inngest/client";

/** REAL — Phase 4 NOTIF-01. Consumes notifications/email.requested events. */
const notificationsSendEmail = inngest.createFunction(
  {
    id: "notifications-send-email",
    retries: 3,
    triggers: [{ event: "notifications/email.requested" }],
  },
  async ({ event, step }) => {
    const data = event.data as NotificationsEmailRequestedPayload;
    // step.run is JSON-serialized in Inngest's type model. The React
    // element survives in-process between steps within a single execution
    // tick, but we re-tag it as ReactElement after the boundary so the
    // resendAdapter signature is preserved.
    const rendered = (await step.run("render-email", async () =>
      renderEmail(data.template, data.props),
    )) as { react: ReactElement };
    const result = await step.run("send-resend", async () =>
      resendAdapter.send({
        from: serverEnv.RESEND_FROM_ADDRESS,
        to: data.to,
        subject: data.subject,
        react: rendered.react,
        templateName: data.template,
      }),
    );
    return { messageId: result.id };
  },
);

/** STUB — Phase 8 (push notifications via web-push). */
const notificationsSendPush = inngest.createFunction(
  {
    id: "notifications-send-push",
    triggers: [{ event: "notifications/push.requested" }],
  },
  async () => ({ status: "not_implemented" }),
);

export const notificationsFunctions = [notificationsSendEmail, notificationsSendPush];
