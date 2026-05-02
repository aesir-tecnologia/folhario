---
phase: 05-catalog-meu-jardim
fixed_at: 2026-05-02T00:00:00Z
source_review: 05-REVIEW.md
fix_scope: all
findings_in_scope: 18
fixed: 18
skipped: 0
iteration: 1
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed:** 2026-05-02
**Source:** 05-REVIEW.md (depth: deep, 18 findings)
**Scope:** all (Critical + Warning + Info)
**Status:** all_fixed

## Summary

All 18 findings from the post-gap-closure code review were resolved in a single pass. Each fix was committed atomically with a descriptive message. No findings were deferred or skipped.

---

## Critical Fixes

### CR-01 — Lightbox + thumbnail strip + journal preview composition ✓

**Commit:** `fix(05): correct lightbox/thumbnail/journal photo composition (CR-01)`

Added `coverEntry` (matched by `photo_url === cover_photo_url`) and `nonCoverEntries` (filtered set). All three rendering paths now use `nonCoverEntries` instead of positional slices:
- `allPhotos`: cover at index 0, then `nonCoverEntries` in order — no cover duplication.
- Thumbnail strip: `nonCoverEntries.slice(0, 3)` — newest non-cover photos.
- Journal preview: `nonCoverEntries.slice(0, 4)` with `openLightbox(idx + 1)` offset.
- `hasMultiplePhotos` changed to `nonCoverEntries.length > 0` (semantically accurate).

### CR-02 — Rules of Hooks violation in `use-plant-profile-mutations.ts` ✓

**Commit:** `fix(05): unconditionally call useQueryClient() to fix Rules of Hooks violation`

Split `const qc = opts?.queryClient ?? useQueryClient()` into:
```ts
const defaultQc = useQueryClient();
const qc = opts?.queryClient ?? defaultQc;
```
Applied to both `usePatchPlantField` and `useDeletePlant`.

### CR-03 — Hardcoded pt-BR strings ✓

**Commit:** `fix(05): replace all hardcoded pt-BR strings with i18n keys (CR-03, WR-08, IN-05)`

Added to `pt-BR.json`:
- `catalog.profile.a11y.{back, coverPhotoOf, lightboxClose, photoIndexOf, photoFallbackAlt}`
- `catalog.journal.a11y.{photoIndex, photoFallbackAlt}`
- `catalog.journal.lightboxClose`
- `catalog.journal.add.errors.photoRequired`

`plant-profile.tsx`: `useTranslations("catalog.profile.a11y")` for all aria-labels/alts.
`photo-journal.tsx`: `useTranslations("catalog.journal.a11y")` for list aria-labels/alts.
`journal-add-sheet.tsx`: `photoRequired` added to `JournalAddSheetLabels`; component uses `labels.photoRequired`.
`journal/page.tsx`: wires `photoRequired` and uses `t("lightboxClose")`.

### CR-04 — `extractObjectKey` does not validate bucket prefix ✓

**Commit:** `fix(05): validate bucket prefix in extractObjectKey before writing to pending_storage_deletions (CR-04)`

- Exported `KNOWN_BUCKETS` from `photo-storage.ts`.
- `extractObjectKey` now returns `{ bucket, key } | null` (was `string | null`) and rejects URLs whose bucket is not in `KNOWN_BUCKETS`.
- Added per-bucket defense-in-depth check: `photoParsed.bucket` must equal `PLANT_PHOTOS_BUCKET`, `thumbParsed.bucket` must equal `PLANT_THUMBNAILS_BUCKET`.
- Replaced `throw` inside TX with `return { kind: "validation_failed" }` → caller returns `ErrorCode.ValidationFailed`.

### CR-05 — Idempotency key regenerated on retry ✓

**Commit:** `fix(05): fix journal-add-sheet idempotency, blob leaks, file input, sheet lifecycle (CR-05, WR-01-03)`

On 5xx and network error, the failure path now preserves `currentKey` (does NOT call `crypto.randomUUID()`). Only HTTP 409 (hash mismatch on same key) generates a fresh key. This restores the D-37 contract that retry uses the same idempotency key.

---

## Warning Fixes

### WR-01 — Temp blob URL leak ✓

Same commit as CR-05. `tempPhotoUrl` and `tempThumbUrl` are now named variables. Both are revoked via `URL.revokeObjectURL()` after the success swap and after both failure rollback paths.

### WR-02 — File input not cleared on reset ✓

Same commit as CR-05. `resetState()` now includes `if (fileInputRef.current) fileInputRef.current.value = ""` so re-selecting the same file fires the `change` event.

### WR-03 — Sheet close/reopen pattern wipes file on failure ✓

Same commit as CR-05. Removed `onOpenChange(false)` before the fetch and both `onOpenChange(true)` in failure paths. Sheet stays open during the network call; `onOpenChange(false)` is only called on success, satisfying D-15.

### WR-04 — `InlineEditField` Esc + blur race ✓

**Commit:** `fix(05): fix InlineEditField Esc+blur race and add savingLabel prop (WR-04, IN-01)`

Added `committingRef = useRef(false)`. `handleTextKeyDown`, `handleTextareaKeyDown`, and the date `Escape` handler all set `committingRef.current = true` before triggering commit or cancel. New `handleBlurCommit()` checks and clears the ref, skipping `void commit()` if it was already triggered by a key event. Replaces all `onBlur={() => void commit()}` occurrences.

### WR-05 — Missing `kind/prefix` shape CHECK constraint ✓

**Commit:** `fix(05): add CHECK constraint enforcing kind/prefix shape invariant (WR-05)`

New migration `0007_pending_deletion_kind_shape_check.sql` adds:
```sql
ALTER TABLE pending_storage_deletions
  ADD CONSTRAINT pending_storage_deletions_kind_shape_chk
  CHECK (
    (kind = 'prefix' AND prefix LIKE '%/')
    OR (kind = 'object' AND prefix NOT LIKE '%/')
  );
```
All existing rows already satisfy the constraint (confirmed by code analysis of both insert paths).

### WR-06 — `as unknown` type escape hatches in query consumers ✓

**Commit:** `fix(05): type queryFn return shapes, export canonical response types (WR-06)`

`queries/index.ts` now exports `PlantDetail`, `PlantDetailResponse`, `PlantPhotoEntry`, `PhotoEntriesResponse`, `LocationsResponse`. All three internal fetch functions are typed. Query factory functions use typed `QueryFunction<T>` rather than `QueryFunction<unknown>`. Consumers drop `as unknown` and elaborate casts:
- `plant-profile.tsx`: plain `useQuery(plantsKeys.detail(...))`, `query.data` typed directly.
- `photo-journal.tsx`: `useQuery<PhotoEntriesResponse>(...)`, no `as unknown` on `initialData`.
- `journal-add-sheet.tsx`: imports canonical types, removes duplicate local definitions.

### WR-07 — Duplicated `extractPlantIdFromKey` / `extractPlantIdFromObjectKey` ✓

**Commit:** `fix(05): extract parsePlantPhotoKey shared helper, remove duplicates (WR-07)`

Added `parsePlantPhotoKey(key, userId): string | null` to `storage-paths.ts`. Both consumers updated:
- `delete-photo-entry.ts`: imports `parsePlantPhotoKey`, local duplicate removed.
- `inngest/functions.ts`: imports `parsePlantPhotoKey`, local duplicate removed. Maps `null` → `throw` to preserve reconciler error semantics.

### WR-08 — `router.back()` stuck on direct links ✓

Resolved in the CR-03 commit. Back button now checks `window.history.length <= 1` and falls back to `router.push("/catalog")` for deep-linked users.

---

## Info Fixes

### IN-01 — Hardcoded "Salvando…" in `inline-edit-field.tsx` ✓

Resolved in the WR-04 commit. Added `savingLabel?: string` (default `"Salvando…"`) to `InlineEditFieldProps`. `plant-profile.tsx` passes `t("savingLabel")` to all five `InlineEditField` usages.

### IN-02 — `cleanupStorageHandler` doesn't discriminate on `kind` ✓

**Commit:** `fix(05): add kind-discrimination to cleanupStorageHandler (IN-02)`

Handler now mirrors `cleanupStorageReconcilerHandler`: routes `kind='object'` through `parsePlantPhotoKey` + `validateStorageObjectKey` + `deleteObject`, and `kind='prefix'` through `validateStorageDeletionPrefix` + `deletePrefix`.

### IN-03 — Toggle id collision on duplicate labels ✓

**Commit:** `fix(05): fix Toggle id collision via useId(), add TOCTOU comment (IN-03, IN-04)`

`toggle.tsx` now imports `useId` from React; `toggleId = id ?? reactId`. Caller-supplied `id` prop still takes precedence for stable selectors.

### IN-04 — TOCTOU comment missing in `delete-photo-entry.ts` ✓

Same commit as IN-03. Added explanatory comment above the pre-flight ownership check documenting the race window and why it's safe (FK CASCADE + TX-internal delete provide the real safety).

### IN-05 — Duplicate `announce`/`announcement` keys in `pt-BR.json` ✓

Resolved in the CR-03 commit. Removed `announcement`; kept `announce` (the key consumed by `catalog-header.tsx`).

---

_Fixed: 2026-05-02_
_Fixer: Claude (gsd-code-fixer / direct)_
_Iterations: 1_
