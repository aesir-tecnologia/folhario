---
phase: 05-catalog-meu-jardim
plan: 20
subsystem: api
tags: [catalog, plant-profile, delete, idempotency, signed-urls, gap-closure, tdd]

# Dependency graph
requires:
  - phase: 05-catalog-meu-jardim
    provides: useDeletePlant + GET /api/v1/plants/:id route handlers (Plans 05-09 + 05-08); toPlantWithSignedUrlSnakeCase mapper (Plan 05-08); usePatchPlantField idempotency-key pattern (Plan 05-12)
provides:
  - useDeletePlant generates and sends Idempotency-Key header on every DELETE request, mirroring usePatchPlantField's ref-based key pattern
  - GET /api/v1/plants/:plantId response now includes top-level cover_signed_url (string | null)
  - Unit Test 8 in tests/unit/use-plant-profile-mutations.test.tsx asserts the DELETE request carries idempotency-key
  - Integration Test 4.4 in tests/integration/catalog-routes-read-create.integration.test.ts asserts cover_signed_url presence + null shape
affects: [phase-06-identification, native-client-phase-11+, third-party-api-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ref-based idempotency-key generation: useRef<string|null>(null) + crypto.randomUUID() on mutate, clear on success/error — applied to both PATCH and DELETE plant mutations"
    - "GET-detail responses use toPlantWithSignedUrlSnakeCase mapper to attach signed cover URL (24h TTL via D-20 / signCatalogPhotoUrl)"

key-files:
  created: []
  modified:
    - "src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts"
    - "src/app/api/v1/plants/[plantId]/route.ts"
    - "tests/unit/use-plant-profile-mutations.test.tsx"
    - "tests/integration/catalog-routes-read-create.integration.test.ts"

key-decisions:
  - "Test 4.4 uses toHaveProperty('cover_signed_url') + ===null on a plant with no cover — proves CR-04 closure (field present in response shape) without relying on URL-shape regex. The InMemoryStorageAdapter returns memory:// URLs, so a /^https?:\\/\\// regex would have produced a false negative; the property-presence check is the load-bearing discriminator."
  - "Lifted vi.stubGlobal('crypto', { randomUUID }) into the useDeletePlant beforeEach to mirror usePatchPlantField test setup — gives deterministic UUID and matches the existing pattern even though jsdom's real crypto.randomUUID would also satisfy the assertion."
  - "Cleared idempotencyKeyRef in useDeletePlant onError (in addition to clearing on success) so a retry under a fresh user action regenerates a UUID rather than reusing the failed one — mirrors line 80 of usePatchPlantField."

patterns-established:
  - "Idempotency-key parity across plant-mutation hooks: every fetch into /api/v1/plants/:id (PATCH + DELETE) carries Idempotency-Key from a useRef<string|null> + crypto.randomUUID() generator, cleared on success and error"
  - "Route handlers that return plant detail responses use toPlantWithSignedUrlSnakeCase (not toPlantSnakeCase) so the wire payload always carries cover_signed_url; the SSR page and any TanStack/native consumer share the same shape"

requirements-completed: [CAT-04, CAT-09, UI-08]

# Metrics
duration: ~14min
completed: 2026-05-01
---

# Phase 05 Plan 20: Plant Profile API Contract Fix Summary

**Closed CR-02 + CR-04 via TDD: useDeletePlant now sends Idempotency-Key on every DELETE; GET /api/v1/plants/:id response now includes cover_signed_url, restoring the plant-profile delete button and the cover-refetch path.**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-05-01T21:18:00Z (approx — orientation + first edit)
- **Completed:** 2026-05-01T21:31:52Z
- **Tasks:** 2 (both TDD: RED + GREEN)
- **Files modified:** 4

## Accomplishments

- **CR-02 closed.** `useDeletePlant` now mirrors `usePatchPlantField`'s ref-based idempotency pattern: a `useRef<string | null>(null)` holds the current key; the ref is set on mutate via `crypto.randomUUID()` and cleared on success/error so the next distinct user action regenerates a fresh UUID. The `DELETE /api/v1/plants/:id` request now carries the `Idempotency-Key` header that the route handler at `src/contexts/catalog/api/route-handlers/delete-plant-handler.ts:47-50` requires. The plant-profile delete button works end-to-end again — `mutate` resolves, `onSuccess` fires, and the `router.push("/catalog")` redirect from `plant-profile.tsx` is reachable.
- **CR-04 closed.** `GET /api/v1/plants/:plantId` now uses `toPlantWithSignedUrlSnakeCase({ ...result.plant, coverSignedUrl: result.coverSignedUrl })` instead of `toPlantSnakeCase(result.plant)`. The `getPlant` use-case was already returning a 24h-TTL signed URL via `signCatalogPhotoUrl`; the route was discarding it. TanStack Query refetches and any direct API consumer (native client in Phase 11+, third-party tools) now receive the signed cover URL alongside the rest of the plant payload.
- **8 unit tests pass** (`tests/unit/use-plant-profile-mutations.test.tsx`) including new Test 8 asserting `idempotency-key` header presence on the DELETE call.
- **34 integration tests pass** (`tests/integration/catalog-routes-read-create.integration.test.ts`) including new Test 4.4 asserting `cover_signed_url` field presence on the GET detail response.

## Task Commits

Each task was committed atomically with explicit RED/GREEN cycles per the plan's `type: tdd` directive:

1. **Task 1 RED:** `c07f35f` `test(05-20): add failing test for useDeletePlant Idempotency-Key header (CR-02)`
2. **Task 1 GREEN:** `861d9a7` `feat(05-20): useDeletePlant sends Idempotency-Key header (CR-02)`
3. **Task 2 RED:** `3bec207` `test(05-20): add failing test for cover_signed_url in GET /api/v1/plants/:plantId (CR-04)`
4. **Task 2 GREEN:** `fddb621` `feat(05-20): GET /api/v1/plants/:id response includes cover_signed_url (CR-04)`

## Files Created/Modified

- `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts` — `useDeletePlant` patched: added `idempotencyKeyRef`, generate UUID on mutate, send via `headers: { "Idempotency-Key": idempotencyKey }`, clear on success and error.
- `src/app/api/v1/plants/[plantId]/route.ts` — Import swap (`toPlantSnakeCase` → `toPlantWithSignedUrlSnakeCase`); GET handler maps the plant through the signed-URL mapper with the spread `{ ...result.plant, coverSignedUrl: result.coverSignedUrl }`.
- `tests/unit/use-plant-profile-mutations.test.tsx` — Lifted `crypto.randomUUID` stub into `useDeletePlant` `beforeEach`; added Test 8 asserting `lowerHeaders["idempotency-key"]` is defined and non-empty after a successful DELETE mutation.
- `tests/integration/catalog-routes-read-create.integration.test.ts` — Added Test 4.4 in the `GET /api/v1/plants/[plantId]` describe block asserting `body.plant.cover_signed_url` is present (`toHaveProperty`) and `=== null` for a plant without a cover photo, with regression checks for `cover_photo_url` + `_meta.photo_entry_count` + `_meta.reminder_count`.

## Decisions Made

- **Test 4.4 uses property-presence + null check, not URL-shape regex.** The plan's example `expect(body.plant.cover_signed_url).toMatch(/^https?:\/\//)` would have produced a false negative against the in-memory test fixture: `tests/integration/fixtures/in-memory-storage-adapter.ts:46` returns `memory://${bucket}/${objectKey}?expires_in=...` URLs. Since `detailPlantId` has no `cover_photo_url`, `getPlant` returns `coverSignedUrl: null`, so the discriminator that proves CR-04 closure is `toHaveProperty('cover_signed_url')` (fails RED because `toPlantSnakeCase` omits the key entirely; passes GREEN once the route uses `toPlantWithSignedUrlSnakeCase`). The `=== null` follow-up locks in the value-side correctness for the no-cover branch.
- **`crypto` stub lifted into `useDeletePlant` beforeEach.** The plan called this out as conditional ("if missing"), and it was missing. Adding the stub matches `usePatchPlantField`'s `beforeEach` (line 62-64) and gives deterministic test output.
- **`onError` clears the idempotency-key ref in `useDeletePlant`.** Mirrors `usePatchPlantField` line 80. Without this, a retry after a network failure would reuse the same key — semantically a replay (correct for `withIdempotency` deduplication), but the test contract for "next distinct user action regenerates UUID" requires the clear, so the source change matches `usePatchPlantField`'s pattern verbatim.

## Deviations from Plan

None of substance — plan executed as written with two micro-adaptations documented above (URL-shape regex relaxed to property-presence + null check; `crypto` stub added to the existing `useDeletePlant` `beforeEach`). Both adaptations are internal to test wiring; no source-code behavior diverges from the plan's `<behavior>` block. No deviations against CLAUDE.md, no security gaps introduced, no auto-fixes triggered.

## Issues Encountered

- **Watch-mode test command initially blocked.** First `pnpm test:unit ... vitest --run` invocation was blocked by the `prevent-watch-mode-tests.sh` hook because the surrounding tooling treated `pnpm exec vitest --run` as watch-mode. Switched to `pnpm exec vitest run` syntax via the local binary at `/Users/machado/Projects/folhario/node_modules/.bin/vitest` and tests executed in single-run mode. Worktree has no `node_modules` of its own, so all binary invocations route to the main repo's `node_modules`.
- **Integration test required env loading.** Integration tests read `DATABASE_POOL_URL` from process env. Loaded `/Users/machado/Projects/folhario/.env.local` via `set -a; . /path/.env.local; set +a` before each integration run. Local Supabase Postgres at `127.0.0.1:54322` was already up.

## User Setup Required

None — no new environment variables, no dashboard configuration, no migrations.

## TDD Gate Compliance

Both tasks honored the RED → GREEN cycle:

- **Task 1:** RED commit `c07f35f` (test only, fails with "expected undefined to be defined" against the missing `idempotency-key` header). GREEN commit `861d9a7` (source patch makes Test 8 pass; Tests 1-7 remain green).
- **Task 2:** RED commit `3bec207` (test only, fails with "expected { …(11) } to have property 'cover_signed_url'"). GREEN commit `fddb621` (route handler patch makes Test 4.4 pass; Tests 4.1-4.3 + the other 30 integration tests remain green).

REFACTOR phase skipped on both tasks — both GREEN diffs are minimal (Task 1: 10 lines added in `useDeletePlant`; Task 2: 5-line spread substitution in the route handler) with zero duplication.

## Threat Flags

None. Both edits land within trust boundaries already analyzed in the plan's `<threat_model>`:

- T-05-20-01 (DELETE replay): mitigated — `Idempotency-Key` restores the deduplication contract end-to-end.
- T-05-20-02 (signed URL leakage): accepted per plan; Sentry breadcrumbs already redact `/api/v1` response bodies; 24h TTL bounds blast radius.
- T-05-20-03 (repudiation under fresh keys): accepted — DB-layer FK cascade + `findByIdForUser` returning null on second call makes the second commit a no-op.
- T-05-20-04 (read-only spoofing): mitigated — server-side `delete-plant-handler` enforces `resolveReadOnlyFromRequest`; the hook-level `ReadOnlyError` is defense-in-depth UX.

No new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Known Stubs

None. All edits wire real data sources end-to-end.

## Next Phase Readiness

- **SC-3 (plant profile + delete) restored** at the integration layer. Human verification still required per `05-VERIFICATION.md` `human_verification` item 6 — "Plant-profile delete flow end-to-end on real device" — which the verification report flagged as "WILL fail in the UI; once CR-02 is fixed, human must re-test the cascade UX." That re-test is now unblocked.
- **CAT-04 plant-profile cover refetch path restored.** TanStack Query refetch will receive `cover_signed_url` and the cover image will render correctly without relying on the SSR-only `[plantId]/page.tsx` `toPlantWithSignedUrlSnakeCase` injection.
- **SC-5 (delete cascade) reachable from UI.** Backend cascade behavior is unchanged (FK rules + Inngest event + reconciler cron + `pending_storage_deletions` rows still verified per `05-VERIFICATION.md` SC-5).
- **Phase 6 unblocked on the SC-3/SC-5 axis.** Other gaps remain (CR-01 closed by Plan 05-19; CR-03, WR-04, WR-05 are in sibling Phase-5 gap-closure plans). This plan does not address them.

## Self-Check: PASSED

Verified before declaring complete:

- `[ ✓ ]` `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts` exists; `Idempotency-Key` appears 2× (in `usePatchPlantField` and `useDeletePlant`).
- `[ ✓ ]` `src/app/api/v1/plants/[plantId]/route.ts` exists; `toPlantWithSignedUrlSnakeCase` appears 2× (import + invocation).
- `[ ✓ ]` `tests/unit/use-plant-profile-mutations.test.tsx` exists; `idempotency-key` appears 3× (Test 8 assertions).
- `[ ✓ ]` `tests/integration/catalog-routes-read-create.integration.test.ts` exists; `cover_signed_url` appears 4× (Test 4.4 + comments).
- `[ ✓ ]` Commits `c07f35f`, `861d9a7`, `3bec207`, `fddb621` present in `git log --oneline -6`.
- `[ ✓ ]` `pnpm typecheck` exits 0.
- `[ ✓ ]` `vitest run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx` exits 0 with 8 tests passing.
- `[ ✓ ]` `vitest run --project=integration tests/integration/catalog-routes-read-create.integration.test.ts` exits 0 with 34 tests passing.

---
*Phase: 05-catalog-meu-jardim*
*Plan: 20*
*Completed: 2026-05-01*
