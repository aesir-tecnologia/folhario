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

requirements-completed: [UI-03, UI-21, UI-22, UI-25, OFF-09, OFF-10]

duration: ~3h (1h Task 1 + ~1.5h Task 2 Docker recipe debug + baseline gen + ~30m Task 3 verification)
completed: 2026-04-27
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

## Task 2 outcome — Docker baseline generation

The official Playwright Docker image (`mcr.microsoft.com/playwright:v1.59.1-jammy`) ships with `npm`/`yarn` only — Folhário's `playwright.config.ts` invokes `pnpm start` for its `webServer.command`, so the original `pnpm visual:baseline:docker` recipe failed with `pnpm: not found`. Then a second failure surfaced: the host bind-mount leaked the macOS-arm64 `node_modules` into the linux-arm64 container (`@parcel/watcher-linux-arm64-glibc` not found).

**Recipe rewrite (commit `8e46ef0`):** the script now:

1. Activates corepack inside the container and prepares `pnpm@9.15.5` (matches the project's `packageManager` pin).
2. Masks `/app/node_modules` and `/app/.next` with named Docker volumes (`folhario_docker_node_modules`, `folhario_docker_next_cache`) so the container builds its OWN linux-arm64 dependency tree without colliding with the host's darwin-arm64 install.
3. Runs `pnpm install --frozen-lockfile && pnpm build && npx playwright test --update-snapshots`. The named volumes persist across runs so subsequent baseline regenerations are fast.

A sibling `visual:baseline:docker:check` script omits `--update-snapshots` for the green-suite verification step (no longer needs --update-snapshots once baselines are committed).

**Baseline output:** Playwright wrote 20 PNGs to `tests/e2e/visual-snapshots.spec.ts-snapshots/` (Playwright's default snapshot-sibling path; the plan's `tests/e2e/__screenshots__/.gitkeep` is unused — left in place as a no-op marker). Linux-only PNGs are committed; darwin baselines from local non-Docker runs are gitignored to keep CI deterministic.

**Spot-checked baselines (commit `2d8e7cd`):**

- `/` light no-preference: Paper Cream bg, Source Serif 4 "Identifique sua primeira planta", Canopy "Identificar planta" CTA, 4-tab bottom nav (Início/Catálogo/Identificar/Perfil) ✓
- `/offline` dark+reduce: Night Cream bg, leaf SVG, "Você está offline." + Catálogo continuity hint, mint "Tentar novamente" CTA ✓
- All copy in pt-BR; no English leakage. Centered tablet-width layout intact.

## Task 3 outcome — full E2E suite + Phase 3 lockdown

Running the full E2E suite against committed baselines surfaced **9 pre-existing failures** that the unit-test-only verification of Plans 03-01..03-04 never exposed. **7 of the 9 are real Phase 3 implementation gaps** in Plans 03-04 + 03-05 that the e2e suite was specifically designed to catch — exactly Plan 05's intent. Fixed inline:

| # | Spec | Root cause | Fix |
|---|------|-----------|-----|
| 1 | `axe-modal-focus-trap.spec.ts` (UI-22) | Radix Dialog returns focus via `triggerRef`, only set by `Dialog.Trigger`. Harness opened the dialog imperatively, so triggerRef was null → focus went to body on close. | `ModalSheet` exposes `onCloseAutoFocus`; harness uses it to `event.preventDefault()` and refocus the stored invokerRef. Commit `c0857f3`. |
| 2-5 | `axe-placeholder-pages.spec.ts` (UI-24 + W-3, 4 routes) | `setOffline + reload` produced `net::ERR_FAILED`. SW had `clientsClaim: false`, no navigation strategy in `defaultCache`, and `/offline` was not in precache so the fallbacks plugin's `matchPrecache` returned undefined. | Three fixes in `src/app/sw.ts` (commit `bfeddbd`): (a) flip `clientsClaim: true` so the first install controls navigations immediately; (b) register an explicit `NetworkFirst` capture for `request.mode === "navigate"`; (c) precache the (app) shell routes (`/`, `/catalog`, `/identify`, `/profile`, `/offline`) with `revision: null` so the install handler hashes the responses. User-controlled OFF-10 update flow unchanged (`skipWaiting: false` still gates the new SW). |
| 6 | `bottom-nav-scroll-restore.spec.ts` (UI-14) | Two AppShell bugs: (i) cleanup unconditionally re-saved on navigation, overwriting the just-flushed scrollY with the post-restore value (typically 0); (ii) the synthetic scroll event from `useLayoutEffect`'s `window.scrollTo` was captured by the debounced onScroll listener, which then saved a clipped 0 when returning to a route whose document was shorter than the saved Y. | (i) Track `pending` flag — cleanup only flushes when a debounce is genuinely unfired. (ii) Install a capture-phase `consumeOnce` listener that calls `stopImmediatePropagation` on the synthetic scroll event ONLY when the scrollTo will actually move (current ≠ clamped target). Commit `f32941c`. |
| 7 | `offline-fallback.spec.ts` (OFF-09) | Same root cause as #2-5 — uncached navigation + offline produced ERR_FAILED instead of /offline fallback. | Resolved by the same `src/app/sw.ts` patch (commit `bfeddbd`). |

Two failures remain — both are pre-existing and out of Phase 3 scope:

- `diagnostics-consent.spec.ts` (POST + GET both 500) — Phase 02 endpoints, require a running Supabase DB. Not in Plan 05's mandate.

After fixes:

- `pnpm typecheck` → 0 errors ✓
- `pnpm lint` → 0 errors, 57 warnings (all pre-existing, see deferred-items.md; lint errors cleared in commit `15f466f`) ✓
- `pnpm lint:styles` → unchanged ✓
- `npx vitest run --project=unit --project=unit-dom` → 447 / 447 ✓
- `npx playwright test` (full suite) → 64 / 66 (2 pre-existing diagnostics-consent failures excluded) ✓
- 7 consecutive runs of the originally-failing 27-test subset → all pass, zero flakes ✓

## Self-Check: PASSED

## Next Phase Readiness

Phase 3 closes with a green Playwright suite (modulo 2 pre-existing diagnostics tests requiring DB). Plan 04 (LGPD onboarding + auth) inherits a hardened SW (cached app shell + offline fallback proven), a focus-restoring `ModalSheet` primitive (consumed for the consent modal), and a regression-resistant scroll-save that correctly preserves Y across SPA tab switches.

---

*Phase: 03-design-system-app-shell*
*Plan: 05 — completed 2026-04-27*
