---
phase: 02-data-layer
fixed_at: 2026-04-26T20:58:00Z
review_path: .planning/phases/02-data-layer/02-REVIEW.md
iteration: 1
findings_in_scope: 11
fixed: 9
skipped: 2
status: partial
---

# Phase 02 (Data Layer) — Code Review Fix Report

**Fixed at:** 2026-04-26T20:58:00Z
**Source review:** `.planning/phases/02-data-layer/02-REVIEW.md`
**Iteration:** 1

**Summary:**
- Findings in scope: 11 (1 BLOCKER + 6 WARNING + 4 INFO)
- Fixed: 9
- Skipped: 2 (WR-05, IN-04)

## Fixed Issues

### CR-01: CR-03 fix regression — `deleteSinglePlantPhotoBestEffort` is a no-op against the real Supabase Storage adapter

**Files modified:** `src/contexts/catalog/infrastructure/photo-storage.ts`, `src/shared/adapters/storage.ts`, `src/shared/adapters/supabase-storage.ts`, `tests/integration/photo-upload.integration.test.ts`
**Commits:** `9a297ba` (production fix + initial test rewrite), `c4e06d5` (test follow-up: make round-trip assertion load-bearing)
**Applied fix:** Added `deleteObject(input)` to the `StorageAdapter` interface (single-key removal via the SDK's `client.storage.from(bucket).remove([objectKey])`). Implemented in the Supabase adapter with proper error wrapping. Replaced both `deletePrefix` calls in `deleteSinglePlantPhotoBestEffort` with `deleteObject` calls so single-file compensating deletion no longer routes through the SDK's folder-list path. Updated the photo-upload integration test's fake adapter to add a `deleteObject` mock plus a `_stored` test seam exposing the internal storage set, then replaced the call-shape assertion with a state-based assertion: after the compensating delete fires, `listObjectsUnderPrefix({ bucket, prefix: "${userId}/" })` returns an empty array. The follow-up commit `c4e06d5` was needed because `vi.fn().mockImplementation(...)` REPLACES default behaviour, so the override had to seed `fake._stored` directly to keep the round-trip assertion load-bearing; the fake's `deletePrefix` was also tightened to no-op when the prefix doesn't end with `/` (mirroring the real Supabase SDK semantic that a file-path-as-folder list returns zero matches). With these changes a regression that reverts `deleteSinglePlantPhotoBestEffort` to its old `deletePrefix(file_path)` form would leave `_stored` non-empty and the assertion would fail — the test now has teeth.

### WR-01: JWT verification skips `audience` and `issuer` validation

**Files modified:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts`, `tests/e2e/fixtures/test-jwks.ts`, `tests/unit/auth-adapter.test.ts`, `tests/integration/auth-jwt.integration.test.ts`, `tests/e2e/diagnostics-consent.spec.ts`, `playwright.config.ts`
**Commit:** `4c36c67`
**Applied fix:** Added `audience`, `issuer`, and `algorithms` factory options to `createAuthAdapter`. Defaults: `audience = "authenticated"`, `issuer = "${NEXT_PUBLIC_SUPABASE_URL}/auth/v1"`, `algorithms = ["RS256", "ES256"]`. Each can be overridden via factory option or env var (`AUTH_AUDIENCE_OVERRIDE` / `AUTH_ISSUER_OVERRIDE`) — analogous to the existing `AUTH_JWKS_OVERRIDE_URL` hook. Pass these options to `jwtVerify` so jose actually validates the claims. Updated `tests/e2e/fixtures/test-jwks.ts` to export `TEST_AUDIENCE` / `TEST_ISSUER` constants, modified `signTestJwt` to set them by default. Updated the unit test to pin matching audience/issuer in the local-JWKS adapter and added three new tests: wrong-audience, wrong-issuer, and missing-audience all return `Unauthenticated`. Updated the integration test to pass audience/issuer through to the URL-based adapter constructor. Updated `playwright.config.ts` to set `AUTH_AUDIENCE_OVERRIDE` / `AUTH_ISSUER_OVERRIDE` on the Next webServer's env so the running server pins the same values the spec's signed JWTs carry. Updated `tests/e2e/diagnostics-consent.spec.ts` to set audience/issuer on its locally-constructed JWT.

### WR-02: Photo upload route leaks jose error names through `errorResponse.message`

**Files modified:** `src/app/api/v1/photos/upload/route.ts`
**Commit:** `afac19c`
**Applied fix:** Replaced `errorResponse(auth.code, auth.reason)` with `errorResponse(auth.code, "missing or invalid bearer token")` — the same stable, non-jose-specific message the consent route uses. The `auth.reason` is still available to server-side observability code (e.g., Sentry breadcrumbs), but never reaches the client response body. Eliminates jose error-name fingerprinting on the client surface.

### WR-03: `policy_versions.is_current = true` has no DB-level uniqueness invariant

**Files modified:** `drizzle/migrations/0002_unique_current_policy_per_doc_type.sql` (new), `drizzle/migrations/meta/_journal.json`, `drizzle/migrations/meta/0002_snapshot.json` (new), `src/contexts/iam/application/record-consent.ts`
**Commit:** `4a4b6a2`
**Applied fix:** Created migration `0002_unique_current_policy_per_doc_type.sql` that adds a partial unique index `policy_versions_one_current_per_doc_type_idx ON public.policy_versions (document_type) WHERE is_current = true`. This makes "exactly one current row per document_type" a hard DB invariant, so the LGPD consent chain-of-custody is deterministic. Updated `_journal.json` with idx 2 entry and timestamp at the moment of generation. Created `0002_snapshot.json` (custom non-schema migration → snapshot identical to 0001 except for `id` (new uuid) and `prevId` (set to 0001's id), per drizzle's snapshot graph requirements). Added `.orderBy(desc(policyVersions.effectiveAt))` belt-and-braces to the query in `record-consent.ts:64-77` so the most-recently-effective row is picked deterministically even when historical data pre-dates the index.

### WR-04: Route-boundary schema bypasses the drizzle-zod root it claims to honour

**Files modified:** `src/contexts/iam/api/consent-route.ts`
**Commit:** `7e63056`
**Applied fix:** Replaced the dead `_ensureSchemaRoot` import + hand-rolled `z.object({...})` with `consentLogInsertSchema.pick({ purpose: true, legalBasis: true, source: true })`. Verified via local script that drizzle-zod preserves the column-level enum constraints (`purpose`, `source`) and the `legalBasis` pgEnum, so a malformed value fails parse. Removed the now-unused `z` import. The drizzle-zod rooting is now load-bearing — extending an enum on the table will flow to the route boundary automatically.

### WR-06: Idempotency-key writes share the user's transaction with no service-role separation

**Files modified:** `src/shared/api/idempotency.ts`, `drizzle/migrations/0001_phase_02_rls_policies.sql`
**Commit:** `6e30f29`
**Applied fix:** Per advisor recommendation, took option (b) from the review. Added a 12-line documentation block above the `idempotency_keys_owner_all` policy in the migration explaining that `withIdempotency` runs INSERT/SELECT-FOR-UPDATE/UPDATE on this table inside the user transaction, so the policy is load-bearing for the helper. Added a matching note inside `withIdempotency`'s docstring referencing the policy and the integration test as the regression gate. Did NOT add a regression test (per advisor: substantive new test code, not a fix). Did NOT switch to a temporary-service-role pattern — that would couple infra writes to RLS bypass mechanics and defeat the existing CR-02 hardening.

### IN-01: `extFromMime` defaults to `"webp"` for any unknown MIME

**Files modified:** `src/contexts/catalog/application/upload-photo.ts`
**Commit:** `3bc95c5`
**Applied fix:** Replaced the if/if/return-`"webp"` form with an exhaustive `switch` on `mime`. The `default` arm assigns `mime` to a `_exhaustive: never` local — TypeScript will surface a type error at compile time when `AllowedMime` gains a new variant, and the runtime throws if reached anyway. The `_exhaustive as string` template-string coercion is required because `never` cannot be implicitly stringified.

### IN-02: Compensating-delete failures only reach `console.warn`, not Sentry

**Files modified:** `src/contexts/catalog/infrastructure/photo-storage.ts` (combined with CR-01 commit since both touch the same compensating-delete block)
**Commit:** `9a297ba` (same commit as CR-01)
**Applied fix:** Imported `* as Sentry from "@sentry/nextjs"`. After each `console.warn`, added `Sentry.captureException(err, { tags: { area: "photo-storage", operation: "compensating-delete" }, extra: { bucket, objectKey, userId, plantId, photoId } })`. Compliant with CLAUDE.md's "Sentry user context is `Sentry.setUser({ id })` only — never email" rule: the userId travels via `extra`, not `setUser`.

### IN-03: Cursor encoding uses standard base64 (not URL-safe)

**Files modified:** `src/shared/api/cursor.ts`
**Commit:** `6709714`
**Applied fix:** Switched `encodeCursor` to use Node `Buffer.toString("base64url")` — URL-safe by definition, no `+` / `/` characters that would need percent-encoding when placed in `?cursor=...`. Also switched `decodeCursor` to use `"base64url"` decoding, which Node accepts for both URL-safe and standard-base64 inputs (so legacy clients that may have stored a standard-base64 cursor continue to decode correctly). Updated docstrings to reflect the new contract.

## Skipped Issues

### WR-05: `auth.uid()` shim activation is keyed on schema presence, not environment

**File:** `drizzle/migrations/0001_phase_02_rls_policies.sql:34-42`
**Reason:** skipped: SQL-only guard requires coordinated migration-runner GUC plumbing.
**Original issue:** The reviewer's proposed fix adds a `current_setting('app.environment', true) IS NOT DISTINCT FROM 'production'` guard inside the migration's `DO $$ ... $$` block. As the advisor noted, that guard only fires when the GUC is *explicitly* set to `'production'`. With the current `db:migrate` command (drizzle-kit invoked directly via `node node_modules/drizzle-kit/bin.cjs migrate`), no SQL session-level `SET LOCAL app.environment = 'production'` is issued before applying migrations, so `current_setting(...,true)` returns NULL/empty in production and the comparison evaluates to false — the shim still installs. To make this real, the migration runner itself (a wrapper around `src/shared/db/migration-client.ts`, or a custom drizzle migration adapter) would need to inject the GUC from `process.env.NODE_ENV` before applying any migration. That is a coordinated cross-cutting change beyond the scope of a single finding fix. The existing `scripts/check-rls.ts` production guard at deploy time already provides the operative defense: it reads `process.env.NODE_ENV` directly (the source of truth) and aborts when production lands without a real Supabase auth schema. Recommend handling this in a dedicated follow-up if/when the migration-runner is overhauled — adding the SQL guard alone today is theater that would mislead future readers about the actual layer of protection.

### IN-04: Migration timestamps in `_journal.json` predate the planning artifact dates

**File:** `drizzle/migrations/meta/_journal.json`
**Reason:** skipped: no stable home for the convention note in the current docs structure.
**Original issue:** The reviewer suggested either a CI assertion script that `meta/_journal.json` `when` values are monotonically increasing per `idx`, or a CLAUDE.md `## Conventions` note saying "drizzle migrations: never hand-edit `meta/_journal.json` `when` timestamps; let drizzle-kit generate them at the moment of creation." The CI assertion is a substantive new script — per the broader review-fix posture (skip-and-log substantive scope expansion), that is out of scope. The CLAUDE.md doc note initially looked viable, but the file is auto-managed: the `## Conventions` block is sourced from `CONVENTIONS.md` (per the `<!-- GSD:conventions-start source:CONVENTIONS.md -->` marker), and currently reads "Conventions not yet established. Will populate as patterns emerge during development." Editing the section directly would be lost the next time CLAUDE.md is regenerated from its sources, and creating `CONVENTIONS.md` ad-hoc would couple this fix to project documentation infrastructure not yet in place. Net effect of skipping: a hygiene issue stays open. The 0002 migration written today uses a fresh timestamp from `Date.now()`, demonstrating the convention by example.

---

_Fixed: 2026-04-26T20:58:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
