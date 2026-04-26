import { createSelectSchema, createInsertSchema } from "drizzle-zod";

import {
  consentLogs,
  dataDeletionRequests,
  dataExportRequests,
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

export const consentLogSelectSchema = createSelectSchema(consentLogs);
export const consentLogInsertSchema = createInsertSchema(consentLogs);
export type ConsentLog = ReturnType<typeof consentLogSelectSchema.parse>;
export type ConsentLogInsert = ReturnType<typeof consentLogInsertSchema.parse>;

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
