---
phase: 1
reviewers: [claude]
reviewed_at: 2026-04-14T00:00:00Z
plans_reviewed:
  - 01-01-PLAN.md
  - 01-02-PLAN.md
  - 01-03-PLAN.md
  - 01-04-PLAN.md
  - 01-05-PLAN.md
  - 01-06-PLAN.md
  - 01-07-PLAN.md
  - 01-08-PLAN.md
  - 01-09-PLAN.md
  - 01-10-PLAN.md
  - 01-11-PLAN.md
  - 01-12-PLAN.md
  - 01-13-PLAN.md
  - 01-14-PLAN.md
  - 01-15-PLAN.md
  - 01-16-PLAN.md
  - 01-17-PLAN.md
  - 01-18-PLAN.md
---

# Cross-AI Plan Review — Phase 1: Foundation & CI/CD

## Claude Review

### Summary

This is a well-structured, production-quality foundation plan with unusually strong discipline for an MVP phase: TDD on all infrastructure modules, explicit scrubbing rules before any feature ships, and clear operator gates at both ends. The wave structure is mostly sound. The plan earns its 18-plan count — each plan is genuinely infrastructure, not hidden feature work, with one borderline exception. The dominant risks are concentrated in two technically ambitious decisions: Turbopack for production builds paired with `@serwist/next`, and the D-19 OVERRIDE assumption that `@sentry/nextjs@10.48.x` handles Turbopack source maps natively without a separate CI step. Both decisions are reasonable but neither has been verified in this plan, and both are deep in the critical path for Success Criteria 1 and 3.

### Strengths

- **Wave structure correctly isolates operator dependencies.** Gating behind Wave 0 and Wave 5 prevents the common failure mode of CI pipelines that assume secrets exist.
- **TDD discipline on infra modules (Plans 05–09).** Error codes, env parser, Sentry scrubber, PostHog factory, and security headers are the modules everything else imports. Getting them test-covered before any feature code is the right call.
- **D-29 double-gate is well-reasoned.** `IDENTIFICATION_PROVIDER_MODE=stub` AND `VERCEL_ENV=preview` is sufficient: `VERCEL_ENV` is Vercel-controlled in production and undefined outside Vercel, both of which produce a 404. The runtime guard is preferable to a build-time one for a route handler.
- **D-17 opt-out-by-default for PostHog** aligns LGPD Art. 33 consent requirements with the tech from day one.
- **D-16 (no Session Replay)** is the correct LGPD risk call. Explicit in the decisions log.
- **D-14 (transaction rollback per test, fresh DB per file)** is the right integration test isolation pattern for Drizzle + postgres.
- **D-19 OVERRIDE is documented as an override** with a rationale, rather than silently deviating from standard `sentry-cli` practice.
- **Drizzle client separation** (DATABASE_URL for migrations, DATABASE_POOL_URL for runtime) correctly models the Supavisor constraint.

### Concerns

**HIGH**

- **Turbopack + `@serwist/next` production build (D-09 + D-26, Plan 11).** `@serwist/next` Turbopack support was experimental as of late 2024. Using Turbopack for *production* builds (not just dev) is the aggressive part — most production Serwist deployments still fall back to webpack. If the service worker bundle fails to emit under Turbopack, Success Criterion 1 breaks silently (build succeeds, SW absent). Plan 11 notes "Serwist disabled in dev" as a pitfall but doesn't address the production Turbopack path. **Mitigation needed:** explicit verification step in Plan 11 that the SW asset appears in `.next/` after `pnpm build`, or a fallback decision documented if Turbopack support is confirmed broken.

- **D-19 OVERRIDE is unverified in the plan.** The claim that `@sentry/nextjs@10.48.x` with `withSentryConfig` uploads Turbopack source maps natively — without `sentry-cli` — should be verified against the Sentry changelog or tested on a throw-away build before Plan 17 is written. If this assumption is wrong, production errors will have no stack trace resolution, and the fix mid-pipeline is expensive. **Mitigation needed:** explicit verification gate in Wave 0 or Plan 07, or a fallback to `sentry-cli` in Plan 17.

- **D-24 smoke item 3 (Sentry PII scrubbing) cannot be verified by Playwright.** The smoke test fires `/_test/throw` and confirms Sentry *receives* something. It cannot inspect the Sentry event payload without a Sentry API token and a synchronous poll of the Sentry Events API. Without that, SC-4 ("PII scrubbed") passes silently whether or not scrubbing worked. **Mitigation needed:** either add a Sentry API poll step to the smoke suite (requires `SENTRY_AUTH_TOKEN` in CI and a short `await` for ingest), or add a unit test in Plan 07 that asserts the `beforeSend` hook strips the target fields from a synthetic event.

**MEDIUM**

- **D-24 smoke item 4 (PostHog ping) contradicts D-17.** PostHog loads with `opt_out_capturing()` by default. There is no consent flow in the smoke test. A pure browser ping would never fire. The plan doesn't specify whether this is a *server-side* ping (posthog-node, bypasses client consent) or a *client-side* ping (requires opt-in). If it's client-side, the test will always pass vacuously (no network request, no assertion possible). **Mitigation needed:** clarify whether the smoke validates the server-side `posthog-node` initialization, and what the concrete assertion is.

- **No `concurrency:` group on deploy-preview.yml (Plan 15).** Rapid pushes to the same PR will queue or race two workflow runs against the same Supabase branch DB. If the second run starts branch creation before the first completes, the Supabase CLI will either error or create a duplicate. **Mitigation needed:** `concurrency: group: preview-pr-${{ github.event.pull_request.number }}, cancel-in-progress: true` on Plan 15.

- **Implicit intra-Wave-2 ordering: Plan 11 depends on Plans 07 and 08.** `next.config.ts` with `withSentryConfig` wrapping `withNextIntl` wrapping `withSerwist` references packages that Plans 07 and 08 install/configure. If Wave 2 plans execute in parallel and Plan 11 runs first, `pnpm build` in Wave 4 will pick up an incomplete configuration. This is a wave-internal dependency not captured in the structure. **Mitigation needed:** either note Plan 11 as sequentially after Plans 07–10 within Wave 2, or confirm that `withSentryConfig` tolerates absent `sentry.*.config.ts` files at config-write time (it does, but the plan should say so explicitly).

- **`DATABASE_POOL_URL` in integration test CI (Plan 14) has no Supavisor.** The postgres:17-alpine service container has no Supavisor pooler. `DATABASE_POOL_URL` for integration tests must point directly at the container — effectively the same value as `DATABASE_URL`. This is fine technically, but if `{ prepare: false }` is conditionally applied only when a pooler is detected, tests could silently exercise a different code path than production. **Mitigation needed:** confirm the Drizzle client (Plan 10) unconditionally passes `{ prepare: false }` regardless of environment.

- **No cleanup on deploy-preview.yml failure mid-run (Plan 15).** If the Supabase branch DB is created but `vercel deploy` fails, the branch DB persists until PR close. For long-lived PRs this accumulates orphaned branch DBs. **Mitigation needed:** wrap the workflow with `if: always()` cleanup step or rely on Plan 16's cleanup being idempotent (document this explicitly).

- **`/api/inngest` in Plan 12 is borderline out-of-scope.** The phase explicitly excludes "Inngest function registration (Phase 2)," yet Plan 12 includes an Inngest `serve()` handler with a hello-world function. The serve handler is infrastructure, but the hello-world function is a registered function body. **Mitigation needed:** either trim to bare `serve()` with no registered functions, or note this as a deliberate scaffold.

- **next-intl `NextIntlClientProvider` in root layout (Plan 11) needs `messages` prop.** If Plan 11 scaffolds the layout without correctly loading `src/shared/i18n/pt-BR.json` into the provider, next-intl throws at runtime and the smoke test fails with a confusing error. This is implementation-detail but easy to get wrong in the App Router Server Component pattern.

**LOW**

- **D-21 HSTS without preload is correct but should be explained.** `max-age=15552000` without preload is the right conservative choice for a new domain. Worth a single comment in the plan noting that preload requires being on the preload list (irreversible) — avoids someone adding it "to complete" the header later.
- **Plan 17 Inngest sync mechanism unspecified.** "Inngest function sync" appears as a deploy step without specifying the mechanism (`npx inngest-cli deploy`, the Inngest GitHub Action, or a `POST` to the Inngest API). This could block Plan 17 execution.
- **`@sentry/nextjs@10.48.x` + Next.js 16 + React 19 compatibility.** The pinned minor version is good practice, but Sentry releases for Next.js major versions often lag. The plan doesn't include a compatibility check step in Wave 0.

### Suggestions

- **Add a Sentry event assertion to Plan 07's unit tests** that directly exercises the `beforeSend` hook with a synthetic event containing all PII fields, asserting each is scrubbed. This makes SC-4 verifiable without requiring a live Sentry API call in CI.

- **Add an explicit "build smoke" step to Plan 11** that runs `pnpm build` after scaffolding and asserts the SW asset is present in `.next/static/` — catching the Turbopack + Serwist incompatibility before it reaches Plan 17.

- **Clarify the PostHog smoke assertion in Plan 13/D-24.** If the intent is to verify server-side initialization only, change "PostHog ping confirmed" to "posthog-node client initializes without error and captures a server-side `test_ping` event" with an assertion against a PostHog test project or a mock.

- **Add `concurrency:` groups to Plans 14 and 15.** CI workflow for the same PR should cancel-in-progress; deploy-preview for the same PR should cancel-in-progress.

- **Specify the Inngest sync mechanism in Plan 17.** One sentence: which CLI, which command, whether it requires `INNGEST_SIGNING_KEY` to be in GH secrets (it does).

- **Document DATABASE_POOL_URL in CI in Plan 06's env parser tests.** Explicitly test the path where both vars are set to the same value (the local postgres case) vs. different values (the Supabase production case) to prevent subtle bugs when the vars are wired up.

- **Plan 04 (folder scaffold) should note that `src/app/sw.ts` is NOT under `src/contexts/` or `src/shared/`** — it lives in the Next.js app directory. Easy source of confusion during Wave 2 execution.

- **Trim Plan 12's Inngest registration to a bare `serve([])` with no hello-world function body**, keeping it strictly infrastructure and consistent with the phase scope boundary.

### Risk Assessment

**MEDIUM**

The plan is well-scoped, the TDD discipline reduces integration risk significantly, and the operator-gate waves prevent the most common "secrets missing on first run" failure. What lifts this above LOW is the concentration of unverified assumptions in the production build path: Turbopack + `@serwist/next` for production and the D-19 Sentry source-map OVERRIDE are both reasonable decisions that could each individually require an emergency re-plan if they prove incompatible. Neither risk is fatal — both have fallbacks — but discovering them in Wave 4 or Wave 5 rather than in a Wave 1 build smoke would be expensive. Derisk both in Wave 1 or early Wave 2 by adding build verification steps, and the plan drops to LOW overall risk.

---

## Consensus Summary

Single reviewer session. Consensus summary reflects Claude's findings directly.

### Agreed Strengths

- Wave structure with non-autonomous gates at Wave 0 and Wave 5 is sound
- TDD on all infra modules (Plans 05–09) is the right call
- D-17 opt-out-by-default for PostHog correctly handles LGPD from day one
- Drizzle URL separation (DATABASE_URL migrations / DATABASE_POOL_URL runtime) correctly models Supavisor
- D-29 double-gate on the deliberate-error endpoint is sufficient and well-reasoned

### Agreed Concerns

1. **(HIGH)** Turbopack + `@serwist/next` production build path is unverified — need a build smoke step in Plan 11 that asserts the SW asset emits
2. **(HIGH)** D-19 OVERRIDE (native Turbopack source-map upload via `withSentryConfig`) is unverified — needs a compatibility check in Wave 0 or Plan 07 with a documented fallback
3. **(HIGH)** D-24 Sentry PII scrubbing cannot be confirmed by Playwright alone — needs a `beforeSend` unit test in Plan 07 asserting all six fields are stripped from synthetic events
4. **(MEDIUM)** PostHog smoke assertion contradicts D-17 opt-out default — needs clarification that the assertion targets server-side `posthog-node` init, not client-side capture
5. **(MEDIUM)** deploy-preview.yml missing `concurrency:` group — rapid pushes can race on Supabase branch creation

### Divergent Views

N/A — single reviewer.
