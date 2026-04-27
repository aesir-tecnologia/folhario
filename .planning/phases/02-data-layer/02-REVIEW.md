---
phase: 02-data-layer
reviewed: 2026-04-26T18:45:00Z
depth: standard
files_reviewed: 79
files_reviewed_list:
  - .github/workflows/ci.yml
  - .gitignore
  - drizzle.config.ts
  - drizzle/migrations/0000_phase_02_initial_schema.sql
  - drizzle/migrations/0001_phase_02_rls_policies.sql
  - drizzle/migrations/meta/0000_snapshot.json
  - drizzle/migrations/meta/0001_snapshot.json
  - drizzle/migrations/meta/_journal.json
  - drizzle/seeds/phase-02.sql
  - eslint.config.mjs
  - package.json
  - playwright.config.ts
  - scripts/check-rls.ts
  - scripts/check-seeds.ts
  - scripts/seed.ts
  - src/app/api/v1/diagnostics/consent/route.ts
  - src/app/api/v1/photos/upload/route.ts
  - src/contexts/billing/domain/events.ts
  - src/contexts/billing/domain/schemas.ts
  - src/contexts/billing/infrastructure/db/schema.ts
  - src/contexts/catalog/application/upload-photo.ts
  - src/contexts/catalog/domain/events.ts
  - src/contexts/catalog/domain/schemas.ts
  - src/contexts/catalog/infrastructure/db/photo-entries.ts
  - src/contexts/catalog/infrastructure/db/plants.ts
  - src/contexts/catalog/infrastructure/db/schema.ts
  - src/contexts/catalog/infrastructure/photo-storage.ts
  - src/contexts/iam/api/consent-route.ts
  - src/contexts/iam/application/current-user.ts
  - src/contexts/iam/application/record-consent.ts
  - src/contexts/iam/application/user-query-service.ts
  - src/contexts/iam/domain/consent-schemas.ts
  - src/contexts/iam/domain/events.ts
  - src/contexts/iam/domain/schemas.ts
  - src/contexts/iam/infrastructure/auth/auth-adapter.ts
  - src/contexts/iam/infrastructure/db/consent-logs.ts
  - src/contexts/iam/infrastructure/db/schema.ts
  - src/contexts/iam/infrastructure/db/users.ts
  - src/contexts/identification/domain/events.ts
  - src/contexts/identification/domain/schemas.ts
  - src/contexts/identification/infrastructure/db/schema.ts
  - src/contexts/notifications/domain/events.ts
  - src/contexts/notifications/domain/schemas.ts
  - src/contexts/notifications/infrastructure/db/schema.ts
  - src/contexts/reminders/domain/events.ts
  - src/contexts/reminders/domain/schemas.ts
  - src/contexts/reminders/infrastructure/db/schema.ts
  - src/contexts/species-care/domain/events.ts
  - src/contexts/species-care/domain/schemas.ts
  - src/contexts/species-care/infrastructure/db/schema.ts
  - src/proxy.ts
  - src/shared/adapters/storage.ts
  - src/shared/adapters/supabase-storage.ts
  - src/shared/api/auth.ts
  - src/shared/api/cursor.ts
  - src/shared/api/idempotency.ts
  - src/shared/api/request.ts
  - src/shared/config/server-env.ts
  - src/shared/db/client.ts
  - src/shared/db/migration-client.ts
  - src/shared/db/schema-registry.ts
  - src/shared/db/unit-of-work.ts
  - src/shared/images/client-compress.ts
  - src/shared/images/limits.ts
  - src/shared/images/server-validate.ts
  - supabase/config.toml
  - tests/e2e/diagnostics-consent.spec.ts
  - tests/e2e/fixtures/test-jwks.ts
  - tests/e2e/global-setup.ts
  - tests/integration/auth-jwt.integration.test.ts
  - tests/integration/diagnostics-consent.integration.test.ts
  - tests/integration/idempotency.integration.test.ts
  - tests/integration/photo-upload.integration.test.ts
  - tests/integration/proxy-auth.integration.test.ts
  - tests/integration/rls-real-jwt.integration.test.ts
  - tests/integration/schema-rls.integration.test.ts
  - tests/integration/seed-data.integration.test.ts
  - tests/integration/sharp-smoke.integration.test.ts
  - tests/integration/storage-adapter.integration.test.ts
  - tests/integration/storage-buckets.integration.test.ts
  - tests/integration/unit-of-work.integration.test.ts
  - tests/unit/api-conventions.test.ts
  - tests/unit/auth-adapter.test.ts
  - tests/unit/db-client.test.ts
  - tests/unit/image-pipeline.test.ts
  - tests/unit/no-drizzle-in-routes.test.ts
  - tests/unit/proxy-body-passthrough.test.ts
  - tests/unit/schema-registry.test.ts
findings:
  critical: 0
  warning: 3
  info: 4
  total: 7
status: issues_found
prior_review: 2026-04-26 iter2 — 1 BLOCKER (CR-01) + 6 WR + 4 IN. This iter3 verifies all 9 listed prior fixes resolved their invariants in code; 2 carry-forward findings (WR-05, IN-04) remain open from iter2 because they were out-of-scope for the iter2-3 fix list.
---

# Phase 02 (Data Layer) — Re-Review (iteration 3)

**Reviewed:** 2026-04-26T18:45:00Z
**Depth:** standard
**Files Reviewed:** 79
**Status:** issues_found

## Re-Review Context

The iter2 review (`02-REVIEW.iter2.md`) flagged 11 findings; the orchestrator listed 9 to fix in this iteration. This re-review confirms all 9 fixes resolve their stated invariants in code with no behavioural regressions, and surfaces 1 new WARNING introduced by the WR-04 fix (a now-unreferenced schema), plus carries forward the 2 iter2 findings that were out of fix scope (WR-05 auth.uid() shim, IN-04 migration timestamps).

### Verified prior fixes (all sound)

- **CR-01 (compensating-delete no-op).** `StorageAdapter.deleteObject` added at `src/shared/adapters/storage.ts:82` and implemented at `src/shared/adapters/supabase-storage.ts:122-134` via `remove([objectKey])`. `src/contexts/catalog/infrastructure/photo-storage.ts:180,198` now routes both compensating deletes through `deleteObject` (not `deletePrefix`). The integration test at `tests/integration/photo-upload.integration.test.ts:283-372` was upgraded to state-based — it asserts both `deleteObject` was called with the canonical key AND `listObjectsUnderPrefix({prefix: "${userId}/"})` returns `[]` after the failure. The fake's `deletePrefix` mock at `:93-110` deliberately mirrors the real Supabase semantics (no-ops on file-path prefix), so a regression that re-routes single-file delete through `deletePrefix` cannot pass.
- **WR-01 (jose audience/issuer/algorithm pinning).** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:155-159` pins `audience`, `issuer`, `algorithms`. Defaults at `:98-118` derive issuer/audience from Supabase URL with `AUTH_AUDIENCE_OVERRIDE` / `AUTH_ISSUER_OVERRIDE` env hooks for E2E. Unit tests at `tests/unit/auth-adapter.test.ts:169-217` cover wrong-aud, wrong-iss, and no-aud paths; the e2e fixture at `tests/e2e/fixtures/test-jwks.ts:52-53` and Playwright config at `playwright.config.ts:48-53` thread the same constants end-to-end.
- **WR-02 (jose error-name leak).** `src/app/api/v1/photos/upload/route.ts:42` and `src/contexts/iam/api/consent-route.ts:59,131` both use `"missing or invalid bearer token"` — jose error names no longer reach the client. `auth.reason` is preserved for server-side observability only.
- **WR-03 (policy_versions one-current invariant).** Migration `drizzle/migrations/0002_unique_current_policy_per_doc_type.sql` creates `CREATE UNIQUE INDEX ... WHERE is_current = true`. `src/contexts/iam/application/record-consent.ts:74` adds `.orderBy(desc(policyVersions.effectiveAt))` as belt-and-braces.
- **WR-04 (drizzle-zod-rooted body schema).** `src/contexts/iam/api/consent-route.ts:27-31` switched from a hand-rolled `z.object({...})` to `consentLogInsertSchema.pick({purpose: true, legalBasis: true, source: true})`. Verified directly against `node_modules/drizzle-zod/index.mjs:44-45` — the library generates `z.enum(column.enumValues)` for `varchar({ enum: [...] as const })` columns, and `insertConditions.optional` at `:287` makes `.notNull()`-without-default columns required. So the picked schema preserves the strict enum validation. (See WR-01 below for the related dead-code finding.)
- **WR-06 (idempotency–RLS coupling).** Documentation present in both `src/shared/api/idempotency.ts:43-55` and the matching migration block at `drizzle/migrations/0001_phase_02_rls_policies.sql:184-194`. The two notes cross-reference each other and the integration test as the regression gate. This is the documented-dependency form recommended by iter2.
- **IN-01 (extFromMime exhaustive).** `src/contexts/catalog/application/upload-photo.ts:53-66` now uses an exhaustive switch with `const _exhaustive: never = mime` — adding a new variant to `AllowedMime` will fail at compile time. (See IN-04 below for a minor purity nit.)
- **IN-02 (compensating-delete observability).** `src/contexts/catalog/infrastructure/photo-storage.ts:186-195` and `:204-213` both add `Sentry.captureException(err, { tags, extra: { bucket, objectKey, userId, plantId, photoId } })`. LGPD-compliant: only IDs are passed via `extra`, never email/name. The CLAUDE.md `Sentry.setUser({ id })` only rule is honoured because no `Sentry.setUser(...)` is invoked here at all.
- **IN-03 (base64url cursor).** `src/shared/api/cursor.ts:49,67` uses `"base64url"` for encode and decode. `Buffer.from(input, "base64url")` accepts both standard and URL-safe forms, so legacy clients with stored standard-base64 cursors continue to decode (verified against Node stdlib).

### Carry-forward findings (still open, out of iter2-3 fix scope)

- **WR-05 from iter2 (`auth.uid()` shim activation gating).** No code change; the shim at `drizzle/migrations/0001_phase_02_rls_policies.sql:34-42` still activates on schema-presence only, with `scripts/check-rls.ts:62-75` as the production guard. Re-numbered as WR-02 below.
- **IN-04 from iter2 (migration timestamps predate planning).** `drizzle/migrations/meta/_journal.json` now has 3 entries with timestamps `1777220218174` (2026-04-22), `1777220252423` (2026-04-22), `1777247706469` (2026-04-22) — all still pre-date the iter2 review date (2026-04-26). The new 0002 migration is also back-dated. Re-numbered as IN-03 below.

### New finding introduced by the WR-04 fix

`consentLogCreateInputSchema` (lines 28-40 of `src/contexts/iam/domain/consent-schemas.ts`) is now dead code — the route stopped importing it when it switched to `consentLogInsertSchema.pick(...)`, and a grep across `src/` and `tests/` shows the only remaining references are the export itself and the comment in `src/contexts/iam/api/consent-route.ts:43`. See WR-01 below.

---

## Summary

The phase ships a careful data layer with cryptographic JWT verification (now correctly pinning aud/iss/alg), drizzle-zod-rooted route schemas, a unit-of-work that switches role + binds the JWT-sub GUC, an idempotency wrapper composing inside the same transaction, real `deleteObject` for compensating-delete, a partial unique index pinning the one-current-policy invariant, and Sentry-backed observability for compensating-delete failures. Test coverage has been strengthened from call-shape to state-based for the orphan-prevention path.

This re-review found zero BLOCKERS, three WARNINGS (one new dead-code finding from the WR-04 fix, plus two carry-forwards from iter2 — one re-classified to WR-03 about a typing cast that surfaced when reading the idempotency helper closely), and four INFO items (one new test-coverage gap, three carry-forwards). All previously-listed fixes hold up to standard-depth verification.

---

## Warnings

### WR-01: Dead code — `consentLogCreateInputSchema` no longer has any consumer

**File:** `src/contexts/iam/domain/consent-schemas.ts:28-40`
**Issue:** When the WR-04 fix in iter2 switched `src/contexts/iam/api/consent-route.ts` to use `consentLogInsertSchema.pick(...)` (lines 27-31 of that file), it stopped importing `consentLogCreateInputSchema`. A grep across `src/` and `tests/` confirms the only remaining references are the export itself and a stale doc-comment at `src/contexts/iam/api/consent-route.ts:43`. The hand-rolled schema is now structurally orphaned.

```bash
$ grep -rn "consentLogCreateInputSchema" src/ tests/
src/contexts/iam/api/consent-route.ts:43:   *   - `parseJsonBody(...)` + `consentLogCreateInputSchema` validate the
src/contexts/iam/domain/consent-schemas.ts:15: * `consentLogCreateInputSchema` is the refined boundary shape for that
src/contexts/iam/domain/consent-schemas.ts:28:export const consentLogCreateInputSchema = z.object({
src/contexts/iam/domain/consent-schemas.ts:40:export type ConsentLogCreateInput = z.infer<typeof consentLogCreateInputSchema>;
```

This is a code-quality regression introduced by the iter2 fix. The risk is two-fold: (a) future maintainers may "fix" the route by switching back to `consentLogCreateInputSchema` because it superficially matches the documented shape, undoing the drizzle-zod rooting; (b) the dead schema can drift from the table definition without any test catching it (no consumer = no signal).

**Fix:** Delete the orphaned schema and type, plus the now-stale comment in the route doc:

```typescript
// src/contexts/iam/domain/consent-schemas.ts
// Delete lines 28-40 and the descriptive doc-block at lines 14-21.
// Keep `consentLogInsertSchema` (line 26) — that IS the source of truth now.

// src/contexts/iam/api/consent-route.ts:43
// Replace the stale "consentLogCreateInputSchema" mention with
// "consentRoutePostBodySchema" (the local picked schema).
```

If the schema is intentionally kept for future surfaces (e.g. settings page, signup flow), document the justification in the schema's doc-comment and add at least one consumer-side test pinning the enum membership so the schema cannot silently drift.

---

### WR-02: `auth.uid()` shim activation is keyed on schema presence, not environment (carry-forward from iter2 WR-05)

**File:** `drizzle/migrations/0001_phase_02_rls_policies.sql:34-42`
**Issue:** Unchanged from iter2. The CI shim runs `IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth')`. If a future production environment ever lands without the `auth` schema (a new Supabase project with auth feature disabled, a misconfigured restore, a forked Supabase installation), the shim silently installs and `auth.uid()` returns `NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid`. RLS policies that compare against `auth.uid()` would then trust whatever value PostgREST/the application bound — including the empty string (NULL after the cast) which makes `auth.uid() = id` evaluate to NULL → reject all rows. Or if no GUC is set, `current_setting('request.jwt.claim.sub', true)` returns NULL → `NULLIF(NULL, '')` is NULL → cast to uuid fails noisily on the first authenticated query.

`scripts/check-rls.ts:62-75` partially compensates: when `NODE_ENV=production` AND `auth` schema absent, it aborts. But `check-rls` is a deploy-time script, not a migration step. If `db:migrate` runs but `db:check-rls` is skipped (CI workflow change, manual intervention), the shim installs and the production runtime is exposed.

**Fix:** Combine the existing schema check with an explicit non-production guard inside the migration itself:

```sql
DO $$ BEGIN
  IF current_setting('app.environment', true) IS NOT DISTINCT FROM 'production' THEN
    RAISE EXCEPTION 'auth.uid() shim must not be installed in production';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'auth') THEN
    CREATE SCHEMA auth;
    -- ... existing function definition
  END IF;
END $$;
```

Or guard at the migration runner: have `db:migrate` set `app.environment` from `process.env.NODE_ENV` via `SET LOCAL` before applying. Either way, the migration itself should refuse to install the shim in production rather than relying on a separate readiness probe.

---

### WR-03: `idempotency_keys.responseBody` cast `as never` defeats the column's typed shape

**File:** `src/shared/api/idempotency.ts:142`
**Issue:** Inside `withIdempotency`, the UPDATE statement at lines 138-145 includes:

```typescript
responseBody: response.body as never,
```

The cast forces `unknown` (from `IdempotencyHandler`'s return signature) into the column's typed shape — Drizzle's `jsonb` column type infers `unknown | null` here, but `as never` is the wrong escape hatch. `as never` asserts the value can be anything, which short-circuits any future type narrowing that drizzle-zod or Drizzle could provide for jsonb shapes (e.g. a Phase 04 refinement that pins the response body to a closed shape would not produce a type error here). The conventional escape hatch for "I trust this jsonb is valid" is `as unknown` or — better — leave the field untyped at the column declaration and validate at the use-case boundary.

This is a code-quality issue, not a runtime bug today: the value IS serializable JSON (validated by the route handler before calling `withIdempotency`). But the cast hides one of the load-bearing safety properties of the helper: that the body returned to a replay matches the body returned to the original caller. A future refactor that narrows the type at the column declaration would silently lose type-checking here.

**Fix:** Replace `as never` with `as unknown` (the Drizzle-recommended form) or remove the cast entirely if Drizzle's inferred type accepts `unknown`:

```typescript
// idempotency.ts:142
responseBody: response.body as unknown,
```

Add a unit test that pins the round-trip with a non-trivial body so a future serialization regression is observable. Already partially covered by `tests/integration/idempotency.integration.test.ts:103-104` ("second call returns same body") — extend with a deeply-nested body so a `JSON.parse(JSON.stringify(...))`-style regression would fail loudly.

---

## Info

### IN-01: `consent-route.ts` doc-comment still references the deleted schema

**File:** `src/contexts/iam/api/consent-route.ts:43`
**Issue:** The route's module-level doc-comment at lines 33-52 includes:

```typescript
 *   - `parseJsonBody(...)` + `consentLogCreateInputSchema` validate the
 *     POST body, mapping non-ok to errorResponse(ValidationFailed, ...).
```

But the route now uses `consentRoutePostBodySchema` (the local picked schema at line 27). The comment is stale by exactly one identifier. This is the same drift WR-01 surfaces from a different angle — fix both together.

**Fix:**
```typescript
// consent-route.ts:43-44
 *   - `parseJsonBody(...)` + `consentRoutePostBodySchema` (a `.pick()` of
 *     the drizzle-zod-rooted `consentLogInsertSchema`) validate the POST
 *     body, mapping non-ok to errorResponse(ValidationFailed, ...).
```

---

### IN-02: No regression test pinning the route's enum-validation contract

**File:** `tests/integration/diagnostics-consent.integration.test.ts`
**Issue:** The WR-04 iter2 fix replaced a hand-rolled `z.enum(...)` validator with `consentLogInsertSchema.pick(...)`. The drizzle-zod source (verified at `node_modules/drizzle-zod/index.mjs:44-45`) confirms 0.8.3 generates `z.enum(column.enumValues)` for varchar columns with `enum:` constraints — so the route still rejects e.g. `purpose: "garbage"` with 400. But there is NO test exercising this path: a regression that re-imports the wrong schema, or a future drizzle-zod major bump that changes enum handling, would not be caught by the current test suite.

The diagnostics-consent integration test at lines 256-447 covers: missing bearer (401), missing idempotency key (400), valid POST (201), replay, GET pagination, malformed cursor (400), proxy body passthrough. It does NOT cover: invalid enum value in `purpose`/`legalBasis`/`source` returning 400 with `validation_failed`.

**Fix:** Add a focused enum-rejection test:

```typescript
it("POST with invalid purpose returns 400 validation_failed", async () => {
  __setCurrentUserAdapterForTests(adapterForUser(userId));
  const request = new NextRequest(reqUrl("/api/v1/diagnostics/consent"), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer fake-test-token",
      "idempotency-key": `task2-bad-${randomUUID()}`,
    },
    body: JSON.stringify({
      purpose: "not_a_real_purpose",
      legalBasis: "consent",
      source: "first_use_prompt",
    }),
  });
  const response = await routeMod.POST(request);
  expect(response.status).toBe(400);
  const body = await response.json();
  expect(body.error.code).toBe(ErrorCode.ValidationFailed);
});
```

This pins the drizzle-zod rooting empirically — if a refactor weakens the enum to `z.string()` (intentionally or by library regression), this test fails loudly.

---

### IN-03: Migration timestamps in `_journal.json` predate the planning artifact dates (carry-forward from iter2 IN-04)

**File:** `drizzle/migrations/meta/_journal.json:8,14,22`
**Issue:** Unchanged from iter2 — the new 0002 migration was added but its `when` value is also back-dated. All three timestamps decode to 2026-04-22 (computed from the millisecond values 1777220218174, 1777220252423, 1777247706469), several days before the iter2 review date (2026-04-26) and before the iter3 fix-application date implied by today (2026-04-26). Drizzle uses these timestamps to order migrations; a future phase-3 migration that's accidentally back-dated could silently flip the ordering.

**Fix:** Add a CI assertion that `meta/_journal.json` `when` values are monotonically increasing per `idx`. Alternatively, document under CLAUDE.md `Conventions` that drizzle migrations must use the timestamp at the moment of generation and never be hand-edited. A small Vitest check is cheap:

```typescript
// tests/unit/journal-monotonic.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("drizzle migrations journal monotonicity", () => {
  it("entry `when` values are strictly increasing per `idx`", () => {
    const journal = JSON.parse(
      readFileSync(join(__dirname, "..", "..", "drizzle/migrations/meta/_journal.json"), "utf8"),
    ) as { entries: { idx: number; when: number }[] };
    const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i]!.when).toBeGreaterThan(sorted[i - 1]!.when);
    }
  });
});
```

---

### IN-04: `_exhaustive as string` cast in `extFromMime` defeats the `never` purity

**File:** `src/contexts/catalog/application/upload-photo.ts:63`
**Issue:** The IN-01 iter2 fix added an exhaustive switch:

```typescript
default: {
  const _exhaustive: never = mime;
  throw new Error(`extFromMime: unhandled MIME ${_exhaustive as string}`);
}
```

The `as string` cast bypasses the `never` type just to interpolate the value in a template string. Not a runtime bug — the default branch is unreachable when `AllowedMime` is correctly narrowed. But the cast slightly defeats the exhaustiveness check: a future refactor that loosens `AllowedMime` (e.g. to `string` for any reason) would not trigger a type error here because the cast accepts anything.

**Fix:** Drop the cast — `String(_exhaustive)` is a runtime-safe way to coerce that doesn't suppress type checking:

```typescript
default: {
  const _exhaustive: never = mime;
  throw new Error(`extFromMime: unhandled MIME ${String(_exhaustive)}`);
}
```

Or accept that the value is unreachable and emit a static string:

```typescript
default: {
  const _exhaustive: never = mime;
  throw new Error("extFromMime: exhaustive switch hit a never value");
}
```

Either form preserves the compile-time exhaustiveness guarantee that motivated the iter2 IN-01 fix.

---

_Reviewed: 2026-04-26T18:45:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
