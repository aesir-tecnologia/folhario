// D-17 (no Drizzle imports), D-21 (requireVerifiedUser), D-03 (cover auto-promote),
// Phase 2 D-37 (Idempotency-Key required). Handler logic in route-handlers/.

export const runtime = "nodejs";

// ============================================================================
// DELETE /api/v1/photo-entries/[photoEntryId] — added by 05-09
// ============================================================================

export { deletePhotoEntryHandler as DELETE } from "@contexts/catalog/api/route-handlers/delete-photo-entry-handler";
