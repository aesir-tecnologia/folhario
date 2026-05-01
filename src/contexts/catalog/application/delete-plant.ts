import { inngest } from "@shared/inngest/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import type { TransactionalDb } from "@shared/db/unit-of-work";
import { db } from "@shared/db/client";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { ErrorCode } from "@shared/config/errors";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import * as pendingDeletionsRepo from "@contexts/catalog/infrastructure/db/pending-storage-deletions";
import {
  PLANT_PHOTOS_BUCKET,
  PLANT_THUMBNAILS_BUCKET,
} from "@contexts/catalog/infrastructure/photo-storage";
import type { PlantDeletedPayload } from "@contexts/catalog/domain/events";

export interface DeletePlantInput {
  userId: string;
  plantId: string;
}

export type PostCommitCallback = () => Promise<void>;

export type DeletePlantResult =
  | { ok: true; postCommit?: PostCommitCallback }
  | { ok: false; code: typeof ErrorCode.NotFound; reason: string };

/**
 * Delete a plant and schedule durable storage cleanup (CAT-09 / D-22).
 *
 * Steps:
 *  1. Ownership check OUTSIDE UoW (short-circuit if not found/not owned).
 *  2. UoW TX: read cascade counts (BEFORE delete) → DELETE plant (FK cascade
 *     handles photo_entries + reminders; identifications.plant_id SET NULL) →
 *     INSERT 2 pending_storage_deletions rows.
 *  3. After UoW commit: dispatch plant.deleted Inngest event + PostHog.
 *
 * When `deps.tx` is provided (HIGH-3: caller-owned TX path):
 *  - Use the external tx, do NOT commit.
 *  - Return postCommit callback so caller can fire Inngest + PostHog AFTER
 *    the outer withIdempotency transaction commits.
 *
 * D-29: PostHog plant_deleted props are privacy-clean counts only.
 *   journal_entry_count is hard-coded 0 in Phase 5: photo_entries IS the
 *   journal surface; Phase 7+ may split the concept. The slot is reserved.
 */
export async function deletePlant(
  input: DeletePlantInput,
  deps: { tx?: TransactionalDb } = {},
): Promise<DeletePlantResult> {
  const plant = await plantsRepo.findByIdForUser(db, input.userId, input.plantId);
  if (!plant) {
    return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
  }

  const prefix = `${input.userId}/${input.plantId}/`;
  const deletedAt = new Date().toISOString();

  type TxResult = { photoCount: number; reminderCount: number; deletionRowIds: [string, string]; eventPayload: PlantDeletedPayload };

  const runInTx = async (tx: TransactionalDb): Promise<TxResult> => {
    const counts = await plantsRepo.getCascadeCounts(tx, {
      userId: input.userId,
      plantId: input.plantId,
    });

    await plantsRepo.deletePlant(tx, { userId: input.userId, plantId: input.plantId });

    const psdRow = await pendingDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_PHOTOS_BUCKET,
      prefix,
    });
    const ptdRow = await pendingDeletionsRepo.create(tx, {
      userId: input.userId,
      bucket: PLANT_THUMBNAILS_BUCKET,
      prefix,
    });

    const eventPayload: PlantDeletedPayload = {
      plantId: input.plantId,
      userId: input.userId,
      deletedAt,
      deletionRowIds: [psdRow.id, ptdRow.id] as [string, string],
    };

    return {
      photoCount: counts.photo_entry_count,
      reminderCount: counts.reminder_count,
      deletionRowIds: [psdRow.id, ptdRow.id] as [string, string],
      eventPayload,
    };
  };

  // Caller-owned TX path (HIGH-3): do not commit here; return postCommit.
  if (deps.tx) {
    const txResult = await runInTx(deps.tx);
    return {
      ok: true,
      postCommit: async () => {
        await inngest.send({
          id: `plant-deleted/${input.plantId}`,
          name: "plant.deleted",
          data: txResult.eventPayload,
        });

        const ph = getPostHog();
        if (ph) {
          ph.capture({
            distinctId: input.userId,
            event: "plant_deleted",
            properties: {
              photo_count: txResult.photoCount,
              journal_entry_count: 0,
              reminder_count: txResult.reminderCount,
            },
          });
          await ph.shutdown();
        }
      },
    };
  }

  // Own-UoW path: commit happens inside withUnitOfWork.
  const txResult = await withUnitOfWork(input.userId, runInTx);

  await inngest.send({
    id: `plant-deleted/${input.plantId}`,
    name: "plant.deleted",
    data: txResult.eventPayload,
  });

  const ph = getPostHog();
  if (ph) {
    ph.capture({
      distinctId: input.userId,
      event: "plant_deleted",
      properties: {
        photo_count: txResult.photoCount,
        journal_entry_count: 0,
        reminder_count: txResult.reminderCount,
      },
    });
    await ph.shutdown();
  }

  return { ok: true };
}
