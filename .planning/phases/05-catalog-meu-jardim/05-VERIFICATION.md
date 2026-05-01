---
phase: 05-catalog-meu-jardim
status: gaps_found
must_haves_verified: 2
must_haves_total: 5
requirement_coverage: 10/16
gaps:
  - CR-02 — useDeletePlant fires DELETE /api/v1/plants/:id WITHOUT Idempotency-Key header (src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts:112-114). Route handler rejects with 400 validation_failed (src/contexts/catalog/api/route-handlers/delete-plant-handler.ts:47-50). The plant-profile delete button is BROKEN — it never deletes; mutation throws and onSuccess + router.push("/catalog") is unreachable. Breaks SC-3 ("plant profile with ... delete") and SC-5 (delete cascade unreachable from UI).
  - CR-03 — Photo-journal lightbox renders unsigned bucket-key as src (src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx:65 builds {src: e.photo_url}). list-photo-entries.ts:40-51 only signs thumbnailUrl; photoUrl stays as raw "plant-photos/userId/.../photoId.jpg" string. Browser interprets as relative URL → full-size view broken on every entry. Breaks SC-4 photo journal preview/lightbox, breaks UI-11.
  - WR-05 — Photo-journal POST response shape mismatch (src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx:127-130). Client reads body.data, server returns body.photo_entry (src/app/api/v1/plants/[plantId]/photo-entries/route.ts:112). Optimistic temp entry is replaced with undefined; UI renders undefined entries until invalidateQueries refetch resolves. Breaks SC-4 photo-journal "add entry" flow.
  - CR-01 — Photo-entry deletion strands storage bytes (src/contexts/catalog/application/delete-photo-entry.ts:145-154 writes prefix=photoKey full object key, but src/contexts/catalog/inngest/functions.ts:152-161 reconciler validates against `${userId}/${plantId}/` shape and routes to deletePrefix which silently no-ops on object keys). Bytes are never deleted. Breaks SC-4 (photo journal entry CRUD — delete leaves orphaned media) and creates LGPD storage-deletion gap that will compound in Phase 11.
  - CR-04 — GET /api/v1/plants/[plantId] route response drops cover_signed_url (src/app/api/v1/plants/[plantId]/route.ts:47-56 calls toPlantSnakeCase, which omits cover_signed_url; coverSignedUrl from getPlant is discarded). The SSR plant-detail page papers over this by injecting the field directly, but TanStack Query refetches and any direct API consumer cannot render the cover. Breaks SC-3 ("Plant profile: cover ... gallery") on TanStack refetch path.
  - WR-04 — Focus ring outline fails CLAUDE.md spec ("3px Canopy @ 40% offset 2px"). modal-sheet.tsx:90-94 + inline-edit-field.tsx:242-244,263-265,282-284 use outline-2/ring-2 (2px). WCAG-AA met but project brand spec is not. Breaks UI-08 inline-edit affordance per project standard.
human_verification:
  - test: Open /catalog as a user with 0 plants, confirm Home empty state ("Identifique sua primeira planta" + camera + "Adicionar manualmente") and Catalog empty state ("Sua estante ainda está esperando a primeira planta." + Canopy CTA) render with correct line-art / typography per PRD §17 empty-state composition; expected — visual + screen-reader announcement matches spec; why_human — visual + assistive-tech check requires real browser/device.
  - test- Add a plant manually, then verify the catalog grid is 2 cols at ≤375px, 3 cols at 600–899px, 4 cols at ≥900px and acquisition_date DESC NULLS LAST sort is applied; expected — breakpoints + sort hold across viewport resize; why_human — responsive grid breakpoints need a real viewport.
  - test- On plant-profile, attempt inline-edit of name/nickname/location/acquisition_date/notes (tap-to-edit, blur-to-save, Esc-to-cancel) and verify optimistic UI + sonner failure toast; expected — fields save on blur, revert on Esc, toast on PATCH failure; why_human — input/blur/keyboard interaction validated only in real browser.
  - test- Open the location-picker on plant-profile and on /catalog/add, and verify it shows prior user locations + 8 i18n defaults (sala, varanda, quarto, banheiro, cozinha, escritório, jardim, outro) + free-text "Adicionar '{typed}'" affordance; expected — combobox renders all three sources with APG keyboard nav; why_human — combobox keyboard + visual behavior; also CR-03/WR-08 (combobox does not close on outside click) needs human confirmation.
  - test- Online → offline transition while browsing /catalog and /catalog/[plantId]; verify the offline banner appears, previously-loaded plants stay visible (Serwist SWR cache), and identify is blocked with clear message; expected — OFF-08 catalog browseable + identify blocked banner; why_human — SW cache + offline UX requires real browser DevTools offline mode.
  - test- Plant-profile delete flow end-to-end on real device — tap overflow → "Excluir planta" → confirm sheet → confirm. Expected — plant disappears from grid, redirect to /catalog, cascade-counts preview is correct in sheet; current code emits DELETE without Idempotency-Key (CR-02) so this WILL fail in the UI; once CR-02 is fixed, human must re-test the cascade UX.
---

# Phase 5: Catalog — Meu Jardim Verification Report

**Phase Goal:** A verified user can manually add plants, see them as a responsive 2/3/4-column grid sorted by acquisition date, open a plant profile with photo journal + location picker + delete, and browse a previously-loaded catalog offline — producing the "something to identify INTO" that Phase 6 needs.

**Verified:** 2026-05-01
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (5 ROADMAP Success Criteria)

| #   | Truth (ROADMAP SC) | Status | Evidence |
| --- | ------ | ------ | -------- |
| SC-1 | Zero-plants user sees Home empty state "Identifique sua primeira planta" + camera button + "Adicionar manualmente" link, Catalog tab shows "Sua estante ainda está esperando a primeira planta." with Canopy CTA. | VERIFIED | `src/app/(app)/page.tsx:19-42` — count===0 branch renders title + CaptureButton + manual-add Link; `src/messages/pt-BR.json:11-20` matches required pt-BR copy. `src/app/(app)/catalog/_components/catalog-empty.tsx:6-18` + `src/messages/pt-BR.json:42-44` matches Catalog empty copy. `src/app/(app)/catalog/page.tsx:47-48` gates on totalCount===0. |
| SC-2 | "Adicionar manualmente" creates Plant with name + ≥1 photo + initial PhotoEntry; missing name/photo → validation_failed; grid is 2/3/4-col responsive at correct breakpoints; default sort acquisition_date DESC NULLS LAST. | VERIFIED | `src/app/(app)/catalog/add/add-plant-form.tsx:138-153` posts multipart to /api/v1/plants; `src/app/api/v1/plants/route.ts:67-77` validates name + photo, returns ValidationFailed with field issues. `src/contexts/catalog/application/create-plant.ts` creates Plant + PhotoEntry in one TX (use-case wired to route). `src/app/(app)/catalog/_components/catalog-grid.tsx:9-10` grid uses `grid-cols-2 [@media(min-width:600px)]:grid-cols-3 [@media(min-width:900px)]:grid-cols-4` (matches 375/600/900 spec). `src/contexts/catalog/infrastructure/db/plants.ts:127-131` orderBy `acquisition_date desc nulls last` for date_new (default per `src/app/(app)/catalog/page.tsx:21`). |
| SC-3 | Plant profile: cover + thumbnail gallery, inline-editable name/nickname/room/acquisition_date/notes, active-reminders placeholder, photo-journal preview, ID-history link placeholder, delete overflow. Location picker: prior locations + 8 defaults + free text reusable. | FAILED | Cover, gallery, inline edits, reminders+journal placeholders, location combobox all wired (`src/app/(app)/catalog/[plantId]/plant-profile.tsx:191-369`). HOWEVER **delete is broken** (CR-02): `use-plant-profile-mutations.ts:112-114` issues DELETE without `Idempotency-Key`, route at `delete-plant-handler.ts:47-50` rejects with 400 `validation_failed`. CR-04 also drops `cover_signed_url` from GET response, breaking refetch path. ID-history link is missing from UI (no placeholder rendered). |
| SC-4 | Photo journal entry CRUD; sort control: name A-Z, name Z-A, date newest, date oldest, location; selection persists per session. | FAILED | Sort control verified — 5 SORT_IDS in `use-sort-preference.ts:5`, persisted via sessionStorage (`use-sort-preference.ts:23-24`). Photo journal CRUD broken on multiple axes: **CR-03** lightbox uses unsigned `photo_url` (`photo-journal.tsx:65`, `list-photo-entries.ts:42-49`) — full-size view broken on every entry; **WR-05** journal-add response-shape mismatch (`journal-add-sheet.tsx:127`) — optimistic UI reads `body.data` but server returns `body.photo_entry`, causing `undefined` rows; **CR-01** photo-entry delete strands storage bytes (`delete-photo-entry.ts:145-154` writes object-key as prefix; reconciler validates trailing-slash shape and silently no-ops). |
| SC-5 | Plant deletion cascades PhotoEntry + Reminder + schedules storage cleanup + sets Identification.plant_id NULL preserving history; offline catalog browse works with offline banner. | VERIFIED | DB cascade rules verified: `photo_entries.plant_id` ON DELETE CASCADE (`src/contexts/catalog/infrastructure/db/schema.ts:64-66`), `reminders.plant_id` ON DELETE CASCADE (`src/contexts/reminders/infrastructure/db/schema.ts:32-34`), `identifications.plant_id` ON DELETE SET NULL (`src/contexts/identification/infrastructure/db/schema.ts:44`). `src/contexts/catalog/application/delete-plant.ts:65-76` deletes plant + inserts 2 pending_storage_deletions rows (plant-photos + plant-thumbnails buckets) with trailing-slash prefix; emits `plant.deleted` Inngest event in postCommit. `src/contexts/catalog/inngest/functions.ts` cleanupStorage handler + reconciler cron pick up rows. Offline catalog: `src/app/sw.ts:72-92` SWR runtime cache for `/api/v1/plants*`, `/api/v1/photo-entries*`, `/api/v1/locations` with 7d max-age; `src/app/(app)/app-shell.tsx:14,147` mounts `<OfflineBanner />`. NOTE: SC-5 plant-deletion backend is sound; the UI delete button is unreachable due to CR-02 (counted under SC-3). |

**Score:** 2/5 truths verified. SC-1, SC-2, SC-5 VERIFIED. SC-3 + SC-4 FAILED.

### Deferred Items

| #   | Item    | Addressed In | Evidence                            |
| --- | ------- | ------------ | ----------------------------------- |
| 1   | CAT-01 — Plant created from identification with `species_id` populated, name pre-filled, cover from identification upload | Phase 6 | `05-CONTEXT.md` <domain> block explicitly states "Plant creation from identification (`species_id` populated, `Identification.plant_id` FK set) — Phase 6". The Phase-5 `create-plant.ts` use-case will be invoked by Phase 6 with `source: 'identification'` per CONTEXT D-02. |

### Required Artifacts (Spot Checks)

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `src/app/(app)/page.tsx` | Home server component with empty/bridge branches | VERIFIED | countForUser called; pt-BR copy via next-intl. |
| `src/app/(app)/catalog/page.tsx` | Server component; first-page list + count; SSR-hydrate | VERIFIED | dehydrate + HydrationBoundary; 2/3/4 grid via CatalogGrid. |
| `src/app/(app)/catalog/add/add-plant-form.tsx` | Single-screen multipart POST; field validation | VERIFIED | Sends multipart to /api/v1/plants with name+photo+optional fields; redirects to /catalog/{id} on success. |
| `src/app/(app)/catalog/[plantId]/plant-profile.tsx` | Cover + gallery + inline-edit + reminders/journal placeholder + delete overflow | PARTIAL | All sections present; ID-history link missing; delete overflow renders but mutation broken (CR-02); cover signed-URL works on SSR but refetch breaks (CR-04). |
| `src/app/(app)/catalog/[plantId]/journal/photo-journal.tsx` | Lightbox + add-entry sheet + reverse-chronological list | STUB-LIKE FOR LIGHTBOX | List + sort + sheet wired, but lightbox `src` uses unsigned `photo_url` (CR-03) — full-size always broken. |
| `src/app/api/v1/plants/route.ts` | POST multipart + GET cursor list | VERIFIED | Idempotency-Key required + multipart parsing + Sort/cursor/include_count. |
| `src/app/api/v1/plants/[plantId]/route.ts` | GET + PATCH + DELETE | PARTIAL | GET drops cover_signed_url (CR-04); PATCH OK; DELETE handler requires Idempotency-Key but client omits it (CR-02). |
| `src/app/api/v1/plants/[plantId]/photo-entries/route.ts` | POST + GET | PARTIAL | POST returns `{photo_entry: ...}` but client expects `{data: ...}` (WR-05). |
| `src/app/api/v1/locations/route.ts` | GET ranked suggestions | VERIFIED | Owner-scoped via requireVerifiedUser; snake_case mapping. |
| `src/contexts/catalog/inngest/functions.ts` | cleanupStorage event handler + reconciler cron | PARTIAL | Plant-prefix path correct; photo-entry object-key path strands bytes (CR-01). |
| `src/app/sw.ts` | SWR cache for catalog/photo-entries/locations + offline fallback | VERIFIED | 7d max-age; navigation NetworkFirst with /offline fallback. |
| `src/messages/pt-BR.json` | All Phase-5 i18n keys | VERIFIED | catalog.{empty,add,profile,journal,locations,offline,readOnly}, home.empty.* present. |

### Key Link Verification

| From | To  | Via | Status | Details |
| ---- | --- | --- | ------ | ------- |
| Home (page.tsx) | countForUser | direct import | WIRED | Server-side count drives empty/bridge branch. |
| Catalog page | listPlants use-case | direct call + dehydrate | WIRED | First-page SSR + TanStack hydration. |
| AddPlantForm | POST /api/v1/plants | fetch multipart + Idempotency-Key | WIRED | Validation errors mapped to per-field errors. |
| PlantProfile | DELETE /api/v1/plants/:id | useDeletePlant fetch | NOT_WIRED | Missing Idempotency-Key header — server returns 400 validation_failed (CR-02). |
| PhotoJournal | POST /api/v1/plants/:id/photo-entries | journal-add-sheet fetch | PARTIAL | Request OK; response shape mismatch (WR-05). |
| PhotoJournal Lightbox | photo_url signed | list-photo-entries sign | NOT_WIRED | photoUrl never signed — only thumbnailUrl signed (CR-03). |
| deletePlant | catalog/cleanup-storage Inngest | inngest.send | WIRED | postCommit emits event after TX commit; reconciler cron handles stuck rows. |
| deletePhotoEntry | pending_storage_deletions | repo.create | PARTIAL | Row inserted but reconciler can never complete it (CR-01). |
| (app) shell | OfflineBanner | useOnlineStatus | WIRED | Banner mounted in app-shell.tsx:147. |
| /api/v1/* SWR cache | catalog/photo-entries/locations | Serwist registerCapture | WIRED | StaleWhileRevalidate with 7d max-age. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| CatalogGrid | data.items | useQuery(plantsKeys.lists) hydrated from listPlants SSR | YES (DB query in plants repo `list`) | FLOWING |
| PlantProfile | plantQuery.data.plant | useQuery hydrated from getPlant SSR (toPlantWithSignedUrlSnakeCase) | YES (DB findByIdForUser + signing) | FLOWING (SSR); HOLLOW on refetch (CR-04 drops signed cover) |
| PhotoJournal | rawEntries | useQuery hydrated from listPhotoEntries SSR | YES (DB query in photo-entries repo) | FLOWING for thumbnail; HOLLOW for full-size (CR-03 unsigned photo_url) |
| AddPlantForm | location combobox suggestions | initialLocationSuggestions=[] passed in | NO (page passes empty array) | HOLLOW_PROP — page.tsx:41 hard-codes `initialLocationSuggestions={[]}`; suggestions only loaded after first save via locations query — minor UX gap. |
| LocationCombobox (profile) | locationsQuery.data.locations | useQuery(locationsKeys.all) | YES (route + use-case + repo) | FLOWING |

### Behavioral Spot-Checks

Skipped: Phase produces server + client code reachable only with Supabase + Inngest running. Coverage is provided by the integration tests bundled in the phase commits (`tests/integration/catalog-*`) and the existing Playwright fixtures, which the orchestrator runs separately. Manual verification listed in human_verification.

### Requirements Coverage (16 IDs)

| Requirement | Description | Status | Evidence |
| ----------- | ----------- | ------ | -------- |
| CAT-01 | Plant from identification with species_id, prefilled name, ID cover | DEFERRED | CONTEXT D-01 explicitly defers to Phase 6. |
| CAT-02 | Manual create: name + ≥1 photo → Plant + PhotoEntry | SATISFIED | add-plant-form.tsx + create-plant.ts + /api/v1/plants POST. |
| CAT-03 | Missing name OR photo → validation_failed | SATISFIED | Inline + summary errors + 400 from route handler. |
| CAT-04 | Plant profile: name/nickname/room/date/notes/cover/care/reminders/journal/ID-history | PARTIAL | Care card not in scope (Phase 7 OK); ID-history link MISSING from UI; delete broken (CR-02); active reminders + journal placeholders OK; cover broken on refetch (CR-04). |
| CAT-05 | Location picker: prior + defaults + free text reusable | SATISFIED | LocationCombobox + locations.defaults i18n + list-locations use-case. |
| CAT-06 | Photo journal entry CRUD with reverse-chronological timeline | BLOCKED | CR-01 strands storage on delete; WR-05 breaks add UX; CR-03 breaks lightbox. |
| CAT-07 | Default sort acquisition_date DESC NULLS LAST | SATISFIED | plants.ts:127-131 buildOrderBy date_new. |
| CAT-08 | Sort options + sessionStorage persistence | SATISFIED | use-sort-preference.ts SORT_IDS + read/write sessionStorage. |
| CAT-09 | Delete cascade + storage scheduled + Identification.plant_id NULL | SATISFIED (BACKEND) | FK rules + delete-plant.ts + cleanupStorage Inngest. UI button unreachable due to CR-02 — covered under CAT-04. |
| CAT-10 | Grid responsive 2/3/4 at 375/600/900 | SATISFIED | catalog-grid.tsx GRID_CLASS Tailwind arbitrary breakpoints. |
| CAT-11 | Empty catalog state with Sage line-art + Canopy CTA | SATISFIED | catalog-empty.tsx + EmptyState primitive + i18n copy. |
| OFF-08 | Previously-loaded catalog browseable offline; identify blocked | SATISFIED | Serwist SWR cache + identify placeholder offline copy + OfflineBanner. |
| UI-04 | Home empty: "Identifique sua primeira planta" + camera + manual link | SATISFIED | page.tsx empty branch. |
| UI-07 | Catalog grid 2/3/4 + 4:5 + sort | SATISFIED | catalog-grid + plant-card + sort control. |
| UI-08 | Plant profile + variants + delete overflow | PARTIAL | Sections present but delete button broken (CR-02), focus ring 2px not 3px (WR-04), ID-history surface missing. |
| UI-11 | Photo journal screen with add entry; read-only variant | PARTIAL | Add path WR-05; lightbox CR-03; read-only respected (readOnlyProp || subscription.readOnly). |

**Coverage:** 10 SATISFIED + 5 PARTIAL/BLOCKED + 1 DEFERRED = 10/16 fully satisfied (CAT-01 deferred per CONTEXT). Recorded as `requirement_coverage: 10/16`.

### Anti-Patterns Found (Beyond Code Review)

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| src/app/(app)/catalog/add/page.tsx | 8 | Dead conditional `process.env.ENABLE_TEST_ROUTES === "1" ? false : false` (WR-09) | Warning | Misleading; breaks read-only gate when Phase 10 wires Stripe state. |
| src/app/(app)/catalog/[plantId]/journal/page.tsx | 62 | Non-canonical env var `SUBSCRIPTION_READ_ONLY` (WR-10) | Warning | Diverges from `ENABLE_TEST_ROUTES` + `__test_subscription_read_only` cookie pattern; will silently flip gate global on misconfiguration. |
| src/app/api/v1/plants/route.ts (POST) + .../photo-entries/route.ts | — | Read-only gate not applied to POST handlers (WR-11) | Warning | Today benign; will incoherently allow paying-but-read-only users to create plants in Phase 10. |
| src/contexts/catalog/application/delete-plant.ts | 49 | Ownership check OUTSIDE outer transaction (WR-02) | Warning | TOCTOU window on concurrent delete races; reconciler may delete bytes the user did not intend. |
| src/shared/ui/combobox.tsx | 24-264 | No outside-click close handler (WR-08) | Warning | UX bug — listbox sticky after focus shift. |
| src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts | 38, 104 | `useQueryClient()` called conditionally on `??` short-circuit (WR-07) | Warning | Rules-of-Hooks violation; happens to work because callers pass a constant. |
| src/app/sw.ts | 72-92 + logout-link.tsx:38 | SW catalog cache leaks across users on session expiry (WR-01) | Warning | Partial mitigation via explicit logout; LGPD-adjacent concern. |
| src/shared/ui/{modal-sheet,inline-edit-field}.tsx | various | Focus ring `outline-2`/`ring-2` (WR-04) | Warning | Project spec is 3px; WCAG 2.1 SC 2.4.7 still met. |
| src/shared/ui/bottom-sheet.tsx + modal-sheet.tsx | 35-36, 64-101 | Doc claims `motion-reduce:*` but no such Tailwind variants present (WR-03) | Info | Misleading comment; no functional bug. |
| src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx | 92-100 | Two `URL.createObjectURL(...)` never revoked (WR-06) | Warning | Memory leak per add. |
| src/app/(app)/catalog/_components/use-sort-preference.ts | 23-24 | sessionStorage read in useState init (WR-12) | Warning | React 19 hydration mismatch risk. |
| src/contexts/catalog/application/update-plant.ts | 81 | Trim-only location not normalized to null (WR-13) | Info | Schema-level normalize would fix; cosmetic. |
| src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx | 106-108, 138, 143 | Idempotency key reset before await (WR-14) | Warning | Retry under new key may duplicate row. |

### Human Verification Required

See `human_verification` in frontmatter — six items spanning visual/empty-state composition, responsive grid breakpoints, inline-edit interaction model, location combobox keyboard nav + outside-click, online→offline transition with banner, and end-to-end delete flow on a real device (which will only succeed after CR-02 is fixed).

### Gaps Summary

The phase ships a coherent catalog domain with strong backend guarantees: RLS-backed repositories, idempotency, transaction handoff, durable storage cleanup pipeline, snake_case route contracts, all required UI primitives. **Backend cascade behavior for plant deletion is sound** (FK rules + Inngest event + reconciler cron + pending_storage_deletions table). **Offline catalog browse works** (SWR cache + OfflineBanner).

But **two of five must-haves fail** at the integration layer:

- **SC-3 (plant profile + delete)** — the UI delete button is broken because the mutation hook omits `Idempotency-Key` (CR-02). Cover signed URL is also dropped from the GET response (CR-04), so the cover does not refetch correctly. ID-history link is missing from the UI. This is "tasks done, goal missed" — code exists, but the wiring is wrong.
- **SC-4 (photo journal CRUD)** — three independent integration defects: lightbox renders unsigned bucket-key string as `<img src>` (CR-03), the journal-add response shape is mismatched (WR-05), and the photo-entry delete pipeline strands storage bytes forever because the reconciler validates only the trailing-slash plant-prefix shape (CR-01).

The four code-review CRITICALs (CR-01..04) are fully reproduced in code. WR-05 is the same severity tier as CR-03 in user-impact and is included as a gap. WR-09 (dead `readOnly` conditional) and WR-10 (non-canonical env var) do not block Phase 5 because the stub `useSubscription` returns `{readOnly: false}` constant — they are flagged as warnings for Phase 10 attention.

CAT-01 is deferred to Phase 6 per CONTEXT D-01 and is not counted against this phase.

Phase 6 should NOT proceed until CR-01..04 are resolved — without a working delete and a working photo journal, "something to identify INTO" is not achieved.

---

_Verified: 2026-05-01_
_Verifier: Claude (gsd-verifier)_
