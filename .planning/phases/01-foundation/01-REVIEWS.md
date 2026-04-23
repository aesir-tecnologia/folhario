---
phase: 1
reviewers: [claude]
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
caveat: |
  /gsd-review was invoked with --claude from inside Claude Code. The claude CLI
  spawned a SEPARATE SESSION (fresh context, no access to this planning
  conversation) so it is somewhat adversarial — but same model family means
  less divergence than a Gemini/Codex cross-review would provide. Future
  reviews should include --gemini and/or --codex when those CLIs are installed.
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

## Consensus Summary

Only one reviewer (Claude CLI, separate session) was invoked this round. Treat this as a single-source review rather than cross-model consensus. For multi-model consensus, re-run with `--gemini` and/or `--codex` once those CLIs are installed.

### Agreed Strengths

*(single-reviewer — strengths listed in the Claude Review above)*

### Agreed Concerns

*(single-reviewer — concerns listed in the Claude Review above)*

### Divergent Views

*(not applicable with one reviewer)*

---

## Prioritized Action List

Ordered by severity and ease of fix — for use with `/gsd-plan-phase 1 --reviews`:

### Must resolve before execution

1. **HIGH — OBS-05 deferral** — surface to user and either (a) add implementation tasks to Plan 05, or (b) log in CONTEXT.md `## Deferred Ideas` with explicit user sign-off. **User decision required.**
2. **HIGH — eslint-config-next v16 flat-config shape** — spike: `pnpm create next-app@16.2.4 /tmp/next-check` and inspect generated `eslint.config.mjs`. Update Plan 01-01 Task 2 Step 2 import pattern if needed.
3. **HIGH — SC-4 auto-verification gap** — user decision: (a) accept the documented limitation + amend ROADMAP SC-4 wording to split client (auto) vs server (dashboard check), OR (b) ship a CI-local HTTP relay spec (mitmproxy or mock ingest sidecar) that intercepts both client + server envelopes.

### Should resolve (low cost, high payoff)

4. **MEDIUM — Plan 03 `depends_on: [01, 02]`** — defensive edge to prevent Wave 2 build race.
5. **MEDIUM — File-ownership matrix** — add `01-FILE-MATRIX.md` or append to CONTEXT.md Integration Points listing cross-plan edits (vitest.config.ts, src/instrumentation.ts, src/app/layout.tsx, REQUIREMENTS.md).
6. **MEDIUM — Plan 01 Task 4 Step 5 commitlint verification** — replace stash-based check with `echo "bad message" \| pnpm exec commitlint --stdin --strict`.
7. **MEDIUM — Playwright webServer probe URL** — change `webServer.url` default from `/__diag` to `/` in Plan 01's playwright.config.ts; move stub-mode guard into route handlers only.
8. **MEDIUM — Pin exact patch versions** — add a 01-01 sub-step that runs `npm view <pkg>@<major> version` and records resolved patches in 01-01-SUMMARY.md.
9. **MEDIUM — Plan 07 local-mode Sentry assertion** — empty DSN → zero envelopes sanity check.

### Nice to have

10. **LOW — Plan 04 cloud-Supabase hostname guard** — refuse integration run against `supabase.co` URLs.
11. **LOW — Plan 05 type semantics** — split into `05a tdd` + `05b execute` for cleaner frontmatter.
12. **LOW — Plan 02 `.env.example` POSTHOG_HOST blank vs non-blank** — decide + align with secret-pattern test.
13. **LOW — Plan 07 unused GET handler** on `/api/v1/_diagnostics/ping` — either exercise or drop.
14. **LOW — Plan 08 actions/checkout@v5 + setup-node@v5 version availability** — verify at scaffold.

---

**To incorporate feedback into planning:**

```
/gsd-plan-phase 1 --reviews
```
