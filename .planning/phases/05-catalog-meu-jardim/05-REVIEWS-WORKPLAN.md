# Phase 5 Reviews Workplan

## Cross-Cutting Decisions

### 1. HTTP envelope (data/next_cursor vs rows/nextCursor)

**Decision:** `{ data: T[], next_cursor: string | null }` at the HTTP JSON boundary (snake_case wire). Internal repository return shapes stay `{ rows: T[], nextCursor: ExtendedCursor | null }`. The route handler adapter converts: `rows` → `data`, `nextCursor` (encoded string) → `next_cursor`. This is already locked in 05-08 frontmatter truths line 40 (`returns { data: rows, next_cursor: string|null }`); all other plans must match.

**Rationale:** Consistent snake_case wire format aligns with Phase 2 D-05 (DB columns snake_case; TS camelCase via Drizzle). Opaque cursor token remains camelCase internally (Phase 2 D-36 opaque blob). Eliminates RSC prefetch / cache hydration mismatch between list and detail shapes.

**Plans to edit:** 05-03 (repo interface block references `{ rows, nextCursor }` — correct, no change needed at internal layer; add note that route adapter converts to `data/next_cursor`), 05-07 (list-plants use case returns `{ rows, nextCursor }` internally — correct; add adapter note), 05-08 (truths already correct; verify integration test assertions use `data`/`next_cursor`), 05-09 (verify integration test assertions), 05-15 (usePlants hook must read `data` and `next_cursor` from HTTP response), 05-16 (use-plant.ts + usePlants-derived cache seeding must use `data` field), 05-17 (use-photo-entries.ts must use `data`/`next_cursor`)

---

### 2. Field naming (snake_case JSON boundary, camelCase internal)

**Decision:** HTTP JSON fields are snake_case (`cover_photo_url`, `acquisition_date`, `created_at`, `identification_count`, `photo_url`, `thumbnail_url`). TypeScript types are camelCase (`coverPhotoUrl`, `acquisitionDate`, `createdAt`, `identificationCount`, `photoUrl`, `thumbnailUrl`). The route handler serializes camelCase repo rows to snake_case JSON responses. React hooks receive snake_case from the API and adapt to camelCase at the hook layer for component consumption.

**Rationale:** Phase 2 D-05 locks DB→TS as snake_case→camelCase. Using snake_case on the wire follows REST conventions and prevents the mixed-case drift the reviewer called out as HIGH severity.

**Plans to edit:** 05-08 (route handlers must serialize PlantRow camelCase fields to snake_case JSON — add explicit serializer step in task action), 05-09 (same; also PATCH body inputs are snake_case from client), 05-15 (usePlants hook: API returns snake_case; hook adapter maps to camelCase for components; also RSC HydrationBoundary must dehydrate snake_case-keyed data), 05-16 (use-plant.ts same adapter pattern; `identification_count` field name in HTTP response verified), 05-17 (use-photo-entries.ts, use-create-plant.ts — all must read snake_case response fields)

---

### 3. listPlants argument signature

**Decision:** `listPlants({ userId, sortKey, cursor, limit, plantIdFilter?, includeIdentificationCount? })` — single options object throughout. No positional overload. `sortKey` (not `sort`) is the parameter name everywhere. `plantIdFilter?: string` is optional and tested for by the existing 05-07 use-case implementation and the 05-08 detail-route call.

**Rationale:** 05-08 truth #1 (list) uses positional form but truth #2 (detail) uses object form with `plantIdFilter` — an internal contradiction. Locking to single object form removes both the call-site drift and the argument-name drift (`sort` vs `sortKey`) that the reviewer flagged as HIGH.

**Plans to edit:** 05-07 (list-plants.ts implementation signature — confirm object form; `sortKey` field name locked), 05-08 (truths line 40: update the positional-arg call form to object form; integration tests must use `sortKey` not `sort` in query param mapping), 05-15 (usePlants hook passes `sortKey` query param; `?sort=` query param name at HTTP layer stays `sort` per 05-08 decisions `cursor_query_param` — clarify that HTTP param is `sort`, internal argument is `sortKey`)

---

### 4. Phase 2/3/4 stub policy

**Decision:** NO code-level stubs for `requireUser` (Phase 4), idempotency table (Phase 2 D-37), UoW (Phase 2 D-18), or Inngest client (Phase 4). Phase 5 BLOCKS execution on those phases landing. The sole exception is Inngest: 05-06 MAY create a defensive stub file at `@shared/events/inngest-client.ts` if Phase 4 has not landed — this is already documented as a fallback in 05-06's Phase-4-dependency comment and is acceptable because the stub mirrors the exact API surface and the integration test proves the event payload shape when Phase 4 does land. Phase 3 design tokens: CSS `var(--token, fallback)` fallback values in 5b UI plans are acceptable for local authoring but visual approval requires Phase 3 tokens.

**Rationale:** Codex flagged that stub-able and blocking simultaneously masks integration failures. Stubs for auth/idempotency/UoW would create false-positive test suites. The Inngest stub is a documented contingency with an explicit integration guard, not silent masking.

**Plans to edit:** 05-06 (clarify that the Inngest stub is a NAMED CONTINGENCY documented in SUMMARY, not the default path; add explicit note "block execution if Phase 4 is not landed"), 05-08 (remove any "stub if absent" language for `requireUser`; state BLOCKING dependency explicitly), 05-09 (same)

---

### 5. Idempotency scoping

**Decision:** `requireUser(req)` executes FIRST, returning `{ userId, user }`. The idempotency helper is called as `idempotent(req, userId, fn)` — the `userId` argument is passed explicitly from the pre-extracted auth result so the helper can scope keys to the authenticated user BEFORE the callback executes. This satisfies Phase 2 D-37's `user_id` column requirement and prevents per-IP or per-key-only collision.

**Rationale:** If `requireUser` runs inside the idempotency callback, the helper cannot safely scope the key to the user (the user identity is unknown when the key lookup happens). Phase 2 D-37 schema has a `user_id` NOT NULL column — the helper must receive it at call time.

**Plans to edit:** 05-08 (task action: add explicit ordering note — `const user = await requireUser(req)` then `return idempotent(req, user.id, async () => { ... })`; update all 5 handler action blocks to match), 05-09 (same for all 6 mutating handlers)

---

### 6. Storage path canonical format

**Decision:** Paths are `{user_id}/{plant_id}/{photo_id}.{ext}` — bucket-relative, no leading slash, no bucket-name prefix in the path value. The bucket name (`plant-photos` or `plant-thumbnails`) is held by the StorageAdapter / photo-storage context helper and never appears inside the path string. `validateStoragePathOwnership` checks that each path starts with the exact prefix `{userId}/{plantId}/`.

**Rationale:** Phase 2 D-26 verbatim: `{user_id}/{aggregate_id}/{file_id}.{ext}` inside the bucket. Mixed examples in the plans (`plant-photos/u/p/x.jpg` vs `{userId}/{plantId}/...`) create spoofing-defense ambiguity. Locking to the exact format ensures T-5-01 path checks work correctly.

**Plans to edit:** 05-02 (integration test example path `'plant-photos/u/p/x.jpg'` must be corrected to bucket-relative `'{userId}/{plantId}/{uuid}.jpg'` form), 05-04 (`validateStoragePathOwnership` doc and test paths must use the canonical no-bucket-prefix format), 05-05 (test fixture paths in create-plant-manual.integration.test.ts must use canonical format), 05-07 (addPhotoEntry test paths), 05-08 (POST /plants integration tests: spoofed-path test must use a path that fails the prefix check, not a bucket-prefixed one), 05-09 (POST /plants/:id/photos spoofed-path test)

---

### 7. Per-PhotoEntry deletion event

**Decision:** Single-photo deletion dispatches a new event `photo_entry.deleted` with payload `{ user_id, plant_id, photo_entry_id, storage_deletion_job_id, storage_paths }`. The `catalog/cleanup-storage` Inngest function registered in 05-06 is expanded to listen to BOTH `plant.deleted` AND `photo_entry.deleted` (same handler body; both event types carry a `storage_deletion_job_id`). The `plant.deleted` event name is NOT reused for per-photo cleanup. The `pending_storage_deletions` outbox table is reused (no second table needed).

**Rationale:** Codex flagged reusing `plant.deleted` for per-photo cleanup as HIGH severity — semantically dangerous for future subscribers and metrics. A dedicated event name preserves domain clarity without adding a second table. The cleanup-storage function can handle both with a trivial union trigger.

**Plans to edit:** 05-04 (events.ts: add `PhotoEntryDeletedEvent` type alongside `PlantDeletedEvent`; add `PhotoEntryDeletedEventName = "photo_entry.deleted"` constant), 05-06 (cleanup-storage.ts: add `photo_entry.deleted` as a second trigger on the same Inngest function; update unit test to cover the photo_entry.deleted path), 05-09 (`deletePhotoEntryWithStorageCleanup` use case: dispatch `photo_entry.deleted` event instead of `plant.deleted`; update must_haves truths and task action accordingly)

---

### 8. IDB cache scope

**Decision:** IDB persister key is user-scoped: `folhario:tq-cache:${userId}`. The `createIdbPersister(userId)` factory (not a hardcoded constant) takes `userId` and constructs the key. The `ReactQueryProvider` (`persist-client-provider.tsx`) receives `userId` as a prop from the layout server component (which can read it from the session). On logout/user-switch, the app must call `persister.removeClient()` for the prior key and (if starting a new session) initialize a fresh persister with the new userId. Auth state listener in layout wires this.

**Rationale:** Codex flagged global `folhario:tq-cache` as persisting multiple users' data on shared devices — LGPD compliance risk. Per-user keys scope the data correctly. Clearing on logout is required by LGPD consent revocation (PRD §11 / Art. 18 data rights).

**Plans to edit:** 05-10 (all three: `decisions.persister_storage_key`, `createIdbPersister` signature, `persist-client-provider.tsx` — accept userId prop; update TDD tests to pass userId; update layout.tsx wiring section)

---

### 9. Combobox commit API

**Decision:** `Combobox` props: `{ inputValue: string, onInputValueChange: (v: string) => void, value: string | null, onCommit: (v: string) => void, priorItems, defaultItems, placeholder, ariaLabel, sectionLabels }`. There is NO `onChange` prop. Consumers that previously wired `onChange` to a PATCH mutation must be updated to wire `onCommit` instead. `onInputValueChange` fires on every keystroke (for internal filter state); `onCommit` fires only on Enter/blur with a value/on option selection.

**Rationale:** Codex flagged this as HIGH severity — `onChange` on keystroke + Plant Profile treating it as commit causes a PATCH on every keystroke. Separating input state from commit intent is the standard combobox pattern (also aligns with WAI-ARIA APG's "Editable Combobox" model).

**Plans to edit:** 05-12 (Combobox component props, must_haves truths, TDD behavior block — remove `onChange`, add `onInputValueChange` + `onCommit`; update artifacts description), 05-16 (Plant Profile inline-edit location field: wire `onCommit` to the inline-save mutation, not `onChange`), 05-17 (Manual Add location field: wire `onCommit`)

---

### 10. Home route resolution

**Decision:** Home page lives at `src/app/(home)/page.tsx`. The Phase 1 placeholder at `src/app/page.tsx` MUST be deleted in the same commit that creates `(home)/page.tsx`. There is exactly one `/` route. 05-18's task action must include: `trash src/app/page.tsx` followed by creating `src/app/(home)/page.tsx`.

**Rationale:** Codex flagged this as a load-bearing collision — two files cannot both define `/`. The `(home)` route group pattern is already documented in 05-18 `decisions.home_route_group` and in 05-RESEARCH. Locking the delete-and-create sequence eliminates ambiguity.

**Plans to edit:** 05-18 (task action: make the deletion of `src/app/page.tsx` explicit — not conditional; add `src/app/page.tsx` to the files_modified as "deleted"; update must_haves truths to assert `src/app/page.tsx` does NOT exist after execution)

---

## Per-Plan Edit Checklist

### 05-01

- Edits: No edits required.
- Rationale: Wave 0 test infrastructure bootstrap. No HTTP shapes, no combobox, no IDB keys, no storage paths, no event names. Network-dependent `npm view` version resolution risk (Codex finding) is a runtime concern handled by the executor, not a plan edit.

---

### 05-02

- Edits:
  1. **Schema fix (CRITICAL):** In the `decisions.pending_storage_deletions_schema` block and in the `<interfaces>` Drizzle table snippet, replace `array_length(storage_paths,1) > 0` with `cardinality(storage_paths) > 0`. Same change required in Task 3's generated-SQL verification step (acceptance criterion grep pattern must check for `cardinality` not `array_length`).
  2. **Add `dispatched_at` column:** Add `dispatched_at timestamptz NULL` column to the `pending_storage_deletions` table in the schema. This is required by the reconciler in 05-06 to skip rows dispatched within the last N seconds (preventing repeated re-dispatch on every cron tick). Update must_haves.artifacts `pending_storage_deletions` description and the Drizzle table snippet in `<interfaces>`. Update integration test (Task 5) to verify the column exists and defaults to NULL.
  3. **Storage path example (canonical format):** In Task 5 integration test, change `'plant-photos/u/p/x.jpg'` to `'{userId}/{plantId}/{uuid}.jpg'` (bucket-relative, no bucket prefix in path value — Decision 6).
- Findings addressed: schema `array_length` NULL-returning bug (Codex HIGH, schema section), missing `dispatched_at` causing reconciler re-dispatch (Codex plan-specific 05-06 finding), storage path format canonicalization (Decision 6).

---

### 05-03

- Edits:
  1. **Add `dispatched_at` to `PendingDeletionRow` type and repo functions:** `PendingDeletionRow` gains `dispatched_at: string | null`. Add `markDispatched(tx: Sql, id: string): Promise<PendingDeletionRow | null>` function to `pending-storage-deletions.ts`. Update `findOlderThan` predicate to also filter `dispatched_at IS NULL OR dispatched_at < now() - <threshold>` so recently-dispatched rows are skipped even if still `pending`. Update `<interfaces>` block, `must_haves.artifacts` description, and Task 2 behavior list.
  2. **Integration test storage paths:** All test fixture path strings must use canonical `{userId}/{plantId}/{uuid}.ext` format (no bucket prefix).
  3. **Clarify HTTP-layer adapter note:** Add a sentence to the objective: "Repository functions return camelCase TypeScript types; route handlers (05-08/09) serialize to snake_case JSON." This prevents the executor from assuming the repo already outputs wire format.
- Findings addressed: missing `dispatched_at` (Codex 05-06 concern), storage path format (Decision 6), HTTP boundary adapter clarity.

---

### 05-04

- Edits:
  1. **drizzle-zod field name clarification:** Add explicit note in task action: "drizzle-zod generates schemas using the Drizzle TypeScript property names (camelCase), NOT the DB column names. `createSelectSchema(plants)` produces `.coverPhotoUrl`, `.acquisitionDate`, `.createdAt` — not `.cover_photo_url`. Consumers that import these schemas get camelCase field names. The route handler is responsible for mapping camelCase response objects to snake_case JSON."
  2. **Add `PhotoEntryDeletedEvent` type to events.ts:** Per Decision 7, events.ts must export `PhotoEntryDeletedEvent` with payload `{ user_id: string, plant_id: string, photo_entry_id: string, storage_deletion_job_id: string, storage_paths: string[] }` and `PhotoEntryDeletedEventName = "photo_entry.deleted"`. Update `must_haves.artifacts` events.ts description and the `min_lines` estimate.
  3. **Storage path canonical format in tests:** `validateStoragePathOwnership` test cases must use paths in the form `{userId}/{plantId}/{uuid}.jpg` (no bucket prefix). Update test fixture strings in `decisions.storage_path_validator_signature` description.
- Findings addressed: drizzle-zod field name compilation risk (Codex HIGH 05-04), `photo_entry.deleted` event type (Decision 7), storage path canonicalization (Decision 6).

---

### 05-05

- Edits:
  1. **PostHog serverless flush:** Add explicit note in task action: "After calling `posthog.capture(...)`, call `await posthog.shutdownAsync()` (or `posthog.flush()`) in the same request handler to ensure the event is transmitted before the serverless function terminates. Vercel functions terminate promptly — fire-and-forget PostHog calls are dropped."
  2. **Storage path test fixtures:** Integration test fixture paths must use canonical `{userId}/{plantId}/{uuid}.ext` format.
  3. **`create-plant-from-identification` result shape note:** Add explicit comment that the result `Plant` type is the internal camelCase `PlantRow`; Phase 6 consumes it through the API (snake_case serialized); no custom Phase-6-specific result shape is invented here. The use case returns the standard `PlantRow` from the repo.
- Findings addressed: PostHog serverless flush behavior (Codex 05-05 finding), storage path format (Decision 6), Phase 6 result shape drift risk.

---

### 05-06

- Edits:
  1. **Add `dispatched_at` to dispatch flow:** After `inngest.send(...)` succeeds, call `pendingDeletions.markDispatched(tx, jobId)` (or after commit, equivalent non-transactional update). Update task action and must_haves truths to include this step.
  2. **Expand `catalog/cleanup-storage` to handle `photo_entry.deleted`:** Update `cleanup-storage.ts` Inngest function: trigger array becomes `[{ event: "plant.deleted" }, { event: "photo_entry.deleted" }]`. Same handler body works for both since both carry `storage_deletion_job_id`. Update must_haves truths, task actions, and unit test to cover the `photo_entry.deleted` path.
  3. **Reconciler uses `dispatched_at`:** Update `reconcile-deletions.ts` and 05-03's `findOlderThan` call: the threshold check must also cover `dispatched_at IS NULL OR dispatched_at < now() - threshold` to avoid re-dispatching recently-fired jobs. Update must_haves truths.
  4. **Stub contingency language:** Tighten stub language — "Inngest stub is a NAMED CONTINGENCY; executor must document in SUMMARY whether Phase 4 was present. Block execution if Phase 4 is absent without acknowledging the stub path."
- Findings addressed: missing `dispatched_at` causing repeated reconciler dispatch (Codex 05-06), `photo_entry.deleted` event for cleanup (Decision 7 / Codex 05-09 HIGH).

---

### 05-07

- Edits:
  1. **`setCoverPhoto` must NOT use raw SQL in use-case layer:** The plan's `decisions.set_cover_photo_validation` references "a tiny SELECT 1 from photo_entries WHERE…" — this is borderline raw SQL in the use-case. Clarify that `setCoverPhoto` calls `photoEntries.findByPlant` or a new repo helper `photoEntries.findById` from 05-03 to verify ownership — the use case never writes SQL directly. Repository call for the SELECT; repository call for the UPDATE. This preserves Phase 2 D-17 (no Drizzle in application layer — use cases are application layer; they call repos, not SQL).
  2. **`listPlants` signature (Decision 3):** Update task action and must_haves truths to use the object-form signature: `listPlants({ userId, sortKey, cursor, limit, plantIdFilter?, includeIdentificationCount? })`. Ensure the `sortKey` parameter name (not `sort`) is consistent in the implementation description.
  3. **`listPlants` returns camelCase internally:** Add note that `listPlants` returns `{ rows: PlantRow[], nextCursor: string | null }` (camelCase). Route handler (05-08) converts to `{ data, next_cursor }` in the HTTP response.
  4. **Storage path test fixtures in addPhotoEntry integration test:** Canonical format required.
- Findings addressed: `setCoverPhoto` raw SQL in use-case risk (Codex 05-07 HIGH), `listPlants` argument drift (Decision 3 / Codex HIGH), HTTP envelope adapter clarity (Decision 1).

---

### 05-08

- Edits:
  1. **HTTP envelope consistency:** Must-haves truths lines 40-44 already specify `{ data, next_cursor }` — verify all 5 integration test files assert this exact shape. Update task action to make the serialization step explicit: "Route handler converts camelCase `PlantRow` fields to snake_case JSON keys before returning." List the explicit mapping: `coverPhotoUrl` → `cover_photo_url`, `acquisitionDate` → `acquisition_date`, `createdAt` → `created_at`.
  2. **Idempotency ordering (Decision 5):** Update all 5 handler task actions to show: `const user = await requireUser(req)` THEN `return idempotent(req, user.id, async () => { ... })`. Currently implied but not explicit.
  3. **listPlants call form (Decision 3):** Update truth #1 to use object form: `listPlants({ userId, sortKey, cursor, limit })`. Update truth #2 for detail fetch: `listPlants({ userId, plantIdFilter: plantId, includeIdentificationCount: true, sortKey: 'created_desc', cursor: null, limit: 1 })`.
  4. **Auth error mapping:** Add explicit note in task action for `httpMapDomainError`: errors thrown by `requireUser` (unauthenticated, token_expired) must be caught and mapped to the closed error registry (not bubble as 500). Update `http-error-map.ts` description to include auth error codes.
  5. **stub policy:** Remove any conditional "stub if absent" language for `requireUser`; replace with BLOCKING dependency note.
- Findings addressed: Response-shape drift (Decision 1/2), idempotency ordering (Decision 5), listPlants signature (Decision 3), auth error 500 risk (Codex 05-08), stub policy (Decision 4).

---

### 05-09

- Edits:
  1. **`photo_entry.deleted` event (Decision 7):** `deletePhotoEntryWithStorageCleanup` must dispatch `photo_entry.deleted` (NOT `plant.deleted`). Update use case name and must_haves truths, task actions, and unit test. The `pending_storage_deletions` row is still the outbox; only the event name changes.
  2. **Idempotency ordering (Decision 5):** Same pattern as 05-08 — `requireUser` first, `idempotent(req, user.id, fn)` second. Update all 6 handler action blocks.
  3. **HTTP response serialization (Decisions 1/2):** PATCH responses (200 + Plant) must serialize camelCase PlantRow to snake_case JSON. Add explicit serialization note in task actions.
  4. **stub policy:** Remove conditional Inngest stub language; state BLOCKING dependency.
- Findings addressed: `plant.deleted` reuse for PhotoEntry cleanup (Codex 05-09 HIGH / Decision 7), idempotency ordering (Decision 5), field-name drift (Decision 2), stub policy (Decision 4).

---

### 05-10

- Edits:
  1. **IDB cache key user-scoping (Decision 8):** Replace `decisions.persister_storage_key` value `"folhario:tq-cache"` with the pattern `folhario:tq-cache:${userId}`. Update `createIdbPersister(key)` signature to `createIdbPersister(userId: string)`. Update `persist-client-provider.tsx` to accept `userId: string` prop; update layout.tsx wiring to pass the current authenticated user's ID. Update TDD test behavior: "createIdbPersister('user-abc') writes to key 'folhario:tq-cache:user-abc'". Add test case: "calling removeClient() for one userId does not affect another userId's cache."
  2. **Logout/user-switch clearing:** Add explicit must_haves truth: "ReactQueryProvider calls persister.removeClient() on auth state change (logout or user-switch) to prevent cross-user data leak." Add task action note: "Auth state listener wired in persist-client-provider.tsx or layout.tsx; Phase 4 AuthAdapter provides the subscription mechanism."
- Findings addressed: Global IDB key cross-user leak (Codex 05-10 HIGH / Decision 8 LGPD risk).

---

### 05-11

- Edits: No edits required.
- Rationale: Fine as a stub per Codex review. The "only status key" test will break Phase 10 intentionally — that is the design. The env-flag test harness is sound. No cross-cutting decision touches this plan.

---

### 05-12

- Edits:
  1. **Combobox commit API (Decision 9):** Replace `onChange` prop with `onInputValueChange: (v: string) => void` (fires on every keystroke) and `onCommit: (v: string) => void` (fires on Enter/blur commit or option selection). Remove all `onChange` references from must_haves truths, artifacts description (`src/shared/ui/combobox.tsx` props), and TDD behavior blocks. Update the behavior list to: "onInputValueChange fires on every keystroke with the current input text"; "onCommit fires when user selects an option OR presses Enter with non-empty input OR blurs with non-empty input"; "onCommit does NOT fire on ArrowUp/Down navigation."
  2. **Consumer note:** Add explicit note in objective: "Consumers (05-16 Plant Profile location, 05-17 Manual Add location) MUST wire `onCommit` to the mutation/state-update — NOT `onInputValueChange`. This is the load-bearing change from the pre-review plan."
- Findings addressed: `onChange` fires on every keystroke causing PATCH while typing (Codex 05-12 HIGH / Decision 9).

---

### 05-13

- Edits: No edits required.
- Rationale: Codex finding about swipe-down deferral is status quo by design — the plan already documents it with a `vaul_fallback_path` contingency. The checkpoint gate catches a11y failures. No cross-cutting decision touches this plan.

---

### 05-14

- Edits:
  1. **InlineEditField hidden pencil on disabled/readOnly:** Add to must_haves truths: "InlineEditField in `disabled` or `readOnly` state hides the pencil affordance entirely (display:none or conditional render), not just disables the button." Add TDD behavior case: "disabled=true: pencil icon is not in the DOM (queryByRole('button', { name: /editar/i }) returns null)."
- Findings addressed: pencil affordance visibility in disabled state (Codex 05-14 finding).

---

### 05-15

- Edits:
  1. **HTTP response shape in usePlants (Decisions 1/2):** Update the hook implementation description: "GET /api/v1/plants returns `{ data: PlantRow[], next_cursor: string|null }`. `usePlants` reads `pages[n].data` and `pages[n].next_cursor`. The `data` array contains snake_case response objects; adapt to camelCase in the `select` transform or in the component." Explicitly state the field mapping in the task action.
  2. **RSC prefetch shape alignment:** RSC calls the use case directly (returns camelCase `PlantRow[]`); HydrationBoundary dehydrates this. The client hook expects `data`/`next_cursor` from HTTP fetches. Add note: "Prefetched RSC data and subsequent HTTP pages must have consistent field shapes after the adapter layer — either normalize to camelCase everywhere in the query client's `select` transform, or ensure the RSC prefetch wraps its result in `{ data: rows, next_cursor: null }` to match the HTTP page shape."
  3. **`<style>` inside `<ul>` (Codex 05-15):** Add to task action: "Do NOT place `<style>` elements inside `<ul>` list containers. All `<style>` tags must be outside the list DOM tree."
- Findings addressed: RSC prefetch / usePlants shape mismatch (Codex 05-15), `<style>` inside `<ul>` (Codex 05-15), HTTP envelope consistency (Decision 1/2).

---

### 05-16

- Edits:
  1. **Plant detail cache from list data (Decisions 1/2):** Plant Profile seeds its cache from list data. Add explicit adapter note in task action: "The `use-plant.ts` hook reads from the cache seeded by `usePlants`. The list cache entries are snake_case HTTP response objects. The plant detail hook must apply the same camelCase adapter used by usePlants (or reference the shared adapter from 05-15). Do NOT access `plant.coverPhotoUrl` from an HTTP-sourced cache entry — it will be `cover_photo_url`."
  2. **`identification_count` field name:** The detail endpoint returns `identification_count` (snake_case per Decision 2). The hook must read `plant.identification_count`, not `plant.identificationCount`, when consuming the HTTP response.
  3. **Combobox `onCommit` (Decision 9):** Location field inline-edit wires `onCommit` to `useUpdatePlant`'s mutate function (not `onInputValueChange`). Update task action description for the location inline-edit field.
- Findings addressed: Plant detail cache adapter mismatch (Codex 05-16), `identification_count` field name (Codex cross-plan HIGH), Combobox commit semantics (Decision 9).

---

### 05-17

- Edits:
  1. **Manual Add draft key — real userId (Codex 05-17 HIGH):** The draft key `folhario:catalog:new-plant-draft:${userId}` requires a real `userId` at draft-write time. The manual-add page is a server component with auth check; the client island receives `userId` as a prop from the RSC wrapper. Add explicit note: "Manual Add page RSC layer calls `requireUser(req)` server-side and passes `userId` as a prop to the client island. The client island MUST NOT use `anonymous-draft` or any placeholder — if `userId` is unavailable (user not authenticated), the RSC redirects to login before the island renders. The draft key always uses the real `userId`." Update must_haves truths and task action.
  2. **Optimistic cover update URL field (Codex 05-17):** `useSetCoverPhoto`'s optimistic update sets `cover_photo_url` (snake_case wire field) on the plant detail cache entry — NOT `coverPhotoUrl` (camelCase) and NOT `thumbnailUrl`. The server returns the full `photo_url` from the PhotoEntry as the new `cover_photo_url`. Update the `optimistic_set_cover_photo` decision block: "onMutate update: `oldPlant.cover_photo_url = resolvedPhotoUrl` — uses the PhotoEntry's `photo_url` field (NOT `thumbnailUrl`)."
  3. **HTTP response field names in hooks (Decisions 1/2):** All hooks reading API responses (`use-photo-entries.ts`, `use-create-plant.ts`, etc.) must read snake_case fields from the HTTP response. Add a shared adapter note to task action.
  4. **Combobox `onCommit` (Decision 9):** Manual Add location field wires `onCommit` to the form state update — not `onInputValueChange`.
- Findings addressed: `anonymous-draft` key (Codex 05-17 HIGH / Decision 8 user-scoping principle), optimistic cover URL field (Codex 05-17), HTTP envelope consistency (Decisions 1/2), Combobox commit semantics (Decision 9).

---

### 05-18

- Edits:
  1. **Home route collision (Decision 10):** Task action must be explicit: "Delete `src/app/page.tsx` (Phase 1 placeholder) using `trash src/app/page.tsx`. Create `src/app/(home)/page.tsx`. These are the SAME commit. Verify there is no remaining `src/app/page.tsx` after the deletion." Add `src/app/page.tsx` to `files_modified` with note "(deleted)". Add must_haves truth: "`src/app/page.tsx` does NOT exist after this plan runs; the single `/` route is defined solely by `src/app/(home)/page.tsx`."
- Findings addressed: Home route collision (Codex 05-18 HIGH / Decision 10).

---

## Schema / Migration Changes

The following schema changes must be reflected in Plan 05-02 (schema definition + migration SQL) and Plan 05-03 (repository types + functions):

| Change | Table | Column / Constraint | Action |
|--------|-------|---------------------|--------|
| Fix NULL-returning CHECK | `pending_storage_deletions` | `CHECK (cardinality(storage_paths) > 0)` | Replace `array_length(storage_paths, 1) > 0` with `cardinality(storage_paths) > 0` in Plan 05-02 schema snippet, Drizzle check expression, generated migration SQL, and integration test acceptance criteria. |
| Add dispatch tracking column | `pending_storage_deletions` | `dispatched_at timestamptz NULL` (default NULL) | Add to Plan 05-02 Drizzle table definition. Add `dispatched_at` to `PendingDeletionRow` type in Plan 05-03. Add `markDispatched(tx, id)` function to pending-storage-deletions repo (Plan 05-03). Update `findOlderThan` predicate in Plan 05-03 and reconciler in Plan 05-06 to skip recently-dispatched rows. |

Both changes require a new or amended Drizzle migration file and a re-run of `drizzle-kit push --force` on the local DB.

---

## Open Questions / Deferrals

1. **E2E tests skipped until Phase 4 (Codex MEDIUM):** Several E2E Playwright specs in 05-15 through 05-18 are annotated `skip` pending Phase 4 auth landing. This is intentional and acceptable. The phase is not considered end-to-end verified until Phase 4 lands and the skip annotations are removed. This is captured in 05-VALIDATION.md and is a known gate, not a gap to close in this workplan.

2. **Lightbox swipe deferred (Codex 05-13/05-14 finding):** Swipe-down dismiss on BottomSheet and swipe-between-photos on Lightbox are deferred per Plans 05-13/05-14 decisions. Visible buttons are provided as the accessibility fallback. This is an intentional scope decision already documented in plan decisions blocks. No change required.

3. **`useSubscription` test-only break in Phase 10 (Codex 05-11):** The "only status key" test will intentionally break when Phase 10 adds richer subscription data. This is by design — it creates a forcing function for Phase 10 to update the hook. No change required.

4. **Phase 3 design token CSS fallbacks (Plans 05-12 through 05-18):** UI plans use `var(--token, fallback)` patterns for Phase 3 design tokens not yet on disk. Visual approval requires Phase 3 completion. Not a workplan edit — execution dependency documented in each plan's PHASE-3-DEPENDENCY comment.

5. **Create-from-identification result shape and Phase 6 (Codex 05-05):** The Plan 05-05 note about "may not match Phase 6" is acknowledged. The use case returns the standard `PlantRow`; Phase 6 controls its own caller and can adapt. No Phase-6-specific custom result shape is invented in Phase 5 (per the fix in 05-05 edits above).

---

## Return marker

## WORKPLAN COMPLETE
File: .planning/phases/05-catalog-meu-jardim/05-REVIEWS-WORKPLAN.md
Plans needing edits: 14/18
Cross-cutting decisions locked: 10/10
