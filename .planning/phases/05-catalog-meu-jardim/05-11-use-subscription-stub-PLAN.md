---
phase: 05-catalog-meu-jardim
plan: 11
type: execute
wave: 1
depends_on: []
files_modified:
  - src/contexts/billing/application/use-subscription.ts
  - src/contexts/billing/application/subscription-provider.tsx
  - src/contexts/billing/application/subscription-provider.client.tsx
  - src/contexts/billing/application/use-subscription.unit.test.ts
  - src/app/(app)/layout.tsx
autonomous: true
requirements: []
tags:
  - billing
  - subscription-stub
  - read-only-mode
must_haves:
  truths:
    - "Calling `useSubscription()` from any client component under (app)/ returns `{ active: true, readOnly: false }` by default."
    - "When `ENABLE_TEST_ROUTES=1` is set in server env AND the request carries cookie `__test_subscription_read_only=1`, `useSubscription()` returns `{ active: true, readOnly: true }` for every client component under (app)/."
    - "When `ENABLE_TEST_ROUTES` is NOT set (production default), the cookie `__test_subscription_read_only` is ignored entirely — `readOnly` is always `false` regardless of cookie presence."
    - "Production builds never set `ENABLE_TEST_ROUTES=1`; the cookie check is a dead code path at runtime in production."
    - "The Playwright fixture `tests/e2e/fixtures/read-only.ts` (created in 05-01) flips readOnly state by setting the cookie via `page.context().addCookies(...)` — no dev-server restart required. `ENABLE_TEST_ROUTES=1` is set once in `playwright.config.ts` `webServer.env`."
  artifacts:
    - path: "src/contexts/billing/application/use-subscription.ts"
      provides: "useSubscription() client hook returning { active: boolean; readOnly: boolean }"
      exports: ["useSubscription", "type SubscriptionState"]
    - path: "src/contexts/billing/application/subscription-provider.tsx"
      provides: "Server entry SubscriptionProvider that reads ENABLE_TEST_ROUTES + request cookie and feeds a client-side React context provider"
      exports: ["SubscriptionProvider"]
    - path: "src/contexts/billing/application/use-subscription.unit.test.ts"
      provides: "Vitest unit-dom coverage for the hook + provider cookie-flip behavior"
    - path: "src/app/(app)/layout.tsx"
      provides: "Wraps the (app) tree in <SubscriptionProvider> so every catalog/profile/journal route can call useSubscription()"
  key_links:
    - from: "src/contexts/billing/application/subscription-provider.tsx"
      to: "process.env.ENABLE_TEST_ROUTES + cookies()"
      via: "server-component reads env gate then Next.js cookies() at SSR time"
      pattern: "ENABLE_TEST_ROUTES|__test_subscription_read_only"
    - from: "src/app/(app)/layout.tsx"
      to: "src/contexts/billing/application/subscription-provider.tsx"
      via: "JSX wrap of children"
      pattern: "<SubscriptionProvider"
    - from: "any client component"
      to: "src/contexts/billing/application/use-subscription.ts"
      via: "import { useSubscription } from '@contexts/billing/application/use-subscription'"
      pattern: "useSubscription\\("
---

<objective>
Ship the Phase 5 stub for `useSubscription()` that catalog UI surfaces (Add Plant button, inline-edit fields, delete overflow, "+ Foto", `<ReadOnlyBanner>`) consume to gate mutating affordances per D-21. The stub returns `{ active: true, readOnly: false }` constant in production-shape contexts; the Playwright read-only-mode E2E specs toggle `readOnly: true` per-test by setting cookie `__test_subscription_read_only=1` (honored only when `ENABLE_TEST_ROUTES=1` is in server env — set once in `playwright.config.ts` `webServer.env`, never in production).

Purpose: every Wave 4 UI plan (05-15..05-18) needs a single import target whose readOnly value is deterministic, mockable for E2E, and forward-compatible with Phase 10's real Stripe wiring. Ship the contract NOW so Wave 4 plans don't all roll their own.

Output:
- `useSubscription()` client hook (returns `{ active, readOnly }`)
- `<SubscriptionProvider>` server component that reads `ENABLE_TEST_ROUTES` env + request cookie at SSR boundary and passes the resolved value to a client React context
- Hook wired into `(app)/layout.tsx` so every authenticated route can consume it
- Unit tests proving constant return + cookie-flip behavior + threat model invariants
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-VALIDATION.md
@CLAUDE.md

<!-- Existing artifacts the plan must respect -->
@src/app/(app)/layout.tsx
@src/app/(app)/app-shell.tsx
@src/shared/config/server-env.ts
@src/shared/config/client-env.ts
@src/shared/online/use-online-status.ts
@src/contexts/billing/inngest/functions.ts

<interfaces>
<!-- Phase 1 D-29 enforces a strict server/client env split. Server-only flags
     live in src/shared/config/server-env.ts (no NEXT_PUBLIC_ prefix). Client
     code must NOT read process.env.ENABLE_TEST_ROUTES directly.

     Pattern reused from playwright.config.ts:93 — IDENTIFICATION_PROVIDER_MODE
     is set at webServer launch and read by Server Components / route handlers
     at request time. Same shape applies to ENABLE_TEST_ROUTES. -->

From src/shared/config/server-env.ts (Phase 1 D-29 — server-only env):
```typescript
export const serverSchema = z.object({
  // ... existing entries ...
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
  // ENABLE_TEST_ROUTES already registered (or register here if absent):
  // ENABLE_TEST_ROUTES: optional(z.enum(["1"])).default(undefined),
});
export const serverEnv = serverSchema.parse(process.env);
```

From src/app/(app)/layout.tsx (Phase 4 D-21 — verified-user gate):
```typescript
export default async function AppLayout({ children }: { children: ReactNode }) {
  // ...gates...
  return <AppShell>{children}</AppShell>;
}
```
This plan wraps the `<AppShell>` invocation in `<SubscriptionProvider>`. AppShell already
imports `<ReadOnlyBanner active={false} />` (app-shell.tsx:146); a follow-up plan
(05-18) flips it to `active={readOnly}` from `useSubscription()`. This plan does NOT
modify app-shell.tsx — only wires the provider so the hook is available.

Hook contract (this plan defines):
```typescript
export type SubscriptionState = {
  active: boolean;     // Phase 5: always true
  readOnly: boolean;   // Phase 5: cookie-flip via __test_subscription_read_only=1 (ENABLE_TEST_ROUTES=1 guard)
};
export function useSubscription(): SubscriptionState;
```
</interfaces>

<design_decision>
<!-- ADVISOR-RESOLVED: Client/server env split per Phase 1 D-29.
     Three options were on the table:
       1. Server reads env → React context → client hook consumes (CHOSEN)
       2. NEXT_PUBLIC_SUBSCRIPTION_READ_ONLY (REJECTED — re-introduces the
          WR-08 trap that Phase 4 fixed for ENABLE_TEST_ROUTES; flag value
          would leak into the production client bundle)
       3. Client hook calls a route handler (REJECTED — heavyweight for a
          stub; introduces network dependency for a constant)

     Option 1 is forward-compatible: Phase 10 swaps the provider's value
     source from env to real Stripe state without changing any consumer
     of useSubscription(). It also satisfies threat T-05-11-01 (server
     evaluates the flag at SSR; client cannot tamper) and T-05-11-02
     (no API surface returns the literal that could be tampered with).

     Per-request cookie mechanism (MEDIUM-5): process-level env vars cannot
     toggle per Playwright test once the dev server is running. The cookie
     `__test_subscription_read_only=1`, honored only when ENABLE_TEST_ROUTES=1,
     allows per-test toggling via page.context().addCookies() without
     restarting the server. The ENABLE_TEST_ROUTES guard ensures the cookie
     check is a complete no-op in production. -->

**Server reads ENABLE_TEST_ROUTES + request cookie → React context → client hook consumes** (option 1 with per-request cookie mechanism).
</design_decision>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define SubscriptionState contract + ensure ENABLE_TEST_ROUTES is registered in server-env</name>
  <files>
    src/contexts/billing/application/use-subscription.ts (NEW),
    src/shared/config/server-env.ts (MODIFY if ENABLE_TEST_ROUTES absent)
  </files>
  <behavior>
    - Test 1 (hook contract): `SubscriptionState` is `{ active: boolean; readOnly: boolean }` — both required, both boolean. (Compile-time check via tsc.)
    - Test 2 (hook default): a component calling `useSubscription()` outside any provider receives the context default `{ active: true, readOnly: false }` (no throw — graceful default per D-21 production constant).
    - Test 3 (ENABLE_TEST_ROUTES absent): `resolveSubscriptionState({ enableTestRoutes: undefined, cookieValue: "1" })` returns `{ active: true, readOnly: false }` — cookie is ignored when gate is off.
    - Test 4 (ENABLE_TEST_ROUTES present, cookie absent): `resolveSubscriptionState({ enableTestRoutes: "1", cookieValue: undefined })` returns `{ active: true, readOnly: false }`.
  </behavior>
  <action>
    Create `src/contexts/billing/application/use-subscription.ts` per D-21, exporting:
      - `export type SubscriptionState = { active: boolean; readOnly: boolean }`
      - `export const SubscriptionContext` — a React Context with default value `{ active: true, readOnly: false }` (the production-shape constant per D-21).
      - `export function useSubscription(): SubscriptionState` — `"use client"` directive at top of file; thin wrapper around `useContext(SubscriptionContext)`.

    File header convention: copy the comment block style from `src/shared/online/use-online-status.ts:1-23` (terse multi-line summary referencing D-21 and Phase 10's planned replacement).

    Check `src/shared/config/server-env.ts` — if `ENABLE_TEST_ROUTES` is NOT already registered, add it:
      - Add `ENABLE_TEST_ROUTES: optional(z.string().min(1))` to `serverSchema` (use the existing `optional` helper).
      - Add a comment block above it explaining: "Test-route gate. Set to '1' in CI / local E2E only (playwright.config.ts webServer.env). Server-only — no NEXT_PUBLIC_ prefix per Phase 1 D-29. Production env never sets this. Guards cookie-based test mechanisms (e.g. __test_subscription_read_only)."
      - Do NOT add it to client-env.ts. The flag is server-only.
      - If `ENABLE_TEST_ROUTES` is already registered, do not duplicate it.

    No fallback consumer logic in this task — Task 2 ships the provider that reads the env+cookie and feeds the context.

    Per D-21 (using @ alias paths configured in tsconfig): file path is `src/contexts/billing/application/use-subscription.ts` exactly. No other location. The directory currently contains only a `.gitkeep`.
  </action>
  <verify>
    <automated>pnpm test:unit --project=unit-dom -- src/contexts/billing/application/use-subscription</automated>
  </verify>
  <done>
    - `use-subscription.ts` exists with `SubscriptionState` type, `SubscriptionContext`, `useSubscription` exports.
    - `server-env.ts` has `ENABLE_TEST_ROUTES` registered as an optional string env var (added or already present).
    - Unit tests pass (4 tests).
    - `pnpm tsc --noEmit` reports zero new errors.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Server SubscriptionProvider that reads ENABLE_TEST_ROUTES + cookie + feeds client context, wired into (app)/layout.tsx</name>
  <files>
    src/contexts/billing/application/subscription-provider.tsx (NEW),
    src/contexts/billing/application/use-subscription.unit.test.ts (NEW),
    src/app/(app)/layout.tsx (MODIFY)
  </files>
  <behavior>
    - Test 1 (default state): rendering a child component that calls `useSubscription()` inside `<SubscriptionProvider initialState={{ active: true, readOnly: false }}>` returns `{ active: true, readOnly: false }`.
    - Test 2 (read-only flip): rendering inside `<SubscriptionProvider initialState={{ active: true, readOnly: true }}>` returns `{ active: true, readOnly: true }`.
    - Test 3 (no provider, default fallback): a component calling `useSubscription()` outside any provider receives the context default `{ active: true, readOnly: false }` (no throw — graceful default per D-21 production constant).
    - Test 4 (resolver — cookie honored when gate on): `resolveSubscriptionState({ enableTestRoutes: "1", cookieValue: "1" })` returns `{ active: true, readOnly: true }`.
    - Test 5 (resolver — cookie absent when gate on): `resolveSubscriptionState({ enableTestRoutes: "1", cookieValue: undefined })` returns `{ active: true, readOnly: false }`.
    - Test 6 (resolver — cookie ignored when gate off): `resolveSubscriptionState({ enableTestRoutes: undefined, cookieValue: "1" })` returns `{ active: true, readOnly: false }` — gate is the primary guard; cookie alone cannot flip readOnly.
    - Test 7 (resolver — gate off, no cookie): `resolveSubscriptionState({ enableTestRoutes: "0", cookieValue: "1" })` returns `{ active: true, readOnly: false }` (strict "1" check on gate; anything other than "1" is treated as off).
    - Test 8 (resolver — strict gate check): `resolveSubscriptionState({ enableTestRoutes: "true", cookieValue: "1" })` returns `{ active: true, readOnly: false }` (we DO NOT accept truthy strings for the gate — keeps surface tight, avoids accidental enablement).
    - Test 9 (cookie ignored in production path): `resolveSubscriptionState({ enableTestRoutes: undefined, cookieValue: "1" })` returns `{ active: true, readOnly: false }` — production never sets ENABLE_TEST_ROUTES so this is a dead code path.

    All tests live in a single file: `src/contexts/billing/application/use-subscription.unit.test.ts`. Use `@testing-library/react` (already in the unit-dom project) for the render tests (Tests 1-3); use plain Vitest for the resolver tests (Tests 4-9).
  </behavior>
  <action>
    Create `src/contexts/billing/application/subscription-provider.tsx`. This file has TWO surfaces:

    1. **Pure helper (testable in isolation, no React)**:
       ```ts
       export function resolveSubscriptionState(input: {
         enableTestRoutes: string | undefined;
         cookieValue: string | undefined;
       }): SubscriptionState {
         if (input.enableTestRoutes === "1" && input.cookieValue === "1") {
           return { active: true, readOnly: true };
         }
         return { active: true, readOnly: false };
       }
       ```
       Both checks use strict equality with `"1"` — anything else is falsy. This is the threat T-05-11-01 mitigation: the gate and cookie are evaluated server-side with tight checks; client cannot influence them; production env never sets `ENABLE_TEST_ROUTES`.

    2. **Server entry (no `"use client"` — runs at SSR boundary)**:
       ```tsx
       import { cookies } from "next/headers";
       import { serverEnv } from "@shared/config/server-env";
       import { SubscriptionContextClient } from "./subscription-provider.client";

       export function SubscriptionProvider({ children }: { children: ReactNode }) {
         let cookieValue: string | undefined;
         if (process.env.ENABLE_TEST_ROUTES === "1") {
           cookieValue = cookies().get("__test_subscription_read_only")?.value;
         }
         const state = resolveSubscriptionState({
           enableTestRoutes: process.env.ENABLE_TEST_ROUTES,
           cookieValue,
         });
         return <SubscriptionContextClient initialState={state}>{children}</SubscriptionContextClient>;
       }
       ```
       Note: `cookies()` is only called when `ENABLE_TEST_ROUTES === "1"`. In production this branch is never entered. This avoids the Next.js dynamic rendering penalty (cookies() opts a route into dynamic rendering) for all production traffic.

    3. **Client provider** (split into a SECOND file `subscription-provider.client.tsx` because Server Components cannot directly render `<Context.Provider>` — Next 16 App Router requires client-side context wiring to live in a `"use client"` module):
       ```tsx
       "use client";
       import { SubscriptionContext, type SubscriptionState } from "./use-subscription";
       export function SubscriptionContextClient({ initialState, children }: { initialState: SubscriptionState; children: ReactNode }) {
         return <SubscriptionContext.Provider value={initialState}>{children}</SubscriptionContext.Provider>;
       }
       ```

    Files created in this task:
       - `src/contexts/billing/application/subscription-provider.tsx` (server entry; exports `SubscriptionProvider` + `resolveSubscriptionState`)
       - `src/contexts/billing/application/subscription-provider.client.tsx` (`"use client"`; exports `SubscriptionContextClient`)
       - `src/contexts/billing/application/use-subscription.unit.test.ts` (the 9 behavior tests)

    Update the `files_modified` interpretation: the .client.tsx companion is a Next.js App Router idiom for Server-passes-data-to-Client-Context, not a separate concern. It lives in the same directory and is treated as part of the provider artifact. (Listed in this task's files; will be added to plan-level `files_modified` if validator demands a complete list.)

    Modify `src/app/(app)/layout.tsx`:
      - Import `SubscriptionProvider` from `@contexts/billing/application/subscription-provider`.
      - Wrap the existing `<AppShell>{children}</AppShell>` return value: change to `<SubscriptionProvider><AppShell>{children}</AppShell></SubscriptionProvider>`.
      - Place the wrap INSIDE the verified-user gate (line 52) — unverified users render `<UnverifiedBlocker />` and DO NOT need a subscription provider. This keeps the provider tree minimal and avoids touching the unverified path.
      - Do NOT modify the AppShell internals or the ReadOnlyBanner. Plan 05-18 wires the banner's `active` prop from `useSubscription()`.

    Test setup notes:
      - The default-context-fallback test (Test 3) renders without `<SubscriptionProvider>` — relies on the default value baked into the `createContext()` call in Task 1.
      - The render tests (Tests 1, 2, 3) import `SubscriptionContextClient` directly; they DO NOT exercise the server entry (which depends on `cookies()` and `process.env`). The resolver tests (Tests 4-9) cover the server-side branch by calling `resolveSubscriptionState` with explicit input — no `process.env` mutation or `cookies()` mocking needed.
      - Use `act` from `@testing-library/react` for any state-affecting assertions (Phase 3 unit-dom convention).
  </action>
  <verify>
    <automated>pnpm test:unit --project=unit-dom -- src/contexts/billing/application/use-subscription.unit.test.ts</automated>
  </verify>
  <done>
    - `subscription-provider.tsx` exists with `SubscriptionProvider` (server) + `resolveSubscriptionState` (pure helper) exports.
    - `subscription-provider.client.tsx` exists with `SubscriptionContextClient` (client) export.
    - All 9 unit tests pass.
    - `(app)/layout.tsx` wraps the verified-user branch in `<SubscriptionProvider>`.
    - `pnpm tsc --noEmit` reports zero new errors.
    - `pnpm lint` reports zero new errors.
    - `grep -rn "__test_subscription_read_only" src/` returns ONE hit only — inside `subscription-provider.tsx`, confirming the cookie name is not scattered.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Process env (ENABLE_TEST_ROUTES) → SSR | Server checks `ENABLE_TEST_ROUTES` at request time inside `<SubscriptionProvider>` (Server Component). In production this env var is never set, so the cookie branch is never reached. |
| Request cookie → SSR | Cookie `__test_subscription_read_only` is read via Next.js `cookies()` ONLY when `ENABLE_TEST_ROUTES === "1"`. In production (env absent) the cookie is completely ignored. |
| SSR → client bundle | Resolved `SubscriptionState` value crosses the wire as React props on the client provider. Neither the env var nor the cookie value ever leaves the server. |
| Client → Server | No path. `useSubscription()` is read-only on the client; mutating the value requires either (a) changing `ENABLE_TEST_ROUTES` in process env (operator-only) or (b) setting the cookie AND having `ENABLE_TEST_ROUTES=1` active. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-11-01 | E (Elevation of Privilege) | `subscription-provider.tsx` cookie + env read | mitigate | The cookie `__test_subscription_read_only` is honored ONLY when `process.env.ENABLE_TEST_ROUTES === "1"` (strict equality). Production deployments never set `ENABLE_TEST_ROUTES`; a user setting the cookie in production has zero effect — the branch is never entered. The double-gate (env AND cookie must both be "1") means accidental enablement requires both a misconfigured server AND a crafted cookie. `ENABLE_TEST_ROUTES` has NO `NEXT_PUBLIC_` prefix per Phase 1 D-29 and Phase 4 WR-08, so its value is never inlined into the client JS bundle. |
| T-05-11-02 | I (Information Disclosure) | API responses + client bundle | mitigate | Hook lives client-side only; no API surface returns the resolved `readOnly` boolean, the cookie value, or any signal about `ENABLE_TEST_ROUTES` presence. The boolean reaches the client only as a React context value scoped to the (app) tree — it never appears in JSON responses, request headers, or analytics events. Phase 10 will wire server truth (Stripe state) replacing this stub; the surface remains the same. |
| T-05-11-03 | T (Tampering) | Client bundle React context | accept | The client receives the `SubscriptionState` value via React props. A determined attacker with browser devtools CAN mutate the in-memory context to flip `readOnly` to `false` locally, but every mutating server action under `/api/v1/*` independently enforces server-side checks (Phase 4 D-21 `requireVerifiedUser`; Phase 10 will add subscription gating). The hook is a UI-affordance gate, NOT a security boundary. Acceptable: flipping it client-side gives the attacker hidden buttons that 4xx on submit. |
| T-05-11-04 | R (Repudiation) | Stub vs real subscription state | accept | Phase 5 stub returns a constant; there is no audit trail of "subscription state at time T" because there is no real state yet. Phase 10 will add Stripe webhook ingest + audit logs. Acceptable for stub. |
| T-05-11-05 | D (Denial of Service) | env + cookie read on every SSR | accept | `process.env` access is sub-microsecond. `cookies()` call (when `ENABLE_TEST_ROUTES=1`) is a header parse — also sub-microsecond. In production neither is called beyond the env check. No rate-limit risk. |

`block_on_high: true` per outline. T-05-11-01 and T-05-11-02 are HIGH severity and BOTH are mitigated. No unmitigated HIGHs.
</threat_model>

<verification>

## Plan-Level Checks

After both tasks complete, run:

```bash
# Unit tests for the hook + provider + resolver
pnpm test:unit --project=unit-dom -- src/contexts/billing/application/use-subscription

# Type-check the whole tree (touches (app)/layout.tsx so widen the net)
pnpm tsc --noEmit

# Lint
pnpm lint --max-warnings=0

# Confirm cookie name only appears in subscription-provider.tsx (not scattered)
grep -rn "__test_subscription_read_only" src/
# Expected: exactly ONE hit — subscription-provider.tsx.
# ZERO hits in any "use client" module or under src/app/.

# Confirm ENABLE_TEST_ROUTES is only read server-side
grep -rn "ENABLE_TEST_ROUTES" src/
# Expected: hits in server-env.ts (registration, if added) and subscription-provider.tsx only.
# ZERO hits in any "use client" module.

# Confirm the provider wraps the verified-user branch only
grep -n "SubscriptionProvider" src/app/\(app\)/layout.tsx
# Expected: ONE wrap, inside the verified-user return.

# Confirm no NEXT_PUBLIC_ leak
grep "NEXT_PUBLIC_SUBSCRIPTION\|NEXT_PUBLIC_ENABLE_TEST" src/shared/config/client-env.ts
# Expected: ZERO hits (these flags are server-only).
```

## Integration with Wave 4 Plans

This plan does NOT consume any UI surface — it only ships the contract. Wave 4 plans (05-15..05-18) import `useSubscription` and:
- Hide Add Plant button when `readOnly: true` (05-15)
- Render inline-edit fields as read-only text when `readOnly: true` (05-16)
- Hide delete overflow item when `readOnly: true` (05-16)
- Hide "+ Foto" button when `readOnly: true` (05-17)
- Flip `<ReadOnlyBanner active={readOnly} />` (05-18 modifies app-shell.tsx)

This plan's verification ends at: hook + provider exist, cookie-flip works, layout wires the provider. Functional E2E happens in Wave 4 via `tests/e2e/fixtures/read-only.ts` (created in 05-01) which sets the cookie `__test_subscription_read_only=1` via `page.context().addCookies(...)` and asserts the affordances disappear. `ENABLE_TEST_ROUTES=1` must be present in `playwright.config.ts` `webServer.env` for the cookie to be honored.

</verification>

<success_criteria>

- [ ] `useSubscription()` is callable from any client component under `(app)/` and returns `{ active: true, readOnly: false }` by default.
- [ ] When `ENABLE_TEST_ROUTES=1` is set in server env AND cookie `__test_subscription_read_only=1` is present, the provider resolves to `{ active: true, readOnly: true }` for all subsequent requests in that session.
- [ ] When `ENABLE_TEST_ROUTES` is NOT set, the cookie is ignored entirely — `readOnly` is always `false`.
- [ ] `ENABLE_TEST_ROUTES` is registered in `serverSchema` only — no NEXT_PUBLIC_ alias, no client-env entry.
- [ ] `<SubscriptionProvider>` is wrapped around `<AppShell>` only inside the verified-user branch of `(app)/layout.tsx`.
- [ ] All 13 unit tests pass (4 from Task 1, 9 from Task 2).
- [ ] `pnpm tsc --noEmit` reports zero new errors.
- [ ] `pnpm lint --max-warnings=0` passes.
- [ ] Grep confirms `__test_subscription_read_only` appears in exactly ONE place (`subscription-provider.tsx`).
- [ ] All HIGH STRIDE threats (T-05-11-01, T-05-11-02) have `mitigate` disposition with concrete implementation references in code comments.
- [ ] The Playwright fixture from 05-01 (`tests/e2e/fixtures/read-only.ts`) — created in Wave 0, NOT modified by this plan — uses `page.context().addCookies([{ name: '__test_subscription_read_only', value: '1', domain: 'localhost', path: '/' }])` to flip readOnly state per-test.

</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-11-SUMMARY.md` summarizing:
- Files created (3) and modified (2)
- Test count (13 unit tests)
- Key contract: `useSubscription(): { active: boolean; readOnly: boolean }` consumed by Wave 4 plans
- Phase 10 handoff note: replace `resolveSubscriptionState` body with real Stripe state; the hook signature stays.
</output>
