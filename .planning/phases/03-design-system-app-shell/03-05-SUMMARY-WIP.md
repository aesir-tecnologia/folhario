---
phase: 03-design-system-app-shell
plan: 05
subsystem: testing
tags: [e2e, playwright, axe, visual-snapshots, accessibility, pwa, service-worker]

requires:
  - phase: 03-design-system-app-shell
    provides: "Plans 01-04 design tokens, primitives, app-shell + 5 placeholder routes, ModalSheet (test) harness, OfflineBanner, AppUpdateToast, /offline composed empty-state, BottomNav scroll-restore"
provides:
  - "10 E2E spec files exercising the visual + a11y + PWA-fallback contract for Phase 3"
  - "playwright.config.ts extended with toHaveScreenshot defaults (animations: disabled, maxDiffPixels: 100)"
  - "tests/e2e/__screenshots__/ directory committed (Task 2 will populate baselines via Docker)"
affects: [phase-04-onboarding-consent, phase-05-home-today, all-future-feature-phases]

tech-stack:
  added: []
  patterns:
    - "Playwright visual-snapshot matrix (5 routes x 4 [colorScheme, reducedMotion] combos = 20 baselines)"
    - "@axe-core/playwright AxeBuilder with serious + critical filter; moderate warn-logged"
    - "SW navigation-fallback verification via uncached route + context.setOffline (HIGH 3 codex review pattern)"

key-files:
  created:
    - "tests/e2e/visual-snapshots.spec.ts"
    - "tests/e2e/horizontal-scroll-guard.spec.ts"
    - "tests/e2e/offline-fallback.spec.ts"
    - "tests/e2e/bottom-nav-scroll-restore.spec.ts"
    - "tests/e2e/axe-placeholder-pages.spec.ts"
    - "tests/e2e/axe-modal-focus-trap.spec.ts"
    - "tests/e2e/axe-route-focus-move.spec.ts"
    - "tests/e2e/axe-skip-to-main.spec.ts"
    - "tests/e2e/__screenshots__/.gitkeep"
    - ".planning/phases/03-design-system-app-shell/deferred-items.md"
  modified:
    - "playwright.config.ts"

key-decisions:
  - "Per SCOPE BOUNDARY rule, pre-existing lint errors/warnings in Plan 02-04 files were NOT auto-fixed by Plan 05; logged in deferred-items.md for follow-up"
  - "Reworded comment in offline-fallback.spec.ts to avoid literal 'page.goto(\"/offline\")' string so the plan's grep-based negative check passes (intent preserved)"

patterns-established:
  - "Visual snapshot matrix loops [routes x combos] with data-snapshot-mask='true' for volatile regions"
  - "SW offline test sequence: navigate ONLINE -> waitForFunction(navigator.serviceWorker.ready) -> setOffline(true) -> goto UNCACHED route -> assert /offline content"
  - "axe spec moderate-only violations are warn-logged to stdout, not failed"

requirements-completed: []  # Pending Task 2 (Docker baselines) + Task 3 (full e2e green) before flipping any requirement IDs.

duration: in-progress
completed: pending-task-2-and-3
---

# Phase 03 Plan 05: E2E Visual + A11y Lockdown — WIP

**Plan paused at Task 2 (`checkpoint:human-action`) — Docker-based visual-snapshot baseline generation requires user supervision per Open Risk #5.**

## Status

- [x] Task 1 — 10 E2E spec files committed (`b0c48cd`)
- [ ] Task 2 — `checkpoint:human-action` — awaiting human-supervised `pnpm visual:baseline:docker` run
- [ ] Task 3 — full e2e suite green + VALIDATION.md sign-off (gated behind Task 2)

## Performance (so far)

- **Started:** 2026-04-27T17:15:00Z
- **Last activity:** 2026-04-27T20:22:36Z
- **Tasks complete:** 1 of 3
- **Files added:** 10
- **Files modified:** 1

## Accomplishments (Task 1)

- 8 E2E spec files authored covering UI-03, UI-14, UI-21, UI-22, UI-25, OFF-09, plus a W-3 OfflineBanner pt-BR copy verification block embedded in `axe-placeholder-pages.spec.ts`
- `playwright.config.ts` extended with `expect.toHaveScreenshot` defaults (animations: disabled, maxDiffPixels: 100) AND `NEXT_PUBLIC_ENABLE_TEST_ROUTES=1` env so the (test)/modal-sheet harness route is reachable in `pnpm start` mode (HIGH 2 / Open Risk #8)
- `tests/e2e/__screenshots__/.gitkeep` committed so Task 2's Docker run lands baselines under a tracked directory
- Pre-existing lint failures captured in `deferred-items.md` per SCOPE BOUNDARY rule

## Task Commits

1. **Task 1: E2E spec suite + playwright.config snapshot defaults** — `b0c48cd` (test)
2. **Deferred items tracking** — `0c1db63` (docs)

## Files Created/Modified

- `tests/e2e/visual-snapshots.spec.ts` — 5 routes x 4 combos = 20 snapshot tests, data-snapshot-mask aware
- `tests/e2e/horizontal-scroll-guard.spec.ts` — UI-21 across 5 Phase 3 routes (1px tolerance)
- `tests/e2e/offline-fallback.spec.ts` — OFF-09 SW navigation fallback chain (HIGH 3 codex review pattern)
- `tests/e2e/bottom-nav-scroll-restore.spec.ts` — UI-14 happy path with retries: 2 for debounced-save flake
- `tests/e2e/axe-placeholder-pages.spec.ts` — 20-combo axe matrix + 4 W-3 OfflineBanner pt-BR copy checks
- `tests/e2e/axe-modal-focus-trap.spec.ts` — UI-22 focus-trap via /modal-sheet harness (B-4)
- `tests/e2e/axe-route-focus-move.spec.ts` — UI-03 focus moves to <main> on route change
- `tests/e2e/axe-skip-to-main.spec.ts` — UI-22 first Tab lands on skip-link
- `tests/e2e/__screenshots__/.gitkeep` — directory tracked for Task 2 baseline drop
- `playwright.config.ts` — toHaveScreenshot defaults + NEXT_PUBLIC_ENABLE_TEST_ROUTES env
- `.planning/phases/03-design-system-app-shell/deferred-items.md` — pre-existing lint debt log

## Decisions Made

- **Comment rewording in `offline-fallback.spec.ts`:** the plan's prescribed comment included a literal `page.goto("/offline")` string used to explain what NOT to do, but the plan's own verification grep `! grep -E 'page\.goto\("/offline"\)' tests/e2e/offline-fallback.spec.ts` would match that comment string. Rephrased the warning to "navigating directly to the /offline route defeats the test" — same semantic content, no literal string match. The actual navigation under test is `page.goto("/profile/never-precached-edge")`.
- **Pre-existing lint debt:** SCOPE BOUNDARY rule applied — 4 errors in `tests/unit/heartbeat-route-contract.test.ts` (Plan 02-02) and 57 warnings in Plan 03-03/03-04 files were logged to `deferred-items.md` rather than fixed by Plan 05. Plan 05 task is E2E spec authoring; lint cleanup belongs in the owning plans or a Phase 3 cleanup pass.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Reworded literal `page.goto("/offline")` string in comment of `offline-fallback.spec.ts`**

- **Found during:** Task 1 verification
- **Issue:** Plan's prescribed comment contained the literal string `page.goto("/offline")` to explain the anti-pattern; the plan's own automated verification regex `! grep -E 'page\.goto\("/offline"\)'` matched the comment literally and would fail the negative check.
- **Fix:** Rewrote the comment to "navigating directly to the /offline route defeats the test" — preserves the educational intent without triggering the negative grep.
- **Files modified:** `tests/e2e/offline-fallback.spec.ts`
- **Verification:** `grep -E 'page\.goto\("/offline"\)' tests/e2e/offline-fallback.spec.ts` returns no matches; the test still navigates to `page.goto("/profile/never-precached-edge")` as the navigation under test.
- **Committed in:** `b0c48cd` (Task 1 commit)

**2. [Rule 2 - Missing Critical] Created `deferred-items.md` to track pre-existing lint failures**

- **Found during:** Task 1 verification (`pnpm lint`)
- **Issue:** Base commit `bbd0335` already had 4 hard lint errors (`tests/unit/heartbeat-route-contract.test.ts` Plan 02-02) + 57 better-tailwindcss warnings (Plan 03/04 files); Plan 05's verify gate (`pnpm typecheck && pnpm lint`) would fail but the failures are NOT caused by Plan 05's changes.
- **Fix:** Per SCOPE BOUNDARY, did NOT fix unrelated files; logged the items to `.planning/phases/03-design-system-app-shell/deferred-items.md` so Task 3's continuation agent + the orchestrator are aware.
- **Files modified:** `.planning/phases/03-design-system-app-shell/deferred-items.md` (new)
- **Verification:** `pnpm typecheck` exits 0; `pnpm lint` against the new spec files emits zero new problems (only pre-existing items remain).
- **Committed in:** `0c1db63`

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 missing critical)
**Impact on plan:** No scope creep; all auto-fixes are verification-related housekeeping and preserve the plan's intent.

## Issues Encountered

- `node_modules/` was missing in this fresh worktree at start of execution — ran `pnpm install --frozen-lockfile` once. No version drift; `pnpm-lock.yaml` honored.
- `pnpm lint` exits 1 because of pre-existing failures in Plan 02-04 files (see Deferred Items). Logged for follow-up, not fixed in this plan.

## Known Stubs

None — Plan 05 ships only test specs; no UI rendering paths introduced.

## Threat Flags

None — Test infrastructure only; no new runtime trust boundaries. Plan's STRIDE register (T-03-05-01..06) covers the only relevant threats (snapshot drift accepted/mitigated via committed baselines + git diff review).

## Self-Check (interim)

File presence checks (Task 1 deliverables):

- FOUND: `playwright.config.ts` (modified)
- FOUND: `tests/e2e/visual-snapshots.spec.ts`
- FOUND: `tests/e2e/horizontal-scroll-guard.spec.ts`
- FOUND: `tests/e2e/offline-fallback.spec.ts`
- FOUND: `tests/e2e/bottom-nav-scroll-restore.spec.ts`
- FOUND: `tests/e2e/axe-placeholder-pages.spec.ts`
- FOUND: `tests/e2e/axe-modal-focus-trap.spec.ts`
- FOUND: `tests/e2e/axe-route-focus-move.spec.ts`
- FOUND: `tests/e2e/axe-skip-to-main.spec.ts`
- FOUND: `tests/e2e/__screenshots__/.gitkeep`
- FOUND: `.planning/phases/03-design-system-app-shell/deferred-items.md`

Commits:

- FOUND: `b0c48cd` — Task 1
- FOUND: `0c1db63` — deferred-items tracking

## Self-Check (interim): PASSED

## Awaiting Continuation

A separate continuation agent (spawned by the orchestrator after Task 2's human-action checkpoint resolves) will:

1. Verify Docker-generated baselines committed under `tests/e2e/__screenshots__/visual-snapshots.spec.ts/` (20 PNGs)
2. Run Task 3: `pnpm typecheck && pnpm lint && pnpm lint:styles && pnpm test:unit && pnpm test:integration && pnpm test:e2e` — pre-existing lint debt in `deferred-items.md` MUST be resolved before this gate clears
3. Update `03-VALIDATION.md` frontmatter (`nyquist_compliant: false -> true`, `wave_0_complete: false -> true`) + append Plan 05 Sign-Off block
4. Rename this `03-05-SUMMARY-WIP.md` to `03-05-SUMMARY.md` once Task 3 done; flip `requirements-completed` to `[UI-03, UI-21, UI-22, UI-25, OFF-09, OFF-10]`

## Next Phase Readiness

Pending Task 2 + Task 3 completion. After Plan 05 closes, Phase 3 is ready for `/gsd:verify-work`.

---

*Phase: 03-design-system-app-shell*
*Plan: 05 (paused at Task 2 human-action checkpoint)*
*Last activity: 2026-04-27*
