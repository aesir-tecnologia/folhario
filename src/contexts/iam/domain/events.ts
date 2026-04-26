// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 — IAM bounded-context events. These constants are the canonical
// event-name registry for downstream async handlers (Phase 4+); types
// describe the JSON payload shape consumers must rely on.

export const IamEvents = {
  UserSignedUp: "user.signed_up",
  UserConsentGranted: "user.consent_granted",
  UserConsentRevoked: "user.consent_revoked",
  UserDeletionRequested: "user.deletion_requested",
  UserDeleted: "user.deleted",
  DataExportRequested: "data_export.requested",
} as const;

export type IamEventName = (typeof IamEvents)[keyof typeof IamEvents];

export interface UserSignedUpPayload {
  userId: string;
  email: string;
  trialSource: "organic" | "partner";
  partnerCode: string | null;
  signedUpAt: string;
}

export interface UserConsentGrantedPayload {
  userId: string;
  purpose: string;
  policyVersionId: string;
  grantedAt: string;
}

export interface UserConsentRevokedPayload {
  userId: string;
  purpose: string;
  policyVersionId: string;
  revokedAt: string;
}

export interface UserDeletionRequestedPayload {
  userId: string;
  requestedAt: string;
  gracePeriodEndsAt: string;
}

export interface UserDeletedPayload {
  userId: string;
  deletedAt: string;
}

export interface DataExportRequestedPayload {
  userId: string;
  requestId: string;
  requestedAt: string;
}
