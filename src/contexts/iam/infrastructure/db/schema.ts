import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * IAM bounded-context schema.
 *
 * Per phase-2 D-01: this module is the schema source for the IAM context.
 * `src/shared/db/schema-registry.ts` re-exports these tables for drizzle-kit
 * only; application/route code imports per-context modules directly.
 *
 * Conventions (D-02..D-07, D-46, D-48):
 * - UUID v4 PKs via `uuid().primaryKey().defaultRandom()` (gen_random_uuid()).
 * - `timestamptz` everywhere with `mode: "string"` so reads round-trip as
 *   ISO-8601 UTC strings without an extra `.toISOString()` step.
 * - Operational status / type fields use `varchar({ enum: [...] })` for
 *   type-level safety; CHECK constraints land with the migration in plan 02-03.
 * - `legal_basis` is a Postgres enum (D-48) because it is a closed legal registry.
 * - FK delete behavior is explicit on every reference (D-07).
 */

export const legalBasisEnum = pgEnum("legal_basis", [
  "consent",
  "contract",
  "legitimate_interest",
]);

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 320 }).notNull(),
    name: varchar("name", { length: 200 }).notNull(),
    locale: varchar("locale", { length: 10 }).notNull().default("pt-BR"),
    timezone: varchar("timezone", { length: 64 }).notNull(),
    notificationTimeLocal: varchar("notification_time_local", { length: 5 })
      .notNull()
      .default("09:00"),
    trialSource: varchar("trial_source", {
      length: 16,
      enum: ["organic", "partner"] as const,
    }).notNull(),
    partnerCode: varchar("partner_code", { length: 64 }),
    ageConfirmedAt: timestamp("age_confirmed_at", { withTimezone: true, mode: "string" }),
    toxicityDisclaimerAcknowledgedAt: timestamp("toxicity_disclaimer_acknowledged_at", {
      withTimezone: true,
      mode: "string",
    }),
    deletionRequestedAt: timestamp("deletion_requested_at", {
      withTimezone: true,
      mode: "string",
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const policyVersions = pgTable(
  "policy_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    version: varchar("version", { length: 32 }).notNull(),
    documentType: varchar("document_type", {
      length: 32,
      enum: ["privacy_policy", "terms_of_service"] as const,
    }).notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true, mode: "string" }).notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("policy_versions_doc_version_idx").on(table.documentType, table.version)],
);

export const consentLogs = pgTable(
  "consent_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    purpose: varchar("purpose", {
      length: 64,
      enum: [
        "identification_third_party",
        "push_notifications",
        "marketing",
        "analytics",
      ] as const,
    }).notNull(),
    legalBasis: legalBasisEnum("legal_basis").notNull(),
    policyVersionId: uuid("policy_version_id")
      .notNull()
      .references(() => policyVersions.id, { onDelete: "restrict" }),
    grantedAt: timestamp("granted_at", { withTimezone: true, mode: "string" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true, mode: "string" }),
    source: varchar("source", {
      length: 32,
      enum: ["signup", "settings", "first_use_prompt"] as const,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("consent_logs_user_id_idx").on(table.userId)],
);

export const partnerStores = pgTable(
  "partner_stores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    code: varchar("code", { length: 64 }).notNull(),
    trialDays: integer("trial_days").notNull().default(30),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("partner_stores_code_idx").on(table.code)],
);

export const dataExportRequests = pgTable(
  "data_export_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", {
      length: 16,
      enum: ["pending", "ready", "delivered", "failed"] as const,
    })
      .notNull()
      .default("pending"),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    downloadUrl: varchar("download_url", { length: 2048 }),
  },
  (table) => [index("data_export_requests_user_id_idx").on(table.userId)],
);

export const dataDeletionRequests = pgTable(
  "data_deletion_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedAt: timestamp("requested_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    gracePeriodEndsAt: timestamp("grace_period_ends_at", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    status: varchar("status", {
      length: 16,
      enum: ["pending", "cancelled", "completed"] as const,
    })
      .notNull()
      .default("pending"),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [index("data_deletion_requests_user_id_idx").on(table.userId)],
);
