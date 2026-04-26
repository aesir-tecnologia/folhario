import { and, eq } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { plants } from "@contexts/catalog/infrastructure/db/schema";

/**
 * Catalog `plants` repository — functional module per phase-2 D-16.
 *
 * The `findByIdForUser` helper enforces ownership at the SQL layer (D-20):
 * RLS is defense in depth, but the `WHERE user_id = $1 AND id = $2` filter
 * is what actually keeps user A from reading user B's plants when the
 * service-role connection is used (T-02-12).
 */

type PlantsDb = DbClient | TransactionalDb;

export type PlantRow = typeof plants.$inferSelect;

export async function findByIdForUser(
  db: PlantsDb,
  userId: string,
  plantId: string,
): Promise<PlantRow | null> {
  const rows = await db
    .select()
    .from(plants)
    .where(and(eq(plants.userId, userId), eq(plants.id, plantId)))
    .limit(1);
  return rows[0] ?? null;
}
