---
status: resolved
trigger: "Investigate two related issues in the catalog after a plant delete flow: Issue A hydration mismatch in catalog-header.tsx:75 aria-live sort announcement, Issue B no delete toast after confirming plant deletion"
created: 2026-05-03T00:00:00Z
updated: 2026-05-03T00:00:00Z
---

## Current Focus

hypothesis: Both root causes confirmed — see Resolution
test: N/A
expecting: N/A
next_action: resolved

## Symptoms

expected: A) Server and client agree on initial sort value. B) A success toast fires after plant deletion and redirect to /catalog.
actual: A) aria-live region renders "Adicionadas antigas" (date_old) on server but "Adicionadas recentes" (date_new) on client — React hydration mismatch. B) No toast appears after successful delete; user is redirected silently.
errors: A) React hydration error on aria-live div in catalog-header.tsx:75. B) No error; toast simply never fires.
reproduction: A) Load /catalog — observe hydration warning in console. B) Delete a plant via the confirm sheet; observe redirect to /catalog with no toast.
started: Present in current codebase

## Eliminated

(none)

## Evidence

- timestamp: 2026-05-03T00:00:00Z
  checked: src/app/(app)/catalog/_components/use-sort-preference.ts
  found: useState(readStoredSort) — readStoredSort reads sessionStorage on client, returns "date_new" on server (typeof window === "undefined"). On first client render, if sessionStorage has a stored value like "date_old", the initial state disagrees with the server render.
  implication: Classic localStorage/sessionStorage hydration mismatch — server always returns "date_new" but client may return a different stored value on first render.

- timestamp: 2026-05-03T00:00:00Z
  checked: src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts — useDeletePlant onSuccess
  found: onSuccess only calls opts?.onSuccess?.() — no toast.success() call anywhere in the success path.
  implication: The success toast was never wired up. onSuccess in plant-profile.tsx calls router.push("/catalog") only.

- timestamp: 2026-05-03T00:00:00Z
  checked: src/app/(app)/catalog/page.tsx
  found: Server component, no searchParams read, no toast trigger on arrival.
  implication: There is no cross-route toast mechanism (e.g. URL param ?deleted=1) either — the toast needs to fire before navigation or be added.

## Resolution

root_cause: |
  Issue A: useSortPreference calls useState(readStoredSort) where readStoredSort reads sessionStorage synchronously. On the server readStoredSort returns "date_new" (window is undefined). On the client, if sessionStorage contains a different sort (e.g. "date_old"), React initializes with that value — producing a different aria-live text than what the server rendered, causing a hydration mismatch.

  Issue B: useDeletePlant.onSuccess never calls toast.success(). The hook only invokes the caller-supplied opts.onSuccess callback (which in plant-profile.tsx is router.push("/catalog")). No success toast was ever written.

fix: |
  Issue A: Initialize useState with the server-safe default ("date_new"), then in a useEffect after mount read sessionStorage and call setSortId if the stored value differs. This matches server output on first render and reconciles with stored preference client-side without a hydration mismatch.

  Issue B: Add toast.success(t("success")) call inside useDeletePlant.onSuccess before calling opts?.onSuccess?.(). Add a "success" key to the catalog.profile.delete translation namespace. The toast fires before router.push("/catalog") unmounts the component, so Sonner's toaster (in the layout) will display it.

files_changed:
  - src/app/(app)/catalog/_components/use-sort-preference.ts
  - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
  - src/messages/pt-BR.json
