-- Enforce that 'prefix' rows always end with '/' (directory sweep) and
-- 'object' rows never end with '/' (single-file key). Prevents callers from
-- inserting a kind='object' row with a directory prefix (or vice-versa),
-- which would cause the reconciler to call the wrong storage operation.
--
-- Existing rows: delete-plant.ts (kind='prefix') always appends '/' per
-- D-26 path conventions; delete-photo-entry.ts (kind='object') stores the
-- canonical {userId}/{plantId}/{photoId}.{ext} key which never ends in '/'.
-- No backfill needed — all existing rows already satisfy the constraint.
ALTER TABLE pending_storage_deletions
  ADD CONSTRAINT pending_storage_deletions_kind_shape_chk
  CHECK (
    (kind = 'prefix' AND prefix LIKE '%/')
    OR (kind = 'object' AND prefix NOT LIKE '%/')
  );
