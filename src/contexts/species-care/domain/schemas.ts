import { createSelectSchema, createInsertSchema } from "drizzle-zod";

import { careGuides, species } from "@contexts/species-care/infrastructure/db/schema";

/**
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).
 *
 * Species & Care domain Zod schemas (D-19, D-40). Routes/use-cases in later
 * phases import from here, not from the table modules. Until a consumer
 * lands, adding refinements here has no effect because nothing imports them.
 */

export const speciesSelectSchema = createSelectSchema(species);
export const speciesInsertSchema = createInsertSchema(species);
export type Species = ReturnType<typeof speciesSelectSchema.parse>;
export type SpeciesInsert = ReturnType<typeof speciesInsertSchema.parse>;

export const careGuideSelectSchema = createSelectSchema(careGuides);
export const careGuideInsertSchema = createInsertSchema(careGuides);
export type CareGuide = ReturnType<typeof careGuideSelectSchema.parse>;
export type CareGuideInsert = ReturnType<typeof careGuideInsertSchema.parse>;
