// Phase 4 D-16/D-17: IAM context Inngest functions (3 of 8 Plan-04 registry entries).
// Stubs here:
//   - iam-process-deletion (PRD §3 MVP — Phase 11)
//   - iam-generate-export (PRD §3 MVP — Phase 11)
//   - iam-password-reset-requested (Phase-4 anti-enumeration add per D-11; Plan 08 replaces this stub with real impl)
//
// NOTE on auth-throttle cleanup: D-12 OR clause permits partial-index TTL alternative.
// Plan 02 added `auth_throttle_window_start_idx`; Phase 11+ may add a real cron.
//
// NOTE on iam/password-reset-requested: D-11 mandates this function for AUTH-11 anti-enumeration
// (timing-attack defense — route handler MUST return 200 in constant time, conditional logic
// happens asynchronously inside this function). User resolved D-11 vs D-16 conflict on
// 2026-04-26 by reframing INFRA-10 as "8 PRD §3 MVP + 1 Phase-4 anti-enumeration add".
// Plan 04 ships this as a stub so the dashboard topology is correct from day one;
// Plan 08 replaces the stub with the real impl (same pattern as Plan 05 replacing
// notifications/send-email — except this slot ships as a stub up-front, not added net-new).
import { inngest } from "@shared/inngest/client";

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

/** STUB — Plan 08 replaces this with real impl per D-11 (anti-enumeration timing-attack defense). */
const iamPasswordResetRequested = inngest.createFunction(
  { id: "iam-password-reset-requested", triggers: [{ event: "iam/password-reset-requested" }] },
  async () => ({ status: "not_implemented" }),
);

export const iamFunctions = [iamProcessDeletion, iamGenerateExport, iamPasswordResetRequested];
