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
