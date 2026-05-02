// Phase 5 D-22 / D-24 — catalog storage cleanup pipeline.
//
// Belt + braces: cleanupStorage handles the happy path on plant.deleted
// events (retries: 4); cleanupStorageReconciler (Task 3 / D-24) is the
// recovery layer that picks up rows stuck in 'pending'.
//
// Both functions use the bare `db` singleton (BYPASSRLS connection role).
// cleanupStorage: no single JWT applies (rows from different users).
// cleanupStorageReconciler: cron context has no JWT at all (Pitfall 4).
import { RetryAfterError } from "inngest";

import { db } from "@shared/db/client";
import { inngest } from "@shared/inngest/client";
import * as pendingDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import {
  validateStorageDeletionPrefix,
  validateStorageObjectKey,
  parsePlantPhotoKey,
} from "@contexts/catalog/domain/storage-paths";
import { getStorageAdapter } from "@contexts/catalog/infrastructure/photo-storage";
import type { PlantDeletedPayload } from "@contexts/catalog/domain/events";

// =====================================================================
// cleanupStorage — event handler (retries: 4)
// =====================================================================

/**
 * Handler for the cleanupStorage Inngest function.
 *
 * Exported separately so integration tests can invoke it directly without
 * spinning up the Inngest runtime. The `step` argument is a real Inngest
 * Step object in production, or a { run: (_name, fn) => fn() } shim in tests.
 *
 * State machine for each row:
 *   pending → in_progress (markInProgress conditional on status='pending')
 *   → completed | pending (retry) | failed (terminal at attempts=5)
 *
 * T-05-06-01: validateStorageDeletionPrefix is called before deletePrefix.
 * T-05-06-02: markInProgress WHERE status='pending' prevents double-processing.
 * Pitfall 6: deletePrefix is idempotent — safe to re-run on empty prefix.
 */
export async function cleanupStorageHandler({
  event,
  step,
}: {
  event: { data: unknown };
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}): Promise<{ processed: number }> {
  const data = event.data as PlantDeletedPayload;

  for (const rowId of data.deletionRowIds) {
    await step.run(`process-${rowId}`, async () => {
      const row = await pendingDeletionsRepo.findById(db, rowId);
      if (!row) return;
      if (row.status === "completed") return;
      if (row.status === "failed") return;

      const transitioned = await pendingDeletionsRepo.markInProgress(db, rowId);
      if (!transitioned) return;

      try {
        validateStorageDeletionPrefix({
          userId: row.userId,
          plantId: data.plantId,
          prefix: row.prefix,
        });
      } catch (err) {
        await pendingDeletionsRepo.recordError(db, rowId, `path validation failed: ${String(err)}`);
        throw err;
      }

      try {
        await getStorageAdapter().deletePrefix({
          bucket: row.bucket,
          prefix: row.prefix,
        });
      } catch (err) {
        await pendingDeletionsRepo.recordError(db, rowId, String(err));
        throw new RetryAfterError("storage delete failed", "5m");
      }

      await pendingDeletionsRepo.markCompleted(db, rowId);
    });
  }

  return { processed: data.deletionRowIds.length };
}

const cleanupStorage = inngest.createFunction(
  {
    id: "catalog/cleanup-storage",
    retries: 4,
    triggers: [{ event: "plant.deleted" }],
  },
  cleanupStorageHandler,
);

// =====================================================================
// cleanupStorageReconciler — hourly cron (retries: 0)
// =====================================================================

// D-24 backoff schedule (indexed by attempts after first failure):
// attempts=0 → process immediately (first attempt)
// attempts=1 → wait 5 min from scheduled_at
// attempts=2 → wait 30 min
// attempts=3 → wait 4h
// attempts=4 → wait 24h
// attempts=5 → terminal (status='failed')
const BACKOFF_MINUTES = [5, 30, 4 * 60, 24 * 60, 72 * 60] as const;
const MAX_ATTEMPTS = 5;

function extractPlantIdFromPrefix(prefix: string): string {
  const parts = prefix.split("/").filter((s) => s.length > 0);
  if (parts.length < 2) {
    throw new Error(`malformed prefix: ${prefix}`);
  }
  return parts[1]!;
}


/**
 * Handler for the cleanupStorageReconciler Inngest cron function.
 * Exported for direct test invocation.
 *
 * Service-role db client (Pitfall 4): cron has no JWT, BYPASSRLS reads
 * all users' rows (proven by Cycle 3C test).
 */
export async function cleanupStorageReconcilerHandler({
  step,
}: {
  step: { run: (name: string, fn: () => Promise<unknown>) => Promise<unknown> };
}): Promise<{ processedCount: number }> {
  const result = (await step.run("reconcile-batch", async () => {
    const rows = await pendingDeletionsRepo.fetchPendingBatch(db, 50, {
      staleInProgressMinutes: 30,
    });

    let processedCount = 0;

    for (const row of rows) {
      if (row.attempts >= MAX_ATTEMPTS) {
        await pendingDeletionsRepo.markFailed(db, row.id);
        processedCount++;
        continue;
      }

      const waitMin = row.attempts === 0 ? 0 : BACKOFF_MINUTES[row.attempts - 1]!;
      const readyAt = new Date(row.scheduledAt).getTime() + waitMin * 60 * 1000;
      if (Date.now() < readyAt) continue;

      if (row.status === "pending") {
        const transitioned = await pendingDeletionsRepo.markInProgress(db, row.id);
        if (!transitioned) continue;
      }

      try {
        if (row.kind === "object") {
          const plantId = parsePlantPhotoKey(row.prefix, row.userId);
          if (!plantId) {
            throw new Error(`malformed object key: ${row.prefix}`);
          }
          validateStorageObjectKey({
            userId: row.userId,
            plantId,
            key: row.prefix,
          });
          await getStorageAdapter().deleteObject({
            bucket: row.bucket,
            objectKey: row.prefix,
          });
        } else {
          const plantId = extractPlantIdFromPrefix(row.prefix);
          validateStorageDeletionPrefix({
            userId: row.userId,
            plantId,
            prefix: row.prefix,
          });
          await getStorageAdapter().deletePrefix({
            bucket: row.bucket,
            prefix: row.prefix,
          });
        }
        await pendingDeletionsRepo.markCompleted(db, row.id);
      } catch (err) {
        await pendingDeletionsRepo.recordError(db, row.id, String(err));
      }

      processedCount++;
    }

    return { processedCount };
  })) as { processedCount: number };

  return result;
}

const cleanupStorageReconciler = inngest.createFunction(
  {
    id: "catalog/cleanup-storage-reconciler",
    retries: 0,
    triggers: [{ cron: "0 * * * *" }],
  },
  cleanupStorageReconcilerHandler,
);

export const catalogFunctions = [cleanupStorage, cleanupStorageReconciler];
