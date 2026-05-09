import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import { timeServer } from "@shared/telemetry/server-timing";
import {
  decodeSortCursor,
  encodeSortCursor,
  normalizeLimit,
  type SortId,
} from "@shared/api/cursor";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";
import { signCatalogPhotoUrl } from "@contexts/catalog/infrastructure/photo-storage";

export interface ListPlantsInput {
  userId: string;
  sort: SortId;
  cursor: string | null;
  limit: number;
  includeCount: boolean;
}

export type ListPlantsResult =
  | {
      ok: true;
      items: (PlantRow & { coverSignedUrl: string | null })[];
      nextCursor: string | null;
      totalCount?: number;
    }
  | { ok: false; code: typeof ErrorCode.ValidationFailed; reason: string };

export async function listPlants(input: ListPlantsInput): Promise<ListPlantsResult> {
  const limit = normalizeLimit(input.limit);

  // Decode cursor if provided. T-05-07-04: WHERE user_id = $1 enforced in repo
  // regardless of cursor contents (cursor only narrows within user's own data).
  let cursorPayload: import("@shared/api/cursor").SortCursorPayload | null = null;
  if (input.cursor !== null) {
    const decoded = decodeSortCursor(input.cursor);
    if (!decoded.ok) {
      return { ok: false, code: ErrorCode.ValidationFailed, reason: "invalid cursor" };
    }
    if (decoded.value.sort_id !== input.sort) {
      return { ok: false, code: ErrorCode.ValidationFailed, reason: "cursor sort mismatch" };
    }
    cursorPayload = decoded.value;
  }

  const { rows, nextCursor: nextRaw } = await timeServer(
    "catalog.plants.list",
    () =>
      plantsRepo.list(defaultDb, {
        userId: input.userId,
        sort: input.sort,
        cursor: cursorPayload,
        limit,
      }),
    { sort: input.sort, cursor: input.cursor !== null, limit },
  );

  const nextCursor = nextRaw === null ? null : encodeSortCursor(nextRaw);

  // MEDIUM-3: batch-sign cover storage keys in parallel (up to page size per request).
  // All sign calls initiated before any resolves — true parallel (Promise.all).
  const signedItems = await timeServer(
    "catalog.plants.signCoverUrls",
    () =>
      Promise.all(
        rows.map(async (row) => {
          if (!row.coverPhotoUrl) return { ...row, coverSignedUrl: null };
          const signed = await signCatalogPhotoUrl({
            storedUrl: row.coverPhotoUrl,
            ttlSeconds: 24 * 3600, // D-20: 24h TTL in caller, not baked into helper
          });
          return { ...row, coverSignedUrl: signed.ok ? signed.signedUrl : null };
        }),
      ),
    { rows: rows.length, withCover: rows.filter((row) => row.coverPhotoUrl).length },
  );

  // D-12: total_count only when includeCount AND first page (cursor === null).
  if (input.includeCount && input.cursor === null) {
    const totalCount = await timeServer("catalog.plants.countForUser", () =>
      plantsRepo.countForUser(defaultDb, input.userId),
    );
    return { ok: true, items: signedItems, nextCursor, totalCount };
  }

  return { ok: true, items: signedItems, nextCursor };
}
