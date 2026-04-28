import {
  bigint,
  boolean,
  index,
  integer,
  json,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
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
    // Phase 4 D-22: product source of truth for email verification (NOT auth.users.email_confirmed_at, which D-22 explicitly forbids using for product gating)
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true, mode: "string" }),
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
        // Phase 4 AUTH-09: signup-time T&C + Privacy acceptance row marker; the doc identity (T&C vs Privacy) is recorded via policy_version_id → policy_versions.documentType
        "signup_acceptance",
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

/**
 * IAM-support tables (PRD §4 + plan 02-03 acceptance):
 *
 * - `offline_sync_failures`: per-user replay log for offline-queued actions.
 *   D-06: payload is `json` (audit-faithful raw envelope; do not normalize).
 * - `idempotency_keys`: race-safe replay protection for mutating /api/v1
 *   endpoints (D-37/D-38). `request_hash` is NOT NULL by REVIEWS.md contract:
 *   every idempotent write MUST supply a hash; null-hash rows are forbidden.
 *   `expires_at` is set 7 days out by the API helper at insert time.
 *
 * D-07 delete rules: both tables CASCADE on `users.id` deletion (LGPD sweep).
 */

export const offlineSyncFailures = pgTable(
  "offline_sync_failures",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    actionType: varchar("action_type", { length: 32 }).notNull(),
    payload: json("payload").notNull(),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("offline_sync_failures_user_id_idx").on(table.userId)],
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    key: varchar("key", { length: 200 }).notNull(),
    requestHash: text("request_hash").notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_user_key_idx").on(table.userId, table.key),
    index("idempotency_keys_expires_at_idx").on(table.expiresAt),
  ],
);

// Phase 4 D-06: custom email-verification token table; raw tokens exist only in URLs, sha256 hashes only in DB
export const emailVerificationTokens = pgTable(
  "email_verification_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    sentToEmail: varchar("sent_to_email", { length: 320 }).notNull(),
  },
  (table) => [
    uniqueIndex("email_verification_tokens_token_hash_idx").on(table.tokenHash),
    index("email_verification_tokens_user_id_idx").on(table.userId),
  ],
);

// Phase 4 D-09: same shape as verification tokens; expires_at default 1h per AUTH-11
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    sentToEmail: varchar("sent_to_email", { length: 320 }).notNull(),
  },
  (table) => [
    uniqueIndex("password_reset_tokens_token_hash_idx").on(table.tokenHash),
    index("password_reset_tokens_user_id_idx").on(table.userId),
  ],
);

// Phase 4 D-12 + D-14 (Codex HIGH #5): per-IP atomic counter with locked_until column for 5-minute lockout; minute-bucket PK enables UPSERT-RETURNING without races (Pattern 8)
export const authThrottle = pgTable(
  "auth_throttle",
  {
    ip: varchar("ip", { length: 45 }).notNull(),
    endpoint: varchar("endpoint", { length: 64 }).notNull(),
    windowStart: bigint("window_start", { mode: "number" }).notNull(),
    count: integer("count").notNull().default(1),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.ip, table.endpoint, table.windowStart] }),
  ],
);
