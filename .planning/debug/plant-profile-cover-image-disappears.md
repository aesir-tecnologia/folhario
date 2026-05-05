---
status: investigating
trigger: "Investigate why the plant profile cover image disappears when the user performs an inline-edit of any field (name, nickname, location, acquisition_date, notes)."
created: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Focus

hypothesis: PATCH response replaces plant cache with object lacking cover_signed_url, causing conditional render to hide cover image
test: traced full mutation flow from onSuccess through cache to render gate
expecting: confirmed — cover image render is gated on plant.cover_signed_url (line 197), which is absent from PATCH response
next_action: ROOT CAUSE CONFIRMED

## Symptoms

<!-- Written during gathering, then IMMUTABLE -->

expected: cover image stays visible during and after inline-edit of name/nickname/location/acquisition_date/notes
actual: cover image disappears when user activates inline-edit on any field (specifically: after saving, on optimistic update during blur)
errors: none reported
reproduction: tap any editable field on plant profile page to activate inline-edit, then blur/save
started: unknown

## Eliminated

- hypothesis: InlineEditField local state causes component remount or conditional render that hides the image
  evidence: InlineEditField only manages mode/draft state; cover image is in PlantProfile outside that component tree
  timestamp: 2026-05-03

- hypothesis: cover image disappears on entering edit mode (before save)
  evidence: onMutate optimistic update (line 73-77 in use-plant-profile-mutations.ts) only sets the patched field on the cached plant object; it spreads the existing plant so cover_signed_url is preserved during edit. Disappearance happens on onSuccess.
  timestamp: 2026-05-03

## Evidence

- timestamp: 2026-05-03
  checked: plant-profile.tsx lines 197-215
  found: cover image renders only if `plant.cover_signed_url` is truthy — `{plant.cover_signed_url && (...)}`
  implication: if cover_signed_url becomes null/undefined in cache, image disappears

- timestamp: 2026-05-03
  checked: use-plant-profile-mutations.ts lines 88-94 (onSuccess)
  found: onSuccess does `qc.setQueryData(key, prev => ({ ...prev, plant: data.plant }))` — it replaces `prev.plant` entirely with the API response
  implication: whatever fields are absent from the API response will be lost from the cache

- timestamp: 2026-05-03
  checked: update-plant-handler.ts line 78
  found: PATCH handler returns `{ plant: toPlantSnakeCase(inner.plant) }` — uses toPlantSnakeCase, NOT toPlantWithSignedUrlSnakeCase
  implication: response has no `cover_signed_url` field

- timestamp: 2026-05-03
  checked: snake-case.ts lines 26-40 vs 42-53
  found: toPlantSnakeCase omits cover_signed_url entirely; toPlantWithSignedUrlSnakeCase adds it
  implication: after onSuccess merges data.plant into cache, cover_signed_url becomes undefined → image disappears

- timestamp: 2026-05-03
  checked: use-plant-profile-mutations.ts lines 69-78 (onMutate)
  found: optimistic update spreads `...previous.plant` and only adds the patched field — cover_signed_url is preserved during the in-flight request
  implication: image is visible while request is in-flight; disappears the moment onSuccess fires and overwrites plant with the stripped API response

## Resolution

root_cause: The PATCH API response (via toPlantSnakeCase) omits cover_signed_url. The onSuccess handler in usePatchPlantField replaces the cached plant object entirely with data.plant, erasing cover_signed_url from the cache. The cover image render is gated on plant.cover_signed_url, so it disappears after every save.
fix: In onSuccess, merge data.plant into the previous cached plant while preserving cover_signed_url (and any other client-only fields not returned by PATCH). Change `plant: data.plant` to `plant: { ...prev.plant, ...data.plant }`.
verification:
files_changed:
  - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
