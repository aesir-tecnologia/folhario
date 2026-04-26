// Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.
//
// PRD §3 — Catalog bounded-context events. Catalog emits when a user creates
// or deletes a plant; consumers in Reminders, Identification, and IAM react
// asynchronously in Phase 4+.

export const CatalogEvents = {
  PlantCreated: "plant.created",
  PlantDeleted: "plant.deleted",
} as const;

export type CatalogEventName = (typeof CatalogEvents)[keyof typeof CatalogEvents];

export interface PlantCreatedPayload {
  plantId: string;
  userId: string;
  speciesId: string | null;
  createdAt: string;
}

export interface PlantDeletedPayload {
  plantId: string;
  userId: string;
  deletedAt: string;
}
