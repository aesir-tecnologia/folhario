// Phase 4 D-16/D-17: IAM context Inngest functions (3 of 9 registry entries).
// Stubs:
//   - iam-process-deletion (PRD §3 MVP — Phase 11)
//   - iam-generate-export (PRD §3 MVP — Phase 11)
// REAL (Plan 08 replaces Plan 04's stub):
//   - iam-password-reset-requested per D-11 (anti-enumeration timing-attack
//     defense). The route handler is a thin inngest.send wrapper with
//     constant-time response; all conditional logic (user lookup,
//     hasPassword check, token mint, email dispatch) lives async here —
//     invisible from the route response timing. Same pattern as Plan 05
//     replacing the notifications/send-email stub with real impl.
//
// User resolved D-11 vs D-16 conflict on 2026-04-26 by reframing INFRA-10
// as "8 PRD §3 MVP + 1 Phase-4 anti-enumeration add" — keeping the
// password-reset slot at +1 in the registry (total 9).
//
// NOTE on auth-throttle cleanup: D-12 OR clause permits partial-index TTL
// alternative. Plan 02 added `auth_throttle_window_start_idx`; Phase 11+
// may add a real cron.
import { inngest } from "@shared/inngest/client";
import { requestPasswordReset } from "@contexts/iam/application/request-password-reset";

/** STUB — Phase 11. */
const iamProcessDeletion = inngest.createFunction(
  { id: "iam-process-deletion", triggers: [{ event: "iam/deletion-requested" }] },
  async () => ({ status: "not_implemented" }),
);

/** STUB — Phase 11. */
const iamGenerateExport = inngest.createFunction(
  { id: "iam-generate-export", triggers: [{ event: "iam/export-requested" }] },
  async () => ({ status: "not_implemented" }),
);

/**
 * REAL — Plan 08 per D-11 (anti-enumeration timing-attack defense).
 * Replaces the Plan 04 stub. The route handler emits this event with
 * constant-time sub-ms response; all conditional logic happens here async.
 * D-25 atomicity: requestPasswordReset wraps mint in db.transaction.
 */
const iamPasswordResetRequested = inngest.createFunction(
  {
    id: "iam-password-reset-requested",
    triggers: [{ event: "iam/password-reset-requested" }],
  },
  async ({ event, step }) => {
    const { email, requestUrl } = event.data as {
      email: string;
      requestUrl: string;
    };
    await step.run("dispatch-password-reset", () =>
      requestPasswordReset({ email, requestUrl }),
    );
    return { status: "ok" };
  },
);

export const iamFunctions = [
  iamProcessDeletion,
  iamGenerateExport,
  iamPasswordResetRequested,
];
