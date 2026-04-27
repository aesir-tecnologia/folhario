---
phase: 05-catalog-meu-jardim
plan: 08
type: execute
wave: 3
depends_on:
  - 05-01
  - 05-02
  - 05-03
  - 05-04
  - 05-05
  - 05-07
  # PHASE-2-DEPENDENCY: requires Phase 2 plans 02-06 (idempotent + cursor + zod helpers at @shared/api/*), 02-07 (requireUser at @shared/auth/require-user — JWT verification + currentUser helper), 02-08 (photo upload route at /api/v1/photos/upload — referenced in CONTEXT D-22 two-step flow but not directly invoked by these handlers).
files_modified:
  - src/app/api/v1/plants/route.ts
  - src/app/api/v1/plants/[plantId]/route.ts
  - src/app/api/v1/plants/[plantId]/photos/route.ts
  - src/app/api/v1/plants/from-identification/route.ts
  - src/shared/api/http-error-map.ts
  - src/contexts/catalog/application/list-plants.ts  # CONSUMPTION-ONLY (resolves plan-checker BLOCKER 2): Plan 05-07 (Wave 2) ships `plantIdFilter?: string` as an optional parameter on listPlants; this Plan 05-08 (Wave 3) consumes it from the GET /api/v1/plants/:plantId handler. Wave 3 does NOT modify the use case implementation — Plan 05-07 owns implementation; this entry is the cross-plan-traceability anchor for the parameter consumption (mirrors the 05-09 file-overlap convention).
  - tests/integration/catalog/get-plants-route.integration.test.ts
  - tests/integration/catalog/get-plant-detail-route.integration.test.ts
  - tests/integration/catalog/get-plant-photos-route.integration.test.ts
  - tests/integration/catalog/post-plants-route.integration.test.ts
  - tests/integration/catalog/post-plants-from-identification-route.integration.test.ts
autonomous: true
requirements:
  - CAT-01
  - CAT-02
  - CAT-04
  - CAT-07
decisions:
  http_error_mapper_location: "src/shared/api/http-error-map.ts — exports `httpMapDomainError(err)` returning a NextResponse via errorResponse(...). Maps DomainError.code → ErrorCode literal. NEW shared module; consumed by all Phase 5 route handlers (Plans 05-08 and 05-09)."
  endpoint_paths_verbatim: "GET /api/v1/plants, GET /api/v1/plants/:plantId, GET /api/v1/plants/:plantId/photos, POST /api/v1/plants, POST /api/v1/plants/from-identification (CONTEXT D-23B verbatim)"
  cursor_query_param: "?cursor=<base64>&limit=<int>&sort=<sortKey>; defaults: cursor=null, limit=50 (max 200), sort=acquired_desc. Invalid sort value → validation_failed."
  thin_handler_pattern: "Per Phase 2 D-17 + PRD §2: handler validates → use case → HTTP map. NO Drizzle imports in handlers (ESLint guard). NO business logic — entirely orchestration."
  identification_count_query_param: "GET /api/v1/plants accepts ?include=identification_count to enable the includeIdentificationCount flag in listPlants (Plan 05-07). Off by default; the catalog grid (5b) doesn't need it; the plant profile detail endpoint always includes the count for the conditional ID-history link visibility (CAT-04)."
must_haves:
  truths:
    - "GET /api/v1/plants validates JWT → calls listPlants(userId, sortKey, cursor, limit) → returns { data: rows, next_cursor: string|null }"
    - "GET /api/v1/plants/:plantId validates JWT → calls listPlants({ userId, plantIdFilter: plantId, includeIdentificationCount: true, sortKey: 'created_desc', cursor: null, limit: 1 }) — plantIdFilter param is shipped by Plan 05-07 — → 404 when not found → returns the Plant + identification_count"
    - "GET /api/v1/plants/:plantId/photos validates JWT → calls listPhotoEntries(plantId, userId, cursor, limit) → returns { data: rows, next_cursor: string|null } in reverse-chrono order"
    - "POST /api/v1/plants validates JWT + Idempotency-Key + zod (PlantCreateInputSchema) → calls createPlantManual → 201 + Plant"
    - "POST /api/v1/plants/from-identification validates JWT + Idempotency-Key + zod → calls createPlantFromIdentification → 201 + Plant"
    - "All 5 handlers map DomainError to closed-registry ErrorCodes via httpMapDomainError"
    - "All POST handlers wrap their work in `idempotent(req, async () => ...)` per Phase 2 D-37/D-38"
  artifacts:
    - path: "src/app/api/v1/plants/route.ts"
      provides: "GET (list with cursor + sort) and POST (Plant create)"
      min_lines: 80
    - path: "src/app/api/v1/plants/[plantId]/route.ts"
      provides: "GET (Plant detail with identification_count)"
      min_lines: 35
    - path: "src/app/api/v1/plants/[plantId]/photos/route.ts"
      provides: "GET (PhotoEntry list with cursor)"
      min_lines: 40
    - path: "src/app/api/v1/plants/from-identification/route.ts"
      provides: "POST (create Plant linked to existing Identification)"
      min_lines: 40
    - path: "src/shared/api/http-error-map.ts"
      provides: "httpMapDomainError(err) — NextResponse via errorResponse"
      min_lines: 30
    - path: "tests/integration/catalog/get-plants-route.integration.test.ts"
      provides: "GET /api/v1/plants — happy path, cursor pagination, bad cursor 400, sort variations, JWT required"
      min_lines: 80
    - path: "tests/integration/catalog/get-plant-detail-route.integration.test.ts"
      provides: "GET /api/v1/plants/:id — happy path, 404 for cross-user, identification_count present"
      min_lines: 50
    - path: "tests/integration/catalog/get-plant-photos-route.integration.test.ts"
      provides: "GET /api/v1/plants/:id/photos — happy path, reverse-chrono order, cursor pagination"
      min_lines: 40
    - path: "tests/integration/catalog/post-plants-route.integration.test.ts"
      provides: "POST /api/v1/plants — happy path, validation_failed on missing photo, idempotency replay returns same row, storage path spoof rejected"
      min_lines: 100
    - path: "tests/integration/catalog/post-plants-from-identification-route.integration.test.ts"
      provides: "POST /api/v1/plants/from-identification — happy path, cross-user identification rejected (forbidden), already-linked conflict, identification not found"
      min_lines: 70
  key_links:
    - from: "src/app/api/v1/plants/route.ts"
      to: "src/contexts/catalog/application/list-plants.ts + create-plant-manual.ts (Plans 05-07 + 05-05)"
      via: "imports use cases; calls them after JWT + zod validation"
      pattern: "createPlantManual\\|listPlants"
    - from: "src/app/api/v1/plants/route.ts"
      to: "src/shared/api/idempotent (Phase 2 D-37)"
      via: "POST wrapped in idempotent(req, fn)"
      pattern: "idempotent"
    - from: "src/shared/api/http-error-map.ts"
      to: "src/shared/config/errors.ts (Phase 1 D-10)"
      via: "uses errorResponse + ErrorCode enum"
      pattern: "ErrorCode\\."
---

<objective>
Ship 5 read + create route handlers under `/api/v1/plants/*` per CONTEXT D-23B. Each handler is THIN per PRD §2 + Phase 2 D-17: validate (JWT + zod) → call use case → HTTP-map. Also ships the shared `httpMapDomainError` helper consumed by both this plan and Plan 05-09.

Purpose: completes the read + create surface of the catalog API. Plan 05-09 adds the mutate + delete surface. Together they cover all 11 endpoints from CONTEXT D-23B.

Output: 5 route handler files (~235 lines), 1 shared error-mapping helper (~30 lines), 5 integration test files (~340 lines covering the per-route behaviors specified in VALIDATION.md for CAT-01/02/04/07).
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/02-data-layer/02-CONTEXT.md
@.planning/phases/01-foundation/01-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-05-plant-create-use-cases-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-07-patch-photo-entry-cover-use-cases-PLAN.md

<interfaces>
src/shared/api/http-error-map.ts:
```ts
import { errorResponse, ErrorCode } from "@shared/config/errors";
import { DomainError } from "@contexts/catalog/application/errors";
import type { NextResponse } from "next/server";

export function httpMapDomainError(err: unknown): NextResponse {
  if (err instanceof DomainError) {
    const map = {
      validation_failed: ErrorCode.ValidationFailed,
      not_found: ErrorCode.NotFound,
      forbidden: ErrorCode.Forbidden,
      conflict: ErrorCode.Conflict,
    } as const;
    return errorResponse(map[err.code], err.message, err.details);
  }
  // Re-throw unknown errors so Sentry captures via Next.js instrumentation hook
  throw err;
}
```
NOTE: Phase 1 D-10/D-12 closed registry — verify `ErrorCode.Conflict` exists in src/shared/config/errors.ts. If absent (Phase 1 may have only shipped a subset), the executor MUST extend the registry within this plan. Task 1 explicitly verifies the registry coverage.

src/app/api/v1/plants/route.ts (skeleton):
```ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@shared/auth/require-user"; // Phase 2 D-32/D-33
import { idempotent } from "@shared/api/idempotent"; // Phase 2 D-37/D-38
import { errorResponse, ErrorCode } from "@shared/config/errors";
import { httpMapDomainError } from "@shared/api/http-error-map";
import { PlantCreateInputSchema } from "@contexts/catalog/domain/plant";
import { createPlantManual } from "@contexts/catalog/application/create-plant-manual";
import { listPlants } from "@contexts/catalog/application/list-plants";
import { uow } from "@shared/db/unit-of-work"; // Phase 2 D-18

const VALID_SORTS = ["acquired_desc", "acquired_asc", "name_asc", "name_desc", "location_asc", "created_desc"] as const;

export async function GET(req: NextRequest) {
  try {
    const user = await requireUser(req);
    const url = new URL(req.url);
    const sort = url.searchParams.get("sort") ?? "acquired_desc";
    if (!VALID_SORTS.includes(sort as any)) {
      return errorResponse(ErrorCode.ValidationFailed, "invalid_sort_key");
    }
    const cursor = url.searchParams.get("cursor");
    const limitRaw = url.searchParams.get("limit");
    let limit = limitRaw ? parseInt(limitRaw, 10) : 50;
    if (isNaN(limit) || limit < 1) limit = 50;
    if (limit > 200) limit = 200;
    const includeIdent = url.searchParams.get("include") === "identification_count";

    const result = await listPlants({
      userId: user.id,
      sortKey: sort as any,
      cursor,
      limit,
      includeIdentificationCount: includeIdent,
    });
    return NextResponse.json({ data: result.rows, next_cursor: result.nextCursor });
  } catch (err) {
    return httpMapDomainError(err);
  }
}

export async function POST(req: NextRequest) {
  return idempotent(req, async () => {
    try {
      const user = await requireUser(req);
      const body = await req.json().catch(() => null);
      const parsed = PlantCreateInputSchema.safeParse(body);
      if (!parsed.success) {
        return errorResponse(ErrorCode.ValidationFailed, "input_invalid", { issues: parsed.error.issues });
      }
      const plant = await createPlantManual({ userId: user.id, input: parsed.data, uow });
      return NextResponse.json(plant, { status: 201 });
    } catch (err) {
      return httpMapDomainError(err);
    }
  });
}
```

src/app/api/v1/plants/[plantId]/route.ts:
```ts
export async function GET(req: NextRequest, { params }: { params: Promise<{ plantId: string }> }) {
  try {
    const user = await requireUser(req);
    const { plantId } = await params;
    const result = await listPlants({
      userId: user.id,
      sortKey: "created_desc",
      cursor: null,
      limit: 1,
      includeIdentificationCount: true,
      plantIdFilter: plantId,  // CHOSEN PATH (resolves plan-checker BLOCKER 2): listPlants in Plan 05-07 ships `plantIdFilter?: string` as an optional parameter. When set, returns 0|1 row, ignores cursor + sortKey, still enforces userId.
    });
    if (result.rows.length === 0) return errorResponse(ErrorCode.NotFound, "plant_not_found");
    return NextResponse.json(result.rows[0]);
  } catch (err) {
    return httpMapDomainError(err);
  }
}
```
**Cross-plan contract (resolves plan-checker BLOCKER 2):** Plan 05-07 (Wave 2) ships `listPlants` with `plantIdFilter?: string` as an optional parameter (default undefined). This Plan 05-08 (Wave 3) consumes the parameter from `src/contexts/catalog/application/list-plants.ts` — that file is appended to this plan's `files_modified` as an "append-only optional parameter consumption" override note (mirroring the 05-09 wave-3-to-4 file-overlap convention). Sibling-helper alternative was rejected because it would have required two new files (use case + repo helper) for what is semantically a single-row variant of an existing query.

NOTE: Next 16 App Router uses `params: Promise<{...}>` — verify with the Phase 1 diagnostics route examples.
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Ship httpMapDomainError helper + extend ErrorCode registry if needed (Conflict)</name>
  <files>src/shared/api/http-error-map.ts, src/shared/config/errors.ts</files>
  <read_first>
    - src/shared/config/errors.ts (Phase 1 Plan 01-02 — verify which ErrorCode literals are exported; PRD §5 closed registry includes Conflict but Phase 1 may have shipped only a subset)
    - src/contexts/catalog/application/errors.ts (Plan 05-05 — DomainError class + 4 codes)
    - .planning/phases/01-foundation/01-CONTEXT.md D-10/D-11/D-12 (closed error registry semantics + extension policy)
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Closed error registry (Phase 1 D-10/D-11/D-12)"
  </read_first>
  <action>
    1. Read src/shared/config/errors.ts. Confirm presence of `ErrorCode.ValidationFailed`, `ErrorCode.NotFound`, `ErrorCode.Forbidden`. If `ErrorCode.Conflict` is MISSING, add it to the enum + the message-mapping. Phase 1 D-10/D-12 explicitly defines the closed registry; adding `Conflict` is an extension within Phase 5 scope (HTTP 409 status). PRD §5 lists `conflict` in the closed registry, so this is filling in a planned-but-deferred entry rather than inventing a new code.

    2. If extending errors.ts: also extend the `errorResponse(code, message, details?)` helper to return 409 for Conflict. Update the existing tests/unit/errors.test.ts if it asserts the full enum count.

    3. Create src/shared/api/http-error-map.ts per the `<interfaces>` block. Imports DomainError from `@contexts/catalog/application/errors`.

    4. Run `pnpm exec tsc --noEmit` — must pass.
  </action>
  <acceptance_criteria>
    - src/shared/config/errors.ts contains `Conflict` (case-sensitive, in the ErrorCode enum)
    - src/shared/config/errors.ts contains `409` (the HTTP status for Conflict)
    - src/shared/api/http-error-map.ts exists and exports `httpMapDomainError`
    - http-error-map.ts contains all 4 mappings: validation_failed, not_found, forbidden, conflict
    - `pnpm exec tsc --noEmit` exits 0
    - tests/unit/errors.test.ts (existing) still passes after registry extension
  </acceptance_criteria>
  <verify>
    <automated>grep -q "Conflict" src/shared/config/errors.ts && grep -q "409" src/shared/config/errors.ts && grep -q "export function httpMapDomainError" src/shared/api/http-error-map.ts && grep -q "validation_failed" src/shared/api/http-error-map.ts && grep -q "not_found" src/shared/api/http-error-map.ts && grep -q "forbidden" src/shared/api/http-error-map.ts && grep -q "conflict" src/shared/api/http-error-map.ts && pnpm exec tsc --noEmit && pnpm exec vitest --run --project=unit tests/unit/errors.test.ts</automated>
  </verify>
  <done>ErrorCode registry covers all 4 Phase 5 codes; httpMapDomainError shipped and exported; existing errors.test.ts still green.</done>
</task>

<task type="auto">
  <name>Task 2: Ship the 5 read + create route handlers + their integration tests</name>
  <files>
    src/app/api/v1/plants/route.ts,
    src/app/api/v1/plants/[plantId]/route.ts,
    src/app/api/v1/plants/[plantId]/photos/route.ts,
    src/app/api/v1/plants/from-identification/route.ts,
    tests/integration/catalog/get-plants-route.integration.test.ts,
    tests/integration/catalog/get-plant-detail-route.integration.test.ts,
    tests/integration/catalog/get-plant-photos-route.integration.test.ts,
    tests/integration/catalog/post-plants-route.integration.test.ts,
    tests/integration/catalog/post-plants-from-identification-route.integration.test.ts
  </files>
  <read_first>
    - src/app/api/v1/diagnostics/ping/route.ts (the analog from Phase 1; copy the import pattern, the closed-error-response usage, and the Next.js NextResponse style)
    - src/contexts/catalog/application/{create-plant-manual,create-plant-from-identification,list-plants,list-photo-entries}.ts (Plans 05-05/07 — use case signatures)
    - src/contexts/catalog/domain/plant.ts + photo-entry.ts (Plan 05-04 — Zod schemas)
    - src/shared/api/http-error-map.ts (Task 1 — the error mapper)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-17 (no Drizzle in handlers — verified by ESLint guard)
    - .planning/phases/02-data-layer/02-CONTEXT.md D-37/D-38 (Idempotency-Key contract; the `idempotent` helper signature)
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "Route handlers under src/app/api/v1/plants/**/route.ts"
    - tests/integration/diagnostics-server-probe.integration.test.ts (the in-process route handler import pattern: `await import("../../src/app/api/v1/diagnostics/ping/route")` then `mod.POST(new Request(...))`)
    - tests/helpers/playwright-auth-bypass.ts (Plan 05-01 — for E2E later, NOT for these integration tests)
  </read_first>
  <action>
    1. Implement src/app/api/v1/plants/route.ts per the `<interfaces>` skeleton. GET handler reads sort/cursor/limit/include from URL searchParams; POST handler wraps in idempotent. Both call httpMapDomainError on caught errors. Use `requireUser(req)` from Phase 2 D-32; if Phase 2 hasn't shipped the helper, add a minimal stub at `src/shared/auth/require-user.ts` matching the contract: `(req: Request) => Promise<{ id: string }>` that throws `unauthenticated` when no JWT. Document the Phase 2 dependency in the file header.

    2. Implement src/app/api/v1/plants/[plantId]/route.ts (GET only). Calls `listPlants({ userId, sortKey: "created_desc", cursor: null, limit: 1, includeIdentificationCount: true, plantIdFilter: plantId })`. The `plantIdFilter` parameter is shipped by Plan 05-07 (Wave 2) as an optional `plantIdFilter?: string` on the `listPlants` use case signature — see the cross-plan contract note in `<interfaces>` above. This Plan 05-08 (Wave 3) appends `src/contexts/catalog/application/list-plants.ts` to its `files_modified` to consume the parameter; it does NOT modify the use case implementation (Plan 05-07 owns that). The verify gate checks both that the file exists (Plan 05-07 shipped it) AND that the parameter is consumed correctly here.

    3. Implement src/app/api/v1/plants/[plantId]/photos/route.ts (GET only). Calls `listPhotoEntries({ plantId, userId, cursor, limit })`.

    4. Implement src/app/api/v1/plants/from-identification/route.ts (POST only). Wraps in idempotent. Accepts a small inline Zod schema for the body:
       ```ts
       const FromIdentificationSchema = z.object({
         id: z.string().uuid().optional(),
         identification_id: z.string().uuid(),
         selected_result_id: z.string().min(1),
         name: z.string().min(1).max(80).optional(),
         nickname: z.string().max(80).nullable().optional(),
         location: z.string().max(40).nullable().optional(),
         acquisition_date: z.string().nullable().optional(),
         notes: z.string().max(2000).nullable().optional(),
       }).strict();
       ```
       This schema lives inline (small enough; CONTEXT D-23A defines the body shape). Calls `createPlantFromIdentification`.

    5. Write 5 integration test files. Use the in-process route-handler import pattern (`await import("../../../src/app/api/v1/plants/route")` then `mod.POST(new Request(...))`). Mock requireUser via vi.mock to return a deterministic user id. For DB seeding, use the postgres connection + withRollback pattern. Required cases per file:

       - get-plants: happy path with seeded plants, cursor pagination across 2 pages, bad cursor returns 400 with validation_failed, missing JWT (mock requireUser to throw) returns 401, sort variations
       - get-plant-detail: happy path with identification_count, 404 for cross-user lookup
       - get-plant-photos: happy path reverse-chrono, cursor pagination
       - post-plants: happy path with valid body returns 201, missing photo array returns 400, idempotency replay returns same row (Phase 2 D-37 contract — verify same response body byte-for-byte for the same Idempotency-Key)
       - post-plants-from-identification: happy path returns 201, cross-user identification_id returns 403 forbidden, already-linked returns 409 conflict, missing identification returns 404

    6. Run all 5 integration test files.
  </action>
  <acceptance_criteria>
    - All 4 route handler files exist (the `[plantId]` ones use Next.js dynamic-route folder syntax)
    - src/app/api/v1/plants/route.ts contains both `export async function GET` AND `export async function POST`
    - src/app/api/v1/plants/route.ts contains literal `idempotent(req, async`
    - src/app/api/v1/plants/route.ts contains literal `httpMapDomainError`
    - src/app/api/v1/plants/route.ts contains literal `requireUser(req)`
    - No route handler imports from `drizzle-orm` (grep -l for "drizzle-orm" in src/app/api/v1/plants returns 0)
    - All 5 integration test files exist
    - `pnpm exec vitest --run --project=integration tests/integration/catalog/get-plants-route.integration.test.ts tests/integration/catalog/get-plant-detail-route.integration.test.ts tests/integration/catalog/get-plant-photos-route.integration.test.ts tests/integration/catalog/post-plants-route.integration.test.ts tests/integration/catalog/post-plants-from-identification-route.integration.test.ts` exits 0
    - `pnpm exec tsc --noEmit` exits 0
  </acceptance_criteria>
  <verify>
    <automated>grep -q "export async function GET" src/app/api/v1/plants/route.ts && grep -q "export async function POST" src/app/api/v1/plants/route.ts && grep -q "idempotent(req, async" src/app/api/v1/plants/route.ts && grep -q "httpMapDomainError" src/app/api/v1/plants/route.ts && grep -q "requireUser(req)" src/app/api/v1/plants/route.ts && (grep -rl "drizzle-orm" src/app/api/v1/plants 2>/dev/null | wc -l | grep -q "^0$") && pnpm exec vitest --run --project=integration tests/integration/catalog/get-plants-route.integration.test.ts tests/integration/catalog/get-plant-detail-route.integration.test.ts tests/integration/catalog/get-plant-photos-route.integration.test.ts tests/integration/catalog/post-plants-route.integration.test.ts tests/integration/catalog/post-plants-from-identification-route.integration.test.ts && pnpm exec tsc --noEmit</automated>
  </verify>
  <done>5 route handlers shipped; thin pattern enforced (no Drizzle imports, no business logic); idempotency wired on both POSTs; httpMapDomainError used uniformly; 5 integration test files green.</done>
</task>

</tasks>

<threat_model>
<threat id="T-5-02" severity="high" stride="I">
  <description>IDOR — JWT verification bypass on /api/v1/plants/* endpoints would let any unauthenticated request read every user's catalog.</description>
  <mitigation file="src/app/api/v1/plants/route.ts">Every handler calls `requireUser(req)` (Phase 2 D-32/D-33) as the FIRST line inside try block. requireUser throws `unauthenticated` (JWT missing) or `token_expired` (JWT expired) BEFORE any use case runs. The thrown error is caught by httpMapDomainError or surfaces as a generic 401 via Phase 2's error helper. Integration tests assert that mocking requireUser to throw returns 401 with no DB access.</mitigation>
</threat>

<threat id="T-5-18" severity="medium" stride="T">
  <description>Idempotency replay collision across users — if Phase 2 D-37's idempotency table is keyed only by Idempotency-Key (not user_id), two users could collide on the same key and one could replay the other's response.</description>
  <mitigation file="src/app/api/v1/plants/route.ts">Phase 2 D-37 spec calls for `(key, user_id)` composite uniqueness in the idempotency_keys table. The `idempotent(req, fn)` helper from Phase 2 must read user_id from JWT before scoping the lookup. This plan does NOT re-implement the helper — it relies on Phase 2's correct implementation. If Phase 2 ships an unscoped helper, that's a Phase 2 bug that Plan 05-08 cannot fix here; integration test in this plan covers the happy-path replay (same user, same key → same response) but NOT the cross-user collision (which would be a Phase 2 regression test).</mitigation>
</threat>

<threat id="T-5-19" severity="low" stride="I">
  <description>Sort-key tampering on GET /api/v1/plants — client passes `?sort=DROP TABLE` hoping for SQL injection.</description>
  <mitigation file="src/app/api/v1/plants/route.ts">The sort parameter is whitelisted against the literal VALID_SORTS array (6 hardcoded values) BEFORE being passed to the use case. Anything not in the whitelist returns `validation_failed`. The use case + repo layer use parameterized SQL — even if the whitelist were bypassed, postgres-js tagged templates would prevent injection. Defense in depth.</mitigation>
</threat>
</threat_model>

<verification>
1. `pnpm exec vitest --run --project=integration tests/integration/catalog/` exits 0 (all integration tests including 5 route tests green).
2. `pnpm exec tsc --noEmit` exits 0.
3. `grep -rl "drizzle-orm" src/app/api/v1/plants` returns no files (Phase 2 D-17 ESLint guard satisfied).
4. All 4 route handler files exist; httpMapDomainError + requireUser + idempotent wired uniformly.
</verification>

<success_criteria>
- 5 endpoints shipped: GET /api/v1/plants, GET /api/v1/plants/:plantId, GET /api/v1/plants/:plantId/photos, POST /api/v1/plants, POST /api/v1/plants/from-identification.
- httpMapDomainError shared helper consumed by all handlers + by Plan 05-09.
- ErrorCode.Conflict added to closed registry if Phase 1 hadn't shipped it.
- All POSTs wrapped in idempotent (Phase 2 D-37/D-38).
- All handlers thin: validate → use case → HTTP map (Phase 2 D-17 enforced — no Drizzle imports).
- 5 integration test files cover the per-endpoint behaviors specified in 05-VALIDATION.md for CAT-01/02/04/07.
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-08-SUMMARY.md` capturing:
- The exact endpoint paths shipped + their input shapes (so 5b's TanStack Query hooks consume the correct contract)
- The response shapes: { data, next_cursor } for lists; raw Plant for single-resource GETs; raw Plant for POST 201; { error: { code, message, details? } } for errors
- Note for Plan 05-09 (mutate routes): import httpMapDomainError from this plan; use the same `idempotent` + `requireUser` pattern; ensure the same DomainError → ErrorCode mapping
- Note for Plan 5b's manual-add E2E (CAT-02): this plan's POST /api/v1/plants accepts the verified-user JWT from tests/helpers/playwright-auth-bypass.ts (Plan 05-01); when Phase 4 lands, the E2E suite can run end-to-end without re-mocking
- Note: if Phase 1's `errors.ts` did NOT have `Conflict`, this plan added it; tests/unit/errors.test.ts may have been amended to reflect the new enum count
- A note on idempotency at the ROUTE level vs use-case level: idempotency lives at the route via Phase 2 D-37 helper; use cases are NOT idempotent themselves (per Plan 05-05's integration tests note)
</output>
