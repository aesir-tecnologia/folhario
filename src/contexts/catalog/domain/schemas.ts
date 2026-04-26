import { createSelectSchema, createInsertSchema } from "drizzle-zod";

import { photoEntries, plants } from "@contexts/catalog/infrastructure/db/schema";

/**
 * Catalog domain Zod schemas (D-19, D-40).
 *
 * Routes/use-cases import from here, not from the table modules.
 */

export const plantSelectSchema = createSelectSchema(plants);
export const plantInsertSchema = createInsertSchema(plants);
export type Plant = ReturnType<typeof plantSelectSchema.parse>;
export type PlantInsert = ReturnType<typeof plantInsertSchema.parse>;

export const photoEntrySelectSchema = createSelectSchema(photoEntries);
export const photoEntryInsertSchema = createInsertSchema(photoEntries);
export type PhotoEntry = ReturnType<typeof photoEntrySelectSchema.parse>;
export type PhotoEntryInsert = ReturnType<typeof photoEntryInsertSchema.parse>;
