---
phase: 5
slug: catalog-meu-jardim
plan: 17
type: execute
wave: 4
depends_on:
  - 05-08
  - 05-09
  - 05-10
  - 05-11
  - 05-12
  - 05-13
  - 05-14
files_modified:
  - src/app/(app)/catalog/add/page.tsx
  - src/app/(app)/catalog/add/add-plant-form.tsx
  - src/app/(app)/catalog/[plantId]/journal/page.tsx
  - src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx
  - src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx
  - tests/unit/add-plant-form.test.tsx
  - tests/unit/photo-journal.test.tsx
  - tests/e2e/catalog-manual-add.spec.ts
  - tests/e2e/catalog-photo-journal.spec.ts
autonomous: true
requirements:
  - CAT-02
  - CAT-03
  - CAT-05
  - CAT-06
  - UI-07
  - UI-11
tags: [catalog, manual-add, photo-journal, ui, lightbox, bottom-sheet]

must_haves:
  truths:
    - "User can navigate to /catalog/add, see name + photo first, fill optional fields below (UI-SPEC §5)"
    - "Selecting a photo renders a local preview immediately; bytes are deferred to submit (D-01)"
    - "Photo bytes are compressed (≤1MB) and EXIF-stripped client-side BEFORE the multipart submit (D-02 / CLAUDE.md / T-05-17-01)"
    - "Submitting with missing name AND missing photo shows per-field Overdue Rust borders + helper text + summary block 'Falta preencher: …' with anchor links (D-04 ≥2-errors threshold)"
    - "Submit auto-focuses the first invalid field regardless of error count (D-04)"
    - "Single multipart POST to /api/v1/plants returns the new plant; user is routed to /catalog/{plantId} on success (D-02)"
    - "Submit failure surfaces a sonner toast and retains the photo preview client-side (UI-SPEC §5 line 247)"
    - "When useSubscription().readOnly is true on /catalog/add, the submit button is hidden and the read-only banner renders (UI-SPEC §5 line 216 + D-21) — page is NOT redirected"
    - "User can navigate to /catalog/{plantId}/journal and see photo entries in reverse chronological order (UI-SPEC §8)"
    - "Tapping a journal entry photo opens the Lightbox at that index (UI-SPEC §8 / §9)"
    - "Tapping '+ Foto' opens a BottomSheet with photo picker + optional note textarea + Adicionar primary button (D-15 / UI-SPEC §8)"
    - "Submitting the journal add sheet POSTs multipart to /api/v1/plants/{plantId}/photo-entries and optimistically prepends the new entry on success (D-15)"
    - "Journal add failure keeps the sheet open with sonner toast; photo bytes are retained client-side (D-15 / UI-SPEC §8 line 421)"
    - "When useSubscription().readOnly is true, the '+ Foto' button is hidden but the Lightbox still works for browsing (D-21 / UI-SPEC §8 line 422)"
    - "/catalog/add and /catalog/{plantId}/journal pass axe-core 0 serious + critical violations across {light,dark} × {no-preference,reduce} via dedicated authed Playwright specs (matches 05-16 pattern; `tests/e2e/axe-placeholder-pages.spec.ts` is NOT modified)"
    - "Journal axe scan covers the BottomSheet OPEN state — sheet opened immediately before AxeBuilder.analyze() per UI-SPEC §8 line 422 a11y gate"
    - "User-typed nickname and notes render via React text-content (no dangerouslySetInnerHTML), so script tags display as literal text"
    - "Lightbox controlled-index contract is owned by 05-14 — this plan mirrors its props for executor reference; 05-14-lightbox-inline-edit-primitives-PLAN.md is canonical. Props: open/onOpenChange/photos[{src,alt?,caption?}]/index/onIndexChange/plantName (builds aria-label internally)"
    - "Each mutation POST (/api/v1/plants and /api/v1/plants/{plantId}/photo-entries) carries Idempotency-Key: crypto.randomUUID() generated once per submit attempt, stored in a useRef, reused across retries from the same form fill, cleared on terminal success (T-05-17-04)"
  artifacts:
    - path: "src/app/(app)/catalog/add/page.tsx"
      provides: "Server Component shell for /catalog/add. Imports `<AddPlantForm>` client child, awaits `useTranslations('catalog.add')` and resolves the read-only flag via the Phase 5 `useSubscription` server seam (or its env-driven equivalent surfaced by 05-11)."
    - path: "src/app/(app)/catalog/add/add-plant-form.tsx"
      provides: "Client component (\"use client\") rendering the manual-add form per UI-SPEC §5 — photo picker first, name + optional fields below, validation summary at ≥2 errors, sticky submit. Uses `compressPlantPhoto` from `@shared/images/client-compress` BEFORE the multipart POST."
      exports: ["AddPlantForm", "AddPlantFormProps"]
    - path: "src/app/(app)/catalog/[plantId]/journal/page.tsx"
      provides: "Server Component shell for /catalog/{plantId}/journal. Fetches plant + photo entries via Phase 5 use-cases (or hydrates the Tkdodo `plantsKeys.photoEntries(plantId)` query). Renders `<PhotoJournal>` with `readOnly` from useSubscription."
    - path: "src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx"
      provides: "Client component reverse-chronological list of photo entries, lightbox-on-tap, '+ Foto' button. Read-only mode hides the '+ Foto' button. Uses `<Lightbox>` from 05-14."
      exports: ["PhotoJournal", "PhotoJournalProps"]
    - path: "src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx"
      provides: "Client component composing `<BottomSheet>` from 05-13: photo picker + note textarea + Adicionar primary + Cancelar secondary. Compresses + EXIF-strips client-side, multipart-POSTs to /api/v1/plants/{plantId}/photo-entries, optimistically prepends via TanStack Query, retains bytes on failure."
      exports: ["JournalAddSheet", "JournalAddSheetProps"]
    - path: "tests/unit/add-plant-form.test.tsx"
      provides: "Vitest unit-dom suite covering: photo preview after selection, validation summary appearing only at ≥2 errors, per-field aria-invalid + helper text, first-invalid auto-focus on submit, compress+strip called before submit, hidden submit + banner in read-only mode, Idempotency-Key header present on POST and reused across retries."
    - path: "tests/unit/photo-journal.test.tsx"
      provides: "Vitest unit-dom suite covering: reverse-chrono ordering, lightbox-on-tap, '+ Foto' visibility flip on readOnly, optimistic prepend on add success, sheet stays open + bytes retained on add failure, user-typed note renders `<script>` text as literal content (T-05-17-02 XSS guard), Idempotency-Key header present on POST and reused across retries."
    - path: "tests/e2e/catalog-manual-add.spec.ts"
      provides: "Dedicated authed Playwright spec — manual-add happy path (form submit → /catalog/{plantId}) AND manual-add validation (missing name + photo → ≥2 errors summary + Overdue Rust borders + first-invalid focused) AND axe scans of /catalog/add across 4 colorScheme × reducedMotion combos with 0 serious/critical violations. Per VALIDATION.md E2E rows 'Manual add happy path' and 'Manual add validation' + Axe Catalog routes stratum."
      contains: "AxeBuilder"
    - path: "tests/e2e/catalog-photo-journal.spec.ts"
      provides: "Dedicated authed Playwright spec — manual-add a plant first (reusing the same flow), navigate to its journal, '+ Foto' opens BottomSheet, submit prepends optimistically, tap thumbnail opens Lightbox, AND axe scans of /catalog/{plantId}/journal with the BottomSheet OPEN across 4 colorScheme × reducedMotion combos with 0 serious/critical violations. Per VALIDATION.md E2E row 'Photo journal' + Axe Catalog routes stratum."
      contains: "AxeBuilder"
  key_links:
    - from: "src/app/(app)/catalog/add/add-plant-form.tsx"
      to: "src/shared/images/client-compress.ts"
      via: "import { compressPlantPhoto } from '@shared/images/client-compress'"
      pattern: "compressPlantPhoto\\("
    - from: "src/app/(app)/catalog/add/add-plant-form.tsx"
      to: "POST /api/v1/plants (from 05-08)"
      via: "fetch('/api/v1/plants', { method: 'POST', body: FormData, headers: { 'Idempotency-Key': idempotencyKeyRef.current } })"
      pattern: "fetch\\([\"'`]/api/v1/plants[\"'`]"
    - from: "src/app/(app)/catalog/add/add-plant-form.tsx"
      to: "src/shared/ui/location-combobox.tsx (from 05-12)"
      via: "import { LocationCombobox } from '@shared/ui/location-combobox'"
      pattern: "LocationCombobox"
    - from: "src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx"
      to: "src/shared/ui/bottom-sheet.tsx (from 05-13)"
      via: "import { BottomSheet } from '@shared/ui/bottom-sheet'"
      pattern: "BottomSheet"
    - from: "src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx"
      to: "POST /api/v1/plants/{plantId}/photo-entries (from 05-08)"
      via: "fetch(`/api/v1/plants/${plantId}/photo-entries`, { method: 'POST', body: FormData, headers: { 'Idempotency-Key': idempotencyKeyRef.current } })"
      pattern: "/photo-entries"
    - from: "src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx"
      to: "src/shared/ui/lightbox.tsx (from 05-14)"
      via: "import { Lightbox } from '@shared/ui/lightbox'"
      pattern: "Lightbox"
    - from: "src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx"
      to: "src/contexts/catalog/queries/index.ts (from 05-10)"
      via: "import { plantsKeys } from '@catalog/queries' for optimistic prepend"
      pattern: "plantsKeys\\.photoEntries"
    - from: "src/app/(app)/catalog/add/add-plant-form.tsx"
      to: "src/contexts/billing/application/use-subscription.ts (from 05-11)"
      via: "import { useSubscription } from '@billing/application/use-subscription'"
      pattern: "useSubscription"
    - from: "tests/e2e/catalog-manual-add.spec.ts"
      to: "tests/e2e/fixtures/authed-user.ts"
      via: "authedUser fixture drives all manual-add scenarios + axe scans"
      pattern: "authedUser"
    - from: "tests/e2e/catalog-photo-journal.spec.ts"
      to: "tests/e2e/fixtures/authed-user.ts"
      via: "authedUser fixture drives all journal scenarios + axe scans"
      pattern: "authedUser"
---

<objective>
Ship the two remaining Phase 5 user-facing surfaces — the **Manual Add** page (`/catalog/add`) and the **Photo Journal** page (`/catalog/{plantId}/journal`) — wiring the primitives delivered by 05-12 / 05-13 / 05-14 against the route handlers delivered by 05-08 / 05-09 and the TanStack Query factory from 05-10.

Purpose: close requirements **CAT-02** (manual create: name + ≥1 photo → Plant + PhotoEntry, surfaced from the user perspective), **CAT-03** (missing name OR photo → `validation_failed` + per-field highlight), **CAT-05** (location picker reuses prior + defaults), **CAT-06** (photo journal add with optional note + reverse-chrono list), **UI-07** (manual-add card geometry), and **UI-11** (photo journal + add entry + read-only variant).

Output: two server-component page shells, three client components (`AddPlantForm`, `PhotoJournal`, `JournalAddSheet`), two Vitest unit-dom suites, and two dedicated authed Playwright E2E specs that ALSO own the axe a11y coverage for these auth-required surfaces. `tests/e2e/axe-placeholder-pages.spec.ts` is NOT modified by this plan — that file is reserved for unauthenticated routes (its `page.goto(route)` at `tests/e2e/axe-placeholder-pages.spec.ts:22` runs without any auth fixture, so adding `/catalog/add` or `/catalog/{plantId}/journal` would scan the login redirect, not the actual page). This plan adopts the same dedicated-authed-spec pattern that 05-16 ships for `/catalog/{plantId}`.

Per the planner brief: this plan is `type: execute`. The brief flagged TDD for the client-side compress/EXIF-strip helper, but `src/shared/images/client-compress.ts` already exists from Phase 02 and is already covered by `tests/unit/image-pipeline.test.ts` — it does NOT need to be (re-)test-driven here. Tasks below CONSUME `compressPlantPhoto`; they do not redefine it.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-08-route-handlers-read-create-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-09-route-handlers-mutate-delete-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-11-use-subscription-stub-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-12-combobox-primitive-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-13-bottom-sheet-primitive-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-14-lightbox-inline-edit-primitives-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-16-plant-profile-page-PLAN.md
@src/shared/images/client-compress.ts
@src/shared/images/limits.ts
@src/shared/ui/text-input.tsx
@src/shared/ui/modal-sheet.tsx
@src/app/(app)/catalog/page.tsx
@CLAUDE.md

<interfaces>
<!-- Contracts the executor needs. Do NOT scavenge the codebase for these. -->

### Already-shipped helpers this plan CONSUMES

```typescript
// From src/shared/images/client-compress.ts (Phase 02-08, already shipped + tested)
export async function compressPlantPhoto(file: File): Promise<File>;
// preserveExif: false (EXIF + GPS strip), maxSizeMB: 1, useWebWorker: true.
// MUST be called from a "use client" component before the multipart POST.

// From src/shared/images/limits.ts
export const CLIENT_COMPRESSION_TARGET_MB = 1;
export const MAX_UPLOAD_BYTES = 1_048_576;
```

```typescript
// From src/shared/ui/text-input.tsx (Phase 03)
export interface TextInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "autoComplete"> {
  label: string;
  autoComplete: string;
  error?: string;
}
export function TextInput(props: TextInputProps);
```

### Primitives delivered by sibling Wave-1 plans this plan CONSUMES

```typescript
// From 05-12: src/shared/ui/location-combobox.tsx
export interface LocationComboboxProps {
  label: string;
  suggestions: string[];      // ordered server-side by usage_count DESC, last_used_at DESC
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  required?: boolean;
  error?: string;
}
export function LocationCombobox(props: LocationComboboxProps): JSX.Element;
```

```typescript
// From 05-13: src/shared/ui/bottom-sheet.tsx
export interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  closeLabel: string;          // i18n string, used as drag-handle aria-label
  role?: "dialog" | "alertdialog";   // default "dialog"; this plan uses "dialog"
  interactiveDragHandle?: boolean;   // default false; this plan sets true
  onCloseAutoFocus?: (event: Event) => void;
  children: ReactNode;
}
export function BottomSheet(props: BottomSheetProps);
```

```typescript
// From 05-14: src/shared/ui/lightbox.tsx
// (Canonical contract owned by 05-14-lightbox-inline-edit-primitives-PLAN.md — mirrored here for executor reference only.)
export interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  photos: Array<{ src: string; alt?: string; caption?: string }>;
  index: number;
  onIndexChange: (next: number) => void;
  plantName: string;           // Lightbox builds aria-label="Galeria — {plantName}" internally
}
export function Lightbox(props: LightboxProps);
```

```typescript
// From 05-11: src/contexts/billing/application/use-subscription.ts
export function useSubscription(): { active: boolean; readOnly: boolean };
// Stub returns { active: true, readOnly: false } unless SUBSCRIPTION_READ_ONLY=1.
```

```typescript
// From 05-10: src/contexts/catalog/queries/index.ts (Tkdodo factory)
export const plantsKeys: {
  lists: (sort: string) => { queryKey: readonly unknown[]; queryFn: () => Promise<unknown>; staleTime: number };
  detail: (id: string) => { queryKey: readonly unknown[]; queryFn: () => Promise<unknown>; staleTime: number };
  photoEntries: (plantId: string) => { queryKey: readonly unknown[]; queryFn: () => Promise<unknown>; staleTime: number };
};
```

### API contracts this plan CONSUMES (defined by 05-08)

```
POST /api/v1/plants
  Auth: requireVerifiedUser (Phase 4 D-21) — cookie session, NOT bearer
  Body: multipart/form-data
    - name: string (required, 1..200 chars)
    - photo: File (required, image/jpeg|image/png|image/webp, ≤1MiB; server rejects GPS)
    - nickname: string (optional)
    - location: string (optional)
    - acquisition_date: string (optional, YYYY-MM-DD)
    - notes: string (optional, ≤4000 chars)
  Idempotency-Key header: optional (Phase 2 D-37)
  Response 201:
    { data: { id: string, name: string, ... }, _meta?: {...} }
  Response 4xx (closed registry only — src/shared/config/errors.ts):
    { error: { code: 'validation_failed' | 'subscription_required' | 'read_only_mode' | 'forbidden', message, details? } }

POST /api/v1/plants/{plantId}/photo-entries
  Auth: requireVerifiedUser
  Body: multipart/form-data
    - photo: File (required, same constraints as above)
    - note: string (optional, ≤2000 chars)
  Idempotency-Key header: optional
  Response 201:
    { data: { id: string, photo_url: string, note: string | null, created_at: string } }
  Response 4xx: same closed registry as above
```

### Pattern conventions to honour (from PATTERNS.md / Phase prior plans)

- **No Drizzle in client components** — these are React components, period. All data flow through the route handlers above.
- **i18n via `next-intl`** — `useTranslations('catalog.add')` / `useTranslations('catalog.journal')` (client) or `getTranslations(...)` (server). All copy lives in `messages/pt-BR.json` under `catalog.*` (extended by 05-10).
- **Validation messages** use the keys listed in UI-SPEC §5 line 234–243 (`nameRequired`, `photoRequired`, `summaryHeader`, etc.). NEVER hardcoded strings.
- **Color discipline (UI-22)** — validation uses Overdue Rust (`border-rust` Tailwind class — see Phase 3 `text-input.tsx:35` precedent), NEVER Urgent Poppy.
- **Snake_case JSON** for API request and response bodies (PRD §5).
- **Closed error registry only** — never invent a new code; map server errors to the existing `validation_failed | not_found | forbidden | read_only_mode | subscription_required` set.

### Pattern reference — 05-16 dedicated-authed-spec axe block (this plan mirrors the structure)

```typescript
// from 05-16-plant-profile-page-PLAN.md Task 3, lines 786-803.
const COMBOS = [
  { colorScheme: "light", reducedMotion: "no-preference" },
  { colorScheme: "light", reducedMotion: "reduce" },
  { colorScheme: "dark", reducedMotion: "no-preference" },
  { colorScheme: "dark", reducedMotion: "reduce" },
] as const;
for (const combo of COMBOS) {
  test(`axe /catalog/{plantId} [${combo.colorScheme} / ${combo.reducedMotion}]`, async ({ authedUser, page }) => {
    /* seed plant; emulateMedia; goto; AxeBuilder.analyze() ... */
  });
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Manual Add page (/catalog/add) + AddPlantForm client component + authed E2E spec (incl. axe)</name>
  <files>
    src/app/(app)/catalog/add/page.tsx,
    src/app/(app)/catalog/add/add-plant-form.tsx,
    tests/unit/add-plant-form.test.tsx,
    tests/e2e/catalog-manual-add.spec.ts
  </files>
  <action>
    Ship `/catalog/add` per **UI-SPEC §5** + **D-01** + **D-02** + **D-04** + **D-21**.

    **A. Server shell** — `src/app/(app)/catalog/add/page.tsx`:
    - Pure async Server Component. Mirror the file shape of `src/app/(app)/catalog/page.tsx:1-14` (already in repo).
    - `await getTranslations('catalog.add')` to pre-resolve labels for the form's static strings (button labels, field labels, summary header). Pass them as props to `<AddPlantForm>` so the form remains testable in unit-dom without a full intl provider — this matches the `EmptyState` propful pattern from Phase 03.
    - Resolve the read-only flag server-side by reading `process.env.SUBSCRIPTION_READ_ONLY === '1'` (the env-driven seam shipped by 05-11), and pass `readOnly` as a prop to `<AddPlantForm>`. Do NOT redirect — UI-SPEC §5 line 216 specifies "Banner active, page falls back to disabled view (D-21)" (the page renders, but submit + form interactivity are gated). Render `<ReadOnlyBanner active={readOnly} />` (Phase 03 primitive at `src/shared/ui/read-only-banner.tsx`) above the form.
    - Page layout: max-w-tablet centered (per CLAUDE.md tablet-width-centered rule), 24px padding top, 16px horizontal padding, bottom-nav-safe-area inset.

    **B. Client form** — `src/app/(app)/catalog/add/add-plant-form.tsx`:
    - Top of file: `"use client"` directive.
    - Export `interface AddPlantFormProps` with props: `readOnly: boolean`, `labels: { /* pre-resolved i18n strings */ }`, optional `initialLocationSuggestions: string[]` (pass `[]` for now; LocationCombobox can fetch lazily via plantsKeys / locationsKeys in a follow-up — out of scope for this task).
    - Field order per UI-SPEC §5 line 201–208:
      1. Photo picker (required) — render a 4:5 aspect card-shaped tap target with dashed Hairline stroke when empty. Use a hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` and a styled `<button type="button">` that triggers it. After selection, render `URL.createObjectURL(file)` preview immediately (D-01). Add a small "Trocar foto" tertiary text link beneath the preview that re-opens the file picker. Track the selected `File` in component state — DO NOT compress on selection (compression happens at submit per D-01 "bytes deferred to submit").
      2. Name (required) — `<TextInput label={labels.name} autoComplete="off" />`.
      3. Apelido (optional) — `<TextInput label={labels.nickname} autoComplete="off" />`.
      4. Localização (optional) — `<LocationCombobox label={labels.location} suggestions={initialLocationSuggestions} value={location} onChange={setLocation} />`.
      5. Data de aquisição (optional) — `<TextInput type="date" label={labels.acquisitionDate} autoComplete="off" />`.
      6. Notas (optional) — styled `<textarea>` matching the TextInput visual contract (Warm Ivory bg, 1.5px Hairline → Canopy stroke on focus). 96px min-height, 240px max-height with scroll.
    - Submit button (sticky-bottom inside the page): full-width Canopy primary, 48px tall, label `labels.submit` (`Adicionar à minha estante`). Disabled while submitting; label flips to `labels.submitLoading` (`Adicionando…`). When `readOnly` is true, the submit button is HIDDEN (NOT disabled — UI-SPEC §5 line 216 specifies "button HIDDEN").
    - Validation contract per **D-04** (≥2-errors threshold, NOT 3+):
      - Compute `errors: Record<'name' | 'photo' | 'acquisitionDate', string | undefined>` on submit.
      - For each invalid field: pass `error={errors.field}` to the input — TextInput already renders the Overdue Rust border + helper line + `aria-invalid="true"` + `aria-describedby` per `text-input.tsx:31-58`. The photo picker needs a hand-rolled equivalent (Overdue Rust border on the dashed dropzone + helper line below + `role="alert"` on the helper paragraph the FIRST time the form is invalid).
      - Summary block — render ONLY when `Object.values(errors).filter(Boolean).length >= 2`:
        - Position: above the photo picker, 16px below page title.
        - Style: 4px Overdue Rust left border, Warm Ivory bg, 8px radius, 16px padding, Plus Jakarta Sans 14/20 weight 600 Forest Ink headline.
        - Headline: ICU-rendered `labels.summaryHeader` with `{fields}` interpolated as a comma-separated list of pt-BR field names (use the pre-resolved `labels.fieldNames.{name,photo,acquisitionDate}` mapping).
        - Body: each invalid field name is an `<a href="#input-{slug}">` anchor link that focuses the corresponding input on click (use `useId`-derived input ids and pass them down to TextInput's `id` prop so the anchors line up).
        - `role="alert"` on the summary block so screen readers announce it on first render.
      - First-invalid auto-focus on submit (regardless of count): after `setErrors`, schedule a `requestAnimationFrame` that focuses the first invalid field (use the same id mapping). UI-SPEC §5 line 231.
      - **Color discipline** — validation uses Overdue Rust ONLY (`border-rust` Tailwind class — see `text-input.tsx:35`). NEVER Urgent Poppy. UI-SPEC §5 line 232.
    - Submit handler:
      1. Build `errors` synchronously. If any errors: `setErrors`, focus first invalid, return.
      2. Call `await compressPlantPhoto(selectedFile)` to compress + strip EXIF (T-05-17-01 client-side defense; server still re-checks per Phase 02 D-30).
      3. Build `FormData`: append `name`, the compressed `photo`, and any of `nickname`, `location`, `acquisition_date`, `notes` whose values are non-empty.
      4. **Idempotency key** (T-05-17-04): declare `const idempotencyKeyRef = useRef<string | null>(null)`. On submit (before the fetch), if `idempotencyKeyRef.current === null` set it to `crypto.randomUUID()`. This ensures retries from the same form fill reuse the same key. Clear it on terminal success (before `router.push`) and on terminal error (when the user can consciously retry — clear after displaying the toast, so the next click generates a fresh key).
      5. `fetch('/api/v1/plants', { method: 'POST', body: formData, credentials: 'same-origin', headers: { 'Idempotency-Key': idempotencyKeyRef.current } })`. Do NOT set `Content-Type` — browser handles multipart boundary.
      6. On success (201): parse JSON → clear `idempotencyKeyRef.current` → `router.push('/catalog/' + data.id)` using `next/navigation` `useRouter`.
      7. On failure: parse `error.code` from the response. If `validation_failed`: surface server-side per-field errors (the route returns `error.details.fields` per closed registry). Otherwise: `toast.error(labels.submitFailure)` via sonner (already in repo from Phase 03). Clear `idempotencyKeyRef.current` after the toast so a manual retry generates a new key. Photo bytes remain in component state — preview persists, user can retry without re-picking. UI-SPEC §5 line 247.
    - **XSS guard** (T-05-17-02): nickname and notes are NEVER rendered via `dangerouslySetInnerHTML` anywhere in this component. They are rendered as React text content only. The Vitest test below proves this.
    - Add `data-testid="add-plant-form"` to the form root wrapper so the Playwright spec can reliably anchor on it for the axe scan.

    **C. Unit-dom tests** — `tests/unit/add-plant-form.test.tsx`:
    - Mock `@shared/images/client-compress` so `compressPlantPhoto` is `vi.fn(async (f: File) => f)` — we are not retesting compression here, only that it is INVOKED before the POST.
    - Mock `next/navigation` `useRouter` returning a `push` spy.
    - Mock global `fetch` per assertion.
    - Test 1 — photo preview: simulate file selection via `fireEvent.change(input, { target: { files: [makeFile()] } })`. Assert that an `<img>` with a `blob:` src appears within the picker region. Assert `compressPlantPhoto` was NOT yet called (deferred to submit per D-01).
    - Test 2 — single-error per-field but NO summary: render with empty form, click submit. Only "name" is invalid (photo also invalid → that's two; instead seed the photo and leave name empty). Assert: the name `<input>` has `aria-invalid="true"`; `<p role="alert">` with name-required helper text appears below; the summary block does NOT render. Assert: name input is the active element after submit.
    - Test 3 — ≥2 errors triggers summary: render empty form, click submit. Assert: summary block (locator: `getByRole('alert', { name: /falta preencher/i })` OR query by border style) IS present, contains anchor links named (case-insensitive) for both Nome and Foto. Assert: clicking the "Nome" anchor focuses the name input. Per D-04 ≥2-errors threshold.
    - Test 4 — compression invoked before fetch: seed valid name + photo, click submit, await microtasks. Assert: `compressPlantPhoto` called with the original File; assert `fetch` called with first arg `'/api/v1/plants'` and second arg's `body` is a FormData containing `'name'` and `'photo'` keys; assert: order of calls — compress BEFORE fetch (`compressPlantPhoto.mock.invocationCallOrder[0] < (fetch as MockedFn).mock.invocationCallOrder[0]`).
    - Test 5 — read-only hides submit: render with `readOnly={true}`. Assert: submit button is NOT in the document (`queryByRole('button', { name: /adicionar à minha estante/i })` is null). UI-SPEC §5 line 216.
    - Test 6 — submit failure retains photo: seed valid form, mock fetch to resolve with 500. Click submit. Assert: photo preview `<img>` is still present; sonner toast was emitted (mock `sonner` `toast.error`); submit button is re-enabled with idle label.
    - Test 7 — Idempotency-Key header present on POST: seed valid form, click submit. Assert: the `fetch` call includes `headers['Idempotency-Key']` that is a valid UUID string (matches `/^[0-9a-f-]{36}$/i`).
    - Test 8 — Idempotency-Key reused across retries, fresh on new submit: seed valid form, mock fetch to reject twice then succeed. First submit attempt → capture `headers['Idempotency-Key']` value (call it `key1`). Second submit attempt (retry, same form fill) → assert `headers['Idempotency-Key']` equals `key1`. Third submit after success → seed form again → assert `headers['Idempotency-Key']` is a NEW UUID different from `key1`.

    **D. Dedicated authed E2E spec (incl. axe)** — `tests/e2e/catalog-manual-add.spec.ts`:
    - Use the `authedUser` Playwright fixture from 05-01: `import { test, expect } from "./fixtures/authed-user";` plus `import AxeBuilder from "@axe-core/playwright";`.
    - This spec OWNS the axe coverage for `/catalog/add`. It does NOT modify `tests/e2e/axe-placeholder-pages.spec.ts` (that file is for unauthenticated routes only — its `for (const route of ROUTES)` loop calls `page.goto(route)` without any fixture; adding `/catalog/add` there would scan the login redirect, not the form).
    - Test "manual add happy path" (per VALIDATION.md row): goto `/catalog/add` → fill name "Hera" → set photo from `tests/e2e/fixtures/sample.jpg` (use the existing 1-pixel sample if present, else seed `tests/e2e/fixtures/sample.jpg` — a minimal real JPEG checked into the repo by the catalog test infra; if absent, use Playwright's `Buffer.from(...)` PNG with a 1×1 pixel base64) → click Adicionar → assert URL matches `/catalog/[a-f0-9-]{36}` → assert plant name appears on the destination page (best-effort: 05-16 ships the profile but if not yet present the URL change alone is the gate). Also assert the POST `/api/v1/plants` request had `Idempotency-Key` header present (intercept via `page.route('/api/v1/plants', ...)` or `request.headers()['idempotency-key']` from a `page.on('request', ...)` listener scoped to the POST).
    - Test "manual add validation" (per VALIDATION.md row): goto `/catalog/add` → click submit with empty form → assert summary block visible with text matching `Falta preencher` → assert at least 2 inputs have `aria-invalid="true"` → assert the first invalid input is the active element (`expect(page.locator(':focus')).toHaveAttribute('aria-invalid', 'true')`).
    - **Axe a11y across 4 colorScheme × reducedMotion combos** (mirrors 05-16 exactly):
      ```typescript
      const COMBOS = [
        { colorScheme: "light", reducedMotion: "no-preference" },
        { colorScheme: "light", reducedMotion: "reduce" },
        { colorScheme: "dark", reducedMotion: "no-preference" },
        { colorScheme: "dark", reducedMotion: "reduce" },
      ] as const;
      for (const combo of COMBOS) {
        test(`axe /catalog/add [${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`, async ({ page, authedUser }) => {
          await page.emulateMedia(combo);
          await page.goto('/catalog/add');
          await page.waitForSelector('[data-testid="add-plant-form"]');
          const results = await new AxeBuilder({ page }).analyze();
          const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
          expect(blocking, `serious + critical: ${blocking.map(v => v.id).join(', ')}`).toEqual([]);
        });
      }
      ```
    - `test.describe.configure({ retries: 0 })` for deterministic timing (matches 05-16 pattern).

    **Test data fixture note** — if `tests/e2e/fixtures/sample.jpg` does not exist, this task creates it. Use a minimal valid JPEG (~1KB, no EXIF) committed as binary. The same fixture is reused by Task 2.
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit-dom tests/unit/add-plant-form.test.tsx &amp;&amp; pnpm exec playwright test tests/e2e/catalog-manual-add.spec.ts --project=chromium</automated>
  </verify>
  <done>
    - `/catalog/add` renders the form per UI-SPEC §5 with photo + name first, optional fields below, submit at the bottom.
    - Selecting a file shows the local preview immediately; compress + EXIF strip runs at submit (Vitest Test 4 invocation-order assertion green).
    - Submitting empty form shows summary block + per-field Overdue Rust borders + first-invalid focus (Vitest Tests 2/3 + Playwright validation spec green).
    - Submitting valid form posts to `/api/v1/plants` with `Idempotency-Key` header and routes to `/catalog/{plantId}` (Vitest Tests 7/8 + Playwright happy-path spec green).
    - read-only mode hides the submit button and renders the read-only banner (Vitest Test 5 green).
    - Submit failure retains the photo preview and surfaces a sonner toast (Vitest Test 6 green).
    - Axe scans of `/catalog/add` across 4 colorScheme × reducedMotion combos return 0 serious + critical violations (4 axe tests in `catalog-manual-add.spec.ts` green).
    - `tests/e2e/axe-placeholder-pages.spec.ts` is NOT modified by this task.
    - All new files compile (`pnpm tsc --noEmit` clean), pass `pnpm lint`.
  </done>
</task>

<task type="auto">
  <name>Task 2: Photo Journal page (/catalog/[plantId]/journal) + PhotoJournal + JournalAddSheet + authed E2E spec (incl. axe with sheet open)</name>
  <files>
    src/app/(app)/catalog/[plantId]/journal/page.tsx,
    src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx,
    src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx,
    tests/unit/photo-journal.test.tsx,
    tests/e2e/catalog-photo-journal.spec.ts
  </files>
  <action>
    Ship `/catalog/{plantId}/journal` per **UI-SPEC §8** + **D-14** + **D-15** + **D-21**.

    **A. Server shell** — `src/app/(app)/catalog/[plantId]/journal/page.tsx`:
    - Async Server Component receiving `params: { plantId: string }`.
    - Resolve the read-only flag the same way Task 1 does (`process.env.SUBSCRIPTION_READ_ONLY === '1'`).
    - Fetch the plant via the catalog `getPlant` use-case shipped by 05-07 (or call the API route `/api/v1/plants/{plantId}` server-side via the same internal call pattern Phase 04 established for `iam/me`); fetch the photo entries via `listPhotoEntries` (05-07). 404 → `notFound()` from `next/navigation`.
    - Pre-resolve i18n labels for the journal: `getTranslations('catalog.journal')` + the BottomSheet-relevant subset (`catalog.journal.add.*`, `catalog.journal.empty.*`, `catalog.journal.titleFormat`).
    - Render top bar (back chevron + title `{plantName} — Diário` + `+ Foto` button placeholder slot — the button itself is rendered inside `<PhotoJournal>` so it can read `readOnly` + open the sheet).
    - Render `<PhotoJournal plant={plant} entries={entries} readOnly={readOnly} labels={labels} />`.
    - Hydrate via TanStack Query `dehydrate` if 05-10 has shipped the queries factory (best-effort — if the factory is not yet usable from server components, fall back to passing `entries` as a prop and let the client component own further refetches via `plantsKeys.photoEntries(plantId)`).

    **B. PhotoJournal client** — `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx`:
    - `"use client"` directive.
    - Props: `plant: { id, name, nickname? }`, `entries: PhotoEntry[]`, `readOnly: boolean`, `labels`.
    - Local state: `lightboxOpen: boolean`, `lightboxIndex: number`, `addSheetOpen: boolean`. (TanStack Query hook reads `entries` from cache via `useQuery({ ...plantsKeys.photoEntries(plant.id), initialData: entries })` so SSR data + optimistic prepends from the add sheet stay in sync.)
    - Render reverse-chrono list of entry cards (`entries.sort` by `created_at` DESC client-side as defense; the API also returns DESC). Each card per UI-SPEC §8 line 401–409: full-width 4:5 photo, Plus Jakarta Sans 14/20 Calm Slate date below (formatted via `Intl.DateTimeFormat('pt-BR')`), optional note in Plus Jakarta Sans 16/24 Forest Ink. Tap photo → setState `{ lightboxOpen: true, lightboxIndex: i }`.
    - Render `<Lightbox open={lightboxOpen} onOpenChange={setLightboxOpen} photos={entries.map(e => ({ src: e.photo_url, caption: e.note || undefined }))} index={lightboxIndex} onIndexChange={setLightboxIndex} plantName={plant.nickname ?? plant.name} />` per UI-SPEC §9. (Canonical contract: 05-14-lightbox-inline-edit-primitives-PLAN.md. Lightbox builds `aria-label="Galeria — {plantName}"` internally.)
    - Render `+ Foto` button at top right of the page only when `!readOnly` (UI-SPEC §8 line 392 + D-21). Click → `setAddSheetOpen(true)`.
    - Empty state (entries.length <= 1, only the cover): render Phase 03 `<EmptyState>` with `headline=labels.empty.title`, `hint=labels.empty.hint`, `ctaLabel=labels.empty.cta`, `onCtaClick={() => setAddSheetOpen(true)}` (UI-SPEC §8 line 394–399). Hide the CTA in read-only.
    - Render `<JournalAddSheet open={addSheetOpen} onOpenChange={setAddSheetOpen} plantId={plant.id} labels={labels.add} />`.
    - Add `data-testid="photo-journal"` to the root wrapper so the Playwright spec can anchor on it for axe + waitForSelector.
    - **XSS guard** (T-05-17-02): `entry.note` is rendered as `<p>{entry.note}</p>` — React text-content only, NEVER `dangerouslySetInnerHTML`. The Vitest test below proves a `<script>` tag in `note` renders as literal text.

    **C. JournalAddSheet client** — `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx`:
    - `"use client"` directive.
    - Props: `open: boolean`, `onOpenChange: (b: boolean) => void`, `plantId: string`, `labels`.
    - Compose `<BottomSheet open={open} onOpenChange={onOpenChange} title={labels.title /* "Adicionar foto" */} closeLabel={labels.closeLabel} interactiveDragHandle role="dialog">`.
    - Inside the sheet, per UI-SPEC §8 line 414–418:
      1. Photo picker (same dashed 4:5 dropzone pattern as Task 1; tap → native picker; preview after selection).
      2. Note textarea (optional, 96–240px height) with label `labels.noteLabel` (`Anotação (opcional)`) and placeholder `labels.notePlaceholder` (`Como ela está hoje?`).
      3. Adicionar primary button (Canopy fill, full width).
      4. Cancelar secondary button (transparent, Canopy stroke, `autoFocus` per BottomSheet's Cancel-first contract from 05-13).
    - Submit handler:
      1. If no photo: surface inline error "Adicione uma foto" — same Overdue Rust treatment as Task 1's photo dropzone.
      2. `await compressPlantPhoto(file)` (T-05-17-01).
      3. Build FormData with `photo` (compressed) + optional `note`.
      4. **Idempotency key** (T-05-17-04): declare `const idempotencyKeyRef = useRef<string | null>(null)`. On submit (before the fetch), if `idempotencyKeyRef.current === null` set it to `crypto.randomUUID()`. Clear it on terminal success (after optimistic prepend, before closing the sheet) and on terminal error (after displaying the toast, so the next tap generates a fresh key).
      5. **Optimistic prepend via TanStack Query**:
         - `const queryClient = useQueryClient()`.
         - Snapshot current entries: `const previous = queryClient.getQueryData(plantsKeys.photoEntries(plantId).queryKey)`.
         - Build a temp entry `{ id: 'temp-' + crypto.randomUUID(), photo_url: URL.createObjectURL(file), note: noteValue || null, created_at: new Date().toISOString() }`.
         - `queryClient.setQueryData(plantsKeys.photoEntries(plantId).queryKey, (old) => [tempEntry, ...(old ?? [])])`.
         - Clear `idempotencyKeyRef.current`, close the sheet immediately on optimistic success (UI-SPEC §8 line 419 "Optimistic prepend").
      6. `fetch(\`/api/v1/plants/${plantId}/photo-entries\`, { method: 'POST', body: formData, credentials: 'same-origin', headers: { 'Idempotency-Key': idempotencyKeyRef.current } })`.
      7. On 201: parse JSON, replace the temp entry with the server response. `queryClient.invalidateQueries({ queryKey: plantsKeys.photoEntries(plantId).queryKey })` to refetch authoritative state.
      8. On failure: roll back the optimistic insert (`queryClient.setQueryData(... , previous)`), re-open the sheet, surface sonner toast `labels.failure` (`Não conseguimos enviar. Tente novamente.`), clear `idempotencyKeyRef.current` after the toast so a manual retry generates a new key, retain the file in component state so the user can retry without re-picking. UI-SPEC §8 line 420.

    **D. Unit-dom tests** — `tests/unit/photo-journal.test.tsx`:
    - Wrap renders in a `QueryClientProvider` with a fresh `QueryClient` per test (TanStack v5 standard pattern; if 05-10's QueryProvider exposes a test helper, prefer it).
    - Mock `@shared/images/client-compress` to identity (`async (f) => f`).
    - Mock `fetch`.
    - Test 1 — reverse-chrono ordering: pass entries `[{id:'a', created_at:'2026-01-01...'}, {id:'b', created_at:'2026-04-01...'}]`, render. Assert: in DOM order, the second entry's photo appears BEFORE the first (reverse chrono). The component should re-sort on the client even if the prop is unsorted.
    - Test 2 — '+ Foto' visible only when not readOnly: render with `readOnly={false}` → assert button visible. Re-render with `readOnly={true}` → assert button NOT in document.
    - Test 3 — tap entry opens Lightbox at correct index: click the second card. Assert: the lightbox dialog (`getByRole('dialog')`) is visible AND contains the second entry's `photo_url`. (Use a Lightbox mock that renders `<dialog data-photo-src={photos[index].src}>` so the assertion is structural; actual lightbox behaviour is owned by 05-14 tests.)
    - Test 4 — optimistic prepend on add success: open the add sheet, set photo, click Adicionar. Stub fetch resolves 201 with `{ data: { id: 'real-id', photo_url: 'https://example/real.jpg', note: null, created_at: '...' } }`. Assert: immediately after click the journal list has 1 more entry at the top (the temp entry); after the fetch resolves the temp id is replaced with `'real-id'`.
    - Test 5 — failure rolls back + sheet re-opens: same setup but fetch resolves 500. Assert: list returns to original length; sheet is open; sonner `toast.error` was called; the file is still selected (preview persists in the sheet).
    - Test 6 — XSS guard (T-05-17-02): pass an entry with `note: "<script>alert('xss')</script>"`. Render. Assert: `document.body.innerHTML` contains the literal text `&lt;script&gt;` (escaped) and DOES NOT contain a `<script>` element (`document.querySelectorAll('script').length === 0` for the journal subtree, OR more strictly `getByText("<script>alert('xss')</script>")` matches).
    - Test 7 — Idempotency-Key header present on POST: open the add sheet, set photo, click Adicionar. Assert: the `fetch` call for `/api/v1/plants/{plantId}/photo-entries` includes `headers['Idempotency-Key']` matching `/^[0-9a-f-]{36}$/i`.
    - Test 8 — Idempotency-Key reused across retries, fresh after terminal error: set photo, click Adicionar; mock fetch to reject. Capture `headers['Idempotency-Key']` (call it `key1`). Click Adicionar again (retry same sheet open) → assert `headers['Idempotency-Key']` still equals `key1`. After the toast clears `idempotencyKeyRef`, click Adicionar a third time → assert `headers['Idempotency-Key']` is a NEW UUID different from `key1`.

    **E. Dedicated authed E2E spec (incl. axe with sheet open)** — `tests/e2e/catalog-photo-journal.spec.ts`:
    - Use the `authedUser` fixture: `import { test, expect } from "./fixtures/authed-user";` plus `import AxeBuilder from "@axe-core/playwright";`.
    - This spec OWNS the axe coverage for `/catalog/{plantId}/journal`. It does NOT modify `tests/e2e/axe-placeholder-pages.spec.ts`.
    - Test "Photo journal E2E" (per VALIDATION.md row):
      1. Drive the manual-add flow (`page.goto('/catalog/add')` → fill name → set photo → submit) to land on `/catalog/{plantId}`. This also serves as the "we don't have a separate seed-plant fixture" bridge — it's the only way to land on a real plant profile without 05-16 also being shipped or a custom seeder. (Per advisor feedback: this is the cleanest path.)
      2. Capture the plant id from the URL.
      3. Navigate to `/catalog/{plantId}/journal`.
      4. Click `+ Foto` → assert BottomSheet is visible (`getByRole('dialog', { name: /adicionar foto/i })` or `name: /Anotação/`).
      5. Set the photo via the sheet's input → click Adicionar → assert the sheet closes AND the journal list now shows ≥2 entries (cover + new entry). Assert the POST `/api/v1/plants/{plantId}/photo-entries` request had `Idempotency-Key` header present (intercept via a `page.on('request', ...)` listener scoped to the POST, checking `request.headers()['idempotency-key']`).
      6. Click the second journal entry's photo → assert Lightbox is visible (`getByRole('dialog', { name: /galeria/i })`).
    - **Axe a11y across 4 colorScheme × reducedMotion combos — BottomSheet OPEN state** (per UI-SPEC §8 line 422 a11y gate; matches 05-16 dedicated-authed-spec pattern):
      ```typescript
      const COMBOS = [
        { colorScheme: "light", reducedMotion: "no-preference" },
        { colorScheme: "light", reducedMotion: "reduce" },
        { colorScheme: "dark", reducedMotion: "no-preference" },
        { colorScheme: "dark", reducedMotion: "reduce" },
      ] as const;
      for (const combo of COMBOS) {
        test(`axe /catalog/{plantId}/journal [sheet open, ${combo.colorScheme} / ${combo.reducedMotion}] — 0 serious + critical`, async ({ page, authedUser }) => {
          // Seed a plant via the manual-add flow (same approach as the E2E happy path above).
          // Helper: const plantId = await seedPlantViaForm(page, { name: 'AxeJournal' });
          await page.emulateMedia(combo);
          await page.goto(`/catalog/${plantId}/journal`);
          await page.waitForSelector('[data-testid="photo-journal"]');
          // Open the BottomSheet so the axe scan covers the open-sheet a11y contract.
          await page.getByRole('button', { name: /\+ Foto/i }).click();
          await page.waitForSelector('[role="dialog"]');
          const results = await new AxeBuilder({ page }).analyze();
          const blocking = results.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
          expect(blocking, `serious + critical: ${blocking.map(v => v.id).join(', ')}`).toEqual([]);
        });
      }
      ```
      The BottomSheet MUST be open during the axe scan because UI-SPEC §8 line 422 specifies the open-sheet state as the a11y gate (focus trap, dialog labelling, drag-handle aria-label all only verifiable while open). 05-16 establishes the same pattern for `<DeleteConfirmSheet>`.
    - `test.describe.configure({ retries: 0 })` for deterministic timing (matches 05-16 pattern).
    - The shared `seedPlantViaForm` helper can be inlined at the top of this spec or imported from `tests/e2e/fixtures/seed-plant.ts` if 05-15/05-16 has promoted it (verify at write time via `grep -l "export.*seedPlant" tests/e2e/fixtures/`).
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit-dom tests/unit/photo-journal.test.tsx &amp;&amp; pnpm exec playwright test tests/e2e/catalog-photo-journal.spec.ts --project=chromium</automated>
  </verify>
  <done>
    - `/catalog/{plantId}/journal` renders entries in reverse-chrono order with lightbox-on-tap.
    - `+ Foto` is visible when `!readOnly` and opens the BottomSheet (UI-SPEC §8).
    - Submitting the add sheet POSTs multipart with `Idempotency-Key` header to the photo-entries endpoint and optimistically prepends; on failure the sheet stays open with sonner toast and bytes retained (Vitest Tests 4/5/7/8 + Playwright spec green).
    - In read-only mode the `+ Foto` button is hidden but the Lightbox remains usable (Vitest Test 2 green).
    - User-typed notes render as text content only — `<script>` injection renders as literal text (Vitest Test 6 green; T-05-17-02 mitigated).
    - Axe scans of `/catalog/{plantId}/journal` with the BottomSheet OPEN across 4 colorScheme × reducedMotion combos return 0 serious + critical violations (4 axe tests in `catalog-photo-journal.spec.ts` green).
    - `tests/e2e/axe-placeholder-pages.spec.ts` is NOT modified by this task.
    - All new files compile (`pnpm tsc --noEmit` clean) and pass `pnpm lint`.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Browser → /api/v1/plants (multipart) | Untrusted user-supplied photo bytes + form fields cross here on manual add |
| Browser → /api/v1/plants/{plantId}/photo-entries (multipart) | Untrusted user-supplied photo bytes + note cross here on journal add |
| User-typed input → React render | Nickname, location, notes (manual-add) and journal note (photo-journal) are rendered back to the same user; XSS surface limited to single-tenant view but worth defending against pasted markup |

## STRIDE Threat Register

| Threat ID    | Category | Component                                        | Disposition | Mitigation Plan                                                                                                                                                                                                                                                                                                                       |
|--------------|----------|--------------------------------------------------|-------------|---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-05-17-01   | I, D     | Multipart upload from `<AddPlantForm>` and `<JournalAddSheet>` | mitigate    | Client-side compress + EXIF strip BEFORE upload via existing `compressPlantPhoto` (`src/shared/images/client-compress.ts:30`, `preserveExif: false`, `maxSizeMB: 1`). Defense in depth: server enforces same per Phase 02 D-30 (GPS rejection at the route layer). Vitest Test 4 in Task 1 asserts compress is invoked before fetch.        |
| T-05-17-02   | I        | `<PhotoJournal>` rendering of user-typed notes; `<PlantProfile>`-side rendering of nickname (caller-side responsibility, but our components render notes inline) | mitigate    | All user-typed strings (nickname, location, notes, journal note) are rendered via React text-content only. Zero `dangerouslySetInnerHTML` calls in any of the three new client components. Vitest Test 6 in Task 2 plants `<script>alert('xss')</script>` into a note and asserts the literal text renders (no `<script>` element appears). |
| T-05-17-03   | E        | POST `/api/v1/plants` and POST `/api/v1/plants/{plantId}/photo-entries` from the browser  | mitigate    | Same-origin multipart submit + Supabase SSR cookie session (`requireVerifiedUser` from 05-08 / Phase 04 D-21). Next.js App Router default protections + `credentials: 'same-origin'` on every fetch. We never expose the session token in any non-cookie surface; CSRF requires cross-origin form which the same-site cookie posture refuses.   |
| T-05-17-04   | T, R     | Repeated submit of `/api/v1/plants` or `/api/v1/plants/{plantId}/photo-entries` from a flaky network re-attempting the same logical mutation | mitigate    | Client generates `Idempotency-Key: crypto.randomUUID()` once per logical submit attempt and stores it in a `useRef`. Retries from the same form fill (same sheet open) reuse the same key — the server's Phase 2 D-37 `idempotency_keys` table deduplicates and returns the cached response without re-executing the use-case. Key is cleared on terminal success (preventing stale key from tainting the next intent) and on terminal error after the toast (so a deliberate manual retry generates a fresh key). Vitest Tests 7/8 in both Task 1 and Task 2 assert the header is present and the retry-reuse behaviour is correct. Playwright happy-path specs assert the header is present on the live POST. |

Block-on: high. Tasks ship only when T-05-17-01, T-05-17-02, and T-05-17-04 mitigations are present + tested.
</threat_model>

<verification>
- All new and modified files type-check cleanly (`pnpm tsc --noEmit`).
- All new and modified files pass `pnpm lint`.
- `pnpm exec vitest --run --project=unit-dom tests/unit/add-plant-form.test.tsx tests/unit/photo-journal.test.tsx` passes.
- `pnpm exec playwright test tests/e2e/catalog-manual-add.spec.ts tests/e2e/catalog-photo-journal.spec.ts --project=chromium` passes.
- Axe coverage for `/catalog/add` and `/catalog/{plantId}/journal` (sheet open) lives in the dedicated authed specs above; 0 serious + critical violations across all 4 theme × motion combinations per spec.
- `tests/e2e/axe-placeholder-pages.spec.ts` is NOT modified by this plan.
- Manual visual sanity check (NOT a blocker — the Playwright + axe gates are the contract): pages render the UI-SPEC §5 + §8 layout at 375 / 600 / 900 viewports.
</verification>

<success_criteria>
- **CAT-02 satisfied**: a verified user can manually add a plant via `/catalog/add` (name + ≥1 photo → Plant + PhotoEntry, both rows committed in one transaction by the route handler from 05-08).
- **CAT-03 satisfied**: missing name OR photo (or both) renders per-field Overdue Rust border + helper text + summary block at ≥2 errors with anchor links + first-invalid auto-focus, all without ever using Urgent Poppy.
- **CAT-05 satisfied**: the manual-add form's location field uses `<LocationCombobox>` from 05-12 — user suggestions + i18n defaults + "Adicionar '{typed}'" ghost row.
- **CAT-06 satisfied**: a verified user can navigate to `/catalog/{plantId}/journal`, see entries in reverse-chrono order, open the Lightbox on tap, and add a new entry with optional note via the BottomSheet.
- **UI-07 partial (manual-add card)** satisfied: the manual-add page uses the same Plant Card geometry tokens (16px radius, 4:5 photo, 16px padding) for the photo dropzone preview state per UI-SPEC §5 line 203 and PRD §17 line 911.
- **UI-11 satisfied**: photo journal screen + add-entry bottom sheet + read-only variant per UI-SPEC §8.
- **D-21 honoured**: read-only mode hides the manual-add submit button (page still renders + banner + form fields read-only), hides the journal `+ Foto` button while keeping the Lightbox usable.
- Axe a11y for both new auth-required surfaces lives in dedicated authed specs (matches 05-16 pattern); `tests/e2e/axe-placeholder-pages.spec.ts` is not modified.
- **VALIDATION.md per-task verification map** updated with Task 1 + Task 2 entries pointing at their automated commands.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-17-SUMMARY.md` per `templates/summary.md` — including the four files created/modified by each task, the threats mitigated, the test commands that gate this plan, and a note that axe coverage for the auth-required surfaces lives in the dedicated authed Playwright specs created here (consistent with 05-16's pattern).
</output>
