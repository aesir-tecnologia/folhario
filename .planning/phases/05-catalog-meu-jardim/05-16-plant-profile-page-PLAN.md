---
phase: 05-catalog-meu-jardim
plan: 16
type: execute
wave: 7
depends_on:
  - 05-08    # GET /api/v1/plants/:plantId + GET /api/v1/plants/:plantId/photos contracts
  - 05-09    # PATCH /api/v1/plants/:plantId + DELETE /api/v1/plants/:plantId contracts
  - 05-10    # ReactQueryProvider + pt-BR.json
  - 05-11    # useSubscription stub (read-only-mode hide of edit affordances + delete overflow)
  - 05-12    # Combobox primitive (location inline-edit)
  - 05-13    # BottomSheet primitive (delete-confirm modal)
  - 05-14    # InlineEditField primitive (all 5 inline-editable fields)
files_modified:
  - src/app/catalog/[plantId]/page.tsx
  - src/app/catalog/[plantId]/plant-profile-client.tsx
  - src/contexts/catalog/api/use-plant.ts
  - src/contexts/catalog/api/use-update-plant.ts
  - src/contexts/catalog/api/use-delete-plant.ts
  - src/contexts/catalog/api/use-location-suggestions.ts
  - tests/e2e/catalog/plant-profile-render.spec.ts
  - tests/e2e/catalog/inline-edit-per-field.spec.ts
  - tests/e2e/catalog/inline-edit-announcements.spec.ts
  - tests/e2e/catalog/delete-plant-flow.spec.ts
  - tests/e2e/catalog/location-picker-keyboard.spec.ts
  - tests/e2e/catalog/location-picker-a11y.spec.ts
  - tests/e2e/catalog/read-only-mode.spec.ts
autonomous: true
requirements:
  - CAT-04   # UI render of single-scroll Plant Profile + conditional sections
  - CAT-05   # UI consumer of location-suggestions endpoint via combobox
  - CAT-09   # UI of destructive confirm modal (server-side already in 5a 05-09)
  - UI-08    # Plant profile inline-edit pattern + delete overflow
decisions:
  rsc_prefetch_uses_use_case_directly: |
    Same pattern as Plan 05-15: RSC calls `listPlants({ userId, plantIdFilter:
    plantId, includeIdentificationCount: true, sortKey: 'created_desc',
    cursor: null, limit: 1 })` server-side per Plan 05-08 frontmatter
    `must_haves.truths` line 41 contract. This eliminates the duplicate
    HTTP roundtrip and ensures the same RLS-protected use case fires for
    both SSR and the API endpoint.
  identification_count_drives_id_history_visibility: |
    Per CONTEXT D-26 + Plan 05-08 `decisions.identification_count_query_param`:
    GET /api/v1/plants/:plantId includes identification_count by default for
    this profile detail endpoint. The Plant Profile renders the ID-history
    link section ONLY when identification_count > 0. Zero placeholder UI
    when count = 0 (per D-26 verbatim "ID-history link is hidden when there
    are no Identifications"). Phase 6 starts creating Identification rows;
    the link appears automatically.
  inline_edit_field_validation_rules: |
    name: required, min 1, max 80 (Phase 5a 05-04 PlantPatchSchema);
      pt-BR validation copy: catalog.profile.validation already covers
      future-date; name validation is "Nome é obrigatório" (add to i18n if
      missing — Plan 05-10 covers it via catalog.manualAdd.validation.nameRequired
      which is reused here)
    nickname: optional, max 40 (capped by server schema; client soft-cap at 40)
    location: optional, max 40 (capped by server schema; client soft-cap)
    acquisition_date: optional ISO date; client validates not-in-future
      (catalog.profile.validation.futureDateNotAllowed key from Plan 05-10)
    notes: optional, max 2000 (multiline=true); client soft-cap with character counter
  optimistic_inline_edit_per_d_07: |
    useUpdatePlant uses Pattern 3 (optimistic) per CONTEXT D-07 hybrid:
    inline edits are optimistic. onMutate snapshots prior cache; onError
    rolls back; onSettled invalidates. Per RESEARCH Pattern 3 lines 568-613.
  pessimistic_delete_per_d_07: |
    useDeletePlant uses Pattern 4 (pessimistic) per CONTEXT D-07 +
    RESEARCH Pattern 4 lines 622-655. Button-loading state during request;
    on success, removes plant from all list pages via setQueriesData +
    removeQueries.
  location_suggestions_endpoint_url: |
    Plan 05-08 ships GET /api/v1/plants but does not explicitly ship
    /api/v1/locations or /api/v1/plants/locations endpoint for the
    distinctByUser query. Per 05-PATTERNS.md § "Repositories" line 78
    (Phase 5 owns location-suggestions repo) and 05-RESEARCH.md
    Architectural Map row "Location picker" — the location-suggestions
    query lives at the use-case layer (5a 05-07) but no dedicated route
    handler was planned in 5a. Plan 05-16 ships use-location-suggestions
    hook that calls a NEW lightweight endpoint at
    /api/v1/plants/locations (GET, returns string[]).
    The route handler creation is OUT OF SCOPE for this plan (UI plan);
    add as a contingent edit OR defer to a 5a follow-up. Document the
    chosen path in 05-16-SUMMARY.md.

    PROVISIONAL APPROACH (executor decides at execution time):
    Option A: Create the route handler `src/app/api/v1/plants/locations/route.ts`
      in this plan as a contingent edit (~30 lines, calls the
      location-suggestions repo from Plan 05-03).
    Option B: Embed the distinct locations in the GET /api/v1/plants/:plantId
      response payload via a `locations_used: string[]` field — requires
      amending Plan 05-08's payload shape.
    Option C: Defer location combobox prior-items to Phase 6+; ship with
      defaults only (degraded but functional CAT-05 — does NOT meet the
      "shows user's prior locations" verbatim requirement).
    Recommended: Option A (smallest scope, properly RLS-scoped, parallels
    other GET handlers).
  delete_confirm_uses_bottom_sheet: |
    Per CONTEXT D-19 + UI-SPEC § "Modal sheet" — delete confirmation is
    a §17 destructive modal (which IS a BottomSheet on mobile). Reuses
    BottomSheet primitive from Plan 05-13. Title interpolates plant.name
    via i18n key `catalog.delete.modal.title` ({name} placeholder).
must_haves:
  truths:
    - "src/app/catalog/[plantId]/page.tsx is RSC; prefetches via listPlants(plantIdFilter, includeIdentificationCount=true)"
    - "PlantProfileClient renders single-scroll layout (D-10): cover photo (4:5 full-bleed) → details (5 inline-editable fields via InlineEditField from 05-14) → care-card slot (HIDDEN — Phase 7 fills) → reminders stub ('Nenhum lembrete ativo.') → photo-journal preview (link to /catalog/[plantId]/photos) → ID-history link (CONDITIONAL on identification_count > 0 per D-26) → delete overflow"
    - "Inline edit name uses InlineEditField with validate(v) returning 'Nome é obrigatório' if empty"
    - "Inline edit acquisition_date validates not-in-future via catalog.profile.validation.futureDateNotAllowed"
    - "Inline edit location uses Combobox primitive (Plan 05-12) with priorItems from useLocationSuggestions + 8 i18n defaults"
    - "useUpdatePlant is OPTIMISTIC (Pattern 3) — onMutate snapshot + onError rollback + onSettled invalidate"
    - "useDeletePlant is PESSIMISTIC (Pattern 4) — button-loading state; on success setQueriesData removes plant + removeQueries for detail/photos"
    - "Delete overflow opens BottomSheet (Plan 05-13) with delete-confirm content: title 'Excluir {name}?' + body 'Isso apagará as fotos e lembretes desta planta. A ação não pode ser desfeita.' + Cancelar (primary in layout) + Excluir (destructive Urgent Poppy color)"
    - "On delete success: navigate to /catalog (router.push) — user returns to grid which immediately reflects deletion via TQ cache update"
    - "All inline-edit pencil affordances HIDDEN when useSubscription().status is 'expired' or 'grace' (D-24 + UI-SPEC table line 339)"
    - "Delete overflow HIDDEN in read-only mode (UI-SPEC table line 340)"
    - "ID-history link section HIDDEN when identification_count === 0 (D-26)"
    - "Care-card slot is HIDDEN (Phase 7 placeholder); reminders section shows static 'Nenhum lembrete ativo.' stub (Phase 8 placeholder)"
    - "Successful inline-edit save announces 'Atualizado' via aria-live='polite'"
  artifacts:
    - path: "src/app/catalog/[plantId]/page.tsx"
      provides: "RSC plant detail page with prefetch + HydrationBoundary"
      min_lines: 40
      contains: "HydrationBoundary"
    - path: "src/app/catalog/[plantId]/plant-profile-client.tsx"
      provides: "Single-scroll client island with all 5 inline edits + delete-confirm BottomSheet + photo-journal preview link + conditional ID-history + read-only-mode gating"
      min_lines: 220
      contains: "InlineEditField"
    - path: "src/contexts/catalog/api/use-plant.ts"
      provides: "useQuery hook for /api/v1/plants/:plantId — queryKey ['plants', 'detail', plantId]"
      min_lines: 25
      contains: "useQuery"
    - path: "src/contexts/catalog/api/use-update-plant.ts"
      provides: "useMutation OPTIMISTIC for PATCH /api/v1/plants/:plantId per Pattern 3"
      min_lines: 50
      contains: "onMutate"
    - path: "src/contexts/catalog/api/use-delete-plant.ts"
      provides: "useMutation PESSIMISTIC for DELETE /api/v1/plants/:plantId per Pattern 4"
      min_lines: 35
      contains: "useMutation"
    - path: "src/contexts/catalog/api/use-location-suggestions.ts"
      provides: "useQuery hook for GET /api/v1/plants/locations — returns string[] for combobox priorItems"
      min_lines: 25
      contains: "useQuery"
    - path: "tests/e2e/catalog/plant-profile-render.spec.ts"
      provides: "Playwright: profile renders all sections in correct order; care-card hidden; reminders stub visible; ID-history conditional"
      min_lines: 60
      contains: "Sobre"
    - path: "tests/e2e/catalog/inline-edit-per-field.spec.ts"
      provides: "Playwright: each of 5 fields independently editable; blur saves; Escape reverts; persistence verified by reload"
      min_lines: 80
      contains: "InlineEditField"
    - path: "tests/e2e/catalog/inline-edit-announcements.spec.ts"
      provides: "Playwright a11y: 'Atualizado' announced via aria-live=polite after successful save"
      min_lines: 30
      contains: "aria-live"
    - path: "tests/e2e/catalog/delete-plant-flow.spec.ts"
      provides: "Playwright: overflow → BottomSheet opens → confirm → 204 → navigate to /catalog → row gone (D-19 verbatim)"
      min_lines: 50
      contains: "Excluir"
    - path: "tests/e2e/catalog/location-picker-keyboard.spec.ts"
      provides: "Playwright: combobox keyboard nav (ArrowDown/Up/Enter/Escape) + free-text commit"
      min_lines: 50
      contains: "ArrowDown"
    - path: "tests/e2e/catalog/location-picker-a11y.spec.ts"
      provides: "Playwright + axe: open + closed combobox states pass axe scan"
      min_lines: 30
      contains: "AxeBuilder"
    - path: "tests/e2e/catalog/read-only-mode.spec.ts"
      provides: "Playwright: with NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS=expired, edit affordances hidden + delete overflow hidden + read-only banner stub visible (banner stub from Plan 05-18)"
      min_lines: 60
      contains: "expired"
  key_links:
    - from: "src/app/catalog/[plantId]/page.tsx"
      to: "src/contexts/catalog/application/list-plants.ts (5a Plan 05-07)"
      via: "RSC server-side import + prefetch with plantIdFilter + includeIdentificationCount"
      pattern: "listPlants"
    - from: "src/app/catalog/[plantId]/plant-profile-client.tsx"
      to: "src/shared/ui/inline-edit-field.tsx (Plan 05-14)"
      via: "named import for 5 inline-editable fields"
      pattern: "InlineEditField"
    - from: "src/app/catalog/[plantId]/plant-profile-client.tsx"
      to: "src/shared/ui/bottom-sheet.tsx (Plan 05-13)"
      via: "named import for delete-confirm modal"
      pattern: "BottomSheet"
    - from: "src/app/catalog/[plantId]/plant-profile-client.tsx"
      to: "src/shared/ui/combobox.tsx (Plan 05-12)"
      via: "named import for location field"
      pattern: "Combobox"
    - from: "src/app/catalog/[plantId]/plant-profile-client.tsx"
      to: "src/contexts/billing/api/use-subscription.ts (Plan 05-11)"
      via: "named import; gates pencil + delete overflow"
      pattern: "useSubscription"
user_setup: []
---

<objective>
Plant Profile page — Wave 7 — composes 5b primitives (Combobox, BottomSheet, InlineEditField) + 5a routes (GET/PATCH/DELETE /api/v1/plants/:plantId, GET /api/v1/plants/:plantId/photos preview) into the single-scroll Plant Profile per CONTEXT D-10.

Surfaces:
- Cover photo (4:5 full-bleed)
- 5 inline-editable fields (name + nickname + location via Combobox + acquisition_date + notes via InlineEditField multiline)
- Care-card slot (hidden — Phase 7 placeholder)
- Active reminders stub ("Nenhum lembrete ativo.")
- Photo-journal preview (link to `/catalog/[plantId]/photos`)
- ID-history link (CONDITIONAL on identification_count > 0 per D-26)
- Delete overflow → BottomSheet destructive confirm modal per D-19
- Read-only-mode UI variants per D-24

Hooks shipped: usePlant, useUpdatePlant (optimistic), useDeletePlant (pessimistic), useLocationSuggestions.

Output: 6 source files (~410 lines combined) + 7 E2E spec files (~360 lines combined). Covers 4 requirement IDs: CAT-04 + CAT-05 + CAT-09 + UI-08.

NOTE on /api/v1/plants/locations route: see `decisions.location_suggestions_endpoint_url` — this plan SHIPS the route handler as a contingent edit (Option A) since it's a small ~30 line file properly RLS-scoped. If the executor finds a conflict with 5a 05-08 ownership, fall back to documented alternatives.
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

<interfaces>
<!-- Consumed contracts -->

GET /api/v1/plants/:plantId (Plan 05-08 — payload includes identification_count by default for this endpoint per Plan 05-08 frontmatter):
```ts
type PlantDetailResponse = {
  id: string;
  name: string;
  nickname: string | null;
  location: string | null;
  acquisition_date: string | null;
  notes: string | null;
  cover_photo_url: string | null;
  species_id: string | null;
  identification_count: number;  // 0 → hide ID-history link per D-26
  created_at: string;
};
```

PATCH /api/v1/plants/:plantId (Plan 05-09):
- Headers: `Idempotency-Key: <uuid>`, `Content-Type: application/json`
- Body: `Partial<{ name, nickname, location, acquisition_date, notes }>` per PlantPatchSchema (.strict())
- Response 200: full Plant
- Response on validation failure: 400 + `{ error: { code: "validation_failed", ... } }`

DELETE /api/v1/plants/:plantId (Plan 05-09):
- Headers: `Idempotency-Key: <uuid>`
- Response 204 No Content

GET /api/v1/plants/:plantId/photos (Plan 05-08) — used for journal PREVIEW (top 3-5 thumbnails):
```ts
type PhotoEntriesPage = {
  data: { id: string; photo_url: string; thumbnail_url: string; note: string | null; created_at: string }[];
  next_cursor: string | null;
};
```

GET /api/v1/plants/locations (NEW IN THIS PLAN — see decisions.location_suggestions_endpoint_url):
- Response 200: `{ data: string[] }` distinct location values for the user's plants

From src/shared/ui primitives:
- `InlineEditField({ label, value, onSave, validate?, multiline?, disabled? })` — Plan 05-14
- `BottomSheet({ open, onOpenChange, title, children })` — Plan 05-13
- `Combobox({ value, onChange, priorItems, defaultItems, placeholder, ariaLabel, sectionLabels })` — Plan 05-12

From src/messages/pt-BR.json (Plan 05-10) — keys consumed:
- `catalog.profile.sections.{about|careGuide|reminders|journal|idHistory}`
- `catalog.profile.{remindersEmpty|journalEmpty|addJournalCta|deleteOverflow|saveAnnouncement}`
- `catalog.profile.fieldLabels.{name|nickname|location|acquisitionDate|notes}`
- `catalog.profile.validation.futureDateNotAllowed`
- `catalog.profile.editAria` ("Editar {field}")
- `catalog.delete.modal.{title|body|cancel|confirm}` (D-19 verbatim)
- `catalog.locationPicker.{placeholder|sections|defaults|ariaListboxLabel}`
- `catalog.manualAdd.validation.nameRequired` (reused for inline-edit name)
</interfaces>

<related_files>
- Plan 05-09 SUMMARY.md lines 41-49 — explicit hook → endpoint → optimism mapping table (this plan IMPLEMENTS that contract)
- src/shared/ui/{combobox,bottom-sheet,inline-edit-field}.tsx (Plans 05-12/13/14)
- src/contexts/billing/api/use-subscription.ts (Plan 05-11)
- src/contexts/catalog/api/use-plants.ts (Plan 05-15) — same query-key family; this plan adds detail variant
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

<task type="auto">
  <name>Task 1: Implement 4 catalog hooks (use-plant, use-update-plant, use-delete-plant, use-location-suggestions) + new /api/v1/plants/locations route</name>
  <files>src/contexts/catalog/api/use-plant.ts, src/contexts/catalog/api/use-update-plant.ts, src/contexts/catalog/api/use-delete-plant.ts, src/contexts/catalog/api/use-location-suggestions.ts, src/app/api/v1/plants/locations/route.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 3 (optimistic mutation lines 568-613)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pattern 4 (pessimistic mutation lines 622-655)
    - .planning/phases/05-catalog-meu-jardim/05-09-SUMMARY.md lines 41-56 — exact endpoint contract + Idempotency-Key convention
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Repositories" line 78 (location-suggestions repo from 5a 05-03)
    - .planning/phases/05-catalog-meu-jardim/05-08-route-handlers-read-create-PLAN.md (existing route patterns to mirror)
    - src/shared/api/http-error-map.ts (Plan 05-08 — httpMapDomainError helper)
    - src/shared/auth/require-user.ts (Phase 2 — RSC variant of requireUser)
  </read_first>
  <action>
    **Step A: usePlant** — `src/contexts/catalog/api/use-plant.ts`:
    ```ts
    "use client";
    import { useQuery } from "@tanstack/react-query";

    export type PlantDetail = {
      id: string;
      name: string;
      nickname: string | null;
      location: string | null;
      acquisition_date: string | null;
      notes: string | null;
      cover_photo_url: string | null;
      species_id: string | null;
      identification_count: number;
      created_at: string;
    };

    export function usePlant(plantId: string) {
      return useQuery<PlantDetail, Error>({
        queryKey: ["plants", "detail", plantId],
        queryFn: async () => {
          const res = await fetch(`/api/v1/plants/${plantId}`, { credentials: "include" });
          if (!res.ok) throw new Error(`plant_fetch_failed_${res.status}`);
          return (await res.json()) as PlantDetail;
        },
      });
    }
    ```

    **Step B: useUpdatePlant** — `src/contexts/catalog/api/use-update-plant.ts` per RESEARCH Pattern 3 (optimistic):
    ```ts
    "use client";
    import { useMutation, useQueryClient } from "@tanstack/react-query";
    import type { PlantDetail } from "./use-plant";

    type Patch = Partial<Pick<PlantDetail, "name" | "nickname" | "location" | "acquisition_date" | "notes">>;
    type PatchInput = { id: string; patch: Patch };

    export function useUpdatePlant() {
      const queryClient = useQueryClient();
      return useMutation<PlantDetail, Error, PatchInput, { previous: PlantDetail | undefined }>({
        mutationFn: async ({ id, patch }) => {
          const res = await fetch(`/api/v1/plants/${id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Idempotency-Key": crypto.randomUUID(),
            },
            body: JSON.stringify(patch),
            credentials: "include",
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error?.code || `update_failed_${res.status}`);
          }
          return (await res.json()) as PlantDetail;
        },
        onMutate: async ({ id, patch }) => {
          await queryClient.cancelQueries({ queryKey: ["plants", "detail", id] });
          const previous = queryClient.getQueryData<PlantDetail>(["plants", "detail", id]);
          if (previous) {
            queryClient.setQueryData<PlantDetail>(["plants", "detail", id], { ...previous, ...patch });
          }
          return { previous };
        },
        onError: (_err, { id }, context) => {
          if (context?.previous) {
            queryClient.setQueryData(["plants", "detail", id], context.previous);
          }
        },
        onSettled: (_data, _err, { id }) => {
          queryClient.invalidateQueries({ queryKey: ["plants", "detail", id] });
          queryClient.invalidateQueries({ queryKey: ["plants"] });
        },
      });
    }
    ```

    **Step C: useDeletePlant** — `src/contexts/catalog/api/use-delete-plant.ts` per RESEARCH Pattern 4 (pessimistic):
    ```ts
    "use client";
    import { useMutation, useQueryClient } from "@tanstack/react-query";

    export function useDeletePlant() {
      const queryClient = useQueryClient();
      return useMutation<void, Error, string>({
        mutationFn: async (id: string) => {
          const res = await fetch(`/api/v1/plants/${id}`, {
            method: "DELETE",
            headers: { "Idempotency-Key": crypto.randomUUID() },
            credentials: "include",
          });
          if (!res.ok && res.status !== 204) {
            throw new Error(`delete_failed_${res.status}`);
          }
        },
        onSuccess: (_data, id) => {
          // Remove from all list pages
          queryClient.setQueriesData<{ pages: { data: { id: string }[]; next_cursor: string | null }[] }>(
            { queryKey: ["plants"] },
            (old) => {
              if (!old) return old;
              return {
                ...old,
                pages: old.pages.map((p) => ({ ...p, data: p.data.filter((plant) => plant.id !== id) })),
              };
            },
          );
          queryClient.removeQueries({ queryKey: ["plants", "detail", id] });
          queryClient.removeQueries({ queryKey: ["plants", id, "photos"] });
        },
      });
    }
    ```

    **Step D: useLocationSuggestions** — `src/contexts/catalog/api/use-location-suggestions.ts`:
    ```ts
    "use client";
    import { useQuery } from "@tanstack/react-query";

    export function useLocationSuggestions() {
      return useQuery<string[], Error>({
        queryKey: ["plants", "locations"],
        queryFn: async () => {
          const res = await fetch("/api/v1/plants/locations", { credentials: "include" });
          if (!res.ok) throw new Error(`locations_fetch_failed_${res.status}`);
          const body = (await res.json()) as { data: string[] };
          return body.data;
        },
        staleTime: 1000 * 60 * 5, // 5min — locations rarely change
      });
    }
    ```

    **Step E: NEW route handler** — `src/app/api/v1/plants/locations/route.ts`:
    ```ts
    import { NextResponse } from "next/server";
    import { requireUser } from "@shared/auth/require-user";
    import { httpMapDomainError } from "@shared/api/http-error-map";
    import { listLocationSuggestions } from "@contexts/catalog/application/list-location-suggestions";

    export async function GET(req: Request) {
      try {
        const user = await requireUser(req);
        const data = await listLocationSuggestions({ userId: user.id });
        return NextResponse.json({ data });
      } catch (err) {
        return httpMapDomainError(err);
      }
    }
    ```

    NOTE on use case: 5a Plan 05-03 ships the `location-suggestions` repository (`src/contexts/catalog/infrastructure/db/location-suggestions.ts` with `distinctByUser(db, userId)` per 05-PATTERNS.md line 78). 5a did NOT ship a use case wrapper. This task creates the missing thin use case at `src/contexts/catalog/application/list-location-suggestions.ts`:
    ```ts
    import { locationSuggestions } from "@contexts/catalog/infrastructure/db/location-suggestions";
    import { db } from "@shared/db/client";

    export async function listLocationSuggestions({ userId }: { userId: string }): Promise<string[]> {
      return locationSuggestions.distinctByUser(db, userId);
    }
    ```

    Add this file to `files_modified` at execution time if the executor confirms the use case is missing on disk.

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/contexts/catalog/api/use-plant.ts src/contexts/catalog/api/use-update-plant.ts src/contexts/catalog/api/use-delete-plant.ts src/contexts/catalog/api/use-location-suggestions.ts src/app/api/v1/plants/locations/route.ts && git commit -m "feat(05-16): catalog detail/update/delete/locations hooks + locations route handler"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c onMutate src/contexts/catalog/api/use-update-plant.ts | grep -qE "^[1-9]" &amp;&amp; grep -c "Idempotency-Key" src/contexts/catalog/api/use-update-plant.ts | grep -qE "^[1-9]" &amp;&amp; grep -c "Idempotency-Key" src/contexts/catalog/api/use-delete-plant.ts | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - 4 hooks + 1 route handler shipped
    - useUpdatePlant uses Pattern 3 (optimistic): onMutate + onError rollback + onSettled invalidate
    - useDeletePlant uses Pattern 4 (pessimistic): button-loading; onSuccess setQueriesData + removeQueries
    - All mutations send Idempotency-Key header (crypto.randomUUID())
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-16):`
  </done>
</task>

<task type="auto">
  <name>Task 2: Plant Profile RSC page + single-scroll PlantProfileClient with all 5 inline edits + delete-confirm BottomSheet + conditional ID-history + read-only-mode gating</name>
  <files>src/app/catalog/[plantId]/page.tsx, src/app/catalog/[plantId]/plant-profile-client.tsx</files>
  <read_first>
    - Task 1 outputs (4 new hooks)
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-10 + D-11 + D-12 + D-19 + D-26
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md § "Plant Profile cover" lines 260-272 + § "Modal sheet" + § "Read-only mode UI variants"
    - src/shared/ui/inline-edit-field.tsx (Plan 05-14)
    - src/shared/ui/bottom-sheet.tsx (Plan 05-13)
    - src/shared/ui/combobox.tsx (Plan 05-12)
    - src/messages/pt-BR.json (Plan 05-10) — catalog.profile.* + catalog.delete.modal.* + catalog.locationPicker.*
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Pitfall 9 (lines 1252-1264) — date hydration mismatch; this plan's acquisition_date display uses date-fns-tz formatInTimeZone
  </read_first>
  <action>
    **RSC page** — `src/app/catalog/[plantId]/page.tsx`:
    ```tsx
    import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
    import { listPlants } from "@contexts/catalog/application/list-plants";
    import { requireUser } from "@shared/auth/require-user";
    import { PlantProfileClient } from "./plant-profile-client";
    import { notFound } from "next/navigation";

    export default async function PlantProfilePage({ params }: { params: Promise<{ plantId: string }> }) {
      const { plantId } = await params;
      const user = await requireUser();
      const queryClient = new QueryClient();

      // Prefetch via use case directly (Plan 05-08 frontmatter line 41 contract)
      const result = await listPlants({
        userId: user.id,
        plantIdFilter: plantId,
        includeIdentificationCount: true,
        sort: "acquired_desc",
        cursor: null,
        limit: 1,
      });
      if (!result.data || result.data.length === 0) notFound();

      // Seed the detail query directly (NOT via prefetchQuery to /api/v1, which would
      // incur a server-side HTTP roundtrip); use case returns the right shape already.
      queryClient.setQueryData(["plants", "detail", plantId], result.data[0]);

      return (
        <HydrationBoundary state={dehydrate(queryClient)}>
          <PlantProfileClient plantId={plantId} />
        </HydrationBoundary>
      );
    }
    ```

    **Client island** — `src/app/catalog/[plantId]/plant-profile-client.tsx` (~220 lines):
    ```tsx
    "use client";
    import { useState } from "react";
    import { useRouter } from "next/navigation";
    import Link from "next/link";
    import Image from "next/image";
    import { useTranslations } from "next-intl";
    import { MoreVertical } from "lucide-react";
    import { usePlant } from "@contexts/catalog/api/use-plant";
    import { useUpdatePlant } from "@contexts/catalog/api/use-update-plant";
    import { useDeletePlant } from "@contexts/catalog/api/use-delete-plant";
    import { useLocationSuggestions } from "@contexts/catalog/api/use-location-suggestions";
    import { useSubscription } from "@contexts/billing/api/use-subscription";
    import { InlineEditField } from "@shared/ui/inline-edit-field";
    import { BottomSheet } from "@shared/ui/bottom-sheet";
    import { Combobox } from "@shared/ui/combobox";

    export function PlantProfileClient({ plantId }: { plantId: string }) {
      const t = useTranslations("catalog");
      const router = useRouter();
      const { data: plant, isLoading } = usePlant(plantId);
      const updatePlant = useUpdatePlant();
      const deletePlant = useDeletePlant();
      const { data: priorLocations = [] } = useLocationSuggestions();
      const { status } = useSubscription();
      const readOnly = status === "expired" || status === "grace";

      const [deleteOpen, setDeleteOpen] = useState(false);
      const [saveAnnouncement, setSaveAnnouncement] = useState("");

      if (isLoading || !plant) {
        return <main className="p-8">{t("loading.list")}</main>;
      }

      const altText = plant.nickname
        ? t("card.alt.withNickname", { name: plant.name, nickname: plant.nickname })
        : t("card.alt.nameOnly", { name: plant.name });

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

      async function saveField(patch: Partial<typeof plant>) {
        await updatePlant.mutateAsync({ id: plantId, patch });
        setSaveAnnouncement(t("profile.saveAnnouncement"));
        setTimeout(() => setSaveAnnouncement(""), 2000);
      }

      async function confirmDelete() {
        await deletePlant.mutateAsync(plantId);
        router.push("/catalog");
      }

      return (
        <main className="min-h-[100dvh] bg-[var(--paper-cream,#FBF7EF)] pb-24">
          {/* Cover */}
          <div className="relative aspect-[4/5] w-full">
            {plant.cover_photo_url && (
              <Image src={plant.cover_photo_url} alt={altText} fill className="object-cover" sizes="100vw" />
            )}
            {!readOnly && (
              <button
                type="button"
                onClick={() => setDeleteOpen(true)}
                aria-label={t("profile.deleteOverflow")}
                className="absolute right-4 top-4 rounded-full bg-[var(--surface,#FFFDF7)]/90 p-2 text-[var(--calm-slate,#5A6358)]"
              >
                <MoreVertical size={24} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="px-5 pt-8">
            {/* Live region for save announcement */}
            <div aria-live="polite" className="sr-only">{saveAnnouncement}</div>

            {/* Section: Sobre (5 inline edits) */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--calm-slate,#5A6358)]">
                {t("profile.sections.about")}
              </h2>
              <div className="space-y-4">
                <InlineEditField
                  label={t("profile.fieldLabels.name")}
                  value={plant.name}
                  onSave={(v) => saveField({ name: v })}
                  validate={(v) => (v.trim().length === 0 ? t("manualAdd.validation.nameRequired") : null)}
                  disabled={readOnly}
                />
                <InlineEditField
                  label={t("profile.fieldLabels.nickname")}
                  value={plant.nickname ?? ""}
                  onSave={(v) => saveField({ nickname: v || null })}
                  disabled={readOnly}
                />
                {/* Location uses Combobox primitive, not InlineEditField — distinct edit pattern */}
                <div>
                  <label className="block text-sm text-[var(--calm-slate,#5A6358)]">
                    {t("profile.fieldLabels.location")}
                  </label>
                  {readOnly ? (
                    <p className="text-base">{plant.location || "—"}</p>
                  ) : (
                    <Combobox
                      value={plant.location ?? ""}
                      onChange={(v) => saveField({ location: v || null })}
                      priorItems={priorLocations}
                      defaultItems={defaultLocations}
                      placeholder={t("locationPicker.placeholder")}
                      ariaLabel={t("locationPicker.ariaListboxLabel")}
                      sectionLabels={{
                        prior: t("locationPicker.sections.prior"),
                        defaults: t("locationPicker.sections.defaults"),
                      }}
                    />
                  )}
                </div>
                <InlineEditField
                  label={t("profile.fieldLabels.acquisitionDate")}
                  value={plant.acquisition_date ?? ""}
                  onSave={(v) => saveField({ acquisition_date: v || null })}
                  validate={(v) => {
                    if (!v) return null;
                    const d = new Date(v);
                    if (isNaN(d.getTime())) return null;
                    return d > new Date() ? t("profile.validation.futureDateNotAllowed") : null;
                  }}
                  disabled={readOnly}
                />
                <InlineEditField
                  label={t("profile.fieldLabels.notes")}
                  value={plant.notes ?? ""}
                  onSave={(v) => saveField({ notes: v || null })}
                  multiline
                  disabled={readOnly}
                />
              </div>
            </section>

            {/* Care card slot — HIDDEN per CONTEXT D-10; Phase 7 fills */}

            {/* Reminders stub — Phase 8 fills */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--calm-slate,#5A6358)]">
                {t("profile.sections.reminders")}
              </h2>
              <p className="text-base text-[var(--calm-slate,#5A6358)]">{t("profile.remindersEmpty")}</p>
            </section>

            {/* Photo journal preview */}
            <section className="mb-8">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--calm-slate,#5A6358)]">
                {t("profile.sections.journal")}
              </h2>
              <Link
                href={`/catalog/${plantId}/photos`}
                className="text-base font-semibold text-[var(--canopy,#1F4D35)]"
              >
                {t("profile.addJournalCta")}
              </Link>
            </section>

            {/* ID-history link — CONDITIONAL per D-26 */}
            {plant.identification_count > 0 && (
              <section className="mb-8">
                <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-[var(--calm-slate,#5A6358)]">
                  {t("profile.sections.idHistory")}
                </h2>
                {/* Phase 6 owns the actual identification list page; Phase 5 ships the link target as a placeholder */}
                <Link href={`/catalog/${plantId}/identifications`} className="text-base font-semibold text-[var(--canopy,#1F4D35)]">
                  {plant.identification_count}{" "}
                  {plant.identification_count === 1 ? "identificação" : "identificações"}
                </Link>
              </section>
            )}
          </div>

          {/* Delete-confirm BottomSheet — D-19 verbatim */}
          <BottomSheet
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title={t("delete.modal.title", { name: plant.name })}
          >
            <p className="mb-6 text-base text-[var(--forest-ink,#143424)]">{t("delete.modal.body")}</p>
            <div className="flex gap-3">
              {/* Cancelar PRIMARY in layout order per PRD §17 + D-19 */}
              <button
                type="button"
                onClick={() => setDeleteOpen(false)}
                className="flex-1 rounded-lg border border-[var(--hairline,#D8D2C7)] bg-[var(--surface,#FFFDF7)] px-4 py-3 text-base font-semibold text-[var(--forest-ink,#143424)]"
              >
                {t("delete.modal.cancel")}
              </button>
              {/* Excluir DESTRUCTIVE secondary */}
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletePlant.isPending}
                className="flex-1 rounded-lg bg-[var(--overdue,#A14A2C)] px-4 py-3 text-base font-semibold text-[var(--surface,#FFFDF7)] disabled:opacity-60"
              >
                {t("delete.modal.confirm")}
              </button>
            </div>
          </BottomSheet>
        </main>
      );
    }
    ```

    Run typecheck: `pnpm exec tsc --noEmit` exits 0.

    Commit: `git add src/app/catalog/[plantId]/page.tsx src/app/catalog/[plantId]/plant-profile-client.tsx && git commit -m "feat(05-16): Plant Profile page (single-scroll D-10 + 5 inline edits + delete-confirm + ID-history conditional + read-only-mode)"`
  </action>
  <verify>
    <automated>pnpm exec tsc --noEmit &amp;&amp; grep -c "InlineEditField" src/app/catalog/[plantId]/plant-profile-client.tsx | grep -qE "^[5-9]|^[1-9][0-9]" &amp;&amp; grep -c "BottomSheet" src/app/catalog/[plantId]/plant-profile-client.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "Combobox" src/app/catalog/[plantId]/plant-profile-client.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "useSubscription" src/app/catalog/[plantId]/plant-profile-client.tsx | grep -qE "^[1-9]" &amp;&amp; grep -c "identification_count" src/app/catalog/[plantId]/plant-profile-client.tsx | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - RSC page exists, prefetches via listPlants(plantIdFilter, includeIdentificationCount=true)
    - Client island ships single-scroll layout
    - 5 inline-editable fields (4 InlineEditField + 1 Combobox for location)
    - Care-card slot omitted (Phase 7); reminders stub renders empty copy (Phase 8)
    - ID-history section CONDITIONAL on identification_count > 0
    - Delete overflow → BottomSheet with D-19 verbatim copy
    - On delete success → router.push("/catalog")
    - All edit affordances + delete overflow gated by `!readOnly`
    - aria-live announcement for "Atualizado"
    - tsc --noEmit exits 0
    - Commit prefix `feat(05-16):`
  </done>
</task>

<task type="auto">
  <name>Task 3: 7 Playwright E2E specs (profile render + inline edits + announcements + delete flow + location keyboard + location a11y + read-only mode)</name>
  <files>tests/e2e/catalog/plant-profile-render.spec.ts, tests/e2e/catalog/inline-edit-per-field.spec.ts, tests/e2e/catalog/inline-edit-announcements.spec.ts, tests/e2e/catalog/delete-plant-flow.spec.ts, tests/e2e/catalog/location-picker-keyboard.spec.ts, tests/e2e/catalog/location-picker-a11y.spec.ts, tests/e2e/catalog/read-only-mode.spec.ts</files>
  <read_first>
    - tests/helpers/playwright-auth-bypass.ts (Plan 05-01)
    - tests/helpers/axe-helper.ts (Plan 05-01)
    - .planning/phases/05-catalog-meu-jardim/05-VALIDATION.md rows CAT-04 e2e, CAT-05 e2e + a11y, CAT-09 e2e, UI-08 e2e + a11y, (D-24) e2e
  </read_first>
  <action>
    All 7 specs use `test.skip(!process.env.PHASE_4_AUTH_READY, ...)` — same pattern as Plan 05-15. Authoring contract:

    1. **plant-profile-render.spec.ts** (~60 lines): Navigate to /catalog/[id]; assert all 4 visible sections render in correct order (Sobre → Lembretes → Diário → optional ID-history). Care-card slot is NOT in DOM; reminders shows "Nenhum lembrete ativo." stub copy. ID-history section visibility test parametrized by identification_count fixture (0 = hidden; 1 = visible).

    2. **inline-edit-per-field.spec.ts** (~80 lines): For each of 5 fields (name, nickname, location, acquisition_date, notes): click → edit → blur → assert PATCH was called with correct field; reload page → assert value persisted. Escape test: edit → press Escape → verify reverted.

    3. **inline-edit-announcements.spec.ts** (~30 lines): Edit name → blur → assert `aria-live="polite"` region contains "Atualizado".

    4. **delete-plant-flow.spec.ts** (~50 lines): Click overflow → assert BottomSheet visible → assert title is "Excluir Samambaia?" + body verbatim "Isso apagará as fotos e lembretes desta planta. A ação não pode ser desfeita." + "Cancelar" + "Excluir" buttons → click Excluir → assert DELETE was called → assert navigation to /catalog → assert plant absent from grid.

    5. **location-picker-keyboard.spec.ts** (~50 lines): Click location field → opens Combobox (or focus → opens) → press ArrowDown → first option focused (aria-activedescendant) → press Enter → field commits → assert PATCH location was called. Test free-text path: type "Garagem" → press Enter → PATCH with "Garagem".

    6. **location-picker-a11y.spec.ts** (~30 lines): Closed combobox state → axe scan → 0 violations. Open state → axe scan → 0 violations. Asserts `[role="combobox"]` and `[role="listbox"]` exist with required ARIA attrs.

    7. **read-only-mode.spec.ts** (~60 lines): Set webServer env `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS=expired`. Navigate to /catalog/[id]. Assert: pencil icons absent → no `[aria-label^="Editar "]` button visible; delete overflow `[aria-label="Excluir planta"]` button absent; persistent banner stub from Plan 05-18 visible (this part might fail if Plan 05-18 hasn't shipped — acceptable, the banner test is in the read-only spec but the per-banner-presence test belongs to Plan 05-18's test suite).

    Each spec opens with the auth-fixture-readiness skip. Author all 7 with the structure documented above.

    Run `pnpm exec playwright test tests/e2e/catalog/plant-profile-render.spec.ts tests/e2e/catalog/inline-edit-per-field.spec.ts tests/e2e/catalog/inline-edit-announcements.spec.ts tests/e2e/catalog/delete-plant-flow.spec.ts tests/e2e/catalog/location-picker-keyboard.spec.ts tests/e2e/catalog/location-picker-a11y.spec.ts tests/e2e/catalog/read-only-mode.spec.ts --list` — should collect without syntax errors.

    Commit: `git add tests/e2e/catalog/plant-profile-render.spec.ts tests/e2e/catalog/inline-edit-per-field.spec.ts tests/e2e/catalog/inline-edit-announcements.spec.ts tests/e2e/catalog/delete-plant-flow.spec.ts tests/e2e/catalog/location-picker-keyboard.spec.ts tests/e2e/catalog/location-picker-a11y.spec.ts tests/e2e/catalog/read-only-mode.spec.ts && git commit -m "test(05-16): 7 Playwright E2E specs for Plant Profile (render + inline edits + delete + combobox + read-only)"`
  </action>
  <verify>
    <automated>pnpm exec playwright test tests/e2e/catalog/plant-profile-render.spec.ts tests/e2e/catalog/inline-edit-per-field.spec.ts tests/e2e/catalog/inline-edit-announcements.spec.ts tests/e2e/catalog/delete-plant-flow.spec.ts tests/e2e/catalog/location-picker-keyboard.spec.ts tests/e2e/catalog/location-picker-a11y.spec.ts tests/e2e/catalog/read-only-mode.spec.ts --list 2>&amp;1 | grep -qE "[0-9]+ tests in [0-9]+ files"</automated>
  </verify>
  <done>
    - 7 spec files exist
    - Each guards with auth-fixture-readiness skip
    - Playwright `--list` succeeds
    - Commit prefix `test(05-16):`
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser → API (PATCH/DELETE) | JWT auth + Idempotency-Key + RLS server-side (Plan 05-09) |
| user input → InlineEditField → onSave | Plant name/nickname/location/notes capped server-side by Plan 05-04 schema |
| Read-only mode UI gate | UX gate; server enforces read_only_mode 402 on mutating endpoints (Plan 05-09 + Phase 10) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-16-01 | XSS | Plant name in BottomSheet title `t("delete.modal.title", { name })` | mitigate | next-intl auto-escapes interpolated values; React JSX text nodes auto-escape. Plant name capped at 80 chars by Plan 05-04. |
| T-5b-16-02 | XSS | Plant notes (multiline, up to 2000 chars) rendered in InlineEditField read mode | mitigate | InlineEditField renders `value` via JSX text node `<span>{value || "—"}</span>` — auto-escaped. No `dangerouslySetInnerHTML`. |
| T-5b-16-03 | Information Disclosure | Sentry breadcrumb leaks photo_url on Plant Profile error | mitigate | Phase 1 LGPD-13 scrub (Plan 01-05a) drops sensitive fields. Plant Profile does not add `cover_photo_url` to Sentry scope. |
| T-5b-16-04 | Tampering | Mass-assignment via PATCH (e.g., user tries to set cover_photo_url through inline edit) | mitigate | Server-side defense: Plan 05-04 PlantPatchSchema is `.strict()` + picks only writable fields (name, nickname, location, acquisition_date, notes). Plan 05-09 SUMMARY § "Mass-assignment defense layered three deep" confirms 3-layer defense. UI does not surface fields outside the PATCH whitelist. |
| T-5b-16-05 | Spoofing | Read-only user bypasses UI gate by spoofing useSubscription env flag | accept | Server-side enforcement is load-bearing (T-5b-11-01 already documented). UI gate is UX. |
| T-5b-16-06 | Information Disclosure | identification_count leaks count of Identifications belonging to other users | mitigate | listPlants use case (Plan 05-07) scopes count by `userId` in repo query; RLS enforces (Phase 2 D-22). Cross-user identification_count cannot leak. |
| T-5b-16-07 | Tampering | useUpdatePlant optimistic onMutate writes attacker-controlled patch into local cache | accept | Local cache only; server PATCH validates + returns canonical state via onSettled invalidation. Failed PATCH triggers onError rollback. No server-side trust. |

</threat_model>

<verification>
- `pnpm exec tsc --noEmit` exits 0
- `grep -c onMutate src/contexts/catalog/api/use-update-plant.ts` ≥ 1
- `grep -c "Idempotency-Key" src/contexts/catalog/api/use-update-plant.ts` ≥ 1
- `grep -c "Idempotency-Key" src/contexts/catalog/api/use-delete-plant.ts` ≥ 1
- `grep -c "InlineEditField" src/app/catalog/[plantId]/plant-profile-client.tsx` ≥ 4 (used for 4 of 5 fields)
- `grep -c "Combobox" src/app/catalog/[plantId]/plant-profile-client.tsx` ≥ 1 (location field)
- `grep -c "BottomSheet" src/app/catalog/[plantId]/plant-profile-client.tsx` ≥ 1 (delete confirm)
- `grep -c "useSubscription" src/app/catalog/[plantId]/plant-profile-client.tsx` ≥ 1
- `grep -c "identification_count" src/app/catalog/[plantId]/plant-profile-client.tsx` ≥ 1
- `grep -c 'aria-live="polite"' src/app/catalog/[plantId]/plant-profile-client.tsx` ≥ 1
- All 7 Playwright specs collect without syntax errors via `--list`
</verification>

<success_criteria>
- Plant Profile page renders single-scroll D-10 layout with care-card hidden + reminders stub + photo-journal preview link + conditional ID-history (D-26)
- 5 inline-editable fields wired to optimistic useUpdatePlant per D-07
- Delete overflow opens D-19 verbatim BottomSheet; on confirm calls pessimistic useDeletePlant + navigates to /catalog
- Read-only mode hides edit affordances + delete overflow per D-24
- Location combobox uses Plan 05-12 primitive with priorItems from useLocationSuggestions + 8 i18n defaults
- /api/v1/plants/locations route handler ships per `decisions.location_suggestions_endpoint_url` Option A
- 7 Playwright E2E specs authored
- 4 requirement IDs covered (CAT-04 + CAT-05 + CAT-09 + UI-08)
- Commits prefixed `feat(05-16):` (hooks + page + client) and `test(05-16):` (E2E)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-16-SUMMARY.md` summarizing:
- Final approach to /api/v1/plants/locations route (Option A confirmed shipped, OR fallback engaged)
- Whether the use case `list-location-suggestions.ts` was created in this plan or pre-existed from 5a 05-07
- Confirmation of `data-testid` attributes (e.g., bottom-sheet-scrim from Plan 05-13 still works)
- Note for Plan 05-17: this plan's PhotoJournal preview link target is `/catalog/[plantId]/photos` — Plan 05-17 owns that route
- Number of E2E specs landed (7) + auth-fixture-readiness skip status
</output>
</content>
</invoke>