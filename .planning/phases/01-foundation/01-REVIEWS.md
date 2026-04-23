---
phase: 1
reviewers: [claude, codex]
reviewed_at: 2026-04-23T00:00:00Z
plans_reviewed:
  - 01-01-PLAN.md
  - 01-02-PLAN.md
  - 01-03-PLAN.md
  - 01-04-PLAN.md
  - 01-05-PLAN.md
  - 01-06-PLAN.md
  - 01-07-PLAN.md
  - 01-08-PLAN.md
caveats:
  - Claude CLI ran from inside Claude Code in a SEPARATE SESSION (fresh context, no access to this planning conversation). Same model family means less divergence than Gemini/Codex would provide.
  - Codex CLI (codex-cli 0.122.0) ran with --sandbox read-only and is a genuinely different model family. Treat Claude + Codex as approximate cross-model consensus.
---

# Cross-AI Plan Review — Phase 1

## Claude Review

# Phase 1 Foundation — Cross-AI Plan Review

## Summary

This is a well-researched, carefully sequenced 8-plan Wave DAG that scaffolds Next 16 + local Supabase + CI-only observability from zero. Landmines L-1 (proxy.ts), L-2 (sendDefaultPii), L-3 (hand-rolled PostHog) are all addressed correctly. The LGPD-13 scrubbing contract gets load-bearing TDD coverage in Plan 05. The plans are thorough and defensive, with explicit cross-plan mutation notes and threat models throughout. The most material gap is that **ROADMAP Success Criterion #4 is not actually met by the automated smoke**: Playwright cannot intercept server-originated Sentry/PostHog traffic, so "both verified automatically" degrades to "client verified automatically + server acknowledged". A few smaller issues (eslint-flat-config API assumption, OBS-05 silent deferral, cross-plan file edits) deserve attention before execution.

## Strengths

- **Landmine hygiene**: L-1 enforced at the `grep -q "export default function proxy"` verification level (01-03), L-2 pins `sendDefaultPii: false` across all three Sentry init files (01-05), L-3 has a `! grep -q '"@posthog/next"' package.json` gate (01-06).
- **TDD where it matters**: 01-05 Task 1 writes 12 behavior tests for `makeBeforeSend` before implementation — LGPD-13 is treated as a legal contract encoded in tests, not an afterthought.
- **Explicit wave dependencies + `depends_on:` arrays** make the DAG legible. Plan 07's `[02, 03, 05, 06]` correctly reflects that it consumes errors, env, Sentry init, and PostHog providers.
- **Threat modeling per plan** (STRIDE tables with dispositions) catches CVE-2025-65944, secret-leak vectors, and the diagnostics-route production-exposure threat.
- **Human checkpoints placed correctly**: 01-04 Task 3 (local Docker stack is un-CI-able) and 01-08 Task 3 (GitHub Actions secrets are out-of-repo). Not over-used.
- **Scrub module single-sourced** via `sentry-scrub.ts` consumed by server/edge/client init files (SP-3 pattern) — avoids drift.
- **CI pipeline avoids Pitfall 7** (no `SENTRY_AUTH_TOKEN` in build step → no accidental source-map upload before Phase 12).

## Concerns

### HIGH

- **[SC-4 gap] Playwright smoke does NOT automatically verify the server-side ping.** ROADMAP SC-4 says "a PostHog ping event fires from both the client and `posthog-node` server and lands in the PostHog US project — both verified automatically by the Playwright smoke." Plan 07 explicitly concedes "CI verifies the server event separately by logging into the PostHog project dashboard (manual verification deferred to Plan 08 SUMMARY)." Same gap exists for the server-side Sentry envelope from `/api/v1/_diagnostics/ping`. The Plan 05 unit test covers the scrub *rule* but not the *transport*. As written, Phase 1 cannot claim SC-4 is met automatically.
- **[eslint flat config API assumption] `eslint.config.mjs` uses `[...next(), prettier]`.** The syntax assumes `eslint-config-next` v16 exports a callable that returns an array. Current public `eslint-config-next` flat-config API (as of the v15/v16 transition) exports a config *array* directly, not a function. If the real v16 API differs, `pnpm lint` will throw on the first CI run. Recommend verifying the exact import/spread shape against `eslint-config-next@16.2.4` docs or a fresh `create-next-app` output BEFORE committing.
- **[OBS-05 silent deferral]** REQUIREMENTS.md maps OBS-05 (alert rules) to Phase 1. VALIDATION.md (line 63) marks OBS-05 "Deferred" with no CONTEXT.md entry justifying the defer. Plan 05 SUMMARY mentions "alerting rules out of scope Phase 1; deferred to Phase 4." This is a unilateral scope cut that should be approved by the user before execution, or surfaced into CONTEXT.md "Deferred Ideas".

### MEDIUM

- **Cross-plan file mutations create implicit DAG edges not in `depends_on`**:
  - 01-02 Task 3 modifies `vitest.config.ts` (created by 01-01) to add `setupFiles`.
  - 01-05 Task 3 rewrites `src/instrumentation.ts` (created by 01-03) to remove try/catch guards.
  - 01-06 Task 2 rewrites `src/app/layout.tsx` (created by 01-03) to add `<PostHogProvider>`.
  - 01-08 Task 2 edits `.planning/REQUIREMENTS.md`.
  These are documented inline but not surfaced in a single manifest. In worktree-mode parallel execution, any two plans in the same wave touching the same file would conflict. Wave 3 (05 + 06) both downstream-edit Wave 2 artifacts but are themselves independent — acceptable. Worth capturing in a phase-level file-ownership matrix.
- **Wave 2 cross-plan race on `pnpm build`**: 01-03 Task 3 Step 4 runs `pnpm build` with env stubs. If 01-02 hasn't yet committed `src/shared/config/env.ts`, and any file 01-03 ships imports from `@shared/config/*` (it doesn't today — but check `src/instrumentation.ts`, `src/proxy.ts`, layout.tsx), the build will fail. Currently safe, but one accidental `import { serverEnv } from "@shared/config/env"` added during execution would silently break the wave. Consider moving 01-03's build verification to after 01-02 lands, or having 01-03 `depends_on: [01, 02]` defensively.
- **Dependency version pins may not exist**: `typescript@6`, `eslint@10`, `lint-staged@16`, `@types/node@22`, `@commitlint/cli@20` are all *past* the currently-published majors as of late 2025. Assuming project date 2026-04-23 is real, these may be valid — but the plan's "if pnpm errors… fall back to latest patch within same major" is a silent-drift vector. Recommend pinning to exact patches from `npm view <pkg> dist-tags` at scaffold time, not just majors.
- **Plan 07's Sentry E2E is CI-gated** (`if (process.env.CI)` around envelope count assertion). Local `pnpm test:e2e` passes trivially with 0 envelopes. This means a regression that *disables* Sentry entirely locally is invisible until CI. Consider either (a) a local-mode assertion that DSN absence → no envelopes *intended*, or (b) a test fixture DSN that points at a Playwright-controlled mock endpoint.
- **Task 4 Hook verification in 01-01** uses `git stash push + commit + cleanup` which can leave the repo in inconsistent state if the assertion fails mid-way. Replace with `echo "bad message" | pnpm exec commitlint --stdin --strict` — stateless, deterministic, no stash required.
- **`.env.example` inconsistency**: Plan 01-01 Task 3 says observability vars are "Empty values intentionally" but then sets `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com` (non-empty). Minor but the Plan 02 secret-pattern test would also not catch a real POSTHOG key here.
- **Playwright `webServer.url: /__diag`** (set in 01-01) means `pnpm test:e2e` locally fails *every wave before 07 lands* because the probe 404s. A developer running E2E between Plans 01 and 07 will see misleading failures. Consider a Wave-0 stub `/__diag` that just returns `ok` until 07 replaces it, or use `/` as the probe URL and move the stub-mode guard into the test fixtures.

### LOW

- **Plan 04 integration test** uses `describe.skipIf(!dbUrl)` — safe by default, but if a dev accidentally has `DATABASE_POOL_URL` pointing at a real Supabase instance in their shell, `SELECT 1` succeeds against prod. Add a hostname guard (`if (/supabase\.co/.test(dbUrl)) throw new Error("Refusing to run integration tests against cloud Supabase")`).
- **`next.config.ts` reads `SENTRY_*` from `process.env` directly** rather than from Plan 02's typed `serverEnv`. Correct by necessity (next.config evaluates before module-load parsing), but worth a comment.
- **Plan 05 is marked `type: tdd`** in frontmatter but only Task 1 follows RED→GREEN; Tasks 2 and 3 are `type="auto"`. Per `tdd.md` the plan type implies the whole plan is TDD — split into two plans (`01-05a tdd` + `01-05b execute`) or re-label.
- **Plan 02 `errorResponse` tests assert content-type = `application/json`** but the implementation uses `"content-type"` lowercase key. Headers are case-insensitive but the literal string check in the test passes because JS Headers normalizes. Still, clearer to use `res.headers.get("content-type")` everywhere.
- **Plan 07 `/api/v1/_diagnostics/ping` exports a GET handler** that's never exercised by E2E. Either exercise it or drop it.
- **Plan 08 `actions/checkout@v5`, `setup-node@v5`** — `setup-node@v5` is not yet released (v4 is current). Verify version availability at scaffold time.

## Suggestions

1. **Close the SC-4 gap** by adding a local HTTP relay in CI that proxies Sentry/PostHog ingest, captures request bodies, and is asserted against by a new Playwright spec. Alternatively, run `mitmproxy` as a sidecar and parse its flow log. Without this, Phase 1's headline observability claim relies on manual dashboard checks.
2. **Surface OBS-05 deferral** into 01-CONTEXT.md "Deferred Ideas" with user sign-off before executing Plan 05.
3. **Validate `eslint-config-next@16.2.x` flat-config shape** via `pnpm create next-app@16 tmp-next-check` + read its `eslint.config.mjs` output. If the API differs from `[...next(), prettier]`, fix 01-01 Task 2 Step 2 BEFORE Wave 1.
4. **Add a File Ownership Matrix** to 01-CONTEXT.md or a new `01-FILE-MATRIX.md`:
   ```
   vitest.config.ts           — created: 01-01; edited: 01-02
   src/instrumentation.ts     — created: 01-03; edited: 01-05
   src/app/layout.tsx         — created: 01-03; edited: 01-06
   .planning/REQUIREMENTS.md  — edited: 01-08
   ```
   Makes worktree-merge conflicts diagnosable and prevents silent cross-plan drift.
5. **Make Plan 03 depend on Plan 02 explicitly** (`depends_on: [01, 02]`) to prevent Wave 2 race on the `pnpm build` step.
6. **Pin exact patch versions at scaffold time** — add a 01-01 Task 0 sub-step that runs `npm view <pkg>@<major> version` and records the resolved patches in a `01-01-SUMMARY.md` table.
7. **Replace Plan 01 Task 4 Step 5** with the stateless `echo "bad message" | pnpm exec commitlint --stdin --strict` pattern.
8. **Plan 07: add a local-mode Sentry assertion** that empty DSN → zero envelopes (catches the "Sentry entirely broken locally" regression).
9. **Plan 04 integration test**: add a hostname-allowlist guard against `supabase.co` URLs.
10. **Consider splitting Plan 05** into `05a-sentry-scrub-tdd` and `05b-sentry-init-wiring` for cleaner type semantics and summary clarity.
11. **Plan 07 `webServer.url` probe**: Change to `/` (always 200) and move the stub-mode check entirely into route handlers + server layout guards. Avoids Plan 1–7 inter-state E2E failure.

## Risk Assessment

**MEDIUM** — The plans are execution-ready with disciplined research, correct landmine handling, and strong test coverage for the legal-critical LGPD-13 path. Risk is driven by:

- **One material success-criterion gap** (SC-4 server-side transport not auto-verified) that users should accept/close before phase start.
- **Three pre-flight-verifiable assumptions** (eslint flat-config syntax, TypeScript 6 / ESLint 10 / setup-node@v5 availability) that could break Wave 1 before any substantive work lands.
- **Implicit cross-plan file ownership** that, while documented inline, isn't surfaced in a single audit-ready matrix — meaning parallel execution risk is latent.
- **OBS-05 quietly deferred** — should be user-confirmed.

None of these are blockers; all are resolvable with 30–60 minutes of pre-execution validation. If the eslint config syntax verifies, the scope-cut (OBS-05) gets user sign-off, and SC-4's "automatic" wording either relaxes or gains a relay spec, the risk profile drops to LOW.

---

## Codex Review

## Summary

Phase 1 is well-scoped and mostly coherent: the plans establish a usable foundation, the wave ordering is mostly sane, and the landmines are explicitly carried through (`proxy.ts`, `sendDefaultPii: false`, hand-rolled PostHog). The main problem is not lack of detail but a few contract mismatches between the roadmap success criteria and the implementation plans. In particular, the current plans do not fully prove the server-side observability path automatically in CI, and the security-header approach does not satisfy the stated "every response" requirement. There are also a couple of planning inconsistencies that will create avoidable execution friction.

## Strengths

- The phase boundary is disciplined. Phase 1 stays focused on local runnable foundation, CI, basic observability wiring, and guards against accidental provider spend.
- Landmine handling is strong:
  - `01-03-PLAN.md` correctly switches to `src/proxy.ts` and names the export `proxy` (L-1).
  - `01-05-PLAN.md` correctly sticks with `sendDefaultPii: false` and avoids the unreleased `dataCollection` API (L-2).
  - `01-06-PLAN.md` correctly forbids `@posthog/next` and uses raw `posthog-js` / `posthog-node` (L-3).
- `01-02-PLAN.md` is the best-designed plan in the set. The error registry and env validation are contract-first, test-first, and give later phases a stable base.
- Security thinking is generally good for ASVS L1:
  - Sentry scrub rules are centralized in one module.
  - Diagnostics routes are gated by environment and additionally hidden from crawlers.
  - Internal error codes are redacted before crossing the client boundary.
- CI composition in `01-08-PLAN.md` is pragmatic and intentionally excludes deploy concerns and source-map upload, which matches the stated phase boundary.
- The plans consistently distinguish what is automated vs what requires human verification. That is useful and realistic for Docker- and dashboard-dependent setup.

## Concerns

- **HIGH**: `01-07-PLAN.md` does not actually satisfy Roadmap Success Criterion 4.
  - The roadmap says the Sentry error and both client + server PostHog pings are "verified automatically by the Playwright smoke."
  - `01-07-PLAN.md` explicitly concedes that Playwright cannot assert the server-side Sentry envelope or the server-side PostHog event and falls back to client-only assertions plus manual dashboard inspection.
  - `01-08-PLAN.md` keeps that gap by moving server verification to a human checkpoint.
  - Result: the phase as planned does not fully achieve the success criterion it claims to close.

- **HIGH**: `01-03-PLAN.md` / `01-07-PLAN.md` do not meet the "security headers apply to every response" contract.
  - `src/proxy.ts` in `01-03-PLAN.md` excludes `/api/*`, `_next`, and all static assets via the matcher.
  - That means `/api/v1/_diagnostics/ping`, `/manifest.webmanifest`, `/sw.js`, and `robots.txt` will not get the headers from `proxy.ts`.
  - `01-07-PLAN.md` only tests headers on `GET /`.
  - This is materially weaker than both the roadmap wording and the requirement phrasing.

- **HIGH**: The env-module design in `01-02-PLAN.md` is unsafe for client imports.
  - `src/shared/config/env.ts` exports both `serverEnv` and `clientEnv`, and it parses `serverEnv` at module load.
  - `01-06-PLAN.md` imports `clientEnv` into `src/shared/telemetry/posthog-client.ts`, which is used from a client component.
  - That couples browser code to server-only env parsing and risks build/runtime issues. At minimum it creates an unnecessary shared boundary; in the worst case it breaks client bundling or leaks assumptions into the client graph.
  - This should be split into server-only and client-only env modules.

- **MEDIUM**: `next-env.d.ts` handling is internally inconsistent.
  - `01-01-PLAN.md` adds `next-env.d.ts` to `.gitignore`.
  - `01-03-PLAN.md` lists `next-env.d.ts` under `files_modified`, creates it manually, and verifies its existence.
  - If it is intentionally ignored, it should not be treated like a tracked artifact. If it is intended to be tracked, it should not be ignored.
  - This is a clear planning inconsistency that will confuse execution and summaries.

- **MEDIUM**: `01-01-PLAN.md` has inconsistent env-var counts.
  - It says `.env.example` contains 18 variables.
  - The listed keys total 19.
  - `01-02-PLAN.md` then switches to 19.
  - This will cause flaky verification or pointless churn.

- **MEDIUM**: `OBS-05` is declared as Phase 1 scope but not actually implemented in these plans.
  - The roadmap and requirement list include `OBS-05`.
  - `01-05-PLAN.md` mentions alerting, but the actual alert rules and operator-email path are deferred.
  - `01-08-PLAN.md` does not provision or verify alerting.
  - If the intent is "partial groundwork only," the requirement mapping should say that explicitly, otherwise this phase claims more than it ships.

- **MEDIUM**: `01-04-PLAN.md` adds `postgres@3` as a dev dependency, but the architectural posture implies it will become a runtime dependency almost immediately.
  - This is not wrong for Phase 1, but it creates avoidable dependency churn one phase later.
  - If the repo is already establishing the canonical DB driver choice, there is little value in classifying it as dev-only first.

- **LOW**: The plan set is over-specified in places that do not materially reduce risk.
  - Example: several plans prescribe exact file contents, exact commands, exact summary formats, and commit shapes.
  - That increases maintenance cost when one upstream package or convention changes.
  - The TDD plans justify some of this, but the execute plans could be a bit looser.

- **LOW**: The roadmap excerpt says "Plans: 8 plans" but only lists 7 plan filenames.
  - The review packet includes `01-08-PLAN.md`, so the roadmap list is stale.
  - Minor, but it signals traceability drift.

## Suggestions

- Split env handling before implementation:
  - `src/shared/config/server-env.ts`
  - `src/shared/config/client-env.ts`
  - Keep parsing isolated to the side that owns the variables.
  - Make client telemetry modules import only the client env module.

- Change the security-header strategy so it actually covers all required responses.
  - Keep locale handling in `src/proxy.ts` if needed.
  - Move headers to `next.config.ts headers()` or otherwise ensure pages, API routes, and static file responses all get them.
  - Then expand `tests/e2e/security-headers.spec.ts` to cover `/`, `/api/v1/_diagnostics/ping`, and one static asset like `/manifest.webmanifest`.

- Rework observability verification so server-side transport is automatically testable in CI.
  - Best option: point Sentry/PostHog server traffic at a local mock collector during Playwright runs, then assert both client and server payloads from that collector.
  - If that is too much for Phase 1, downgrade the roadmap success criterion now instead of pretending it is automated.

- Fix the `next-env.d.ts` contradiction.
  - Either remove it from `.gitignore` and track it intentionally, or stop listing it as a tracked artifact and let Next generate it locally/CI-only.

- Normalize the `.env.example` key count across `01-01-PLAN.md` and `01-02-PLAN.md`.
  - Pick 19 and make every verify block use the same number.

- Reconcile `OBS-05` with what is actually shipping.
  - Either remove it from Phase 1, or explicitly define the Phase 1 deliverable as "Sentry foundation only; alert rules deferred."
  - Right now the traceability is overstated.

- Simplify the CI/human split in `01-08-PLAN.md`.
  - The workflow should be the acceptance gate.
  - External dashboard inspection is useful, but if it is required to declare success, the phase is not truly CI-verified.

## Risk Assessment

**Overall risk: MEDIUM**

The phase is close to executable and the sequencing is mostly sound, but there are two substantive gaps against the stated acceptance bar: automatic verification of server-side observability, and security headers on "every response." Those are not cosmetic issues; they affect whether the phase truly meets Roadmap Success Criteria 4 and 5. The rest of the concerns are fixable planning inconsistencies rather than architectural failures, so I would not rate the phase as high risk, but I would not start implementation without tightening those contracts first.

---

## Consensus Summary

Two reviewers: **Claude CLI** (separate session, same model family) + **Codex CLI** (different model family). Treat overlap as approximate cross-model consensus.

### Agreed Strengths (both reviewers)

- **Landmine compliance:** L-1 `proxy.ts` export, L-2 `sendDefaultPii: false`, L-3 no `@posthog/next` — both reviewers verified the verification-level grep gates.
- **Load-bearing LGPD-13 TDD in Plan 05:** both called out the scrub contract as correctly encoded in tests before implementation.
- **Scoped phase boundary:** both recognized the phase stays focused on local-dev foundation without drifting into deploy/Drizzle/Inngest/Stripe scope.
- **CI composition:** both flagged Plan 08's intentional exclusion of source-map upload as correct for Phase 1.

### Agreed Concerns (both reviewers, HIGH)

1. **SC-4 server-side transport not auto-verified by Playwright.** Plans 07 + 08 concede server-originated Sentry/PostHog events require dashboard checks. Roadmap wording says "both verified automatically." This is the headline gap — user decision needed.
2. **OBS-05 silent deferral.** Phase 1 claims OBS-05 (alert rules) as in-scope but no plan implements it. Must either add implementation tasks to Plan 05 OR log deferral in CONTEXT.md `## Deferred Ideas` with user sign-off.

### Divergent / Codex-only (not caught by Claude)

- **HIGH — Security-header coverage gap:** Codex noticed `src/proxy.ts`'s matcher excludes `/api/*`, `_next`, and static assets. That means `/api/v1/_diagnostics/ping`, `/manifest.webmanifest`, `/sw.js`, and `robots.txt` get no headers, and Plan 07 only tests headers on `GET /`. Success Criterion #5 says "standard security headers apply to every response" — plans as written don't meet it. **User decision needed.**
- **HIGH — Client-bundle env import risk:** Codex flagged that `src/shared/config/env.ts` parses `serverEnv` at module load but `01-06` imports `clientEnv` from the same module into a client component. Risk: breaks client bundling or leaks server-only parsing into the browser graph. Suggestion: split into `server-env.ts` + `client-env.ts`.
- **MEDIUM — `next-env.d.ts` contradiction:** 01-01 `.gitignore`'s it, 01-03 manually creates it + lists in `files_modified`. Contradictory.
- **MEDIUM — `.env.example` variable count drift:** 01-01 says 18 vars, 01-02 says 19. Fix: normalize both to one count.
- **MEDIUM — `postgres@3` as devDependency in 01-04:** will become runtime dep in Phase 2; avoidable churn.

### Divergent / Claude-only (not caught by Codex)

- **HIGH — eslint-config-next@16 flat-config shape:** Claude flagged `[...next(), prettier]` syntax assumes a callable; v16 API may export array directly. Pre-flight spike needed.
- **MEDIUM — Cross-plan file mutations not in `depends_on`:** vitest.config.ts (01-01→02), instrumentation.ts (01-03→05), layout.tsx (01-03→06), REQUIREMENTS.md (01-08). No single matrix surfaces this.
- **MEDIUM — Wave 2 `pnpm build` race:** 01-03 depends on 01 only; should add 02 defensively.
- **MEDIUM — Dependency version pins** may not exist (`typescript@6`, `eslint@10`, `lint-staged@16`, `@types/node@22`, `@commitlint/cli@20`).
- **MEDIUM — Plan 07 Sentry E2E CI-gated only** (local runs pass trivially with 0 envelopes).
- **MEDIUM — Plan 01 Task 4 commitlint verification** uses stateful `git stash` loop — replace with stateless `commitlint --stdin --strict`.
- **MEDIUM — Playwright webServer probe at `/__diag`** — 404s between Plans 1–7.
- **LOW — Plan 04 cloud-Supabase hostname guard missing.**
- **LOW — Plan 05 `type: tdd` semantics:** only Task 1 is TDD; Tasks 2+3 are `type="auto"`. Consider splitting into 05a + 05b.
- **LOW — Plan 08 `actions/checkout@v5` + `setup-node@v5`** — v5 of setup-node not yet released.

---

## Prioritized Action List

Ordered by severity and ease of fix — for use with `/gsd-plan-phase 1 --reviews`:

### Must resolve before execution

1. **HIGH — SC-4 auto-verification gap (BOTH reviewers)** — user decision: (a) accept + amend ROADMAP SC-4 to split client (auto) vs server (dashboard), OR (b) add a CI-local HTTP mock collector spec (mitmproxy or local ingest sidecar) that intercepts both client + server envelopes.
2. **HIGH — OBS-05 deferral (BOTH reviewers)** — either (a) add alert-rule implementation tasks to Plan 05, or (b) log in CONTEXT.md `## Deferred Ideas` with explicit user sign-off. **User decision required.**
3. **HIGH — Security-header coverage (Codex)** — widen `proxy.ts` matcher OR move headers to `next.config.ts headers()` to cover `/`, `/api/*`, static assets (`/manifest.webmanifest`, `/sw.js`, `robots.txt`). Expand `tests/e2e/security-headers.spec.ts` accordingly. SC-5 ships at risk otherwise.
4. **HIGH — Client/server env module split (Codex)** — split `src/shared/config/env.ts` into `server-env.ts` (parses server-only vars) + `client-env.ts` (parses only `NEXT_PUBLIC_*`). Update 01-02 Task 2 and 01-06 imports.
5. **HIGH — eslint-config-next@16 flat-config shape (Claude)** — pre-flight spike: `pnpm create next-app@16.2.4 /tmp/next-check` and inspect generated `eslint.config.mjs`. Fix 01-01 Task 2 Step 2 import pattern if needed.

### Should resolve (low cost, high payoff)

6. **MEDIUM — `next-env.d.ts` contradiction (Codex)** — either track or ignore consistently; remove from 01-03 `files_modified` OR remove from 01-01 `.gitignore`.
7. **MEDIUM — `.env.example` var-count drift (Codex)** — normalize 01-01 and 01-02 to the same count.
8. **MEDIUM — Plan 03 `depends_on: [01, 02]` (Claude)** — defensive edge to prevent Wave 2 build race.
9. **MEDIUM — File-ownership matrix (Claude)** — add `01-FILE-MATRIX.md` listing cross-plan edits (vitest.config.ts, src/instrumentation.ts, src/app/layout.tsx, REQUIREMENTS.md).
10. **MEDIUM — Plan 01 Task 4 Step 5 commitlint (Claude)** — replace stash-based check with `echo "bad message" \| pnpm exec commitlint --stdin --strict`.
11. **MEDIUM — Playwright webServer probe URL (Claude)** — change default from `/__diag` to `/`; move stub-mode guard into route handlers only.
12. **MEDIUM — Pin exact patch versions (Claude)** — add 01-01 sub-step that runs `npm view <pkg>@<major> version` and records resolved patches.
13. **MEDIUM — Plan 07 local-mode Sentry assertion (Claude)** — empty DSN → zero envelopes sanity check.
14. **MEDIUM — `postgres@3` runtime-vs-dev (Codex)** — install as production dep in 01-04 to avoid Phase 2 churn.

### Nice to have

15. **LOW — Plan 04 cloud-Supabase hostname guard (Claude)** — refuse integration run against `supabase.co` URLs.
16. **LOW — Plan 05 type semantics (Claude)** — split into `05a tdd` + `05b execute` for cleaner frontmatter.
17. **LOW — Plan 02 `.env.example` POSTHOG_HOST blank vs non-blank (Claude)** — decide + align with secret-pattern test.
18. **LOW — Plan 07 unused GET handler (Claude)** on `/api/v1/_diagnostics/ping` — either exercise or drop.
19. **LOW — Plan 08 `actions/checkout@v5` + `setup-node@v5` (Claude)** — verify v5 of setup-node is released at scaffold time (v4 is current stable).
20. **LOW — ROADMAP Phase 1 plan list stale (Codex)** — shows 7 plan filenames but 8 exist. Update.
21. **LOW — Plans over-specified in places (Codex)** — execute plans could be looser on exact commit shapes / summary formats.

---

**To incorporate feedback into planning:**

```
/gsd-plan-phase 1 --reviews
```
