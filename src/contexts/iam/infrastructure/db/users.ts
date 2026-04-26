import { eq } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { users } from "@contexts/iam/infrastructure/db/schema";

/**
 * IAM `users` repository — functional module per phase-2 D-16.
 *
 * Repositories are plain functions that accept a Drizzle client (regular DB
 * or transactional). They never assume RLS is the only authorization layer;
 * caller-provided `userId`/`id` filters are explicit (D-20, T-02-12).
 */

type UsersDb = DbClient | TransactionalDb;

export type UserRow = typeof users.$inferSelect;

export async function findById(db: UsersDb, userId: string): Promise<UserRow | null> {
  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}
