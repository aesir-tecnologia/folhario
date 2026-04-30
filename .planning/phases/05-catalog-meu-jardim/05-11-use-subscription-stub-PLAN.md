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
    - "When the server is started with `SUBSCRIPTION_READ_ONLY=1`, `useSubscription()` returns `{ active: true, readOnly: true }` for every client component under (app)/."
    - "The `SUBSCRIPTION_READ_ONLY` environment variable is server-only (no NEXT_PUBLIC_ prefix) and is never inlined into the client bundle as a literal."
    - "Production builds (NODE_ENV=production) ignore `SUBSCRIPTION_READ_ONLY` unless the operator deliberately sets it; default value is undefined → readOnly false."
    - "The Playwright fixture `tests/e2e/fixtures/read-only.ts` (created in 05-01) flips this state by setting the env var on the dev server, with no other client-side intervention."
  artifacts:
    - path: "src/contexts/billing/application/use-subscription.ts"
      provides: "useSubscription() client hook returning { active: boolean; readOnly: boolean }"
      exports: ["useSubscription", "type SubscriptionState"]
    - path: "src/contexts/billing/application/subscription-provider.tsx"
      provides: "Server entry SubscriptionProvider that reads SUBSCRIPTION_READ_ONLY and feeds a client-side React context provider"
      exports: ["SubscriptionProvider"]
    - path: "src/contexts/billing/application/use-subscription.unit.test.ts"
      provides: "Vitest unit-dom coverage for the hook + provider env-flip behavior"
    - path: "src/app/(app)/layout.tsx"
      provides: "Wraps the (app) tree in <SubscriptionProvider> so every catalog/profile/journal route can call useSubscription()"
  key_links:
    - from: "src/contexts/billing/application/subscription-provider.tsx"
      to: "process.env.SUBSCRIPTION_READ_ONLY"
      via: "server-component module read at SSR time"
      pattern: "process\\.env\\.SUBSCRIPTION_READ_ONLY"
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
Ship the Phase 5 stub for `useSubscription()` that catalog UI surfaces (Add Plant button, inline-edit fields, delete overflow, "+ Foto", `<ReadOnlyBanner>`) consume to gate mutating affordances per D-21. The stub returns `{ active: true, readOnly: false }` constant in production-shape contexts; an environment-variable flip (`SUBSCRIPTION_READ_ONLY=1`) toggles `readOnly: true` for the Playwright read-only-mode E2E specs (`tests/e2e/fixtures/read-only.ts` created in 05-01 wires that env into the dev server).

Purpose: every Wave 4 UI plan (05-15..05-18) needs a single import target whose readOnly value is deterministic, mockable for E2E, and forward-compatible with Phase 10's real Stripe wiring. Ship the contract NOW so Wave 4 plans don't all roll their own.

Output:
- `useSubscription()` client hook (returns `{ active, readOnly }`)
- `<SubscriptionProvider>` server component that reads env once at SSR boundary and passes the resolved value to a client React context
- Hook wired into `(app)/layout.tsx` so every authenticated route can consume it
- Unit tests proving constant return + env-flip behavior + threat model invariants
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
     code must NOT read process.env.SUBSCRIPTION_READ_ONLY directly.

     Pattern reused from playwright.config.ts:93 — IDENTIFICATION_PROVIDER_MODE
     is set at webServer launch and read by Server Components / route handlers
     at request time. Same shape applies to SUBSCRIPTION_READ_ONLY. -->

From src/shared/config/server-env.ts (Phase 1 D-29 — server-only env):
```typescript
export const serverSchema = z.object({
  // ... existing entries ...
  IDENTIFICATION_PROVIDER_MODE: z.enum(["stub", "real"]).default("stub"),
  // After this plan ships:
  // SUBSCRIPTION_READ_ONLY: optional(z.enum(["1", "0"])).default(undefined),
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
  readOnly: boolean;   // Phase 5: env-flip via SUBSCRIPTION_READ_ONLY=1
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
     The recommendation in 05-RESEARCH.md Open Q1 ("Set
     SUBSCRIPTION_READ_ONLY=1 in the webServer env") is honored by this
     option — the env is read server-side, then propagated via context. -->

**Server reads env → React context → client hook consumes** (option 1).
</design_decision>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Define SubscriptionState contract + register SUBSCRIPTION_READ_ONLY in server-env</name>
  <files>
    src/contexts/billing/application/use-subscription.ts (NEW),
    src/shared/config/server-env.ts (MODIFY)
  </files>
  <behavior>
    - Test 1 (server-env schema): when `SUBSCRIPTION_READ_ONLY` is unset, `serverEnv.SUBSCRIPTION_READ_ONLY` is `undefined`.
    - Test 2 (server-env schema): when `SUBSCRIPTION_READ_ONLY=1`, `serverEnv.SUBSCRIPTION_READ_ONLY === "1"`.
    - Test 3 (server-env schema): when `SUBSCRIPTION_READ_ONLY=anything-else`, schema parse must NOT throw (treat any non-"1" value as falsy/disabled — fail-closed for read-only).
    - Test 4 (hook contract): `SubscriptionState` is `{ active: boolean; readOnly: boolean }` — both required, both boolean. (Compile-time check via tsc.)
  </behavior>
  <action>
    Create `src/contexts/billing/application/use-subscription.ts` per D-21, exporting:
      - `export type SubscriptionState = { active: boolean; readOnly: boolean }`
      - `export const SubscriptionContext` — a React Context with default value `{ active: true, readOnly: false }` (the production-shape constant per D-21).
      - `export function useSubscription(): SubscriptionState` — `"use client"` directive at top of file; thin wrapper around `useContext(SubscriptionContext)`.

    File header convention: copy the comment block style from `src/shared/online/use-online-status.ts:1-23` (terse multi-line summary referencing D-21 and Phase 10's planned replacement).

    Register the env var in `src/shared/config/server-env.ts`:
      - Add `SUBSCRIPTION_READ_ONLY: optional(z.string().min(1))` to `serverSchema` (use the existing `optional` helper at line 3).
      - Add a comment block above it explaining: "Phase 5 D-21 stub-flip flag. Set to '1' in test environments only (Playwright fixtures/tests/e2e/fixtures/read-only.ts). Server-only — no NEXT_PUBLIC_ prefix per Phase 1 D-29 and Phase 4 WR-08. Production env never sets this."
      - Do NOT add it to client-env.ts. The flag is server-only.

    No fallback consumer logic in this task — Task 2 ships the provider that reads the env and feeds the context.

    Per D-21 (using @ alias paths configured in tsconfig): file path is `src/contexts/billing/application/use-subscription.ts` exactly. No other location. The directory currently contains only a `.gitkeep`.
  </action>
  <verify>
    <automated>pnpm test:unit --project=unit-dom -- src/contexts/billing/application/use-subscription</automated>
  </verify>
  <done>
    - `use-subscription.ts` exists with `SubscriptionState` type, `SubscriptionContext`, `useSubscription` exports.
    - `server-env.ts` accepts `SUBSCRIPTION_READ_ONLY` as an optional string env var.
    - Unit tests pass (4 tests).
    - `pnpm tsc --noEmit` reports zero new errors.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Server SubscriptionProvider that reads env + feeds client context, wired into (app)/layout.tsx</name>
  <files>
    src/contexts/billing/application/subscription-provider.tsx (NEW),
    src/contexts/billing/application/use-subscription.unit.test.ts (NEW),
    src/app/(app)/layout.tsx (MODIFY)
  </files>
  <behavior>
    - Test 1 (default state): rendering a child component that calls `useSubscription()` inside `<SubscriptionProvider initialState={{ active: true, readOnly: false }}>` returns `{ active: true, readOnly: false }`.
    - Test 2 (read-only flip): rendering inside `<SubscriptionProvider initialState={{ active: true, readOnly: true }}>` returns `{ active: true, readOnly: true }`.
    - Test 3 (no provider, default fallback): a component calling `useSubscription()` outside any provider receives the context default `{ active: true, readOnly: false }` (no throw — graceful default per D-21 production constant).
    - Test 4 (env resolution helper): `resolveSubscriptionStateFromEnv({ SUBSCRIPTION_READ_ONLY: "1" })` returns `{ active: true, readOnly: true }`.
    - Test 5 (env resolution helper): `resolveSubscriptionStateFromEnv({ SUBSCRIPTION_READ_ONLY: undefined })` returns `{ active: true, readOnly: false }`.
    - Test 6 (env resolution helper): `resolveSubscriptionStateFromEnv({ SUBSCRIPTION_READ_ONLY: "0" })` returns `{ active: true, readOnly: false }` (anything other than "1" is falsy — fail-closed for the read-only mode).
    - Test 7 (env resolution helper): `resolveSubscriptionStateFromEnv({ SUBSCRIPTION_READ_ONLY: "true" })` returns `{ active: true, readOnly: false }` (strict "1" check; we DO NOT accept truthy strings — keeps the surface tight and avoids accidental enablement).

    All tests live in a single file: `src/contexts/billing/application/use-subscription.unit.test.ts`. Use `@testing-library/react` (already in the unit-dom project) for the render tests; use plain Vitest for the env-resolver tests.
  </behavior>
  <action>
    Create `src/contexts/billing/application/subscription-provider.tsx`. This file has TWO surfaces:

    1. **Pure helper (testable in isolation, no React)**:
       ```ts
       export function resolveSubscriptionStateFromEnv(env: { SUBSCRIPTION_READ_ONLY?: string | undefined }): SubscriptionState {
         const readOnly = env.SUBSCRIPTION_READ_ONLY === "1";
         return { active: true, readOnly };
       }
       ```
       Strict equality with `"1"` only — anything else (undefined, "0", "true", "yes", "TRUE", garbage) is falsy. This is the threat T-05-11-01 mitigation: the flag is read at the server boundary with a tight check; client cannot influence it; production env never sets it.

    2. **Server entry (no `"use client"` — runs at SSR boundary)**:
       ```tsx
       import { serverEnv } from "@shared/config/server-env";
       import { SubscriptionContextClient } from "./subscription-provider.client";

       export function SubscriptionProvider({ children }: { children: ReactNode }) {
         const state = resolveSubscriptionStateFromEnv({
           SUBSCRIPTION_READ_ONLY: serverEnv.SUBSCRIPTION_READ_ONLY,
         });
         return <SubscriptionContextClient initialState={state}>{children}</SubscriptionContextClient>;
       }
       ```

    3. **Client provider** (split into a SECOND file `subscription-provider.client.tsx` because Server Components cannot directly render `<Context.Provider>` — Next 16 App Router requires client-side context wiring to live in a `"use client"` module):
       ```tsx
       "use client";
       import { SubscriptionContext, type SubscriptionState } from "./use-subscription";
       export function SubscriptionContextClient({ initialState, children }: { initialState: SubscriptionState; children: ReactNode }) {
         return <SubscriptionContext.Provider value={initialState}>{children}</SubscriptionContext.Provider>;
       }
       ```

    Files created in this task:
       - `src/contexts/billing/application/subscription-provider.tsx` (server entry; exports `SubscriptionProvider` + `resolveSubscriptionStateFromEnv`)
       - `src/contexts/billing/application/subscription-provider.client.tsx` (`"use client"`; exports `SubscriptionContextClient`)
       - `src/contexts/billing/application/use-subscription.unit.test.ts` (the 7 behavior tests)

    Update the `files_modified` interpretation: the .client.tsx companion is a Next.js App Router idiom for Server-passes-data-to-Client-Context, not a separate concern. It lives in the same directory and is treated as part of the provider artifact. (Listed in this task's files; will be added to plan-level `files_modified` if validator demands a complete list.)

    Modify `src/app/(app)/layout.tsx`:
      - Import `SubscriptionProvider` from `@contexts/billing/application/subscription-provider`.
      - Wrap the existing `<AppShell>{children}</AppShell>` return value: change to `<SubscriptionProvider><AppShell>{children}</AppShell></SubscriptionProvider>`.
      - Place the wrap INSIDE the verified-user gate (line 52) — unverified users render `<UnverifiedBlocker />` and DO NOT need a subscription provider. This keeps the provider tree minimal and avoids touching the unverified path.
      - Do NOT modify the AppShell internals or the ReadOnlyBanner. Plan 05-18 wires the banner's `active` prop from `useSubscription()`.

    Test setup notes:
      - The default-context-fallback test (Test 3) renders without `<SubscriptionProvider>` — relies on the default value baked into the `createContext()` call in Task 1.
      - The render tests (Tests 1, 2, 3) import `SubscriptionContextClient` directly; they DO NOT exercise the server entry (which depends on `serverEnv` and is therefore harder to mock cleanly in unit-dom). The env-resolver tests (Tests 4-7) cover the server-side branch by calling `resolveSubscriptionStateFromEnv` with explicit input — no `process.env` mutation needed.
      - Use `act` from `@testing-library/react` for any state-affecting assertions (Phase 3 unit-dom convention).
  </action>
  <verify>
    <automated>pnpm test:unit --project=unit-dom -- src/contexts/billing/application/use-subscription.unit.test.ts</automated>
  </verify>
  <done>
    - `subscription-provider.tsx` exists with `SubscriptionProvider` (server) + `resolveSubscriptionStateFromEnv` (pure helper) exports.
    - `subscription-provider.client.tsx` exists with `SubscriptionContextClient` (client) export.
    - All 7 unit tests pass.
    - `(app)/layout.tsx` wraps the verified-user branch in `<SubscriptionProvider>`.
    - `pnpm tsc --noEmit` reports zero new errors.
    - `pnpm lint` reports zero new errors.
    - `grep -n "process.env.SUBSCRIPTION_READ_ONLY" src/` returns ONE hit only — inside `subscription-provider.tsx` (via `serverEnv`), confirming no client-side direct read.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Process env → SSR | Server reads `SUBSCRIPTION_READ_ONLY` at request time inside `<SubscriptionProvider>` (Server Component). Untrusted input does not cross this boundary in production — only operators set process env. |
| SSR → client bundle | Resolved `SubscriptionState` value crosses the wire as React props on the client provider. The literal env value never leaves the server. |
| Client → Server | No path. `useSubscription()` is read-only on the client; mutating the value requires changing process env on the server. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-05-11-01 | E (Elevation of Privilege) | `subscription-provider.tsx` env read | mitigate | Env is server-evaluated at SSR boundary via `serverEnv.SUBSCRIPTION_READ_ONLY`. Strict equality check (`=== "1"`) means accidental truthy strings (`"true"`, `"yes"`) do NOT enable read-only mode — fail-closed (open) for legitimate users. The flag has NO `NEXT_PUBLIC_` prefix per Phase 1 D-29 and Phase 4 WR-08, so its value is never inlined into the client JS bundle. Production deployments never set this var; it is a test-only switch. |
| T-05-11-02 | I (Information Disclosure) | API responses + client bundle | mitigate | Hook lives client-side only; no API surface returns the literal `SUBSCRIPTION_READ_ONLY` value, the resolved `readOnly` boolean, or any signal about the env var's presence. The boolean reaches the client only as a React context value scoped to the (app) tree — it never appears in JSON responses, request headers, or analytics events. Phase 10 will wire server truth (Stripe state) replacing this stub; the surface remains the same. |
| T-05-11-03 | T (Tampering) | Client bundle React context | accept | The client receives the `SubscriptionState` value via React props. A determined attacker with browser devtools CAN mutate the in-memory context to flip `readOnly` to `false` locally, but every mutating server action under `/api/v1/*` independently enforces server-side checks (Phase 4 D-21 `requireVerifiedUser`; Phase 10 will add subscription gating). The hook is a UI-affordance gate, NOT a security boundary. Acceptable: flipping it client-side gives the attacker hidden buttons that 4xx on submit. |
| T-05-11-04 | R (Repudiation) | Stub vs real subscription state | accept | Phase 5 stub returns a constant; there is no audit trail of "subscription state at time T" because there is no real state yet. Phase 10 will add Stripe webhook ingest + audit logs. Acceptable for stub. |
| T-05-11-05 | D (Denial of Service) | env read on every SSR | accept | `process.env` access is sub-microsecond; no rate-limit risk. The Server Component re-reads env per request (consistent with Next 16 App Router model). No caching layer needed. |

`block_on_high: true` per outline. T-05-11-01 and T-05-11-02 are HIGH severity and BOTH are mitigated. No unmitigated HIGHs.
</threat_model>

<verification>

## Plan-Level Checks

After both tasks complete, run:

```bash
# Unit tests for the hook + provider + env resolver
pnpm test:unit --project=unit-dom -- src/contexts/billing/application/use-subscription

# Type-check the whole tree (touches (app)/layout.tsx so widen the net)
pnpm tsc --noEmit

# Lint
pnpm lint --max-warnings=0

# Confirm no client-side direct env read
grep -rn "SUBSCRIPTION_READ_ONLY" src/
# Expected: exactly TWO hits — server-env.ts (registration) and subscription-provider.tsx (consumption via serverEnv).
# ZERO hits in any "use client" module or under src/app/ outside of (app)/layout.tsx.

# Confirm the provider wraps the verified-user branch only
grep -n "SubscriptionProvider" src/app/\(app\)/layout.tsx
# Expected: ONE wrap, inside the verified-user return.

# Confirm no NEXT_PUBLIC_ leak
grep "NEXT_PUBLIC_SUBSCRIPTION" src/shared/config/client-env.ts
# Expected: ZERO hits (the flag is server-only).
```

## Integration with Wave 4 Plans

This plan does NOT consume any UI surface — it only ships the contract. Wave 4 plans (05-15..05-18) import `useSubscription` and:
- Hide Add Plant button when `readOnly: true` (05-15)
- Render inline-edit fields as read-only text when `readOnly: true` (05-16)
- Hide delete overflow item when `readOnly: true` (05-16)
- Hide "+ Foto" button when `readOnly: true` (05-17)
- Flip `<ReadOnlyBanner active={readOnly} />` (05-18 modifies app-shell.tsx)

This plan's verification ends at: hook + provider exist, env-flip works, layout wires the provider. Functional E2E happens in Wave 4 via `tests/e2e/fixtures/read-only.ts` (created in 05-01) which sets `SUBSCRIPTION_READ_ONLY=1` on the dev server and asserts the affordances disappear.

</verification>

<success_criteria>

- [ ] `useSubscription()` is callable from any client component under `(app)/` and returns `{ active: true, readOnly: false }` by default.
- [ ] Setting `SUBSCRIPTION_READ_ONLY=1` on the Node process flips the value to `{ active: true, readOnly: true }` for all subsequent requests.
- [ ] `SUBSCRIPTION_READ_ONLY` is registered in `serverSchema` only — no NEXT_PUBLIC_ alias, no client-env entry.
- [ ] `<SubscriptionProvider>` is wrapped around `<AppShell>` only inside the verified-user branch of `(app)/layout.tsx`.
- [ ] All 11 unit tests pass (4 from Task 1, 7 from Task 2).
- [ ] `pnpm tsc --noEmit` reports zero new errors.
- [ ] `pnpm lint --max-warnings=0` passes.
- [ ] Grep confirms `process.env.SUBSCRIPTION_READ_ONLY` appears in exactly ONE place (`server-env.ts` parse input — implicitly via `process.env`); the resolved value is read via `serverEnv.SUBSCRIPTION_READ_ONLY` in exactly ONE client-call site (`subscription-provider.tsx`).
- [ ] All HIGH STRIDE threats (T-05-11-01, T-05-11-02) have `mitigate` disposition with concrete implementation references in code comments.
- [ ] The Playwright fixture from 05-01 (`tests/e2e/fixtures/read-only.ts`) — created in Wave 0, NOT modified by this plan — has a working env-flip target.

</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-11-SUMMARY.md` summarizing:
- Files created (3) and modified (2)
- Test count (11 unit tests)
- Key contract: `useSubscription(): { active: boolean; readOnly: boolean }` consumed by Wave 4 plans
- Phase 10 handoff note: replace `resolveSubscriptionStateFromEnv` body with real Stripe state; the hook signature stays.
</output>
