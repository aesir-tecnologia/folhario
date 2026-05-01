---
phase: 05-catalog-meu-jardim
plan: 11
subsystem: billing
tags: [react-context, subscription, read-only-mode, server-component, playwright, tdd]

requires:
  - phase: 04-iam
    provides: "D-21 verified-user gate in (app)/layout.tsx"
  - phase: 01-foundation
    provides: "server-env.ts with ENABLE_TEST_ROUTES registered (Phase 4 WR-08)"

provides:
  - "useSubscription() client hook returning { active: boolean; readOnly: boolean }"
  - "SubscriptionProvider server component (reads ENABLE_TEST_ROUTES + request cookie)"
  - "SubscriptionContextClient 'use client' React context provider"
  - "resolveSubscriptionState() pure helper for server-side gate evaluation"
  - "(app)/layout.tsx wraps verified-user branch in <SubscriptionProvider>"

affects:
  - "05-15 through 05-18 (Wave 4 plans consuming useSubscription)"
  - "10-payments (Phase 10 replaces resolveSubscriptionState body with Stripe state)"

tech-stack:
  added: []
  patterns:
    - "Server reads env+cookie → React context → client hook (D-21 server/client split per Phase 1 D-29)"
    - "Async SubscriptionProvider server component; cookies() guarded by ENABLE_TEST_ROUTES branch to avoid dynamic-rendering penalty in production"
    - "Colocated *.unit.test.tsx in src/ picked up by vitest unit-dom project via src/**/*.unit.test.tsx include pattern"

key-files:
  created:
    - src/contexts/billing/application/use-subscription.ts
    - src/contexts/billing/application/subscription-provider.tsx
    - src/contexts/billing/application/subscription-provider.client.tsx
    - src/contexts/billing/application/use-subscription.unit.test.tsx
  modified:
    - src/app/(app)/layout.tsx
    - vitest.config.ts

key-decisions:
  - "Test file created as .unit.test.tsx (not .ts) because render tests require JSX + jsdom; vitest.config.ts unit-dom include extended to src/**/*.unit.test.tsx"
  - "SubscriptionProvider is async because cookies() is async in Next 16 (follows existing pattern in supabase-server.ts)"
  - "cookies() call is inside ENABLE_TEST_ROUTES=1 branch only so production routes stay statically optimizable"
  - "ENABLE_TEST_ROUTES was already registered in server-env.ts (no modification needed)"
  - "resolveSubscriptionState uses strict '=== 1' equality on both gate and cookie (T-05-11-01 mitigation)"

patterns-established:
  - "Server/client context split: server reads env/IO → resolves state → passes to client provider as props"
  - "Colocated test files: src/**/*.unit.test.tsx for React-render tests alongside source modules"

requirements-completed: []

duration: 4min
completed: 2026-05-01
---

# Phase 5 Plan 11: useSubscription Stub Summary

**React context stub for billing read-only mode: server resolves env+cookie at SSR boundary, useSubscription() client hook returns constant `{ active: true, readOnly: false }` in production; Playwright tests flip readOnly via `__test_subscription_read_only` cookie**

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-01T01:40:36Z
- **Completed:** 2026-05-01T01:44:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Created `useSubscription()` hook with `SubscriptionState` type, exported from `use-subscription.ts` with graceful context default `{ active: true, readOnly: false }`
- Created `SubscriptionProvider` (async server component) that reads `ENABLE_TEST_ROUTES` + `__test_subscription_read_only` cookie at SSR boundary, cookies() gated behind env check to avoid dynamic-rendering penalty in production
- Created `SubscriptionContextClient` ("use client" provider) for the Next.js App Router server/client context split
- Wired `<SubscriptionProvider>` around verified-user branch of `(app)/layout.tsx`
- 10 unit tests covering hook default, render behaviors, and resolver pure logic (all passing)

## Task Commits

1. **Task 1: RED test (hook contract)** - `233b130` (feat — includes vitest.config.ts update + hook + initial test)
2. **Task 2: RED test (provider + resolver)** - `41f2c23` (test — expanded test file with 9 behaviors)
3. **Task 2: GREEN (provider + layout wire)** - `e507932` (feat)

## Files Created/Modified

- `src/contexts/billing/application/use-subscription.ts` - SubscriptionState type + SubscriptionContext + useSubscription() hook
- `src/contexts/billing/application/subscription-provider.tsx` - SubscriptionProvider (async server) + resolveSubscriptionState (pure helper)
- `src/contexts/billing/application/subscription-provider.client.tsx` - SubscriptionContextClient ("use client" context wire)
- `src/contexts/billing/application/use-subscription.unit.test.tsx` - 10 unit tests (unit-dom, jsdom)
- `src/app/(app)/layout.tsx` - added `<SubscriptionProvider>` wrap around verified-user branch
- `vitest.config.ts` - unit-dom include extended to `src/**/*.unit.test.tsx`

## Decisions Made

- Test file created as `.unit.test.tsx` (not `.ts` as plan specified) because render tests need JSX + jsdom environment; vitest.config.ts unit-dom include pattern extended accordingly. Rule 3 deviation — no behavior change.
- `SubscriptionProvider` is `async` because `cookies()` is async in Next 16 (follows `supabase-server.ts` pattern at line 39).
- `cookies()` call is strictly inside the `process.env.ENABLE_TEST_ROUTES === "1"` branch to avoid Next.js dynamic rendering opt-in for all production traffic.
- `ENABLE_TEST_ROUTES` was already registered in `server-env.ts` (Phase 4 WR-08 addition) — no modification needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test file extension changed from .ts to .tsx**

- **Found during:** Task 1 analysis (before writing)
- **Issue:** Plan specified `use-subscription.unit.test.ts` (.ts) but the test renders React components via @testing-library/react, requiring JSX syntax and jsdom environment. The vitest unit-dom project only matched `.tsx` files in `tests/unit/` — a `.ts` colocated file would land in the `unit` (node) project and fail on JSX.
- **Fix:** Created `use-subscription.unit.test.tsx` (.tsx) and extended vitest.config.ts unit-dom include to `src/**/*.unit.test.tsx`.
- **Files modified:** `vitest.config.ts`
- **Verification:** Tests run under unit-dom project with jsdom environment; all 10 pass.
- **Committed in:** `233b130` (Task 1 feat commit)

---

**Total deviations:** 1 auto-fixed (1 Rule 3 blocking)
**Impact on plan:** Essential for tests to run in the correct environment. No scope creep.

## Issues Encountered

None — all checks passed cleanly.

## Phase 10 Handoff Note

To wire real Stripe state: replace `resolveSubscriptionState` body in `subscription-provider.tsx` with a Stripe subscription query. The hook signature (`useSubscription(): SubscriptionState`) and `SubscriptionContextClient` stay unchanged. Wave 4 UI consumers (05-15..05-18) will automatically pick up real state without modification.

## Next Phase Readiness

- `useSubscription()` is available for import from `@contexts/billing/application/use-subscription` in any client component under `(app)/`
- Wave 4 plans (05-15..05-18) can now gate mutating affordances: Add Plant button, inline-edit fields, delete overflow, "+ Foto", ReadOnlyBanner
- Playwright E2E fixture (`tests/e2e/fixtures/read-only.ts`) can flip `readOnly: true` per-test via `page.context().addCookies([{ name: '__test_subscription_read_only', value: '1', ... }])` — requires `ENABLE_TEST_ROUTES=1` in `playwright.config.ts` webServer.env

## Self-Check: PASSED

- FOUND: src/contexts/billing/application/use-subscription.ts
- FOUND: src/contexts/billing/application/subscription-provider.tsx
- FOUND: src/contexts/billing/application/subscription-provider.client.tsx
- FOUND: src/contexts/billing/application/use-subscription.unit.test.tsx
- FOUND: src/app/(app)/layout.tsx
- FOUND: vitest.config.ts
- FOUND: .planning/phases/05-catalog-meu-jardim/05-11-SUMMARY.md
- FOUND commit: 233b130
- FOUND commit: 41f2c23
- FOUND commit: e507932

---
*Phase: 05-catalog-meu-jardim*
*Completed: 2026-05-01*
