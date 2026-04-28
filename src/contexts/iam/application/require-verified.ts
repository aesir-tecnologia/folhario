/**
 * Phase 4 D-21 — application-layer re-export of the API auth gates.
 *
 * Plans 04-04..04-11 import from this module rather than reaching across the
 * `@shared/api` boundary directly. Behavior lives in `@shared/api/auth`.
 */
export { requireApiUser, requireVerifiedUser } from "@shared/api/auth";
export type { ApiUserResult, VerifiedUserResult } from "@shared/api/auth";
