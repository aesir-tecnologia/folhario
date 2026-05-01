---
phase: 05-catalog-meu-jardim
plan: 20
type: tdd
wave: 1
depends_on: []
files_modified:
  - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
  - src/app/api/v1/plants/[plantId]/route.ts
  - tests/unit/use-plant-profile-mutations.test.tsx
  - tests/integration/catalog-routes-read-create.integration.test.ts
autonomous: true
gap_closure: true
requirements:
  - CAT-04
  - CAT-09
  - UI-08
tags:
  - catalog
  - plant-profile
  - delete
  - idempotency
  - signed-urls
  - gap-closure
must_haves:
  truths:
    - "Tapping the plant-profile delete confirm button fires `DELETE /api/v1/plants/:id` with a non-empty `Idempotency-Key` header generated via `crypto.randomUUID()` (CR-02 fix; SC-3 plant profile delete; SC-5 cascade reachable from UI)."
    - "`useDeletePlant` mirrors `usePatchPlantField`'s idempotency-key pattern: a `useRef<string | null>(null)` holds the current key; the ref is set on `mutate` and cleared on success/error so the next distinct user action regenerates a fresh UUID."
    - "`GET /api/v1/plants/:plantId` route response now includes a top-level `cover_signed_url` snake_case field (24h-TTL signed URL) for any client (TanStack Query refetch, native client, third-party tool) — CR-04 fix; SC-3 cover render path on refetch."
    - "The route handler uses `toPlantWithSignedUrlSnakeCase({ ...plant, coverSignedUrl: result.coverSignedUrl })` instead of `toPlantSnakeCase(result.plant)` — the use-case already returns `coverSignedUrl`; the route was discarding it."
    - "Read-only guard short-circuits `useDeletePlant` BEFORE the fetch is invoked — `if (subscription.readOnly) throw new ReadOnlyError()` matches the existing pattern in `usePatchPlantField`."
    - "Unit test asserts the DELETE request carries an `idempotency-key` header (case-insensitive, non-empty UUID-shaped string)."
    - "Integration test asserts `cover_signed_url` is present in the GET /api/v1/plants/:plantId response when the plant has a cover photo."
  artifacts:
    - path: "src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts"
      provides: "`useDeletePlant` now generates + sends an Idempotency-Key on every DELETE request, mirroring `usePatchPlantField`. ReadOnlyError check unchanged."
      contains: "Idempotency-Key"
    - path: "src/app/api/v1/plants/[plantId]/route.ts"
      provides: "GET handler maps the use-case result through `toPlantWithSignedUrlSnakeCase` so `cover_signed_url` is included in the JSON response."
      contains: "toPlantWithSignedUrlSnakeCase"
    - path: "tests/unit/use-plant-profile-mutations.test.tsx"
      provides: "New test asserts `useDeletePlant` fetch call carries `idempotency-key` header. Existing 7 tests preserved + augmented."
      contains: "idempotency-key"
    - path: "tests/integration/catalog-routes-read-create.integration.test.ts"
      provides: "New assertion that GET /api/v1/plants/:plantId response body contains a `cover_signed_url` field of type `string | null`."
      contains: "cover_signed_url"
  key_links:
    - from: "src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts"
      to: "src/contexts/catalog/api/route-handlers/delete-plant-handler.ts"
      via: "fetch DELETE with `Idempotency-Key` header → route validates `request.headers.get('idempotency-key')` per existing handler contract"
      pattern: "Idempotency-Key"
    - from: "src/app/api/v1/plants/[plantId]/route.ts"
      to: "src/contexts/catalog/api/snake-case.ts"
      via: "toPlantWithSignedUrlSnakeCase({ ...result.plant, coverSignedUrl: result.coverSignedUrl })"
      pattern: "toPlantWithSignedUrlSnakeCase"
---

<objective>
Close two CRITICAL gaps that together break SC-3 (plant profile + delete) on the integration layer:

1. **CR-02:** `useDeletePlant` issues `DELETE /api/v1/plants/:id` with no `Idempotency-Key` header. The route handler at `delete-plant-handler.ts:47-50` rejects with HTTP 400 `validation_failed: "Idempotency-Key header is required"`. The mutation throws, `onSuccess` never fires, and the `router.push("/catalog")` redirect from `plant-profile.tsx:85` is unreachable. **The plant-profile delete button is broken end-to-end.**

2. **CR-04:** `GET /api/v1/plants/:plantId` discards `coverSignedUrl` from the use-case result. The SSR plant-detail page papers over this by injecting the field directly via `toPlantWithSignedUrlSnakeCase` in `[plantId]/page.tsx`, but TanStack Query refetches and any direct API consumer (native client in Phase 11+, third-party tools) get the row WITHOUT a signed cover and the cover image cannot render.

**TDD framing:**
- CR-02 is a unit-testable hook contract: write a failing test that asserts the fetch call carries `idempotency-key`, then patch `useDeletePlant` to mirror `usePatchPlantField`'s ref-based key generation.
- CR-04 is a route integration contract: write a failing assertion in the existing route integration test that the response body contains `cover_signed_url`, then update the GET handler to use `toPlantWithSignedUrlSnakeCase`.

**Wave coordination:** This plan touches `tests/integration/catalog-routes-read-create.integration.test.ts` (Task 2 adds a `cover_signed_url` assertion). Plan 05-21 also adds a net-new `it(...)` block to the same integration test file (a `photo_signed_url` assertion on GET `/api/v1/plants/:plantId/photo-entries`). To prevent a parallel-execution merge conflict on that shared test file, plan 05-21 has been moved to Wave 2 with `depends_on: ["20"]` — plan 05-20 lands first, plan 05-21 rebases on top. With plans 19, 22, and 23 there is no `files_modified` overlap, so 05-20 remains parallel-safe alongside them within Wave 1.

**Purpose:** restore SC-3 plant profile + delete end-to-end on the UI; restore CAT-04 plant profile cover refetch; restore SC-5 (delete cascade) reachable from UI.

**Output:** 2 source patches + 2 test additions, all green under `pnpm test:unit` and `pnpm test:integration`.
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

# The bug surfaces
@src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts
@src/app/api/v1/plants/[plantId]/route.ts
@src/contexts/catalog/api/snake-case.ts
@src/contexts/catalog/application/get-plant.ts
@src/contexts/catalog/api/route-handlers/delete-plant-handler.ts

# Tests we extend
@tests/unit/use-plant-profile-mutations.test.tsx
@tests/integration/catalog-routes-read-create.integration.test.ts

<interfaces>
### `useDeletePlant` source-of-truth pattern — mirror `usePatchPlantField`

The current `usePatchPlantField` (lines 41-58) is the canonical idempotency pattern in this file:

```ts
const idempotencyKeyRef = useRef<string | null>(null);
return useMutation({
  mutationFn: async ({ field, value }) => {
    if (subscription.readOnly) throw new ReadOnlyError();
    const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
    idempotencyKeyRef.current = idempotencyKey;
    const res = await fetch(`/api/v1/plants/${plantId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ [field]: value === "" ? null : value }),
    });
    idempotencyKeyRef.current = null;
    if (!res.ok) { ... }
    return ...;
  },
  onError: (_err, _vars, ctx) => {
    idempotencyKeyRef.current = null;  // discard key on error so retry generates fresh
    ...
  },
});
```

`useDeletePlant` must adopt the same shape: ref + generate-on-mutate + clear-on-success/error.

### `toPlantWithSignedUrlSnakeCase` (already exists at `src/contexts/catalog/api/snake-case.ts:46`)

```ts
export type PlantWithSignedUrlSnakeCase = PlantSnakeCase & {
  cover_signed_url: string | null;
};

export function toPlantWithSignedUrlSnakeCase(
  row: PlantRow & { coverSignedUrl: string | null },
): PlantWithSignedUrlSnakeCase;
```

The mapper already exists from Plan 05-08; the route handler simply was not using it. The SSR page (`[plantId]/page.tsx`) already uses `toPlantWithSignedUrlSnakeCase`, proving the type contract works end-to-end.

### `getPlant` use-case result shape (already shipped, `application/get-plant.ts`)

```ts
{ ok: true; plant: PlantRow; coverSignedUrl: string | null; _meta: { photoEntryCount, reminderCount } }
```

The route handler already destructures `result.plant` and `result._meta` — adding `result.coverSignedUrl` to the mapper input is a one-line fix.

### Existing route response shape (DO NOT REGRESS)

```ts
return Response.json(
  {
    plant: <PlantWithSignedUrlSnakeCase>,   // was PlantSnakeCase — gain cover_signed_url field
    _meta: {
      photo_entry_count: result._meta.photoEntryCount,
      reminder_count: result._meta.reminderCount,
    },
  },
  { status: 200 },
);
```

The `_meta` block is unchanged. Only the `plant` field's mapper changes.
</interfaces>

<scope_clarifications>
- **CR-02 fix only changes `useDeletePlant` — leave `usePatchPlantField` untouched.** PATCH already does the right thing.
- **No change to `delete-plant-handler.ts` or the route DELETE export.** The server-side contract is correct (Idempotency-Key required); the bug is purely client-side.
- **No change to `getPlant` use-case.** It already returns `coverSignedUrl` correctly. CR-04 is purely a route-handler mapper bug.
- **WR-07 (`useQueryClient` conditional `??`)** is OUT OF SCOPE for this plan. WR-07 was not flagged in the gap inventory; it is a Phase-warning-only hook ordering smell that does not break user-facing behavior. Do not refactor.
- **Existing 7 unit tests in `tests/unit/use-plant-profile-mutations.test.tsx` MUST remain green.** The delete-related tests (5, 6, 7) currently mock `fetch` and assert call counts, success/error states, and ReadOnly short-circuit; they do not assert headers. Adding the new header assertion alongside Test 6 (or as a new Test 8) is additive.
</scope_clarifications>
</context>

<threat_model>

## Trust Boundaries

| Boundary                           | Description                                                                                                          |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| browser → DELETE /api/v1/plants/:id | Untrusted client request; route handler validates auth + idempotency-key + ownership.                              |
| API response → TanStack Query cache | Plant detail JSON is consumed by the client cache; missing fields cause hollow renders and broken cover images.    |
| signed URL leakage                 | `cover_signed_url` is a 24h-TTL Supabase Storage URL. Surface only over HTTPS; do not log on the server.            |

## STRIDE Threat Register

| Threat ID    | Category               | Component                                       | Disposition | Mitigation Plan                                                                                                                                                                                                              |
| ------------ | ---------------------- | ----------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-05-20-01   | Tampering / replay     | DELETE /api/v1/plants/:id idempotency replay   | mitigate    | Adding Idempotency-Key restores the deduplication contract: a duplicate DELETE within the idempotency window returns the cached response (`withIdempotency` wrapper from Phase 1). Without it, the route returns 400 — the user-facing bug. |
| T-05-20-02   | Information disclosure | cover_signed_url leaked in logs                | accept      | Sentry breadcrumbs already redact response bodies for /api/v1 paths (Phase 1 D-21 telemetry contract). The 24h TTL bounds the blast radius.                                                                                |
| T-05-20-03   | Repudiation            | retry under different keys creates duplicate FX | accept      | Plant DELETE is idempotent at the DB layer (FK cascade + `findByIdForUser` returns null on second call). A retry under a fresh key after a real network failure is a no-op on the second commit.                            |
| T-05-20-04   | Spoofing               | client-side ReadOnlyError bypass                | mitigate    | Server-side delete-plant-handler ALSO enforces `resolveReadOnlyFromRequest` per Plan 05-09. The hook-level `ReadOnlyError` is defense-in-depth UX (avoids the round-trip when UI already knows the user is read-only).      |

</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED + GREEN — useDeletePlant sends Idempotency-Key header (CR-02)</name>
  <files>
    - tests/unit/use-plant-profile-mutations.test.tsx (MODIFY — extend Test 6 or add Test 8)
    - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts (MODIFY — patch useDeletePlant)
  </files>
  <read_first>
    - src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts (full file — line 41-58 is the canonical pattern; line 96-155 is the broken `useDeletePlant`)
    - tests/unit/use-plant-profile-mutations.test.tsx (full file — line 200-317 covers `useDeletePlant`; mock setup at line 6-23 + 53-65; the tests use `vi.stubGlobal("fetch", vi.fn())` and `vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "test-uuid-1234-1234-1234-123456789012") })`)
    - src/contexts/catalog/api/route-handlers/delete-plant-handler.ts (lines 47-50 — confirms server-side validation expects `idempotency-key` lower-case header on `request.headers.get`)
  </read_first>
  <behavior>
    **RED:** add a new test (Test 8) inside the `describe("useDeletePlant", ...)` block. It must:
    - Mock fetch to resolve `{ ok: true, status: 204, json: () => Promise.resolve(null) }`.
    - Stub `crypto.randomUUID` to return a known UUID (already in beforeEach for `usePatchPlantField`; lift the same pattern into the `useDeletePlant` beforeEach if missing).
    - Render the hook + call `mutate()`.
    - Wait for `result.current.isSuccess === true`.
    - Assert: `vi.mocked(fetch).mock.calls[0][1].headers["Idempotency-Key"]` (or equivalent — the fetch call was invoked with `{ method: "DELETE", headers: { "Idempotency-Key": "<uuid>" } }`).

    Concrete assertion shape:
    ```ts
    const [, init] = vi.mocked(fetch).mock.calls[0]!;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    expect(headers["Idempotency-Key"]).toMatch(/^[a-f0-9-]{36}$/i);
    ```

    Or, more robust against header-shape variation:
    ```ts
    const lowerHeaders = Object.fromEntries(
      Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
    );
    expect(lowerHeaders["idempotency-key"]).toBeDefined();
    expect(lowerHeaders["idempotency-key"]).not.toBe("");
    ```

    Run the unit suite — Test 8 must fail (current `useDeletePlant` has `headers` undefined on the fetch call). Other 7 tests stay green.

    **GREEN:** patch `useDeletePlant` to mirror `usePatchPlantField`:

    ```ts
    export function useDeletePlant(plantId: string, opts?: { ... }) {
      const ownQc = useQueryClient();
      const qc = opts?.queryClient ?? ownQc;
      const t = useTranslations("catalog.profile.delete");
      const subscription = useSubscription();
      const idempotencyKeyRef = useRef<string | null>(null);

      return useMutation({
        mutationFn: async () => {
          if (subscription.readOnly) throw new ReadOnlyError();

          const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
          idempotencyKeyRef.current = idempotencyKey;

          const res = await fetch(`/api/v1/plants/${plantId}`, {
            method: "DELETE",
            headers: {
              "Idempotency-Key": idempotencyKey,
            },
          });

          idempotencyKeyRef.current = null;

          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.error?.code ?? "delete_failed");
          }
        },
        onMutate: async () => { /* unchanged — existing snapshot pattern */ },
        onError: (_err, _vars, ctx) => {
          idempotencyKeyRef.current = null;  // discard key on error
          /* unchanged restore logic */
        },
        onSuccess: () => { /* unchanged */ },
      });
    }
    ```

    Re-run the unit suite — all 8 tests must pass.
  </behavior>
  <action>
    1. Open `tests/unit/use-plant-profile-mutations.test.tsx`. Inside the `describe("useDeletePlant", ...)` block (line 200-317), add `vi.stubGlobal("crypto", { randomUUID: vi.fn(() => "test-uuid-...") })` to the `beforeEach` if it's not already present (compare with the `usePatchPlantField` beforeEach at line 57-65 — confirm the crypto stub is missing for the delete suite and add it).

    2. Add a new test "Test 8: idempotency-key header — DELETE request carries Idempotency-Key from crypto.randomUUID()":
    ```ts
    it("Test 8: idempotency-key header — DELETE request carries Idempotency-Key from crypto.randomUUID()", async () => {
      const { useDeletePlant } = await import(
        "../../src/app/(app)/catalog/[plantId]/use-plant-profile-mutations"
      );

      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
      } as unknown as Response);

      const { result } = renderHook(
        () => useDeletePlant(PLANT_ID, { queryClient: qc }),
        { wrapper: wrapper(qc) },
      );

      result.current.mutate();

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      const [url, init] = vi.mocked(fetch).mock.calls[0]!;
      expect(url).toBe(`/api/v1/plants/${PLANT_ID}`);
      expect((init as RequestInit | undefined)?.method).toBe("DELETE");

      const headers = ((init as RequestInit | undefined)?.headers ?? {}) as Record<string, string>;
      const lowerHeaders = Object.fromEntries(
        Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
      );
      expect(lowerHeaders["idempotency-key"]).toBeDefined();
      expect(lowerHeaders["idempotency-key"]).not.toBe("");
    });
    ```

    3. Run `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx`. Test 8 MUST fail (header missing). Tests 1-7 must still pass.

    4. Commit RED: `test(05-20): add failing test for useDeletePlant Idempotency-Key header (CR-02)`.

    5. Open `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts`. Patch `useDeletePlant` (lines 96-155):
       - Add `import { useRef } from "react";` if not already in the existing line 3 import (it already is — `useRef` is imported for `usePatchPlantField`).
       - Add `const idempotencyKeyRef = useRef<string | null>(null);` after the `subscription` line.
       - In `mutationFn`, before the fetch, generate the key via the same pattern as `usePatchPlantField`:
         ```ts
         const idempotencyKey = idempotencyKeyRef.current ?? crypto.randomUUID();
         idempotencyKeyRef.current = idempotencyKey;
         ```
       - Add `headers: { "Idempotency-Key": idempotencyKey }` to the fetch options.
       - After the fetch resolves successfully (before the `if (!res.ok)` check), clear the ref: `idempotencyKeyRef.current = null;`.
       - In `onError`, also clear the ref (mirrors line 80 in `usePatchPlantField`).

    6. Run `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx`. All 8 tests must pass.

    7. Commit GREEN: `feat(05-20): useDeletePlant sends Idempotency-Key header (CR-02)`.
  </action>
  <acceptance_criteria>
    - `tests/unit/use-plant-profile-mutations.test.tsx` contains the literal string `idempotency-key` (lowercase, the header-comparison key).
    - `src/app/(app)/catalog/[plantId]/use-plant-profile-mutations.ts` contains the literal string `Idempotency-Key` AT LEAST 2 times (one in `usePatchPlantField`, one in `useDeletePlant`).
    - `pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx` exits 0 with 8 tests passing.
    - Git log shows `test(05-20): ...` and `feat(05-20): ...` commits.
  </acceptance_criteria>
  <verify>
    <automated>pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx && pnpm typecheck</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/\(app\)/catalog/\[plantId\]/use-plant-profile-mutations.ts | grep -c "Idempotency-Key" | grep -E "^[2-9]"</gate>
    <gate type="grep">grep -c "idempotency-key" tests/unit/use-plant-profile-mutations.test.tsx | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - Test 8 exists and asserts the Idempotency-Key header on the DELETE call.
    - `useDeletePlant` mirrors `usePatchPlantField`'s ref-based key generation.
    - All 8 unit tests pass.
    - Two commits: RED + GREEN.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: RED + GREEN — GET /api/v1/plants/[plantId] response includes cover_signed_url (CR-04)</name>
  <files>
    - tests/integration/catalog-routes-read-create.integration.test.ts (MODIFY — assert cover_signed_url on GET response)
    - src/app/api/v1/plants/[plantId]/route.ts (MODIFY — swap mapper)
  </files>
  <read_first>
    - src/app/api/v1/plants/[plantId]/route.ts (full file — only ~66 lines; the GET handler at lines 18-57 is the bug surface)
    - src/contexts/catalog/api/snake-case.ts (full file — confirm `toPlantWithSignedUrlSnakeCase` signature at line 46)
    - src/contexts/catalog/application/get-plant.ts (confirm result shape includes `coverSignedUrl: string | null`)
    - tests/integration/catalog-routes-read-create.integration.test.ts (find the existing GET /api/v1/plants/:plantId tests; identify the cleanest place to add a new assertion or new `it(...)`)
  </read_first>
  <behavior>
    **RED:** Add a new assertion (or new `it(...)`) in `tests/integration/catalog-routes-read-create.integration.test.ts` that:
    - Creates a plant with a cover photo (use whatever existing test helper the file already exposes — typically a `seedPlantWithPhoto` or inline `createPlant` call).
    - Issues `GET /api/v1/plants/:plantId` with the authed user's session.
    - Parses the JSON body and asserts:
      - `body.plant.cover_signed_url` is a string starting with `https://` (signed URL shape) OR is null when no cover.
      - `body.plant.cover_photo_url` is still present (existing field — regression check).
      - `body._meta.photo_entry_count` and `body._meta.reminder_count` still present (existing contract).

    Run the test — it MUST fail (`cover_signed_url` is undefined because the route uses `toPlantSnakeCase`).

    **GREEN:** Open `src/app/api/v1/plants/[plantId]/route.ts`. Change the import on line 10:
    ```ts
    import { toPlantWithSignedUrlSnakeCase } from "@contexts/catalog/api/snake-case";
    ```
    (replacing or augmenting `toPlantSnakeCase`).

    Change lines 47-56 from:
    ```ts
    return Response.json(
      {
        plant: toPlantSnakeCase(result.plant),
        _meta: { ... },
      },
      { status: 200 },
    );
    ```
    to:
    ```ts
    return Response.json(
      {
        plant: toPlantWithSignedUrlSnakeCase({
          ...result.plant,
          coverSignedUrl: result.coverSignedUrl,
        }),
        _meta: {
          photo_entry_count: result._meta.photoEntryCount,
          reminder_count: result._meta.reminderCount,
        },
      },
      { status: 200 },
    );
    ```

    Re-run the integration test — must pass.
  </behavior>
  <action>
    1. Open `tests/integration/catalog-routes-read-create.integration.test.ts`. Locate an existing GET-by-id test for `/api/v1/plants/:plantId` (search for `/plants/${plantId}` or similar). If the file already has fixtures for an authed user + a plant with a cover photo, reuse them. Otherwise extend the existing setup.

    Add a new assertion (or new `it(...)`):
    ```ts
    it("CR-04: GET /api/v1/plants/:plantId response includes cover_signed_url", async () => {
      // ... seed user + plant with cover (reuse existing setup helpers) ...

      const res = await fetch(`http://localhost:3000/api/v1/plants/${plantId}`, {
        headers: { Cookie: authedCookie },
      });
      expect(res.status).toBe(200);
      const body = await res.json();

      expect(body).toHaveProperty("plant");
      expect(body.plant).toHaveProperty("cover_signed_url");
      expect(typeof body.plant.cover_signed_url === "string" || body.plant.cover_signed_url === null).toBe(true);
      if (body.plant.cover_signed_url !== null) {
        expect(body.plant.cover_signed_url).toMatch(/^https?:\/\//);
      }

      // Regression: existing fields still present
      expect(body.plant).toHaveProperty("cover_photo_url");
      expect(body._meta).toHaveProperty("photo_entry_count");
      expect(body._meta).toHaveProperty("reminder_count");
    });
    ```

    The exact API for issuing the request varies by test fixture; use whatever shape the existing tests already use (e.g. `await GET(req, { params })` direct invocation, or an in-process fetch). Read the file's existing imports + helpers to find the canonical pattern.

    2. Run `pnpm exec vitest --run --project=integration tests/integration/catalog-routes-read-create.integration.test.ts`. The new assertion MUST fail (`cover_signed_url` undefined).

    3. Commit RED: `test(05-20): add failing test for cover_signed_url in GET /api/v1/plants/:plantId (CR-04)`.

    4. Open `src/app/api/v1/plants/[plantId]/route.ts`. Update the import on line 10:
    ```ts
    import {
      toPlantSnakeCase,
      toPlantWithSignedUrlSnakeCase,
    } from "@contexts/catalog/api/snake-case";
    ```
    (Keep `toPlantSnakeCase` if other route exports use it; otherwise it can be dropped.)

    Replace the `Response.json` call at lines 47-56 to use `toPlantWithSignedUrlSnakeCase` with the spread + `coverSignedUrl` injection. The `_meta` block stays unchanged.

    5. Run `pnpm exec vitest --run --project=integration tests/integration/catalog-routes-read-create.integration.test.ts`. All tests must pass.

    6. Run `pnpm typecheck` to ensure the import + spread are well-typed.

    7. Commit GREEN: `feat(05-20): GET /api/v1/plants/:id response includes cover_signed_url (CR-04)`.
  </action>
  <acceptance_criteria>
    - `tests/integration/catalog-routes-read-create.integration.test.ts` contains the literal string `cover_signed_url` at least 2 times (assertion + regression check).
    - `src/app/api/v1/plants/[plantId]/route.ts` contains the literal string `toPlantWithSignedUrlSnakeCase` at least 1 time.
    - `pnpm exec vitest --run --project=integration tests/integration/catalog-routes-read-create.integration.test.ts` exits 0.
    - `pnpm typecheck` exits 0.
    - Git log shows two more commits: `test(05-20): ...` and `feat(05-20): ...`.
  </acceptance_criteria>
  <verify>
    <automated>pnpm typecheck && pnpm exec vitest --run --project=integration tests/integration/catalog-routes-read-create.integration.test.ts</automated>
    <gate type="grep">grep -v '^[[:space:]]*//' src/app/api/v1/plants/\[plantId\]/route.ts | grep -c "toPlantWithSignedUrlSnakeCase" | grep -E "^[1-9][0-9]*$"</gate>
    <gate type="grep">grep -c "cover_signed_url" tests/integration/catalog-routes-read-create.integration.test.ts | grep -E "^[1-9][0-9]*$"</gate>
  </verify>
  <done>
    - GET handler emits `cover_signed_url`.
    - Integration test asserts presence + URL shape.
    - All catalog-routes integration tests still green.
    - Two commits (RED + GREEN).
  </done>
</task>

</tasks>

<verification>
  <automated>
    pnpm typecheck && \
    pnpm exec vitest --run --project=unit-dom tests/unit/use-plant-profile-mutations.test.tsx && \
    pnpm exec vitest --run --project=integration tests/integration/catalog-routes-read-create.integration.test.ts
  </automated>
</verification>

<success_criteria>
- `useDeletePlant` generates + sends `Idempotency-Key` header on DELETE; mirrors `usePatchPlantField`'s ref pattern.
- Unit Test 8 asserts the header presence + non-empty value.
- GET /api/v1/plants/:plantId response body includes `cover_signed_url` field (string|null) at the top of `body.plant`.
- Integration test asserts the new field's presence + URL shape on a plant with a cover.
- All pre-existing tests in both files remain green (no regression).
- Four commits in git log: 2 RED (test) + 2 GREEN (feat).
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-20-plant-profile-api-contract-fix-SUMMARY.md` covering RED/GREEN cycles for both gaps, test results, and CR-02 + CR-04 closure status.
</output>
</content>
</invoke>