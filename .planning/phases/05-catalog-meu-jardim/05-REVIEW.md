---
phase: 05-catalog-meu-jardim
status: issues_found
depth: standard
files_reviewed: 69
findings:
  critical: 4
  warning: 14
  info: 6
  total: 24
---

# Phase 05: Code Review Report — catalog-meu-jardim

**Reviewed:** 2026-05-01
**Depth:** standard
**Status:** issues_found

## Summary

The Phase-5 implementation lands a coherent catalog domain with strong guardrails (RLS, owner-scoped repos, closed error registry, idempotency, transaction handoff for delete/update use-cases, durable storage cleanup pipeline, focus-aware UI primitives). Most plan-stage HIGH findings from `05-REVIEWS.md` are addressed at the code level — DTO contracts agree, API contracts use snake_case consistently, location upsert runs in the same TX as the plant edit, and the SW logout path purges the catalog cache.

However, several integration-stage defects remain:

- The reconciler cannot complete cleanup of single photo-entry deletions — the delete-photo-entry use-case stores **full object keys** in `pending_storage_deletions.prefix`, but the cron Inngest function **only validates plant-prefix shapes** and routes to `deletePrefix` (which silently no-ops on object keys). Bytes get stranded.
- The plant-profile UI ships a `DELETE /api/v1/plants/:id` request **without an `Idempotency-Key` header**, while the route handler rejects unkeyed deletes with `validation_failed`. The delete button is broken in the UI.
- Photo-journal entries return the **unsigned** `photo_url` to the client, so the lightbox full-size view loads a `plant-photos/...` storage path as if it were a relative URL.
- The plant-detail GET API drops `coverSignedUrl` from the response (the SSR page hydrates correctly via the use-case, but any direct API consumer cannot render the cover).

In addition there are several smaller correctness, accessibility, and consistency defects (focus ring not 3px Canopy/40 per spec, claimed `motion-reduce` Tailwind variants are absent on modal-sheet, dual gating flags `SUBSCRIPTION_READ_ONLY` vs `ENABLE_TEST_ROUTES`, dead conditional in add page, hooks rule violation in profile mutations, ObjectURL leaks in journal-add).

The reconciler-prefix bug is the single most consequential defect: it creates orphaned bytes that ALSO fail LGPD storage-deletion guarantees once Phase 11 runs.

## Critical Issues

### CR-01: Photo-entry deletion strands storage bytes — `pending_storage_deletions` schema mismatch with reconciler

**File:** `src/contexts/catalog/inngest/functions.ts:152-161`, `src/contexts/catalog/application/delete-photo-entry.ts:145-154`

**Issue:** `deletePhotoEntry` writes a row to `pending_storage_deletions` with `prefix = photoKey` — a full canonical object key like `userId/plantId/photoId.jpg` (verified by the test at `tests/integration/catalog-delete-photo-entry.integration.test.ts:247-253`).

The reconciler at `inngest/functions.ts:152` then computes `extractPlantIdFromPrefix(row.prefix)` and calls `validateStorageDeletionPrefix({ userId, plantId, prefix })`, which asserts `prefix === ${userId}/${plantId}/` exactly (`storage-paths.ts:67`). Object keys never match — the validator throws on every photo-entry-deletion row.

The validation throw is caught at `inngest/functions.ts:163` and routed to `recordError`. After 5 retries the row goes to `failed`. Even if validation were skipped, `getStorageAdapter().deletePrefix({ prefix: row.prefix })` (line 158) calls `collectObjectsRecursively` against a file path; per `supabase-storage.ts:122-133` doc, the SDK's `list()` with a file path treats it as a folder and silently returns nothing. The `remove([])` early-returns. **The bytes stay in storage forever.**

The cleanup-storage event handler is unreachable for this case because `deletePhotoEntry` never fires `plant.deleted` (correctly) — only the cron picks up these rows.

This also breaks the LGPD-required user-data deletion guarantees for the plant-photos / plant-thumbnails buckets the moment a photo-entry is individually deleted.

**Fix:**

Either:

1. **Switch the photo-entry delete path to `deleteObject`** by adding a discriminator column (e.g. `kind enum('object','prefix')`) and branching in the reconciler:

   ```ts
   // pending_storage_deletions schema migration:
   ALTER TABLE pending_storage_deletions
     ADD COLUMN kind text NOT NULL DEFAULT 'prefix'
     CHECK (kind IN ('prefix','object'));

   // delete-photo-entry.ts:
   await pendingStorageDeletionsRepo.create(tx, {
     userId, bucket: PLANT_PHOTOS_BUCKET, prefix: photoKey, kind: 'object',
   });

   // inngest/functions.ts reconciler:
   if (row.kind === 'object') {
     validateStorageObjectKey({ userId: row.userId, plantId, key: row.prefix });
     await getStorageAdapter().deleteObject({ bucket: row.bucket, objectKey: row.prefix });
   } else {
     validateStorageDeletionPrefix({ userId, plantId, prefix: row.prefix });
     await getStorageAdapter().deletePrefix({ bucket, prefix: row.prefix });
   }
   ```

2. Or, more invasive: have `deletePhotoEntry` issue the `deleteObject` calls directly via a post-commit callback (mirroring the pattern in `delete-plant.ts`), since the failure mode here is much smaller (single file vs whole prefix).

Either path requires a migration + a reconciler integration test that drives a photo-entry-delete row through end-to-end (current tests at `cleanup-storage-reconciler.integration.test.ts:140-178` only seed plant-prefix rows with a trailing slash — the failure mode is uncovered).

---

### CR-02: `useDeletePlant` issues `DELETE /api/v1/plants/:id` without an `Idempotency-Key` — UI delete button is broken

**File:** `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts:108-119`

**Issue:** The mutation hook posts:

```ts
const res = await fetch(`/api/v1/plants/${plantId}`, {
  method: "DELETE",
});
```

No `Idempotency-Key` header is set. The route handler at `src/contexts/catalog/api/route-handlers/delete-plant-handler.ts:47-50` rejects this with HTTP 400 `validation_failed: "Idempotency-Key header is required"`. The mutation throws, `onSuccess` never fires, and the `router.push("/catalog")` redirect from `plant-profile.tsx:85` is unreachable.

`usePatchPlantField` in the same file (line 47-58) does the right thing for PATCH — DELETE was missed. Unit tests at `tests/unit/use-plant-profile-mutations.test.tsx:200-244` mock `fetch` but never assert request headers, so this is uncovered.

The Codex plan-review HIGH-3 specifically called this out for UI plans 05-16 and 05-17; the PATCH path was patched but DELETE was not.

**Fix:**

```ts
return useMutation({
  mutationFn: async () => {
    if (subscription.readOnly) throw new ReadOnlyError();

    const idempotencyKey = crypto.randomUUID();
    const res = await fetch(`/api/v1/plants/${plantId}`, {
      method: "DELETE",
      headers: { "Idempotency-Key": idempotencyKey },
    });

    if (!res.ok) { /* … */ }
  },
  // …
});
```

Also add a unit test that asserts `expect(headers["idempotency-key"]).toBeTruthy()`.

---

### CR-03: Photo-journal lightbox receives unsigned `photo_url` — full-size view broken

**File:** `src/contexts/catalog/application/list-photo-entries.ts:40-51`, `src/contexts/catalog/api/snake-case.ts:64-72`, `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx:63-67`

**Issue:** `listPhotoEntries` signs only `thumbnailUrl` (line 47-48). `photoUrl` keeps the raw `{bucket}/{key}` value persisted at create time (e.g. `plant-photos/userId/plantId/photoId.jpg`). `toPhotoEntrySnakeCase` (snake-case.ts:68) returns this unsigned string as `photo_url`.

In the journal, `photo-journal.tsx:65` builds the lightbox photos as `{ src: e.photo_url }`. The lightbox renders `<img src="plant-photos/userId/plantId/photoId.jpg">` which the browser interprets as a relative path under the current origin — the full-size view is broken on every photo entry.

The plant-profile page works around this by signing the cover separately (`plant-profile.tsx:111-128` uses `cover_signed_url` for index 0), but the journal page does not have such a fallback.

**Fix:** Sign both URLs in `listPhotoEntries` and surface a separate field. Don't reuse the column name (the DB row stores the canonical bucket-key shape; the API should return signed URLs in distinct fields):

```ts
// list-photo-entries.ts:
const items = await Promise.all(
  reversed.map(async (row) => {
    const [signedThumb, signedPhoto] = await Promise.all([
      signCatalogPhotoUrl({ storedUrl: row.thumbnailUrl, ttlSeconds: SIGN_TTL_SECONDS }),
      signCatalogPhotoUrl({ storedUrl: row.photoUrl, ttlSeconds: SIGN_TTL_SECONDS }),
    ]);
    return {
      ...row,
      photoSignedUrl: signedPhoto.ok ? signedPhoto.signedUrl : null,
      thumbnailSignedUrl: signedThumb.ok ? signedThumb.signedUrl : null,
    };
  }),
);
```

Then add `photo_signed_url` / `thumbnail_signed_url` fields to the snake-case mapper and the route response, and consume those in `photo-journal.tsx` and `plant-profile.tsx`.

---

### CR-04: `GET /api/v1/plants/[plantId]` drops `cover_signed_url` from the response

**File:** `src/app/api/v1/plants/[plantId]/route.ts:47-56`

**Issue:** `getPlant` (`get-plant.ts:38-46`) signs the cover URL and returns it as `coverSignedUrl`. The route at `[plantId]/route.ts:47-56` builds the response as `{ plant: toPlantSnakeCase(result.plant), _meta: { … } }` — `toPlantSnakeCase` (snake-case.ts:26) does NOT include `cover_signed_url`.

The plant-detail SSR page works because it bypasses the route and calls `getPlant` directly, then injects the field via `toPlantWithSignedUrlSnakeCase` (`[plantId]/page.tsx:36-39`). But any direct API consumer (TanStack Query refetch, native client in Phase 11+, third-party tools) gets the row WITHOUT a signed cover, and the cover image cannot render.

**Fix:**

```ts
// [plantId]/route.ts:
return Response.json(
  {
    plant: toPlantWithSignedUrlSnakeCase({
      ...result.plant,
      coverSignedUrl: result.coverSignedUrl,
    }),
    _meta: {
      photo_entry_count: result._meta.photoEntryCount,
      reminder_count: result._meta.reminderCount,
    },
  },
  { status: 200 },
);
```

Also add a route integration test that asserts `cover_signed_url` is present in the response (no current coverage in `catalog-routes-read-create.integration.test.ts`).

## Warnings

### WR-01: SW catalog API cache leaks across users when session expires without explicit logout

**File:** `src/app/sw.ts:72-92`, `src/contexts/iam/api/components/logout-link.tsx:38`

**Issue:** The Serwist `StaleWhileRevalidate` cache `folhario-catalog-api-v1` is keyed by URL with a 7-day max-age. The logout flow purges this cache (logout-link.tsx:38), but there is no purge on JWT expiry, on a 401 from the API, or on session-cookie removal by other means. On a shared device where user A's session expires and user B logs in via fresh credentials, user A's catalog/photo-entries/locations responses are still in the cache and may be served stale (then revalidated, but the cached body is exposed to user B until the 7-day window passes for that URL).

The `pages` cache (`sw.ts:104`) is similarly unpurged and may contain user-specific HTML for `/catalog`, `/catalog/[plantId]`.

This was raised as HIGH-2 in `05-REVIEWS.md`; the LogoutLink mitigation is partial.

**Fix:** Either (a) include the user id in the cache key via a Serwist `cacheKeyWillBeUsed` plugin, (b) clear both `folhario-catalog-api-v1` and `pages` caches on every 401 response from the API plus on session-cookie removal, or (c) drop the 7-day max-age and force a network refetch when the SW receives a 401.

---

### WR-02: `delete-plant.ts` runs ownership check OUTSIDE the outer transaction — TOCTOU window

**File:** `src/contexts/catalog/application/delete-plant.ts:49`

**Issue:** When `deps.tx` is provided (route-handler path), the use-case calls `plantsRepo.findByIdForUser(db, …)` against the global `db` client (line 49) **before** entering the outer transaction. Concurrent deletions of the same plant — or delete-then-recreate races — can produce inconsistent state.

The mitigation inside `runInTx` is incomplete: `getCascadeCounts` (`plants.ts:233-235`) re-checks ownership and returns `{0,0}` if the plant is gone, but `plantsRepo.deletePlant` (line 65) becomes a no-op zero-row delete, while two `pending_storage_deletions` rows still get inserted with the correct prefix (line 67-76). The reconciler then issues `deletePrefix(${userId}/${plantId}/)` for a plant that may now belong to a different create cycle, deleting bytes the user did not intend to remove.

**Fix:** Move the ownership check inside `runInTx` and return `{ ok: false, code: NotFound }` from there. The outer `withIdempotency` will commit cleanly; the route handler swallows `inner.ok === false` and returns 404 to the client.

```ts
const runInTx = async (tx: TransactionalDb): Promise<TxResult | { kind: "not_found" }> => {
  const plant = await plantsRepo.findByIdForUser(tx, input.userId, input.plantId);
  if (!plant) return { kind: "not_found" };
  // … existing logic …
};
```

---

### WR-03: `bottom-sheet.tsx` / `modal-sheet.tsx` claim reduced-motion handling but no `motion-reduce:*` classes exist

**File:** `src/shared/ui/bottom-sheet.tsx:35-36`, `src/shared/ui/modal-sheet.tsx:64-101`

**Issue:** The doc comment at `bottom-sheet.tsx:35-36` states "prefers-reduced-motion: honoured via Tailwind motion-reduce: variants on Dialog.Content (no slide animation under reduced-motion OS preference)." Inspection of the JSX in `modal-sheet.tsx:71-75` shows ZERO `motion-reduce:*` utilities and no `data-state`-based animations — there's nothing to gate on reduced motion. The Dialog opens without animation in both modes, which is benign, but the doc lies and a future contributor may add an animation under the false assumption that the variant wraps it.

Lightbox (`lightbox.tsx:35-43`) does honor `useReducedMotion` correctly — the discrepancy is only in modal-sheet.

**Fix:** Either remove the misleading comment, or add a real animation gated on `motion-reduce:*`:

```tsx
className="
  fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto
  rounded-t-[24px] bg-ivory p-6
  data-[state=open]:animate-slide-up data-[state=closed]:animate-slide-down
  motion-reduce:animate-none
"
```

---

### WR-04: Focus-ring outline does not match WCAG spec (3px Canopy @ 40% offset 2px)

**File:** `src/shared/ui/modal-sheet.tsx:90-94`, `src/shared/ui/inline-edit-field.tsx:242-244, 263-265, 282-284`

**Issue:** CLAUDE.md mandates "focus ring global 3px Canopy @ 40% opacity offset 2px." Multiple primitives in this phase use `outline-2` / `ring-2` (which is 2px in Tailwind) instead of 3px:

- `modal-sheet.tsx:92`: `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-canopy/40`
- `inline-edit-field.tsx:243, 264, 283`: `focus:ring-2 focus:ring-canopy/40`

WCAG 2.1 SC 2.4.7 (focus visible) is met, but the project's stricter brand spec is not.

**Fix:** Replace with `outline-[3px]` / `ring-[3px]`, or add a global `focus-visible:outline-folhario` utility in the Tailwind config and apply it to all interactive primitives. Verify the audit covers BottomSheet, ModalSheet, Combobox, InlineEditField, Lightbox, and Select.

---

### WR-05: Photo-journal POST response shape mismatch — client reads `body.data`, server returns `body.photo_entry`

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:127-130`, `src/app/api/v1/plants/[plantId]/photo-entries/route.ts:109-115`

**Issue:** The route response is `{ photo_entry: toPhotoEntrySnakeCase(usecase.photoEntry) }` (verified by `tests/integration/catalog-routes-read-create.integration.test.ts:641-645`). The client reads:

```ts
const body = (await response.json()) as { data: PhotoEntry };
queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
  items: (old?.items ?? []).map((e) => (e.id === tempId ? body.data : e)),
}));
```

`body.data` is `undefined`. The optimistic temp entry is replaced with `undefined`, so the rendering `entries.map((e) => …)` will crash on the first read of `e.id`. The follow-up `await queryClient.invalidateQueries({ queryKey })` masks this by triggering a refetch that overwrites the bad data, but during the brief window between cache-set and refetch-resolve, the UI can render undefined entries.

**Fix:**

```ts
const body = (await response.json()) as { photo_entry: PhotoEntry };
queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
  items: (old?.items ?? []).map((e) => (e.id === tempId ? body.photo_entry : e)),
}));
```

---

### WR-06: ObjectURL leaks in `journal-add-sheet.tsx` optimistic preview

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:92-100`

**Issue:** Two `URL.createObjectURL(selectedFile)` calls (line 96, 97) build the optimistic temp entry — these blob URLs are never revoked. `resetState` (line 68-75) only revokes `previewUrl` (the form preview), not the optimistic-row blobs. On every successful add, two blob URLs leak.

**Fix:** Track the optimistic blob URLs, revoke them in the success/error branches, or use the existing `previewUrl` (only valid until the sheet closes):

```ts
const tempPhotoUrl = URL.createObjectURL(selectedFile);
const tempThumbUrl = URL.createObjectURL(selectedFile);
const tempEntry: PhotoEntry = {
  id: tempId,
  plant_id: plantId,
  photo_url: tempPhotoUrl,
  thumbnail_url: tempThumbUrl,
  // …
};

// in finally:
URL.revokeObjectURL(tempPhotoUrl);
URL.revokeObjectURL(tempThumbUrl);
```

---

### WR-07: `useQueryClient()` called conditionally — Rules of Hooks violation

**File:** `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts:38, 104`

**Issue:**

```ts
const qc = opts?.queryClient ?? useQueryClient();
```

The `??` short-circuit means `useQueryClient()` is only called when `opts?.queryClient` is undefined. Since `opts` is the function argument and may differ between renders (e.g. caller passes `{ queryClient: qc, onSuccess: () => …}` once, then in a later render passes `{ onSuccess: () => …}`), the hook call list changes. React's exhaustive-deps + react-hooks/rules-of-hooks lint should be flagging this.

It happens to work in practice because `opts.queryClient` is constant within the consumer (`plant-profile.tsx:82-86` passes the same `queryClient` from `useQueryClient` every render), but the pattern is unsafe.

**Fix:**

```ts
const ownQc = useQueryClient();
const qc = opts?.queryClient ?? ownQc;
```

Apply to both `usePatchPlantField` and `useDeletePlant`.

---

### WR-08: Combobox does not close on outside click

**File:** `src/shared/ui/combobox.tsx:24-264`

**Issue:** The combobox listbox closes on `Escape`, `Tab`, `commitOption` (mouse-down on a row), or `closeListbox()` callers. There is **no document-level click handler** to close the listbox when the user clicks outside the input/listbox. Once the user opens the suggestions and clicks a non-combobox area (e.g. another form field), the listbox stays visible until they re-focus the input or hit Esc.

This is a usability bug that makes the location combobox feel sticky on every form interaction. APG combobox pattern explicitly requires close-on-outside-click.

**Fix:** Add a `useEffect` that registers a `mousedown` listener on `document` and closes the listbox when the click target is outside the wrapper:

```ts
const wrapperRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (!open) return;
  function onDocClick(e: MouseEvent) {
    if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
      closeListbox();
    }
  }
  document.addEventListener("mousedown", onDocClick);
  return () => document.removeEventListener("mousedown", onDocClick);
}, [open]);
// then attach ref={wrapperRef} on the outer <div>.
```

---

### WR-09: `add/page.tsx` dead conditional — `readOnly` always `false`

**File:** `src/app/(app)/catalog/add/page.tsx:8`

**Issue:**

```ts
const readOnly = process.env.ENABLE_TEST_ROUTES === "1" ? false : false;
```

Both branches evaluate to `false`. Either the conditional was a typo (intended `true : false`) or the prop is intentionally always-false because the actual gate is the client `useSubscription` hook in the form. The dead conditional is misleading and should be removed.

**Fix:**

```ts
// drop the conditional entirely; AddPlantForm reads useSubscription on the client.
return (
  <div className="mx-auto max-w-tablet pb-safe-area-inset-bottom">
    <AddPlantForm readOnly={false} labels={labels} initialLocationSuggestions={[]} />
  </div>
);
```

Or, if SSR pre-population was intended, fetch `subscription.readOnly` from the server-side `resolveSubscriptionState({ enableTestRoutes, cookieValue })` helper and pass that value through.

---

### WR-10: `journal/page.tsx` uses non-canonical `SUBSCRIPTION_READ_ONLY` env var

**File:** `src/app/(app)/catalog/[plantId]/journal/page.tsx:62`

**Issue:**

```ts
const readOnly = process.env.SUBSCRIPTION_READ_ONLY === "1";
```

Every other read-only gate in the catalog uses `ENABLE_TEST_ROUTES === "1"` + `__test_subscription_read_only` cookie pair (see `_shared.ts:36-66`, `subscription-provider.tsx:23-31`). `SUBSCRIPTION_READ_ONLY` is never set or referenced anywhere else, so this branch is always `false` in practice. If an operator ever sets the env var thinking it's a global override, every journal page becomes read-only for every user — bypassing per-user subscription state.

This was flagged as MEDIUM-7 in `05-REVIEWS.md` ("dual-flag confusion").

**Fix:** Either remove the line entirely (the `PhotoJournal` client component already merges `readOnlyProp || subscriptionReadOnly`), or align with the rest of the codebase:

```ts
const readOnly = resolveSubscriptionState({
  enableTestRoutes: process.env.ENABLE_TEST_ROUTES,
  cookieValue: (await cookies()).get("__test_subscription_read_only")?.value,
}).readOnly;
```

---

### WR-11: Read-only gate missing on POST /api/v1/plants and POST /api/v1/plants/[plantId]/photo-entries

**File:** `src/app/api/v1/plants/route.ts:28-159`, `src/app/api/v1/plants/[plantId]/photo-entries/route.ts:26-122`

**Issue:** The PATCH/DELETE handlers under `route-handlers/` all check `resolveReadOnlyFromRequest(request)` and return 402 `ReadOnlyMode` if the gate is active. The two POST handlers (create plant, create photo entry) do not. Today this only affects E2E (since `resolveSubscriptionState` only flips to `readOnly: true` when `ENABLE_TEST_ROUTES=1` + cookie), but Phase 10 will wire real Stripe state and the gate will activate in production. At that point, paying-but-read-only users will be able to create new plants while being blocked from editing/deleting them — incoherent.

**Fix:** Add the gate at the same point in both POST routes:

```ts
if (resolveReadOnlyFromRequest(request)) {
  return errorResponse(ErrorCode.ReadOnlyMode, "subscription is in read-only mode");
}
```

---

### WR-12: `useSortPreference` reads sessionStorage during initial useState — hydration mismatch risk

**File:** `src/app/(app)/catalog/_components/use-sort-preference.ts:23-24`

**Issue:** `useState<SortId>(readStoredSort)` is a function-form initial state that reads `sessionStorage` synchronously. SSR returns `"date_new"` (line 11). On the client, the first render reads the stored value. If the user previously selected `"name_asc"`, the client renders `"name_asc"` while React's hydration expects `"date_new"`. React 19 will emit a hydration mismatch warning and may force a full client re-render of the catalog grid.

**Fix:** Initialize to `"date_new"` and update via `useEffect` after mount:

```ts
const [sortId, setSortId] = useState<SortId>("date_new");
useEffect(() => {
  setSortId(readStoredSort());
}, []);
```

---

### WR-13: `update-plant.ts` location upsert ignores trim-only inputs but does not unset the column

**File:** `src/contexts/catalog/application/update-plant.ts:81`

**Issue:** When a user clears the location field, the client sends `{ location: "" }` (or `null`). The use-case at line 81 only upserts when `typeof patch.location === "string" && patch.location.trim().length > 0`. That's correct — empty/whitespace input does NOT add a suggestion. But the actual `plants.location` column update happens earlier in `runInTx` (line 73-77) via `plantsRepo.update`, which writes whatever value is in `patch.location`. If the user types " " (a space) and saves, the column is set to `" "` while the location_suggestions table is untouched. Two separate canonicalization paths.

**Fix:** Normalize at the schema layer — `updatePlantInputSchema` should `.transform((s) => (s ?? "").trim() || null)` for the location field, so empty-after-trim becomes null and the column gets a sensible value.

---

### WR-14: `idempotencyKeyRef` reset before await in journal-add-sheet creates inconsistent retry behavior

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:106-108, 138, 143`

**Issue:** Line 106-108 captures the current key, immediately nulls the ref, then closes the sheet. If the upload fails (line 136-139 / 140-144), the ref is restored to a NEW UUID and the sheet is re-opened. This means a network retry by the user (re-tapping the now-visible Add button after the toast) gets a NEW idempotency key — losing the de-duplication semantics for the original failed request. If the original POST actually committed server-side (network read-side failure on the response, not write-side), the retry under a different key creates a duplicate photo entry.

**Fix:** Don't null the ref until the response is materialized successfully. On failure, KEEP the same key so the user's retry replays:

```ts
try {
  // … fetch …
  if (response.ok) {
    // … success path …
    idempotencyKeyRef.current = null; // ← only here
    resetState();
    return;
  }
  // failure: keep the key so retry replays
  toast.error(labels.failure);
  onOpenChange(true);
} catch {
  // network error: keep the key
  toast.error(labels.failure);
  onOpenChange(true);
}
```

## Info

### IN-01: `delete-photo-entry.ts` `extractObjectKey` is duplicated across modules

**File:** `src/contexts/catalog/application/delete-photo-entry.ts:34-38`, `src/contexts/catalog/infrastructure/photo-storage.ts:180-186`

**Issue:** Both files implement an identical `{bucket}/{key}` parser. Extract to a shared helper to avoid future drift.

**Fix:** Move the parser to `@contexts/catalog/domain/storage-paths.ts`:

```ts
export function parseStoredCatalogUrl(storedUrl: string): { bucket: string; key: string } | null {
  const slash = storedUrl.indexOf("/");
  if (slash <= 0 || slash >= storedUrl.length - 1) return null;
  return { bucket: storedUrl.slice(0, slash), key: storedUrl.slice(slash + 1) };
}
```

Both consumers import from there.

---

### IN-02: Magic numbers in `delete-plant.ts` PostHog property `journal_entry_count: 0`

**File:** `src/contexts/catalog/application/delete-plant.ts:112, 137`

**Issue:** Hard-coded `0` for `journal_entry_count` with a doc comment explaining this is a Phase-7 reservation. The code is correct but the literal couples to that Phase-7 plan; future contributors may not see the comment.

**Fix:** Promote to a named constant:

```ts
const JOURNAL_ENTRY_COUNT_PLACEHOLDER = 0; // D-29 reservation, populated in Phase 7+
```

Used in both the `deps.tx` and own-UoW PostHog blocks.

---

### IN-03: `combobox.tsx` activedescendant id may collide on duplicate option values

**File:** `src/shared/ui/combobox.tsx:188-191, 244`

**Issue:** Option ids are constructed as `${listboxId}-${opt.value}`. If two options share the same `value` (defensible — should not happen, but the type allows it), both `<li>` elements get the same id, breaking `aria-activedescendant`.

**Fix:** Use option index (or a hash) for the id; use value only as the key/data attribute.

---

### IN-04: `delete-plant.ts` Inngest event id uses plantId only — replays across users impossible

**File:** `src/contexts/catalog/application/delete-plant.ts:100-103, 125-129`

**Issue:** `id: plant-deleted/${input.plantId}` is the Inngest deduplication key. Plants ids are UUIDs so global uniqueness holds, but if a row is ever resurrected (Phase 7+ undelete), the second deletion would silently no-op due to the dedup key. Embedding `userId` and `deletedAt` makes the dedup window scoped to the current request.

**Fix:** `id: plant-deleted/${input.userId}/${input.plantId}/${deletedAt}` — at the cost of dedup losing its primary purpose. Re-evaluate when the resurrection feature is in scope.

---

### IN-05: `journal-add-sheet.tsx` calls `compressPlantPhoto` AFTER the optimistic temp entry is rendered

**File:** `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:111-114`

**Issue:** The temp entry is rendered with the un-compressed file blob; the actual upload uses the compressed file. Discrepancy is invisible to the user but the temp blob may be huge (≤1MB after client compression upstream, but the optimistic preview uses the original which can be much larger). Memory usage briefly spikes for the temp display.

**Fix:** Compress first, then render the temp entry with the compressed blob URL. Trade-off: ~100ms compression latency before the sheet closes vs. lower memory.

---

### IN-06: `Combobox` clears typed query on `Escape` AND clears the bound `value` — surprising

**File:** `src/shared/ui/combobox.tsx:149-159`

**Issue:** When the listbox is closed and the user hits Escape, `onChange("")` fires (line 154), erasing the previously committed value. This may be intentional (Escape = clear in some patterns) but APG combobox spec calls for Escape to clear ONLY the typed query / close the listbox; clearing the committed value is non-standard and surprising in a form context (loses the saved location).

**Fix:** Remove the `onChange("")` call in the closed-listbox Escape branch. Clear only `query` and `filteredOptions`:

```ts
case "Escape": {
  e.preventDefault();
  if (open) {
    closeListbox();
  } else {
    setQuery("");
    setFilteredOptions(options);
  }
  break;
}
```

---

_Reviewed: 2026-05-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
