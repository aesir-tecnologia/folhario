import { and, asc, count, desc, eq, sql } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import {
  photoEntries,
  plants,
} from "@contexts/catalog/infrastructure/db/schema";
import { reminders } from "@contexts/reminders/infrastructure/db/schema";
import {
  SORT_IDS,
  type SortCursorPayload,
  type SortId,
} from "@shared/api/cursor";

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
export type PlantInsert = typeof plants.$inferInsert;
export type PlantUpdate = Partial<
  Pick<
    PlantInsert,
    | "name"
    | "nickname"
    | "location"
    | "acquisitionDate"
    | "notes"
    | "coverPhotoUrl"
    | "speciesId"
  >
>;

export type PlantListParams = {
  userId: string;
  sort: SortId;
  cursor: SortCursorPayload | null;
  limit: number;
};

export type PlantListResult = {
  rows: PlantRow[];
  nextCursor: SortCursorPayload | null;
};

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

/**
 * List plants for a user with sort-aware cursor pagination.
 *
 * Supports 5 sort modes (D-11): name_asc, name_desc, date_new, date_old,
 * location. Acquisition date sorts use NULLS LAST per CAT-07.
 *
 * Cursor is opaque pagination state, NOT an ACL token — the WHERE clause
 * always includes `plants.userId = params.userId` regardless of cursor
 * contents (T-05-03-01 mitigation).
 */
export async function list(
  db: PlantsDb,
  params: PlantListParams,
): Promise<PlantListResult> {
  if (!SORT_IDS.includes(params.sort)) {
    throw new Error(`plants.list: invalid sort_id "${params.sort}"`);
  }

  const { userId, sort, cursor, limit } = params;
  const fetchLimit = limit + 1;

  let query = db.select().from(plants).where(buildWhere(userId, sort, cursor)).$dynamic();

  const orderBy = buildOrderBy(sort);
  query = query.orderBy(...orderBy);
  query = query.limit(fetchLimit);

  const rows = await query;

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const lastRow = page[page.length - 1];

  const nextCursor: SortCursorPayload | null =
    hasMore && lastRow
      ? {
          sort_id: sort,
          last_value: extractLastValue(sort, lastRow),
          last_id: lastRow.id,
        }
      : null;

  return { rows: page, nextCursor };
}

function extractLastValue(sort: SortId, row: PlantRow): string | null {
  switch (sort) {
    case "date_new":
    case "date_old":
      return row.acquisitionDate ?? null;
    case "name_asc":
    case "name_desc":
      return row.name;
    case "location":
      return row.location ?? null;
  }
}

function buildOrderBy(sort: SortId) {
  switch (sort) {
    case "date_new":
      return [
        sql`${plants.acquisitionDate} desc nulls last`,
        desc(plants.id),
      ];
    case "date_old":
      return [
        sql`${plants.acquisitionDate} asc nulls last`,
        asc(plants.id),
      ];
    case "name_asc":
      return [asc(plants.name), asc(plants.id)];
    case "name_desc":
      return [desc(plants.name), desc(plants.id)];
    case "location":
      return [
        sql`${plants.location} asc nulls last`,
        asc(plants.id),
      ];
  }
}

function buildWhere(userId: string, sort: SortId, cursor: SortCursorPayload | null) {
  const ownerFilter = eq(plants.userId, userId);

  if (!cursor) {
    return ownerFilter;
  }

  const { last_value, last_id } = cursor;

  let strictAfter: ReturnType<typeof sql>;

  switch (sort) {
    case "date_new":
      if (last_value !== null) {
        strictAfter = sql`(
          ${plants.acquisitionDate} < ${last_value}
          OR (${plants.acquisitionDate} = ${last_value} AND ${plants.id} < ${last_id})
          OR ${plants.acquisitionDate} IS NULL
        )`;
      } else {
        strictAfter = sql`(${plants.acquisitionDate} IS NULL AND ${plants.id} < ${last_id})`;
      }
      break;

    case "date_old":
      if (last_value !== null) {
        strictAfter = sql`(
          ${plants.acquisitionDate} > ${last_value}
          OR (${plants.acquisitionDate} = ${last_value} AND ${plants.id} > ${last_id})
          OR ${plants.acquisitionDate} IS NULL
        )`;
      } else {
        strictAfter = sql`(${plants.acquisitionDate} IS NULL AND ${plants.id} > ${last_id})`;
      }
      break;

    case "name_asc":
      strictAfter = sql`(
        ${plants.name} > ${last_value}
        OR (${plants.name} = ${last_value} AND ${plants.id} > ${last_id})
      )`;
      break;

    case "name_desc":
      strictAfter = sql`(
        ${plants.name} < ${last_value}
        OR (${plants.name} = ${last_value} AND ${plants.id} < ${last_id})
      )`;
      break;

    case "location":
      if (last_value !== null) {
        strictAfter = sql`(
          ${plants.location} > ${last_value}
          OR (${plants.location} = ${last_value} AND ${plants.id} > ${last_id})
          OR ${plants.location} IS NULL
        )`;
      } else {
        strictAfter = sql`(${plants.location} IS NULL AND ${plants.id} > ${last_id})`;
      }
      break;
  }

  return and(ownerFilter, strictAfter);
}

export async function countForUser(db: PlantsDb, userId: string): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(plants)
    .where(eq(plants.userId, userId));
  return Number(row?.count ?? 0);
}

/**
 * Returns { photo_entry_count, reminder_count } for the given plant.
 *
 * T-05-03-05 mitigation: asserts plant ownership via findByIdForUser BEFORE
 * running count queries. Returns {0, 0} if the plant does not belong to userId.
 */
export async function getCascadeCounts(
  db: PlantsDb,
  params: { userId: string; plantId: string },
): Promise<{ photo_entry_count: number; reminder_count: number }> {
  const plant = await findByIdForUser(db, params.userId, params.plantId);
  if (!plant) {
    return { photo_entry_count: 0, reminder_count: 0 };
  }

  const [photoCount] = await db
    .select({ count: count() })
    .from(photoEntries)
    .where(eq(photoEntries.plantId, params.plantId));

  const [reminderCount] = await db
    .select({ count: count() })
    .from(reminders)
    .where(eq(reminders.plantId, params.plantId));

  return {
    photo_entry_count: Number(photoCount?.count ?? 0),
    reminder_count: Number(reminderCount?.count ?? 0),
  };
}

export async function create(db: PlantsDb, input: PlantInsert): Promise<PlantRow> {
  const [row] = await db.insert(plants).values(input).returning();
  if (!row) throw new Error("plants.create: insert returned no row");
  return row;
}

export async function update(
  db: PlantsDb,
  params: { userId: string; plantId: string; fields: PlantUpdate },
): Promise<PlantRow | null> {
  const [row] = await db
    .update(plants)
    .set({ ...params.fields, updatedAt: sql`now()` })
    .where(and(eq(plants.userId, params.userId), eq(plants.id, params.plantId)))
    .returning();
  return row ?? null;
}

/**
 * Delete a plant row owned by userId. Returns the deleted row or null if not found.
 *
 * Named `deletePlant` (not `delete`) because `delete` is a reserved keyword in JS/TS.
 * Defense in depth: WHERE clause includes both user_id and id even though RLS is active
 * (T-02-12 mitigation).
 */
export async function deletePlant(
  db: PlantsDb,
  params: { userId: string; plantId: string },
): Promise<PlantRow | null> {
  const [row] = await db
    .delete(plants)
    .where(and(eq(plants.userId, params.userId), eq(plants.id, params.plantId)))
    .returning();
  return row ?? null;
}
