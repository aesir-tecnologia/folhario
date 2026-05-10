---
phase: 05-catalog-meu-jardim
verified: 2026-05-03T12:00:00Z
status: passed
score: 5/5 must-haves verified
overrides_applied: 8
human_approved_at: 2026-05-09
re_verification:
  previous_status: human_needed
  previous_score: 5/5
  gaps_closed:
    - "Plant profile cover image disappearing after inline field edits — fixed via spread-merge in usePatchPlantField.onSuccess"
    - "Location combobox not opening on click/focus — fixed via openListbox() in onFocus + onClick"
    - "Chrome offline dino appearing instead of cached catalog — fixed via navigate NetworkFirst prepended before defaultCache in runtimeCaching"
    - "Missing delete success toast — fixed via toast.success(t('success')) in useDeletePlant.onSuccess"
    - "Journal page i18n crash on titleFormat — fixed via passing { name: plant.nickname ?? plant.name } variable"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Open /catalog as a user with 0 plants; verify Home empty state ('Identifique sua primeira planta' + camera + 'Adicionar manualmente') and Catalog empty state ('Sua estante ainda está esperando a primeira planta.' + Canopy CTA) render with correct line-art / typography per PRD §17."
    expected: "Visual + screen-reader announcement matches spec."
    why_human: "Visual + assistive-tech check requires real browser/device."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "Add a plant manually; verify the catalog grid is 2 cols at ≤375px, 3 cols at 600–899px, 4 cols at ≥900px and acquisition_date DESC NULLS LAST sort is applied."
    expected: "Breakpoints + sort hold across viewport resize."
    why_human: "Responsive grid breakpoints need a real viewport."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "On plant-profile, attempt inline-edit of name/nickname/location/acquisition_date/notes (tap-to-edit, blur-to-save, Esc-to-cancel) and verify optimistic UI + sonner failure toast. After saving any field, verify the cover image remains visible."
    expected: "Fields save on blur, revert on Esc, toast on PATCH failure, cover image persists after edit."
    why_human: "Input/blur/keyboard interaction + visual cover image persistence validated only in real browser."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "Open the location-picker on plant-profile and on /catalog/add; click (without typing) to verify the listbox opens immediately. Verify it shows prior user locations + 8 i18n defaults + free-text 'Adicionar {typed}' affordance."
    expected: "Combobox opens on click and focus without typing; renders all three sources with APG keyboard nav; outside-click closes listbox."
    why_human: "Combobox click-to-open behavior + keyboard + visual behavior requires real browser."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "Online → offline transition while browsing /catalog and /catalog/[plantId]; verify offline banner appears, previously-loaded plants stay visible (Serwist SWR cache), identify is blocked with clear message. The Chrome dino must NOT appear."
    expected: "OFF-08 catalog browseable + identify blocked banner. Chrome dino does not appear."
    why_human: "SW cache + offline UX requires real browser DevTools offline mode."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "Plant-profile delete flow end-to-end on a real device — tap overflow → 'Excluir planta' → confirm sheet → confirm. Verify: plant disappears from grid, redirect to /catalog, success toast 'Planta excluída com sucesso.' appears, no hydration mismatch errors."
    expected: "Delete completes; redirect to /catalog; toast appears; sort state initialized as 'Adicionadas recentes' on both server and client (no hydration mismatch)."
    why_human: "End-to-end delete UX flow including confirmation sheet, optimistic cache update, route redirect, toast, and hydration parity needs real device."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "Photo-journal lightbox + thumbnail strip on a plant with ≥2 photos. The advisory NEW-CR-01 flagged that listPhotoEntries reverses to newest-first while plant-profile.tsx still slices(1) — newest photo may be missing from carousel; cover may render twice."
    expected: "Open lightbox from cover, swipe through carousel; verify (a) newest photo is reachable, (b) cover does not appear twice, (c) thumbnail strip below cover does not duplicate the cover."
    why_human: "Lightbox carousel composition + thumbnail-strip ordering is observable only by clicking through photos on a plant with 3+ entries."
    result: approved
    override: "user-approved 2026-05-09"
  - test: "Idempotency-key behavior on photo-journal add when the network fails mid-request. Advisory NEW-CR-05 flagged that journal-add-sheet.tsx regenerates the key on retry — defeats the duplicate-protection purpose of the Idempotency-Keys table."
    expected: "Two POSTs of the same payload after a transient 5xx should reach the server with the SAME Idempotency-Key (server returns the previous response, no duplicate row)."
    why_human: "Requires triggering a 5xx + retry on a real backend with the idempotency_keys table; functional bug that's user-observable as duplicate journal entries on flaky networks."
    result: approved
    override: "user-approved 2026-05-09"
---

# Phase 5: Catalog — Meu Jardim Verification Report

**Phase Goal:** A verified user can manually add plants, see them as a responsive 2/3/4-column grid sorted by acquisition date, open a plant profile with photo journal + location picker + delete, and browse a previously-loaded catalog offline — producing the "something to identify INTO" that Phase 6 needs.

**Verified:** 2026-05-03T12:00:00Z
**Status:** passed
**Human approved:** 2026-05-09 (user override — all 8 human UAT items approved)
**Re-verification:** Yes — after Plan 05-gap-closure (Plans 05-24 commits ff7fc0c, 8629ad7, da64edd, 58e482b) closed 5 UAT gaps from the 05-HUMAN-UAT.md cycle.

## Goal Achievement

### Observable Truths — Gap Closure Pass (Plan 05-gap-closure must_haves)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Plant profile cover image stays visible after inline-editing any field | VERIFIED | `use-plant-profile-mutations.ts:88-92` — `onSuccess` uses `{ ...prev, plant: { ...prev.plant, ...data.plant } }` spread merge; cover_signed_url is preserved because it exists in prev.plant but is absent from the PATCH response. Commit ff7fc0c. |
| 2 | Location combobox opens its listbox on click or focus, without requiring typing | VERIFIED | `combobox.tsx:224-230` — `onFocus` handler calls `openListbox()` at line 228; `onClick={() => openListbox()}` prop at line 230. Both call sites verified in file. Commit 8629ad7. |
| 3 | Previously-cached catalog pages remain visible when offline; Chrome dino does not appear | VERIFIED | `sw.ts:67-76` — `runtimeCaching` array starts with `{ matcher: ({ request }) => request.mode === "navigate", handler: new NetworkFirst({ cacheName: "pages", networkTimeoutSeconds: 3 }) }` before `...defaultCache`. The standalone `registerCapture` for navigate is absent — only catalog SWR and `/api/` NetworkOnly remain. Commit da64edd. |
| 4 | Deleting a plant shows a success toast and catalog header renders without hydration mismatch | VERIFIED | (A) `use-plant-profile-mutations.ts:160-162` — `onSuccess` calls `toast.success(t("success"))` before `opts?.onSuccess?.()`. (B) `pt-BR.json:145` — `"success": "Planta excluída com sucesso."` key present. (C) `use-sort-preference.ts:24-31` — `useState<SortId>("date_new")` constant init + `useEffect` to apply stored value after mount, eliminating server/client text mismatch. Commit ff7fc0c (toast + i18n) + 8629ad7 (SSR hydration). |
| 5 | Journal page title renders as '{plantName} — Diário' without i18n formatting errors | VERIFIED | `journal/page.tsx:37-41` — `const { plant } = plantResult` destructure at line 37 precedes the `labels` block at line 40; `t("titleFormat", { name: plant.nickname ?? plant.name })` at line 41 passes the required variable. Commit 58e482b. |

**Score:** 5/5 gap-closure truths verified.

### Observable Truths — ROADMAP Success Criteria (carried from previous verification)

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|-------------------|--------|----------|
| SC-1 | Zero-plants user sees Home empty state "Identifique sua primeira planta" + camera button + "Adicionar manualmente" link; Catalog tab shows "Sua estante ainda está esperando a primeira planta." with Canopy CTA. | VERIFIED | `src/app/(app)/page.tsx:19-42` count===0 branch; `src/messages/pt-BR.json:11-20` pt-BR copy. `catalog-empty.tsx` + `pt-BR.json:42-44`. Prior cycle confirmed; no regression from gap-closure commits. |
| SC-2 | "Adicionar manualmente" creates Plant with name + ≥1 photo + initial PhotoEntry; missing name/photo → validation_failed; grid is 2/3/4-col responsive at correct breakpoints; default sort acquisition_date DESC NULLS LAST. | VERIFIED | `add-plant-form.tsx:138-153`; `route.ts:67-77`; `catalog-grid.tsx:9-10` Tailwind breakpoints; `plants.ts:127-131` orderBy. No regression from gap-closure commits. |
| SC-3 | Plant profile: cover + thumbnail gallery, inline-editable fields, location picker, photo-journal preview, ID-history placeholder, delete overflow. | VERIFIED | All sections in `plant-profile.tsx:149-393`. Cover image now preserved on PATCH round-trip (gap 1 closed). Combobox now opens on click (gap 2 closed). |
| SC-4 | Photo journal entry CRUD; sort control: name A-Z, name Z-A, date newest, date oldest, location; selection persists per session. | VERIFIED | `use-sort-preference.ts` — 5 SORT_IDS + sessionStorage persistence. SSR hydration mismatch resolved (gap 4 closed). Journal page i18n no longer crashes (gap 5 closed). |
| SC-5 | Plant deletion cascades PhotoEntry + Reminder + schedules storage cleanup + sets Identification.plant_id NULL; offline catalog browse works with offline banner. | VERIFIED | FK cascade rules verified; `delete-plant.ts` + Inngest reconciler. Delete success toast now fires (gap 4 closed). Offline browse: navigate NetworkFirst now fires before defaultCache "others" catch-all (gap 3 closed). |

**Score:** 5/5 ROADMAP truths verified.

### Required Artifacts — Gap Closure

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts` | Spread-merge onSuccess for usePatchPlantField; toast.success in useDeletePlant.onSuccess | VERIFIED | Line 88-92: `{ ...prev.plant, ...data.plant }`; line 161: `toast.success(t("success"))`. |
| `src/shared/ui/combobox.tsx` | openListbox() called on both onFocus and onClick | VERIFIED | Line 228: `openListbox()` in onFocus; line 230: `onClick={() => openListbox()}`. |
| `src/app/sw.ts` | navigate NetworkFirst entry prepended before defaultCache in runtimeCaching array | VERIFIED | Lines 67-76: navigate handler is first entry; no standalone registerCapture for navigate. |
| `src/app/(app)/catalog/_components/use-sort-preference.ts` | useState initialized with 'date_new' always; stored value applied in useEffect | VERIFIED | Line 24: `useState<SortId>("date_new")`; lines 26-31: useEffect reads sessionStorage + setSortId. ESLint disable-line comment on line 29 is intentional per SUMMARY decision log. |
| `src/messages/pt-BR.json` | catalog.profile.delete.success key added | VERIFIED | Line 145: `"success": "Planta excluída com sucesso."` present inside the `delete` object. |
| `src/app/(app)/catalog/[plantId]/journal/page.tsx` | t('titleFormat') called with { name: plant.nickname ?? plant.name } | VERIFIED | Lines 37-41: plant destructure before labels block; t("titleFormat", { name: plant.nickname ?? plant.name }) at line 41. |

### Key Link Verification — Gap Closure

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| usePatchPlantField.onSuccess | cached plant query | spread merge preserves cover_signed_url | WIRED | `{ ...prev, plant: { ...prev.plant, ...data.plant } }` at line 88-92 |
| combobox input | openListbox() | onFocus and onClick handlers | WIRED | Both call sites at lines 228, 230 |
| sw.ts runtimeCaching | navigate NetworkFirst | first entry in array before defaultCache spread | WIRED | Lines 67-76; no competing standalone registerCapture for navigate |
| useSortPreference | sessionStorage | useEffect after mount | WIRED | Lines 26-31; eslint disable-line comment on setState in effect |
| JournalPage t('titleFormat') | plant.name | { name: plant.nickname ?? plant.name } | WIRED | Lines 37-41; plant destructure precedes labels block |
| useDeletePlant.onSuccess | toast.success | t("success") from catalog.profile.delete namespace | WIRED | Line 161; i18n key at pt-BR.json:145 |

### Data-Flow Trace (Level 4)

No new data-flow concerns introduced by gap-closure commits — all changes are client-state fixes, i18n string interpolation, and service worker route ordering. Data-flow trace from prior cycle remains valid. The hollow_prop note for `AddPlantForm initialLocationSuggestions` is unchanged and still a minor UX gap.

### Behavioral Spot-Checks

Step 7b: SKIPPED — gap-closure changes are client-only state/rendering fixes with no runnable entry points testable without a live Supabase + Inngest stack.

Commit verification: all 4 commits confirmed in git log — ff7fc0c, 8629ad7, da64edd, 58e482b.

TypeScript typecheck: summary confirms `pnpm exec tsc --noEmit` exits cleanly post-closure.

Sort preference unit tests: summary confirms all 5 tests in `use-sort-preference.unit.test.tsx` pass.

### Requirements Coverage

| Requirement | Description | Status | Evidence |
|-------------|-------------|--------|----------|
| CAT-03 | Manual create missing name OR photo → validation_failed | SATISFIED | `add-plant-form.tsx` + route handler; REQUIREMENTS.md marked Complete for Phase 5. |
| CAT-04 | Plant profile shows name, nickname, room, date, notes, cover, care, reminders, journal, ID-history | SATISFIED | All sections in `plant-profile.tsx`; cover image now survives PATCH (gap 1 closed); REQUIREMENTS.md marked Complete. |
| CAT-07 | Catalog default sort acquisition_date DESC NULLS LAST | SATISFIED | `plants.ts:127-131`; REQUIREMENTS.md marked Complete. |
| OFF-08 | Previously-loaded catalog browseable offline; identify blocked | SATISFIED | Navigate NetworkFirst now fires before defaultCache "others" catch-all (gap 3 closed); REQUIREMENTS.md marked Complete. |

All 4 requirements from gap-closure plan frontmatter confirmed Complete in REQUIREMENTS.md traceability table.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `use-sort-preference.ts` | 29 | eslint-disable-line react-hooks/set-state-in-effect | Info | Intentional client-initialization pattern per SUMMARY decision log; effect runs once on mount after hydration — not a performance anti-pattern. |

No new TODOs, placeholders, or empty implementations introduced by gap-closure commits.

### Advisory Items Carried Forward (from prior cycle 05-REVIEW.md)

These are NOT blocking gaps for phase completion. They are tracked here for developer awareness:

| ID | File | Issue | Severity |
|----|------|-------|----------|
| NEW-CR-01 | `plant-profile.tsx:113-130, 214-234, 339-358` | Lightbox/thumbnail strip off-by-one: listPhotoEntries reverses to newest-first but slice(1) skips newest and slice(0,4) may include cover twice | CRIT (user-visible on ≥2 photos) |
| NEW-CR-02 | `use-plant-profile-mutations.ts:38, 104` | `const qc = opts?.queryClient ?? useQueryClient()` — Rules-of-Hooks violation if caller varies opts.queryClient between renders | CRIT (latent) |
| NEW-CR-03 | `plant-profile.tsx:155, 196, 203, 220, 226, 345, 351, 391` | Hardcoded pt-BR strings ("Voltar", "Foto N de N", "Fechar") violate next-intl day-one constraint | CRIT (functional in pt-BR-only) |
| NEW-CR-04 | `delete-photo-entry.ts:34-38` | `extractObjectKey` does not validate bucket prefix against KNOWN_BUCKETS | CRIT (latent) |
| NEW-CR-05 | `journal-add-sheet.tsx:138, 143` | Idempotency-Key regenerated on retry — defeats dedupe purpose on flaky networks | CRIT (user-observable as duplicate journal entries) |

### Human Verification

Eight items — all approved by user on 2026-05-09. See `human_verification` in frontmatter.

**Three items were updated by this gap-closure re-verification pass:**

1. **Inline-edit cover image persistence** (test 3) — gap 1 is closed in code; human re-test needed to confirm cover image actually stays visible on the physical device after a field save.

2. **Location combobox click-to-open** (test 4) — gap 2 is closed in code (`openListbox()` in onFocus + onClick); human re-test needed to confirm the listbox opens on first click without typing in a real browser.

3. **Online → offline (no Chrome dino)** (test 5) — gap 3 is closed in code (navigate NetworkFirst prepended); human re-test needed to confirm Chrome dino no longer appears.

4. **Delete flow with success toast and no hydration mismatch** (test 6) — gap 4 is closed in code (toast.success + SSR-safe sort init); human re-test needed to confirm toast appears and no hydration error fires.

5. **Journal page title** (test 8) — gap 5 is closed in code; no separate human re-test needed beyond the normal journal page open.

**Three items carry forward unchanged from prior cycle:**

6. Empty-state visuals (test 1) — visual check.
7. Responsive grid breakpoints (test 2) — requires real viewport.
8. Idempotency-key on retry (test 8, NEW-CR-05) — requires flaky-network simulation.

**Two advisory items need human confirmation:**

9. Lightbox/thumbnail composition off-by-one (NEW-CR-01) — observable only with ≥2 photos on real device.
10. Idempotency-key churn observable as duplicate journal entries on transient 5xx retries (NEW-CR-05).

### Gaps Summary

**All 5 UAT gaps are closed in code** (confirmed by direct file inspection):

- Gap 1 (cover image loss on PATCH): `usePatchPlantField.onSuccess` at `use-plant-profile-mutations.ts:88-92` uses spread merge `{ ...prev.plant, ...data.plant }` — cover_signed_url preserved.
- Gap 2 (combobox click-to-open): `combobox.tsx:228,230` — `openListbox()` in both onFocus and onClick.
- Gap 3 (Chrome dino offline): `sw.ts:67-76` — navigate NetworkFirst is first in runtimeCaching; standalone registerCapture for navigate removed.
- Gap 4 (no delete toast + hydration mismatch): `use-plant-profile-mutations.ts:161` — `toast.success(t("success"))`; `pt-BR.json:145` — success key present; `use-sort-preference.ts:24` — `useState("date_new")` constant + useEffect.
- Gap 5 (journal i18n crash): `journal/page.tsx:37,41` — plant destructured before labels; `t("titleFormat", { name: plant.nickname ?? plant.name })`.

**UAT test 7 (CSS chunk preload warning, minor-severity)** was intentionally out of scope for this gap-closure plan. The prior 05-HUMAN-UAT.md classified it as a known Turbopack dev-mode behavior (CSS chunks preloaded speculatively but not consumed within the browser timeout window) — not a production concern. No fix required.

**All ROADMAP success criteria verified.** Phase 6 remains unblocked.

**All 8 human verification items approved by user on 2026-05-09.** Phase status: passed.

---

_Verified: 2026-05-03T12:00:00Z_
_Verifier: Claude (gsd-verifier)_
_Re-verification: post-Plan 05-gap-closure (commits ff7fc0c, 8629ad7, da64edd, 58e482b)_
