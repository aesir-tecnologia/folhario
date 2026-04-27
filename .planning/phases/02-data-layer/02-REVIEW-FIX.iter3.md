---
phase: 02-data-layer
fixed_at: 2026-04-26T22:35:00Z
review_path: .planning/phases/02-data-layer/02-REVIEW.md
iteration: 2
findings_in_scope: 7
fixed: 4
skipped: 3
status: partial
---

# Phase 02 (Data Layer) — Code Review Fix Report

**Fixed at:** 2026-04-26T22:35:00Z
**Source review:** `.planning/phases/02-data-layer/02-REVIEW.md`
**Iteration:** 2

**Summary:**
- Findings in scope: 7 (3 WARNING + 4 INFO; 0 BLOCKER)
- Fixed: 4 (WR-01, WR-03, IN-01, IN-04)
- Skipped: 3 (WR-02 carry-forward, IN-02 substantive new test code, IN-03 carry-forward)

## Fixed Issues

### WR-01: Dead code — `consentLogCreateInputSchema` no longer has any consumer

**Files modified:** `src/contexts/iam/domain/consent-schemas.ts`, `tests/unit/api-conventions.test.ts`
**Commit:** `24416f8`
**Applied fix:** Deleted the orphaned `consentLogCreateInputSchema` schema and `ConsentLogCreateInput` type from `src/contexts/iam/domain/consent-schemas.ts`. Removed the unused `z` import (the file now only needs `createInsertSchema` from `drizzle-zod`). Rewrote the module-level doc-comment to describe the new reality: `consentLogInsertSchema` is the single source of truth (the drizzle-zod root) and the diagnostics route narrows it locally with `.pick({ purpose, legalBasis, source })`. Cross-referenced the route file so a maintainer reading either file can find the other.

The reviewer's grep missed one consumer: `tests/unit/api-conventions.test.ts:13` imported `consentLogCreateInputSchema` and exercised it through a `describe` block. The test was already pinning the wrong schema (the dead hand-rolled one, not the `.pick(...)` form the route actually validates). Migrated the test block to mirror the route's local picked schema: re-declared `const consentRoutePostBodySchema = consentLogInsertSchema.pick({purpose, legalBasis, source})` inside the `describe` so the unit test now pins exactly the same shape the route validates. This means a future regression that swaps the route back to a hand-rolled schema, or a drizzle-zod major bump that changes enum handling, fails this test loudly. Per advisor guidance, this is required scope (the test is a consumer of the deleted symbol; leaving it broken would fail the build) — not a substantive new test addition. Three test cases were dropped or adapted: the `policyVersionId` field doesn't exist in the picked schema, so the "non-UUID policyVersionId" case was deleted entirely and the other inputs no longer include `policyVersionId`. The "rejects missing required fields" case is preserved (empty `{}` still fails). Updated the describe label and the doc-comment at lines 176-194 to reflect the picked-schema reality. `npx tsc --noEmit` is clean after the change.

### WR-03: `idempotency_keys.responseBody` cast `as never` defeats the column's typed shape

**Files modified:** `src/shared/api/idempotency.ts`
**Commit:** `78073d9`
**Applied fix:** Replaced `responseBody: response.body as never` with `responseBody: response.body as unknown` at line 142. The `responseBody` column is declared as plain `jsonb("response_body")` in `src/contexts/iam/infrastructure/db/schema.ts:232` (no narrower TypeScript shape pinned at the column declaration), so Drizzle infers the column as `unknown | null` — `as unknown` is the conventional drizzle-zod-friendly escape hatch and preserves any future column-level narrowing that drizzle or drizzle-zod might introduce. `as never` would have silently absorbed a future narrowed type. `npx tsc --noEmit` and ESLint both clean. Did NOT extend the integration test as the reviewer suggested (substantive new test scaffolding, not a fix); the existing replay round-trip assertion at `tests/integration/diagnostics-consent.integration.test.ts:307-343` already exercises the JSONB serialization path end-to-end.

### IN-01: `consent-route.ts` doc-comment still references the deleted schema

**Files modified:** `src/contexts/iam/api/consent-route.ts`
**Commit:** `35f2a5d`
**Applied fix:** Replaced the stale `consentLogCreateInputSchema` mention in the route's module-level doc-comment (line 43) with `consentRoutePostBodySchema (a `.pick()` of the drizzle-zod-rooted consentLogInsertSchema)`. The comment now accurately describes the validation flow as it exists in the code at line 27. This is the same drift that WR-01 surfaces — fixing them in separate atomic commits per the per-finding commit discipline.

### IN-04: `_exhaustive as string` cast in `extFromMime` defeats the `never` purity

**Files modified:** `src/contexts/catalog/application/upload-photo.ts`
**Commit:** `826d8db`
**Applied fix:** Replaced `${_exhaustive as string}` with `${String(_exhaustive)}` in the exhaustive switch's default branch at line 63. `String()` is a runtime-safe coercion that doesn't suppress type checking — if a future refactor loosens `AllowedMime` to a wider type, the assignment to `_exhaustive: never` on line 62 will fail at compile time as intended. The previous `as string` cast would have silently absorbed any wider type. `npx tsc --noEmit` is clean.

## Skipped Issues

### WR-02: `auth.uid()` shim activation is keyed on schema presence, not environment (carry-forward from iter2 WR-05)

**File:** `drizzle/migrations/0001_phase_02_rls_policies.sql:34-42`
**Reason:** skipped: SQL-only guard requires coordinated migration-runner GUC plumbing (same rationale as iter1).
**Original issue:** Identical to iter2 WR-05; the underlying conditions have not changed since iter1 skipped this finding. The reviewer's proposed fix adds a `current_setting('app.environment', true) IS NOT DISTINCT FROM 'production'` guard inside the migration's `DO $$ ... $$` block, but that GUC must be set explicitly via `SET LOCAL app.environment = 'production'` before applying migrations. The current `db:migrate` command (drizzle-kit invoked directly) does not issue any such `SET LOCAL`, so `current_setting(...)` returns NULL/empty in production and the comparison silently evaluates false — the shim still installs. Making the guard real requires modifying the migration runner itself (a wrapper around `src/shared/db/migration-client.ts` or a custom drizzle migration adapter) to inject the GUC from `process.env.NODE_ENV` before any migration runs. That is a coordinated cross-cutting change beyond the scope of a single finding fix. The existing `scripts/check-rls.ts` production guard at `:62-75` already provides the operative defense at deploy time: it reads `process.env.NODE_ENV` directly (the source of truth) and aborts when production lands without a real Supabase auth schema. Adding the SQL guard alone today would be theater that misleads future readers about the actual layer of protection. Recommend handling this in a dedicated follow-up if/when the migration-runner is overhauled.

### IN-02: No regression test pinning the route's enum-validation contract

**File:** `tests/integration/diagnostics-consent.integration.test.ts`
**Reason:** skipped: substantive new test code, not a fix; consistent with iter1 WR-06 posture.
**Original issue:** The reviewer suggested adding an integration test that POSTs `purpose: "not_a_real_purpose"` and asserts the response is 400 `validation_failed`. Per the iter1 fix-posture (skip-and-log substantive new test additions when the underlying behaviour is already proven), this is consistent with how iter1 handled WR-06 ("Did NOT add a regression test (per advisor: substantive new test code, not a fix)"). The drizzle-zod-rooted enum behaviour is now empirically pinned at the unit level by the migrated test block in `tests/unit/api-conventions.test.ts` (added as part of the WR-01 fix above) — that block exercises `consentLogInsertSchema.pick({...}).safeParse(...)` with invalid `purpose`, `legalBasis`, and `source` values and asserts each returns `success: false`. This pins the exact `.pick(...)` shape the route uses without reinventing the route-level wiring. Adding a duplicate integration-level test would be additive coverage at meaningfully higher infrastructure cost. The reviewer's intent — "fail loudly if drizzle-zod ever loses enum membership" — is satisfied by the unit test. Recommend the integration-level test as a separate follow-up if the team wants HTTP-boundary coverage of the same invariant.

### IN-03: Migration timestamps in `_journal.json` predate the planning artifact dates (carry-forward from iter2 IN-04)

**File:** `drizzle/migrations/meta/_journal.json:8,14,22`
**Reason:** skipped: no stable home for the convention note in the current docs structure; CI assertion is substantive new test code (same rationale as iter1).
**Original issue:** Identical to iter2 IN-04; the underlying conditions have not changed. The reviewer's proposed fix is either a CI assertion (a new Vitest unit test enforcing monotonic `when` per `idx`) or a CLAUDE.md `## Conventions` note. The CI assertion is substantive new code, out of scope for the broader review-fix posture. The CLAUDE.md doc note is structurally infeasible: the `## Conventions` block is auto-managed (sourced via `<!-- GSD:conventions-start source:CONVENTIONS.md -->` from a `CONVENTIONS.md` file that does not yet exist), and currently reads "Conventions not yet established. Will populate as patterns emerge during development." Editing that section directly would be lost on the next regeneration, and creating `CONVENTIONS.md` ad-hoc would couple this hygiene fix to project-documentation infrastructure not yet in place. Net effect of skipping: a hygiene issue stays open. The reviewer's note that the new 0002 migration is also back-dated would only be addressable by regenerating the migration with a current timestamp, which is not safe to do post-commit (drizzle-kit would treat it as a new migration). Recommend handling either via: (a) bootstrap `CONVENTIONS.md` and add the convention there in a future docs-housekeeping phase, or (b) add the CI assertion in a future test-housekeeping phase.

---

_Fixed: 2026-04-26T22:35:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 2_
