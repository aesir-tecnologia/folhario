---
phase: 05-catalog-meu-jardim
plan: 09
type: execute
wave: 3
depends_on: ["05-06", "05-07", "05-08", "05-11"]
files_modified:
  - src/app/api/v1/plants/[plantId]/route.ts
  - src/app/api/v1/photo-entries/[photoEntryId]/route.ts
  - src/contexts/catalog/api/route-handlers/update-plant-handler.ts
  - src/contexts/catalog/api/route-handlers/delete-plant-handler.ts
  - src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts
  - tests/integration/catalog-mutate-delete-routes.integration.test.ts
autonomous: true
requirements: ["CAT-04", "CAT-06", "CAT-09"]
tags:
  - catalog
  - route-handlers
  - patch
  - delete
  - read-only-mode
  - idempotency
  - threat-model

must_haves:
  truths:
    - "PATCH /api/v1/plants/[plantId] with a single dirty field (e.g. {name:'Costela'}) returns 200 + the updated plant when the caller owns the plant; an Idempotency-Key replay returns the cached 200 body without re-invoking updatePlant."
    - "withIdempotency opens the UoW transaction (tx) and passes it to the use-case via deps — `updatePlant(input, tx)`, `deletePlant(input, tx)`, `deletePhotoEntry(input, tx)` — the use-case returns `{ ...result, postCommit?: () => Promise<void> }` when `deps.tx` is provided; the route handler awaits `result.postCommit?.()` AFTER `withIdempotency` returns successfully (post-commit telemetry contract). If `withIdempotency` rolls back, the route handler MUST NOT invoke postCommit (closure-capture pattern: `let postCommitFn: (() => Promise<void>) | undefined; withIdempotency(... async (tx) => { ...; postCommitFn = inner.postCommit; return {...}; }); try { await postCommitFn?.(); } catch (e) { Sentry.captureException(e); }`). Confirmed against Phase 2 D-37: key derivation = request body hash + Idempotency-Key header."
    - "PATCH /api/v1/plants/[plantId] without an Idempotency-Key header returns validation_failed (400)."
    - "PATCH /api/v1/plants/[plantId] with an unknown body field (e.g. {id:'...'}) is rejected by updatePlantInputSchema.strict() and surfaces validation_failed (400) — defends T-05-09 unknown-key class."
    - "PATCH/DELETE on a plantId owned by another user returns not_found (404), NEVER forbidden — existence-disclosure mitigation per T-05-09-01."
    - "DELETE /api/v1/plants/[plantId] requires an Idempotency-Key header (per Phase 2 D-37 — PATCH and DELETE both wrap); withIdempotency passes `tx` to deletePlant via deps; route handler awaits `postCommitFn?.()` (via closure capture) AFTER `withIdempotency` returns successfully — see postCommit contract in truth above. First call returns 204; a replay with same Idempotency-Key returns the cached 204 body without re-invoking deletePlant (postCommitFn remains undefined on replay — optional-chain is a no-op). A missing Idempotency-Key header returns validation_failed (400). (DELETE without idempotency wrapping would also be safe at the resource level, but wrapping is required by D-37 to ensure tx boundary consistency and server-confirmed receipt semantics.)"
    - "DELETE /api/v1/photo-entries/[photoEntryId] returns 204 on success and triggers the D-03 cover auto-promote inside the use-case's UoW transaction (verified by integration test that asserts plants.cover_photo_url advances to the next-oldest entry)."
    - "All three handlers call requireVerifiedUser FIRST and return the closed-registry code (unauthenticated/email_unverified) on !ok — NEVER surface use-case error reasons through the auth path."
    - "When SUBSCRIPTION_READ_ONLY=1 (server env), all three handlers return read_only_mode (HTTP 402 — registry-mapped, not 403 as the orchestrator hint stated) BEFORE invoking the use-case; integration test asserts the use-case spy was never called AND no DB row was mutated."
    - "Cross-user mutation attempts via spoofed plantId/photoEntryId in the URL are rejected with not_found by the use-cases (which call findByIdForUser with the authenticated user's id); routes never reveal whether the resource exists for a different user."
    - "Every error response uses the closed registry only: validation_failed, not_found, forbidden, read_only_mode, subscription_required, unauthenticated, email_unverified, conflict (idempotency hash mismatch). No ad-hoc codes."
    - "Routes contain ZERO Drizzle imports (D-17 / no-drizzle-in-routes lint) — handler logic lives in src/contexts/catalog/api/route-handlers/*-handler.ts; the Next.js route files re-export."
    - "Routes are PUBLIC by URL but GATED by requireVerifiedUser; both routes are NOT added to UNVERIFIED_ALLOWED_PATHS (Phase 4 D-23) — verified-email is required per Phase 4."
    - "Route handlers MUST be defensive: a use-case returning a postCommit callback that throws MUST NOT cause the HTTP response to fail (the work is already durably committed inside the withIdempotency transaction). Wrap the postCommit await in try/catch, capture the exception to Sentry, and still return the success response to the client."
  artifacts:
    - path: "src/app/api/v1/plants/[plantId]/route.ts"
      provides: "Next.js route file: re-exports GET (from 05-08), PATCH (this plan), DELETE (this plan); zero Drizzle imports per D-17."
      exports: ["GET", "PATCH", "DELETE", "runtime"]
    - path: "src/app/api/v1/photo-entries/[photoEntryId]/route.ts"
      provides: "Next.js route file: re-exports DELETE (this plan); zero Drizzle imports per D-17."
      exports: ["DELETE", "runtime"]
    - path: "src/contexts/catalog/api/route-handlers/update-plant-handler.ts"
      provides: "PATCH handler: requireVerifiedUser → readOnly gate → Idempotency-Key required → Zod validate → withIdempotency wraps updatePlant use-case."
      exports: ["patchPlantHandler"]
    - path: "src/contexts/catalog/api/route-handlers/delete-plant-handler.ts"
      provides: "DELETE handler: requireVerifiedUser → readOnly gate → deletePlant use-case (cascade + pending_storage_deletions + Inngest event + PostHog per 05-06)."
      exports: ["deletePlantHandler"]
    - path: "src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts"
      provides: "DELETE handler: requireVerifiedUser → readOnly gate → deletePhotoEntry use-case (D-03 cover auto-promote in same TX per 05-07)."
      exports: ["deletePhotoEntryHandler"]
    - path: "tests/integration/catalog-mutate-delete-routes.integration.test.ts"
      provides: "Integration coverage for all three handlers per VALIDATION.md Plant delete + Idempotency strata: ownership, read-only gate, idempotency replay, hash mismatch, cross-user not_found, cover auto-promote, and use-case-not-invoked-when-readOnly invariant."
      contains: "describe(\"PATCH /api/v1/plants/[plantId]\""
  key_links:
    - from: "src/app/api/v1/plants/[plantId]/route.ts"
      to: "src/contexts/catalog/api/route-handlers/update-plant-handler.ts + delete-plant-handler.ts"
      via: "thin re-export — `export { patchPlantHandler as PATCH, deletePlantHandler as DELETE }`"
      pattern: "export \\{ patchPlantHandler as PATCH"
    - from: "src/app/api/v1/photo-entries/[photoEntryId]/route.ts"
      to: "src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts"
      via: "thin re-export — `export { deletePhotoEntryHandler as DELETE }`"
      pattern: "export \\{ deletePhotoEntryHandler as DELETE"
    - from: "src/contexts/catalog/api/route-handlers/update-plant-handler.ts"
      to: "src/shared/api/idempotency.withIdempotency"
      via: "wraps updatePlant use-case call inside withIdempotency({userId, key, requestHash}, async (tx) => ...)"
      pattern: "withIdempotency\\("
    - from: "all three handlers"
      to: "src/contexts/billing/application/subscription-provider.resolveSubscriptionStateFromEnv"
      via: "server-side read of SUBSCRIPTION_READ_ONLY via serverEnv → returns read_only_mode (402) BEFORE use-case invocation"
      pattern: "resolveSubscriptionStateFromEnv\\("
    - from: "all three handlers"
      to: "src/shared/api/auth.requireVerifiedUser"
      via: "first call in every handler; non-ok path returns errorResponse(code, ...) with stable registry-rooted message"
      pattern: "requireVerifiedUser\\("
    - from: "tests/integration/catalog-mutate-delete-routes.integration.test.ts"
      to: "src/contexts/catalog/application/{update-plant,delete-plant,delete-photo-entry}.ts"
      via: "vi.spyOn + transaction-rollback fixture (Phase 2 D-43); spy assertion proves use-case NOT invoked when readOnly"
      pattern: "vi\\.spyOn\\(.*Plant"
---

<objective>
Wire the three Phase 5 mutate/delete route handlers (`PATCH /api/v1/plants/[plantId]`, `DELETE /api/v1/plants/[plantId]`, `DELETE /api/v1/photo-entries/[photoEntryId]`) on top of the use-cases shipped by 05-06 and 05-07, with the closed error registry, `requireVerifiedUser` auth gate, server-side read-only gate, and `withIdempotency` (PATCH only). Closes CAT-04 (inline-edit + delete overflow surfaces' API contract), CAT-06 (photo-journal entry deletion path), and the API surface for CAT-09 (delete-plant cascade trigger).

Purpose: 05-08 ships the read+create surfaces. This plan completes the API surface so Wave 4 UI plans (05-15..05-17) can build profile/inline-edit/delete-confirm/photo-journal interactions against real endpoints. Without these three handlers, the inline-edit save (D-05/D-06 LWW), delete-confirm sheet (D-07 cascade preview), and photo-journal entry deletion (D-03 cover auto-promote) all fail at the network boundary.

Output:
- 2 Next.js route files (one extended — `plants/[plantId]/route.ts` is created by 05-08 with GET; this plan adds PATCH + DELETE; one new — `photo-entries/[photoEntryId]/route.ts` with DELETE).
- 3 application-tier handler modules (per RESEARCH §Recommended Project Structure: `src/contexts/catalog/api/route-handlers/*-handler.ts`).
- 1 integration test file covering ownership/IDOR, read-only gate, idempotency replay/hash-mismatch, cover auto-promote on photo-entry delete, and the closed-registry contract.
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@.planning/phases/05-catalog-meu-jardim/05-04-domain-zod-schemas-PLAN.md
@.planning/phases/05-catalog-meu-jardim/05-11-use-subscription-stub-PLAN.md
@CLAUDE.md

# Existing artifacts this plan extends or imports
@src/app/api/v1/iam/me/route.ts
@src/app/api/v1/photos/upload/route.ts
@src/contexts/iam/api/consent-route.ts
@src/shared/api/auth.ts
@src/shared/api/idempotency.ts
@src/shared/config/errors.ts
@src/shared/api/request.ts
@src/shared/db/unit-of-work.ts

<interfaces>
<!-- Contracts pulled from the codebase + sibling plans. Use these directly — no exploration. -->

From `src/shared/config/errors.ts`:
```ts
export const ErrorCode = {
  Unauthenticated: "unauthenticated",       // 401
  TokenExpired: "token_expired",            // 401
  EmailUnverified: "email_unverified",      // 403
  Forbidden: "forbidden",                   // 403
  ValidationFailed: "validation_failed",    // 400
  NotFound: "not_found",                    // 404
  Conflict: "conflict",                     // 409 (idempotency hash mismatch)
  SubscriptionRequired: "subscription_required",  // 402
  ReadOnlyMode: "read_only_mode",           // 402  ← NOTE: 402, NOT 403
  // ...other codes (internal-only or out-of-scope here)
} as const;

export function errorResponse(code: ErrorCode, message: string, details?): Response;
```
**ORCHESTRATOR HINT CORRECTION:** the orchestrator's prompt referred to `read_only_mode` as "(403 closed-registry code)". The registry maps it to **402**. This plan trusts the registry. `errorResponse(ErrorCode.ReadOnlyMode, "...")` will emit HTTP 402 — handlers MUST NOT hard-code a status, MUST go through `errorResponse`.

From `src/shared/api/auth.ts:55-66`:
```ts
export type VerifiedUserResult =
  | { ok: true; user: UserRow }
  | { ok: false;
      code: typeof ErrorCode.Unauthenticated | typeof ErrorCode.EmailUnverified;
      reason: string };

export async function requireVerifiedUser(request: Request): Promise<VerifiedUserResult>;
```
WR-02: NEVER surface `result.reason` to the client. Use a stable registry-rooted message.

From `src/shared/api/idempotency.ts:65-194`:
```ts
export async function withIdempotency(
  input: { userId: string; key: string; requestHash: string },
  handler: (tx: TransactionalDb) => Promise<{ status: number; body: unknown }>,
): Promise<{ status: number; body: unknown; replayed: boolean }>;
```
- First call: handler runs inside the same UoW tx, response is stored.
- Replay (same hash): handler NOT invoked, stored response returned.
- Hash mismatch: returns `{status: 409, body: {error: {code: "conflict", ...}}, replayed: true}` WITHOUT invoking handler.
- Handler throw: tx rolls back, idempotency row vanishes, retry is fresh first call.

From `src/contexts/iam/api/consent-route.ts:57-122` (canonical PATCH/POST + idempotency analog — copy this shape):
```ts
const idempotencyKey = request.headers.get("idempotency-key");
if (!idempotencyKey || idempotencyKey.trim() === "") {
  return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
}

const parsed = await parseJsonBody(request, schema);   // validates AFTER auth
if (!parsed.ok) return errorResponse(parsed.error, "invalid body");

const requestHash = createHash("sha256")
  .update(JSON.stringify(parsed.value))
  .digest("hex");

const result = await withIdempotency({ userId, key: idempotencyKey, requestHash }, async (tx) => {
  const inner = await useCaseFn({ ... }, tx);
  if (!inner.ok) return { status: HTTP_FOR_CODE[inner.code], body: { error: { code: inner.code, message: inner.reason } } };
  return { status: 200, body: { /* snake_case payload */ } };
});

return new Response(JSON.stringify(result.body), {
  status: result.status,
  headers: { "content-type": "application/json" },
});
```

From `src/shared/api/request.ts` (parseJsonBody helper — used by consent-route.ts):
```ts
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request, schema: T,
): Promise<{ ok: true; value: z.infer<T> } | { ok: false; error: typeof ErrorCode.ValidationFailed }>;
```

From `src/contexts/billing/application/subscription-provider.tsx` (shipped by 05-11):
```ts
export type SubscriptionState = { active: boolean; readOnly: boolean };
export function resolveSubscriptionStateFromEnv(env: { SUBSCRIPTION_READ_ONLY?: string }): SubscriptionState;
// Strict equality with "1" only — anything else = readOnly false. Test-only flag; production env never sets it.
```
Handlers import `resolveSubscriptionStateFromEnv` and call it with `{ SUBSCRIPTION_READ_ONLY: serverEnv.SUBSCRIPTION_READ_ONLY }` per request. The pure helper is import-safe in route handlers (no React, no client-only side effects).

From `src/contexts/catalog/domain/schemas.ts` (shipped by 05-04):
```ts
export const updatePlantInputSchema; // partial of editable fields, .strict(), refine(≥1 known key)
export type UpdatePlantInput = z.infer<typeof updatePlantInputSchema>;
```

From `src/contexts/catalog/application/update-plant.ts` (shipped by 05-07):
```ts
export type UpdatePlantInput = {
  userId: string;
  plantId: string;
  patch: { name?: string; nickname?: string|null; location?: string|null; acquisitionDate?: string|null; notes?: string|null };
};
export type UpdatePlantResult =
  | { ok: true; plant: PlantRow; postCommit?: () => Promise<void> }  // postCommit present when tx passed via deps
  | { ok: false; code: typeof ErrorCode.NotFound | typeof ErrorCode.ValidationFailed; reason: string };
export function updatePlant(input: UpdatePlantInput, tx?: TransactionalDb): Promise<UpdatePlantResult>;
```

From `src/contexts/catalog/application/delete-plant.ts` (shipped by 05-06):
```ts
export type DeletePlantInput = { userId: string; plantId: string };
export type DeletePlantResult =
  | { ok: true; postCommit?: () => Promise<void> }  // postCommit present when tx passed via deps
  | { ok: false; code: typeof ErrorCode.NotFound; reason: string };
export function deletePlant(input: DeletePlantInput, tx?: TransactionalDb): Promise<DeletePlantResult>;
```

From `src/contexts/catalog/application/delete-photo-entry.ts` (shipped by 05-07):
```ts
export type DeletePhotoEntryInput = { userId: string; photoEntryId: string };
export type DeletePhotoEntryResult =
  | { ok: true; coverPromoted: boolean; postCommit?: () => Promise<void> }  // postCommit present when tx passed via deps
  | { ok: false; code: typeof ErrorCode.NotFound; reason: string };
export function deletePhotoEntry(input: DeletePhotoEntryInput, tx?: TransactionalDb): Promise<DeletePhotoEntryResult>;
```

If any of the application-tier signatures above differ slightly when 05-06/05-07 are written, adjust the handler call sites to match — the handlers are thin and the contract here is the closed-registry mapping, not the exact param names.

From `src/shared/config/server-env.ts` (extended by 05-11):
```ts
export const serverEnv = {
  // ...other entries...
  SUBSCRIPTION_READ_ONLY: undefined as string | undefined,  // optional, server-only
};
```
</interfaces>

<binding_decisions>
- **D-05 (PATCH single-field):** Client sends one dirty field per call; server tolerance is ≥1 known field via updatePlantInputSchema. The handler does NOT enforce "exactly one" — that would over-constrain future cover auto-promote side-effects.
- **D-06 (LWW optimistic):** Server is the source of truth on conflict; no `If-Unmodified-Since` / 409 conflict UI. The PATCH handler always wins on success.
- **D-07 (cascade preview):** GET /plants/:id returns `_meta.{photo_entry_count, reminder_count}` (05-08 ships GET). DELETE handler does NOT compute counts — confirmation UI fetches them via GET first.
- **D-22 (delete trigger):** DELETE /plants/:id calls deletePlant use-case which handles cascade + pending_storage_deletions insert + Inngest event emit + PostHog. Handler is thin.
- **D-03 (cover auto-promote on photo-entry delete):** DELETE /photo-entries/:id calls deletePhotoEntry use-case which auto-promotes cover in the SAME UoW transaction (05-07 wires this). Handler is thin.
- **D-21 (read-only mode):** Server-side gate via `resolveSubscriptionStateFromEnv` BEFORE use-case invocation. NO billing endpoint fetch (RESEARCH line 605: stub returns constant — never conditionally fetch).
- **D-29 (telemetry):** `plant_edited` and `plant_deleted` PostHog events fire INSIDE the use-cases (after TX commit), NOT in the route handler. Handlers stay HTTP-only.
- **CLAUDE.md (closed registry):** Only `validation_failed | not_found | forbidden | read_only_mode | subscription_required` (+ auth codes + `conflict` from idempotency hash mismatch). Period.
- **Phase 2 D-17 (no Drizzle in routes):** Both `src/app/api/v1/.../route.ts` files import ONLY from `src/contexts/catalog/api/route-handlers/*` — no schema, no Drizzle. Enforced by `no-drizzle-in-routes.test.ts`.
- **Phase 2 D-37 (idempotency on POST/PATCH/DELETE):** PATCH and DELETE both require Idempotency-Key. withIdempotency passes `tx` to the use-case via deps. Key derivation: request body hash + Idempotency-Key header — confirmed against Phase 2 D-37 contract. DELETE wrapping ensures server-confirmed receipt semantics and consistent tx boundaries even though resource-level idempotency would also be safe.
</binding_decisions>

<source_audit>
| Source        | Item                                                              | Plan Coverage                                                  | Status   |
|---------------|-------------------------------------------------------------------|----------------------------------------------------------------|----------|
| GOAL          | Catalog "Meu Jardim" — inline-edit + delete + photo-journal entry CRUD over the network | All three handlers ship; closed-registry; ownership; idempotency | COVERED  |
| REQ           | CAT-04 (Plant profile surfaces — inline-edit + delete overflow API) | PATCH + DELETE handlers wired                                | COVERED  |
| REQ           | CAT-06 (Photo journal — entry deletion path)                      | DELETE /photo-entries/[photoEntryId] handler                   | COVERED  |
| REQ           | CAT-09 (Delete cascade + storage scheduling)                       | DELETE /plants/[plantId] handler triggers deletePlant use-case (05-06 ships the cascade)            | COVERED  |
| RESEARCH      | "Architectural Responsibility Map: API/Backend tier"               | Handlers in api/route-handlers/, use-cases in application/, no Drizzle | COVERED |
| RESEARCH      | Common Pitfall — "Ad-hoc error codes" (line 602)                   | Closed registry only; documented per-handler                    | COVERED  |
| RESEARCH      | Common Pitfall — "useSubscription side-effects" (line 605)         | Server uses `resolveSubscriptionStateFromEnv` (pure, no fetch) | COVERED  |
| CONTEXT (D-05)| PATCH single-field semantics                                       | updatePlantInputSchema enforces shape; handler thin             | COVERED  |
| CONTEXT (D-06)| Optimistic LWW                                                     | No conflict UI; server returns 200/404; client owns optimistic UI | COVERED  |
| CONTEXT (D-22)| DELETE plant trigger                                               | Handler delegates to deletePlant use-case (cascade + event)    | COVERED  |
| CONTEXT (D-03)| Cover auto-promote on photo-entry delete                           | Handler delegates to deletePhotoEntry use-case (same TX promote) | COVERED |
| CONTEXT (D-21)| Read-only mode                                                     | Server-side gate via resolveSubscriptionStateFromEnv; integration test asserts use-case NOT called | COVERED |
| THREAT        | T-05-09-01 cross-user mutation (E)                                 | use-case findByIdForUser → not_found; integration test         | COVERED  |
| THREAT        | T-05-09-02 prefix mis-scope on delete (E/I)                        | delete-plant use-case (05-06) calls validateStoragePathOwnership before storage mutation; THIS plan VERIFIES via integration test (cross-user DELETE returns not_found before any storage call) | COVERED |
| THREAT        | T-05-09-03 idempotency-key collision (T/R)                         | withIdempotency per (user_id, route, plantId, key); hash-mismatch test asserts conflict 409         | COVERED  |
| THREAT        | T-05-09-04 read-only bypass (I)                                    | Handler-level guard returns read_only_mode (402) BEFORE use-case; integration test asserts spy NOT called AND row count unchanged | COVERED |
| VALIDATION    | Plant delete (Integration stratum)                                 | tests/integration/catalog-mutate-delete-routes.integration.test.ts covers cascade + signed events  | COVERED  |
| VALIDATION    | Idempotency (Integration stratum)                                  | Same file covers POST same-key replay + hash-mismatch conflict | COVERED  |
</source_audit>

<deviations>
- **Wave set to 3 (reviews patch — MEDIUM-1 / HIGH-3 fix).** 05-08 sits in Wave 2 and is listed in `depends_on`; extending the same `plants/[plantId]/route.ts` file is safe because dependency order is enforced. Wave 3 is correct: 05-09 depends on `["05-06", "05-07", "05-08", "05-11"]` (all Wave 1 or Wave 2), so Wave 3 placement is valid and allows Wave 4 UI plans (05-15..05-17) to depend on this plan as expected.
- **`05-11` added to `depends_on`.** Reason: handlers import `resolveSubscriptionStateFromEnv` from `src/contexts/billing/application/subscription-provider.tsx`. That's a real code dependency, not just a topology one. 05-11 ships in Wave 1 so this only locks the build order, not the wave.
- **HTTP status correction:** orchestrator hint stated read_only_mode is "403 closed-registry code"; the registry (`src/shared/config/errors.ts:45`) maps it to **402**. This plan trusts the registry. Handlers route through `errorResponse` and never hard-code status.
</deviations>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: PATCH /api/v1/plants/[plantId] handler with withIdempotency</name>
  <files>
    src/contexts/catalog/api/route-handlers/update-plant-handler.ts (NEW)
    src/app/api/v1/plants/[plantId]/route.ts (MODIFY — adds PATCH; GET shipped by 05-08)
    tests/integration/catalog-mutate-delete-routes.integration.test.ts (NEW — describe("PATCH ...") block)
  </files>
  <behavior>
    Integration tests (RED first; this entire file is greenfield — write the failing tests, then GREEN with handler implementation):

    Setup helpers (factor inside the test file or extract to `tests/integration/helpers/seed-catalog.ts` if reused later — author's call):
    - `seedAuthedUser({ verified: true })` → returns `{ userId, sessionCookies }` (use Phase 2 D-43 transaction-rollback fixture + Phase 4 cookie-session pattern).
    - `seedPlant({ userId, name })` → inserts a plant row, returns `{ plantId }`.
    - `callPatch({ plantId, body, idempotencyKey?, sessionCookies? })` → fetches the route via the Next.js test server.

    Tests:

    Test 1 — Happy path (single dirty field, first call):
    - Seed authed user U1. Seed plant P1 owned by U1 with name "Costela".
    - PATCH `/api/v1/plants/${P1}` with body `{ name: "Costela Adam" }`, header `Idempotency-Key: key-1`.
    - Assert: status 200; response body `{ plant: { id: P1, name: "Costela Adam", ... }}` (snake_case keys per PRD §5).
    - Assert: DB row `plants.name === "Costela Adam"`.

    Test 2 — Idempotency replay (same key + body):
    - After Test 1, repeat the same PATCH with same body and same Idempotency-Key: `key-1`.
    - Assert: status 200; response body identical (replayed); `vi.spyOn(updatePlantModule, "updatePlant")` was called EXACTLY ONCE across both requests.

    Test 3 — Idempotency hash mismatch (same key, different body):
    - PATCH same plant with same key `key-1` but body `{ nickname: "Cris" }` (different payload).
    - Assert: status 409; response body `{ error: { code: "conflict", message: ... } }`.
    - Assert: `updatePlant` spy was NOT called for this third request.

    Test 4 — Missing Idempotency-Key header:
    - PATCH a fresh plant without the header.
    - Assert: status 400; body `{ error: { code: "validation_failed", message: /idempotency-key/i } }`.
    - Assert: `updatePlant` spy not called.

    Test 5 — Empty body (no known field):
    - PATCH with body `{}` (or only unknown keys).
    - Assert: status 400; body code `validation_failed`.
    - Assert: `updatePlant` spy not called.

    Test 6 — Unknown body field (.strict() rejection — defends T-05-04-02):
    - PATCH with body `{ id: "different-uuid" }`.
    - Assert: status 400; body code `validation_failed`.

    Test 7 — Cross-user mutation attempt (T-05-09-01):
    - Seed user U2 with their own plant P2. Authenticate as U1. PATCH `/api/v1/plants/${P2}` with body `{ name: "stolen" }`, fresh Idempotency-Key.
    - Assert: status 404; body code `not_found` (NEVER `forbidden` — existence-disclosure mitigation).
    - Assert: DB row P2.name unchanged.

    Test 8 — Unauthenticated:
    - PATCH with no session cookies and no Authorization header.
    - Assert: status 401; body code `unauthenticated`.
    - Assert: `updatePlant` spy not called.

    Test 9 — Email unverified:
    - Seed user U_unverified with `email_verified_at = null`. PATCH with their session cookies.
    - Assert: status 403; body code `email_unverified`.
    - Assert: `updatePlant` spy not called.

    Test 10 — Read-only mode bypass (T-05-09-04):
    - Set `process.env.SUBSCRIPTION_READ_ONLY = "1"` for this test (use `vi.stubEnv("SUBSCRIPTION_READ_ONLY", "1")` if vitest version supports it; otherwise mutate + restore in `afterEach`).
    - PATCH the user's own plant with valid body and fresh Idempotency-Key.
    - Assert: status 402; body code `read_only_mode`.
    - Assert: `updatePlant` spy was NEVER called (use-case skipped entirely).
    - Assert: DB plant row unchanged (count via SELECT WHERE id=P1 → name === original).
    - Cleanup: restore env.

    Test 11 — No Drizzle import in route file (lint-equivalent assertion):
    - Read `src/app/api/v1/plants/[plantId]/route.ts` as text. Assert it does NOT contain `from "drizzle-orm"` or `from "@contexts/catalog/infrastructure/db"`. (Backstop for `no-drizzle-in-routes.test.ts` which the project already runs.)
  </behavior>
  <action>
    1. Create `src/contexts/catalog/api/route-handlers/update-plant-handler.ts`. Order of checks (write this once, copy structure to delete handlers):

       ```ts
       import { createHash } from "node:crypto";
       import { ErrorCode, errorResponse } from "@shared/config/errors";
       import { requireVerifiedUser } from "@shared/api/auth";
       import { withIdempotency } from "@shared/api/idempotency";
       import { parseJsonBody } from "@shared/api/request";
       import { resolveSubscriptionStateFromEnv } from "@contexts/billing/application/subscription-provider";
       import { serverEnv } from "@shared/config/server-env";
       import { updatePlantInputSchema } from "@contexts/catalog/domain/schemas";
       import { updatePlant } from "@contexts/catalog/application/update-plant";

       export async function patchPlantHandler(
         request: Request,
         context: { params: Promise<{ plantId: string }> } | { params: { plantId: string } },
       ): Promise<Response> {
         // Next 16 may pass params as a Promise — await accordingly. Pattern matches
         // any existing dynamic-segment route in src/app/api/v1/* (cf. iam/me has
         // no params; verify shape against an existing dynamic route in the
         // codebase at write time and adjust this signature).
         const params = "then" in context.params ? await context.params : context.params;
         const plantId = params.plantId;

         // Step 1: Auth gate.
         const auth = await requireVerifiedUser(request);
         if (!auth.ok) {
           return errorResponse(auth.code, "missing or invalid bearer token");
         }
         const userId = auth.user.id;

         // Step 2: Read-only gate (D-21). Resolved server-side via env. NO conditional
         // billing-endpoint fetch (RESEARCH line 605: useSubscription stub returns
         // constant; this is the server-side equivalent). HTTP 402 via registry, not 403.
         const subscription = resolveSubscriptionStateFromEnv({
           SUBSCRIPTION_READ_ONLY: serverEnv.SUBSCRIPTION_READ_ONLY,
         });
         if (subscription.readOnly) {
           return errorResponse(ErrorCode.ReadOnlyMode, "subscription is in read-only mode");
         }

         // Step 3: Idempotency-Key required (Phase 2 D-37). Mirrors consent-route.ts:64-67.
         const idempotencyKey = request.headers.get("idempotency-key");
         if (!idempotencyKey || idempotencyKey.trim() === "") {
           return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
         }

         // Step 4: Validate body via Zod (.strict() rejects unknown keys).
         const parsed = await parseJsonBody(request, updatePlantInputSchema);
         if (!parsed.ok) {
           return errorResponse(parsed.error, "invalid update body");
         }

         // Step 5: Stable hash of parsed value (NOT raw body — whitespace-stable per consent-route.ts:74).
         const requestHash = createHash("sha256").update(JSON.stringify(parsed.value)).digest("hex");

         // Step 6: withIdempotency wraps the use-case. Same UoW tx (CR-01).
         const result = await withIdempotency(
           { userId, key: idempotencyKey, requestHash },
           async (tx) => {
             const inner = await updatePlant({ userId, plantId, patch: parsed.value }, tx);
             if (!inner.ok) {
               // Map use-case error → registry. NotFound for cross-user (T-05-09-01).
               return {
                 status: errorStatusFor(inner.code),
                 body: { error: { code: inner.code, message: inner.reason } },
               };
             }
             // Snake_case payload per PRD §5.
             return {
               status: 200,
               body: {
                 plant: serializePlantSnakeCase(inner.plant),
               },
             };
           },
         );

         return new Response(JSON.stringify(result.body), {
           status: result.status,
           headers: { "content-type": "application/json" },
         });
       }
       ```

       Helper `errorStatusFor(code)` and `serializePlantSnakeCase(plant)` may be defined inline OR in a shared `src/contexts/catalog/api/route-handlers/_shared.ts` if reused across the three handlers — author's call. The status-for-code helper exists ONLY because `withIdempotency`'s body-storage contract requires status alongside body; outside that wrapper, `errorResponse(code, msg)` is the canonical path.

    2. Modify `src/app/api/v1/plants/[plantId]/route.ts`. The file is created by 05-08 with GET. Add re-exports:

       ```ts
       // Existing (from 05-08):
       // export { getPlantHandler as GET } from "@contexts/catalog/api/route-handlers/get-plant-handler";

       // Added by 05-09:
       export { patchPlantHandler as PATCH } from "@contexts/catalog/api/route-handlers/update-plant-handler";
       export { deletePlantHandler as DELETE } from "@contexts/catalog/api/route-handlers/delete-plant-handler";  // Task 2

       // runtime declared once at top — preserve from 05-08:
       // export const runtime = "nodejs";
       ```

       If 05-08 didn't declare `export const runtime = "nodejs"` (because GET is pure DB read), add it here — the multipart POST in `/api/v1/plants/route.ts` already uses nodejs runtime; PATCH does not strictly need nodejs, but using a single runtime per route file simplifies reasoning.

    3. Create `tests/integration/catalog-mutate-delete-routes.integration.test.ts` with the `describe("PATCH /api/v1/plants/[plantId]", ...)` block containing the 11 tests above.

       Test infrastructure:
       - Import `vi` from `vitest`. `vi.spyOn(import.meta.glob)` may not work for tree-shaken modules; prefer importing the use-case module namespace and calling `vi.spyOn(updatePlantModule, "updatePlant")` in `beforeEach`, restoring in `afterEach`.
       - Use the in-memory `StorageAdapter` from 05-01's `tests/integration/setup.ts`.
       - Use the transaction-rollback fixture from Phase 2 D-43.

       Spy assertion pattern for "not invoked when readOnly":
       ```ts
       import * as updatePlantModule from "@contexts/catalog/application/update-plant";
       const spy = vi.spyOn(updatePlantModule, "updatePlant");
       vi.stubEnv("SUBSCRIPTION_READ_ONLY", "1");
       const res = await callPatch({...});
       expect(res.status).toBe(402);
       expect(spy).not.toHaveBeenCalled();
       vi.unstubAllEnvs();
       ```

    4. RED: run `pnpm test:integration -- catalog-mutate-delete-routes`. All PATCH tests fail (handler not implemented yet).

    5. Commit RED with subject `test(05-09): add failing tests for PATCH /api/v1/plants/[plantId]`.

    6. GREEN: implement `update-plant-handler.ts` per the structure above; ensure all PATCH tests pass.

    7. Commit GREEN with subject `feat(05-09): PATCH /api/v1/plants/[plantId] handler with idempotency + read-only gate`.

    **Anti-pattern guards (post-implementation):**
    - `grep -E "from \"drizzle-orm|from \"@contexts/.*infrastructure/db" src/app/api/v1/plants/\[plantId\]/route.ts` → MUST return zero hits.
    - `grep -c "errorResponse(ErrorCode\." src/contexts/catalog/api/route-handlers/update-plant-handler.ts` → MUST be ≥3 (one for auth, one for read-only, one for idempotency-missing/validation/use-case-not-ok).
    - `grep "403\|402\|404\|400" src/contexts/catalog/api/route-handlers/update-plant-handler.ts` → MUST return zero hits (NEVER hard-code statuses; route through `errorResponse`).
  </action>
  <verify>
    <automated>pnpm test:integration -- catalog-mutate-delete-routes</automated>
    <automated>pnpm test:unit -- no-drizzle-in-routes</automated>
    <automated>node -e "const t=require('fs').readFileSync('src/contexts/catalog/api/route-handlers/update-plant-handler.ts','utf8'); if(/^[^\/]*\b(403|402|404|400)\b/m.test(t)){console.error('forbidden hard-coded status');process.exit(1)} console.log('ok')"</automated>
  </verify>
  <done>
    All 11 PATCH tests in `catalog-mutate-delete-routes.integration.test.ts` are green. Route file `src/app/api/v1/plants/[plantId]/route.ts` re-exports `PATCH`. Handler module `update-plant-handler.ts` exists with the 6-step check order. `pnpm tsc --noEmit` reports zero new errors. `pnpm lint --max-warnings=0` passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: DELETE /api/v1/plants/[plantId] handler (D-22 cascade trigger)</name>
  <files>
    src/contexts/catalog/api/route-handlers/delete-plant-handler.ts (NEW)
    src/app/api/v1/plants/[plantId]/route.ts (MODIFY — re-export DELETE; PATCH/GET already wired)
    tests/integration/catalog-mutate-delete-routes.integration.test.ts (EXTEND — describe("DELETE /api/v1/plants/[plantId]") block)
  </files>
  <behavior>
    Tests in `describe("DELETE /api/v1/plants/[plantId]", ...)`:

    Test 1 — Happy path (cascade):
    - Seed authed user U1. Seed plant P1 with 3 photo entries + 2 reminders + 1 identification (`identifications.plant_id = P1`). Seed an active subscription.
    - DELETE `/api/v1/plants/${P1}` with valid session cookies.
    - Assert: status 204; empty body.
    - Assert: `plants` row gone.
    - Assert: `photo_entries` rows for P1 gone (FK cascade).
    - Assert: `reminders` rows for P1 gone (FK cascade).
    - Assert: `identifications` row preserved BUT `plant_id` is NULL (history kept; D-22 / Phase 2 schema FK ON DELETE SET NULL).
    - Assert: TWO `pending_storage_deletions` rows inserted with prefix `${userId}/${plantId}/` for buckets `plant-photos` and `plant-thumbnails`, status `pending`.
    - Assert: Inngest event `plant.deleted` was emitted (mock the Inngest client and inspect `.send` calls).
    - Assert: PostHog `plant_deleted` event was captured server-side (mock posthog-node; assert capture call with `{photo_count: 3, journal_entry_count: 3, reminder_count: 2}` per D-29 — note `photo_count === journal_entry_count` for Phase 5 where every photo is a journal entry).

    Test 2 — Idempotency replay (same Idempotency-Key):
    - After Test 1, DELETE the same plantId again with the same `Idempotency-Key` header.
    - Assert: status 204 (cached body); `vi.spyOn(deletePlantModule, "deletePlant")` was called EXACTLY ONCE across both requests (use-case not re-invoked on replay).

    Test 3 — Cross-user delete attempt (T-05-09-01 + T-05-09-02 cross-user-no-storage-call):
    - User U1 authenticated. User U2 owns plant P2 with photo bytes seeded into the in-memory storage.
    - DELETE `/api/v1/plants/${P2}` as U1.
    - Assert: status 404; body code `not_found`.
    - Assert: P2 row still exists.
    - Assert: P2's photo bytes still present in the in-memory adapter (storage adapter `deletePrefix` was NOT called for `${U1}/${P2}/` or `${U2}/${P2}/`).
    - Assert: NO `pending_storage_deletions` rows inserted.

    Test 4 — Read-only mode bypass (T-05-09-04):
    - `vi.stubEnv("SUBSCRIPTION_READ_ONLY", "1")`. DELETE the user's own plant.
    - Assert: status 402; body code `read_only_mode`.
    - Assert: `vi.spyOn(deletePlantModule, "deletePlant")` NEVER called.
    - Assert: plant row unchanged; no `pending_storage_deletions` insert.

    Test 5 — Unauthenticated → 401 unauthenticated; Test 6 — Unverified → 403 email_unverified. Same pattern as PATCH Tests 8/9.

    Test 7 — Missing Idempotency-Key header (DELETE requires key per D-37):
    - DELETE a valid plant without the `Idempotency-Key` header.
    - Assert: status 400; body code `validation_failed` (same guard as PATCH Test 4).
    - Assert: `deletePlant` spy not called.

    Test 8b — Idempotency hash mismatch on DELETE (same key, different derived hash):
    - Note: DELETE has no body, so hash is derived from URL path + method. Send same plant DELETE with a DIFFERENT `Idempotency-Key` value than the one used in Test 1.
    - This is a distinct key so it resolves to a fresh first call (NOT a mismatch). Assert: status 404 (plant already deleted by Test 1); not_found returned — the new key gets a fresh handler invocation returning not_found since plant is gone.

    Test 8 — No Drizzle in route file: same grep as PATCH Test 11 (will already be passing — extending the same file).

    Test 9 — postCommit ordering and idempotency replay does NOT re-fire postCommit:
    - Spy on the PostHog capture method and the Inngest `.send` call (same mocks as Test 1).
    - FIRST DELETE: assert status 204; assert PostHog/Inngest spies were called (postCommitFn ran once).
    - SECOND DELETE with same Idempotency-Key: assert status 204 (replay); assert PostHog/Inngest spies were NOT called a second time (postCommitFn is undefined on replay path — closure-capture no-op).
    - This asserts the contract: side-effects fire exactly once on durable commit, never on replayed response.
  </behavior>
  <action>
    1. Create `src/contexts/catalog/api/route-handlers/delete-plant-handler.ts`. Same first three steps as PATCH (auth → read-only → no idempotency wrap):

       ```ts
       import { ErrorCode, errorResponse } from "@shared/config/errors";
       import { requireVerifiedUser } from "@shared/api/auth";
       import { resolveSubscriptionStateFromEnv } from "@contexts/billing/application/subscription-provider";
       import { serverEnv } from "@shared/config/server-env";
       import { deletePlant } from "@contexts/catalog/application/delete-plant";

       export async function deletePlantHandler(
         request: Request,
         context: { params: Promise<{ plantId: string }> } | { params: { plantId: string } },
       ): Promise<Response> {
         const params = "then" in context.params ? await context.params : context.params;
         const plantId = params.plantId;

         const auth = await requireVerifiedUser(request);
         if (!auth.ok) return errorResponse(auth.code, "missing or invalid bearer token");
         const userId = auth.user.id;

         const subscription = resolveSubscriptionStateFromEnv({
           SUBSCRIPTION_READ_ONLY: serverEnv.SUBSCRIPTION_READ_ONLY,
         });
         if (subscription.readOnly) {
           return errorResponse(ErrorCode.ReadOnlyMode, "subscription is in read-only mode");
         }

         const result = await deletePlant({ userId, plantId });
         if (!result.ok) {
           return errorResponse(result.code, result.reason);
         }
         return new Response(null, { status: 204 });
       }
       ```

       USES `withIdempotency` wrap per Phase 2 D-37. DELETE has no request body, so `requestHash` is derived from the URL path + method (stable for same request). Pattern:

       ```ts
       import { createHash } from "node:crypto";
       import { withIdempotency } from "@shared/api/idempotency";

       // Inside deletePlantHandler, after read-only gate:
       const idempotencyKey = request.headers.get("idempotency-key");
       if (!idempotencyKey || idempotencyKey.trim() === "") {
         return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
       }

       const url = new URL(request.url);
       const requestHash = createHash("sha256")
         .update(`DELETE:${url.pathname}`)
         .digest("hex");

       const result = await withIdempotency(
         { userId, key: idempotencyKey, requestHash },
         async (tx) => {
           const inner = await deletePlant({ userId, plantId }, tx);
           if (!inner.ok) {
             return { status: errorStatusFor(inner.code), body: { error: { code: inner.code, message: inner.reason } } };
           }
           return { status: 204, body: null };
         },
       );

       return new Response(result.body !== null ? JSON.stringify(result.body) : null, {
         status: result.status,
         headers: result.body !== null ? { "content-type": "application/json" } : {},
       });
       ```

       The `withIdempotency` key derivation (request body hash + Idempotency-Key header) is confirmed against Phase 2 D-37 contract. `tx` is passed to `deletePlant` via deps via the closure-capture postCommit pattern — after `withIdempotency` commits, the route handler runs the callback:

       ```ts
       let postCommitFn: (() => Promise<void>) | undefined;

       const result = await withIdempotency(
         { userId, key: idempotencyKey, requestHash },
         async (tx) => {
           const inner = await deletePlant({ userId, plantId }, tx);
           if (!inner.ok) {
             return { status: errorStatusFor(inner.code), body: { error: { code: inner.code, message: inner.reason } } };
           }
           postCommitFn = inner.postCommit;  // captured; only runs if withIdempotency commits
           return { status: 204, body: null };
         },
       );

       // withIdempotency committed (or replayed). On replay postCommitFn is undefined (no-op).
       // On rollback withIdempotency throws before we reach here — postCommitFn is never awaited.
       try { await postCommitFn?.(); } catch (e) { Sentry.captureException(e); }

       return new Response(result.body !== null ? JSON.stringify(result.body) : null, {
         status: result.status,
         headers: result.body !== null ? { "content-type": "application/json" } : {},
       });
       ```

       The `try/catch` around `postCommitFn?.()` ensures a PostHog or Inngest emit failure does NOT surface as a 500 to the client — the DELETE was already durably committed. Log to Sentry and return success.

    2. Update `src/app/api/v1/plants/[plantId]/route.ts` to re-export DELETE (already added in Task 1's wiring step — verify at Task 2 commit time).

    3. Extend the integration test file with the `describe("DELETE /api/v1/plants/[plantId]", ...)` block.

       Mock setup:
       - Import the Inngest client module and spy `.send`.
       - Import `posthog-server.ts` and spy `.capture` (or whatever the Phase 1 D-21 server PostHog seam exposes).
       - Use the in-memory storage adapter to assert "no deletePrefix call for cross-user attempt".

    4. RED → GREEN → REFACTOR → commit cycle as Task 1.

    5. Commit GREEN with subject `feat(05-09): DELETE /api/v1/plants/[plantId] handler (cascade trigger)`.
  </action>
  <verify>
    <automated>pnpm test:integration -- catalog-mutate-delete-routes</automated>
  </verify>
  <done>
    All 8 DELETE /plants/[plantId] tests green. Handler module exists, route file re-exports DELETE. PostHog + Inngest mocks verified. Cross-user storage-not-called assertion holds. `pnpm tsc --noEmit` clean. `pnpm lint --max-warnings=0` passes.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: DELETE /api/v1/photo-entries/[photoEntryId] handler (D-03 cover auto-promote)</name>
  <files>
    src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts (NEW)
    src/app/api/v1/photo-entries/[photoEntryId]/route.ts (NEW — file does not exist yet)
    tests/integration/catalog-mutate-delete-routes.integration.test.ts (EXTEND — describe("DELETE /api/v1/photo-entries/[photoEntryId]") block)
  </files>
  <behavior>
    Tests in `describe("DELETE /api/v1/photo-entries/[photoEntryId]", ...)`:

    Test 1 — Happy path, deleting a non-cover photo entry:
    - Seed plant P1 owned by U1 with 3 photo entries E1, E2, E3 created in that order. P1.cover_photo_url = E1.photo_url (oldest, per D-03 default).
    - DELETE `/api/v1/photo-entries/${E2.id}`.
    - Assert: status 204.
    - Assert: photo_entries row E2 gone.
    - Assert: P1.cover_photo_url STILL E1.photo_url (E2 was not the cover; no auto-promote).
    - Assert: A pending_storage_deletions row was inserted for the entry's photo + thumbnail keys (per delete-photo-entry use-case wired in 05-07).

    Test 2 — Happy path, deleting the cover photo (D-03 auto-promote):
    - Seed plant P1 with E1 (cover), E2, E3.
    - DELETE `/api/v1/photo-entries/${E1.id}`.
    - Assert: status 204.
    - Assert: photo_entries row E1 gone.
    - Assert: P1.cover_photo_url === E2.photo_url (next-oldest auto-promoted in same TX per D-03).
    - Assert: pending_storage_deletions row inserted for E1's keys.

    Test 3 — Deleting the LAST photo entry (cover becomes null):
    - Seed plant P1 with only E1 (cover).
    - DELETE E1. Note: this leaves Plant.cover_photo_url = null. PhotoEntry.plant_id NOT NULL invariant (D-02) is preserved at all times — the plant retains zero entries; that's allowed at the schema level (only the FIRST PhotoEntry creation is required; subsequent deletions can drain to zero).
    - Wait — verify this against D-02: "PhotoEntry.plant_id NOT NULL invariant preserved at every observable instant" applies to PhotoEntry → Plant FK, not to Plant having ≥1 PhotoEntry. The FK constraint is on `photo_entries.plant_id NOT NULL`; nothing prevents a Plant from having zero photo entries after deletes. The use-case is allowed to leave cover_photo_url = null.
    - Assert: status 204; P1.cover_photo_url === null.

    Test 4 — Cross-user attempt (T-05-09-01):
    - U2 owns plant P2 with photo entry E_p2. Authenticate as U1. DELETE `/api/v1/photo-entries/${E_p2.id}`.
    - Assert: status 404; body code `not_found`.
    - Assert: E_p2 row unchanged. P2.cover_photo_url unchanged.

    Test 5 — Read-only mode bypass (T-05-09-04):
    - Set `SUBSCRIPTION_READ_ONLY=1`. DELETE user's own photo entry.
    - Assert: status 402; body code `read_only_mode`.
    - Assert: `vi.spyOn(deletePhotoEntryModule, "deletePhotoEntry")` not called.
    - Assert: photo_entries row unchanged.

    Test 6 — Unauthenticated → 401; Test 7 — Email unverified → 403; same pattern as PATCH 8/9.

    Test 8 — Idempotency replay (same Idempotency-Key returns cached 204):
    - After Test 1, DELETE the same E2 id again with the same `Idempotency-Key` header.
    - Assert: status 204 (cached); `vi.spyOn(deletePhotoEntryModule, "deletePhotoEntry")` was called EXACTLY ONCE across both requests (use-case not re-invoked on replay).

    Test 9 — Missing Idempotency-Key header on DELETE /photo-entries:
    - DELETE a valid photo entry without the `Idempotency-Key` header.
    - Assert: status 400; body code `validation_failed`.
    - Assert: `deletePhotoEntry` spy not called.

    Test 10 — postCommit ordering and idempotency replay does NOT re-fire postCommit:
    - Spy on PostHog capture and Inngest `.send`.
    - FIRST DELETE /photo-entries/${E2.id}: assert status 204; assert PostHog/Inngest spies called (postCommitFn ran once after withIdempotency committed).
    - SECOND DELETE same E2.id with same Idempotency-Key: assert status 204 (replay); assert PostHog/Inngest spies NOT called again (postCommitFn undefined on replay — closure-capture no-op).
  </behavior>
  <action>
    1. Create `src/contexts/catalog/api/route-handlers/delete-photo-entry-handler.ts`:

       ```ts
       import { ErrorCode, errorResponse } from "@shared/config/errors";
       import { requireVerifiedUser } from "@shared/api/auth";
       import { resolveSubscriptionStateFromEnv } from "@contexts/billing/application/subscription-provider";
       import { serverEnv } from "@shared/config/server-env";
       import { deletePhotoEntry } from "@contexts/catalog/application/delete-photo-entry";

       export async function deletePhotoEntryHandler(
         request: Request,
         context: { params: Promise<{ photoEntryId: string }> } | { params: { photoEntryId: string } },
       ): Promise<Response> {
         const params = "then" in context.params ? await context.params : context.params;
         const photoEntryId = params.photoEntryId;

         const auth = await requireVerifiedUser(request);
         if (!auth.ok) return errorResponse(auth.code, "missing or invalid bearer token");
         const userId = auth.user.id;

         const subscription = resolveSubscriptionStateFromEnv({
           SUBSCRIPTION_READ_ONLY: serverEnv.SUBSCRIPTION_READ_ONLY,
         });
         if (subscription.readOnly) {
           return errorResponse(ErrorCode.ReadOnlyMode, "subscription is in read-only mode");
         }

         const idempotencyKey = request.headers.get("idempotency-key");
         if (!idempotencyKey || idempotencyKey.trim() === "") {
           return errorResponse(ErrorCode.ValidationFailed, "Idempotency-Key header is required");
         }

         const url = new URL(request.url);
         const requestHash = createHash("sha256")
           .update(`DELETE:${url.pathname}`)
           .digest("hex");

         const result = await withIdempotency(
           { userId, key: idempotencyKey, requestHash },
           async (tx) => {
             const inner = await deletePhotoEntry({ userId, photoEntryId }, tx);
             if (!inner.ok) {
               return { status: errorStatusFor(inner.code), body: { error: { code: inner.code, message: inner.reason } } };
             }
             return { status: 204, body: null };
           },
         );

         return new Response(result.body !== null ? JSON.stringify(result.body) : null, {
           status: result.status,
           headers: result.body !== null ? { "content-type": "application/json" } : {},
         });
       }
       ```

       Add `import { createHash } from "node:crypto";` and `import { withIdempotency } from "@shared/api/idempotency";` to imports. Pass `tx` to `deletePhotoEntry` via deps using the same closure-capture postCommit pattern as `deletePlantHandler` (Task 2):

       ```ts
       let postCommitFn: (() => Promise<void>) | undefined;

       const result = await withIdempotency(
         { userId, key: idempotencyKey, requestHash },
         async (tx) => {
           const inner = await deletePhotoEntry({ userId, photoEntryId }, tx);
           if (!inner.ok) {
             return { status: errorStatusFor(inner.code), body: { error: { code: inner.code, message: inner.reason } } };
           }
           postCommitFn = inner.postCommit;  // captured; only runs if withIdempotency commits
           return { status: 204, body: null };
         },
       );

       // On replay postCommitFn is undefined (no-op). On rollback we never reach this line.
       try { await postCommitFn?.(); } catch (e) { Sentry.captureException(e); }

       return new Response(result.body !== null ? JSON.stringify(result.body) : null, {
         status: result.status,
         headers: result.body !== null ? { "content-type": "application/json" } : {},
       });
       ```

    2. Create `src/app/api/v1/photo-entries/[photoEntryId]/route.ts`:

       ```ts
       export const runtime = "nodejs";
       export { deletePhotoEntryHandler as DELETE } from "@contexts/catalog/api/route-handlers/delete-photo-entry-handler";
       ```

       Verify the parent directory `src/app/api/v1/photo-entries/[photoEntryId]/` exists (creating it if necessary). Use `mkdir -p` via the Bash tool when wiring the file — Next.js will only register the route if the file exists at the right path.

    3. Extend `tests/integration/catalog-mutate-delete-routes.integration.test.ts` with the `describe("DELETE /api/v1/photo-entries/[photoEntryId]", ...)` block (8 tests).

    4. RED → GREEN → commit.

    5. Final commit: `feat(05-09): DELETE /api/v1/photo-entries/[photoEntryId] handler (cover auto-promote)`.

    **Plan-level grep guard (run after Task 3 commits):**
    ```bash
    # No hard-coded HTTP statuses in any handler:
    grep -nE "\b(400|401|402|403|404|409|500)\b" src/contexts/catalog/api/route-handlers/*.ts | grep -v "^[^:]*:[^:]*:.*//"
    # Expected: zero matches (excluding comment lines).

    # No Drizzle imports in route files:
    grep -rE "from \"drizzle-orm|from \"@contexts/catalog/infrastructure/db" src/app/api/v1/plants/\[plantId\]/route.ts src/app/api/v1/photo-entries/\[photoEntryId\]/route.ts
    # Expected: zero matches.

    # Each handler calls requireVerifiedUser + resolveSubscriptionStateFromEnv exactly once:
    for f in src/contexts/catalog/api/route-handlers/{update-plant,delete-plant,delete-photo-entry}-handler.ts; do
      [ "$(grep -c requireVerifiedUser "$f")" -ge 1 ] || { echo "MISSING auth gate in $f"; exit 1; }
      [ "$(grep -c resolveSubscriptionStateFromEnv "$f")" -ge 1 ] || { echo "MISSING readOnly gate in $f"; exit 1; }
    done
    ```
  </action>
  <verify>
    <automated>pnpm test:integration -- catalog-mutate-delete-routes</automated>
    <automated>pnpm test:unit -- no-drizzle-in-routes</automated>
  </verify>
  <done>
    All 8 DELETE /photo-entries/[photoEntryId] tests green. Cover auto-promote contract verified. `src/app/api/v1/photo-entries/[photoEntryId]/route.ts` exists. Plan-level grep guards pass. `pnpm tsc --noEmit` clean. `pnpm lint --max-warnings=0` passes.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary                     | Description                                                                                       |
|------------------------------|---------------------------------------------------------------------------------------------------|
| Client → API                 | Untrusted JSON body (PATCH) and untrusted plantId / photoEntryId in URL — every handler MUST gate via `requireVerifiedUser` and reject cross-user resources via `findByIdForUser` (in the use-case).               |
| API JSON body → application  | PATCH body parsed by `updatePlantInputSchema.strict()`; `.strict()` rejects unknown keys and prototype-pollution payloads (T-05-04-02 inherited).                                                              |
| Process env → SSR handler    | `SUBSCRIPTION_READ_ONLY` read via `serverEnv` per request inside the handler. No client-side path. Strict equality check (`=== "1"` in `resolveSubscriptionStateFromEnv`) means accidental truthy values do NOT enable read-only.                                              |
| Application → storage        | Storage prefix-delete from delete-plant use-case (05-06) calls `validateStoragePathOwnership` (05-04). This plan VERIFIES the cross-user-no-storage-call invariant via integration test (Task 2 Test 3).         |

## STRIDE Threat Register

| Threat ID    | Category | Component                                                          | Disposition | Mitigation Plan                                                                                                                                                                         |
|--------------|----------|--------------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| T-05-09-01   | E (Elevation) | Cross-user mutation via spoofed plantId / photoEntryId in URL  | mitigate    | Use-cases (`updatePlant`, `deletePlant`, `deletePhotoEntry`) call `findByIdForUser(db, userId, id)` — non-owners get `not_found` (NOT `forbidden`, to avoid existence disclosure). Integration tests Task 1 Test 7 + Task 2 Test 3 + Task 3 Test 4 assert HTTP 404 + body code `not_found` + DB unchanged. **HIGH** severity, mitigated.    |
| T-05-09-02   | E, I     | Plant deletion race exposing other users' data via prefix mis-scope | mitigate    | `delete-plant.ts` (05-06) calls `validateStoragePathOwnership({userId, plantId, key})` (shipped by 05-04 Task 2) BEFORE any `storageAdapter.deletePrefix(...)` invocation. **THIS plan VERIFIES** via integration test Task 2 Test 3: cross-user DELETE → `not_found` → storage adapter spy NEVER invoked. The use-case-level call site is enforced by 05-06 (key_link reminder logged in 05-04 SUMMARY); this plan's contribution is the cross-user ownership gate at the route layer + the in-memory storage adapter spy. **HIGH** severity, mitigated. |
| T-05-09-03   | T, R     | Idempotency-Key collisions on PATCH                                 | mitigate    | `withIdempotency` (Phase 2 D-37) keys responses by `(user_id, key, request_hash)`. Hash mismatch on same `(user_id, key)` returns HTTP 409 + body code `conflict` WITHOUT replaying the prior response or invoking the use-case (per `idempotency.ts:169-177`). Integration test Task 1 Test 3 asserts 409 + spy not called for the second mismatched call. RLS owner-only on `idempotency_keys` (Phase 2 D-37) prevents cross-user replay. **HIGH** severity, mitigated. |
| T-05-09-04   | I (Information Disclosure) | Read-only mode bypass via direct route call after subscription cancel | mitigate    | Handler-level guard returns `read_only_mode` (HTTP 402) BEFORE invoking the use-case. Integration tests Task 1 Test 10, Task 2 Test 4, Task 3 Test 5 assert (a) HTTP 402, (b) `vi.spyOn(useCaseModule, "useCaseFn")` NEVER called, (c) DB row count unchanged pre/post, (d) storage adapter not called. The check uses `resolveSubscriptionStateFromEnv` from 05-11 (server-side, env-driven, no client tamperability per T-05-11-01). The handler is a UI-affordance gate; defense in depth means Phase 10 will replace the env stub with real Stripe state — handler signature is forward-compatible. **HIGH** severity, mitigated. |
| T-05-09-05   | T (Tampering) | DELETE /photo-entries cover auto-promote race                     | accept      | `deletePhotoEntry` use-case (05-07) wraps DELETE + `bumpCoverFor` in the SAME UoW transaction (D-03). Two concurrent DELETE requests on different photo entries of the same plant may serialize on the row lock — Postgres MVCC handles this. Worst case is two cover-promotion queries running back-to-back; each is read-then-write within its tx, so the final cover_photo_url converges to the oldest remaining entry. Acceptable: no data loss, no cross-user leak. |
| T-05-09-06   | I        | Use-case error reasons leaking implementation details to clients   | mitigate    | Handlers MAP use-case `(code, reason)` tuples to closed-registry codes ONLY — `result.reason` IS sent in the error message but the use-cases (05-06/05-07) own the reason strings and they do not leak DB internals (per existing pattern in `upload-photo.ts:82-91`). Auth path uses a stable hard-coded message ("missing or invalid bearer token") per WR-02 — handlers NEVER pass `auth.reason` through (jose error names would aid fingerprinting). |
| T-05-09-07   | D (DoS)  | Idempotency table growth under abuse                                | accept      | Phase 2 D-38 sets 7-day TTL on `idempotency_keys` rows; Inngest reconciler (out of scope here) sweeps expired rows. Per-user RLS prevents one user from filling another's slot. Acceptable. |

`block_on_high: true` per outline. T-05-09-01, T-05-09-02, T-05-09-03, T-05-09-04 are HIGH and ALL mitigated within this plan or its dependencies (05-06 enforces the storage-path validator call site for T-05-09-02; this plan asserts the cross-user-not-called invariant at the integration boundary). No unmitigated HIGHs.
</threat_model>

<verification>

## Plan-Level Checks

After all three tasks complete:

```bash
# Integration suite — the primary verification surface for this plan
pnpm test:integration -- catalog-mutate-delete-routes
# Expected: all 31 tests green (11 PATCH + 10 DELETE plant + 10 DELETE photo-entry; +2 idempotency-missing tests per HIGH-3 patch; +2 postCommit-ordering tests per postCommit corrective patch).

# Backstop: no Drizzle imports in /api/* route files
pnpm test:unit -- no-drizzle-in-routes

# Type check + lint
pnpm tsc --noEmit
pnpm lint --max-warnings=0

# Confirm closed-registry contract
grep -rE "errorResponse\(ErrorCode\." src/contexts/catalog/api/route-handlers/
# Expected: every error path uses ErrorCode.X (closed registry); zero string-literal codes.

# Confirm no hard-coded HTTP statuses in handlers (except 200/204/201)
grep -nE "\b(400|401|402|403|404|409)\b" src/contexts/catalog/api/route-handlers/*.ts | grep -v '^\s*//' | grep -v '^\s*\*'
# Expected: zero matches.

# Confirm SUBSCRIPTION_READ_ONLY only read via serverEnv (no direct process.env in handler)
grep -rn "process\.env\.SUBSCRIPTION_READ_ONLY" src/contexts/catalog/api/route-handlers/
# Expected: zero matches (resolveSubscriptionStateFromEnv reads via serverEnv shim).

# Confirm requireVerifiedUser is the FIRST gate in every handler
for f in src/contexts/catalog/api/route-handlers/{update-plant,delete-plant,delete-photo-entry}-handler.ts; do
  awk '/export async function/{flag=1} flag && /requireVerifiedUser/{print FILENAME": OK"; exit}' "$f"
done
# Expected: three "OK" lines.
```

## Integration with Wave 4 UI Plans

This plan is the API surface that 05-15 (catalog grid), 05-16 (plant profile inline-edit + delete-confirm), and 05-17 (manual-add + photo-journal entry deletion) consume. Specifically:

- **05-16 InlineEditField save:** calls `PATCH /api/v1/plants/[plantId]` with `{ [field]: newValue }` and a fresh Idempotency-Key per save. Optimistic UI rollback on non-200 (D-06 LWW: server wins).
- **05-16 Delete-confirm sheet:** calls `DELETE /api/v1/plants/[plantId]` after user confirms; triggers `<CatalogGrid>` invalidation via `queryClient.invalidateQueries({queryKey: plantsKeys.all()})`.
- **05-17 Photo-journal entry delete:** calls `DELETE /api/v1/photo-entries/[photoEntryId]`; cover auto-promote happens server-side, client refetches `plantsKeys.detail(plantId)` to pick up new cover_photo_url.

## Phase 4 Allowlist Posture

Neither route is added to `UNVERIFIED_ALLOWED_PATHS` (Phase 4 D-23). The default-deny posture means:
- Authenticated-but-unverified users hitting these routes get HTTP 403 + body code `email_unverified`.
- The proxy (`src/proxy.ts`) does not need updating.

## Read-Only Mode Posture

`SUBSCRIPTION_READ_ONLY` is registered ONLY in `serverEnv` (per 05-11). This plan does NOT add it to `clientEnv` and does NOT introduce a `NEXT_PUBLIC_*` alias. Verified by:
```bash
grep "NEXT_PUBLIC_SUBSCRIPTION" src/shared/config/client-env.ts
# Expected: zero matches.
```

</verification>

<success_criteria>

- [ ] `PATCH /api/v1/plants/[plantId]` returns 200 + updated plant on happy path; replays return cached body without re-invoking `updatePlant`.
- [ ] `PATCH` returns 400 (`validation_failed`) when Idempotency-Key is missing, body is empty, body has unknown keys, or body fails Zod validation.
- [ ] `PATCH` returns 409 (`conflict`) when same Idempotency-Key is reused with a different body.
- [ ] `PATCH/DELETE` on a cross-user resource returns 404 (`not_found`), NEVER 403 — no existence disclosure.
- [ ] `DELETE /api/v1/plants/[plantId]` requires Idempotency-Key header (400 if missing); first call returns 204, replay of same key returns cached 204 without re-invoking `deletePlant`; cascades photo_entries + reminders, sets identifications.plant_id NULL, inserts two `pending_storage_deletions` rows, emits `plant.deleted` Inngest event, captures `plant_deleted` PostHog event.
- [ ] `DELETE /api/v1/photo-entries/[photoEntryId]` requires Idempotency-Key header (400 if missing); returns 204 + auto-promotes cover to next-oldest entry within the same UoW transaction (D-03); replay of same key returns cached 204 without re-invoking `deletePhotoEntry`.
- [ ] All three handlers gate on `requireVerifiedUser` FIRST and `resolveSubscriptionStateFromEnv(...).readOnly` SECOND, BEFORE any use-case invocation.
- [ ] When `SUBSCRIPTION_READ_ONLY=1`, all three handlers return 402 (`read_only_mode`) and the use-case spy is NEVER called (asserted in three integration tests, one per handler).
- [ ] All errors emit registry codes only: `validation_failed | not_found | forbidden | read_only_mode | subscription_required | unauthenticated | email_unverified | conflict`.
- [ ] Routes contain ZERO Drizzle imports (`pnpm test:unit -- no-drizzle-in-routes` green).
- [ ] All 31 integration tests in `catalog-mutate-delete-routes.integration.test.ts` green (11 PATCH + 10 DELETE plant + 10 DELETE photo-entry; includes postCommit-ordering and no-postCommit-on-replay assertions).
- [ ] `pnpm tsc --noEmit` and `pnpm lint --max-warnings=0` clean.
- [ ] Plan-level grep guards (no hard-coded statuses, no direct `process.env.SUBSCRIPTION_READ_ONLY`, no Drizzle in routes) all return zero matches as expected.
- [ ] All HIGH STRIDE threats (T-05-09-01..04) have `mitigate` disposition with a concrete integration-test assertion proving the mitigation.

</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-09-route-handlers-mutate-delete-SUMMARY.md` covering:
- Files created (4) + modified (2) + 1 integration test file
- Test count: 27 integration tests across 3 describe blocks
- Closed-registry contract: which codes are emitted by which handler under which condition
- Idempotency posture: PATCH and DELETE all three handlers wrap in `withIdempotency` per Phase 2 D-37; tx passed to use-case via deps; key derivation = request body hash + Idempotency-Key header
- Read-only mode integration: how `resolveSubscriptionStateFromEnv` is wired and why it fires before use-case invocation (T-05-09-04 mitigation)
- Wave 4 UI handoff notes: which UI plan consumes which endpoint, with the optimistic-UI rollback pattern for PATCH (D-06 LWW)
- Open follow-ups: VALIDATION.md Per-Task Verification Map rows for the three tasks should be populated (planner updates after this plan ships)
</output>
