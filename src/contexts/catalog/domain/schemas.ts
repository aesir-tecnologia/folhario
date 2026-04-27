import { createSelectSchema, createInsertSchema } from "drizzle-zod";

import { photoEntries, plants } from "@contexts/catalog/infrastructure/db/schema";

/**
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).
 *
 * Catalog domain Zod schemas (D-19, D-40). Routes/use-cases in later phases
 * import from here, not from the table modules. Until a consumer lands,
 * adding refinements here has no effect because nothing imports them.
 */

export const plantSelectSchema = createSelectSchema(plants);
export const plantInsertSchema = createInsertSchema(plants);
export type Plant = ReturnType<typeof plantSelectSchema.parse>;
export type PlantInsert = ReturnType<typeof plantInsertSchema.parse>;

export const photoEntrySelectSchema = createSelectSchema(photoEntries);
export const photoEntryInsertSchema = createInsertSchema(photoEntries);
export type PhotoEntry = ReturnType<typeof photoEntrySelectSchema.parse>;
export type PhotoEntryInsert = ReturnType<typeof photoEntryInsertSchema.parse>;
