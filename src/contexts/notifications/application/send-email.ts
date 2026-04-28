// Phase 4 NOTIF-01/02: render template name + props into a React element for Resend.
// Used by both the notifications-send-email Inngest function (events flow) and
// any future direct-render callers.
import type { ReactElement } from "react";

import type {
  PasswordResetProps,
  TemplateName,
  VerificationProps,
  WelcomeBackProps,
} from "@contexts/notifications/domain/events";
import { PasswordResetEmail } from "@contexts/notifications/infrastructure/email-templates/password-reset";
import { VerificationEmail } from "@contexts/notifications/infrastructure/email-templates/verification";
import { WelcomeBackEmail } from "@contexts/notifications/infrastructure/email-templates/welcome-back";

export type { TemplateName };

export function renderEmail(
  template: TemplateName,
  props: unknown,
): { react: ReactElement } {
  switch (template) {
    case "verification":
      return { react: VerificationEmail(props as VerificationProps) };
    case "password-reset":
      return { react: PasswordResetEmail(props as PasswordResetProps) };
    case "welcome-back":
      return { react: WelcomeBackEmail(props as WelcomeBackProps) };
    default: {
      const exhaustive: never = template;
      throw new Error(`Unknown email template: ${String(exhaustive)}`);
    }
  }
}
