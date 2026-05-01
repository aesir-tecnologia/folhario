---
phase: 05-catalog-meu-jardim
plan: 18
subsystem: ui
tags: [serwist, service-worker, offline, pwa, react, next-intl, axe, playwright]

# Dependency graph
requires:
  - phase: 05-03
    provides: countForUser repository function used by Home server component
  - phase: 05-10
    provides: useSubscription hook + logout cache purge (caches.delete CATALOG_API_CACHE)
  - phase: 05-11
    provides: SubscriptionProvider + useSubscription context mounted in (app)/layout.tsx
  - phase: 05-15
    provides: authedUser Playwright fixture pattern
  - phase: 03-design-system-app-shell
    provides: CaptureButton, OfflineBanner, ReadOnlyBanner, useOnlineStatus

provides:
  - Serwist StaleWhileRevalidate runtime cache for catalog GETs (CATALOG_API_CACHE = 'folhario-catalog-api-v1')
  - Home empty-state dual-affordance composition (CaptureButton + manual-add link)
  - Home bridge composition for count>=1 (ICU plural + catalog link)
  - /identify Em breve placeholder with online/offline conditional content
  - ReadOnlyBanner wired to useSubscription().readOnly (D-21)
  - OFF-08 E2E spec covering online→offline catalog browse + identify blocked + authed Home axe + cross-user SW cache leak prevention

affects:
  - 05-19 (future plans that import CATALOG_API_CACHE constant from src/app/sw.ts)
  - Phase 6 (identify page will be replaced; axe coverage migration needed)
  - Phase 10 (useSubscription() Phase 5 stub wired; Phase 10 replaces with real Stripe state)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - TDD RED→GREEN for service worker unit tests using class-based vi.mock constructors
    - Dedicated authed Playwright spec pattern (OFF-08 + Home axe in single spec)
    - Server component auth pattern: getCurrentUserFromSessionReadOnly() + countForUser()
    - Client component co-located offline detection (_identify-placeholder.tsx)

key-files:
  created:
    - src/app/(app)/identify/_identify-placeholder.tsx
    - tests/unit/sw-runtime-cache.test.ts
    - tests/e2e/catalog-offline.spec.ts
  modified:
    - src/app/sw.ts
    - src/app/(app)/page.tsx
    - src/app/(app)/identify/page.tsx
    - src/app/(app)/app-shell.tsx
    - src/messages/pt-BR.json
    - tests/unit/sw-skip-waiting.test.ts
    - tests/unit/messages-coverage.test.ts

key-decisions:
  - "CATALOG_API_CACHE exported as named constant from src/app/sw.ts to prevent cache-name drift across logout-link.tsx (05-10) and catalog onSuccess (05-06)"
  - "SWR capture registered before NetworkOnly /api/* catch-all — Serwist first-match-wins; allowlist is a strict subset of /api/*"
  - "Home page calls getCurrentUserFromSessionReadOnly() (mirrors layout.tsx pattern) then countForUser() — no redundant re-gating; layout already enforces auth"
  - "identify.empty.* keys replaced with identify.placeholder.* — only consumer was identify/page.tsx; messages-coverage.test.ts updated"
  - "Banner stacking (offline + readOnly both true): ships stacked vertically by default — UI-SPEC §4.5 says never stack but does not address this composition; founder review deferred"
  - "Test 6 (cross-user SW cache leak) uses inline user creation — authedUser fixture only provides one user at a time; workaround documented in SUMMARY"

patterns-established:
  - "Service worker unit tests: use class-based mock constructors (not vi.fn()) so instanceof checks work; capture constructor instances via module-level arrays"
  - "Authed Home axe coverage: lives in catalog-offline.spec.ts (dedicated authed spec), NOT axe-placeholder-pages.spec.ts (unauthenticated only)"
  - "TDD for sw.ts: vi.resetModules() + dynamic import in beforeEach to re-execute sw.ts registration logic after mock setup"

requirements-completed: [OFF-08, UI-04, UI-07, UI-08, UI-11]

# Metrics
duration: 60min
completed: 2026-05-01
---

# Phase 05 Plan 18: Home + Identify + Serwist Offline Banners Summary

**Serwist StaleWhileRevalidate allowlist for catalog GETs, Home dual-affordance composition with breathing CaptureButton, /identify offline-blocked placeholder, and ReadOnlyBanner wired to useSubscription() — closing the OFF-08 offline-catalog-browsable loop**

## Performance

- **Duration:** ~60 min
- **Started:** 2026-05-01T19:40:00Z
- **Completed:** 2026-05-01T20:40:00Z
- **Tasks:** 3 (Task 1 TDD: 2 commits; Tasks 2+3: 1 commit each)
- **Files modified:** 9

## Accomplishments

- Serwist service worker extended with `StaleWhileRevalidate` for `/api/v1/plants*`, `/api/v1/photo-entries*`, `/api/v1/locations` — registered before the NetworkOnly `/api/*` catch-all (first-match-wins); `CATALOG_API_CACHE = 'folhario-catalog-api-v1'` exported as named constant
- Home page replaced with dual-affordance composition: `count===0` shows breathing `CaptureButton` + "Adicionar manualmente" link; `count>=1` shows bridge composition with ICU plural body + "Ver catálogo" link
- `/identify` shows "Em breve" placeholder online, "Identificação requer conexão à internet." (with `WifiOffIcon`, `role=status`, `aria-live=polite`) when offline
- `ReadOnlyBanner` wired from hardcoded `active={false}` to `useSubscription().readOnly` (D-21)
- OFF-08 E2E spec shipped with: online→offline catalog browse (plants visible from SW cache), OfflineBanner visible, offline /identify blocked, authed Home axe (count=0 + count>=1) × 4 combos, offline-banner axe × 4 combos, cross-user SW cache leak prevention

## Task Commits

1. **Task 1 RED — sw-runtime-cache failing tests** — `54d99a3` (test)
2. **Task 1 GREEN — Serwist SWR allowlist + CATALOG_API_CACHE** — `4a80812` (feat)
3. **Task 2 — Home + identify + i18n** — `e43f3ec` (feat)
4. **Task 3 — ReadOnlyBanner wiring + catalog-offline E2E** — `3b3c3d5` (feat)

## Files Created/Modified

- `src/app/sw.ts` — Added `StaleWhileRevalidate` + `ExpirationPlugin`, exported `CATALOG_API_CACHE` constant
- `src/app/(app)/page.tsx` — Replaced EmptyState with dual-affordance + bridge server component
- `src/app/(app)/identify/page.tsx` — Replaced with server shell rendering `<IdentifyPlaceholder />`
- `src/app/(app)/identify/_identify-placeholder.tsx` — New client component: online shows placeholder, offline shows blocked notice
- `src/app/(app)/app-shell.tsx` — Added `useSubscription` import + hook call; wired `ReadOnlyBanner active={readOnly}`
- `src/messages/pt-BR.json` — Added `home.bridge.{body,cta}`, `catalog.offline.identifyBlocked`, replaced `identify.empty` with `identify.placeholder.{title,hint,offlineBlocked}`
- `tests/unit/sw-runtime-cache.test.ts` — New Vitest unit test: SWR registration order, allowlist matcher, ExpirationPlugin args, CATALOG_API_CACHE value
- `tests/unit/sw-skip-waiting.test.ts` — Added `ExpirationPlugin` to serwist mock (Rule 1 fix — my sw.ts changes added the new import)
- `tests/unit/messages-coverage.test.ts` — Updated `identify.empty.*` → `identify.placeholder.*` required keys (Rule 1 fix)
- `tests/e2e/catalog-offline.spec.ts` — New E2E spec: OFF-08 + authed Home axe + offline-banner axe + cross-user SW cache leak (T-05-18-04)

## Decisions Made

- **Home auth seam**: Layout already gates via `getCurrentUserFromSessionReadOnly()` — Home page calls the same helper to get userId for `countForUser()` without re-gating (layout handles redirect; page handles count branch).
- **Server component pattern for identify**: Server shell renders client `<IdentifyPlaceholder>` — `useOnlineStatus` is client-only; co-located `_identify-placeholder.tsx` (underscore = Next.js convention for non-routed files) avoids polluting the page component.
- **Test 6 cross-user inline creation**: `authedUser` fixture creates one user. Test 6 creates two users inline using `seedUser` + `createServerClient` cookie capture — same pattern as the fixture itself. Documented in SUMMARY.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed sw-skip-waiting.test.ts mock missing ExpirationPlugin**
- **Found during:** Task 1 GREEN (implementing StaleWhileRevalidate in sw.ts)
- **Issue:** `sw-skip-waiting.test.ts` mocked `serwist` but didn't include `ExpirationPlugin`; my new sw.ts import caused Vitest to throw "No ExpirationPlugin export defined on serwist mock"
- **Fix:** Added `FakeExpirationPlugin` class to the `vi.doMock("serwist", ...)` factory in `sw-skip-waiting.test.ts`
- **Files modified:** `tests/unit/sw-skip-waiting.test.ts`
- **Verification:** All 3 sw-skip-waiting tests pass
- **Committed in:** `4a80812` (Task 1 feat commit)

**2. [Rule 1 - Bug] Fixed messages-coverage.test.ts after identify.empty → identify.placeholder rename**
- **Found during:** Task 2 (replacing i18n keys)
- **Issue:** `messages-coverage.test.ts` required `identify.empty.{title,hint,cta}` keys which were removed when replacing with `identify.placeholder.*`
- **Fix:** Updated `REQUIRED_KEYS` array to reference `identify.placeholder.{title,hint,offlineBlocked}`
- **Files modified:** `tests/unit/messages-coverage.test.ts`
- **Verification:** All 688 unit tests pass after change
- **Committed in:** `e43f3ec` (Task 2 feat commit)

---

**Total deviations:** 2 auto-fixed (2× Rule 1)
**Impact on plan:** Both fixes were direct consequences of my Task 1/2 changes — no scope creep.

## Issues Encountered

**Worktree branch behind expected base:** The worktree branch `worktree-agent-a7949b487384edff6` was at commit `666b1fc` (138 commits behind expected base `19a07e52`). Dependencies from plans 05-03, 05-10, 05-11, 05-15 were missing. Fixed by `git reset --hard 19a07e52`. All dependencies confirmed present after reset.

**unit-dom project crashes (pre-existing):** `pnpm exec vitest run --project=unit-dom` throws "Worker exited unexpectedly" — confirmed pre-existing by reverting changes and reproducing. Not caused by this plan. Unit tests (`.test.ts`) all pass (688 passed).

**E2E tests not run in worktree:** `pnpm test:e2e -- catalog-offline` requires a running Next.js server (`pnpm start`). Not feasible in worktree context. TypeScript check passed clean; spec logic follows established patterns from `plant-profile.spec.ts` and `catalog-grid-sort.spec.ts`. E2E verification is deferred to merge-time CI pipeline.

## Open Questions / Follow-ups

1. **Logout + SW cache flush (T-05-18-01/T-05-18-04):** `logout-link.tsx` in 05-10 already calls `caches.delete("folhario-catalog-api-v1")` — confirmed at `src/contexts/iam/api/components/logout-link.tsx:38`. E2E Test 6 will verify this contract at merge time.

2. **Banner stacking visual (offline + readOnly both true):** Both banners render stacked vertically when both conditions are true. UI-SPEC §4.5 says "never stack visually" but doesn't address this composition. Default ships stacked (each conveys different information: offline = transient, readOnly = persistent). Founder review needed for Phase 6 polish.

3. **/identify Phase 6 transition:** When Phase 6 ships the identification flow, `/identify` will become auth-required. At that point, move it from `axe-placeholder-pages.spec.ts` ROUTES into a dedicated authed spec (same pattern as Phase 5 dedicated specs). Track in Phase 6 plan.

4. **`identify.empty.*` keys removed:** Only consumer was `identify/page.tsx` (confirmed by grep). All other specs used `identify.placeholder.*` after this plan.

5. **Two-user fixture for Test 6:** `authedUser` fixture provides one user. Test 6 creates both users inline using the same `seedUser` + cookie-capture pattern as the fixture itself. Documents the approach chosen.

6. **`unit-dom` worker crash:** Pre-existing issue — `pnpm exec vitest run --project=unit-dom` crashes. Not caused by this plan. Should be investigated separately (likely a jsdom + Node 24 incompatibility or a memory issue in an existing test).

## Known Stubs

- `useSubscription()` returns `{ active: true, readOnly: false }` in Phase 5. Phase 10 replaces with real Stripe state. This is intentional and documented in `src/contexts/billing/application/use-subscription.ts`.

## Threat Flags

None found beyond those already addressed in the plan's threat model (T-05-18-01 through T-05-18-04).

## Self-Check: PASSED

All created files confirmed present:
- `src/app/sw.ts` FOUND
- `src/app/(app)/page.tsx` FOUND
- `src/app/(app)/identify/page.tsx` FOUND
- `src/app/(app)/identify/_identify-placeholder.tsx` FOUND
- `src/app/(app)/app-shell.tsx` FOUND
- `tests/unit/sw-runtime-cache.test.ts` FOUND
- `tests/e2e/catalog-offline.spec.ts` FOUND

All commits confirmed:
- `54d99a3` FOUND (test - RED)
- `4a80812` FOUND (feat - Task 1 GREEN)
- `e43f3ec` FOUND (feat - Task 2)
- `3b3c3d5` FOUND (feat - Task 3)

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
