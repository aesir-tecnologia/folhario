---
created: 2026-04-29T17:01:57.110Z
title: Investigate offline + axe + bottom-nav E2E failure cluster (7 specs)
area: testing
files:
  - tests/e2e/axe-placeholder-pages.spec.ts:59
  - tests/e2e/axe-route-focus-move.spec.ts:3
  - tests/e2e/axe-skip-to-main.spec.ts:3
  - tests/e2e/bottom-nav-scroll-restore.spec.ts:7
  - tests/e2e/offline-fallback.spec.ts:7
  - .planning/todos/pending/2026-04-29-add-dev-mode-service-worker-unregister-to-prevent-stale-cache-papercut.md
---

## Problem

The 2026-04-29 full Playwright suite run (driven from commit `42e0d8f` lineage) produced 7 functional failures clustered around PWA service-worker behavior, offline-context mocking, and accessibility/navigation invariants. None of them were touched by Plan 04-13 work — they are pre-existing failures that surfaced because this was the first full E2E run in this checkout post-Phase-4.

Failing specs:

| Spec                                        | Line | Concern                                                            |
|---------------------------------------------|-----:|--------------------------------------------------------------------|
| `tests/e2e/axe-placeholder-pages.spec.ts`   |   59 | UI-24 + W-3 — OfflineBanner pt-BR copy renders on `/` when offline |
| `tests/e2e/axe-placeholder-pages.spec.ts`   |   59 | …same on `/catalog`                                                |
| `tests/e2e/axe-placeholder-pages.spec.ts`   |   59 | …same on `/identify`                                               |
| `tests/e2e/axe-placeholder-pages.spec.ts`   |   59 | …same on `/profile`                                                |
| `tests/e2e/axe-route-focus-move.spec.ts`    |    3 | UI-03 — focus moves to `<main>` on route change                    |
| `tests/e2e/axe-skip-to-main.spec.ts`        |    3 | UI-22 — skip-to-main link is the FIRST focusable element            |
| `tests/e2e/bottom-nav-scroll-restore.spec.ts` |  7 | UI-14 — per-tab scroll preservation across bottom-nav switches     |
| `tests/e2e/offline-fallback.spec.ts`        |    7 | OFF-09 — SW navigation-fallback serves `/offline` when offline     |

Strong overlap with the SW papercut documented in `.planning/todos/pending/2026-04-29-add-dev-mode-service-worker-unregister-to-prevent-stale-cache-papercut.md` — the offline tests in particular need a clean SW state to reliably assert `context.online === false` mocks. A leftover SW from a prior `pnpm build && pnpm start` could be intercepting the fetch path that the offline mock targets.

But the cluster is almost certainly NOT one root cause. The OfflineBanner + offline-fallback failures point at SW + offline-context plumbing; the axe focus + skip-to-main failures point at route-restructure (the `(public)` group, `/auth/check-email` page added by 2852450, etc.) breaking the focus-move expectation; the bottom-nav scroll-restore failure is its own state-machine concern. These should NOT be debugged as a single mega-session.

## Solution

Three-step procedure. Do step 1 first because it cheaply tells us how many true root causes are in play.

1. **Run each spec individually + capture exact failure messages** to triage. Order matters: do the offline cluster first because those are the most likely to be SW-state contaminated, and a fresh SW unregister might fix all four `axe-placeholder-pages` instances + `offline-fallback` in one go.
   ```bash
   set -a; source .env.local; set +a
   export RESEND_API_KEY="re_test_only_local_e2e"
   export ENABLE_TEST_ROUTES=1
   pnpm exec playwright test tests/e2e/axe-placeholder-pages.spec.ts --reporter=list
   pnpm exec playwright test tests/e2e/offline-fallback.spec.ts --reporter=list
   pnpm exec playwright test tests/e2e/axe-route-focus-move.spec.ts --reporter=list
   pnpm exec playwright test tests/e2e/axe-skip-to-main.spec.ts --reporter=list
   pnpm exec playwright test tests/e2e/bottom-nav-scroll-restore.spec.ts --reporter=list
   ```
   Capture verbatim error output for each (paste into the matching `/gsd:debug` session in step 3).

2. **Land the dev-SW-unregister fix** from the sister todo (`2026-04-29-add-dev-mode-service-worker-unregister-to-prevent-stale-cache-papercut.md`) BEFORE opening the offline-cluster debug session. The new `<DevSwUnregister />` component runs in dev only, but `pnpm start` (which Playwright uses) is `NODE_ENV=production` — so the dev guard does NOT help directly. Instead, augment `tests/e2e/global-setup.ts` to call `await page.evaluate(() => navigator.serviceWorker.getRegistrations().then(rs => Promise.all(rs.map(r => r.unregister()))))` once before the suite starts, OR use Playwright's `storageState` reset between specs. This puts every spec on the same SW baseline regardless of prior runs. If after this the offline cluster passes, the root cause was simply SW contamination.

3. **Open one `/gsd:debug` session per remaining cluster** with the symptoms captured in step 1:
   - **`offline-banner-not-rendering`** — if `axe-placeholder-pages.spec.ts:59` still fails after step 2; isolated to the OfflineBanner mount race vs offline-context mock activation.
   - **`axe-focus-on-route-change`** — single root cause likely shared by `axe-route-focus-move` + `axe-skip-to-main`; suspect candidates: the new `(public)/auth/check-email/page.tsx` (commit 2852450) introducing a layout that doesn't move focus, or a `tabindex` regression from a Phase 3 `<DevSwUnregister />` placeholder.
   - **`bottom-nav-scroll-restore`** — its own concern; UI-14 wants per-tab scroll memory across switches and is likely state-machine drift unrelated to the others.

   Each session should be opened as `--diagnose` first (find root cause without committing to a fix), get the verdict, then either ship the fix in-session or escalate.

## Why this is a todo, not seven debug sessions right now

I lost an hour to the SW-cache papercut earlier today (see commit `2852450` body). Spawning seven debug sessions back-to-back would burn context that's better spent doing the cheap triage in step 1 first — the SW unregister might collapse 5 failures into 0, and then the remaining 2 are quick targeted debugs. Capture the lineage here so the next session has the symptom register, the most-likely root-cause hypotheses, and the recommended cluster split — instead of starting cold.
