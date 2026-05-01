// Phase 4 D-17: each context exports its array; this file concatenates.
// After Plan 05-06 ships, the registry contains EXACTLY 11 functions =
// 8 PRD §3 MVP + 1 Phase-4 add per D-11 + 2 Phase-5 catalog functions per D-22/D-24:
//   notifications/send-email (real, Plan 05 Phase 4)
//   notifications/send-push (stub)
//   care-guide/augment (stub)
//   iam/process-deletion (stub)
//   iam/generate-export (stub)
//   iam/password-reset-requested (stub here in Plan 04 → real impl in Plan 08 per D-11)
//   billing/process-webhook (stub)
//   billing/trial-ending-notifier (stub)
//   reminders/dispatch (stub)
//   catalog/cleanup-storage (real, Phase 5 Plan 05-06 — D-22)
//   catalog/cleanup-storage-reconciler (real, Phase 5 Plan 05-06 — D-24)
import { iamFunctions } from "@contexts/iam/inngest/functions";
import { notificationsFunctions } from "@contexts/notifications/inngest/functions";
import { billingFunctions } from "@contexts/billing/inngest/functions";
import { remindersFunctions } from "@contexts/reminders/inngest/functions";
import { speciesCareFunctions } from "@contexts/species-care/inngest/functions";
import { identificationFunctions } from "@contexts/identification/inngest/functions";
import { catalogFunctions } from "@contexts/catalog/inngest/functions";

export const registry = [
  ...iamFunctions,
  ...notificationsFunctions,
  ...billingFunctions,
  ...remindersFunctions,
  ...speciesCareFunctions,
  ...identificationFunctions,
  ...catalogFunctions,
];
