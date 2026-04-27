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
 * Domain Zod schemas derived from drizzle-zod (D-19, D-40).
 *
 * Routes/use-cases import these — never raw table definitions. Refinements
 * (cross-field rules, formats not encodable at the column type) belong here,
 * one layer above the column-faithful generated shape.
 */

export const userSelectSchema = createSelectSchema(users);
export const userInsertSchema = createInsertSchema(users);
export type User = ReturnType<typeof userSelectSchema.parse>;
export type UserInsert = ReturnType<typeof userInsertSchema.parse>;

export const policyVersionSelectSchema = createSelectSchema(policyVersions);
export const policyVersionInsertSchema = createInsertSchema(policyVersions);
export type PolicyVersion = ReturnType<typeof policyVersionSelectSchema.parse>;
export type PolicyVersionInsert = ReturnType<typeof policyVersionInsertSchema.parse>;

// Note: consentLog{Insert,Select}Schema live in `consent-schemas.ts` — that
// is the canonical, route-consumed module (D-19, WR-01). Do NOT re-derive
// `createInsertSchema(consentLogs)` here; a duplicate root re-creates the
// drift hazard where a refinement added in one module silently fails to
// propagate to the route.
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
