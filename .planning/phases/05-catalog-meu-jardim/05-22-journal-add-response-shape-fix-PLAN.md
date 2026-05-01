---
phase: 05-catalog-meu-jardim
plan: 22
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx
  - tests/unit/journal-add-sheet.test.tsx
autonomous: true
gap_closure: true
requirements:
  - CAT-06
  - UI-11
tags:
  - catalog
  - photo-journal
  - response-shape
  - optimistic-cache
  - gap-closure
must_haves:
  truths:
    - "After a successful POST /api/v1/plants/:plantId/photo-entries, the optimistic temp entry is replaced with `body.photo_entry` (server contract per `route.ts:112` is locked) — never `body.data`. WR-05 fix; SC-4 photo-journal add UX."
    - "The cache merge after success uses the typed `body.photo_entry` field; the `setQueryData` callback emits the real entry shape, never `undefined`."
    - "Unit test asserts the cache transition: optimistic temp entry → real `photo_entry` from the response, with no `undefined` row visible to renders between cache-set and refetch."
    - "No server-side change. The route handler at `src/app/api/v1/plants/[plantId]/photo-entries/route.ts:109-115` already returns `{ photo_entry: ... }` and is the source of truth — only the client misread the shape."
  artifacts:
    - path: "src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx"
      provides: "Client reads `body.photo_entry` from the POST response and replaces the optimistic temp entry with it. Type annotation: `(await response.json()) as { photo_entry: PhotoEntry }`."
      contains: "body.photo_entry"
    - path: "tests/unit/journal-add-sheet.test.tsx"
      provides: "New unit test (file may be NEW if no existing coverage exists for this component): mocks fetch to resolve `{ photo_entry: <entry> }` and asserts that after the cache merge, the queryClient cache contains the new entry's id (not undefined). Uses @testing-library/react + a controlled QueryClient."
      contains: "photo_entry"
  key_links:
    - from: "src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx"
      to: "src/app/api/v1/plants/[plantId]/photo-entries/route.ts"
      via: "fetch POST → response body shape `{ photo_entry: ... }` per route.ts:112; client setQueryData reads `body.photo_entry`"
      pattern: "photo_entry"
---

<objective>
Close gap **WR-05** — `journal-add-sheet.tsx:127-130` reads `body.data` after the POST resolves, but the route handler at `route.ts:109-115` returns `{ photo_entry: ... }`. The optimistic temp entry is replaced with `undefined`, the rendering `entries.map((e) => e.id)` will crash if hit before the follow-up `invalidateQueries` refetch resolves, and at minimum the UI flickers an undefined row.

**TDD framing:** the contract is unit-testable — given a fetch mock that resolves `{ photo_entry: <entry> }`, the queryClient cache must transition from `[temp_entry, ...prior]` to `[<real_entry>, ...prior]`. RED: write the failing test. GREEN: change `body.data` → `body.photo_entry`. The fix is a 2-character delta.

**Note on the cleaner alternative:** Plan 21 fixes CR-03 by extending the snake-case mapper to emit `photo_signed_url` + `thumbnail_signed_url`. The `body.photo_entry` returned by POST will gain those fields automatically (defaulting to null because the route's POST path uses the bare PhotoEntryRow with no signed URLs — ObjectStore signing happens only in the GET list path). The optimistic-merge here cares only about reading the right field name.

**Purpose:** restore SC-4 photo-journal add UX (no undefined entries between optimistic update and refetch); close UI-11 photo-journal CRUD contract gap.

**Output:** 1 source patch + 1 unit test, all green under `pnpm test:unit`.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/05-catalog-meu-jardim/05-VERIFICATION.md
@.planning/phases/05-catalog-meu-jardim/05-REVIEW.md

# Bug surface
@src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx
@src/app/api/v1/plants/[plantId]/photo-entries/route.ts

# Pattern reference for unit tests with @testing-library + QueryClient
@tests/unit/use-plant-profile-mutations.test.tsx

<interfaces>
### Server contract (locked, do NOT modify)

`src/app/api/v1/plants/[plantId]/photo-entries/route.ts:109-115`:
```ts
return {
  status: 201,
  body: {
    photo_entry: toPhotoEntrySnakeCase(usecase.photoEntry),
  },
};
```

The client must align to `photo_entry` — this is the canonical snake-case key matching all other Phase-5 route responses (`{ plant: ... }`, `{ photo_entries: ... }`, `{ locations: ... }`).

### Current client misread (`journal-add-sheet.tsx:127-130`)

```ts
if (response.ok) {
  const body = (await response.json()) as { data: PhotoEntry };  // ← wrong type assertion
  queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
    items: (old?.items ?? []).map((e) => (e.id === tempId ? body.data : e)),  // ← body.data is undefined
  }));
  await queryClient.invalidateQueries({ queryKey });
  resetState();
  return;
}
```

### Fix shape

```ts
if (response.ok) {
  const body = (await response.json()) as { photo_entry: PhotoEntry };
  queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
    items: (old?.items ?? []).map((e) => (e.id === tempId ? body.photo_entry : e)),
  }));
  await queryClient.invalidateQueries({ queryKey });
  resetState();
  return;
}
```

### Unit test pattern

Mirror `tests/unit/use-plant-profile-mutations.test.tsx` for the QueryClient + mocking setup:
- `vi.mock("sonner", () => ({ toast: { error: vi.fn() } }))`
- `vi.stubGlobal("fetch", vi.fn())`
- `vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "test-uuid") })`
- Render the component with `<QueryClientProvider>` wrapping a controlled `QueryClient`.
- The component takes `plantId` + `open` + `onOpenChange` + `labels` props per `JournalAddSheetProps` (line 24-29).
</interfaces>
</context>

<threat_model>

## Trust Boundaries

| Boundary                         | Description                                                                                                                                  |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| client cache → render            | TanStack Query cache is the render source for the photo-journal list; `undefined` entries cause `e.id` reads to throw.                       |
| client retry → server idempotency | The same `Idempotency-Key` is reused across response-shape misreads — the server already has the row; the client just couldn't parse it.    |

## STRIDE Threat Register

| Threat ID    | Category        | Component                                            | Disposition | Mitigation Plan                                                                                                                                                                                                |
| ------------ | --------------- | ---------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-22-01   | Tampering       | client-side cache replacement with undefined        | mitigate    | Fix the type assertion + access path so `body.photo_entry` is read (server contract). Unit test asserts the post-success cache contains a real entry, not undefined.                                          |
| T-05-22-02   | DoS             | render crash on `e.id` read of undefined entry       | mitigate    | The fix prevents the undefined window. Defense-in-depth: the rendering code in `photo-journal.tsx:97-122` could filter `entries.filter(Boolean)`, but that's out-of-scope for this gap closure.              |
| T-05-22-03   | Repudiation     | invalidate-after-set masks the bug                   | accept      | Existing code calls `invalidateQueries` immediately after `setQueryData`; on most networks the bad cache window is sub-perceptible. The fix removes the window entirely.                                       |

</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED + GREEN — journal-add-sheet reads body.photo_entry from POST response (WR-05)</name>
  <files>
    - tests/unit/journal-add-sheet.test.tsx (NEW or MODIFY — file may not exist)
    - src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx (MODIFY — 2-char delta)
  </files>
  <read_first>
    - src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx (full file — only ~245 lines; lines 127-130 are the bug surface; lines 87-148 are the full submit flow)
    - src/app/api/v1/plants/[plantId]/photo-entries/route.ts (full file — confirm `photo_entry` is the response key)
    - tests/unit/use-plant-profile-mutations.test.tsx (full file — pattern reference for QueryClient + fetch mock + crypto stub)
    - ls tests/unit/ → check whether `journal-add-sheet.test.tsx` already exists; if it does, read it before extending; if not, create new.
  </read_first>
  <behavior>
    **RED:**
    Create or extend `tests/unit/journal-add-sheet.test.tsx` with a test that:
    1. Sets up a controlled `QueryClient` and seeds the photo-entries cache with a known prior entry.
    2. Mocks fetch to resolve `{ ok: true, status: 201, json: () => Promise.resolve({ photo_entry: { id: 'real-id', plant_id: 'p1', photo_url: 'plant-photos/u/p1/real.jpg', thumbnail_url: 'plant-thumbnails/u/p1/real.jpg', note: null, created_at: '2026-05-01T00:00:00Z' } }) }`.
    3. Renders `<JournalAddSheet open={true} onOpenChange={vi.fn()} plantId="p1" labels={...} />` inside the QueryClientProvider.
    4. Mocks `compressPlantPhoto` to return the file unchanged (avoids sharp).
    5. Selects a file via the hidden input (or directly invokes the submit flow — depends on which side of the API surface the test targets).
    6. Waits for the cache to transition. Asserts:
       ```ts
       const cache = queryClient.getQueryData<{ items: PhotoEntry[] }>(plantsKeys.photoEntries('p1').queryKey);
       const realEntry = cache?.items.find((e) => e.id === 'real-id');
       expect(realEntry).toBeDefined();
       expect(realEntry).not.toBeUndefined();
       expect(realEntry?.id).toBe('real-id');
       const undefinedRows = cache?.items.filter((e) => e === undefined);
       expect(undefinedRows).toEqual([]);
       ```

    Run the test — it MUST fail because the current `body.data` is undefined → `setQueryData` writes a row with value undefined.

    Practical alternative if testing the full component is cumbersome (file pickers + ref interaction): refactor the test to invoke the success-path behavior at a lower level by mocking `useQueryClient` and inspecting the `setQueryData` arguments directly. The contract under test is the body-key access, not the file-input UX.

    **GREEN:**
    Change `journal-add-sheet.tsx:127-130`:
    ```ts
    const body = (await response.json()) as { photo_entry: PhotoEntry };
    queryClient.setQueryData<PhotoEntriesCache>(queryKey, (old) => ({
      items: (old?.items ?? []).map((e) => (e.id === tempId ? body.photo_entry : e)),
    }));
    ```

    Two changes: type assertion `data` → `photo_entry`; field access `body.data` → `body.photo_entry`.

    Re-run the test — must pass.
  </behavior>
  <action>
    1. `ls tests/unit/journal-add-sheet.test.tsx 2>/dev/null` — if it exists, read it; if not, create it.

    2. Write the failing unit test. Recommended approach (low-coupling, focused on the contract):

    ```tsx
    import { describe, it, expect, vi, beforeEach } from "vitest";
    import { render, waitFor } from "@testing-library/react";
    import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
    import type { ReactNode } from "react";

    vi.mock("sonner", () => ({
      toast: { error: vi.fn(), success: vi.fn() },
    }));
    vi.mock("@shared/images/client-compress", () => ({
      compressPlantPhoto: vi.fn(async (f: File) => f),
    }));
    // ... other mocks ...

    import { JournalAddSheet } from "../../src/app/(app)/catalog/[plantId]/journal/journal-add-sheet";
    import { plantsKeys } from "@contexts/catalog/queries";

    const PLANT_ID = "plant-1";
    const TEMP_QUERY_KEY = plantsKeys.photoEntries(PLANT_ID).queryKey;

    function makeQueryClient() {
      return new QueryClient({ defaultOptions: { queries: { retry: false } } });
    }

    function wrap(qc: QueryClient) {
      return function Wrapper({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
      };
    }

    const labels = {
      cta: "+ Foto", title: "Adicionar ao diário",
      photoPlaceholder: "Toque para adicionar foto",
      noteLabel: "Nota", notePlaceholder: "(opcional)",
      submit: "Salvar", submitting: "Salvando…",
      failure: "Falhou", cancel: "Cancelar",
    };

    describe("JournalAddSheet — WR-05 response shape", () => {
      let qc: QueryClient;

      beforeEach(() => {
        qc = makeQueryClient();
        qc.setQueryData(TEMP_QUERY_KEY, { items: [] });
        vi.stubGlobal("fetch", vi.fn());
        vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "stub-uuid") });
      });

      it("WR-05: success path replaces optimistic temp entry with body.photo_entry, never undefined", async () => {
        const realEntry = {
          id: "real-id",
          plant_id: PLANT_ID,
          photo_url: "plant-photos/u/p1/real.jpg",
          thumbnail_url: "plant-thumbnails/u/p1/real.jpg",
          note: null,
          created_at: "2026-05-01T00:00:00Z",
        };
        vi.mocked(fetch).mockResolvedValue({
          ok: true,
          status: 201,
          json: () => Promise.resolve({ photo_entry: realEntry }),
        } as unknown as Response);

        const { container } = render(
          <JournalAddSheet open={true} onOpenChange={vi.fn()} plantId={PLANT_ID} labels={labels} />,
          { wrapper: wrap(qc) },
        );

        // Drive the file input + submit. Exact wiring depends on how the component
        // exposes the file picker — see component lines 198-206 for the hidden input.
        // ... simulate file selection + submit click ...

        await waitFor(() => {
          const cached = qc.getQueryData<{ items: typeof realEntry[] }>(TEMP_QUERY_KEY);
          // The temp entry should be replaced with the real one.
          const undefinedRows = (cached?.items ?? []).filter((e) => e === undefined);
          expect(undefinedRows).toEqual([]);
          expect(cached?.items.find((e) => e?.id === "real-id")).toBeDefined();
        });
      });
    });
    ```

    If driving the file picker through the test is brittle, an acceptable simplification is to extract the submit handler to a testable function (out of scope for this gap closure) OR write a more minimal test that mocks `useQueryClient` to return a stub and asserts the stub's `setQueryData` call was invoked with `(queryKey, cb)` where `cb({ items: [tempEntry] })` returns `{ items: [realEntry] }`. Either approach satisfies the acceptance criteria — the constraint is "the test fails when the bug is present and passes when fixed".

    3. Run `pnpm exec vitest --run --project=unit-dom tests/unit/journal-add-sheet.test.tsx`. The test MUST fail.

    4. Commit RED: `test(05-22): add failing test for journal-add-sheet body.photo_entry contract (WR-05)`.

    5. Open `src/app/(app)/catalog/[plantId]/journal/journal-add-sheet.tsx`. At lines 127-130:
       - Replace `as { data: PhotoEntry }` with `as { photo_entry: PhotoEntry }`.
       - Replace `body.data` with `body.photo_entry`.

    6. Run `pnpm exec vitest --run --project=unit-dom tests/unit/journal-add-sheet.test.tsx`. The test must pass.

    7. Run `pnpm typecheck` to confirm the type assertion change compiles.

    8. Commit GREEN: `feat(05-22): journal-add-sheet reads body.photo_entry from POST response (WR-05)`.
  </action>
  <acceptance_criteria>
    - `tests/unit/journal-add-sheet.test.tsx` exists.
    - `grep -c "photo_entry" tests/unit/journal-add-sheet.test.tsx` returns `>=2` (mock + assertion).
    - `grep -c "body.photo_entry" src/app/\(app\)/catalog/\[plantId\]/journal/journal-add-sheet.tsx` returns `>=1`.
    - `grep -c "body.data" src/app/\(app\)/catalog/\[plantId\]/journal/journal-add-sheet.tsx` returns `0` (the buggy access path is gone).
    - `pnpm exec vitest --run --project=unit-dom tests/unit/journal-add-sheet.test.tsx` exits 0.
    - `pnpm typecheck` exits 0.
    - Git log shows `test(05-22): ...` then `feat(05-22): ...` commits.
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec vitest --run --project=unit-dom tests/unit/journal-add-sheet.test.tsx && pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/journal/journal-add-sheet.tsx | grep -c "body.photo_entry" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/journal/journal-add-sheet.tsx | grep -c "body\.data" | grep -E "^0$"</gate>
  </verify>
  <done>
    - `body.data` access path removed; `body.photo_entry` in its place.
    - Unit test asserts no undefined rows enter the cache after success.
    - All assertions green; typecheck clean.
    - RED + GREEN commits in git log.
  </done>
</task>

</tasks>

<verification>
  <automated>pnpm typecheck && pnpm exec vitest --run --project=unit-dom tests/unit/journal-add-sheet.test.tsx</automated>
</verification>

<success_criteria>
- Client reads `body.photo_entry` matching the locked server contract.
- Unit test proves the cache transition does not contain undefined rows.
- Server-side contract unchanged.
- Two commits in git log: `test(05-22): ...` and `feat(05-22): ...`.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-22-journal-add-response-shape-fix-SUMMARY.md` covering RED/GREEN cycle and WR-05 closure status.
</output>
