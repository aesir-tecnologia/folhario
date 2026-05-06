import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "@contexts/iam/infrastructure/db/schema";
import { plants } from "@contexts/catalog/infrastructure/db/schema";

/**
 * Identification bounded-context schema (PRD §4 + §6).
 *
 * Per phase-2 D-01: this module is the schema source for the Identification
 * context. The shared registry re-exports these tables for drizzle-kit only;
 * application code imports per-context modules directly.
 *
 * Conventions inherited from the Phase 2 baseline (D-02..D-07):
 * - UUID v4 PKs via `uuid().primaryKey().defaultRandom()` (gen_random_uuid()).
 * - `timestamptz` columns with `mode: "string"` for ISO-8601 round-trip.
 * - `varchar({ enum: [...] as const })` for typed PRD enums; SQL CHECK
 *   constraints land via the migration generated in plan 02-03.
 * - Explicit FK delete rules (D-07): users CASCADE, plants SET NULL on
 *   identification, preserving identification audit when a plant disappears.
 *
 * D-06: `identifications.results` is `jsonb` (queryable top-N payload).
 */

export const identifications = pgTable(
  "identifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plantId: uuid("plant_id").references(() => plants.id, { onDelete: "set null" }),
    photoUrls: text("photo_urls").array().notNull(),
    provider: varchar("provider", { length: 64 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    results: jsonb("results").notNull(),
    selectedResult: jsonb("selected_result"),
    manualCorrection: text("manual_correction"),
    latencyMs: integer("latency_ms").notNull(),
    consentVersion: varchar("consent_version", { length: 32 }).notNull(),
    status: varchar("status", {
      length: 16,
      enum: ["success", "failed"] as const,
    }).notNull(),
    failureReason: varchar("failure_reason", {
      length: 32,
      enum: [
        "timeout",
        "provider_unavailable",
        "cost_ceiling_reached",
        "breaker_open",
        "invalid_response",
      ] as const,
    }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("identifications_user_id_idx").on(table.userId),
    index("identifications_plant_id_idx").on(table.plantId),
  ],
);

export const identificationLimits = pgTable("identification_limits", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: varchar("tier", {
    length: 16,
    enum: ["trial", "paid"] as const,
  })
    .notNull()
    .unique(),
  dailyCap: integer("daily_cap").notNull(),
  periodCap: integer("period_cap").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
  updatedBy: varchar("updated_by", { length: 128 }),
});

export const providerBudgets = pgTable(
  "provider_budgets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 64 }).notNull(),
    purpose: varchar("purpose", {
      length: 32,
      enum: ["identification", "care_guide"] as const,
    }).notNull(),
    dailyCostCapCents: integer("daily_cost_cap_cents").notNull(),
    alertThresholdPct: integer("alert_threshold_pct").notNull().default(80),
    minConfidence: numeric("min_confidence", { precision: 3, scale: 2 }),
    isActive: boolean("is_active").notNull().default(true),
    costPerRequestCents: integer("cost_per_request_cents").notNull().default(2),
    lastAlertedAt: date("last_alerted_at"),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedBy: varchar("updated_by", { length: 128 }),
  },
  (table) => [
    uniqueIndex("provider_budgets_provider_purpose_idx").on(table.provider, table.purpose),
  ],
);

export const providerUsageCounters = pgTable(
  "provider_usage_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provider: varchar("provider", { length: 64 }).notNull(),
    purpose: varchar("purpose", {
      length: 32,
      enum: ["identification", "care_guide"] as const,
    }).notNull(),
    utcDate: date("utc_date").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    estimatedCostCents: integer("estimated_cost_cents").notNull().default(0),
    lastUpdated: timestamp("last_updated", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("provider_usage_counters_provider_purpose_date_idx").on(
      table.provider,
      table.purpose,
      table.utcDate,
    ),
  ],
);

export const providerCircuitBreakers = pgTable("provider_circuit_breakers", {
  provider: varchar("provider", { length: 64 }).primaryKey(),
  state: varchar("state", { length: 16, enum: ["closed", "open", "half_open"] as const })
    .notNull()
    .default("closed"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),
  openedAt: timestamp("opened_at", { withTimezone: true, mode: "string" }),
  lastFailureAt: timestamp("last_failure_at", { withTimezone: true, mode: "string" }),
  inFlightAt: timestamp("in_flight_at", { withTimezone: true, mode: "string" }),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" }).notNull().defaultNow(),
});
