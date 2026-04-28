// Phase 4 NOTIF-02: welcome-back email template — Task 1 skeleton (Task 2 GREEN fills in).
import { Html } from "@react-email/components";

import type { WelcomeBackProps } from "@contexts/notifications/domain/events";

export function WelcomeBackEmail(_props: WelcomeBackProps) {
  return <Html lang="pt-BR" />;
}
