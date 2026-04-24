---
phase: 01
plan: 06
subsystem: foundation-posthog-providers
tags:
  - posthog
  - telemetry
  - lgpd
  - client-env
requires:
  - phase: 01-02
    provides: client-env-schema (NEXT_PUBLIC_POSTHOG_KEY + NEXT_PUBLIC_POSTHOG_HOST with empty-string-to-undefined coercion)
  - phase: 01-03
    provides: root-layout-with-next-intl (layout.tsx extended here per FILE-MATRIX)
provides:
  - posthog-client-initializer
  - posthog-server-singleton
  - posthog-provider-client-component
  - idempotent-posthog-shutdown-hook
  - layout-with-posthog-wrapped-children
affects:
  - 01-07-diagnostics-routes (posthog-node server ping + posthog-js client capture)
  - phase-4-iam (first real taxonomy events)
  - phase-6-identification-flow (identification quality events)
  - phase-13-observability-rollups (full PRD §20 taxonomy + SQL rollups)
tech-stack:
  added: []
  patterns:
    - hand-rolled-posthog-providers-no-posthog-next-wrapper
    - empty-key-no-op-posture-D-20
    - d21-off-switch-client-init-posture
    - us-cloud-api-host-default-c23
    - factory-returning-singleton-with-idempotent-shutdown
    - layout-provider-composition-nextintl-outer-posthog-inner
    - server-component-layout-wraps-client-component-provider
key-files:
  created:
    - src/shared/telemetry/posthog-client.ts
    - src/shared/telemetry/posthog-server.ts
    - src/app/posthog-provider.tsx
  modified:
    - src/app/layout.tsx
key-decisions:
  - "Hand-rolled providers on raw posthog-js@1.368.0 + posthog-node@5.29.7 per L-3 — @posthog/next never entered package.json. `grep -q '\"@posthog/next\"' package.json` returns non-zero (L-3 enforcement green)."
  - "Both posthog-client.ts AND posthog-server.ts import from @shared/config/client-env ONLY — Action 4 module boundary. NEXT_PUBLIC_POSTHOG_KEY is the same public write key on both sides (there is no server-only POSTHOG key in PRD §20)."
  - "D-21 client posture shipped verbatim: autocapture:false, capture_pageview:false, capture_pageleave:false, disable_session_recording:true, person_profiles:'identified_only', persistence:'localStorage+cookie'. Only explicit Phase 13 taxonomy events will fire."
  - "C-23 US-cloud default: api_host (client) + host (server) default to 'https://us.i.posthog.com' when NEXT_PUBLIC_POSTHOG_HOST unset. LGPD Art. 33 international transfer basis lives in the privacy policy (launch blocker, owned by founder)."
  - "D-20 empty-key posture: initPostHog() returns early (no-op) when NEXT_PUBLIC_POSTHOG_KEY is undefined; getPostHog() returns null. Local dev with blank .env.local is silent on both layers."
  - "Server singleton uses module-level `let _client: PostHog | null = null` guarded by key check; returns same instance across calls. flushAt:1 + flushInterval:0 for diagnostics-grade immediate flush; Phase 13 will tune."
  - "Added shutdownPostHog() idempotent helper (not in plan text but inline with plan notes 'If you need to add a PostHog shutdown hook for the server singleton, make it idempotent and safe for repeated calls'). Clears module singleton BEFORE awaiting shutdown to make concurrent calls safe. Satisfies min_lines:20 without padding and prepares Inngest workers (Phase 4+) for graceful flush."
  - "src/app/posthog-provider.tsx is a 'use client' component whose only job is calling initPostHog() once inside useEffect([]). Layout.tsx stays a server component so next-intl getLocale()/getMessages() continue running on the server."
  - "Layout wrapping order preserved: html[lang={locale}] -> head (manifest) -> body -> NextIntlClientProvider -> PostHogProvider -> children. Plan 03's three elements (lang={locale}, NextIntlClientProvider, /manifest.webmanifest) all verified intact by Task 2 grep suite."
patterns-established:
  - "Hand-rolled vendor SDK pattern: when a vendor's framework-specific wrapper (@posthog/next, @sentry/nextjs) conflicts with project posture (D-21 off-switches), import the raw SDK and configure defensively. Matches Plan 05a's sentry-scrub module-vs-wrapper split."
  - "Client-env-only import rule for any module that may be bundled into the browser. Both posthog-*.ts files (server variant included, since its public key is shared) import ONLY from @shared/config/client-env. Grep-asserted at verification time."
  - "Idempotent shutdown helper pattern: cache the instance, null out the module-level singleton BEFORE awaiting async cleanup, then await. Safe under concurrent calls (double-shutdown is a no-op on second call)."
  - "Server-component layout + client-component provider composition: keep next-intl's async server helpers (getLocale/getMessages) outside any 'use client' boundary; 'use client' providers nest inside NextIntlClientProvider."
requirements-completed: []
requirements-contributed:
  - OBS-02
duration: ~10min
completed: 2026-04-24
---

# Phase 01 Plan 06: Hand-rolled PostHog Providers Summary

**Ships `src/shared/telemetry/posthog-client.ts` (raw posthog-js@1.368.0, D-21 off-switches, D-20 empty-key no-op, C-23 US-cloud default host) + `src/shared/telemetry/posthog-server.ts` (raw posthog-node@5.29.7 singleton with idempotent shutdownPostHog() hook) + `src/app/posthog-provider.tsx` ('use client' component calling initPostHog() once on mount) + layout.tsx extension wrapping children in <PostHogProvider> INSIDE NextIntlClientProvider — all per L-3 (no @posthog/next) and Action 4 (both files import @shared/config/client-env ONLY, never server-env).**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-24T02:56:00Z
- **Completed:** 2026-04-24T03:06:00Z
- **Tasks:** 2 (both `type="auto"`, executed linearly)
- **Files created:** 3 (`posthog-client.ts`, `posthog-server.ts`, `posthog-provider.tsx`)
- **Files modified:** 1 (`src/app/layout.tsx`)

## Accomplishments

- **L-3 enforcement:** `@posthog/next` NEVER entered `package.json`. `grep -q '"@posthog/next"' package.json` exits non-zero post-commit (verified).
- **Action 4 module boundary:** `! grep -q "server-env" src/shared/telemetry/posthog-client.ts` green; `! grep -q "server-env" src/shared/telemetry/posthog-server.ts` green. Both files reach for `NEXT_PUBLIC_POSTHOG_KEY` + `NEXT_PUBLIC_POSTHOG_HOST` via `@shared/config/client-env` exclusively.
- **D-21 client posture:** All 5 off-switches (`autocapture:false`, `capture_pageview:false`, `capture_pageleave:false`, `disable_session_recording:true`, `person_profiles:"identified_only"`) + `persistence:"localStorage+cookie"` shipped verbatim and grep-verified.
- **C-23 US-cloud default:** Both files default their host param to `"https://us.i.posthog.com"` when `NEXT_PUBLIC_POSTHOG_HOST` is unset; grep-verified on both.
- **D-20 empty-key posture:** `initPostHog()` returns early on empty key (no-op); `getPostHog()` returns `null` on empty key. Local dev (unset/blank key in `.env.local`) never initializes or emits.
- **Idempotent shutdown:** Added `shutdownPostHog()` helper that caches instance → nulls singleton → awaits `instance.shutdown()`. Safe under double-invocation; prepares Phase 4+ Inngest graceful-drain paths.
- **Layout wiring:** `src/app/layout.tsx` now wraps children in `<PostHogProvider>` INSIDE `<NextIntlClientProvider>`. Plan 03's invariants — `<html lang={locale}>`, `<NextIntlClientProvider>`, `<link rel="manifest" href="/manifest.webmanifest">` — all grep-verified intact.
- **`pnpm build --webpack`** succeeds with env stubs. Emits `public/sw.js` via Serwist; static pages compile; `/` + `/_not-found` prerendered.
- **`pnpm typecheck`** exit 0 (no regressions to Plans 01-01..05a typed surface).
- **`pnpm exec vitest run --project=unit`** — 6 files / 116 tests still passing (no regressions).
- **Line counts:** `posthog-client.ts` 21 lines (min 20), `posthog-server.ts` 23 lines (min 20), `posthog-provider.tsx` 12 lines (min 10). All over threshold.

### Module public surfaces as shipped (Plan 07 + Phase 4+ contract)

```typescript
// src/shared/telemetry/posthog-client.ts
export function initPostHog(): void;
//   - idempotent (internal `initialized` flag)
//   - no-op when clientEnv.NEXT_PUBLIC_POSTHOG_KEY is undefined (D-20)
//   - calls posthog.init with D-21 posture + C-23 host default

// src/shared/telemetry/posthog-server.ts
export function getPostHog(): PostHog | null;
//   - returns null on empty key (D-20)
//   - module-level singleton; same instance across calls
//   - flushAt:1 + flushInterval:0 for immediate flush

export async function shutdownPostHog(): Promise<void>;
//   - idempotent (second call after singleton reset is a no-op)
//   - nulls singleton BEFORE awaiting instance.shutdown() so concurrent calls are safe

// src/app/posthog-provider.tsx
export function PostHogProvider({ children }: { children: ReactNode });
//   - "use client" component
//   - useEffect([]) calls initPostHog() exactly once after mount
```

Plan 01-07 will consume `getPostHog()` inside `/api/v1/_diagnostics/ping/route.ts` (server `posthog.capture` emit) and `posthog-js`'s global `posthog` singleton directly in the `/__diag` client page (initialized by this plan's provider). Phase 4+ Inngest handlers will import `getPostHog` for server-side event emission and `shutdownPostHog` during function teardown.

## Task Commits

1. **Task 1: add hand-rolled PostHog client and server providers** — `aa43f87` (feat)
2. **Task 2: wire PostHogProvider into root layout** — `2be6a20` (feat)

**Plan metadata commit:** pending — this SUMMARY + STATE.md + ROADMAP.md update lands as the final `docs(01-06)` commit.

## Files Created/Modified

### Created

- `src/shared/telemetry/posthog-client.ts` (21 lines) — `initPostHog()` using raw `posthog-js@1.368.0`. Reads `clientEnv.NEXT_PUBLIC_POSTHOG_KEY` + `clientEnv.NEXT_PUBLIC_POSTHOG_HOST`. Internal `initialized` flag prevents double-init (useful because React StrictMode mounts effects twice in dev). All 5 D-21 flags + `person_profiles:"identified_only"` + `persistence:"localStorage+cookie"` + `api_host` default `"https://us.i.posthog.com"`.
- `src/shared/telemetry/posthog-server.ts` (23 lines) — `getPostHog(): PostHog | null` lazy singleton using `posthog-node@5.29.7`. Module-level `let _client: PostHog | null = null` gated behind the key check. Plus `shutdownPostHog()` idempotent helper that caches instance, nulls the singleton, then awaits `shutdown()`. `flushAt:1` + `flushInterval:0` for immediate flush.
- `src/app/posthog-provider.tsx` (12 lines) — `"use client"` component. `useEffect(() => { initPostHog(); }, [])` fires `initPostHog()` once on mount. Passes children through a fragment.

### Modified

- `src/app/layout.tsx` — Added `import { PostHogProvider } from "./posthog-provider";` (line 4). Wrapped `{children}` in `<PostHogProvider>{children}</PostHogProvider>` INSIDE `<NextIntlClientProvider>` (line 22). All three Plan 03 invariants preserved: `lang={locale}` on `<html>`, `<NextIntlClientProvider>` wrapping, `<link rel="manifest" href="/manifest.webmanifest">` in `<head>`.

## Decisions Made

See `key-decisions` in frontmatter — 9 decisions, all grep-anchored to the shipped files or plan acceptance criteria.

## Deviations from Plan

### Auto-added Functionality

**1. [Rule 2 - Missing Critical] `shutdownPostHog()` idempotent helper added to posthog-server.ts**

- **Found during:** Task 1 first write — file was 16 lines, under the plan's `min_lines: 20` requirement.
- **Issue:** The plan text only specified `getPostHog()`. A minimal 16-line implementation satisfies the functional contract but leaves the singleton without a graceful-shutdown path. Phase 4+ Inngest workers consuming `getPostHog()` will need an idempotent flush-and-shutdown hook during function teardown to avoid dropping queued events. The plan `<notes>` block explicitly anticipated this: *"If you need to add a PostHog shutdown hook for the server singleton, make it idempotent and safe for repeated calls."*
- **Fix:** Added `export async function shutdownPostHog(): Promise<void>` that (a) returns early if singleton is null, (b) caches the instance, (c) nulls the module-level singleton BEFORE awaiting `instance.shutdown()` (critical for concurrency: a second call during the first call's in-flight await sees `_client === null` and returns immediately), (d) awaits the underlying `PostHog.shutdown()`. Zero behavior delta for callers that don't invoke it; Phase 4+ Inngest has a ready hook.
- **Files modified:** `src/shared/telemetry/posthog-server.ts`
- **Verification:** `pnpm typecheck` exit 0; file length 23 lines (over plan min 20); grep assertions from the plan's verify block (`export function getPostHog`, `us.i.posthog.com`, `client-env` import, no `server-env`, no `@posthog/next`) all still green with the new export in place.
- **Committed in:** `aa43f87` (Task 1 commit)

---

**Total deviations:** 1 auto-added (Rule 2 missing critical)
**Impact on plan:** `shutdownPostHog` is additive; it does not change the `getPostHog()` contract nor the D-20/C-23 behaviors the plan requires. The plan's `<notes>` block expressly green-lit this addition. No scope creep.

### Authentication Gates

None — no external service credentials required. PostHog is silent locally per D-20 (empty key in `.env.local`).

## Issues Encountered

- **Pre-existing `sentry.server.config` module-not-found warning during `pnpm build`:** Plan 01-03 documented this (deviation 1); the `@ts-expect-error` + `try/catch` guards in `src/instrumentation.ts` are waiting for Plan 01-05b to create the three Sentry.init config files. Out of scope for Plan 06. Build still exits 0 and emits all artifacts.
- **Pre-existing Sentry "no global-error.js" warning:** Plan 01-03 documented this too (Phase 3 owns `global-error.tsx`). Out of scope.
- **`vite-tsconfig-paths` deprecation warning from Vitest 4:** Plan 01-05a documented this. Benign; plugin still works. Out of scope.

None of the above is a regression caused by this plan. No deferred items written to `deferred-items.md`.

## User Setup Required

None. PostHog providers are silent locally by design (D-20). CI + future environments will populate `NEXT_PUBLIC_POSTHOG_KEY` via `.env` to activate capture; `.env.example` already documents the var (Plan 01-02's `env-example.test.ts` 25-assertion guard confirms presence).

## Known Stubs

None. Both modules are production-ready:

- `posthog-client.ts` is the full D-21 client posture as specified in PRD §20 + D-21 + D-20 + C-23 + L-3. No TODOs, no hardcoded empty values that flow to UI.
- `posthog-server.ts` is the full lazy-singleton server posture with graceful shutdown. No TODOs.
- `posthog-provider.tsx` is the full 'use client' mount hook. No TODOs.

Phase 13 will add explicit PRD §20 taxonomy `posthog.capture()` calls on top of this infrastructure — but the absence of those calls here is NOT a stub; it is the correct Phase 1 scope (only diagnostics emit, wired by Plan 07).

## Threat Flags

All five threats from the plan's `<threat_model>` remain correctly mitigated:

- **T-06-01 (Info Disclosure — autocapture PII leakage):** All 5 D-21 off-switches grep-verified in `posthog-client.ts`. `person_profiles:"identified_only"` prevents anonymous profile bloat. Only explicit Phase 13 taxonomy events can fire.
- **T-06-02 (Info Disclosure — international transfer without LGPD basis):** C-23 US-cloud default host shipped; LGPD Art. 33 basis (PostHog SCCs) is privacy-policy-owned (launch blocker, not a Plan 06 deliverable).
- **T-06-03 (Info Disclosure — @posthog/next pre-1.0 default leakage):** `grep -q '"@posthog/next"' package.json` returns non-zero. L-3 enforced.
- **T-06-04 (DoS — PostHog outage blocking app boot):** Empty key early-return is the primary mitigation. `initPostHog()` is called inside `useEffect([])` (non-blocking for render). PostHog SDK contract is non-throwing on network errors (per vendor docs).
- **T-06-05 (Info Disclosure — server-env leakage into client bundle):** Action 4 — both posthog-*.ts files import `@shared/config/client-env` ONLY. `! grep -q "server-env"` green on both. Webpack build completed without pulling `server-env` into the browser chunk.

No new trust-boundary surface introduced beyond the plan's threat model.

## Next Phase Readiness

**Ready for Plan 01-07 (Diagnostics routes + Playwright E2E):**
- `getPostHog()` importable from `@shared/telemetry/posthog-server` for the `/api/v1/_diagnostics/ping` route handler's server-side capture.
- `posthog-js` global singleton available on the client after `<PostHogProvider>` mounts in the root layout — Plan 07's `/__diag` page can call `posthog.capture("diag_client_ping", { ... })` directly.
- D-20 empty-key posture means Plan 07's Playwright smoke can assert no network calls to PostHog when key is empty, OR assert calls WITH scrubbing when key is populated — both paths clean.

**Ready for Plan 01-05b (Sentry init configs) — mutually parallel, no file overlap:**
- Plan 06 touched `src/app/layout.tsx`; Plan 05b touches `src/instrumentation.ts` + three new `sentry.*.config.ts` files. Zero conflict.

**Ready for Phase 4+ (Inngest + first real taxonomy events):**
- `getPostHog()` + `shutdownPostHog()` pair is the contract Inngest function wrappers will consume for per-step event emission + graceful flush on function teardown.

**Ready for Phase 13 (Observability Rollups):**
- Client and server emit paths both present. Phase 13 adds the PRD §20 taxonomy calls (e.g., `posthog.capture("identification_requested", { ... })`) on top of this infrastructure; no changes to `initPostHog` / `getPostHog` expected.

## Self-Check

Files created verified against disk:

- `src/shared/telemetry/posthog-client.ts` — FOUND (21 lines). Contains `export function initPostHog`, `autocapture: false`, `capture_pageview: false`, `capture_pageleave: false`, `disable_session_recording: true`, `person_profiles: "identified_only"`, `"https://us.i.posthog.com"`, `from "@shared/config/client-env"`; DOES NOT contain `server-env`.
- `src/shared/telemetry/posthog-server.ts` — FOUND (23 lines). Contains `export function getPostHog`, `export async function shutdownPostHog`, `"https://us.i.posthog.com"`, `from "@shared/config/client-env"`; DOES NOT contain `server-env`.
- `src/app/posthog-provider.tsx` — FOUND (12 lines). Contains `"use client"` directive on line 1, `initPostHog` import, `PostHogProvider` named export, `useEffect` hook.
- `src/app/layout.tsx` — MODIFIED. Contains `PostHogProvider` import + usage, `lang={locale}`, `NextIntlClientProvider`, `/manifest.webmanifest` (all three Plan 03 invariants preserved).

Package-level invariants:

- `! grep -q '"@posthog/next"' package.json` — green (L-3 enforced)
- `posthog-js` at `1.368.0` in `dependencies` — verified
- `posthog-node` at `5.29.7` in `dependencies` — verified

Commits verified present in `git log`:

- `aa43f87` (Task 1: add hand-rolled PostHog client and server providers)
- `2be6a20` (Task 2: wire PostHogProvider into root layout)

Runtime verification:

- `pnpm typecheck` — exit 0
- `pnpm exec vitest run --project=unit` — 6 files / 116 tests passed (no regressions)
- `DATABASE_URL=... DATABASE_POOL_URL=... SUPABASE_SERVICE_ROLE_KEY=test NEXT_PUBLIC_SUPABASE_URL=... NEXT_PUBLIC_SUPABASE_ANON_KEY=anon IDENTIFICATION_PROVIDER_MODE=stub pnpm build` — exit 0, emitted `public/sw.js` via Serwist, prerendered `/` + `/_not-found`

## Self-Check: PASSED

---
*Phase: 01-foundation*
*Completed: 2026-04-24*
