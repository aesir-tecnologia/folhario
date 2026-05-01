---
phase: 05-catalog-meu-jardim
reviewed: 2026-05-01T00:00:00Z
depth: deep
files_reviewed: 22
files_reviewed_list:
  - drizzle/migrations/0006_add_pending_deletion_kind.sql
  - src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx
  - src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx
  - src/app/(app)/catalog/[plantId]/plant-profile.tsx
  - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
  - src/app/api/v1/plants/[plantId]/photo-entries/route.ts
  - src/app/api/v1/plants/[plantId]/route.ts
  - src/contexts/catalog/api/snake-case.ts
  - src/contexts/catalog/application/delete-photo-entry.ts
  - src/contexts/catalog/application/list-photo-entries.ts
  - src/contexts/catalog/infrastructure/db/schema.ts
  - src/contexts/catalog/inngest/functions.ts
  - src/messages/pt-BR.json
  - src/shared/ui/inline-edit-field.tsx
  - src/shared/ui/modal-sheet.tsx
  - src/shared/ui/toggle.tsx
  - tests/integration/catalog-delete-photo-entry.integration.test.ts
  - tests/integration/catalog-list-photo-entries.integration.test.ts
  - tests/integration/catalog-routes-read-create.integration.test.ts
  - tests/integration/cleanup-storage-reconciler.integration.test.ts
  - tests/unit/journal-add-sheet.test.tsx
  - tests/unit/photo-journal.test.tsx
  - tests/unit/use-plant-profile-mutations.test.tsx
findings:
  critical: 5
  warning: 8
  info: 5
  total: 18
status: issues_found
---

# Phase 05: Code Review Report — Gap-Closure Cycle (CR-01..04, WR-04, WR-05)

**Reviewed:** 2026-05-01
**Depth:** deep
**Files Reviewed:** 22
**Status:** issues_found

## Summary

Reviewed the gap-closure changes that purportedly close CR-01..04 and WR-04/WR-05 from the prior cycle. The headline mitigations are real and tested — the `pending_deletion_kind` enum migration (CR-01) is correctly threaded through `delete-photo-entry.ts` and the reconciler, `cover_signed_url` is now passed through `toPlantWithSignedUrlSnakeCase` (CR-04), and `photoSignedUrl`/`thumbnailSignedUrl` are surfaced on photo-entries list responses (CR-03). Tests pin each fix.

But the cycle introduced new defects in two new client surfaces (`plant-profile.tsx`, `journal-add-sheet.tsx`) that the existing tests do not cover end-to-end:

- **A photo-journal lightbox composition bug** that hides the user's newest photo and shows the cover photo twice, observable any time a plant has 2+ photos.
- **Two Rules-of-Hooks violations** in `use-plant-profile-mutations.ts` that React will throw on the moment a caller varies `opts.queryClient` between renders. Tests pass only because they pin a single shape.
- **Hardcoded pt-BR strings** in `plant-profile.tsx` (Voltar, Fechar, "Foto N de N", `aria-label` strings) and one in `journal-add-sheet.tsx` ("Adicione uma foto") — direct violation of CLAUDE.md "next-intl mandatory day one" and the closed-string-table pattern.
- **An idempotency-key churn pattern** in `journal-add-sheet.tsx` that a new unit test (Test 8) actively pins as correct behavior — but it defeats the entire point of the idempotency-keys table on retry-after-network-timeout.

The two new ENUM-touching DB writes (kind='object') are correct and have integration coverage. The `pending_storage_deletions` reconciler `kind`-discriminated path is sound. The CR-02 (idempotency atomicity), CR-03 (signed URL passthrough), and CR-04 (cover_signed_url passthrough) fixes are solid.

## Critical Issues

### CR-01: Lightbox + thumbnail strip + journal preview drop the newest photo and double-render the cover

**File:** `src/app/(app)/catalog/[plantId]/plant-profile.tsx:113-130, 214-234, 339-358`
**Issue:**

`listPhotoEntries` (`src/contexts/catalog/application/list-photo-entries.ts:41-42`) reverses the repo-ordered ASC array to newest-first. So `photoEntries[0]` is the **newest**, `photoEntries[length-1]` is the **oldest** — and per D-03 the oldest is the cover.

In `plant-profile.tsx:113-130`, `allPhotos` is composed as:
```
[ {id:"cover", src: cover_signed_url}, ...photoEntries.slice(1) ]
```
With three entries `[newest, mid, oldest]`, this yields:
- index 0 = cover (= oldest)
- index 1 = mid
- index 2 = oldest (the cover, **a second time**)

The newest photo is **never** in the lightbox carousel.

The same off-by-one regime exists in two other render paths:
- **Thumbnail strip (line 216):** `photoEntries.slice(1, 4)` skips `photoEntries[0]` (the newest). Intent was clearly "skip the cover, show 3 more"; reality is "skip the newest, show 3 oldest."
- **Journal preview (line 341):** `photoEntries.slice(0, 4)` includes the cover (oldest) in the preview AND the cover is also rendered separately at line 193-211 — so the cover appears twice in the profile.

The thumbnail strip's `aria-label={`Foto ${idx + 2} de ${displayName}`}` (line 220) further confirms the intent was "second photo onwards" — but the slice doesn't honor that semantic against the reverse-chrono order.

Tests that would have caught this (`tests/unit/photo-journal.test.tsx`) only exercise `<PhotoJournal>`, not `<PlantProfile>`. There is no `plant-profile.test.tsx` in the changed file set or the wider tests/ tree.

**Fix:**

Track which entry in `photoEntries` matches the cover (compare `cover_photo_url` to `photo_entries.photo_url` raw, which `list-photo-entries.ts:63` preserves) and exclude exactly that entry from the "additional" slices. A defensive composition:

```ts
// list returns newest-first; the cover is the oldest non-deleted entry.
// Build a single source-of-truth list and dedupe the cover.
const coverEntry = photoEntries.find((pe) => pe.photo_url === plant.cover_photo_url);
const nonCoverEntries = photoEntries.filter((pe) => pe.id !== coverEntry?.id);

const allPhotos = plant?.cover_signed_url
  ? [
      {
        id: coverEntry?.id ?? "cover",
        src: plant.cover_signed_url,
        caption: plant.nickname ?? plant.name ?? undefined,
      },
      ...nonCoverEntries.map((pe) => ({
        id: pe.id,
        src: pe.photo_signed_url ?? pe.photo_url,
        caption: pe.note ?? undefined,
      })),
    ]
  : photoEntries.map((pe) => ({ ... }));

// Thumbnail strip: render up to 3 non-cover thumbnails (newest first)
{nonCoverEntries.slice(0, 3).map((pe, idx) => ( ... ))}
```

Add a `tests/unit/plant-profile.test.tsx` that asserts: with three entries `[newest, mid, oldest]` where oldest is cover, the lightbox photos (in DOM order) are `[oldest, newest, mid]` (or `[oldest, mid, newest]` if you prefer ordering newest-after-cover) — and `oldest` appears exactly **once**.

---

### CR-02: Conditional `useQueryClient()` calls violate Rules of Hooks (will throw at runtime)

**File:** `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts:38, 104`
**Issue:**

```ts
const qc = opts?.queryClient ?? useQueryClient();
```

This conditionally invokes `useQueryClient()` based on the runtime value of `opts?.queryClient`. If a caller renders the hook with `opts.queryClient` provided on first render and `undefined` on a subsequent render (or vice versa), the hook count differs between renders and React throws "Rendered more hooks than during the previous render."

The unit tests at `tests/unit/use-plant-profile-mutations.test.tsx` always pass `{ queryClient: qc }` so they never exercise the no-opts path; existing tests do not catch the regression. The PROFILE consumer at `plant-profile.tsx:84-88` always passes `queryClient: queryClient` (resolved via `useQueryClient()` at line 64), so the bug is latent in production but the tests' API is unsafe.

The pattern fails ESLint `react-hooks/rules-of-hooks` for any call site that varies the option. It also fails React Compiler's analysis if the project ever opts in.

**Fix:**

Always call the hook unconditionally; let the prop override afterwards:

```ts
const defaultQc = useQueryClient();
const qc = opts?.queryClient ?? defaultQc;
```

Apply the same pattern at line 104 of `useDeletePlant`. Add a unit test that calls `usePatchPlantField(plantId)` with **no** opts and verifies the hook returns a usable mutation. Add a re-render test that toggles `opts.queryClient` between defined/undefined to lock the contract.

---

### CR-03: Hardcoded pt-BR strings in `plant-profile.tsx` and `journal-add-sheet.tsx` violate i18n constraint

**File:** `src/app/(app)/catalog/[plantId]/plant-profile.tsx:155, 196, 203, 220, 226, 345, 351, 391`; `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:79, 112`
**Issue:**

CLAUDE.md project instructions: `next-intl mandatory day one, <html lang="pt-BR">`. PRD §17 + Phase 4 patterns: copy lives in `src/messages/pt-BR.json` so future locales can be added without touching components.

Found hardcoded strings:

`plant-profile.tsx`:
- Line 155: `aria-label="Voltar"`
- Line 196: `aria-label={`Foto de ${displayName}`}` (template, but base is hardcoded)
- Line 203: `alt={`Foto de ${displayName}`}`
- Line 220: `aria-label={`Foto ${idx + 2} de ${displayName}`}`
- Line 226: `alt={pe.note ?? `Foto ${idx + 2}`}`
- Line 345: `aria-label={pe.note ?? `Foto ${idx + 1}`}`
- Line 351: `alt={pe.note ?? `Foto ${idx + 1}`}`
- Line 391: `closeLabel="Fechar"` (the lightbox in the same file is given a localised label by `photo-journal.tsx:134` which uses `labels.lightboxClose` — so this is an inconsistency within the same component family)

`journal-add-sheet.tsx`:
- Line 79: `setPhotoError("Adicione uma foto")` — error copy hardcoded; user-visible.
- Line 112 (in `photo-journal.tsx`): `alt={entry.note ?? `Foto do diário`}` — same pattern, hardcoded in `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx:112`.

These are not stylistic — they make adding any future locale a multi-file bug hunt and (more importantly for now) violate the locked rule that founder-reviewable copy lives in the message catalog.

**Fix:**

Move all of the above into `src/messages/pt-BR.json` under `catalog.profile.a11y.*` and `catalog.journal.a11y.*`, and have the components either consume them via `useTranslations` (server/client both work) or accept them as labels props (the `JournalAddSheet` already accepts a `labels` object). For `plant-profile.tsx`, add a `useTranslations("catalog.profile.a11y")` block and ICU-format the photo-index strings:

```json
"catalog.profile.a11y": {
  "back": "Voltar",
  "coverPhotoOf": "Foto de {name}",
  "lightboxClose": "Fechar",
  "photoIndexOf": "Foto {index} de {name}",
  "photoFallbackAlt": "Foto {index}"
}
```

For the `JournalAddSheet`, add `photoRequired` to the `labels` shape and have callers wire `t("catalog.journal.add.errors.photoRequired")`.

---

### CR-04: `delete-photo-entry.ts` `extractObjectKey` does not validate bucket prefix — feeds garbage to `pending_storage_deletions`

**File:** `src/contexts/catalog/application/delete-photo-entry.ts:34-38`
**Issue:**

```ts
function extractObjectKey(storedUrl: string): string | null {
  const slash = storedUrl.indexOf("/");
  if (slash <= 0 || slash >= storedUrl.length - 1) return null;
  return storedUrl.slice(slash + 1);
}
```

This trusts the stored URL is in `{bucket}/{key}` shape. The downstream `signCatalogPhotoUrl` helper in `photo-storage.ts:176-195` validates the bucket against `KNOWN_BUCKETS` (`plant-photos`, `plant-thumbnails`); this delete path does not.

If a stored URL is ever:
- A fully-qualified Supabase URL (`https://abc.supabase.co/storage/v1/object/public/plant-photos/...`) — possible if Phase-2 upload code ever wrote the public URL form, or if a legacy migration script populated rows differently
- A `s3://...` form
- A Windows path
- An empty bucket prefix (`/userId/plantId/...`)

…the `extractObjectKey` returns whatever follows the first `/`, which is then used as the `prefix` for the `pending_storage_deletions` row with `kind='object'`. The reconciler subsequently calls `getStorageAdapter().deleteObject({ bucket: row.bucket, objectKey: row.prefix })` with garbage. At best the SDK errors and the row hits MAX_ATTEMPTS → status='failed'; at worst it deletes the wrong object (because `https:` becomes the "bucket" string and the rest becomes the key — but the actual bucket in `row.bucket` is taken from `PLANT_PHOTOS_BUCKET` constant, so the wrong-object risk is bounded by validateStorageObjectKey at line 134).

The `validateStorageObjectKey` call at `delete-photo-entry.ts:134, 139` does catch userId-mismatch attacks, but only for keys that LOOK like `{userId}/{plantId}/...`. A non-matching shape leads to the check at line 131-133 throwing "malformed stored url: cannot extract plantId" — which becomes an uncaught error that aborts the use-case mid-transaction. The transaction rolls back (good — no partial state), but the 5xx surfaces to the user with no visibility into the cause.

**Fix:**

Validate the bucket prefix matches a known bucket BEFORE extracting the key. Reuse the `KNOWN_BUCKETS` set from `photo-storage.ts` (export it, or extract a shared `parseStoredObjectUrl` helper):

```ts
import { KNOWN_BUCKETS } from "@contexts/catalog/infrastructure/photo-storage";

function extractObjectKey(storedUrl: string): { bucket: string; key: string } | null {
  const slash = storedUrl.indexOf("/");
  if (slash <= 0 || slash >= storedUrl.length - 1) return null;
  const bucket = storedUrl.slice(0, slash);
  if (!KNOWN_BUCKETS.has(bucket)) return null;
  return { bucket, key: storedUrl.slice(slash + 1) };
}
```

Update the use-case to compare the extracted bucket against the literal bucket constant being passed to `pendingStorageDeletionsRepo.create` (defense in depth: photo URL must come from `PLANT_PHOTOS_BUCKET`, thumbnail URL must come from `PLANT_THUMBNAILS_BUCKET`). On parse failure return `{ ok: false, code: ErrorCode.ValidationFailed, reason: "malformed stored url" }` rather than throwing inside the TX.

---

### CR-05: `JournalAddSheet` regenerates Idempotency-Key on every retry — defeats Idempotency-Keys table on network/timeout failures

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:138, 143`; pinned-as-correct-behavior by `tests/unit/photo-journal.test.tsx:323-411` (Test 8)
**Issue:**

The handler's failure paths (5xx, network throw) reset the idempotency key:

```ts
queryClient.setQueryData<PhotoEntriesCache>(queryKey, previous);
toast.error(labels.failure);
idempotencyKeyRef.current = crypto.randomUUID();   // ← NEW KEY ON RETRY
onOpenChange(true);
```

This is the exact failure mode the `idempotency_keys` table exists to prevent. Real scenario:
1. User taps Adicionar; fetch posts with key `K1`.
2. Server commits the row + bytes; response packet drops on the network.
3. Client sees a network error and rolls back optimistic state.
4. Client generates `K2` and the user retries.
5. Server creates a **second** PhotoEntry + a second pair of bytes. Cover photo logic depends on the oldest row's photo_url — fine — but the user sees a duplicate entry at the next refetch.

The Phase-2 D-37 idempotency contract is precisely "use the same key on retry." The earlier code at line 47-48 / line 75 establishes the key once and clears it on success. The failure path overrides this and re-creates a fresh key — making the table inert for this surface.

Test 8 in `tests/unit/photo-journal.test.tsx:323-411` *asserts* that the second attempt uses a different key (`expect(key2).not.toBe(key1)`). This pins the regression as intended behavior. The test is wrong.

**Fix:**

On 5xx and on network throw, **keep** the idempotency key. Only regenerate when the caller resets state (e.g., user cancels or successfully submits something else):

```ts
} catch {
  queryClient.setQueryData<PhotoEntriesCache>(queryKey, previous);
  toast.error(labels.failure);
  idempotencyKeyRef.current = currentKey;   // ← REUSE
  onOpenChange(true);
} finally {
  setSubmitting(false);
}
```

`resetState()` (line 68-75) already clears the key on a clean cancel/close, which is the correct boundary. For 4xx hash-mismatch (HTTP 409) — which can only happen if the body changed on the same key — generate a fresh key. Distinguish 4xx vs 5xx vs network error in the catch block.

Update Test 8 to assert the OPPOSITE: the second attempt **must** carry the same Idempotency-Key as the first when both attempts have the same payload. Add a new test that asserts a 409-conflict response causes the next attempt to use a fresh key.

---

## Warnings

### WR-01: Memory leak — temp-entry blob URLs are created twice and never revoked

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:96-100`
**Issue:**

```ts
const tempEntry: PhotoEntry = {
  id: tempId,
  ...
  photo_url: URL.createObjectURL(selectedFile),
  thumbnail_url: URL.createObjectURL(selectedFile),
  ...
};
```

Two new blob URLs are created and stored in the cache. They are **never revoked** when:
- The temp entry is replaced by the real `body.photo_entry` (line 129) — the temp object becomes garbage but the two blob URLs leak until the page unloads.
- The optimistic rollback restores `previous` (line 136 / 141) — same leak, two URLs per failed submit.

`previewUrl` at line 59-60 is correctly revoked, but these two are not tracked.

**Fix:**

Track the two created URLs and revoke them after the temp entry is swapped or the rollback completes:

```ts
const tempPhotoUrl = URL.createObjectURL(selectedFile);
const tempThumbUrl = URL.createObjectURL(selectedFile);
const tempEntry: PhotoEntry = { ..., photo_url: tempPhotoUrl, thumbnail_url: tempThumbUrl };
// ... later, after success or rollback:
URL.revokeObjectURL(tempPhotoUrl);
URL.revokeObjectURL(tempThumbUrl);
```

Or factor the temp entry into a useRef-tracked structure that resetState revokes alongside `previewUrl`.

---

### WR-02: File input `value` not cleared after error rollback — re-selecting same file is a no-op

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:55-62, 68-75`
**Issue:**

`handleFileChange` reads `e.target.files?.[0]`. After a failed submit (line 140-144 catch path), the sheet re-opens with `selectedFile` cleared from React state (well, actually `selectedFile` is NOT cleared on failure — only on success via `resetState()`), but the underlying `<input type="file">` still has the previously-chosen file in its `.value`. If the user wants to retry with the **same** file, the change event will not fire because the value is unchanged.

`resetState()` doesn't clear `fileInputRef.current.value` either, so closing and re-opening the sheet leaves the input in a stale state.

**Fix:**

Clear the input value at the start of `handleFileChange` after consuming it, and inside `resetState`:

```ts
function resetState() {
  setSelectedFile(null);
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  setPreviewUrl(null);
  setNoteValue("");
  setPhotoError(null);
  idempotencyKeyRef.current = null;
  if (fileInputRef.current) fileInputRef.current.value = "";
}
```

---

### WR-03: `JournalAddSheet` does not clear local state on submit failure — but DOES close the sheet then re-open it

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:108, 139, 144`
**Issue:**

Sequence:
1. Line 108: `onOpenChange(false)` closes the sheet.
2. Submit fails. Line 139 / 144: `onOpenChange(true)` re-opens it.

Between those two events, Radix Dialog's `onOpenChange(false)` fires the consumer's `BottomSheet onOpenChange` callback at line 153-156, which calls `resetState()` because `nextOpen === false`. So the file/preview/note are wiped right before the failure rollback re-opens the sheet — directly contradicting the comment at line 60 of `photo-journal.tsx:227-265` (Test 5) which asserts "bytes retained."

Empirically the test passes because Test 5 also re-uploads the file (no — it does not re-upload). Wait: Test 5 only fires `fireEvent.change(fileInput, ...)` once, then submits. After failure it just asserts `cachedData?.items` rolled back and the dialog is open — but it does **not** assert that `selectedFile` is preserved or that re-clicking Submit would resend bytes.

So the production behavior on failure is: sheet closes → resetState wipes everything → sheet re-opens **empty** → user has to re-pick the file. This contradicts D-15 "On failure: sheet stays open with retry, photo bytes retained client-side."

**Fix:**

Instead of toggling `onOpenChange(false)` then `onOpenChange(true)` across the network call, keep the sheet open and only close on success:

```ts
// REMOVE the optimistic close at line 108.
// KEEP the sheet open during the network call.
try {
  // ... fetch ...
  if (response.ok) {
    // ... swap temp entry ...
    resetState();
    onOpenChange(false);  // ← close ONLY on success
    return;
  }
  // failure: sheet already open, just rollback + toast
  queryClient.setQueryData(queryKey, previous);
  toast.error(labels.failure);
} catch {
  queryClient.setQueryData(queryKey, previous);
  toast.error(labels.failure);
}
```

Also tighten Test 5 to `expect(selectedFile)` is still rendered (i.e., the `<img data-testid="journal-sheet-preview">` is still in the DOM after failure).

---

### WR-04: `InlineEditField` Esc + blur race issues an unwanted PATCH

**File:** `src/shared/ui/inline-edit-field.tsx:118-125, 233, 253, 273`
**Issue:**

`handleTextKeyDown` on Esc calls `cancel()` which sets `mode = "read"`. React unmounts the input the next render. On the way out, the input fires `blur`, which calls `void commit()` (line 273). Because `cancel()` reset `draft = preEditValueRef.current`, the commit fires a PATCH with the **original** value — a network call that the user explicitly canceled.

Same pattern at line 233 (textarea `onBlur`) and line 253 (date `onBlur` — though `handleDateKeyDown` does call `cancel()` on Esc, so blur after cancel is the same problem).

This is harmless if PATCH idempotency holds (and it does, mostly), but it's surprising, wastes a request, and the optimistic UI in `usePatchPlantField` will no-op-then-overwrite the cache with the server response — which CAN race with a subsequent edit if the user is typing fast.

**Fix:**

Track whether commit was already triggered by Enter or by an explicit cancel, and short-circuit blur:

```ts
const committingRef = useRef(false);

function handleTextKeyDown(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") {
    e.preventDefault();
    committingRef.current = true;
    void commit();
  } else if (e.key === "Escape") {
    committingRef.current = true;
    cancel();
  }
}

// in onBlur:
onBlur={() => {
  if (committingRef.current) {
    committingRef.current = false;
    return;
  }
  void commit();
}}
```

---

### WR-05: `pending_storage_deletions.kind` migration introduces mid-cycle column with mismatched semantics for legacy rows

**File:** `drizzle/migrations/0006_add_pending_deletion_kind.sql:1-2`; `src/contexts/catalog/infrastructure/db/schema.ts:97-100, 120`
**Issue:**

Migration 0006 adds `kind pending_deletion_kind NOT NULL DEFAULT 'prefix'`. Any pre-existing rows from `delete-plant.ts` (Phase-5-pre-CR-01) get `kind='prefix'` retroactively — correct, because those rows ARE prefixes (`{userId}/{plantId}/`).

But the comment on the column (`schema.ts:112-119`) says `'prefix'` is "legacy / default" and `'object'` is the "new" path. There is no guard preventing a future caller from inserting `kind='object'` with a row whose `prefix` ends in `/` (a directory), or `kind='prefix'` with a full canonical key. The reconciler at `inngest/functions.ts:168-190` trusts the discriminator absolutely — `extractPlantIdFromObjectKey` will throw for a prefix ending in `/`, but `extractPlantIdFromPrefix` will silently accept a single-file key (because `parts.length >= 2` is true for `userId/plantId/photoId.jpg.split("/")` — three parts).

**Fix:**

Add a CHECK constraint to enforce the invariant: `'prefix'` requires trailing `/`, `'object'` forbids trailing `/`. Drizzle doesn't ship a clean CHECK abstraction at the migration level the project uses, so add a raw SQL migration:

```sql
ALTER TABLE pending_storage_deletions
  ADD CONSTRAINT pending_storage_deletions_kind_shape_chk
  CHECK (
    (kind = 'prefix' AND prefix LIKE '%/')
    OR (kind = 'object' AND prefix NOT LIKE '%/')
  );
```

Then add a backfill check that no existing rows violate it (legacy `delete-plant` rows end in `/` per `delete-plant.ts` callers — confirm before applying the constraint).

---

### WR-06: `PhotoJournal` casts `initialData` through `unknown` to bypass `useQuery`'s shape constraint — fragile typing

**File:** `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx:53-58`
**Issue:**

```ts
const query = useQuery({
  ...queryDef,
  initialData: { items: initialEntries } as unknown,
});

const cachedData = query.data as PhotoEntriesCache | undefined;
```

The `as unknown` and the subsequent `as PhotoEntriesCache | undefined` together form a type-unsafe escape hatch. Any rename on the API response shape (e.g., `items` → `entries`) will not be caught by TS. The same pattern at `plant-profile.tsx:70-72`:

```ts
const plantQuery = useQuery(plantsKeys.detail(plantId) as ReturnType<typeof plantsKeys.detail> & { select?: (d: unknown) => PlantDetailCache });
```

…uses an even more elaborate type cast that signals the query factory's `queryFn` return type (`unknown`) is fundamentally fighting the consumers.

**Fix:**

Type the `queryFn` return shape in the factory at `src/contexts/catalog/queries/index.ts`:

```ts
export type PhotoEntriesResponse = { items: PhotoEntry[] };
async function fetchPhotoEntries(plantId: string): Promise<PhotoEntriesResponse> {
  const r = await fetch(`/api/v1/plants/${plantId}/photo-entries`);
  if (!r.ok) throw new Error(`photo entries failed: ${r.status}`);
  return r.json() as Promise<PhotoEntriesResponse>;
}
photoEntries: (plantId: string) => ({
  queryKey: ["catalog", "photo-entries", plantId] as const,
  queryFn: fetchPhotoEntries.bind(null, plantId) as QueryFunction<PhotoEntriesResponse>,
  staleTime: 60_000,
}) as const,
```

Then both consumers can drop the `as unknown` / `as PhotoEntriesCache` and use `query.data` directly. Same for `fetchPlantDetail` and `fetchLocations`.

---

### WR-07: `delete-photo-entry.ts` `extractPlantIdFromKey` is duplicated with `inngest/functions.ts:extractPlantIdFromObjectKey`

**File:** `src/contexts/catalog/application/delete-photo-entry.ts:51-58`; `src/contexts/catalog/inngest/functions.ts:119-130`
**Issue:**

Two near-identical helpers extract `plantId` from a `{userId}/{plantId}/{photoId}.{ext}` key. They have subtly different error semantics:
- `delete-photo-entry.ts:51-58` returns `null` on failure.
- `inngest/functions.ts:119-130` throws on failure.

If the canonical key shape ever changes (e.g., adds a sub-folder), both must change in lockstep — and the difference in error semantics could mask the synchronization break.

**Fix:**

Extract a single `parsePlantPhotoKey(key: string, userId: string)` helper in `src/contexts/catalog/domain/storage-paths.ts` (next to `validateStorageObjectKey`) and have both call sites use it. Standardize on the `Result`-shape (`{ ok, plantId }` vs `{ ok: false, reason }`) consistent with the rest of the catalog use-cases.

---

### WR-08: `plant-profile.tsx` shows `aria-label` "Voltar" on a button that uses `router.back()` — but if no history, this is a stuck button

**File:** `src/app/(app)/catalog/[plantId]/plant-profile.tsx:153-160`
**Issue:**

```tsx
<button onClick={() => router.back()} aria-label="Voltar">
```

A user landing on `/catalog/[plantId]` directly (deep link from a notification, an emailed link, manual URL paste, or Open in new tab from the catalog grid) has no history entry in this tab. `router.back()` becomes a no-op. The button looks responsive (the focus ring fires) but does nothing.

This is a degraded UX, not a bug per se — but it interacts with the closed-error-registry and PRD §17 "no dead controls" guidance.

**Fix:**

Fall back to `router.push("/catalog")` when `history.length <= 1`:

```ts
onClick={() => {
  if (typeof window !== "undefined" && window.history.length <= 1) {
    router.push("/catalog");
  } else {
    router.back();
  }
}}
```

This also fixes the i18n issue (CR-03) for the same control if you sweep the aria-label into messages.

---

## Info

### IN-01: `inline-edit-field.tsx` hardcoded "Salvando…" string at line 290

**File:** `src/shared/ui/inline-edit-field.tsx:290`
**Issue:**

`<span className="text-sm text-slate">Salvando…</span>` — the saving label is hardcoded. The component is a primitive; its consumer (`plant-profile.tsx`) has access to `useTranslations("catalog.profile")` and the message catalog already exposes `catalog.profile.savingLabel: "Salvando…"`.

**Fix:**

Add `savingLabel` to `InlineEditFieldProps` and have the consumer pass `t("savingLabel")`. Default to the literal for backwards compat.

---

### IN-02: `cleanupStorageHandler` always uses `data.plantId` even when row is from a kind='object' deletion

**File:** `src/contexts/catalog/inngest/functions.ts:60-69`
**Issue:**

The plant.deleted event handler validates the row's prefix against `data.plantId`. Photo-entry deletions never emit `plant.deleted` events (they rely solely on the reconciler), so this code path is currently `kind='prefix'`-only. But the schema allows `kind='object'` rows to be inserted, and a future caller could legitimately enqueue a kind='object' row alongside a `plant.deleted` event. The handler would then call `validateStorageDeletionPrefix` (not `validateStorageObjectKey`) and the prefix-shape validator would reject the object key.

**Fix:**

Discriminate on `row.kind` in `cleanupStorageHandler` the same way `cleanupStorageReconcilerHandler` does at `functions.ts:168-190`. Move the kind-discrimination into a shared helper to prevent drift:

```ts
async function processDeletionRow(row: PendingStorageDeletionRow, plantIdHint?: string) {
  if (row.kind === "object") {
    const plantId = extractPlantIdFromObjectKey(row.prefix, row.userId);
    validateStorageObjectKey({ userId: row.userId, plantId, key: row.prefix });
    await getStorageAdapter().deleteObject({ bucket: row.bucket, objectKey: row.prefix });
  } else {
    const plantId = plantIdHint ?? extractPlantIdFromPrefix(row.prefix);
    validateStorageDeletionPrefix({ userId: row.userId, plantId, prefix: row.prefix });
    await getStorageAdapter().deletePrefix({ bucket: row.bucket, prefix: row.prefix });
  }
}
```

---

### IN-03: `Toggle` primitive's auto-generated id is fragile against label collisions

**File:** `src/shared/ui/toggle.tsx:19`
**Issue:**

```ts
const toggleId = id ?? `toggle-${label.toLowerCase().replace(/\s+/g, "-")}`;
```

Two toggles with the same label (e.g., two "Ativar" rows on a settings page) generate the same DOM id, breaking `<label htmlFor>`. Pure-ASCII labels with normalized whitespace happen to be safe here — but accents (e.g., "Notificações") survive `toLowerCase()` and create selectors like `#toggle-notificações`, which is technically valid HTML5 but trips a lot of CSS selectors and most legacy testing libraries.

**Fix:**

Default to React's `useId()` instead:

```ts
import { useId } from "react";
const reactId = useId();
const toggleId = id ?? reactId;
```

---

### IN-04: `delete-photo-entry.ts` ownership check uses `defaultDb` outside the TX — TOCTOU window

**File:** `src/contexts/catalog/application/delete-photo-entry.ts:104-111`
**Issue:**

```ts
const owned = await plantsRepo.findByIdForUser(defaultDb, input.userId, resolvedPlantId);
if (!owned) {
  return { ok: false, code: ErrorCode.NotFound, reason: "plant not found" };
}
// ... open TX, delete photo entry ...
```

Between the ownership check and the TX, another request could DELETE the plant (cascade-deleting the photo entry). The TX would then no-op (`deletePhotoEntry` returns `null` → `not_found`). Harmless behavior, but the comment at line 104-107 says "Ownership check OUTSIDE UoW" as though that's deliberate — the design choice is fine, but the code has no defense if the plant rotation happens AFTER the check (rare, but possible during bulk operations).

**Fix:**

Re-validate ownership inside the TX or rely on the cascade behavior + RLS for the actual delete. The current code is correct in practice (the photo entry's `plant_id` FK ON DELETE CASCADE handles the race), but a code comment would help future readers:

```ts
// Pre-flight ownership check is best-effort — the actual safety lies in
// (a) the TX-internal photoEntries.delete WHERE id matching, and
// (b) the FK CASCADE that already removed the row if the plant was deleted.
// A concurrent plant deletion → this delete returns 'not_found', the user
// sees a stale-cache error, and the next refetch resolves it.
```

---

### IN-05: `pt-BR.json` has duplicate `announce` and `announcement` keys under `catalog.sort`

**File:** `src/messages/pt-BR.json:31, 39`
**Issue:**

```json
"sort": {
  "label": "Ordenar por",
  "announce": "Catálogo reordenado por {label}",
  ...
  "announcement": "Catálogo reordenado por {label}"
}
```

Both keys hold identical strings. One is dead code and a future founder-review will surface "which one am I editing?" as a question. Likely a copy-paste artifact during the gap-closure cycle.

**Fix:**

Delete one (probably `announce` — `announcement` reads more naturally) and grep for consumers:

```bash
grep -rn 'sort.announce' src/
grep -rn 'sort.announcement' src/
```

Keep the surviving key wired to its consumer.

---

---

_Reviewed: 2026-05-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
