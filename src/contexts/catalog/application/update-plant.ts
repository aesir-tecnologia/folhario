import { ErrorCode } from "@shared/config/errors";
import { db as defaultDb } from "@shared/db/client";
import { withUnitOfWork } from "@shared/db/unit-of-work";
import type { TransactionalDb } from "@shared/db/unit-of-work";
import { getPostHog } from "@shared/telemetry/posthog-server";
import { updatePlantInputSchema, type UpdatePlantInput } from "@contexts/catalog/domain/schemas";
import * as plantsRepo from "@contexts/catalog/infrastructure/db/plants";
import type { PlantRow } from "@contexts/catalog/infrastructure/db/plants";
import * as locationSuggestionsRepo from "@contexts/catalog/infrastructure/db/location-suggestions";

export interface UpdatePlantArgs {
  userId: string;
  plantId: string;
  patch: unknown;
}

export type PostCommitCallback = () => Promise<void>;

export type UpdatePlantResult =
  | { ok: true; plant: PlantRow; postCommit?: PostCommitCallback }
  | {
      ok: false;
      code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed;
      reason: string;
    };

const EDITED_FIELDS = [
  "name",
  "nickname",
  "location",
  "acquisitionDate",
  "notes",
] as const;
type EditedField = (typeof EDITED_FIELDS)[number];

function inferDirtyField(parsed: UpdatePlantInput): EditedField | null {
  for (const f of EDITED_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(parsed, f)) return f;
  }
  return null;
}

// D-29: PostHog uses schema field name `acquisition_date`, NEVER `ack_date`.
const FIELD_TO_POSTHOG: Record<EditedField, string> = {
  name: "name",
  nickname: "nickname",
  location: "location",
  acquisitionDate: "acquisition_date",
  notes: "notes",
};

export async function updatePlant(
  args: UpdatePlantArgs,
  deps: { tx?: TransactionalDb } = {},
): Promise<UpdatePlantResult> {
  const parseResult = updatePlantInputSchema.safeParse(args.patch);
  if (!parseResult.success) {
    return { ok: false, code: ErrorCode.ValidationFailed, reason: parseResult.error.message };
  }
  const patch = parseResult.data;

  // Ownership check OUTSIDE the UoW — short-circuit cross-user PATCH.
  // T-05-07-02: returns not_found (not forbidden) to avoid existence disclosure.
  const owned = await plantsRepo.findByIdForUser(defaultDb, args.userId, args.plantId);
  if (!owned) {
    return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
  }

  const dirty = inferDirtyField(patch);

  // Inner function run inside a transaction (either caller-provided or own UoW).
  const runInTx = async (tx: TransactionalDb): Promise<PlantRow | null> => {
    const row = await plantsRepo.update(tx, {
      userId: args.userId,
      plantId: args.plantId,
      fields: patch,
    });
    if (!row) return null; // RLS denied — surface as not_found

    // D-09: if dirty field is location, upsert the location suggestion in SAME TX.
    if (typeof patch.location === "string" && patch.location.trim().length > 0) {
      await locationSuggestionsRepo.upsert(tx, {
        userId: args.userId,
        label: patch.location,
      });
    }
    return row;
  };

  // HIGH-3: caller-owned-TX path — use external tx, do NOT commit, return postCommit callback.
  if (deps.tx) {
    const row = await runInTx(deps.tx);
    if (!row) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
    return {
      ok: true,
      plant: row,
      postCommit:
        dirty !== null
          ? async () => {
              getPostHog()?.capture({
                distinctId: args.userId,
                event: "plant_edited",
                properties: { field: FIELD_TO_POSTHOG[dirty] },
              });
            }
          : undefined,
    };
  }

  // Own-UoW path: commit happens inside withUnitOfWork.
  // T-05-07-03: telemetry runs inline ONLY if UoW resolved (no rollback leak).
  const updated = await withUnitOfWork(args.userId, runInTx);
  if (!updated) return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };

  if (dirty !== null) {
    getPostHog()?.capture({
      distinctId: args.userId,
      event: "plant_edited",
      properties: { field: FIELD_TO_POSTHOG[dirty] },
    });
  }

  return { ok: true, plant: updated };
}
