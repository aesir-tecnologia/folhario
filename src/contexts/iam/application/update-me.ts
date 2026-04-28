// Phase 4 plan 09 — Codex HIGH #3: keep Drizzle out of the /api/v1/iam/me
// route handler. The route calls this use-case which delegates to the users
// repository.

import { updateUserTimezone } from "@contexts/iam/infrastructure/db/users";

export async function updateMyTimezone(opts: {
  userId: string;
  timezone: string;
}): Promise<void> {
  await updateUserTimezone(opts.userId, opts.timezone);
}
