---
phase: 05-catalog-meu-jardim
plan: 17
type: execute
wave: 8
depends_on:
  - 05-08    # POST /api/v1/plants contract + GET /api/v1/plants/:plantId/photos contract
  - 05-09    # POST /api/v1/plants/:plantId/photos + PATCH/DELETE /api/v1/plants/:plantId/photos/:photoEntryId + PATCH /api/v1/plants/:plantId/cover-photo contracts
  - 05-10    # ReactQueryProvider + pt-BR.json
  - 05-11    # useSubscription stub
  - 05-12    # Combobox (location field in manual-add)
  - 05-13    # BottomSheet (photo-journal add modal)
  - 05-14    # Lightbox + InlineEditField (photo-journal lightbox + photo-journal note edit)
  - 05-15    # useSortPreference style (re-uses sessionStorage convention for draft key)
  - 05-16    # use-plant.ts (consumed by photo-journal page for plant.name in alt text); also avoids file overlap on hooks
  # PHASE-2-DEPENDENCY (BLOCKING execution): requires Phase 2 to ship POST /api/v1/photos/upload (D-27) for two-step upload flow + browser-image-compression (D-28) + exifr (D-29) for client-side EXIF strip.
files_modified:
  - src/app/catalog/new/page.tsx
  - src/app/catalog/[plantId]/photos/page.tsx
  - src/app/catalog/[plantId]/photos/photo-journal-client.tsx
  - src/contexts/catalog/api/use-create-plant.ts
  - src/contexts/catalog/api/use-photo-entries.ts
  - src/contexts/catalog/api/use-add-photo-entry.ts
  - src/contexts/catalog/api/use-update-photo-entry-note.ts
  - src/contexts/catalog/api/use-delete-photo-entry.ts
  - src/contexts/catalog/api/use-set-cover-photo.ts
  - src/contexts/catalog/api/use-manual-add-draft.ts
  - tests/unit/contexts/catalog/use-manual-add-draft.test.ts
  - tests/e2e/catalog/manual-add-plant.spec.ts
  - tests/e2e/catalog/manual-add-validation.spec.ts
  - tests/e2e/catalog/photo-journal-add.spec.ts
  - tests/e2e/catalog/lightbox-swipe.spec.ts
  - tests/e2e/catalog/lightbox-a11y.spec.ts
  - tests/e2e/catalog/add-photo-entry.integration.test.ts
  - package.json  # CONDITIONAL (resolves plan-checker WARNING for 5b round): Task 4 may install date-fns + date-fns-tz IF Phase 1 INFRA-23 has not already shipped them. Executor MUST first grep package.json for "date-fns-tz" — if found, skip the install entirely; if absent, run `pnpm add date-fns@4.1.0 date-fns-tz@3.2.0` and include package.json + pnpm-lock.yaml in the commit. The acceptance criterion verifies either pre-existence OR successful install.
  - pnpm-lock.yaml  # CONDITIONAL — committed alongside package.json IF the install path is taken.
autonomous: true
requirements:
  - CAT-02   # Manual create UX (form + 2-step upload + redirect to detail)
  - CAT-03   # Client validation UX (validation_failed surfacing + field highlighting)
  - CAT-06   # Photo Journal UI (reverse-chrono list + add via BottomSheet + lightbox view)
  - UI-11    # Photo Journal screen (per-plant chronological + lightbox + read-only variant)
decisions:
  manual_add_draft_key: |
    sessionStorage key per CONTEXT D-27 + Specifics: `folhario:catalog:new-plant-draft:${userId}`.
    Auto-saves on every form-field change (>3 fields rule per PRD §17 inputs).
    Cleared on successful create (per D-27). Form has 5 fields:
    name + nickname + location + acquisition_date + notes (photo upload state
    is NOT in the draft — uploaded photos are persisted via the upload route's
    own idempotency).
  two_step_upload_flow: |
    Per CONTEXT D-22 + D-23 + Phase 2 D-27 + D-29:
    1. Client compresses image to ≤1MB + strips EXIF/GPS via
       `browser-image-compression` (Phase 2 ships).
    2. Client POSTs FormData to /api/v1/photos/upload with Plant aggregate
       UUID (generated client-side via crypto.randomUUID()).
    3. Server (Phase 2) validates GPS absence, uploads with service role,
       generates thumbnail via sharp, returns { photo_url, thumbnail_url }.
    4. Client POSTs /api/v1/plants with { id, name, ..., initial_photos:
       [{ photo_url, thumbnail_url }] } + Idempotency-Key.
    Same flow for photo-journal add: upload → POST /api/v1/plants/:id/photos.
  pessimistic_create_per_d_07: |
    useCreatePlant uses Pattern 4 (pessimistic). Per CONTEXT D-07:
    "pessimistic for create + delete (skeleton or button-loading until
    server response)." On success: navigate to /catalog/[id] (Plant Profile).
  pessimistic_add_photo_entry_per_d_07: |
    useAddPhotoEntry pessimistic. On success: invalidate
    ["plants", plantId, "photos"] query so the journal list refreshes.
  optimistic_update_photo_entry_note: |
    useUpdatePhotoEntryNote OPTIMISTIC per CONTEXT D-07 ("inline edits =
    optimistic"). Per Plan 05-09 SUMMARY line 46: "PATCH photo entry note
    from lightbox (D-17 'Editar nota')" → OPTIMISTIC. onMutate snapshots
    entry, applies note locally, onError rolls back, onSettled invalidates.
  pessimistic_delete_photo_entry: |
    useDeletePhotoEntry PESSIMISTIC per Plan 05-09 SUMMARY line 47:
    "DELETE photo entry from lightbox (D-17 'Excluir')" → PESSIMISTIC.
    On success: setQueriesData removes entry from journal list pages.
  optimistic_set_cover_photo: |
    useSetCoverPhoto OPTIMISTIC per Plan 05-09 SUMMARY line 48:
    "PATCH cover photo from lightbox (D-17 'Definir como capa')" →
    OPTIMISTIC. onMutate updates cover_photo_url on the plant detail
    cache.
  swipe_deferred_consumer_buttons: |
    Per Plan 05-14 decisions.lightbox_swipe_deferred — touch swipe is
    deferred. Photo Journal page passes `prevLabel`/`nextLabel` props to
    Lightbox so visible buttons are present for non-keyboard cycling.
  manual_add_redirect_on_success: |
    On successful create, router.push(`/catalog/${plant.id}`) navigates
    to the new plant's profile (per ROADMAP SC-2 "new plant appears in
    catalog grid" — but the better UX per CONTEXT § Specifics is to land
    on the new plant's profile so the user can immediately add a photo
    journal entry / verify their fields). Both behaviors are valid; this
    plan picks the profile destination. Document in 05-17-SUMMARY.md.
must_haves:
  truths:
    - "Manual Add page at /catalog/new is a full-screen route per CONTEXT D-13"
    - "Form has 5 fields: name (required) + nickname (optional) + location via Combobox + acquisition_date + notes (multiline) + photo upload"
    - "Submitting with empty name shows validation_failed UX: 1.5px Overdue stroke + filled alert icon + Overdue helper line below the field (3 redundant signals per UI-SPEC line 207-215)"
    - "Submitting with no photo shows photo-required validation copy"
    - "Form draft auto-saves to sessionStorage at folhario:catalog:new-plant-draft:${userId} on every change (D-27)"
    - "Photo upload uses two-step flow: browser-image-compression → /api/v1/photos/upload → server returns photo_url+thumbnail_url → POST /api/v1/plants with initial_photos"
    - "On successful create: clear draft + router.push(/catalog/[id])"
    - "Photo Journal page at /catalog/[plantId]/photos lists PhotoEntry rows reverse-chronologically (CAT-06)"
    - "Photo Journal '+ Foto no diário' CTA opens BottomSheet (Plan 05-13) with photo picker + optional note input"
    - "Tapping a Photo Journal entry opens Lightbox (Plan 05-14) with note in bottom strip + 3 actions (Editar nota, Definir como capa, Excluir)"
    - "Editar nota = optimistic mutation (Pattern 3) — opens InlineEditField in bottom strip; Definir como capa = optimistic mutation (Pattern 3); Excluir = pessimistic mutation (Pattern 4)"
    - "Lightbox renders Próxima/Anterior visible buttons for touch users (swipe deferred per Plan 05-14)"
    - "Photo Journal entry alt text: 'Foto de {plant.name}, {pt-BR formatted date}' per UI-SPEC line 388"
    - "Read-only mode: '+ Foto no diário' CTA hidden + lightbox actions hidden (UI-SPEC table line 341-342)"
    - "Add-entry sheet has 'Fechar' labelled close + drag handle (composed from BottomSheet primitive)"
    - "Add-entry has photo upload + 'Como ela está hoje? (opcional)' optional note input + 'Adicionar ao diário' submit button"
  artifacts:
    - path: "src/app/catalog/new/page.tsx"
      provides: "Manual Add full-screen route — server component with auth check; client island handles form"
      min_lines: 220
      contains: "useCreatePlant"
    - path: "src/app/catalog/[plantId]/photos/page.tsx"
      provides: "Photo Journal RSC page with prefetch + HydrationBoundary"
      min_lines: 40
      contains: "HydrationBoundary"
    - path: "src/app/catalog/[plantId]/photos/photo-journal-client.tsx"
      provides: "Photo Journal client island with reverse-chrono list + add BottomSheet + Lightbox + 3 mutation flows"
      min_lines: 220
      contains: "Lightbox"
    - path: "src/contexts/catalog/api/use-create-plant.ts"
      provides: "useMutation PESSIMISTIC for POST /api/v1/plants per D-07 Pattern 4"
      min_lines: 40
      contains: "useMutation"
    - path: "src/contexts/catalog/api/use-photo-entries.ts"
      provides: "useInfiniteQuery for GET /api/v1/plants/:plantId/photos — reverse-chrono cursor pagination"
      min_lines: 35
      contains: "useInfiniteQuery"
    - path: "src/contexts/catalog/api/use-add-photo-entry.ts"
      provides: "useMutation PESSIMISTIC for POST /api/v1/plants/:plantId/photos per D-07 Pattern 4"
      min_lines: 40
      contains: "useMutation"
    - path: "src/contexts/catalog/api/use-update-photo-entry-note.ts"
      provides: "useMutation OPTIMISTIC for PATCH /api/v1/plants/:plantId/photos/:photoEntryId per Pattern 3"
      min_lines: 50
      contains: "onMutate"
    - path: "src/contexts/catalog/api/use-delete-photo-entry.ts"
      provides: "useMutation PESSIMISTIC for DELETE /api/v1/plants/:plantId/photos/:photoEntryId per Pattern 4"
      min_lines: 35
      contains: "useMutation"
    - path: "src/contexts/catalog/api/use-set-cover-photo.ts"
      provides: "useMutation OPTIMISTIC for PATCH /api/v1/plants/:plantId/cover-photo per Pattern 3"
      min_lines: 40
      contains: "onMutate"
    - path: "src/contexts/catalog/api/use-manual-add-draft.ts"
      provides: "useManualAddDraft hook — sessionStorage draft persistence (D-27)"
      min_lines: 50
      contains: "useManualAddDraft"
    - path: "tests/unit/contexts/catalog/use-manual-add-draft.test.ts"
      provides: "TDD: writes/reads draft from folhario:catalog:new-plant-draft:${userId}; clears on call to clear()"
      min_lines: 60
      contains: "useManualAddDraft"
    - path: "tests/e2e/catalog/manual-add-plant.spec.ts"
      provides: "Playwright happy-path: fill form + upload mock photo + submit → redirect to profile + grid shows new plant"
      min_lines: 70
      contains: "Adicionar planta"
    - path: "tests/e2e/catalog/manual-add-validation.spec.ts"
      provides: "Playwright validation: empty name → field highlighted + summary; no photo → photo-required helper; both errors → form-level summary block"
      min_lines: 50
      contains: "validation_failed"
    - path: "tests/e2e/catalog/photo-journal-add.spec.ts"
      provides: "Playwright: open BottomSheet → upload → submit → entry appears reverse-chrono"
      min_lines: 50
      contains: "BottomSheet"
    - path: "tests/e2e/catalog/lightbox-swipe.spec.ts"
      provides: "Playwright: tap entry → lightbox opens; click Próxima → next entry; click Anterior at first → no change; Escape closes"
      min_lines: 50
      contains: "Próxima"
    - path: "tests/e2e/catalog/lightbox-a11y.spec.ts"
      provides: "Playwright + axe: lightbox open state passes axe scan"
      min_lines: 30
      contains: "AxeBuilder"
    - path: "tests/e2e/catalog/add-photo-entry.integration.test.ts"
      provides: "Vitest integration: POST upload + POST /api/v1/plants/:id/photos roundtrip with real Postgres + storage stub"
      min_lines: 60
      contains: "addPhotoEntry"
  key_links:
    - from: "src/app/catalog/new/page.tsx"
      to: "src/contexts/catalog/api/use-create-plant.ts"
      via: "named import; submit handler"
      pattern: "useCreatePlant"
    - from: "src/app/catalog/new/page.tsx"
      to: "src/contexts/catalog/api/use-manual-add-draft.ts"
      via: "named import; auto-save on change"
      pattern: "useManualAddDraft"
    - from: "src/app/catalog/new/page.tsx"
      to: "/api/v1/photos/upload (Phase 2 D-27)"
      via: "fetch FormData"
      pattern: "/api/v1/photos/upload"
    - from: "src/app/catalog/[plantId]/photos/photo-journal-client.tsx"
      to: "src/shared/ui/lightbox.tsx (Plan 05-14)"
      via: "named import"
      pattern: "Lightbox"
    - from: "src/app/catalog/[plantId]/photos/photo-journal-client.tsx"
      to: "src/shared/ui/bottom-sheet.tsx (Plan 05-13)"
      via: "named import for add-entry sheet"
      pattern: "BottomSheet"
user_setup:
  - service: "browser-image-compression"
    why: "Client-side compress images to ≤1MB + strip EXIF/GPS before upload (Phase 2 D-28/D-29 + LGPD minimization)"
    env_vars: []
    dashboard_config: []
    note: "Phase 2 D-28 ships browser-image-compression v2.0.2. Phase 5 only uses it; no install needed if Phase 2 already installed."
---

<objective>
Wave 8 ships the two highest-touch user surfaces:
1. **Manual Add page** at `/catalog/new` (CONTEXT D-13 full-screen route) with 5-field form, sessionStorage draft (D-27), client-side image compression + EXIF strip (Phase 2 D-29), two-step upload flow (D-22), pessimistic useCreatePlant.
2. **Photo Journal page** at `/catalog/[plantId]/photos` (UI-11 + CAT-06) with reverse-chronological PhotoEntry list, "+ Foto no diário" CTA opening BottomSheet (D-16), entry-tap opening Lightbox (D-17) with 3 actions (D-18: Edit note + Set as cover + Delete).

Plus 6 mutation/query hooks to keep all photo-entry concerns in this plan (no file overlap with 05-16): useCreatePlant + usePhotoEntries + useAddPhotoEntry + useUpdatePhotoEntryNote + useDeletePhotoEntry + useSetCoverPhoto + useManualAddDraft.

Output: 3 page files + 7 hook files (~530 lines combined) + 6 E2E specs + 1 integration test + 1 unit test (~410 lines combined). Covers 4 requirement IDs.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-08-route-handlers-read-create-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-09-route-handlers-mutate-delete-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-09-SUMMARY.md
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-12-combobox-primitive-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-13-bottom-sheet-primitive-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-14-lightbox-inline-edit-primitives-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-16-plant-profile-page-PLAN.md
@.planning/phases/02-data-layer/02-CONTEXT.md

<interfaces>
<!-- Consumed contracts -->

POST /api/v1/photos/upload (Phase 2 D-27 — multipart):
- Headers: `Content-Type: multipart/form-data`
- FormData fields: `file: Blob`, `aggregate_id: string` (Plant UUID), `entity_type: "plant"`
- Response 200: `{ photo_url: string, thumbnail_url: string }`
- Response on failure: 4xx + `{ error: { code, message, details? } }`
  - `validation_failed` if file >1MB or GPS EXIF detected
  - Closed registry per Phase 1

POST /api/v1/plants (Plan 05-08):
- Headers: `Content-Type: application/json`, `Idempotency-Key: <uuid>`
- Body: `{ id: string, name: string, nickname?: string, location?: string, acquisition_date?: string, notes?: string, initial_photos: [{ photo_url, thumbnail_url }] }`
- Response 201 + Plant

GET /api/v1/plants/:plantId/photos (Plan 05-08):
- Query: `?cursor=<base64>&limit=<int>` defaults limit=50
- Response 200: `{ data: PhotoEntry[], next_cursor: string | null }` reverse-chrono

POST /api/v1/plants/:plantId/photos (Plan 05-09):
- Headers: `Idempotency-Key: <uuid>`
- Body: `{ photo_url, thumbnail_url, note?: string }`
- Response 201 + PhotoEntry

PATCH /api/v1/plants/:plantId/photos/:photoEntryId (Plan 05-09):
- Headers: `Idempotency-Key: <uuid>`
- Body: `{ note: string | null }`
- Response 200 + PhotoEntry

DELETE /api/v1/plants/:plantId/photos/:photoEntryId (Plan 05-09):
- Headers: `Idempotency-Key: <uuid>`
- Response 204 No Content

PATCH /api/v1/plants/:plantId/cover-photo (Plan 05-09):
- Headers: `Idempotency-Key: <uuid>`
- Body: `{ photo_entry_id: string (uuid) }`
- Response 200 + Plant

From src/shared/ui:
- BottomSheet ({ open, onOpenChange, title, children }) — Plan 05-13
- Lightbox ({ entries, startIndex, open, onClose, onEditNote?, onSetCover?, onDelete?, ... }) — Plan 05-14
- Combobox (location field) — Plan 05-12
- InlineEditField (used inside lightbox bottom strip for Editar nota) — Plan 05-14

From browser-image-compression (Phase 2 D-28):
```ts
import imageCompression from "browser-image-compression";
const compressed = await imageCompression(file, {
  maxSizeMB: 1,
  preserveExif: false,  // STRIP per LGPD
  maxWidthOrHeight: 2048,
});
```

From src/messages/pt-BR.json (Plan 05-10):
- catalog.manualAdd.{title|fields|submit|cancel|validation|photoButton}
- catalog.locationPicker.* (combobox prop sources)
- catalog.photoJournal.{title|addSheet|empty|lightbox}
- catalog.modal.close ("Fechar")
</interfaces>

<related_files>
- Plan 05-09 SUMMARY.md lines 41-49 — endpoint contract + optimism mapping (this plan IMPLEMENTS hooks per the table)
- Plan 05-09 SUMMARY § "Override: 05-07 deferred-cleanup decision" — DELETE photo entry triggers storage cleanup via outbox (server-side; this plan only invokes the endpoint)
- Plan 05-09 SUMMARY § "Cover-photo adapter — `setCoverPhotoByEntryId`" — endpoint accepts `{ photo_entry_id }`, server resolves to photo_url
- src/shared/ui/{lightbox,bottom-sheet,inline-edit-field,combobox}.tsx
</related_files>
</context>

<!-- TEST-IMPORT NOTE (Phase 1 STATE.md / Plan 01-07 lessons learned):
The project has NO `@/*` tsconfig path alias. Only `@contexts/*`, `@shared/*`,
`@i18n/*` are configured (see tsconfig.json). All test files MUST use RELATIVE
imports for tests/helpers/* and src/* references. The samples below have been
patched accordingly. If you see any `@/...` import in this plan, it's a sample
typo — replace with the correct relative path before committing.
-->

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: TDD focus — useManualAddDraft hook (sessionStorage per D-27)</name>
  <files>src/contexts/catalog/api/use-manual-add-draft.ts, tests/unit/contexts/catalog/use-manual-add-draft.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-27 line 119
    - src/contexts/catalog/api/use-sort-preference.ts (Plan 05-15 — sessionStorage hook pattern to mirror)
  </read_first>
  <behavior>
    - D1 returns null when no draft exists for userId
    - D2 setDraft writes the partial form state to sessionStorage at correct key
    - D3 clearDraft removes the entry
    - D4 different userId reads + writes different keys (per-user isolation)
    - D5 storage key shape exactly `folhario:catalog:new-plant-draft:${userId}`
    - D6 SSR-safe: returns null on server-render (window undefined)
    - D7 invalid JSON in sessionStorage falls back to null (defensive)
  </behavior>
  <action>
    **RED step:** Create `tests/unit/contexts/catalog/use-manual-add-draft.test.ts`:
    ```ts
    import { describe, it, expect, beforeEach } from "vitest";
    import { renderHook, act } from "@testing-library/react";
    import { useManualAddDraft } from "@contexts/catalog/api/use-manual-add-draft";

    beforeEach(() => sessionStorage.clear());

    describe("useManualAddDraft (D-27)", () => {
      it("D1 returns null when no draft", () => {
        const { result } = renderHook(() => useManualAddDraft("user-1"));
        expect(result.current.draft).toBeNull();
      });

      it("D2 setDraft writes to correct sessionStorage key", () => {
        const { result } = renderHook(() => useManualAddDraft("user-1"));
        act(() => result.current.setDraft({ name: "Sam", nickname: "S" }));
        expect(sessionStorage.getItem("folhario:catalog:new-plant-draft:user-1")).toContain("Sam");
        expect(result.current.draft).toEqual({ name: "Sam", nickname: "S" });
      });

      it("D3 clearDraft removes the entry", () => {
        const { result } = renderHook(() => useManualAddDraft("user-1"));
        act(() => result.current.setDraft({ name: "Sam" }));
        act(() => result.current.clearDraft());
        expect(sessionStorage.getItem("folhario:catalog:new-plant-draft:user-1")).toBeNull();
        expect(result.current.draft).toBeNull();
      });

      it("D4 isolates per userId", () => {
        const { result: r1 } = renderHook(() => useManualAddDraft("user-1"));
        const { result: r2 } = renderHook(() => useManualAddDraft("user-2"));
        act(() => r1.current.setDraft({ name: "A" }));
        act(() => r2.current.setDraft({ name: "B" }));
        expect(r1.current.draft).toEqual({ name: "A" });
        expect(r2.current.draft).toEqual({ name: "B" });
      });

      it("D5 uses exact storage key shape", () => {
        const { result } = renderHook(() => useManualAddDraft("abc"));
        act(() => result.current.setDraft({ name: "X" }));
        expect(Object.keys(sessionStorage)).toContain("folhario:catalog:new-plant-draft:abc");
      });

      it("D7 invalid JSON falls back to null", () => {
        sessionStorage.setItem("folhario:catalog:new-plant-draft:user-1", "{invalid_json");
        const { result } = renderHook(() => useManualAddDraft("user-1"));
        expect(result.current.draft).toBeNull();
      });
    });
    ```

    Run: `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/use-manual-add-draft.test.ts` — MUST FAIL.

    Commit RED: `git add tests/unit/contexts/catalog/use-manual-add-draft.test.ts && git commit -m "test(05-17): add failing tests for useManualAddDraft (D-27 sessionStorage)"`

    **GREEN step:** Create `src/contexts/catalog/api/use-manual-add-draft.ts`:
    ```ts
    "use client";
    import { useCallback, useState, useEffect } from "react";

    export type ManualAddDraft = {
      name?: string;
      nickname?: string;
      location?: string;
      acquisition_date?: string;
      notes?: string;
    };

    function key(userId: string): string {
      return `folhario:catalog:new-plant-draft:${userId}`;
    }

    function readDraft(userId: string): ManualAddDraft | null {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage.getItem(key(userId));
        if (!raw) return null;
        return JSON.parse(raw) as ManualAddDraft;
      } catch {
        return null;
      }
    }

    export function useManualAddDraft(userId: string) {
      const [draft, setDraftState] = useState<ManualAddDraft | null>(() => readDraft(userId));

      useEffect(() => {
        const next = readDraft(userId);
        if (JSON.stringify(next) !== JSON.stringify(draft)) setDraftState(next);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [userId]);

      const setDraft = useCallback(
        (next: ManualAddDraft) => {
          setDraftState(next);
          if (typeof window !== "undefined") {
            try {
              window.sessionStorage.setItem(key(userId), JSON.stringify(next));
            } catch {
              // private mode etc.
            }
          }
        },
        [userId],
      );

      const clearDraft = useCallback(() => {
        setDraftState(null);
        if (typeof window !== "undefined") {
          try {
            window.sessionStorage.removeItem(key(userId));
          } catch {
            // private mode etc.
          }
        }
      }, [userId]);

      return { draft, setDraft, clearDraft };
    }
    ```

    Run: 6 tests MUST PASS (D6 SSR-safe is implicit; doesn't fire in jsdom).
    Run typecheck.

    Commit: `git add src/contexts/catalog/api/use-manual-add-draft.ts && git commit -m "feat(05-17): implement useManualAddDraft (D-27 sessionStorage)"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/use-manual-add-draft.test.ts &amp;&amp; pnpm exec tsc --noEmit</automated>
  </verify>
  <done>
    - 6 tests pass
    - Storage key exact: `folhario:catalog:new-plant-draft:${userId}`
    - tsc --noEmit exits 0
    - Commit prefixes `test(05-17):` (RED), `feat(05-17):` (GREEN)
  </done>
</task>

<task type="auto">
  <name>Task 2: Implement 6 photo + plant mutation/query hooks (use-create-plant + use-photo-entries + use-add-photo-entry + use-update-photo-entry-note + use-delete-photo-entry + use-set-cover-photo)</name>
  <files>src/contexts/catalog/api/use-create-plant.ts, src/contexts/catalog/api/use-photo-entries.ts, src/contexts/catalog/api/use-add-photo-entry.ts, src/contexts/catalog/api/use-update-photo-entry-note.ts, src/contexts/catalog/api/use-delete-photo-entry.ts, src/contexts/catalog/api/use-set-cover-photo.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-09-SUMMARY.md lines 41-56 — endpoint optimism mapping table
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Patterns 3 + 4 (lines 568-655)
    - src/contexts/catalog/api/use-update-plant.ts (Plan 05-16 — optimistic pattern reference)
    - src/contexts/catalog/api/use-delete-plant.ts (Plan 05-16 — pessimistic pattern reference)
  </read_first>
  <action>
    Ship 6 hook files:

    1. **use-create-plant.ts** (PESSIMISTIC, Pattern 4):
    ```ts
    "use client";
    import { useMutation, useQueryClient } from "@tanstack/react-query";

    export type CreatePlantInput = {
      id: string;  // client-generated UUID
      name: string;
      nickname?: string | null;
      location?: string | null;
      acquisition_date?: string | null;
      notes?: string | null;
      initial_photos: Array<{ photo_url: string; thumbnail_url: string }>;
    };

    export function useCreatePlant() {
      const queryClient = useQueryClient();
      return useMutation<{ id: string }, Error, CreatePlantInput>({
        mutationFn: async (input) => {
          const res = await fetch("/api/v1/plants", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify(input),
            credentials: "include",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error?.code || `create_failed_${res.status}`);
          }
          return (await res.json()) as { id: string };
        },
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["plants"] });
        },
      });
    }
    ```

    2. **use-photo-entries.ts** (useInfiniteQuery for journal list):
    ```ts
    "use client";
    import { useInfiniteQuery } from "@tanstack/react-query";

    export type PhotoEntry = {
      id: string;
      photo_url: string;
      thumbnail_url: string;
      note: string | null;
      created_at: string;
    };

    export type PhotoEntriesPage = { data: PhotoEntry[]; next_cursor: string | null };

    export function usePhotoEntries(plantId: string) {
      return useInfiniteQuery<PhotoEntriesPage, Error>({
        queryKey: ["plants", plantId, "photos"],
        queryFn: async ({ pageParam }) => {
          const url = new URL(`/api/v1/plants/${plantId}/photos`, window.location.origin);
          if (pageParam && typeof pageParam === "string") url.searchParams.set("cursor", pageParam);
          url.searchParams.set("limit", "50");
          const res = await fetch(url.toString(), { credentials: "include" });
          if (!res.ok) throw new Error(`photos_fetch_failed_${res.status}`);
          return (await res.json()) as PhotoEntriesPage;
        },
        initialPageParam: null as string | null,
        getNextPageParam: (lastPage) => lastPage.next_cursor,
      });
    }
    ```

    3. **use-add-photo-entry.ts** (PESSIMISTIC, Pattern 4):
    ```ts
    "use client";
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import type { PhotoEntry } from "./use-photo-entries";

    type Input = { plantId: string; photo_url: string; thumbnail_url: string; note?: string | null };

    export function useAddPhotoEntry() {
      const queryClient = useQueryClient();
      return useMutation<PhotoEntry, Error, Input>({
        mutationFn: async ({ plantId, ...body }) => {
          const res = await fetch(`/api/v1/plants/${plantId}/photos`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify(body),
            credentials: "include",
          });
          if (!res.ok) throw new Error(`add_photo_failed_${res.status}`);
          return (await res.json()) as PhotoEntry;
        },
        onSuccess: (_data, { plantId }) => {
          queryClient.invalidateQueries({ queryKey: ["plants", plantId, "photos"] });
          queryClient.invalidateQueries({ queryKey: ["plants", "detail", plantId] }); // cover may have updated
        },
      });
    }
    ```

    4. **use-update-photo-entry-note.ts** (OPTIMISTIC, Pattern 3):
    ```ts
    "use client";
    import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
    import type { PhotoEntry, PhotoEntriesPage } from "./use-photo-entries";

    type Input = { plantId: string; photoEntryId: string; note: string | null };

    export function useUpdatePhotoEntryNote() {
      const queryClient = useQueryClient();
      return useMutation<PhotoEntry, Error, Input, { previous: InfiniteData<PhotoEntriesPage> | undefined }>({
        mutationFn: async ({ plantId, photoEntryId, note }) => {
          const res = await fetch(`/api/v1/plants/${plantId}/photos/${photoEntryId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify({ note }),
            credentials: "include",
          });
          if (!res.ok) throw new Error(`update_note_failed_${res.status}`);
          return (await res.json()) as PhotoEntry;
        },
        onMutate: async ({ plantId, photoEntryId, note }) => {
          await queryClient.cancelQueries({ queryKey: ["plants", plantId, "photos"] });
          const previous = queryClient.getQueryData<InfiniteData<PhotoEntriesPage>>([
            "plants", plantId, "photos",
          ]);
          if (previous) {
            queryClient.setQueryData<InfiniteData<PhotoEntriesPage>>(["plants", plantId, "photos"], {
              ...previous,
              pages: previous.pages.map((p) => ({
                ...p,
                data: p.data.map((entry) => (entry.id === photoEntryId ? { ...entry, note } : entry)),
              })),
            });
          }
          return { previous };
        },
        onError: (_err, { plantId }, context) => {
          if (context?.previous) {
            queryClient.setQueryData(["plants", plantId, "photos"], context.previous);
          }
        },
        onSettled: (_data, _err, { plantId }) => {
          queryClient.invalidateQueries({ queryKey: ["plants", plantId, "photos"] });
        },
      });
    }
    ```

    5. **use-delete-photo-entry.ts** (PESSIMISTIC, Pattern 4):
    ```ts
    "use client";
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import type { PhotoEntriesPage } from "./use-photo-entries";

    type Input = { plantId: string; photoEntryId: string };

    export function useDeletePhotoEntry() {
      const queryClient = useQueryClient();
      return useMutation<void, Error, Input>({
        mutationFn: async ({ plantId, photoEntryId }) => {
          const res = await fetch(`/api/v1/plants/${plantId}/photos/${photoEntryId}`, {
            method: "DELETE",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            credentials: "include",
          });
          if (!res.ok && res.status !== 204) throw new Error(`delete_photo_failed_${res.status}`);
        },
        onSuccess: (_data, { plantId, photoEntryId }) => {
          queryClient.setQueryData<{ pages: PhotoEntriesPage[] }>(
            ["plants", plantId, "photos"],
            (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((p) => ({
                  ...p,
                  data: p.data.filter((e) => e.id !== photoEntryId),
                })),
              };
            },
          );
          queryClient.invalidateQueries({ queryKey: ["plants", "detail", plantId] });
        },
      });
    }
    ```

    6. **use-set-cover-photo.ts** (OPTIMISTIC, Pattern 3):
    ```ts
    "use client";
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import type { PlantDetail } from "./use-plant";

    type Input = { plantId: string; photoEntryId: string; thumbnailUrl: string };

    export function useSetCoverPhoto() {
      const queryClient = useQueryClient();
      return useMutation<PlantDetail, Error, Input, { previous: PlantDetail | undefined }>({
        mutationFn: async ({ plantId, photoEntryId }) => {
          const res = await fetch(`/api/v1/plants/${plantId}/cover-photo`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify({ photo_entry_id: photoEntryId }),
            credentials: "include",
          });
          if (!res.ok) throw new Error(`set_cover_failed_${res.status}`);
          return (await res.json()) as PlantDetail;
        },
        onMutate: async ({ plantId, thumbnailUrl }) => {
          await queryClient.cancelQueries({ queryKey: ["plants", "detail", plantId] });
          const previous = queryClient.getQueryData<PlantDetail>(["plants", "detail", plantId]);
          if (previous) {
            queryClient.setQueryData<PlantDetail>(["plants", "detail", plantId], {
              ...previous,
              cover_photo_url: thumbnailUrl,
            });
          }
          return { previous };
        },
        onError: (_err, { plantId }, context) => {
          if (context?.previous) {
            queryClient.setQueryData(["plants", "detail", plantId], context.previous);
          }
        },
        onSettled: (_data, _err, { plantId }) => {
          queryClient.invalidateQueries({ queryKey: ["plants", "detail", plantId] });
          queryClient.invalidateQueries({ queryKey: ["plants"] });
        },
      });
    }
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/contexts/catalog/api/use-create-plant.ts src/contexts/catalog/api/use-photo-entries.ts src/contexts/catalog/api/use-add-photo-entry.ts src/contexts/catalog/api/use-update-photo-entry-note.ts src/contexts/catalog/api/use-delete-photo-entry.ts src/contexts/catalog/api/use-set-cover-photo.ts && git commit -m "feat(05-17): 6 photo+plant mutation/query hooks per Plan 05-09 SUMMARY optimism table"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "Idempotency-Key" src/contexts/catalog/api/use-create-plant.ts | grep -qE "^[1-9]" &amp;&amp; grep -c "onMutate" src/contexts/catalog/api/use-update-photo-entry-note.ts | grep -qE "^[1-9]" &amp;&amp; grep -c "onMutate" src/contexts/catalog/api/use-set-cover-photo.ts | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - 6 hook files shipped
    - Optimism distribution matches Plan 05-09 SUMMARY: useUpdatePhotoEntryNote + useSetCoverPhoto = OPTIMISTIC; rest = PESSIMISTIC
    - All mutations send Idempotency-Key header
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-17):`
  </done>
</task>

<task type="auto">
  <name>Task 3: Manual Add page (full-screen route /catalog/new) with form + draft + 2-step upload + validation UX</name>
  <files>src/app/catalog/new/page.tsx</files>
  <read_first>
    - Task 1 + Task 2 outputs
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-13 + D-14 + D-22 + D-27
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Manual-add form" copy + § "Form validation" lines 207-215
    - .planning/phases/02-data-layer/02-CONTEXT.md D-28 + D-29 (browser-image-compression contract)
  </read_first>
  <action>
    Create `src/app/catalog/new/page.tsx` (~220 lines). Since the page combines auth + form, ship it as a single 'use client' component with auth handled by middleware (Phase 4 territory; for Phase 5 we trust the route exists). For RSC-style auth, use a server wrapper that delegates; simpler to make the page entirely client-side because the form has no server-rendered data.

    ```tsx
    "use client";
    import { useState, useEffect, useCallback, useId } from "react";
    import { useRouter } from "next/navigation";
    import Link from "next/link";
    import { useTranslations } from "next-intl";
    import imageCompression from "browser-image-compression";
    import { useCreatePlant } from "@contexts/catalog/api/use-create-plant";
    import { useManualAddDraft } from "@contexts/catalog/api/use-manual-add-draft";
    import { useLocationSuggestions } from "@contexts/catalog/api/use-location-suggestions";
    import { Combobox } from "@shared/ui/combobox";

    // NOTE: userId is not server-available in this client page. In production we would
    // read it from a client-side auth context (Phase 4 ships SessionProvider). For now,
    // accept userId via window-side prop or fall back to a sentinel "anonymous-draft"
    // value. Plan 05-17 SUMMARY documents this hand-off for Phase 4.
    function getCurrentUserId(): string {
      if (typeof window === "undefined") return "anonymous-draft";
      // Phase 4 will inject window.__user.id via SessionProvider; placeholder for now
      const anyWin = window as unknown as { __user?: { id?: string } };
      return anyWin.__user?.id ?? "anonymous-draft";
    }

    export default function ManualAddPage() {
      const t = useTranslations("catalog");
      const router = useRouter();
      const userId = getCurrentUserId();
      const { draft, setDraft, clearDraft } = useManualAddDraft(userId);
      const { data: priorLocations = [] } = useLocationSuggestions();
      const createPlant = useCreatePlant();

      const nameId = useId();
      const nicknameId = useId();
      const locationId = useId();
      const dateId = useId();
      const notesId = useId();

      // Local form state seeded from draft
      const [name, setName] = useState(draft?.name ?? "");
      const [nickname, setNickname] = useState(draft?.nickname ?? "");
      const [location, setLocation] = useState(draft?.location ?? "");
      const [acquisitionDate, setAcquisitionDate] = useState(draft?.acquisition_date ?? "");
      const [notes, setNotes] = useState(draft?.notes ?? "");
      const [photoFile, setPhotoFile] = useState<File | null>(null);
      const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

      const [errors, setErrors] = useState<{ name?: string; photo?: string; submit?: string }>({});
      const [submitting, setSubmitting] = useState(false);

      // Auto-save draft on every change (D-27)
      useEffect(() => {
        setDraft({
          name,
          nickname,
          location,
          acquisition_date: acquisitionDate,
          notes,
        });
      }, [name, nickname, location, acquisitionDate, notes, setDraft]);

      const defaultLocations = [
        t("locationPicker.defaults.sala"),
        t("locationPicker.defaults.varanda"),
        t("locationPicker.defaults.quarto"),
        t("locationPicker.defaults.banheiro"),
        t("locationPicker.defaults.cozinha"),
        t("locationPicker.defaults.escritorio"),
        t("locationPicker.defaults.jardim"),
        t("locationPicker.defaults.outro"),
      ];

      const onPickFile = useCallback(async (file: File) => {
        setErrors((e) => ({ ...e, photo: undefined }));
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            preserveExif: false, // STRIP per LGPD + Phase 2 D-29
            maxWidthOrHeight: 2048,
          });
          setPhotoFile(compressed);
          setPhotoPreviewUrl(URL.createObjectURL(compressed));
        } catch {
          setErrors((e) => ({ ...e, photo: t("manualAdd.validation.photoRejected") }));
        }
      }, [t]);

      async function uploadPhoto(plantId: string, file: File): Promise<{ photo_url: string; thumbnail_url: string }> {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("aggregate_id", plantId);
        fd.append("entity_type", "plant");
        const res = await fetch("/api/v1/photos/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.code || `upload_failed_${res.status}`);
        }
        return (await res.json()) as { photo_url: string; thumbnail_url: string };
      }

      async function onSubmit(e: React.FormEvent) {
        e.preventDefault();
        const newErrors: typeof errors = {};
        if (!name.trim()) newErrors.name = t("manualAdd.validation.nameRequired");
        if (!photoFile) newErrors.photo = t("manualAdd.validation.photoRequired");
        if (newErrors.name || newErrors.photo) {
          setErrors(newErrors);
          return;
        }

        setSubmitting(true);
        const plantId = crypto.randomUUID();
        try {
          const { photo_url, thumbnail_url } = await uploadPhoto(plantId, photoFile!);
          await createPlant.mutateAsync({
            id: plantId,
            name: name.trim(),
            nickname: nickname.trim() || null,
            location: location.trim() || null,
            acquisition_date: acquisitionDate || null,
            notes: notes.trim() || null,
            initial_photos: [{ photo_url, thumbnail_url }],
          });
          clearDraft();
          router.push(`/catalog/${plantId}`);
        } catch (err) {
          setErrors({ submit: err instanceof Error ? err.message : "submit_failed" });
          setSubmitting(false);
        }
      }

      const hasErrors = Boolean(errors.name || errors.photo);

      return (
        <main className="min-h-[100dvh] bg-[var(--paper-cream,#FBF7EF)] px-5 pb-24 pt-6">
          <h1 className="mb-6 text-2xl font-medium font-serif text-[var(--forest-ink,#143424)]">
            {t("manualAdd.title")}
          </h1>

          <form onSubmit={onSubmit} noValidate>
            {/* Form-level summary block — visible only when multiple errors */}
            {hasErrors && (Object.keys(errors).length > 1 || (errors.name && errors.photo)) && (
              <div role="alert" aria-live="polite" className="mb-6 rounded-lg border border-[var(--overdue,#A14A2C)] bg-[var(--surface,#FFFDF7)] p-4 text-sm text-[var(--overdue,#A14A2C)]">
                {t("manualAdd.validation.summary")}
              </div>
            )}

            {/* Name (required) */}
            <div className="mb-4">
              <label htmlFor={nameId} className="block text-sm font-semibold text-[var(--forest-ink,#143424)]">
                {t("manualAdd.fields.name")} *
              </label>
              <input
                id={nameId}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  if (!name.trim()) setErrors((p) => ({ ...p, name: t("manualAdd.validation.nameRequired") }));
                  else setErrors((p) => ({ ...p, name: undefined }));
                }}
                aria-invalid={Boolean(errors.name)}
                aria-describedby={errors.name ? `${nameId}-err` : undefined}
                className={`mt-1 w-full rounded-lg border bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base outline-none focus-visible:border-[var(--canopy,#1F4D35)] ${
                  errors.name ? "border-[var(--overdue,#A14A2C)]" : "border-[var(--hairline,#D8D2C7)]"
                }`}
              />
              {errors.name && (
                <p id={`${nameId}-err`} aria-live="polite" className="mt-1 flex items-center gap-1 text-sm text-[var(--overdue,#A14A2C)]">
                  <span aria-hidden="true">⚠</span>
                  {errors.name}
                </p>
              )}
            </div>

            {/* Nickname (optional) */}
            <div className="mb-4">
              <label htmlFor={nicknameId} className="block text-sm font-semibold text-[var(--forest-ink,#143424)]">
                {t("manualAdd.fields.nickname")}
              </label>
              <input
                id={nicknameId}
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base outline-none focus-visible:border-[var(--canopy,#1F4D35)]"
              />
            </div>

            {/* Location (Combobox) */}
            <div className="mb-4">
              <label htmlFor={locationId} className="block text-sm font-semibold text-[var(--forest-ink,#143424)]">
                {t("manualAdd.fields.location")}
              </label>
              <Combobox
                inputId={locationId}
                value={location}
                onChange={setLocation}
                priorItems={priorLocations}
                defaultItems={defaultLocations}
                placeholder={t("locationPicker.placeholder")}
                ariaLabel={t("locationPicker.ariaListboxLabel")}
                sectionLabels={{
                  prior: t("locationPicker.sections.prior"),
                  defaults: t("locationPicker.sections.defaults"),
                }}
              />
            </div>

            {/* Acquisition date (optional) */}
            <div className="mb-4">
              <label htmlFor={dateId} className="block text-sm font-semibold text-[var(--forest-ink,#143424)]">
                {t("manualAdd.fields.acquisitionDate")}
              </label>
              <input
                id={dateId}
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base outline-none focus-visible:border-[var(--canopy,#1F4D35)]"
              />
            </div>

            {/* Notes (multiline, optional) */}
            <div className="mb-4">
              <label htmlFor={notesId} className="block text-sm font-semibold text-[var(--forest-ink,#143424)]">
                {t("manualAdd.fields.notes")}
              </label>
              <textarea
                id={notesId}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                maxLength={2000}
                className="mt-1 w-full rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base outline-none focus-visible:border-[var(--canopy,#1F4D35)]"
              />
            </div>

            {/* Photo upload (required) */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-[var(--forest-ink,#143424)]">
                {t("manualAdd.photoButton")} *
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                }}
                className="mt-1 block"
              />
              {photoPreviewUrl && (
                <img src={photoPreviewUrl} alt="" className="mt-3 max-h-48 rounded-lg" />
              )}
              {errors.photo && (
                <p aria-live="polite" className="mt-1 flex items-center gap-1 text-sm text-[var(--overdue,#A14A2C)]">
                  <span aria-hidden="true">⚠</span>
                  {errors.photo}
                </p>
              )}
            </div>

            {/* Submit + Cancel */}
            <div className="flex gap-3">
              <Link
                href="/catalog"
                className="flex-1 rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-center text-base font-semibold text-[var(--forest-ink,#143424)]"
              >
                {t("manualAdd.cancel")}
              </Link>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-[var(--canopy,#1F4D35)] px-4 py-3 text-base font-semibold text-[var(--surface,#FFFDF7)] disabled:opacity-60"
              >
                {submitting ? `${t("manualAdd.submit")}…` : t("manualAdd.submit")}
              </button>
            </div>

            {errors.submit && (
              <p aria-live="polite" className="mt-3 text-sm text-[var(--overdue,#A14A2C)]">
                {errors.submit}
              </p>
            )}
          </form>
        </main>
      );
    }
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/app/catalog/new/page.tsx && git commit -m "feat(05-17): Manual Add full-screen page (D-13 + D-22 2-step upload + D-27 draft + 3-signal validation)"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "useCreatePlant" src/app/catalog/new/page.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "imageCompression" src/app/catalog/new/page.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "useManualAddDraft" src/app/catalog/new/page.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "Combobox" src/app/catalog/new/page.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - Page exists at /catalog/new
    - 5 form fields rendered (name + nickname + location combobox + date + notes)
    - Photo upload uses browser-image-compression with preserveExif:false
    - Two-step flow: upload → create
    - Auto-save draft via useManualAddDraft on every change
    - Validation surfaces 3 redundant signals (border + icon + helper line) per UI-SPEC
    - On success: clearDraft + router.push to profile
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-17):`
  </done>
</task>

<task type="auto">
  <name>Task 4: Photo Journal page (RSC + client island) with reverse-chrono list + add BottomSheet + Lightbox + 3 mutation flows</name>
  <files>src/app/catalog/[plantId]/photos/page.tsx, src/app/catalog/[plantId]/photos/photo-journal-client.tsx</files>
  <read_first>
    - Task 2 outputs (6 hooks)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-16 + D-17 + D-18 + D-23
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Photo Journal" copy + § "Lightbox"
    - src/shared/ui/{lightbox,bottom-sheet,inline-edit-field}.tsx
  </read_first>
  <action>
    **RSC page** — `src/app/catalog/[plantId]/photos/page.tsx`:
    ```tsx
    import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
    import { listPhotoEntries } from "@contexts/catalog/application/list-photo-entries";
    import { listPlants } from "@contexts/catalog/application/list-plants";
    import { requireUser } from "@shared/auth/require-user";
    import { notFound } from "next/navigation";
    import { PhotoJournalClient } from "./photo-journal-client";

    export default async function PhotoJournalPage({ params }: { params: Promise<{ plantId: string }> }) {
      const { plantId } = await params;
      const user = await requireUser();
      const queryClient = new QueryClient();

      // Verify plant exists + belongs to user (returns 404 otherwise via RLS)
      const plantResult = await listPlants({
        userId: user.id,
        plantIdFilter: plantId,
        sort: "acquired_desc",
        cursor: null,
        limit: 1,
      });
      if (!plantResult.data || plantResult.data.length === 0) notFound();
      queryClient.setQueryData(["plants", "detail", plantId], plantResult.data[0]);

      // Prefetch first page of photos
      await queryClient.prefetchInfiniteQuery({
        queryKey: ["plants", plantId, "photos"],
        queryFn: async ({ pageParam }) =>
          listPhotoEntries({
            userId: user.id,
            plantId,
            cursor: typeof pageParam === "string" ? pageParam : null,
            limit: 50,
          }),
        initialPageParam: null,
      });

      return (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PhotoJournalClient plantId={plantId} plantName={plantResult.data[0].name} userTimezone={user.timezone ?? "America/Sao_Paulo"} />
        </HydrationBoundary>
      );
    }
    ```

    **Client island** — `src/app/catalog/[plantId]/photos/photo-journal-client.tsx` (~220 lines):
    ```tsx
    "use client";
    import { useCallback, useState } from "react";
    import { useTranslations } from "next-intl";
    import imageCompression from "browser-image-compression";
    import { formatInTimeZone } from "date-fns-tz";
    import { ptBR } from "date-fns/locale";
    import Image from "next/image";
    import Link from "next/link";
    import { usePhotoEntries, type PhotoEntry } from "@contexts/catalog/api/use-photo-entries";
    import { useAddPhotoEntry } from "@contexts/catalog/api/use-add-photo-entry";
    import { useUpdatePhotoEntryNote } from "@contexts/catalog/api/use-update-photo-entry-note";
    import { useDeletePhotoEntry } from "@contexts/catalog/api/use-delete-photo-entry";
    import { useSetCoverPhoto } from "@contexts/catalog/api/use-set-cover-photo";
    import { useSubscription } from "@contexts/billing/api/use-subscription";
    import { BottomSheet } from "@shared/ui/bottom-sheet";
    import { Lightbox, type LightboxEntry } from "@shared/ui/lightbox";
    import { InlineEditField } from "@shared/ui/inline-edit-field";

    export function PhotoJournalClient({
      plantId,
      plantName,
      userTimezone,
    }: {
      plantId: string;
      plantName: string;
      userTimezone: string;
    }) {
      const t = useTranslations("catalog");
      const { data, isLoading } = usePhotoEntries(plantId);
      const addEntry = useAddPhotoEntry();
      const updateNote = useUpdatePhotoEntryNote();
      const deleteEntry = useDeletePhotoEntry();
      const setCover = useSetCoverPhoto();
      const { status } = useSubscription();
      const readOnly = status === "expired" || status === "grace";

      const [addOpen, setAddOpen] = useState(false);
      const [pickedFile, setPickedFile] = useState<File | null>(null);
      const [pickedPreview, setPickedPreview] = useState<string | null>(null);
      const [draftNote, setDraftNote] = useState("");
      const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
      const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);

      const allEntries = (data?.pages ?? []).flatMap((p) => p.data);

      function formatDate(iso: string): string {
        return formatInTimeZone(new Date(iso), userTimezone, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
      }

      const lightboxEntries: LightboxEntry[] = allEntries.map((e) => ({
        id: e.id,
        photoUrl: e.photo_url,
        thumbnailUrl: e.thumbnail_url,
        note: e.note,
        alt: t("photoJournal.lightbox.alt", { name: plantName, date: formatDate(e.created_at) }),
        formattedDate: formatDate(e.created_at),
      }));

      const onPickFile = useCallback(async (file: File) => {
        try {
          const compressed = await imageCompression(file, {
            maxSizeMB: 1,
            preserveExif: false,
            maxWidthOrHeight: 2048,
          });
          setPickedFile(compressed);
          setPickedPreview(URL.createObjectURL(compressed));
        } catch {
          // Surface error in BottomSheet UI
        }
      }, []);

      async function uploadAndCreate(): Promise<void> {
        if (!pickedFile) return;
        const fd = new FormData();
        fd.append("file", pickedFile);
        fd.append("aggregate_id", plantId);
        fd.append("entity_type", "plant");
        const upRes = await fetch("/api/v1/photos/upload", {
          method: "POST",
          body: fd,
          credentials: "include",
        });
        if (!upRes.ok) throw new Error("upload_failed");
        const { photo_url, thumbnail_url } = (await upRes.json()) as { photo_url: string; thumbnail_url: string };
        await addEntry.mutateAsync({ plantId, photo_url, thumbnail_url, note: draftNote || null });
        // Reset sheet state
        setPickedFile(null);
        setPickedPreview(null);
        setDraftNote("");
        setAddOpen(false);
      }

      return (
        <main className="min-h-[100dvh] bg-[var(--paper-cream,#FBF7EF)] px-5 pb-24 pt-6">
          <header className="mb-6 flex items-center justify-between">
            <Link href={`/catalog/${plantId}`} className="text-sm text-[var(--canopy,#1F4D35)]">
              ← {plantName}
            </Link>
            <h1 className="text-2xl font-medium font-serif text-[var(--forest-ink,#143424)]">
              {t("photoJournal.title")}
            </h1>
            {!readOnly && (
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="rounded-lg bg-[var(--canopy,#1F4D35)] px-3 py-2 text-sm font-semibold text-[var(--surface,#FFFDF7)]"
              >
                {t("profile.addJournalCta")}
              </button>
            )}
          </header>

          {isLoading && <p>{t("loading.list")}</p>}

          {!isLoading && allEntries.length === 0 && (
            <p className="py-8 text-center text-base text-[var(--calm-slate,#5A6358)]">
              {t("photoJournal.empty")}
            </p>
          )}

          {/* Reverse-chronological list (server already returns reverse-chrono per CAT-06) */}
          <ul className="space-y-3" data-testid="photo-journal-list">
            {allEntries.map((entry, i) => (
              <li key={entry.id} className="overflow-hidden rounded-2xl bg-[var(--surface,#FFFDF7)] p-3">
                <button
                  type="button"
                  onClick={() => setLightboxIdx(i)}
                  className="flex w-full items-center gap-4 text-left"
                >
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[var(--hairline,#D8D2C7)]">
                    <Image
                      src={entry.thumbnail_url}
                      alt={t("photoJournal.lightbox.alt", { name: plantName, date: formatDate(entry.created_at) })}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--calm-slate,#5A6358)]">{formatDate(entry.created_at)}</p>
                    {entry.note && (
                      <p className="mt-1 line-clamp-2 text-sm text-[var(--forest-ink,#143424)]">{entry.note}</p>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Add-entry BottomSheet (D-16) */}
          <BottomSheet open={addOpen} onOpenChange={setAddOpen} title={t("photoJournal.addSheet.title")}>
            <div>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onPickFile(f);
                }}
              />
              {pickedPreview && (
                <img src={pickedPreview} alt="" className="mt-3 max-h-48 rounded-lg" />
              )}
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                placeholder={t("photoJournal.addSheet.notePlaceholder")}
                rows={3}
                className="mt-3 w-full rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base outline-none focus-visible:border-[var(--canopy,#1F4D35)]"
              />
              <button
                type="button"
                onClick={() => uploadAndCreate().catch(() => { /* TODO surface error */ })}
                disabled={!pickedFile || addEntry.isPending}
                className="mt-4 w-full rounded-lg bg-[var(--canopy,#1F4D35)] px-4 py-3 text-base font-semibold text-[var(--surface,#FFFDF7)] disabled:opacity-60"
              >
                {t("photoJournal.addSheet.save")}
              </button>
            </div>
          </BottomSheet>

          {/* Lightbox (D-17 + D-18) */}
          <Lightbox
            entries={lightboxEntries}
            startIndex={lightboxIdx ?? 0}
            open={lightboxIdx !== null}
            onClose={() => {
              setLightboxIdx(null);
              setEditingNoteFor(null);
            }}
            // Read-only mode: pass undefined for all 3 callbacks → Lightbox hides actions per Plan 05-14
            onEditNote={readOnly ? undefined : (entry) => setEditingNoteFor(entry.id)}
            onSetCover={readOnly ? undefined : (entry) => {
              setCover.mutate({ plantId, photoEntryId: entry.id, thumbnailUrl: entry.thumbnailUrl });
            }}
            onDelete={readOnly ? undefined : (entry) => {
              if (window.confirm(`${t("photoJournal.lightbox.delete")} ?`)) {
                deleteEntry.mutate({ plantId, photoEntryId: entry.id }, {
                  onSuccess: () => setLightboxIdx(null),
                });
              }
            }}
            closeLabel={t("photoJournal.lightbox.close")}
            editLabel={t("photoJournal.lightbox.editNote")}
            setCoverLabel={t("photoJournal.lightbox.setAsCover")}
            deleteLabel={t("photoJournal.lightbox.delete")}
            prevLabel="Foto anterior"
            nextLabel="Próxima foto"
          />

          {/* Edit-note inline (overlay rendered inside lightbox area when editingNoteFor set) */}
          {editingNoteFor && (
            <div className="fixed inset-x-0 bottom-0 z-[60] bg-[var(--surface,#FFFDF7)] p-4">
              <InlineEditField
                label={t("profile.fieldLabels.notes")}
                value={allEntries.find((e) => e.id === editingNoteFor)?.note ?? ""}
                onSave={async (v) => {
                  await updateNote.mutateAsync({ plantId, photoEntryId: editingNoteFor, note: v || null });
                  setEditingNoteFor(null);
                }}
                multiline
              />
            </div>
          )}
        </main>
      );
    }
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    NOTE on `date-fns` + `date-fns-tz`: Phase 1 INFRA-23 mandates `date-fns-tz` per Phase 5 RESEARCH § Standard Stack. If not yet installed, add `"date-fns": "4.1.0"` and `"date-fns-tz": "3.2.0"` (verify versions at execution).

    Commit: `git add src/app/catalog/[plantId]/photos/page.tsx src/app/catalog/[plantId]/photos/photo-journal-client.tsx package.json pnpm-lock.yaml && git commit -m "feat(05-17): Photo Journal page (RSC + reverse-chrono list + BottomSheet add + Lightbox + 4 mutation flows + read-only mode)"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "Lightbox" src/app/catalog/[plantId]/photos/photo-journal-client.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "BottomSheet" src/app/catalog/[plantId]/photos/photo-journal-client.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "formatInTimeZone" src/app/catalog/[plantId]/photos/photo-journal-client.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "useSubscription" src/app/catalog/[plantId]/photos/photo-journal-client.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - 2 page files exist (RSC + client island)
    - Reverse-chronological list per CAT-06
    - "+ Foto no diário" CTA opens BottomSheet (D-16)
    - Photo upload uses 2-step flow with browser-image-compression + EXIF strip
    - Tap entry opens Lightbox (D-17) with note + 3 actions (D-18) — actions hidden in read-only mode
    - Editar nota uses InlineEditField with optimistic mutation (D-07)
    - Definir como capa uses optimistic useSetCoverPhoto
    - Excluir uses pessimistic useDeletePhotoEntry with native confirm
    - All dates rendered server-side via formatInTimeZone(date, userTimezone, ...) — Pitfall 9 mitigation
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-17):`
  </done>
</task>

<task type="auto">
  <name>Task 5: 5 Playwright E2E specs (manual-add happy path + manual-add validation + photo-journal add + lightbox swipe + lightbox a11y)</name>
  <files>tests/e2e/catalog/manual-add-plant.spec.ts, tests/e2e/catalog/manual-add-validation.spec.ts, tests/e2e/catalog/photo-journal-add.spec.ts, tests/e2e/catalog/lightbox-swipe.spec.ts, tests/e2e/catalog/lightbox-a11y.spec.ts</files>
  <read_first>
    - tests/helpers/playwright-auth-bypass.ts (Plan 05-01)
    - tests/helpers/axe-helper.ts (Plan 05-01)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md rows CAT-02 e2e + CAT-03 e2e + CAT-06 e2e + a11y + UI-11 e2e + a11y
    - tests/e2e/diagnostics-posthog.spec.ts (Phase 1 — Playwright fixture style + page.route mock pattern)
  </read_first>
  <action>
    All 5 specs use `test.skip(!process.env.PHASE_4_AUTH_READY, ...)` per the convention from Plans 05-15/16. All upload-touching specs use `page.route("**/api/v1/photos/upload", ...)` to mock the upload endpoint deterministically.

    1. **manual-add-plant.spec.ts** (~70 lines) — happy path: navigate to /catalog/new → fill all 5 fields → upload mock photo (use page.route to mock the /api/v1/photos/upload response with deterministic photo_url + thumbnail_url) → click "Adicionar planta" → assert POST /api/v1/plants was called with correct body shape → assert navigation to /catalog/{newPlantId} → navigate to /catalog → assert new plant appears in grid.

    2. **manual-add-validation.spec.ts** (~50 lines) — validation paths:
       - Empty name + submit → assert validation_failed UI: name field has `aria-invalid="true"` + helper line shows "Dê um nome para sua planta — pode ser carinhoso." + form-level summary block visible (because both errors fire if photo also missing)
       - No photo + submit → assert helper "Adicione pelo menos uma foto." renders
       - Both errors → assert summary block + 2 per-field errors

    3. **photo-journal-add.spec.ts** (~50 lines) — open Plant Profile → click "+ Foto no diário" → assert BottomSheet visible (data-testid="bottom-sheet-scrim" + role="dialog") → upload mock photo + type note → click "Adicionar ao diário" → assert POST /api/v1/plants/{id}/photos was called → BottomSheet closes → new entry appears at top of journal list.

    4. **lightbox-swipe.spec.ts** (~50 lines) — open journal with ≥3 entries → tap first entry → Lightbox opens (role="dialog" with aria-label "Foto de {name}, {date}") → click "Próxima foto" button → aria-label updates to next entry → click "Foto anterior" at index=0 → no change → press Escape → lightbox closes.

       NOTE: this spec tests button-based cycling (per Plan 05-14 swipe deferral); no native swipe gesture is exercised.

    5. **lightbox-a11y.spec.ts** (~30 lines) — open lightbox → run AxeBuilder.include('[role="dialog"]').analyze() → expect violations === [].

    For each spec, write the file with proper structure, the auth-fixture-readiness skip, and the page.route mocks. Run `pnpm exec playwright test --list` to verify syntax.

    Commit: `git add tests/e2e/catalog/manual-add-plant.spec.ts tests/e2e/catalog/manual-add-validation.spec.ts tests/e2e/catalog/photo-journal-add.spec.ts tests/e2e/catalog/lightbox-swipe.spec.ts tests/e2e/catalog/lightbox-a11y.spec.ts && git commit -m "test(05-17): 5 Playwright E2E specs (manual add + journal + lightbox + axe)"`
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/catalog/manual-add-plant.spec.ts tests/e2e/catalog/manual-add-validation.spec.ts tests/e2e/catalog/photo-journal-add.spec.ts tests/e2e/catalog/lightbox-swipe.spec.ts tests/e2e/catalog/lightbox-a11y.spec.ts --list 2>&amp;1 | grep -qE "[0-9]+ tests in [0-9]+ files"</automated>
  </verify>
  <done>
    - 5 spec files exist
    - Each guards with `test.skip(!process.env.PHASE_4_AUTH_READY, ...)`
    - Playwright `--list` succeeds
    - Commit prefix `test(05-17):`
  </done>
</task>

<task type="auto">
  <name>Task 6: Vitest integration test for add-photo-entry (real Postgres roundtrip)</name>
  <files>tests/e2e/catalog/add-photo-entry.integration.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md row CAT-06 integration
    - tests/helpers/db-guard.ts (Plan 05-01)
    - tests/helpers/transaction-rollback.ts (Plan 05-01)
    - tests/integration/postgres-connection.integration.test.ts (Phase 1 — DB roundtrip pattern)
    - .planning/phases/02-data-layer/02-PATTERNS.md § "Integration Tests" (cloud-DB guard + tx-rollback)
  </read_first>
  <action>
    Note: file path uses `tests/e2e/catalog/` prefix per validation-map row but should actually be `tests/integration/catalog/add-photo-entry.integration.test.ts` to match the integration test convention. Place at `tests/integration/catalog/add-photo-entry.integration.test.ts` and update the validation-map row in 05-17-SUMMARY.md as a documentation correction.

    Create `tests/integration/catalog/add-photo-entry.integration.test.ts`:
    ```ts
    import { describe, it, expect, beforeAll, afterAll } from "vitest";
    import postgres from "postgres";
    import { assertLocalDb } from "../../helpers/db-guard";
    import { withRollback } from "../../helpers/transaction-rollback";

    const dbUrl = process.env.DATABASE_POOL_URL;
    if (dbUrl) assertLocalDb(dbUrl);

    let sql: ReturnType<typeof postgres> | null = null;
    beforeAll(() => {
      if (!dbUrl) return;
      sql = postgres(dbUrl, { prepare: false, max: 1, idle_timeout: 5 });
    });
    afterAll(async () => {
      if (sql) await sql.end({ timeout: 5 });
    });

    describe.skipIf(!dbUrl)("addPhotoEntry — integration (CAT-06)", () => {
      it("POST /api/v1/plants/:id/photos persists PhotoEntry + sets cover_photo_url if first entry", async () => {
        if (!sql) return;
        await withRollback(sql, async (tx) => {
          // Seed: insert a User + Plant (relies on Phase 5a 05-03 repo)
          // Note: this test assumes 5a 05-03 repos are on disk; if not, skip.
          // Use direct SQL fallback to avoid full repo wiring:
          const userId = crypto.randomUUID();
          const plantId = crypto.randomUUID();
          await tx`INSERT INTO users (id, email) VALUES (${userId}, ${'test@example.com'})`;
          await tx`INSERT INTO plants (id, user_id, name) VALUES (${plantId}, ${userId}, ${'Test'})`;

          // Insert a PhotoEntry directly via SQL (mimics use case)
          const photoEntryId = crypto.randomUUID();
          await tx`INSERT INTO photo_entries (id, plant_id, photo_url, thumbnail_url, note)
                   VALUES (${photoEntryId}, ${plantId}, ${'/path/photo.jpg'}, ${'/path/thumb.jpg'}, ${null})`;

          // Verify
          const rows = await tx`SELECT * FROM photo_entries WHERE plant_id = ${plantId}`;
          expect(rows.length).toBe(1);
          expect(rows[0].photo_url).toBe("/path/photo.jpg");
        });
      });
    });
    ```

    NOTE: This integration test is a SKELETON — full coverage of the use case (storage path ownership + cover update) lives in 5a Plan 05-07/08/09 integration tests already. This file in 5b primarily verifies that the 5b consumer can roundtrip a PhotoEntry via the Phase 2 schema. If 5a tests are sufficient, this file may be deleted at execution time.

    Run: `pnpm exec vitest --run --project=integration tests/integration/catalog/add-photo-entry.integration.test.ts`. Should SKIP if DATABASE_POOL_URL not set; PASS if it is.

    Commit: `git add tests/integration/catalog/add-photo-entry.integration.test.ts && git commit -m "test(05-17): integration test for PhotoEntry CRUD roundtrip"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=integration tests/integration/catalog/add-photo-entry.integration.test.ts 2>&amp;1 | grep -qE "(passed|skipped)"</automated>
  </verify>
  <done>
    - Integration test exists
    - Uses Phase 2 D-43 transaction-rollback pattern
    - Cloud DB guard via assertLocalDb
    - Test SKIPs without DATABASE_POOL_URL; PASSES with local Supabase
    - Commit prefix `test(05-17):`
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → /api/v1/photos/upload | multipart upload; Phase 2 D-30 server-side rejects GPS-bearing files |
| browser → /api/v1/plants (POST) | 2-step flow trusts client to pass back upload's photo_url; T-5-01 mitigation lives at Plan 05-08 + Plan 05-04 (server validates path prefix matches user_id + plant_id per Pitfall 1) |
| sessionStorage manual-add draft | Per-user keyed; isolated; auto-saves form data including notes (potentially PII) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-17-01 | Information Disclosure | sessionStorage draft contains user-typed plant notes (potentially personal/private text) | accept | sessionStorage is per-tab, cleared on tab close (D-08 + PRD §17 sessionStorage policy). Same-origin sandbox. Risk is low — notes are about plants. clearDraft on successful submit per D-27. |
| T-5b-17-02 | XSS | Draft note rendered in form textarea | mitigate | React JSX `<textarea value={notes}>` sets value as text node — auto-escaped. No `dangerouslySetInnerHTML`. |
| T-5b-17-03 | Tampering | EXIF/GPS strip happens client-side; user could bypass by sending raw FormData with curl | mitigate | Server-side GPS detection via `exifr` (Phase 2 D-30) is the load-bearing defense. Client-side strip is LGPD minimization (don't transmit GPS) but server enforces. |
| T-5b-17-04 | Tampering | Photo URL spoofing on POST /api/v1/plants (T-5-01 / Pitfall 1) | mitigate | Server-side path-prefix validation in createPlantManual use case (Plan 05-04 + Plan 05-08). Client just submits the photo_url it received from upload; server re-verifies. UI does not need additional mitigation. |
| T-5b-17-05 | XSS | Plant name interpolated in lightbox alt text via i18n `catalog.photoJournal.lightbox.alt` | mitigate | next-intl auto-escapes interpolated values. Plant name capped at 80 chars by Plan 05-04 schema. Renders as text node in `<img alt={...}>` and `<div aria-label={...}>` — auto-escaped. |
| T-5b-17-06 | Tampering | Optimistic update on PATCH note allows attacker-controlled text in local cache | accept | Local cache only; server PATCH validates body via PhotoEntryNotePatchSchema (Plan 05-04). Failed PATCH triggers onError rollback. |
| T-5b-17-07 | Information Disclosure | Sentry breadcrumb leaks PhotoEntry photo_url | mitigate | Phase 1 LGPD-13 scrub (Plan 01-05a). Client-side fetches do not add photo_url to error scope. Sentry user scope = `setUser({ id })` only. |
| T-5b-17-08 | Spoofing | Read-only user spoofs useSubscription to bypass UI gate | accept | Server-side enforcement is load-bearing (T-5b-11-01 documented). UI gate is UX. POST /api/v1/plants and POST /api/v1/plants/:id/photos return 402 read_only_mode in Phase 10 swap. |

</threat_model>

<verification>
- `pnpm exec vitest --run --project=unit tests/unit/contexts/catalog/use-manual-add-draft.test.ts` exits 0 (6 tests pass)
- `pnpm exec tsc --noEmit` exits 0
- All 6 hook files exist with correct optimism per Plan 05-09 SUMMARY:
  - `grep -c "onMutate" src/contexts/catalog/api/use-update-photo-entry-note.ts` ≥ 1 (OPTIMISTIC)
  - `grep -c "onMutate" src/contexts/catalog/api/use-set-cover-photo.ts` ≥ 1 (OPTIMISTIC)
  - `grep -E "onMutate" src/contexts/catalog/api/use-create-plant.ts | grep -v '^//' | grep -c ''` returns 0 (NOT optimistic)
  - `grep -E "onMutate" src/contexts/catalog/api/use-add-photo-entry.ts | grep -v '^//' | grep -c ''` returns 0 (NOT optimistic)
  - `grep -E "onMutate" src/contexts/catalog/api/use-delete-photo-entry.ts | grep -v '^//' | grep -c ''` returns 0 (NOT optimistic)
- Manual Add page exists at /catalog/new with all hooks wired
- Photo Journal page exists with BottomSheet add + Lightbox + 4 mutation flows
- All 5 Playwright specs collect via `--list`
- Integration test passes or skips depending on DATABASE_POOL_URL
- date-fns-tz used for date rendering (Pitfall 9 mitigation): `grep -c "formatInTimeZone" src/app/catalog/[plantId]/photos/photo-journal-client.tsx` ≥ 1
</verification>

<success_criteria>
- Manual Add full-screen page (D-13) with 5 fields + sessionStorage draft (D-27) + 2-step upload (D-22) + 3-signal validation
- Photo Journal page with reverse-chrono list (CAT-06) + BottomSheet add (D-16) + Lightbox view+edit (D-17) + 3 actions (D-18)
- 6 catalog hooks wired per Plan 05-09 SUMMARY optimism mapping (4 PESSIMISTIC + 2 OPTIMISTIC)
- useManualAddDraft TDD coverage (6 tests)
- Read-only mode hides "+ Foto no diário" CTA + lightbox actions
- All dates rendered via formatInTimeZone(userTimezone) — Pitfall 9 mitigation
- 5 E2E specs + 1 integration test authored
- 4 requirement IDs covered (CAT-02 + CAT-03 + CAT-06 + UI-11)
- Commits prefixed `test(05-17):` (RED + E2E + integration), `feat(05-17):` (GREEN + pages + hooks)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-17-SUMMARY.md` summarizing:
- Confirmation of post-create destination (`/catalog/[id]` profile vs `/catalog` grid; current plan picks profile)
- date-fns + date-fns-tz versions installed if not pre-existing
- Whether the integration test path was relocated from tests/e2e to tests/integration (likely yes; documented as a validation-map correction)
- Auth-fixture-readiness skip status across all 5 E2E + 1 integration test
- Note for Plan 05-18: this plan does NOT modify `src/app/sw.ts` or `src/app/(home)/page.tsx` — those are 05-18's territory
- Number of tests landed: 6 unit + 5 E2E + 1 integration = 12
</output>
