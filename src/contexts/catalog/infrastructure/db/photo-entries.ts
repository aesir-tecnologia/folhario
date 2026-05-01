import { and, asc, eq, sql } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { photoEntries, plants } from "@contexts/catalog/infrastructure/db/schema";

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

/**
 * List all photo entries for a given plant, ordered oldest-first (created_at ASC).
 *
 * Callers are responsible for verifying that the plant belongs to the
 * authenticated user via `plants.findByIdForUser` before calling this.
 * The ORDER BY created_at ASC / id ASC drives D-03 cover auto-promote
 * (oldest entry becomes the new cover). Journal reverse-chrono display
 * is the caller's responsibility.
 */
export async function list(
  db: PhotoEntriesDb,
  params: { plantId: string },
): Promise<PhotoEntryRow[]> {
  return db
    .select()
    .from(photoEntries)
    .where(eq(photoEntries.plantId, params.plantId))
    .orderBy(asc(photoEntries.createdAt), asc(photoEntries.id));
}

/**
 * Delete a photo entry by its id. Returns the deleted row or null if not found.
 *
 * Named `deletePhotoEntry` (not `delete`) because `delete` is a reserved keyword in JS/TS.
 * Callers are responsible for ensuring the photo entry belongs to the
 * authenticated user via the plant_id FK chain.
 */
export async function deletePhotoEntry(
  db: PhotoEntriesDb,
  params: { photoEntryId: string },
): Promise<PhotoEntryRow | null> {
  const [row] = await db
    .delete(photoEntries)
    .where(eq(photoEntries.id, params.photoEntryId))
    .returning();
  return row ?? null;
}

/**
 * D-03 cover auto-promote. MUST run inside a transaction so the SELECT
 * + UPDATE see a consistent snapshot. The plants UPDATE is filtered by
 * BOTH `id` and `user_id` even though the caller already verified
 * ownership via findByIdForUser — defense in depth (T-05-03-04 mitigation).
 *
 * Selects the oldest photo_entry for the plant (created_at ASC, id ASC tiebreak)
 * and updates plants.cover_photo_url to its photo_url. If no entries remain,
 * sets cover_photo_url to NULL.
 *
 * Returns the new cover_photo_url (or null when no entries remain).
 *
 * @param tx — strict TransactionalDb only. The SELECT + UPDATE MUST share
 *   the same transaction snapshot to be correct. Passing the bare `db`
 *   singleton is rejected at the TypeScript level.
 */
export async function bumpCoverFor(
  tx: TransactionalDb,
  params: { userId: string; plantId: string },
): Promise<string | null> {
  const [oldest] = await tx
    .select({ photoUrl: photoEntries.photoUrl })
    .from(photoEntries)
    .where(eq(photoEntries.plantId, params.plantId))
    .orderBy(asc(photoEntries.createdAt), asc(photoEntries.id))
    .limit(1);

  const nextCover = oldest?.photoUrl ?? null;

  await tx
    .update(plants)
    .set({ coverPhotoUrl: nextCover, updatedAt: sql`now()` })
    .where(and(eq(plants.id, params.plantId), eq(plants.userId, params.userId)));

  return nextCover;
}
