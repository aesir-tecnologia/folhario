import {
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { users } from "@contexts/iam/infrastructure/db/schema";
import { species } from "@contexts/species-care/infrastructure/db/schema";

/**
 * Catalog ("Meu Jardim") bounded-context schema.
 *
 * Per phase-2 D-01: schema source for catalog aggregates. Cross-context FK
 * imports (`users`, `species`) are conventional Drizzle and not a D-01
 * violation — D-01 only forbids using `src/shared/db/schema-registry.ts`
 * as an application barrel. Per-context module-to-module imports for FK
 * targets are the supported way to model real referential integrity.
 *
 * FK delete rules (D-07, PRD §4):
 * - plants.user_id → users.id ON DELETE CASCADE (LGPD deletion sweep)
 * - plants.species_id → species.id ON DELETE SET NULL (preserve user data
 *   when a species reference is purged)
 * - photo_entries.plant_id → plants.id ON DELETE CASCADE
 */

export const plants = pgTable(
  "plants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    speciesId: uuid("species_id").references(() => species.id, { onDelete: "set null" }),
    name: varchar("name", { length: 200 }).notNull(),
    nickname: varchar("nickname", { length: 200 }),
    location: varchar("location", { length: 200 }),
    acquisitionDate: date("acquisition_date"),
    notes: text("notes"),
    coverPhotoUrl: varchar("cover_photo_url", { length: 2048 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("plants_user_id_idx").on(table.userId),
    index("plants_species_id_idx").on(table.speciesId),
  ],
);

export const photoEntries = pgTable(
  "photo_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    plantId: uuid("plant_id")
      .notNull()
      .references(() => plants.id, { onDelete: "cascade" }),
    photoUrl: varchar("photo_url", { length: 2048 }).notNull(),
    thumbnailUrl: varchar("thumbnail_url", { length: 2048 }).notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("photo_entries_plant_id_idx").on(table.plantId)],
);

/**
 * Pending-deletion state machine for asynchronous storage cleanup.
 *
 * Per phase-5 D-22/D-23: when a Plant is deleted, the same TX inserts
 * one row per affected bucket (plant-photos + plant-thumbnails) with
 * status='pending'. The Inngest event handler `catalog/cleanup-storage`
 * (D-22) and the hourly reconciler cron `catalog/cleanup-storage-reconciler`
 * (D-24) drive rows through pending → in_progress → completed | failed.
 *
 * Phase 11 LGPD bulk deletes reuse this same table for full-account
 * sweeps (the prefix carries the scope, not a plant_id FK — by design,
 * because the plant row is already gone by the time cleanup runs).
 */
export const pendingDeletionStatus = pgEnum("pending_deletion_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export const pendingStorageDeletions = pgTable(
  "pending_storage_deletions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bucket: text("bucket").notNull(),
    prefix: text("prefix").notNull(),
    status: pendingDeletionStatus("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true, mode: "string" }),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "string" }),
  },
  (table) => [
    index("psd_status_scheduled_at_idx").on(table.status, table.scheduledAt),
    index("psd_user_id_idx").on(table.userId),
  ],
);

/**
 * Per-user location autocomplete corpus.
 *
 * Per phase-5 D-09: every plant create + every plant edit that touches
 * the location field upserts here (ON CONFLICT increment usage_count +
 * touch last_used_at). Plant DELETE does NOT decrement — user-entered
 * locations stick across plant lifecycle (D-09 verbatim).
 *
 * Composite PK on (user_id, label_normalized) makes per-user de-dup the
 * default. label_normalized is the lower-cased + trimmed + diacritic-
 * folded form used for de-dup; label_display is what the user typed
 * (preserved casing/accents for display).
 *
 * Combined with the i18n defaults from src/messages/pt-BR.json
 * `catalog.locations.defaults` (D-10), the location combobox merges
 * these two sources at the application layer.
 */
export const locationSuggestions = pgTable(
  "location_suggestions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    labelNormalized: varchar("label_normalized", { length: 200 }).notNull(),
    labelDisplay: varchar("label_display", { length: 200 }).notNull(),
    usageCount: integer("usage_count").notNull().default(1),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.labelNormalized] }),
    index("loc_suggestions_user_rank_idx").on(table.userId, table.usageCount, table.lastUsedAt),
  ],
);
