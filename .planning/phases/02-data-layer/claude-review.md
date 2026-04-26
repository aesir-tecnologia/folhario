# Phase 2 Cross-AI Plan Review: Data Layer & Bounded Contexts

## Summary

This is a strong, dependency-ordered plan set that converts the Phase 2 success criteria into ten executable plans with tight RED/GREEN coverage where TDD applies and integration verification everywhere else. The strongest moves are: per-context schema ownership behind a migration-only registry guarded by both ESLint and a Vitest grep test (D-17); a deliberate split between pooled runtime client (`DATABASE_POOL_URL`, `prepare:false`) and a separate migration client; a closed `legal_basis` PG enum vs. operational varchar+CHECK; and an explicit, documented decision to keep RLS as defense in depth while requiring repositories to scope by `userId`. The most material risk is the conditional `auth.uid()` shim in Plan 03 — it lets migrations apply against a plain Postgres CI container, but if it ever runs in an environment where Supabase's real `auth.uid()` is missing at runtime the policies silently degrade. Several other concerns are scope-inflation around CI-vs-Supabase parity and a few thin verification gates that pass trivially.

## Strengths

- **Goal-backward task design.** Every one of Phase 2's five success criteria maps to specific tasks across plans 02–10, and Plan 10 reconciles requirements only after full lint/typecheck/unit/`db:setup`/integration/build/E2E pass.
- **Layered guardrails for "no Drizzle in route handlers"** (D-17): ESLint `no-restricted-imports` on `src/app/api/**/route.ts` *plus* a Vitest grep test (`tests/unit/no-drizzle-in-routes.test.ts`) — belt-and-braces against silent drift.
- **Migration-only registry is comment-warned and unit-test-guarded** (Plan 02 Task 3) and the registry import scan covers `src/app`, `src/contexts/*/api`, and `src/contexts/*/application`.
- **Idempotency design is race-safe**: unique `(user_id, key)` constraint, transactional insert/lock, `request_hash` mismatch returns `conflict`, 7-day `expires_at` — Plan 06 Task 3 explicitly forbids SELECT-then-INSERT and tests assert handler-call count of 1.
- **GPS rejection is layered**: client `preserveExif: false`, server `exifr.gps()` *before* any storage write, integration test fixture asserts rejection ordering (Plan 08).
- **JWT verification is cryptographic, not decode-only**: `jose.createRemoteJWKSet` + `jwtVerify` against Supabase JWKS, with a documented `unauthenticated` failure when JWKS is empty (Plan 07 T-02-19).
- **Proxy split is correct**: Proxy does only fast missing-bearer rejection on `/api/v1/*`; route helpers re-verify cryptographically. Aligns with Next 16 guidance that Proxy must not own authorization.
- **Storage paths are deletion-friendly**: `{user_id}/{aggregate_id}/{file_id}.{ext}` enables LGPD prefix deletion (D-26), private buckets, signed-URL helpers, service-role key never reaches browser.
- **Seed data is idempotent SQL** (`ON CONFLICT`) for legal basis, policy versions, identification limits, and provider budgets — fresh-DB-ready for Phase 6 cost controls without extra setup.
- **The `_diagnostics` → `diagnostics` correction** is captured as a first-class decision (D-39) with an acceptance criterion that no `_diagnostics` directory exists and an E2E assertion that the path is reachable over real HTTP.
- **Integration tests use real Postgres 17** (matching Phase 1) and the cloud-Supabase guard pattern is preserved across new tests.

## Concerns

### HIGH

- **Conditional `auth.uid()` shim risks silent RLS bypass at runtime.** Plan 03 Task 2 appends a "minimal `auth.uid()` helper for plain Postgres/CI when Supabase's auth schema is absent." That helper presumably returns null (or whatever `set_config('request.jwt.claim.sub', ...)` was set to via the UoW). Risk: if any non-Supabase environment ever runs production traffic, owner policies of the form `(select auth.uid()) is not null AND (select auth.uid()) = user_id` will *deny* all reads — or worse, if a future variant returns a constant — silently allow them. Mitigation: a startup probe asserting that `auth.uid()` returns the JWT subject when the request claim is set, and an explicit "this helper exists in CI only" runtime guard that throws if `NODE_ENV === 'production'` and the real Supabase auth schema is absent. Document the failure mode in `02-10-SUMMARY.md`.

- **UnitOfWork RLS context model is unproven against the real Supabase RLS engine.** Plan 05 sets `select set_config('request.jwt.claim.sub', userId, true)` inside the transaction so policies wrapping `auth.uid()` work. This works *only if* `auth.uid()` is wired to read that GUC. Supabase's real `auth.uid()` reads from a JWT verified by PostgREST/GoTrue, not arbitrary GUCs. There is no integration test that proves a policy denies access when `userId` mismatches the row owner using the real `auth.uid()` against a real Supabase local instance. Without that, "RLS as defense in depth" becomes "RLS that compiles." Add an integration test that connects with a real Supabase-issued JWT (or impersonates `request.jwt.claims` the way Supabase actually does) and verifies a row from another user is invisible.

- **Plan 03 Task 2 generates the migration AND appends custom SQL in the same task.** This is a one-shot moment with no test gate between "drizzle-kit emitted SQL" and "we appended raw SQL to that file." If the agent appends to the wrong file, edits a stale migration, or the generated filename changes, the failure surfaces only at `pnpm db:migrate`. Suggest splitting into Task 2a (generate, snapshot the filename) and Task 2b (append custom SQL with file-existence assertions and an idempotent `IF NOT EXISTS` check). Also: the acceptance criteria for Task 2 say "A file exists under `drizzle/migrations` whose name or SQL contains `phase_02_initial_schema`" — `drizzle-kit generate --name X` typically encodes the name in the filename, so `or SQL` is a fallback that hides drift.

### MEDIUM

- **`tests/unit/db-client.test.ts` "fails if `src/shared/db/client.ts` contains `DATABASE_URL`" is brittle.** A file may legitimately contain the substring `DATABASE_URL` inside a comment, error message, or as part of `DATABASE_POOL_URL` substring matching. Recommend asserting the *parsed* import / `process.env.X` reference, or grep for `process.env.DATABASE_URL\b` with a word boundary. The same brittleness applies to several other "contains" acceptance criteria across plans.

- **No-Drizzle-in-routes guard scans imports textually.** It will miss dynamic `await import('drizzle-orm')` and re-exports through intermediate modules (e.g. a route imports a shared "helper" that imports Drizzle). Consider extending the test to traverse the actual transitive import graph for files under `src/app/api/**/route.ts`, or add an ESLint rule that bans `drizzle-orm` from being reachable via the transitive boundary.

- **Plan 04 storage bucket integration test parses `supabase/config.toml` as text instead of asking Supabase Storage.** The test will pass even if Supabase failed to actually create the buckets locally. The plan justifies this with "do not require Docker/Supabase Studio for this automated test," which is reasonable for fast CI — but then no test in Phase 2 actually proves buckets exist at runtime. At minimum, Plan 08 Task 2 (StorageAdapter integration test) should verify the three bucket names exist and reject unknown buckets, not skip silently.

- **Idempotency `request_hash` is "optional" in Plan 03 schema but Plan 06 expects `conflict` on hash mismatch.** Plan 03: `idempotency_keys.request_hash nullable`. Plan 06 acceptance criteria mention `ErrorCode.Conflict` for "same key with different request hash." If hash is null on the stored row (e.g., older entries), the conflict path collapses to "always replay" or "always allow." Lock the contract: either (a) `request_hash NOT NULL` from day one and refuse writes that don't pass one, or (b) treat null-hash rows as "match-any" with an explicit comment.

- **Plan 06 idempotency tests don't assert the failure-then-replay path.** Specifically: if the handler throws, what does the next call with the same key see? Per the design ("insert pending row, run handler, store JSON response, commit"), a thrown handler rolls back the insert and the next caller sees no row → re-executes. That's correct, but it should be an explicit test, otherwise a future implementer may "fix" the rollback to persist a 500 response and break retry semantics.

- **Plan 07 includes `/api/v1/diagnostics/ping` in a public-endpoint allowlist inside Proxy** but the allowlist mechanism (string set vs. matcher precedence) isn't specified. With Next 16 Proxy, matcher rules and per-request bailouts are easy to get subtly wrong (an `_next` carve-out that catches `_next/static` but not `_next/data`, etc.). Add a Playwright assertion that `/api/v1/diagnostics/ping` returns 200 *without* a bearer (proving the allowlist works) alongside the 401 assertion for `/diagnostics/consent`.

- **Plan 08 says client compression "calls browser-image-compression with `maxSizeMB: 1`"** — but the rejection threshold at the upload route boundary is "files over 1 MiB." 1 MB ≠ 1 MiB (1,000,000 vs. 1,048,576 bytes). `browser-image-compression`'s `maxSizeMB: 1` targets 1,000,000-byte (decimal MB) output, which sometimes overshoots by a few percent due to JPEG quantization. A photo compressed to ~1.04 MB will pass the client and be rejected by the server. Pick one (recommend MiB everywhere with `maxSizeMB: 1` and a server cap of 1.1 MiB or similar buffer) and assert the boundary in tests with a fixture file.

- **Plan 08 `sharp` is required at install time** but no test boots a real route to prove the Node runtime resolves `sharp` on Vercel's build target (linux-x64-gnu binaries can be missing in some environments). Plan 10's `pnpm build` will catch import errors but not native-binary-load failures in the serverless function. Consider an integration test that calls `sharp().metadata()` once.

- **Plan 09's E2E test "obtains or constructs a valid test JWT using the same test helper pattern."** That helper isn't named. If the helper signs with a local key whose JWKS is missing (the JWKS-mismatch problem flagged in Plan 07's threat model), the valid-token subtest is *always* skipped, and Phase 2 ships without a single end-to-end positive auth assertion. Concrete remediation: stand up a tiny test JWKS endpoint as part of the test suite (Playwright global setup), publish a test key, and configure the AuthAdapter factory to point at it during E2E. Skipping should be a documented exception, not a default.

- **Plan 10 marks INFRA-19 done** but Phase 2 does not exercise the *client-side* compression path (it ships the helper, but the only integration test that runs the helper is in Node, not a real browser). The acceptance is true in the "helper exists and tests pass" sense but not in the "we proved an iPhone HEIC photo gets compressed in a service worker" sense. Either narrow the wording in `02-10-SUMMARY.md` to "server pipeline foundations" or add a Playwright test that uploads a real fixture through the file input.

- **`set_config('request.jwt.claim.sub', userId, true)` requires `userId` to be a UUID string.** No validation in `withUnitOfWork(userId, fn)` — a passed-in invalid string would fail the whole transaction with a confusing error. Add a Zod-style guard at the function boundary.

### LOW

- **Plan 03 Task 4 puts seven `domain/events.ts` files into the schema migration plan.** They're independent of the migration and could ship in their own micro-plan or be deferred to Phase 4 alongside Inngest wiring. Including them here doesn't hurt, but it widens the diff that has to land before the migration can be regenerated if anything goes wrong.
- **Acceptance criteria like `tests/integration/seed-data.integration.test.ts contains 'trial'` and `'daily_cap'`** are very thin. A passing grep is not a passing test. The actual `pnpm db:check-seeds` already does the real work; the `contains` checks add noise without value.
- **`.notification_time_local` default `09:00` in the auth-trigger insert (Plan 03)** is fine, but PRD specifies `User.notification_time_local` is `HH:MM` in `User.timezone`, and the trigger hardcodes `America/Sao_Paulo`. For a user signing up from another timezone, this is wrong on row 1 and corrected on first profile save. Worth a one-line comment in the trigger SQL acknowledging the trade-off.
- **Plan 04 declares a Supabase `plant-photos` bucket with `file_size_limit = "5MiB"`** even though the upload pipeline rejects >1 MiB at the boundary. The 5 MiB bucket cap is fine as defense in depth, but the choice should be a deliberate, commented decision; right now it's just a number.
- **Plan 06 cursor schema uses `z.string().datetime()`.** Zod's `.datetime()` accepts ISO 8601 with `Z` *or* `±HH:MM` offsets. PRD constraint is "ISO-8601 UTC with `Z`." Use `.datetime({ offset: false })` — or a custom refinement — to lock the contract.
- **Plan 09's "missing current policy version returns `validation_failed` or a typed domain error."** "Or" is a tell — pick one. Closed error registry says `validation_failed`.
- **Plan 02 IAM schema lists `users` columns including `partner_code`** but the partner_stores table has `code unique`. There's no FK enforcing `users.partner_code` references `partner_stores.code`. Probably intentional (partner_code can be a free-form code at signup, validated at trial-attribution time), but worth a one-line note in `02-02-SUMMARY.md`.
- **Plan 10 has no explicit "rollback / what-if-CI-fails" step.** If `pnpm db:setup` fails on the GitHub Actions postgres:17-alpine container in a way that doesn't reproduce locally, there's no fast iteration plan beyond "push and hope." Not blocking, but a 30-min-ahead consideration.

## Suggestions

1. **Add a real-Supabase RLS policy test** in Plan 05 or as a Plan 05.5: connect with a Supabase-issued JWT for user A, attempt to read user B's plant row, assert zero rows returned. This is the single highest-value test in the phase and the current plan set doesn't include it.
2. **Split Plan 03 Task 2 into "generate" and "append"** with an intermediate filename-snapshot artifact.
3. **Run a JWKS-published test endpoint as part of E2E global setup** (Plan 09 Task 3) so the valid-token subtest cannot silently skip on every CI run.
4. **Tighten "contains X" acceptance criteria** to behavioral assertions (`pnpm db:check-seeds` exits 0 *and* prints the seeded row count) where a grep is uninformative.
5. **Add a transitive-import scan** to the no-Drizzle-in-routes guard, or accept the textual scan as a smoke and add a Plan 12 follow-up.
6. **Reconcile MB vs. MiB** (Plan 08) and pick one unit across helpers, route, and bucket caps.
7. **Add a runtime probe** in `scripts/check-rls.ts` (Plan 03) that asserts the `auth.uid()` helper is the real Supabase one in any non-CI environment, throwing loudly otherwise.
8. **Add an `expires_at` cleanup story** for `idempotency_keys` (a Phase 4+ Inngest cron note in `02-10-SUMMARY.md`). Otherwise the table grows forever until the operator notices.
9. **Document the auth.users → public.users trigger's "first row only" behavior** (Plan 03 Task 2) so Phase 4 signup doesn't accidentally re-insert and conflict.
10. **Specify which test-JWT helper Plan 09 Task 3 reuses.** If `auth-jwt.integration.test.ts` (Plan 07) constructs its own key without publishing JWKS, that helper isn't enough.

## Risk Assessment

**MEDIUM.**

The plans are well-scoped, dependency-ordered, and verification-heavy. The execution risk is low because each plan's verification gate is concrete and the artifact list is small. The *correctness* risk is medium and concentrated in two places: (1) the conditional `auth.uid()` shim plus the `set_config` UoW pattern is unproven against real Supabase RLS semantics, and the only test that would catch a silent bypass is missing; (2) the JWT-verification E2E path can degrade to "always skipped" without anyone noticing, removing the only real-HTTP positive auth signal in the phase. Both are addressable with targeted additions (a real-JWT RLS test, a published test JWKS) that don't change the plan structure. With those two additions, this drops to LOW. Without them, "INFRA-07/08 done" in Plan 10 will overstate what's actually been verified.
