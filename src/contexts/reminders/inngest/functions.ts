// Phase 4 D-16: 1 stub for Phase 8 (reminders-dispatch).
// notifications/send-push moved to notifications context per Codex MEDIUM topology fix.
//
// Trigger note: stub uses an event NO ONE EMITS in Phase 4 (`reminders/dispatch.requested.STUB`)
// so the function appears in the Inngest dashboard for topology visibility WITHOUT firing.
// A cron trigger here (e.g. "* * * * *") would spam the local Inngest dev server and burn
// free-tier quota in cloud. Phase 8 replaces BOTH the trigger (real cron schedule per
// PRD §20) AND the handler (real dispatch logic).
import { inngest } from "@shared/inngest/client";

/** STUB — Phase 8 (reminder-dispatch loop). STUB-only event trigger; Phase 8 replaces with real cron. */
const remindersDispatch = inngest.createFunction(
  { id: "reminders-dispatch", triggers: [{ event: "reminders/dispatch.requested.STUB" }] },
  async () => ({ status: "not_implemented" }),
);

export const remindersFunctions = [remindersDispatch];
