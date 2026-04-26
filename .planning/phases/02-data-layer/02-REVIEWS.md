---
phase: 2
reviewers: [claude, gemini]
reviewed_at: 2026-04-25T19:58:52Z
plans_reviewed:
  - 02-01-PLAN.md
  - 02-02-PLAN.md
  - 02-03-PLAN.md
  - 02-04-PLAN.md
  - 02-05-PLAN.md
  - 02-06-PLAN.md
  - 02-07-PLAN.md
  - 02-08-PLAN.md
  - 02-09-PLAN.md
  - 02-10-PLAN.md
caveats:
  - Reviews were supplied manually after the external CLI invocations failed for missing Gemini credentials and Claude login state.
  - Gemini source was gemini-review.md at the repo root; Claude source was .planning/phases/02-data-layer/claude-review.md.
---

# Cross-AI Plan Review - Phase 2

## Claude Review

# Phase 2 Cross-AI Plan Review: Data Layer & Bounded Contexts

## Summary

This is a strong, dependency-ordered plan set that converts the Phase 2 success criteria into ten executable plans with tight RED/GREEN coverage where TDD applies and integration verification everywhere else. The strongest moves are: per-context schema ownership behind a migration-only registry guarded by both ESLint and a Vitest grep test (D-17); a deliberate split between pooled runtime client (`DATABASE_POOL_URL`, `prepare:false`) and a separate migration client; a closed `legal_basis` PG enum vs. operational varchar+CHECK; and an explicit, documented decision to keep RLS as defense in depth while requiring repositories to scope by `userId`. The most material risk is the conditional `auth.uid()` shim in Plan 03 - it lets migrations apply against a plain Postgres CI container, but if it ever runs in an environment where Supabase's real `auth.uid()` is missing at runtime the policies silently degrade. Several other concerns are scope-inflation around CI-vs-Supabase parity and a few thin verification gates that pass trivially.

## Strengths

- **Goal-backward task design.** Every one of Phase 2's five success criteria maps to specific tasks across plans 02-10, and Plan 10 reconciles requirements only after full lint/typecheck/unit/`db:setup`/integration/build/E2E pass.
- **Layered guardrails for "no Drizzle in route handlers"** (D-17): ESLint `no-restricted-imports` on `src/app/api/**/route.ts` plus a Vitest grep test (`tests/unit/no-drizzle-in-routes.test.ts`) - belt-and-braces against silent drift.
- **Migration-only registry is comment-warned and unit-test-guarded** (Plan 02 Task 3) and the registry import scan covers `src/app`, `src/contexts/*/api`, and `src/contexts/*/application`.
- **Idempotency design is race-safe**: unique `(user_id, key)` constraint, transactional insert/lock, `request_hash` mismatch returns `conflict`, 7-day `expires_at` - Plan 06 Task 3 explicitly forbids SELECT-then-INSERT and tests assert handler-call count of 1.
- **GPS rejection is layered**: client `preserveExif: false`, server `exifr.gps()` before any storage write, integration test fixture asserts rejection ordering (Plan 08).
- **JWT verification is cryptographic, not decode-only**: `jose.createRemoteJWKSet` + `jwtVerify` against Supabase JWKS, with a documented `unauthenticated` failure when JWKS is empty (Plan 07 T-02-19).
- **Proxy split is correct**: Proxy does only fast missing-bearer rejection on `/api/v1/*`; route helpers re-verify cryptographically. Aligns with Next 16 guidance that Proxy must not own authorization.
- **Storage paths are deletion-friendly**: `{user_id}/{aggregate_id}/{file_id}.{ext}` enables LGPD prefix deletion (D-26), private buckets, signed-URL helpers, service-role key never reaches browser.
- **Seed data is idempotent SQL** (`ON CONFLICT`) for legal basis, policy versions, identification limits, and provider budgets - fresh-DB-ready for Phase 6 cost controls without extra setup.
- **The `_diagnostics` to `diagnostics` correction** is captured as a first-class decision (D-39) with an acceptance criterion that no `_diagnostics` directory exists and an E2E assertion that the path is reachable over real HTTP.
- **Integration tests use real Postgres 17** (matching Phase 1) and the cloud-Supabase guard pattern is preserved across new tests.

## Concerns

### HIGH

- **Conditional `auth.uid()` shim risks silent RLS bypass at runtime.** Plan 03 Task 2 appends a "minimal `auth.uid()` helper for plain Postgres/CI when Supabase's auth schema is absent." That helper presumably returns null (or whatever `set_config('request.jwt.claim.sub', ...)` was set to via the UoW). Risk: if any non-Supabase environment ever runs production traffic, owner policies of the form `(select auth.uid()) is not null AND (select auth.uid()) = user_id` will deny all reads - or worse, if a future variant returns a constant - silently allow them. Mitigation: a startup probe asserting that `auth.uid()` returns the JWT subject when the request claim is set, and an explicit "this helper exists in CI only" runtime guard that throws if `NODE_ENV === 'production'` and the real Supabase auth schema is absent. Document the failure mode in `02-10-SUMMARY.md`.

- **UnitOfWork RLS context model is unproven against the real Supabase RLS engine.** Plan 05 sets `select set_config('request.jwt.claim.sub', userId, true)` inside the transaction so policies wrapping `auth.uid()` work. This works only if `auth.uid()` is wired to read that GUC. Supabase's real `auth.uid()` reads from a JWT verified by PostgREST/GoTrue, not arbitrary GUCs. There is no integration test that proves a policy denies access when `userId` mismatches the row owner using the real `auth.uid()` against a real Supabase local instance. Without that, "RLS as defense in depth" becomes "RLS that compiles." Add an integration test that connects with a real Supabase-issued JWT (or impersonates `request.jwt.claims` the way Supabase actually does) and verifies a row from another user is invisible.

- **Plan 03 Task 2 generates the migration and appends custom SQL in the same task.** This is a one-shot moment with no test gate between "drizzle-kit emitted SQL" and "we appended raw SQL to that file." If the agent appends to the wrong file, edits a stale migration, or the generated filename changes, the failure surfaces only at `pnpm db:migrate`. Suggest splitting into Task 2a (generate, snapshot the filename) and Task 2b (append custom SQL with file-existence assertions and an idempotent `IF NOT EXISTS` check). Also: the acceptance criteria for Task 2 say "A file exists under `drizzle/migrations` whose name or SQL contains `phase_02_initial_schema`" - `drizzle-kit generate --name X` typically encodes the name in the filename, so `or SQL` is a fallback that hides drift.

### MEDIUM

- **`tests/unit/db-client.test.ts` "fails if `src/shared/db/client.ts` contains `DATABASE_URL`" is brittle.** A file may legitimately contain the substring `DATABASE_URL` inside a comment, error message, or as part of `DATABASE_POOL_URL` substring matching. Recommend asserting the parsed import / `process.env.X` reference, or grep for `process.env.DATABASE_URL\b` with a word boundary. The same brittleness applies to several other "contains" acceptance criteria across plans.
- **No-Drizzle-in-routes guard scans imports textually.** It will miss dynamic `await import('drizzle-orm')` and re-exports through intermediate modules. Consider extending the test to traverse the actual transitive import graph for files under `src/app/api/**/route.ts`, or add an ESLint rule that bans `drizzle-orm` from being reachable via the transitive boundary.
- **Plan 04 storage bucket integration test parses `supabase/config.toml` as text instead of asking Supabase Storage.** The test will pass even if Supabase failed to actually create the buckets locally. At minimum, Plan 08 Task 2 should verify the three bucket names exist and reject unknown buckets, not skip silently.
- **Idempotency `request_hash` is optional in Plan 03 schema but Plan 06 expects `conflict` on hash mismatch.** Lock the contract: either `request_hash NOT NULL` from day one and refuse writes that do not pass one, or treat null-hash rows as "match-any" with an explicit comment.
- **Plan 06 idempotency tests do not assert the failure-then-replay path.** If the handler throws, the transactional insert should roll back and the next caller should re-execute. Make that behavior explicit.
- **Plan 07 includes `/api/v1/diagnostics/ping` in a public-endpoint allowlist inside Proxy** but the allowlist mechanism is not specified. Add a Playwright assertion that `/api/v1/diagnostics/ping` returns 200 without a bearer alongside the 401 assertion for `/diagnostics/consent`.
- **Plan 08 says client compression uses `maxSizeMB: 1` while the upload route rejects files over 1 MiB.** Reconcile MB vs. MiB across helpers, route, and bucket caps, and assert the boundary with a fixture.
- **Plan 08 `sharp` is required at install time** but no test proves the native binary loads in the serverless target. Consider an integration test that calls `sharp().metadata()` once.
- **Plan 09's E2E test "obtains or constructs a valid test JWT using the same test helper pattern."** If the helper signs with a local key whose JWKS is missing, the valid-token subtest is always skipped. Stand up a tiny test JWKS endpoint as part of the test suite, publish a test key, and configure the AuthAdapter factory to point at it during E2E.
- **Plan 10 marks INFRA-19 done** but Phase 2 does not exercise the client-side compression path in a browser. Either narrow `02-10-SUMMARY.md` to "server pipeline foundations" or add a Playwright file-input upload fixture.
- **`set_config('request.jwt.claim.sub', userId, true)` requires `userId` to be a UUID string.** Add a Zod-style guard at the `withUnitOfWork(userId, fn)` boundary.

### LOW

- **Plan 03 Task 4 puts seven `domain/events.ts` files into the schema migration plan.** They are independent of the migration and could ship in their own micro-plan or be deferred to Phase 4 alongside Inngest wiring.
- **Acceptance criteria like `tests/integration/seed-data.integration.test.ts contains 'trial'` and `'daily_cap'` are thin.** The actual `pnpm db:check-seeds` already does the real work; the contains checks add noise without value.
- **`notification_time_local` default `09:00` in the auth-trigger insert is fine, but the trigger hardcodes `America/Sao_Paulo`.** Add a one-line comment in the trigger SQL acknowledging the trade-off.
- **Plan 04 declares a Supabase `plant-photos` bucket with `file_size_limit = "5MiB"`** even though the upload pipeline rejects >1 MiB at the boundary. Comment the defense-in-depth choice.
- **Plan 06 cursor schema uses `z.string().datetime()`.** PRD constraint is "ISO-8601 UTC with `Z`." Use `.datetime({ offset: false })` or a custom refinement.
- **Plan 09's "missing current policy version returns `validation_failed` or a typed domain error."** Pick one. Closed error registry says `validation_failed`.
- **Plan 02 IAM schema lists `users.partner_code` and `partner_stores.code unique` without an FK.** Probably intentional, but worth a one-line note in `02-02-SUMMARY.md`.
- **Plan 10 has no explicit rollback / what-if-CI-fails step.** Not blocking, but worth considering.

## Suggestions

1. **Add a real-Supabase RLS policy test** in Plan 05 or as a Plan 05.5: connect with a Supabase-issued JWT for user A, attempt to read user B's plant row, assert zero rows returned.
2. **Split Plan 03 Task 2 into "generate" and "append"** with an intermediate filename-snapshot artifact.
3. **Run a JWKS-published test endpoint as part of E2E global setup** (Plan 09 Task 3) so the valid-token subtest cannot silently skip on every CI run.
4. **Tighten "contains X" acceptance criteria** to behavioral assertions (`pnpm db:check-seeds` exits 0 and prints the seeded row count) where a grep is uninformative.
5. **Add a transitive-import scan** to the no-Drizzle-in-routes guard, or accept the textual scan as a smoke and add a Plan 12 follow-up.
6. **Reconcile MB vs. MiB** (Plan 08) and pick one unit across helpers, route, and bucket caps.
7. **Add a runtime probe** in `scripts/check-rls.ts` (Plan 03) that asserts the `auth.uid()` helper is the real Supabase one in any non-CI environment, throwing loudly otherwise.
8. **Add an `expires_at` cleanup story** for `idempotency_keys` (a Phase 4+ Inngest cron note in `02-10-SUMMARY.md`).
9. **Document the auth.users to public.users trigger's "first row only" behavior** (Plan 03 Task 2) so Phase 4 signup does not accidentally re-insert and conflict.
10. **Specify which test-JWT helper Plan 09 Task 3 reuses.**

## Risk Assessment

**MEDIUM.**

The plans are well-scoped, dependency-ordered, and verification-heavy. The execution risk is low because each plan's verification gate is concrete and the artifact list is small. The correctness risk is medium and concentrated in two places: (1) the conditional `auth.uid()` shim plus the `set_config` UoW pattern is unproven against real Supabase RLS semantics, and the only test that would catch a silent bypass is missing; (2) the JWT-verification E2E path can degrade to "always skipped" without anyone noticing, removing the only real-HTTP positive auth signal in the phase. Both are addressable with targeted additions (a real-JWT RLS test, a published test JWKS) that do not change the plan structure. With those two additions, this drops to LOW. Without them, "INFRA-07/08 done" in Plan 10 will overstate what has actually been verified.

---

## Gemini Review

# Phase 2: Data Layer & Bounded Contexts - Plan Review

## 1. Summary

The Phase 2 plans are exceptionally well-structured, methodical, and correctly prioritize architectural integrity over speed. The breakdown into 10 distinct, dependency-ordered plans (Waves 1-7) properly separates tooling/bootstrap, schema generation, operational adapters, application conventions, and finally E2E validation. Adherence to the project context (e.g., preventing Drizzle imports in route handlers, enforcing explicit RLS policies, and establishing the Unit-of-Work pattern) is tightly integrated via custom linting rules and test guards.

## 2. Strengths

- **Strict Boundary Enforcement:** The plans introduce both `eslint.config.mjs` rules and Vitest guards to strictly ensure Drizzle ORM does not leak into route handlers.
- **Idempotency & Pagination:** Defining the API conventions (`cursor`, `idempotency`, Zod validation) via TDD before creating the route handlers ensures these utilities are tested in isolation.
- **RLS & Connection Pooling Awareness:** Utilizing `set_config` inside the `withUnitOfWork` transaction boundary correctly maps application `userId` to the PostgreSQL transaction session, ensuring RLS rules are respected despite bypassing the traditional Supabase PostgREST API.
- **Clear Storage Boundaries:** The image pipeline correctly splits responsibilities - client-side compression/EXIF stripping and server-side GPS extraction/rejection - maintaining strong privacy guardrails.
- **Automated CI Validation:** The inclusion of plan `02-10-PLAN.md` strictly ensures that database migrations and seeds are executed prior to CI integration tests, preventing false greens.

## 3. Concerns

- **Custom SQL in Generated Migrations (MEDIUM Severity):**
  Plan `02-03-PLAN.md` states: "Append custom SQL to the generated migration". While Drizzle supports custom migrations, manually appending complex RLS and trigger SQL directly to a `drizzle-kit generate` output file is brittle. If a schema change requires regenerating this file, the custom SQL will be lost.
- **Unit of Work State Leakage (MEDIUM Severity):**
  Plan `02-05-PLAN.md` states: "call `select set_config('request.jwt.claim.sub', userId, true)` before invoking fn". The third parameter `true` sets `is_local = true`, meaning the config only lives for the duration of the current transaction. This is correct and crucial; however, if a developer mistakenly executes queries outside the transaction block using the same connection, they might hit permission errors or, worse, unintended state leakage.
- **Synchronous Image Processing (LOW/MEDIUM Severity):**
  Plan `02-08-PLAN.md` generates thumbnails synchronously using `sharp` in the route handler. While specifying `runtime = "nodejs"` fixes the Vercel edge deployment issues with `sharp`, synchronous image manipulation blocks the Node.js event loop. Under load, this could degrade the API's performance.
- **Supabase Local Configuration Refresh (LOW Severity):**
  Plan `02-04-PLAN.md` correctly configures private buckets in `supabase/config.toml`. However, changes to `config.toml` typically require `supabase restart` locally. The automated test scripts do not explicitly handle the required restart if a developer is actively running the local Supabase stack.

## 4. Suggestions

1. **Isolate Custom Migration SQL:** Instead of appending custom SQL to `drizzle-kit` generated files (Plan `02-03-PLAN.md`), create a dedicated empty migration file specifically for RLS, indexes, and triggers using `drizzle-kit generate --custom`. This ensures `generate` commands for standard table schema updates do not overwrite handwritten RLS rules.
2. **UoW Transaction Guard:** Ensure the Unit-of-Work helper in `02-05-PLAN.md` asserts that it is operating strictly within a PostgreSQL transaction (`BEGIN ... COMMIT`) so that `set_config` remains locally scoped to the transaction.
3. **Document Supabase Restart:** Add explicit instructions in `02-04-PLAN.md` that developers must run `supabase stop && supabase start` locally for the storage bucket declarations to take effect, or add an explicit check to the seed/setup scripts.
4. **Proxy Auth Logging:** In `02-07-PLAN.md`, ensure that `src/proxy.ts` is careful not to consume or alter the request body when checking for authentication, to ensure Next.js route handlers can still parse the stream.

## 5. Risk Assessment

**Overall Risk: LOW**

**Justification:**
The structural integrity of this phase is highly resilient. The architecture heavily mitigates risk through defense-in-depth (RLS paired with explicit repository-level scoping), and robust automated testing requirements (schema guards, dependency guards, E2E). The identified concerns represent minor operational friction (like managing custom SQL inside generated migrations) rather than fundamental security or architectural flaws. The plan reliably achieves the Phase 2 goals.

---

## Consensus Summary

Two reviewers: **Claude CLI review output supplied manually** and **Gemini CLI review output supplied manually**. Treat overlap as the highest-priority signal for `/gsd-plan-phase 2 --reviews`.

### Agreed Strengths

- **Dependency-ordered 10-plan structure:** both reviewers found the phase breakdown coherent, scoped, and sequenced around real dependencies.
- **Boundary enforcement:** both called out the Drizzle route-handler guardrails and context boundaries as strong design choices.
- **RLS/UoW awareness:** both reviewers recognized the transaction-scoped `set_config` pattern as central to the plan, with Claude asking for stronger proof against real Supabase semantics.
- **Storage and privacy separation:** both reviewers approved the split between client compression/EXIF stripping and server GPS rejection.
- **Verification posture:** both reviewers considered the migration, seed, unit, integration, CI, and E2E gates useful; the main disagreement is how much they prove.

### Agreed Concerns

1. **Custom SQL around generated migrations needs a safer contract.** Claude rated this HIGH because generation and appending are in one brittle task; Gemini rated it MEDIUM and suggested a dedicated custom migration. Action: split generation from handwritten SQL or use an explicit custom migration path with filename assertions.
2. **The UoW/RLS transaction model needs tighter proof and guardrails.** Gemini focused on state leakage and transaction discipline; Claude focused on the conditional `auth.uid()` shim and missing real-Supabase RLS proof. Action: add transaction-boundary assertions, `userId` validation, and a real-Supabase/real-JWT RLS denial test or equivalent documented harness.
3. **Several verification gates risk false confidence.** Claude identified specific thin or skippable gates (JWKS E2E, storage buckets, textual greps, client compression); Gemini identified operational gaps around Supabase config refresh. Action: replace brittle contains checks and silent skips with behavioral tests or explicit documented exceptions.

### Divergent Views

- **Overall risk:** Gemini rated the plan LOW risk; Claude rated it MEDIUM. Use MEDIUM as the planning input because Claude identified security/correctness verification gaps that affect claim accuracy, not just execution friction.
- **RLS severity:** Gemini accepts the `set_config(..., true)` pattern as correct if transaction discipline is maintained. Claude argues the pattern is not yet proven against Supabase's real `auth.uid()` behavior. The replan should preserve the UoW design but add the missing proof.
- **Image processing:** Gemini flagged synchronous `sharp` thumbnail generation as a load risk; Claude emphasized binary-load verification and MB/MiB boundary mismatches.
- **Proxy:** Gemini flagged body non-consumption/logging discipline; Claude flagged public allowlist behavior and bearer/no-bearer assertions.

## Prioritized Action List

Ordered by severity and ease of incorporation into `/gsd-plan-phase 2 --reviews`:

### Must resolve before execution

1. **HIGH - Real RLS proof:** Add a Plan 05 or Plan 05.5 test proving owner policies deny user B from reading user A data through a Supabase-faithful JWT/claims path. Also add a production/runtime guard so the CI-only `auth.uid()` shim cannot silently stand in for Supabase auth in non-CI environments.
2. **HIGH - JWKS-positive E2E path cannot silently skip:** Plan 09 should define a concrete test JWKS endpoint/key setup and fail loudly if the positive-token E2E path cannot run.
3. **HIGH - Custom migration SQL contract:** Split Plan 03 Task 2 into generated-schema and handwritten-SQL steps, or use a dedicated custom migration for RLS/triggers/indexes with file-existence and idempotency assertions.

### Should resolve

4. **MEDIUM - UoW guardrails:** Validate `userId` as UUID at `withUnitOfWork` entry, assert transaction-local config discipline, and document/verify queries must run inside the transaction callback.
5. **MEDIUM - Idempotency contract:** Decide whether `request_hash` is required or nullable; add tests for mismatch and handler-throws-then-retry behavior.
6. **MEDIUM - Storage verification:** Ensure bucket existence is verified behaviorally by an adapter/setup test, and document or automate `supabase restart` when `config.toml` bucket definitions change.
7. **MEDIUM - Proxy behavior:** Add HTTP assertions that `/api/v1/diagnostics/ping` is public without bearer, protected endpoints return 401 without bearer, and proxy auth checks do not consume request bodies.
8. **MEDIUM - Upload/image boundary:** Reconcile MB vs. MiB, add a `sharp` native-load smoke, and either test client compression in browser or narrow Plan 10's INFRA-19 completion claim.
9. **MEDIUM - Brittle grep guards:** Replace substring checks like `contains DATABASE_URL` and seed-test `contains trial` with AST/regex/behavioral assertions where possible.

### Nice to have

10. **LOW - Domain events scope:** Move or explicitly justify `domain/events.ts` files in the schema migration plan.
11. **LOW - Trigger defaults:** Comment the `America/Sao_Paulo` default in the auth trigger as a first-row trade-off.
12. **LOW - Bucket cap rationale:** Comment why the `plant-photos` bucket cap is 5 MiB while route-level uploads are lower.
13. **LOW - Cursor datetime:** Enforce UTC `Z` timestamps for cursor parsing, not arbitrary offsets.
14. **LOW - Error-code choice:** Make missing current policy version return `validation_failed`, not "validation_failed or typed domain error."
15. **LOW - Cleanup story:** Add a Phase 4+ Inngest cleanup note for expired idempotency keys.

---

To incorporate this feedback into planning:

```bash
/gsd-plan-phase 2 --reviews
```
