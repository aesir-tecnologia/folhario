---
phase: 05-catalog-meu-jardim
plan: 11
type: tdd
wave: 5
depends_on:
  - 05-10
files_modified:
  - src/contexts/billing/api/use-subscription.ts
  - tests/unit/contexts/billing/use-subscription.test.ts
autonomous: true
requirements: []
decisions:
  hook_path: |
    LOCKED in 05-10 `decisions.use_subscription_location` — Option (a):
    `src/contexts/billing/api/use-subscription.ts` (CONTEXT D-24 verbatim).
    All Phase 10 swaps the BODY of this file; the path is stable across
    Phase 5 → Phase 10 and across all 5b consumers.
  read_only_mode_test_harness: |
    The 'read-only mode' is a UI variant (D-24) that needs E2E coverage
    BEFORE Phase 10 swaps the hook. Strategy:
    - Hook reads `process.env.NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS`
      and returns `{ status: <env value> }` if set (test-only escape hatch);
      otherwise returns `{ status: "trialing" }` (production-default).
    - Production builds NEVER set this env var; the var is undocumented in
      `.env.example`. Threat: T-5b-11-01 (env-flag spoofing in prod) is
      mitigated by the fact that the var is read at module load — Vite/Next
      tree-shake `process.env.NEXT_PUBLIC_*` at build time so accidental
      runtime injection cannot flip the flag without a redeploy.
    - Playwright suite `tests/e2e/catalog/read-only-mode.spec.ts` (created
      by Plan 05-15 / 05-16 / 05-17 / 05-18) sets the env var at test boot
      via Playwright `webServer.env`.
    - Phase 10 swaps the hook body to read live `Subscription.status` from
      a real session/JWT; the test harness env-flag becomes a no-op.
  return_shape: |
    `{ status: SubscriptionStatus }` where
    `SubscriptionStatus = "trialing" | "active" | "expired" | "grace"`.
    Phase 10 will extend with `currentPeriodEnd`, `provider`, etc.; Phase 5
    consumers must NOT depend on those future fields. Type alias is
    co-located in this file for now (no shared `domain/` until Phase 10).
must_haves:
  truths:
    - "useSubscription() called from any client component returns { status: 'trialing' } by default (production behavior — no env override set)"
    - "useSubscription() returns { status: <value> } when NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS is set to a valid SubscriptionStatus literal"
    - "Hook PATH src/contexts/billing/api/use-subscription.ts is locked for Phase 10 swap (no rename)"
    - "Hook is a 'use client' module so it can be imported from any 5b page or primitive that needs read-only-mode gating"
    - "SubscriptionStatus type union is exported as a named TS type for downstream consumer typing"
  artifacts:
    - path: "src/contexts/billing/api/use-subscription.ts"
      provides: "useSubscription() React hook + SubscriptionStatus type alias"
      min_lines: 18
      contains: "useSubscription"
    - path: "tests/unit/contexts/billing/use-subscription.test.ts"
      provides: "RED→GREEN: hook returns trialing by default; returns env-overridden status when test-flag set; rejects unknown env values gracefully (falls back to trialing)"
      min_lines: 40
      contains: "useSubscription"
  key_links:
    - from: "src/contexts/billing/api/use-subscription.ts"
      to: "Phase 10 Subscription state machine"
      via: "BODY swap-in-place by Phase 10; PATH unchanged"
      pattern: "useSubscription"
    - from: "src/contexts/billing/api/use-subscription.ts"
      to: "5b read-only-mode UI consumers (Plans 05-15 + 05-16 + 05-17 + 05-18)"
      via: "named import"
      pattern: "useSubscription"
user_setup: []
---

<objective>
Ship the `useSubscription()` stub at the path locked by 05-10's Q3 resolution. Returns `{ status: "trialing" }` by default (production behavior) and reads an undocumented test-only env flag `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS` for the Playwright read-only-mode E2E suite to flip in 5b plans 15-18.

Purpose: D-24 says "All branches land now (hidden Add button, hidden inline-edit affordances, hidden delete overflow, persistent read-only banner stub)". The branches need a hook to gate them. Phase 10 swaps this file's body to read live `Subscription.status`; the path stays stable across the swap.

Output: 1 client hook (~18 lines) + 1 unit test (~40 lines, RED→GREEN). No layout / page changes (those land in waves 6-8).
</objective>

<execution_context>
@/Users/machado/Projects/folhario/.claude/get-shit-done/workflows/execute-plan.md
@/Users/machado/Projects/folhario/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/05-catalog-meu-jardim/05-CONTEXT.md
@.planning/phases/05-catalog-meu-jardim/05-RESEARCH.md
@.planning/phases/05-catalog-meu-jardim/05-PATTERNS.md
@.planning/phases/05-catalog-meu-jardim/05-10-tq-provider-idb-persister-i18n-PLAN.md
@.planning/phases/01-foundation/01-CONTEXT.md

<interfaces>
<!-- The hook contract that 5b consumers will rely on. Keep stable across the Phase 10 swap. -->

```ts
// src/contexts/billing/api/use-subscription.ts (THIS PLAN)
"use client";

export type SubscriptionStatus = "trialing" | "active" | "expired" | "grace";

export function useSubscription(): { status: SubscriptionStatus };
```

Consumers in 5b will write:
```tsx
"use client";
import { useSubscription } from "@contexts/billing/api/use-subscription";

const { status } = useSubscription();
const readOnly = status === "expired" || status === "grace";
// readOnly hides Add CTA, edit affordances, delete overflow; shows banner.
```

Test override pattern (5b E2E plans):
```ts
// playwright.config.ts (or per-suite override) — DO NOT add this here; documenting for 5b plans
webServer: {
  command: "pnpm dev",
  env: { NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS: "expired" },
},
```
</interfaces>
</context>

<tasks>

<task type="tdd" tdd="true">
  <name>Task 1: RED — write failing tests for useSubscription stub (default + env override + invalid override)</name>
  <files>tests/unit/contexts/billing/use-subscription.test.ts</files>
  <read_first>
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "src/contexts/billing/api/use-subscription.ts" (line 168-184) — stub contract verbatim
    - .planning/phases/05-catalog-meu-jardim/05-CONTEXT.md D-24 lines 113 — "stubbed useSubscription() hook that always returns 'trialing'"
    - tests/unit/contexts/billing/.gitkeep (5a Plan 05-01 — directory exists)
    - .planning/phases/05-catalog-meu-jardim/05-RESEARCH.md § Validation Architecture line 1521-1522 — `(D-24) useSubscription() stub returns 'trialing'` test row
  </read_first>
  <behavior>
    - Test 1 (`returns trialing by default`): no env flag set → `useSubscription()` returns `{ status: "trialing" }`
    - Test 2 (`respects valid env override`): with `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS=expired` set, returns `{ status: "expired" }`. Repeat for `active` and `grace`.
    - Test 3 (`falls back to trialing on invalid env value`): with `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS=garbage`, returns `{ status: "trialing" }` (defensive default — prevents test-misconfiguration from coercing UI into broken state)
    - Test 4 (`returns object with single status field, no extra fields`): assert `Object.keys(result)` === `["status"]` (Phase 10 may extend; consumers must not depend on absent fields)

    Tests use `renderHook` from `@testing-library/react` (already in repo per Phase 1 / Phase 3 — verify via `grep "@testing-library/react" package.json` before writing the test). If not yet installed, add `@testing-library/react@latest` and `@testing-library/dom@latest` exact-pinned dev deps inline as a deviation note (TDD plan budget allows ~10 lines of bootstrap).

    Each test mutates `process.env.NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS` via `vi.stubEnv()` + `vi.unstubAllEnvs()` in beforeEach/afterEach so tests are isolated.
  </behavior>
  <action>
    **RED step:**

    1. Verify `@testing-library/react` is installed: `grep '"@testing-library/react"' package.json`. If absent, add it as a dev dep (exact-pinned latest stable — verify version on npm first via `npm view @testing-library/react version`). For Phase 5 read-mode planning, document the version chosen in this task's commit message.

    2. Create `tests/unit/contexts/billing/use-subscription.test.ts`:
       ```ts
       import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
       import { renderHook } from "@testing-library/react";
       import { useSubscription } from "@contexts/billing/api/use-subscription";

       describe("useSubscription (Phase 5 stub)", () => {
         afterEach(() => {
           vi.unstubAllEnvs();
         });

         it("returns { status: 'trialing' } by default (no env override)", () => {
           vi.stubEnv("NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS", "");
           const { result } = renderHook(() => useSubscription());
           expect(result.current).toEqual({ status: "trialing" });
         });

         it.each(["active", "expired", "grace", "trialing"] as const)(
           "respects env override %s",
           (status) => {
             vi.stubEnv("NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS", status);
             const { result } = renderHook(() => useSubscription());
             expect(result.current).toEqual({ status });
           },
         );

         it("falls back to trialing on invalid env value", () => {
           vi.stubEnv("NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS", "garbage_value");
           const { result } = renderHook(() => useSubscription());
           expect(result.current).toEqual({ status: "trialing" });
         });

         it("returns an object whose only key is 'status'", () => {
           vi.stubEnv("NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS", "");
           const { result } = renderHook(() => useSubscription());
           expect(Object.keys(result.current)).toEqual(["status"]);
         });
       });
       ```

    3. Run `pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts` — MUST FAIL with module-not-found on `@contexts/billing/api/use-subscription`.

    4. Commit RED:
       `git add tests/unit/contexts/billing/use-subscription.test.ts package.json pnpm-lock.yaml`
       `git commit -m "test(05-11): add failing tests for useSubscription stub + env-flag override"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts 2>&amp;1 | grep -qE "(Cannot find module|Failed to resolve)" &amp;&amp; echo RED_GATE_OK</automated>
  </verify>
  <done>
    - Test file exists with 4 `it`/`it.each` blocks (1 default + 4 env-overrides via it.each + 1 invalid + 1 shape = 7 test cases)
    - Vitest fails with module-not-found on `@contexts/billing/api/use-subscription`
    - `@testing-library/react` is in package.json dependencies (or noted with version + rationale in commit message if added in this task)
    - Commit message starts with `test(05-11):`
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 2: GREEN — implement useSubscription stub at the locked path</name>
  <files>src/contexts/billing/api/use-subscription.ts</files>
  <read_first>
    - tests/unit/contexts/billing/use-subscription.test.ts (the RED tests from Task 1)
    - .planning/phases/05-catalog-meu-jardim/05-PATTERNS.md § "src/contexts/billing/api/use-subscription.ts" (line 168-184) — stub contract
    - .planning/phases/01-foundation/01-CONTEXT.md (D-29 client env split — `NEXT_PUBLIC_*` is browser-readable; this is intentional for the test override)
  </read_first>
  <behavior>
    - Module export: `useSubscription()` returns `{ status: SubscriptionStatus }`
    - Default behavior (no env flag): `{ status: "trialing" }`
    - With env flag set to valid value: returns that value
    - With env flag set to invalid value: returns `{ status: "trialing" }` (defensive default)
    - Type alias `SubscriptionStatus` is exported (named export, not default)
  </behavior>
  <action>
    **GREEN step:**

    Create `src/contexts/billing/api/use-subscription.ts`:
    ```ts
    "use client";

    /**
     * Phase 5 (D-24) stub. Phase 10 swaps the BODY of this file to read live
     * `Subscription.status` — the PATH is stable across the swap (locked by
     * Plan 05-10 decisions.use_subscription_location).
     *
     * Test-only escape hatch: NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS
     * env var lets the Playwright read-only-mode E2E suite force a non-trialing
     * status without spinning up a real subscription. The var is undocumented
     * in .env.example and tree-shaken at build time when unset (Next 16 +
     * `NEXT_PUBLIC_*` inlining), so production cannot accidentally surface
     * a forced status without a deliberate redeploy.
     */

    export type SubscriptionStatus = "trialing" | "active" | "expired" | "grace";

    const VALID_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
      "trialing",
      "active",
      "expired",
      "grace",
    ]);

    function readOverrideStatus(): SubscriptionStatus {
      const raw = process.env.NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS;
      if (typeof raw === "string" && VALID_STATUSES.has(raw as SubscriptionStatus)) {
        return raw as SubscriptionStatus;
      }
      return "trialing";
    }

    export function useSubscription(): { status: SubscriptionStatus } {
      return { status: readOverrideStatus() };
    }
    ```

    Run tests: `pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts` — MUST PASS (7 cases).
    Run typecheck: `pnpm exec tsc --noEmit` exits 0.
    Run lint: `pnpm exec eslint src/contexts/billing/` exits 0.

    Commit GREEN:
    `git add src/contexts/billing/api/use-subscription.ts`
    `git commit -m "feat(05-11): ship useSubscription Phase 5 stub at locked path per D-24"`
  </action>
  <verify>
    <automated>pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts &amp;&amp; pnpm exec tsc --noEmit &amp;&amp; grep -c "use client" src/contexts/billing/api/use-subscription.ts | grep -qE "^[1-9]"</automated>
  </verify>
  <done>
    - File `src/contexts/billing/api/use-subscription.ts` exists at the EXACT path D-24 specifies (verified by `ls`)
    - File starts with `"use client"` directive
    - Exports both `useSubscription` and `SubscriptionStatus`
    - All 7 test cases pass
    - `pnpm exec tsc --noEmit` exits 0
    - No lint errors
    - Commit message starts with `feat(05-11):`
    - File is the BODY-swap target Phase 10 will edit; comment block at top documents this contract
  </done>
</task>

</tasks>

<threat_model>

## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| process.env → React render | `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS` is browser-visible per Next 16 NEXT_PUBLIC_* convention; readable in DevTools |
| client → server (none) | Stub does NOT call any server endpoint; Phase 10 swap will introduce that boundary |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-5b-11-01 | Spoofing / Tampering | Production user spoofs read-only mode by setting `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS` in browser to bypass UI gating | accept | UI gating is UX, NOT security. Server-side enforcement (read_only_mode 402 on mutating endpoints) is the load-bearing defense per CONTEXT D-24 + 05-RESEARCH § Security Domain. The stub flag CAN be flipped by a malicious user but it cannot grant access to any server resource. Phase 10 swaps the hook to read JWT-derived status; the same mitigation logic applies. |
| T-5b-11-02 | Information Disclosure | Env-flag value visible in DevTools network/console | accept | Subscription status is not sensitive; same data is rendered visibly in the UI (read-only banner). Threat is benign. |
| T-5b-11-03 | Tampering | Phase 10 swap drifts the path | mitigate | This plan's `decisions.hook_path` block PINS the path; Plan 10 PATTERNS.md (when written) must reference it. Acceptance criterion verifies file existence at exact path. |

</threat_model>

<verification>
- `pnpm exec vitest --run --project=unit tests/unit/contexts/billing/use-subscription.test.ts` exits 0 (7 test cases pass)
- `pnpm exec tsc --noEmit` exits 0
- `ls src/contexts/billing/api/use-subscription.ts` succeeds
- `grep -c "SubscriptionStatus" src/contexts/billing/api/use-subscription.ts` returns ≥ 3 (type + Set + function signature)
- `grep -E "use client" src/contexts/billing/api/use-subscription.ts | head -1` returns the directive
</verification>

<success_criteria>
- Hook lives at `src/contexts/billing/api/use-subscription.ts` (Q3 verbatim)
- Default return: `{ status: "trialing" }` (production behavior)
- Test-only env override works for E2E suites in 5b plans 15-18
- 7 test cases all green
- File is ready for Phase 10 body-swap (PATH stable across phases)
- Commits prefixed `test(05-11):` (RED), `feat(05-11):` (GREEN)
</success_criteria>

<output>
After completion, create `.planning/phases/05-catalog-meu-jardim/05-11-SUMMARY.md` summarizing:
- Final hook signature
- The exact env-flag name `NEXT_PUBLIC_FOLHARIO_TEST_SUBSCRIPTION_STATUS` (so 5b plans 15-18 can reference it in their Playwright `webServer.env` blocks without re-reading this plan)
- Confirmation that the path is locked for Phase 10 swap
- Any version of `@testing-library/react` added if it wasn't already in package.json
</output>
</content>
</invoke>