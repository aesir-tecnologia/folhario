---
phase: 1
reviewers: [claude, opencode]
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

## OpenCode Review

### Summary

Phase 1 is comprehensively specced with strong TDD discipline, well-researched patterns, and correct security/LGPD defaults. The 18-plan structure is sound, dependencies are mostly correct, and the D-19 OVERRIDE and D-28 clarifications are properly propagated. Significant risks exist around the Supabase branching API surface, the database URL vs pooler URL mix in CI, and the lack of a deterministic Sentry e2e assertion in Playwright. All are mitigable without re-planning.

### Strengths

- **TDD discipline is well-applied.** Plans 05–09 use RED→GREEN patterns with isolated pure-function unit tests that are fast, deterministic, and CI-friendly. Scrubber, PostHog config, and security-header tests are particularly strong.
- **D-19 OVERRIDE is consistently propagated.** Plans 11, 14, 15, 17 all correctly identify that `withSentryConfig` native upload replaces the explicit `sentry-cli` step. `grep` acceptance criteria explicitly exclude `sentry-cli` from all workflow files.
- **D-28 (postgres:17-alpine) is correctly applied.** `ci.yml` plan 14 uses the clarified image; `16-alpine` does not appear.
- **LGPD-13 PII scrubbing is multi-layered.** Pure scrubber functions unit-testable in plan 07, wired to all three Sentry init files, with `sendDefaultPii: false` + `Sentry.setUser({ id })` enforced. Playwright smoke fires the route but does NOT query Sentry's API for scrub verification — coverage correctly owned by plan 07 (unit) + plan 18 (manual dashboard).
- **D-14 rollback pattern is documented and enforced.** The sentinel-throw `client.begin` pattern with `TX_ROLLBACK_SENTINEL` is explicitly locked in the integration setup and verified in acceptance criteria.
- **Serwist `disable: process.env.NODE_ENV === 'development'`** correctly prevents dev SW registration from breaking HMR (Pitfall 6).
- **D-29 double guard is correct.** `mode !== 'stub' || vercelEnv !== 'preview'` returns 404 for all non-preview, non-stub combinations including unset env. The unit test covers all four branches.
- **Branch protection setup is delegated to a human-operable `gh api` document** (plan 17 Task 2) rather than making it a code artifact.
- **next-intl plugin is wired in Task 11.1** (not delegated to a prose note in Task 11.2), preventing the "executor stops after 11.1 and produces a broken build" failure mode.

### Concerns

**HIGH**

- **DATABASE_URL = DATABASE_POOL_URL in CI masks Supavisor behavior (Plan 14).** Plan 14 Task 1 sets both env vars to the same local postgres URL. `drizzle-kit migrate` runs against `DATABASE_URL` — fine, it hits the local postgres container. But `client.ts` (plan 10) uses `DATABASE_POOL_URL` at runtime; when `DATABASE_POOL_URL === DATABASE_URL` locally, runtime uses a direct connection, not the pooler. This masks the `{ prepare: false }` + Supavisor pattern correctness. If the local Docker postgres behaves differently from Supavisor (session mode vs txn mode), the CI integration tests do not exercise the production runtime path. **Mitigation:** Plan 10's acceptance criteria should note this trade-off explicitly; Phase 2 should add a Supavisor-compatible test target.

**MEDIUM**

- **Supabase branching API surface (Plans 15 and 16).** Plans 15 and 16 reference `supabase branches create pr-{N} --experimental`. The `--experimental` flag reflects a moving interface. If the Supabase CLI changes the flag surface before Phase 1 ships, both `deploy-preview.yml` and `deploy-preview-cleanup.yml` will fail. Additionally, plan 15's branch creation uses `|| true` which swallows real failures (invalid token, network error). **Mitigation:** pin the `supabase` CLI to a verified version rather than `latest`; validate the branch creation exit code separately from the "branch already exists" case.

- **Sentry release verification is non-blocking (Plan 17).** Plan 17's "Verify Sentry release" step uses `continue-on-error: true` and only emits a `::warning::` if the release has 0 artifacts. A failed upload silently passes the deploy. **Mitigation:** add a second step that fails the job if `ARTIFACT_COUNT` is 0 AND `SENTRY_AUTH_TOKEN` is non-empty (avoid false failures when token is absent locally).

- **Playwright smoke does not verify Sentry ingest (Plan 13).** The smoke asserts the HTTP status of `GET /api/v1/_test/throw` and relies on plan 07 unit tests + plan 18 manual dashboard verification for scrub coverage. If the Sentry DSN is wrong or the SDK fails to initialize silently, the smoke passes green while Sentry receives nothing. **Mitigation:** add a lightweight Sentry API poll in CI that queries `sentry.io/api/0/issues/` for the event after firing the test route, or rely exclusively on the plan 07 `beforeSend` unit tests (which are strong enough to own this coverage).

- **`test.extend` fixture spin loop is fragile (Plan 13).** The `sql.begin` + sentinel-throw + `while (!capturedTxDb)` microtask spin pattern works but could theoretically race in slow CI environments. A more robust pattern resolves a `Promise` with the `txDb` handle rather than spinning. **Mitigation:** add an explanatory comment on the `while` loop preventing future "simplification" that breaks the pattern.

- **`deploy-preview-cleanup.yml` uses `continue-on-error: true` on both steps.** This means the workflow always succeeds even if branch deletion fails for the wrong reason (invalid token, wrong project ref). **Mitigation:** capture and echo the `supabase branches delete` exit code to `$GITHUB_OUTPUT` even on failure so the workflow summary shows the attempt outcome.

**LOW**

- **`next.config.ts` type assertion may need `as NextConfig`.** The `withSerwistInit`, `withSentryConfig`, and `createNextIntlPlugin` wrappers may require `as NextConfig` on the final export for TypeScript to accept them; `satisfies NextConfig` may not work through multiple wrappers. Verify at build time.
- **`eslint-config-next@16.2.3` may not exist.** `eslint-config-next` minor versions don't always align 1:1 with Next.js patch versions. Fall back to `eslint-config-next@latest` at scaffold time if the pinned version doesn't resolve.

### Suggestions

1. **Add a local dev parity note in `.env.example`** that `DATABASE_POOL_URL === DATABASE_URL` is intentional for local Docker development (no Supavisor locally). Phase 2 should add a `docker-compose.yml` with Supavisor for local parity testing.
2. **Pin `supabase` CLI version in `deploy-preview.yml`** to the current verified version rather than `latest` to prevent a future Supabase CLI breaking the workflow unexpectedly.
3. **Add a cleanup step that echoes the exit code** after `supabase branches delete` so failures are visible in the workflow log even when `continue-on-error: true`.
4. **Add `postinstall: husky install` to `package.json`** so developers who run `pnpm install` get hooks set up automatically; the `prepare` script doesn't run in CI with `--frozen-lockfile`.
5. **Add `SENTRY_AUTH_TOKEN` empty-check in the Sentry verify step (Plan 17)** to avoid a false warning when the token is absent in local dev runs.
6. **Specify the Inngest sync mechanism in Plan 17** — one sentence naming the CLI command and confirming `INNGEST_SIGNING_KEY` is required as a GH secret.
7. **Add a lightweight API contract test for the health route** that hits `http://localhost:3000/api/v1/health` via HTTP (not module import) to test the full HTTP stack — not required Phase 1, but useful before Phase 2.

### Risk Assessment

**MEDIUM**

| Risk | Severity | Mitigation |
|------|----------|------------|
| Supabase branching API drift | MEDIUM | Pin CLI version; verify `--experimental` flag at plan-writing time |
| DATABASE_POOL_URL in CI masks Supavisor behavior | MEDIUM → HIGH | Acceptable Phase 1; Phase 2 needs Supavisor-compatible test target |
| Sentry upload non-blocking `continue-on-error` | MEDIUM | Add artifact-count check that fails job when token present but count = 0 |
| Sentry e2e ingest not automated | MEDIUM | Plan 07 `beforeSend` unit tests own this coverage; plan 18 manual check closes the gap |
| Integration test fixture spin loop | MEDIUM | Works in practice; add explanatory comment |
| `next.config.ts` type cast | LOW | Verify at build time; fix with `as NextConfig` if needed |
| `eslint-config-next` version mismatch | LOW | Fall back to `@latest`; verify at scaffold time |

The phase is well-grounded in research and the patterns from 01-RESEARCH.md are correctly applied. The TDD plans (05–09) are the strongest part of the deliverable. The main risks are CI infrastructure integration points (Supabase branching, Sentry upload verification) that are inherently harder to test deterministically without the actual external services.

---

## Consensus Summary

Two reviewers: Claude (separate session) and OpenCode.

### Agreed Strengths

- **TDD discipline on Plans 05–09** — both reviewers independently called this the strongest part of the deliverable
- **Wave structure with non-autonomous gates** at Wave 0 and Wave 5 is sound and prevents the "secrets missing on first run" failure mode
- **D-29 double-gate** (`IDENTIFICATION_PROVIDER_MODE=stub` AND `VERCEL_ENV=preview`) is sufficient and well-reasoned
- **D-19 OVERRIDE correctly propagated** through Plans 11, 14, 15, 17 — both reviewers confirmed consistency
- **LGPD/PostHog opt-out-by-default** (D-17) correctly handles the compliance requirement from day one
- **Drizzle URL separation** (DATABASE_URL for migrations / DATABASE_POOL_URL for runtime) correctly models Supavisor

### Agreed Concerns

1. **(HIGH — both)** Sentry PII scrubbing cannot be verified end-to-end by Playwright alone. **Fix:** add a `beforeSend` unit test in Plan 07 that strips all six fields from a synthetic event. This is the single most actionable finding from both reviewers.

2. **(HIGH — Claude / MEDIUM → HIGH — OpenCode)** Sentry source-map upload reliability. Claude flags the D-19 OVERRIDE assumption as unverified; OpenCode flags the `continue-on-error: true` making upload failure silent. **Fix:** (a) verify `@sentry/nextjs@10.48.x` + Turbopack source-map upload works on a throwaway build, and (b) add an artifact-count check in Plan 17 that fails the job when the token is present but upload produced zero artifacts.

3. **(MEDIUM — both)** `DATABASE_POOL_URL` in CI (postgres:17-alpine) does not exercise the Supavisor path. **Fix:** document in Plan 10 that `{ prepare: false }` is unconditional (not pooler-detected); note the parity gap in `.env.example`; defer Supavisor-compatible CI target to Phase 2.

4. **(MEDIUM — both)** Supabase branch creation in deploy-preview.yml uses `|| true` / `--experimental` with no pin and no failure-mode distinction. **Fix:** pin the Supabase CLI version and separate "branch already exists" from genuine failures.

5. **(MEDIUM — both, different angles)** PostHog smoke assertion is ambiguous. Claude notes it contradicts D-17 opt-out default; OpenCode notes the scrub verification is delegated to unit tests + manual check. **Fix:** clarify in Plan 13 that the assertion targets server-side `posthog-node` initialization, not a client-side capture event.

### Divergent Views

- **Turbopack + `@serwist/next` production build (Claude HIGH, OpenCode did not flag).** Claude considers the unverified Turbopack production SW emission path a HIGH risk requiring an explicit build smoke in Plan 11. OpenCode reviewed the same plan and did not flag it — suggesting the D-26 no-op shell + Serwist disable-in-dev pattern may be sufficient. **Recommendation:** add the Plan 11 build smoke step as a low-cost precaution regardless; it takes one acceptance criterion to add.

- **Integration test `while`-spin fixture (OpenCode MEDIUM, Claude did not flag).** OpenCode flagged the `sql.begin` + `while (!capturedTxDb)` pattern as potentially fragile. Claude accepted the D-14 rollback pattern without concern. **Recommendation:** add the explanatory comment OpenCode suggests; refactoring to `Promise`-based resolution is a nice-to-have, not a blocker.

- **`/api/inngest` hello-world function scope (Claude MEDIUM, OpenCode did not flag).** Claude considers it borderline out-of-scope per the "no Inngest function registration in Phase 1" decision. OpenCode reviewed the plan and accepted it. **Recommendation:** trim to `serve([])` with no function body, consistent with the scope boundary.

