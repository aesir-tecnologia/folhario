---
phase: 02-data-layer
fixed_at: 2026-04-26T23:30:00Z
review_path: .planning/phases/02-data-layer/02-REVIEW.md
iteration: 3
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 02 (Data Layer) — Code Review Fix Report

**Fixed at:** 2026-04-26T23:30:00Z
**Source review:** `.planning/phases/02-data-layer/02-REVIEW.md`
**Iteration:** 3

**Summary:**
- Findings in scope: 6 (2 WARNING + 4 INFO; 0 BLOCKER)
- Fixed: 6 (WR-01, WR-02, IN-01, IN-02, IN-03, IN-04)
- Skipped: 0

This is the final iteration (3 of 3) of the `--auto` fix loop. All 6 new findings surfaced by iter4 review have been addressed in scoped, low-risk fixes. None of the 3 acknowledged-skipped findings from prior iterations (auth.uid() shim, enum-rejection HTTP-boundary test, migration timestamp note) are re-raised in this review and remain documented in the prior REVIEW-FIX reports.

## Fixed Issues

### WR-01: Duplicate `consentLogInsertSchema` in `iam/domain/schemas.ts` re-creates iter3 drift hazard

**Files modified:** `src/contexts/iam/domain/schemas.ts`
**Commit:** `2bdfc02`
**Applied fix:** Surgical removal of the four consent-related lines from `src/contexts/iam/domain/schemas.ts` (the `consentLogSelectSchema`, the duplicate `consentLogInsertSchema`, and the `ConsentLog` / `ConsentLogInsert` types) plus the now-unused `consentLogs` import. The canonical definitions remain at `src/contexts/iam/domain/consent-schemas.ts:29` (the route's actual import source per `src/contexts/iam/api/consent-route.ts:9`). Replaced the deleted block with a one-paragraph note explaining where the consent schema lives and why this file must not re-derive it — refinements added to the canonical schema now flow to every consumer without ambiguity. Did not delete the rest of `iam/domain/schemas.ts` — the user's directive was "remove the duplicate," not "remove the file"; the broader IN-03 finding handles the unconsumed-scaffolding concern with an annotation rather than deletion. `npx tsc --noEmit` is clean. `grep -rn "consentLogInsertSchema" src/` now shows the symbol only at `consent-schemas.ts` (definition) and `consent-route.ts` (consumer) — no third invocation site exists.

### WR-02: Integration body-passthrough test now exercises route's `parseJsonBody` after proxy

**Files modified:** `tests/integration/diagnostics-consent.integration.test.ts`
**Commit:** `445c8ef`
**Applied fix:** Reshaped the `"end-to-end proxy body-passthrough"` integration test to actually prove the load-bearing claim from `02-09-PLAN.md:124-125` and `:138`: the route's `request.json()` successfully parses a body after the proxy returns. Concrete changes: (a) included an `Idempotency-Key` header so the route does NOT short-circuit at the missing-key check (consent-route.ts:64-67) and proceeds to `parseJsonBody` at line 69; (b) sent a structurally-valid JSON body with an INVALID `purpose` enum value so `parseJsonBody`'s `safeParse` fails at the schema layer, the route hits "invalid consent body" at consent-route.ts:71, and the resulting 400 is provably caused by `request.json()` having been successfully invoked; (c) renamed the test to `"end-to-end proxy body-passthrough — route's parseJsonBody runs after proxy"`; (d) tightened the assertions: `request.bodyUsed === false` immediately after `proxyDefault(request)` (proves proxy did not consume), `expect(body.error.message).toContain("invalid consent body")` (proves the 400 came from line 71 not line 66 since "invalid consent body" only emits from the parseJsonBody branch), and `request.bodyUsed === true` after the route call (proves request.json() was actually invoked and finished, distinguishing "schema rejected my body" from "json() threw before consuming"). The combination of these three assertions closes the docstring lie the iter4 reviewer correctly flagged. Did not invoke vitest run because the test requires a live local Postgres (the test is `describe.skipIf(!dbUrl)` gated and the broader Phase-02 verifier owns DB-bound runs); compile-check via `npx tsc --noEmit` passes cleanly.

### IN-01: Removed unreachable `|| DEFAULT_LIMIT` in consent route GET handler

**Files modified:** `src/contexts/iam/api/consent-route.ts`
**Commit:** `1b57f93`
**Applied fix:** Replaced `const limit = normalizeLimit(limitParam) || DEFAULT_LIMIT` with `const limit = normalizeLimit(limitParam)` at consent-route.ts:140 (now :144 after comment expansion). Per `tests/unit/api-conventions.test.ts:133-174`, `normalizeLimit` is contractually total and never returns 0/NaN/falsy — empty/null/non-numeric inputs collapse to `DEFAULT_LIMIT`, negatives clamp to 1, over-MAX clamps to MAX_LIMIT — so the right operand was unreachable. Added a 4-line comment documenting why the fallback isn't needed so a future maintainer doesn't reintroduce the operator out of misplaced defensiveness. Also dropped `DEFAULT_LIMIT` from the import statement at line 8 since it was the only consumer in the file and ESLint's `no-unused-vars` would have flagged it. `npx tsc --noEmit` clean.

### IN-02: `buildFakeUserRow` now constructs from real `users` schema fields

**Files modified:** `tests/unit/auth-adapter.test.ts`
**Commit:** `5680a2b`
**Applied fix:** Rewrote `buildFakeUserRow` at tests/unit/auth-adapter.test.ts:258 to use the real schema field names (`trialSource`, `partnerCode`, `ageConfirmedAt`, `toxicityDisclaimerAcknowledgedAt`, `deletionRequestedAt`) instead of the stale ones (`plan`, `trialEndsAt`, `consentVersionId`, `notificationOptIn`, `pendingDeletionAt`) that don't exist on the `users` table. The `as unknown as UserRow` cast is now removed entirely — the function returns a structurally-typed object that satisfies `UserRow` directly. Timestamps use `new Date().toISOString()` rather than `new Date()` because the schema declares `timestamp(...).withTimezone().mode("string")`, so `UserRow` types `createdAt` / `updatedAt` as `string`. With the cast gone, a future schema change (column rename, new required field, type change) now fails at compile time inside this test file rather than being silently absorbed. `npx tsc --noEmit` clean.

### IN-03: Annotated 6 unconsumed `domain/schemas.ts` modules as Phase-2 scaffolding

**Files modified:** `src/contexts/billing/domain/schemas.ts`, `src/contexts/catalog/domain/schemas.ts`, `src/contexts/identification/domain/schemas.ts`, `src/contexts/notifications/domain/schemas.ts`, `src/contexts/reminders/domain/schemas.ts`, `src/contexts/species-care/domain/schemas.ts`
**Commit:** `b08b5b3`
**Applied fix:** Selected Option B from the reviewer's three options (annotation, not deletion). Added a `Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).` lead paragraph to the module-level doc-comment on each of the six listed files, mirroring the pattern already established in the `domain/events.ts` files (which carry an explicit `Phase 2 scope: event NAME and PAYLOAD types only. Async dispatcher lands in Phase 4.` annotation). The annotation tells a future maintainer that adding refinements here has no effect because nothing imports them — the same drift hazard that bit the iter3/iter4 IAM consent schema in a different form. The identification context retained its specific examples ("result-array shape, min_confidence range, failure_reason coupling with status") inside the same comment because those refinements ARE the future-consumer plan; the annotation just makes the no-current-consumer status explicit. Deletion was rejected as the chosen option for two reasons: (a) deleting six files at the final iteration carries real regression risk on a tight loop and (b) the reviewer's own preference order placed annotation second only to deletion, and the user's "low-risk only" instruction for the final iteration leans the choice toward annotation. The IAM `iam/domain/schemas.ts` was not annotated — its scope is owned by WR-01 and the canonical-vs-orphaned story there is more nuanced than a generic placeholder note. `npx tsc --noEmit` clean across all six files.

### IN-04: Documented snapshot/SQL discrepancy in 0002 migration header

**Files modified:** `drizzle/migrations/0002_unique_current_policy_per_doc_type.sql`
**Commit:** `667f6d2`
**Applied fix:** Appended an `IN-04 — SNAPSHOT/SQL DISCREPANCY` block to the migration's header comment explaining (a) why `meta/0002_snapshot.json` does not contain the partial unique index, (b) what happens if a future phase adds the equivalent `uniqueIndex(...).on(documentType).where(eq(isCurrent, true))` declaration to `policyVersions` in TypeScript, (c) why the `IF NOT EXISTS` guard makes a redundant CREATE safe at deploy time but still constitutes audit-trail noise, and (d) the recommended workflow (regenerate the snapshot alongside the TS declaration so drizzle-kit emits an empty diff). Documentation-only fix; snapshot regeneration was deliberately deferred to avoid unrelated diff noise — `pnpm db:generate` requires `DATABASE_URL` (a direct, non-pooled connection per `drizzle.config.ts:3-5`) and would re-emit any unrelated drift in the canonical schema. The reviewer's primary recommendation was the SQL header comment; that's what landed. The optional Vitest snapshot-presence assertion remains a future-housekeeping item; it is substantive new test code beyond the scope of an INFO-level finding fix.

---

_Fixed: 2026-04-26T23:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 3_
