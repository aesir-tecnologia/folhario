import { z } from "zod";
import { createSelectSchema, createInsertSchema } from "drizzle-zod";

import {
  dataDeletionRequests,
  dataExportRequests,
  idempotencyKeys,
  offlineSyncFailures,
  partnerStores,
  policyVersions,
  users,
} from "@contexts/iam/infrastructure/db/schema";

/**
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03,
 * mirroring the 6 other context `domain/schemas.ts` modules). Routes/
 * use-cases in later phases will import from here, not from the table
 * modules. Until a consumer lands, adding refinements here has no effect
 * because nothing imports them.
 *
 * IAM domain Zod schemas derived from drizzle-zod (D-19, D-40). Refinements
 * (cross-field rules, formats not encodable at the column type) belong here,
 * one layer above the column-faithful generated shape.
 *
 * The IAM consent-log Zod root lives in `consent-schemas.ts` (the
 * route-consumed module — WR-01 cleanup); do NOT re-derive
 * `createInsertSchema(consentLogs)` here.
 */

export const userSelectSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users);
export type User = ReturnType<typeof userSelectSchema.parse>;
export type UserInsert = ReturnType<typeof userInsertSchema.parse>;

export const policyVersionSelectSchema = createSelectSchema(policyVersions);
export const policyVersionInsertSchema = createInsertSchema(policyVersions);
export type PolicyVersion = ReturnType<typeof policyVersionSelectSchema.parse>;
export type PolicyVersionInsert = ReturnType<typeof policyVersionInsertSchema.parse>;

export const partnerStoreSelectSchema = createSelectSchema(partnerStores);
export const partnerStoreInsertSchema = createInsertSchema(partnerStores);
export type PartnerStore = ReturnType<typeof partnerStoreSelectSchema.parse>;
export type PartnerStoreInsert = ReturnType<typeof partnerStoreInsertSchema.parse>;

export const dataExportRequestSelectSchema = createSelectSchema(dataExportRequests);
export const dataExportRequestInsertSchema = createInsertSchema(dataExportRequests);
export type DataExportRequest = ReturnType<typeof dataExportRequestSelectSchema.parse>;
export type DataExportRequestInsert = ReturnType<typeof dataExportRequestInsertSchema.parse>;

export const dataDeletionRequestSelectSchema = createSelectSchema(dataDeletionRequests);
export const dataDeletionRequestInsertSchema = createInsertSchema(dataDeletionRequests);
export type DataDeletionRequest = ReturnType<typeof dataDeletionRequestSelectSchema.parse>;
export type DataDeletionRequestInsert = ReturnType<typeof dataDeletionRequestInsertSchema.parse>;

export const offlineSyncFailureSelectSchema = createSelectSchema(offlineSyncFailures);
export const offlineSyncFailureInsertSchema = createInsertSchema(offlineSyncFailures);
export type OfflineSyncFailure = ReturnType<typeof offlineSyncFailureSelectSchema.parse>;
export type OfflineSyncFailureInsert = ReturnType<typeof offlineSyncFailureInsertSchema.parse>;

export const idempotencyKeySelectSchema = createSelectSchema(idempotencyKeys);
export const idempotencyKeyInsertSchema = createInsertSchema(idempotencyKeys);
export type IdempotencyKey = ReturnType<typeof idempotencyKeySelectSchema.parse>;
export type IdempotencyKeyInsert = ReturnType<typeof idempotencyKeyInsertSchema.parse>;

// ─────────────────────────────────────────────────────────────────────────────
// Phase 4 IAM request-body schemas (D-30: Claude proposes initial drafts;
// founder reviews during plan execution).
//
// Every Phase 4 IAM endpoint validates its untrusted body against one of these
// schemas at the API boundary (T-04-03-07: prototype-pollution guard via
// `.strict()` rejecting unknown keys). Closed error registry (Phase 1 D-10):
// failures map to ErrorCode.ValidationFailed at the route layer.
// ─────────────────────────────────────────────────────────────────────────────

// AUTH-08: validate against IANA timezone list. Brazilian zones surface first
// in the UI per UI-SPEC; the schema is locale-agnostic.
const ianaTimezone = z.string().refine(
  (v) => Intl.supportedValuesOf("timeZone").includes(v),
  { message: "invalid_timezone" },
);

const partnerCodeSchema = z
  .string()
  .regex(/^[A-Za-z0-9-]*$/)
  .optional()
  .or(z.literal(""));

export const signupRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(8).max(72),
    age_confirmed: z.literal(true), // AUTH-06
    terms_accepted: z.literal(true), // AUTH-09
    privacy_accepted: z.literal(true), // AUTH-09
    timezone: ianaTimezone, // AUTH-08
    partner_code: partnerCodeSchema,
  })
  .strict();
export type SignupRequest = z.infer<typeof signupRequestSchema>;

export const loginRequestSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();
export type LoginRequest = z.infer<typeof loginRequestSchema>;

export const passwordResetRequestSchema = z
  .object({
    email: z.string().email(),
  })
  .strict();
export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>;

export const passwordResetConsumeSchema = z
  .object({
    token: z.string().length(64),
    password: z.string().min(8).max(72),
  })
  .strict();
export type PasswordResetConsume = z.infer<typeof passwordResetConsumeSchema>;

export const changePasswordSchema = z
  .object({
    current_password: z.string().min(1),
    new_password: z.string().min(8).max(72),
  })
  .strict();
export type ChangePassword = z.infer<typeof changePasswordSchema>;

export const oauthCompleteSchema = z
  .object({
    age_confirmed: z.literal(true),
    terms_accepted: z.literal(true),
    privacy_accepted: z.literal(true),
    timezone: ianaTimezone,
    partner_code: partnerCodeSchema,
  })
  .strict();
export type OAuthComplete = z.infer<typeof oauthCompleteSchema>;
