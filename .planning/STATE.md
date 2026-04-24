---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: executing
stopped_at: Completed Phase 1 Plan 01-06 (hand-rolled PostHog providers client + server + layout wiring)
last_updated: "2026-04-24T03:06:00.000Z"
last_activity: 2026-04-24 -- Phase 01 Plan 01-06 complete; 2 feat commits (Task 1 providers + Task 2 layout); 3 files created, 1 modified; pnpm build green, 116 unit tests green
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 9
  completed_plans: 6
  percent: 66
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.
**Current focus:** Phase null

## Current Position

Phase: 01 — foundation — EXECUTING
Plan: 7 of 9 (next: 01-07 — diagnostics routes + 4 Playwright E2E specs that actually exercise the Sentry + PostHog providers shipped by 05a/05b/06)
Status: Executing Phase 01
Last activity: 2026-04-24 -- Phase 01 Plan 01-06 complete; 2 feat commits (Task 1 providers + Task 2 layout); 3 files created, 1 modified; pnpm build green, 116 unit tests green

Progress: [██████░░░░] 66%

## Performance Metrics

**Velocity:**

- Total plans completed: 6
- Average duration: ~12 minutes
- Total execution time: ~71 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 6/9 | ~71 min | ~12 min |

**Recent Trend:**

- Last 6 plans: 01-01 (~11 min), 01-02 (~12 min), 01-03 (~25 min), 01-04 (~9 min), 01-05a (~4 min), 01-06 (~10 min)
- Trend: Plan 01-06 was a clean two-task execution. One Rule 2 auto-add (idempotent `shutdownPostHog()` helper on the server singleton, explicitly green-lit by the plan's `<notes>` block and needed to hit the `min_lines: 20` artifact bar without padding). Zero TDD RED/GREEN cadence for this plan by design — plan ships telemetry infrastructure with no new unit-testable behavior in Phase 1 (the contract is "initialize" + "return singleton"; Plan 07 verifies behavior end-to-end via Playwright + Vitest integration per D-27-a). All 116 unit tests from prior plans still green (no regressions). `pnpm build --webpack` green with env stubs; `pnpm typecheck` exit 0.

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
- Plan 01-05a: `src/shared/telemetry/sentry-scrub.ts` ships the LGPD-13 scrub contract as 5 named exports (`SCRUB_FIELDS`, `scrubHeaders`, `scrubObject`, `makeBeforeSend`, `makeBeforeBreadcrumb`) consumed verbatim by Plan 05b's three Sentry.init files. Redaction marker is the literal string `[scrubbed]` for per-field scrubs; `undefined` reserved for wholesale section drops (request.cookies, request.data on `/api/v1/identifications/*`).
- Plan 01-05a: IDENTIFICATION_PATH regex uses `(\/|$)` boundary anchor — matches `/api/v1/identifications`, `/api/v1/identifications/`, `/api/v1/identifications/abc`; does NOT match `/api/v1/identifications_foo` (T-05a-02 suffix-bypass mitigation). `isScrubKey` lowercases before Set lookup (T-05a-03 case-bypass mitigation).
- Plan 01-05a: makeBeforeSend / makeBeforeBreadcrumb are factory functions returning closures, not direct exports — future-proofs for per-runtime config injection in Plan 05b without breaking the import shape.
- Plan 01-05a: LGPD-13 NOT marked complete in REQUIREMENTS.md — the module is shipped but runtime enforcement requires Plan 05b's three Sentry.init files. Frontmatter `requirements: [LGPD-13]` is a contributor traceability pointer, not a completion claim; 05b marks it complete. Per the plan's own threat model T-05a-01: "the scrub MODULE is verified here; the init-file WIRING that consumes it is verified in Plan 05b".
- Plan 01-05a: Test file rewritten to use typed synthetic events (`TestEvent`, `TestBreadcrumb` locals mirroring module's internal types) because project's `@typescript-eslint/no-explicit-any` rule (from eslint-config-next/typescript) blocked the plan's `any`-laden sample code at lint-staged. Semantically identical; all 12 behaviors / 15 tests preserved 1:1.
- Plan 01-05a: Commitlint `subject-case` rejected "LGPD-13" as a leading upper-case subject word — rephrased RED commit subject to lowercase-start ("add failing test for Sentry LGPD-13 ..."). Zero content change; commitlint flags only the first subject word.
- Plan 01-05a: REFACTOR skipped — GREEN is 94 lines, zero duplication, single-responsibility helpers. Plan explicitly permitted `no refactor needed — GREEN is minimal` in the summary.
- ROADMAP.md Phase 1 plan list has stale entry `01-05-PLAN.md` (pre-split) — actual files on disk are `01-05a-PLAN.md` + `01-05b-PLAN.md`. Left as-is; out of 05a's scope to fix retroactively. Progress row updated to 5/9.
- Plan 01-06: Hand-rolled PostHog providers on raw posthog-js@1.368.0 + posthog-node@5.29.7 per L-3 — @posthog/next never installed. Both providers import from @shared/config/client-env ONLY per Action 4; NEXT_PUBLIC_POSTHOG_KEY is the same public write key on both sides (no server-only POSTHOG secret in PRD §20).
- Plan 01-06: D-21 client posture shipped verbatim (autocapture:false, capture_pageview:false, capture_pageleave:false, disable_session_recording:true, person_profiles:"identified_only", persistence:"localStorage+cookie"). C-23 US-cloud default (api_host / host = "https://us.i.posthog.com" when NEXT_PUBLIC_POSTHOG_HOST unset) on BOTH client and server.
- Plan 01-06: Added idempotent `shutdownPostHog()` helper to posthog-server.ts (Rule 2 auto-add — not in plan text but explicitly green-lit by plan `<notes>`). Caches instance → nulls module-level singleton BEFORE awaiting shutdown() so concurrent calls are safe; second call after singleton reset is a no-op. Prepares Phase 4+ Inngest graceful-drain paths and satisfied min_lines:20 without padding.
- Plan 01-06: `src/app/posthog-provider.tsx` is a "use client" component (12 lines) that calls initPostHog() once inside useEffect([]). Layout.tsx stays a server component; PostHogProvider wraps children INSIDE NextIntlClientProvider. Plan 03's three invariants (`lang={locale}`, NextIntlClientProvider, /manifest.webmanifest) all grep-verified preserved.
- Plan 01-06: OBS-02 NOT marked complete in REQUIREMENTS.md — providers are shipped but end-to-end verification (US-cloud project receives a ping from both layers) requires Plan 07's diagnostics routes + Playwright smoke. Treating OBS-02 as "contributed" here, parallel to Plan 05a's LGPD-13 posture. Plan 07 (or 08) marks OBS-02 complete.

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

Last session: 2026-04-24T03:06:00.000Z
Stopped at: Completed Phase 1 Plan 01-06 (hand-rolled PostHog providers — client + server + layout wiring; 2 feat commits; 3 files created, 1 modified; pnpm build green, 116 unit tests green, pnpm typecheck exit 0); ready to execute 01-05b (three Sentry.init config files) or 01-07 (diagnostics routes) per the wave DAG
Resume file: .planning/phases/01-foundation/01-05b-PLAN.md
