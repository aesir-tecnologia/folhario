---
phase: 02-data-layer
reviewed: 2026-04-26T22:30:00Z
depth: standard
files_reviewed: 89
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
  - pnpm-lock.yaml
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
  warning: 2
  info: 3
  total: 5
status: issues_found
prior_review: 2026-04-26 iter4 — 0 BLOCKER + 2 WR + 4 IN. iter4-fix landed all 6 (WR-01 duplicate-schema removal, WR-02 body-passthrough test rewrite, IN-01 dead `|| DEFAULT_LIMIT` removal, IN-02 buildFakeUserRow real-schema rebuild, IN-03 6 unconsumed `domain/schemas.ts` annotations, IN-04 0002-migration snapshot/SQL discrepancy note). This iter5 verifies all 6 fixes hold and surfaces 2 new findings + 3 new INFO items, primarily around (a) cross-route response-naming inconsistency that contradicts a comment-asserted PRD §5 convention and (b) the IAM `domain/schemas.ts` exception to the IN-03 cleanup that is itself a structural inconsistency.
---

# Phase 02 (Data Layer) — Re-Review (iteration 5)

**Reviewed:** 2026-04-26T22:30:00Z
**Depth:** standard
**Files Reviewed:** 89
**Status:** issues_found

## Re-Review Context

The iter4 review (`02-REVIEW.iter*`) flagged 6 findings (2 WR + 4 IN, 0 BLOCKER); the iter4 `--auto` fix loop landed all 6 in a tight chain (commits `2bdfc02..667f6d2` plus the report at `f9ae6d3`). This re-review confirms each fix holds at standard-depth verification with no regressions, and surfaces 2 new findings — one a cross-context response-naming inconsistency that flatly contradicts a comment-asserted PRD §5 convention, the other a structural inconsistency where `iam/domain/schemas.ts` was deliberately left out of the IN-03 cleanup based on reasoning that does not actually hold up — plus 3 new INFO items including a misleading comment in the iter4 WR-02 body-passthrough fix.

### Verified iter4 fixes (all sound)

- **WR-01 (`iam/domain/schemas.ts` duplicate `consentLogInsertSchema`).** The duplicate `consentLogInsertSchema`, `consentLogSelectSchema`, `ConsentLog`, and `ConsentLogInsert` exports plus the `consentLogs` import were removed from `src/contexts/iam/domain/schemas.ts`. Lines 31-35 now carry an explanatory note pointing maintainers to `consent-schemas.ts` as the canonical source. `grep -rn "consentLogInsertSchema" src/` returns the symbol only at `consent-schemas.ts:29` (definition) and `consent-route.ts:9` (consumer) — exactly two sites. The single-source-of-truth invariant is restored.
- **WR-02 (body-passthrough test).** `tests/integration/diagnostics-consent.integration.test.ts:394-457` now includes an `Idempotency-Key` header AND sends a body with an invalid `purpose` enum value, so `parseJsonBody`'s `safeParse` runs after `request.json()` succeeds. The new triple assertion (`request.bodyUsed === false` after proxy, `request.bodyUsed === true` after route, `body.error.message.includes("invalid consent body")`) is load-bearing for the T-02-37 end-to-end claim that the originating plan made — a regression where the proxy starts consuming the body or the route accidentally calls `await request.text()` before `parseJsonBody` would now fail this single test.
- **IN-01 (dead `|| DEFAULT_LIMIT`).** `consent-route.ts:144` now reads `const limit = normalizeLimit(limitParam)` and `DEFAULT_LIMIT` is gone from the file's import (line 8). The 4-line comment block at lines 140-143 explains why `normalizeLimit`'s total contract makes the fallback unreachable, so a future maintainer does not reintroduce it.
- **IN-02 (`buildFakeUserRow` schema drift).** `tests/unit/auth-adapter.test.ts:258-280` now constructs the fake from real `users` schema fields (`trialSource`, `partnerCode`, `ageConfirmedAt`, `toxicityDisclaimerAcknowledgedAt`, `deletionRequestedAt`). The `as unknown as UserRow` cast is gone — the function returns a structurally-typed `UserRow` directly. Timestamp fields use `new Date().toISOString()` to match the schema's `mode: "string"`. A future schema rename now fails at compile time inside the test instead of being silently absorbed.
- **IN-03 (6 unconsumed `domain/schemas.ts` annotations).** Six files (`billing`, `catalog`, `identification`, `notifications`, `reminders`, `species-care`) now carry the `Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).` lead paragraph, mirroring the `domain/events.ts` convention. The `iam/domain/schemas.ts` deliberately was NOT annotated — this exception is the basis for WR-02 below (it does not fit the iter4 reviewer's stated reasoning that placed iam in scope).
- **IN-04 (0002 snapshot/SQL discrepancy).** `drizzle/migrations/0002_unique_current_policy_per_doc_type.sql:15-24` carries the `IN-04 — SNAPSHOT/SQL DISCREPANCY` block explaining why the partial unique index is in raw SQL but not in `meta/0002_snapshot.json`, what happens if a future phase adds the equivalent TS declaration, and why the `IF NOT EXISTS` guard makes a redundant CREATE safe at deploy time. Documentation-only fix as the iter4 reviewer recommended; the snapshot regeneration is correctly deferred (it would require `DATABASE_URL` and risk picking up unrelated drift).

---

## Summary

The phase ships a careful data layer. This re-review found **zero BLOCKERS**, **two WARNINGS** (one is a cross-route response-naming inconsistency that contradicts a comment-asserted convention; the other is the unfinished slice of the iter4 IN-03 cleanup — `iam/domain/schemas.ts` did not receive the Phase-2-scaffolding annotation that the other 6 files did, despite being equally orphaned), and **three INFO items** (a slightly-wrong-but-non-load-bearing comment in the iter4 WR-02 body-passthrough fix, an asymmetric production guard between the JWKS override hook and the audience/issuer override hooks, and a missing-by-convention `test:run` script).

All previously-listed iter4 fixes hold up to standard-depth verification.

---

## Warnings

### WR-01: cross-route response-field naming inconsistency — `/api/v1/photos/upload` returns camelCase but `/api/v1/diagnostics/consent` returns snake_case (and asserts that as the PRD §5 convention)

**Files:** `src/app/api/v1/photos/upload/route.ts:88-95`, `src/contexts/iam/api/consent-route.ts:52,103-114,165-174`
**Issue:** The two `/api/v1/*` routes shipped in Phase 02 use mutually-incompatible response-field naming:

```typescript
// src/app/api/v1/photos/upload/route.ts:86-98 — CAMELCASE
return Response.json(
  {
    photoEntry: {
      id: result.photoEntry.id,
      plantId: result.photoEntry.plantId,
      photoUrl: result.photoEntry.photoUrl,
      thumbnailUrl: result.photoEntry.thumbnailUrl,
      note: result.photoEntry.note,
      createdAt: result.photoEntry.createdAt,
    },
  },
  { status: 201 },
);
```

```typescript
// src/contexts/iam/api/consent-route.ts:103-114 — SNAKE_CASE
return {
  status: 201,
  body: {
    id: row.id,
    user_id: row.userId,
    purpose: row.purpose,
    legal_basis: row.legalBasis,
    policy_version_id: row.policyVersionId,
    source: row.source,
    granted_at: row.grantedAt,
    revoked_at: row.revokedAt,
    created_at: row.createdAt,
  },
};
```

The consent route's doc-comment at `consent-route.ts:52` explicitly asserts the convention: **"Snake_case field names on response payloads match PRD §5 conventions."** That assertion is reinforced in `02-09-SUMMARY.md:88` ("Snake_case payload per PRD §5") and consistent with the published PRD §5 contract that `next_cursor` (not `nextCursor`) is the cursor field name. So one of the two routes is wrong, and the comment-asserted convention names the consent route as canonical.

The test fixture at `tests/integration/photo-upload.integration.test.ts:374-416` reads `rows[0]?.plant_id` and `rows[0]?.photo_url` directly from `driver` (the raw postgres-js row), not from the route response, so the integration test does NOT pin the route's response shape — a contract change to snake_case here would not break any currently-shipping test.

This is structurally distinct from a stylistic preference: both routes are part of the same API surface, so a client written against `/diagnostics/consent` (snake_case) and `/photos/upload` (camelCase) cannot use a uniform property-access pattern, and any future shared response normalizer (e.g., a `next-intl` formatter, a frontend `data` reducer) would need a per-route table. PRD §5 picks snake_case as the contract; the photo upload route diverges silently.

Risk: API-contract drift. The Phase 03 catalog UI (per `02-08-SUMMARY.md:237`) is documented to consume the response shape `{ photoEntry: { id, plantId, photoUrl, thumbnailUrl, note, createdAt } }`. If that consumer is built against the camelCase shape today and the route is later corrected to snake_case (as the PRD §5 convention demands), the UI breaks. If it stays as-is, every future `/api/v1/*` route the team writes faces the same fork — pick-your-own-naming becomes the de-facto contract.

**Fix:** Convert the upload route response to snake_case so the two routes agree and the comment-asserted PRD §5 convention is honored:

```typescript
// src/app/api/v1/photos/upload/route.ts:86-98
return Response.json(
  {
    photo_entry: {
      id: result.photoEntry.id,
      plant_id: result.photoEntry.plantId,
      photo_url: result.photoEntry.photoUrl,
      thumbnail_url: result.photoEntry.thumbnailUrl,
      note: result.photoEntry.note,
      created_at: result.photoEntry.createdAt,
    },
  },
  { status: 201 },
);
```

If the team prefers camelCase across the API surface (legitimate alternative — the convention is unwritten in `CLAUDE.md ## Conventions` which is empty), the consent route's comment at `consent-route.ts:52` should be deleted and the consent route's body keys flipped to camelCase. Either direction resolves the inconsistency; pick one and note the choice in `CLAUDE.md ## Conventions` (currently a placeholder line) so the next route author has a single rule to follow rather than a precedent table to read.

Optional: add a unit test in `tests/unit/api-conventions.test.ts` that imports both route handlers, drives them with stub adapters, and asserts the response keys are snake_case (or camelCase, per the chosen convention). That converts the convention from comment-only to load-bearing.

---

### WR-02: iter4 IN-03 cleanup is INCOMPLETE — `iam/domain/schemas.ts` is the same Phase-2-scaffolding shape as the 6 annotated files but did not receive the annotation, on reasoning that does not actually hold

**Files:** `src/contexts/iam/domain/schemas.ts:1-60` (no Phase-2-scaffolding annotation), vs `src/contexts/billing/domain/schemas.ts:5`, `src/contexts/catalog/domain/schemas.ts:5`, `src/contexts/identification/domain/schemas.ts:11`, `src/contexts/notifications/domain/schemas.ts`, `src/contexts/reminders/domain/schemas.ts`, `src/contexts/species-care/domain/schemas.ts` (all annotated `Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03).`)

**Issue:** The iter4 IN-03 fix annotated 6 of 7 unconsumed `domain/schemas.ts` files. The seventh — `src/contexts/iam/domain/schemas.ts` — was deliberately left out, and the `02-REVIEW-FIX.md:55` note justifies the exception with: "The IAM `iam/domain/schemas.ts` was not annotated — its scope is owned by WR-01 and the canonical-vs-orphaned story there is more nuanced than a generic placeholder note."

That reasoning does not actually hold up under the standard-depth pass:

1. **`iam/domain/schemas.ts` is structurally identical to the 6 annotated files for the orphaned exports it carries.** It exports `userSelectSchema`, `userInsertSchema`, `policyVersionSelectSchema`, `policyVersionInsertSchema`, `partnerStoreSelectSchema`, `partnerStoreInsertSchema`, `dataExportRequestSelectSchema`, `dataExportRequestInsertSchema`, `dataDeletionRequestSelectSchema`, `dataDeletionRequestInsertSchema`, `offlineSyncFailureSelectSchema`, `offlineSyncFailureInsertSchema`, `idempotencyKeySelectSchema`, `idempotencyKeyInsertSchema` — and ZERO of these are imported anywhere in `src/` or `tests/`:

   ```bash
   $ grep -rn "userInsertSchema\|policyVersionSelectSchema\|partnerStoreSelectSchema\|dataExportRequestSelectSchema\|dataDeletionRequestSelectSchema\|offlineSyncFailureSelectSchema\|idempotencyKeySelectSchema" src/ tests/
   src/contexts/iam/domain/schemas.ts:21:export const userSelectSchema = ...
   src/contexts/iam/domain/schemas.ts:22:export const userInsertSchema = ...
   src/contexts/iam/domain/schemas.ts:24:export type UserInsert = ...
   src/contexts/iam/domain/schemas.ts:26:export const policyVersionSelectSchema = ...
   src/contexts/iam/domain/schemas.ts:27:export const policyVersionInsertSchema = ...
   src/contexts/iam/domain/schemas.ts:28:export type PolicyVersion = ...
   src/contexts/iam/domain/schemas.ts:36:export const partnerStoreSelectSchema = ...
   ...
   # only the definition site appears; no consumer site exists.
   ```

   The "WR-01 owns it" claim is partially true — WR-01 owned the `consentLog`-related exports — but the file's OTHER 14 exports were not part of WR-01's scope and have no consumers. They are exactly the IN-03 shape: orphaned `createInsertSchema`/`createSelectSchema` invocations.

2. **The "canonical-vs-orphaned story is more nuanced" claim does not hold.** Looking at the file's structure, the lines 31-35 comment block correctly tells maintainers `consentLog{Insert,Select}Schema` lives in `consent-schemas.ts` — that's the WR-01 fix. But the rest of the file (lines 21-29, 36-59) is unannotated and EXACTLY the same drift hazard the iter4 IN-03 finding called out:

   ```typescript
   // src/contexts/iam/domain/schemas.ts:36-39 — unannotated, no consumers
   export const partnerStoreSelectSchema = createSelectSchema(partnerStores);
   export const partnerStoreInsertSchema = createInsertSchema(partnerStores);
   export type PartnerStore = ReturnType<typeof partnerStoreSelectSchema.parse>;
   export type PartnerStoreInsert = ReturnType<typeof partnerStoreInsertSchema.parse>;
   ```

   A future maintainer who adds a `.refine(...)` on `partnerStoreInsertSchema` here will see no effect on any consumer (none exist), exactly as the iter4 IN-03 finding warned. Without the annotation, the file looks like a production export, not scaffolding.

3. **The asymmetry is now load-bearing for IN-03's posture.** The iter4 IN-03 finding deliberately picked Option B (annotate, don't delete) so future maintainers see "intentional placeholder, refinements have no effect." Leaving 1 of 7 files unannotated breaks that property: a maintainer reading `iam/domain/schemas.ts` won't see the placeholder marker the other 6 files carry, so the implicit rule "if no annotation, this file is live" leads them to add a refinement that silently has no effect.

Risk: low (no runtime impact), structural (same drift hazard the iter4 IN-03 fix targeted, surface area now larger because one file disagrees with the convention the others establish).

**Fix:** Add the same Phase-2-scaffolding annotation to `iam/domain/schemas.ts`, preferably as a second paragraph in the existing `/** ... */` block at lines 13-19 so the WR-01 cleanup explanation and the IN-03 placeholder note co-exist:

```typescript
// src/contexts/iam/domain/schemas.ts:13-25
/**
 * IAM domain Zod schemas derived from drizzle-zod (D-19, D-40).
 *
 * Phase 2 scope: scaffolding only — no consumers in Phase 02 (IN-03,
 * mirroring the 6 other context `domain/schemas.ts` modules). Routes/
 * use-cases in later phases will import from here, not from the table
 * modules. Until a consumer lands, adding refinements here has no effect
 * because nothing imports them.
 *
 * The IAM consent-log Zod root lives in `consent-schemas.ts` (the
 * route-consumed module — WR-01 cleanup); do NOT re-derive
 * `createInsertSchema(consentLogs)` here.
 */
```

Optional: when WR-01 from this iter5 review (the response-naming inconsistency) is fixed, consider adding a `tests/unit/api-conventions.test.ts` block that asserts every `domain/schemas.ts` file in the codebase EITHER has a consumer (via grep) OR carries the Phase-2-scaffolding annotation. That converts the convention from documentation-only to a hard build gate — an unannotated unconsumed file would fail the test.

---

## Info

### IN-01: misleading comment in iter4 WR-02 fix's body-passthrough test — claims `bodyUsed === false` would be the regression signal if proxy consumed the body, but it would actually be `true`

**File:** `tests/integration/diagnostics-consent.integration.test.ts:453-456`
**Issue:** The iter4 WR-02 fix added a body-passthrough integration test. The comment at lines 453-456 reads:

```typescript
// Final proof that request.json() was actually called and consumed the
// body inside the route — if the proxy had eaten the body, json()
// would have thrown before completing and bodyUsed would still be false.
expect(request.bodyUsed).toBe(true);
```

This explanation is **factually inverted**. If the proxy had consumed the body via `request.json()` or `request.text()`, the WHATWG fetch spec is unambiguous: `request.bodyUsed` becomes `true` AT THE MOMENT the underlying ReadableStream lock is acquired (i.e., before any parse step). So the regression signal is:

- **If the proxy consumed:** `request.bodyUsed === true` AFTER the proxy step (line 437-439's `expect(request.bodyUsed).toBe(false)` would fail FIRST — before line 444's route call even runs).
- **If the proxy did NOT consume:** `request.bodyUsed === false` after the proxy, then the route's `parseJsonBody` calls `request.json()` which sets `bodyUsed === true`.

The actual regression signal is the line-439 assertion (`bodyUsed === false` after proxy) and the line-456 assertion (`bodyUsed === true` after route) — together they pin the proxy-doesn't-consume + route-does-consume invariant. The comment at 453-456 misdescribes the failure mode but the actual assertion is correct.

The test STILL works as a regression gate. The comment is just inaccurate about WHY. A future maintainer reading the comment to understand the test's intent could then write a "simpler" version that drops one of the two `bodyUsed` assertions and the regression-detection guarantee falls apart.

**Fix:** Replace the comment at lines 453-455 with the correct explanation:

```typescript
// Final proof that request.json() ran inside the route. The earlier
// assertion at line 439 (`bodyUsed === false` after proxy) is the
// proxy-doesn't-consume gate; THIS assertion is the
// route-DID-consume gate. Together they distinguish:
//   - regression where proxy consumes → bodyUsed === true at line 439 (test fails there)
//   - regression where route doesn't reach parseJsonBody → bodyUsed === false here (test fails)
expect(request.bodyUsed).toBe(true);
```

Risk: zero runtime impact. The test is a valid regression gate; only the documentation explaining HOW it gates is wrong. INFO-level noise that compounds maintainability cost over time.

---

### IN-02: `AUTH_AUDIENCE_OVERRIDE` and `AUTH_ISSUER_OVERRIDE` env hooks lack the production guard that `AUTH_JWKS_OVERRIDE_URL` implicitly gets via `scripts/check-rls.ts`

**Files:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:82-118`, `scripts/check-rls.ts:55-75`
**Issue:** The auth adapter exposes three production-bypass-shaped env hooks for E2E test setup:

- `AUTH_JWKS_OVERRIDE_URL` (line 83) — points the adapter at a different JWKS URL.
- `AUTH_ISSUER_OVERRIDE` (line 99) — overrides the expected `iss` claim.
- `AUTH_AUDIENCE_OVERRIDE` (line 113) — overrides the expected `aud` claim.

The JWKS override has an implicit production guard: `scripts/check-rls.ts:69-75` aborts startup if NODE_ENV=production AND the Supabase `auth` schema is missing, on the theory that a misconfigured production environment would otherwise let the CI-only `auth.uid()` shim load. That guard does not extend to the audience/issuer overrides — they read directly from `process.env` at every `createAuthAdapter()` call, with NO production check.

Concrete attack: if a future Vercel deploy accidentally inherits `AUTH_AUDIENCE_OVERRIDE=authenticated` and `AUTH_ISSUER_OVERRIDE=https://folhario-test.invalid/auth/v1` (the test fixtures' values) from a misconfigured env, the production AuthAdapter would happily verify any JWT minted by the test fixture's private key against the production Supabase JWKS — IF the JWKS happened to also resolve. Because `AUTH_JWKS_OVERRIDE_URL` ALSO has no env-precedence safeguard, all three together would be a complete production auth bypass with the right combination of leaked test artifacts.

The realistic exposure today is small: production env vars are managed in Vercel's dashboard and not user-supplied; the test fixtures' private key (`tests/e2e/.tmp-jwks.json`) is `.gitignore`'d (line 25); the .invalid TLD per RFC 2606 cannot resolve so `AUTH_ISSUER_OVERRIDE` set to test issuer would only match if the same value is set in the test env. Defense in depth says: the override path should refuse to load in production regardless.

**Fix:** Add a NODE_ENV check inside `defaultJwksUrl()` / `defaultIssuer()` / `defaultAudience()` so each override fails LOUDLY in production rather than silently winning:

```typescript
// src/contexts/iam/infrastructure/auth/auth-adapter.ts:82-118
function defaultJwksUrl(): string {
  const override = process.env.AUTH_JWKS_OVERRIDE_URL;
  if (override && override.length > 0) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_JWKS_OVERRIDE_URL is set in NODE_ENV=production. " +
          "This env var is for E2E test setup only — it must not be set " +
          "in production. Refusing to construct an auth adapter that bypasses " +
          "the Supabase JWKS.",
      );
    }
    return override;
  }
  // ... (rest unchanged)
}

// Same pattern in defaultIssuer() and defaultAudience() if you want belt-and-braces
// — strictly speaking, only the JWKS override is the dangerous one because it
// changes the signature-verification surface; iss/aud overrides without a JWKS
// override still fail because the signature won't match. But the principle is the
// same: a production deploy should never carry these env vars.
```

The `scripts/check-rls.ts:69-75` precedent is the right model. INFO-level because the realistic exploit window is narrow, but the asymmetry (one path guards, three paths don't) is a posture inconsistency worth resolving.

---

### IN-03: `package.json` scripts diverge from the `CLAUDE.md` user-rule's "use `npx vitest run` or `npm run test:run`" instruction

**File:** `package.json:16-18`
**Issue:** The user's global instruction in `~/.claude/CLAUDE.md` reads:

> **Never run tests in watch mode**: NEVER use `npm test`, `npx vitest`, or any watch-mode command — they hang forever. Use `npx vitest run` or `npm run test:run`.

The repo `package.json` has no `test` script (good — no watch-mode footgun) but also no `test:run` script (the explicit instruction). It has `test:unit` and `test:integration`, both correctly using `--run`:

```json
"test:unit": "pnpm exec vitest --run --project=unit",
"test:integration": "pnpm exec vitest --run --project=integration",
```

These cover the actual workflows correctly. But the user's `npm run test:run` instruction expects a script of that name to exist as a "run all tests once" entry point. As-shipped, the user (or any tool following the user's documented convention) running `pnpm test:run` gets:

```
ERROR  Command "test:run" not found.
```

— forcing them to discover the project-specific `test:unit` / `test:integration` shape via reading `package.json` rather than following the documented convention.

This is purely a convenience finding (no runtime effect, no security risk), but the convention gap is real: the global rule says "use `npm run test:run`," and it doesn't exist here.

**Fix:** Add an aggregate `test:run` script that delegates to the two project-specific runs, keeping the existing scripts as-is:

```json
// package.json:16-18
"test:unit": "pnpm exec vitest --run --project=unit",
"test:integration": "pnpm exec vitest --run --project=integration",
"test:run": "pnpm test:unit && pnpm test:integration",
```

If the project's `test:run` should NOT include integration (because integration requires a live Postgres and CI runs them in separate steps), pick the unit-only target:

```json
"test:run": "pnpm test:unit",
```

Either choice is fine — what matters is that `pnpm test:run` succeeds with sensible default semantics. Optional: also add a `test` script wired to `test:run` so `pnpm test` works without watch mode (the user's rule explicitly forbids watch-mode `npm test`, but a non-watch `test` would be safe and convention-aligned).

This is the lowest-risk finding — pure scaffolding consistency.

---

_Reviewed: 2026-04-26T22:30:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
