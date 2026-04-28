import { eq, sql } from "drizzle-orm";

import { db, type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { users } from "@contexts/iam/infrastructure/db/schema";
import { type DbOrTx } from "@contexts/iam/infrastructure/db/types";

/**
 * IAM `users` repository — Phase 4 plan 06 (D-22 product source of truth).
 *
 * Phase 2 shipped `findById(db, userId): UserRow | null`; Phase 4 keeps that
 * surface (Wave 3 SUMMARY deviation #1) and adds the new signup-flow
 * functions alongside:
 *   - `getUserById` / `getUserByEmail` — both join `auth.users` to derive
 *     `hasPassword` (T-04-07-02 information leak: never expose
 *     `encrypted_password`; only the boolean).
 *   - `insertPublicUser` — write through `db.transaction` per D-25 +
 *     Codex HIGH #2. Phase 2 D-35 trigger pre-creates a row with default
 *     `trial_source='organic'` + name derived from email; this writer
 *     uses `ON CONFLICT (id) DO UPDATE` to set the signup-supplied
 *     timezone, age confirmation, partner_code, AND the partner-vs-organic
 *     `trial_source` (see Plan 06 deviation: D-32 partner_code lookup
 *     drives `trial_source` on `users`, not on `subscriptions`).
 *   - `setEmailVerifiedAt` — D-22 product source of truth update.
 */

type UsersDb = DbClient | TransactionalDb;

export type UserRow = typeof users.$inferSelect;

/** Repository row joined with auth.users.encrypted_password (boolean only). */
export type UserWithCredentialFlag = UserRow & { hasPassword: boolean };

export async function findById(dbHandle: UsersDb, userId: string): Promise<UserRow | null> {
  const rows = await dbHandle.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

type UserJoinedRow = {
  id: string;
  email: string;
  email_verified_at: string | null;
  age_confirmed_at: string | null;
  timezone: string;
  partner_code: string | null;
  name: string;
  locale: string;
  trial_source: "organic" | "partner";
  notification_time_local: string;
  toxicity_disclaimer_acknowledged_at: string | null;
  deletion_requested_at: string | null;
  created_at: string;
  updated_at: string;
  has_password: boolean;
} & Record<string, unknown>;

function rowToUser(row: UserJoinedRow): UserWithCredentialFlag {
  return {
    id: row.id,
    email: row.email,
    emailVerifiedAt: row.email_verified_at,
    ageConfirmedAt: row.age_confirmed_at,
    timezone: row.timezone,
    partnerCode: row.partner_code,
    name: row.name,
    locale: row.locale,
    trialSource: row.trial_source,
    notificationTimeLocal: row.notification_time_local,
    toxicityDisclaimerAcknowledgedAt: row.toxicity_disclaimer_acknowledged_at,
    deletionRequestedAt: row.deletion_requested_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    hasPassword: row.has_password,
  };
}

export async function getUserById(id: string): Promise<UserWithCredentialFlag | null> {
  const rows = await db.execute<UserJoinedRow>(
    sql`SELECT pu.id, pu.email, pu.email_verified_at, pu.age_confirmed_at, pu.timezone,
               pu.partner_code, pu.name, pu.locale, pu.trial_source,
               pu.notification_time_local, pu.toxicity_disclaimer_acknowledged_at,
               pu.deletion_requested_at, pu.created_at, pu.updated_at,
               (au.encrypted_password IS NOT NULL) AS has_password
          FROM public.users pu
          JOIN auth.users au ON au.id = pu.id
         WHERE pu.id = ${id}
         LIMIT 1`,
  );
  const row = rows[0];
  return row ? rowToUser(row as UserJoinedRow) : null;
}

export async function getUserByEmail(email: string): Promise<UserWithCredentialFlag | null> {
  const rows = await db.execute<UserJoinedRow>(
    sql`SELECT pu.id, pu.email, pu.email_verified_at, pu.age_confirmed_at, pu.timezone,
               pu.partner_code, pu.name, pu.locale, pu.trial_source,
               pu.notification_time_local, pu.toxicity_disclaimer_acknowledged_at,
               pu.deletion_requested_at, pu.created_at, pu.updated_at,
               (au.encrypted_password IS NOT NULL) AS has_password
          FROM public.users pu
          JOIN auth.users au ON au.id = pu.id
         WHERE pu.email = ${email}
         LIMIT 1`,
  );
  const row = rows[0];
  return row ? rowToUser(row as UserJoinedRow) : null;
}

export interface InsertPublicUserInput {
  id: string;
  email: string;
  age_confirmed_at: Date;
  timezone: string;
  partner_code: string | null;
  /**
   * Plan 06 deviation: `trial_source` lives on `users` (Phase 2 schema),
   * NOT on `subscriptions`. Caller resolves after `isPartnerCodeActive`.
   */
  trial_source: "organic" | "partner";
}

// Codex HIGH #2: insertPublicUser accepts dbOrTx so the signup tx can pass the handle.
export async function insertPublicUser(
  input: InsertPublicUserInput,
  dbOrTx: DbOrTx = db,
): Promise<void> {
  // Phase 2 D-35 trigger may have inserted a row with name=split_part(email,'@',1)
  // and trial_source='organic'. The DO UPDATE here writes the signup-supplied
  // values; `name` is intentionally left untouched so the trigger's value
  // persists (signup form doesn't collect a display name in MVP).
  await dbOrTx.execute(
    sql`INSERT INTO public.users (id, email, age_confirmed_at, timezone, partner_code, trial_source, name)
        VALUES (
          ${input.id},
          ${input.email},
          ${input.age_confirmed_at.toISOString()},
          ${input.timezone},
          ${input.partner_code},
          ${input.trial_source},
          COALESCE(split_part(${input.email}::text, '@', 1), 'user')
        )
        ON CONFLICT (id) DO UPDATE SET
          email = EXCLUDED.email,
          age_confirmed_at = EXCLUDED.age_confirmed_at,
          timezone = EXCLUDED.timezone,
          partner_code = EXCLUDED.partner_code,
          trial_source = EXCLUDED.trial_source,
          updated_at = now()`,
  );
}

// Codex HIGH #2: setEmailVerifiedAt accepts dbOrTx so verify-email can wrap with consume in one tx.
export async function setEmailVerifiedAt(
  id: string,
  when: Date,
  dbOrTx: DbOrTx = db,
): Promise<void> {
  await dbOrTx
    .update(users)
    .set({ emailVerifiedAt: when.toISOString() })
    .where(eq(users.id, id));
}
