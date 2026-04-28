// Phase 4 NOTIF-01 / D-20.
// Resend SDK wrapper with dev console-log fallback. When RESEND_API_KEY is
// empty/undefined we never instantiate the SDK; instead, .send() logs the
// payload to stdout and returns id "dev-mode". CI sets RESEND_API_KEY to
// the Resend sandbox key (D-29) so the same path exercises the real SDK.
//
// Anti-pattern (RESEARCH.md line 807): the Resend SDK returns
// {data, error}. Do NOT wrap .emails.send() in try/catch — read .error and
// throw directly so Inngest retries see a real error.
import type { ReactElement } from "react";
import { Resend } from "resend";

import { serverEnv } from "@shared/config/server-env";

const resend = serverEnv.RESEND_API_KEY
  ? new Resend(serverEnv.RESEND_API_KEY)
  : null;

export const resendAdapter = {
  async send(params: {
    from: string;
    to: string;
    subject: string;
    react: ReactElement;
  }): Promise<{ id: string }> {
    if (!resend) {
      // D-20 dev fallback — log payload, never network.
      // eslint-disable-next-line no-console
      console.log("[resend-dev] would send", {
        from: params.from,
        to: params.to,
        subject: params.subject,
      });
      return { id: "dev-mode" };
    }
    const { data, error } = await resend.emails.send(params);
    if (error) throw new Error(`resend.send failed: ${error.message}`);
    if (!data) throw new Error("resend.send returned no data");
    return { id: data.id };
  },
};
