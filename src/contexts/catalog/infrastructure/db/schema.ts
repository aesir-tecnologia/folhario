import { date, index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

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
