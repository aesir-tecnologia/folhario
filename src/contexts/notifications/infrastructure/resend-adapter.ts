// Phase 4 NOTIF-01 / D-20.
// Resend SDK wrapper with dev console-log fallback. When RESEND_API_KEY is
// empty/undefined we never instantiate the SDK; instead, .send() logs a
// SANITIZED payload (no rendered HTML — it contains raw verification/
// reset token URLs) to stdout and returns id "dev-mode". CI sets
// RESEND_API_KEY to the Resend sandbox key (D-29) so the same path
// exercises the real SDK.
//
// Phase 04 review CR-01: in production the env schema requires
// RESEND_API_KEY; if for any reason `resend` is still null at runtime,
// we throw rather than risk leaking a token URL to Vercel logs.
//
// Anti-pattern (RESEARCH.md line 807): the Resend SDK returns
// {data, error}. Do NOT wrap .emails.send() in try/catch — read .error and
// throw directly so Inngest retries see a real error.
import type { ReactElement } from "react";
import { Resend } from "resend";

import { serverEnv } from "@shared/config/server-env";

const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;

export const resendAdapter = {
  async send(params: {
    from: string;
    to: string;
    subject: string;
    react: ReactElement;
    templateName?: string;
  }): Promise<{ id: string }> {
    if (!resend) {
      // Phase 04 review CR-01: refuse to log token URLs into prod stdout.
      if (process.env.NODE_ENV === "production") {
        throw new Error(
          "resendAdapter.send: RESEND_API_KEY missing in production — " +
            "refusing to fall through to dev console.log (would leak token URL).",
        );
      }
      // D-20 dev fallback — log a SANITIZED summary only. The rendered HTML
      // contains raw verification/reset token URLs; logging it here (even
      // in dev) trains operators to expect tokens in logs, which CR-01
      // identifies as the leak surface. Devs can inspect the React element
      // tree via React DevTools or the email-templates unit tests.
       
      console.log("[resend-dev] would send (dev fallback fired — body omitted)", {
        from: params.from,
        to: params.to,
        subject: params.subject,
        templateName: params.templateName ?? "unknown",
        devFallback: true,
      });
      return { id: "dev-mode" };
    }
    const { data, error } = await resend.emails.send({
      from: params.from,
      to: params.to,
      subject: params.subject,
      react: params.react,
    });
    if (error) throw new Error(`resend.send failed: ${error.message}`);
    if (!data) throw new Error("resend.send returned no data");
    return { id: data.id };
  },
};
