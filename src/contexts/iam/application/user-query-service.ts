import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import * as usersRepo from "@contexts/iam/infrastructure/db/users";

/**
 * IAM user query service — cross-context read example per phase-2 D-41.
 *
 * Other bounded contexts (Catalog, Identification, Reminders, …) need a
 * narrow read view of a User to operate (locale, timezone, notification
 * preferences). They MUST NOT import the IAM repository directly — they
 * call this query service instead. That keeps:
 *
 * - the IAM module's persistence model encapsulated;
 * - the cross-context contract small and stable;
 * - sensitive fields (e.g. `email`) out of every other context's reach.
 */

type QueryDb = DbClient | TransactionalDb;

export interface UserSummary {
  id: string;
  locale: string;
  timezone: string;
  notificationTimeLocal: string;
  trialSource: "organic" | "partner";
  partnerCode: string | null;
  deletionRequestedAt: string | null;
}

export async function getUserSummary(
  db: QueryDb,
  userId: string,
): Promise<UserSummary | null> {
  const user = await usersRepo.findById(db, userId);
  if (!user) return null;
  return {
    id: user.id,
    locale: user.locale,
    timezone: user.timezone,
    notificationTimeLocal: user.notificationTimeLocal,
    trialSource: user.trialSource,
    partnerCode: user.partnerCode,
    deletionRequestedAt: user.deletionRequestedAt,
  };
}
