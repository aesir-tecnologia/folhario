---
phase: 05-catalog-meu-jardim
plan: 16
type: execute
wave: 4
depends_on:
  - 05-08
  - 05-09
  - 05-11
  - 05-12
  - 05-13
  - 05-14
files_modified:
  - src/app/(app)/catalog/[plantId]/page.tsx
  - src/app/(app)/catalog/[plantId]/plant-profile.tsx
  - src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx
  - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
  - tests/unit/use-plant-profile-mutations.test.tsx
  - tests/unit/delete-confirm-sheet.test.tsx
  - tests/e2e/plant-profile.spec.ts
autonomous: true
requirements:
  - CAT-04
  - CAT-09
  - UI-08
tags:
  - catalog
  - plant-profile
  - inline-edit
  - delete-confirm
  - cascade-counts
  - read-only
  - axe
must_haves:
  truths:
    - "Visiting /catalog/{plantId} as the owner renders the plant cover photo, thumbnail strip (when ≥2 PhotoEntry rows), and 5 inline-edit fields (name, nickname, location, acquisition_date, notes) populated from the server."
    - "Tapping an inline-edit field's value text converts it to an editable input focused on the current value; blur saves via PATCH; Enter saves single-line; Esc reverts to the pre-edit value (per D-05 / UI-SPEC §6 / 05-14 InlineEditField contract)."
    - "On PATCH success the server row is merged into the TanStack Query cache as truth (D-06 last-write-wins); on PATCH failure the optimistic value is rolled back and a sonner toast renders catalog.profile.saveFailure with a retry tap target."
    - "Visiting /catalog/{plantId} for a plant the requesting user does NOT own returns notFound() — getPlant use-case scoping prevents cross-user disclosure (T-05-16-01 mitigation)."
    - "Tapping the overflow MoreVertical button opens a popover with a single 'Excluir planta' item (i18n key catalog.profile.overflow.delete); tapping it opens the <DeleteConfirmSheet> in role='alertdialog' mode."
    - "DeleteConfirmSheet body shows live cascade counts from getPlant._meta — bodyBoth when both > 0, bodyPhotosOnly when only photos > 0, bodyRemindersOnly when only reminders > 0, bodyEmpty when both 0 (per D-07 + UI-SPEC §7); ICU plural rules apply via next-intl."
    - "DeleteConfirmSheet renders Cancelar above Excluir planta on mobile (PRD §17 destructive layout-secondary rule); Cancelar receives initial focus via standard React autoFocus (05-13 BottomSheet contract)."
    - "Confirming delete fires DELETE /api/v1/plants/{plantId}; on 204 the plant is optimistically removed from the catalog list cache (plantsKeys.lists partial-match invalidate) and the route navigates to /catalog; on failure the sheet stays open with sonner toast catalog.profile.delete.failure."
    - "Hidden placeholder sections render for care card (Phase 7), active reminders (Phase 8), and ID history (Phase 6) per CONTEXT.md scope boundary — they emit zero observable affordances when their underlying data is absent."
    - "Photo-journal preview strip (UI-SPEC §6 Section 4) renders the last 4 PhotoEntry thumbnails fetched via plantsKeys.photoEntries(plantId) with a 'Ver tudo' link to /catalog/{plantId}/journal; empty (1 PhotoEntry, the cover) shows the catalog.profile.journal.empty hint + addCta tertiary link."
    - "Read-only variant (useSubscription().readOnly === true per 05-11 stub): all <InlineEditField> instances render with readOnly=true (no tap affordance, cursor default), the overflow MoreVertical button is hidden entirely, and the photo-journal preview strip's add affordances are hidden — Phase 3 <ReadOnlyBanner> is already flipped on by AppShell."
    - "Playwright spec tests/e2e/plant-profile.spec.ts (using authedUser fixture from 05-01) covers: inline-edit blur saves, Enter saves single-line, Esc reverts, delete-confirm cascade counts visible, plant disappears from /catalog after confirm; axe-core scans /catalog/{plantId} in 4 colorScheme × reducedMotion combos with 0 serious+critical violations."
  artifacts:
    - path: "src/app/(app)/catalog/[plantId]/page.tsx"
      provides: "Server Component for plant profile route. Fetches plant + cascade counts via getPlant use-case, fetches first 4 photo entries via list-photo-entries (limit 4) for the preview strip, dehydrates queryClient and hands off to <PlantProfile> client component via <HydrationBoundary> (D-13 pattern)."
      exports: ["default"]
      min_lines: 40
    - path: "src/app/(app)/catalog/[plantId]/plant-profile.tsx"
      provides: "Client component composing the single-scroll plant profile per UI-SPEC §6: cover + thumbnail gallery, 5 <InlineEditField> instances (3 text, 1 textarea, 1 combobox via <LocationCombobox>, 1 date), photo-journal preview strip, hidden Phase 6/7/8 placeholder sections, overflow popover delete trigger. Read-only variant per D-21."
      exports: ["PlantProfile"]
      min_lines: 200
    - path: "src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx"
      provides: "<DeleteConfirmSheet> composing 05-13 <BottomSheet role='alertdialog'>. ICU-pluralised cascade-count body (4 variants per UI-SPEC §7), Cancelar (autoFocus, primary visual position), Excluir planta (destructive, layout-secondary). Wires DELETE mutation + optimistic catalog grid removal."
      exports: ["DeleteConfirmSheet"]
      min_lines: 80
    - path: "src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts"
      provides: "Hooks: usePatchPlantField (D-05/D-06 LWW optimistic update + rollback + sonner toast on failure) and useDeletePlant (optimistic removal from plantsKeys.lists() partial-match + redirect to /catalog on success). Both hooks use plantsKeys factory from 05-10."
      exports: ["usePatchPlantField", "useDeletePlant"]
      min_lines: 80
    - path: "tests/unit/use-plant-profile-mutations.test.tsx"
      provides: "Vitest unit-dom coverage for the LWW optimistic update + rollback contract (D-06). Covers: optimistic apply on mutate; cache merge with server response on success; rollback to pre-mutation snapshot on error; sonner toast invocation on error path."
      min_lines: 80
    - path: "tests/unit/delete-confirm-sheet.test.tsx"
      provides: "Vitest unit-dom coverage for the cascade-count body variant selection (4 variants), the alertdialog role pass-through, and the Cancelar autoFocus contract."
      min_lines: 80
    - path: "tests/e2e/plant-profile.spec.ts"
      provides: "Playwright E2E spec using authedUser fixture (05-01) + seeded plant. Covers inline-edit blur/Enter/Esc, delete-confirm cascade counts, plant-removed-from-grid post-delete, read-only variant via read-only.ts fixture (05-11), and axe-core a11y scans across 4 colorScheme × reducedMotion combos with 0 serious+critical violations."
      min_lines: 150
      contains: "AxeBuilder"
  key_links:
    - from: "src/app/(app)/catalog/[plantId]/page.tsx"
      to: "src/contexts/catalog/application/get-plant.ts"
      via: "Server Component await getPlant({userId, plantId}) inside try/catch with notFound() on { ok: false, code: 'not_found' }"
      pattern: "getPlant"
    - from: "src/app/(app)/catalog/[plantId]/page.tsx"
      to: "src/contexts/catalog/application/list-photo-entries.ts"
      via: "Server Component await listPhotoEntries({userId, plantId, limit: 4}) for the preview strip"
      pattern: "listPhotoEntries"
    - from: "src/app/(app)/catalog/[plantId]/plant-profile.tsx"
      to: "src/shared/ui/inline-edit-field.tsx"
      via: "5 <InlineEditField> instances wired to usePatchPlantField via the onSave prop"
      pattern: "InlineEditField"
    - from: "src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx"
      to: "src/shared/ui/bottom-sheet.tsx"
      via: "<BottomSheet role=\"alertdialog\"> with autoFocus on Cancelar (05-13 contract)"
      pattern: "role=\"alertdialog\""
    - from: "src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts"
      to: "src/contexts/catalog/queries/index.ts"
      via: "plantsKeys.detail(id) for cache reads/writes; plantsKeys.lists() partial-match for invalidation/optimistic removal"
      pattern: "plantsKeys"
    - from: "src/app/(app)/catalog/[plantId]/plant-profile.tsx"
      to: "src/contexts/billing/application/use-subscription.ts"
      via: "useSubscription().readOnly gates inline-edit affordances + overflow popover + photo-journal add link"
      pattern: "useSubscription"
    - from: "tests/e2e/plant-profile.spec.ts"
      to: "tests/e2e/fixtures/authed-user.ts"
      via: "test fixture seeds verified user + creates a plant via authenticated POST /api/v1/plants before navigating to /catalog/{plantId}"
      pattern: "authedUser"
---

<objective>
Ship the **Plant Profile** page (`/catalog/[plantId]`) — the deepest catalog surface in Phase 5 — composing six upstream artifacts (Server Component data fetch via `getPlant` from 05-07/05-08, `<InlineEditField>` × 5 from 05-14, `<BottomSheet role="alertdialog">` from 05-13, `<LocationCombobox>` from 05-12, `useSubscription()` read-only gate from 05-11, `useDeletePlant` against PATCH/DELETE handlers from 05-08/05-09).

Three deliverables:

1. **Server Component shell** at `src/app/(app)/catalog/[plantId]/page.tsx`. Fetches the plant detail (with `_meta.{photo_entry_count, reminder_count}` per D-07) and the first 4 photo entries (preview strip) via use-cases on the server. Returns `notFound()` cross-user (T-05-16-01 mitigation: `getPlant` returns the closed-registry `not_found` result for non-owners; the route maps that into Next's `notFound()`). Hands off SSR'd data to the client via `dehydrate(queryClient)` / `<HydrationBoundary>` (RESEARCH §Pattern 1).

2. **`<PlantProfile>` client component** — single-scroll layout per UI-SPEC §6: cover photo (full-bleed 4:5), thumbnail strip (last 4 photo entries from preview query), 5 `<InlineEditField>` instances wired to `usePatchPlantField` (D-05 tap-to-edit + D-06 LWW optimistic + sonner rollback toast), photo-journal preview strip (UI-SPEC §6 Section 4 — last 4 thumbnails + "Ver tudo" link to `/catalog/{plantId}/journal`), hidden placeholder sections for care card (Phase 7), active reminders (Phase 8), ID history (Phase 6) per CONTEXT.md scope; overflow `MoreVertical` button opens a popover with the lone "Excluir planta" item. Cover + thumbnail tap → `<Lightbox>` from 05-14 (Wave 1) at the corresponding index — the primitive ships before this plan.

3. **`<DeleteConfirmSheet>`** — composes the 05-13 `<BottomSheet role="alertdialog">` primitive. ICU-pluralised body that selects between four `catalog.profile.delete.body*` variants based on `_meta.{photo_entry_count, reminder_count}` (per D-07 + UI-SPEC §7). Cancelar uses standard React `autoFocus` to win Radix initial focus (05-13 contract). Confirm fires DELETE → optimistic `removeQueries` from `plantsKeys.lists()` partial-match + `useRouter().push("/catalog")`; failure keeps the sheet open and emits `catalog.profile.delete.failure` toast.

**Read-only variant (D-21 / 05-11):** when `useSubscription().readOnly === true`, every `<InlineEditField>` renders with `readOnly={true}`, the overflow `MoreVertical` button is hidden entirely (delete unreachable), and the photo-journal preview strip's `Adicionar foto` tertiary link is hidden. Phase 3's `<ReadOnlyBanner>` is already flipped on by `AppShell` from 05-18 wiring.

**Verification:** TDD task on the LWW mutation hook + cascade-count selector (unit-dom). E2E spec covers: inline-edit blur saves + Enter saves single-line + Esc reverts; delete-confirm cascade counts visible + plant disappears from grid; read-only variant assertions; axe-core in 4 light/dark × reduced-motion/no-preference combos. **Note:** the chunked-mode brief mentioned "extend ROUTES in axe-placeholder-pages with /catalog/{plantId}", but `tests/e2e/axe-placeholder-pages.spec.ts` is for static unauthenticated routes (it `page.goto(route)` without any fixture; see `tests/e2e/axe-placeholder-pages.spec.ts:22`). `/catalog/{plantId}` requires (a) the `authedUser` fixture from 05-01 and (b) a seeded plant. Putting the axe scan inside the dedicated `plant-profile.spec.ts` keeps it green and avoids file-conflict serialization with sibling Wave 4 plans 05-15/17/18.

**Purpose:** deliver CAT-04 (plant profile surfaces), CAT-09 (delete cascade triggered from profile), UI-08 (plant profile + variants).

**Output:** 7 files (4 source, 2 unit tests, 1 E2E spec) all green under `pnpm test:unit` and `pnpm test:e2e -- plant-profile.spec.ts`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md

# Upstream plans (read SUMMARYs after they ship; PLAN.md is the contract until then)
@.planning/phases/05-catalog-meu-jardim/05-11-use-subscription-stub-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-12-combobox-primitive-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-13-bottom-sheet-primitive-PLAN.md

# Existing route + auth helpers (Phase 4)
@src/shared/api/auth.ts
@src/app/(app)/layout.tsx
@src/app/(app)/app-shell.tsx

# Test fixtures + existing E2E spec patterns to mirror
@tests/e2e/axe-placeholder-pages.spec.ts
@tests/e2e/axe-modal-focus-trap.spec.ts

<interfaces>
<!-- All contracts the executor needs. Embedded so no codebase scavenger hunt. -->

### `getPlant` use-case (from 05-07; consumed by Server Component in Task 1)

```typescript
// src/contexts/catalog/application/get-plant.ts (shipped by Plan 05-07)
export type GetPlantResult =
  | { ok: true; plant: PlantRow; _meta: { photo_entry_count: number; reminder_count: number } }
  | { ok: false; code: typeof ErrorCode.NotFound; reason: string };

export async function getPlant(input: { userId: string; plantId: string }): Promise<GetPlantResult>;
```

Cross-user requests return `{ ok: false, code: ErrorCode.NotFound }` (not `forbidden`) — non-disclosure of existence (T-05-16-01 mitigation; ownership filter at SQL layer per Phase 2 D-20). The Server Component maps `ok: false` → `notFound()` from `next/navigation`.

### `listPhotoEntries` use-case (from 05-07; preview strip)

```typescript
// src/contexts/catalog/application/list-photo-entries.ts (shipped by Plan 05-07)
export type PhotoEntryDto = {
  id: string;
  plant_id: string;
  photo_url: string;        // 24h-TTL signed URL (D-20)
  thumbnail_url: string;    // 24h-TTL signed URL
  note: string | null;
  created_at: string;       // ISO-8601 UTC
};

export type ListPhotoEntriesResult =
  | { ok: true; photo_entries: PhotoEntryDto[] }
  | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.Forbidden; reason: string };

export async function listPhotoEntries(input: {
  userId: string;
  plantId: string;
  limit?: number;        // default 50; we pass 4 for the preview strip
  cursor?: string | null;
}): Promise<ListPhotoEntriesResult>;
```

Verifies plant ownership before listing; returns `not_found` if plant missing or owned by another user.

### `<InlineEditField>` (from 05-14; UI-SPEC §12)

```typescript
// src/shared/ui/inline-edit-field.tsx (shipped by Plan 05-14)
export type InlineEditFieldProps = {
  label: string;             // i18n-resolved
  value: string | null;      // null → renders the placeholder copy in italic
  placeholder: string;       // i18n-resolved
  variant: "text" | "textarea" | "date" | "combobox";
  onSave: (newValue: string) => Promise<void>;  // throws on validation/network failure
  readOnly?: boolean;        // when true: read state only, no tap affordance, cursor default
  required?: boolean;        // empty submit blocks (validation visual)
  // combobox-only
  options?: ComboboxOption[];
  // textarea-only
  minRows?: number;
  maxRows?: number;
};

export function InlineEditField(props: InlineEditFieldProps): JSX.Element;
```

State machine: `read → tap → editing → blur/Enter/Cmd+Enter → saving → success → read`. On `onSave` throw: rollback to pre-edit value + render error helper (`role="alert"`). The hook in this plan (`usePatchPlantField`) is the `onSave` callback.

### `<LocationCombobox>` (from 05-12)

```typescript
// src/shared/ui/location-combobox.tsx (shipped by Plan 05-12)
export interface LocationComboboxProps {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (next: string) => void;
  suggestions: string[];     // user's prior locations from GET /api/v1/locations
  disabled?: boolean;
  // ...other forwarded props
}
```

For the inline-edit `combobox` variant we DO NOT mount `<LocationCombobox>` directly inside `<InlineEditField>` — `<InlineEditField variant="combobox" options={merged}>` mounts the underlying `<Combobox>` per its 05-14 contract. The 6-line dedupe normalizer (NFD diacritic-strip + lowercase + trim, mirroring the merge in `<LocationCombobox>` per Plan 05-12) is duplicated inline inside `<PlantProfile>` because Plan 05-12 ships the merge as internal logic, not a public export. Six lines is well below the threshold to justify modifying a shipped plan to expose a helper.

### `<BottomSheet>` (from 05-13)

```typescript
// src/shared/ui/bottom-sheet.tsx (shipped by Plan 05-13)
export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;
  children: ReactNode;
  /** "alertdialog" for destructive surfaces (D-07). Defaults to "dialog". */
  role?: "dialog" | "alertdialog";
  onCloseAutoFocus?: (event: Event) => void;
}

export function BottomSheet(props: BottomSheetProps): JSX.Element;
```

Cancel-first focus contract: place the standard React `autoFocus` attribute on the Cancelar button — Radix initial focus lands there (05-13 unit Test 7).

### `<Lightbox>` (from 05-14; UI-SPEC §9)

```typescript
// src/shared/ui/lightbox.tsx (shipped by Plan 05-14, Wave 1)
export interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: { url: string; alt: string; caption?: string }[];
  initialIndex?: number;
  ariaLabel: string;
}
export function Lightbox(props: LightboxProps): JSX.Element;
```

Plan 05-14 ships the Lightbox in Wave 1 (this plan is Wave 4). Wrap the cover photo + each thumbnail in a `<button>` that opens `<Lightbox open onOpenChange photos={...} initialIndex={i}>` at the corresponding index. Read 05-14 SUMMARY at execute time only to confirm the prop names match the shape above.

### `useSubscription()` (from 05-11)

```typescript
// src/contexts/billing/application/use-subscription.ts (shipped by Plan 05-11)
export type SubscriptionState = { active: boolean; readOnly: boolean };
export function useSubscription(): SubscriptionState;
```

Phase 5 default: `{ active: true, readOnly: false }`. The `tests/e2e/fixtures/read-only.ts` fixture flips it for the read-only assertions in `plant-profile.spec.ts`.

### `plantsKeys` factory (from 05-10)

```typescript
// src/contexts/catalog/queries/index.ts (shipped by Plan 05-10)
export const plantsKeys = {
  all: () => ['catalog', 'plants'] as const,
  lists: (params?: { sort?: string }) => ({
    queryKey: ['catalog', 'plants', 'list', params],
    queryFn: () => listPlants(params ?? {}),
    staleTime: 30_000,
  }),
  detail: (id: string) => ({
    queryKey: ['catalog', 'plant', id],
    queryFn: () => fetchPlantDetail(id),
    staleTime: 60_000,
  }),
  photoEntries: (plantId: string, params?: { limit?: number }) => ({
    queryKey: ['catalog', 'photo-entries', plantId, params ?? {}],
    queryFn: () => fetchPhotoEntries(plantId, params),
    staleTime: 60_000,
  }),
};
export const locationsKeys = {
  all: () => ({
    queryKey: ['catalog', 'locations'],
    queryFn: () => fetchLocations(),
    staleTime: 5 * 60_000,
  }),
};
```

Mutation invalidation pattern: `queryClient.invalidateQueries({ queryKey: plantsKeys.all() })` matches all plant lists (partial-match). For optimistic delete we use `queryClient.removeQueries({ queryKey: plantsKeys.all() })` after a snapshot rollback handler is registered.

### Route handler shapes (from 05-08 + 05-09)

```
GET    /api/v1/plants/[plantId]                  → 200 { plant, _meta }                      | 404 { error: { code: 'not_found', ... } }
PATCH  /api/v1/plants/[plantId]                  → 200 { plant }                              | 422 { error: { code: 'validation_failed', ... } } | 404
DELETE /api/v1/plants/[plantId]                  → 204 (no body)                              | 404 | 5xx
GET    /api/v1/plants/[plantId]/photo-entries    → 200 { photo_entries, next_cursor }         | 404
GET    /api/v1/locations                         → 200 { locations: string[] }                | 401
```

All require `requireVerifiedUser` (Phase 4 D-21). All return the closed-registry error shape `{ error: { code, message, details? } }` per Phase 1 D-11.

### Phase 3 ReadOnlyBanner (already wired by 05-18 / app-shell.tsx)

The `<ReadOnlyBanner active={readOnly} />` line lives in `src/app/(app)/app-shell.tsx`. Plan 05-18 flips its `active` prop to `useSubscription().readOnly`. **This plan does NOT modify app-shell.tsx** — the banner wiring is 05-18's responsibility (Wave 4, parallel).

### `notFound()` from next/navigation

```typescript
import { notFound } from "next/navigation";
// In a Server Component:
const result = await getPlant({ userId, plantId });
if (!result.ok) {
  if (result.code === ErrorCode.NotFound) notFound();
  throw new Error(`getPlant failed unexpectedly: ${result.code}`);
}
```

`notFound()` THROWS — Next.js intercepts and renders `not-found.tsx`. Phase 3 ships a default 404 page; nothing extra needed here.

### `requireVerifiedUser` (from Phase 4 D-21)

```typescript
// src/shared/api/auth.ts
export async function requireVerifiedUser(request: Request): Promise<
  | { ok: true; userId: string; user: VerifiedUserContext }
  | { ok: false; code: ErrorCode.Unauthorized | ErrorCode.Forbidden | ErrorCode.NotFound; reason: string }
>;
```

In Server Components we read `cookies()` instead — the `(app)/layout.tsx` gate already verified the session, so `getSession()` from the auth context is sufficient (mirror `src/app/(app)/layout.tsx:34-52` pattern). The Server Component receives the userId from the session and passes it to `getPlant`.
</interfaces>

<scope_clarifications>
- **Lightbox cover + thumbnail tap.** Plan 05-14 ships `<Lightbox>` in Wave 1; this plan is Wave 4 — the primitive is available. Wrap the cover photo + each thumbnail in a `<button>` that opens `<Lightbox open onOpenChange photos={...} initialIndex={i}>` at the corresponding index. See `<interfaces>` block above for the exact prop shape. Read 05-14 SUMMARY at execute time only to confirm prop names match.
- **LocationCombobox merge — duplicate the 6-line dedupe inline.** Plan 05-12 ships the merge logic as internal `<LocationCombobox>` behavior, NOT as a public helper export. Rather than retroactively modify a shipped plan, duplicate the 6-line normalizer (NFD diacritic-strip + lowercase + trim + Set-based dedupe) inline inside `<PlantProfile>`. Six lines is below the threshold for cross-plan refactor. The merge sources: user suggestions from `useQuery(locationsKeys.all())` (05-10) + i18n defaults from `useTranslations('catalog.locations').raw('defaults')` (05-12 / D-10).
- **Photo-journal `+ Foto` add bottom-sheet** lives on `/catalog/{plantId}/journal` (Plan 05-17 ships that page). The plant-profile preview strip only shows thumbnails + "Ver tudo" link + (when zero entries) `Adicionar foto` tertiary link that navigates to the journal page. NO bottom-sheet wiring in this plan.
- **Care card section (Phase 7), active reminders (Phase 8), ID history (Phase 6)** ship as zero-affordance placeholders. CONTEXT.md `<deferred>` is explicit: "active-reminders surface — Phase 8 placeholder line ... with a 'Criar lembrete' CTA linking to `/settings/notifications` Em breve" — this is the only placeholder copy that emits a CTA in Phase 5 (UI-SPEC §6 Section 3). The other two sections render NOTHING in Phase 5 (UI-SPEC §6 Sections 5/6 say "HIDDEN by default in Phase 5").
- **`<ReadOnlyBanner>`** is wired to `useSubscription().readOnly` by Plan 05-18 in `app-shell.tsx`. This plan only consumes the hook for inline-edit / overflow / preview-strip add-affordance gates. NO modification of app-shell.tsx.
- **Telemetry**: `plant_edited` and `plant_deleted` PostHog events fire SERVER-SIDE inside the PATCH/DELETE route handlers (D-29 + Plan 05-09). This plan ships the client UI; PostHog calls are NOT made from `<PlantProfile>` or its hooks.
- **`messages/pt-BR.json`** keys for `catalog.profile.*` are populated by Plan 05-10 (UI-SPEC § Copywriting Contract) — every key listed in UI-SPEC §6 / §7 / Copywriting Contract is in the bundle by Wave 3. This plan only consumes them via `useTranslations('catalog.profile')`.
- **axe-placeholder-pages.spec.ts deviation**: the chunked-mode brief said to "extend ROUTES in axe-placeholder-pages with /catalog/{plantId}", but that file's `for (const route of ROUTES)` loop calls `page.goto(route)` without any auth fixture (see `tests/e2e/axe-placeholder-pages.spec.ts:22`) — `/catalog/{plantId}` would 401-or-redirect to /login and the axe scan would assert against the login page. We instead put the axe scan inside `tests/e2e/plant-profile.spec.ts` using the `authedUser` fixture. This is the single deviation from the chunked-mode brief; it should propagate to the sibling Wave 4 plans 05-15 and 05-17 (also auth-required surfaces).
</scope_clarifications>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Server Component data fetch + <PlantProfile> client composition</name>
  <files>
    - src/app/(app)/catalog/[plantId]/page.tsx (NEW — Server Component)
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx (NEW — client component)
    - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts (NEW — TDD target)
    - tests/unit/use-plant-profile-mutations.test.tsx (NEW — TDD harness)
  </files>
  <behavior>
    Implements D-04, D-05 (inline-edit save-on-blur), D-06 (LWW optimistic with rollback) and the read-only variant per D-21.

    **TDD target = `usePatchPlantField` hook** (`use-plant-profile-mutations.ts`). The hook is the deterministic I/O surface — given an input field and a value, the hook produces an optimistic cache write, fires the PATCH, and either merges the server response into the cache (success) or rolls back + emits a sonner toast (failure).

    Unit-dom test cases (each its own `it(...)`):
    - **Test 1 (optimistic apply):** invoking `mutate({ field: 'nickname', value: 'Verdinho' })` synchronously updates `plantsKeys.detail(plantId)` cache to reflect `{ plant: { ..., nickname: 'Verdinho' } }` BEFORE the PATCH promise resolves. Assert via `queryClient.getQueryData(plantsKeys.detail(plantId).queryKey)`.
    - **Test 2 (server merge on success):** when fetch resolves with `{ plant: { ..., nickname: 'Verdinho 2', updated_at: '2026-04-30T...' } }`, the cache value is REPLACED with the server response (not merely the optimistic value retained). LWW per D-06 — server is truth.
    - **Test 3 (rollback on error):** when fetch rejects (or returns 4xx), the cache reverts to the pre-mutation snapshot (the value it held before `mutate` was called). The optimistic write is gone.
    - **Test 4 (toast on error):** the error path invokes the sonner `toast.error(...)` mock with the i18n key `catalog.profile.saveFailure` (test mocks `useTranslations` to return the key as the string). Use `vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))`.
    - **Test 5 (deletePlant optimistic removal):** invoking `useDeletePlant(plantId).mutate()` removes the plant from `plantsKeys.lists()` cache (any list query containing the plant id loses it before the DELETE resolves). On success: NO rollback. On error: cache restored + sonner toast `catalog.profile.delete.failure`.
    - **Test 6 (deletePlant redirect):** on success the hook calls the injected `onSuccess` callback (in production: `router.push("/catalog")`); on error: NO redirect. Inject the callback via hook arg so the test asserts call-count without mocking next/navigation.
    - **Test 7 (read-only guard rejects mutation):** when `useSubscription().readOnly === true` is mocked, calling `usePatchPlantField`'s `mutate` causes the `mutationFn` to throw `ReadOnlyError` BEFORE any network call. Assert `mutate` settles to `error` state AND the global `fetch` mock was NOT invoked. (Defense-in-depth — UI hides the affordance, but the hook also short-circuits.)
  </behavior>
  <action>
    **RED first:**
    1. Create `tests/unit/use-plant-profile-mutations.test.tsx` with tests 1–7 above. Use `@testing-library/react` + `@tanstack/react-query`'s `QueryClient` directly (no provider needed — the hook accepts an optional `queryClient` arg in tests, defaults to `useQueryClient()` in production). Mock `next-intl`'s `useTranslations` minimally (return a passthrough function `(key) => key`). Mock `sonner` as shown in Test 4. Mock `fetch` globally via `vi.stubGlobal('fetch', vi.fn())`. Run `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx` — expect import failure on `@app/(app)/catalog/[plantId]/use-plant-profile-mutations` because the file doesn't exist yet. Commit RED: `test(05-16): add failing tests for plant-profile mutation hooks (LWW + optimistic delete)`.

    **GREEN — Step A (hooks):**
    2. Create `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts` with `"use client"` directive at the top. Implement `usePatchPlantField` and `useDeletePlant` per the test contract:
       ```ts
       export function usePatchPlantField(plantId: string, opts?: {
         queryClient?: QueryClient;     // test seam
         onErrorToast?: (key: string) => void;  // defaults to sonner toast.error
       }) {
         const qc = opts?.queryClient ?? useQueryClient();
         const t = useTranslations("catalog.profile");
         const subscription = useSubscription();
         return useMutation({
           mutationFn: async ({ field, value }: { field: PatchableField; value: string }) => {
             if (subscription.readOnly) throw new ReadOnlyError();   // test 7 — throws before fetch
             const res = await fetch(`/api/v1/plants/${plantId}`, {
               method: "PATCH",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ [field]: value === "" ? null : value }),
             });
             if (!res.ok) {
               const body = await res.json().catch(() => null);
               throw new PatchFailedError(body?.error?.code ?? "unknown");
             }
             return (await res.json()) as { plant: PlantDto };
           },
           onMutate: async ({ field, value }) => {
             await qc.cancelQueries({ queryKey: ["catalog", "plant", plantId] });
             const previous = qc.getQueryData<PlantDetailDto>(["catalog", "plant", plantId]);
             if (previous) {
               qc.setQueryData<PlantDetailDto>(["catalog", "plant", plantId], {
                 ...previous,
                 plant: { ...previous.plant, [field]: value === "" ? null : value },
               });
             }
             return { previous };
           },
           onError: (_err, _vars, ctx) => {
             if (ctx?.previous) qc.setQueryData(["catalog", "plant", plantId], ctx.previous);
             const emit = opts?.onErrorToast ?? ((k: string) => toast.error(k));
             emit(t("saveFailure"));
           },
           onSuccess: (data) => {
             // LWW per D-06 — replace with server truth, not merge.
             qc.setQueryData(["catalog", "plant", plantId], (prev: PlantDetailDto | undefined) =>
               prev ? { ...prev, plant: data.plant } : prev,
             );
           },
         });
       }
       ```
       `useDeletePlant` follows the same shape with optimistic `removeQueries` against `plantsKeys.lists()`-shaped keys (use `predicate: (q) => q.queryKey[0] === 'catalog' && q.queryKey[1] === 'plants'` for partial-match removal); `onSuccess` calls `opts?.onSuccess?.()` (production: `router.push("/catalog")`); `onError` restores via the same snapshot pattern + emits `delete.failure` toast.

    3. Run `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx` — all 7 tests must pass.

    4. Commit GREEN: `feat(05-16): implement usePatchPlantField + useDeletePlant LWW optimistic mutation hooks`.

    **GREEN — Step B (Server Component + PlantProfile composition):**
    5. Create `src/app/(app)/catalog/[plantId]/page.tsx` (Server Component, no `"use client"`):
       ```tsx
       import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
       import { notFound } from "next/navigation";
       import { getSession } from "@shared/api/session";  // existing helper from Phase 4
       import { getPlant } from "@contexts/catalog/application/get-plant";
       import { listPhotoEntries } from "@contexts/catalog/application/list-photo-entries";
       import { plantsKeys } from "@contexts/catalog/queries";
       import { ErrorCode } from "@shared/config/errors";
       import { PlantProfile } from "./plant-profile";

       export default async function PlantProfilePage({ params }: { params: Promise<{ plantId: string }> }) {
         const { plantId } = await params;       // Next 16 App Router — params is a Promise
         const session = await getSession();      // (app)/layout.tsx already gated this
         if (!session) notFound();                 // defensive — should be unreachable

         const plantResult = await getPlant({ userId: session.userId, plantId });
         if (!plantResult.ok) {
           if (plantResult.code === ErrorCode.NotFound) notFound();
           throw new Error(`getPlant failed: ${plantResult.code}`);
         }

         // Photo-journal preview strip — UI-SPEC §6 Section 4 (limit 4)
         const photoEntriesResult = await listPhotoEntries({
           userId: session.userId,
           plantId,
           limit: 4,
         });
         const photoEntries = photoEntriesResult.ok ? photoEntriesResult.photo_entries : [];

         // SSR'd data into TQ cache for client hydration (RESEARCH Pattern 1).
         const queryClient = new QueryClient();
         queryClient.setQueryData(["catalog", "plant", plantId], {
           plant: plantResult.plant,
           _meta: plantResult._meta,
         });
         queryClient.setQueryData(["catalog", "photo-entries", plantId, { limit: 4 }], {
           photo_entries: photoEntries,
         });

         return (
           <HydrationBoundary state={dehydrate(queryClient)}>
             <PlantProfile plantId={plantId} />
           </HydrationBoundary>
         );
       }
       ```
       Verify the exact session-helper export name by reading `src/shared/api/auth.ts` at write time — `requireVerifiedUser` is the request-scoped variant; the Server Component variant is `getSession()` or `getServerSession()` depending on Phase 4 plumbing. Use grep: `grep -n "export " src/shared/api/auth.ts src/shared/api/session.ts 2>/dev/null`. If neither exists, lift the same `cookies()` + Supabase pattern used in `src/app/(app)/layout.tsx:34-52`.

    6. Create `src/app/(app)/catalog/[plantId]/plant-profile.tsx` (`"use client"`). Layout per UI-SPEC §6:
       - Top bar: back chevron (Lucide `ChevronLeft`), overflow `MoreVertical` (HIDDEN when `useSubscription().readOnly`); the overflow popover uses Phase 3's existing primitive (or Radix `<DropdownMenu>` if no popover primitive ships) — verify by grep'ing `src/shared/ui/` at write time. The popover has ONE item: "Excluir planta" (`catalog.profile.overflow.delete`) → opens `<DeleteConfirmSheet>` (Task 2).
       - Section 1 — Cover + thumbnail strip: cover from `plant.cover_photo_url` (already a 24h-TTL signed URL per D-20), 4:5 aspect via Tailwind `aspect-[4/5]`. Thumbnail strip below: maps over `photoEntries` (limit 4 from the SSR'd preview query), 64×80 px tiles. Wrap cover + each thumbnail in a `<button>` that opens `<Lightbox>` from 05-14 (Wave 1, ships before this plan) at the corresponding index — see `<interfaces>` block for the prop shape.
       - Section 2 — `<InlineEditField>` × 5:
         - **Name** (`variant="text"`, `required={true}`): `value={plant.name}`, `onSave={async (v) => patchMutation.mutateAsync({ field: 'name', value: v })}`. Empty submit blocks (InlineEditField's `required` handles the in-field validation visual + `catalog.profile.fields.name.requiredError`).
         - **Apelido** (`variant="text"`): same shape, `field: 'nickname'`. Empty allowed → `null` server-side.
         - **Localização** (`variant="combobox"`, `options={mergedLocationOptions}`): merged options come from a `useQuery(locationsKeys.all())` call inside `<PlantProfile>`. Inline the 6-line dedupe normalizer (NFD diacritic-strip + lowercase + trim + Set-based dedupe — same shape as Plan 05-12's internal merge, see `<scope_clarifications>` for rationale):
           ```ts
           const norm = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
           const seen = new Set<string>();
           const mergedLocationOptions: ComboboxOption[] = [];
           const t = useTranslations('catalog.locations');
           for (const label of [...(suggestionsQuery.data?.locations ?? []), ...(t.raw('defaults') as string[])]) {
             const key = norm(label);
             if (key && !seen.has(key)) { seen.add(key); mergedLocationOptions.push({ value: label, label }); }
           }
           ```
         - **Adicionada em** (`variant="date"`): `value={plant.acquisition_date}` (ISO date string or null), `onSave` PATCHes `acquisition_date`. Date format on display follows Phase 3's `formatDate(value, "pt-BR")` helper.
         - **Notas** (`variant="textarea"`, `minRows={4}`, `maxRows={10}`): `field: 'notes'`.
       - Section 3 — Active reminders placeholder (UI-SPEC §6 Section 3): renders `LEMBRETES ATIVOS` section label + body copy `catalog.profile.reminders.empty` + tertiary text link `catalog.profile.reminders.cta` → href `/settings/notifications` (Phase 8 destination; Phase 5 routes there for the `Em breve` placeholder).
       - Section 4 — Photo-journal preview strip (UI-SPEC §6 Section 4): section label `DIÁRIO DE FOTOS` + tertiary `Ver tudo` link to `/catalog/{plantId}/journal`. If `photoEntries.length > 1` (count > cover): horizontal-scroll strip of last 4 thumbnails. If `photoEntries.length === 0 || === 1`: empty hint copy `catalog.profile.journal.empty` + tertiary `catalog.profile.journal.addCta` link to the journal page (HIDDEN when `readOnly`).
       - Sections 5 + 6 — ID history (Phase 6) + Care card (Phase 7): render NOTHING in Phase 5 per UI-SPEC §6 Sections 5/6 ("HIDDEN by default in Phase 5"). No DOM, no placeholder text — just absent sections so a11y reading order isn't polluted with empty headings.
       - Read-only variant: when `useSubscription().readOnly === true`, all 5 `<InlineEditField>` instances pass `readOnly={true}`, the overflow `MoreVertical` button is conditionally not rendered, and the photo-journal preview strip's `addCta` link is conditionally not rendered.
    7. Run `pnpm typecheck` to confirm Server Component imports compile (especially the `params: Promise<...>` Next 16 contract).
    8. Commit GREEN: `feat(05-16): plant profile Server Component + PlantProfile client composition (cover, gallery, 5 inline-edit fields, hidden Phase 6/7/8 placeholders, read-only variant)`.
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx && pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/plant-profile.tsx | grep -c "InlineEditField" | grep -E "^[5-9]|^[1-9][0-9]+$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/page.tsx | grep -c "notFound" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/use-plant-profile-mutations.ts | grep -c "useSubscription" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/page.tsx | grep -c "HydrationBoundary" | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - All 7 unit tests in `tests/unit/use-plant-profile-mutations.test.tsx` pass.
    - `pnpm typecheck` clean across the workspace.
    - Server Component fetches `getPlant` + `listPhotoEntries(limit: 4)`, dehydrates queryClient, hands off to `<PlantProfile>` via `<HydrationBoundary>`. Cross-user requests render `notFound()`.
    - `<PlantProfile>` mounts 5 `<InlineEditField>` instances wired through `usePatchPlantField` (LWW optimistic), an overflow `MoreVertical` trigger, photo-journal preview strip with `Ver tudo` link, and Phase 6/7/8 placeholder sections per UI-SPEC §6.
    - Read-only variant hides inline-edit affordances, the overflow button, and the photo-journal `addCta` link when `useSubscription().readOnly === true`.
    - Both commits (RED + GREEN-A + GREEN-B) created.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: <DeleteConfirmSheet> with cascade-count body variants + optimistic delete wiring</name>
  <files>
    - src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx (NEW)
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx (MODIFY — wire the overflow → sheet → mutation)
    - tests/unit/delete-confirm-sheet.test.tsx (NEW — TDD harness)
  </files>
  <behavior>
    Implements D-07 cascade-counts confirm sheet + UI-SPEC §7 destructive-confirmation rule. The sheet body picks one of FOUR ICU-pluralised i18n keys based on `_meta.{photo_entry_count, reminder_count}`.

    Unit-dom test cases:
    - **Test 1 (bodyBoth):** rendering with `_meta={{ photo_entry_count: 3, reminder_count: 2 }}` produces text matching `catalog.profile.delete.bodyBoth` (mock `useTranslations` to return `t(key) => key + ":" + JSON.stringify(values)` so the test asserts both the key chosen AND the count values fed to the formatter).
    - **Test 2 (bodyPhotosOnly):** `{ photo_entry_count: 5, reminder_count: 0 }` → uses `bodyPhotosOnly` key; `reminderCount` not passed.
    - **Test 3 (bodyRemindersOnly):** `{ photo_entry_count: 0, reminder_count: 1 }` → uses `bodyRemindersOnly` key.
    - **Test 4 (bodyEmpty):** `{ photo_entry_count: 0, reminder_count: 0 }` → uses `bodyEmpty` key (no count interpolation).
    - **Test 5 (alertdialog role pass-through):** the rendered DOM contains `[role="alertdialog"]` (querySelector inside `document.body` because Radix portals out of the React tree).
    - **Test 6 (autoFocus on Cancelar):** after sheet open + portal mount, `document.activeElement` carries `data-testid="delete-confirm-cancel"`. Use `await waitFor(...)` because Radix focus management runs after mount.
    - **Test 7 (Cancelar onClick closes sheet):** clicking Cancelar invokes `onOpenChange(false)` exactly once.
    - **Test 8 (Excluir planta onClick fires deleteMutation):** clicking the destructive button invokes the injected `onConfirm` callback exactly once. Inject `onConfirm` via prop so the test asserts call-count without mocking the hook.
    - **Test 9 (Excluir layout-secondary):** the Cancelar button's DOM order is BEFORE Excluir planta (querySelector `[data-testid="delete-confirm-cancel"]` and `[data-testid="delete-confirm-confirm"]` and assert `compareDocumentPosition` returns `Node.DOCUMENT_POSITION_FOLLOWING` for confirm relative to cancel) — proves PRD §17 destructive layout-secondary rule.
    - **Test 10 (Excluindo state):** when prop `isDeleting={true}` is set, the Excluir button label switches to `catalog.profile.delete.deleting` and the button is disabled.

    No tests for the optimistic-removal cache contract — that lives in Task 1's `useDeletePlant` hook tests (Tests 5/6).
  </behavior>
  <action>
    **RED first:**
    1. Create `tests/unit/delete-confirm-sheet.test.tsx` with all 10 cases above. Mock `useTranslations` in the format described (key + values trace). Mock `<BottomSheet>` minimally — actually, prefer to render the REAL `<BottomSheet>` from `@shared/ui/bottom-sheet` so the role pass-through test (Test 5) and autoFocus contract (Test 6) exercise the real Radix portal. Use `@testing-library/react` `render`.
    2. Run `pnpm exec vitest --run --project=unit-dom tests/unit/delete-confirm-sheet.test.tsx` — expect import failure on `./delete-confirm-sheet`. Commit RED: `test(05-16): add failing tests for DeleteConfirmSheet cascade-count variant + alertdialog + autoFocus contract`.

    **GREEN:**
    3. Create `src/app/(app)/catalog/[plantId]/delete-confirm-sheet.tsx`:
       ```tsx
       "use client";
       import { useTranslations } from "next-intl";
       import { BottomSheet } from "@shared/ui/bottom-sheet";

       export interface DeleteConfirmSheetProps {
         open: boolean;
         onOpenChange: (open: boolean) => void;
         plantNameOrNickname: string;
         photoEntryCount: number;
         reminderCount: number;
         onConfirm: () => void | Promise<void>;
         isDeleting?: boolean;
       }

       export function DeleteConfirmSheet(props: DeleteConfirmSheetProps) {
         const t = useTranslations("catalog.profile.delete");

         const bothPositive = props.photoEntryCount > 0 && props.reminderCount > 0;
         const onlyPhotos = props.photoEntryCount > 0 && props.reminderCount === 0;
         const onlyReminders = props.photoEntryCount === 0 && props.reminderCount > 0;

         const bodyKey = bothPositive ? "bodyBoth"
                       : onlyPhotos ? "bodyPhotosOnly"
                       : onlyReminders ? "bodyRemindersOnly"
                       : "bodyEmpty";

         const bodyValues =
           bothPositive ? { photoCount: props.photoEntryCount, reminderCount: props.reminderCount }
           : onlyPhotos ? { photoCount: props.photoEntryCount }
           : onlyReminders ? { reminderCount: props.reminderCount }
           : {};

         return (
           <BottomSheet
             open={props.open}
             onOpenChange={props.onOpenChange}
             role="alertdialog"
             title={t("title", { nameOrNickname: props.plantNameOrNickname })}
             closeLabel={t("cancel")}
           >
             <p className="...calm-slate body...">
               {t(bodyKey, bodyValues)}
             </p>
             <div className="mt-6 flex flex-col gap-3">
               <button
                 type="button"
                 autoFocus  /* Cancel-first per UI-SPEC §7 + 05-13 contract */
                 data-testid="delete-confirm-cancel"
                 onClick={() => props.onOpenChange(false)}
                 className="...secondary canopy stroke..."
               >
                 {t("cancel")}
               </button>
               <button
                 type="button"
                 data-testid="delete-confirm-confirm"
                 disabled={props.isDeleting}
                 onClick={() => { void props.onConfirm(); }}
                 className="...destructive urgent-poppy fill..."
               >
                 {props.isDeleting ? t("deleting") : t("confirm")}
               </button>
             </div>
           </BottomSheet>
         );
       }
       ```
       Notes:
       - Cancelar BEFORE Excluir in JSX → DOM order matches PRD §17 destructive layout-secondary rule. The vertical stack on mobile renders Cancelar above Excluir visually (Test 9).
       - `autoFocus` is the standard React attribute — `<BottomSheet>` 05-13 contract guarantees Radix initial-focus lands on it.
       - `t("title", { nameOrNickname })` interpolates the headline (`Excluir {nameOrNickname}?`).
       - `t(bodyKey, bodyValues)` selects one of 4 keys + plural-formatted counts.

    4. Wire `<DeleteConfirmSheet>` into `<PlantProfile>` (`plant-profile.tsx`):
       - Add local state `const [deleteOpen, setDeleteOpen] = useState(false);`.
       - The overflow popover's "Excluir planta" item handler: `() => setDeleteOpen(true)`.
       - Mount the sheet:
         ```tsx
         <DeleteConfirmSheet
           open={deleteOpen}
           onOpenChange={setDeleteOpen}
           plantNameOrNickname={plant.nickname ?? plant.name}
           photoEntryCount={meta.photo_entry_count}
           reminderCount={meta.reminder_count}
           isDeleting={deleteMutation.isPending}
           onConfirm={async () => {
             await deleteMutation.mutateAsync();
             setDeleteOpen(false);
           }}
         />
         ```
       - `deleteMutation` = `useDeletePlant(plantId, { onSuccess: () => router.push("/catalog") })`. The mutation's optimistic `removeQueries({ queryKey: plantsKeys.all() })` is what makes the plant disappear from the catalog grid before the redirect lands.

    5. Run `pnpm exec vitest --run --project=unit-dom tests/unit/delete-confirm-sheet.test.tsx` — all 10 tests pass.
    6. Run `pnpm typecheck` — clean.
    7. Commit GREEN: `feat(05-16): DeleteConfirmSheet with ICU cascade-count body variants + autoFocus Cancelar + optimistic delete wiring`.
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit-dom tests/unit/delete-confirm-sheet.test.tsx && pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/delete-confirm-sheet.tsx | grep -c 'role="alertdialog"' | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/delete-confirm-sheet.tsx | grep -c "autoFocus" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/delete-confirm-sheet.tsx | grep -E "bodyBoth|bodyPhotosOnly|bodyRemindersOnly|bodyEmpty" | wc -l | tr -d ' ' | grep -E "^[4-9]|^[1-9][0-9]+$"</gate>
  </verify>
  <done>
    - All 10 unit tests in `tests/unit/delete-confirm-sheet.test.tsx` pass.
    - `pnpm typecheck` clean.
    - The sheet renders `role="alertdialog"`, places initial focus on Cancelar via `autoFocus`, picks one of 4 cascade-count body variants based on `_meta`, and exposes `onConfirm` for the consumer to wire the deleteMutation.
    - `<PlantProfile>` opens the sheet from the overflow popover, wires `useDeletePlant` (Task 1) for optimistic removal + redirect, and the `Excluindo…` state lights when the mutation is pending.
    - Both commits (RED + GREEN) created.
  </done>
</task>

<task type="auto">
  <name>Task 3: Playwright E2E spec — inline-edit + delete confirm + read-only + axe</name>
  <files>
    - tests/e2e/plant-profile.spec.ts (NEW)
  </files>
  <action>
    Create `tests/e2e/plant-profile.spec.ts` exercising the full plant-profile surface against a real Chromium + real Postgres dev DB. Uses the `authedUser` Playwright fixture from 05-01 (server-side `supabase.auth.admin.createUser` + verified user + cookie injection) and the `read-only.ts` fixture from 05-01 + 05-11 (env-driven `SUBSCRIPTION_READ_ONLY=1` flip).

    **Six scenarios:**

    1. **Inline-edit blur saves (CAT-04, D-05):**
       ```ts
       test("inline-edit nickname saves on blur", async ({ authedUser, page }) => {
         const plantId = await seedPlant(authedUser, { name: "Samambaia", nickname: null });
         await page.goto(`/catalog/${plantId}`);
         await page.getByTestId("inline-edit-nickname").click();
         await page.keyboard.type("Verdinho");
         await page.locator("body").click({ position: { x: 0, y: 0 } });  // blur
         await expect(page.getByTestId("inline-edit-nickname")).toContainText("Verdinho");
         // Reload — server is truth.
         await page.reload();
         await expect(page.getByTestId("inline-edit-nickname")).toContainText("Verdinho");
       });
       ```

    2. **Inline-edit Enter saves single-line (D-05):**
       ```ts
       test("inline-edit name saves on Enter (single-line)", async ({ authedUser, page }) => {
         const plantId = await seedPlant(authedUser, { name: "Original" });
         await page.goto(`/catalog/${plantId}`);
         await page.getByTestId("inline-edit-name").click();
         await page.keyboard.press("Control+a");
         await page.keyboard.type("Novo nome");
         await page.keyboard.press("Enter");
         await expect(page.getByTestId("inline-edit-name")).toContainText("Novo nome");
       });
       ```

    3. **Inline-edit Esc reverts (D-05):**
       ```ts
       test("inline-edit Esc reverts to pre-edit value", async ({ authedUser, page }) => {
         const plantId = await seedPlant(authedUser, { nickname: "Verdinho" });
         await page.goto(`/catalog/${plantId}`);
         await page.getByTestId("inline-edit-nickname").click();
         await page.keyboard.press("Control+a");
         await page.keyboard.type("Outro nome");
         await page.keyboard.press("Escape");
         await expect(page.getByTestId("inline-edit-nickname")).toContainText("Verdinho");
       });
       ```

    4. **Delete confirm cascade counts + plant disappears from grid (CAT-09, D-07):**
       ```ts
       test("delete confirm shows cascade counts + plant removed from /catalog", async ({ authedUser, page }) => {
         const plantId = await seedPlant(authedUser, {
           name: "ParaExcluir",
           photoCount: 3,        // helper seeds 2 extra PhotoEntry rows beyond the cover
           reminderCount: 2,     // helper seeds 2 Reminder rows
         });
         await page.goto(`/catalog/${plantId}`);
         await page.getByTestId("plant-overflow-trigger").click();
         await page.getByTestId("plant-overflow-delete").click();
         // alertdialog rendered with cascade counts in the body
         const alert = page.getByRole("alertdialog");
         await expect(alert).toBeVisible();
         await expect(alert).toContainText(/3 fotos? do diário/);
         await expect(alert).toContainText(/2 lembretes?/);
         // Cancelar receives initial focus (UI-SPEC §7 + 05-13 contract)
         await expect(page.getByTestId("delete-confirm-cancel")).toBeFocused();
         // Confirm
         await page.getByTestId("delete-confirm-confirm").click();
         await expect(page).toHaveURL("/catalog");
         await expect(page.getByText("ParaExcluir")).toHaveCount(0);
       });
       ```

    5. **Read-only variant hides affordances (D-21):**
       ```ts
       test.describe("read-only variant", () => {
         test.use({ storageState: undefined });   // we'll use the read-only fixture instead
         test("inline-edit + overflow hidden when readOnly", async ({ readOnlyAuthedUser, page }) => {
           const plantId = await seedPlant(readOnlyAuthedUser, { name: "ReadOnlyTest" });
           await page.goto(`/catalog/${plantId}`);
           // Inline-edit fields render as static text (no role="button" affordance)
           const nameField = page.getByTestId("inline-edit-name");
           await expect(nameField).toContainText("ReadOnlyTest");
           // Overflow trigger absent
           await expect(page.getByTestId("plant-overflow-trigger")).toHaveCount(0);
         });
       });
       ```
       (The `readOnlyAuthedUser` fixture composes `authedUser` and the env-driven flip from 05-11.)

    6. **Axe-core a11y across 4 colorScheme × reducedMotion combos:**
       ```ts
       const COMBOS = [
         { colorScheme: "light", reducedMotion: "no-preference" },
         { colorScheme: "light", reducedMotion: "reduce" },
         { colorScheme: "dark", reducedMotion: "no-preference" },
         { colorScheme: "dark", reducedMotion: "reduce" },
       ] as const;
       for (const combo of COMBOS) {
         test(`axe /catalog/{plantId} [${combo.colorScheme} / ${combo.reducedMotion}]`, async ({ authedUser, page }) => {
           const plantId = await seedPlant(authedUser, { name: "AxeTest" });
           await page.emulateMedia(combo);
           await page.goto(`/catalog/${plantId}`);
           const results = await new AxeBuilder({ page }).analyze();
           const blocking = results.violations.filter(v => v.impact === "critical" || v.impact === "serious");
           expect(blocking, `serious+critical: ${blocking.map(v => v.id).join(", ")}`).toEqual([]);
         });
       }
       ```

    Notes:
    - **`seedPlant(authedUser, opts)` helper.** Inline in this spec at the top, OR add to `tests/e2e/fixtures/seed-plant.ts` if other Wave 4 plans need it. The helper makes an authenticated `POST /api/v1/plants` (multipart with a fixture image) and returns the created plant id; for `photoCount`/`reminderCount` it makes additional `POST /api/v1/plants/{id}/photo-entries` calls and direct DB inserts for Reminder rows (Reminder routes don't exist in Phase 5 — use the `tests/integration/setup.ts` direct-insert pattern with a service-role client). Keep the helper local to this spec for now; promote later if 05-17 needs it too.
    - **`readOnlyAuthedUser` fixture.** Defined in `tests/e2e/fixtures/read-only.ts` (created by 05-01). It extends `authedUser` and sets `SUBSCRIPTION_READ_ONLY=1` on the dev server before running the test (per 05-11's design decision). Verify the fixture is exported correctly at write time.
    - **`data-testid` requirements on `<PlantProfile>`.** Task 1 + Task 2 must add these testids:
      - `inline-edit-name`, `inline-edit-nickname`, `inline-edit-location`, `inline-edit-acquisition-date`, `inline-edit-notes` (one per field — wired through `<InlineEditField>` via a `data-testid` prop forwarded to its read-state wrapper).
      - `plant-overflow-trigger`, `plant-overflow-delete` (overflow button + the delete menu item).
      - `delete-confirm-cancel`, `delete-confirm-confirm` (already added in Task 2).
      Verify the `<InlineEditField>` 05-14 contract supports `data-testid` forwarding; if not, wrap each instance in `<div data-testid="...">`. Read the 05-14 SUMMARY at write time.
    - **No `axe-placeholder-pages.spec.ts` modification.** That file is for static unauthenticated routes (see `<scope_clarifications>`). All Phase 5 catalog axe coverage lives in dedicated specs (`plant-profile.spec.ts` here; `catalog-grid.spec.ts` for 05-15; `manual-add.spec.ts` + `photo-journal.spec.ts` for 05-17).
    - **Disable retries for deterministic timing:** `test.describe.configure({ retries: 0 })`.

    Run `pnpm test:e2e -- plant-profile.spec.ts` — all scenarios pass. Commit: `test(05-16): plant profile E2E + axe coverage (inline-edit, delete cascade, read-only, axe×4 combos)`.
  </action>
  <verify>
    <automated>pnpm test:e2e -- plant-profile.spec.ts</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' tests/e2e/plant-profile.spec.ts | grep -c "AxeBuilder" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' tests/e2e/plant-profile.spec.ts | grep -c "alertdialog" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' tests/e2e/plant-profile.spec.ts | grep -c "readOnlyAuthedUser\|SUBSCRIPTION_READ_ONLY" | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - `tests/e2e/plant-profile.spec.ts` exists with at least 6 scenarios + 4 axe combos = 10 individual tests, all green under `pnpm test:e2e -- plant-profile.spec.ts`.
    - The spec uses `authedUser` for happy-path + axe scenarios and `readOnlyAuthedUser` (or equivalent fixture from 05-01) for the read-only variant scenario.
    - The cascade-count assertion verifies BOTH the photo count substring AND the reminder count substring in the alertdialog body.
    - The delete-then-grid scenario asserts the URL navigates to `/catalog` AND the deleted plant's name no longer appears.
    - axe finds 0 serious+critical violations in all 4 colorScheme × reducedMotion combos.
    - `tests/e2e/axe-placeholder-pages.spec.ts` is NOT modified — Phase 5 catalog axe coverage lives in dedicated authenticated specs.
    - Commit created.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Client-supplied `plantId` (URL path param) → server fetch | Untrusted input crosses here at every page load and at every PATCH/DELETE. Cross-user spoofing must not disclose existence or counts. |
| Client optimistic state → server PATCH | Client temporarily holds a value the server has not yet validated. Server must round-trip every change; cache must auto-revert on failure. |
| `_meta.{photo_entry_count, reminder_count}` exposure | Aggregated counts about a user's data must never leak across the ownership boundary. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-16-01 | E (Elevation of Privilege) | `src/app/(app)/catalog/[plantId]/page.tsx` Server Component | mitigate | The Server Component calls `getPlant({ userId: session.userId, plantId })`. The use-case (shipped by 05-07) applies the `findByIdForUser` ownership filter at the SQL layer — cross-user requests return `{ ok: false, code: 'not_found' }` (existence non-disclosure per closed error registry). The Server Component maps that result to Next's `notFound()`. Phase 2 D-20 RLS is defense in depth. Verified end-to-end by Task 3 axe scan running under the `authedUser` fixture (cross-user attempt would 404, never reach axe). |
| T-05-16-02 | I (Information Disclosure) | `_meta.{photo_entry_count, reminder_count}` aggregation | mitigate | `_meta` is computed inside `getPlant` AFTER the ownership filter passes — for non-owners the use-case returns before counts are calculated, so the `not_found` response carries no aggregation data. The DeleteConfirmSheet's body interpolates these counts from the cache populated by the SSR'd `getPlant` result; the cache key is plantId-scoped and TanStack Query's IDB persister allowlist (D-17) excludes any aggregated counters from the persisted cache. |
| T-05-16-03 | T (Tampering) | Optimistic update → server PATCH | mitigate | Every `usePatchPlantField` mutation round-trips through `PATCH /api/v1/plants/{plantId}` (handler ships in 05-09 with `requireVerifiedUser` gate + Zod single-field validation per Phase 2 D-19). The client optimistic write is held only in TanStack Query's in-memory cache; on PATCH error the `onError` snapshot rollback (Task 1 Test 3) restores the pre-mutation cache value. The IDB persister's `dehydrateOptions.shouldDehydrateQuery` allowlist (D-17 / 05-10) does NOT persist mutations — only successful query data. A determined attacker with browser devtools can mutate the in-memory cache, but every server action independently validates ownership; flipping the cache locally yields hidden affordances that 4xx on submit (acceptable surface — the cache is a UI-affordance helper, not a security boundary, mirroring T-05-11-03 from Plan 05-11). |
| T-05-16-04 | I (Information Disclosure) | Read-only mode bypass | accept | `useSubscription().readOnly` is read client-side. A devtools-savvy attacker can override the React context value and unhide the inline-edit affordances; the server-side enforcement (Phase 10 will add subscription gating to PATCH/DELETE handlers) is what actually blocks the mutation. Phase 5 ships only the affordance gate; the security boundary is enforced at the route handler in Phase 10. Acceptable for the stub. |
| T-05-16-05 | D (Denial of Service) | Cascade-count query on every profile open | accept | `getPlant` returns `_meta` from a small COUNT query under the ownership filter — sub-millisecond for typical user catalogs (< 100 plants). No rate-limit risk. |

`block_on_high: true` per outline. T-05-16-01, T-05-16-02, T-05-16-03 are HIGH severity and ALL three have `mitigate` disposition with concrete implementation references. T-05-16-04 is the same client-cache-tampering surface accepted in Plan 05-11 (T-05-11-03) and Phase 10 will close it server-side.
</threat_model>

<verification>

## Plan-Level Checks

After all 3 tasks complete:

```bash
# Unit tests for the mutation hook + cascade-count selector
pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx tests/unit/delete-confirm-sheet.test.tsx

# Type-check the workspace
pnpm typecheck

# Lint
pnpm lint --max-warnings=0

# Full E2E spec (includes axe)
pnpm test:e2e -- plant-profile.spec.ts

# Confirm no client-side env reads (D-21 server-only contract)
grep -rn "process.env.SUBSCRIPTION_READ_ONLY" src/app/\(app\)/catalog/\[plantId\]/
# Expected: ZERO hits — the readOnly value comes from useSubscription(), never from process.env directly.

# Confirm no Drizzle imports in the route page (Phase 2 D-17 — Drizzle confined to infrastructure layer)
grep -rn "drizzle-orm\|drizzle-zod" src/app/\(app\)/catalog/\[plantId\]/
# Expected: ZERO hits.

# Confirm Phase 4 D-21 verified-user gate inheritance
grep -n "getSession\|requireVerifiedUser" src/app/\(app\)/catalog/\[plantId\]/page.tsx
# Expected: ONE call to the session-resolver helper (verify exact name from src/shared/api/auth.ts at write time).
```

## Per-Task Verification Map (05-VALIDATION.md inputs)

| Task ID | Stratum | Test File | Command |
|---------|---------|-----------|---------|
| 05-16-T1 | Unit (unit-dom) | `tests/unit/use-plant-profile-mutations.test.tsx` | `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx` |
| 05-16-T2 | Unit (unit-dom) | `tests/unit/delete-confirm-sheet.test.tsx` | `pnpm exec vitest --run --project=unit-dom tests/unit/delete-confirm-sheet.test.tsx` |
| 05-16-T3 | E2E + Axe | `tests/e2e/plant-profile.spec.ts` | `pnpm test:e2e -- plant-profile.spec.ts` |

VALIDATION.md strata covered:
- **Inline edit (E2E)** — Task 3 scenarios 1–3.
- **Delete confirm sheet (E2E)** — Task 3 scenario 4.
- **Axe Catalog routes** — Task 3 scenario 6 (4 combos under `authedUser`; deviates from chunked-mode brief by NOT using `axe-placeholder-pages.spec.ts` for the auth-required surface — see `<scope_clarifications>`. Recommendation: update VALIDATION.md row "Catalog routes" to "dedicated authed E2E specs (`{plan}-{surface}.spec.ts`)" so sibling Wave 4 plans 05-15 / 05-17 don't have to repeat this deviation note).

</verification>

<success_criteria>
1. `pnpm typecheck` clean across the workspace.
2. `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx` — 7/7 green (LWW optimistic apply + server merge + rollback + toast + delete optimistic + redirect callback + readOnly guard rejecting before fetch).
3. `pnpm exec vitest --run --project=unit-dom tests/unit/delete-confirm-sheet.test.tsx` — 10/10 green (4 cascade-count body variants + alertdialog role + autoFocus Cancelar + Cancelar onClick + Excluir onClick + DOM order + Excluindo state).
4. `pnpm test:e2e -- plant-profile.spec.ts` — all 10 scenarios green (6 functional + 4 axe combos), 0 serious+critical violations across all 4 colorScheme × reducedMotion combos.
5. Server Component `/catalog/{plantId}/page.tsx` uses `notFound()` for cross-user requests AND for legitimately missing plants (T-05-16-01 + T-05-16-02 mitigations satisfied).
6. `<PlantProfile>` mounts 5 `<InlineEditField>` instances + photo-journal preview strip + Phase 6/7/8 hidden placeholders + overflow popover delete trigger; all wired through `usePatchPlantField` (LWW optimistic) and `useDeletePlant` (optimistic grid removal + redirect).
7. `<DeleteConfirmSheet>` composes `<BottomSheet role="alertdialog">`, picks one of 4 ICU body variants based on `_meta`, places initial focus on Cancelar via `autoFocus` (05-13 contract).
8. Read-only variant: when `useSubscription().readOnly === true`, all inline-edit affordances render read-only, the overflow `MoreVertical` is hidden, and the photo-journal preview strip's `addCta` link is hidden — verified by Task 3 scenario 5.
9. CAT-04 (plant profile surfaces), CAT-09 (delete cascade triggered from profile), UI-08 (plant profile + variants) all closed by this plan + upstream 05-07/05-08/05-09 use-cases + handlers.
10. No modification of `tests/e2e/axe-placeholder-pages.spec.ts` — Phase 5 catalog axe coverage lives in authenticated dedicated specs (deviation from chunked-mode brief explicitly documented in `<scope_clarifications>`).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-16-plant-profile-page-SUMMARY.md` per `@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md`. Include:
- Files created (7) and modified (0).
- Test count: 7 unit (mutation hooks) + 10 unit (delete-confirm sheet) + 10 E2E (6 functional + 4 axe) = 27 total.
- LWW + optimistic mutation contract recap (Test 1–3 evidence + the cache snapshot rollback path).
- Cascade-count selector recap (4 i18n key variants).
- Read-only variant outcome (which affordances hidden, which testids dropped).
- Axe a11y outcome (0 serious+critical across 4 combos).
- Threat T-05-16-01/-02/-03 mitigation evidence (test names + assertion shape).
- Hand-off note for downstream phases:
  - Phase 6 closes the ID-history hidden section + populates `species_id`.
  - Phase 7 closes the care-card hidden section.
  - Phase 8 closes the active-reminders hidden section + the `Criar lembrete` CTA destination.
  - Phase 10 wires the real `useSubscription()` and adds server-side subscription gating to PATCH/DELETE handlers (closes T-05-16-04).
- Documented deviation from chunked-mode brief: `tests/e2e/axe-placeholder-pages.spec.ts` NOT extended for `/catalog/{plantId}` — auth-required surface lives in `tests/e2e/plant-profile.spec.ts` instead.
</output>
