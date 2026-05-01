import { z } from "zod";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";

import { photoEntries, plants } from "@contexts/catalog/infrastructure/db/schema";
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, type AllowedMime } from "@shared/images/limits";

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

const SERVER_MANAGED_PLANT_KEYS = {
  id: true,
  userId: true,
  coverPhotoUrl: true,
  createdAt: true,
  updatedAt: true,
  speciesId: true,
} as const;

const photoInputSchema = z.object({
  contentType: z.string().refine(
    (v): v is AllowedMime => (ALLOWED_MIME_TYPES as Set<string>).has(v),
    { message: "unsupported content type" },
  ),
  byteLength: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const createPlantInputSchema = plantInsertSchema
  .omit(SERVER_MANAGED_PLANT_KEYS)
  .extend({
    name: z.string().min(1).max(200),
    nickname: z.string().min(1).max(200).optional(),
    location: z.string().min(1).max(200).optional(),
    acquisitionDate: z.string().date().optional(),
    notes: z.string().optional(),
    photo: photoInputSchema,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (!value.name || value.name.trim().length === 0) {
      ctx.addIssue({ code: "custom", path: ["name"], message: "name required" });
    }
    if (!value.photo) {
      ctx.addIssue({ code: "custom", path: ["photo"], message: "photo required" });
    }
  });

export type CreatePlantInput = z.infer<typeof createPlantInputSchema>;

export const updatePlantInputSchema = plantInsertSchema
  .omit(SERVER_MANAGED_PLANT_KEYS)
  .partial()
  .extend({
    name: z.string().min(1).max(200).optional(),
    nickname: z.string().min(1).max(200).nullable().optional(),
    location: z.string().min(1).max(200).nullable().optional(),
    acquisitionDate: z.string().date().nullable().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict()
  .refine(
    (v) => Object.keys(v).length > 0,
    { message: "at least one editable field required" },
  );

export type UpdatePlantInput = z.infer<typeof updatePlantInputSchema>;

export const createPhotoEntryInputSchema = z
  .object({
    contentType: z.string().refine(
      (v): v is AllowedMime => (ALLOWED_MIME_TYPES as Set<string>).has(v),
      { message: "unsupported content type" },
    ),
    byteLength: z.number().int().positive().max(MAX_UPLOAD_BYTES),
    note: z.string().max(500).nullable().optional(),
  })
  .strict();

export type CreatePhotoEntryInput = z.infer<typeof createPhotoEntryInputSchema>;
