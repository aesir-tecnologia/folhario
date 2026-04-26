import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { photoEntries } from "@contexts/catalog/infrastructure/db/schema";

/**
 * Catalog `photo_entries` repository — functional module per phase-2 D-16.
 *
 * Phase 02 Plan 08 — added (Rule 2 auto-add) so the upload use-case can
 * insert PhotoEntry metadata via UoW. Mirrors the `consent-logs.ts:create`
 * pattern from plan 02-05: take a Drizzle client (or transaction), accept
 * the inferred insert shape, return the inserted row.
 *
 * Ownership at the SQL layer is mediated by the `plant_id` FK and the
 * upstream `plants.user_id` filter in the use-case (D-20, T-02-12). RLS is
 * defense in depth.
 */

type PhotoEntriesDb = DbClient | TransactionalDb;

export type PhotoEntryRow = typeof photoEntries.$inferSelect;
export type PhotoEntryInsert = typeof photoEntries.$inferInsert;

export async function create(
  db: PhotoEntriesDb,
  input: PhotoEntryInsert,
): Promise<PhotoEntryRow> {
  const [row] = await db.insert(photoEntries).values(input).returning();
  if (!row) {
    throw new Error("photoEntries.create: insert returned no row");
  }
  return row;
}
