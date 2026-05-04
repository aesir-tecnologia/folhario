---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 6 context gathered
last_updated: "2026-05-04T03:46:34.599Z"
last_activity: 2026-05-03
progress:
  total_phases: 13
  completed_phases: 5
  total_plans: 62
  completed_plans: 62
  percent: 100
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-14)

**Core value:** A beginner in Brazil goes from "I have no idea what this plant is" to "identified, cataloged, with care guidance" in under 2 minutes from email verification — honestly, without jargon, without fake confidence scores, and without hiding AI provenance.
**Current focus:** Phase 5 — catalog-meu-jardim

## Current Position

Phase: 5 (catalog-meu-jardim) — EXECUTING
Plan: 1 of 1
Status: Phase complete — ready for verification
Last activity: 2026-05-03

Progress: [██████████] 100%

## Performance Metrics

**Velocity:**

- Total plans completed: 55
- Average duration: ~10 minutes
- Total execution time: ~92 minutes

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01 | 9/9 | ~92 min | ~10 min |
| 02 | 11 | - | - |
| 04 | 13 | - | - |

**Recent Trend:**

- Last 9 plans: 01-01 (~11 min), 01-02 (~12 min), 01-03 (~25 min), 01-04 (~9 min), 01-05a (~4 min), 01-06 (~10 min), 01-05b (~3 min), 01-07 (~12 min), 01-08 (~6 min automated + checkpoint)
- Trend: Plan 01-08 shipped the full CI pipeline (postgres:17-alpine service container + pnpm + Playwright caches + 15-step workflow) plus 3 planning-doc reconciliations (REQUIREMENTS INFRA-12 + OBS-05 defer, ROADMAP SC-4 split wording + 9-plan list, FILE-MATRIX diag rename fix) + 1 Rule 2 housekeeping (public/sw.js.map gitignore). First PR CI run (24911496475) passed in 2m43s on the first attempt after the Task 4 checkpoint unblock: client-side posthog-js capture could not be intercepted by Playwright despite 8 commits of investigation (init/loaded/capture pipeline all execute without error); root cause never isolated. Resolved per SC-4 (b) by softening the client assertion to warn-only + deferring to the PostHog dashboard as authoritative, with the full investigation and follow-up disposition documented in 01-08-SUMMARY § 'Known gap'. D-21 privacy posture (`person_profiles: 'identified_only'`) restored post-investigation. GitHub deprecation warning on actions/cache@v4 + actions/upload-artifact@v4 captured as a tooling todo (`.planning/todos/pending/2026-04-24-bump-github-actions-to-v5-v7-to-escape-node-20-deprecation.md`) with hard 2026-06-02 and 2026-09-16 deadlines.

*Updated after each plan completion*
| Phase 05-catalog-meu-jardim P01 | 4 | 3 tasks | 7 files |
| Phase 05-catalog-meu-jardim P02 | 7 | 3 tasks | 11 files |
| Phase 05-catalog-meu-jardim P11 | 4 | 2 tasks | 6 files |
| Phase 05-catalog-meu-jardim P12 | 11 | 3 tasks | 9 files |
| Phase 05-catalog-meu-jardim P24 | 437 | 4 tasks | 6 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Plan 05-02: schema-registry.ts must export new tables for drizzle-kit to detect schema changes — drizzle.config.ts uses registry as schema entry point, not per-context schema.ts files
- Plan 05-02: vitest unit project extended to include src/**/*.test.ts for co-located test files (cursor.test.ts sits alongside cursor.ts)
- Plan 05-02: Two separate drizzle-kit generate invocations (one table per pass) to produce two distinct named migration files; REFACTOR phase skipped (duplication ~6 lines)
- Plan 05-12: Ghost row uses __ghost__ value prefix to prevent React key collision with real options sharing the same string value; commitOption strips prefix before calling onChange
- Plan 05-12: @testing-library/jest-dom/vitest wired into unit test setup (Rule 2 — was installed but not imported; enables toHaveAttribute matcher across all unit-dom tests)

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
- Plan 01-05b: Three Sentry.init callsites (`src/sentry.server.config.ts`, `src/sentry.edge.config.ts`, `src/instrumentation-client.ts`) all shipped with `sendDefaultPii: false` (L-2/CVE-2025-65944), `beforeSend`/`beforeBreadcrumb` from Plan 05a's scrub module, and `dsn || undefined` + `enabled: Boolean(...)` empty-DSN disable (D-19). Browser init uses the v10 convention `instrumentation-client.ts` (NOT the legacy `sentry.client.config.ts` — verified via context7 on 2026-04-23); `src/sentry.client.config.ts` grep-verified absent as regression guard.
- Plan 01-05b: Three type-casts required — `makeBeforeSend() as unknown as Sentry.{Node,Edge,Browser}Options["beforeSend"]` (and same for `beforeBreadcrumb`). Sentry's `BeforeSendCallback` is invariant on return (`ErrorEvent` vs Plan 05a's local `SentryEvent` with `User.id: string` — Sentry's `User.id: string | number` widens beyond our local type). Plan `<action>` Step 4 pre-approved casts conditional on TS2322 firing. Behavior preserved because scrub module never constructs fresh users, only deletes fields.
- Plan 01-05b: `src/instrumentation.ts` cleaned of BOTH `try/catch` wrappers AND `@ts-expect-error` directives from Plan 03 (T-05b-04 mitigation — init failures now surface as real errors instead of being swallowed). Final file is 13 lines: conditional `await import` by `NEXT_RUNTIME` + `onRequestError = Sentry.captureRequestError` export.
- Plan 01-05b: `onRouterTransitionStart = Sentry.captureRouterTransitionStart` exported from `instrumentation-client.ts` per Sentry v10 docs — Next 16 App Router auto-picks up this named export to instrument client navigation transitions. Safe to export when Sentry is disabled (no-op without init). Browser init also pins `replaysSessionSampleRate: 0` + `replaysOnErrorSampleRate: 0` as dual-trigger guard against accidental Replay activation (D-21 diagnostics-only posture).
- Plan 01-05b: OBS-01 marked complete per plan frontmatter `requirements: [OBS-01]` despite REQUIREMENTS.md prose covering 4 sub-items. This plan delivers (1) Sentry SDK integrated + (4) PII scrubbing; sub-items (2) release tag = git SHA + (3) source-map upload post-build are Phase 12's responsibility per Plan 01-08's explicit defer (Pitfall 7: do NOT add source-map upload in Phase 1 ci.yml). Phase 12's deploy-production.yml work augments the same requirement without re-opening it.
- Plan 01-05b: LGPD-13 marked complete — runtime enforcement across all three runtimes (server + edge + browser) now live via Plan 05a's scrub module mounted into all three Sentry.init callsites. Plan 05a SUMMARY explicitly deferred this marking to 05b (per its own threat model T-05a-01: "the scrub MODULE is verified here; the init-file WIRING that consumes it is verified in Plan 05b").
- Plan 01-07: Diagnostics routes renamed from `/__diag` + `/api/v1/_diagnostics/` to `/diag` + `/api/v1/diagnostics/` — Next.js App Router's route-discovery filter (`node_modules/next/dist/esm/build/route-discovery.js:54` — `ignorePartFilter: part => part.startsWith('_')`) silently excludes any path segment starting with `_`. The plan's prescribed URLs violated this rule; the build emitted only `/` + `/_not-found` and all E2E specs returned 404. Renamed folders via `git mv`, updated 5 E2E specs + integration test + `public/robots.txt` Disallow entries. Defense-in-depth story unchanged (mode-gate + robots.txt still coherent).
- Plan 01-07: `vi.mock("posthog-node")` requires function-constructor form `PostHog: function MockPostHog() { return { capture, shutdown } }` — NOT `PostHog: vi.fn().mockImplementation(() => ({...}))`. Arrow functions lack `[[Construct]]` and the route handler calls `new PostHog(...)`, raising `TypeError: not a constructor`. Named-function return-object pattern satisfies `[[Construct]]` and Vitest handles the object-return correctly.
- Plan 01-07: SC-4 server-side automatic proof (D-27-a / user decision 1 / Action 13) shipped as `tests/integration/diagnostics-server-probe.integration.test.ts` — imports POST handler directly, mocks `posthog-node` + `@sentry/nextjs` via `vi.mock`, asserts `captureMock` invoked with event `$diagnostics_server_ping` AND `captureExceptionMock` invoked once. Second test flips `IDENTIFICATION_PROVIDER_MODE=real` + `vi.resetModules()` and asserts POST returns 404 (mode-gate regression guard). Replaces prior "Playwright cannot intercept server-originated traffic" concession with automatic CI proof.
- Plan 01-07: Integration test imports via relative path `../../src/app/api/v1/diagnostics/ping/route` (not `@/...`) — `tsconfig.json` paths only declares `@contexts/*`, `@shared/*`, `@i18n/*`; no `@/*` alias exists. Relative path resolves identically via `vite-tsconfig-paths`.
- Plan 01-07: Sentry envelope-count assertion in `diagnostics-sentry.spec.ts` is CI-gated (`if (process.env.CI) expect(...)`); PII-sentinel assertion is unconditional. The inverse `sentry-local-mode.spec.ts` uses `test.skip(!!process.env.CI, ...)` — runs only locally and asserts zero envelopes emitted under empty-DSN mode (Action 13). This split means local-mode developers running the suite don't get false failures when DSN is blank while still catching any accidental re-enable.
- Plan 01-07: INFRA-16 + INFRA-18 + OBS-01 + OBS-02 + LGPD-13 all marked complete in REQUIREMENTS.md per plan frontmatter. OBS-01 + LGPD-13 were previously marked by Plan 05b; plan 07 re-confirms them end-to-end via the smoke suite. OBS-02 was contributed-not-completed by Plan 06; 07 closes the loop. INFRA-16 (env gate) + INFRA-18 (security headers every response) land here because their end-to-end Playwright verification is the authoritative proof.
- Plan 01-07: Pre-existing `public/sw.js.map` missing from `.gitignore` (Plan 03 SUMMARY claimed it was added but only `public/sw.js` was). Logged to `.planning/phases/01-foundation/deferred-items.md` for Plan 01-08 or later housekeeping — out of Plan 07 scope.
- Plan 01-08: `.github/workflows/ci.yml` pins `actions/checkout@v5` + `actions/setup-node@v5` + `actions/cache@v4` + `actions/upload-artifact@v4`; all verified GA via live `api.github.com/repos/.../tags` on 2026-04-24 (Action 19). postgres:17-alpine service container matches local Supabase's bundled Postgres 17 (D-25 parity); DATABASE_URL == DATABASE_POOL_URL in CI because Supavisor is not used. Integration step exports `NEXT_PUBLIC_POSTHOG_KEY=ph_test_key` so the mocked `getPostHog()` in `diagnostics-server-probe` unlocks its singleton. SENTRY_DSN_CI + POSTHOG_KEY_CI injected ONLY into the E2E step; Build step has NO SENTRY_AUTH_TOKEN (Pitfall 7 — source-map upload is Phase 12 `deploy-production.yml`). Workflow uses `on: pull_request` (NOT `pull_request_target`) so fork PRs run without secrets; CI-gated diagnostics assertions tolerate empty DSN/key.
- Plan 01-08: Planning-doc-drift mitigations (T-08-06) extended beyond plan text to include REQUIREMENTS.md per-phase totals (Phase 1 13→12 after OBS-05 move, Phase 13 3→4), FILE-MATRIX.md stale `__diag`/`_diagnostics` paths post-Plan-07 rename (3 rows), and `.gitignore` `public/sw.js.map` entry (Plan 07 deferred-item closure). Advisor-flagged as Rule 1 doc-consistency fixes — keeps Phase 1's planning artifacts authoritative.
- Plan 01-08: posthog-js 1.368 client-side capture does NOT POST to `*.i.posthog.com` in the Playwright + CI + Next 16 combo despite the full pipeline executing without error (init → loaded-callback → capture all confirmed via instrumentation; `/flags` POST IS observed but `/e`, `/batch`, `/capture` never fire). 8 commits of investigation (`6b23819`…`a95a004`) eliminated candidate root causes (batch-flush timing, page-unload flush, pre-init drop, `person_profiles: 'identified_only'` gate, loaded-callback queuing) without producing a POST. Resolved per SC-4 (b) / user decision 1: Playwright assertion softened to warn-only when zero events intercepted (dashboard is authoritative); marker + scrub sentinel assertions retained when events ARE intercepted. Hard assertions remain for server-side `$diagnostics_server_ping` (via `diagnostics-server-probe.integration.test.ts`), Sentry envelopes, and scrub sentinels. D-21 privacy posture (`person_profiles: 'identified_only'`) restored after the diagnostic flip to `'always'` (`fcfa448`) was reverted. Gap documented in 01-08-SUMMARY § 'Known gap' with investigation trail, resolution posture, and follow-up disposition (ops item, no phase owner; not a launch blocker since MVP identification flows will capture server-side via `posthog-node` where the pipeline is fully asserted).
- Plan 01-08: INFRA-12 marked complete in REQUIREMENTS.md traceability table. Phase 1 complete: INFRA-12 + INFRA-16 + INFRA-17 + INFRA-18 + INFRA-20 + INFRA-23 + INFRA-26 + OBS-01 + OBS-02 + LGPD-13 (plus INFRA-01 + INFRA-02 from Plan 01-01). OBS-05 explicitly deferred to Phase 13 on 2026-04-23 per user decision 2 (alert rules need real traffic to tune thresholds — empty-project alerts are noise).
- Plan 01-08: First PR CI run (https://github.com/aesir-tecnologia/folhario/actions/runs/24911496475) completed green in 2m43s on the first attempt post-checkpoint-unblock; all 15 workflow steps passed including Playwright smoke (7 passed + 1 expected local-mode skip). GitHub emitted a deprecation annotation: `actions/cache@v4` and `actions/upload-artifact@v4` run on Node 20, forced to Node 24 on 2026-06-02, removed 2026-09-16 — captured as tooling todo at `.planning/todos/pending/2026-04-24-bump-github-actions-to-v5-v7-to-escape-node-20-deprecation.md`.
- Post-Phase-1 (2026-04-24): **Reversed Action 6 on `next-env.d.ts` handling.** Original Action 6 (from `/gsd-plan-phase 1 --reviews` resolution pass) landed on "untracked AND not gitignored" to reconcile a textual contradiction between 01-01-PLAN (gitignore) and 01-03-PLAN (track). The Codex review that surfaced the contradiction (`01-REVIEWS.md:269`) asked for a clean binary — track OR gitignore — and the resolution invented a third option neither reviewer argued for. Next 16 docs (verified via context7 against `/vercel/next.js` canary — `docs/01-app/03-api-reference/05-config/02-typescript.mdx` and `06-cli/next.mdx`) explicitly recommend gitignoring and regenerating via `next typegen` before typecheck: *"We recommend adding `next-env.d.ts` to your `.gitignore` file"*. `next typegen` exists specifically so CI can hydrate the file cheaply before `tsc --noEmit` without paying for a full build. Resolution: added `next-env.d.ts` to `.gitignore`; inserted `pnpm exec next typegen` step in `ci.yml` between Lint and Typecheck; updated `01-CONTEXT.md` with supersedes-note pointing back to this decision. Historical references to "Action 6" in completed plan/summary artifacts left intact as frozen audit trail — current behavior is the STATE/CONTEXT decision, not the old Action 6 text.
- [Phase ?]: Plan 05-11: subscription stub shipped; .unit.test.tsx for colocated React tests; async SubscriptionProvider; production static rendering preserved

### Pending Todos

1. **Bump GitHub Actions to v5/v7 to escape Node 20 deprecation** (tooling) — `.planning/todos/pending/2026-04-24-bump-github-actions-to-v5-v7-to-escape-node-20-deprecation.md`
2. **Replace vite-tsconfig-paths plugin with native Vite resolve.tsconfigPaths** (tooling) — `.planning/todos/pending/2026-04-27-replace-vite-tsconfig-paths-plugin-with-native-vite-resolve-tsconfigpaths.md`

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

Last session: 2026-05-04T03:46:34.590Z
Stopped at: Phase 6 context gathered
Resume file: .planning/phases/06-identification-flow-cost-controls/06-CONTEXT.md
