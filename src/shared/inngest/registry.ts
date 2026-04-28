// Phase 4 D-17: each context exports its array; this file concatenates.
// After Plan 05 ships, the registry contains EXACTLY 9 functions = 8 PRD §3 MVP + 1 Phase-4 add per D-11:
//   notifications/send-email (real, Plan 05)
//   notifications/send-push (stub — Codex MEDIUM fix moved this from reminders to notifications)
//   care-guide/augment (stub — owned by species-care context; care-guide is not a separate bounded context)
//   iam/process-deletion (stub)
//   iam/generate-export (stub)
//   iam/password-reset-requested (stub here in Plan 04 → real impl in Plan 08 per D-11 — the +1 Phase-4 anti-enumeration add)
//   billing/process-webhook (stub)
//   billing/trial-ending-notifier (stub)
//   reminders/dispatch (stub)
//
// Plan 04 ships 8 (the 7 MVP stubs + iam/password-reset-requested stub). Plan 05 adds the 9th
// (notifications/send-email real impl).
import { iamFunctions } from "@contexts/iam/inngest/functions";
import { notificationsFunctions } from "@contexts/notifications/inngest/functions";
import { billingFunctions } from "@contexts/billing/inngest/functions";
import { remindersFunctions } from "@contexts/reminders/inngest/functions";
import { speciesCareFunctions } from "@contexts/species-care/inngest/functions";
import { identificationFunctions } from "@contexts/identification/inngest/functions";

export const registry = [
  ...iamFunctions,
  ...notificationsFunctions,
  ...billingFunctions,
  ...remindersFunctions,
  ...speciesCareFunctions,
  ...identificationFunctions,
];
