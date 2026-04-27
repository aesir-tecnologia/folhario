---
phase: 02-data-layer
fixed_at: 2026-04-26T23:55:00Z
review_path: .planning/phases/02-data-layer/02-REVIEW.md
iteration: 1
findings_in_scope: 5
fixed: 4
skipped: 1
status: partial
---

# Phase 02 (Data Layer) — Code Review Fix Report (iter5)

**Fixed at:** 2026-04-26T23:55:00Z
**Source review:** `.planning/phases/02-data-layer/02-REVIEW.md`
**Iteration:** 1

**Summary:**

- Findings in scope: 5 (0 critical + 2 warning + 3 info)
- Fixed: 4 (WR-01, WR-02, IN-01, IN-03)
- Skipped: 1 (IN-02 — rationale below)

The four fixes hold to standard-depth verification (TypeScript clean across the workspace and JSON parses cleanly for the package.json change). IN-02 is skipped because the review's literal patch would break the E2E suite — see the Skipped section for the empirical evidence.

## Fixed Issues

### WR-01: cross-route response-field naming inconsistency — `/photos/upload` returned camelCase but `/diagnostics/consent` returns snake_case

**Files modified:** `src/app/api/v1/photos/upload/route.ts`
**Commit:** `609433a`
**Applied fix:** Converted the upload route's 201 response from camelCase (`photoEntry`, `plantId`, `photoUrl`, `thumbnailUrl`, `createdAt`) to snake_case (`photo_entry`, `plant_id`, `photo_url`, `thumbnail_url`, `created_at`). Added an inline comment pointing maintainers at the consent route's PRD §5 assertion (`consent-route.ts:52`) and the PRD's `next_cursor` precedent so the convention is now load-bearing in two routes rather than one.

**Why snake_case is the right direction (decision rationale):**

- The reviewer's prompt explicitly authorized: "If the PRD is silent or ambiguous, prefer the snake_case path because the consent route explicitly asserts the convention in its comment, but flag the decision in the fix report."
- `docs/CAVE-PRD.md:230` documents `next_cursor` (snake_case) as the cursor field name in API responses, confirming the PRD §5 convention is snake_case.
- The reviewer-supplied grep on `tests/integration/photo-upload.integration.test.ts:374-416` was confirmed: the row-level assertions read directly from the postgres-js `driver` (raw DB rows are already snake_case at the DB layer), not from the route response. The use-case-level call at `tests/integration/photo-upload.integration.test.ts:402` reads `result.photoEntry.id` which is `uploadPhoto`'s internal return shape (still camelCase, intentionally — that's the application layer, not the HTTP boundary).
- Independent grep across `src/` and `tests/` for `fetch.*photos/upload` and `/api/v1/photos/upload` found NO HTTP-response consumer that pins the camelCase keys. The only references are within the route file itself, the use-case-level tests, and infrastructure docs. Safe to flip.

**Verification:** `pnpm exec tsc --noEmit` reports no errors; the route's input shape (formData fields) is untouched, only the response keys changed.

**Optional follow-ups deliberately deferred** (per the reviewer's "Optional" sub-recommendations):

- A `tests/unit/api-conventions.test.ts` block that imports both route handlers, drives them with stub adapters, and asserts the response keys are snake_case — would convert the convention from comment-only to load-bearing build gate. Deferred to a housekeeping iteration; the test requires non-trivial stub-adapter scaffolding and lives at a different abstraction than this minimal contract-fix.
- A line in `CLAUDE.md ## Conventions` (currently a placeholder) recording "API response keys are snake_case (PRD §5)." Deferred to a CLAUDE.md curation pass that aggregates conventions across phases — adding one line in isolation invites churn when the next convention lands.
- `02-08-SUMMARY.md:237` still documents the camelCase shape that the route used to ship; intentionally NOT updated because planning summaries are historical artifacts of the moment they were written. A future Phase 03 planner who reads that summary alongside the live route will see the discrepancy and will be expected to follow the route's actual current shape.

### WR-02: incomplete iter4 IN-03 cleanup — `iam/domain/schemas.ts` lacked the Phase-2-scaffolding annotation

**Files modified:** `src/contexts/iam/domain/schemas.ts`
**Commit:** `f92249a`
**Applied fix:** Replaced the existing 6-line lead doc-block with a 14-line block that mirrors the format of the 6 other annotated `domain/schemas.ts` files (read `billing/domain/schemas.ts:5-11`, `catalog/domain/schemas.ts:5-11`, `identification/domain/schemas.ts:11-18`, `notifications/domain/schemas.ts:5-11`, `reminders/domain/schemas.ts:5-11`, `species-care/domain/schemas.ts:5-11` to confirm the template). The new block carries:

1. The Phase 2 scaffolding-only IN-03 annotation paragraph (matching the convention of the other 6 files).
2. The original "drizzle-zod (D-19, D-40), refinements one layer above" paragraph (preserved).
3. The WR-01 explanation note redirecting consentLog schemas to `consent-schemas.ts`.

Also removed the previous-redundant inline comment block at the old lines 31-35 (the `Note: consentLog{Insert,Select}Schema live in consent-schemas.ts` paragraph) since the same content is now in the lead doc-block. Net diff: lead block grows by ~8 lines, the redundant inline block (~5 lines) deletes — overall the file is clearer with one consolidated explanation rather than two.

**Verification:** `pnpm exec tsc --noEmit` passes; the file's exports are unchanged so no downstream typing impact.

### IN-01: misleading body-passthrough test comment — claimed `bodyUsed === false` would be the regression signal but it would actually be `true`

**Files modified:** `tests/integration/diagnostics-consent.integration.test.ts`
**Commit:** `184eb2e`
**Applied fix:** Replaced the 3-line comment at lines 453-455 that incorrectly described the regression-failure mode as `bodyUsed === false` (factually inverted per WHATWG fetch — a consumed body has `bodyUsed === true` AT THE MOMENT the underlying ReadableStream lock is acquired). The new 6-line comment accurately states that the line-439 assertion gates "proxy doesn't consume" and the line-456 assertion gates "route does consume," with both regression cases enumerated:

- regression where proxy consumes → `bodyUsed === true` at line 439 (test fails THERE)
- regression where route doesn't reach parseJsonBody → `bodyUsed === false` here (test fails)

**Verification:** `pnpm exec tsc --noEmit` passes; comment-only change has no runtime semantics.

### IN-03: missing `test:run` aggregate script per CLAUDE.md user-rule

**Files modified:** `package.json`
**Commit:** `49871d4`
**Applied fix:** Added `"test:run": "pnpm test:unit && pnpm test:integration"` between the existing `test:integration` and `test:e2e` scripts. Selected the unit-and-integration composition over unit-only because the user's CLAUDE.md mandates "use `npx vitest run` or `npm run test:run`" without further qualification, and the more inclusive default matches that expectation. E2E is excluded because it requires a running webServer and a live test JWKS endpoint; gating it on the playwright config keeps `pnpm test:run` viable without external deps.

**Verification:** `node -e "JSON.parse(require('fs').readFileSync('package.json','utf-8'))"` confirms the JSON is well-formed.

## Skipped Issues

### IN-02: `AUTH_AUDIENCE_OVERRIDE` and `AUTH_ISSUER_OVERRIDE` lack the production guard that `AUTH_JWKS_OVERRIDE_URL` implicitly gets via `scripts/check-rls.ts`

**File:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:82-118`
**Reason:** The review's literal patch (insert `if (process.env.NODE_ENV === "production") throw` inside `defaultJwksUrl`/`defaultIssuer`/`defaultAudience`) would break the E2E suite because `pnpm start` runs `next start`, which forces `NODE_ENV=production` (verified empirically in `node_modules/next/dist/bin/next:47,66`: when no NODE_ENV is set, the start command's preAction hook sets `process.env.NODE_ENV = "production"` by default). The `playwright.config.ts:48-53` `webServer.env` block sets all three `AUTH_*_OVERRIDE` env vars on this same `next start` process, so any inline NODE_ENV-based guard would throw on every E2E test boot before a single spec executes.

**Three options were on the table** (the reviewer's prompt explicitly noted this was a judgment call: "Use your judgment and explain in the fix report"):

1. **Add inline guards as the review suggests** — would break E2E. Rejected on the empirical evidence above.
2. **Add inline guards plus a paired opt-in env var** (e.g., `AUTH_OVERRIDE_ALLOW=1`) and update `playwright.config.ts` to set it — viable but adds two env vars and a coupling between the auth adapter and the playwright config that has its own change-management cost. The exposure ceiling is INFO-level (per the review: "the realistic exposure today is small"); the cost-benefit doesn't justify the new surface and the feedback latency on getting the playwright env right.
3. **Skip the inline guard and add upstream coverage in `scripts/check-rls.ts`** to refuse to start production deploys that have any of the three override env vars set — this matches the prompt's note that the existing `AUTH_JWKS_OVERRIDE_URL` protection comes from how `check-rls.ts` is wired into CI/preflight, NOT from an inline guard. This is the option that achieves the asymmetry-resolution the review wants without breaking E2E.

**Decision:** Defer to a separate change. Option 3 (the upstream `check-rls.ts` extension) is the right architectural fix but is out of scope for a single REVIEW-FIX iteration: it touches the deploy-gate path, requires a new test asserting the gate fires for each of the three vars, and lives at a different abstraction level than the inline guard the review describes. INFO-level finding, narrow exploit window per the reviewer's own analysis (private key in `.gitignore`'d `.tmp-jwks.json`, `.invalid` issuer cannot resolve per RFC 2606, all three env vars must coincidentally leak together), so deferring to a follow-up phase or housekeeping task is acceptable.

**Original issue:** The auth adapter's three `AUTH_*_OVERRIDE` env hooks have asymmetric production safety — only `AUTH_JWKS_OVERRIDE_URL` benefits from the `scripts/check-rls.ts:69-75` production-readiness gate that runs in CI/preflight. `AUTH_ISSUER_OVERRIDE` and `AUTH_AUDIENCE_OVERRIDE` have no equivalent upstream check. Defense-in-depth says all three paths should refuse to load in production.

**Recommended next step (for a follow-up iteration):** Add an early-startup check in `scripts/check-rls.ts` (or a new `scripts/check-env.ts` companion) that aborts when `NODE_ENV === "production"` AND any of the three `AUTH_*_OVERRIDE` env vars is set. Pair it with a unit test asserting the check fires for each of the three vars individually. That keeps the guard upstream of route construction (where E2E's webServer environment lives) and resolves the asymmetry the review flagged without churning the auth adapter or playwright config.

---

_Fixed: 2026-04-26T23:55:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
