---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed Phase 1 Plan 01-04 (local Supabase dev stack + env sync + postgres@3 integration test)
last_updated: "2026-04-24T02:41:28.000Z"
last_activity: 2026-04-24 -- Phase 01 Plan 01-04 complete; 3 commits; 4 files created, 3 modified
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 9
  completed_plans: 4
  percent: 44
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.
**Current focus:** Phase null

## Current Position

Phase: 01 — foundation — EXECUTING
Plan: 5 of 9 (next)
Status: Executing Phase 01
Last activity: 2026-04-24 -- Phase 01 Plan 01-04 complete; 3 commits; 4 files created, 3 modified

Progress: [████░░░░░░] 44%

## Performance Metrics

**Velocity:**

- Total plans completed: 4
- Average duration: ~14 minutes
- Total execution time: ~57 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 4/9 | ~57 min | ~14 min |

**Recent Trend:**

- Last 5 plans: 01-01 (~11 min), 01-02 (~12 min), 01-03 (~25 min), 01-04 (~9 min)
- Trend: Plan 01-04 fastest to date — only 1 Rule 1 bug (script key names + pnpm banner) and 1 Rule 3 blocker (Plan 01-02 root-level setupFiles leak into integration project). Docker already up from prior session; supabase images cached — skipped ~4GB first-run download.

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Phase 1: Next 16 App Router + Serwist (not next-pwa), GitHub Actions as sole deploy pipeline (Vercel git integration OFF)
- Phase 1: Drizzle + `postgres-js` + `{ prepare: false }` mandatory for Supavisor txn pooler (stack lock-in from CLAUDE.md)
- Phase 1: Inngest for all async (no raw cron, no BullMQ) — enables `step.sleepUntil` for Phase 11's 7-day LGPD grace
- Plan 01-01: eslint-config-next@16 uses subpath imports (`core-web-vitals` + `typescript`), not a combined default export — verified from create-next-app@16.2.4 output; project `eslint.config.mjs` line 1 comment documents this
- Plan 01-01: Downgraded `typescript@6 → 5.9.3` and `eslint@10 → 9.39.4` to satisfy transitive peer-dep constraints (Rule 1 fixes during install); matches create-next-app upstream stack
- Plan 01-01: `lint` script changed from `next lint` (Next 15 form) to `eslint` (Next 16 form; create-next-app@16.2.4 output confirmed)
- Plan 01-01: `src/placeholder.ts` ships as a TS18003 workaround for empty src/; must be deleted once Plan 01-02 lands real modules
- Plan 01-02: SPLIT env modules per D-29 revised; `src/shared/config/{server,client}-env.ts` with grep-verified module boundary; no combined `env.ts`
- Plan 01-02: `src/placeholder.ts` deleted in Task 2 GREEN (bundled with `errors.ts` creation so `tsc --noEmit` never sees an empty `src/`)
- Plan 01-02: `vitest.config.ts` gained root-level `setupFiles: ["tests/unit/setup-env.ts"]`; `extends: true` propagates into both projects
- Plan 01-02: Zod `z.string().url()` kept as-is (deprecated in Zod 4.3.6 but functional; migration to top-level `z.url()` deferred — zero behavior delta)
- Plan 01-03: next.config.ts wraps `withSentryConfig(withSerwist(withNextIntl(nextConfig)))` — added `createNextIntlPlugin` (Rule 3 blocker; plan omitted the plugin; `getLocale()`/`getMessages()` cannot find `src/i18n/request.ts` without it)
- Plan 01-03: Build script uses `next build --webpack` because `@serwist/next@9.5.7` does not support Next 16 Turbopack (upstream issue); Serwist is disabled in dev anyway (D-13). Dev script stays on default Turbopack.
- Plan 01-03: Switched to next-intl "without i18n routing" mode — `src/proxy.ts` is a no-op pass-through; `src/i18n/request.ts` hardcodes `routing.defaultLocale`. Plan's `createMiddleware(routing)` invocation with `localePrefix: "as-needed"` rewrote `/` → `/pt-BR` expecting an `src/app/[locale]/` segment that intentionally doesn't exist. Routing config remains committed for future multi-locale plan.
- Plan 01-03: Security headers live ONLY in `next.config.ts` `headers()` with `source: "/(.*)"` (user decision 3); `src/proxy.ts` grep-verified to contain zero security-header strings.
- Plan 01-03: `src/instrumentation.ts` uses `try/catch` + `@ts-expect-error` on `await import("./sentry.<runtime>.config")` because Plan 05b creates both files in a later wave. Plan 05b removes both guards.
- Plan 01-03: `public/sw.js` + `public/sw.js.map` added to `.gitignore`; `next-env.d.ts` is intentionally NEITHER tracked NOR gitignored (CONTEXT.md Action 6). `tsconfig.json` `jsx` changed from `preserve` to `react-jsx` by Next 16 build (mandatory).
- Plan 01-04: Script invokes `./node_modules/.bin/supabase` directly (NOT `pnpm supabase`) — pnpm wrapper prepended a run-banner (`> folhario@0.0.0 supabase ...`) into `.env.local` on first run. Rule 1 bug fix commit `d395c4f`.
- Plan 01-04: Supabase CLI 2.95 internal override-name keys corrected: `anon_key` → `auth.anon_key`, `service_role_key` → `auth.service_role_key` (plan template was wrong). Verified empirically; only `api.url` and `db.url` worked as-is.
- Plan 01-04: `DATABASE_POOL_URL` derived verbatim from `DATABASE_URL` locally (R-3). Local Supabase ships with `[db.pooler] enabled=false` in config.toml by default. Preview/prod (Supavisor) will diverge the two URLs later.
- Plan 01-04: Moved Plan 01-02's root-level `vitest.config.ts` `setupFiles: ["tests/unit/setup-env.ts"]` INTO the unit project block only. Rule 3 blocker fix: root placement leaked synthetic `DATABASE_POOL_URL=postgres://u:p@localhost:5432/db` into integration project, defeating `describe.skipIf(!dbUrl)`. Integration project now gets no synthetic env.
- Plan 01-04: `postgres@3.4.9` pinned exactly (not `"3"` or `"^3.x"`) as PRODUCTION dependency (not devDep). Action 14 avoids Phase 2 churn; exact pin matches repo convention (`next: 16.2.3`, `zod: 4.3.6`).
- Plan 01-04: `supabase/config.toml` tracked with `[db].major_version = 17` (CLI 2.95 default matches D-16 + D-25). Live Postgres reports `server_version = 17.6`, `server_version_num = 170006`.
- Plan 01-04: Task 3 was a `checkpoint:human-verify` in the plan; orchestrator pre-authorized the automatable subset (steps 2, 3, 5). Steps 4 (dev server headers — covered by Plan 01-03), 6 (`db:reset`), 7 (`db:stop`) SKIPPED. Stack left running per orchestrator instruction.

### Pending Todos

None yet.

### Blockers/Concerns

Launch-blocker dependencies tracked in ROADMAP.md "Launch-Blocker Dependencies" section — not dev tasks, but Phase 12 gates production deploy on all five:

1. BRL monthly pricing (blocks Phase 10 live mode)
2. NFS-e issuance strategy (Phase 10 ships without; post-launch gap for Brazilian fiscal compliance)
3. DPO appointment (blocks Phase 4 consent flow going live)
4. Privacy policy + ToS authoring (blocks Phase 4 consent flow going live)
5. ≥200 curated care guides (Phase 7 dev ships empty; launch needs the corpus)

## Deferred Items

Items acknowledged and carried forward from previous milestone close:

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| *(none)* | | | |

## Session Continuity

Last session: 2026-04-24T02:41:28.000Z
Stopped at: Completed Phase 1 Plan 01-04 (local Supabase dev stack + postgres@3 integration test); ready to execute 01-05a (Sentry scrub TDD)
Resume file: .planning/phases/01-foundation/01-05a-PLAN.md
