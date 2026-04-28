// Phase 4 NOTIF-02: password-reset email template — Task 1 skeleton (Task 2 GREEN fills in).
import { Html } from "@react-email/components";

import type { PasswordResetProps } from "@contexts/notifications/domain/events";

export function PasswordResetEmail(_props: PasswordResetProps) {
  return <Html lang="pt-BR" />;
}
