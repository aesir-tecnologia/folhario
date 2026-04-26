import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Species & Care bounded-context schema.
 *
 * Per phase-2 D-01: this module is the schema source for species/care; the
 * shared registry imports from here for drizzle-kit only.
 *
 * Conventions inherited from IAM schema: UUID PKs via `defaultRandom()`,
 * `timestamptz` columns with `mode: "string"` for ISO-8601 round-trip,
 * `varchar({ enum: [...] })` for typed enums (CHECK constraints land in
 * plan 02-03), explicit FK delete rules (D-07).
 */

export const species = pgTable(
  "species",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    commonName: varchar("common_name", { length: 200 }).notNull(),
    scientificName: varchar("scientific_name", { length: 200 }).notNull(),
    referenceImageUrl: varchar("reference_image_url", { length: 2048 }),
    flagReason: varchar("flag_reason", {
      length: 32,
      enum: ["missing_care_guide", "incomplete_data", "user_reported"] as const,
    }),
    flagStatus: varchar("flag_status", {
      length: 16,
      enum: ["open", "resolved"] as const,
    }),
    identificationCount: integer("identification_count").notNull().default(0),
    resolvedAt: timestamp("resolved_at", { withTimezone: true, mode: "string" }),
    resolvedBy: varchar("resolved_by", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [uniqueIndex("species_scientific_name_idx").on(table.scientificName)],
);

export const careGuides = pgTable(
  "care_guides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    speciesId: uuid("species_id")
      .notNull()
      .references(() => species.id, { onDelete: "cascade" }),
    locale: varchar("locale", { length: 10 }).notNull().default("pt-BR"),
    version: varchar("version", { length: 32 }).notNull(),
    source: varchar("source", {
      length: 16,
      enum: ["editorial", "imported", "augmented"] as const,
    }).notNull(),
    watering: text("watering").notNull(),
    light: text("light").notNull(),
    soil: text("soil").notNull(),
    temperatureMin: integer("temperature_min").notNull(),
    temperatureMax: integer("temperature_max").notNull(),
    humidity: text("humidity").notNull(),
    toxicity: varchar("toxicity", {
      length: 24,
      enum: ["safe", "toxic_pets", "toxic_children", "toxic_both"] as const,
    }).notNull(),
    toxicitySourceUrl: varchar("toxicity_source_url", { length: 2048 }),
    difficulty: varchar("difficulty", {
      length: 8,
      enum: ["easy", "medium", "hard"] as const,
    }).notNull(),
    seasonalTips: text("seasonal_tips").notNull(),
    compatibilityNotes: text("compatibility_notes").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("care_guides_species_id_idx").on(table.speciesId),
    uniqueIndex("care_guides_species_locale_version_idx").on(
      table.speciesId,
      table.locale,
      table.version,
    ),
  ],
);
