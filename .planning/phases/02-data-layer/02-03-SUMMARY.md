---
phase: 02-data-layer
plan: "03"
subsystem: database
tags: [drizzle, drizzle-kit, drizzle-zod, postgres, rls, migration, bounded-contexts, schema, events]

# Dependency graph
requires:
  - phase: 02-data-layer
    provides: drizzle.config.ts pointing at schema-registry, migration-client (DATABASE_URL), pgcrypto-ready Postgres 17 (plan 01) + 10 IAM/Catalog/Species-Care tables (plan 02)
provides:
  - "Identification schema: identifications (jsonb results), identification_limits (unique tier), provider_budgets (numeric min_confidence + alert_threshold_pct, unique provider+purpose), provider_usage_counters (unique provider+purpose+utc_date)"
  - "Reminders schema: reminders (advance_rule from_scheduled, UTC next_due_at) + reminder_logs (cascade)"
  - "Billing schema: subscriptions (cascade on user) + billing_events (json payload per D-06; SET NULL on subscription cleanup; unique provider+event_id)"
  - "Notifications schema: push_subscriptions (per-device unique on user_id+device_id; jsonb keys for VAPID)"
  - "IAM-support schema: offline_sync_failures (json payload) + idempotency_keys with request_hash text NOT NULL per locked REVIEWS.md contract; (user_id, key) unique + expires_at index"
  - "Drizzle migration 0000_phase_02_initial_schema.sql — schema-only DDL for all 21 tables (19 PRD §4 + 2 IAM-support); regen-safe"
  - "Drizzle CUSTOM migration 0001_phase_02_rls_policies.sql — handwritten pgcrypto + authenticated role + auth.uid() shim + 21 ALTER TABLE ENABLE RLS + 6 reference SELECT policies + 14 owner FOR ALL policies (10 direct user_id + 4 transitive) + 16 ownership indexes + auth.users sync trigger; idempotent, schema-regen-safe"
  - "Domain Zod schemas (drizzle-zod) for every new table"
  - "scripts/check-rls.ts — production runtime guard (T-02-29) + behavioural relrowsecurity audit for all 21 tables"
  - "tests/integration/schema-rls.integration.test.ts — 7 specs covering table existence, RLS coverage, owner/reference policy presence, ownership indexes, and auth.uid() helper"
  - "Per-context domain events.ts files for all 7 bounded contexts: name registry + payload types only (no Phase-4 dispatcher imports)"
affects: [02-04, 02-05, 02-05.5, 02-06, 02-07, 02-08, 02-09, 02-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two-migration layout: schema migration + custom RLS migration. drizzle-kit generate output is for schema only; handwritten DDL lives in --custom files (T-02-30 mitigation)"
    - "Idempotent custom SQL: every ALTER TABLE / CREATE POLICY / CREATE INDEX / DO block is wrapped so a double-apply is a no-op (IF NOT EXISTS, pg_policies probe, ON CONFLICT DO NOTHING)"
    - "Conditional auth.uid() helper for plain-Postgres CI; production guard in check-rls throws when NODE_ENV=production AND auth schema is absent (T-02-29)"
    - "Transitive RLS ownership via EXISTS subquery against parent tables (photo_entries→plants, reminders→plants, reminder_logs→reminders→plants, billing_events→subscriptions)"
    - "auth.users → public.users sync trigger created conditionally; trigger function is created unconditionally and dormant when auth.users is absent (PL/pgSQL DO blocks cannot host bare CREATE FUNCTION)"
    - "Per-context events.ts pattern: const-as-const event-name registry + interface payload types; zero runtime dependencies"
    - "Mixed json/jsonb: json for audit-faithful raw envelopes (billing_events.payload, offline_sync_failures.payload), jsonb for queryable shapes (identifications.results, push_subscriptions.keys, idempotency_keys.response_body) — D-06"

key-files:
  created:
    - src/contexts/identification/infrastructure/db/schema.ts
    - src/contexts/identification/domain/schemas.ts
    - src/contexts/identification/domain/events.ts
    - src/contexts/reminders/infrastructure/db/schema.ts
    - src/contexts/reminders/domain/schemas.ts
    - src/contexts/reminders/domain/events.ts
    - src/contexts/billing/infrastructure/db/schema.ts
    - src/contexts/billing/domain/schemas.ts
    - src/contexts/billing/domain/events.ts
    - src/contexts/notifications/infrastructure/db/schema.ts
    - src/contexts/notifications/domain/schemas.ts
    - src/contexts/notifications/domain/events.ts
    - src/contexts/iam/domain/events.ts
    - src/contexts/catalog/domain/events.ts
    - src/contexts/species-care/domain/events.ts
    - drizzle/migrations/0000_phase_02_initial_schema.sql
    - drizzle/migrations/0001_phase_02_rls_policies.sql
    - drizzle/migrations/meta/0000_snapshot.json
    - drizzle/migrations/meta/0001_snapshot.json
    - drizzle/migrations/meta/_journal.json
    - tests/integration/schema-rls.integration.test.ts
  modified:
    - src/contexts/iam/infrastructure/db/schema.ts
    - src/contexts/iam/domain/schemas.ts
    - src/shared/db/schema-registry.ts
    - scripts/check-rls.ts

key-decisions:
  - "Two-file migration split (schema vs RLS) follows Gemini/Claude review consensus and resolves T-02-30: handwritten RLS lives in 0001_phase_02_rls_policies.sql which schema regen never touches. Future drizzle-kit generate runs only emit a NEW numbered file containing schema deltas."
  - "request_hash uses text() (not varchar) so the plan's strict regex `\\brequestHash[^,]*\\.notNull\\(\\)` matches without commas. Behaviour is identical (text and varchar without length are storage-equivalent in Postgres)."
  - "CREATE FUNCTION public.handle_new_auth_user is hoisted OUTSIDE the conditional DO block. PL/pgSQL DO can't host bare CREATE FUNCTION; alternatives required EXECUTE with double-string-escaping the entire function body. The function is dormant when auth.users doesn't exist (only the conditional trigger references it). Net behaviour matches the plan's intent."
  - "Used drizzle-kit binary directly (./node_modules/.bin/drizzle-kit generate --name X) rather than `pnpm db:generate -- --name X`. pnpm 9 strips the bare `--` separator differently than older versions and passes it as a literal arg, breaking the script. Either form lands the same SQL."
  - "Integration test uses `IN ${sql([...])}` for parameterised lists rather than `ANY(${sql.array(...)})` because postgres-js 3.4 doesn't infer array OID for `sql.array()` without an explicit type hint. The check-rls.ts script keeps `sql.array(...)` because its tagged-template runs after auto-array-OID fetch (postgres-js docs §1136) and works there."
  - "billing_events RLS policy includes `subscription_id is not null` because subscription_id is nullable per PRD §4 (some webhooks arrive before linkage). Unlinked rows are visible to NO authenticated user — service-role only — by design."
  - "provider_usage_counters has RLS enabled but NO authenticated policy. Counters are written by the cap-check path (service role) and not surfaced to end users in MVP. Documented inline in the RLS migration."

requirements-completed: [INFRA-05, INFRA-08]

# Metrics
duration: 35min
completed: 2026-04-26
---

# Phase 02 Plan 03: Operational Schemas + RLS + First Migration Summary

**4 new bounded-context schemas (Identification, Reminders, Billing, Notifications) + 2 IAM-support tables (offline_sync_failures with audit-faithful json payload, idempotency_keys with text-NOT-NULL request_hash and 7-day expires_at), Drizzle-generated initial migration covering all 21 app tables, a dedicated handwritten `--custom` RLS migration (pgcrypto + authenticated role + conditional auth.uid() shim + ALTER TABLE ENABLE RLS for all 21 + 6 reference SELECT policies + 14 owner FOR ALL policies including 4 transitive-ownership variants + 16 ownership indexes + conditional auth.users → public.users sync trigger with first-row-tradeoff defaults), `scripts/check-rls.ts` production guard (T-02-29) + behavioural RLS audit, a 7-spec integration test asserting the schema/RLS contract, and per-context domain events.ts files for all 7 contexts (name registry + payload types, zero async-runtime imports).**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-26T13:00:00Z (approx — orchestrator spawn)
- **Completed:** 2026-04-26T13:35:00Z
- **Tasks:** 5
- **Files modified:** 25 (21 created, 4 modified)

## Accomplishments

- All 21 app tables (19 PRD §4 entities + 2 IAM-support) are in the Drizzle registry with explicit FK delete rules, mixed json/jsonb per D-06, and `varchar({ enum: [...] as const })` for typed PRD enums.
- The idempotency contract is locked from day one: `request_hash` is `text NOT NULL` and the migration file enforces it. Plan 06's idempotency helper inherits this contract — no null-hash rows ever land.
- The two-migration split (schema-only + handwritten custom RLS) directly resolves T-02-30. Future schema regenerations will emit a new numbered file and never touch `0001_phase_02_rls_policies.sql`.
- Every app table has RLS enabled (`pg_class.relrowsecurity = true`); reference tables get authenticated SELECT, user-owned tables get owner FOR ALL, transitively-owned tables (photo_entries, reminders, reminder_logs, billing_events) get parent-FK-joined policies, and `provider_usage_counters` is service-role-only by design.
- The auth.uid() helper shim is conditional (only created when Supabase's auth schema is absent) AND backed by a runtime production guard in `scripts/check-rls.ts` that aborts when `NODE_ENV=production` and `pg_namespace` lacks the auth schema (T-02-29).
- The auth.users → public.users insert trigger is wired with `ON CONFLICT (id) DO NOTHING` so Phase 4 signup can re-insert without conflict; defaults `'America/Sao_Paulo'` + `'09:00'` are documented inline as first-row trade-offs.
- 7-spec integration test (`tests/integration/schema-rls.integration.test.ts`) proves table existence, RLS coverage, owner/reference policy presence, ownership-index presence, and auth.uid() helper presence over a real Postgres connection — inheriting the existing cloud-Supabase guard pattern.
- Per-context `domain/events.ts` for all 7 bounded contexts ships the canonical event-name registry + payload types Phase 4 will consume; zero async-runtime imports anywhere.

## Task Commits

1. **Task 1: Add operational + IAM-support schemas across 4 contexts** — `a11761b` (feat)
2. **Task 2a: Generate initial Drizzle schema migration (21 tables)** — `9944fe1` (feat)
3. **Task 2b: Handwritten RLS / auth shim / ownership indexes / auth.users sync trigger** — `cb1bd13` (feat)
4. **Task 3: Schema/RLS integration test + production runtime guard** — `5208b81` (feat)
5. **Task 4: Per-context domain event NAME and PAYLOAD types** — `58df0e3` (feat)

**Plan metadata:** orchestrator owns the metadata commit (parallel-executor mode).

## Files Created/Modified

### Schema modules (Task 1)

- `src/contexts/identification/infrastructure/db/schema.ts` — 4 tables: identifications (jsonb results, jsonb selected_result, varchar provider/model, varchar status with enum check, nullable failure_reason from PRD §6 closed registry), identification_limits (unique tier), provider_budgets (numeric min_confidence with precision 3 scale 2, alert_threshold_pct default 80, unique provider+purpose), provider_usage_counters (date utc_date, unique provider+purpose+date).
- `src/contexts/reminders/infrastructure/db/schema.ts` — 2 tables: reminders (advance_rule default `from_scheduled`, indexed by next_due_at for cron dispatch) + reminder_logs.
- `src/contexts/billing/infrastructure/db/schema.ts` — 2 tables: subscriptions (status enum trialing/active/past_due/canceled/expired) + billing_events (json payload per D-06, unique provider+event_id, SET NULL on subscription cleanup so audit rows survive).
- `src/contexts/notifications/infrastructure/db/schema.ts` — 1 table: push_subscriptions (per-device unique on user_id+device_id; jsonb keys for VAPID auth/p256dh).
- `src/contexts/iam/infrastructure/db/schema.ts` (modified) — appended offline_sync_failures (json payload, audit-faithful) and idempotency_keys (request_hash text NOT NULL per locked REVIEWS.md contract; (user_id, key) unique; expires_at index for the future Phase-4+ cleanup cron).
- `src/contexts/{identification,reminders,billing,notifications}/domain/schemas.ts` — drizzle-zod select+insert schemas + matching TS types for every new table (lean — refinements land in plans that need them).
- `src/contexts/iam/domain/schemas.ts` (modified) — appended drizzle-zod surfaces for offline_sync_failures and idempotency_keys.
- `src/shared/db/schema-registry.ts` (modified) — re-exports every new context's tables for drizzle-kit; the migration-only marker is preserved.

### Migrations (Tasks 2a + 2b)

- `drizzle/migrations/0000_phase_02_initial_schema.sql` — drizzle-kit generate output. 21 tables. Contains schema DDL only — no RLS, no policies (verified by acceptance-criterion grep).
- `drizzle/migrations/0001_phase_02_rls_policies.sql` — drizzle-kit generate `--custom` output. Idempotent handwritten DDL: pgcrypto extension, conditional `authenticated` role, conditional auth.uid() helper for plain-Postgres CI, 21 ALTER TABLE ENABLE ROW LEVEL SECURITY, 6 reference SELECT policies (species, care_guides, identification_limits, provider_budgets, policy_versions, partner_stores), 10 direct-owner FOR ALL policies, 4 transitive-owner FOR ALL policies (photo_entries, reminders, reminder_logs, billing_events), 16 ownership indexes (CREATE INDEX IF NOT EXISTS), and the conditional auth.users → public.users insert trigger with the first-row-tradeoff comment + ON CONFLICT (id) DO NOTHING.
- `drizzle/migrations/meta/{0000,0001}_snapshot.json` + `_journal.json` — drizzle-kit's diff-determinism artefacts.

### Test + script (Task 3)

- `tests/integration/schema-rls.integration.test.ts` — 7 specs: PRD-table presence, IAM-support table presence, RLS-everywhere, owner-policy coverage, reference-policy coverage, user_id ownership-index coverage, auth.uid() helper presence. Cloud-Supabase guard inherited.
- `scripts/check-rls.ts` (replaced) — production guard at the top + behavioural relrowsecurity audit for all 21 tables. Exit 0 on success, 1 on missing tables / disabled RLS / production-guard failure, 2 on connection error.

### Domain events (Task 4)

- `src/contexts/{iam,catalog,species-care,identification,reminders,billing,notifications}/domain/events.ts` — 7 files, one per bounded context. Each declares an `as const` event-name registry plus payload `interface`s. The top line is `// Phase 2 scope: event NAME and PAYLOAD types only.` to honor the acceptance-criterion grep.

## Decisions Made

See `key-decisions` in frontmatter for the full list. Highlights:

- **Two-file migration layout** — directly addresses T-02-30 (lost handwritten SQL on schema regeneration). Schema lives in 0000, RLS lives in 0001 (`--custom`), and future generations won't touch 0001.
- **`text("request_hash")` over `varchar(...).notNull()`** — the plan's regex `\brequestHash[^,]*\.notNull\(\)` requires no comma between `requestHash` and `.notNull()`. text() is regex-clean and storage-equivalent (Postgres treats unparameterised text and varchar identically).
- **CREATE FUNCTION outside the DO block** — PL/pgSQL DO can't host bare DDL; the alternative (EXECUTE with stringified function body) doubles dollar-quoting depth and is harder to read. The function is dormant when `auth.users` doesn't exist; only the conditional trigger references it. Net behaviour matches the plan.
- **`./node_modules/.bin/drizzle-kit generate ...` over `pnpm db:generate -- --name X`** — pnpm 9 forwards the bare `--` literally to the script, which drizzle-kit doesn't recognise. Direct binary call lands the same SQL.
- **`IN ${sql([...])}` over `ANY(${sql.array(...)})`** in the integration test — postgres-js 3.4 needs an explicit OID for `sql.array()` without auto-array-OID fetch having completed; on a fresh integration-test connection that hasn't happened yet. The IN form is documented in postgres-js README §"Dynamic values and where in".
- **billing_events policy includes `subscription_id is not null`** — PRD §4: subscription_id is nullable for webhooks that arrive before linkage. Unlinked rows are service-role-only by design.
- **provider_usage_counters has RLS but no authenticated policy** — counter writes are service-role; clients have no read use case in MVP. Documented inline in the migration.

## Deviations from Plan

### Auto-fixed (Rule 3 — Blocking issues)

**1. [Rule 3 - Blocker] `pnpm db:generate -- --name X` breaks under pnpm 9**

- **Found during:** Task 2a
- **Issue:** `pnpm db:generate -- --name phase_02_initial_schema` invocation (per the plan text) exits 1 with `Unrecognized options for command 'generate': --, phase_02_initial_schema`. pnpm 9 forwards the standalone `--` as a literal argv, but drizzle-kit consumes the `--name` flag directly without an argv separator.
- **Fix:** Invoked the binary directly: `./node_modules/.bin/drizzle-kit generate --name phase_02_initial_schema` (and the same for `--custom --name phase_02_rls_policies`). Output is identical: `0000_phase_02_initial_schema.sql` and `0001_phase_02_rls_policies.sql` are committed.
- **Commit:** `9944fe1`, `cb1bd13`
- **Plan-text correction for future plans:** drop the `--` separator OR call drizzle-kit directly.

**2. [Rule 3 - Blocker] `${sql.array([...])}` fails in fresh integration-test connection**

- **Found during:** Task 3 first run
- **Issue:** `tablename = ANY(${sql.array([...])})` raised `op ANY/ALL (array) requires array on right side` because postgres-js 3.4's automatic array-type OID fetch hasn't completed on the first query of a freshly-opened test connection.
- **Fix:** Switched to the documented `tablename IN ${sql([...])}` form (postgres-js README §"Dynamic values and `where in`"). All 7 specs now pass.
- **Commit:** `5208b81`
- **Note:** `scripts/check-rls.ts` still uses `sql.array(...)`; that script runs `select 1` first (the readiness probe), giving postgres-js time to populate array-type info before the pg_class probe runs. No change needed there.

### Planner-conflict resolution (Rule 3)

**3. [Rule 3 - Planner conflict] events.ts marker vs. inngest grep**

- **Found during:** Task 4 acceptance-criteria check
- **Issue:** Plan's two acceptance criteria contradict each other:
  1. "Add the comment `// Phase 2 scope: event NAME and PAYLOAD types only. Inngest registration lands in Phase 4.`" (literal line)
  2. "`grep -ri 'inngest' src/contexts/*/domain/events.ts` exits non-zero" (no inngest substring anywhere)
- **Fix:** Honor criterion (1)'s testable substring `Phase 2 scope: event NAME and PAYLOAD types only` (which is what the acceptance criteria explicitly grep for) and rephrase the trailing clause to `Async dispatcher lands in Phase 4` so criterion (2) holds. Planner intent (signal Phase-2 scope) is preserved.
- **Commit:** `58df0e3`
- **Plan-text correction for future plans:** the acceptance-criteria block should not list a literal comment containing the very token a different criterion forbids.

### Auto-added (Rule 2 — missing critical functionality)

**4. [Rule 2 - Critical] Transitive-ownership RLS for tables without direct user_id**

- **Found during:** Task 2b authoring
- **Issue:** Plan section 6 specifies "Owner `FOR ALL TO authenticated` policies for user-owned tables" but several PRD-§4 tables (photo_entries, reminders, reminder_logs, billing_events) don't have a direct user_id column. With RLS enabled and no policy, they would be unreachable to authenticated callers — breaking PRD §10 (Reminders dashboard) and §4 (Photo journal).
- **Fix:** Added 4 transitive-ownership policies that join through the parent FK (photo_entries→plants, reminders→plants, reminder_logs→reminders→plants, billing_events→subscriptions). Each uses an EXISTS subquery and includes the same `auth.uid() is not null` guard as direct-owner policies.
- **Commit:** `cb1bd13`

**5. [Rule 2 - Critical] Production runtime guard for the auth.uid() shim is part of the test gate**

- The plan text explicitly required this in Task 3, but it's worth noting that `scripts/check-rls.ts` is the only thing standing between a misconfigured deploy and silent RLS bypass via the CI shim (T-02-29). The implementation queries `pg_namespace` for `nspname = 'auth'` and throws a clearly-worded error when `NODE_ENV=production` and the schema is absent, fully satisfying the must_haves.truths line "scripts/check-rls.ts throws in production when the Supabase `auth` schema is absent."

## Issues Encountered

- **Initial run of the IAM `text` import was missing.** Adding `idempotency_keys` and `offline_sync_failures` required `text` and `json`/`jsonb`, which weren't in the previous IAM import block. Fixed inline before committing Task 1.
- **`request_hash` regex fails with varchar form.** The plan asks for `request_hash text NOT NULL` and verifies with `\brequestHash[^,]*\.notNull\(\)`. A `varchar("request_hash", { length: 128 }).notNull()` form has a comma inside `varchar(...)` which fails the regex. Switched to `text("request_hash").notNull()` — plan-faithful and regex-clean.
- **postgres-js 3.4 quirk** with `sql.array()` on cold connections (described in deviation #2). Documented for future plans.

## User Setup Required

None. Local Supabase stack must be running (`pnpm db:start`) to apply migrations, but that's true for every Phase-2 plan from 02-03 onward. CI runs against `postgres:17-alpine` and inherits the same migration stream.

## Next Phase Readiness

- **02-04 (seeds + buckets):** ready. The 21 tables exist with RLS; seed scripts can use the per-context drizzle-zod insert schemas to validate seed rows. `pnpm db:check-seeds` (placeholder from plan 01) will be replaced in plan 02-04 with real seed assertions.
- **02-05 (runtime DB client + repositories):** ready. Per-context `infrastructure/db/schema.ts` modules are the import target for plan 05's functional repositories. The schema-registry guard from plan 02 still enforces no-application-imports.
- **02-05.5 (real-JWT RLS test):** ready. The owner FOR ALL policies are in place; plan 05.5 will issue a real Supabase JWT and prove cross-user denial — closing the verification gap Claude flagged in REVIEWS.md.
- **02-06 (cursor + idempotency helper):** ready. The `idempotency_keys` table is in place with the locked NOT-NULL `request_hash` contract; the helper just needs to compute a hash, insert/replay, and respect the 7-day `expires_at`.
- **02-07 (Auth adapter + Proxy):** ready. The `users` table is the full PRD §4 shape; `auth.uid()` exists locally (real or shim); the production guard in check-rls.ts prevents a bad deploy.
- **02-08 (image pipeline):** ready. `photo_entries` is wired through plants → users with the transitive RLS policy.
- **02-09 (smoke route):** ready. ConsentLog table is in place from plan 02-02; plan 09 wires the route + JWT + idempotency helper.
- **02-10 (CI reconciliation):** ready. `pnpm db:setup` chains migrate → seed (placeholder) → check-rls → check-seeds. The first three exit 0 today; check-seeds still exits 1 with `schema not ready` until plan 02-04 lands.

## Deferred Items

- **CHECK constraints on operational varchar enums** (D-04) are NOT in this migration. Plan 02-02 SUMMARY mentioned them landing here, but Plan 02-03's acceptance criteria don't require them and the must_haves don't list D-04. The varchar `enum: [...]` modifier provides TS-level safety today; SQL-level CHECK enforcement can land in a follow-up plan if required by Phase 6 cost-control correctness reviews. Logged here so future plans pick it up.
- **`expires_at` cleanup cron for `idempotency_keys`** — REVIEWS.md "Nice to have #15" calls for a Phase-4+ Inngest cleanup. The schema is ready (expires_at is indexed); the cron is Phase 4's responsibility.
- **A real-Supabase JWT-rooted RLS denial test** (REVIEWS.md HIGH-1) is plan 02-05.5's deliverable and intentionally not duplicated here.

## Self-Check: PASSED

- [x] All 5 tasks committed atomically: `a11761b`, `9944fe1`, `cb1bd13`, `5208b81`, `58df0e3` all present in `git log`.
- [x] `src/contexts/identification/infrastructure/db/schema.ts` exists; exports `identifications`, `identificationLimits`, `providerBudgets`, `providerUsageCounters`.
- [x] `src/contexts/reminders/infrastructure/db/schema.ts` exists; exports `reminders` and `reminderLogs`.
- [x] `src/contexts/billing/infrastructure/db/schema.ts` exists; exports `subscriptions` and `billingEvents`; `billingEvents.payload` uses `json("payload")`.
- [x] `src/contexts/notifications/infrastructure/db/schema.ts` exists; exports `pushSubscriptions`.
- [x] `src/contexts/iam/infrastructure/db/schema.ts` exports `offlineSyncFailures` and `idempotencyKeys`.
- [x] `src/contexts/identification/infrastructure/db/schema.ts` `identifications.results` uses `jsonb("results")`.
- [x] `grep -E '\brequestHash[^,]*\.notNull\(\)' src/contexts/iam/infrastructure/db/schema.ts` matches.
- [x] `ls drizzle/migrations/ | grep -E '^[0-9]{4}_phase_02_initial_schema\.sql$'` exits 0 — `0000_phase_02_initial_schema.sql` present.
- [x] `0000_phase_02_initial_schema.sql` does NOT contain `enable row level security` or `create policy`.
- [x] `ls drizzle/migrations/ | grep -E '^[0-9]{4}_phase_02_rls_policies\.sql$'` exits 0 — `0001_phase_02_rls_policies.sql` present.
- [x] `0001_phase_02_rls_policies.sql` contains `enable row level security`, `create policy`, `auth.uid`, `ON CONFLICT (id) DO NOTHING`, and `first-row trade-offs`.
- [x] `git ls-files drizzle/migrations/` shows both SQL files committed.
- [x] `pnpm db:migrate` exits 0.
- [x] `pnpm db:check-rls` prints `OK — 21 app tables present with RLS enabled.` and exits 0.
- [x] `tests/integration/schema-rls.integration.test.ts` contains `Refusing to run integration tests against cloud Supabase` and names all 19 PRD entity tables (verified with per-table grep).
- [x] `scripts/check-rls.ts` contains `relrowsecurity`, matches `/NODE_ENV\s*===?\s*['"]production['"]/`, and matches `/nspname\s*=\s*['"]auth['"]/`.
- [x] All 7 `events.ts` files exist; each contains `Phase 2 scope: event NAME and PAYLOAD types only`; `grep -ri 'inngest' src/contexts/*/domain/events.ts` exits non-zero (no matches).
- [x] `src/contexts/identification/domain/events.ts` contains `identification.succeeded`.
- [x] `src/contexts/reminders/domain/events.ts` contains `daily_reminder_summary.due`.
- [x] Plan-level verification (`pnpm db:migrate && integration-test-spec && pnpm db:check-rls`) all green.
- [x] `pnpm typecheck` exits 0; `pnpm lint` exits 0; full integration suite (3 files / 11 specs) green; full unit suite (8 files / 125 specs) green.
- [x] No accidental file deletions across the 5 commits (`git diff --diff-filter=D --name-only HEAD~5 HEAD` is empty).
- [x] No modifications to STATE.md or ROADMAP.md across the 5 commits (`git diff 6537d58 HEAD --name-only | grep -E 'STATE|ROADMAP'` is empty).

---

*Phase: 02-data-layer*
*Plan: 03*
*Completed: 2026-04-26*
