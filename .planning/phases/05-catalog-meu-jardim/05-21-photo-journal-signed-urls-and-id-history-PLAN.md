---
phase: 05-catalog-meu-jardim
plan: 21
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/contexts/catalog/application/list-photo-entries.ts
  - src/contexts/catalog/api/snake-case.ts
  - src/app/api/v1/plants/[plantId]/photo-entries/route.ts
  - src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx
  - src/app/(app)/catalog/[plantId]/plant-profile.tsx
  - src/messages/pt-BR.json
  - tests/integration/catalog-list-photo-entries.integration.test.ts
  - tests/integration/catalog-routes-read-create.integration.test.ts
autonomous: true
gap_closure: true
requirements:
  - CAT-04
  - CAT-06
  - UI-08
  - UI-11
tags:
  - catalog
  - photo-journal
  - signed-urls
  - plant-profile
  - id-history-placeholder
  - gap-closure
must_haves:
  truths:
    - "`listPhotoEntries` use-case signs BOTH `photoUrl` and `thumbnailUrl` (24h-TTL each); the result row carries new fields `photoSignedUrl` and `thumbnailSignedUrl` alongside the original `photoUrl`/`thumbnailUrl` (kept as raw bucket-key for non-display callers). CR-03 fix; SC-4 photo-journal full-size lightbox."
    - "`toPhotoEntrySnakeCase` mapper emits new snake-case fields `photo_signed_url` and `thumbnail_signed_url` (string | null). The existing `photo_url` / `thumbnail_url` fields are PRESERVED for backward compatibility with existing consumers + tests."
    - "GET /api/v1/plants/:plantId/photo-entries response includes the two new fields on every item. POST response unchanged (single-item creation already returns the row via `toPhotoEntrySnakeCase` — gains the new fields automatically through the mapper change)."
    - "`photo-journal.tsx` lightbox `photos` array uses `e.photo_signed_url ?? e.photo_url` as the `src` (signed URL primary; raw bucket-key fallback only when signing fails — yields a clearly-broken image that surfaces the signing failure rather than silently showing nothing). UI-11 lightbox renders a real signed URL on tap."
    - "`plant-profile.tsx` lightbox `allPhotos` array uses `pe.photo_signed_url ?? pe.photo_url` for non-cover entries; cover continues to use `plant.cover_signed_url` as it does today. UI-08 plant-profile gallery renders signed URLs throughout."
    - "`plant-profile.tsx` renders an `Histórico de Identificação` placeholder section (UI-08) below the photo-journal preview strip — section label + body copy `catalog.profile.history.empty` (new i18n key); no CTA, no link. Section is structurally present so a11y reading order matches UI-SPEC §6 and Phase 6 only needs to swap the body copy + add a link, not introduce new DOM."
    - "New i18n key `catalog.profile.history.empty` exists in `src/messages/pt-BR.json` with copy explicitly framing the placeholder as Phase-6 territory (suggested: `\"O histórico de identificações aparecerá aqui após a Fase 6.\"`). Section label key `catalog.profile.sections.history` reuses the existing `sections.*` pattern (suggested: `\"HISTÓRICO DE IDENTIFICAÇÃO\"`)."
  artifacts:
    - path: "src/contexts/catalog/application/list-photo-entries.ts"
      provides: "Use-case now signs both photoUrl + thumbnailUrl in parallel. Result item shape gains `photoSignedUrl: string | null` + `thumbnailSignedUrl: string | null`. Original `photoUrl`/`thumbnailUrl` kept as the canonical bucket-key (used by deletePhotoEntry for `extractObjectKey`)."
      contains: "photoSignedUrl"
    - path: "src/contexts/catalog/api/snake-case.ts"
      provides: "`toPhotoEntrySnakeCase` adds `photo_signed_url` + `thumbnail_signed_url` to the output type + value. Backward-compat: existing `photo_url` + `thumbnail_url` keys remain."
      contains: "photo_signed_url"
    - path: "src/app/api/v1/plants/[plantId]/photo-entries/route.ts"
      provides: "GET response item shape gains the two new fields (delegated to the mapper). Inline `items.map` handler in route updated OR replaced with `items: result.items.map(toPhotoEntrySnakeCase)` for consistency with the POST handler."
      contains: "photo_signed_url"
    - path: "src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx"
      provides: "Lightbox `src` reads `e.photo_signed_url ?? e.photo_url` instead of `e.photo_url`. PhotoEntry type gains the two new optional fields."
      contains: "photo_signed_url"
    - path: "src/app/(app)/catalog/[plantId]/plant-profile.tsx"
      provides: "(1) `allPhotos` mapping uses `pe.photo_signed_url ?? pe.photo_url` for the non-cover gallery entries. (2) New `Histórico de Identificação` placeholder section below the photo-journal preview, before the lightbox + delete-confirm sheet. Section is hidden behind `useSubscription().readOnly` no-op gate (placeholder shows in both modes — it's read-only by definition)."
      contains: "history.empty"
    - path: "src/messages/pt-BR.json"
      provides: "Two new i18n keys under `catalog.profile`: `sections.history` and `history.empty`."
      contains: "HISTÓRICO DE IDENTIFICAÇÃO"
    - path: "tests/integration/catalog-list-photo-entries.integration.test.ts"
      provides: "New assertion that the use-case result items contain `photoSignedUrl` (or `photo_signed_url` once snake-cased — depends on what the existing tests assert against)."
      contains: "photoSignedUrl"
    - path: "tests/integration/catalog-routes-read-create.integration.test.ts"
      provides: "New assertion on GET /api/v1/plants/:plantId/photo-entries that response items include `photo_signed_url`."
      contains: "photo_signed_url"
  key_links:
    - from: "src/contexts/catalog/application/list-photo-entries.ts"
      to: "src/contexts/catalog/infrastructure/photo-storage.ts"
      via: "Promise.all([signCatalogPhotoUrl(thumbnail), signCatalogPhotoUrl(photo)]) for each row"
      pattern: "Promise.all"
    - from: "src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx"
      to: "src/contexts/catalog/api/snake-case.ts"
      via: "PhotoEntry type carries `photo_signed_url`; lightbox reads `e.photo_signed_url ?? e.photo_url`"
      pattern: "photo_signed_url"
    - from: "src/app/(app)/catalog/[plantId]/plant-profile.tsx"
      to: "src/messages/pt-BR.json"
      via: "useTranslations('catalog.profile').raw('history.empty') + .raw('sections.history')"
      pattern: "history.empty"
---

<objective>
Close two gaps in a single plan because both surface inside the catalog photo-journal subsystem and have shared edges in `plant-profile.tsx`:

1. **CR-03 (CRITICAL):** `listPhotoEntries` only signs `thumbnailUrl`. `photoUrl` is the raw `{bucket}/{key}` string (e.g. `plant-photos/userId/plantId/photoId.jpg`). The lightbox in `photo-journal.tsx` and the gallery `allPhotos` mapping in `plant-profile.tsx` use `photo_url` as the `<img src>`, so the browser interprets a relative bucket path under the current origin — the **full-size view is broken on every photo entry**. SC-4 photo-journal CRUD lightbox is dead.

2. **ID-history placeholder (CAT-04 / UI-08, user-confirmed addition):** UI-SPEC §324-326 says Section 5 "ID history link (PLACEHOLDER for Phase 6)" is HIDDEN by default in Phase 5 because manual plants have no Identifications. The verification report flagged the missing surface; the user confirmed during planning checkpoint that a structural placeholder ships in Phase 5 so Phase 6 can wire the real link without DOM-shape changes. This plan ships the placeholder section (label + body copy, no link) so reading order, scroll position, and a11y match UI-SPEC.

**Why combined:** both gaps modify `plant-profile.tsx`. CR-03 changes the `allPhotos` mapping (around lines 117-128); ID-history adds a section block between photo-journal preview (line 324-370) and the lightbox + delete-confirm sheet at the bottom of the file. They cannot run in parallel as separate plans (file collision); folding into one plan with two tasks is cleaner than artificial wave-2 sequencing.

**TDD framing for CR-03:** the use-case has integration test coverage; extend the existing test to assert the new signed-URL field. Route-level integration test asserts the snake-case fields surface end-to-end. Type: `tdd` for the use-case + route layer; the UI consumer changes (photo-journal.tsx, plant-profile.tsx) are mechanical and ship inside Task 3 alongside the i18n + ID-history placeholder.

**Purpose:** restore SC-4 photo-journal lightbox; close UI-08 ID-history placeholder gap; keep cache shape backward-compatible so existing journal consumers never see undefined.

**Output:** 5 source patches + 1 i18n update + 2 test additions, all green under `pnpm test:unit`, `pnpm test:integration`, and `pnpm typecheck`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-VERIFICATION.md
@.planning/phases/05-catalog-meu-jardim/05-REVIEW.md
@.planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md

# Bug surfaces
@src/contexts/catalog/application/list-photo-entries.ts
@src/contexts/catalog/api/snake-case.ts
@src/app/api/v1/plants/[plantId]/photo-entries/route.ts
@src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx
@src/app/(app)/catalog/[plantId]/plant-profile.tsx

# Existing tests we extend
@tests/integration/catalog-list-photo-entries.integration.test.ts
@tests/integration/catalog-routes-read-create.integration.test.ts

# Existing i18n + UI-SPEC
@src/messages/pt-BR.json

<interfaces>
### `signCatalogPhotoUrl` (already exists, `src/contexts/catalog/infrastructure/photo-storage.ts`)

```ts
export async function signCatalogPhotoUrl(input: {
  storedUrl: string;
  ttlSeconds: number;
}): Promise<{ ok: true; signedUrl: string } | { ok: false; reason: string }>;
```

Used today only for the thumbnail. The exact same call signs the photo URL — both inputs share the `{bucket}/{key}` shape.

### Current `listPhotoEntries` result row shape (line 18-20 — must NOT change column-keep contract)

```ts
{ ok: true; items: (Omit<PhotoEntryRow, "thumbnailUrl"> & { thumbnailUrl: string })[] }
```

The existing shape REPLACES `thumbnailUrl` with the signed value. The fix should ADD new fields (`photoSignedUrl`, `thumbnailSignedUrl`) and keep the original `photoUrl` + `thumbnailUrl` as the raw bucket-key — this keeps `delete-photo-entry`'s `extractObjectKey(deleted.photoUrl)` (line 123) working. The existing thumbnail-replace pattern was a Phase-5 shortcut; the new dual-field shape is the future-proof contract.

**HOWEVER** — backward compatibility test: the existing integration test at `tests/integration/catalog-list-photo-entries.integration.test.ts` may assert that `thumbnailUrl` is signed. Read the test before changing the use-case; if existing tests rely on `thumbnailUrl` being the signed URL, KEEP THAT BEHAVIOR (so the field is the signed URL) and add `thumbnailSignedUrl` as a duplicate field. The duplication is intentional for migration safety; once Phase 6+ stabilizes the new field name, the legacy override can be cleaned up.

### Current `toPhotoEntrySnakeCase` (line 64-73)

```ts
export function toPhotoEntrySnakeCase(row: PhotoEntryRow): PhotoEntrySnakeCase {
  return {
    id, plant_id, photo_url: row.photoUrl, thumbnail_url: row.thumbnailUrl,
    note, created_at,
  };
}
```

Add the two new fields (defaulted to null when absent — POST handler uses the bare PhotoEntryRow with no signed URL; GET handler will pass the augmented row from `listPhotoEntries`). Make the input parameter type accept the optional signed URLs:

```ts
export function toPhotoEntrySnakeCase(
  row: PhotoEntryRow & { photoSignedUrl?: string | null; thumbnailSignedUrl?: string | null },
): PhotoEntrySnakeCase {
  return {
    id, plant_id, photo_url: row.photoUrl, thumbnail_url: row.thumbnailUrl,
    photo_signed_url: row.photoSignedUrl ?? null,
    thumbnail_signed_url: row.thumbnailSignedUrl ?? null,
    note, created_at,
  };
}
```

This keeps the POST handler's existing call site (`toPhotoEntrySnakeCase(usecase.photoEntry)`) compiling — `photoEntry` is a `PhotoEntryRow` without the signed extension, the optional fields default to null, snake-case mapper emits null. The GET handler can be updated to use the same mapper instead of inline mapping.

### Existing route GET inline mapping (route.ts:159-167)

```ts
items: result.items.map((item) => ({
  id: item.id,
  plant_id: item.plantId,
  photo_url: item.photoUrl,
  thumbnail_url: item.thumbnailUrl,
  note: item.note ?? null,
  created_at: item.createdAt,
})),
```

Replace with `items: result.items.map((item) => toPhotoEntrySnakeCase(item))`. The augmented item type carries `photoSignedUrl` + `thumbnailSignedUrl`; the mapper picks them up.

### `PhotoEntry` type in client (`photo-journal.tsx:13-20`)

```ts
export type PhotoEntry = {
  id: string;
  plant_id: string;
  photo_url: string;
  thumbnail_url: string;
  note: string | null;
  created_at: string;
};
```

Add two optional fields:
```ts
photo_signed_url?: string | null;
thumbnail_signed_url?: string | null;
```

This keeps the optimistic temp-entry shape in `journal-add-sheet.tsx:93-100` valid (the temp entry uses ObjectURL strings as `photo_url` + `thumbnail_url`; signed-URL fields are absent and the lightbox falls back to `?? e.photo_url`).

### UI-SPEC §6 Section 5 (ID-history placeholder)

UI-SPEC line 324-326:
> **Section 5 — ID history link (PLACEHOLDER for Phase 6):**
> - Phase 5 plants are manual-only (`species_id = null`, no Identification rows linked). Section is HIDDEN by default in Phase 5 (CONTEXT.md `<deferred>` line 257).
> - Phase 6 conditionally renders when `Identification.plant_id` matches.

The user-confirmed addition flips this from "HIDDEN" to "structurally present, body copy only" — Phase 6 swaps the copy + adds a link without DOM-shape changes. The placeholder copy is NEW (UI-SPEC has none); pick a terse pt-BR phrase that matches the `Em breve` voice used elsewhere (e.g. `catalog.profile.reminders.cta` → `Em breve` per UI-SPEC line 313).

Suggested copy:
- Section label key `catalog.profile.sections.history` → `HISTÓRICO DE IDENTIFICAÇÃO` (matches existing all-caps tracking-widest pattern at lines 311 + 318).
- Body copy key `catalog.profile.history.empty` → `O histórico de identificações aparecerá aqui após a Fase 6.` (mirrors the "Em breve" tone; explicit phase reference is internal-developer-friendly and gets swapped at Phase 6).

Use `Claude's discretion` per CONTEXT.md guidance — this is the suggested wording; the executor may tighten it (e.g. drop the explicit phase number for end-user copy: `"O histórico de identificações ainda não está disponível."`). The structural decision (label + body copy, no link, no CTA) is fixed; the exact words are Claude's discretion.
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                                | Description                                                                                                                                                       |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| use-case → route response               | Signed URLs cross from server-only Supabase Storage tokens into the JSON response over HTTPS.                                                                     |
| route response → TanStack Query cache   | Cached signed URLs persist for the 60s `staleTime` of the photoEntries query (Plan 05-10) — well within the 24h URL TTL.                                          |
| client lightbox → browser image fetch   | Lightbox `src` is interpreted by the browser; a malformed URL (relative bucket-key) silently fails to load.                                                       |

## STRIDE Threat Register

| Threat ID    | Category               | Component                                                  | Disposition | Mitigation Plan                                                                                                                                                                                                       |
| ------------ | ---------------------- | ---------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-21-01   | Information disclosure | photo_signed_url leakage in PostHog / Sentry              | accept      | Phase 1 D-21 telemetry contract redacts response bodies for /api/v1; the 24h TTL bounds the blast radius.                                                                                                            |
| T-05-21-02   | Tampering              | client renders raw bucket-key in `src` if signing fails    | mitigate    | Use `?? e.photo_url` fallback so the original raw key still rendersa visibly-broken image — making the failure surface during dev/QA. Better than silently swapping to a blank `src`.                                |
| T-05-21-03   | Spoofing               | rogue server returns wrong user's signed_url               | accept      | RLS at Supabase Storage level (Phase 2 D-26) ensures cross-user signed URLs cannot be generated by the storage adapter; ownership is checked in the use-case before signing.                                          |
| T-05-21-04   | Information disclosure | ID-history placeholder leaks Phase-6 plans                | accept      | The placeholder copy mentions "Fase 6" only in the suggested string. The executor's discretion can soften to non-version-specific phrasing for end-user copy. No security-sensitive information either way.          |

</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED + GREEN — `listPhotoEntries` signs both URLs; snake-case mapper emits the new fields; route response surfaces them (CR-03 backend)</name>
  <files>
    - src/contexts/catalog/application/list-photo-entries.ts
    - src/contexts/catalog/api/snake-case.ts
    - src/app/api/v1/plants/[plantId]/photo-entries/route.ts
    - tests/integration/catalog-list-photo-entries.integration.test.ts
    - tests/integration/catalog-routes-read-create.integration.test.ts
  </files>
  <read_first>
    - src/contexts/catalog/application/list-photo-entries.ts (full file — only 55 lines; lines 40-51 are the bug surface)
    - src/contexts/catalog/api/snake-case.ts (full file — line 64-73 is the mapper to update)
    - src/app/api/v1/plants/[plantId]/photo-entries/route.ts (full file — line 159-167 is the inline-map to refactor)
    - tests/integration/catalog-list-photo-entries.integration.test.ts (read existing assertions to determine whether they pin `thumbnailUrl` to signed shape — informs whether to add a duplicate field or rename)
    - tests/integration/catalog-routes-read-create.integration.test.ts (find existing GET /photo-entries assertions; will extend with a `photo_signed_url` check)
  </read_first>
  <behavior>
    **RED:**
    1. Open `tests/integration/catalog-list-photo-entries.integration.test.ts`. Add an assertion that the use-case result items include a `photoSignedUrl` field (or `thumbnailSignedUrl` — pick one, the other follows by parallel construction):
       ```ts
       expect(result.items[0]).toHaveProperty("photoSignedUrl");
       expect(typeof result.items[0]!.photoSignedUrl === "string" || result.items[0]!.photoSignedUrl === null).toBe(true);
       ```
    2. Open `tests/integration/catalog-routes-read-create.integration.test.ts`. In the existing GET /photo-entries test, add:
       ```ts
       expect(body.items[0]).toHaveProperty("photo_signed_url");
       expect(typeof body.items[0].photo_signed_url === "string" || body.items[0].photo_signed_url === null).toBe(true);
       ```

    Run integration tests — both assertions MUST fail (`photoSignedUrl` undefined; `photo_signed_url` undefined).

    **GREEN:**
    3. `listPhotoEntries` (use-case) signs both URLs in parallel. Update the result type in the file to include the two new fields. Existing `thumbnailUrl` REMAINS the signed URL (preserves any tests that depend on it); ADD `thumbnailSignedUrl` as a duplicate of the signed value, ADD `photoSignedUrl` as the newly-signed photo URL. The original raw `photoUrl` is also preserved in the return shape (the field name kept; just the value changes — see below).

    Concrete patch:
    ```ts
    export type ListPhotoEntriesResult =
      | {
          ok: true;
          items: (PhotoEntryRow & {
            photoSignedUrl: string | null;
            thumbnailSignedUrl: string | null;
          })[];
        }
      | { ok: false; code: typeof ErrorCode.NotFound; reason: string };

    // body of listPhotoEntries:
    const items = await Promise.all(
      reversed.map(async (row) => {
        const [signedThumb, signedPhoto] = await Promise.all([
          signCatalogPhotoUrl({ storedUrl: row.thumbnailUrl, ttlSeconds: SIGN_TTL_SECONDS }),
          signCatalogPhotoUrl({ storedUrl: row.photoUrl, ttlSeconds: SIGN_TTL_SECONDS }),
        ]);
        return {
          ...row,
          // Phase 5 contract: thumbnailUrl was the signed URL (legacy carry-over).
          // Phase 6+ should consume thumbnailSignedUrl explicitly.
          thumbnailUrl: signedThumb.ok ? signedThumb.signedUrl : row.thumbnailUrl,
          photoSignedUrl: signedPhoto.ok ? signedPhoto.signedUrl : null,
          thumbnailSignedUrl: signedThumb.ok ? signedThumb.signedUrl : null,
        };
      }),
    );
    ```

    Note: `photoUrl` stays as the raw bucket-key (per the existing pattern of preserving `row.photoUrl` from the spread). `delete-photo-entry.ts:123` `extractObjectKey(deleted.photoUrl)` continues to work because that path uses the DB row directly (`photoEntriesRepo.deletePhotoEntry` returns the raw row), not the use-case result.

    4. `toPhotoEntrySnakeCase`: extend the function input + output to include `photo_signed_url` + `thumbnail_signed_url`:

    ```ts
    export type PhotoEntrySnakeCase = {
      id: string;
      plant_id: string;
      photo_url: string;
      thumbnail_url: string;
      photo_signed_url: string | null;
      thumbnail_signed_url: string | null;
      note: string | null;
      created_at: string;
    };

    export function toPhotoEntrySnakeCase(
      row: PhotoEntryRow & { photoSignedUrl?: string | null; thumbnailSignedUrl?: string | null },
    ): PhotoEntrySnakeCase {
      return {
        id: row.id,
        plant_id: row.plantId,
        photo_url: row.photoUrl,
        thumbnail_url: row.thumbnailUrl,
        photo_signed_url: row.photoSignedUrl ?? null,
        thumbnail_signed_url: row.thumbnailSignedUrl ?? null,
        note: row.note ?? null,
        created_at: row.createdAt,
      };
    }
    ```

    5. GET /api/v1/plants/:plantId/photo-entries route — replace the inline `items.map(...)` (lines 159-167) with `items: result.items.map((item) => toPhotoEntrySnakeCase(item))`. Confirm the import is present.

    6. Run all affected integration tests:
       ```
       pnpm exec vitest --run --project=integration tests/integration/catalog-list-photo-entries.integration.test.ts tests/integration/catalog-routes-read-create.integration.test.ts tests/integration/catalog-create-photo-entry.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts
       ```
       All must pass — the create-photo-entry POST handler returns the new fields automatically (defaulting to null because the freshly-created row has no signed URLs), preserving the existing test if it asserts on `photo_url` directly.

    7. Run `pnpm typecheck` — must be clean.

    8. Commits: RED first (`test(05-21): add failing tests for listPhotoEntries signed URLs`) then GREEN (`feat(05-21): listPhotoEntries signs both photoUrl + thumbnailUrl; snake-case mapper emits *_signed_url fields (CR-03 backend)`).
  </action>
  <action>
    See <behavior> — execute steps 1-8 in order. RED commit BEFORE any source patch; GREEN commit AFTER all integration tests pass.
  </action>
  <acceptance_criteria>
    - `grep -c "photoSignedUrl" src/contexts/catalog/application/list-photo-entries.ts` returns `>=2` (type + assignment).
    - `grep -c "photo_signed_url" src/contexts/catalog/api/snake-case.ts` returns `>=2` (type + value).
    - `grep -c "toPhotoEntrySnakeCase" src/app/api/v1/plants/\[plantId\]/photo-entries/route.ts` returns `>=2` (POST + GET use sites).
    - `pnpm typecheck` exits 0.
    - `pnpm exec vitest --run --project=integration tests/integration/catalog-list-photo-entries.integration.test.ts tests/integration/catalog-routes-read-create.integration.test.ts tests/integration/catalog-create-photo-entry.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts` exits 0.
    - Git log shows `test(05-21): ...` then `feat(05-21): ...` commits in that order.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck && pnpm exec vitest --run --project=integration tests/integration/catalog-list-photo-entries.integration.test.ts tests/integration/catalog-routes-read-create.integration.test.ts tests/integration/catalog-create-photo-entry.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/contexts/catalog/application/list-photo-entries.ts | grep -c "photoSignedUrl" | grep -E "^[2-9]|^[1-9][0-9]+$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/contexts/catalog/api/snake-case.ts | grep -c "photo_signed_url" | grep -E "^[2-9]|^[1-9][0-9]+$"</gate>
  </verify>
  <done>
    - listPhotoEntries signs both URLs.
    - snake-case mapper accepts + emits the new fields.
    - GET route uses the mapper (no inline mapping).
    - All integration tests green; typecheck clean.
    - RED + GREEN commits.
  </done>
</task>

<task type="auto">
  <name>Task 2: Wire client consumers — photo-journal lightbox + plant-profile gallery use signed URLs (CR-03 frontend)</name>
  <files>
    - src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx
  </files>
  <read_first>
    - src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx (full file — line 13-20 PhotoEntry type; line 63-67 lightbox `photos` mapping)
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx (full file — line 32-39 PhotoEntrySnakeCase type; lines 117-128 `allPhotos` non-cover mapping)
  </read_first>
  <action>
    1. Open `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx`. Update the `PhotoEntry` type (lines 13-20) to add the two optional fields:
    ```ts
    export type PhotoEntry = {
      id: string;
      plant_id: string;
      photo_url: string;
      thumbnail_url: string;
      photo_signed_url?: string | null;
      thumbnail_signed_url?: string | null;
      note: string | null;
      created_at: string;
    };
    ```

    Update the `lightboxPhotos` mapping (line 63-67):
    ```ts
    const lightboxPhotos = entries.map((e) => ({
      id: e.id,
      src: e.photo_signed_url ?? e.photo_url,
      caption: e.note ?? undefined,
    }));
    ```

    No other changes — the thumbnail strip already reads `entry.thumbnail_url` which is the signed value (preserved by the use-case's legacy carry-over).

    2. Open `src/app/(app)/catalog/[plantId]/plant-profile.tsx`. Update the `PhotoEntrySnakeCase` local type (lines 32-39) to add the two optional fields (mirror the journal type).

    Update the `allPhotos` non-cover mapping (lines 117-128). Currently:
    ```ts
    ...photoEntries.slice(1).map((pe) => ({
      id: pe.id,
      src: pe.photo_url,
      caption: pe.note ?? undefined,
    })),
    ```
    becomes:
    ```ts
    ...photoEntries.slice(1).map((pe) => ({
      id: pe.id,
      src: pe.photo_signed_url ?? pe.photo_url,
      caption: pe.note ?? undefined,
    })),
    ```

    The `else` branch at lines 124-128 (when `plant.cover_signed_url` is null — falls back to `photoEntries.map`) likewise updates:
    ```ts
    : photoEntries.map((pe) => ({
        id: pe.id,
        src: pe.photo_signed_url ?? pe.photo_url,
        caption: pe.note ?? undefined,
      }));
    ```

    3. Run `pnpm typecheck` → must be clean.

    4. Run the unit tests for the affected components if any exist (`tests/unit/photo-journal.test.tsx`, `tests/unit/plant-profile.test.tsx` — check `ls tests/unit/` first; do not invent test files that don't exist). If the journal-add-sheet test exists and asserts on the temp-entry shape, confirm it still passes (the temp entry uses ObjectURL strings; signed-url fields are absent → fallback chain works).

    5. Commit: `feat(05-21): photo-journal lightbox + plant-profile gallery consume photo_signed_url (CR-03 frontend)`.
  </action>
  <acceptance_criteria>
    - `grep -c "photo_signed_url" src/app/\(app\)/catalog/\[plantId\]/journal/photo-journal.tsx` returns `>=2` (type + usage).
    - `grep -c "photo_signed_url" src/app/\(app\)/catalog/\[plantId\]/plant-profile.tsx` returns `>=2` (type + 2 usages = 3 total typically).
    - `pnpm typecheck` exits 0.
    - Existing unit tests touching these files (if any) still pass.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/journal/photo-journal.tsx | grep -c "photo_signed_url" | grep -E "^[2-9]|^[1-9][0-9]+$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/plant-profile.tsx | grep -c "photo_signed_url" | grep -E "^[2-9]|^[1-9][0-9]+$"</gate>
  </verify>
  <done>
    - PhotoEntry types in both files carry the new optional signed-url fields.
    - Lightbox `src` reads signed URL with raw-key fallback.
    - Plant-profile `allPhotos` mapping reads signed URL with raw-key fallback.
    - Typecheck clean.
    - Commit landed.
  </done>
</task>

<task type="auto">
  <name>Task 3: Add ID-history placeholder section to plant-profile + i18n keys (UI-08)</name>
  <files>
    - src/messages/pt-BR.json
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx
  </files>
  <read_first>
    - src/messages/pt-BR.json (lines around `catalog.profile.sections.*` — confirm the existing pattern of `sections.reminders` + `sections.journal` and add `sections.history` alongside; lines around `catalog.profile.reminders.empty` to mirror the new `history.empty` shape)
    - src/app/(app)/catalog/[plantId]/plant-profile.tsx (lines 309-321 reminders section; 323-370 photo-journal section — the new placeholder goes BETWEEN photo-journal and the lightbox + delete-confirm-sheet at line 372+)
    - .planning/phases/05-catalog-meu-jardim/05-UI-SPEC.md lines 311-322 (existing section-label pattern for label formatting, font, tracking)
  </read_first>
  <action>
    1. Open `src/messages/pt-BR.json`. Locate the `catalog.profile.sections` block. After `journal` (around line where `sections.journal` is defined), add:
    ```json
    "sections": {
      "reminders": "LEMBRETES ATIVOS",
      "journal": "DIÁRIO DE FOTOS",
      "history": "HISTÓRICO DE IDENTIFICAÇÃO"
    }
    ```
    Then locate the `history` namespace (likely absent — add a new sibling under `catalog.profile`):
    ```json
    "history": {
      "empty": "O histórico de identificações ainda não está disponível."
    }
    ```

    Use Claude's discretion on the exact string. The structural decision (a single `history.empty` string, no CTA, no link) is fixed; the exact pt-BR phrasing is your call. Suggested alternatives:
    - `"O histórico de identificações aparecerá aqui quando você identificar plantas pela câmera."` (user-facing, no version reference, slightly longer)
    - `"O histórico de identificações ainda não está disponível."` (terse, version-neutral) — recommended.

    Validate the JSON with `node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))"` after editing — a single misplaced comma silently breaks next-intl runtime.

    2. Open `src/app/(app)/catalog/[plantId]/plant-profile.tsx`. Add a new `<section>` block between the photo-journal preview (ends at line 370 `)}` `</section>`) and the Lightbox at line 372+. Match the format of the reminders section (lines 309-321):

    ```tsx
    {/* Section 5 — ID history placeholder (Phase 6 wires real link; UI-08) */}
    <section className="px-4 py-4">
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-slate">
        {t("sections.history")}
      </h2>
      <p className="text-sm text-slate">{t("history.empty")}</p>
    </section>
    ```

    The section is structurally present in BOTH read-only and read-write modes — it shows no affordance regardless of subscription state, so no `!readOnly &&` gate is needed. (Per UI-SPEC §6 Section 5: the section is HIDDEN in Phase 5 by default; user-confirmed gap closure flips it to "visible placeholder, no link". Phase 6 adds the link conditionally based on Identification.plant_id matches.)

    A11y: the new section preserves reading order between the photo-journal preview and the bottom-of-page Lightbox/DeleteConfirmSheet portals. The `<h2>` makes it part of the heading outline (matching the two existing siblings), so screen readers announce the placeholder without requiring DOM changes in Phase 6.

    3. Run `pnpm typecheck` and confirm next-intl resolves both new keys at compile-time (TypeScript will flag missing keys if the project uses strict next-intl typing). If types break, follow the existing pattern in the file — `useTranslations("catalog.profile")` already provides `t` for both new keys.

    4. Run an existing unit/E2E test that touches plant-profile.tsx if one exists (e.g. `tests/unit/use-plant-profile-mutations.test.tsx` only covers hooks, not the section render — but `tests/e2e/plant-profile.spec.ts` does render the page; do NOT run E2E here, just confirm the section exists by grep).

    5. Commit: `feat(05-21): plant-profile renders ID-history placeholder section + new i18n keys (UI-08)`.
  </action>
  <acceptance_criteria>
    - `src/messages/pt-BR.json` valid JSON (parseable by `JSON.parse`).
    - `grep -c "sections.history\|HISTÓRICO" src/messages/pt-BR.json` returns `>=2`.
    - `grep -c "history.empty" src/messages/pt-BR.json` returns `>=1`.
    - `grep -c "sections.history" src/app/\(app\)/catalog/\[plantId\]/plant-profile.tsx` returns `>=1`.
    - `grep -c "history.empty" src/app/\(app\)/catalog/\[plantId\]/plant-profile.tsx` returns `>=1`.
    - `pnpm typecheck` exits 0.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck && node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))" && echo "json ok"</automated>
    <gate type="grep">grep -c "history.empty" src/messages/pt-BR.json | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/plant-profile.tsx | grep -c "sections.history" | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - i18n keys `sections.history` + `history.empty` exist in pt-BR.json (valid JSON).
    - Plant-profile renders the placeholder `<section>` between journal preview and lightbox.
    - No `!readOnly &&` gate on the section (placeholder shows in both modes).
    - Typecheck clean.
    - Commit landed.
  </done>
</task>

</tasks>

<verification>
  <automated>
    pnpm typecheck && \
    node -e "JSON.parse(require('fs').readFileSync('src/messages/pt-BR.json','utf8'))" && \
    pnpm exec vitest --run --project=integration tests/integration/catalog-list-photo-entries.integration.test.ts tests/integration/catalog-routes-read-create.integration.test.ts tests/integration/catalog-create-photo-entry.integration.test.ts tests/integration/catalog-delete-photo-entry.integration.test.ts
  </automated>
</verification>

<success_criteria>
- listPhotoEntries signs both photoUrl + thumbnailUrl in parallel; result row carries `photoSignedUrl` + `thumbnailSignedUrl`.
- snake-case mapper emits `photo_signed_url` + `thumbnail_signed_url`; existing `photo_url` + `thumbnail_url` preserved (backward compat).
- GET /api/v1/plants/:plantId/photo-entries route uses the mapper (no inline map); response items carry the new fields.
- POST handler unchanged at the call-site level (mapper handles defaults to null).
- photo-journal.tsx + plant-profile.tsx PhotoEntry types include the new optional fields; lightbox/gallery `src` reads signed URL with raw-key fallback.
- plant-profile.tsx renders an `Histórico de Identificação` placeholder section with new i18n keys; no link, no CTA.
- All integration tests green; typecheck clean; pt-BR.json valid.
- Multiple commits in sequence: RED (Task 1) → GREEN (Task 1) → frontend (Task 2) → ID-history (Task 3).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-21-photo-journal-signed-urls-and-id-history-SUMMARY.md` covering the RED/GREEN cycle for CR-03, the frontend wiring, the ID-history placeholder + i18n additions, and gap closure status (CR-03 + ID-history).
</output>
