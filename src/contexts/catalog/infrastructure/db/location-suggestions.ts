import { desc, eq, sql } from "drizzle-orm";

import { type DbClient } from "@shared/db/client";
import { type TransactionalDb } from "@shared/db/unit-of-work";
import { locationSuggestions } from "@contexts/catalog/infrastructure/db/schema";
import { normalizeLocationLabel } from "@contexts/catalog/domain/locations";

type LocSuggestionsDb = DbClient | TransactionalDb;

export type LocationSuggestionRow = typeof locationSuggestions.$inferSelect;

/**
 * Per phase-5 D-09: every plant create + every plant edit that touches
 * the location field upserts here (ON CONFLICT increment usage_count +
 * touch last_used_at). Plant DELETE does NOT decrement.
 *
 * `label_normalized` is derived from `label` via `normalizeLocationLabel`
 * (NFD diacritic fold + lowercase + trim + whitespace collapse) so that
 * "Varanda", "varanda", and "varánda" all resolve to the same row.
 *
 * On CONFLICT, `label_display` is NOT updated — first writer wins on
 * casing/accents (so "Varanda" stays "Varanda" even when "varanda" is
 * later upserted).
 *
 * Returns null for empty/whitespace-only labels (callers should guard).
 */
export async function upsert(
  db: LocSuggestionsDb,
  params: { userId: string; label: string },
): Promise<LocationSuggestionRow | null> {
  const labelNormalized = normalizeLocationLabel(params.label);
  if (labelNormalized.length === 0) return null;

  const [row] = await db
    .insert(locationSuggestions)
    .values({
      userId: params.userId,
      labelNormalized,
      labelDisplay: params.label.trim(),
      usageCount: 1,
    })
    .onConflictDoUpdate({
      target: [locationSuggestions.userId, locationSuggestions.labelNormalized],
      set: {
        usageCount: sql`${locationSuggestions.usageCount} + 1`,
        lastUsedAt: sql`now()`,
      },
    })
    .returning();

  return row ?? null;
}

/**
 * Returns the top-N location suggestions for a user, ordered by
 * usage_count DESC, last_used_at DESC (most frequently and recently used first).
 *
 * RLS owner-only ensures cross-user rows are never visible. Defense in depth:
 * the WHERE clause also filters by user_id explicitly.
 */
export async function listForUser(
  db: LocSuggestionsDb,
  params: { userId: string; limit: number },
): Promise<LocationSuggestionRow[]> {
  return db
    .select()
    .from(locationSuggestions)
    .where(eq(locationSuggestions.userId, params.userId))
    .orderBy(desc(locationSuggestions.usageCount), desc(locationSuggestions.lastUsedAt))
    .limit(params.limit);
}
