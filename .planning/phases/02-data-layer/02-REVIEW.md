---
phase: 02-data-layer
reviewed: 2026-04-26T23:55:00Z
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
  warning: 0
  info: 0
  total: 0
status: clean
prior_review: 2026-04-26 iter5 — 0 BLOCKER + 2 WR + 3 IN. iter5-fix landed 4 of 5 (WR-01, WR-02, IN-01, IN-03) and explicitly deferred IN-02 with empirically verified rationale that the literal patch would break the E2E suite under `next start` (which forces NODE_ENV=production via `node_modules/next/dist/bin/next:47,66`). This iter6 verifies all 4 applied fixes hold and concurs with the IN-02 deferral; no new findings surface at standard depth.
---

# Phase 02 (Data Layer) — Re-Review (iteration 6)

**Reviewed:** 2026-04-26T23:55:00Z
**Depth:** standard
**Files Reviewed:** 89
**Status:** clean

## Re-Review Context

The iter5 review (`02-REVIEW.iter2.md`) flagged 5 findings (2 WR + 3 IN, 0 BLOCKER). The iter5 `--auto` fix loop landed 4 of 5 (commits `f92249a`, `184eb2e`, `49871d4`, `609433a`) and deferred IN-02 with a documented rationale grounded in the E2E suite's `next start` posture.

This re-review confirms each applied fix holds at standard-depth verification with no regressions, and concurs with the IN-02 deferral. **No new findings surface in this iteration.**

### Verified iter5 fixes (all sound)

- **WR-01 (cross-route response naming → snake_case for `/api/v1/photos/upload`).** `src/app/api/v1/photos/upload/route.ts:91-103` now returns `{ photo_entry: { id, plant_id, photo_url, thumbnail_url, note, created_at } }` matching the consent route's snake_case convention and the PRD §5 `next_cursor` precedent. The new comment block at lines 86-90 cites `consent-route.ts:52` so the convention is now load-bearing in two routes.

  Verified no consumer regression: a wide grep for `fetch.*photos/upload` and `/api/v1/photos/upload` across `src/`, `tests/`, and active worktrees returned zero HTTP-response consumers that pin camelCase keys. The integration test at `tests/integration/photo-upload.integration.test.ts:374-416` reads `result.photoEntry.id` from the application use-case's return shape (still camelCase by design — that's the application layer), and `rows[0]?.plant_id` directly from the postgres-js driver (DB rows are already snake_case at the column level). Neither path constrains the route's HTTP response. The only references outside the route file itself are documentation strings in `src/shared/images/limits.ts:27`, `src/shared/images/server-validate.ts:7`, and the integration test's preamble comment — all just naming the URL, not pinning the response shape.

- **WR-02 (iam/domain/schemas.ts Phase-2-scaffolding annotation).** `src/contexts/iam/domain/schemas.ts:13-27` now carries a 3-paragraph lead block: (1) the IN-03 Phase-2-scaffolding annotation matching the pattern in the 6 other annotated `domain/schemas.ts` files, (2) the original drizzle-zod (D-19, D-40) explanation, (3) the WR-01 redirect to `consent-schemas.ts`. The first paragraph mirrors the "scaffolding only — no consumers in Phase 02 (IN-03)" form used by `billing`, `catalog`, `identification`, `notifications`, `reminders`, and `species-care`. The previous redundant inline comment block at the old lines 31-35 (which re-stated the consent-log redirect) was removed, leaving a single consolidated explanation. Verified: every one of the 7 context `domain/schemas.ts` files now opens with the IN-03 annotation paragraph as its lead.

- **IN-01 (body-passthrough comment factual correction).** `tests/integration/diagnostics-consent.integration.test.ts:453-458` now correctly describes the regression-failure modes: line 439's `bodyUsed === false` is the proxy-doesn't-consume gate, line 459's `bodyUsed === true` is the route-DID-consume gate, and the comment enumerates both regression cases (proxy consumes → fails at line 439; route doesn't reach `parseJsonBody` → fails at line 459). The test logic itself was already correct; only the comment was inverted.

- **IN-03 (`test:run` aggregate script).** `package.json:18` now contains `"test:run": "pnpm test:unit && pnpm test:integration"` between the existing `test:integration` and `test:e2e` entries. The user's `~/.claude/CLAUDE.md` rule "use `npx vitest run` or `npm run test:run`" now resolves to a real script. JSON parses cleanly. The chain skips E2E intentionally — E2E requires a `pnpm start` webServer, a JWKS HTTP endpoint, and a seeded test user, all of which the playwright config wires; gating it on E2E would make `pnpm test:run` non-portable.

### Concurs with iter5-fix IN-02 deferral

The iter5-fix report's IN-02 skip rationale was empirically verified during this re-review: `node_modules/next/dist/bin/next:47` sets `defaultEnv = 'production'` for the `start` command, and line 66 sets `process.env.NODE_ENV = process.env.NODE_ENV || defaultEnv`. The Playwright webServer at `playwright.config.ts:43-54` runs `pnpm start` with all three `AUTH_*_OVERRIDE` env vars set, so any inline NODE_ENV-based guard in `defaultJwksUrl()` / `defaultIssuer()` / `defaultAudience()` would throw at every E2E test boot before a single spec runs. The recommended architectural follow-up (option 3: extend `scripts/check-rls.ts` to refuse production deploys with any of the three override vars set) lives at the deploy-gate level rather than the route construction level and is appropriately scoped to a separate change.

The asymmetry the original IN-02 finding flagged (one of three override paths benefits from a production guard, two do not) remains in the codebase as INFO-level posture noise. Re-flagging the same finding without refining the proposed fix to match the documented deferral path would perpetuate the loop without surfacing new evidence; this re-review accepts the deferral and notes the follow-up is tracked in `02-REVIEW-FIX.md:99` ("Recommended next step").

---

## Summary

The phase ships a careful data layer. This re-review found **zero findings** at standard depth. All four iter5 applied fixes are sound and the deferred IN-02 rationale is empirically supported by the Next CLI's `start`-command NODE_ENV defaulting behavior.

Verification spot-checks performed during this pass:

- **Supavisor compatibility (D-14/D-15):** `src/shared/db/client.ts:38-40` keeps `prepare: false` non-negotiable; the runtime `db` is built from `getSql()` against `DATABASE_POOL_URL`. `src/shared/db/migration-client.ts:17-22` reads `DATABASE_URL` (direct, non-pooled) and never falls back to the pooled URL. The boundary holds.
- **RLS coverage:** `drizzle/migrations/0001_phase_02_rls_policies.sql:48-68` enables RLS on all 21 tables; 7 reference tables get authenticated SELECT policies (species, care_guides, identification_limits, provider_budgets, policy_versions, partner_stores) plus the internal-only `provider_usage_counters` (RLS enabled, no policy → authenticated callers see zero rows by design); 11 user-owned tables get FOR ALL owner policies via `auth.uid() = user_id` (users, consent_logs, data_export_requests, data_deletion_requests, offline_sync_failures, idempotency_keys, plants, identifications, subscriptions, push_subscriptions); 4 use parent/grandparent ownership (photo_entries via plants, reminders via plants, reminder_logs via reminders→plants, billing_events via subscriptions). All 21 tables accounted for.
- **Drizzle confinement (D-17):** `tests/unit/no-drizzle-in-routes.test.ts:142-150` is the standing grep guard. `src/app/api/v1/photos/upload/route.ts:1-3` and `src/app/api/v1/diagnostics/consent/route.ts:1-4` import only via `@shared/config/errors`, `@shared/api/auth`, and `@contexts/*` API/application boundaries — no `drizzle-orm`, no `@shared/db/client`, no `@shared/db/schema-registry`, no per-context schema modules.
- **Image pipeline:** `src/shared/images/client-compress.ts:30-36` strips EXIF (`preserveExif: false`); `src/shared/images/server-validate.ts:45-66` re-rejects GPS via `exifr.gps()` defense-in-depth; `src/shared/images/limits.ts:28,35` exports the single source of truth for `MAX_UPLOAD_BYTES = 1_048_576` (server, MiB) and `CLIENT_COMPRESSION_TARGET_MB = 1` (client, MB) with the boundary invariant `1_000_000 < 1_048_576` documented and load-bearing.
- **Auth adapter:** `src/contexts/iam/infrastructure/auth/auth-adapter.ts:155-159` pins audience, issuer, and algorithms on `jwtVerify`; the WR-01 (iter2/iter3 era) hardening prevents `alg=none` and HMAC-vs-RSA-key confusion. Override hooks at lines 82-118 read from `process.env` directly without a production guard (the IN-02 deferral); the recommended upstream fix in `scripts/check-rls.ts` is the next step but not blocking here.
- **Idempotency:** `src/shared/api/idempotency.ts:115-194` runs the entire INSERT-on-conflict / SELECT-FOR-UPDATE / UPDATE pipeline inside `withUnitOfWork(userId, ...)` so the user's RLS GUC and authenticated role apply uniformly to the idempotency_keys writes AND the handler's writes; the WR-06 coupling is documented at lines 41-55 and mirrored on the policy at `0001_phase_02_rls_policies.sql:182-202`.
- **UoW + RLS GUC:** `src/shared/db/unit-of-work.ts:64-78` opens `db.transaction(...)`, runs `set local role authenticated`, binds `request.jwt.claim.sub` via `set_config('...', $userId, true)`, and the `is_local=true` (third arg) scopes the GUC to the transaction so commit/rollback clear it.
- **Cursor pagination:** `src/shared/api/cursor.ts:48-85` encodes via `Buffer.toString('base64url')` and the decode path returns a discriminated union with `validation_failed` for any malformed input (bad base64, bad JSON, schema mismatch, off-spec datetime); never throws.
- **Closed error registry (PRD §5):** routes use only `errorResponse(ErrorCode.*)` from `@shared/config/errors`. No ad-hoc string codes appear in any route or use-case file in scope.
- **Test integrity (T-02-40 / T-02-41):** `tests/e2e/global-setup.ts:112-183` throws on JWKS bind failure, throws on self-probe non-200, throws on empty keys array, and refuses to seed against cloud Supabase (line 168). No silent-skip path.
- **WR-01 fix consumer check:** verified above. No consumer pins camelCase from `/api/v1/photos/upload`.
- **WR-02 fix annotation pattern check:** verified above. The IAM lead-block opens with the same IN-03 annotation form as the other 6 files.

All previously-listed iter4 + iter5 fixes hold up to standard-depth verification.

---

_Reviewed: 2026-04-26T23:55:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
